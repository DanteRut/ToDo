import { describe, expect, it } from 'vitest'
import {
  DAY_SCHEDULE_END,
  DAY_SCHEDULE_START,
  scheduleTimeAfterVerticalDrag,
  scheduleTimeAtPosition
} from './daySchedule'

describe('full-day calendar placement', () => {
  it('maps the top and middle of the 06:00–24:00 timeline to local schedule times', () => {
    expect(scheduleTimeAtPosition(100, 100, 1080, 30)).toBe('06:00')
    expect(scheduleTimeAtPosition(640, 100, 1080, 30)).toBe('15:00')
  })

  it('snaps drops to 15-minute intervals', () => {
    expect(scheduleTimeAtPosition(233, 100, 1080, 30)).toBe('08:15')
  })

  it('changes time in discrete 15-minute steps while dragging vertically', () => {
    expect(scheduleTimeAfterVerticalDrag('09:00', 11)).toBe('09:00')
    expect(scheduleTimeAfterVerticalDrag('09:00', 12)).toBe('09:15')
    expect(scheduleTimeAfterVerticalDrag('09:00', 36)).toBe('09:45')
    expect(scheduleTimeAfterVerticalDrag('09:00', -12)).toBe('08:45')
  })

  it('clamps vertical dragging to the allowed schedule and chain bounds', () => {
    expect(scheduleTimeAfterVerticalDrag('23:30', 24, { duration: 30 })).toBe('23:30')
    expect(scheduleTimeAfterVerticalDrag('06:00', -24, { duration: 30 })).toBe('06:00')
    expect(scheduleTimeAfterVerticalDrag('10:00', 96, { duration: 30, minStart: 600, maxStart: 660 })).toBe('11:00')
  })

  it('keeps the full task inside the calendar at the bottom edge', () => {
    expect(scheduleTimeAtPosition(1180, 100, 1080, 30)).toBe('23:30')
    expect(scheduleTimeAtPosition(1180, 100, 1080, 120)).toBe('22:00')
  })

  it('clamps out-of-range pointers and handles invalid geometry safely', () => {
    expect(scheduleTimeAtPosition(-100, 100, 1080, 30)).toBe('06:00')
    expect(scheduleTimeAtPosition(2000, 100, 1080, 30)).toBe('23:30')
    expect(scheduleTimeAtPosition(10, 0, 0, 30)).toBe('06:00')
    expect(DAY_SCHEDULE_START).toBe(360)
    expect(DAY_SCHEDULE_END).toBe(1440)
  })
})
