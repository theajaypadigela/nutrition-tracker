import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  buildReminderHealthReport,
  HealthItem,
  HealthStatus,
  ReminderHealthReport,
} from '../../services/notifications/reminderHealth';

const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: '#1D9E75',
  warn: '#C9821B',
  error: '#E24B4A',
  na: '#9AA0A6',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  warn: 'Needs attention',
  error: 'Action required',
  na: 'N/A',
};

export default function ReminderHealthScreen() {
  const [report, setReport] = useState<ReminderHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await buildReminderHealthReport());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runFix = async (item: HealthItem) => {
    if (!item.fix) return;
    setBusyId(item.id);
    try {
      await item.fix.run();
    } finally {
      setBusyId(null);
      // Re-read after returning from settings so the surface reflects the new state.
      load();
    }
  };

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1D9E75" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Reminder health</Text>
      <Text style={styles.subtitle}>
        These settings determine whether your meal and habit calls actually ring on time.
      </Text>

      {report?.degraded && (
        <View style={styles.degradedBanner}>
          <Text style={styles.degradedText}>
            Some reminders may be late or silent. Fix the items marked below.
          </Text>
        </View>
      )}

      {report?.items.map(item => (
        <View key={item.id} style={styles.row}>
          <View style={styles.rowHeader}>
            <View
              style={[styles.dot, { backgroundColor: STATUS_COLOR[item.status] }]}
            />
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={[styles.statusTag, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
          <Text style={styles.detail}>{item.detail}</Text>
          {item.fix && (
            <TouchableOpacity
              style={styles.fixButton}
              onPress={() => runFix(item)}
              disabled={busyId === item.id}
            >
              <Text style={styles.fixButtonText}>
                {busyId === item.id ? 'Opening…' : item.fix.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  degradedBanner: {
    backgroundColor: '#FDF2E2',
    borderColor: '#F0C98A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  degradedText: { color: '#8A5A12', fontSize: 13, lineHeight: 18 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  statusTag: { fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 13, color: '#555', lineHeight: 18 },
  fixButton: {
    marginTop: 12,
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fixButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
