import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useTasksStore } from '../../store/tasksStore';
import { useAuthStore } from '../../store/authStore';
import { CalDavService } from '../../services/caldav';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import type { Task, TaskPriority } from '../../types';

export default function TasksScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { account, password } = useAuthStore();
  const {
    tasks,
    isLoading,
    setTaskLists,
    setTasks,
    addTask,
    updateTask,
    setLoading,
    setError,
  } = useTasksStore();

  const caldav = useMemo(() => account ? new CalDavService(account) : null, [account]);

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('none');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const loadData = useCallback(async () => {
    if (!caldav || !password) return;
    setLoading(true);
    try {
      const lists = await caldav.getTaskLists(password);
      setTaskLists(lists);
      const taskData = await caldav.getTasks(lists[0]?.url ?? '', password);
      setTasks(taskData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [caldav, password, setTaskLists, setTasks, setLoading, setError]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (task: Task) => {
    const updated: Task = {
      ...task,
      status: task.status === 'completed' ? 'needs-action' : 'completed',
      completedAt: task.status === 'completed' ? undefined : new Date().toISOString(),
    };
    updateTask(updated);
    if (caldav && password) {
      caldav.updateTask('', updated, password).catch(() => {});
    }
  };

  const handlePress = (task: Task) => {
    // TODO: navigate to task detail / edit screen
  };

  async function handleCreateTask() {
    if (!caldav || !password || !newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title.');
      return;
    }
    try {
      const task = await caldav.createTask('', {
        calendarId: 'tasks-default',
        title: newTitle,
        dueDate: newDueDate || undefined,
        priority: newPriority,
        status: 'needs-action',
      }, password);
      addTask(task);
      setShowNewTask(false);
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('none');
    } catch {
      Alert.alert('Error', 'Failed to create task.');
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return t.status !== 'completed';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const priorities: TaskPriority[] = ['none', 'low', 'medium', 'high'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(['active', 'all', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterTab,
              filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filter === f ? colors.primary : colors.textSecondary },
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewTask(true)}
        >
          <Text style={styles.addBtnText}>+ Task</Text>
        </TouchableOpacity>
      </View>

      {isLoading && tasks.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {filter === 'active' ? 'No active tasks 🎉' : 'No tasks'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskListItem
              task={item}
              onToggle={handleToggle}
              onPress={handlePress}
            />
          )}
        />
      )}

      {/* New Task Modal */}
      <Modal
        visible={showNewTask}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewTask(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Task</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Task title"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newDueDate}
              onChangeText={setNewDueDate}
              placeholder="2025-12-31"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorities.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    {
                      backgroundColor: newPriority === p ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={{ color: newPriority === p ? '#fff' : colors.text, fontSize: 13 }}>
                    {p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowNewTask(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateTask}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 4,
  },
  filterTabText: { fontSize: 14, fontWeight: '600' },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15 },
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
  priorityRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
