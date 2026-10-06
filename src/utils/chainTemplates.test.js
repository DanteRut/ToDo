import { describe, expect, it } from 'vitest'
import { toSavedChainTemplate } from './chainTemplates'

describe('chain template persistence', () => {
  it('saves preparation steps when applying a template and strips per-instance settings', () => {
    const template = {
      id: 'template-1',
      title: '  Учебный блок  ',
      preparations: [
        { id: 'prep-1', title: '  Открыть материалы  ', duration: 10 },
        { id: 'blank', title: '  ', duration: 5 }
      ],
      useDate: '2026-10-05',
      useTime: '09:30',
      instanceTitle: 'Лекция',
      selectedTaskIds: ['task-1']
    }

    expect(toSavedChainTemplate(template)).toEqual({
      id: 'template-1',
      type: 'chainTemplate',
      title: 'Учебный блок',
      preparations: [{ id: 'prep-1', title: 'Открыть материалы', duration: 10 }]
    })
    expect(template.preparations[0].title).toBe('  Открыть материалы  ')
  })
})
