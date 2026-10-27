/** Calendar date on the device, deliberately not the date of its UTC timestamp. */
export function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export const today = (now: Date = new Date()) => localDateKey(now);
