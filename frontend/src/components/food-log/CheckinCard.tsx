import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Switch,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { Text } from '../ui/text';
import { Phone, Zap, Clock, ChevronRight, X } from 'lucide-react-native';
import {
  MealSchedule,
  loadMealScheduleCached,
  saveMealSchedule,
  defaultMealSchedule,
} from '@/services/notifications/reminderService';
import { formatClockTimeFromParts } from '@/utils/timeFormatter';
import { tokens } from '@/theme/tokens';

const T = tokens.foodLog;

const TIME_SLOTS = [
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '3:00 PM', hour: 15, minute: 0 },
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '7:00 PM', hour: 19, minute: 0 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '9:00 PM', hour: 21, minute: 0 },
];

function computeEta(hour: number, minute: number): string {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diff = Math.round((target.getTime() - now.getTime()) / 60000);
  if (diff < 60) return `in ${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

export const CheckinCard: React.FC = () => {
  const [reminder, setReminder] = useState<MealSchedule>(defaultMealSchedule());
  const [showSheet, setShowSheet] = useState(false);
  const [draftHour, setDraftHour] = useState(20);
  const [draftMinute, setDraftMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMealScheduleCached().then(s => {
      setReminder(s);
      setDraftHour(s.hour);
      setDraftMinute(s.minute);
    });
  }, []);

  const timeLabel = formatClockTimeFromParts(reminder.hour, reminder.minute);
  const etaLabel = computeEta(reminder.hour, reminder.minute);

  const openSheet = () => {
    setDraftHour(reminder.hour);
    setDraftMinute(reminder.minute);
    setShowSheet(true);
  };

  const toggleEnabled = async (val: boolean) => {
    const updated: MealSchedule = { ...reminder, enabled: val };
    setReminder(updated);
    try {
      await saveMealSchedule(updated);
    } catch (e: any) {
      console.error('Toggle reminder failed:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updated: MealSchedule = { hour: draftHour, minute: draftMinute, enabled: true };
    try {
      await saveMealSchedule(updated);
      setReminder(updated);
      setShowSheet(false);
    } catch (e: any) {
      Alert.alert('Error', 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  const rows = [TIME_SLOTS.slice(0, 3), TIME_SLOTS.slice(3, 6)];

  return (
    <>
      <View style={styles.card}>
        {/* header row */}
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Phone size={20} color={T.surface} strokeWidth={2} />
            <View style={styles.sparkBadge}>
              <Zap size={9} color={T.surface} fill={T.surface} />
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>AI check-in call</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              We'll call to log everything you ate
            </Text>
          </View>

          <Switch
            value={reminder.enabled}
            onValueChange={toggleEnabled}
            trackColor={{ false: T.switchTrackOff, true: T.green }}
            thumbColor={T.surface}
            ios_backgroundColor={T.switchTrackOff}
          />
        </View>

        {/* time button */}
        <TouchableOpacity
          onPress={openSheet}
          disabled={!reminder.enabled}
          activeOpacity={0.7}
          style={[
            styles.timeBtn,
            {
              backgroundColor: reminder.enabled ? T.greenSoft : T.lineSoft,
              opacity: reminder.enabled ? 1 : 0.55,
            },
          ]}
        >
          <Clock size={18} color={T.green} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.timeMain}>Today at {timeLabel}</Text>
            <Text style={styles.timeEta}>Next call {etaLabel}</Text>
          </View>
          <View style={styles.editRow}>
            <Text style={styles.editLabel}>Edit</Text>
            <ChevronRight size={14} color={T.green} strokeWidth={2.2} />
          </View>
        </TouchableOpacity>
      </View>

      {/* time picker sheet */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowSheet(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetSuper}>AI CHECK-IN</Text>
                <Text style={styles.sheetTitle}>When should we call?</Text>
                <Text style={styles.sheetSub}>
                  Pick a daily time. The call takes about 2 minutes.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSheet(false)}
                style={styles.closeBtn}
              >
                <X size={16} color={T.inkSoft} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {rows.map((row, ri) => (
                <View key={ri} style={styles.gridRow}>
                  {row.map(slot => {
                    const active =
                      draftHour === slot.hour && draftMinute === slot.minute;
                    return (
                      <TouchableOpacity
                        key={slot.label}
                        onPress={() => {
                          setDraftHour(slot.hour);
                          setDraftMinute(slot.minute);
                        }}
                        activeOpacity={0.7}
                        style={[styles.slot, active && styles.slotActive]}
                      >
                        <Text
                          style={[styles.slotText, active && styles.slotTextActive]}
                        >
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : 'Save check-in time'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.line,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: T.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    flexShrink: 0,
  },
  sparkBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: T.surface,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
  },
  subtitle: {
    fontSize: 12.5,
    color: T.inkSoft,
    marginTop: 2,
    fontWeight: '500',
  },
  timeBtn: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  timeMain: {
    fontSize: 15,
    fontWeight: '800',
    color: T.greenDeep,
    letterSpacing: -0.2,
  },
  timeEta: {
    fontSize: 11.5,
    color: T.inkSoft,
    fontWeight: '600',
    marginTop: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  editLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: T.green,
  },
  // sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,24,16,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sheetSuper: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: T.ink,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12.5,
    color: T.inkSoft,
    marginTop: 4,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: T.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    marginTop: 18,
    gap: 9,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 9,
  },
  slot: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: T.surface,
  },
  slotActive: {
    borderWidth: 1.5,
    borderColor: T.green,
    backgroundColor: T.greenSoft,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.inkSoft,
  },
  slotTextActive: {
    color: T.greenDeep,
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: T.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: T.surface,
  },
});
