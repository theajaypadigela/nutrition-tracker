module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    [
      require.resolve('react-native-dotenv'),
      {
        moduleName: '@env',
        path: '.env',
        allowUndefined: true,
      },
    ],
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
          'tailwind.config': './tailwind.config.js',
        },
      },
    ],
    "react-native-reanimated/plugin",
  ],
};
