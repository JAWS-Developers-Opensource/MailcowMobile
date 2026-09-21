import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import type { Email } from '../../types';
import { Colors } from '../../constants/Colors';

interface Props {
  email: Email;
}

export function EmailDetail({ email }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const formatAddress = (addr: { name?: string; address: string }) =>
    addr.name ? `${addr.name} <${addr.address}>` : addr.address;

  const date = new Date(email.date).toLocaleString();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.subject, { color: colors.text }]}>
        {email.subject}
      </Text>

      <View style={[styles.meta, { borderBottomColor: colors.border }]}>
        <MetaRow label="From" value={formatAddress(email.from)} colors={colors} />
        <MetaRow
          label="To"
          value={email.to.map(formatAddress).join(', ')}
          colors={colors}
        />
        {email.cc && email.cc.length > 0 ? (
          <MetaRow
            label="CC"
            value={email.cc.map(formatAddress).join(', ')}
            colors={colors}
          />
        ) : null}
        <MetaRow label="Date" value={date} colors={colors} />
      </View>

      {email.bodyText ? (
        <Text style={[styles.body, { color: colors.text }]}>
          {email.bodyText}
        </Text>
      ) : null}

      {email.hasAttachments && email.attachments ? (
        <View style={[styles.attachments, { borderTopColor: colors.border }]}>
          <Text style={[styles.attachmentsTitle, { color: colors.textSecondary }]}>
            Attachments
          </Text>
          {email.attachments.map((att) => (
            <Text
              key={att.filename}
              style={[styles.attachmentItem, { color: colors.primary }]}
            >
              📎 {att.filename}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function MetaRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
        {label}:
      </Text>
      <Text
        style={[styles.metaValue, { color: colors.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  subject: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  meta: {
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 13,
    width: 44,
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 13,
    flex: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  attachments: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachmentsTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  attachmentItem: {
    fontSize: 14,
    marginBottom: 4,
  },
});
