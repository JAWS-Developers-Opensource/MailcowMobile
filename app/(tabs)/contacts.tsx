import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useContactsStore } from '../../store/contactsStore';
import { useAuthStore } from '../../store/authStore';
import { CardDavService } from '../../services/carddav';
import { ContactListItem } from '../../components/contacts/ContactListItem';
import type { Contact } from '../../types';

export default function ContactsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account, password } = useAuthStore();
  const {
    contacts,
    searchQuery,
    isLoading,
    setAddressBooks,
    setContacts,
    addContact,
    setSearchQuery,
    setLoading,
    setError,
  } = useContactsStore();

  const carddav = useMemo(() => account ? new CardDavService(account) : null, [account]);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrg, setNewOrg] = useState('');

  const loadData = useCallback(async () => {
    if (!carddav || !password) return;
    setLoading(true);
    try {
      const books = await carddav.getAddressBooks(password);
      setAddressBooks(books);
      const contactData = await carddav.getContacts(books[0]?.url ?? '', password);
      setContacts(contactData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [carddav, password, setAddressBooks, setContacts, setLoading, setError]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.emails.some((e) => e.address.toLowerCase().includes(q)) ||
      (c.organization ?? '').toLowerCase().includes(q)
    );
  });

  // Sort alphabetically
  const sorted = [...filtered].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  async function handleCreateContact() {
    if (!carddav || !password || (!newFirstName.trim() && !newLastName.trim())) {
      Alert.alert('Error', 'Please enter at least a first or last name.');
      return;
    }
    try {
      const fullName = [newFirstName, newLastName].filter(Boolean).join(' ');
      const contact = await carddav.createContact('', {
        addressBookId: 'ab-default',
        fullName,
        firstName: newFirstName || undefined,
        lastName: newLastName || undefined,
        emails: newEmail ? [{ type: 'work', address: newEmail }] : [],
        phones: newPhone ? [{ type: 'work', number: newPhone }] : [],
        organization: newOrg || undefined,
      }, password);
      addContact(contact);
      setShowNewContact(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewOrg('');
    } catch {
      Alert.alert('Error', 'Failed to create contact.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts…"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewContact(true)}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Contact list */}
      {isLoading && contacts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {searchQuery ? 'No contacts found' : 'No contacts yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactListItem
              contact={item}
              onPress={(c) => setSelectedContact(c)}
            />
          )}
        />
      )}

      {/* Contact Detail Modal */}
      {selectedContact ? (
        <Modal
          visible={!!selectedContact}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedContact(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

              <ScrollView>
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {selectedContact.fullName}
                </Text>
                {selectedContact.organization ? (
                  <Text style={[styles.contactOrg, { color: colors.textSecondary }]}>
                    {selectedContact.organization}
                  </Text>
                ) : null}

                {selectedContact.emails.length > 0 ? (
                  <Section title="Email" colors={colors}>
                    {selectedContact.emails.map((e, i) => (
                      <Text key={i} style={[styles.contactDetail, { color: colors.text }]}>
                        {e.address}
                        <Text style={{ color: colors.textSecondary }}> ({e.type})</Text>
                      </Text>
                    ))}
                  </Section>
                ) : null}

                {selectedContact.phones.length > 0 ? (
                  <Section title="Phone" colors={colors}>
                    {selectedContact.phones.map((p, i) => (
                      <Text key={i} style={[styles.contactDetail, { color: colors.text }]}>
                        {p.number}
                        <Text style={{ color: colors.textSecondary }}> ({p.type})</Text>
                      </Text>
                    ))}
                  </Section>
                ) : null}

                {selectedContact.notes ? (
                  <Section title="Notes" colors={colors}>
                    <Text style={[styles.contactDetail, { color: colors.text }]}>
                      {selectedContact.notes}
                    </Text>
                  </Section>
                ) : null}
              </ScrollView>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.surface }]}
                onPress={() => setSelectedContact(null)}
              >
                <Text style={[styles.closeBtnText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* New Contact Modal */}
      <Modal
        visible={showNewContact}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewContact(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Contact</Text>

            <ScrollView>
              {[
                { label: 'First Name', value: newFirstName, setter: setNewFirstName, placeholder: 'Alice' },
                { label: 'Last Name', value: newLastName, setter: setNewLastName, placeholder: 'Example' },
                { label: 'Email', value: newEmail, setter: setNewEmail, placeholder: 'alice@example.com' },
                { label: 'Phone', value: newPhone, setter: setNewPhone, placeholder: '+1 555 0100' },
                { label: 'Organization', value: newOrg, setter: setNewOrg, placeholder: 'ACME Corp' },
              ].map(({ label, value, setter, placeholder }) => (
                <View key={label}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize={label === 'Email' ? 'none' : 'words'}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowNewContact(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateContact}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: (typeof Colors)['light'];
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.container}>
      <Text style={[sectionStyles.title, { color: colors.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15 },
  clearIcon: { fontSize: 16, paddingLeft: 6 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  contactName: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  contactOrg: { fontSize: 15, marginBottom: 16 },
  contactDetail: { fontSize: 15, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  closeBtn: { marginTop: 16, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '600' },
});
