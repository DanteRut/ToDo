import { describe, expect, it } from 'vitest'
import {
  normalizeSupplementMeals,
  setSupplementPlanned,
  setSupplementTaken,
  supplementIntakeProgress,
  SUPPLEMENT_MEALS
} from './supplementPlan'

describe('daily supplement meal planning', () => {
  it('provides the three meal slots and normalizes malformed or duplicate entries', () => {
    expect(SUPPLEMENT_MEALS.map(meal => meal.id)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(normalizeSupplementMeals({ breakfast: { plannedIds: ['mg', 'mg', null], takenIds: ['mg', 'orphan'] } })).toEqual({
      breakfast: { plannedIds: ['mg'], takenIds: ['mg', 'orphan'] },
      lunch: { plannedIds: [], takenIds: [] },
      dinner: { plannedIds: [], takenIds: [] }
    })
  })

  it('keeps the actual intake mark when a meal is later unscheduled', () => {
    const planned = setSupplementPlanned(null, 'breakfast', 'magnesium', true)
    const taken = setSupplementTaken({ meals: planned }, 'breakfast', 'magnesium', true)

    expect(taken.breakfast).toEqual({ plannedIds: ['magnesium'], takenIds: ['magnesium'] })
    expect(setSupplementPlanned({ meals: taken }, 'breakfast', 'magnesium', false).breakfast).toEqual({ plannedIds: [], takenIds: ['magnesium'] })
  })

  it('records actual intake independently from a meal plan', () => {
    const breakfast = setSupplementTaken(null, 'breakfast', 'vitamin-d', true)
    const dinner = setSupplementPlanned({ meals: breakfast }, 'dinner', 'magnesium', true)
    const record = { meals: setSupplementTaken({ meals: dinner }, 'dinner', 'magnesium', false) }

    expect(record.meals.breakfast).toEqual({ plannedIds: [], takenIds: ['vitamin-d'] })
    expect(supplementIntakeProgress(record)).toEqual({ planned: 1, taken: 1, completedPlanned: 0, percent: 0 })
  })
})
