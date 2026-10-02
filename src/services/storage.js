import Dexie from 'dexie'
import { reactive, computed } from 'vue'
import { format, addDays } from 'date-fns'
import { expiredChainTasks, releaseAsFreeOverdueTask } from '../utils/taskLifecycle'

export const db = new Dexie('momentum-personal-os')
db.version(1).stores({ records: 'id, type, date, updatedAt, dirty, deleted' })
db.version(2).stores({ records: 'id, type, date, updatedAt, dirty, deleted', backups: '++id, createdAt' })

const isoDay = (date = new Date()) => format(date, 'yyyy-MM-dd')
export const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
export const toPlainRecord = record => JSON.parse(JSON.stringify(record))
const nonActionTaskStages = new Set(['prepare', 'finish'])

const builtInHabits = [
  { seedKey: 'seed-habit-plank', kind: 'trackable', title: 'Планка ЛФК', subtitle: 'Поясница · 3 минуты', icon: 'activity', color: '#60a5fa', timerMinutes: 3, target: 1, order: 1 },
  { seedKey: 'seed-habit-mass-shake', kind: 'trackable', title: 'Коктейль массы', subtitle: '700 ккал', icon: 'cup-soda', color: '#f59e0b', target: 1, order: 2 },
  { seedKey: 'seed-habit-water', kind: 'trackable', title: 'Вода 2.5 л', subtitle: '5 × 500 мл', icon: 'droplets', color: '#06b6d4', target: 5, order: 3 },
  { seedKey: 'seed-habit-pulse', kind: 'intention', title: 'Пульс под контролем', subtitle: '< 155 уд/мин', icon: 'heart-pulse', color: '#f43f5e', target: 1, order: 4 },
  { seedKey: 'seed-habit-no-snacks', kind: 'intention', title: 'Не перекусывать', subtitle: 'Питание только по плану', icon: 'activity', color: '#a78bfa', target: 1, order: 5 }
]

function builtInHabitFor(record) {
  if (record.type !== 'habit') return null
  if (record.seedKey) return builtInHabits.find(habit => habit.seedKey === record.seedKey) || null
  return builtInHabits.find(habit => record.title === habit.title && record.subtitle === habit.subtitle
    && (!record.kind || record.kind === habit.kind)
    && (!record.icon || record.icon === habit.icon)
    && (record.target == null || Number(record.target) === habit.target)) || null
}

const seed = () => {
  const today = isoDay()
  const tomorrow = isoDay(addDays(new Date(), 1))
  const chainWork = uid()
  const chainGym = uid()
  const workoutId = uid()
  return [
    { id: chainWork, type: 'chain', title: 'Глубокая работа', icon: 'briefcase', color: '#8b5cf6', date: today, startTime: '09:30', note: 'Главный результат дня', order: 1 },
    { id: uid(), type: 'task', chainId: chainWork, title: 'Фокус-блок: главный проект', stage: 'action', date: today, startTime: '09:30', duration: 90, priority: 'high', done: false, order: 1 },
    { id: chainGym, type: 'chain', title: 'Тренировка · День 1', icon: 'dumbbell', color: '#22c55e', date: today, startTime: '18:30', workoutId, order: 2 },
    { id: uid(), type: 'task', chainId: chainGym, title: 'Спина (ширина) + бицепс', stage: 'action', date: today, startTime: '18:30', duration: 75, priority: 'high', done: false, order: 1 },
    { id: uid(), type: 'task', title: 'Разобрать входящие за 15 минут', stage: 'action', date: tomorrow, startTime: '10:00', duration: 15, priority: 'medium', done: false, order: 1 },
    ...builtInHabits.map(habit => ({ ...habit, id: uid(), type: 'habit', history: {} })),
    { id: workoutId, type: 'workout', title: 'Спина + бицепс', day: 1, color: '#8b5cf6', exercises: [
      { id: uid(), title: 'Подтягивания с весом', sets: 4, reps: '6–8', rest: 180 },
      { id: uid(), title: 'Тяга верхнего блока', sets: 3, reps: '10–12', rest: 150 },
      { id: uid(), title: 'Сгибание рук с EZ-грифом', sets: 4, reps: '8–10', rest: 90 }
    ]},
    { id: uid(), type: 'workout', title: 'Грудь + трицепс + икры', day: 2, color: '#f97316', exercises: [
      { id: uid(), title: 'Отжимания на брусьях с весом', sets: 4, reps: '6–8', rest: 180 },
      { id: uid(), title: 'Жим гантелей лёжа', sets: 4, reps: '8–10', rest: 150 },
      { id: uid(), title: 'Подъёмы на носки стоя', sets: 5, reps: '8–12', rest: 90 }
    ]},
    { id: uid(), type: 'workout', title: 'Осанка + плечи + предплечья', day: 3, color: '#06b6d4', exercises: [
      { id: uid(), title: 'Тяга штанги в наклоне', sets: 4, reps: '6–8', rest: 180 },
      { id: uid(), title: 'Face pull', sets: 3, reps: '12–15', rest: 90 },
      { id: uid(), title: 'Махи гантелей в стороны', sets: 4, reps: '12–15', rest: 90 }
    ]},
    { id: uid(), type: 'workout', title: 'Ноги + икры + пресс', day: 4, color: '#22c55e', exercises: [
      { id: uid(), title: 'Болгарские выпады', sets: 4, reps: '8–10', rest: 180 },
      { id: uid(), title: 'Гоблет-присед', sets: 4, reps: '10–12', rest: 150 },
      { id: uid(), title: 'Подъёмы ног в висе', sets: 3, reps: '10–15', rest: 90 }
    ]}
  ].map(r => ({ ...r, updatedAt: now(), dirty: 1, deleted: 0 }))
}

const state = reactive({ records: [], ready: false, syncing: false, syncLabel: 'Локально', selectedDate: isoDay() })

async function reload() {
  state.records = await db.records.filter(r => !r.deleted).toArray()
  state.ready = true
}

export const store = {
  state,
  today: isoDay,
  tasks: computed(() => state.records.filter(r => r.type === 'task' && r.status !== 'archived')),
  chains: computed(() => state.records.filter(r => r.type === 'chain' && r.status !== 'archived')),
  chainTemplates: computed(() => state.records.filter(r => r.type === 'chainTemplate').sort((a,b) => (a.order || 0) - (b.order || 0))),
  habits: computed(() => state.records.filter(r => r.type === 'habit').sort((a,b) => a.order-b.order)),
  async deduplicateBuiltInHabits() {
    const records = await db.records.where('type').equals('habit').toArray()
    const groups = new Map()
    for (const record of records) {
      const definition = builtInHabitFor(record)
      if (!definition) continue
      const group = groups.get(definition.seedKey) || []
      group.push(record)
      groups.set(definition.seedKey, group)
    }

    const timestamp = now()
    const writes = []
    for (const definition of builtInHabits) {
      const group = groups.get(definition.seedKey) || []
      const active = group.filter(record => !record.deleted)
      const intentionalDelete = group.find(record => record.deleted && !record.duplicateOf)

      if (intentionalDelete) {
        for (const record of active) writes.push({
          ...record,
          seedKey: definition.seedKey,
          duplicateOf: intentionalDelete.id,
          updatedAt: timestamp,
          dirty: 1,
          deleted: 1
        })
        continue
      }
      if (!active.length) continue

      const needsMigration = active.length > 1 || active.some(record => record.seedKey !== definition.seedKey)
      if (!needsMigration) continue

      const canonical = active.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]
      const latest = active.reduce((current, record) => {
        const currentTime = Date.parse(current.updatedAt || '') || 0
        const recordTime = Date.parse(record.updatedAt || '') || 0
        return recordTime > currentTime ? record : current
      }, active[0])
      const history = {}
      for (const record of active) {
        for (const [date, value] of Object.entries(record.history || {})) {
          history[date] = Math.max(history[date] || 0, Number(value) || 0)
        }
      }

      writes.push({ ...latest, id: canonical.id, seedKey: definition.seedKey, history, updatedAt: timestamp, dirty: 1, deleted: 0 })
      for (const record of active) {
        if (record.id !== canonical.id) writes.push({ ...record, seedKey: definition.seedKey, duplicateOf: canonical.id, updatedAt: timestamp, dirty: 1, deleted: 1 })
      }
    }

    if (!writes.length) return 0
    await this.createBackup('Перед объединением повторов')
    await db.records.bulkPut(writes)
    await reload()
    return writes.length
  },
  async releaseExpiredChainTasks(today) {
    let released = 0
    await db.transaction('rw', db.records, async () => {
      const tasks = await db.records.where('type').equals('task').toArray()
      const expired = expiredChainTasks(tasks.filter(task => !task.deleted && task.status !== 'archived'), today)
      if (!expired.length) return
      const timestamp = now()
      await db.records.bulkPut(expired.map(task => ({
        ...releaseAsFreeOverdueTask(task),
        updatedAt: timestamp,
        dirty: 1,
        deleted: 0
      })))
      released = expired.length
    })
    if (released) {
      await reload()
      try { localStorage.setItem('momentum.localTouched', '1') } catch { /* IndexedDB changes still remain local and visible. */ }
    }
    return released
  },
  async removeLegacyChainStages() {
    const [tasks, templates] = await Promise.all([
      db.records.where('type').equals('task').toArray(),
      db.records.where('type').equals('chainTemplate').toArray()
    ])
    const legacyTasks = tasks.filter(record => nonActionTaskStages.has(record.stage))
    const legacyTemplates = templates.filter(record => Object.prototype.hasOwnProperty.call(record, 'preparations'))
    if (!legacyTasks.length && !legacyTemplates.length) return { tasks: 0, templates: 0 }

    try { await this.createBackup('Перед отключением подготовок и завершений') } catch { /* Do not block cleanup if backups are unavailable. */ }
    const timestamp = now()
    const writes = [
      ...legacyTasks.map(record => ({ id: record.id, type: 'task', updatedAt: timestamp, dirty: 1, deleted: 1 })),
      ...legacyTemplates.map(record => {
        const { preparations: _preparations, ...cleanTemplate } = record
        return { ...cleanTemplate, updatedAt: timestamp, dirty: 1 }
      })
    ]
    await db.transaction('rw', db.records, async () => { await db.records.bulkPut(writes) })
    try { localStorage.setItem('momentum.localTouched', '1') } catch { /* Cleanup remains valid if local storage is unavailable. */ }
    await reload()
    return { tasks: legacyTasks.length, templates: legacyTemplates.length }
  },
  workouts: computed(() => state.records.filter(r => r.type === 'workout').sort((a,b) => a.day-b.day)),
  homeworks: computed(() => state.records.filter(r => r.type === 'homework').sort((a,b) => (a.dueDate || '').localeCompare(b.dueDate || ''))),
  inbox: computed(() => state.records.filter(r => r.type === 'inbox').sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''))),
  projects: computed(() => state.records.filter(r => r.type === 'project' && r.status !== 'archived').sort((a,b) => (a.order || 0) - (b.order || 0))),
  measurements: computed(() => state.records.filter(r => r.type === 'measurement').sort((a,b) => (b.date || '').localeCompare(a.date || ''))),
  timeEntries: computed(() => state.records.filter(r => r.type === 'timeEntry').sort((a,b) => (b.startedAt || '').localeCompare(a.startedAt || ''))),
  async init() {
    if (await db.records.count() === 0) await db.records.bulkPut(seed())
    const habits = await db.records.where('type').equals('habit').toArray()
    const migrated = habits.filter(h => !h.kind || (h.title.includes('Планка') && !h.timerMinutes)).map(h => ({ ...h, kind: h.kind || (h.title.toLowerCase().includes('пульс') ? 'intention' : 'trackable'), timerMinutes: h.timerMinutes || (h.title.includes('Планка') ? 3 : 0), updatedAt: now(), dirty: 1 }))
    if (migrated.length) await db.records.bulkPut(migrated)
    if (await db.records.where('type').equals('chainTemplate').count() === 0) {
      await db.records.bulkPut([
        { id: uid(), type: 'chainTemplate', title: 'Глубокая работа', color: '#8b5cf6', icon: 'briefcase', order: 1 },
        { id: uid(), type: 'chainTemplate', title: 'Учебный блок', color: '#06b6d4', icon: 'activity', order: 2 },
        { id: uid(), type: 'chainTemplate', title: 'Тренировка', color: '#22c55e', icon: 'dumbbell', order: 3 }
      ].map(record => ({...record, updatedAt:now(), dirty:1, deleted:0})))
    }
    await this.deduplicateBuiltInHabits()
    await this.removeLegacyChainStages()
    await reload()
    const backupDay = isoDay()
    try {
      if (localStorage.getItem('momentum.lastAutoBackup') !== backupDay) {
        await this.createBackup('Автоматическая копия')
        localStorage.setItem('momentum.lastAutoBackup', backupDay)
      }
    } catch { /* Storage can be restricted in private browsing; app data still works. */ }
  },
  async save(record, markDirty = true) {
    // Vue wraps nested form values in Proxy objects. IndexedDB cannot clone Proxies,
    // so every record is converted to a plain JSON document before persistence.
    const plain = toPlainRecord(record)
    if (plain.type === 'task' && !plain.deleted && nonActionTaskStages.has(plain.stage)) {
      const existing = plain.id ? await db.records.get(plain.id) : null
      if (existing && !existing.deleted) {
        await db.records.put({ id: existing.id, type: 'task', updatedAt: now(), dirty: markDirty ? 1 : 0, deleted: 1 })
        if (markDirty) localStorage.setItem('momentum.localTouched', '1')
        await reload()
      }
      return null
    }
    const next = { ...plain, updatedAt: now(), dirty: markDirty ? 1 : 0, deleted: plain.deleted || 0 }
    await db.records.put(next)
    if (markDirty) localStorage.setItem('momentum.localTouched', '1')
    await reload()
    return next
  },
  async add(record) {
    // Form models intentionally use id: null for unsaved entities. Generate the
    // key after spreading so a null placeholder can never overwrite the UUID.
    return this.save({ ...record, id: record.id || uid() })
  },
  async remove(id) {
    const record = await db.records.get(id)
    if (record) await this.save({ ...record, deleted: 1 })
  },
  async replaceAll(records) {
    await db.transaction('rw', db.records, async () => { await db.records.clear(); await db.records.bulkPut(records) })
    await this.removeLegacyChainStages()
    await reload()
  },
  async createBackup(label = 'Резервная копия') {
    const records = await db.records.toArray()
    const id = await db.backups.add({ createdAt: now(), label, records })
    const all = await db.backups.orderBy('createdAt').reverse().toArray()
    if (all.length > 7) await db.backups.bulkDelete(all.slice(7).map(item => item.id))
    return id
  },
  async listBackups() { return db.backups.orderBy('createdAt').reverse().toArray() },
  async restoreBackup(id) {
    const backup = await db.backups.get(id)
    if (!backup) throw new Error('Резервная копия не найдена')
    await db.transaction('rw', db.records, async () => { await db.records.clear(); await db.records.bulkPut(backup.records.map(record => ({ ...record, dirty: 1 }))) })
    await this.removeLegacyChainStages()
    await reload()
  },
  async allWithDeleted() { return db.records.toArray() },
  async reset() { db.close(); await Dexie.delete('momentum-personal-os'); localStorage.removeItem('momentum.localTouched') },
  async reload() { await reload() }
}
