export const toMinutes = value => {
  const [hours = 0, minutes = 0] = String(value || '00:00').split(':').map(Number)
  return hours * 60 + minutes
}

export const fromMinutes = value => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export function buildDayTimeline(tasks, classes, commuteMinutes = 50) {
  const items = [
    ...classes.map(lesson => ({ id: `class-${lesson.id}`, type: 'class', title: lesson.subject, start: toMinutes(lesson.start), end: toMinutes(lesson.end), source: lesson })),
    ...tasks.filter(task => task.startTime).map(task => ({ id: task.id, type: 'task', title: task.title, start: toMinutes(task.startTime), end: toMinutes(task.startTime) + (Number(task.duration) || 30), source: task }))
  ]
  if (classes.length) {
    const first = Math.min(...classes.map(lesson => toMinutes(lesson.start)))
    items.push({ id: 'commute-university', type: 'commute', title: 'Сборы и дорога до вуза', start: Math.max(0, first - commuteMinutes), end: first, duration: commuteMinutes })
  }
  return items.sort((a, b) => a.start - b.start || a.end - b.end)
}

export function dayCapacity(tasks, classes, commuteMinutes = 50, dayStart = 8 * 60, dayEnd = 22 * 60) {
  const available = dayEnd - dayStart
  const classMinutes = classes.reduce((sum, lesson) => sum + Math.max(0, toMinutes(lesson.end) - toMinutes(lesson.start)), 0)
  const taskMinutes = tasks.filter(task => !task.done).reduce((sum, task) => sum + (Number(task.duration) || 0), 0)
  const fixed = classMinutes + (classes.length ? commuteMinutes : 0)
  const planned = fixed + taskMinutes
  return { available, fixed, taskMinutes, planned, overload: Math.max(0, planned - available), free: Math.max(0, available - planned) }
}

export function freeWindows(items, dayStart = 8 * 60, dayEnd = 22 * 60) {
  const busy = items.map(item => ({ start: Math.max(dayStart, item.start), end: Math.min(dayEnd, item.end) })).filter(item => item.end > dayStart && item.start < dayEnd).sort((a, b) => a.start - b.start)
  const merged = []
  for (const item of busy) {
    const last = merged.at(-1)
    if (last && item.start <= last.end) last.end = Math.max(last.end, item.end)
    else merged.push({ ...item })
  }
  const windows = []
  let cursor = dayStart
  for (const item of merged) {
    if (item.start > cursor) windows.push({ start: cursor, end: item.start, duration: item.start - cursor })
    cursor = Math.max(cursor, item.end)
  }
  if (cursor < dayEnd) windows.push({ start: cursor, end: dayEnd, duration: dayEnd - cursor })
  return windows
}

export function layoutOverlaps(items) {
  const result = items.map(item => ({ ...item, lane: 0, lanes: 1, group: 0 }))
  let group = 0
  let groupEnd = -1
  let groupItems = []
  const finishGroup = () => {
    if (!groupItems.length) return
    const lanes = Math.max(...groupItems.map(item => item.lane)) + 1
    groupItems.forEach(item => { item.lanes = lanes })
    groupItems = []
  }
  for (const item of result) {
    if (item.start >= groupEnd) { finishGroup(); group += 1; groupEnd = item.end }
    else groupEnd = Math.max(groupEnd, item.end)
    item.group = group
    const occupied = new Set(groupItems.filter(other => other.end > item.start).map(other => other.lane))
    while (occupied.has(item.lane)) item.lane += 1
    groupItems.push(item)
  }
  finishGroup()
  return result
}
