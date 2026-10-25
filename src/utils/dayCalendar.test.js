import { describe, expect, it } from 'vitest'
import {
  buildDayCalendarPreview,
  calendarInsertionAtPosition,
  calendarTaskUnitsFromEvents,
  layoutDayCalendarEvents,
  planCalendarInsertion
} from './dayCalendar'

const taskEvent = (id, start, end, extra = {}) => ({
  id: `task:${id}`,
  type: 'task',
  title: `Дело ${id}`,
  start,
  end,
  source: { id, duration: end - start, ...extra }
})

describe('day calendar layout and placement', () => {
  it('keeps task cards in three responsive lanes and preserves their real duration', () => {
    const events = layoutDayCalendarEvents([
      taskEvent('a', 600, 630),
      taskEvent('b', 600, 630),
      taskEvent('c', 600, 630)
    ])

    expect(events.map(event => event.lane)).toEqual([0, 1, 2])
    expect(events.map(event => event.lanes)).toEqual([3, 3, 3])
    expect(events.map(event => event.end)).toEqual([630, 630, 630])
  })

  it('allocates a separate visual lane to short consecutive tasks so minimum-height cards do not cover each other', () => {
    const events = layoutDayCalendarEvents([
      taskEvent('short-a', 600, 615),
      taskEvent('short-b', 615, 630)
    ])

    expect(events.map(event => event.lane)).toEqual([0, 1])
    expect(events.every(event => event.layoutEnd > event.end)).toBe(true)
  })

  it('groups a chain into one movable scheduling unit', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('chain-a', 600, 630, { chainId: 'chain-1', order: 1 }),
      taskEvent('chain-b', 630, 675, { chainId: 'chain-1', order: 2 })
    ])

    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ id: 'chain:chain-1', taskIds: ['chain-a', 'chain-b'], start: 600, end: 675, duration: 75 })
  })

  it('inserts before a parallel group and shifts the group and later tasks by the inserted duration', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ])
    const plan = planCalendarInsertion(units, { id: 'task:new', taskIds: ['new'], duration: 30 }, 'a', 'before')

    expect(plan).toMatchObject({ valid: true, start: 540, shiftBy: 30, mode: 'before' })
    expect(plan.group.map(unit => unit.id)).toEqual(['task:a', 'task:b'])
    expect(plan.shiftedUnits.map(unit => unit.id)).toEqual(['task:b', 'task:a', 'task:later'])
  })

  it('inserts after the end of a parallel group, not just after the shorter item under the pointer', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ])
    const plan = planCalendarInsertion(units, { id: 'task:new', taskIds: ['new'], duration: 30 }, 'b', 'after')

    expect(plan).toMatchObject({ valid: true, start: 600, shiftBy: 30, mode: 'after' })
    expect(plan.shiftedUnits.map(unit => unit.id)).toEqual(['task:later'])
  })

  it('inserts at an overlap boundary between parallel tasks and only shifts tasks that follow that point', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ])
    const plan = planCalendarInsertion(units, { id: 'task:new', taskIds: ['new'], duration: 30 }, 'a', 'between', 570)

    expect(plan).toMatchObject({ valid: true, start: 570, insertionMinute: 570, shiftBy: 30, mode: 'between' })
    expect(plan.shiftedUnits.map(unit => unit.id)).toEqual(['task:later'])
  })

  it('chooses before, between, or after from the cursor position, independent of which card is under it', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ])

    expect(calendarInsertionAtPosition(units, 'a', 545, ['new'])).toMatchObject({ mode: 'before', insertionMinute: 540, groupStart: 540, groupEnd: 600 })
    expect(calendarInsertionAtPosition(units, 'b', 545, ['new'])).toMatchObject({ mode: 'before', insertionMinute: 540, groupStart: 540, groupEnd: 600 })
    expect(calendarInsertionAtPosition(units, 'a', 560, ['new'])).toMatchObject({ mode: 'between', insertionMinute: 570, groupStart: 540, groupEnd: 600 })
    expect(calendarInsertionAtPosition(units, 'a', 590, ['new']).mode).toBe('after')
    expect(calendarInsertionAtPosition(units, 'b', 570, ['new']).mode).toBe('between')
    expect(calendarInsertionAtPosition(units, 'a', null, ['new'])).toBeNull()
  })

  it('previews the inserted task and every task that will be shifted before the drop', () => {
    const events = [
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ]
    const preview = buildDayCalendarPreview(events, { id: 'new', title: 'Новое дело', duration: 30 }, '09:20', { targetTaskId: 'a', mode: 'before' })

    expect(preview).toMatchObject({ valid: true, startTime: '09:00', insertionMode: 'before', shiftBy: 30 })
    expect(preview.events.find(event => event.preview === 'moving')).toMatchObject({ title: 'Новое дело', start: 540, end: 570 })
    expect(preview.events.filter(event => event.preview === 'shifted').map(event => event.start)).toEqual([570, 570, 630])
  })

  it('keeps the chosen between-task boundary in the live preview', () => {
    const events = [
      taskEvent('a', 540, 600),
      taskEvent('b', 540, 570),
      taskEvent('later', 600, 630)
    ]
    const preview = buildDayCalendarPreview(events, { id: 'new', title: 'Новое дело', duration: 30 }, '09:20', {
      targetTaskId: 'a',
      mode: 'between',
      insertionMinute: 570
    })

    expect(preview).toMatchObject({ valid: true, startTime: '09:30', insertionMode: 'between', movingStart: 570 })
    expect(preview.insertion.insertionMinute).toBe(570)
    expect(preview.events.find(event => event.preview === 'moving')).toMatchObject({ start: 570, end: 600 })
  })

  it('uses full chain membership data to preview moving a chain member without breaking its order', () => {
    const current = taskEvent('chain-current', 630, 660, { chainId: 'chain-1', order: 2 })
    const unit = {
      id: 'chain:chain-1',
      chainId: 'chain-1',
      taskIds: ['chain-done', 'chain-current'],
      start: 600,
      end: 660,
      duration: 60,
      members: [
        { id: 'chain-done', title: 'Готовый шаг', chainId: 'chain-1', order: 1, duration: 30, startTime: '10:00', done: true },
        { id: 'chain-current', title: 'Текущий шаг', chainId: 'chain-1', order: 2, duration: 30, startTime: '10:30', done: false }
      ]
    }
    const preview = buildDayCalendarPreview([current], current.source, '11:00', null, [unit])

    expect(preview).toMatchObject({ valid: true, movingStart: 630, movingDuration: 60 })
    expect(preview.events.filter(event => event.preview === 'moving').map(event => event.start)).toEqual([630, 660])
  })

  it('rejects an insertion that would push scheduled tasks beyond 24:00', () => {
    const units = calendarTaskUnitsFromEvents([
      taskEvent('target', 1380, 1410),
      taskEvent('last', 1410, 1430)
    ])
    const plan = planCalendarInsertion(units, { id: 'task:new', taskIds: ['new'], duration: 30 }, 'target', 'before')

    expect(plan.valid).toBe(false)
    expect(plan.reason).toBe('shifted-task-outside-day')
  })
})
