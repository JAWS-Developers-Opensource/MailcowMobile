/**
 * IMAP TCP Client
 *
 * Low-level IMAP4rev1 (RFC 3501) client built on react-native-tcp-socket.
 * Supports IMAPS (TLS on port 993) and STARTTLS (port 143 / 587).
 *
 * This module requires a custom Expo dev client or a production EAS build
 * because react-native-tcp-socket is a native module.
 *
 * Supported commands:
 *   CAPABILITY, LOGIN, SELECT, LIST, FETCH, STORE, COPY, UID COPY,
 *   UID FETCH, UID STORE, EXPUNGE, CREATE, LOGOUT
 */

// react-native-tcp-socket types
import TcpSocketModule from 'react-native-tcp-socket';
// The package exports a default namespace; create a typed alias for createConnection.
const TcpSocket = TcpSocketModule;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImapConnectOptions {
  host: string;
  port: number;
  tls: boolean;
}

interface PendingCommand {
  tag: string;
  resolve: (lines: string[]) => void;
  reject: (err: Error) => void;
  accumulated: string[];
}

// ─── ImapClient ──────────────────────────────────────────────────────────────

export class ImapClient {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private buffer = '';
  private tagCounter = 0;
  private pendingCommands: PendingCommand[] = [];
  private unsolicitedHandlers: Array<(line: string) => void> = [];
  private connected = false;

  // ─── Connection ────────────────────────────────────────────────────────────

  connect(options: ImapConnectOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timed out'));
      }, 15000);

      this.socket = TcpSocket.createConnection(
        {
          host: options.host,
          port: options.port,
          tls: options.tls,
          tlsCheckValidity: false, // allow self-signed certs for home servers
        },
        () => {
          clearTimeout(timeout);
          this.connected = true;
          // Wait for the server greeting (* OK ...)
          const greetingHandler = (line: string) => {
            if (line.startsWith('* OK') || line.startsWith('* PREAUTH')) {
              this.unsolicitedHandlers = this.unsolicitedHandlers.filter((h) => h !== greetingHandler);
              resolve();
            } else if (line.startsWith('* BYE')) {
              this.unsolicitedHandlers = this.unsolicitedHandlers.filter((h) => h !== greetingHandler);
              reject(new Error(`Server rejected connection: ${line}`));
            }
          };
          this.unsolicitedHandlers.push(greetingHandler);
        },
      );

      this.socket.on('data', (data: Buffer | string) => {
        this.onData(typeof data === 'string' ? data : data.toString('utf8'));
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        // Reject any outstanding commands
        for (const cmd of this.pendingCommands) {
          cmd.reject(new Error('IMAP connection closed'));
        }
        this.pendingCommands = [];
      });
    });
  }

  /** Upgrade an unencrypted connection to TLS via STARTTLS. */
  startTls(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'));
      (this.socket as unknown as { upgrade: (opts: object, cb: () => void) => void }).upgrade(
        { tlsCheckValidity: false },
        () => resolve(),
      );
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket && this.connected) {
      try {
        await this.sendCommand('LOGOUT');
      } catch { /* ignore */ }
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  // ─── Data handler ──────────────────────────────────────────────────────────

  private onData(chunk: string): void {
    this.buffer += chunk;

    // Process complete lines
    let lineEnd: number;
    while ((lineEnd = this.buffer.indexOf('\r\n')) !== -1) {
      const line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + 2);
      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    // Check if this line is a tagged response (matches a pending command)
    for (const cmd of this.pendingCommands) {
      if (line.startsWith(`${cmd.tag} OK`) || line.startsWith(`${cmd.tag} NO`) || line.startsWith(`${cmd.tag} BAD`)) {
        cmd.accumulated.push(line);
        const success = line.startsWith(`${cmd.tag} OK`);
        this.pendingCommands = this.pendingCommands.filter((c) => c !== cmd);
        if (success) {
          cmd.resolve(cmd.accumulated);
        } else {
          cmd.reject(new Error(`IMAP command failed: ${line}`));
        }
        return;
      }
      // Continuation / untagged lines for this command
      if (line.startsWith('* ') || line.startsWith('+ ')) {
        cmd.accumulated.push(line);
        // Notify unsolicited handlers too
        for (const h of this.unsolicitedHandlers) h(line);
        return;
      }
    }

    // Unsolicited / untagged response not belonging to any command
    for (const h of this.unsolicitedHandlers) h(line);
  }

  // ─── Command sender ────────────────────────────────────────────────────────

  private nextTag(): string {
    this.tagCounter += 1;
    return `MC${String(this.tagCounter).padStart(4, '0')}`;
  }

  sendCommand(cmdText: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('IMAP: not connected'));
      }
      const tag = this.nextTag();
      const pending: PendingCommand = { tag, resolve, reject, accumulated: [] };
      this.pendingCommands.push(pending);
      this.socket.write(`${tag} ${cmdText}\r\n`);
    });
  }

  // ─── High-level IMAP commands ──────────────────────────────────────────────

  async capability(): Promise<string[]> {
    const lines = await this.sendCommand('CAPABILITY');
    const capLine = lines.find((l) => l.startsWith('* CAPABILITY'));
    return capLine ? capLine.slice('* CAPABILITY '.length).split(' ') : [];
  }

  async login(username: string, password: string): Promise<void> {
    // Escape special chars in quoted strings
    const escUser = username.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escPass = password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await this.sendCommand(`LOGIN "${escUser}" "${escPass}"`);
  }

  async list(reference: string, pattern: string): Promise<ListResult[]> {
    const lines = await this.sendCommand(`LIST "${reference}" "${pattern}"`);
    return lines
      .filter((l) => l.startsWith('* LIST'))
      .map(parseListLine)
      .filter((r): r is ListResult => r !== null);
  }

  async select(mailbox: string): Promise<SelectResult> {
    const lines = await this.sendCommand(`SELECT "${mailbox}"`);
    return parseSelectLines(lines);
  }

  async examine(mailbox: string): Promise<SelectResult> {
    const lines = await this.sendCommand(`EXAMINE "${mailbox}"`);
    return parseSelectLines(lines);
  }

  /** Fetch messages by sequence set. Returns raw FETCH response lines. */
  async fetch(
    sequenceSet: string,
    items: string,
  ): Promise<FetchResult[]> {
    const lines = await this.sendCommand(`FETCH ${sequenceSet} ${items}`);
    return parseFetchLines(lines);
  }

  /** Fetch messages by UID. */
  async uidFetch(
    uidSet: string,
    items: string,
  ): Promise<FetchResult[]> {
    const lines = await this.sendCommand(`UID FETCH ${uidSet} ${items}`);
    return parseFetchLines(lines);
  }

  /** STORE flags on messages by sequence set. */
  async store(sequenceSet: string, flags: string, mode: '+' | '-' | '' = '+'): Promise<void> {
    await this.sendCommand(`STORE ${sequenceSet} ${mode}FLAGS (${flags})`);
  }

  /** STORE flags by UID. */
  async uidStore(uidSet: string, flags: string, mode: '+' | '-' | '' = '+'): Promise<void> {
    await this.sendCommand(`UID STORE ${uidSet} ${mode}FLAGS (${flags})`);
  }

  /** COPY messages to another mailbox by sequence set. */
  async copy(sequenceSet: string, destination: string): Promise<void> {
    await this.sendCommand(`COPY ${sequenceSet} "${destination}"`);
  }

  /** COPY messages to another mailbox by UID. */
  async uidCopy(uidSet: string, destination: string): Promise<void> {
    await this.sendCommand(`UID COPY ${uidSet} "${destination}"`);
  }

  /** EXPUNGE deleted messages in the currently selected mailbox. */
  async expunge(): Promise<void> {
    await this.sendCommand('EXPUNGE');
  }

  /** CREATE a new mailbox. */
  async create(mailbox: string): Promise<void> {
    await this.sendCommand(`CREATE "${mailbox}"`);
  }

  /** APPEND a raw RFC 2822 message to a mailbox. */
  async append(mailbox: string, message: string, flags = '\\Seen'): Promise<void> {
    const size = new TextEncoder().encode(message).length;
    // APPEND uses a literal: send command + size, wait for '+ ' continuation
    await new Promise<void>((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('IMAP: not connected'));
      }
      const tag = this.nextTag();
      const cmd: PendingCommand = {
        tag,
        resolve: (_) => resolve(),
        reject,
        accumulated: [],
      };
      this.pendingCommands.push(cmd);
      this.socket.write(`${tag} APPEND "${mailbox}" (${flags}) {${size}}\r\n`);
      // After sending the command, we need to detect the '+ ' continuation
      // and then send the literal data.  We hijack the accumulated handler.
      const origResolve = cmd.resolve;
      // Wait for continuation
      const waitContinuation = (line: string) => {
        if (line.startsWith('+ ')) {
          this.unsolicitedHandlers = this.unsolicitedHandlers.filter((h) => h !== waitContinuation);
          this.socket?.write(`${message}\r\n`);
          cmd.resolve = origResolve;
        }
      };
      this.unsolicitedHandlers.push(waitContinuation);
    });
  }
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

export interface ListResult {
  flags: string[];
  delimiter: string;
  name: string;
}

function parseListLine(line: string): ListResult | null {
  // * LIST (\HasNoChildren) "." "INBOX"
  // * LIST (\Noselect) "/" ""
  const m = line.match(/^\* LIST \(([^)]*)\) "([^"]*)" (.+)$/i);
  if (!m) return null;
  const flags = m[1].split(/\s+/).filter(Boolean);
  const delimiter = m[2];
  const name = m[3].replace(/^"(.*)"$/, '$1');
  return { flags, delimiter, name };
}

export interface SelectResult {
  exists: number;
  recent: number;
  unseen?: number;
  uidNext?: number;
  uidValidity?: number;
  flags: string[];
}

function parseSelectLines(lines: string[]): SelectResult {
  const result: SelectResult = { exists: 0, recent: 0, flags: [] };
  for (const line of lines) {
    const exists = line.match(/^\* (\d+) EXISTS/i);
    if (exists) { result.exists = parseInt(exists[1], 10); continue; }

    const recent = line.match(/^\* (\d+) RECENT/i);
    if (recent) { result.recent = parseInt(recent[1], 10); continue; }

    const unseen = line.match(/\[UNSEEN (\d+)\]/i);
    if (unseen) { result.unseen = parseInt(unseen[1], 10); continue; }

    const uidNext = line.match(/\[UIDNEXT (\d+)\]/i);
    if (uidNext) { result.uidNext = parseInt(uidNext[1], 10); continue; }

    const uidVal = line.match(/\[UIDVALIDITY (\d+)\]/i);
    if (uidVal) { result.uidValidity = parseInt(uidVal[1], 10); continue; }

    const flags = line.match(/^\* FLAGS \(([^)]*)\)/i);
    if (flags) { result.flags = flags[1].split(/\s+/).filter(Boolean); }
  }
  return result;
}

export interface FetchResult {
  seq: number;
  uid?: number;
  flags?: string[];
  envelope?: EnvelopeData;
  bodyText?: string;
  bodyHtml?: string;
  size?: number;
  internalDate?: string;
  headers?: string;
}

export interface EnvelopeData {
  date?: string;
  subject?: string;
  from?: Array<{ name?: string; email: string }>;
  to?: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  replyTo?: Array<{ name?: string; email: string }>;
  messageId?: string;
}

/**
 * Very simplified FETCH response parser.
 *
 * IMAP FETCH responses can be complex (multi-line literals, nested data).
 * This handles the common case of ENVELOPE + FLAGS + BODY[] responses.
 */
function parseFetchLines(lines: string[]): FetchResult[] {
  const results: FetchResult[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // * N FETCH (...)
    const fetchMatch = line.match(/^\* (\d+) FETCH \(/i);
    if (!fetchMatch) { i++; continue; }

    const seq = parseInt(fetchMatch[1], 10);
    const result: FetchResult = { seq };

    // Collect all content between the outer parens (may span multiple lines)
    let content = line.slice(line.indexOf('(') + 1);
    // If content doesn't end with ')' consume more lines
    while (!content.trimEnd().endsWith(')') && i + 1 < lines.length) {
      i++;
      content += '\r\n' + lines[i];
    }
    // Remove trailing ')'
    content = content.replace(/\)$/, '').trim();

    // Extract UID
    const uidM = content.match(/UID (\d+)/i);
    if (uidM) result.uid = parseInt(uidM[1], 10);

    // Extract FLAGS
    const flagsM = content.match(/FLAGS \(([^)]*)\)/i);
    if (flagsM) result.flags = flagsM[1].split(/\s+/).filter(Boolean);

    // Extract RFC822.SIZE
    const sizeM = content.match(/RFC822\.SIZE (\d+)/i);
    if (sizeM) result.size = parseInt(sizeM[1], 10);

    // Extract INTERNALDATE
    const dateM = content.match(/INTERNALDATE "([^"]+)"/i);
    if (dateM) result.internalDate = dateM[1];

    // Extract ENVELOPE
    const envStart = content.indexOf('ENVELOPE (');
    if (envStart !== -1) {
      result.envelope = parseEnvelope(content.slice(envStart + 'ENVELOPE '.length));
    }

    // Extract BODY[] (full message text)
    const bodyMatch = content.match(/BODY(?:\[\])? \{(\d+)\}\r?\n([\s\S]*)/i);
    if (bodyMatch) {
      const bodyRaw = bodyMatch[2].slice(0, parseInt(bodyMatch[1], 10));
      const { text, html, headers } = splitBodyParts(bodyRaw);
      result.bodyText = text;
      result.bodyHtml = html;
      result.headers = headers;
    }

    results.push(result);
    i++;
  }

  return results;
}

/** Very simplified ENVELOPE parser. */
function parseEnvelope(envStr: string): EnvelopeData {
  // ENVELOPE is a parenthesised list; we do a best-effort parse
  const env: EnvelopeData = {};
  // Grab everything inside the outer parens
  const m = envStr.match(/^\((.+)\)$/s);
  const inner = m ? m[1] : envStr;

  // Split into top-level tokens (respecting nested parens and quotes)
  const tokens = splitEnvelopeTokens(inner);
  // Position:  0=date, 1=subject, 2=from, 3=sender, 4=reply-to, 5=to, 6=cc, 7=bcc, 8=in-reply-to, 9=message-id
  env.date = unquote(tokens[0] ?? 'NIL');
  env.subject = decodeImapUtf8(unquote(tokens[1] ?? 'NIL'));
  env.from = parseAddressList(tokens[2] ?? 'NIL');
  env.replyTo = parseAddressList(tokens[4] ?? 'NIL');
  env.to = parseAddressList(tokens[5] ?? 'NIL');
  env.cc = parseAddressList(tokens[6] ?? 'NIL');
  env.messageId = unquote(tokens[9] ?? 'NIL');
  return env;
}

function unquote(s: string): string {
  if (s === 'NIL') return '';
  return s.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function parseAddressList(token: string): Array<{ name?: string; email: string }> {
  if (token === 'NIL' || !token.startsWith('(')) return [];
  // Each address: ((name NIL mailbox host) ...)
  const addrs: Array<{ name?: string; email: string }> = [];
  const addrRe = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = addrRe.exec(token)) !== null) {
    const parts = splitEnvelopeTokens(m[1]);
    const name = unquote(parts[0] ?? 'NIL') || undefined;
    const mailbox = unquote(parts[2] ?? 'NIL');
    const host = unquote(parts[3] ?? 'NIL');
    if (mailbox && host) {
      addrs.push({ name, email: `${mailbox}@${host}` });
    }
  }
  return addrs;
}

/** Split a space-separated envelope token string respecting parens and quotes. */
function splitEnvelopeTokens(s: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') { inQuote = !inQuote; cur += ch; continue; }
    if (inQuote) { cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ' ' && depth === 0) {
      tokens.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** Decode RFC 2047 encoded words (Q-encoding and B-encoding). */
function decodeImapUtf8(s: string): string {
  // =?charset?encoding?text?=
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') {
        // Base64
        const bytes = atob(text);
        return bytes; // Simplified — full decoding would need TextDecoder
      } else {
        // Q-encoding
        return text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_unused: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      }
    } catch {
      return text;
    }
  });
}

/** Split a raw RFC 2822 message into text, HTML, and headers. */
function splitBodyParts(raw: string): { text: string; html?: string; headers: string } {
  const headerEnd = raw.indexOf('\r\n\r\n');
  const headers = headerEnd !== -1 ? raw.slice(0, headerEnd) : '';
  const body = headerEnd !== -1 ? raw.slice(headerEnd + 4) : raw;

  const contentType = (headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] ?? '').toLowerCase();

  if (contentType.includes('multipart/')) {
    const boundaryM = contentType.match(/boundary="?([^";\s]+)"?/i);
    if (boundaryM) {
      const boundary = boundaryM[1];
      const parts = body.split(new RegExp(`--${escapeRegex(boundary)}(?:--)?`));
      let text = '';
      let html = '';
      for (const part of parts) {
        const pHeaderEnd = part.indexOf('\r\n\r\n');
        if (pHeaderEnd === -1) continue;
        const pHeaders = part.slice(0, pHeaderEnd);
        const pBody = part.slice(pHeaderEnd + 4);
        const pCT = (pHeaders.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] ?? '').toLowerCase();
        if (pCT.includes('text/plain') && !text) text = pBody;
        if (pCT.includes('text/html') && !html) html = pBody;
      }
      return { text: text || body, html: html || undefined, headers };
    }
  }

  if (contentType.includes('text/html')) {
    return { text: body.replace(/<[^>]+>/g, ''), html: body, headers };
  }

  return { text: body, headers };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
