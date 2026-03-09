import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
      return;
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [isSpeaking, pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{statusText}</Text>

        <Animated.View
          style={[styles.micWrapper, { transform: [{ scale: pulseAnim }] }]}
        >
          <TouchableOpacity
            style={[
              styles.micButton,
              status === 'active' && styles.micButtonActive,
              (status === 'completed' || status === 'processing') &&
                styles.micButtonCompleted,
            ]}
            onPress={onPrimaryPress}
            disabled={disablePrimary}
            activeOpacity={0.8}
          >
            <Text style={styles.micIcon}>
              {status === 'active'
                ? '⏹'
                : status === 'processing'
                  ? '⏳'
                  : status === 'completed'
                    ? '✓'
                    : '🎙️'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {transcript.length > 0 && (
          <ScrollView
            ref={scrollRef}
            style={styles.transcriptBox}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {transcript.map((line, i) => (
              <Text key={i} style={styles.transcriptLine}>
                {line}
              </Text>
            ))}
          </ScrollView>
        )}

        {status === 'active' && (
          <Text style={styles.hint}>Tap the stop button when done</Text>
        )}

        {status === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.hint}>{processingText}</Text>
          </View>
        )}

        {status === 'completed' && (
          <TouchableOpacity style={styles.doneButton} onPress={onDonePress}>
            <Text style={styles.doneButtonText}>{doneButtonText}</Text>
          </TouchableOpacity>
        )}

        {status === 'error' && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetryPress}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    marginBottom: 48,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  micWrapper: {
    marginBottom: 32,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonActive: {
    backgroundColor: '#e53935',
  },
  micButtonCompleted: {
    backgroundColor: '#059669',
  },
  micIcon: {
    fontSize: 40,
  },
  transcriptBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  transcriptLine: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: '#888',
  },
  processingContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 12,
  },
  doneButton: {
    marginTop: 24,
    backgroundColor: '#059669',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
