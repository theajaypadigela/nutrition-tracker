/* global jest */

require('react-native-gesture-handler/jestSetup');

jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);
jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
  })),
  vars: jest.fn(() => ({})),
}));
jest.mock('@vapi-ai/react-native', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    setMuted: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  })),
);
