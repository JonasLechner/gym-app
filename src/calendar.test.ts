import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarMonth,
  calendarMonthIndex,
  calendarSwipeDirection,
  createCalendarWheelTracker,
  isCalendarPan,
  shiftCalendarMonth,
} from './calendar';

test('month grids are Monday-first with a stable six-row height', () => {
  const january = calendarMonth('2026-01');
  assert.equal(january.label, 'January 2026');
  assert.equal(january.cells.length, 42);
  assert.deepEqual(january.cells.slice(0, 4), [null, null, null, 1]);
  assert.deepEqual(
    january.cells.filter((day) => day !== null),
    Array.from({ length: 31 }, (_, index) => index + 1),
  );
  const february = calendarMonth('2021-02');
  assert.equal(february.cells[0], 1);
  assert.equal(february.cells[27], 28);
  assert.deepEqual(february.cells.slice(28), Array(14).fill(null));
});

test('leap days follow Gregorian century rules', () => {
  for (const [month, length] of [
    ['2024-02', 29],
    ['2026-02', 28],
    ['1900-02', 28],
    ['2000-02', 29],
    ['0004-02', 29],
  ] as const)
    assert.equal(calendarMonth(month).cells.filter((day) => day !== null).length, length);
});

test('month navigation crosses years and retains padded date keys', () => {
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(shiftCalendarMonth('2025-12', 1), '2026-01');
  assert.equal(shiftCalendarMonth('0099-12', 1), '0100-01');
  assert.equal(shiftCalendarMonth('0001-01', 1), '0001-02');
  assert.equal(calendarMonthIndex('0001-01'), 0);
});

test('the supported year range and date-picker current-month boundary cannot be crossed', () => {
  assert.equal(shiftCalendarMonth('0001-01', -1), '0001-01');
  assert.equal(shiftCalendarMonth('9999-12', 1), '9999-12');
  assert.equal(shiftCalendarMonth('2026-01', 1, '2026-01'), '2026-01');
  assert.equal(shiftCalendarMonth('2025-12', 1, '2026-01'), '2026-01');
  assert.equal(shiftCalendarMonth('2026-01', -1, '2026-01'), '2025-12');
});

test('invalid month keys fail instead of producing invalid calendar dates', () => {
  for (const month of ['', '2026-00', '2026-13', '26-01', '0000-01', '2026-1', '2026-02-01']) {
    assert.throws(() => calendarMonth(month), /Invalid calendar month/);
    assert.throws(() => shiftCalendarMonth(month, 1), /Invalid calendar month/);
  }
});

test('a left swipe advances one month and a right swipe goes back', () => {
  assert.equal(calendarSwipeDirection(-100, 0), 1);
  assert.equal(calendarSwipeDirection(100, 3), -1);
  assert.equal(calendarSwipeDirection(-48, 0), 1);
  assert.equal(calendarSwipeDirection(48, 0), -1);
});

test('taps, short drags, vertical/diagonal swipes and invalid coordinates do not change months', () => {
  for (const [dx, dy] of [
    [0, 0],
    [9, 3],
    [47, 0],
    [-47, 0],
    [5, 100],
    [100, 100],
    [100, NaN],
    [Infinity, 0],
  ])
    assert.equal(calendarSwipeDirection(dx!, dy!), null);
  assert.equal(isCalendarPan(9, 0, 1), false);
  assert.equal(isCalendarPan(12, 0, 1), true);
  assert.equal(calendarSwipeDirection(12, 0), null);
});

test('multi-touch and vertical movement never claim a calendar pan', () => {
  assert.equal(isCalendarPan(100, 0, 2), false);
  assert.equal(isCalendarPan(100, 0, 0), false);
  assert.equal(isCalendarPan(10, 100, 1), false);
  assert.equal(isCalendarPan(100, 70, 1), true);
  assert.equal(isCalendarPan(100, 85, 1), false);
});

test('horizontal wheel momentum advances only once until the gesture has settled', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(100, 0, 0), 1);
  for (const at of [30, 60, 90, 120]) assert.equal(wheel.observe(100, 0, at), null);
  assert.equal(wheel.observe(-100, 0, 350), -1);
  assert.equal(wheel.observe(-100, 0, 380), null);
});

test('small horizontal trackpad deltas accumulate without triggering on vertical motion', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(10, 0, 0), null);
  assert.equal(wheel.observe(15, 0, 20), null);
  assert.equal(wheel.observe(23, 0, 40), 1);
  assert.equal(wheel.observe(5, 100, 300), null);
  assert.equal(wheel.observe(-47, 0, 320), null);
  assert.equal(wheel.observe(-1, 0, 340), -1);
});

test('Today cancels lingering horizontal wheel motion, but a new gesture still works', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(20, 0, 0), null);
  wheel.cancel(10);
  assert.equal(wheel.observe(100, 0, 30), null);
  assert.equal(wheel.observe(100, 0, 60), null);
  assert.equal(wheel.observe(100, 0, 300), 1);
});

test('invalid or vertical wheel deltas cannot change months', () => {
  const wheel = createCalendarWheelTracker();
  for (const [dx, dy] of [
    [100, NaN],
    [Infinity, 0],
    [10, 100],
    [100, 100],
    [0, 0],
  ])
    assert.equal(wheel.observe(dx!, dy!, 0), null);
  assert.equal(wheel.observe(100, 0, 0), 1);
});

test('calendar weekday alignment remains local and stable across time zones and DST changes', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['Europe/Vienna', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      const march = calendarMonth('2026-03');
      assert.equal(march.cells[6], 1);
      assert.equal(march.cells[36], 31);
      assert.equal(calendarMonth('2026-10').cells[3], 1);
      assert.equal(calendarMonth('0001-01').cells[0], 1);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
