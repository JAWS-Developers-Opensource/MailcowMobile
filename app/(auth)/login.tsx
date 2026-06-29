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
import { normalizeServerHost, loginErrorMessage } from '../../utils/loginValidation';
import { ImapService } from '../../services/imap';
import type { MailcowAccount } from '../../types';

function isImapGreetingTimeout(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return message.toLowerCase().includes('timed out waiting for server greeting');
}

export default function LoginScreen() {
  console.log('Rendering LoginScreen');
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { setAccount, setStatus, setError, status } = useAuthStore();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [isServerHostManuallyEdited, setIsServerHostManuallyEdited] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapPort, setImapPort] = useState('993');
  const [smtpPort, setSmtpPort] = useState('465');
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

    const loginAttemptId = `login-${Date.now()}`;
    const startedAt = Date.now();
    console.log(`[Login:${loginAttemptId}] Start`, {
      email: emailAddress.trim(),
      serverHost: serverHost.trim(),
      imapPort,
      imapTls,
    });

    setStatus('loading');
    console.log(`[Login:${loginAttemptId}] Auth status set to loading`);

    try {
      const normalizedHost = normalizeServerHost(serverHost);
      const accountId = `account-${Date.now()}`;
      console.log(`[Login:${loginAttemptId}] Host normalized`, {
        originalHost: serverHost.trim(),
        normalizedHost,
      });

      const account: MailcowAccount = {
        id: accountId,
        label: emailAddress,
        emailAddress: emailAddress.trim(),
        imapHost: normalizedHost,
        imapPort: parseInt(imapPort, 10) || 993,
        imapTls,
        smtpHost: normalizedHost,
        smtpPort: parseInt(smtpPort, 10) || 465,
        smtpTls,
        davBaseUrl: `https://${normalizedHost}/SOGo/dav/${encodeURIComponent(emailAddress.trim())}`,
        username: emailAddress.trim(),
        passwordStored: true,
        useOAuth2: false,
      };

      console.log(`[Login:${loginAttemptId}] Verifying IMAP credentials`, {
        accountId,
        username: account.username,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        imapTls: account.imapTls,
      });

      // Validate credentials before persisting account/login state.
      const imap = new ImapService(account);
      try {
        await imap.verifyCredentials(password.trim());
      } catch (err) {
        // Some Mailcow installs expose STARTTLS on 143 while 993 can timeout
        // (especially with local IP/self-managed TLS setups). Retry once.
        if (account.imapTls && account.imapPort === 993 && isImapGreetingTimeout(err)) {
          const retryAccount: MailcowAccount = {
            ...account,
            imapPort: 143,
            imapTls: false,
          };
          const retryImap = new ImapService(retryAccount);
          await retryImap.verifyCredentials(password.trim());
          account.imapPort = 143;
          account.imapTls = false;
        } else {
          throw err;
        }
      }
      console.log(`[Login:${loginAttemptId}] IMAP credentials verified`, {
        elapsedMs: Date.now() - startedAt,
      });

      // Persist account JSON and password in SecureStore for auto-login on next launch
      await savePassword(accountId, password.trim());
      console.log(`[Login:${loginAttemptId}] Password saved`);
      await saveAccount(accountId, JSON.stringify(account));
      console.log(`[Login:${loginAttemptId}] Account saved`);
      await saveActiveAccountId(accountId);
      console.log(`[Login:${loginAttemptId}] Active account saved`);

      // Store account + in-memory password
      setAccount(account, password.trim());
      console.log(`[Login:${loginAttemptId}] Account set in store`, {
        elapsedMs: Date.now() - startedAt,
      });
      router.replace('/(tabs)');
      console.log(`[Login:${loginAttemptId}] Navigation to tabs complete`);
    } catch (err) {
      console.log(`[Login:${loginAttemptId}] Login failed`, {
        elapsedMs: Date.now() - startedAt,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      });
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
                placeholder="465"
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
