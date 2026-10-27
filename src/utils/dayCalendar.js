import { fromMinutes, layoutOverlaps } from './dayPlan'
import { DAY_SCHEDULE_END, DAY_SCHEDULE_START } from './daySchedule'
import { timeToMinute } from './weeklyPlan'

export const DAY_CALENDAR_HOUR_HEIGHT = 64
export const DAY_CALENDAR_MIN_EVENT_HEIGHT = 42
export const DAY_CALENDAR_MIN_EVENT_MINUTES = DAY_CALENDAR_MIN_EVENT_HEIGHT * 60 / DAY_CALENDAR_HOUR_HEIGHT

export function canReturnTaskToPool(task) {
  return Boolean(task && !task.chainId && !task.done && !['someday', 'waiting', 'cancelled', 'archived'].includes(task.status))
}

export function unscheduleTaskForPool(task) {
  if (!canReturnTaskToPool(task) || !task.startTime) return null
  return { ...task, startTime: '' }
}

function taskEventDuration(event) {
  const sourceDuration = Number(event?.source?.duration)
  if (Number.isFinite(sourceDuration) && sourceDuration > 0) return sourceDuration
  const duration = Number(event?.duration)
  if (Number.isFinite(duration) && duration > 0) return duration
  const elapsed = Number(event?.end) - Number(event?.start)
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 30
}

function compareTaskEvents(a, b) {
  const orderA = Number(a.source?.order)
  const orderB = Number(b.source?.order)
  if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) return orderA - orderB
  return a.start - b.start || a.end - b.end
}

function sameTaskId(a, b) {
  return a !== undefined && a !== null && b !== undefined && b !== null && a === b
}

export function layoutDayCalendarEvents(events = []) {
  const prepared = events
    .filter(event => Number.isFinite(event.start) && Number.isFinite(event.end) && event.end > DAY_SCHEDULE_START && event.start < DAY_SCHEDULE_END)
    .map(event => ({
      ...event,
      __dayCalendarActualEnd: event.end,
      end: Math.min(DAY_SCHEDULE_END, Math.max(event.end, event.start + DAY_CALENDAR_MIN_EVENT_MINUTES))
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  return layoutOverlaps(prepared).map(event => {
    const { __dayCalendarActualEnd, ...layout } = event
    return {
      ...layout,
      end: __dayCalendarActualEnd,
      layoutEnd: event.end,
      lanes: Math.max(3, event.lanes)
    }
  })
}

export function calendarTaskUnitsFromEvents(events = []) {
  const taskEvents = events.filter(event => event.type === 'task' && event.source?.id !== undefined && Number.isFinite(event.start) && Number.isFinite(event.end))
  const chains = new Map()
  const singles = []

  for (const event of taskEvents) {
    const chainId = event.source?.chainId
    if (chainId === undefined || chainId === null || chainId === '') {
      if (!event.source?.done) singles.push(event)
      continue
    }
    if (!chains.has(chainId)) chains.set(chainId, [])
    chains.get(chainId).push(event)
  }

  const units = singles.map(event => {
    const duration = taskEventDuration(event)
    return {
      id: `task:${event.source.id}`,
      taskIds: [event.source.id],
      start: event.start,
      end: event.start + duration,
      duration,
      title: event.title,
      event
    }
  })

  for (const [chainId, members] of chains) {
    if (!members.some(event => !event.source?.done)) continue
    const sorted = members.slice().sort(compareTaskEvents)
    const duration = sorted.reduce((sum, event) => sum + taskEventDuration(event), 0)
    const start = sorted[0].start
    units.push({
      id: `chain:${chainId}`,
      chainId,
      taskIds: sorted.map(event => event.source.id),
      start,
      end: start + duration,
      duration,
      title: sorted[0].chainTitle || sorted[0].title,
      events: sorted
    })
  }

  return units.sort((a, b) => a.start - b.start || a.end - b.end)
}

function unitContainsAny(unit, ids) {
  return (unit.taskIds || []).some(id => ids.has(id))
}

function overlapGroup(units, target, eligible) {
  const group = [target]
  let start = target.start
  let end = target.end
  let expanded = true

  while (expanded) {
    expanded = false
    for (const unit of eligible) {
      if (group.includes(unit)) continue
      if (unit.start < end && unit.end > start) {
        group.push(unit)
        start = Math.min(start, unit.start)
        end = Math.max(end, unit.end)
        expanded = true
      }
    }
  }

  return { group, start, end }
}

function insertionContext(units, targetTaskId, movingTaskIds = []) {
  const movingIds = movingTaskIds instanceof Set ? movingTaskIds : new Set(movingTaskIds || [])
  const target = units.find(unit => (unit.taskIds || []).some(id => sameTaskId(id, targetTaskId)))
  if (!target) return null
  if (unitContainsAny(target, movingIds)) return { target, sameUnit: true, group: [target], start: target.start, end: target.end, eligible: [] }

  const eligible = units.filter(unit => !unitContainsAny(unit, movingIds))
  return { target, sameUnit: false, eligible, ...overlapGroup(eligible, target, eligible) }
}

export function calendarInsertionAtPosition(units = [], targetTaskId, pointerMinute, movingTaskIds = []) {
  const context = insertionContext(units, targetTaskId, movingTaskIds)
  const position = pointerMinute === null || pointerMinute === undefined || pointerMinute === '' ? NaN : Number(pointerMinute)
  if (!context || context.sameUnit || !Number.isFinite(position)) return null

  const internalBoundaries = [...new Set(context.group.flatMap(unit => [unit.start, unit.end])
    .filter(minute => minute > context.start && minute < context.end))]
  const candidates = [
    { minute: context.start, mode: 'before', priority: 0 },
    ...internalBoundaries.map(minute => ({ minute, mode: 'between', priority: 1 })),
    { minute: context.end, mode: 'after', priority: 2 }
  ]
  const nearest = candidates.reduce((best, candidate) => {
    const distance = Math.abs(position - candidate.minute)
    return distance < best.distance || (distance === best.distance && candidate.priority > best.priority)
      ? { ...candidate, distance }
      : best
  }, { ...candidates[0], distance: Math.abs(position - candidates[0].minute) })

  return {
    targetTaskId,
    mode: nearest.mode,
    insertionMinute: nearest.minute,
    group: context.group,
    groupStart: context.start,
    groupEnd: context.end
  }
}

export function planCalendarInsertion(units = [], movingUnit, targetTaskId, mode = 'before', insertionMinute = null) {
  const movingIds = new Set(movingUnit?.taskIds || [])
  const normalizedMode = mode === 'after' ? 'after' : mode === 'between' ? 'between' : 'before'

  if (!movingUnit || !Number.isFinite(Number(movingUnit.duration)) || Number(movingUnit.duration) <= 0) {
    return { valid: false, reason: 'invalid-moving-task', target: null, mode: normalizedMode, shiftedUnits: [] }
  }
  const context = insertionContext(units, targetTaskId, movingIds)
  if (!context) return { valid: false, reason: 'target-not-found', target: null, mode: normalizedMode, shiftedUnits: [] }
  if (context.sameUnit) return { valid: false, reason: 'same-unit', target: context.target, mode: normalizedMode, shiftedUnits: [] }

  const requestedInsertionMinute = insertionMinute === null || insertionMinute === undefined || insertionMinute === '' ? NaN : Number(insertionMinute)
  if (normalizedMode === 'between' && !Number.isFinite(requestedInsertionMinute)) {
    return { valid: false, reason: 'invalid-insertion-position', target: context.target, group: context.group, mode: normalizedMode, shiftedUnits: [] }
  }
  const start = normalizedMode === 'after' ? context.end : normalizedMode === 'between' ? requestedInsertionMinute : context.start
  const shiftBy = Number(movingUnit.duration)
  const shiftedUnits = context.eligible.filter(unit => unit.start >= start)
  const taskFits = start >= DAY_SCHEDULE_START && start + shiftBy <= DAY_SCHEDULE_END
  const shiftedTasksFit = shiftedUnits.every(unit => unit.end + shiftBy <= DAY_SCHEDULE_END)

  return {
    valid: taskFits && shiftedTasksFit,
    reason: !taskFits ? 'moving-task-outside-day' : !shiftedTasksFit ? 'shifted-task-outside-day' : '',
    target: context.target,
    group: context.group,
    groupStart: context.start,
    groupEnd: context.end,
    mode: normalizedMode,
    insertionMinute: start,
    start,
    shiftBy,
    shiftedUnits
  }
}

function durationForTask(task, event) {
  const duration = Number(task?.duration) || taskEventDuration(event)
  return Math.max(1, duration)
}

function compareTaskRecords(a, b) {
  const orderA = Number(a.order)
  const orderB = Number(b.order)
  if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) return orderA - orderB
  return (timeToMinute(a.startTime) ?? 0) - (timeToMinute(b.startTime) ?? 0)
}

export function buildDayCalendarPreview(events = [], task, startTime, insertion = null, taskUnits = []) {
  const requestedStart = timeToMinute(startTime)
  if (!task || requestedStart === null) return null

  const suppliedTaskUnits = taskUnits.length ? taskUnits : calendarTaskUnitsFromEvents(events)
  const eventTaskUnits = suppliedTaskUnits.filter(unit => Number.isFinite(unit.start) && Number.isFinite(unit.end))
  const taskEvents = events.filter(event => event.type === 'task' && event.source?.id !== undefined)
  const sourceEvent = taskEvents.find(event => sameTaskId(event.source.id, task.id)) || null
  const movingUnit = suppliedTaskUnits.find(unit => (unit.taskIds || []).some(id => sameTaskId(id, task.id))) || null
  const isChain = task.chainId !== undefined && task.chainId !== null && task.chainId !== ''
  const memberRecords = isChain
    ? (movingUnit?.members?.length
        ? movingUnit.members.slice().sort(compareTaskRecords)
        : taskEvents.filter(event => event.source?.chainId === task.chainId).sort(compareTaskEvents).map(event => event.source))
    : []
  const movingEvents = isChain
    ? memberRecords.map(member => {
      const existing = taskEvents.find(event => sameTaskId(event.source.id, member.id))
      const start = Number.isFinite(existing?.start) ? existing.start : timeToMinute(member.startTime) ?? DAY_SCHEDULE_START
      const duration = Math.max(1, Number(member.duration) || taskEventDuration(existing))
      return {
        ...(existing || {}),
        id: existing?.id || `task:${member.id}`,
        type: 'task',
        title: existing?.title || member.title,
        start,
        end: start + duration,
        duration,
        source: member,
        chainTitle: existing?.chainTitle || movingUnit?.title || ''
      }
    })
    : sourceEvent ? [sourceEvent] : []
  const movingTaskIds = new Set(movingUnit?.taskIds || movingEvents.map(event => event.source.id))
  movingTaskIds.add(task.id)
  const movingOffset = isChain
    ? memberRecords.slice(0, Math.max(0, memberRecords.findIndex(member => sameTaskId(member.id, task.id))))
      .reduce((sum, member) => sum + (Number(member.duration) || 0), 0)
    : 0
  const fallbackChainDuration = memberRecords.reduce((sum, member) => sum + (Number(member.duration) || 0), 0)
  const movingDuration = isChain
    ? Math.max(1, Number(movingUnit?.duration) || fallbackChainDuration || durationForTask(task, sourceEvent))
    : durationForTask(task, sourceEvent)
  const movingScheduleUnit = {
    id: isChain ? `chain:${task.chainId}` : `task:${task.id}`,
    taskIds: [...movingTaskIds],
    duration: movingDuration
  }

  const proposedPlan = insertion?.targetTaskId !== undefined
    ? planCalendarInsertion(eventTaskUnits, movingScheduleUnit, insertion.targetTaskId, insertion.mode, insertion.insertionMinute)
    : null
  const useInsertion = Boolean(proposedPlan?.target && proposedPlan.reason !== 'same-unit')
  const insertionStart = useInsertion ? proposedPlan.start : null
  const movingStart = useInsertion ? insertionStart : requestedStart - movingOffset
  const valid = useInsertion
    ? proposedPlan.valid
    : movingStart >= DAY_SCHEDULE_START && movingStart + movingDuration <= DAY_SCHEDULE_END
  const normalizedInsertion = useInsertion
    ? { targetTaskId: insertion.targetTaskId, mode: proposedPlan.mode, insertionMinute: proposedPlan.insertionMinute, unitIds: eventTaskUnits.map(unit => unit.id) }
    : null
  const shiftedUnitIds = new Set(valid && useInsertion ? proposedPlan.shiftedUnits.map(unit => unit.id) : [])
  const unitForTaskId = new Map()
  for (const unit of eventTaskUnits) {
    for (const id of unit.taskIds || []) unitForTaskId.set(id, unit.id)
  }

  const projected = []
  for (const event of events) {
    if (event.type === 'task' && movingTaskIds.has(event.source?.id)) {
      projected.push({ ...event, preview: 'source' })
      continue
    }
    const unitId = event.type === 'task' ? unitForTaskId.get(event.source?.id) : null
    if (unitId && shiftedUnitIds.has(unitId)) {
      projected.push({
        ...event,
        start: event.start + proposedPlan.shiftBy,
        end: event.end + proposedPlan.shiftBy,
        preview: 'shifted'
      })
    } else projected.push(event)
  }

  const movingPreviews = movingEvents.length
    ? movingEvents.map((event, index) => {
      const duration = taskEventDuration(event)
      const offset = movingEvents.slice(0, index).reduce((sum, member) => sum + taskEventDuration(member), 0)
      return {
        ...event,
        id: `calendar-preview:${event.source.id}`,
        start: movingStart + offset,
        end: movingStart + offset + duration,
        preview: valid ? 'moving' : 'invalid'
      }
    })
    : [{
      ...(sourceEvent || {}),
      id: `calendar-preview:${task.id}`,
      type: 'task',
      title: task.title,
      start: movingStart,
      end: movingStart + movingDuration,
      duration: movingDuration,
      source: task,
      preview: valid ? 'moving' : 'invalid'
    }]

  return {
    events: layoutDayCalendarEvents([...projected, ...movingPreviews]),
    valid,
    reason: useInsertion ? proposedPlan.reason : valid ? '' : 'moving-task-outside-day',
    startTime: useInsertion ? fromMinutes(insertionStart) : startTime,
    insertion: normalizedInsertion,
    insertionStart,
    movingStart,
    movingDuration,
    shiftBy: useInsertion ? proposedPlan.shiftBy : 0,
    shiftedUnits: valid && useInsertion ? proposedPlan.shiftedUnits : [],
    targetTitle: useInsertion ? proposedPlan.target.title : '',
    insertionMode: useInsertion ? proposedPlan.mode : ''
  }
}
