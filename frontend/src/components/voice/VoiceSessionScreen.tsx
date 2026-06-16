import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ASSISTANT_NAME } from '../../config/assistant';
import { callColors, callFontFamily } from '../../theme/callTheme';

export type CallStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'processing'
  | 'completed'
  | 'error';

type VoiceSessionScreenProps = {
  title: string;
  statusText: string;
  status: CallStatus;
  isSpeaking: boolean;
  transcript: string[];
  onPrimaryPress: () => void;
  onDonePress: () => void;
  onRetryPress: () => void;
  disablePrimary: boolean;
  processingText: string;
  doneButtonText: string;
};

type ParsedTranscriptMessage = {
  role: 'user' | 'assistant';
  isUser: boolean;
  text: string;
};

const CONTROLS_BASE_PADDING = 18;

function parseTranscriptMessage(line: string): ParsedTranscriptMessage {
  const trimmed = line.trim();

  if (/^you\s*:/i.test(trimmed)) {
    return {
      role: 'user',
      isUser: true,
      text: trimmed.replace(/^you\s*:/i, '').trim(),
    };
  }

  if (/^assistant\s*:/i.test(trimmed)) {
    return {
      role: 'assistant',
      isUser: false,
      text: trimmed.replace(/^assistant\s*:/i, '').trim(),
    };
  }

  return {
    role: 'assistant',
    isUser: false,
    text: trimmed,
  };
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function deriveCallStateLabel(status: CallStatus, isSpeaking: boolean): string {
  if (status === 'requesting') return 'Connecting...';
  if (status === 'active' && isSpeaking) return 'Speaking...';
  if (status === 'active') return 'Listening...';
  if (status === 'completed') return 'Call ended';
  if (status === 'processing') return 'Finalizing...';
  if (status === 'error') return 'Connection issue';
  return 'Ready';
}

export default function VoiceSessionScreen({
  title,
  statusText,
  status,
  isSpeaking,
  transcript,
  onPrimaryPress,
  onDonePress,
  onRetryPress,
  disablePrimary,
  processingText,
  doneButtonText,
}: VoiceSessionScreenProps) {
  const pulseAnim = useRef(new Animated.Value(0.75)).current;
  const scrollRef = useRef<ScrollView>(null);
  const shouldAutoScrollRef = useRef(true);
  const [callSeconds, setCallSeconds] = useState(0);

  const parsedMessages = useMemo(
    () => transcript.map(parseTranscriptMessage),
    [transcript],
  );

  const callStateLabel = useMemo(
    () => deriveCallStateLabel(status, isSpeaking),
    [status, isSpeaking],
  );

  const primaryButtonLabel =
    status === 'active' ? 'End Call' : status === 'requesting' ? 'Connecting...' : 'Start Call';

  const isActive = status === 'active';
  const isProcessing = status === 'processing';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  const canShowTimer =
    status === 'active' || status === 'processing' || status === 'completed';

  useEffect(() => {
    if (status === 'active' || status === 'requesting') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.75,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();
      return;
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(0.75);
  }, [status, pulseAnim]);

  useEffect(() => {
    if (status !== 'active') return;

    const interval = setInterval(() => {
      setCallSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const handleTranscriptScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (layoutMeasurement.height + contentOffset.y);

    // If user scrolls up by more than a small threshold, pause auto-scroll.
    shouldAutoScrollRef.current = distanceFromBottom < 48;
  };

  const handleTranscriptContentSizeChange = () => {
    if (!shouldAutoScrollRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIdentityRow}>
              <View style={styles.headerAvatarOuter}>
                <View style={styles.headerAvatarInner} />
              </View>
              <View>
                <Text style={styles.agentTitle}>{ASSISTANT_NAME}</Text>
                <Text style={styles.sessionTitle}>{title}</Text>
              </View>
            </View>
            {canShowTimer && (
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{formatDuration(callSeconds)}</Text>
              </View>
            )}
          </View>

          <View style={styles.statusRow}>
            <Animated.View
              style={[styles.statusPulse, { transform: [{ scale: pulseAnim }] }]}
            />
            <Text style={styles.statusLabel}>{callStateLabel}</Text>
            <Text style={styles.subtitle}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.transcriptSection}>
          {parsedMessages.length > 0 ? (
            <ScrollView
              ref={scrollRef}
              style={styles.transcriptScroll}
              contentContainerStyle={styles.transcriptContent}
              onScroll={handleTranscriptScroll}
              onContentSizeChange={handleTranscriptContentSizeChange}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {parsedMessages.map((message, i) => {
                const isUserMessage = message.isUser;

                return (
                  <View
                    key={`${i}-${message.role}`}
                    style={[
                      styles.messageRow,
                      isUserMessage
                        ? styles.messageRowUser
                        : styles.messageRowAssistant,
                    ]}
                  >
                    {isUserMessage ? null : (
                      <View style={styles.messageAssistantAvatar} />
                    )}
                    <View
                      style={[
                        styles.messageBubble,
                        isUserMessage ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isUserMessage
                            ? styles.userMessageText
                            : styles.assistantMessageText,
                        ]}
                      >
                        {message.text || '...'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateWrap}>
              <Text style={styles.emptyStateTitle}>No transcript yet</Text>
              <Text style={styles.emptyStateBody}>
                Start speaking to begin the conversation.
              </Text>
            </View>
          )}
        </View>

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color={callColors.brand} />
            <Text style={styles.processingText}>{processingText}</Text>
          </View>
        )}

        <View style={styles.controlsBar}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
                isActive ? styles.primaryButtonDanger : styles.primaryButtonNeutral,
              disablePrimary && styles.buttonDisabled,
            ]}
            onPress={onPrimaryPress}
            disabled={disablePrimary}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={primaryButtonLabel}
          >
            <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
          </TouchableOpacity>

          {isCompleted && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDonePress}
              accessibilityRole="button"
              accessibilityLabel={doneButtonText}
            >
              <Text style={styles.secondaryButtonText}>{doneButtonText}</Text>
            </TouchableOpacity>
          )}

          {isError && (
            <TouchableOpacity
              style={styles.warningButton}
              onPress={onRetryPress}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.warningButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: callColors.background,
  },
  panel: {
    flex: 1,
    width: '100%',
    backgroundColor: callColors.surface,
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: callColors.border,
    backgroundColor: callColors.surface,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: callColors.surfaceAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: callColors.brand,
  },
  agentTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: callColors.textMuted,
    fontFamily: callFontFamily,
  },
  sessionTitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: '700',
    color: callColors.textPrimary,
    fontFamily: callFontFamily,
  },
  timerPill: {
    backgroundColor: callColors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: callColors.textSecondary,
  },
  statusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: callColors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: callColors.brand,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: callColors.brand,
  },
  subtitle: {
    fontSize: 12,
    color: callColors.textSecondary,
    flexShrink: 1,
  },
  transcriptSection: {
    flex: 1,
    minHeight: 220,
    backgroundColor: callColors.background,
  },
  transcriptScroll: {
    flex: 1,
    backgroundColor: callColors.background,
  },
  transcriptContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 10,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageAssistantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: callColors.surfaceAvatar,
  },
  messageBubble: {
    maxWidth: '72%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assistantBubble: {
    backgroundColor: callColors.bubbleAssistant,
    borderColor: callColors.bubbleAssistantBorder,
    borderTopLeftRadius: 8,
  },
  userBubble: {
    backgroundColor: callColors.bubbleUser,
    borderColor: callColors.bubbleUserBorder,
    borderTopRightRadius: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  assistantMessageText: {
    color: callColors.onBubbleAssistant,
  },
  userMessageText: {
    color: callColors.onBubbleUser,
    textAlign: 'right',
  },
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: callColors.textPrimary,
  },
  emptyStateBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: callColors.textMuted,
    textAlign: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: callColors.border,
    backgroundColor: callColors.surfaceElevated,
  },
  processingText: {
    flex: 1,
    fontSize: 13,
    color: callColors.textSecondary,
  },
  controlsBar: {
    padding: CONTROLS_BASE_PADDING,
    paddingBottom: CONTROLS_BASE_PADDING,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: callColors.border,
    backgroundColor: callColors.surface,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  primaryButtonNeutral: {
    backgroundColor: callColors.brand,
  },
  primaryButtonDanger: {
    backgroundColor: callColors.decline,
  },
  primaryButtonText: {
    color: callColors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: callColors.border,
    backgroundColor: callColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: callColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  warningButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: callColors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  warningButtonText: {
    color: callColors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
