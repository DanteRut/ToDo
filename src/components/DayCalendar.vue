<script setup>
import { computed, ref } from 'vue'
import { Check, GripVertical } from 'lucide-vue-next'
import { fromMinutes } from '../utils/dayPlan'
import { buildDayCalendarPreview, DAY_CALENDAR_HOUR_HEIGHT, DAY_CALENDAR_MIN_EVENT_HEIGHT, layoutDayCalendarEvents } from '../utils/dayCalendar'
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
const draggingOver = ref(false)
const dropPreview = ref(null)
const dropTargetLock = ref(null)
const announcement = ref('')
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
function beginDrag(task, event) {
  draggedTask.value = task
  selectedTaskId.value = task.id
  dropPreview.value = null
  dropTargetLock.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}
function beginEventDrag(eventItem, event) {
  if (!canDragEvent(eventItem)) return
  draggedTask.value = eventItem.source
  dropPreview.value = null
  dropTargetLock.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', eventItem.source.id)
  }
}
function endDrag() {
  draggedTask.value = null
  draggingOver.value = false
  dropPreview.value = null
  dropTargetLock.value = null
}
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
function insertionAtPointer(event, task, targetEvent = null, targetElement = null) {
  const trackRect = track.value?.getBoundingClientRect()
  const scrollTop = track.value?.closest('.day-calendar-scroll')?.scrollTop || 0
  const pointerY = trackRect ? event.clientY - trackRect.top + scrollTop : event.clientY
  if (targetEvent) {
    const invalidTarget = targetEvent.type !== 'task' || !targetEvent.source?.id || targetEvent.source.done
      || targetEvent.source.id === task?.id
      || (task?.chainId && targetEvent.source.chainId === task.chainId)
    if (invalidTarget) {
      dropTargetLock.value = null
      return null
    }
    const rect = targetElement?.getBoundingClientRect?.()
    if (!rect || rect.height <= 0 || !trackRect) return null
    const top = rect.top - trackRect.top + scrollTop
    const bottom = top + rect.height
    dropTargetLock.value = { targetTaskId: targetEvent.source.id, top, bottom }
    return { targetTaskId: targetEvent.source.id, mode: pointerY < top + rect.height / 2 ? 'before' : 'after' }
  }

  const locked = dropTargetLock.value
  if (locked && pointerY >= locked.top && pointerY <= locked.bottom) {
    const target = props.events.find(item => item.type === 'task' && item.source?.id === locked.targetTaskId)
    if (target && !target.source?.done && target.source.id !== task?.id && !(task?.chainId && target.source.chainId === task.chainId)) {
      return { targetTaskId: locked.targetTaskId, mode: pointerY < (locked.top + locked.bottom) / 2 ? 'before' : 'after' }
    }
  }
  dropTargetLock.value = null
  return null
}
function targetEventAtPointer(event) {
  const targetElement = event.target?.closest?.('[data-calendar-event-id]') || null
  if (!targetElement) return { targetEvent: null, targetElement: null }
  const id = targetElement.dataset.calendarEventId
  return {
    targetEvent: props.events.find(item => String(item.id) === id) || null,
    targetElement
  }
}
function previewAtPointer(event, task = placementTask.value, targetEvent = null, targetElement = null) {
  if (!task) return null
  const startTime = timeAtPointer(event, task.duration)
  if (!startTime) return null
  if (!targetEvent && !targetElement) ({ targetEvent, targetElement } = targetEventAtPointer(event))
  const insertion = insertionAtPointer(event, task, targetEvent, targetElement)
  const preview = buildDayCalendarPreview(props.events, task, startTime, insertion, props.taskUnits)
  dropPreview.value = preview
  return preview
}
function handleDragOver(event) {
  if (!props.interactive) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  draggingOver.value = true
  previewAtPointer(event)
}
function handleDragLeave(event) {
  const rect = track.value?.getBoundingClientRect()
  if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return
  draggingOver.value = false
  dropTargetLock.value = null
  if (draggedTask.value) dropPreview.value = null
}
function handlePointerMove(event) {
  if (!props.interactive || !selectedTask.value || draggedTask.value) return
  previewAtPointer(event, selectedTask.value)
}
function handlePointerLeave() {
  if (draggedTask.value) return
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
  if (!props.interactive || !selectedTask.value) return
  event.stopPropagation()
  finishPreview(selectedTask.value, previewAtPointer(event, selectedTask.value))
}
function placeAtEnteredTime() {
  if (!selectedTask.value || !selectedTime.value) return
  finishPreview(selectedTask.value, buildDayCalendarPreview(props.events, selectedTask.value, selectedTime.value, null, props.taskUnits))
}
function handleDrop(event) {
  if (!props.interactive) return
  const task = draggedTask.value || selectedTask.value
  if (!task) return
  event.preventDefault()
  finishPreview(task, previewAtPointer(event, task))
}
function handleEventClick(eventItem, event) {
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
  <section class="day-calendar-card" :class="{ interactive, 'drag-over': draggingOver }" :aria-label="`Расписание дня с 06:00 до 24:00${interactive ? ', конструктор расписания' : ''}`">
    <div v-if="interactive" class="day-calendar-builder-tools">
      <div class="day-calendar-unscheduled">
        <div class="day-calendar-pool-heading"><strong>Без времени</strong><span>{{unscheduledTasks.length}}</span></div>
        <div v-if="unscheduledTasks.length" class="day-calendar-task-pool">
          <button v-for="task in unscheduledTasks" :key="task.id" type="button" class="day-calendar-task-chip" :class="[priorityClass(task),{selected:selectedTaskId===task.id}]" draggable="true" :aria-pressed="selectedTaskId===task.id" @click="selectTask(task)" @dragstart="beginDrag(task,$event)" @dragend="endDrag">
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
        <span v-if="dropPreview.insertion">Вставить {{dropPreview.insertionMode==='before'?'перед':'после'}} «{{dropPreview.targetTitle}}» · сдвиг {{dropPreview.shiftBy}} мин</span>
        <span v-else>{{dropPreview.valid?'Предпросмотр позиции':dropPreview.reason==='shifted-task-outside-day'?'Сдвиг выйдет за 24:00':'Задача не помещается в день'}}</span>
      </template>
      <span v-else>Свободное место — параллельная задача; верх/низ карточки — вставка со сдвигом.</span>
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
        <div ref="track" class="day-calendar-track" :class="{'can-place':interactive&&placementTask,'drop-target':draggingOver}" :style="{height:`${TRACK_HEIGHT}px`}" :aria-label="'Временная шкала от 06:00 до 24:00'" @click="placeSelectedTask" @pointermove="handlePointerMove" @pointerleave="handlePointerLeave" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop.prevent.stop="handleDrop">
          <div v-for="hour in HOURS" :key="`line-${hour}`" class="day-calendar-hour-line" :class="{major:hour%3===0}" :style="hourStyle(hour)" aria-hidden="true"></div>
          <div v-for="boundary in boundaries" :key="boundary.key" class="day-calendar-boundary" :class="`day-calendar-boundary--${boundary.key}`" :style="{top:`${(boundary.minute-DAY_SCHEDULE_START)/60*HOUR_HEIGHT}px`}" aria-hidden="true"><span>{{boundary.label}} · {{boundary.value}}</span></div>
          <button v-for="event in renderedEvents" :key="event.id" :data-calendar-event-id="event.preview&&event.preview!=='source'?null:event.id" type="button" class="day-calendar-event" :class="eventClass(event)" :style="eventStyle(event)" :draggable="canDragEvent(event)" :title="`${event.title} · ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?` · ${event.chainTitle}`:event.projectTitle?` · ${event.projectTitle}`:''}`" :aria-label="`${event.title}, ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?`, цепочка ${event.chainTitle}`:event.projectTitle?`, проект ${event.projectTitle}`:''}`" @click.stop="handleEventClick(event,$event)" @dragstart="beginEventDrag(event,$event)" @dragend="endDrag">
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
