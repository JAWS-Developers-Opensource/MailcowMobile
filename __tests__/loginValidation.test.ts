import { loginErrorMessage, normalizeServerHost } from '../utils/loginValidation';

describe('loginValidation utilities', () => {
  describe('normalizeServerHost', () => {
    it('strips https protocol and trailing slash', () => {
      expect(normalizeServerHost('https://mail.example.com/')).toBe('mail.example.com');
    });

    it('strips http protocol and keeps host/path input normalized', () => {
      expect(normalizeServerHost('http://mail.example.com///')).toBe('mail.example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeServerHost('  mail.example.com  ')).toBe('mail.example.com');
    });
  });

  describe('loginErrorMessage', () => {
    it('returns custom runtime message when IMAP native runtime is unavailable', () => {
      const err = new Error('IMAP requires a custom Expo dev client or production build.');
      expect(loginErrorMessage(err)).toBe(err.message);
    });

    it('maps auth failures to a user-friendly invalid credential message', () => {
      expect(loginErrorMessage(new Error('Authentication failed for user'))).toBe(
        'Invalid IMAP credentials. Check email/password and IMAP settings.',
      );
      expect(loginErrorMessage(new Error('LOGIN FAILED'))).toBe(
        'Invalid IMAP credentials. Check email/password and IMAP settings.',
      );
      expect(loginErrorMessage(new Error('invalid credentials'))).toBe(
        'Invalid IMAP credentials. Check email/password and IMAP settings.',
      );
    });

    it('maps timeout errors to a network guidance message', () => {
      expect(loginErrorMessage(new Error('connection timed out'))).toBe(
        'Connection timeout. Check server hostname, port, and network.',
      );
    });

    it('falls back to original message for unknown errors', () => {
      expect(loginErrorMessage(new Error('unexpected server response'))).toBe(
        'unexpected server response',
      );
    });
  });
});
