import { EventType } from '@notifee/react-native';
import {
  iosCallInteractionKey,
  readInitialIosCallInteraction,
  readIosCallInteraction,
} from '../iosCallInteraction';

describe('iOS call notification interactions', () => {
  it('opens the fallback incoming-call screen for a notification body press', () => {
    expect(readIosCallInteraction(EventType.PRESS, 'default')).toBe('open');
  });

  it('maps the explicit Accept and Decline quick actions', () => {
    expect(readIosCallInteraction(EventType.ACTION_PRESS, 'accept')).toBe('accept');
    expect(readIosCallInteraction(EventType.ACTION_PRESS, 'decline')).toBe('decline');
  });

  it('ignores delivery and unrelated actions', () => {
    expect(readIosCallInteraction(EventType.DELIVERED)).toBeNull();
    expect(readIosCallInteraction(EventType.ACTION_PRESS, 'snooze')).toBeNull();
  });

  it('maps the legacy iOS cold-start action shape', () => {
    expect(readInitialIosCallInteraction('default')).toBe('open');
    expect(readInitialIosCallInteraction('accept')).toBe('accept');
    expect(readInitialIosCallInteraction('decline')).toBe('decline');
    expect(readInitialIosCallInteraction(undefined)).toBe('open');
  });

  it('uses the normalized interaction in the exactly-once key', () => {
    expect(iosCallInteractionKey('meal-1', 'accept')).toBe('meal-1:accept');
    expect(iosCallInteractionKey('meal-1', 'open')).toBe('meal-1:open');
    expect(iosCallInteractionKey(undefined, 'decline')).toBe('unknown:decline');
  });
});
