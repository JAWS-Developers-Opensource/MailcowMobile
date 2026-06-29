/**
 * IMAP Service
 *
 * Real IMAP4rev1 implementation connecting directly to the user's Mailcow server.
 * Uses the ImapClient TCP layer (react-native-tcp-socket) — requires a custom
 * Expo dev client or an EAS production build.
 *
 * Falls back with a clear error if the native module is unavailable (Expo Go).
 */

import type { Email, EmailFolder, MailcowAccount } from '../types';
import { ImapClient } from './ImapClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check whether the TCP socket module is available at runtime. */
function isTcpAvailable(): boolean {
  try {
    require('react-native-tcp-socket');
    return true;
  } catch {
    return false;
  }
}

const TCP_UNAVAILABLE =
  'IMAP requires a custom Expo dev client or production build. ' +
  'Run: npx expo prebuild && npx expo run:android (or run:ios)';

// ─── ImapService ─────────────────────────────────────────────────────────────

export class ImapService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  private logDebug(step: string, details?: Record<string, unknown>): void {
    const prefix = `[IMAP:${this.account.emailAddress}] ${step}`;
    if (details) {
      console.log(prefix, details);
      return;
    }
    console.log(prefix);
  }

  /** Open a short-lived authenticated IMAP connection, run a callback, then close. */
  private async withConnection<T>(
    password: string,
    fn: (client: ImapClient) => Promise<T>,
  ): Promise<T> {
    if (!isTcpAvailable()) throw new Error(TCP_UNAVAILABLE);

    const startedAt = Date.now();
    this.logDebug('withConnection:start', {
      host: this.account.imapHost,
      port: this.account.imapPort,
      tls: this.account.imapTls,
    });

    const client = new ImapClient();
    await client.connect({
      host: this.account.imapHost,
      port: this.account.imapPort,
      tls: this.account.imapTls,
    });
    this.logDebug('connect:ok', { elapsedMs: Date.now() - startedAt });

    try {
      // STARTTLS on plain port 143
      if (!this.account.imapTls && this.account.imapPort !== 993) {
        this.logDebug('capability:before-starttls');
        const caps = await client.capability();
        this.logDebug('capability:after-starttls-check', { capabilities: caps });
        if (caps.some((c) => c === 'STARTTLS')) {
          this.logDebug('starttls:begin');
          await client.startTls();
          this.logDebug('starttls:ok');
        }
      }

      this.logDebug('login:begin', { username: this.account.username });
      await client.login(this.account.username, password);
      this.logDebug('login:ok');
      const result = await fn(client);
      this.logDebug('withConnection:operation:ok', { elapsedMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.logDebug('withConnection:error', {
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      });
      throw error;
    } finally {
      this.logDebug('disconnect:begin');
      await client.disconnect();
      this.logDebug('disconnect:done', { totalElapsedMs: Date.now() - startedAt });
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Verify IMAP credentials by opening an authenticated session. */
  async verifyCredentials(password: string): Promise<void> {
    this.logDebug('verifyCredentials:start');
    await this.withConnection(password, async (client) => {
      // Run a lightweight command after LOGIN to ensure session is usable.
      this.logDebug('verifyCredentials:capability:begin');
      await client.capability();
      this.logDebug('verifyCredentials:capability:ok');
    });
    this.logDebug('verifyCredentials:ok');
  }

  /** Fetch the list of IMAP folders/mailboxes. */
  async getFolders(password: string): Promise<EmailFolder[]> {
    return this.withConnection(password, async (client) => {
      const list = await client.list('', '*');
      const folders: EmailFolder[] = [];

      for (const item of list) {
        // Skip non-selectable folders (e.g. parent namespaces)
        if (item.flags.includes('\\Noselect')) continue;

        let unreadCount = 0;
        let totalCount = 0;
        try {
          const info = await client.examine(item.name);
          totalCount = info.exists;
          unreadCount = info.unseen ?? 0;
        } catch { /* ignore errors for individual folders */ }

        folders.push({
          name: item.name.split(item.delimiter || '/').pop() ?? item.name,
          path: item.name,
          unreadCount,
          totalCount,
        });
      }

      return folders;
    });
  }

  /** Fetch emails from a folder, newest first, with pagination. */
  async getEmails(
    folder: string,
    password: string,
    page = 1,
    limit = 25,
  ): Promise<Email[]> {
    return this.withConnection(password, async (client) => {
      const info = await client.select(folder);
      if (info.exists === 0) return [];

      // Compute sequence set for the page (newest first)
      const high = Math.max(1, info.exists - (page - 1) * limit);
      const low = Math.max(1, high - limit + 1);
      const seqSet = `${low}:${high}`;

      const fetched = await client.fetch(
        seqSet,
        '(UID FLAGS RFC822.SIZE INTERNALDATE ENVELOPE)',
      );

      const emails: Email[] = fetched.reverse().map((f) => {
        const env = f.envelope ?? {};
        const flags = f.flags ?? [];
        return {
          id: String(f.uid ?? f.seq),
          uid: f.uid ?? f.seq,
          folder,
          subject: env.subject ?? '(No subject)',
          from: env.from?.[0]
            ? { name: env.from[0].name, address: env.from[0].email }
            : { address: 'unknown@unknown' },
          to: (env.to ?? []).map((a) => ({ name: a.name, address: a.email })),
          cc: (env.cc ?? []).map((a) => ({ name: a.name, address: a.email })),
          date: f.internalDate ?? new Date().toISOString(),
          isRead: flags.includes('\\Seen'),
          isFlagged: flags.includes('\\Flagged'),
          hasAttachments: false, // full detection requires BODYSTRUCTURE
        };
      });

      return emails;
    });
  }

  /** Fetch a single email's full content (headers + body). */
  async getEmail(folder: string, uid: number, password: string): Promise<Email | null> {
    return this.withConnection(password, async (client) => {
      await client.select(folder);
      const fetched = await client.uidFetch(
        String(uid),
        '(UID FLAGS RFC822.SIZE INTERNALDATE ENVELOPE BODY[])',
      );
      if (fetched.length === 0) return null;

      const f = fetched[0];
      const env = f.envelope ?? {};
      const flags = f.flags ?? [];

      return {
        id: String(uid),
        uid,
        folder,
        subject: env.subject ?? '(No subject)',
        from: env.from?.[0]
          ? { name: env.from[0].name, address: env.from[0].email }
          : { address: 'unknown@unknown' },
        to: (env.to ?? []).map((a) => ({ name: a.name, address: a.email })),
        cc: (env.cc ?? []).map((a) => ({ name: a.name, address: a.email })),
        date: f.internalDate ?? new Date().toISOString(),
        bodyText: f.bodyText,
        bodyHtml: f.bodyHtml,
        isRead: flags.includes('\\Seen'),
        isFlagged: flags.includes('\\Flagged'),
        hasAttachments: false,
      };
    });
  }

  /** Mark an email as read or unread on the server. */
  async setReadFlag(folder: string, uid: number, isRead: boolean, password: string): Promise<void> {
    await this.withConnection(password, async (client) => {
      await client.select(folder);
      await client.uidStore(String(uid), '\\Seen', isRead ? '+' : '-');
    });
  }

  /** Toggle the \\Flagged (starred) flag. */
  async setFlaggedFlag(folder: string, uid: number, isFlagged: boolean, password: string): Promise<void> {
    await this.withConnection(password, async (client) => {
      await client.select(folder);
      await client.uidStore(String(uid), '\\Flagged', isFlagged ? '+' : '-');
    });
  }

  /** Move an email to a different folder. */
  async moveEmail(folder: string, uid: number, destination: string, password: string): Promise<void> {
    await this.withConnection(password, async (client) => {
      await client.select(folder);
      await client.uidCopy(String(uid), destination);
      await client.uidStore(String(uid), '\\Deleted', '+');
      await client.expunge();
    });
  }

  /** Permanently delete an email (mark \\Deleted + EXPUNGE). */
  async deleteEmail(folder: string, uid: number, password: string): Promise<void> {
    await this.withConnection(password, async (client) => {
      await client.select(folder);
      await client.uidStore(String(uid), '\\Deleted', '+');
      await client.expunge();
    });
  }

  /** Save a draft to the Drafts folder via APPEND. */
  async saveDraft(rawMessage: string, password: string): Promise<void> {
    await this.withConnection(password, async (client) => {
      await client.append('Drafts', rawMessage, '\\Draft');
    });
  }
}
