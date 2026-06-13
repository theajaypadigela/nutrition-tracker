/**
 * Centralized runtime configuration.
 *
 * react-native-config is NOT installed, so this is a plain TS module rather than a
 * native env bridge. To switch environments, change API_BASE_URL here (or wire a
 * build-time define / process.env replacement in metro/babel) — but keep the value
 * out of scattered source files.
 */
export const API_BASE_URL =
  'http://ec2-3-109-239-9.ap-south-1.compute.amazonaws.com:5000/';
