import { fromMinutes } from './dayPlan'

export const DAY_SCHEDULE_START = 6 * 60
export const DAY_SCHEDULE_END = 24 * 60
export const DAY_SCHEDULE_SNAP = 15

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
