const MIN_MONTH = 0; // January 0001.
const MAX_MONTH = 9999 * 12 - 1;
const SWIPE_DISTANCE = 48;
const AXIS_RATIO = 1.25;

export function calendarMonthIndex(month: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000'))
    throw new Error(`Invalid calendar month: ${month}`);
  const [year, number] = month.split('-').map(Number);
  return (year! - 1) * 12 + number! - 1;
}

export function shiftCalendarMonth(month: string, direction: -1 | 1, maxMonth?: string): string {
  const maximum = maxMonth === undefined ? MAX_MONTH : calendarMonthIndex(maxMonth);
  const index = Math.max(MIN_MONTH, Math.min(maximum, calendarMonthIndex(month) + direction));
  return `${String(Math.floor(index / 12) + 1).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Local noon avoids DST-midnight surprises. Six rows keep swiping from shifting page layout. */
export function calendarMonth(month: string) {
  calendarMonthIndex(month);
  const first = new Date(`${month}-01T12:00:00`);
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  return {
    label: first.toLocaleDateString('en', { month: 'long', year: 'numeric' }),
    cells: Array.from({ length: 42 }, (_, index): number | null => {
      const day = index - leading + 1;
      return day > 0 && day <= last.getDate() ? day : null;
    }),
  };
}

export function isCalendarPan(dx: number, dy: number, touches: number): boolean {
  return (
    touches === 1 &&
    Number.isFinite(dx) &&
    Number.isFinite(dy) &&
    Math.abs(dy) >= 10 &&
    Math.abs(dy) > Math.abs(dx) * AXIS_RATIO
  );
}

/** Dragging the calendar up reveals the next month; dragging down reveals the previous one. */
export function calendarSwipeDirection(dx: number, dy: number): -1 | 1 | null {
  if (!isCalendarPan(dx, dy, 1) || Math.abs(dy) < SWIPE_DISTANCE) return null;
  return dy < 0 ? 1 : -1;
}

/** One month per wheel/trackpad gesture, ignoring momentum until the gesture settles. */
export function createCalendarWheelTracker() {
  let lastAt = -Infinity;
  let total = 0;
  let moved = false;
  return {
    observe(dx: number, dy: number, at: number): -1 | 1 | null {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dy) <= Math.abs(dx) * AXIS_RATIO)
        return null;
      if (at - lastAt > 180) {
        total = 0;
        moved = false;
      }
      lastAt = at;
      if (moved) return null;
      total += dy;
      if (Math.abs(total) < SWIPE_DISTANCE) return null;
      moved = true;
      return total > 0 ? 1 : -1;
    },
    cancel(at: number) {
      lastAt = at;
      total = 0;
      moved = true;
    },
  };
}
