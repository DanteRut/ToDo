import { addDays, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { dayCapacity } from './dayPlan'
import { habitsForDate, habitValueForDate } from './dateContext'

const isWithin = (dateKey, startKey, endKey) => typeof dateKey === 'string' && dateKey >= startKey && dateKey <= endKey
const isExcluded = record => ['cancelled', 'archived', 'someday', 'waiting'].includes(record.status)

export function buildStudyWeekSummary({ weekStart, tasks = [], homeworks = [], habits = [], classesForDate = () => [] }) {
  const start = typeof weekStart === 'string' ? parseISO(weekStart) : weekStart
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const startKey = format(days[0], 'yyyy-MM-dd')
  const endKey = format(days.at(-1), 'yyyy-MM-dd')
  const weekTasks = tasks.filter(task => !isExcluded(task) && isWithin(task.date, startKey, endKey))
  const weekHomework = homeworks.filter(item => isWithin(item.dueDate, startKey, endKey))
  const weekDeadlines = tasks.filter(task => !['cancelled', 'archived'].includes(task.status) && task.deadlineKind && isWithin(task.dueDate, startKey, endKey))
  const mappedHomeworkTaskIds = new Set(weekHomework.map(item => item.sourceTaskId).filter(Boolean))
  const dueItems = [
    ...weekHomework.map(record => ({
      key: `homework:${record.id}`,
      kind: 'homework',
      kindLabel: 'ДЗ',
      title: record.title,
      detail: record.subject || record.lessonKind || 'Домашнее задание',
      dateKey: record.dueDate,
      done: Boolean(record.done),
      record
    })),
    ...weekDeadlines.filter(task => !mappedHomeworkTaskIds.has(task.id)).map(record => ({
      key: `task:${record.id}`,
      kind: 'task',
      kindLabel: record.deadlineKind,
      title: record.title,
      detail: record.projectId ? 'Учебный проект' : 'Контрольная точка',
      dateKey: record.dueDate,
      done: Boolean(record.done),
      record
    }))
  ].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.title.localeCompare(b.title, 'ru'))

  const daySummaries = days.map(date => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const lessons = classesForDate(dateKey)
    const dateTasks = tasks.filter(task => task.date === dateKey && !isExcluded(task))
    const dueHomeworks = weekHomework.filter(item => item.dueDate === dateKey)
    const deadlines = weekDeadlines.filter(task => task.dueDate === dateKey)
    const base = dayCapacity(dateTasks, lessons, 50)
    const manualHomeworkMinutes = homeworks
      .filter(item => !item.sourceTaskId && !item.done && ((item.plannedDates || []).includes(dateKey) || item.dueDate === dateKey))
      .reduce((sum, item) => sum + (Number(item.estimatedMinutes) || 45), 0)
    const scheduledHabits = habitsForDate(habits, dateKey)
    const ritualsDone = scheduledHabits.filter(habit => habitValueForDate(habit, dateKey) >= (Number(habit.target) || 1)).length
    const ritualMinutes = scheduledHabits
      .filter(habit => habitValueForDate(habit, dateKey) < (Number(habit.target) || 1))
      .reduce((sum, habit) => sum + (Number(habit.timerMinutes) || 0), 0)
    const plannedMinutes = base.planned + manualHomeworkMinutes + ritualMinutes

    return {
      key: dateKey,
      weekday: format(date, 'EEEE', { locale: ru }),
      dateLabel: format(date, 'd MMM', { locale: ru }),
      classCount: lessons.length,
      homeworkCount: dueHomeworks.length,
      openHomeworkCount: dueHomeworks.filter(item => !item.done).length,
      deadlineCount: deadlines.filter(task => !task.done).length,
      taskCount: dateTasks.length,
      completedTaskCount: dateTasks.filter(task => task.done).length,
      ritualsDone,
      ritualsTotal: scheduledHabits.length,
      plannedMinutes,
      availableMinutes: base.available,
      overload: plannedMinutes > base.available,
      loadPercent: Math.min(100, Math.round((plannedMinutes / base.available) * 100))
    }
  })

  const ritualTotals = daySummaries.reduce((totals, day) => ({
    done: totals.done + day.ritualsDone,
    total: totals.total + day.ritualsTotal
  }), { done: 0, total: 0 })

  return {
    startKey,
    endKey,
    rangeLabel: `${format(days[0], 'd MMMM', { locale: ru })} — ${format(days.at(-1), 'd MMMM yyyy', { locale: ru })}`,
    days: daySummaries,
    classCount: daySummaries.reduce((sum, day) => sum + day.classCount, 0),
    openHomeworkCount: weekHomework.filter(item => !item.done).length,
    homeworkCount: weekHomework.length,
    deadlineCount: weekDeadlines.filter(task => !task.done).length,
    taskCount: weekTasks.length,
    completedTaskCount: weekTasks.filter(task => task.done).length,
    ritualsDone: ritualTotals.done,
    ritualsTotal: ritualTotals.total,
    dueItems
  }
}
