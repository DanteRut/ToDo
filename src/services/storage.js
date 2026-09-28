import Dexie from 'dexie'
import { reactive, computed } from 'vue'
import { format, addDays } from 'date-fns'

export const db = new Dexie('momentum-personal-os')
db.version(1).stores({ records: 'id, type, date, updatedAt, dirty, deleted' })

const isoDay = (date = new Date()) => format(date, 'yyyy-MM-dd')
export const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const seed = () => {
  const today = isoDay()
  const tomorrow = isoDay(addDays(new Date(), 1))
  const chainWork = uid()
  const chainGym = uid()
  const workoutId = uid()
  return [
    { id: chainWork, type: 'chain', title: 'Глубокая работа', icon: 'briefcase', color: '#8b5cf6', date: today, startTime: '09:30', note: 'Главный результат дня', order: 1 },
    { id: uid(), type: 'task', chainId: chainWork, title: 'Приготовить чай и выпить витамины', stage: 'prepare', date: today, startTime: '09:20', duration: 10, priority: 'normal', done: false, order: 1 },
    { id: uid(), type: 'task', chainId: chainWork, title: 'Сформулировать один измеримый результат', stage: 'prepare', date: today, startTime: '09:30', duration: 10, priority: 'medium', done: false, order: 2 },
    { id: uid(), type: 'task', chainId: chainWork, title: 'Фокус-блок: главный проект', stage: 'action', date: today, startTime: '09:40', duration: 90, priority: 'high', done: false, order: 3 },
    { id: uid(), type: 'task', chainId: chainWork, title: 'Записать итог и следующий шаг', stage: 'finish', date: today, startTime: '11:10', duration: 10, priority: 'normal', done: false, order: 4 },
    { id: chainGym, type: 'chain', title: 'Тренировка · День 1', icon: 'dumbbell', color: '#22c55e', date: today, startTime: '18:30', workoutId, order: 2 },
    { id: uid(), type: 'task', chainId: chainGym, title: 'Свекольный порошок + креатин', stage: 'prepare', date: today, startTime: '17:45', duration: 5, priority: 'normal', done: false, order: 1 },
    { id: uid(), type: 'task', chainId: chainGym, title: 'Разминка и мобилизация плеч', stage: 'prepare', date: today, startTime: '18:20', duration: 10, priority: 'medium', done: false, order: 2 },
    { id: uid(), type: 'task', chainId: chainGym, title: 'Спина (ширина) + бицепс', stage: 'action', date: today, startTime: '18:30', duration: 75, priority: 'high', done: false, order: 3 },
    { id: uid(), type: 'task', title: 'Разобрать входящие за 15 минут', stage: 'action', date: tomorrow, startTime: '10:00', duration: 15, priority: 'medium', done: false, order: 1 },
    { id: uid(), type: 'habit', title: 'Планка ЛФК', subtitle: 'Поясница · 3 минуты', icon: 'activity', color: '#60a5fa', history: {}, target: 1, order: 1 },
    { id: uid(), type: 'habit', title: 'Коктейль массы', subtitle: '700 ккал', icon: 'cup-soda', color: '#f59e0b', history: {}, target: 1, order: 2 },
    { id: uid(), type: 'habit', title: 'Вода 2.5 л', subtitle: '5 × 500 мл', icon: 'droplets', color: '#06b6d4', history: {}, target: 5, order: 3 },
    { id: uid(), type: 'habit', title: 'Пульс под контролем', subtitle: '< 155 уд/мин', icon: 'heart-pulse', color: '#f43f5e', history: {}, target: 1, order: 4 },
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
  tasks: computed(() => state.records.filter(r => r.type === 'task')),
  chains: computed(() => state.records.filter(r => r.type === 'chain')),
  habits: computed(() => state.records.filter(r => r.type === 'habit').sort((a,b) => a.order-b.order)),
  workouts: computed(() => state.records.filter(r => r.type === 'workout').sort((a,b) => a.day-b.day)),
  async init() {
    if (await db.records.count() === 0) await db.records.bulkPut(seed())
    await reload()
  },
  async save(record, markDirty = true) {
    const next = { ...record, updatedAt: now(), dirty: markDirty ? 1 : 0, deleted: record.deleted || 0 }
    await db.records.put(next)
    if (markDirty) localStorage.setItem('momentum.localTouched', '1')
    await reload()
    return next
  },
  async add(record) { return this.save({ id: uid(), ...record }) },
  async remove(id) {
    const record = await db.records.get(id)
    if (record) await this.save({ ...record, deleted: 1 })
  },
  async replaceAll(records) {
    await db.transaction('rw', db.records, async () => { await db.records.clear(); await db.records.bulkPut(records) })
    await reload()
  },
  async allWithDeleted() { return db.records.toArray() },
  async reload() { await reload() }
}
