import { NativeModules, Platform } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback', true);

type SystemRingtoneModule = {
  startRingtone?: () => void;
  stopRingtone?: () => void;
};

const systemRingtoneModule: SystemRingtoneModule | null =
  Platform.OS === 'android'
    ? ((NativeModules.SystemRingtone as SystemRingtoneModule | undefined) ?? null)
    : null;

let ringtone: Sound | null = null;

export function startRingtone() {
  if (Platform.OS === 'android' && systemRingtoneModule?.startRingtone) {
    try {
      systemRingtoneModule.startRingtone();
      return;
    } catch {
      // Fall back to bundled ringtone when native bridge is unavailable.
    }
  }

  if (ringtone) {
    return;
  }

  const soundFile = 'ringtone.mp3';
  ringtone = new Sound(soundFile, Sound.MAIN_BUNDLE, error => {
    if (error || !ringtone) {
      ringtone = null;
      return;
    }

    ringtone.setNumberOfLoops(-1);
    ringtone.play(success => {
      if (!success) {
        stopRingtone();
      }
    });
  });
}

export function stopRingtone() {
  if (Platform.OS === 'android' && systemRingtoneModule?.stopRingtone) {
    try {
      systemRingtoneModule.stopRingtone();
    } catch {
      // Ignore native bridge errors; JS fallback cleanup still runs.
    }
  }

  if (!ringtone) {
    return;
  }

  ringtone.stop(() => {
    ringtone?.release();
    ringtone = null;
  });
}
