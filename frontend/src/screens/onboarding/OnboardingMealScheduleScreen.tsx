import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronRight, Clock, Phone, ShieldCheck, Sparkles } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  defaultMealSchedule,
  saveMealSchedule,
} from '../../services/notifications/reminderService';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { ROUTES } from '../../navigation/routeNames';
import {
  PrimaryButton,
  TextLink,
  T,
  R,
} from '../../components/auth';
import { formatLocaleTimeFromParts } from '../../utils/timeFormatter';

/**
 * One-time "daily check-in call" setup, shown right after registration. Visually the
 * Nourish CallSetup design; functionally it keeps the existing scheduler core
 * (saveMealSchedule + notifee permission). On finish/skip it lands on
 * the Done screen rather than jumping straight to MainTabs.
 */
export default function OnboardingMealScheduleScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const base = defaultMealSchedule();
  const [hour, setHour] = useState(base.hour);
  const [minute, setMinute] = useState(base.minute);
  const [hasPicked, setHasPicked] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const onTimeChange = (event: { type?: string }, selected?: Date) => {
    setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) {
      setHour(selected.getHours());
      setMinute(selected.getMinutes());
      setHasPicked(true);
    }
  };

  const goToDone = (callTime?: string) =>
    navigation.replace(ROUTES.ONBOARDING_DONE, { callTime });

  const handleSetTime = async () => {
    if (!hasPicked) {
      setShowPicker(true);
      return;
    }
    setSaving(true);
    try {
      const settings = await notifee.requestPermission();
      const denied =
        settings.authorizationStatus === AuthorizationStatus.DENIED;
      await saveMealSchedule({ hour, minute, enabled: true });
      if (denied) {
        Alert.alert(
          'Reminders are off',
          'Your call time is saved, but it can’t ring until you enable notifications. You can fix this anytime from Profile → Reminder health.',
        );
      }
      goToDone(formatLocaleTimeFromParts(hour, minute));
    } finally {
      setSaving(false);
    }
  };

  const pickerValue = (() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  })();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />
      <View style={[styles.skipRow, { paddingTop: insets.top + 14 }]}>
        <TextLink color={T.inkSoft} onPress={() => goToDone()}>
          Skip for now
        </TextLink>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* concentric call rings */}
        <View style={styles.ringsWrap}>
          {[150, 116].map((sz, i) => (
            <View
              key={sz}
              style={[
                styles.ring,
                {
                  width: sz,
                  height: sz,
                  borderRadius: sz / 2,
                  opacity: [0.14, 0.26][i],
                },
              ]}
            />
          ))}
          <LinearGradient
            colors={[T.greenMid, T.green, T.greenDeep]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.ringCore}
          >
            <Phone size={34} color={T.white} />
          </LinearGradient>
          <View style={styles.sparkleBadge}>
            <Sparkles size={15} color={T.green} fill={T.green} />
          </View>
        </View>

        <View style={styles.headerBlock}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>ONE LAST STEP</Text>
          </View>
          <Text style={styles.title}>When should we call you?</Text>
          <Text style={styles.subtitle}>
            Each day around this time, our assistant calls to ask what you ate —
            then logs it all for you automatically.
          </Text>
        </View>

        {/* time selector */}
        <Pressable
          onPress={() => setShowPicker(true)}
          style={[
            styles.timeSelect,
            {
              borderColor: hasPicked ? T.green : T.line,
              backgroundColor: hasPicked ? T.surface : T.field,
            },
          ]}
        >
          <View style={styles.timeIcon}>
            <Clock size={24} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeLabel}>PREFERRED TIME</Text>
            <Text
              style={[
                styles.timeValue,
                { color: hasPicked ? T.ink : T.inkMuted },
              ]}
            >
              {hasPicked ? formatLocaleTimeFromParts(hour, minute) : 'Tap to choose'}
            </Text>
          </View>
          <ChevronRight size={20} color={T.inkMuted} />
        </Pressable>

        <View style={styles.noteRow}>
          <ShieldCheck size={15} color={T.inkMuted} />
          <Text style={styles.noteText}>
            You can change or turn off calls anytime in Settings.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <PrimaryButton onPress={handleSetTime} loading={saving}>
          {saving ? 'Saving…' : 'Set call time'}
        </PrimaryButton>
        <View style={styles.footerLink}>
          <TextLink color={T.inkSoft} onPress={() => goToDone()}>
            I’ll do this later
          </TextLink>
        </View>
      </View>

      {showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.surface },
  skipRow: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 8,
  },
  ringsWrap: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: T.green,
  },
  ringCore: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.green,
    shadowOpacity: 0.33,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#08140e',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerBlock: { alignItems: 'center', marginTop: 14 },
  pill: {
    backgroundColor: T.greenSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    color: T.greenDeep,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: T.ink,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: T.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 300,
  },
  timeSelect: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.6,
    borderRadius: R.lg,
    padding: 18,
  },
  timeIcon: {
    width: 46,
    height: 46,
    borderRadius: R.md,
    backgroundColor: T.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: T.inkMuted,
    letterSpacing: 0.4,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 3,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  noteText: { fontSize: 12, fontWeight: '600', color: T.inkMuted },
  footer: {
    paddingHorizontal: 26,
    paddingTop: 18,
    gap: 12,
  },
  footerLink: { alignItems: 'center' },
});
