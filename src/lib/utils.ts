import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a day-of-month as a short label ("1st", "25th"…).
 * Used for salary start dates in Income Sources and settings.
 */
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
 * Compute the budget period a source with the given pay day belongs to when
 * viewing a given calendar month. The period always starts on the payday, so
 * e.g. viewing "2026-09" with payDay 25 → the current period is 2026-08-25 →
 * 2026-09-24 (the salary received Aug 25 funds that period, the next salary
 * arrives Sep 25). A payDay of 1 starts on the 1st of the viewed month itself.
 * Days beyond a month's length clamp to its last day (payDay 31 in February →
 * Feb 28). Returns null for sources without a payDay.
 */
export function getSourcePeriod(
  monthKey: string,
  payDay?: number,
): { periodKey: string; startDate: string; endDate: string } | null {
  if (!payDay || payDay < 1 || payDay > 31) return null
  const [year, month] = monthKey.split('-').map(Number) // month is 1-based
  // Period containing the 1st of monthKey: starts on the 1st itself when the
  // payday is the 1st, otherwise on the payday of the previous month.
  const startYear = payDay === 1 ? year : month === 1 ? year - 1 : year
  const startMonth = payDay === 1 ? month : month === 1 ? 12 : month - 1 // 1-based
  const startDay = Math.min(payDay, new Date(startYear, startMonth, 0).getDate())
  const start = new Date(startYear, startMonth - 1, startDay)
  // Next period starts on the same payday of the following month (clamped).
  const nextYear = startMonth === 12 ? startYear + 1 : startYear
  const nextMonth = startMonth === 12 ? 1 : startMonth + 1
  const nextStartDay = Math.min(payDay, new Date(nextYear, nextMonth, 0).getDate())
  const nextStart = new Date(nextYear, nextMonth - 1, nextStartDay)
  // Calendar-arithmetic end (day before next start), safe across DST shifts.
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return {
    periodKey,
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  }
}
