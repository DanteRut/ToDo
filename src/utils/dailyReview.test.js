import { describe, expect, it } from 'vitest'
import { planEveningReviewSave, previousEveningMessage, ritualTaskDate } from './dailyReview'

describe('daily ritual handoff', () => {
  it('shows the previous day’s message in the next morning ritual, including across month boundaries', () => {
    const reviews = [
      { type: 'dailyReview', date: '2026-10-31', tomorrowMessage: '  Начни с главного.  ' },
      { type: 'dailyReview', date: '2026-11-01', tomorrowMessage: 'Это уже на завтра' }
    ]

    expect(previousEveningMessage(reviews, '2026-11-01')).toBe('Начни с главного.')
    expect(previousEveningMessage(reviews, '2026-11-02')).toBe('Это уже на завтра')
    expect(previousEveningMessage([{ type: 'dailyReview', date: '2026-10-31', tomorrowMessage: '  ', tomorrowFirst: 'Старое напутствие' }], '2026-11-01')).toBe('Старое напутствие')
    expect(previousEveningMessage([], '2026-11-01')).toBe('')
  })

  it('schedules tasks from the evening ritual for the following day', () => {
    expect(ritualTaskDate('2026-12-31', 'evening')).toBe('2027-01-01')
    expect(ritualTaskDate('2027-01-01', 'morning')).toBe('2027-01-01')
  })
})

describe('evening ritual date correction', () => {
  const fields = { type: 'dailyReview', date: '2026-10-02', eveningAt: '2026-10-03T00:30:00Z', lessons: 'Урок', tomorrowMessage: 'Начать' }

  it('adds the evening review to the chosen previous day when there is no source record', () => {
    expect(planEveningReviewSave([], null, fields)).toEqual([{ type: 'add', record: fields }])
  })

  it('keeps the next day’s morning review while moving its evening review back', () => {
    const source = { id: 'next-day', type: 'dailyReview', date: '2026-10-03', morningAt: '2026-10-03T08:00:00Z', mainResult: 'Экзамен', gratitude: 'Друзья', selectedSubtasks: ['task:1'], eveningAt: '2026-10-03T00:15:00Z', lessons: 'Старый урок', tomorrowMessage: 'Старое напутствие' }
    const operations = planEveningReviewSave([source], source, fields)

    expect(operations).toHaveLength(2)
    expect(operations[0]).toEqual({ type: 'add', record: fields })
    expect(operations[1]).toEqual({ type: 'save', record: {
      ...source,
      eveningAt: null,
      eveningScore: null,
      lessons: '',
      reflection: '',
      correction: '',
      intention: '',
      tomorrowMessage: '',
      tomorrowFirst: ''
    } })
    expect(operations[1].record).toMatchObject({ morningAt: source.morningAt, mainResult: source.mainResult, gratitude: source.gratitude, selectedSubtasks: source.selectedSubtasks })
  })

  it('moves a record in place when it contains no morning review and avoids creating a duplicate', () => {
    const source = { id: 'evening-only', type: 'dailyReview', date: '2026-10-03', eveningAt: '2026-10-03T00:15:00Z', lessons: 'Урок' }
    const operations = planEveningReviewSave([source], source, fields)

    expect(operations).toEqual([{ type: 'save', record: { ...source, ...fields } }])
  })

  it('merges into an existing previous-day record and removes an evening-only source', () => {
    const source = { id: 'source', type: 'dailyReview', date: '2026-10-03', eveningAt: '2026-10-03T00:15:00Z' }
    const target = { id: 'target', type: 'dailyReview', date: '2026-10-02', morningAt: '2026-10-02T08:00:00Z', mainResult: 'Главная задача' }
    const operations = planEveningReviewSave([source, target], source, fields)

    expect(operations).toEqual([
      { type: 'save', record: { ...target, ...fields } },
      { type: 'remove', id: source.id }
    ])
  })

  it('preserves morning data in both records when merging into a previous-day review', () => {
    const source = { id: 'source', type: 'dailyReview', date: '2026-10-03', morningAt: '2026-10-03T08:00:00Z', mainResult: 'Сегодняшний план', eveningAt: '2026-10-03T00:15:00Z' }
    const target = { id: 'target', type: 'dailyReview', date: '2026-10-02', morningAt: '2026-10-02T08:00:00Z', mainResult: 'Вчерашний план' }
    const operations = planEveningReviewSave([source, target], source, fields)

    expect(operations[0]).toEqual({ type: 'save', record: { ...target, ...fields } })
    expect(operations[1].type).toBe('save')
    expect(operations[1].record).toMatchObject({ morningAt: source.morningAt, mainResult: source.mainResult, eveningAt: null })
  })

  it('updates the selected day’s existing review without adding another record', () => {
    const source = { id: 'same-day', type: 'dailyReview', date: fields.date, morningAt: '2026-10-02T08:00:00Z', mainResult: 'План' }

    expect(planEveningReviewSave([source], source, fields)).toEqual([{ type: 'save', record: { ...source, ...fields } }])
  })
})
