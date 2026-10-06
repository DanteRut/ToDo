import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, isProxy } from 'vue'
import { db, store, toPlainRecord } from './storage'

describe('storage', () => {
  beforeAll(() => {
    const values = new Map()
    vi.stubGlobal('localStorage', { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null, removeItem: key => values.delete(key) })
  })

  beforeEach(async () => {
    await db.records.clear()
    await db.backups.clear()
    await store.reload()
  })

  it('removes nested Vue proxies from workout logs before IndexedDB persistence', () => {
    const workout = reactive({
      type: 'session',
      log: [{ exerciseId: 'pull-up', sets: [{ weight: '20', reps: '8', done: true }] }]
    })

    expect(isProxy(workout.log[0].sets[0])).toBe(true)
    const plain = toPlainRecord(workout)
    expect(isProxy(plain.log[0].sets[0])).toBe(false)
    expect(plain.log[0].sets[0]).toEqual({ weight: '20', reps: '8', done: true })
  })

  it('seeds chain preparations in both the day plan and reusable templates', async () => {
    await store.init()

    expect(store.tasks.value.some(task => task.stage === 'prepare')).toBe(true)
    expect(store.tasks.value.every(task => task.stage !== 'finish')).toBe(true)
    expect(store.chainTemplates.value.every(template => Array.isArray(template.preparations))).toBe(true)
    expect(store.chainTemplates.value.find(template => template.title === 'Глубокая работа').preparations.length).toBeGreaterThan(0)
  })

  it('keeps preparation tasks and template steps while soft-deleting legacy completion tasks', async () => {
    const updatedAt = '2026-09-30T10:00:00.000Z'
    const preparations = [{ id: 'prep', title: 'Prepare', duration: 5 }]
    await db.records.bulkPut([
      { id: 'legacy-prepare', type: 'task', title: 'Prepare', stage: 'prepare', date: '2026-09-30', updatedAt, dirty: 0, deleted: 0 },
      { id: 'legacy-finish', type: 'task', title: 'Finish', stage: 'finish', date: '2026-09-30', updatedAt, dirty: 0, deleted: 0 },
      { id: 'deleted-legacy', type: 'task', title: 'Old deleted step', stage: 'prepare', date: '2026-09-30', updatedAt, dirty: 0, deleted: 1 },
      { id: 'action-task', type: 'task', title: 'Action', stage: 'action', date: '2026-09-30', updatedAt, dirty: 0, deleted: 0 },
      { id: 'old-template', type: 'chainTemplate', title: 'Old template', preparations, updatedAt, dirty: 0, deleted: 0 }
    ])

    await store.init()
    const records = await db.records.toArray()

    expect(records.find(record => record.id === 'legacy-prepare')).toMatchObject({ id: 'legacy-prepare', type: 'task', title: 'Prepare', stage: 'prepare', deleted: 0 })
    expect(records.find(record => record.id === 'legacy-finish')).toMatchObject({ id: 'legacy-finish', type: 'task', deleted: 1, dirty: 1 })
    expect(records.find(record => record.id === 'deleted-legacy')).toMatchObject({ deleted: 1, stage: 'prepare', title: 'Old deleted step' })
    expect(store.tasks.value.map(task => task.id)).toEqual(expect.arrayContaining(['legacy-prepare', 'action-task']))
    expect(records.find(record => record.id === 'old-template').preparations).toEqual(preparations)
    expect(await db.backups.count()).toBeGreaterThan(0)
    const backups = await store.listBackups()
    expect(backups.some(backup => backup.records.some(record => record.id === 'legacy-prepare' && record.stage === 'prepare'))).toBe(true)
  })

  it('does not overwrite custom preparation steps while initializing templates', async () => {
    const preparations = [{ id: 'custom-step', title: 'My preparation', duration: 17 }]
    await db.records.put({
      id: 'custom-template',
      type: 'chainTemplate',
      title: 'My chain',
      preparations,
      updatedAt: '2026-10-01T10:00:00.000Z',
      dirty: 0,
      deleted: 0
    })

    await store.init()

    expect(await db.records.get('custom-template')).toMatchObject({ preparations })
  })

  it('restores default preparation steps on built-in templates from the previous migration', async () => {
    const updatedAt = '2026-10-01T10:00:00.000Z'
    await db.records.put({ id: 'builtin-template', type: 'chainTemplate', title: 'Глубокая работа', color: '#8b5cf6', icon: 'briefcase', updatedAt, dirty: 1, deleted: 0 })

    await store.init()

    const template = await db.records.get('builtin-template')
    expect(template.preparations).toHaveLength(2)
    expect(template.preparations.map(step => step.title)).toEqual(['Подготовить рабочее место', 'Убрать отвлечения'])
  })

  it('restores preparations hidden by the previous local migration from its backup', async () => {
    const updatedAt = '2026-10-01T10:00:00.000Z'
    const preparations = [{ id: 'prep', title: 'Prepare', duration: 5 }]
    await db.backups.add({
      createdAt: updatedAt,
      label: 'Перед отключением подготовок и завершений',
      records: [
        { id: 'migrated-prepare', type: 'task', title: 'Recovered prepare', stage: 'prepare', date: '2026-10-01', updatedAt, deleted: 0 },
        { id: 'migrated-template', type: 'chainTemplate', title: 'Recovered template', preparations, updatedAt, deleted: 0 }
      ]
    })
    await db.records.bulkPut([
      { id: 'migrated-prepare', type: 'task', updatedAt, dirty: 1, deleted: 1 },
      { id: 'migrated-template', type: 'chainTemplate', title: 'Recovered template', updatedAt, dirty: 1, deleted: 0 }
    ])

    expect(await store.restoreLegacyPreparations()).toBe(2)
    expect(await db.records.get('migrated-prepare')).toMatchObject({ title: 'Recovered prepare', stage: 'prepare', deleted: 0, dirty: 1 })
    expect(await db.records.get('migrated-template')).toMatchObject({ preparations, deleted: 0, dirty: 1 })
  })

  it('releases expired unfinished chain tasks as free overdue actions', async () => {
    const updatedAt = '2026-09-30T10:00:00.000Z'
    const record = (id, changes = {}) => ({ id, type: 'task', chainId: 'chain-old', title: id, stage: 'action', date: '2026-09-30', startTime: '10:00', status: 'planned', done: false, updatedAt, dirty: 0, deleted: 0, ...changes })
    await db.records.bulkPut([
      { id: 'chain-old', type: 'chain', title: 'Expired chain', date: '2026-09-30', updatedAt, dirty: 0, deleted: 0 },
      { id: 'template-stays', type: 'chainTemplate', title: 'Keep template', preparations: [{ id: 'prep', title: 'Prepare', duration: 5 }], updatedAt, dirty: 0, deleted: 0 },
      record('expired'),
      record('waiting', { status: 'waiting' }),
      record('someday', { status: 'someday' }),
      record('preparation', { stage: 'prepare' }),
      record('today', { date: '2026-10-01' }),
      record('done', { done: true, status: 'completed' }),
      record('cancelled', { status: 'cancelled' }),
      record('free', { chainId: null })
    ])
    await store.reload()

    expect(await store.releaseExpiredChainTasks('2026-10-01')).toBe(4)
    for (const id of ['expired', 'waiting', 'someday']) {
      const task = await db.records.get(id)
      expect(task).toMatchObject({
        chainId: null,
        releasedFromChainIds: ['chain-old'],
        date: '2026-09-30',
        startTime: '',
        stage: 'action',
        status: 'planned',
        done: false
      })
    }
    expect(await db.records.get('preparation')).toMatchObject({
      chainId: null,
      releasedFromChainIds: ['chain-old'],
      date: '2026-09-30',
      startTime: '',
      stage: 'prepare',
      status: 'planned',
      done: false
    })
    for (const id of ['today', 'done', 'cancelled']) {
      expect(await db.records.get(id)).toMatchObject({ chainId: null, releasedFromChainIds: ['chain-old'] })
    }
    expect(await db.records.get('chain-old')).toMatchObject({ type: 'chain', deleted: 1, dirty: 1 })
    expect(store.chains.value).toHaveLength(0)
    expect((await db.records.get('template-stays')).preparations).toEqual([{ id: 'prep', title: 'Prepare', duration: 5 }])
    expect((await db.records.get('free')).chainId).toBeNull()
  })

  it('persists preparation tasks but prevents new completion-stage task records', async () => {
    const preparation = await store.add({ type: 'task', title: 'Prepare', stage: 'prepare', date: '2026-09-30' })
    expect(preparation).toMatchObject({ type: 'task', stage: 'prepare', deleted: 0 })
    expect(await db.records.get(preparation.id)).toMatchObject({ title: 'Prepare', stage: 'prepare', deleted: 0 })
    expect(await store.add({ type: 'task', title: 'Finish', stage: 'finish', date: '2026-09-30' })).toBeNull()
    expect((await db.records.where('type').equals('task').toArray())).toHaveLength(1)

    const action = await store.add({ type: 'task', title: 'Action', stage: 'action', date: '2026-09-30' })
    expect(await store.save({ ...action, stage: 'finish' })).toBeNull()
    expect(await db.records.get(action.id)).toMatchObject({ type: 'task', dirty: 1, deleted: 1 })
    expect(await db.records.get(action.id)).not.toHaveProperty('stage')
    expect(await db.records.get(action.id)).not.toHaveProperty('title')
  })

  it('creates and restores a local versioned backup', async () => {
    const task = await store.add({ type: 'task', title: 'Original', date: '2026-09-28', done: false })
    const backupId = await store.createBackup('Test snapshot')
    await store.save({ ...task, title: 'Changed' })
    await store.restoreBackup(backupId)
    expect((await db.records.get(task.id)).title).toBe('Original')
    expect(await store.listBackups()).toHaveLength(1)
  })

  it('merges duplicate copies of built-in habits while preserving history and custom habits', async () => {
    const duplicates = [
      {
        id: 'seed-copy-a', type: 'habit', kind: 'trackable', title: 'Планка ЛФК', subtitle: 'Поясница · 3 минуты',
        icon: 'activity', color: '#60a5fa', timerMinutes: 3, target: 1, order: 1,
        history: { '2026-09-28': 1 }, updatedAt: '2026-09-28T10:00:00.000Z', dirty: 0, deleted: 0
      },
      {
        id: 'seed-copy-b', type: 'habit', kind: 'trackable', title: 'Планка ЛФК', subtitle: 'Поясница · 3 минуты',
        icon: 'activity', color: '#60a5fa', timerMinutes: 3, target: 1, order: 1,
        history: { '2026-09-29': 1 }, updatedAt: '2026-09-29T10:00:00.000Z', dirty: 0, deleted: 0
      },
      {
        id: 'custom-plank', type: 'habit', kind: 'trackable', title: 'Планка ЛФК', subtitle: 'Перед тренировкой',
        icon: 'activity', target: 1, order: 6, history: {}, updatedAt: '2026-09-29T10:00:00.000Z', dirty: 0, deleted: 0
      }
    ]
    await db.records.bulkPut(duplicates)

    await store.deduplicateBuiltInHabits()

    const records = await db.records.toArray()
    const activePlankHabits = records.filter(record => record.type === 'habit' && record.title === 'Планка ЛФК' && !record.deleted)
    expect(activePlankHabits).toHaveLength(2)
    const builtIn = activePlankHabits.find(record => record.seedKey === 'seed-habit-plank')
    expect(builtIn.history).toEqual({ '2026-09-28': 1, '2026-09-29': 1 })
    expect(builtIn.id).toBe('seed-copy-a')
    expect(records.find(record => record.id === 'seed-copy-b')).toMatchObject({ deleted: 1, dirty: 1, duplicateOf: 'seed-copy-a' })
    expect(records.find(record => record.id === 'custom-plank')).toMatchObject({ deleted: 0, subtitle: 'Перед тренировкой' })
    expect((await store.listBackups())[0].records).toHaveLength(3)
  })

  it('keeps archived records stored while hiding them from active collections', async () => {
    const task = await store.add({ type: 'task', title: 'Archive me', date: '2026-09-30', done: true, status: 'completed' })
    await store.save({ ...task, status: 'archived' })
    expect(store.tasks.value).toHaveLength(0)
    expect(await db.records.get(task.id)).toMatchObject({ title: 'Archive me', status: 'archived' })
  })

  it('persists a homework record and exposes it through the reactive collection', async () => {
    const saved = await store.add({
      id: null, // New Vue forms use a null placeholder until persistence.
      type: 'homework',
      lessonId: 'monday-mobile',
      subject: 'Разработка мобильных приложений',
      title: 'Закончить лабораторную',
      dueDate: '2026-10-12',
      done: false
    })

    expect(saved.id).toBeTruthy()
    expect(store.homeworks.value).toHaveLength(1)
    expect(store.homeworks.value[0].title).toBe('Закончить лабораторную')
    expect(await db.records.get(saved.id)).toMatchObject({ type: 'homework', dueDate: '2026-10-12' })
  })
})
