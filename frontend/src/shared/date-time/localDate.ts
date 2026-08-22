export interface LocalDateRange {
  startDate: string;
  endDate: string;
}

const padTwoDigits = (value: number): string => String(value).padStart(2, '0');

/**
 * Formats the device's local calendar date without converting it through UTC.
 * API date-only values represent a user's day, so `toISOString()` is not safe
 * here near timezone boundaries.
 */
export const formatLocalDate = (date: Date = new Date()): string => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Cannot format an invalid date');
  }

  return [
    date.getFullYear(),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate()),
  ].join('-');
};

/** Returns an inclusive range ending on the supplied local calendar day. */
export const trailingLocalDateRange = (
  days: number,
  end: Date = new Date(),
): LocalDateRange => {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError('days must be a positive integer');
  }

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
};
