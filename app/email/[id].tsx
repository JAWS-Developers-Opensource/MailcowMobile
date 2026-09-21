import React, { useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useEmailStore } from '../../store/emailStore';
import { useAuthStore } from '../../store/authStore';
import { ImapService } from '../../services/imap';
import { EmailDetail } from '../../components/email/EmailDetail';

export default function EmailDetailScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { id } = useLocalSearchParams<{ id: string }>();
  const { emails, markAsRead, markAsFlagged, removeEmail } = useEmailStore();
  const { account, password } = useAuthStore();

  const email = emails.find((e) => e.id === id);
  const imap = account ? new ImapService(account) : null;

  useEffect(() => {
    if (email && !email.isRead) {
      markAsRead(email.id);
      if (imap && password) {
        imap.setReadFlag(email.folder, email.uid, true, password).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!email) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>
          Email not found
        </Text>
      </View>
    );
  }

  function handleReply() {
    router.push({
      pathname: '/email/compose',
      params: {
        replyTo: email!.from.address,
        subject: `Re: ${email!.subject}`,
        replyToId: email!.id,
      },
    });
  }

  function handleForward() {
    router.push({
      pathname: '/email/compose',
      params: {
        subject: `Fwd: ${email!.subject}`,
        body: `\n\n--- Forwarded Message ---\nFrom: ${email!.from.address}\nSubject: ${email!.subject}\n\n${email!.bodyText ?? ''}`,
        forwardId: email!.id,
      },
    });
  }

  function handleDelete() {
    Alert.alert('Delete Email', 'Move this email to Trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeEmail(email!.id);
          if (imap && password) {
            imap.deleteEmail(email!.folder, email!.uid, password).catch(() => {});
          }
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: email.subject.length > 30 ? email.subject.slice(0, 30) + '…' : email.subject,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => markAsFlagged(email.id, !email.isFlagged)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 20, color: email.isFlagged ? colors.warning : colors.textSecondary }}>
                {email.isFlagged ? '⚑' : '⚐'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmailDetail email={email} />

        {/* Action toolbar */}
        <View style={[styles.toolbar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <ToolbarButton label="Reply" icon="↩️" onPress={handleReply} colors={colors} />
          <ToolbarButton label="Forward" icon="↪️" onPress={handleForward} colors={colors} />
          <ToolbarButton label="Delete" icon="🗑️" onPress={handleDelete} colors={colors} danger />
        </View>
      </View>
    </>
  );
}

function ToolbarButton({
  label,
  icon,
  onPress,
  colors,
  danger,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  colors: (typeof Colors)['light'];
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.toolbarBtn} onPress={onPress}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[styles.toolbarLabel, { color: danger ? colors.danger : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 15 },
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  toolbarLabel: { fontSize: 12, marginTop: 2 },
});
