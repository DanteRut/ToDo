import { differenceInCalendarDays, format, getDay, parseISO, startOfWeek } from 'date-fns'

export const SEMESTER = {
  start: '2026-09-01',
  end: '2027-01-04',
  anchor: '2026-09-28', // Понедельник первой недели, подтверждено пользователем
  group: 'УВП-412'
}

const lesson = (day, pair, start, end, subject, kind, teacher, room, weeks = [1, 2], shared = '') => ({
  id: `${day}-${pair}-${weeks.join('')}-${subject}`,
  day, pair, start, end, subject, kind, teacher, room, weeks, shared
})

export const CLASS_SCHEDULE = [
  lesson(1, 2, '10:05', '11:25', 'Разработка мобильных приложений', 'Практическое занятие', 'Заманова Е.А.', '1317', [1]),
  lesson(1, 3, '11:40', '13:00', 'Предметно-ориентированное проектирование', 'Практическое занятие', 'Разживайкин И.С.', '1321', [1]),
  lesson(1, 4, '13:45', '15:05', 'Разработка мобильных приложений', 'Лекция', 'Разживайкин И.С.', '1540', [1, 2], 'УВП-411, УВП-412, УИТ-411'),
  lesson(1, 5, '15:20', '16:40', 'Предметно-ориентированное проектирование', 'Практическое занятие', 'Разживайкин И.С.', '1319', [2]),

  lesson(2, 2, '10:05', '11:25', 'Тестирование', 'Лекция', '', '1329', [1, 2], 'УВП-411, УВП-412'),
  lesson(2, 3, '11:40', '13:00', 'Тестирование', 'Практическое занятие', '', '1319'),

  lesson(3, 4, '13:45', '15:05', 'Технологии виртуализации и контейнеризации', 'Лекция', 'Кремнев А.Ю.', '5203', [1, 2], 'УВП-411, УВП-412'),
  lesson(3, 5, '15:20', '16:40', 'Разработка корпоративных приложений', 'Лекция', 'Заманов Е.А.', '5203', [1, 2], 'УВП-411, УВП-412'),

  lesson(4, 4, '13:45', '15:05', 'Предметно-ориентированное проектирование', 'Лекция', 'Разживайкин И.С.', '2423', [2], 'УВП-411, УВП-412, УИТ-411'),
  lesson(4, 5, '15:20', '16:40', 'Основы проектирования ПО', 'Лекция', 'Разживайкин И.С.', '5203', [2], 'УВП-411, УВП-412'),
  lesson(4, 6, '16:55', '18:15', 'Системы искусственного интеллекта и машинное обучение', 'Лекция', 'к.т.н., доц. Варнавский А.Н.', '1540', [1, 2], 'УВП-411, УВП-412, УИТ-411'),
  lesson(4, 7, '18:30', '19:50', 'Системы искусственного интеллекта и машинное обучение', 'Практическое занятие', 'к.т.н., доц. Варнавский А.Н.', '5305'),
  lesson(4, 8, '20:00', '21:20', 'Разработка корпоративных приложений', 'Лабораторная работа', 'Заманов Д.А., Панушкин А.Н.', '1408', [1]),
  lesson(4, 8, '20:00', '21:20', 'Разработка корпоративных приложений', 'Лабораторная работа', 'Заманов Д.А., Панушкин А.Н.', '2214', [2]),

  lesson(5, 4, '13:45', '15:05', 'Технологии виртуализации и контейнеризации', 'Практическое занятие', 'Кремнев А.Ю.', '1319'),
  lesson(5, 5, '15:20', '16:40', 'Разработка мобильных приложений', 'Лабораторная работа', 'Заманова Е.А., Мамонов Н.Ю.', '1319'),
  lesson(5, 6, '16:55', '18:15', 'Основы проектирования ПО', 'Практическое занятие', 'Разживайкин И.С.', '2214'),
  lesson(5, 7, '18:30', '19:50', 'Проектная деятельность', 'Практическое занятие', '', '1317')
]

export function academicWeek(dateInput) {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  const anchorMonday = startOfWeek(parseISO(SEMESTER.anchor), { weekStartsOn: 1 })
  const distance = Math.round(differenceInCalendarDays(monday, anchorMonday) / 7)
  return ((distance % 2) + 2) % 2 + 1
}

export function isInSemester(dateInput) {
  const key = typeof dateInput === 'string' ? dateInput : format(dateInput, 'yyyy-MM-dd')
  return key >= SEMESTER.start && key <= SEMESTER.end
}

export function classesForDate(dateInput) {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  if (!isInSemester(date)) return []
  const day = getDay(date)
  const week = academicWeek(date)
  return CLASS_SCHEDULE.filter(item => item.day === day && item.weeks.includes(week)).sort((a, b) => a.pair - b.pair)
}

export const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']
