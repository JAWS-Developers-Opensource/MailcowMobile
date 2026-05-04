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
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import type { MailcowAccount } from '../../types';

export default function LoginScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { setAccount, setStatus, setError, status } = useAuthStore();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapPort, setImapPort] = useState('993');
  const [smtpPort, setSmtpPort] = useState('587');

  const isLoading = status === 'loading';

  async function handleLogin() {
    if (!emailAddress.trim() || !password.trim() || !serverHost.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setStatus('loading');

    try {
      // Build the account object
      const account: MailcowAccount = {
        id: `account-${Date.now()}`,
        label: emailAddress,
        emailAddress: emailAddress.trim(),
        imapHost: serverHost.trim(),
        imapPort: parseInt(imapPort, 10) || 993,
        imapTls: true,
        smtpHost: serverHost.trim(),
        smtpPort: parseInt(smtpPort, 10) || 587,
        smtpTls: true,
        davBaseUrl: `https://${serverHost.trim()}/SOGo/dav/${encodeURIComponent(emailAddress.trim())}`,
        username: emailAddress.trim(),
        passwordStored: true,
        useOAuth2: false,
      };

      // TODO: verify credentials with an actual IMAP ping or API call
      // For now, accept any non-empty credentials
      setAccount(account);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      Alert.alert('Login Failed', 'Could not connect to the server. Please check your credentials and server address.');
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
          <Text style={[styles.logo, { color: colors.primary }]}>✉️</Text>
          <Text style={[styles.title, { color: colors.text }]}>MailcowMobile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect to your Mailcow server
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
            onChangeText={setEmailAddress}
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
            onChangeText={setServerHost}
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
              <Label text="IMAP Port" colors={colors} />
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
                onChangeText={setImapPort}
                keyboardType="number-pad"
                placeholder="993"
                placeholderTextColor={colors.textSecondary}
              />

              <Label text="SMTP Port" colors={colors} />
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
                onChangeText={setSmtpPort}
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
            MailcowMobile is an unofficial open-source client.{'\n'}
            JAWS Developers is neither affiliated nor partnered with Mailcow.
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
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15 },
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
