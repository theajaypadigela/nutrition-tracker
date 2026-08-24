import { resolveLocalApiBaseUrl } from '../env';

describe('resolveLocalApiBaseUrl', () => {
  it('uses localhost for Android adb reverse', () => {
    expect(
      resolveLocalApiBaseUrl('android', 'http://10.0.2.2:8081/index.bundle'),
    ).toBe('http://localhost:5050/');
  });

  it('uses localhost for the iOS Simulator', () => {
    expect(
      resolveLocalApiBaseUrl('ios', 'http://localhost:8081/index.bundle'),
    ).toBe('http://localhost:5050/');
  });

  it("reuses Metro's Mac host on a physical iPhone", () => {
    expect(
      resolveLocalApiBaseUrl('ios', 'http://192.168.1.24:8081/index.bundle'),
    ).toBe('http://192.168.1.24:5050/');
  });

  it('preserves a bracketed IPv6 Metro host', () => {
    expect(
      resolveLocalApiBaseUrl('ios', 'http://[fe80::1234]:8081/index.bundle'),
    ).toBe('http://[fe80::1234]:5050/');
  });

  it('falls back to localhost when no network bundle URL is available', () => {
    expect(resolveLocalApiBaseUrl('ios', 'file:///app/main.jsbundle')).toBe(
      'http://localhost:5050/',
    );
  });
});
