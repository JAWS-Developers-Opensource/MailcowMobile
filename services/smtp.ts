/**
 * SMTP Service
 *
 * Real SMTP implementation connecting directly to the user's Mailcow server.
 * Uses the SmtpClient TCP layer (react-native-tcp-socket) — requires a custom
 * Expo dev client or an EAS production build.
 *
 * Supported:
 *   - Direct TLS / SMTPS (port 465)
 *   - Submission with STARTTLS (port 587)
 *   - AUTH LOGIN and AUTH PLAIN
 */

import type { ComposeEmailPayload, MailcowAccount } from '../types';
import { SmtpClient } from './SmtpClient';

function isTcpAvailable(): boolean {
  try {
    require('react-native-tcp-socket');
    return true;
  } catch {
    return false;
  }
}

const TCP_UNAVAILABLE =
  'SMTP requires a custom Expo dev client or production build. ' +
  'Run: npx expo prebuild && npx expo run:android (or run:ios)';

export class SmtpService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  /**
   * Send an email via SMTP directly to the user's Mailcow server.
   * @throws {Error} if sending fails
   */
  async sendEmail(payload: ComposeEmailPayload, password: string): Promise<void> {
    if (!isTcpAvailable()) throw new Error(TCP_UNAVAILABLE);

    const options = {
      host: this.account.smtpHost,
      port: this.account.smtpPort,
      tls: this.account.smtpTls && this.account.smtpPort === 465,
    };

    const client = new SmtpClient();
    try {
      await client.connect(options);
      await client.sendMessage(this.account.username, password, {
        from: this.account.emailAddress,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject: payload.subject,
        bodyText: payload.bodyText,
        bodyHtml: payload.bodyHtml,
      }, options);
    } finally {
      await client.disconnect();
    }
  }
}
