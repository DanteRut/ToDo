export const DAY_MODES = [
  { id: 'focus', label: 'Фокус', shortLabel: 'Фокус', description: 'Интенсивная работа без развлечений', color: '#ef4444' },
  { id: 'main', label: 'Главное', shortLabel: 'Главное', description: 'Обязательно выполнить главное', color: '#f59e0b' },
  { id: 'normal', label: 'Обычный', shortLabel: 'Обычный', description: 'Обычный день', color: '#22c55e' },
  { id: 'rest', label: 'Отдых', shortLabel: 'Отдых', description: 'Можно ничего не делать', color: '#f4f4f5' }
]

const dayModeIds = new Set(DAY_MODES.map(mode => mode.id))

export function normalizeDayMode(mode) {
  return dayModeIds.has(mode) ? mode : 'normal'
}

export function dayModeForDate(dateKey, dailyReview, weeklyPlan) {
  if (dayModeIds.has(weeklyPlan?.dayModes?.[dateKey])) return weeklyPlan.dayModes[dateKey]
  if (dailyReview?.date === dateKey && dayModeIds.has(dailyReview.dayMode)) return dailyReview.dayMode
  return 'normal'
}

export function withWeeklyDayMode(plan, dateKey, mode) {
  const dayModes = { ...(plan?.dayModes || {}) }
  dayModes[dateKey] = normalizeDayMode(mode)
  return { dayModes }
}
