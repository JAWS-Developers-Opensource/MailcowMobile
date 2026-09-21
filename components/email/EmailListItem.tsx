import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import type { Email } from '../../types';
import { Colors } from '../../constants/Colors';

interface Props {
  email: Email;
  onPress: (email: Email) => void;
}

export function EmailListItem({ email, onPress }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const fromLabel = email.from.name || email.from.address;
  const date = new Date(email.date);
  const timeLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={() => onPress(email)}
      activeOpacity={0.7}
    >
      {/* Unread indicator */}
      <View
        style={[
          styles.unreadDot,
          { backgroundColor: email.isRead ? 'transparent' : colors.primary },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.from,
              { color: colors.text, fontWeight: email.isRead ? '400' : '700' },
            ]}
            numberOfLines={1}
          >
            {fromLabel}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {timeLabel}
          </Text>
        </View>

        <Text
          style={[
            styles.subject,
            { color: colors.text, fontWeight: email.isRead ? '400' : '600' },
          ]}
          numberOfLines={1}
        >
          {email.subject}
        </Text>

        {email.bodyText ? (
          <Text
            style={[styles.preview, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {email.bodyText}
          </Text>
        ) : null}
      </View>

      {email.isFlagged ? (
        <Text style={[styles.flag, { color: colors.warning }]}>⚑</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  from: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontSize: 12,
    flexShrink: 0,
  },
  subject: {
    fontSize: 14,
    marginBottom: 2,
  },
  preview: {
    fontSize: 13,
  },
  flag: {
    fontSize: 16,
    marginLeft: 8,
  },
});
