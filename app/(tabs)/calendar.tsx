import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useCalendarStore } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';
import { CalDavService } from '../../services/caldav';
import type { CalendarEvent } from '../../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account } = useAuthStore();
  const {
    events,
    selectedDate,
    isLoading,
    setCalendars,
    setEvents,
    addEvent,
    setSelectedDate,
    setLoading,
    setError,
  } = useCalendarStore();

  const caldav = useMemo(() => account ? new CalDavService(account) : null, [account]);

  const [viewDate, setViewDate] = useState(new Date());
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const loadData = useCallback(async () => {
    if (!caldav) return;
    setLoading(true);
    try {
      const cals = await caldav.getCalendars('');
      setCalendars(cals);
      const evts = await caldav.getEvents(cals[0]?.url ?? '', '', '', '');
      setEvents(evts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [caldav, setCalendars, setEvents, setLoading, setError]);

  useEffect(() => { loadData(); }, [loadData]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  const dayHasEvent = (day: number): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.some((e) => e.start.startsWith(dateStr));
  };

  const dayKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const selectedEvents = events.filter((e) => e.start.startsWith(selectedDate));

  async function handleCreateEvent() {
    if (!caldav || !newTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title.');
      return;
    }
    try {
      const now = new Date();
      const event = await caldav.createEvent('', {
        calendarId: 'default',
        title: newTitle,
        start: newStart || now.toISOString(),
        end: newEnd || new Date(now.getTime() + 3600000).toISOString(),
        allDay: false,
        color: colors.primary,
      }, '');
      addEvent(event);
      setShowNewEvent(false);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
    } catch {
      Alert.alert('Error', 'Failed to create event.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Month navigation */}
      <View style={[styles.monthNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setViewDate(new Date(year, month - 1, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.navArrow, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={() => setViewDate(new Date(year, month + 1, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.navArrow, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={styles.daysHeader}>
        {DAYS.map((d) => (
          <Text key={d} style={[styles.dayLabel, { color: colors.textSecondary }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.cell} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const key = dayKey(day);
          const isToday = key === todayStr;
          const isSelected = key === selectedDate;
          const hasEvent = dayHasEvent(day);
          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.cell,
                isSelected && { backgroundColor: colors.primary },
                isToday && !isSelected && { borderColor: colors.primary, borderWidth: 1 },
              ]}
              onPress={() => setSelectedDate(key)}
            >
              <Text
                style={[
                  styles.dayNum,
                  { color: isSelected ? '#fff' : colors.text },
                ]}
              >
                {day}
              </Text>
              {hasEvent ? (
                <View
                  style={[
                    styles.eventDot,
                    { backgroundColor: isSelected ? '#fff' : colors.primary },
                  ]}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day events */}
      <View style={[styles.eventsSection, { borderTopColor: colors.border }]}>
        <View style={styles.eventsSectionHeader}>
          <Text style={[styles.eventsSectionTitle, { color: colors.text }]}>
            {selectedDate === todayStr ? 'Today' : selectedDate}
          </Text>
          <TouchableOpacity
            style={[styles.addEventBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewEvent(true)}
          >
            <Text style={styles.addEventBtnText}>+ Event</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : selectedEvents.length === 0 ? (
          <Text style={[styles.noEvents, { color: colors.textSecondary }]}>
            No events for this day
          </Text>
        ) : (
          <ScrollView>
            {selectedEvents.map((evt) => (
              <EventItem key={evt.id} event={evt} colors={colors} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* New Event Modal */}
      <Modal
        visible={showNewEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewEvent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Event</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Start (ISO 8601)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newStart}
              onChangeText={setNewStart}
              placeholder={new Date().toISOString()}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>End (ISO 8601)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newEnd}
              onChangeText={setNewEnd}
              placeholder={new Date(Date.now() + 3600000).toISOString()}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowNewEvent(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateEvent}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EventItem({
  event,
  colors,
}: {
  event: CalendarEvent;
  colors: (typeof Colors)['light'];
}) {
  const start = new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.eventItem, { borderLeftColor: event.color ?? colors.primary }]}>
      <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
      <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
        {event.allDay ? 'All day' : `${start} – ${end}`}
      </Text>
      {event.location ? (
        <Text style={[styles.eventLocation, { color: colors.textSecondary }]}>
          📍 {event.location}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navArrow: { fontSize: 28, fontWeight: '300' },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 2,
  },
  dayNum: { fontSize: 14 },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  eventsSection: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  eventsSectionTitle: { fontSize: 16, fontWeight: '700' },
  addEventBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addEventBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  noEvents: { textAlign: 'center', marginTop: 20, fontSize: 14 },
  eventItem: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  eventTitle: { fontSize: 15, fontWeight: '600' },
  eventTime: { fontSize: 13, marginTop: 2 },
  eventLocation: { fontSize: 13, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
