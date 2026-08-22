const BUILD_CONFIG_ENV = {
  __NUTRITION_API_BASE_URL__: 'NUTRITION_API_BASE_URL',
  __NUTRITION_VAPI_PUBLIC_KEY__: 'NUTRITION_VAPI_PUBLIC_KEY',
  __NUTRITION_VAPI_MEAL_ASSISTANT_ID__: 'NUTRITION_VAPI_MEAL_ASSISTANT_ID',
  __NUTRITION_VAPI_HABIT_ASSISTANT_ID__: 'NUTRITION_VAPI_HABIT_ASSISTANT_ID',
};

const inlineBuildConfiguration = ({ types }) => ({
  name: 'inline-nutrition-tracker-build-configuration',
  visitor: {
    ReferencedIdentifier(path) {
      const environmentName = BUILD_CONFIG_ENV[path.node.name];
      if (!environmentName) return;

      path.replaceWith(
        types.stringLiteral(process.env[environmentName]?.trim() ?? ''),
      );
    },
  },
});

const isProductionBundle =
  process.env.BABEL_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

if (isProductionBundle) {
  const missing = Object.values(BUILD_CONFIG_ENV).filter(
    environmentName => !process.env[environmentName]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing release build configuration: ${missing.join(', ')}`,
    );
  }

  if (!process.env.NUTRITION_API_BASE_URL.trim().startsWith('https://')) {
    throw new Error('NUTRITION_API_BASE_URL must use HTTPS in release builds');
  }
}

module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    inlineBuildConfiguration,
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
    'react-native-worklets/plugin',
  ],
};
