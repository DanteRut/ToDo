import { fromMinutes } from './dayPlan'

export const DAY_SCHEDULE_START = 6 * 60
export const DAY_SCHEDULE_END = 24 * 60
export const DAY_SCHEDULE_SNAP = 15
export const DAY_SCHEDULE_DRAG_PIXELS_PER_STEP = 12

export function scheduleTimeAfterVerticalDrag(startTime, deltaY, {
  duration = 30,
  minStart = DAY_SCHEDULE_START,
  maxStart = DAY_SCHEDULE_END - duration,
  pixelsPerStep = DAY_SCHEDULE_DRAG_PIXELS_PER_STEP
} = {}) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(startTime || ''))
  const hours = match ? Number(match[1]) : NaN
  const minutes = match ? Number(match[2]) : NaN
  const parsedStart = Number.isInteger(hours) && hours < 24 && Number.isInteger(minutes) && minutes < 60
    ? hours * 60 + minutes
    : minStart
  const taskDuration = Math.max(1, Number(duration) || 30)
  const interval = DAY_SCHEDULE_SNAP
  const requestedMinimum = Number(minStart)
  const requestedMaximum = Number(maxStart)
  const minimum = Math.ceil(Math.max(DAY_SCHEDULE_START, Number.isFinite(requestedMinimum) ? requestedMinimum : DAY_SCHEDULE_START) / interval) * interval
  const maximum = Math.floor(Math.min(DAY_SCHEDULE_END - taskDuration, Number.isFinite(requestedMaximum) ? requestedMaximum : DAY_SCHEDULE_END - taskDuration) / interval) * interval
  const safeMaximum = Math.max(minimum, maximum)
  const start = Math.round(parsedStart / interval) * interval
  const requestedStepHeight = Number(pixelsPerStep)
  const stepHeight = Math.max(1, Number.isFinite(requestedStepHeight) ? requestedStepHeight : DAY_SCHEDULE_DRAG_PIXELS_PER_STEP)
  const requestedDelta = Number(deltaY)
  const steps = Math.trunc((Number.isFinite(requestedDelta) ? requestedDelta : 0) / stepHeight)
  const next = Math.max(minimum, Math.min(safeMaximum, start + steps * interval))

  return fromMinutes(next)
}

export function scheduleTimeAtPosition(clientY, top, height, duration = 30, snap = DAY_SCHEDULE_SNAP) {
  if (![clientY, top, height].every(Number.isFinite) || height <= 0) return fromMinutes(DAY_SCHEDULE_START)

  const progress = Math.max(0, Math.min(1, (clientY - top) / height))
  const requested = DAY_SCHEDULE_START + progress * (DAY_SCHEDULE_END - DAY_SCHEDULE_START)
  const interval = Math.max(1, Number(snap) || DAY_SCHEDULE_SNAP)
  const taskDuration = Math.max(1, Number(duration) || 30)
  const latestStart = Math.max(DAY_SCHEDULE_START, DAY_SCHEDULE_END - taskDuration)
  const snapped = Math.round(requested / interval) * interval
  const safeStart = Math.max(DAY_SCHEDULE_START, Math.min(snapped, Math.floor(latestStart / interval) * interval))

  return fromMinutes(safeStart)
}
