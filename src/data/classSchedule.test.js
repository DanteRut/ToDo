import { describe, expect, it } from 'vitest'
import { academicWeek, classesForDate } from './classSchedule'

describe('academic schedule', () => {
  it('uses 28 September 2026 as week one anchor', () => {
    expect(academicWeek('2026-09-28')).toBe(1)
    expect(academicWeek('2026-10-05')).toBe(2)
    expect(academicWeek('2026-10-12')).toBe(1)
  })

  it('returns only classes for the active alternating week', () => {
    const firstMonday = classesForDate('2026-09-28').map(item => item.pair)
    const secondMonday = classesForDate('2026-10-05').map(item => item.pair)
    expect(firstMonday).toEqual([2, 3, 4])
    expect(secondMonday).toEqual([4, 5])
  })

  it('does not show classes outside the semester', () => {
    expect(classesForDate('2027-01-05')).toEqual([])
  })
})
