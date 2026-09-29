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

  it('creates and restores a local versioned backup', async () => {
    const task = await store.add({ type: 'task', title: 'Original', date: '2026-09-28', done: false })
    const backupId = await store.createBackup('Test snapshot')
    await store.save({ ...task, title: 'Changed' })
    await store.restoreBackup(backupId)
    expect((await db.records.get(task.id)).title).toBe('Original')
    expect(await store.listBackups()).toHaveLength(1)
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
