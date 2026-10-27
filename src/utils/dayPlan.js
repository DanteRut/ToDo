export const toMinutes = value => {
  const [hours = 0, minutes = 0] = String(value || '00:00').split(':').map(Number)
  return hours * 60 + minutes
}

export const fromMinutes = value => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export const FOCUS_LOAD_TARGET_MINUTES = 6 * 60

export function focusLoadMinutes({ tasks = [], classes = [], workouts = [], homework = [] } = {}) {
  const taskMinutes = tasks.reduce((sum, task) => sum + (Number(task.duration) || 30), 0)
  const classMinutes = classes.reduce((sum, lesson) => sum + Math.max(0, toMinutes(lesson.end) - toMinutes(lesson.start)), 0)
  const workoutMinutes = workouts.reduce((sum, workout) => sum + (Number(workout.duration) || 60), 0)
  const homeworkMinutes = homework
    .filter(item => !item.sourceTaskId)
    .reduce((sum, item) => sum + (Number(item.estimatedMinutes) || 45), 0)
  return taskMinutes + classMinutes + workoutMinutes + homeworkMinutes
}

export function focusLoadPercent(minutes) {
  const percentage = Math.max(0, Number(minutes) || 0) / FOCUS_LOAD_TARGET_MINUTES * 100
  return percentage > 100 ? Math.ceil(percentage) : Math.round(percentage)
}

export function commuteWindowBeforeFirstClass(classes = [], commuteMinutes = 50) {
  const attendedStarts = (Array.isArray(classes) ? classes : [])
    .filter(lesson => lesson?.attending !== false)
    .map(lesson => toMinutes(lesson.start))
    .filter(Number.isFinite)
  if (!attendedStarts.length) return null

  const end = Math.min(...attendedStarts)
  const requestedDuration = Math.max(0, Number(commuteMinutes) || 0)
  const start = Math.max(0, end - requestedDuration)
  if (end <= start) return null
  return { start, end, duration: end - start }
}

export function buildDayTimeline(tasks = [], classes = [], commuteMinutes = 50) {
  const scheduledClasses = Array.isArray(classes) ? classes : []
  const commute = commuteWindowBeforeFirstClass(scheduledClasses, commuteMinutes)
  const items = [
    ...scheduledClasses.map(lesson => {
      const attending = lesson?.attending !== false
      return {
        id: `class-${lesson.id}`,
        type: 'class',
        title: lesson.subject,
        start: toMinutes(lesson.start),
        end: toMinutes(lesson.end),
        source: lesson,
        attending,
        blocksTime: attending
      }
    }),
    ...tasks.filter(task => task.startTime).map(task => ({ id: task.id, type: 'task', title: task.title, start: toMinutes(task.startTime), end: toMinutes(task.startTime) + (Number(task.duration) || 30), source: task }))
  ]
  if (commute) items.push({ id: 'commute-university', type: 'commute', title: 'Сборы и дорога до вуза', ...commute })
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
  const busy = items.filter(item => item.blocksTime !== false).map(item => ({ start: Math.max(dayStart, item.start), end: Math.min(dayEnd, item.end) })).filter(item => item.end > dayStart && item.start < dayEnd).sort((a, b) => a.start - b.start)
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
