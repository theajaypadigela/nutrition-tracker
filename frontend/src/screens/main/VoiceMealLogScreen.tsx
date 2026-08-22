import React from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import type { VoiceMealLogParams } from '../../navigation/paramTypes';
import VoiceSessionScreen from '../../components/voice/VoiceSessionScreen';
import { VOICE_LANE_COPY } from '../../components/voice/voiceSessionCopy';
import { useVoiceMealSession } from '../../hooks/useVoiceMealSession';

export default function VoiceMealLogScreen() {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<{ VoiceMealLog: VoiceMealLogParams }, 'VoiceMealLog'>>();
  const { user } = useAuth();

  const {
    title,
    statusText,
    status,
    setStatus,
    transcript,
    isSpeaking,
    startSession,
    stopSession,
  } = useVoiceMealSession({
    mealSlotId: route.params?.mealSlotId,
    autoStart: route.params?.autoStart === true,
    selectedDate: route.params?.selectedDate,
    userName: user?.name,
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
      processingText={VOICE_LANE_COPY.meal.processingStrip}
      doneButtonText={VOICE_LANE_COPY.meal.doneButton}
      onDonePress={() =>
        (navigation as any).navigate('MainTabs', { screen: 'Food' })
      }
      onRetryPress={() => setStatus('idle')}
    />
  );
}
