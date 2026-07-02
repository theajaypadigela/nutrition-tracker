import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, formatTime } from './authTheme';
import { ageFromDob } from '../../utils/authValidation';
import { PrimaryButton, TextLink, Banner } from './AuthControls';

const ITEM = 42;
const VISIBLE = 5;
const SCREEN_H = Dimensions.get('window').height;
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

// ─── bottom sheet shell ────────────────────────────────────
function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 290,
        easing: Easing.bezier(0.32, 0.72, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, translateY]);

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }], paddingBottom: insets.bottom + 8 },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={styles.closeBtn}
            >
              <X size={18} color={T.inkSoft} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── wheel column ──────────────────────────────────────────
function Wheel({
  items,
  index,
  onChange,
  flex = 1,
}: {
  items: (string | number)[];
  index: number;
  onChange: (i: number) => void;
  flex?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const [center, setCenter] = useState(index);
  const max = items.length - 1;

  useEffect(() => {
    const id = setTimeout(
      () => ref.current?.scrollTo({ y: index * ITEM, animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // mount-only: parent remounts (via key) when the item set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM), max);
    if (i !== center) setCenter(i);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM), max);
    onChange(i);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex, height: ITEM * VISIBLE }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={onEnd}
      contentContainerStyle={{ paddingVertical: ITEM * 2 }}
    >
      {items.map((it, i) => {
        const d = Math.abs(i - center);
        return (
          <View key={i} style={styles.wheelItem}>
            <Text
              style={{
                fontSize: d === 0 ? 22 : 18,
                fontWeight: d === 0 ? '800' : '600',
                color: d === 0 ? T.ink : d === 1 ? T.inkSoft : T.inkMuted,
                opacity: d === 0 ? 1 : d === 1 ? 0.65 : 0.35,
              }}
            >
              {it}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function WheelFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.frame}>
      <View pointerEvents="none" style={styles.centerBand} />
      <View style={styles.frameRow}>{children}</View>
      <LinearGradient
        pointerEvents="none"
        colors={[T.surface, 'rgba(255,255,255,0)']}
        style={[styles.fade, { top: 0 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', T.surface]}
        style={[styles.fade, { bottom: 0 }]}
      />
    </View>
  );
}

// ─── helpers ───────────────────────────────────────────────
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const daysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// ─── date of birth picker ──────────────────────────────────
export function DatePickerSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value?: string; // ISO yyyy-MM-dd
  onClose: () => void;
  onSelect: (iso: string) => void;
}) {
  const now = new Date();
  const minYear = 1925;
  const maxYear = now.getFullYear();
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i),
    [maxYear],
  );

  const init = value ? new Date(`${value}T00:00:00`) : null;
  const [m, setM] = useState(init && !isNaN(init.getTime()) ? init.getMonth() : 5);
  const [y, setY] = useState(
    init && !isNaN(init.getTime()) ? init.getFullYear() : 2000,
  );
  const [d, setD] = useState(init && !isNaN(init.getTime()) ? init.getDate() : 15);

  useEffect(() => {
    if (visible) {
      const v = value ? new Date(`${value}T00:00:00`) : null;
      const valid = v && !isNaN(v.getTime());
      setM(valid ? v!.getMonth() : 5);
      setY(valid ? v!.getFullYear() : 2000);
      setD(valid ? v!.getDate() : 15);
    }
  }, [visible, value]);

  const dim = daysInMonth(m, y);
  const dayIndex = Math.min(d - 1, dim - 1);
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const pickedDay = Math.min(d, dim);
  const iso = toIso(y, m, pickedDay);
  const age = ageFromDob(iso);
  const tooYoung = age !== null && age < 13;
  const future = new Date(y, m, pickedDay) > now;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Date of birth"
      subtitle="We use this to personalize your nutrition targets."
      footer={
        <View>
          {tooYoung || future ? (
            <View style={{ marginBottom: 12 }}>
              <Banner
                tone="error"
                title={future ? 'Pick a date in the past' : 'You must be 13 or older'}
              >
                {future
                  ? 'Your date of birth can’t be in the future.'
                  : 'Nourish requires users to be at least 13 years old.'}
              </Banner>
            </View>
          ) : null}
          <PrimaryButton
            disabled={tooYoung || future}
            onPress={() => onSelect(iso)}
          >
            {age !== null && !tooYoung && !future
              ? `Confirm · ${age} years old`
              : 'Confirm date'}
          </PrimaryButton>
        </View>
      }
    >
      <WheelFrame>
        <Wheel flex={1.3} items={MONTHS} index={m} onChange={setM} />
        <Wheel
          key={`d-${m}-${y}`}
          items={days}
          index={dayIndex}
          onChange={i => setD(i + 1)}
        />
        <Wheel items={years} index={y - minYear} onChange={i => setY(minYear + i)} />
      </WheelFrame>
    </BottomSheet>
  );
}

// ─── call time picker ──────────────────────────────────────
export function TimePickerSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value?: { hour: number; minute: number } | null;
  onClose: () => void;
  onSelect: (t: { hour: number; minute: number }) => void;
}) {
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const mins = useMemo(
    () => Array.from({ length: 12 }, (_, i) => pad(i * 5)),
    [],
  );
  const aps = ['AM', 'PM'];

  const from = (v?: { hour: number; minute: number } | null) => {
    const hour24 = v ? v.hour : 20;
    const minute = v ? v.minute : 0;
    const ap = hour24 >= 12 ? 1 : 0;
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    return { h: h12, mi: Math.round(minute / 5) % 12, ap };
  };

  const [h, setH] = useState(from(value).h);
  const [mi, setMi] = useState(from(value).mi);
  const [ap, setAp] = useState(from(value).ap);

  useEffect(() => {
    if (visible) {
      const s = from(value);
      setH(s.h);
      setMi(s.mi);
      setAp(s.ap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const to24 = () => {
    let hour = h % 12;
    if (ap === 1) hour += 12;
    return { hour, minute: mi * 5 };
  };
  const picked = to24();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Preferred call time"
      subtitle="Nourish’s assistant will call around this time each day."
      footer={
        <PrimaryButton onPress={() => onSelect(picked)}>
          {`Set call time · ${formatTime(picked.hour, picked.minute)}`}
        </PrimaryButton>
      }
    >
      <WheelFrame>
        <Wheel items={hours} index={h - 1} onChange={i => setH(i + 1)} />
        <Wheel items={mins} index={mi} onChange={setMi} />
        <Wheel items={aps} index={ap} onChange={setAp} />
      </WheelFrame>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,20,14,0.5)',
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    maxHeight: '92%',
    shadowColor: '#08140e',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -12 },
    elevation: 16,
  },
  handleWrap: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 999, backgroundColor: T.line },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: { fontSize: 21, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontWeight: '500', color: T.inkSoft, marginTop: 3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  frame: { marginVertical: 6, position: 'relative' },
  centerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM * 2,
    height: ITEM,
    backgroundColor: T.greenSoft,
    borderRadius: R.md,
  },
  frameRow: { flexDirection: 'row', gap: 6 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM * 2,
  },
  wheelItem: {
    height: ITEM,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
