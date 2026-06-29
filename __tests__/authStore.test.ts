import { useAuthStore } from '../store/authStore';
import type { MailcowAccount } from '../types';

const mockAccount: MailcowAccount = {
  id: 'test-1',
  label: 'Test Account',
  emailAddress: 'user@example.com',
  imapHost: 'mail.example.com',
  imapPort: 993,
  imapTls: true,
  smtpHost: 'mail.example.com',
  smtpPort: 587,
  smtpTls: true,
  davBaseUrl: 'https://mail.example.com/SOGo/dav/user@example.com',
  username: 'user@example.com',
  passwordStored: true,
  useOAuth2: false,
};

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({ account: null, password: null, status: 'idle', error: null });
  });

  it('starts in idle state', () => {
    const { status, account, password } = useAuthStore.getState();
    expect(status).toBe('idle');
    expect(account).toBeNull();
    expect(password).toBeNull();
  });

  it('sets account and transitions to authenticated', () => {
    useAuthStore.getState().setAccount(mockAccount, 'secret123');
    const { status, account, password } = useAuthStore.getState();
    expect(status).toBe('authenticated');
    expect(account?.emailAddress).toBe('user@example.com');
    expect(password).toBe('secret123');
  });

  it('logs out and resets state', () => {
    useAuthStore.getState().setAccount(mockAccount, 'secret123');
    useAuthStore.getState().logout();
    const { status, account, password } = useAuthStore.getState();
    expect(status).toBe('idle');
    expect(account).toBeNull();
    expect(password).toBeNull();
  });

  it('sets error state', () => {
    useAuthStore.getState().setError('Connection refused');
    const { status, error } = useAuthStore.getState();
    expect(status).toBe('error');
    expect(error).toBe('Connection refused');
  });
});
