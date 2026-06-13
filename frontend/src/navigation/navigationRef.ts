import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

/**
 * Standalone navigation ref. Kept in its own module so headless paths (the notifee
 * background event handler) can import it without pulling in the entire screen graph —
 * part of the registration hardening that keeps a killed-app call handler resilient.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
