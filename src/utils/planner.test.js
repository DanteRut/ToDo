import { describe, expect, it } from 'vitest'
import { buildChainSchedulePreview, chainScheduleStart, computeChainTimes, currentTimeOfDay, isBlocked, nextRecurringDate, smartNext } from './planner'

describe('planner', () => {
  it('calculates every step time from durations', () => {
    expect(computeChainTimes([{ duration: 10 }, { duration: 25 }, { duration: 5 }], '09:20').map(s => s.startTime))
      .toEqual(['09:20', '09:30', '09:55'])
  })

  it('blocks a task until all dependencies are done', () => {
    const tasks = [{ id: 'a', done: true }, { id: 'b', done: false }, { id: 'c', dependsOn: ['a', 'b'] }]
    expect(isBlocked(tasks[2], tasks)).toBe(true)
    tasks[1].done = true
    expect(isBlocked(tasks[2], tasks)).toBe(false)
  })

  it('selects an overdue important task over a future task', () => {
    const tasks = [
      { id: 'a', title: 'future', date: '2026-10-01', priority: 'normal', done: false },
      { id: 'b', title: 'overdue', date: '2026-09-27', priority: 'high', done: false }
    ]
    expect(smartNext(tasks, new Date(2026, 8, 28, 12)).id).toBe('b')
  })

  it('creates the next weekday without landing on a weekend', () => {
    expect(nextRecurringDate({ date: '2026-10-02', recurrence: 'weekdays' })).toBe('2026-10-05')
  })

  it('shows schedule conflicts and lets the user keep the requested chain start', () => {
    const preview = buildChainSchedulePreview({
      date: '2026-10-13',
      requested: 600,
      duration: 60,
      blocks: [
        { title: 'Пара', type: 'class', start: 600, end: 660 },
        { title: 'Другая задача', type: 'task', start: 675, end: 700 }
      ]
    })

    expect(preview).toMatchObject({ requested: 600, suggested: 700, end: 760 })
    expect(preview.conflicts.map(block => block.title)).toEqual(['Пара'])
    expect(preview.classConflicts).toEqual([{ title: 'Пара', type: 'class', start: 600, end: 660 }])
    expect(chainScheduleStart(preview)).toBe(700)
    expect(chainScheduleStart(preview, true)).toBe(600)
  })

  it('defaults a new chain to the current local time of day', () => {
    expect(currentTimeOfDay(new Date(2026, 9, 13, 7, 4))).toBe('07:04')
  })
})
