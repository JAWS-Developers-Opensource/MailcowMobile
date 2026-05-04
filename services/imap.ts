/**
 * IMAP Service
 *
 * Handles IMAP connections for reading emails.
 * In a React Native / Expo context, direct TCP IMAP connections require a
 * native module or a proxy backend. This service provides the interface that
 * connects to either:
 *   1. A Mailcow REST API proxy endpoint (preferred), or
 *   2. A native TCP socket bridge (via expo-modules or a community package).
 *
 * The current implementation shows the API contract and mocks data so the UI
 * can be developed and tested independently.
 */

import type { Email, EmailFolder, MailcowAccount } from '../types';

export class ImapService {
  private account: MailcowAccount;
  private baseUrl: string;

  constructor(account: MailcowAccount) {
    this.account = account;
    // Mailcow provides a REST API at https://<host>/api/v1
    this.baseUrl = `https://${account.imapHost}/api/v1`;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /** Fetch the list of IMAP folders/mailboxes. */
  async getFolders(): Promise<EmailFolder[]> {
    // TODO: Replace with real API / native IMAP call
    return [
      { name: 'Inbox', path: 'INBOX', unreadCount: 3, totalCount: 42 },
      { name: 'Sent', path: 'Sent', unreadCount: 0, totalCount: 120 },
      { name: 'Drafts', path: 'Drafts', unreadCount: 0, totalCount: 5 },
      { name: 'Junk', path: 'Junk', unreadCount: 1, totalCount: 8 },
      { name: 'Trash', path: 'Trash', unreadCount: 0, totalCount: 15 },
    ];
  }

  /** Fetch emails from a folder, with pagination. */
  async getEmails(
    folder: string,
    page = 1,
    limit = 25,
  ): Promise<Email[]> {
    // TODO: Replace with real IMAP fetch
    const mock: Email[] = [
      {
        id: '1',
        uid: 1001,
        folder,
        subject: 'Welcome to Mailcow',
        from: { name: 'Mailcow Team', address: 'noreply@mailcow.email' },
        to: [{ address: this.account.emailAddress }],
        date: new Date().toISOString(),
        bodyText: 'Welcome to your new Mailcow server!',
        isRead: false,
        isFlagged: false,
        hasAttachments: false,
      },
      {
        id: '2',
        uid: 1002,
        folder,
        subject: 'Server maintenance scheduled',
        from: { name: 'Admin', address: `admin@${this.account.imapHost}` },
        to: [{ address: this.account.emailAddress }],
        date: new Date(Date.now() - 86400000).toISOString(),
        bodyText: 'Scheduled maintenance window: Saturday 02:00–04:00 UTC.',
        isRead: true,
        isFlagged: true,
        hasAttachments: false,
      },
    ];
    return mock.slice((page - 1) * limit, page * limit);
  }

  /** Fetch a single email's full content (body, attachments). */
  async getEmail(folder: string, uid: number): Promise<Email | null> {
    const emails = await this.getEmails(folder);
    return emails.find((e) => e.uid === uid) ?? null;
  }

  /** Mark an email as read/unread on the server. */
  async setReadFlag(folder: string, uid: number, isRead: boolean): Promise<void> {
    // TODO: IMAP STORE command / API call
    console.warn('setReadFlag not yet implemented', { folder, uid, isRead });
  }

  /** Move an email to a different folder. */
  async moveEmail(folder: string, uid: number, destination: string): Promise<void> {
    // TODO: IMAP MOVE / COPY + EXPUNGE
    console.warn('moveEmail not yet implemented', { folder, uid, destination });
  }

  /** Permanently delete an email. */
  async deleteEmail(folder: string, uid: number): Promise<void> {
    // TODO: IMAP STORE \Deleted + EXPUNGE
    console.warn('deleteEmail not yet implemented', { folder, uid });
  }
}
