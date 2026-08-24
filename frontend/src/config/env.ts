import { NativeModules, Platform } from 'react-native';

const LOCAL_API_PORT = 5050;

/**
 * Resolves the local development API address for each runtime.
 *
 * Android uses adb reverse, so localhost is correct there. An iOS Simulator also shares
 * the Mac's localhost, but a physical iPhone does not. During a device build Metro's bundle
 * URL contains the development Mac's reachable host, so reuse that host for the backend.
 */
export function resolveLocalApiBaseUrl(
  platform: string,
  scriptUrl?: string,
): string {
  let host = 'localhost';

  if (platform === 'ios' && scriptUrl) {
    const match = scriptUrl.match(/^https?:\/\/(\[[^\]]+\]|[^/:?#]+)(?::\d+)?/i);
    if (match?.[1]) {
      host = match[1];
    }
  }

  return `http://${host}:${LOCAL_API_PORT}/`;
}

const metroScriptUrl = (NativeModules.SourceCode as { scriptURL?: string } | undefined)
  ?.scriptURL;

export const API_BASE_URL = resolveLocalApiBaseUrl(
  Platform.OS,
  metroScriptUrl,
);
