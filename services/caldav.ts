/**
 * CalDAV Service
 *
 * Handles CalDAV connections for calendar events (VEVENT) and
 * tasks (VTODO) via the Mailcow / SOGo CalDAV endpoint.
 *
 * The Mailcow CalDAV endpoint is typically:
 *   https://<host>/SOGo/dav/<username>/Calendar/
 */

import type { Calendar, CalendarEvent, MailcowAccount, Task, TaskList } from '../types';

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

  /** Fetch the list of calendars available for the account. */
  async getCalendars(_password: string): Promise<Calendar[]> {
    // TODO: PROPFIND request to list calendars
    return [
      {
        id: 'default',
        name: 'Personal',
        color: '#2563EB',
        url: `${this.calendarBase}/personal/`,
        visible: true,
        isDefault: true,
      },
    ];
  }

  /** Fetch all events within a date range. */
  async getEvents(
    _calendarUrl: string,
    _from: string,
    _to: string,
    _password: string,
  ): Promise<CalendarEvent[]> {
    // TODO: REPORT request with calendar-query VCALENDAR filter
    return [
      {
        id: 'evt-1',
        calendarId: 'default',
        title: 'Team standup',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 1800000).toISOString(),
        allDay: false,
        color: '#2563EB',
      },
    ];
  }

  /** Create a new calendar event. */
  async createEvent(
    _calendarUrl: string,
    event: Omit<CalendarEvent, 'id' | 'etag'>,
    _password: string,
  ): Promise<CalendarEvent> {
    // TODO: PUT request with VCALENDAR / VEVENT body
    const id = `evt-${Date.now()}`;
    return { ...event, id };
  }

  /** Update an existing event. */
  async updateEvent(
    _calendarUrl: string,
    event: CalendarEvent,
    _password: string,
  ): Promise<CalendarEvent> {
    // TODO: PUT request with If-Match ETag header
    return event;
  }

  /** Delete a calendar event. */
  async deleteEvent(
    calendarUrl: string,
    eventId: string,
    etag: string | undefined,
    _password: string,
  ): Promise<void> {
    // TODO: DELETE request with If-Match ETag header
    console.warn('deleteEvent not yet implemented', { calendarUrl, eventId, etag });
  }

  // ─── Tasks (VTODO) ─────────────────────────────────────────────────────────

  /** Fetch task lists (CalDAV collections that support VTODO). */
  async getTaskLists(_password: string): Promise<TaskList[]> {
    return [
      {
        id: 'tasks-default',
        name: 'Tasks',
        color: '#16A34A',
        url: `${this.tasksBase}/personal/`,
      },
    ];
  }

  /** Fetch tasks from a task list. */
  async getTasks(_listUrl: string, _password: string): Promise<Task[]> {
    return [
      {
        id: 'task-1',
        calendarId: 'tasks-default',
        title: 'Review PR #42',
        priority: 'high',
        status: 'needs-action',
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      },
    ];
  }

  /** Create a new task. */
  async createTask(
    _listUrl: string,
    task: Omit<Task, 'id' | 'etag'>,
    _password: string,
  ): Promise<Task> {
    const id = `task-${Date.now()}`;
    return { ...task, id };
  }

  /** Update an existing task. */
  async updateTask(
    _listUrl: string,
    task: Task,
    _password: string,
  ): Promise<Task> {
    return task;
  }

  /** Delete a task. */
  async deleteTask(
    listUrl: string,
    taskId: string,
    etag: string | undefined,
    _password: string,
  ): Promise<void> {
    console.warn('deleteTask not yet implemented', { listUrl, taskId, etag });
  }
}
