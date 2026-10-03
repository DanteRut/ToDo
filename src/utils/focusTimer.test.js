import { describe, expect, it } from 'vitest'
import { focusSecondsRemaining, restoreFocusTimer } from './focusTimer'

describe('focus timer background recovery', () => {
  const now = Date.parse('2026-10-03T09:00:00.000Z')

  it('calculates remaining time from the absolute deadline, independent of interval ticks', () => {
    const deadline = now + 25 * 60 * 1000

    expect(focusSecondsRemaining(deadline, now + 12_345)).toBe(1488)
    expect(focusSecondsRemaining(deadline, now + 30 * 60 * 1000)).toBe(0)
  })

  it('restores a running timer using its persisted deadline after the app was closed', () => {
    const deadlineAt = now + 25 * 60 * 1000

    expect(restoreFocusTimer({ running: true, seconds: 1500, deadlineAt, savedAt: now }, now + 10 * 60 * 1000)).toEqual({
      seconds: 900,
      running: true,
      deadlineAt,
      expired: false
    })
  })

  it('marks a timer as expired when its deadline passed while the app was closed', () => {
    const deadlineAt = now + 25 * 60 * 1000

    expect(restoreFocusTimer({ running: true, seconds: 1500, deadlineAt }, deadlineAt + 5000)).toEqual({
      seconds: 0,
      running: false,
      deadlineAt,
      expired: true
    })
  })

  it('migrates older saved timers without a deadline using savedAt and remaining seconds', () => {
    const savedAt = now - 10_000

    expect(restoreFocusTimer({ running: true, seconds: 1400, savedAt }, now)).toEqual({
      seconds: 1390,
      running: true,
      deadlineAt: savedAt + 1400_000,
      expired: false
    })
  })

  it('does not consume time while a paused timer is closed', () => {
    expect(restoreFocusTimer({ running: false, seconds: 321, savedAt: now }, now + 60 * 60 * 1000)).toEqual({
      seconds: 321,
      running: false,
      deadlineAt: null,
      expired: false
    })
  })
})
