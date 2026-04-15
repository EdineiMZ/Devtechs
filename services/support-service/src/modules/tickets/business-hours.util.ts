/**
 * Business-hours arithmetic for SLA computation.
 *
 * Business window (DevTechs standard): Monday → Friday, 09:00–18:00
 * local time, 9 hours per day. Weekends and any time outside the
 * window is skipped entirely.
 *
 * The algorithm walks day by day from the start timestamp,
 * subtracting hours from the target until it hits zero — then
 * returns the exact wall-clock moment inside the final day. No
 * calendar magic, no libraries, deterministic on any JS runtime.
 *
 * We expose two helpers:
 *
 *   - addBusinessHours(from, hours)   — add N business hours to a
 *                                       Date, crossing weekends and
 *                                       the 18:00 cutoff as needed.
 *
 *   - businessHoursBetween(a, b)      — compute the number of
 *                                       business hours that elapsed
 *                                       between two Dates (a <= b).
 *                                       Drives SLA-breach reports.
 *
 * Holidays are NOT subtracted today; the operations team tracks
 * them out-of-band and adjusts the slaDeadline manually on the
 * few days it matters. A future enhancement can add a Postgres
 * table of holidays and pipe them through both helpers.
 */

/** Business day starts at 09:00. */
const BUSINESS_START_HOUR = 9;
/** Business day ends at 18:00 (exclusive). */
const BUSINESS_END_HOUR = 18;
/** Length of one business day in hours (18 − 9 = 9). */
const BUSINESS_DAY_HOURS = BUSINESS_END_HOUR - BUSINESS_START_HOUR;

/** Sunday = 0, Monday = 1, ..., Saturday = 6 (matches Date.getDay). */
const SATURDAY = 6;
const SUNDAY = 0;

/** Length of one hour in milliseconds. */
const HOUR_MS = 60 * 60 * 1000;

/** True if the given JS weekday index (0–6) is Monday–Friday. */
function isWeekday(weekday: number): boolean {
  return weekday !== SATURDAY && weekday !== SUNDAY;
}

/**
 * Return the next business moment at-or-after `from`. If `from`
 * falls inside a business window, the same moment is returned. If
 * it's before 09:00, the same day's 09:00 is returned. If it's at
 * or after 18:00 (or on a weekend), the next weekday's 09:00 is
 * returned. Never runs more than 7 iterations — the outer loop
 * always terminates within a week.
 */
function clampToBusinessWindow(from: Date): Date {
  const cursor = new Date(from);

  for (let i = 0; i < 10; i++) {
    const weekday = cursor.getDay();
    if (!isWeekday(weekday)) {
      // Skip to 09:00 of the next day.
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }

    const hour = cursor.getHours();
    if (hour < BUSINESS_START_HOUR) {
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      return cursor;
    }
    if (hour >= BUSINESS_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }
    return cursor;
  }

  // Safety net — shouldn't ever trigger because any start date is
  // ≤ 7 days from the next business window.
  throw new Error('Failed to clamp to a business window');
}

/**
 * Add `hoursToAdd` business hours to `from`, returning the exact
 * Date when the SLA deadline is hit. Fractional hours are allowed
 * (e.g. 0.5 hours for critical first-response).
 */
export function addBusinessHours(from: Date, hoursToAdd: number): Date {
  if (hoursToAdd <= 0) return new Date(from);

  let cursor = clampToBusinessWindow(from);
  let remaining = hoursToAdd;

  while (remaining > 0) {
    // Hours available in the current business day starting from cursor.
    const hourInDay = cursor.getHours() + cursor.getMinutes() / 60;
    const availableToday = BUSINESS_END_HOUR - hourInDay;

    if (availableToday >= remaining) {
      // Deadline lands inside the current business day — advance
      // cursor by `remaining` and return.
      return new Date(cursor.getTime() + remaining * HOUR_MS);
    }

    // Consume the rest of today and roll forward to the next
    // business day at 09:00. `clampToBusinessWindow` handles the
    // weekend skip uniformly.
    remaining -= availableToday;
    cursor = clampToBusinessWindow(
      new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        BUSINESS_START_HOUR,
        0,
        0,
        0,
      ),
    );
  }

  return cursor;
}

/**
 * Business hours elapsed between two Dates (a ≤ b). Used by the
 * SLA-breach report to quantify how late each ticket is.
 */
export function businessHoursBetween(a: Date, b: Date): number {
  if (b <= a) return 0;

  let cursor = clampToBusinessWindow(a);
  let total = 0;

  // Cap at 10000 iterations so a bad input never spins forever.
  for (let i = 0; i < 10_000 && cursor < b; i++) {
    const hourInDay = cursor.getHours() + cursor.getMinutes() / 60;
    const endOfDay = new Date(cursor);
    endOfDay.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    const windowEnd = endOfDay < b ? endOfDay : b;
    const segment = (windowEnd.getTime() - cursor.getTime()) / HOUR_MS;
    if (segment > 0) total += segment;

    if (windowEnd === b) break;

    cursor = clampToBusinessWindow(
      new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
        BUSINESS_START_HOUR,
        0,
        0,
        0,
      ),
    );
  }

  // Clamp tiny float drift — 9.0000000001 → 9.
  return Math.round(total * 1000) / 1000;
}

export const BUSINESS_HOURS_CONFIG = {
  startHour: BUSINESS_START_HOUR,
  endHour: BUSINESS_END_HOUR,
  hoursPerDay: BUSINESS_DAY_HOURS,
} as const;
