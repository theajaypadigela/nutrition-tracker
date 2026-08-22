import { finishVoiceSession } from '../voiceSessionLifecycle';

describe('finishVoiceSession', () => {
  it('stops, persists, and only then removes listeners', async () => {
    const order: string[] = [];
    const client = {
      stop: jest.fn(async () => {
        order.push('stop');
      }),
      removeAllListeners: jest.fn(() => {
        order.push('remove');
      }),
    };

    await finishVoiceSession(
      client,
      async () => {
        order.push('persist');
      },
      async () => {
        order.push('provider-end');
      },
    );

    expect(order).toEqual(['stop', 'provider-end', 'persist', 'remove']);
  });

  it('still persists and removes listeners when stop fails', async () => {
    const persist = jest.fn(async () => undefined);
    const removeAllListeners = jest.fn();

    await expect(
      finishVoiceSession(
        {
          stop: () => {
            throw new Error('provider stop failed');
          },
          removeAllListeners,
        },
        persist,
      ),
    ).rejects.toThrow('provider stop failed');

    expect(persist).toHaveBeenCalledTimes(1);
    expect(removeAllListeners).toHaveBeenCalledTimes(1);
  });
});
