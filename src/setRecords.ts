import type { SetEntry } from './types';

export type SetRecord = { weight: boolean; reps: boolean };

/** A chronological record ledger shared by live workout trophies and historical records. */
export function createSetRecordTracker() {
  let highestWeight = -Infinity;
  const repsByWeight = new Map<number, number>();

  return {
    observe(set: SetEntry): SetRecord | null {
      if (
        !Number.isFinite(set.weight) ||
        set.weight < 0 ||
        !Number.isFinite(set.reps) ||
        set.reps <= 0
      )
        return null;
      const record = {
        weight: set.weight > highestWeight,
        reps: set.reps > (repsByWeight.get(set.weight) ?? 0),
      };
      highestWeight = Math.max(highestWeight, set.weight);
      repsByWeight.set(set.weight, Math.max(repsByWeight.get(set.weight) ?? 0, set.reps));
      return record;
    },
  };
}
