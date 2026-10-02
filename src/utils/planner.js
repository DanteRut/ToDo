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

export function computeChainTimes(steps, startTime) {
  let [h, m] = startTime.split(':').map(Number)
  let cursor = h * 60 + m
  return steps.map(step => {
    const time = `${String(Math.floor(cursor / 60) % 24).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`
    cursor += Number(step.duration) || 0
    return { ...step, startTime: time }
  })
}

export function pluralize(number, forms) {
  const n = Math.abs(number) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}
