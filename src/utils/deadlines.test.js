import { describe, expect, it } from 'vitest'
import { compareDeadlines, deadlineDateKey, deadlineTone } from './deadlines'

describe('deadline display', () => {
  it('assigns the requested color group to each control-point kind', () => {
    expect(deadlineTone('Зачёт')).toBe('exam')
    expect(deadlineTone('Зачет')).toBe('exam')
    expect(deadlineTone('Экзамен')).toBe('exam')
    expect(deadlineTone('Защита')).toBe('defense')
    expect(deadlineTone('Контрольная')).toBe('other')
    expect(deadlineTone('Лабораторная')).toBe('other')
  })

  it('uses and sorts by the actual due date, not the planned task date', () => {
    const tasks = [
      { id: 'later', title: 'Позже', date: '2026-01-05', dueDate: '2026-03-30' },
      { id: 'nearest', title: 'Ближе', date: '2026-12-01', dueDate: '2026-02-04' },
      { id: 'no-deadline', title: 'Без срока', date: '2026-01-01', dueDate: '' }
    ]

    expect(deadlineDateKey(tasks[0])).toBe('2026-03-30')
    expect(deadlineDateKey({ date: '2026-01-01', dueDate: '2026-02-30' })).toBe('')
    expect(tasks.sort(compareDeadlines).map(task => task.id)).toEqual(['nearest', 'later', 'no-deadline'])
  })
})
