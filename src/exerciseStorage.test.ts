import assert from 'node:assert/strict';
import test from 'node:test';
import { writeEditedExercise } from './exerciseStorage';
import type { AppData } from './types';
import { DATA_STORAGE_KEY } from './workoutStorage';

const original = { id: 'definition', name: 'Bench', category: 'Chest' };
const changes = { name: 'My Bench', category: 'Custom' };
const fixture = (): AppData => ({
  workouts: [
    {
      id: 'workout',
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
  exercises: [{ ...original }],
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

test('exercise edits use latest persisted data, preserving unrelated changes', async () => {
  const stale = fixture();
  const latest = fixture();
  latest.workouts.push({ id: 'newer', date: '2026-01-02', draft: true, exercises: [] });
  latest.settings.restSeconds = 180;
  const writes: [string, string][] = [];
  const next = await writeEditedExercise(stale, original, changes, {
    getItem: async (key) => {
      assert.equal(key, DATA_STORAGE_KEY);
      return JSON.stringify(latest);
    },
    setItem: async (key, value) => {
      writes.push([key, value]);
    },
  });
  assert.equal(next.workouts.length, 2);
  assert.equal(next.settings.restSeconds, 180);
  assert.equal(next.workouts[0]?.exercises[0]?.name, 'My Bench');
  assert.deepEqual(writes, [[DATA_STORAGE_KEY, JSON.stringify(next)]]);
  assert.deepEqual(stale, fixture());
});

test('an edit is not acknowledged before its storage write finishes', async () => {
  let finishWrite!: () => void;
  let acknowledged = false;
  const pending = writeEditedExercise(fixture(), original, changes, {
    getItem: async () => null,
    setItem: async () =>
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
  }).then((next) => {
    acknowledged = true;
    return next;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(acknowledged, false);
  finishWrite();
  assert.equal((await pending).exercises[0]?.name, 'My Bench');
  assert.equal(acknowledged, true);
});

test('storage errors propagate and do not mutate the original data', async () => {
  const failure = new Error('Storage unavailable');
  for (const operation of ['read', 'write']) {
    const source = fixture();
    const before = structuredClone(source);
    await assert.rejects(
      writeEditedExercise(source, original, changes, {
        getItem: async () => {
          if (operation === 'read') throw failure;
          return null;
        },
        setItem: async () => {
          if (operation === 'read') assert.fail('Must not write after a read failure');
          throw failure;
        },
      }),
      (caught) => caught === failure,
    );
    assert.deepEqual(source, before);
  }
});

test('malformed stored data fails without any replacement write', async () => {
  for (const stored of ['', 'not JSON', 'null', '{}']) {
    await assert.rejects(
      writeEditedExercise(fixture(), original, changes, {
        getItem: async () => stored,
        setItem: async () => assert.fail('Malformed storage must not be overwritten'),
      }),
    );
  }
});

test('concurrent rename or muscle-group changes require reloading the app', async () => {
  for (const patch of [{ name: 'Changed elsewhere' }, { category: 'Changed elsewhere' }]) {
    const latest = fixture();
    Object.assign(latest.exercises[0]!, patch);
    await assert.rejects(
      writeEditedExercise(fixture(), original, changes, {
        getItem: async () => JSON.stringify(latest),
        setItem: async () => assert.fail('A stale editor must not overwrite another edit'),
      }),
      /changed in another window/,
    );
  }
});

test('a change after the initial read is detected before any replacement write', async () => {
  const source = fixture();
  const newer = fixture();
  newer.workouts[0]!.exercises[0]!.sets[0]!.reps = 12;
  let reads = 0;
  await assert.rejects(
    writeEditedExercise(source, original, changes, {
      getItem: async () => JSON.stringify(++reads === 1 ? source : newer),
      setItem: async () => assert.fail('Concurrent workout changes must not be overwritten'),
    }),
    /Local data changed while saving/,
  );
  assert.equal(reads, 2);
  assert.deepEqual(source, fixture());
});

test('a definition deleted elsewhere is not recreated by a stale editor', async () => {
  const latest = fixture();
  latest.exercises = [];
  await assert.rejects(
    writeEditedExercise(fixture(), original, changes, {
      getItem: async () => JSON.stringify(latest),
      setItem: async () => assert.fail('Deleted exercises must not be recreated'),
    }),
    /no longer exists/,
  );
});

test('invalid or conflicting input never writes storage', async () => {
  const latest = fixture();
  latest.exercises.push({ id: 'other', name: 'Other', category: 'Chest' });
  for (const name of ['', ' ', 'Other']) {
    await assert.rejects(
      writeEditedExercise(
        latest,
        original,
        { ...changes, name },
        {
          getItem: async () => null,
          setItem: async () => assert.fail('Invalid edits must not write'),
        },
      ),
    );
  }
});

test('no-op edits do not produce unnecessary writes', async () => {
  const source = fixture();
  assert.equal(
    await writeEditedExercise(source, original, original, {
      getItem: async () => null,
      setItem: async () => assert.fail('No-op edits must not write'),
    }),
    source,
  );
});
