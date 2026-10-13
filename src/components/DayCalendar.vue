<script setup>
import { computed, ref } from 'vue'
import { Check, GripVertical } from 'lucide-vue-next'
import { fromMinutes, layoutOverlaps } from '../utils/dayPlan'
import { timeToMinute } from '../utils/weeklyPlan'
import { DAY_SCHEDULE_END, DAY_SCHEDULE_START, scheduleTimeAtPosition } from '../utils/daySchedule'

const props = defineProps({
  events: { type: Array, default: () => [] },
  unscheduledTasks: { type: Array, default: () => [] },
  wakeTime: { type: String, default: '' },
  workEndTime: { type: String, default: '' },
  sleepTime: { type: String, default: '' },
  interactive: { type: Boolean, default: false }
})
const emit = defineEmits(['schedule-task', 'open-event'])

const HOUR_HEIGHT = 64
const HOURS = Array.from({ length: 18 }, (_, index) => index + 6)
const TOTAL_HEIGHT = HOURS.length * HOUR_HEIGHT
const track = ref(null)
const selectedTaskId = ref('')
const selectedTime = ref('')
const draggedTask = ref(null)
const draggingOver = ref(false)
const announcement = ref('')
const selectedTask = computed(() => props.unscheduledTasks.find(task => task.id === selectedTaskId.value) || null)
const selectedLatestTime = computed(() => {
  const duration = Math.max(1, Number(selectedTask.value?.duration) || 30)
  const latest = Math.max(DAY_SCHEDULE_START, DAY_SCHEDULE_END - duration)
  return fromMinutes(Math.floor(latest / 15) * 15)
})
const visibleEvents = computed(() => layoutOverlaps(props.events
  .filter(event => Number.isFinite(event.start) && Number.isFinite(event.end) && event.end > DAY_SCHEDULE_START && event.start < DAY_SCHEDULE_END)
  .slice()
  .sort((a, b) => a.start - b.start || a.end - b.end)))
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
  const laneWidth = 100 / event.lanes
  return {
    top: `${(start - DAY_SCHEDULE_START) / 60 * HOUR_HEIGHT}px`,
    height: `${Math.max(22, (end - start) / 60 * HOUR_HEIGHT)}px`,
    left: `calc(${event.lane * laneWidth}% + 3px)`,
    width: `calc(${laneWidth}% - 6px)`
  }
}
function eventClass(event) {
  return [
    `day-calendar-event--${event.type}`,
    { completed: Boolean(event.source?.done), draggable: canDragEvent(event) }
  ]
}
function canDragEvent(event) {
  return props.interactive && event.type === 'task' && event.source && !event.source.done
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
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
  if (!selectedTaskId.value) selectedTaskId.value = task.id
}
function beginEventDrag(eventItem, event) {
  if (!canDragEvent(eventItem)) return
  draggedTask.value = eventItem.source
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', eventItem.source.id)
  }
}
function endDrag() {
  draggedTask.value = null
  draggingOver.value = false
}
function emitSchedule(task, startTime) {
  if (!task || !startTime) return
  emit('schedule-task', { task, startTime })
  selectedTaskId.value = ''
  selectedTime.value = ''
  draggedTask.value = null
  draggingOver.value = false
  announcement.value = `«${task.title}» поставлено на ${startTime}.`
}
function timeAtPointer(event, duration) {
  const rect = track.value?.getBoundingClientRect()
  if (!rect) return ''
  return scheduleTimeAtPosition(event.clientY, rect.top, rect.height, duration)
}
function placeSelectedTask(event) {
  if (!props.interactive || !selectedTask.value) return
  event.stopPropagation()
  const time = timeAtPointer(event, selectedTask.value.duration)
  emitSchedule(selectedTask.value, time)
}
function placeAtEnteredTime() {
  if (!selectedTask.value || !selectedTime.value) return
  emitSchedule(selectedTask.value, selectedTime.value)
}
function handleDrop(event) {
  if (!props.interactive) return
  const task = draggedTask.value
  if (!task) return
  emitSchedule(task, timeAtPointer(event, task.duration))
}
function handleEventClick(eventItem, event) {
  if (props.interactive && selectedTask.value) {
    event.stopPropagation()
    emitSchedule(selectedTask.value, fromMinutes(Math.max(DAY_SCHEDULE_START, eventItem.start)))
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
        <p>Перетащи дело на шкалу. На телефоне выбери его и коснись времени.</p>
        <div v-if="unscheduledTasks.length" class="day-calendar-task-pool">
          <button v-for="task in unscheduledTasks" :key="task.id" type="button" class="day-calendar-task-chip" :class="{selected:selectedTaskId===task.id}" draggable="true" :aria-pressed="selectedTaskId===task.id" @click="selectTask(task)" @dragstart="beginDrag(task,$event)" @dragend="endDrag">
            <GripVertical :size="13" aria-hidden="true"/><span><strong>{{task.title}}</strong><small>{{task.duration||30}} мин</small></span>
          </button>
        </div>
        <div v-else class="day-calendar-empty-pool">Все дела на выбранный день уже стоят во времени.</div>
      </div>
      <div v-if="selectedTask" class="day-calendar-place-tools">
        <span><strong>{{selectedTask.title}}</strong><small>Укажи точное начало или коснись шкалы</small></span>
        <input v-model="selectedTime" type="time" min="06:00" :max="selectedLatestTime" step="900" aria-label="Время начала выбранного дела"/>
        <button type="button" class="primary-btn" :disabled="!selectedTime" @click="placeAtEnteredTime"><Check :size="14"/> Поставить</button>
        <button type="button" class="ghost-btn" @click="selectTask(selectedTask)">Отмена</button>
      </div>
    </div>
    <div v-else-if="unscheduledTasks.length" class="day-calendar-unscheduled day-calendar-unscheduled-readonly">
      <div class="day-calendar-pool-heading"><strong>Дела без времени</strong><span>{{unscheduledTasks.length}}</span></div>
      <div class="day-calendar-task-pool"><button v-for="task in unscheduledTasks" :key="task.id" type="button" class="day-calendar-task-chip" @click="emit('open-event',{type:'task',title:task.title,source:task})"><span><strong>{{task.title}}</strong><small>Без времени · {{task.duration||30}} мин</small></span></button></div>
    </div>
    <div v-if="dayBoundaryTimes.length" class="day-calendar-day-boundaries" aria-label="Границы дня">
      <span v-for="boundary in dayBoundaryTimes" :key="boundary.key" :class="`day-calendar-day-boundary--${boundary.key}`">{{boundary.label}} <strong>{{boundary.value}}</strong></span>
    </div>

    <div class="day-calendar-scroll">
      <div class="day-calendar-grid" :style="{'--day-calendar-height':`${TOTAL_HEIGHT}px`}">
        <div class="day-calendar-axis" aria-hidden="true">
          <span v-for="hour in HOURS" :key="hour" :class="{major:hour%3===0}" :style="hourStyle(hour)">{{padded(hour)}}:00</span>
          <b :style="{top:`${TOTAL_HEIGHT}px`}">24:00</b>
        </div>
        <div ref="track" class="day-calendar-track" :class="{'can-place':interactive&&selectedTask,'drop-target':draggingOver}" :style="{height:`${TOTAL_HEIGHT}px`}" :aria-label="'Временная шкала от 06:00 до 24:00'" @click="placeSelectedTask" @dragover.prevent="draggingOver=true" @dragleave="draggingOver=false" @drop.prevent.stop="handleDrop">
          <div v-for="hour in HOURS" :key="`line-${hour}`" class="day-calendar-hour-line" :class="{major:hour%3===0}" :style="hourStyle(hour)" aria-hidden="true"></div>
          <div v-for="boundary in boundaries" :key="boundary.key" class="day-calendar-boundary" :class="`day-calendar-boundary--${boundary.key}`" :style="{top:`${(boundary.minute-DAY_SCHEDULE_START)/60*HOUR_HEIGHT}px`}" aria-hidden="true"><span>{{boundary.label}} · {{boundary.value}}</span></div>
          <button v-for="event in visibleEvents" :key="event.id" type="button" class="day-calendar-event" :class="eventClass(event)" :style="eventStyle(event)" :draggable="canDragEvent(event)" :title="`${event.title} · ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?` · ${event.chainTitle}`:event.projectTitle?` · ${event.projectTitle}`:''}`" :aria-label="`${event.title}, ${clockLabel(event.start)}–${clockLabel(event.end)}${event.chainTitle?`, цепочка ${event.chainTitle}`:event.projectTitle?`, проект ${event.projectTitle}`:''}`" @click.stop="handleEventClick(event,$event)" @dragstart="beginEventDrag(event,$event)" @dragend="endDrag">
            <strong>{{event.title}}</strong>
            <small>{{clockLabel(event.start)}}–{{clockLabel(event.end)}}<template v-if="event.chainTitle"> · {{event.chainTitle}}</template><template v-else-if="event.projectTitle"> · {{event.projectTitle}}</template></small>
            <small v-if="event.type==='class'&&event.source?.room">Ауд. {{event.source.room}}<template v-if="event.source.teacher"> · {{event.source.teacher}}</template></small>
            <small v-else-if="event.type==='homework'&&event.source?.subject">{{event.source.subject}}</small>
          </button>
          <div v-if="interactive&&selectedTask" class="day-calendar-placement-hint" aria-hidden="true">Выбери время для «{{selectedTask.title}}»</div>
        </div>
      </div>
    </div>
    <p class="day-calendar-announcement" aria-live="polite">{{announcement}}</p>
  </section>
</template>
