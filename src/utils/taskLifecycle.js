const nonReleasableStages = new Set(['finish'])
const nonActiveStatuses = new Set(['cancelled', 'archived', 'completed'])

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function expiredChainTasks(tasks, today) {
  if (!isValidDateKey(today)) return []
  return tasks.filter(task => task.chainId
    && !task.done
    && !nonActiveStatuses.has(task.status)
    && !nonReleasableStages.has(task.stage)
    && isValidDateKey(task.date)
    && task.date < today)
}

export function releaseAsFreeOverdueTask(task) {
  return {
    ...task,
    releasedFromChainIds: [...new Set([...(task.releasedFromChainIds || []), task.chainId].filter(Boolean))],
    chainId: null,
    stage: 'action',
    status: ['someday', 'waiting'].includes(task.status) || !task.status ? 'planned' : task.status,
    startTime: ''
  }
}
