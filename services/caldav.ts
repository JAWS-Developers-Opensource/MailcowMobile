/**
 * CalDAV Service
 *
 * Real CalDAV implementation connecting directly to the user's Mailcow / SOGo
 * server using HTTP PROPFIND / REPORT / PUT / DELETE.
 *
 * Authentication: HTTP Basic (username + password in every request).
 * Protocol: CalDAV RFC 4791 over HTTPS — no backend proxy required.
 *
 * Mailcow endpoints (SOGo):
 *   Calendar list : PROPFIND  https://<host>/SOGo/dav/<user>/Calendar/
 *   Events        : REPORT    https://<host>/SOGo/dav/<user>/Calendar/<cal>/
 *   Create/update : PUT       https://<host>/SOGo/dav/<user>/Calendar/<cal>/<uid>.ics
 *   Delete        : DELETE    same URL with If-Match ETag header
 */

import { XMLParser } from 'fast-xml-parser';
import type { Calendar, CalendarEvent, MailcowAccount, Task, TaskList } from '../types';
import { parseIcal, generateVEvent, generateVTodo } from '../utils/ical';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function basicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  // btoa is available globally in React Native (Hermes)
  return `Basic ${btoa(credentials)}`;
}

function caldavHeaders(username: string, password: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: basicAuth(username, password),
    'Content-Type': 'application/xml; charset=utf-8',
    ...extra,
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,   // strips D:, C:, etc. — multistatus instead of D:multistatus
  isArray: (name) => ['response', 'propstat'].includes(name),
});

/** Safely traverse to a nested value, returning undefined if any step is missing. */
function dig(obj: unknown, ...keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Coerce to array (handles single-item and missing values from the XML parser). */
function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Parse a DAV:multistatus XML body and return the list of D:response elements. */
function parseMultistatus(xml: string): unknown[] {
  const root = xmlParser.parse(xml) as Record<string, unknown>;
  const ms = root['multistatus'] as Record<string, unknown> | undefined;
  if (!ms) return [];
  return toArray(ms['response'] as unknown);
}

// ─── Priority mapping ─────────────────────────────────────────────────────────
// iCal PRIORITY: 1–4=High, 5=Medium, 6–9=Low, 0=None
type AppPriority = 'none' | 'low' | 'medium' | 'high';

function icalPriorityToApp(p: number | undefined): AppPriority {
  if (!p || p === 0) return 'none';
  if (p >= 1 && p <= 4) return 'high';
  if (p === 5) return 'medium';
  return 'low';
}

function appPriorityToIcal(p: AppPriority): number {
  switch (p) {
    case 'high': return 1;
    case 'medium': return 5;
    case 'low': return 9;
    default: return 0;
  }
}

type AppTaskStatus = 'needs-action' | 'in-process' | 'completed' | 'cancelled';

function icalStatusToApp(s: string | undefined): AppTaskStatus {
  switch ((s ?? '').toUpperCase()) {
    case 'IN-PROCESS': return 'in-process';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    default: return 'needs-action';
  }
}

// ─── CalDavService ───────────────────────────────────────────────────────────

export class CalDavService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  private get calendarBase(): string {
    return `${this.account.davBaseUrl}/Calendar`;
  }

  private get tasksBase(): string {
    return `${this.account.davBaseUrl}/Tasks`;
  }

  // ─── Calendars ─────────────────────────────────────────────────────────────

  /**
   * List all CalDAV calendar collections for this account.
   * Issues a PROPFIND Depth:1 to the Calendar home.
   */
  async getCalendars(password: string): Promise<Calendar[]> {
    const url = `${this.calendarBase}/`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <A:calendar-color/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`;

    const resp = await fetch(url, {
      method: 'PROPFIND',
      headers: { ...caldavHeaders(this.account.username, password), Depth: '1' },
      body,
    });

    if (!resp.ok && resp.status !== 207) {
      throw new Error(`CalDAV PROPFIND failed: ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const responses = parseMultistatus(xml);
    const calendars: Calendar[] = [];

    let isFirst = true;
    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      // Skip the home collection itself
      if (href.endsWith('/Calendar/')) { isFirst = false; continue; }

      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      // Only include calendar collections (not address books etc.)
      const restype = prop['resourcetype'] as Record<string, unknown> | undefined;
      if (!restype?.['calendar']) continue;

      const displayName = String(prop['displayname'] ?? href.split('/').filter(Boolean).pop() ?? 'Calendar');
      const rawColor = String(prop['calendar-color'] ?? '#2563EB');
      const color = rawColor.startsWith('#') ? rawColor.slice(0, 7) : '#2563EB';

      const id = href.split('/').filter(Boolean).pop() ?? `cal-${calendars.length}`;

      calendars.push({
        id,
        name: displayName,
        color,
        url: `${this.account.davBaseUrl.replace(/\/$/, '')}${href}`,
        visible: true,
        isDefault: isFirst,
      });
      isFirst = false;
    }

    // Fallback to a sensible default if PROPFIND returned nothing useful
    if (calendars.length === 0) {
      calendars.push({
        id: 'personal',
        name: 'Personal',
        color: '#2563EB',
        url: `${this.calendarBase}/personal/`,
        visible: true,
        isDefault: true,
      });
    }

    return calendars;
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  /**
   * Fetch all VEVENT objects from a calendar collection within a date range.
   * Uses a CalDAV calendar-query REPORT.
   */
  async getEvents(
    calendarUrl: string,
    from: string,
    to: string,
    password: string,
  ): Promise<CalendarEvent[]> {
    if (!calendarUrl) return [];

    const start = from
      ? new Date(from).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
      : new Date(Date.now() - 30 * 86400 * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const end = to
      ? new Date(to).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
      : new Date(Date.now() + 180 * 86400 * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${start}" end="${end}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const resp = await fetch(calendarUrl, {
      method: 'REPORT',
      headers: { ...caldavHeaders(this.account.username, password), Depth: '1' },
      body,
    });

    if (!resp.ok && resp.status !== 207) {
      throw new Error(`CalDAV REPORT failed: ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const responses = parseMultistatus(xml);
    const events: CalendarEvent[] = [];

    // Extract calendar ID from URL path
    const calId = calendarUrl.split('/').filter(Boolean).pop() ?? 'default';

    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      const etag = String(prop['getetag'] ?? '').replace(/"/g, '');
      const icalData = String(prop['calendar-data'] ?? '');
      if (!icalData) continue;

      const { events: parsed } = parseIcal(icalData, etag, href);
      for (const e of parsed) {
        events.push({
          id: e.uid,
          calendarId: calId,
          title: e.summary,
          description: e.description,
          location: e.location,
          start: e.dtstart,
          end: e.dtend ?? e.dtstart,
          allDay: e.allDay,
          recurrence: e.rrule,
          etag: e.etag,
          url: href,
        });
      }
    }

    return events;
  }

  /** Create a new VEVENT on the server via PUT. */
  async createEvent(
    calendarUrl: string,
    event: Omit<CalendarEvent, 'id' | 'etag'>,
    password: string,
  ): Promise<CalendarEvent> {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mailcow-mobile`;
    const icalData = generateVEvent({
      uid,
      summary: event.title,
      description: event.description,
      location: event.location,
      dtstart: event.start,
      dtend: event.end,
      allDay: event.allDay,
      rrule: event.recurrence,
    });

    const resourceUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
    const resp = await fetch(resourceUrl, {
      method: 'PUT',
      headers: {
        ...caldavHeaders(this.account.username, password, { 'Content-Type': 'text/calendar; charset=utf-8' }),
        'If-None-Match': '*',
      },
      body: icalData,
    });

    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      throw new Error(`CalDAV PUT failed: ${resp.status} ${resp.statusText}`);
    }

    const etag = resp.headers.get('ETag')?.replace(/"/g, '') ?? undefined;
    return { ...event, id: uid, etag, url: resourceUrl };
  }

  /** Update an existing VEVENT on the server via PUT with If-Match. */
  async updateEvent(
    _calendarUrl: string,
    event: CalendarEvent,
    password: string,
  ): Promise<CalendarEvent> {
    if (!event.url) throw new Error('Event URL is required for update');

    const icalData = generateVEvent({
      uid: event.id,
      summary: event.title,
      description: event.description,
      location: event.location,
      dtstart: event.start,
      dtend: event.end,
      allDay: event.allDay,
      rrule: event.recurrence,
    });

    const headers: Record<string, string> = {
      ...caldavHeaders(this.account.username, password, { 'Content-Type': 'text/calendar; charset=utf-8' }),
    };
    if (event.etag) headers['If-Match'] = `"${event.etag}"`;

    const resp = await fetch(event.url, {
      method: 'PUT',
      headers,
      body: icalData,
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error(`CalDAV PUT (update) failed: ${resp.status} ${resp.statusText}`);
    }

    const etag = resp.headers.get('ETag')?.replace(/"/g, '') ?? event.etag;
    return { ...event, etag };
  }

  /** Delete a VEVENT from the server via DELETE. */
  async deleteEvent(
    _calendarUrl: string,
    eventId: string,
    etag: string | undefined,
    password: string,
    eventUrl?: string,
  ): Promise<void> {
    const url = eventUrl ?? `${this.calendarBase}/personal/${eventId}.ics`;
    const headers: Record<string, string> = caldavHeaders(this.account.username, password);
    if (etag) headers['If-Match'] = `"${etag}"`;

    const resp = await fetch(url, { method: 'DELETE', headers });
    if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
      throw new Error(`CalDAV DELETE failed: ${resp.status} ${resp.statusText}`);
    }
  }

  // ─── Tasks (VTODO) ─────────────────────────────────────────────────────────

  /** List CalDAV collections that support VTODO components. */
  async getTaskLists(password: string): Promise<TaskList[]> {
    // SOGo puts tasks in the same Calendar home; we look for collections
    // that advertise VTODO support.  Fall back to a default "Tasks" list.
    const url = `${this.calendarBase}/`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <A:calendar-color/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`;

    let responses: unknown[];
    try {
      const resp = await fetch(url, {
        method: 'PROPFIND',
        headers: { ...caldavHeaders(this.account.username, password), Depth: '1' },
        body,
      });
      const xml = await resp.text();
      responses = parseMultistatus(xml);
    } catch {
      responses = [];
    }

    const lists: TaskList[] = [];
    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      if (href.endsWith('/Calendar/')) continue;

      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      const restype = prop['resourcetype'] as Record<string, unknown> | undefined;
      if (!restype?.['calendar']) continue;

      // Check if collection supports VTODO
      const compSet = prop['supported-calendar-component-set'] as Record<string, unknown> | undefined;
      const comps = toArray(compSet?.['comp'] as unknown);
      const supportsTodo = comps.some(
        (c) => String((c as Record<string, unknown>)?.['@_name'] ?? '').toUpperCase() === 'VTODO',
      );
      if (!supportsTodo) continue;

      const displayName = String(prop['displayname'] ?? 'Tasks');
      const rawColor = String(prop['calendar-color'] ?? '#16A34A');
      const color = rawColor.startsWith('#') ? rawColor.slice(0, 7) : '#16A34A';
      const id = href.split('/').filter(Boolean).pop() ?? `list-${lists.length}`;

      lists.push({
        id,
        name: displayName,
        color,
        url: `${this.account.davBaseUrl.replace(/\/$/, '')}${href}`,
      });
    }

    if (lists.length === 0) {
      lists.push({
        id: 'personal',
        name: 'Tasks',
        color: '#16A34A',
        url: `${this.calendarBase}/personal/`,
      });
    }

    return lists;
  }

  /** Fetch all VTODO objects from a task-list collection. */
  async getTasks(listUrl: string, password: string): Promise<Task[]> {
    if (!listUrl) return [];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const resp = await fetch(listUrl, {
      method: 'REPORT',
      headers: { ...caldavHeaders(this.account.username, password), Depth: '1' },
      body,
    });

    if (!resp.ok && resp.status !== 207) {
      throw new Error(`CalDAV REPORT (tasks) failed: ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const responses = parseMultistatus(xml);
    const tasks: Task[] = [];

    const listId = listUrl.split('/').filter(Boolean).pop() ?? 'personal';

    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      const etag = String(prop['getetag'] ?? '').replace(/"/g, '');
      const icalData = String(prop['calendar-data'] ?? '');
      if (!icalData) continue;

      const { todos } = parseIcal(icalData, etag, href);
      for (const t of todos) {
        tasks.push({
          id: t.uid,
          calendarId: listId,
          title: t.summary,
          description: t.description,
          dueDate: t.due?.split('T')[0],
          priority: icalPriorityToApp(t.priority),
          status: icalStatusToApp(t.status),
          completedAt: t.completed,
          etag: t.etag,
        });
      }
    }

    return tasks;
  }

  /** Create a new VTODO on the server via PUT. */
  async createTask(
    listUrl: string,
    task: Omit<Task, 'id' | 'etag'>,
    password: string,
  ): Promise<Task> {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mailcow-mobile`;
    const icalData = generateVTodo({
      uid,
      summary: task.title,
      description: task.description,
      due: task.dueDate,
      priority: appPriorityToIcal(task.priority),
      status: task.status.toUpperCase() as 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED',
    });

    const resourceUrl = `${listUrl.replace(/\/$/, '')}/${uid}.ics`;
    const resp = await fetch(resourceUrl, {
      method: 'PUT',
      headers: {
        ...caldavHeaders(this.account.username, password, { 'Content-Type': 'text/calendar; charset=utf-8' }),
        'If-None-Match': '*',
      },
      body: icalData,
    });

    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      throw new Error(`CalDAV PUT (task) failed: ${resp.status} ${resp.statusText}`);
    }

    return { ...task, id: uid, etag: resp.headers.get('ETag')?.replace(/"/g, '') ?? undefined };
  }

  /** Update an existing VTODO on the server via PUT. */
  async updateTask(
    _listUrl: string,
    task: Task,
    password: string,
    taskUrl?: string,
  ): Promise<Task> {
    const url = taskUrl ?? `${this.calendarBase}/personal/${task.id}.ics`;
    const icalData = generateVTodo({
      uid: task.id,
      summary: task.title,
      description: task.description,
      due: task.dueDate,
      priority: appPriorityToIcal(task.priority),
      status: task.status.toUpperCase() as 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED',
      completed: task.completedAt,
    });

    const headers: Record<string, string> = {
      ...caldavHeaders(this.account.username, password, { 'Content-Type': 'text/calendar; charset=utf-8' }),
    };
    if (task.etag) headers['If-Match'] = `"${task.etag}"`;

    const resp = await fetch(url, { method: 'PUT', headers, body: icalData });
    if (!resp.ok && resp.status !== 204) {
      throw new Error(`CalDAV PUT (task update) failed: ${resp.status} ${resp.statusText}`);
    }
    return task;
  }

  /** Delete a VTODO from the server via DELETE. */
  async deleteTask(
    _listUrl: string,
    taskId: string,
    etag: string | undefined,
    password: string,
    taskUrl?: string,
  ): Promise<void> {
    const url = taskUrl ?? `${this.calendarBase}/personal/${taskId}.ics`;
    const headers: Record<string, string> = caldavHeaders(this.account.username, password);
    if (etag) headers['If-Match'] = `"${etag}"`;

    const resp = await fetch(url, { method: 'DELETE', headers });
    if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
      throw new Error(`CalDAV DELETE (task) failed: ${resp.status} ${resp.statusText}`);
    }
  }
}
