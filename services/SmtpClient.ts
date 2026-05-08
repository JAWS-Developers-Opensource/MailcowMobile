/**
 * SMTP TCP Client
 *
 * Implements RFC 5321 SMTP over a react-native-tcp-socket connection.
 * Supports:
 *   - Direct TLS (SMTPS, port 465)
 *   - STARTTLS (submission, port 587)
 *   - AUTH LOGIN and AUTH PLAIN
 *   - UTF-8 encoded headers via SMTPUTF8 (if advertised)
 *
 * Requires a custom Expo dev client or EAS production build.
 */

import TcpSocketModule from 'react-native-tcp-socket';
const TcpSocket = TcpSocketModule;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmtpConnectOptions {
  host: string;
  port: number;
  /** true = implicit TLS (SMTPS port 465); false = plain + optional STARTTLS */
  tls: boolean;
}

export interface SmtpMessage {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
  inReplyTo?: string;
}

// ─── SmtpClient ──────────────────────────────────────────────────────────────

export class SmtpClient {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private buffer = '';
  private capabilities: string[] = [];
  private connected = false;

  // ─── Connection ────────────────────────────────────────────────────────────

  connect(options: SmtpConnectOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SMTP connection timed out')), 15000);

      this.socket = TcpSocket.createConnection(
        {
          host: options.host,
          port: options.port,
          tls: options.tls,
          tlsCheckValidity: false,
        },
        () => {
          clearTimeout(timeout);
          this.connected = true;
          // Wait for 220 greeting
          this.waitForCode(220).then(() => resolve()).catch(reject);
        },
      );

      this.socket.on('data', (data: Buffer | string) => {
        this.buffer += typeof data === 'string' ? data : data.toString('utf8');
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket && this.connected) {
      try { await this.sendLine('QUIT'); } catch { /* ignore */ }
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  // ─── Low-level ─────────────────────────────────────────────────────────────

  private sendLine(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('SMTP: not connected'));
      }
      this.socket.write(`${line}\r\n`, 'utf8', (err?: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Collect complete response lines from the buffer and return them.
   * SMTP responses end when we see a line matching /^\d{3} / (no dash).
   */
  private waitForCode(expectedCode: number, timeoutMs = 10000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`SMTP timeout waiting for ${expectedCode}`)), timeoutMs);

      const poll = () => {
        // Extract complete lines from buffer
        const lines: string[] = [];
        let pos = 0;
        let end: number;
        while ((end = this.buffer.indexOf('\r\n', pos)) !== -1) {
          lines.push(this.buffer.slice(pos, end));
          pos = end + 2;
        }
        this.buffer = this.buffer.slice(pos);

        if (lines.length === 0) {
          setTimeout(poll, 50);
          return;
        }

        // Find the final response line (code followed by space)
        const finalLine = lines.find((l) => l.match(/^\d{3} /));
        if (!finalLine) {
          // Only continuation lines so far, keep polling
          setTimeout(poll, 50);
          return;
        }

        clearTimeout(deadline);
        const code = parseInt(finalLine.slice(0, 3), 10);
        if (code === expectedCode) {
          resolve(lines);
        } else {
          reject(new Error(`SMTP unexpected response ${code} (expected ${expectedCode}): ${finalLine}`));
        }
      };

      poll();
    });
  }

  /** Send a command and wait for a specific response code. */
  private async cmd(line: string, expectedCode: number): Promise<string[]> {
    await this.sendLine(line);
    return this.waitForCode(expectedCode);
  }

  // ─── SMTP protocol ─────────────────────────────────────────────────────────

  /** Send EHLO and store capabilities. Returns the capability list. */
  async ehlo(hostname = 'mailcow-mobile'): Promise<string[]> {
    const lines = await this.cmd(`EHLO ${hostname}`, 250);
    this.capabilities = lines.map((l) => l.slice(4).trim().toUpperCase());
    return this.capabilities;
  }

  private hasCapability(cap: string): boolean {
    return this.capabilities.some((c) => c.startsWith(cap.toUpperCase()));
  }

  /** Upgrade to TLS via STARTTLS (for port 587). */
  async startTls(): Promise<void> {
    await this.cmd('STARTTLS', 220);
    await new Promise<void>((resolve, reject) => {
      (this.socket as unknown as { upgrade: (opts: object, cb: () => void) => void }).upgrade(
        { tlsCheckValidity: false },
        () => resolve(),
      );
    });
    // Re-issue EHLO after TLS upgrade
    await this.ehlo();
  }

  /** Authenticate using AUTH LOGIN or AUTH PLAIN. */
  async auth(username: string, password: string): Promise<void> {
    const encoded = (s: string) => btoa(s);

    if (this.hasCapability('AUTH') && this.capabilities.some((c) => c.includes('PLAIN'))) {
      // AUTH PLAIN: base64('\0username\0password')
      const credentials = encoded(`\0${username}\0${password}`);
      await this.cmd(`AUTH PLAIN ${credentials}`, 235);
    } else {
      // AUTH LOGIN: base64(username) then base64(password)
      await this.sendLine('AUTH LOGIN');
      await this.waitForCode(334); // "334 Username:"
      await this.sendLine(encoded(username));
      await this.waitForCode(334); // "334 Password:"
      await this.sendLine(encoded(password));
      await this.waitForCode(235);
    }
  }

  // ─── Message sending ───────────────────────────────────────────────────────

  /**
   * Full workflow: EHLO → optional STARTTLS → AUTH → MAIL FROM → RCPT TO × n → DATA.
   * Call connect() first.
   */
  async sendMessage(
    username: string,
    password: string,
    message: SmtpMessage,
    options: SmtpConnectOptions,
  ): Promise<void> {
    // EHLO
    await this.ehlo();

    // STARTTLS for port 587 (plain submission)
    if (!options.tls && this.hasCapability('STARTTLS')) {
      await this.startTls();
    }

    // AUTH
    await this.auth(username, password);

    // MAIL FROM
    await this.cmd(`MAIL FROM:<${message.from}>`, 250);

    // RCPT TO (all recipients)
    const allRecipients = [
      ...message.to,
      ...(message.cc ?? []),
      ...(message.bcc ?? []),
    ];
    for (const addr of allRecipients) {
      await this.cmd(`RCPT TO:<${addr}>`, 250);
    }

    // DATA
    await this.cmd('DATA', 354);
    const raw = buildMimeMessage(message);
    // Send the message, escaping leading dots
    const escaped = raw.split('\r\n').map((l) => (l.startsWith('.') ? '.' + l : l)).join('\r\n');
    await this.sendLine(escaped);
    await this.cmd('.', 250);
  }
}

// ─── MIME builder ─────────────────────────────────────────────────────────────

/** Build a minimal RFC 2822 / MIME message string. */
function buildMimeMessage(msg: SmtpMessage): string {
  const now = new Date().toUTCString();
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers: string[] = [
    `Date: ${now}`,
    `From: ${msg.from}`,
    `To: ${msg.to.join(', ')}`,
    ...(msg.cc && msg.cc.length ? [`Cc: ${msg.cc.join(', ')}`] : []),
    `Subject: ${encodeHeaderValue(msg.subject)}`,
    ...(msg.replyTo ? [`Reply-To: ${msg.replyTo}`] : []),
    ...(msg.inReplyTo ? [`In-Reply-To: ${msg.inReplyTo}`] : []),
    'MIME-Version: 1.0',
  ];

  let body: string;

  if (msg.bodyHtml) {
    // Multipart/alternative
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      qpEncode(msg.bodyText),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      qpEncode(msg.bodyHtml),
      '',
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: quoted-printable');
    body = qpEncode(msg.bodyText);
  }

  return headers.join('\r\n') + '\r\n\r\n' + body;
}

/** Encode a header value using RFC 2047 UTF-8 base64 if it contains non-ASCII. */
function encodeHeaderValue(s: string): string {
  // Check if encoding is needed
  if (!/[^\x00-\x7E]/.test(s)) return s;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
}

/** Very lightweight Quoted-Printable encoder (for SMTP bodies). */
function qpEncode(input: string): string {
  // Encode non-ASCII and special chars
  const lines: string[] = [];
  const rawLines = input.split(/\r?\n/);
  for (const raw of rawLines) {
    let out = '';
    for (const ch of raw) {
      const code = ch.charCodeAt(0);
      if (code > 126 || code < 9 || (code > 10 && code < 32) || ch === '=') {
        out += `=${code.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        out += ch;
      }
    }
    // Soft-wrap at 76 chars
    while (out.length > 76) {
      lines.push(out.slice(0, 75) + '=');
      out = out.slice(75);
    }
    lines.push(out);
  }
  return lines.join('\r\n');
}
