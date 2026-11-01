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

test('a vertical upward swipe advances one month and a downward swipe goes back', () => {
  assert.equal(calendarSwipeDirection(0, -100), 1);
  assert.equal(calendarSwipeDirection(3, 100), -1);
  assert.equal(calendarSwipeDirection(0, -48), 1);
  assert.equal(calendarSwipeDirection(0, 48), -1);
});

test('taps, short drags, horizontal/diagonal swipes and invalid coordinates do not change months', () => {
  for (const [dx, dy] of [
    [0, 0],
    [3, 9],
    [0, 47],
    [0, -47],
    [100, 5],
    [100, 100],
    [NaN, 100],
    [0, Infinity],
  ])
    assert.equal(calendarSwipeDirection(dx!, dy!), null);
  assert.equal(isCalendarPan(0, 9, 1), false);
  assert.equal(isCalendarPan(0, 12, 1), true);
  assert.equal(calendarSwipeDirection(0, 12), null);
});

test('multi-touch and horizontal movement never claim a calendar pan', () => {
  assert.equal(isCalendarPan(0, 100, 2), false);
  assert.equal(isCalendarPan(0, 100, 0), false);
  assert.equal(isCalendarPan(100, 10, 1), false);
  assert.equal(isCalendarPan(70, 100, 1), true);
  assert.equal(isCalendarPan(85, 100, 1), false);
});

test('wheel momentum advances only once until the gesture has settled', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(0, 100, 0), 1);
  for (const at of [30, 60, 90, 120]) assert.equal(wheel.observe(0, 100, at), null);
  assert.equal(wheel.observe(0, -100, 350), -1);
  assert.equal(wheel.observe(0, -100, 380), null);
});

test('small trackpad deltas accumulate without triggering on incidental motion', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(0, 10, 0), null);
  assert.equal(wheel.observe(0, 15, 20), null);
  assert.equal(wheel.observe(0, 23, 40), 1);
  assert.equal(wheel.observe(100, 5, 300), null);
  assert.equal(wheel.observe(0, -47, 320), null);
  assert.equal(wheel.observe(0, -1, 340), -1);
});

test('Today cancels lingering wheel motion, but a new gesture still works', () => {
  const wheel = createCalendarWheelTracker();
  assert.equal(wheel.observe(0, 20, 0), null);
  wheel.cancel(10);
  assert.equal(wheel.observe(0, 100, 30), null);
  assert.equal(wheel.observe(0, 100, 60), null);
  assert.equal(wheel.observe(0, 100, 300), 1);
});

test('invalid or horizontal wheel deltas cannot change months', () => {
  const wheel = createCalendarWheelTracker();
  for (const [dx, dy] of [
    [NaN, 100],
    [0, Infinity],
    [100, 10],
    [100, 100],
    [0, 0],
  ])
    assert.equal(wheel.observe(dx!, dy!, 0), null);
  assert.equal(wheel.observe(0, 100, 0), 1);
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
