import { timeToMinute } from './weeklyPlan'
import { FOCUS_LOAD_TARGET_MINUTES } from './dayPlan'

export const DAY_LOAD_TARGET_MINUTES = FOCUS_LOAD_TARGET_MINUTES
export const DEFAULT_DAY_BALANCE_TARGETS = Object.freeze({
  sleepHours: 8,
  walkMinutes: 30,
  restMinutes: 30
})

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) return fallback
  return Math.max(minimum, Math.min(maximum, number))
}

export function normalizeDayBalanceTargets(targets = {}) {
  const source = targets && typeof targets === 'object' ? targets : {}
  return {
    sleepHours: boundedNumber(source.sleepHours, DEFAULT_DAY_BALANCE_TARGETS.sleepHours, 5, 12),
    walkMinutes: boundedNumber(source.walkMinutes, DEFAULT_DAY_BALANCE_TARGETS.walkMinutes, 0, 360),
    restMinutes: boundedNumber(source.restMinutes, DEFAULT_DAY_BALANCE_TARGETS.restMinutes, 0, 360)
  }
}

export function sleepWindowMinutes(bedTime, wakeTime) {
  const bedtime = timeToMinute(bedTime)
  const wake = timeToMinute(wakeTime)
  if (bedtime === null || wake === null) return null
  const duration = (wake - bedtime + 24 * 60) % (24 * 60)
  return duration > 0 ? duration : null
}

function coveragePercent(value, target) {
  if (target <= 0) return null
  if (value === null || value === undefined || value === '') return 0
  const minutes = Number(value)
  if (!Number.isFinite(minutes) || minutes < 0) return 0
  return Math.min(100, Math.round(minutes / target * 100))
}

export function calculateDayBalance({
  loadMinutes = 0,
  sleepMinutes = null,
  walkMinutes = 0,
  restMinutes = 0,
  targets = DEFAULT_DAY_BALANCE_TARGETS
} = {}) {
  const normalizedTargets = normalizeDayBalanceTargets(targets)
  const requestedLoadMinutes = Number(loadMinutes)
  const safeLoadMinutes = Number.isFinite(requestedLoadMinutes) ? Math.max(0, requestedLoadMinutes) : 0
  const sleepTargetMinutes = normalizedTargets.sleepHours * 60
  const loadPercentRaw = safeLoadMinutes / DAY_LOAD_TARGET_MINUTES * 100
  const loadPercent = loadPercentRaw > 100 ? Math.ceil(loadPercentRaw) : Math.round(loadPercentRaw)
  const sleepPercent = coveragePercent(sleepMinutes, sleepTargetMinutes)
  const walkPercent = coveragePercent(walkMinutes, normalizedTargets.walkMinutes)
  const restPercent = coveragePercent(restMinutes, normalizedTargets.restMinutes)
  const components = [sleepPercent, walkPercent, restPercent].filter(value => value !== null)
  const recoveryPercent = components.length
    ? Math.round(components.reduce((sum, value) => sum + value, 0) / components.length)
    : 0
  const missing = [
    sleepPercent !== null && sleepPercent < 100 ? 'сон' : '',
    walkPercent !== null && walkPercent < 100 ? 'движение' : '',
    restPercent !== null && restPercent < 100 ? 'отдых/перерыв' : ''
  ].filter(Boolean)
  const overLoad = safeLoadMinutes > DAY_LOAD_TARGET_MINUTES
  const allRecoveryGoalsMet = missing.length === 0

  let status = 'recovery-gap'
  let statusTitle = 'Добавь восстановление в план'
  let statusDescription = missing.length
    ? `До личных ориентиров пока не хватает: ${missing.join(', ')}.`
    : 'План восстановления заполнен; проверь, остаётся ли в дне свободный резерв.'

  if (overLoad && recoveryPercent < 60) {
    status = 'deficit'
    statusTitle = 'Нагрузка выше, цели восстановления не закрыты'
    statusDescription = `Нагрузка выше ориентира 6 ч, а восстановление запланировано лишь на ${recoveryPercent}% от личных целей.`
  } else if (overLoad) {
    status = 'high-load'
    statusTitle = 'Нагрузка выше дневного ориентира'
    statusDescription = 'Даже с запланированным отдыхом проверь, можно ли перенести необязательные дела или оставить больше свободного времени.'
  } else if (allRecoveryGoalsMet) {
    status = 'balanced'
    statusTitle = 'План выглядит сбалансированным'
    statusDescription = 'Нагрузка не выше ориентира 6 ч, а заданные цели сна, движения и отдыха учтены.'
  }

  return {
    loadMinutes: safeLoadMinutes,
    loadTargetMinutes: DAY_LOAD_TARGET_MINUTES,
    loadPercent,
    sleepTargetMinutes,
    sleepPercent,
    walkTargetMinutes: normalizedTargets.walkMinutes,
    walkPercent,
    restTargetMinutes: normalizedTargets.restMinutes,
    restPercent,
    recoveryPercent,
    missing,
    status,
    statusTitle,
    statusDescription
  }
}
