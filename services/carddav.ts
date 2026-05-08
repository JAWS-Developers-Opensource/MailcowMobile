/**
 * CardDAV Service
 *
 * Real CardDAV implementation connecting directly to the user's Mailcow / SOGo
 * server using HTTP PROPFIND / REPORT / PUT / DELETE.
 *
 * Authentication: HTTP Basic (username + password in every request).
 * Protocol: CardDAV RFC 6352 over HTTPS — no backend proxy required.
 *
 * Mailcow endpoints (SOGo):
 *   Address book list : PROPFIND  https://<host>/SOGo/dav/<user>/Contacts/
 *   Contacts          : REPORT    https://<host>/SOGo/dav/<user>/Contacts/<book>/
 *   Create/update     : PUT       https://<host>/SOGo/dav/<user>/Contacts/<book>/<uid>.vcf
 *   Delete            : DELETE    same URL with optional If-Match ETag header
 */

import { XMLParser } from 'fast-xml-parser';
import type { AddressBook, Contact, MailcowAccount } from '../types';
import { parseVCards, generateVCard } from '../utils/vcard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function carddavHeaders(
  username: string,
  password: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    Authorization: basicAuth(username, password),
    'Content-Type': 'application/xml; charset=utf-8',
    ...extra,
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => ['response', 'propstat'].includes(name),
});

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseMultistatus(xml: string): unknown[] {
  const root = xmlParser.parse(xml) as Record<string, unknown>;
  const ms = root['multistatus'] as Record<string, unknown> | undefined;
  if (!ms) return [];
  return toArray(ms['response'] as unknown);
}

// ─── CardDavService ───────────────────────────────────────────────────────────

export class CardDavService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  private get contactsBase(): string {
    return `${this.account.davBaseUrl}/Contacts`;
  }

  // ─── Address Books ─────────────────────────────────────────────────────────

  /**
   * List all CardDAV address-book collections for this account.
   * Issues a PROPFIND Depth:1 to the Contacts home.
   */
  async getAddressBooks(password: string): Promise<AddressBook[]> {
    const url = `${this.contactsBase}/`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:CR="urn:ietf:params:xml:ns:carddav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

    let responses: unknown[];
    try {
      const resp = await fetch(url, {
        method: 'PROPFIND',
        headers: { ...carddavHeaders(this.account.username, password), Depth: '1' },
        body,
      });
      if (!resp.ok && resp.status !== 207) {
        throw new Error(`CardDAV PROPFIND failed: ${resp.status} ${resp.statusText}`);
      }
      const xml = await resp.text();
      responses = parseMultistatus(xml);
    } catch (err) {
      // Network error or server doesn't support CardDAV — return sensible default
      console.warn('CardDAV PROPFIND error, using default address book:', err);
      return [{
        id: 'personal',
        name: 'Personal Contacts',
        url: `${this.contactsBase}/personal/`,
        isDefault: true,
      }];
    }

    const books: AddressBook[] = [];
    let isFirst = true;

    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      if (href.endsWith('/Contacts/')) { isFirst = false; continue; }

      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      const restype = prop['resourcetype'] as Record<string, unknown> | undefined;
      if (!restype?.['addressbook']) continue;

      const displayName = String(prop['displayname'] ?? href.split('/').filter(Boolean).pop() ?? 'Contacts');
      const id = href.split('/').filter(Boolean).pop() ?? `ab-${books.length}`;

      books.push({
        id,
        name: displayName,
        url: `${this.account.davBaseUrl.replace(/\/$/, '')}${href}`,
        isDefault: isFirst,
      });
      isFirst = false;
    }

    if (books.length === 0) {
      books.push({
        id: 'personal',
        name: 'Personal Contacts',
        url: `${this.contactsBase}/personal/`,
        isDefault: true,
      });
    }

    return books;
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  /**
   * Fetch all contacts from an address-book collection.
   * Uses a CardDAV addressbook-query REPORT.
   */
  async getContacts(addressBookUrl: string, password: string): Promise<Contact[]> {
    if (!addressBookUrl) return [];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<CR:addressbook-query xmlns:CR="urn:ietf:params:xml:ns:carddav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <CR:address-data/>
  </D:prop>
  <CR:filter/>
</CR:addressbook-query>`;

    const resp = await fetch(addressBookUrl, {
      method: 'REPORT',
      headers: { ...carddavHeaders(this.account.username, password), Depth: '1' },
      body,
    });

    if (!resp.ok && resp.status !== 207) {
      throw new Error(`CardDAV REPORT failed: ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const responses = parseMultistatus(xml);
    const contacts: Contact[] = [];

    const bookId = addressBookUrl.split('/').filter(Boolean).pop() ?? 'personal';

    for (const r of responses) {
      const href = String(dig(r, 'href') ?? '');
      const propstat = toArray(dig(r, 'propstat') as unknown)[0] as Record<string, unknown> | undefined;
      const prop = propstat?.['prop'] as Record<string, unknown> | undefined;
      if (!prop) continue;

      const etag = String(prop['getetag'] ?? '').replace(/"/g, '');
      const vcardData = String(prop['address-data'] ?? '');
      if (!vcardData) continue;

      const cards = parseVCards(vcardData, etag, href);
      for (const card of cards) {
        contacts.push({
          id: card.uid,
          addressBookId: bookId,
          fullName: card.fn,
          firstName: card.n?.given,
          lastName: card.n?.family,
          emails: card.emails.map((e) => ({ type: e.type, address: e.value })),
          phones: card.phones.map((p) => ({ type: p.type, number: p.value })),
          organization: card.org,
          title: card.title,
          notes: card.note,
          photo: card.photo,
          etag: card.etag,
        });
      }
    }

    return contacts;
  }

  /** Create a new contact on the server via PUT. */
  async createContact(
    addressBookUrl: string,
    contact: Omit<Contact, 'id' | 'etag'>,
    password: string,
  ): Promise<Contact> {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mailcow-mobile`;
    const vcardData = generateVCard({
      uid,
      fn: contact.fullName,
      n: contact.firstName !== undefined || contact.lastName !== undefined
        ? {
            family: contact.lastName ?? '',
            given: contact.firstName ?? '',
          }
        : undefined,
      emails: contact.emails.map((e) => ({ type: e.type, value: e.address })),
      phones: contact.phones.map((p) => ({ type: p.type, value: p.number })),
      org: contact.organization,
      title: contact.title,
      note: contact.notes,
      photo: contact.photo,
    });

    const resourceUrl = `${addressBookUrl.replace(/\/$/, '')}/${uid}.vcf`;
    const resp = await fetch(resourceUrl, {
      method: 'PUT',
      headers: {
        ...carddavHeaders(this.account.username, password, {
          'Content-Type': 'text/vcard; charset=utf-8',
        }),
        'If-None-Match': '*',
      },
      body: vcardData,
    });

    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      throw new Error(`CardDAV PUT failed: ${resp.status} ${resp.statusText}`);
    }

    const etag = resp.headers.get('ETag')?.replace(/"/g, '') ?? undefined;
    return { ...contact, id: uid, etag };
  }

  /** Update an existing contact on the server via PUT with If-Match. */
  async updateContact(
    _addressBookUrl: string,
    contact: Contact,
    password: string,
    contactUrl?: string,
  ): Promise<Contact> {
    const url = contactUrl ?? `${this.contactsBase}/personal/${contact.id}.vcf`;
    const vcardData = generateVCard({
      uid: contact.id,
      fn: contact.fullName,
      n: contact.firstName !== undefined || contact.lastName !== undefined
        ? { family: contact.lastName ?? '', given: contact.firstName ?? '' }
        : undefined,
      emails: contact.emails.map((e) => ({ type: e.type, value: e.address })),
      phones: contact.phones.map((p) => ({ type: p.type, value: p.number })),
      org: contact.organization,
      title: contact.title,
      note: contact.notes,
      photo: contact.photo,
    });

    const headers: Record<string, string> = carddavHeaders(
      this.account.username,
      password,
      { 'Content-Type': 'text/vcard; charset=utf-8' },
    );
    if (contact.etag) headers['If-Match'] = `"${contact.etag}"`;

    const resp = await fetch(url, { method: 'PUT', headers, body: vcardData });
    if (!resp.ok && resp.status !== 204) {
      throw new Error(`CardDAV PUT (update) failed: ${resp.status} ${resp.statusText}`);
    }

    return { ...contact, etag: resp.headers.get('ETag')?.replace(/"/g, '') ?? contact.etag };
  }

  /** Delete a contact from the server via DELETE. */
  async deleteContact(
    _addressBookUrl: string,
    contactId: string,
    etag: string | undefined,
    password: string,
    contactUrl?: string,
  ): Promise<void> {
    const url = contactUrl ?? `${this.contactsBase}/personal/${contactId}.vcf`;
    const headers: Record<string, string> = carddavHeaders(this.account.username, password);
    if (etag) headers['If-Match'] = `"${etag}"`;

    const resp = await fetch(url, { method: 'DELETE', headers });
    if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
      throw new Error(`CardDAV DELETE failed: ${resp.status} ${resp.statusText}`);
    }
  }
}
