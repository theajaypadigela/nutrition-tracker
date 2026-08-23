module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Mirrors the '@/*' -> 'src/*' alias in tsconfig.json and babel.config.js.
  // babel-plugin-module-resolver already rewrites these at transform time; this is
  // here so a '@/...' path still resolves if the transform ever stops running.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
