/**
 * Pure reconciliation diff. No RN/Notifee imports.
 *
 * Given the set of triggers we *want* armed (derived from schedule intent) and the
 * set of trigger ids Notifee currently reports pending, compute what to arm, what to
 * prune (orphans), and which desired triggers are already correctly armed.
 *
 * This is the decision core of the reconciliation pass (§B). Keeping it pure means the
 * arm/prune/keep logic is testable without a device.
 */

export type DesiredTrigger = {
  /** Notifee notification id. Stable per reminder occurrence/slot. */
  id: string;
  /** Derived epoch (ms) this trigger should fire at. */
  fireAt: number;
};

export type ReconcileResult = {
  /** Desired triggers that must be (re-)armed: missing from pending, or re-armed to refresh fireAt. */
  toArm: DesiredTrigger[];
  /** Pending trigger ids that are no longer desired and must be cancelled. */
  toPrune: string[];
  /** Desired ids already pending and kept as-is. */
  kept: string[];
};

export type ReconcileOptions = {
  /**
   * Notifee does not expose the armed fireAt, only ids. When `reArmExisting` is true,
   * a desired id that is already pending is still re-armed so its fire time tracks the
   * recomputed wall-clock intent (corrects DAILY epoch drift after DST). Defaults true.
   */
  reArmExisting?: boolean;
  /**
   * Trigger ids this app owns and is therefore allowed to prune. Pending ids outside
   * this set are left untouched (defensive: never cancel a notification we don't manage).
   * If omitted, every pending id is eligible for pruning.
   */
  ownedIdPredicate?: (id: string) => boolean;
};

/**
 * Diffs desired triggers against currently-pending ids.
 */
export function diffTriggers(
  desired: DesiredTrigger[],
  pendingIds: string[],
  options: ReconcileOptions = {},
): ReconcileResult {
  const reArmExisting = options.reArmExisting ?? true;
  const owned = options.ownedIdPredicate ?? (() => true);

  // De-duplicate desired by id (last write wins) so two intents can't both claim a slot.
  const desiredById = new Map<string, DesiredTrigger>();
  for (const d of desired) {
    desiredById.set(d.id, d);
  }

  const pendingSet = new Set(pendingIds);

  const toArm: DesiredTrigger[] = [];
  const kept: string[] = [];

  for (const d of desiredById.values()) {
    if (!pendingSet.has(d.id)) {
      toArm.push(d);
    } else if (reArmExisting) {
      toArm.push(d);
    } else {
      kept.push(d.id);
    }
  }

  const toPrune: string[] = [];
  for (const id of pendingSet) {
    if (!desiredById.has(id) && owned(id)) {
      toPrune.push(id);
    }
  }

  return { toArm, toPrune, kept };
}
