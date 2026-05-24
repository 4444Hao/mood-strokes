export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

export function formatCnDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${year} 年 ${month} 月 ${day} 日`
}

export function formatCnMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year} 年 ${month} 月`
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return toMonthKey(toDateKey(next))
}

export function compareMonthKey(a: string, b: string): number {
  const [aYear, aMonth] = a.split('-').map(Number)
  const [bYear, bMonth] = b.split('-').map(Number)
  if (aYear !== bYear) {
    return aYear - bYear
  }
  return aMonth - bMonth
}
