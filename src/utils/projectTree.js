const compareProjectOrder = (a, b) => (a.order || 0) - (b.order || 0)

export function buildProjectTreeEntries(projects = []) {
  const ordered = [...projects].sort(compareProjectOrder)
  const projectIds = new Set(ordered.map(project => project.id))
  const result = []
  const seen = new Set()

  const append = (project, depth = 0) => {
    if (!project?.id || seen.has(project.id)) return
    seen.add(project.id)
    result.push({ project, depth })
    ordered
      .filter(child => child.parentProjectId === project.id)
      .forEach(child => append(child, depth + 1))
  }

  ordered
    .filter(project => !project.parentProjectId || !projectIds.has(project.parentProjectId))
    .forEach(project => append(project))
  ordered.forEach(project => append(project))

  return result
}

export function filterProjectTreeEntries(entries, projects, completedOnly = false) {
  const includedIds = new Set(projects
    .filter(project => project.status !== 'archived'
      && (completedOnly ? project.status === 'completed' : project.status !== 'completed'))
    .map(project => project.id))
  const projectsById = new Map(projects.map(project => [project.id, project]))

  return entries
    .filter(entry => includedIds.has(entry.project.id))
    .map(entry => {
      let depth = 0
      let parent = projectsById.get(entry.project.parentProjectId)
      const seen = new Set([entry.project.id])

      while (parent && !seen.has(parent.id)) {
        if (includedIds.has(parent.id)) depth += 1
        seen.add(parent.id)
        parent = projectsById.get(parent.parentProjectId)
      }

      return { ...entry, depth, treeDepth: entry.depth }
    })
}
