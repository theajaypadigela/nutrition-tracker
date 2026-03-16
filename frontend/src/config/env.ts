import {
  VAPI_PUBLIC_KEY,
  VAPI_HABIT_ASSISTANT_ID,
  VAPI_MEAL_ASSISTANT_ID,
} from '@env';

function readEnv(value?: string): string {
  return (value ?? '').trim();
}

export const APP_ENV = {
  VAPI_PUBLIC_KEY: readEnv(VAPI_PUBLIC_KEY),
  VAPI_HABIT_ASSISTANT_ID: readEnv(VAPI_HABIT_ASSISTANT_ID),
  VAPI_MEAL_ASSISTANT_ID: readEnv(VAPI_MEAL_ASSISTANT_ID),
};
