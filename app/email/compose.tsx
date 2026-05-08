import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { SmtpService } from '../../services/smtp';

export default function ComposeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account, password } = useAuthStore();
  const params = useLocalSearchParams<{
    replyTo?: string;
    subject?: string;
    body?: string;
    replyToId?: string;
    forwardId?: string;
  }>();

  const [to, setTo] = useState(params.replyTo ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const smtp = account ? new SmtpService(account) : null;

  async function handleSend() {
    const toAddresses = to.split(',').map((s) => s.trim()).filter(Boolean);

    if (toAddresses.length === 0) {
      Alert.alert('Missing Recipient', 'Please enter at least one recipient in the To field.');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Are you sure you want to send without a subject?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Anyway', onPress: () => doSend(toAddresses) },
      ]);
      return;
    }

    doSend(toAddresses);
  }

  async function doSend(toAddresses: string[]) {
    if (!smtp || !password) {
      Alert.alert('Error', 'Not logged in.');
      return;
    }
    setIsSending(true);
    try {
      await smtp.sendEmail({
        to: toAddresses,
        cc: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        subject: subject.trim(),
        bodyText: body,
        replyToId: params.replyToId,
        forwardId: params.forwardId,
      }, password);
      router.dismiss();
    } catch (err) {
      Alert.alert('Send Failed', err instanceof Error ? err.message : 'Could not send email.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New Message',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.dismiss()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: colors.primary, fontSize: 16 }}>Discard</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSend}
              disabled={isSending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isSending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                  Send
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* From (read-only) */}
          <FieldRow label="From" colors={colors} last={false}>
            <Text style={[styles.fromValue, { color: colors.textSecondary }]}>
              {account?.emailAddress ?? ''}
            </Text>
          </FieldRow>

          {/* To */}
          <FieldRow label="To" colors={colors} last={false}>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={to}
              onChangeText={setTo}
              placeholder="recipient@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <TouchableOpacity onPress={() => setShowCcBcc((v) => !v)}>
              <Text style={[styles.ccToggle, { color: colors.primary }]}>
                {showCcBcc ? '−' : 'Cc/Bcc'}
              </Text>
            </TouchableOpacity>
          </FieldRow>

          {showCcBcc ? (
            <>
              <FieldRow label="Cc" colors={colors} last={false}>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={cc}
                  onChangeText={setCc}
                  placeholder="cc@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
              </FieldRow>
              <FieldRow label="Bcc" colors={colors} last={false}>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={bcc}
                  onChangeText={setBcc}
                  placeholder="bcc@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
              </FieldRow>
            </>
          ) : null}

          {/* Subject */}
          <FieldRow label="Subject" colors={colors} last>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={colors.textSecondary}
            />
          </FieldRow>

          {/* Body */}
          <TextInput
            style={[styles.body, { color: colors.text }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your message…"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function FieldRow({
  label,
  colors,
  last,
  children,
}: {
  label: string;
  colors: (typeof Colors)['light'];
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.fieldRow,
        { borderBottomColor: colors.border },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.fieldContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  fieldLabel: { width: 52, fontSize: 14, fontWeight: '600', flexShrink: 0 },
  fieldContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  fieldInput: { flex: 1, fontSize: 15, padding: 0 },
  fromValue: { flex: 1, fontSize: 15 },
  ccToggle: { fontSize: 14, fontWeight: '500', paddingLeft: 8 },
  body: {
    flex: 1,
    fontSize: 15,
    padding: 16,
    minHeight: 300,
    lineHeight: 22,
  },
});
