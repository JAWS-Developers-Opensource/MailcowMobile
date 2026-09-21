// ─── Account / Auth ──────────────────────────────────────────────────────────

export interface MailcowAccount {
  id: string;
  label: string;
  emailAddress: string;
  /** IMAP hostname, e.g. mail.example.com */
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  /** SMTP hostname */
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
  /** CalDAV / CardDAV base URL */
  davBaseUrl: string;
  username: string;
  /** Password is stored in SecureStore, not in-memory beyond login */
  passwordStored: boolean;
  useOAuth2: boolean;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

// ─── Email ────────────────────────────────────────────────────────────────────

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: string; // base64 for small attachments
}

export interface Email {
  id: string;
  uid: number;
  folder: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date: string; // ISO 8601
  bodyText?: string;
  bodyHtml?: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailFolder {
  name: string;
  path: string;
  unreadCount: number;
  totalCount: number;
  children?: EmailFolder[];
}

export interface ComposeEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyToId?: string;
  forwardId?: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  allDay: boolean;
  recurrence?: string; // RRULE string
  color?: string;
  url?: string;
  etag?: string;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  url: string;
  visible: boolean;
  isDefault: boolean;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskStatus = 'needs-action' | 'in-process' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  dueDate?: string; // ISO 8601 date
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  etag?: string;
}

export interface TaskList {
  id: string;
  name: string;
  color: string;
  url: string;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface ContactEmail {
  type: string; // work, home, other
  address: string;
}

export interface ContactPhone {
  type: string;
  number: string;
}

export interface ContactAddress {
  type: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface Contact {
  id: string;
  addressBookId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses?: ContactAddress[];
  organization?: string;
  title?: string;
  notes?: string;
  photo?: string; // base64 or URI
  etag?: string;
}

export interface AddressBook {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}
