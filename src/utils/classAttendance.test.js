import { describe, expect, it } from 'vitest'
import { classAttendanceForDate, toggleClassAttendance, withClassAttendance } from './classAttendance'

const mondayClasses = [
  { id: 'pair-2', pair: 2 },
  { id: 'pair-3', pair: 3 },
  { id: 'pair-4', pair: 4 }
]

describe('class attendance', () => {
  it('assumes scheduled classes are attended until the user makes a choice', () => {
    expect(classAttendanceForDate('2026-10-26', mondayClasses, {})).toEqual(['pair-2', 'pair-3', 'pair-4'])
    expect(classAttendanceForDate('2026-10-26', [], {})).toEqual([])
  })

  it('keeps explicit empty choices and ignores duplicate or outdated lesson ids', () => {
    expect(classAttendanceForDate('2026-10-26', mondayClasses, {
      '2026-10-26': []
    })).toEqual([])
    expect(classAttendanceForDate('2026-10-26', mondayClasses, {
      '2026-10-26': ['pair-4', 'missing', 'pair-4', 'pair-2']
    })).toEqual(['pair-2', 'pair-4'])
  })

  it('toggles one scheduled class while preserving schedule order', () => {
    expect(toggleClassAttendance(mondayClasses, ['pair-2', 'pair-4'], 'pair-3')).toEqual(['pair-2', 'pair-3', 'pair-4'])
    expect(toggleClassAttendance(mondayClasses, ['pair-2', 'pair-3', 'pair-4'], 'pair-3')).toEqual(['pair-2', 'pair-4'])
    expect(toggleClassAttendance(mondayClasses, ['pair-2'], 'missing')).toEqual(['pair-2'])
  })

  it('updates the selected date and preserves other days in the weekly plan', () => {
    const plan = { classAttendance: { '2026-10-26': ['pair-2'], '2026-10-27': ['pair-5'] } }
    expect(withClassAttendance(plan, '2026-10-26', ['pair-4', 'missing', 'pair-4'], mondayClasses)).toEqual({
      classAttendance: {
        '2026-10-26': ['pair-4'],
        '2026-10-27': ['pair-5']
      }
    })
    expect(withClassAttendance(plan, '2026-10-26', [], mondayClasses).classAttendance['2026-10-26']).toEqual([])
  })
})
