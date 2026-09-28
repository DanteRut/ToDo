import { describe, expect, it } from 'vitest'
import { reactive, isProxy } from 'vue'
import { toPlainRecord } from './storage'

describe('storage serialization', () => {
  it('removes nested Vue proxies from workout logs before IndexedDB persistence', () => {
    const workout = reactive({
      type: 'session',
      log: [{ exerciseId: 'pull-up', sets: [{ weight: '20', reps: '8', done: true }] }]
    })

    expect(isProxy(workout.log[0].sets[0])).toBe(true)
    const plain = toPlainRecord(workout)
    expect(isProxy(plain.log[0].sets[0])).toBe(false)
    expect(plain.log[0].sets[0]).toEqual({ weight: '20', reps: '8', done: true })
  })
})
