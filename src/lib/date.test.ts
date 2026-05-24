import { compareMonthKey, daysInMonth, shiftMonthKey } from './date'

describe('date helpers', () => {
  it('shifts month keys forward and backward', () => {
    expect(shiftMonthKey('2026-05', -1)).toBe('2026-04')
    expect(shiftMonthKey('2026-05', 1)).toBe('2026-06')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
  })

  it('compares month keys in chronological order', () => {
    expect(compareMonthKey('2026-05', '2026-05')).toBe(0)
    expect(compareMonthKey('2026-04', '2026-05')).toBeLessThan(0)
    expect(compareMonthKey('2027-01', '2026-12')).toBeGreaterThan(0)
  })

  it('returns correct month day count', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-05')).toBe(31)
  })
})
