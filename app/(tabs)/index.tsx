import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useEmailStore } from '../../store/emailStore';
import { useAuthStore } from '../../store/authStore';
import { ImapService } from '../../services/imap';
import { EmailListItem } from '../../components/email/EmailListItem';
import type { Email } from '../../types';

export default function MailScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account } = useAuthStore();
  const {
    folders,
    emails,
    selectedFolder,
    isLoading,
    setFolders,
    setEmails,
    setSelectedFolder,
    setLoading,
    setError,
  } = useEmailStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showFolders, setShowFolders] = useState(false);

  const imap = useMemo(() => account ? new ImapService(account) : null, [account]);

  const loadFolders = useCallback(async () => {
    if (!imap) return;
    try {
      const data = await imap.getFolders();
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, [imap, setFolders, setError]);

  const loadEmails = useCallback(async () => {
    if (!imap) return;
    setLoading(true);
    try {
      const data = await imap.getEmails(selectedFolder);
      setEmails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [imap, selectedFolder, setEmails, setLoading, setError]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEmails();
    setRefreshing(false);
  }, [loadEmails]);

  const onEmailPress = (email: Email) => {
    router.push({ pathname: '/email/[id]', params: { id: email.id } });
  };

  const currentFolder = folders.find((f) => f.path === selectedFolder);
  const unreadCount = currentFolder?.unreadCount ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.folderButton}
          onPress={() => setShowFolders(true)}
        >
          <Text style={[styles.folderLabel, { color: colors.text }]}>
            {currentFolder?.name ?? selectedFolder}
          </Text>
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.composeButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/email/compose')}
        >
          <Text style={styles.composeIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Email list */}
      {isLoading && emails.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : emails.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            No messages in {currentFolder?.name ?? selectedFolder}
          </Text>
        </View>
      ) : (
        <FlatList
          data={emails}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EmailListItem email={item} onPress={onEmailPress} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Folder picker modal */}
      <Modal
        visible={showFolders}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFolders(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background, borderTopColor: colors.border },
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Folders</Text>
            <ScrollView>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder.path}
                  style={[
                    styles.folderItem,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor:
                        folder.path === selectedFolder
                          ? colors.primaryLight
                          : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setSelectedFolder(folder.path);
                    setShowFolders(false);
                  }}
                >
                  <Text style={[styles.folderItemText, { color: colors.text }]}>
                    {folder.name}
                  </Text>
                  {folder.unreadCount > 0 ? (
                    <Text style={[styles.folderUnread, { color: colors.primary }]}>
                      {folder.unreadCount}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalClose, { backgroundColor: colors.surface }]}
              onPress={() => setShowFolders(false)}
            >
              <Text style={[styles.modalCloseText, { color: colors.text }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  folderLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 14 },
  composeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeIcon: { fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderItemText: { fontSize: 16 },
  folderUnread: { fontSize: 14, fontWeight: '700' },
  modalClose: {
    margin: 16,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
});
