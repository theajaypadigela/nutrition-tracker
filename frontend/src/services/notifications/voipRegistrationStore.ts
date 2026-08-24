import { createJsonValueStore } from '../storage/jsonStore';
import { StorageKeys } from '../storage/storageKeys';

const store = createJsonValueStore<boolean>(
  StorageKeys.iosVoipTokenRegistered,
  (value): value is boolean => typeof value === 'boolean',
  () => false,
  { clearWhenInvalid: true, onWriteFailure: () => {} },
);

/** True only after this install's PushKit token was accepted by the backend. */
export function isIosVoipTokenRegistered(): Promise<boolean> {
  return store.read();
}

export function setIosVoipTokenRegistered(registered: boolean): Promise<void> {
  return store.write(registered);
}

export function clearIosVoipTokenRegistration(): Promise<void> {
  return store.clear().catch(() => {});
}
