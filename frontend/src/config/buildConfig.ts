import { Platform } from 'react-native';

declare const __NUTRITION_API_BASE_URL__: string;
declare const __NUTRITION_VAPI_PUBLIC_KEY__: string;
declare const __NUTRITION_VAPI_MEAL_ASSISTANT_ID__: string;
declare const __NUTRITION_VAPI_HABIT_ASSISTANT_ID__: string;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const configuredApiBaseUrl = __NUTRITION_API_BASE_URL__.trim();
const localApiBaseUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/'
    : 'http://localhost:8080/';

if (!__DEV__ && !configuredApiBaseUrl) {
  throw new Error(
    'A release API URL must be supplied through NUTRITION_API_BASE_URL.',
  );
}

if (
  !__DEV__ &&
  configuredApiBaseUrl &&
  !configuredApiBaseUrl.startsWith('https://')
) {
  throw new Error('The release API URL must use HTTPS.');
}

export const buildConfig = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(configuredApiBaseUrl || localApiBaseUrl),
  vapi: Object.freeze({
    publicKey: __NUTRITION_VAPI_PUBLIC_KEY__.trim(),
    mealAssistantId: __NUTRITION_VAPI_MEAL_ASSISTANT_ID__.trim(),
    habitAssistantId: __NUTRITION_VAPI_HABIT_ASSISTANT_ID__.trim(),
  }),
});

export type VapiFlow = 'meal' | 'habit';

export const getVapiConfiguration = (
  flow: VapiFlow,
): { publicKey: string; assistantId: string } => {
  const assistantId =
    flow === 'meal'
      ? buildConfig.vapi.mealAssistantId
      : buildConfig.vapi.habitAssistantId;

  if (!buildConfig.vapi.publicKey || !assistantId) {
    throw new Error(`Vapi ${flow} configuration is missing from this build.`);
  }

  return { publicKey: buildConfig.vapi.publicKey, assistantId };
};
