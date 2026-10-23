import { addDays, format, getDay, parseISO } from 'date-fns'

export function isBlocked(task, allTasks) {
  if (!task.dependsOn?.length) return false
  const byId = new Map(allTasks.map(item => [item.id, item]))
  return task.dependsOn.some(id => !byId.get(id)?.done)
}

export function taskScore(task, allTasks, now = new Date()) {
  if (task.done || isBlocked(task, allTasks)) return -Infinity
  const today = format(now, 'yyyy-MM-dd')
  const minute = now.getHours() * 60 + now.getMinutes()
  const [h = 23, m = 59] = (task.startTime || '23:59').split(':').map(Number)
  const taskMinute = h * 60 + m
  let score = { high: 60, medium: 30, normal: 10 }[task.priority] || 10
  if (task.date < today) score += 120
  if (task.date === today) score += 50
  if (task.date === today && taskMinute <= minute) score += 45 - Math.min(40, Math.floor((minute - taskMinute) / 15))
  if (task.stage === 'prepare') score += 12
  if ((task.duration || 0) <= 15) score += 5
  return score
}

export function smartNext(tasks, now = new Date()) {
  return [...tasks].sort((a, b) => taskScore(b, tasks, now) - taskScore(a, tasks, now))[0] || null
}

export function nextRecurringDate(task) {
  if (!task.recurrence || task.recurrence === 'none') return null
  let date = parseISO(task.date)
  if (task.recurrence === 'daily') date = addDays(date, 1)
  if (task.recurrence === 'weekly') date = addDays(date, 7)
  if (task.recurrence === 'weekdays') {
    do date = addDays(date, 1); while ([0, 6].includes(getDay(date)))
  }
  return format(date, 'yyyy-MM-dd')
}

export function createRecurringOccurrence(task, date) {
  const copy = { ...task }
  delete copy.id
  delete copy.updatedAt
  delete copy.dirty
  delete copy.completedAt

  return {
    ...copy,
    chainId: null,
    date,
    done: false,
    status: 'planned',
    completedAt: null,
    seriesId: task.seriesId || task.id,
    subtasks: (task.subtasks || []).map(subtask => ({ ...subtask, done: false }))
  }
}

export function stopRecurringSeries(tasks, selectedTask) {
  if (!selectedTask?.id) return []
  const seriesId = selectedTask.seriesId || selectedTask.id

  return tasks
    .filter(task => task.id === seriesId || task.seriesId === seriesId)
    .filter(task => task.recurrence !== 'none'
      || (task.id !== selectedTask.id && !task.done && task.status !== 'cancelled'))
    .map(task => {
      const otherPending = task.id !== selectedTask.id && !task.done
      return {
        ...task,
        recurrence: 'none',
        ...(otherPending ? { status: 'cancelled', completedAt: null } : {})
      }
    })
}

export function computeChainTimes(steps, startTime) {
  let [h, m] = startTime.split(':').map(Number)
  let cursor = h * 60 + m
  return steps.map(step => {
    const time = `${String(Math.floor(cursor / 60) % 24).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`
    cursor += Number(step.duration) || 0
    return { ...step, startTime: time }
  })
}

export function currentTimeOfDay(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function buildChainSchedulePreview({ date, requested, duration, blocks = [] }) {
  const start = Number(requested)
  const length = Math.max(0, Number(duration) || 0)
  const validBlocks = blocks.filter(block => Number.isFinite(block.start) && Number.isFinite(block.end) && block.end > block.start)
  const conflicts = validBlocks.filter(block => start < block.end && start + length > block.start)
  let suggested = start
  let nextConflict
  while ((nextConflict = validBlocks.find(block => suggested < block.end && suggested + length > block.start))) {
    suggested = nextConflict.end
  }
  return {
    date,
    requested: start,
    duration: length,
    suggested,
    end: suggested + length,
    conflicts,
    classConflicts: conflicts.filter(block => block.type === 'class')
  }
}

export function chainScheduleStart(preview, useRequestedTime = false) {
  return useRequestedTime ? preview.requested : preview.suggested
}

export function pluralize(number, forms) {
  const n = Math.abs(number) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}
