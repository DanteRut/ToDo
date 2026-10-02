import { describe, expect, it } from 'vitest'
import { expiredChainTasks, releaseAsFreeOverdueTask } from './taskLifecycle'

describe('chain task lifecycle', () => {
  it('selects unfinished active tasks only after their chain date has passed', () => {
    const tasks = [
      { id: 'expired', chainId: 'chain-a', date: '2026-09-30', status: 'planned', done: false },
      { id: 'today', chainId: 'chain-a', date: '2026-10-01', status: 'planned', done: false },
      { id: 'waiting', chainId: 'chain-a', date: '2026-09-29', status: 'waiting', done: false },
      { id: 'someday', chainId: 'chain-a', date: '2026-09-28', status: 'someday', done: false },
      { id: 'future', chainId: 'chain-a', date: '2026-10-02', status: 'planned', done: false },
      { id: 'free', date: '2026-09-30', status: 'planned', done: false },
      { id: 'done', chainId: 'chain-a', date: '2026-09-30', status: 'completed', done: true },
      { id: 'cancelled', chainId: 'chain-a', date: '2026-09-30', status: 'cancelled', done: false },
      { id: 'archived', chainId: 'chain-a', date: '2026-09-30', status: 'archived', done: false },
      { id: 'legacy-prepare', chainId: 'chain-a', date: '2026-09-30', stage: 'prepare', done: false },
      { id: 'legacy-finish', chainId: 'chain-a', date: '2026-09-30', stage: 'finish', done: false },
      { id: 'invalid-date', chainId: 'chain-a', date: '2026-02-31', done: false }
    ]

    expect(expiredChainTasks(tasks, '2026-10-01').map(task => task.id)).toEqual(['expired', 'waiting', 'someday'])
    expect(expiredChainTasks(tasks, 'not-a-date')).toEqual([])
  })

  it('releases the task without changing its overdue date and restores plan-eligible status', () => {
    const task = {
      id: 'waiting-task',
      chainId: 'chain-a',
      releasedFromChainIds: ['chain-previous'],
      date: '2026-09-30',
      startTime: '11:20',
      stage: 'action',
      status: 'waiting',
      done: false
    }

    expect(releaseAsFreeOverdueTask(task)).toMatchObject({
      id: 'waiting-task',
      chainId: null,
      releasedFromChainIds: ['chain-previous', 'chain-a'],
      date: '2026-09-30',
      startTime: '',
      stage: 'action',
      status: 'planned',
      done: false
    })
    expect(task.chainId).toBe('chain-a')
  })
})
