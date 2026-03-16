import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Bot, Phone, PhoneOff } from 'lucide-react-native';
import { type IncomingCallPayload } from '../hooks/useIncomingCall';
import { startRingtone } from '../hooks/useRingtone';

const VIBRATION_PATTERN = [0, 600, 400, 600, 400, 600, 2000];
const AUTO_DISMISS_MS = 30_000;

type Props = {
  payload: IncomingCallPayload | null;
  onAccept: (payload: IncomingCallPayload) => void;
  onDecline: (payload: IncomingCallPayload) => void;
  /** Tap on the banner body — expands to the full-screen call UI. */
  onExpand: (payload: IncomingCallPayload) => void;
};

function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.45, duration: 680, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 680, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulse }] }]} />
  );
}

export default function IncomingCallBanner({ payload, onAccept, onDecline, onExpand }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // True while we're handing off to the full-screen IncomingCallScreen.
  // In that case we skip stopping audio — the full-screen UI owns it from here.
  const isExpandingRef = useRef(false);

  const isVisible = payload !== null;

  useEffect(() => {
    if (isExpandingRef.current) {
      isExpandingRef.current = false;
    }

    if (isVisible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 9,
        useNativeDriver: true,
      }).start();

      startRingtone();

      if (Platform.OS === 'android') {
        Vibration.vibrate(VIBRATION_PATTERN, true);
      } else {
        vibrationInterval.current = setInterval(() => Vibration.vibrate(500), 2000);
      }

      dismissTimer.current = setTimeout(() => {
        if (payload) {
          onDecline(payload);
        }
      }, AUTO_DISMISS_MS);
    } else {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }).start();

      // Clean up timers. Audio is stopped by handleAccept/handleDecline.
      // Only kill vibration here if we were NOT handed off to the full-screen UI.
      if (!isExpandingRef.current) {
        Vibration.cancel();
        if (vibrationInterval.current) {
          clearInterval(vibrationInterval.current);
          vibrationInterval.current = null;
        }
      }

      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  if (!isVisible || !payload) {
    return null;
  }

  const handleExpand = () => {
    isExpandingRef.current = true;
    onExpand(payload);
  };

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      // Prevent touches from falling through
      pointerEvents="box-none"
    >
      {/* Avatar — tappable to expand */}
      <TouchableOpacity onPress={handleExpand} activeOpacity={0.85}>
        <View style={styles.avatar}>
          <Bot size={22} color="#7F77DD" strokeWidth={1.8} />
          <View style={styles.presenceDot} />
        </View>
      </TouchableOpacity>

      {/* Text — tappable to expand */}
      <TouchableOpacity style={styles.content} onPress={handleExpand} activeOpacity={0.85}>
        <View style={styles.titleRow}>
          <Text style={styles.agentName} numberOfLines={1}>
            AI Agent
          </Text>
          <View style={styles.verifiedPill}>
            <PulsingDot />
            <Text style={styles.verifiedText}>AI • Verified</Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          Incoming call
        </Text>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={() => onDecline(payload)}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <PhoneOff size={15} color="#E24B4A" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.acceptBtn]}
          onPress={() => onAccept(payload)}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Phone size={15} color="#1D9E75" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    // Leave room for the OS status bar
    top: Platform.OS === 'ios' ? 52 : 18,
    left: 16,
    right: 16,
    height: 68,
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    zIndex: 9999,
    elevation: 24,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  presenceDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#1D9E75',
    borderWidth: 2,
    borderColor: '#111111',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  agentName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F0F0F0',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1D9E75',
  },
  verifiedText: {
    fontSize: 10,
    color: '#888888',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 12,
    color: '#555555',
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '400',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#2A0A0A',
  },
  acceptBtn: {
    backgroundColor: '#0A2A1A',
  },
});
