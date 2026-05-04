import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import type { Contact } from '../../types';
import { Colors } from '../../constants/Colors';

interface Props {
  contact: Contact;
  onPress: (contact: Contact) => void;
}

function avatarLabel(contact: Contact): string {
  if (contact.firstName && contact.lastName) {
    return (contact.firstName[0] + contact.lastName[0]).toUpperCase();
  }
  return contact.fullName.slice(0, 2).toUpperCase();
}

export function ContactListItem({ contact, onPress }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const primaryEmail = contact.emails[0]?.address ?? '';
  const primaryPhone = contact.phones[0]?.number ?? '';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
      onPress={() => onPress(contact)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {avatarLabel(contact)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {contact.fullName}
        </Text>
        {contact.organization ? (
          <Text
            style={[styles.org, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {contact.organization}
          </Text>
        ) : null}
        {primaryEmail ? (
          <Text
            style={[styles.detail, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {primaryEmail}
          </Text>
        ) : null}
        {primaryPhone ? (
          <Text
            style={[styles.detail, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {primaryPhone}
          </Text>
        ) : null}
      </View>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  org: { fontSize: 13, marginBottom: 1 },
  detail: { fontSize: 13 },
});
