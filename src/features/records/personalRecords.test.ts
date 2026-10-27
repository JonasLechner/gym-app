import assert from 'node:assert/strict';
import test from 'node:test';
import { CORE_LIFTS } from '../../coreLifts';
import type { SetEntry, Workout } from '../../types';
import { exerciseSetRecords } from '../workout/exerciseRecords';
import { bigThreeTotal, personalRecords } from './personalRecords';

const BENCH = 'Flat Barbell Bench Press';
const sets = (...values: [number, number][]): SetEntry[] =>
  values.map(([weight, reps], index) => ({ id: `set-${index}`, weight, reps }));
const workout = (date: string, entries: SetEntry[], draft = false, name = BENCH): Workout => ({
  id: `${date}-${name}`,
  date,
  draft,
  exercises: [{ id: 'exercise', name, category: 'Chest', sets: entries }],
});

test('an empty record book has no fabricated achievements', () => {
  assert.deepEqual(personalRecords([], BENCH), {
    heaviest: null,
    repRecords: [],
    timeline: [],
    sessions: 0,
    sets: 0,
  });
});

test('records are computed chronologically, but displayed newest/ heaviest first', () => {
  const input = [
    workout('2026-01-03', sets([60, 12], [100, 1])),
    workout('2026-01-01', sets([60, 8], [80, 3])),
    workout('2026-01-02', sets([60, 10], [80, 3], [80, 4])),
  ];
  const before = structuredClone(input);
  const result = personalRecords(input, BENCH);
  assert.equal(result.sessions, 3);
  assert.equal(result.sets, 7);
  assert.deepEqual(
    result.repRecords.map((s) => [s.weight, s.reps, s.date]),
    [
      [100, 1, '2026-01-03'],
      [80, 4, '2026-01-02'],
      [60, 12, '2026-01-03'],
    ],
  );
  assert.equal(result.heaviest, result.repRecords[0]);
  assert.equal(result.timeline.length, 6);
  assert.equal(result.timeline[0]?.weight, 100);
  assert.equal(result.timeline.at(-1)?.date, '2026-01-01');
  assert.deepEqual(input, before);
});

test('ties retain the first achievement date and do not add timeline events', () => {
  const result = personalRecords(
    [workout('2026-01-01', sets([80, 5])), workout('2026-01-02', sets([80, 5]))],
    BENCH,
  );
  assert.equal(result.heaviest?.date, '2026-01-01');
  assert.equal(result.timeline.length, 1);
  assert.deepEqual(result.timeline[0]?.record, { weight: true, reps: true });
  assert.equal(result.sets, 2);
});

test('the heaviest-set card uses the best reps at that weight, not a lighter high-rep set', () => {
  const result = personalRecords(
    [
      workout('2026-01-01', sets([100, 1], [60, 20])),
      workout('2026-01-02', sets([100, 3])),
      workout('2026-01-03', sets([100, 3])),
    ],
    BENCH,
  );
  assert.equal(result.heaviest?.weight, 100);
  assert.equal(result.heaviest?.reps, 3);
  assert.equal(result.heaviest?.date, '2026-01-02');
  assert.deepEqual(result.timeline[0]?.record, { weight: false, reps: true });
});

test('drafts, zero reps, invalid values, and exercise variants cannot establish records', () => {
  const result = personalRecords(
    [
      workout('2026-01-01', sets([150, 5]), true),
      workout('2026-01-02', sets([200, 0], [-1, 10], [Infinity, 5], [60, NaN])),
      workout('2026-01-03', sets([300, 1]), false, 'Flat Bench Pause Reps'),
      workout('2026-01-04', sets([300, 1]), false, 'Flat Dumbbell Bench Press'),
      workout('2026-01-05', sets([80, 5]), false, ' flat BARBELL bench PRESS '),
    ],
    BENCH,
  );
  assert.equal(result.sessions, 1);
  assert.equal(result.sets, 1);
  assert.equal(result.heaviest?.weight, 80);
  assert.equal(result.timeline.length, 1);
});

test('sets within a workout advance the baseline; repeated ties do not generate records', () => {
  const result = personalRecords(
    [workout('2026-01-01', sets([60, 5], [60, 5], [60, 6], [65, 3]))],
    BENCH,
  );
  assert.equal(result.sessions, 1);
  assert.equal(result.sets, 4);
  assert.deepEqual(
    result.timeline.map((s) => [s.weight, s.reps, s.record]),
    [
      [65, 3, { weight: true, reps: true }],
      [60, 6, { weight: false, reps: true }],
      [60, 5, { weight: true, reps: true }],
    ],
  );
});

test('rep records are independent of estimated 1RM and keep exact fractional weights separate', () => {
  const result = personalRecords(
    [workout('2026-01-01', sets([20, 40], [21.25, 5], [21.3, 4]))],
    BENCH,
  );
  assert.equal(result.repRecords.length, 3);
  assert.equal(result.repRecords.find((s) => s.weight === 20)?.reps, 40);
  assert.equal(result.repRecords.find((s) => s.weight === 21.25)?.reps, 5);
});

test('editing or deleting workouts recalculates the book rather than persisting stale PR flags', () => {
  const first = workout('2026-01-01', sets([80, 5]));
  const second = workout('2026-01-02', sets([100, 1]));
  assert.equal(personalRecords([first, second], BENCH).heaviest?.weight, 100);
  assert.equal(personalRecords([first], BENCH).heaviest?.weight, 80);
  assert.equal(personalRecords([{ ...second, draft: true }], BENCH).heaviest, null);
});

test('the three overview lifts use the same exact exercise definitions as Progress', () => {
  const input = CORE_LIFTS.map((lift, index) =>
    workout(`2026-01-0${index + 1}`, sets([100 + index * 20, 5]), false, lift.exerciseName),
  );
  assert.deepEqual(
    CORE_LIFTS.map((lift) => personalRecords(input, lift.exerciseName).heaviest?.weight),
    [100, 120, 140],
  );
});

test('the SBD total sums all three heaviest completed sets, independent of selection order', () => {
  const input = CORE_LIFTS.map((lift, index) =>
    workout(`2026-01-0${index + 1}`, sets([100 + index * 20, 5]), false, lift.exerciseName),
  );
  const lifts = CORE_LIFTS.map((lift) => ({
    ...lift,
    ...personalRecords(input, lift.exerciseName),
  }));
  assert.equal(bigThreeTotal(lifts), 360);
  assert.equal(bigThreeTotal([...lifts].reverse()), 360);
});

test('missing, draft-only, or variant-only lifts cannot produce a partial SBD total', () => {
  const input = [
    workout('2026-01-01', sets([120, 5]), false, 'Barbell Squat'),
    workout('2026-01-02', sets([80, 5])),
    workout('2026-01-03', sets([160, 3]), true, 'Deadlift'),
    workout('2026-01-04', sets([200, 5]), false, 'Romanian Deadlift'),
  ];
  const lifts = CORE_LIFTS.map((lift) => ({
    ...lift,
    ...personalRecords(input, lift.exerciseName),
  }));
  assert.equal(bigThreeTotal(lifts), null);
  assert.equal(bigThreeTotal(lifts.slice(0, 2)), null);
  assert.equal(bigThreeTotal([lifts[0]!, lifts[0]!, lifts[1]!]), null);
  assert.equal(bigThreeTotal([]), null);
});

test('SBD totals retain fractional weights and distinguish zero from missing records', () => {
  for (const [weights, expected] of [
    [[120.25, 80.5, 160.75], 361.5],
    [[0, 0, 0], 0],
  ] as const) {
    const input = CORE_LIFTS.map((lift, index) =>
      workout(`2026-01-0${index + 1}`, sets([weights[index]!, 1]), false, lift.exerciseName),
    );
    assert.equal(
      bigThreeTotal(
        CORE_LIFTS.map((lift) => ({ ...lift, ...personalRecords(input, lift.exerciseName) })),
      ),
      expected,
    );
  }
});

test('historical record flags agree with live workout trophy flags', () => {
  const input = [
    workout('2026-01-01', sets([60, 5], [60, 5], [80, 1])),
    workout('2026-01-02', sets([60, 6], [80, 0], [85, 1])),
  ];
  const history = personalRecords(input, BENCH);
  for (const current of input) {
    const live = exerciseSetRecords(input, BENCH, current.date, current.exercises[0]!.sets);
    const historical = history.timeline.filter((entry) => entry.date === current.date);
    assert.equal(live.size, historical.length);
    for (const achievement of historical) {
      const setId = achievement.key.split(':').at(-1)!;
      assert.deepEqual(live.get(setId), achievement.record);
    }
  }
});
