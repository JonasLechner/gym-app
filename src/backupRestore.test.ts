import assert from 'node:assert/strict';
import test from 'node:test';
import { readSafetySnapshot, writeRestoredBackup, type BackupStorage } from './backupRestore';
import type { AppData } from './types';
import { mergeWorkoutsByDate } from './workoutDays';

const data = (id: string): AppData => ({
  workouts: [
    {
      id,
      date: '2026-01-01',
      exercises: [
        {
          id: 'entry',
          name: 'Bench',
          category: 'Chest',
          sets: [{ id: 'set', weight: 60, reps: 8 }],
        },
      ],
    },
  ],
  exercises: [{ id: 'definition', name: 'Bench', category: 'Chest' }],
  routines: [],
  customCategories: [],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    nextBackupSlot: 'A',
    exerciseDefaultsVersion: 1,
  },
});
function memory(initial: string | null) {
  let value = initial;
  let writes = 0;
  const storage: BackupStorage = {
    getItem: async () => value,
    setItem: async (_key, next) => {
      writes++;
      value = next;
    },
  };
  return {
    storage,
    get value() {
      return value;
    },
    get writes() {
      return writes;
    },
  };
}

test('the safety export reads the latest persisted snapshot instead of stale UI data', async () => {
  const latest = data('latest');
  const stored = JSON.stringify(latest);
  const result = await readSafetySnapshot(data('stale'), memory(stored).storage);
  assert.deepEqual(result.data, latest);
  assert.equal(result.storedValue, stored);
});

test('a new installation without storage can still export its current data first', async () => {
  const current = data('current');
  const result = await readSafetySnapshot(current, memory(null).storage);
  assert.deepEqual(result.data, current);
  assert.equal(result.storedValue, null);
});

test('invalid persisted data blocks the safety flow without writing or discarding it', async () => {
  for (const stored of ['{bad json', '{}', 'null']) {
    const store = memory(stored);
    await assert.rejects(readSafetySnapshot(data('current'), store.storage));
    assert.equal(store.value, stored);
    assert.equal(store.writes, 0);
  }
});

test('a valid replacement is durable before the application is given the new state', async () => {
  const previous = JSON.stringify(data('before'));
  const store = memory(previous);
  const incoming = data('after');
  const result = await writeRestoredBackup(incoming, previous, store.storage, (value) => value);
  assert.deepEqual(result, incoming);
  assert.deepEqual(JSON.parse(store.value!), incoming);
  assert.equal(store.writes, 1);
});

test('changed local data invalidates an older safety copy', async () => {
  const exported = JSON.stringify(data('before'));
  const current = JSON.stringify(data('new-workout'));
  const store = memory(current);
  await assert.rejects(
    writeRestoredBackup(data('after'), exported, store.storage, (value) => value),
    /Local data changed/,
  );
  assert.equal(store.value, current);
  assert.equal(store.writes, 0);
});

test('invalid imports or invalid normalized results cannot touch storage', async () => {
  let reads = 0;
  const storage: BackupStorage = {
    getItem: async () => {
      reads++;
      return null;
    },
    setItem: async () => assert.fail('Invalid replacements must not write'),
  };
  await assert.rejects(
    writeRestoredBackup({}, null, storage, (value) => value),
    /Invalid backup/,
  );
  await assert.rejects(
    writeRestoredBackup(data('after'), null, storage, (value) => ({
      ...value,
      settings: { ...value.settings, restSeconds: -1 },
    })),
    /Invalid backup/,
  );
  assert.equal(reads, 0);
});

test('failed reads and failed writes propagate instead of reporting a successful restore', async () => {
  const previous = JSON.stringify(data('before'));
  const failure = new Error('Storage full or unavailable');
  await assert.rejects(
    writeRestoredBackup(
      data('after'),
      previous,
      {
        getItem: async () => {
          throw failure;
        },
        setItem: async () => assert.fail('Must not write after read failure'),
      },
      (value) => value,
    ),
    (error) => error === failure,
  );
  const store = memory(previous);
  await assert.rejects(
    writeRestoredBackup(
      data('after'),
      previous,
      {
        getItem: store.storage.getItem,
        setItem: async () => {
          throw failure;
        },
      },
      (value) => value,
    ),
    (error) => error === failure,
  );
  assert.equal(store.value, previous);
});

test('the replacement promise cannot resolve before storage finishes writing', async () => {
  let finishWrite!: () => void;
  const pendingWrite = new Promise<void>((resolve) => {
    finishWrite = resolve;
  });
  let completed = false;
  const result = writeRestoredBackup(
    data('after'),
    null,
    {
      getItem: async () => null,
      setItem: async () => pendingWrite,
    },
    (value) => value,
  ).then((value) => {
    completed = true;
    return value;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(completed, false);
  finishWrite();
  assert.equal((await result).workouts[0]?.id, 'after');
  assert.equal(completed, true);
});

test('same-day legacy migration keeps sets, notes and unfinished status when restoring', async () => {
  const incoming = data('first');
  incoming.workouts[0]!.note = 'First note';
  incoming.workouts.push({
    ...structuredClone(incoming.workouts[0]!),
    id: 'second',
    note: 'Second note',
    draft: true,
  });
  let id = 0;
  const store = memory(null);
  const restored = await writeRestoredBackup(incoming, null, store.storage, (value) => ({
    ...value,
    workouts: mergeWorkoutsByDate(value.workouts, () => `id-${++id}`),
  }));
  assert.equal(restored.workouts.length, 1);
  assert.equal(restored.workouts[0]?.exercises[0]?.sets.length, 2);
  assert.equal(restored.workouts[0]?.note, 'First note\n\nSecond note');
  assert.equal(restored.workouts[0]?.draft, true);
});
