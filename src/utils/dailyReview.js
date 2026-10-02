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

function hasMorningReviewContent(record) {
  return Boolean(record?.morningAt || String(record?.mainResult || '').trim() || String(record?.gratitude || '').trim() || record?.selectedSubtasks?.length)
}

function clearEveningReview(record) {
  return { ...record, eveningAt: null, eveningScore: null, lessons: '', reflection: '', correction: '', intention: '', tomorrowMessage: '', tomorrowFirst: '' }
}

export function planEveningReviewSave(records, source, fields) {
  const existing = records.find(record => record.type === 'dailyReview' && record.date === fields.date && record.id !== source?.id)
  if (source?.date === fields.date) return [{ type: 'save', record: { ...source, ...fields } }]
  if (existing) {
    const operations = [{ type: 'save', record: { ...existing, ...fields } }]
    if (source) operations.push(hasMorningReviewContent(source) ? { type: 'save', record: clearEveningReview(source) } : { type: 'remove', id: source.id })
    return operations
  }
  if (source && hasMorningReviewContent(source)) return [
    { type: 'add', record: fields },
    { type: 'save', record: clearEveningReview(source) },
  ]
  if (source) return [{ type: 'save', record: { ...source, ...fields } }]
  return [{ type: 'add', record: fields }]
}
