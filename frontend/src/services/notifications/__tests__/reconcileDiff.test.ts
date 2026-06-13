import { diffTriggers, DesiredTrigger } from '../reconcileDiff';

const d = (id: string, fireAt = 1000): DesiredTrigger => ({ id, fireAt });

describe('diffTriggers', () => {
  it('arms desired triggers that are not pending', () => {
    const res = diffTriggers([d('a'), d('b')], ['a'], { reArmExisting: false });
    expect(res.toArm.map(t => t.id)).toEqual(['b']);
    expect(res.kept).toEqual(['a']);
    expect(res.toPrune).toEqual([]);
  });

  it('prunes pending triggers that are no longer desired', () => {
    const res = diffTriggers([d('a')], ['a', 'orphan'], { reArmExisting: false });
    expect(res.toPrune).toEqual(['orphan']);
  });

  it('re-arms existing triggers by default to refresh fire times (DST drift correction)', () => {
    const res = diffTriggers([d('a')], ['a']);
    expect(res.toArm.map(t => t.id)).toEqual(['a']);
    expect(res.kept).toEqual([]);
  });

  it('only prunes app-owned ids when a predicate is supplied', () => {
    const res = diffTriggers([d('meal-alarm-daily')], ['meal-alarm-daily', 'someone-elses-id'], {
      reArmExisting: false,
      ownedIdPredicate: id => id.startsWith('meal-') || id.startsWith('habit-'),
    });
    expect(res.toPrune).toEqual([]); // foreign id left untouched
  });

  it('de-duplicates desired by id (last write wins)', () => {
    const res = diffTriggers([d('a', 1), d('a', 2)], [], { reArmExisting: false });
    expect(res.toArm).toHaveLength(1);
    expect(res.toArm[0].fireAt).toBe(2);
  });

  it('handles the empty desired set by pruning all pending owned ids', () => {
    const res = diffTriggers([], ['habit-call-08:30', 'meal-alarm-daily']);
    expect(res.toArm).toEqual([]);
    expect(res.toPrune.sort()).toEqual(['habit-call-08:30', 'meal-alarm-daily']);
  });
});
