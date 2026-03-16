import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Bot, Phone, PhoneOff } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import {
  handleAcceptCall,
  handleDeclineCall,
  setActiveCallNotificationId,
  type IncomingCallPayload,
} from '../hooks/useIncomingCall';
import { startRingtone } from '../hooks/useRingtone';

const VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000, 2000];
const AVATAR_SIZE = 96;
const CTA_SIZE = 72;

type IncomingCallRouteParams = {
  autoAccept?: boolean;
  notificationId?: string;
  mealSlotId?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
};

function VerifiedPulseDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.22,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.verifiedDot, { transform: [{ scale: pulse }] }]} />
  );
}

export default function IncomingCallScreen() {
  const route = useRoute<any>();
  const params = (route.params ?? {}) as IncomingCallRouteParams;

  const vibrationInterval = useRef<NodeJS.Timeout | null>(null);

  const callPayload = useMemo<IncomingCallPayload>(() => {
    const type = route.name === 'IncomingHabitCall' ? 'habit' : 'meal';

    return {
      type,
      notificationId: params.notificationId,
      mealSlotId: params.mealSlotId,
      habitId: params.habitId,
      habitName: params.habitName,
      habitTime: params.habitTime,
    };
  }, [params, route.name]);

  useEffect(() => {
    if (params.notificationId) {
      setActiveCallNotificationId(params.notificationId);
    }

    startRingtone();

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
  }, [params.notificationId]);

  useEffect(() => {
    if (params.autoAccept) {
      handleAcceptCall(callPayload).catch(() => {});
    }
  }, [callPayload, params.autoAccept]);

  const isHabit = callPayload.type === 'habit';
  const subtitle = isHabit ? 'Habit assistant' : 'Meal assistant';

  const onAccept = () => {
    handleAcceptCall(callPayload).catch(() => {});
  };

  const onDecline = () => {
    handleDeclineCall(callPayload).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.frame}>
        <View style={styles.topSection}>
          <View style={styles.incomingPill}>
            <Text style={styles.incomingPillText}>incoming call</Text>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Bot size={46} color="#7F77DD" strokeWidth={1.8} />
              <View style={styles.presenceDot} />
            </View>
          </View>

          <Text style={styles.agentName}>AI Agent</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.verifiedPill}>
            <VerifiedPulseDot />
            <Text style={styles.verifiedText}>AI • Verified</Text>
          </View>
        </View>

        <View style={styles.flexSpace} />

        <View style={styles.actionsRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.ctaButton, styles.declineButton]}
              onPress={onDecline}
              activeOpacity={0.85}
            >
              <PhoneOff size={28} color="#E24B4A" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.ctaButton, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.85}
            >
              <Phone size={28} color="#1D9E75" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 375,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 48,
    alignItems: 'center',
  },
  topSection: {
    alignItems: 'center',
  },
  incomingPill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  incomingPillText: {
    fontSize: 11,
    color: '#8B8B92',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '400',
    textTransform: 'lowercase',
  },
  avatarContainer: {
    marginTop: 26,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1D9E75',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  agentName: {
    marginTop: 22,
    fontSize: 22,
    color: '#F3F3F3',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#555555',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '400',
    marginBottom: 14,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verifiedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1D9E75',
    marginRight: 8,
  },
  verifiedText: {
    fontSize: 11,
    color: '#C9C9C9',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '500',
  },
  flexSpace: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItem: {
    alignItems: 'center',
  },
  ctaButton: {
    width: CTA_SIZE,
    height: CTA_SIZE,
    borderRadius: CTA_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#2A0A0A',
  },
  acceptButton: {
    backgroundColor: '#0A2A1A',
  },
  actionLabel: {
    marginTop: 10,
    fontSize: 13,
    color: '#B6B6B6',
    fontFamily: Platform.select({ ios: 'SF Pro Text', android: 'sans-serif' }),
    fontWeight: '400',
  },
});
