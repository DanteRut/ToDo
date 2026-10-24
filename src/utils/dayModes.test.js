import { describe, expect, it } from 'vitest'
import { dayModeForDate, normalizeDayMode, withWeeklyDayMode } from './dayModes'

describe('day modes', () => {
  it('prefers an explicit weekly choice, then uses the morning choice for its date', () => {
    const weeklyPlan = { dayModes: { '2026-10-26': 'focus', '2026-10-27': 'rest' } }
    expect(dayModeForDate('2026-10-26', { date: '2026-10-26', dayMode: 'main' }, weeklyPlan)).toBe('focus')
    expect(dayModeForDate('2026-10-26', { date: '2026-10-26', dayMode: 'main' }, {})).toBe('main')
    expect(dayModeForDate('2026-10-27', null, weeklyPlan)).toBe('rest')
    expect(dayModeForDate('2026-10-28', null, weeklyPlan)).toBe('normal')
  })

  it('normalizes unknown values and updates only the selected weekly date', () => {
    expect(normalizeDayMode('unknown')).toBe('normal')
    expect(withWeeklyDayMode({ dayModes: { '2026-10-26': 'focus' } }, '2026-10-27', 'rest')).toEqual({
      dayModes: { '2026-10-26': 'focus', '2026-10-27': 'rest' }
    })
  })
})
