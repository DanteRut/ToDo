import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { habitValueForDate, habitsForDate, homeworkForDate, tasksForDate, toggleHabitForDate } from './dateContext'

const MONDAY = '2026-10-05'
const TUESDAY = '2026-10-06'

describe('selected-day context', () => {
  it('keeps ritual checkmarks on the date they were marked', () => {
    const selectedDate = ref(MONDAY)
    let habit = { id: 'water', target: 3, history: {} }

    habit = toggleHabitForDate(habit, selectedDate.value)
    expect(habitValueForDate(habit, selectedDate.value)).toBe(1)

    selectedDate.value = TUESDAY
    expect(habitValueForDate(habit, selectedDate.value)).toBe(0)
    habit = toggleHabitForDate(habit, selectedDate.value)
    expect(habitValueForDate(habit, selectedDate.value)).toBe(1)

    selectedDate.value = MONDAY
    expect(habitValueForDate(habit, selectedDate.value)).toBe(1)
    habit = toggleHabitForDate(habit, selectedDate.value)
    expect(habitValueForDate(habit, selectedDate.value)).toBe(2)
    expect(habit.history).toEqual({ [MONDAY]: 2, [TUESDAY]: 1 })
  })

  it('shows only rituals scheduled for the selected weekday', () => {
    const habits = [
      { id: 'weekdays', schedule: [1, 2, 3, 4, 5] },
      { id: 'monday', schedule: [1] },
      { id: 'sunday', schedule: [0] },
      { id: 'every-day' }
    ]

    expect(habitsForDate(habits, MONDAY).map(habit => habit.id)).toEqual(['weekdays', 'monday', 'every-day'])
    expect(habitsForDate(habits, TUESDAY).map(habit => habit.id)).toEqual(['weekdays', 'every-day'])
  })

  it('filters day tasks independently for each selected date', () => {
    const tasks = [
      { id: 'mon', date: MONDAY, status: 'planned' },
      { id: 'tue', date: TUESDAY, status: 'planned' },
      { id: 'someday', date: MONDAY, status: 'someday' },
      { id: 'cancelled', date: MONDAY, status: 'cancelled' }
    ]

    expect(tasksForDate(tasks, MONDAY).map(task => task.id)).toEqual(['mon'])
    expect(tasksForDate(tasks, TUESDAY).map(task => task.id)).toEqual(['tue'])
  })

  it('keeps planned and completed homework attached to their own dates', () => {
    const homework = [
      { id: 'planned-mon', plannedDates: [MONDAY], dueDate: MONDAY, done: false },
      { id: 'planned-tue', plannedDates: [TUESDAY], dueDate: TUESDAY, done: false },
      { id: 'completed-tue', plannedDates: [], completedAt: `${TUESDAY}T14:00:00.000Z`, dueDate: TUESDAY, done: true }
    ]

    expect(homeworkForDate(homework, MONDAY).planned.map(item => item.id)).toEqual(['planned-mon'])
    expect(homeworkForDate(homework, TUESDAY).planned.map(item => item.id)).toEqual(['planned-tue', 'completed-tue'])
    expect(homeworkForDate(homework, MONDAY).backlog.map(item => item.id)).toEqual(['planned-tue'])
  })
})
