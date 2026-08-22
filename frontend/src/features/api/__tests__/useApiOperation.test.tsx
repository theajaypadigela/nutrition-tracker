import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useApiOperation } from '../useApiOperation';

type ApiOperationHook = ReturnType<typeof useApiOperation>;

let latestHook: ApiOperationHook | null = null;
let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

function HookHarness() {
  latestHook = useApiOperation();
  return null;
}

function currentHook(): ApiOperationHook {
  if (!latestHook) {
    throw new Error('Hook harness has not rendered');
  }
  return latestHook;
}

describe('useApiOperation', () => {
  beforeEach(async () => {
    latestHook = null;
    await act(async () => {
      renderer = ReactTestRenderer.create(<HookHarness />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = null;
  });

  it('tracks loading, success, and error state', async () => {
    let resolveRequest: (value: string) => void = () => undefined;
    let request: Promise<string> = Promise.resolve('');

    await act(async () => {
      request = currentHook().execute(
        () =>
          new Promise(resolve => {
            resolveRequest = resolve;
          }),
      );
      await Promise.resolve();
    });

    expect(currentHook().loading).toBe(true);
    expect(currentHook().error).toBeNull();

    await act(async () => {
      resolveRequest('saved');
      await expect(request).resolves.toBe('saved');
    });

    expect(currentHook().loading).toBe(false);

    await act(async () => {
      await expect(
        currentHook().execute(async () => {
          throw new Error('Request failed');
        }),
      ).rejects.toThrow('Request failed');
    });

    expect(currentHook().loading).toBe(false);
    expect(currentHook().error).toBe('Request failed');
  });

  it('cancels an older operation without surfacing a cancellation error', async () => {
    const capturedSignals: AbortSignal[] = [];
    let firstRequest: Promise<unknown> = Promise.resolve();

    await act(async () => {
      firstRequest = currentHook()
        .execute(
          signal =>
            new Promise((_resolve, reject) => {
              capturedSignals.push(signal);
              signal.addEventListener('abort', () => {
                reject({ __CANCEL__: true });
              });
            }),
        )
        .catch(error => error);
      await Promise.resolve();
    });

    await act(async () => {
      await expect(currentHook().execute(async () => 'latest')).resolves.toBe(
        'latest',
      );
      await firstRequest;
    });

    expect(capturedSignals[0]?.aborted).toBe(true);
    expect(currentHook().loading).toBe(false);
    expect(currentHook().error).toBeNull();
  });
});
