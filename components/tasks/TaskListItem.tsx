import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import type { Task } from '../../types';
import { Colors } from '../../constants/Colors';

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onPress: (task: Task) => void;
}

const priorityColors = {
  none: 'transparent',
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
};

export function TaskListItem({ task, onToggle, onPress }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const isCompleted = task.status === 'completed';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={[
          styles.checkbox,
          {
            borderColor: isCompleted ? colors.success : colors.border,
            backgroundColor: isCompleted ? colors.success : 'transparent',
          },
        ]}
        onPress={() => onToggle(task)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isCompleted ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : null}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              textDecorationLine: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.5 : 1,
            },
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {task.dueDate ? (
          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
            Due: {task.dueDate}
          </Text>
        ) : null}
      </View>

      {task.priority !== 'none' ? (
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: priorityColors[task.priority] },
          ]}
        />
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  title: { fontSize: 15 },
  dueDate: { fontSize: 12, marginTop: 2 },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
});
