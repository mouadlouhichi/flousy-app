/**
 * Format a YYYY-MM-DD (or ISO) date as a short label ("29 Aug").
 * Parsed locally so a date-only string never shifts by a UTC offset.
 */
export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
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
 * source with the given pay day.
 */
export function getSourcePeriod(
  monthKey: string,
  payDay?: number,
): { periodKey: string; startDate: string; endDate: string } | null {
  if (!payDay || payDay < 1 || payDay > 31) return null
  const [year, month] = monthKey.split('-').map(Number) // month is 1-based
  const startDay = Math.min(payDay, new Date(year, month, 0).getDate())
  const start = new Date(year, month - 1, startDay)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextStartDay = Math.min(payDay, new Date(nextYear, nextMonth, 0).getDate())
  const nextStart = new Date(nextYear, nextMonth - 1, nextStartDay)
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1)
  return {
    periodKey: monthKey,
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  }
}

/**
 * Resolve the active budget month key (YYYY-MM) for today's date, honouring a
 * configured monthly start date.
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
