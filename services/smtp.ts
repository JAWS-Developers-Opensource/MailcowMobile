/**
 * SMTP Service
 *
 * Handles sending emails via SMTP.
 * Direct SMTP from React Native requires a native module or a backend proxy.
 * This service provides the contract; a real implementation would use
 * a Mailcow API endpoint or a dedicated mail-sending proxy.
 */

import type { ComposeEmailPayload, MailcowAccount } from '../types';

export class SmtpService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  /**
   * Send an email.
   * @throws {Error} if sending fails
   */
  async sendEmail(payload: ComposeEmailPayload): Promise<void> {
    // TODO: Replace with real SMTP call (native module) or REST API proxy
    console.warn('SmtpService.sendEmail called (mock)', payload);

    // Example of what a real implementation might look like using a proxy:
    // const response = await fetch(`https://${this.account.smtpHost}/api/v1/send`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    //   body: JSON.stringify(payload),
    // });
    // if (!response.ok) throw new Error(`SMTP error: ${response.status}`);
  }
}
