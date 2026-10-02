import { addDays, format, parseISO } from 'date-fns'

export function ritualTaskDate(dateKey, mode) {
  const date = parseISO(dateKey)
  return format(mode === 'evening' ? addDays(date, 1) : date, 'yyyy-MM-dd')
}

export function previousEveningMessage(reviews, dateKey) {
  const yesterday = format(addDays(parseISO(dateKey), -1), 'yyyy-MM-dd')
  const review = reviews.find(record => record.type === 'dailyReview' && record.date === yesterday)
  return String(review?.tomorrowMessage || '').trim() || String(review?.tomorrowFirst || '').trim()
}
