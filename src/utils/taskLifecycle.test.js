import { describe, expect, it } from 'vitest'
import { closeChainMembers, expiredChainTasks, releaseAsFreeOverdueTask } from './taskLifecycle'

describe('chain task lifecycle', () => {
  it('selects unfinished actions and preparations only after their chain date has passed', () => {
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

    expect(expiredChainTasks(tasks, '2026-10-01').map(task => task.id)).toEqual(['expired', 'waiting', 'someday', 'legacy-prepare'])
    expect(expiredChainTasks(tasks, 'not-a-date')).toEqual([])
  })

  it('preserves the preparation stage when releasing an overdue task', () => {
    expect(releaseAsFreeOverdueTask({ id: 'prep', chainId: 'chain-a', stage: 'prepare', date: '2026-09-30' }))
      .toMatchObject({ id: 'prep', chainId: null, stage: 'prepare', date: '2026-09-30', startTime: '' })
  })

  it('closes a template-based chain without archiving reusable preparation steps', () => {
    const tasks = [
      { id: 'template-prep', chainId: 'template-chain', templatePreparationId: 'step-1', title: 'Get ready', duration: 5, stage: 'prepare', status: 'planned', done: false },
      { id: 'legacy-template-prep', chainId: 'template-chain', title: 'Read notes', duration: 10, stage: 'prepare', status: 'planned', done: false },
      { id: 'manual-prep', chainId: 'template-chain', title: 'Add a note', duration: 3, stage: 'prepare', status: 'planned', done: false },
      { id: 'action', chainId: 'template-chain', stage: 'action', status: 'planned', done: false },
      { id: 'archived-action', chainId: 'template-chain', stage: 'action', status: 'archived', done: false },
      { id: 'unrelated', chainId: 'another-chain', stage: 'action', status: 'planned', done: false }
    ]
    const template = {
      id: 'template-1',
      preparations: [
        { id: 'step-1', title: 'Get ready', duration: 5 },
        { id: 'step-2', title: 'Read notes', duration: 10 }
      ]
    }

    const result = closeChainMembers(tasks, 'template-chain', template)

    expect(result.discardedPreparationIds).toEqual(['template-prep', 'legacy-template-prep'])
    expect(result.releasedTasks).toEqual([
      {
        id: 'manual-prep',
        chainId: null,
        title: 'Add a note',
        duration: 3,
        stage: 'prepare',
        status: 'planned',
        done: false,
        releasedFromChainIds: ['template-chain']
      },
      {
        id: 'action',
        chainId: null,
        stage: 'action',
        status: 'planned',
        done: false,
        releasedFromChainIds: ['template-chain']
      },
      {
        id: 'archived-action',
        chainId: null,
        stage: 'action',
        status: 'planned',
        done: false,
        archivedAt: null,
        releasedFromChainIds: ['template-chain']
      }
    ])
    expect(tasks[0].chainId).toBe('template-chain')
    expect(template.preparations).toEqual([
      { id: 'step-1', title: 'Get ready', duration: 5 },
      { id: 'step-2', title: 'Read notes', duration: 10 }
    ])
  })

  it('keeps manually created preparation tasks as free tasks when there is no reusable template', () => {
    const result = closeChainMembers([
      { id: 'manual-prep', chainId: 'manual-chain', stage: 'prepare', status: 'planned', done: false }
    ], 'manual-chain')

    expect(result.discardedPreparationIds).toEqual([])
    expect(result.releasedTasks[0]).toMatchObject({
      id: 'manual-prep',
      chainId: null,
      stage: 'prepare',
      releasedFromChainIds: ['manual-chain']
    })
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
