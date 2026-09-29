import { describe, expect, it } from 'vitest'
import { buildDayTimeline, dayCapacity, freeWindows, layoutOverlaps } from './dayPlan'

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

  it('assigns separate lanes to overlapping events', () => {
    const items = layoutOverlaps([{ id: 'a', start: 600, end: 660 }, { id: 'b', start: 620, end: 680 }])
    expect(items.map(item => item.lane)).toEqual([0, 1])
    expect(items.every(item => item.lanes === 2)).toBe(true)
  })
})
