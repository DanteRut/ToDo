const transientFields = ['useDate', 'useTime', 'instanceTitle', 'selectedTaskIds']

export function toSavedChainTemplate(template) {
  const record = {
    ...template,
    type: 'chainTemplate',
    title: String(template.title || '').trim(),
    preparations: (Array.isArray(template.preparations) ? template.preparations : [])
      .filter(step => String(step.title || '').trim())
      .map(step => ({
        ...step,
        title: String(step.title).trim(),
        duration: Number(step.duration) || 5
      }))
  }

  for (const field of transientFields) delete record[field]
  return record
}
