import React, { useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import type { VoiceHabitParams } from '@/navigation/paramTypes';
import VoiceSessionScreen from '@/components/voice/VoiceSessionScreen';
import { VOICE_LANE_COPY } from '@/components/voice/voiceSessionCopy';
import { useVoiceHabitSession } from '@/hooks/useVoiceHabitSession';

export default function VoiceHabitScreen() {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<{ VoiceHabit: VoiceHabitParams }, 'VoiceHabit'>>();
  const { user } = useAuth();

  const navigateToHabits = useCallback(() => {
    (navigation as any).navigate('MainTabs', { screen: 'Habits' });
  }, [navigation]);

  const {
    title,
    statusText,
    status,
    setStatus,
    transcript,
    isSpeaking,
    startSession,
    stopSession,
  } = useVoiceHabitSession({
    habitId: route.params?.habitId,
    habitName: route.params?.habitName ?? 'Habit',
    habitTime: route.params?.habitTime ?? '',
    autoStart: route.params?.autoStart === true,
    userName: user?.name,
    onRescheduled: navigateToHabits,
  });

  return (
    <VoiceSessionScreen
      title={title}
      statusText={statusText}
      status={status}
      isSpeaking={isSpeaking}
      transcript={transcript}
      onPrimaryPress={status === 'active' ? stopSession : startSession}
      disablePrimary={status === 'requesting' || status === 'processing'}
      processingText={VOICE_LANE_COPY.habit.processingStrip}
      doneButtonText={VOICE_LANE_COPY.habit.doneButton}
      onDonePress={navigateToHabits}
      onRetryPress={() => setStatus('idle')}
    />
  );
}
