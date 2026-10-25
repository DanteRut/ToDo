<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Check, GripVertical } from 'lucide-vue-next'
import { fromMinutes } from '../utils/dayPlan'
import { buildDayCalendarPreview, calendarInsertionAtPosition, calendarTaskUnitsFromEvents, DAY_CALENDAR_HOUR_HEIGHT, DAY_CALENDAR_MIN_EVENT_HEIGHT, layoutDayCalendarEvents } from '../utils/dayCalendar'
import { timeToMinute } from '../utils/weeklyPlan'
import { DAY_SCHEDULE_END, DAY_SCHEDULE_START, scheduleTimeAtPosition } from '../utils/daySchedule'

const props = defineProps({
  events: { type: Array, default: () => [] },
  taskUnits: { type: Array, default: () => [] },
  unscheduledTasks: { type: Array, default: () => [] },
  wakeTime: { type: String, default: '' },
  workEndTime: { type: String, default: '' },
  sleepTime: { type: String, default: '' },
  interactive: { type: Boolean, default: false }
})
const emit = defineEmits(['schedule-task', 'open-event'])

const HOUR_HEIGHT = DAY_CALENDAR_HOUR_HEIGHT
const HOURS = Array.from({ length: 18 }, (_, index) => index + 6)
const TOTAL_HEIGHT = HOURS.length * HOUR_HEIGHT
const TRACK_HEIGHT = TOTAL_HEIGHT + DAY_CALENDAR_MIN_EVENT_HEIGHT
const track = ref(null)
const selectedTaskId = ref('')
const selectedTime = ref('')
const draggedTask = ref(null)
const pointerDrag = ref(null)
const draggingOver = ref(false)
const dropPreview = ref(null)
const dropTargetLock = ref(null)
const suppressedClickTaskId = ref('')
const suppressTrackClick = ref(false)
const announcement = ref('')
const POINTER_DRAG_THRESHOLD = 8
const INSERTION_HIT_SLOP = 36
let suppressedClickTimer
const selectedTask = computed(() => props.unscheduledTasks.find(task => task.id === selectedTaskId.value) || null)
const placementTask = computed(() => draggedTask.value || selectedTask.value)
const selectedTimeBounds = computed(() => {
  const task = selectedTask.value
  const unit = task && props.taskUnits.find(item => (item.taskIds || []).includes(task.id))
  if (task?.chainId && unit?.members?.length) {
    const members = unit.members
    const index = members.findIndex(member => member.id === task.id)
    const offset = members.slice(0, Math.max(0, index)).reduce((sum, member) => sum + (Number(member.duration) || 0), 0)
    const total = Math.max(1, Number(unit.duration) || members.reduce((sum, member) => sum + (Number(member.duration) || 0), 0))
    const earliest = DAY_SCHEDULE_START + offset
    const latest = Math.max(earliest, DAY_SCHEDULE_END - Math.max(1, total - offset))
    return { min: fromMinutes(Math.ceil(earliest / 15) * 15), max: fromMinutes(Math.floor(latest / 15) * 15) }
  }
  const duration = Math.max(1, Number(task?.duration) || 30)
  const latest = Math.max(DAY_SCHEDULE_START, DAY_SCHEDULE_END - duration)
  return { min: fromMinutes(DAY_SCHEDULE_START), max: fromMinutes(Math.floor(latest / 15) * 15) }
})
const selectedEarliestTime = computed(() => selectedTimeBounds.value.min)
const selectedLatestTime = computed(() => selectedTimeBounds.value.max)
const visibleEvents = computed(() => layoutDayCalendarEvents(props.events))
const renderedEvents = computed(() => dropPreview.value?.events || visibleEvents.value)
const dayBoundaryTimes = computed(() => [
  { key: 'wake', label: 'Подъём', value: props.wakeTime },
  { key: 'work-end', label: 'Конец дел', value: props.workEndTime },
  { key: 'sleep', label: 'Отбой', value: props.sleepTime }
].map(boundary => ({ ...boundary, minute: timeToMinute(boundary.value) }))
  .filter(boundary => boundary.minute !== null))
const boundaries = computed(() => dayBoundaryTimes.value.filter(boundary => boundary.minute >= DAY_SCHEDULE_START && boundary.minute < DAY_SCHEDULE_END))

function padded(value) { return String(value).padStart(2, '0') }
function clockLabel(minute) { return minute === DAY_SCHEDULE_END ? '24:00' : fromMinutes(minute) }
function hourStyle(hour) { return { top: `${(hour - 6) * HOUR_HEIGHT}px` } }
function eventStyle(event) {
  const start = Math.max(DAY_SCHEDULE_START, event.start)
  const end = Math.min(DAY_SCHEDULE_END, event.end)
  const laneCount = Math.max(3, event.lanes || 1)
  const laneWidth = 100 / laneCount
  return {
    top: `${(start - DAY_SCHEDULE_START) / 60 * HOUR_HEIGHT}px`,
    height: `${Math.max(DAY_CALENDAR_MIN_EVENT_HEIGHT, (end - start) / 60 * HOUR_HEIGHT)}px`,
    left: `calc(${event.lane * laneWidth}% + 3px)`,
    width: `min(calc(${laneWidth}% - 6px), 160px)`
  }
}
function priorityClass(task) {
  const priority = task?.priority === 'high' ? 'high' : task?.priority === 'medium' ? 'medium' : 'normal'
  return `priority-${priority}`
}
function eventClass(event) {
  const priority = event.source?.priority === 'high' ? 'high' : event.source?.priority === 'medium' ? 'medium' : 'normal'
  return [
    `day-calendar-event--${event.type}`,
    event.type === 'task' ? `day-calendar-event--priority-${priority}` : null,
    event.preview === 'moving' ? 'day-calendar-event--preview' : null,
    event.preview === 'invalid' ? ['day-calendar-event--preview', 'day-calendar-event--preview-invalid'] : null,
    event.preview === 'shifted' ? 'day-calendar-event--shifted-preview' : null,
    event.preview === 'source' ? 'day-calendar-event--source-preview' : null,
    { completed: Boolean(event.source?.done), draggable: canDragEvent(event) }
  ]
}
function canDragEvent(event) {
  return props.interactive && (!event.preview || event.preview === 'source') && event.type === 'task' && event.source && !event.source.done
}
function selectTask(task) {
  selectedTaskId.value = selectedTaskId.value === task.id ? '' : task.id
  selectedTime.value = ''
  announcement.value = selectedTaskId.value
    ? `Выбрано дело «${task.title}». Перетащи его на время или укажи начало вручную.`
    : 'Выбор снят.'
}
function removePointerDragListeners() {
  window.removeEventListener('pointermove', handlePointerDragMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
}
function beginPointerDrag(task, event, sourceEvent = null) {
  if (!props.interactive || !task || event.button !== 0 || event.isPrimary === false || pointerDrag.value) return
  if (sourceEvent && !canDragEvent(sourceEvent)) return

  pointerDrag.value = {
    task,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    fromSchedule: Boolean(sourceEvent),
    active: false
  }
  window.addEventListener('pointermove', handlePointerDragMove, { passive: false })
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
  try {
    event.currentTarget?.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture is optional; window listeners still track the gesture.
  }
}
function beginPoolPointerDrag(task, event) {
  beginPointerDrag(task, event)
}
function beginEventPointerDrag(eventItem, event) {
  if (!canDragEvent(eventItem)) return
  beginPointerDrag(eventItem.source, event, eventItem)
}
function activatePointerDrag(drag) {
  drag.active = true
  draggedTask.value = drag.task
  selectedTaskId.value = drag.task.id
  selectedTime.value = ''
  dropPreview.value = null
  dropTargetLock.value = null
}
function isPointerOverTrack(event) {
  const rect = track.value?.getBoundingClientRect()
  return Boolean(rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
}
function suppressDraggedClick(taskId) {
  clearTimeout(suppressedClickTimer)
  suppressedClickTaskId.value = taskId
  suppressTrackClick.value = true
  suppressedClickTimer = setTimeout(() => {
    if (suppressedClickTaskId.value === taskId) suppressedClickTaskId.value = ''
    suppressTrackClick.value = false
  }, 300)
}
function consumeSuppressedClick(taskId, event) {
  if (!taskId || suppressedClickTaskId.value !== taskId) return false
  event.preventDefault()
  event.stopPropagation()
  suppressedClickTaskId.value = ''
  suppressTrackClick.value = false
  clearTimeout(suppressedClickTimer)
  return true
}
function handlePoolTaskClick(task, event) {
  if (consumeSuppressedClick(task.id, event)) return
  selectTask(task)
}
function handlePointerDragMove(event) {
  const drag = pointerDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < POINTER_DRAG_THRESHOLD) return
  if (!drag.active) activatePointerDrag(drag)

  event.preventDefault()
  if (!isPointerOverTrack(event)) {
    draggingOver.value = false
    dropPreview.value = null
    dropTargetLock.value = null
    return
  }

  draggingOver.value = true
  previewAtPointer(event, drag.task)
}
function finishPointerDrag(event) {
  const drag = pointerDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  removePointerDragListeners()
  pointerDrag.value = null
  if (!drag.active) return

  suppressDraggedClick(drag.task.id)
  event.preventDefault()
  if (!isPointerOverTrack(event)) {
    draggedTask.value = null
    draggingOver.value = false
    dropPreview.value = null
    dropTargetLock.value = null
    if (drag.fromSchedule) selectedTaskId.value = ''
    return
  }

  const preview = previewAtPointer(event, drag.task)
  finishPreview(drag.task, preview)
  if (!preview?.valid) {
    draggedTask.value = null
    draggingOver.value = false
    dropTargetLock.value = null
    if (drag.fromSchedule) selectedTaskId.value = ''
  }
}
function cancelPointerDrag(event) {
  const drag = pointerDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  removePointerDragListeners()
  pointerDrag.value = null
  if (!drag.active) return
  draggedTask.value = null
  draggingOver.value = false
  dropPreview.value = null
  dropTargetLock.value = null
  if (drag.fromSchedule) selectedTaskId.value = ''
}
onBeforeUnmount(() => {
  removePointerDragListeners()
  clearTimeout(suppressedClickTimer)
})
function emitSchedule(task, startTime, insertion = null) {
  if (!task || !startTime) return
  emit('schedule-task', { task, startTime, insertion })
  selectedTaskId.value = ''
  selectedTime.value = ''
  draggedTask.value = null
  draggingOver.value = false
  dropPreview.value = null
  dropTargetLock.value = null
  announcement.value = `«${task.title}» поставлено на ${startTime}.`
}
function timeAtPointer(event, duration) {
  const rect = track.value?.getBoundingClientRect()
  if (!rect) return ''
  return scheduleTimeAtPosition(event.clientY, rect.top, TOTAL_HEIGHT, duration)
}
function insertionUnits() {
  return props.taskUnits.length ? props.taskUnits : calendarTaskUnitsFromEvents(props.events)
}
function movingTaskIds(task) {
  const unit = insertionUnits().find(item => (item.taskIds || []).some(id => id === task?.id))
  return unit?.taskIds || (task?.id === undefined ? [] : [task.id])
}
function insertionBounds(insertion, targetElement) {
  const trackRect = track.value?.getBoundingClientRect()
  if (!trackRect) return null
  const scrollTop = track.value?.closest('.day-calendar-scroll')?.scrollTop || 0
  const taskIds = new Set(insertion.group.flatMap(unit => unit.taskIds || []))
  const elements = [...(track.value.querySelectorAll('[data-calendar-event-id]') || [])]
    .filter(element => taskIds.has(props.events.find(item => String(item.id) === element.dataset.calendarEventId)?.source?.id))
  if (targetElement && !elements.includes(targetElement)) elements.push(targetElement)
  const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.height > 0)
  const groupTop = (insertion.groupStart - DAY_SCHEDULE_START) / 60 * HOUR_HEIGHT
  const groupBottom = (insertion.groupEnd - DAY_SCHEDULE_START) / 60 * HOUR_HEIGHT
  const top = Math.min(groupTop, ...rects.map(rect => rect.top - trackRect.top + scrollTop))
  const bottom = Math.max(groupBottom, ...rects.map(rect => rect.bottom - trackRect.top + scrollTop))
  return { top, bottom }
}
function isInvalidInsertionTarget(targetEvent, task) {
  return targetEvent.type !== 'task' || !targetEvent.source?.id || targetEvent.source.done
    || targetEvent.source.id === task?.id
    || (task?.chainId && targetEvent.source.chainId === task.chainId)
}
function insertionAtPointer(event, task, targetEvent = null, targetElement = null) {
  const trackRect = track.value?.getBoundingClientRect()
  const scrollTop = track.value?.closest('.day-calendar-scroll')?.scrollTop || 0
  const pointerY = trackRect ? event.clientY - trackRect.top + scrollTop : event.clientY
  const pointerMinute = timeToMinute(timeAtPointer(event, task.duration))

  if (!targetEvent && !targetElement) ({ targetEvent, targetElement } = targetEventAtPointer(event, task))
  if (targetEvent && isInvalidInsertionTarget(targetEvent, task)) {
    dropTargetLock.value = null
    return null
  }
  if (targetEvent) {
    const insertion = calendarInsertionAtPosition(insertionUnits(), targetEvent.source.id, pointerMinute, movingTaskIds(task))
    if (!insertion) {
      dropTargetLock.value = null
      return null
    }
    const bounds = insertionBounds(insertion, targetElement)
    const laneCount = Math.max(3, targetEvent.lanes || 1)
    dropTargetLock.value = bounds ? { targetTaskId: targetEvent.source.id, lane: targetEvent.lane ?? 0, laneCount, ...bounds } : null
    return { targetTaskId: targetEvent.source.id, mode: insertion.mode, insertionMinute: insertion.insertionMinute }
  }

  const locked = dropTargetLock.value
  const laneCount = Math.max(3, locked?.laneCount || 1)
  const currentLane = trackRect?.width
    ? Math.min(laneCount - 1, Math.max(0, Math.floor((event.clientX - trackRect.left) / trackRect.width * laneCount)))
    : null
  if (locked && currentLane === locked.lane && pointerY >= locked.top - INSERTION_HIT_SLOP && pointerY <= locked.bottom + INSERTION_HIT_SLOP) {
    const target = props.events.find(item => item.type === 'task' && item.source?.id === locked.targetTaskId)
    if (target && !isInvalidInsertionTarget(target, task)) {
      const insertion = calendarInsertionAtPosition(insertionUnits(), locked.targetTaskId, pointerMinute, movingTaskIds(task))
      if (insertion) return { targetTaskId: locked.targetTaskId, mode: insertion.mode, insertionMinute: insertion.insertionMinute }
    }
  }
  dropTargetLock.value = null
  return null
}
function isValidInsertionCandidate(targetEvent, task) {
  return targetEvent?.type === 'task' && targetEvent.source?.id !== undefined && !targetEvent.source.done
    && targetEvent.source.id !== task?.id
    && !(task?.chainId && targetEvent.source.chainId === task.chainId)
}
function nearestTaskEventAtPointer(event, task) {
  const trackRect = track.value?.getBoundingClientRect()
  if (!trackRect?.width || event.clientX < trackRect.left || event.clientX > trackRect.right) return { targetEvent: null, targetElement: null }
  const elements = [...(track.value?.querySelectorAll('[data-calendar-event-id]') || [])]
  let nearest = null
  for (const element of elements) {
    const targetEvent = renderedEvents.value.find(item => String(item.id) === element.dataset.calendarEventId)
    if (!isValidInsertionCandidate(targetEvent, task)) continue
    const laneCount = Math.max(3, targetEvent.lanes || 1)
    const pointerLane = Math.min(laneCount - 1, Math.max(0, Math.floor((event.clientX - trackRect.left) / trackRect.width * laneCount)))
    if (pointerLane !== (targetEvent.lane ?? 0)) continue
    const rect = element.getBoundingClientRect()
    const distance = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom)
    if (distance <= INSERTION_HIT_SLOP && (!nearest || distance < nearest.distance)) {
      nearest = { targetEvent, targetElement: element, distance }
    }
  }
  return nearest
    ? { targetEvent: nearest.targetEvent, targetElement: nearest.targetElement }
    : { targetEvent: null, targetElement: null }
}
function targetEventAtPointer(event, task) {
  const pointTarget = document.elementFromPoint?.(event.clientX, event.clientY)
  const elements = [pointTarget, event.target]
  for (const element of elements) {
    const targetElement = element?.closest?.('[data-calendar-event-id]') || null
    if (!targetElement) continue
    const id = targetElement.dataset.calendarEventId
    const targetEvent = renderedEvents.value.find(item => String(item.id) === id) || null
    if (!targetEvent) continue
    if (element === pointTarget || isValidInsertionCandidate(targetEvent, task)) return { targetEvent, targetElement }
  }
  return nearestTaskEventAtPointer(event, task)
}
function previewAtPointer(event, task = placementTask.value, targetEvent = null, targetElement = null) {
  if (!task) return null
  const startTime = timeAtPointer(event, task.duration)
  if (!startTime) return null
  if (!targetEvent && !targetElement) ({ targetEvent, targetElement } = targetEventAtPointer(event, task))
  const insertion = insertionAtPointer(event, task, targetEvent, targetElement)
  const preview = buildDayCalendarPreview(props.events, task, startTime, insertion, props.taskUnits)
  dropPreview.value = preview
  return preview
}
function handlePointerMove(event) {
  if (!props.interactive || !selectedTask.value || draggedTask.value || pointerDrag.value?.active) return
  previewAtPointer(event, selectedTask.value)
}
function handlePointerLeave() {
  if (draggedTask.value || pointerDrag.value?.active) return
  dropPreview.value = null
  dropTargetLock.value = null
}
function finishPreview(task, preview) {
  if (!preview) return
  dropPreview.value = preview
  if (!preview.valid) {
    announcement.value = preview.reason === 'shifted-task-outside-day'
      ? 'Освободи место или выбери другое время: сдвигаемые дела не помещаются до 24:00.'
      : 'Это дело целиком не помещается в расписание 06:00–24:00.'
    return
  }
  emitSchedule(task, preview.startTime, preview.insertion)
}
function placeSelectedTask(event) {
  if (suppressTrackClick.value) {
    event.preventDefault()
    event.stopPropagation()
    suppressTrackClick.value = false
    suppressedClickTaskId.value = ''
    clearTimeout(suppressedClickTimer)
    return
  }
  if (!props.interactive || !selectedTask.value) return
  event.stopPropagation()
  finishPreview(selectedTask.value, previewAtPointer(event, selectedTask.value))
}
function placeAtEnteredTime() {
  if (!selectedTask.value || !selectedTime.value) return
  finishPreview(selectedTask.value, buildDayCalendarPreview(props.events, selectedTask.value, selectedTime.value, null, props.taskUnits))
}
function handleEventClick(eventItem, event) {
  if (consumeSuppressedClick(eventItem.source?.id, event)) return
  if (props.interactive && selectedTask.value) {
    event.stopPropagation()
    const startTime = fromMinutes(Math.max(DAY_SCHEDULE_START, eventItem.start))
    const insertion = insertionAtPointer(event, selectedTask.value, eventItem, event.currentTarget)
    finishPreview(selectedTask.value, buildDayCalendarPreview(props.events, selectedTask.value, startTime, insertion, props.taskUnits))
    return
  }
  emit('open-event', eventItem)
}
</script>

<template>
  <section class="day-calendar-card" :class="{ interactive, 'drag-over': draggingOver, 'pointer-dragging': Boolean(pointerDrag?.active) }" :aria-label="`Расписание дня с 06:00 до 24:00${interactive ? ', конструктор расписания' : ''}`">
    <div v-if="interactive" class="day-calendar-builder-tools">
      <div class="day-calendar-unscheduled">
        <div class="day-calendar-pool-heading"><strong>Без времени</strong><span>{{unscheduledTasks.length}}</span></div>
        <p class="day-calendar-pool-hint">Перетащи задачу на шкалу; на телефоне жест тоже работает. Или выбери задачу и нажми на нужное время.</p>
        <div v-if="unscheduledTasks.length" class="day-calendar-task-pool">
          <button v-for="task in unscheduledTasks" :key="task.id" type="button" class="day-calendar-task-chip" :class="[priorityClass(task),{selected:selectedTaskId===task.id}]" :aria-pressed="selectedTaskId===task.id" @click="handlePoolTaskClick(task,$event)" @pointerdown.stop="beginPoolPointerDrag(task,$event)">
            <GripVertical :size="13" aria-hidden="true"/><span><strong>{{task.title}}</strong><small>{{task.duration||30}} мин</small></span>
          </button>
        </div>
        <div v-else class="day-calendar-empty-pool">Все дела на выбранный день уже стоят во времени.</div>
      </div>
      <div v-if="selectedTask" class="day-calendar-place-tools">
        <span><strong>{{selectedTask.title}}</strong></span>
        <input v-model="selectedTime" type="time" :min="selectedEarliestTime" :max="selectedLatestTime" step="900" aria-label="Время начала выбранного дела"/>
        <button type="button" class="primary-btn" :disabled="!selectedTime" @click="placeAtEnteredTime"><Check :size="14"/> Поставить</button>
        <button type="button" class="ghost-btn" @click="selectTask(selectedTask)">Отмена</button>
      </div>
    </div>
    <div v-else-if="unscheduledTasks.length" class="day-calendar-unscheduled day-calendar-unscheduled-readonly">
      <div class="day-calendar-pool-heading"><strong>Дела без времени</strong><span>{{unscheduledTasks.length}}</span></div>
      <div class="day-calendar-task-pool"><button v-for="task in unscheduledTasks" :key="task.id" type="button" class="day-calendar-task-chip" @click="emit('open-event',{type:'task',title:task.title,source:task})"><span><strong>{{task.title}}</strong><small>Без времени · {{task.duration||30}} мин</small></span></button></div>
    </div>
    <div v-if="interactive" class="day-calendar-preview-status" :class="{active:Boolean(dropPreview),invalid:Boolean(dropPreview&&!dropPreview.valid)}" aria-live="off">
      <template v-if="dropPreview">
        <strong>{{dropPreview.startTime}}</strong>
        <span v-if="dropPreview.insertion">Вставить <template v-if="dropPreview.insertionMode==='between'">между параллельными делами · {{dropPreview.startTime}}</template><template v-else>{{dropPreview.insertionMode==='before'?'перед':'после'}} «{{dropPreview.targetTitle}}»</template> · сдвиг {{dropPreview.shiftBy}} мин</span>
        <span v-else>{{dropPreview.valid?'Предпросмотр позиции':dropPreview.reason==='shifted-task-outside-day'?'Сдвиг выйдет за 24:00':'Задача не помещается в день'}}</span>
      </template>
      <span v-else>В свободной колонке задача останется параллельной; у группы — в ближайший промежуток или конец со сдвигом.</span>
    </div>
    <div v-if="dayBoundaryTimes.length" class="day-calendar-day-boundaries" aria-label="Границы дня">
      <span v-for="boundary in dayBoundaryTimes" :key="boundary.key" :class="`day-calendar-day-boundary--${boundary.key}`">{{boundary.label}} <strong>{{boundary.value}}</strong></span>
    </div>

    <div class="day-calendar-scroll">
      <div class="day-calendar-grid" :style="{'--day-calendar-height':`${TRACK_HEIGHT}px`}">
        <div class="day-calendar-axis" aria-hidden="true">
          <span v-for="hour in HOURS" :key="hour" :class="{major:hour%3===0}" :style="hourStyle(hour)">{{padded(hour)}}:00</span>
          <b :style="{top:`${TOTAL_HEIGHT}px`}">24:00</b>
        </div>
        <div ref="track" class="day-calendar-track" :class="{'can-place':interactive&&placementTask,'drop-target':draggingOver}" :style="{height:`${TRACK_HEIGHT}px`}" :aria-label="'Временная шкала от 06:00 до 24:00'" @click="placeSelectedTask" @pointermove="handlePointerMove" @pointerleave="handlePointerLeave">
          <div v-for="hour in HOURS" :key="`line-${hour}`" class="day-calendar-hour-line" :class="{major:hour%3===0}" :style="hourStyle(hour)" aria-hidden="true"></div>
          <div v-for="boundary in boundaries" :key="boundary.key" class="day-calendar-boundary" :class="`day-calendar-boundary--${boundary.key}`" :style="{top:`${(boundary.minute-DAY_SCHEDULE_START)/60*HOUR_HEIGHT}px`}" aria-hidden="true"><span>{{boundary.label}} · {{boundary.value}}</span></div>
          <button v-for="event in renderedEvents" :key="event.id" :data-calendar-event-id="event.preview&&event.preview!=='source'?null:event.id" type="button" class="day-calendar-event" :class="eventClass(event)" :style="eventStyle(event)" :title="`${event.title} · ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?` · ${event.chainTitle}`:event.projectTitle?` · ${event.projectTitle}`:''}`" :aria-label="`${event.title}, ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?`, цепочка ${event.chainTitle}`:event.projectTitle?`, проект ${event.projectTitle}`:''}`" @pointerdown.stop="beginEventPointerDrag(event,$event)" @click.stop="handleEventClick(event,$event)">
            <strong>{{event.title}}</strong>
            <small>{{clockLabel(event.start)}}–{{clockLabel(event.end)}}<template v-if="event.chainTitle"> · {{event.chainTitle}}</template><template v-else-if="event.projectTitle"> · {{event.projectTitle}}</template></small>
            <small v-if="event.type==='class'&&event.source?.room">Ауд. {{event.source.room}}<template v-if="event.source.teacher"> · {{event.source.teacher}}</template></small>
            <small v-else-if="event.type==='homework'&&event.source?.subject">{{event.source.subject}}</small>
          </button>
        </div>
      </div>
    </div>
    <p class="day-calendar-announcement" aria-live="polite">{{announcement}}</p>
  </section>
</template>
