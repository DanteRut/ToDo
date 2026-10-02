import { isValid, parseISO } from 'date-fns'

export function deadlineTone(kind) {
  const normalized = String(kind || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
  if (normalized === 'зачет' || normalized === 'экзамен') return 'exam'
  if (normalized === 'защита') return 'defense'
  return 'other'
}

export function deadlineDateKey(task) {
  const dueDate = String(task?.dueDate || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && isValid(parseISO(dueDate)) ? dueDate : ''
}

export function compareDeadlines(a, b) {
  const aDate = deadlineDateKey(a) || '9999-12-31'
  const bDate = deadlineDateKey(b) || '9999-12-31'
  return aDate.localeCompare(bDate) || String(a.title || '').localeCompare(String(b.title || ''), 'ru')
}
