import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a day-of-month as a short label ("1st", "25th"…).
 * Used for salary start dates in Income Sources and settings.
 */
/**
 * Format a YYYY-MM-DD (or ISO) date as a short label ("29 Aug").
 * Parsed locally so a date-only string never shifts by a UTC offset.
 */
export function formatShortDate(iso: string, locale = 'en-GB'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDayOfMonth(day: number): string {
  const safe = Math.min(31, Math.max(1, Math.round(day)))
  const mod10 = safe % 10
  const mod100 = safe % 100
  let suffix = 'th'
  if (mod10 === 1 && mod100 !== 11) suffix = 'st'
  else if (mod10 === 2 && mod100 !== 12) suffix = 'nd'
  else if (mod10 === 3 && mod100 !== 13) suffix = 'rd'
  return `${safe}${suffix}`
}

/**
 * Compute the budget period that starts in the given month key (YYYY-MM) for a
 * source with the given pay day. The period always starts on the payday of
 * that month, e.g. monthKey "2026-08" with payDay 25 → 2026-08-25 → 2026-09-24
 * (the salary received Aug 25 funds that period; the next salary arrives
 * Sep 25). A payDay of 1 starts on the 1st of the month itself. Days beyond a
 * month's length clamp to its last day (payDay 31 in February → Feb 28).
 * Returns null for sources without a payDay.
 */
export function getSourcePeriod(
  monthKey: string,
  payDay?: number,
): { periodKey: string; startDate: string; endDate: string } | null {
  if (!payDay || payDay < 1 || payDay > 31) return null
  const [year, month] = monthKey.split('-').map(Number) // month is 1-based
  const startDay = Math.min(payDay, new Date(year, month, 0).getDate())
  const start = new Date(year, month - 1, startDay)
  // Next period starts on the same payday of the following month (clamped).
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextStartDay = Math.min(payDay, new Date(nextYear, nextMonth, 0).getDate())
  const nextStart = new Date(nextYear, nextMonth - 1, nextStartDay)
  // Calendar-arithmetic end (day before next start), safe across DST shifts.
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1)
  return {
    periodKey: monthKey,
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  }
}

/**
 * Resolve the active budget month key (YYYY-MM) for today's date, honouring a
 * configured monthly start date. With no payDay (or payDay 1) this is simply
 * the calendar month. With a later payday the month does NOT flip on the 1st:
 * e.g. today 2026-09-01 with payDay 25 → "2026-08" (the period that started
 * Aug 25 is still running), and only on Sep 25 does it flip to "2026-09".
 */
export function getCurrentMonthKey(
  payDay: number | undefined,
  now: Date = new Date(),
): string {
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based
  if (!payDay || payDay <= 1) {
    return `${year}-${String(month).padStart(2, '0')}`
  }
  const clamped = Math.min(payDay, new Date(year, month, 0).getDate())
  if (now.getDate() >= clamped) {
    return `${year}-${String(month).padStart(2, '0')}`
  }
  const prev = new Date(year, month - 2, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}
