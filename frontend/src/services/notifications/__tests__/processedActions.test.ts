import { claimAction } from '../processedActions';

describe('claimAction exactly-once dedupe', () => {
  it('lets the first claimant through and rejects the second for the same key', async () => {
    const first = await claimAction('notif-1:accept');
    const second = await claimAction('notif-1:accept');
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('allows distinct keys independently', async () => {
    expect(await claimAction('notif-2:accept')).toBe(true);
    expect(await claimAction('notif-2:decline')).toBe(true);
    expect(await claimAction('notif-3:accept')).toBe(true);
  });

  it('rejects a concurrent double-claim of the same key (cold-start race)', async () => {
    // Both callers race; the synchronous in-memory claim must let exactly one win.
    const [a, b] = await Promise.all([
      claimAction('notif-4:accept'),
      claimAction('notif-4:accept'),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});
