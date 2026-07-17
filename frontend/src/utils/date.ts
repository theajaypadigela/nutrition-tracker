export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getTodayLocalDate = (): string => formatLocalDate(new Date());

export const addDaysToLocalDate = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const parseLocalDateString = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return new Date(value);
  }

  return new Date(year, month - 1, day);
};

export const isSameLocalCalendarDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Human-friendly label for a YYYY-MM-DD string: "Today", "Yesterday", or "3rd July 2026". */
export const formatDate = (dateString: string): string => {
  const date = parseLocalDateString(dateString);
  const today = new Date();
  const yesterday = addDaysToLocalDate(today, -1);

  if (isSameLocalCalendarDay(date, today)) {
    return 'Today';
  } else if (isSameLocalCalendarDay(date, yesterday)) {
    return 'Yesterday';
  } else {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${getOrdinal(day)} ${month} ${year}`;
  }
};
