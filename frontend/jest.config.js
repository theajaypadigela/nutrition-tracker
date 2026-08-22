module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.jsx$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?|@react-native-async-storage|@react-navigation|@gluestack-ui|@legendapp|@expo|@notifee|nativewind|react-native-css-interop|lucide-react-native|@vapi-ai|@daily-co)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // Generated gluestack UI sits under the same exception boundary the
    // TypeScript and lint gates give it.
    '!src/components/ui/**',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  // Today's measured baseline, floored. Report first, ratchet later: these may
  // only go up. See docs/coverage-baseline.md.
  coverageThreshold: {
    global: {
      statements: 18,
      branches: 11,
      functions: 17,
      lines: 18,
    },
  },
};
