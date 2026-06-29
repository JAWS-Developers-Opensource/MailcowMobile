export const normalizeServerHost = (host: string): string =>
  host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

export const loginErrorMessage = (err: unknown): string => {
  const message = err instanceof Error ? err.message : 'Login failed';
  const lower = message.toLowerCase();
  if (lower.includes('imap requires a custom expo dev client')) {
    return message;
  }
  if (
    lower.includes('authentication failed') ||
    lower.includes('invalid credentials') ||
    lower.includes('login failed')
  ) {
    return 'Invalid IMAP credentials. Check email/password and IMAP settings.';
  }
  if (lower.includes('timed out')) {
    return 'Connection timeout. Check server hostname, port, and network.';
  }
  return message;
};
