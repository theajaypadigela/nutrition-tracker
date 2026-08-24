/**
 * Typed domain service layer over the axios apiClient.
 *
 * Screens, contexts, and hooks import these instead of importing apiClient directly, so
 * endpoint strings + response shapes have a single home and the HTTP client can be swapped
 * or mocked (each `create*Api` accepts an injectable HttpClient).
 */
export * from './types';
export * from './authApi';
export * from './habitApi';
export * from './foodLogApi';
export * from './nutritionApi';
export * from './dashboardApi';
export * from './mealScheduleApi';
export * from './voiceApi';
export * from './notificationApi';
