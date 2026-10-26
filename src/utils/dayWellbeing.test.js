import { describe, expect, it } from 'vitest'
import {
  calculateDayBalance,
  DEFAULT_DAY_BALANCE_TARGETS,
  normalizeDayBalanceTargets,
  sleepWindowMinutes
} from './dayWellbeing'

describe('day load and recovery planning', () => {
  it('calculates a sleep window across midnight and rejects missing or identical times', () => {
    expect(sleepWindowMinutes('23:00', '07:00')).toBe(480)
    expect(sleepWindowMinutes('00:30', '08:15')).toBe(465)
    expect(sleepWindowMinutes('08:00', '08:00')).toBeNull()
    expect(sleepWindowMinutes('', '07:00')).toBeNull()
  })

  it('uses editable default targets and clamps unsafe values', () => {
    expect(normalizeDayBalanceTargets()).toEqual(DEFAULT_DAY_BALANCE_TARGETS)
    expect(normalizeDayBalanceTargets({ sleepHours: 20, walkMinutes: -10, restMinutes: 0 })).toEqual({
      sleepHours: 12,
      walkMinutes: 0,
      restMinutes: 0
    })
  })

  it('keeps 360 minutes at 100 percent and shows a higher percentage above the target', () => {
    expect(calculateDayBalance({ loadMinutes: 360 }).loadPercent).toBe(100)
    expect(calculateDayBalance({ loadMinutes: 361 }).loadPercent).toBe(101)
  })

  it('shows a balanced plan when the load stays under six hours and recovery targets are met', () => {
    const result = calculateDayBalance({
      loadMinutes: 300,
      sleepMinutes: 480,
      walkMinutes: 30,
      restMinutes: 30
    })

    expect(result).toMatchObject({ loadPercent: 83, sleepPercent: 100, walkPercent: 100, restPercent: 100, recoveryPercent: 100, status: 'balanced' })
  })

  it('flags high load with little planned recovery without subtracting incomparable minutes', () => {
    const result = calculateDayBalance({ loadMinutes: 420, sleepMinutes: 240, walkMinutes: 0, restMinutes: 0 })

    expect(result).toMatchObject({ loadPercent: 117, recoveryPercent: 17, status: 'deficit' })
    expect(result.statusDescription).toContain('выше ориентира 6 ч')
  })

  it('omits disabled personal movement or rest targets from the recovery average', () => {
    const result = calculateDayBalance({
      loadMinutes: 180,
      sleepMinutes: 480,
      walkMinutes: 0,
      restMinutes: 0,
      targets: { sleepHours: 8, walkMinutes: 0, restMinutes: 0 }
    })

    expect(result.recoveryPercent).toBe(100)
    expect(result.walkPercent).toBeNull()
    expect(result.restPercent).toBeNull()
  })
})
