import { describe, expect, it } from 'vitest'
import {
  isProhibitionActiveOn,
  isProhibitionViolatedOn,
  prohibitionsActiveOn,
  setProhibitionActiveOn,
  setProhibitionViolationOn
} from './prohibitions'

describe('daily prohibitions', () => {
  it('carries the latest activation choice forward until the next explicit choice', () => {
    const prohibition = {
      activationByDate: {
        '2026-10-10': true,
        '2026-10-12': false,
        '2026-10-15': true
      }
    }

    expect(isProhibitionActiveOn(prohibition, '2026-10-09')).toBe(false)
    expect(isProhibitionActiveOn(prohibition, '2026-10-10')).toBe(true)
    expect(isProhibitionActiveOn(prohibition, '2026-10-11')).toBe(true)
    expect(isProhibitionActiveOn(prohibition, '2026-10-12')).toBe(false)
    expect(isProhibitionActiveOn(prohibition, '2026-10-14')).toBe(false)
    expect(isProhibitionActiveOn(prohibition, '2026-10-15')).toBe(true)
  })

  it('stores an explicit inactive choice without mutating the original rule', () => {
    const prohibition = { activationByDate: { '2026-10-10': true } }
    const updated = setProhibitionActiveOn(prohibition, '2026-10-11', false)

    expect(isProhibitionActiveOn(prohibition, '2026-10-11')).toBe(true)
    expect(isProhibitionActiveOn(updated, '2026-10-11')).toBe(false)
    expect(isProhibitionActiveOn(updated, '2026-10-12')).toBe(false)
  })

  it('returns active rules sorted by configured order', () => {
    const rules = [
      { id: 'second', title: 'Вторая', order: 2, activationByDate: { '2026-10-10': true } },
      { id: 'off', title: 'Выключено', order: 0, activationByDate: { '2026-10-10': false } },
      { id: 'first', title: 'Первая', order: 1, activationByDate: { '2026-10-10': true } }
    ]

    expect(prohibitionsActiveOn(rules, '2026-10-10').map(rule => rule.id)).toEqual(['first', 'second'])
  })

  it('records and clears a violation for one date only', () => {
    const prohibition = { violationsByDate: { '2026-10-09': true } }
    const marked = setProhibitionViolationOn(prohibition, '2026-10-10', true)
    const cleared = setProhibitionViolationOn(marked, '2026-10-10', false)

    expect(isProhibitionViolatedOn(prohibition, '2026-10-10')).toBe(false)
    expect(isProhibitionViolatedOn(marked, '2026-10-10')).toBe(true)
    expect(isProhibitionViolatedOn(marked, '2026-10-09')).toBe(true)
    expect(isProhibitionViolatedOn(cleared, '2026-10-10')).toBe(false)
    expect(isProhibitionViolatedOn(cleared, '2026-10-09')).toBe(true)
  })
})
