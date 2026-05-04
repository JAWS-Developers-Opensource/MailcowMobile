/**
 * CardDAV Service
 *
 * Handles CardDAV connections for contacts via the Mailcow / SOGo CardDAV endpoint.
 *
 * The Mailcow CardDAV endpoint is typically:
 *   https://<host>/SOGo/dav/<username>/Contacts/
 */

import type { AddressBook, Contact, MailcowAccount } from '../types';

export class CardDavService {
  private account: MailcowAccount;

  constructor(account: MailcowAccount) {
    this.account = account;
  }

  private get contactsBase(): string {
    return `${this.account.davBaseUrl}/Contacts`;
  }

  /** Fetch the list of address books. */
  async getAddressBooks(_password: string): Promise<AddressBook[]> {
    // TODO: PROPFIND request to list address books
    return [
      {
        id: 'ab-default',
        name: 'Personal Contacts',
        url: `${this.contactsBase}/personal/`,
        isDefault: true,
      },
    ];
  }

  /** Fetch all contacts from an address book. */
  async getContacts(_addressBookUrl: string, _password: string): Promise<Contact[]> {
    // TODO: REPORT request with addressbook-query
    return [
      {
        id: 'contact-1',
        addressBookId: 'ab-default',
        fullName: 'Alice Example',
        firstName: 'Alice',
        lastName: 'Example',
        emails: [{ type: 'work', address: 'alice@example.com' }],
        phones: [{ type: 'work', number: '+1 555 0100' }],
      },
      {
        id: 'contact-2',
        addressBookId: 'ab-default',
        fullName: 'Bob Example',
        firstName: 'Bob',
        lastName: 'Example',
        emails: [{ type: 'home', address: 'bob@example.com' }],
        phones: [{ type: 'mobile', number: '+1 555 0200' }],
        organization: 'JAWS Developers',
      },
    ];
  }

  /** Create a new contact. */
  async createContact(
    addressBookUrl: string,
    contact: Omit<Contact, 'id' | 'etag'>,
    _password: string,
  ): Promise<Contact> {
    // TODO: PUT request with vCard body
    const id = `contact-${Date.now()}`;
    return { ...contact, id };
  }

  /** Update an existing contact. */
  async updateContact(
    addressBookUrl: string,
    contact: Contact,
    _password: string,
  ): Promise<Contact> {
    // TODO: PUT request with If-Match ETag
    return contact;
  }

  /** Delete a contact. */
  async deleteContact(
    addressBookUrl: string,
    contactId: string,
    etag: string | undefined,
    _password: string,
  ): Promise<void> {
    // TODO: DELETE request
    console.warn('deleteContact not yet implemented', { addressBookUrl, contactId, etag });
  }
}
