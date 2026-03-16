import { Platform } from 'react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback', true);

let ringtone: Sound | null = null;

export function startRingtone() {
  if (ringtone) {
    return;
  }

  const soundFile = Platform.OS === 'android' ? 'ringtone.mp3' : 'ringtone.mp3';
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
  if (!ringtone) {
    return;
  }

  ringtone.stop(() => {
    ringtone?.release();
    ringtone = null;
  });
}
