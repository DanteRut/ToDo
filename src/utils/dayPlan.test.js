import { describe, expect, it } from 'vitest'
import { classAttendanceForDate } from './classAttendance'
import { buildDayTimeline, dayCapacity, focusLoadMinutes, focusLoadPercent, freeWindows, layoutOverlaps } from './dayPlan'

describe('day planning', () => {
  const classes = [{ id: 'one', subject: 'Тестирование', start: '10:05', end: '11:25' }]

  it('adds the configured 50 minute university preparation and commute block', () => {
    const timeline = buildDayTimeline([], classes, 50)
    expect(timeline[0]).toMatchObject({ type: 'commute', start: 555, end: 605, duration: 50 })
  })

  it('calculates load and free windows', () => {
    const capacity = dayCapacity([{ duration: 90, done: false }], classes, 50)
    expect(capacity.planned).toBe(220)
    expect(freeWindows(buildDayTimeline([], classes), 8 * 60, 12 * 60)).toEqual([
      { start: 480, end: 555, duration: 75 },
      { start: 685, end: 720, duration: 35 }
    ])
  })

  it('places the commute before the earliest attended class and keeps skipped classes visible without blocking time', () => {
    const dateKey = '2026-10-26'
    const scheduledClasses = [
      { id: 'later', subject: 'Поздняя пара', start: '11:00', end: '12:00' },
      { id: 'skipped', subject: 'Пропущенная пара', start: '09:00', end: '10:00' },
      { id: 'first-attended', subject: 'Первая посещаемая', start: '10:30', end: '11:00' }
    ]
    const attendedIds = new Set(classAttendanceForDate(dateKey, scheduledClasses, {
      [dateKey]: ['later', 'first-attended']
    }))
    const timeline = buildDayTimeline([], scheduledClasses.map(lesson => ({
      ...lesson,
      attending: attendedIds.has(lesson.id)
    })), 50)

    expect(timeline.find(item => item.type === 'commute')).toMatchObject({ start: 580, end: 630, duration: 50 })
    expect(timeline.find(item => item.id === 'class-skipped')).toMatchObject({ attending: false, blocksTime: false })
    expect(freeWindows(timeline, 8 * 60, 11 * 60)[0]).toEqual({ start: 480, end: 580, duration: 100 })
    expect(focusLoadMinutes({ classes: scheduledClasses.filter(lesson => attendedIds.has(lesson.id)) })).toBe(90)
  })

  it('does not add a commute when no classes are selected as attended', () => {
    const timeline = buildDayTimeline([], [
      { id: 'skipped', subject: 'Пропущенная пара', start: '09:00', end: '10:00', attending: false }
    ])
    expect(timeline.some(item => item.type === 'commute')).toBe(false)
    expect(timeline.find(item => item.id === 'class-skipped')).toBeDefined()
  })

  it('sums all tasks, attending classes, workouts, and unlinked homework for the focus load', () => {
    const minutes = focusLoadMinutes({
      tasks: [{ duration: 90, done: true }, { duration: 30, done: false }],
      classes: [{ start: '10:00', end: '11:30' }],
      workouts: [{ duration: 60 }],
      homework: [{ estimatedMinutes: 45 }, { sourceTaskId: 'task-1', estimatedMinutes: 90 }]
    })
    expect(minutes).toBe(315)
  })

  it('measures focus workload against six hours without capping values above 100 percent', () => {
    expect(focusLoadPercent(0)).toBe(0)
    expect(focusLoadPercent(360)).toBe(100)
    expect(focusLoadPercent(361)).toBe(101)
    expect(focusLoadPercent(420)).toBe(117)
  })

  it('assigns separate lanes to overlapping events', () => {
    const items = layoutOverlaps([{ id: 'a', start: 600, end: 660 }, { id: 'b', start: 620, end: 680 }])
    expect(items.map(item => item.lane)).toEqual([0, 1])
    expect(items.every(item => item.lanes === 2)).toBe(true)
  })
})
