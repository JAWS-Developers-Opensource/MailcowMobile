import { useEmailStore } from '../store/emailStore';
import type { Email } from '../types';

const mockEmail: Email = {
  id: 'email-1',
  uid: 1001,
  folder: 'INBOX',
  subject: 'Test Email',
  from: { name: 'Sender', address: 'sender@example.com' },
  to: [{ address: 'recipient@example.com' }],
  date: new Date().toISOString(),
  bodyText: 'Hello world',
  isRead: false,
  isFlagged: false,
  hasAttachments: false,
};

describe('emailStore', () => {
  beforeEach(() => {
    useEmailStore.setState({
      folders: [],
      emails: [],
      selectedFolder: 'INBOX',
      selectedEmail: null,
      isLoading: false,
      error: null,
    });
  });

  it('sets emails', () => {
    useEmailStore.getState().setEmails([mockEmail]);
    expect(useEmailStore.getState().emails).toHaveLength(1);
  });

  it('marks email as read', () => {
    useEmailStore.getState().setEmails([mockEmail]);
    useEmailStore.getState().markAsRead('email-1');
    const email = useEmailStore.getState().emails[0];
    expect(email.isRead).toBe(true);
  });

  it('removes email', () => {
    useEmailStore.getState().setEmails([mockEmail]);
    useEmailStore.getState().removeEmail('email-1');
    expect(useEmailStore.getState().emails).toHaveLength(0);
  });

  it('changes selected folder and clears emails', () => {
    useEmailStore.getState().setEmails([mockEmail]);
    useEmailStore.getState().setSelectedFolder('Sent');
    expect(useEmailStore.getState().selectedFolder).toBe('Sent');
    expect(useEmailStore.getState().emails).toHaveLength(0);
  });
});
