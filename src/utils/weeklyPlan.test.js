import { describe, expect, it } from 'vitest'
import { REST_ACTIVITIES, hasScheduleConflict, isWakePlanComplete, timeToMinute } from './weeklyPlan'

describe('weekly wake and rest planning', () => {
  it('provides the requested rest choices with distinct numeric shortcuts', () => {
    expect(REST_ACTIVITIES.map(activity => activity.shortcut)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(REST_ACTIVITIES.map(activity => activity.title)).toEqual([
      'Прогулка',
      'Дневной сон',
      'Массаж',
      'Дыхание Вим Хофа',
      'Просмотр бильярда',
      'Горячий душ',
      'Игра на гитаре'
    ])
  })

  it('parses 24-hour times and rejects invalid values', () => {
    expect(timeToMinute('00:00')).toBe(0)
    expect(timeToMinute('23:45')).toBe(1425)
    expect(timeToMinute('24:00')).toBe(1440)
    expect(timeToMinute('24:15')).toBeNull()
    expect(timeToMinute('7:30')).toBeNull()
  })

  it('rejects rest blocks that overlap lessons or extend past midnight, but allows touching boundaries', () => {
    const classes = [{ startTime: '10:05', endTime: '11:25' }]

    expect(hasScheduleConflict('10:30', 30, classes)).toBe(true)
    expect(hasScheduleConflict('11:25', 45, classes)).toBe(false)
    expect(hasScheduleConflict('23:30', 45)).toBe(true)
  })

  it('checks conflicts with timed events and existing rest blocks', () => {
    const events = [
      { startTime: '09:15', duration: 50 },
      { startTime: '14:00', duration: 45 },
      { startTime: '16:00', endTime: '17:00' }
    ]

    expect(hasScheduleConflict('09:50', 15, events)).toBe(true)
    expect(hasScheduleConflict('14:30', 30, events)).toBe(true)
    expect(hasScheduleConflict('15:00', 30, events)).toBe(false)
    expect(hasScheduleConflict('15:45', 30, events)).toBe(true)
  })

  it('requires a wake-up time on all seven days before a week can be fixed', () => {
    const days = Array.from({ length: 7 }, (_, index) => ({ key: `2026-10-${String(index + 5).padStart(2, '0')}` }))
    const wakeTimes = Object.fromEntries(days.map(day => [day.key, '07:00']))

    expect(isWakePlanComplete(days, wakeTimes)).toBe(true)
    delete wakeTimes[days[3].key]
    expect(isWakePlanComplete(days, wakeTimes)).toBe(false)
    expect(isWakePlanComplete(days.slice(0, 5), wakeTimes)).toBe(false)
  })
})
