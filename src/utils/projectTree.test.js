import { describe, expect, it } from 'vitest'
import { buildProjectTreeEntries, filterProjectTreeEntries } from './projectTree'

describe('project tree views', () => {
  const projects = [
    { id: 'study', title: 'Study', order: 1, status: 'active' },
    { id: 'math', title: 'Math', parentProjectId: 'study', order: 1, status: 'active' },
    { id: 'physics', title: 'Physics', parentProjectId: 'study', order: 2, status: 'completed' },
    { id: 'old-study', title: 'Old study', order: 2, status: 'completed' },
    { id: 'research', title: 'Research', parentProjectId: 'old-study', order: 1, status: 'active' },
    { id: 'archived', title: 'Archived', order: 3, status: 'archived' }
  ]

  it('keeps current projects visible and flattens children when their parent is completed', () => {
    const entries = buildProjectTreeEntries(projects)
    const current = filterProjectTreeEntries(entries, projects)

    expect(current.map(entry => [entry.project.id, entry.depth, entry.treeDepth])).toEqual([
      ['study', 0, 0],
      ['math', 1, 1],
      ['research', 0, 1]
    ])
  })

  it('lists completed projects and subprojects in the completed view', () => {
    const entries = buildProjectTreeEntries(projects)
    const completed = filterProjectTreeEntries(entries, projects, true)

    expect(completed.map(entry => [entry.project.id, entry.depth, entry.treeDepth])).toEqual([
      ['physics', 0, 1],
      ['old-study', 0, 0]
    ])
  })
})
