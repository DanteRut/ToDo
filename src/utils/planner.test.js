import { describe, expect, it } from 'vitest'
import { buildChainSchedulePreview, chainScheduleStart, computeChainTimes, createRecurringOccurrence, currentTimeOfDay, isBlocked, nextRecurringDate, smartNext, stopRecurringSeries } from './planner'

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

  it('creates the next recurring occurrence as a fresh planned task', () => {
    const occurrence = createRecurringOccurrence({
      id: 'task-a',
      seriesId: 'series-a',
      title: 'Daily review',
      date: '2026-10-01',
      recurrence: 'daily',
      done: true,
      status: 'completed',
      completedAt: '2026-10-01T18:00:00.000Z',
      updatedAt: '2026-10-01T18:00:00.000Z',
      dirty: 1,
      subtasks: [{ id: 'subtask-a', title: 'Read notes', done: true }]
    }, '2026-10-02')

    expect(occurrence).toMatchObject({
      seriesId: 'series-a',
      date: '2026-10-02',
      recurrence: 'daily',
      done: false,
      status: 'planned',
      completedAt: null,
      chainId: null,
      subtasks: [{ id: 'subtask-a', title: 'Read notes', done: false }]
    })
    expect(occurrence).not.toHaveProperty('id')
    expect(occurrence).not.toHaveProperty('updatedAt')
    expect(occurrence).not.toHaveProperty('dirty')
  })

  it('stops a series and cancels other pending occurrences while preserving completed history', () => {
    const tasks = [
      { id: 'root', recurrence: 'daily', done: true, status: 'completed' },
      { id: 'current', seriesId: 'root', recurrence: 'daily', done: false, status: 'planned' },
      { id: 'older-pending', seriesId: 'root', recurrence: 'daily', done: false, status: 'planned' },
      { id: 'completed-copy', seriesId: 'root', recurrence: 'daily', done: true, status: 'completed' },
      { id: 'other-series', seriesId: 'other-series', recurrence: 'daily', done: false, status: 'planned' }
    ]

    const stopped = stopRecurringSeries(tasks, tasks[0])

    expect(stopped.map(task => task.id)).toEqual(['root', 'current', 'older-pending', 'completed-copy'])
    expect(stopped.find(task => task.id === 'root')).toMatchObject({ recurrence: 'none', done: true, status: 'completed' })
    expect(stopped.find(task => task.id === 'current')).toMatchObject({ recurrence: 'none', done: false, status: 'cancelled' })
    expect(stopped.find(task => task.id === 'older-pending')).toMatchObject({ recurrence: 'none', done: false, status: 'cancelled' })
    expect(stopped.find(task => task.id === 'completed-copy')).toMatchObject({ recurrence: 'none', done: true, status: 'completed' })
    expect(tasks.find(task => task.id === 'other-series').recurrence).toBe('daily')
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
