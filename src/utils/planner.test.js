import { describe, expect, it } from 'vitest'
import { computeChainTimes, isBlocked, nextRecurringDate, smartNext } from './planner'

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
})
