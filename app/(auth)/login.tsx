import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { savePassword, saveAccount, saveActiveAccountId } from '../../utils/secureStorage';
import { ImapService } from '../../services/imap';
import type { MailcowAccount } from '../../types';

const normalizeServerHost = (host: string): string =>
  host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

const loginErrorMessage = (err: unknown): string => {
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

export default function LoginScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { setAccount, setStatus, setError, status } = useAuthStore();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [isServerHostManuallyEdited, setIsServerHostManuallyEdited] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapPort, setImapPort] = useState('993');
  const [smtpPort, setSmtpPort] = useState('587');
  const [imapTls, setImapTls] = useState(true);
  const [smtpTls, setSmtpTls] = useState(true);

  const isLoading = status === 'loading';

  const handleEmailChange = (email: string) => {
    setEmailAddress(email);

    // Auto-populate server host if not manually edited
    if (!isServerHostManuallyEdited && email.includes('@')) {
      const domain = email.split('@')[1];
      if (domain) {
        setServerHost(`mail.${domain}`);
      }
    }
  };

  const handleServerHostChange = (host: string) => {
    setServerHost(host);
    setIsServerHostManuallyEdited(true);
  };

  /** Update TLS defaults when the user changes ports. */
  const handleImapPortChange = (p: string) => {
    setImapPort(p);
    setImapTls(p === '993');
  };

  const handleSmtpPortChange = (p: string) => {
    setSmtpPort(p);
    setSmtpTls(p === '465');
  };

  async function handleLogin() {
    if (!emailAddress.trim() || !password.trim() || !serverHost.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setStatus('loading');

    try {
      const normalizedHost = normalizeServerHost(serverHost);
      const accountId = `account-${Date.now()}`;
      const account: MailcowAccount = {
        id: accountId,
        label: emailAddress,
        emailAddress: emailAddress.trim(),
        imapHost: normalizedHost,
        imapPort: parseInt(imapPort, 10) || 993,
        imapTls,
        smtpHost: normalizedHost,
        smtpPort: parseInt(smtpPort, 10) || 587,
        smtpTls,
        davBaseUrl: `https://${normalizedHost}/SOGo/dav/${encodeURIComponent(emailAddress.trim())}`,
        username: emailAddress.trim(),
        passwordStored: true,
        useOAuth2: false,
      };

      // Validate credentials before persisting account/login state.
      const imap = new ImapService(account);
      await imap.verifyCredentials(password.trim());

      // Persist account JSON and password in SecureStore for auto-login on next launch
      await savePassword(accountId, password.trim());
      await saveAccount(accountId, JSON.stringify(account));
      await saveActiveAccountId(accountId);

      // Store account + in-memory password
      setAccount(account, password.trim());
      router.replace('/(tabs)');
    } catch (err) {
      const message = loginErrorMessage(err);
      setError(message);
      Alert.alert(
        'Login Failed',
        message,
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Title */}
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <Text style={[styles.title, { color: colors.text }]}>MailcowMobile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect directly to your Mailcow server
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Label text="Email Address" colors={colors} required />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={emailAddress}
            onChangeText={handleEmailChange}
            placeholder="you@mail.example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <Label text="Server Hostname" colors={colors} required />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={serverHost}
            onChangeText={handleServerHostChange}
            placeholder="mail.example.com"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Label text="Password" colors={colors} required />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            textContentType="password"
          />

          {/* Advanced Settings Toggle */}
          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            style={styles.advancedToggle}
          >
            <Text style={[styles.advancedToggleText, { color: colors.primary }]}>
              {showAdvanced ? '▲ Hide advanced settings' : '▼ Advanced settings'}
            </Text>
          </TouchableOpacity>

          {showAdvanced ? (
            <View
              style={[
                styles.advancedBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Label text="IMAP Port (993 = TLS, 143 = STARTTLS)" colors={colors} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={imapPort}
                onChangeText={handleImapPortChange}
                keyboardType="number-pad"
                placeholder="993"
                placeholderTextColor={colors.textSecondary}
              />

              <Label text="SMTP Port (465 = TLS, 587 = STARTTLS)" colors={colors} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={smtpPort}
                onChangeText={handleSmtpPortChange}
                keyboardType="number-pad"
                placeholder="587"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginButton,
              { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            MailcowMobile connects directly to your Mailcow server.{'\n'}
            IMAP · SMTP · CalDAV · CardDAV — no backend proxy required.{'\n\n'}
            MailcowMobile is an unofficial open-source client.{'\n'}
            Not affiliated with the Mailcow project.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({
  text,
  colors,
  required,
}: {
  text: string;
  colors: (typeof Colors)['light'];
  required?: boolean;
}) {
  return (
    <Text style={[styles.label, { color: colors.textSecondary }]}>
      {text}
      {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 100, height: 100, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: 'center' },
  form: {},
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  advancedToggle: { marginTop: 16, marginBottom: 4 },
  advancedToggleText: { fontSize: 14, fontWeight: '500' },
  advancedBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  loginButton: {
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
