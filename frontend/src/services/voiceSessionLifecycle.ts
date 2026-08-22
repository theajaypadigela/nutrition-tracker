export interface VoiceSessionClient {
  stop(): void | Promise<void>;
  removeAllListeners(): unknown;
}

/**
 * End the provider call while its listeners are still attached, persist the
 * captured result, and only then detach the SDK. The nested finally blocks make
 * transcript persistence run even when the provider's stop call throws.
 */
export const finishVoiceSession = async (
  client: VoiceSessionClient,
  persistCapturedResult: () => Promise<void>,
  waitForProviderEnd: () => Promise<void> = async () => undefined,
): Promise<void> => {
  try {
    await client.stop();
  } finally {
    try {
      await waitForProviderEnd();
    } finally {
      try {
        await persistCapturedResult();
      } finally {
        client.removeAllListeners();
      }
    }
  }
};

export const waitForVoiceCallEnd = (
  callEnd: Promise<void>,
  timeoutMs = 2_000,
): Promise<void> =>
  new Promise(resolve => {
    const timeout = setTimeout(resolve, timeoutMs);
    callEnd.then(
      () => {
        clearTimeout(timeout);
        resolve();
      },
      () => {
        clearTimeout(timeout);
        resolve();
      },
    );
  });
