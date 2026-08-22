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
} from '../../services/notifications/reminderService';
import { formatClockTimeFromParts } from '../../utils/timeFormatter';

const GREEN = '#0f7a3d';
const GREEN_SOFT = '#e6f4ec';
const GREEN_DEEP = '#0a5226';
const GREEN_MID = '#1b9750';
const PURPLE = '#7c3aed';
const LINE = '#e7ede9';
const LINE_SOFT = '#f1f5f2';
const INK = '#16241c';
const INK_SOFT = '#52635a';
const INK_MUTED = '#8a988f';

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
            <Phone size={20} color="#fff" strokeWidth={2} />
            <View style={styles.sparkBadge}>
              <Zap size={9} color="#fff" fill="#fff" />
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
            trackColor={{ false: '#cdd6d0', true: GREEN }}
            thumbColor="#fff"
            ios_backgroundColor="#cdd6d0"
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
              backgroundColor: reminder.enabled ? GREEN_SOFT : LINE_SOFT,
              opacity: reminder.enabled ? 1 : 0.55,
            },
          ]}
        >
          <Clock size={18} color={GREEN} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.timeMain}>Today at {timeLabel}</Text>
            <Text style={styles.timeEta}>Next call {etaLabel}</Text>
          </View>
          <View style={styles.editRow}>
            <Text style={styles.editLabel}>Edit</Text>
            <ChevronRight size={14} color={GREEN} strokeWidth={2.2} />
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
                <X size={16} color={INK_SOFT} strokeWidth={2.2} />
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
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: '#102818',
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
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
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
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  subtitle: {
    fontSize: 12.5,
    color: INK_SOFT,
    marginTop: 2,
    fontWeight: '500',
  },
  timeBtn: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  timeMain: {
    fontSize: 15,
    fontWeight: '800',
    color: GREEN_DEEP,
    letterSpacing: -0.2,
  },
  timeEta: {
    fontSize: 11.5,
    color: INK_SOFT,
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
    color: GREEN,
  },
  // sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,24,16,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
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
    backgroundColor: LINE,
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
    color: INK_MUTED,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: INK,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12.5,
    color: INK_SOFT,
    marginTop: 4,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: LINE_SOFT,
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
    borderColor: LINE,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  slotActive: {
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: GREEN_SOFT,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK_SOFT,
  },
  slotTextActive: {
    color: GREEN_DEEP,
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
