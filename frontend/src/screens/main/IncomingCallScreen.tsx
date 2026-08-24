import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bot, Phone, PhoneOff } from 'lucide-react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  ASSISTANT_NAME,
  ASSISTANT_VERIFIED_LABEL,
  assistantContextLabel,
} from '@/config/assistant';
import { handleAcceptCall, handleDeclineCall } from '@/hooks/useIncomingCall';
import type { IncomingCallParams } from '@/navigation/paramTypes';
import { iosCallInteractionKey } from '@/services/notifications/iosCallInteraction';
import { claimAction } from '@/services/notifications/processedActions';
import { tokens } from '@/theme/tokens';
import { callFontFamily } from '@/theme/callTheme';

const AVATAR_SIZE = 96;
const CTA_SIZE = 72;

function VerifiedPulseDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
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

/**
 * Fallback for a standard iOS call-notification body tap. Merely opening this screen never starts
 * Vapi; microphone use begins only after the user explicitly presses Answer.
 */
export default function IncomingCallScreen() {
  const route = useRoute<RouteProp<{ IncomingCall: IncomingCallParams }, 'IncomingCall'>>();
  const navigation = useNavigation();
  const payload = route.params;
  const [handling, setHandling] = useState(false);

  const actionKey = (action: 'accept' | 'decline') =>
    iosCallInteractionKey(payload.notificationId ?? payload.callId, action);

  const onAnswer = async () => {
    if (handling) return;
    setHandling(true);
    const claimed = await claimAction(actionKey('accept')).catch(() => true);
    if (!claimed) {
      setHandling(false);
      return;
    }
    navigation.goBack();
    await handleAcceptCall(payload).catch(() => {});
  };

  const onDecline = async () => {
    if (handling) return;
    setHandling(true);
    const claimed = await claimAction(actionKey('decline')).catch(() => true);
    if (!claimed) {
      setHandling(false);
      return;
    }
    navigation.goBack();
    await handleDeclineCall(payload, { skipNavigation: true }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.call.background} />
      <View style={styles.frame}>
        <View style={styles.topSection}>
          <View style={styles.incomingPill}>
            <Text style={styles.incomingPillText}>incoming call</Text>
          </View>
          <View style={styles.avatar}>
            <Bot size={46} color={tokens.call.brand} strokeWidth={1.8} />
            <View style={styles.presenceDot} />
          </View>
          <Text style={styles.agentName}>{ASSISTANT_NAME}</Text>
          <Text style={styles.subtitle}>{assistantContextLabel(payload.type)}</Text>
          <View style={styles.verifiedPill}>
            <VerifiedPulseDot />
            <Text style={styles.verifiedText}>{ASSISTANT_VERIFIED_LABEL}</Text>
          </View>
        </View>

        <View style={styles.flexSpace} />

        <View style={styles.actionsRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Decline call"
              disabled={handling}
              style={[styles.ctaButton, styles.declineButton]}
              onPress={onDecline}
              activeOpacity={0.85}
            >
              <PhoneOff size={28} color={tokens.call.decline} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Answer call"
              disabled={handling}
              style={[styles.ctaButton, styles.acceptButton]}
              onPress={onAnswer}
              activeOpacity={0.85}
            >
              <Phone size={28} color={tokens.call.accept} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Answer</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.call.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 375,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 76 : 70,
    paddingBottom: 48,
    alignItems: 'center',
  },
  topSection: { alignItems: 'center' },
  incomingPill: {
    backgroundColor: tokens.call.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  incomingPillText: {
    fontSize: 11,
    color: tokens.call.textMuted,
    fontFamily: callFontFamily,
    fontWeight: '400',
    textTransform: 'lowercase',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginTop: 26,
    backgroundColor: tokens.call.surfaceAvatar,
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
    backgroundColor: tokens.call.presence,
    borderWidth: 2,
    borderColor: tokens.call.background,
  },
  agentName: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 22,
    color: tokens.call.textPrimary,
    fontFamily: callFontFamily,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 14,
    fontSize: 13,
    color: tokens.call.textFaint,
    fontFamily: callFontFamily,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.call.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verifiedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
    backgroundColor: tokens.call.presence,
  },
  verifiedText: {
    fontSize: 11,
    color: tokens.call.textSecondary,
    fontFamily: callFontFamily,
    fontWeight: '500',
  },
  flexSpace: { flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    gap: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItem: { alignItems: 'center' },
  ctaButton: {
    width: CTA_SIZE,
    height: CTA_SIZE,
    borderRadius: CTA_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: { backgroundColor: tokens.call.declineSurface },
  acceptButton: { backgroundColor: tokens.call.acceptSurface },
  actionLabel: {
    marginTop: 10,
    fontSize: 13,
    color: tokens.call.textSecondary,
    fontFamily: callFontFamily,
  },
});
