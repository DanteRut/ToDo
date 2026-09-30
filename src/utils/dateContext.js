import { parseISO } from 'date-fns'

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

export function tasksForDate(tasks, dateKey) {
  if (!dateKey) return []
  return tasks.filter(task => task.date === dateKey && !['someday', 'cancelled', 'archived'].includes(task.status))
}

export function habitsForDate(habits, dateKey) {
  if (!dateKey) return []
  const weekday = parseISO(dateKey).getDay()
  return habits.filter(habit => (habit.schedule || EVERY_DAY).includes(weekday))
}

export function habitValueForDate(habit, dateKey) {
  if (!habit || !dateKey) return 0
  const value = Number(habit.history?.[dateKey]) || 0
  return Math.max(0, value)
}

export function toggleHabitForDate(habit, dateKey) {
  if (!habit || !dateKey) return habit
  const history = { ...(habit.history || {}) }
  const target = Math.max(1, Number(habit.target) || 1)
  const current = habitValueForDate(habit, dateKey)
  history[dateKey] = current >= target ? 0 : current + 1
  return { ...habit, history }
}

export function homeworkForDate(homeworks, dateKey) {
  if (!dateKey) return { planned: [], backlog: [] }
  const planned = homeworks.filter(item => (item.plannedDates || []).includes(dateKey)
    || item.completedAt?.slice(0, 10) === dateKey)
  const backlog = homeworks.filter(item => !item.done && !(item.plannedDates || []).includes(dateKey))
  const sort = (a, b) => `${a.dueDate || ''}${a.subject || ''}`.localeCompare(`${b.dueDate || ''}${b.subject || ''}`)
  return { planned: planned.sort(sort), backlog: backlog.sort(sort) }
}
