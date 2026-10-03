export function focusSecondsRemaining(deadlineAt, now = Date.now()) {
  const deadline = Number(deadlineAt)
  if (!Number.isFinite(deadline)) return 0
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function restoreFocusTimer(draft, now = Date.now()) {
  const seconds = Math.max(0, Number(draft?.seconds) || 0)
  if (!draft?.running) return { seconds, running: false, deadlineAt: null, expired: false }

  const savedAt = Number(draft.savedAt)
  const storedDeadline = Number(draft.deadlineAt)
  const deadlineAt = Number.isFinite(storedDeadline) && storedDeadline > 0
    ? storedDeadline
    : (Number.isFinite(savedAt) && savedAt > 0 ? savedAt : now) + seconds * 1000
  const remaining = focusSecondsRemaining(deadlineAt, now)

  return { seconds: remaining, running: remaining > 0, deadlineAt, expired: remaining === 0 }
}
