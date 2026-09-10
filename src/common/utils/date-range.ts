/**
 * Date-range helpers for consistent end-of-day normalization across
 * accounting, reporting, and dashboard queries.
 *
 * The core bug: `new Date("2025-06-01")` becomes midnight UTC, so any
 * sale/refund/expense on that day after 00:00:00 is excluded from the
 * range. These helpers normalize the end date to 23:59:59.999.
 */

/**
 * Parse a date string (ISO or yyyy-mm-dd) and set the time to 00:00:00.000
 */
export function parseStartOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse a date string (ISO or yyyy-mm-dd) and set the time to 23:59:59.999
 * so the entire final day is included in the range.
 */
export function parseEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns a normalized { startDate, endDate } pair for date-range queries.
 * If `to` is omitted, defaults to end of today.
 */
export function normalizeDateRange(from: string, to?: string): { startDate: Date; endDate: Date } {
  return {
    startDate: parseStartOfDay(from),
    endDate: to ? parseEndOfDay(to) : parseEndOfDay(new Date().toISOString()),
  };
}
