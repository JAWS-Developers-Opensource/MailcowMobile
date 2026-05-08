import { parseIcal, generateVEvent, generateVTodo } from '../utils/ical';

describe('ical utils', () => {
  const sampleVEvent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event-1@example.com
DTSTAMP:20250501T120000Z
DTSTART:20250501T140000Z
DTEND:20250501T150000Z
SUMMARY:Team standup
DESCRIPTION:Weekly team sync
LOCATION:Zoom
END:VEVENT
END:VCALENDAR`;

  const sampleVTodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VTODO
UID:test-todo-1@example.com
DTSTAMP:20250501T120000Z
SUMMARY:Review PR
PRIORITY:1
STATUS:NEEDS-ACTION
DUE;VALUE=DATE:20250510
END:VTODO
END:VCALENDAR`;

  it('parses a VEVENT from iCal', () => {
    const { events } = parseIcal(sampleVEvent);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('test-event-1@example.com');
    expect(events[0].summary).toBe('Team standup');
    expect(events[0].description).toBe('Weekly team sync');
    expect(events[0].location).toBe('Zoom');
    expect(events[0].allDay).toBe(false);
  });

  it('parses a VTODO from iCal', () => {
    const { todos } = parseIcal(sampleVTodo);
    expect(todos).toHaveLength(1);
    expect(todos[0].uid).toBe('test-todo-1@example.com');
    expect(todos[0].summary).toBe('Review PR');
    expect(todos[0].priority).toBe(1);
    expect(todos[0].status).toBe('NEEDS-ACTION');
    expect(todos[0].due).toBe('2025-05-10');
  });

  it('generates a VEVENT string', () => {
    const ical = generateVEvent({
      uid: 'gen-event-1@test',
      summary: 'Generated Event',
      dtstart: '2025-06-01T10:00:00Z',
      dtend: '2025-06-01T11:00:00Z',
      allDay: false,
    });
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('BEGIN:VEVENT');
    expect(ical).toContain('SUMMARY:Generated Event');
    expect(ical).toContain('UID:gen-event-1@test');
    expect(ical).toContain('END:VEVENT');
  });

  it('generates an all-day VEVENT', () => {
    const ical = generateVEvent({
      uid: 'allday-1@test',
      summary: 'All Day Event',
      dtstart: '2025-06-15',
      allDay: true,
    });
    expect(ical).toContain('DTSTART;VALUE=DATE:20250615');
  });

  it('generates a VTODO string', () => {
    const ical = generateVTodo({
      uid: 'gen-todo-1@test',
      summary: 'Buy groceries',
      due: '2025-06-01',
      priority: 5,
      status: 'NEEDS-ACTION',
    });
    expect(ical).toContain('BEGIN:VTODO');
    expect(ical).toContain('SUMMARY:Buy groceries');
    expect(ical).toContain('PRIORITY:5');
  });

  it('round-trips a VEVENT', () => {
    const uid = 'rt-event-1@test';
    const ical = generateVEvent({
      uid,
      summary: 'Round-trip test',
      dtstart: '2025-07-04T09:00:00Z',
      dtend: '2025-07-04T10:00:00Z',
      allDay: false,
      description: 'Independence Day',
    });
    const { events } = parseIcal(ical);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe(uid);
    expect(events[0].summary).toBe('Round-trip test');
    expect(events[0].description).toBe('Independence Day');
  });
});
