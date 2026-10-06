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
    status: ['someday', 'waiting'].includes(task.status) || !task.status ? 'planned' : task.status,
    startTime: ''
  }
}

export function closeChainMembers(tasks, chainId, template = null) {
  const members = tasks.filter(task => task.chainId === chainId && !task.deleted)
  const templatePreparations = Array.isArray(template?.preparations) ? template.preparations : []
  const templatePreparationIds = new Set(templatePreparations.map(step => step.id).filter(Boolean))
  const discardedPreparationIds = []
  const releasedTasks = []

  for (const task of members) {
    const matchesTemplateStep = task.templatePreparationId
      ? templatePreparationIds.has(task.templatePreparationId)
      : templatePreparations.some(step => step.title === task.title
        && (Number(step.duration) || 5) === (Number(task.duration) || 5))
    if (task.stage === 'prepare' && template && matchesTemplateStep) {
      discardedPreparationIds.push(task.id)
      continue
    }

    const wasArchived = task.status === 'archived'
    releasedTasks.push({
      ...task,
      releasedFromChainIds: [...new Set([...(task.releasedFromChainIds || []), chainId].filter(Boolean))],
      chainId: null,
      ...(wasArchived ? { status: task.done ? 'completed' : 'planned', archivedAt: null } : {})
    })
  }

  return { discardedPreparationIds, releasedTasks }
}
