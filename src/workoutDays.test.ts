import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData, Workout } from './types';
import { mergeWorkoutsByDate, workoutDateError } from './workoutDays';
import { withSavedWorkout, workoutStoreState } from './workoutState';
import { persistWorkoutOnWeb } from './workoutStorage';

const session = (id: string, date = '2026-01-01', draft = false): Workout => ({
  id,
  date,
  draft,
  note: `Note ${id}`,
  exercises: [
    {
      id: 'exercise',
      name: 'Bench',
      category: 'Chest',
      sets: [{ id: 'set', weight: 60, reps: 8, comment: id }],
    },
  ],
});
const data = (workouts: Workout[]): AppData => ({
  workouts,
  exercises: [],
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
const ids = () => {
  let id = 0;
  return () => `new-${++id}`;
};

test('migration merges same-day sessions losslessly and retains a draft until Finish', () => {
  const first = session('completed');
  const second = session('draft', first.date, true);
  second.exercises[0]!.name = 'bench';
  second.exercises.push({
    id: 'exercise',
    name: 'Squat',
    category: 'Legs',
    sets: [{ id: 'set', weight: 100, reps: 5 }],
  });
  const input = [first, second, session('later', '2026-01-02')];
  const before = structuredClone(input);
  const result = mergeWorkoutsByDate(input, ids());
  assert.deepEqual(input, before);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.date, '2026-01-02');
  const merged = result[1]!;
  assert.equal(merged.id, first.id);
  assert.equal(merged.draft, true);
  assert.equal(merged.note, 'Note completed\n\nNote draft');
  assert.equal(merged.exercises.length, 2);
  assert.deepEqual(
    merged.exercises[0]?.sets.map((s) => s.comment),
    ['completed', 'draft'],
  );
  assert.equal(merged.exercises[1]?.sets[0]?.weight, 100);
  assert.equal(new Set(merged.exercises.map((e) => e.id)).size, 2);
  assert.equal(new Set(merged.exercises.flatMap((e) => e.sets.map((s) => s.id))).size, 3);
  assert.deepEqual(mergeWorkoutsByDate(result, ids()), result);
});

test('draft status is retained regardless of input order; completed-only days stay completed', () => {
  assert.equal(
    mergeWorkoutsByDate([session('a', undefined, true), session('b')], ids())[0]?.draft,
    true,
  );
  assert.equal(mergeWorkoutsByDate([session('a'), session('b')], ids())[0]?.draft, false);
});

test('occupied dates are blocked, but keeping the current date and moving to a free date work', () => {
  const first = session('first');
  const second = session('second', '2026-01-02');
  assert.equal(workoutDateError(first, [first, second]), null);
  assert.equal(workoutDateError({ ...first, date: '2026-01-03' }, [first, second]), null);
  const moved = { ...first, date: second.date };
  assert.match(workoutDateError(moved, [first, second])!, /one workout per day/);
  assert.throws(() => withSavedWorkout(data([first, second]), moved, ids()), /one workout per day/);
  assert.throws(
    () => workoutStoreState(data([first, second]), moved, undefined, ids()),
    /one workout per day/,
  );
  assert.throws(
    () => workoutStoreState(data([]), moved, data([second]), ids()),
    /one workout per day/,
  );
  const free = withSavedWorkout(data([first, second]), { ...first, date: '2026-01-03' }, ids());
  assert.equal(free.workouts.length, 2);
  assert.equal(free.workouts.find((w) => w.id === first.id)?.date, '2026-01-03');
});

test('a fresh storage conflict cannot overwrite or duplicate an occupied day', () => {
  const existing = session('existing');
  const incoming = session('new');
  let writes = 0;
  assert.throws(
    () =>
      persistWorkoutOnWeb(data([]), incoming, {
        getItem: () => JSON.stringify(data([existing])),
        setItem: () => {
          writes++;
        },
      }),
    /one workout per day/,
  );
  assert.equal(writes, 0);
});

test('explicit Finish can complete a merged draft without losing its imported sets or notes', () => {
  const [merged] = mergeWorkoutsByDate(
    [session('completed'), session('draft', undefined, true)],
    ids(),
  );
  const finished = { ...merged!, draft: false };
  const result = withSavedWorkout(data([merged!]), finished, ids());
  assert.equal(result.workouts.length, 1);
  assert.equal(result.workouts[0]?.draft, false);
  assert.equal(result.workouts[0]?.exercises[0]?.sets.length, 2);
  assert.equal(result.workouts[0]?.note, merged?.note);
});
