/**
 * iCal (RFC 5545) parser and generator
 *
 * Lightweight pure-JS iCal utility used by the CalDAV service.
 * Handles VCALENDAR, VEVENT, and VTODO components.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;  // ISO 8601
  dtend?: string;
  allDay: boolean;
  etag?: string;
  url?: string;
  color?: string;
  rrule?: string;
}

export interface VTodo {
  uid: string;
  summary: string;
  description?: string;
  due?: string;    // ISO 8601 date
  priority?: number; // 1-9, 1=highest
  status?: 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED';
  completed?: string;
  etag?: string;
  url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Unfold iCal lines: RFC 5545 §3.1 — long lines can be folded by inserting
 * CRLF + whitespace. This reverses that.
 */
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, '');
}

/**
 * Parse a DATE or DATE-TIME value into an ISO 8601 string.
 * Handles: 20250501, 20250501T120000, 20250501T120000Z
 */
function parseIcalDate(value: string): { iso: string; allDay: boolean } {
  // DATE only (no time part)
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, allDay: true };
  }
  // DATE-TIME
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, yr, mo, da, hh, mm, ss, z] = m;
    const iso = `${yr}-${mo}-${da}T${hh}:${mm}:${ss}${z ? 'Z' : ''}`;
    return { iso, allDay: false };
  }
  // Return as-is if unrecognised
  return { iso: value, allDay: false };
}

/** Format an ISO 8601 string back into iCal DATE or DATE-TIME format.
 *
 * @param iso  For `allDay=true` expects YYYY-MM-DD; for `allDay=false` expects
 *             a full ISO 8601 date-time string understood by `new Date()`.
 */
function toIcalDateTime(iso: string, allDay = false): string {
  if (allDay) {
    // DATE format: YYYYMMDD
    const d = iso.replace(/-/g, '').slice(0, 8);
    return d;
  }
  // DATE-TIME
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Extract the text value of a property line (handles PARAM;param=val:value). */
function propValue(line: string): string {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return '';
  return line.slice(colonIdx + 1).trim();
}

/** Extract the property name (everything before first `;` or `:`). */
function propName(line: string): string {
  const semi = line.indexOf(';');
  const colon = line.indexOf(':');
  const end = semi !== -1 && semi < colon ? semi : colon;
  return end !== -1 ? line.slice(0, end).toUpperCase() : line.toUpperCase();
}

/** Get a named parameter value from a property line, e.g. `VALUE=DATE`. */
function paramValue(line: string, param: string): string | undefined {
  const m = line.match(new RegExp(`${param}=([^;:]+)`, 'i'));
  return m?.[1];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/** Parse a single VEVENT block (lines between BEGIN:VEVENT and END:VEVENT). */
function parseVEvent(lines: string[], etag?: string, url?: string): VEvent {
  const props: Record<string, string> = {};
  const propLines: Record<string, string> = {};

  for (const line of lines) {
    const name = propName(line);
    const val = propValue(line);
    props[name] = val;
    propLines[name] = line;
  }

  const dtstart = props['DTSTART'] ?? '';
  const dtend = props['DTEND'] ?? props['DUE'] ?? '';
  const valueParam = paramValue(propLines['DTSTART'] ?? '', 'VALUE');
  const startIsDate = valueParam === 'DATE' || /^\d{8}$/.test(dtstart);

  const start = parseIcalDate(dtstart);
  const end = dtend ? parseIcalDate(dtend) : undefined;

  return {
    uid: props['UID'] ?? crypto.randomUUID(),
    summary: props['SUMMARY'] ?? '(No title)',
    description: props['DESCRIPTION'],
    location: props['LOCATION'],
    dtstart: start.iso,
    dtend: end?.iso,
    allDay: startIsDate || start.allDay,
    rrule: props['RRULE'],
    etag,
    url,
  };
}

/** Parse a single VTODO block. */
function parseVTodo(lines: string[], etag?: string, url?: string): VTodo {
  const props: Record<string, string> = {};

  for (const line of lines) {
    const name = propName(line);
    const val = propValue(line);
    props[name] = val;
  }

  const rawPriority = parseInt(props['PRIORITY'] ?? '', 10);
  const due = props['DUE'] ?? props['DTDUE'];
  const completed = props['COMPLETED'];

  return {
    uid: props['UID'] ?? crypto.randomUUID(),
    summary: props['SUMMARY'] ?? '(No title)',
    description: props['DESCRIPTION'],
    due: due ? parseIcalDate(due).iso : undefined,
    priority: isNaN(rawPriority) ? undefined : rawPriority,
    status: (props['STATUS'] as VTodo['status']) ?? 'NEEDS-ACTION',
    completed: completed ? parseIcalDate(completed).iso : undefined,
    etag,
    url,
  };
}

export interface ParsedCalendar {
  events: VEvent[];
  todos: VTodo[];
}

/**
 * Parse one or more VCALENDAR objects from a raw iCal string.
 * @param raw   Raw iCal text (e.g. from a CalDAV REPORT response data section)
 * @param etag  Optional ETag from the HTTP response
 * @param url   Optional resource URL
 */
export function parseIcal(
  raw: string,
  etag?: string,
  url?: string,
): ParsedCalendar {
  const events: VEvent[] = [];
  const todos: VTodo[] = [];

  const lines = unfold(raw).split(/\r?\n/);
  let inside: 'VEVENT' | 'VTODO' | null = null;
  let block: string[] = [];

  for (const line of lines) {
    const upper = line.trim().toUpperCase();

    if (upper === 'BEGIN:VEVENT') {
      inside = 'VEVENT';
      block = [];
    } else if (upper === 'BEGIN:VTODO') {
      inside = 'VTODO';
      block = [];
    } else if (upper === 'END:VEVENT' && inside === 'VEVENT') {
      events.push(parseVEvent(block, etag, url));
      inside = null;
      block = [];
    } else if (upper === 'END:VTODO' && inside === 'VTODO') {
      todos.push(parseVTodo(block, etag, url));
      inside = null;
      block = [];
    } else if (inside && line.trim()) {
      block.push(line.trim());
    }
  }

  return { events, todos };
}

// ─── Generator ───────────────────────────────────────────────────────────────

const PRODID = '-//MailcowMobile//MailcowMobile 1.0//EN';

/** Fold a line at 75 octets per RFC 5545 §3.1. */
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

/** Escape special characters in iCal text values. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Generate a VCALENDAR / VEVENT iCal string. */
export function generateVEvent(event: Omit<VEvent, 'etag' | 'url'>): string {
  const dtstamp = toIcalDateTime(new Date().toISOString());
  const dtstart = event.allDay
    ? `DTSTART;VALUE=DATE:${toIcalDateTime(event.dtstart, true)}`
    : `DTSTART:${toIcalDateTime(event.dtstart)}`;
  const dtend = event.dtend
    ? event.allDay
      ? `DTEND;VALUE=DATE:${toIcalDateTime(event.dtend, true)}`
      : `DTEND:${toIcalDateTime(event.dtend)}`
    : null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    ...(dtend ? [dtend] : []),
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.rrule ? [`RRULE:${event.rrule}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Generate a VCALENDAR / VTODO iCal string. */
export function generateVTodo(todo: Omit<VTodo, 'etag' | 'url'>): string {
  const dtstamp = toIcalDateTime(new Date().toISOString());

  // iCal PRIORITY: 1=High, 5=Medium, 9=Low, 0=None
  const priority = todo.priority ?? 0;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'BEGIN:VTODO',
    `UID:${todo.uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeText(todo.summary)}`,
    ...(todo.description ? [`DESCRIPTION:${escapeText(todo.description)}`] : []),
    ...(todo.due ? [`DUE;VALUE=DATE:${toIcalDateTime(todo.due, true)}`] : []),
    `PRIORITY:${priority}`,
    `STATUS:${todo.status ?? 'NEEDS-ACTION'}`,
    ...(todo.completed ? [`COMPLETED:${toIcalDateTime(todo.completed)}`] : []),
    'END:VTODO',
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}
