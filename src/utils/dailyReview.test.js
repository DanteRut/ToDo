import { describe, expect, it } from 'vitest'
import { previousEveningMessage, ritualTaskDate } from './dailyReview'

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
