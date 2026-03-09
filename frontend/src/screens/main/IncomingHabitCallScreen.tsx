import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  Vibration,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  interpolate,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SharedValue,
} from 'react-native-reanimated';
import { Phone, PhoneOff } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Design Constants ────────────────────────────────────────────────────────
const AVATAR_SIZE = 140;
const ACTION_BTN_SIZE = 76;
const VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000, 2000];

// ─── Colors (Purple theme for habits) ────────────────────────────────────────
const COLORS = {
  background: ['#0a0a0f', '#111118', '#0d0d12'] as const,
  avatarGradient: ['#8b5cf6', '#7c3aed'] as const,
  acceptButton: ['#22c55e', '#16a34a'] as const,
  declineButton: '#ef4444',
  ripple: 'rgba(139, 92, 246, 0.3)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },
};

// ─── Ripple Animation Hook ───────────────────────────────────────────────────
function useRippleStyle(ring: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 2.5]) }],
    opacity: interpolate(ring.value, [0, 0.3, 1], [0.6, 0.3, 0]),
  }));
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function IncomingHabitCallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { habitId, habitName, habitTime, autoAccept } = route.params ?? {};
  const vibrationInterval = useRef<NodeJS.Timeout | null>(null);

  // ─── Animation Values ──────────────────────────────────────────────────────
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const avatarPulse = useSharedValue(1);
  const avatarGlow = useSharedValue(0);
  const acceptButtonScale = useSharedValue(1);
  const declineButtonScale = useSharedValue(1);

  // ─── Start Animations & Vibration ──────────────────────────────────────────
  useEffect(() => {
    const RIPPLE_DURATION = 2800;
    const RIPPLE_DELAY = 900;

    ring1.value = withRepeat(
      withTiming(1, {
        duration: RIPPLE_DURATION,
        easing: Easing.out(Easing.ease),
      }),
      -1,
      false,
    );
    ring2.value = withDelay(
      RIPPLE_DELAY,
      withRepeat(
        withTiming(1, {
          duration: RIPPLE_DURATION,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false,
      ),
    );
    ring3.value = withDelay(
      RIPPLE_DELAY * 2,
      withRepeat(
        withTiming(1, {
          duration: RIPPLE_DURATION,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false,
      ),
    );

    avatarPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    avatarGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    if (Platform.OS === 'android') {
      Vibration.vibrate(VIBRATION_PATTERN, true);
    } else {
      vibrationInterval.current = setInterval(() => {
        Vibration.vibrate(500);
      }, 2000);
    }

    return () => {
      Vibration.cancel();
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-accept Handler ───────────────────────────────────────────────────
  useEffect(() => {
    if (autoAccept) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept]);

  // ─── Action Handlers ───────────────────────────────────────────────────────
  const stopRinging = useCallback(() => {
    Vibration.cancel();
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
    }
    notifee.cancelNotification(`habit-${habitId}`).catch(() => {});
    notifee.cancelNotification(`habit-reschedule-${habitId}`).catch(() => {});
  }, [habitId]);

  const handleAccept = useCallback(() => {
    acceptButtonScale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 400 }),
    );

    stopRinging();
    navigation.replace('VoiceHabit', {
      habitId,
      habitName,
      habitTime,
      autoStart: true,
    });
  }, [
    habitId,
    habitName,
    habitTime,
    navigation,
    stopRinging,
    acceptButtonScale,
  ]);

  const handleDecline = useCallback(() => {
    declineButtonScale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 400 }),
    );

    stopRinging();
    navigation.goBack();
  }, [navigation, stopRinging, declineButtonScale]);

  // ─── Animated Styles ───────────────────────────────────────────────────────
  const ripple1Style = useRippleStyle(ring1);
  const ripple2Style = useRippleStyle(ring2);
  const ripple3Style = useRippleStyle(ring3);

  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarPulse.value }],
  }));

  const avatarGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(avatarGlow.value, [0, 1], [0.3, 0.7]),
  }));

  const acceptBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: acceptButtonScale.value }],
  }));

  const declineBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: declineButtonScale.value }],
  }));

  // Format display text
  const displaySubtitle =
    habitName && habitTime
      ? `${habitName} • ${habitTime}`
      : 'Incoming voice call';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...COLORS.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ══════════════════════════════════════════════════════════════════════
          TOP SECTION - Caller Info
      ══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(100)}
        style={styles.topSection}
      >
        {/* Ripple Rings */}
        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.rippleRing, ripple1Style]} />
          <Animated.View style={[styles.rippleRing, ripple2Style]} />
          <Animated.View style={[styles.rippleRing, ripple3Style]} />

          {/* Avatar with Glow */}
          <Animated.View
            style={[styles.avatarWrapper, avatarAnimStyle, avatarGlowStyle]}
          >
            <LinearGradient
              colors={[...COLORS.avatarGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarIcon}>💪</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Caller Name */}
        <Animated.Text
          entering={FadeIn.duration(500).delay(300)}
          style={styles.callerName}
        >
          AI Habit Assistant
        </Animated.Text>

        {/* Call Type Label */}
        <Animated.Text
          entering={FadeIn.duration(500).delay(400)}
          style={styles.callTypeLabel}
        >
          {displaySubtitle}
        </Animated.Text>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          MIDDLE SECTION - Spacer for clean layout
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.middleSection} />

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM SECTION - Action Buttons
      ══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        entering={FadeInUp.duration(600).delay(200)}
        style={styles.bottomSection}
      >
        <View style={styles.actionsRow}>
          {/* Decline Button */}
          <View style={styles.actionButtonWrapper}>
            <Animated.View style={declineBtnAnimStyle}>
              <TouchableOpacity
                onPress={handleDecline}
                activeOpacity={0.8}
                style={styles.declineButton}
              >
                <PhoneOff
                  size={32}
                  color="#ffffff"
                  strokeWidth={2}
                  style={styles.phoneIconRotated}
                />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Accept Button */}
          <View style={styles.actionButtonWrapper}>
            <Animated.View style={acceptBtnAnimStyle}>
              <TouchableOpacity
                onPress={handleAccept}
                activeOpacity={0.8}
                style={styles.acceptButtonOuter}
              >
                <LinearGradient
                  colors={[...COLORS.acceptButton]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.acceptButton}
                >
                  <Phone size={32} color="#ffffff" strokeWidth={2} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>

        {/* Security Footer */}
        <Text style={styles.securityFooter}>🔒 Secure connection</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background[0],
  },

  // ── Top Section ──
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 40 : 60,
  },

  avatarContainer: {
    width: AVATAR_SIZE * 2.5,
    height: AVATAR_SIZE * 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },

  rippleRing: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.ripple,
  },

  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    shadowColor: COLORS.avatarGradient[0],
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 16,
  },

  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarIcon: {
    fontSize: 64,
  },

  callerName: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  callTypeLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text.secondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // ── Middle Section ──
  middleSection: {
    flex: 0.3,
  },

  // ── Bottom Section ──
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    alignItems: 'center',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 80,
    marginBottom: 32,
  },

  actionButtonWrapper: {
    alignItems: 'center',
  },

  declineButton: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    backgroundColor: COLORS.declineButton,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.declineButton,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },

  phoneIconRotated: {
    transform: [{ rotate: '135deg' }],
  },

  acceptButtonOuter: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    shadowColor: COLORS.acceptButton[0],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 12,
  },

  acceptButton: {
    width: '100%',
    height: '100%',
    borderRadius: ACTION_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionLabel: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.muted,
    letterSpacing: 0.3,
  },

  securityFooter: {
    fontSize: 12,
    color: COLORS.text.muted,
    opacity: 0.6,
  },
});
