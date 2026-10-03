export const REST_ACTIVITIES = [
  { id: 'walk', shortcut: '1', title: 'Прогулка', duration: 45 },
  { id: 'nap', shortcut: '2', title: 'Дневной сон', duration: 30 },
  { id: 'massage', shortcut: '3', title: 'Массаж', duration: 60 },
  { id: 'wim-hof', shortcut: '4', title: 'Дыхание Вим Хофа', duration: 15 },
  { id: 'billiards', shortcut: '5', title: 'Просмотр бильярда', duration: 45 },
  { id: 'hot-shower', shortcut: '6', title: 'Горячий душ', duration: 20 },
  { id: 'guitar', shortcut: '7', title: 'Игра на гитаре', duration: 45 },
]

export function timeToMinute(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null
  return hours * 60 + minutes
}

export function hasScheduleConflict(startTime, duration, events = []) {
  const start = timeToMinute(startTime)
  const length = Number(duration)
  if (start === null || start === 1440 || !Number.isFinite(length) || length <= 0 || start + length > 1440) return true

  return events.some(event => {
    const eventStart = timeToMinute(event.startTime)
    if (eventStart === null || eventStart === 1440) return false
    const eventEnd = event.endTime ? timeToMinute(event.endTime) : eventStart + (Number(event.duration) || 0)
    return eventEnd !== null && start < eventEnd && start + length > eventStart
  })
}

export function isWakePlanComplete(days, wakeTimes = {}) {
  return Array.isArray(days) && days.length === 7 && days.every(day => {
    const minute = timeToMinute(wakeTimes[day.key])
    return minute !== null && minute < 1440
  })
}
