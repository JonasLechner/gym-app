import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateKey, today } from './dates';
import { calculateHistoryMetrics } from './history';
import { weeklyTotalVolume } from './progress';
import type { Workout } from './types';

function inTimeZone(zone: string, check: () => void) {
  const previous = process.env.TZ;
  try {
    process.env.TZ = zone;
    check();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

const workout = (date: string): Workout => ({
  id: date,
  date,
  exercises: [
    {
      id: 'exercise',
      name: 'Squat',
      category: 'Legs',
      sets: [{ id: 'set', weight: 100, reps: 10 }],
    },
  ],
});

test('Austria uses the local date after midnight in winter and summer', () => {
  inTimeZone('Europe/Vienna', () => {
    for (const [timestamp, expected] of [
      ['2026-01-01T00:30:00+01:00', '2026-01-01'],
      ['2026-06-01T00:30:00+02:00', '2026-06-01'],
    ]) {
      const now = new Date(timestamp!);
      assert.notEqual(now.toISOString().slice(0, 10), expected);
      assert.equal(today(now), expected);
      assert.equal(localDateKey(now), expected);
    }
  });
});

test('dates west of UTC keep the local day before midnight', () => {
  inTimeZone('America/Los_Angeles', () => {
    const now = new Date('2026-06-01T23:30:00-07:00');
    assert.equal(now.toISOString().slice(0, 10), '2026-06-02');
    assert.equal(today(now), '2026-06-01');
  });
});

test('local dates retain zero padding and handle leap day and DST transitions', () => {
  inTimeZone('Europe/Vienna', () => {
    for (const [timestamp, expected] of [
      ['2024-02-29T00:01:00+01:00', '2024-02-29'],
      ['2026-03-29T01:59:00+01:00', '2026-03-29'],
      ['2026-03-29T03:01:00+02:00', '2026-03-29'],
      ['2026-10-25T02:30:00+02:00', '2026-10-25'],
      ['2026-10-25T02:30:00+01:00', '2026-10-25'],
    ]) {
      assert.equal(today(new Date(timestamp!)), expected);
    }
  });
});

test('default today uses the current local clock', () => {
  const before = localDateKey(new Date());
  const result = today();
  const after = localDateKey(new Date());
  assert.ok(result === before || result === after);
});

test('History includes the current local day in its 30-day window', () => {
  inTimeZone('Europe/Vienna', () => {
    const workouts = [workout('2026-06-01')];
    const date = today(new Date('2026-06-01T00:30:00+02:00'));
    assert.equal(calculateHistoryMetrics(workouts, workouts, [], date).recentCount, 1);
  });
});

test('weekly volume groups by local Monday across a DST transition', () => {
  inTimeZone('Europe/Vienna', () => {
    assert.deepEqual(weeklyTotalVolume([workout('2026-03-29'), workout('2026-03-30')]), [
      { date: '2026-03-23', value: 1 },
      { date: '2026-03-30', value: 1 },
    ]);
  });
});
