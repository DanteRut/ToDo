export const SUPPLEMENT_MEALS = Object.freeze([
  { id: 'breakfast', label: 'Завтрак' },
  { id: 'lunch', label: 'Обед' },
  { id: 'dinner', label: 'Ужин' }
])

function uniqueIds(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id.length > 0))]
}

export function normalizeSupplementMeals(meals = {}) {
  return Object.fromEntries(SUPPLEMENT_MEALS.map(({ id }) => {
    const meal = meals?.[id] || {}
    return [id, {
      plannedIds: uniqueIds(meal.plannedIds),
      takenIds: uniqueIds(meal.takenIds)
    }]
  }))
}

export function setSupplementPlanned(record, mealId, supplementId, planned) {
  if (!SUPPLEMENT_MEALS.some(meal => meal.id === mealId) || !supplementId) return normalizeSupplementMeals(record?.meals)
  const meals = normalizeSupplementMeals(record?.meals)
  const current = meals[mealId]
  const plannedIds = new Set(current.plannedIds)

  if (planned) plannedIds.add(supplementId)
  else plannedIds.delete(supplementId)

  return {
    ...meals,
    [mealId]: { ...current, plannedIds: [...plannedIds] }
  }
}

export function setSupplementTaken(record, mealId, supplementId, taken) {
  if (!SUPPLEMENT_MEALS.some(meal => meal.id === mealId) || !supplementId) return normalizeSupplementMeals(record?.meals)
  const meals = normalizeSupplementMeals(record?.meals)
  const current = meals[mealId]
  const takenIds = new Set(current.takenIds)

  if (taken) takenIds.add(supplementId)
  else takenIds.delete(supplementId)

  return {
    ...meals,
    [mealId]: { ...current, takenIds: [...takenIds] }
  }
}

export function supplementIntakeProgress(record) {
  const meals = normalizeSupplementMeals(record?.meals)
  const planned = SUPPLEMENT_MEALS.reduce((sum, meal) => sum + meals[meal.id].plannedIds.length, 0)
  const taken = SUPPLEMENT_MEALS.reduce((sum, meal) => sum + meals[meal.id].takenIds.length, 0)
  const completedPlanned = SUPPLEMENT_MEALS.reduce((sum, meal) => {
    const mealPlan = meals[meal.id]
    const takenIds = new Set(mealPlan.takenIds)
    return sum + mealPlan.plannedIds.filter(id => takenIds.has(id)).length
  }, 0)
  return { planned, taken, completedPlanned, percent: planned ? Math.round(completedPlanned / planned * 100) : 0 }
}
