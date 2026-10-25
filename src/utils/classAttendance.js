export function classAttendanceForDate(dateKey, lessons = [], attendanceByDate = {}) {
  const scheduledLessons = Array.isArray(lessons) ? lessons.filter(lesson => lesson?.id) : []
  const savedSelection = attendanceByDate?.[dateKey]
  if (!Array.isArray(savedSelection)) return scheduledLessons.map(lesson => lesson.id)

  const selectedIds = new Set(savedSelection)
  return scheduledLessons.filter(lesson => selectedIds.has(lesson.id)).map(lesson => lesson.id)
}

export function toggleClassAttendance(lessons = [], selectedIds = [], lessonId) {
  const scheduledLessons = Array.isArray(lessons) ? lessons.filter(lesson => lesson?.id) : []
  const scheduledIds = new Set(scheduledLessons.map(lesson => lesson.id))
  const nextSelection = new Set(selectedIds.filter(id => scheduledIds.has(id)))

  if (!scheduledIds.has(lessonId)) return scheduledLessons.filter(lesson => nextSelection.has(lesson.id)).map(lesson => lesson.id)
  if (nextSelection.has(lessonId)) nextSelection.delete(lessonId)
  else nextSelection.add(lessonId)

  return scheduledLessons.filter(lesson => nextSelection.has(lesson.id)).map(lesson => lesson.id)
}

export function withClassAttendance(plan, dateKey, selectedIds = [], lessons = []) {
  const scheduledLessons = Array.isArray(lessons) ? lessons.filter(lesson => lesson?.id) : []
  const selected = new Set(selectedIds)
  const classAttendance = {
    ...(plan?.classAttendance || {}),
    [dateKey]: scheduledLessons.filter(lesson => selected.has(lesson.id)).map(lesson => lesson.id)
  }

  return { classAttendance }
}
