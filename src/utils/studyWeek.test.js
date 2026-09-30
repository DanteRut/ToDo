import { describe, expect, it } from 'vitest'
import { parseISO } from 'date-fns'
import { buildStudyWeekSummary } from './studyWeek'

const MONDAY = '2026-10-05'
const TUESDAY = '2026-10-06'
const WEDNESDAY = '2026-10-07'
const FRIDAY = '2026-10-09'
const SATURDAY = '2026-10-10'

describe('study week summary', () => {
  it('summarizes classes, homework, deadlines, tasks, and rituals across all seven days', () => {
    const summary = buildStudyWeekSummary({
      weekStart: parseISO(MONDAY),
      tasks: [
        { id: 'done-task', title: 'Конспект', date: MONDAY, duration: 30, done: true, status: 'completed' },
        { id: 'exam', title: 'Подготовиться к экзамену', date: WEDNESDAY, dueDate: FRIDAY, duration: 60, done: false, status: 'planned', deadlineKind: 'Экзамен' },
        { id: 'someday', title: 'Когда-нибудь', date: MONDAY, done: false, status: 'someday' },
        { id: 'last-week', title: 'Старое', date: '2026-10-02', done: false, status: 'planned' }
      ],
      homeworks: [
        { id: 'manual-homework', title: 'Лабораторная №3', subject: 'Математика', dueDate: TUESDAY, done: false, plannedDates: [MONDAY], estimatedMinutes: 40 },
        { id: 'project-homework', title: 'Решить задачи 1–5', subject: 'Физика', dueDate: FRIDAY, done: false, plannedDates: [WEDNESDAY], sourceTaskId: 'project-task' },
        { id: 'weekend-homework', title: 'Повторить параграф', subject: 'История', dueDate: SATURDAY, done: false, plannedDates: [], estimatedMinutes: 35 },
        { id: 'last-week-homework', title: 'Уже сдано', subject: 'История', dueDate: '2026-10-02', done: true }
      ],
      habits: [
        { id: 'plank', title: 'Планка', target: 1, timerMinutes: 3, schedule: [1, 2], history: { [MONDAY]: 1 } }
      ],
      classesForDate: dateKey => dateKey === MONDAY
        ? [{ id: 'mon-class', start: '10:00', end: '11:20' }]
        : dateKey === FRIDAY
          ? [{ id: 'fri-class-1', start: '10:00', end: '11:20' }, { id: 'fri-class-2', start: '11:30', end: '12:50' }]
          : []
    })

    expect(summary).toMatchObject({
      startKey: MONDAY,
      endKey: '2026-10-11',
      classCount: 3,
      openHomeworkCount: 3,
      homeworkCount: 3,
      deadlineCount: 1,
      taskCount: 2,
      completedTaskCount: 1,
      ritualsDone: 1,
      ritualsTotal: 2
    })
    expect(summary.dueItems.map(item => item.title)).toEqual([
      'Лабораторная №3',
      'Подготовиться к экзамену',
      'Решить задачи 1–5',
      'Повторить параграф'
    ])
    expect(summary.days).toHaveLength(7)
    expect(summary.days[5]).toMatchObject({key:SATURDAY,homeworkCount:1,openHomeworkCount:1,plannedMinutes:35})
    expect(summary.days[0]).toMatchObject({
      key: MONDAY,
      classCount: 1,
      taskCount: 1,
      completedTaskCount: 1,
      ritualsDone: 1,
      ritualsTotal: 1,
      plannedMinutes: 170
    })
    expect(summary.days[1]).toMatchObject({
      key: TUESDAY,
      openHomeworkCount: 1,
      ritualsDone: 0,
      ritualsTotal: 1
    })
  })
})
