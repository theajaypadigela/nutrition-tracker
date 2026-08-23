import React, { useCallback } from 'react';
import { tokens } from '@/theme/tokens';
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
import { HealthStatus } from '@/services/notifications/reminderHealth';
import { useReminderHealth } from '@/hooks/useReminderHealth';

const STATUS_COLOR: Record<HealthStatus, string> = {
  ok: tokens.settings.statusOk,
  warn: tokens.settings.statusWarn,
  error: tokens.settings.statusError,
  na: tokens.settings.statusNa,
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  warn: 'Needs attention',
  error: 'Action required',
  na: 'N/A',
};

export default function ReminderHealthScreen() {
  const { report, loading, busyId, load, runFix } = useReminderHealth();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.settings.statusOk} />
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
  container: { flex: 1, backgroundColor: tokens.settings.bg },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: tokens.settings.ink },
  subtitle: { fontSize: 14, color: tokens.settings.inkSoft, marginBottom: 20, lineHeight: 20 },
  degradedBanner: {
    backgroundColor: tokens.settings.degradedBg,
    borderColor: tokens.settings.degradedLine,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  degradedText: { color: tokens.settings.degradedInk, fontSize: 13, lineHeight: 18 },
  row: {
    backgroundColor: tokens.settings.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: tokens.settings.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: tokens.settings.ink, flex: 1 },
  statusTag: { fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 13, color: tokens.settings.inkFaint, lineHeight: 18 },
  fixButton: {
    marginTop: 12,
    backgroundColor: tokens.settings.statusOk,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fixButtonText: { color: tokens.settings.surface, fontSize: 14, fontWeight: '600' },
});
