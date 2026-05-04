import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account, logout } = useAuthStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [htmlEmail, setHtmlEmail] = useState(false);

  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Account section */}
      <SectionHeader title="Account" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row label="Email" value={account?.emailAddress ?? '—'} colors={colors} />
        <Row label="Server" value={account?.imapHost ?? '—'} colors={colors} />
        <Row label="IMAP Port" value={String(account?.imapPort ?? '—')} colors={colors} />
        <Row label="SMTP Port" value={String(account?.smtpPort ?? '—')} colors={colors} last />
      </View>

      {/* Email section */}
      <SectionHeader title="Email" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ToggleRow
          label="HTML Email Rendering"
          description="Render HTML emails in a WebView"
          value={htmlEmail}
          onValueChange={setHtmlEmail}
          colors={colors}
        />
        <ToggleRow
          label="Auto-refresh"
          description="Automatically check for new emails"
          value={autoRefresh}
          onValueChange={setAutoRefresh}
          colors={colors}
          last
        />
      </View>

      {/* Notifications */}
      <SectionHeader title="Notifications" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ToggleRow
          label="Push Notifications"
          description="Receive alerts for new emails"
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          colors={colors}
          last
        />
      </View>

      {/* About */}
      <SectionHeader title="About" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row label="Version" value="0.0.1" colors={colors} />
        <Row label="Built with" value="Expo + React Native" colors={colors} last />
      </View>

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
        MailcowMobile is an unofficial open-source client for Mailcow servers.{'\n'}
        JAWS Developers is neither affiliated nor partnered with Mailcow.
      </Text>

      {/* Sign out */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
      {title.toUpperCase()}
    </Text>
  );
}

function Row({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light'];
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  colors,
  last,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: (typeof Colors)['light'];
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14, maxWidth: '55%' },
  rowDescription: { fontSize: 12, marginTop: 2 },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 16,
    lineHeight: 18,
  },
  logoutButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
