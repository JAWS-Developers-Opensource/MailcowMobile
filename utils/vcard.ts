/**
 * vCard (RFC 6350) parser and generator
 *
 * Lightweight pure-JS vCard utility used by the CardDAV service.
 * Supports vCard 3.0 and 4.0.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VCard {
  uid: string;
  fn: string;          // Formatted name
  n?: {
    family: string;
    given: string;
    additional?: string;
    prefix?: string;
    suffix?: string;
  };
  emails: Array<{ type: string; value: string }>;
  phones: Array<{ type: string; value: string }>;
  org?: string;
  title?: string;
  note?: string;
  photo?: string;      // base64 or URL
  etag?: string;
  url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Unfold vCard lines (RFC 6350 §3.2). */
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, '');
}

/** Get the property name (part before first `;` or `:`). */
function propName(line: string): string {
  const semi = line.indexOf(';');
  const colon = line.indexOf(':');
  const end = semi !== -1 && semi < colon ? semi : colon;
  return end !== -1 ? line.slice(0, end).toUpperCase() : line.toUpperCase();
}

/** Get the value part of a property line (after first `:`). */
function propValue(line: string): string {
  const idx = line.indexOf(':');
  return idx !== -1 ? line.slice(idx + 1).trim() : '';
}

/** Extract a named parameter from a property line, e.g. `TYPE=WORK`. */
function paramValue(line: string, param: string): string {
  const m = line.match(new RegExp(`${param}=([^;:,]+)`, 'i'));
  return m?.[1]?.toLowerCase() ?? 'other';
}

/** Unescape vCard text value escape sequences. */
function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** Escape special characters for vCard values. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a single vCard string (between BEGIN:VCARD and END:VCARD).
 */
export function parseVCard(raw: string, etag?: string, url?: string): VCard {
  const lines = unfold(raw).split(/\r?\n/);
  let fn = '';
  let uid = '';
  let org: string | undefined;
  let title: string | undefined;
  let note: string | undefined;
  let photo: string | undefined;
  const emails: VCard['emails'] = [];
  const phones: VCard['phones'] = [];
  let n: VCard['n'] | undefined;

  for (const line of lines) {
    if (!line.trim() || line.trim().toUpperCase() === 'BEGIN:VCARD' || line.trim().toUpperCase() === 'END:VCARD') {
      continue;
    }

    const name = propName(line);
    const val = unescapeText(propValue(line));

    switch (name) {
      case 'FN':
        fn = val;
        break;
      case 'UID':
        uid = val;
        break;
      case 'N': {
        // N:Family;Given;Additional;Prefix;Suffix
        const parts = val.split(';');
        n = {
          family: parts[0] ?? '',
          given: parts[1] ?? '',
          additional: parts[2] ?? undefined,
          prefix: parts[3] ?? undefined,
          suffix: parts[4] ?? undefined,
        };
        break;
      }
      case 'EMAIL':
        emails.push({ type: paramValue(line, 'TYPE'), value: val });
        break;
      case 'TEL':
        phones.push({ type: paramValue(line, 'TYPE'), value: val });
        break;
      case 'ORG':
        org = val.split(';')[0]; // ORG:Company;Department
        break;
      case 'TITLE':
        title = val;
        break;
      case 'NOTE':
        note = val;
        break;
      case 'PHOTO':
        photo = val;
        break;
      default:
        break;
    }
  }

  return {
    uid: uid || crypto.randomUUID(),
    fn: fn || (n ? `${n.given} ${n.family}`.trim() : 'Unknown'),
    n,
    emails,
    phones,
    org,
    title,
    note,
    photo,
    etag,
    url,
  };
}

/**
 * Parse multiple vCards from a string containing one or more VCARD blocks.
 */
export function parseVCards(raw: string, etag?: string, url?: string): VCard[] {
  const results: VCard[] = [];
  // Split on BEGIN:VCARD … END:VCARD blocks
  const regex = /(BEGIN:VCARD[\s\S]*?END:VCARD)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    results.push(parseVCard(match[1], etag, url));
  }
  return results;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/** Fold a line at 75 octets per RFC 6350. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  let out = '';
  let pos = 0;
  while (pos < line.length) {
    const chunk = line.slice(pos, pos + (pos === 0 ? 75 : 74));
    out += (pos === 0 ? '' : '\r\n ') + chunk;
    pos += chunk.length;
  }
  return out;
}

/** Generate a vCard 3.0 string from a VCard object. */
export function generateVCard(card: Omit<VCard, 'etag' | 'url'>): string {
  const nValue = card.n
    ? `${escapeText(card.n.family)};${escapeText(card.n.given)};${escapeText(card.n.additional ?? '')};${escapeText(card.n.prefix ?? '')};${escapeText(card.n.suffix ?? '')}`
    : `${escapeText(card.fn.split(' ').slice(-1)[0] ?? '')};${escapeText(card.fn.split(' ').slice(0, -1).join(' ') ?? '')};;;`;

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `UID:${card.uid}`,
    `FN:${escapeText(card.fn)}`,
    `N:${nValue}`,
    ...card.emails.map((e) =>
      fold(`EMAIL;TYPE=${e.type.toUpperCase()}:${escapeText(e.value)}`),
    ),
    ...card.phones.map((p) =>
      fold(`TEL;TYPE=${p.type.toUpperCase()}:${escapeText(p.value)}`),
    ),
    ...(card.org ? [`ORG:${escapeText(card.org)}`] : []),
    ...(card.title ? [`TITLE:${escapeText(card.title)}`] : []),
    ...(card.note ? [`NOTE:${escapeText(card.note)}`] : []),
    'END:VCARD',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}
