import assert from 'node:assert/strict';
import test from 'node:test';
import type { SetEntry, Workout } from '../../types';
import { exerciseSetRecords } from './exerciseRecords';

const set = (id: string, weight: number, reps: number): SetEntry => ({ id, weight, reps });
const workout = (date: string, sets: SetEntry[], draft = false, name = 'Bench'): Workout => ({
  id: date,
  date,
  draft,
  exercises: [{ id: 'exercise', name, category: 'Chest', sets }],
});
const past = workout('2026-01-01', [set('old', 60, 10), set('heavy', 80, 5)]);
const records = (sets: SetEntry[], history = [past]) =>
  exerciseSetRecords(history, 'Bench', '2026-01-02', sets);

test('first logged set counts; ties do not; preceding current sets establish records', () => {
  const result = records(
    [set('first', 20, 5), set('tie', 20, 5), set('more', 20, 6), set('heavy', 22, 1)],
    [],
  );
  assert.deepEqual(result.get('first'), { weight: true, reps: true });
  assert.equal(result.has('tie'), false);
  assert.deepEqual(result.get('more'), { weight: false, reps: true });
  assert.deepEqual(result.get('heavy'), { weight: true, reps: true });
});

test('only strict weight and exact-weight rep improvements count', () => {
  const result = records([
    set('tie', 60, 10),
    set('lower', 60, 9),
    set('reps', 60, 11),
    set('weight', 85, 1),
    set('new-weight', 50, 3),
  ]);
  assert.equal(result.has('tie'), false);
  assert.equal(result.has('lower'), false);
  assert.deepEqual(result.get('reps'), { weight: false, reps: true });
  assert.deepEqual(result.get('weight'), { weight: true, reps: true });
  assert.deepEqual(result.get('new-weight'), { weight: false, reps: true });
});

test('drafts, same-day and future workouts, and other exercises do not affect the baseline', () => {
  const history = [
    past,
    workout('2025-12-30', [set('draft', 100, 20)], true),
    workout('2026-01-02', [set('same', 100, 20)]),
    workout('2026-01-03', [set('future', 100, 20)]),
    workout('2025-12-31', [set('other', 100, 20)], false, 'Squat'),
  ];
  assert.deepEqual(records([set('new', 90, 1)], history).get('new'), {
    weight: true,
    reps: true,
  });
});

test('zero-rep and invalid sets neither earn trophies nor establish records', () => {
  const result = records(
    [
      set('zero', 100, 0),
      set('negative', -10, 5),
      set('infinite', Infinity, 5),
      set('nan', 20, NaN),
      set('first', 0, 5),
    ],
    [workout('2026-01-01', [set('old-zero', 120, 0)])],
  );
  assert.deepEqual([...result.keys()], ['first']);
  assert.deepEqual(result.get('first'), { weight: true, reps: true });
});

test('editing current values recalculates trophies without persisting flags', () => {
  assert.equal(records([set('edit', 60, 11)]).has('edit'), true);
  assert.equal(records([set('edit', 60, 10)]).has('edit'), false);
});
