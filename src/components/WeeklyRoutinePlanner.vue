<script setup>
import { computed, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Check, Dumbbell, GripVertical, LockKeyhole, X } from 'lucide-vue-next'
import { hasScheduleConflict, isWakePlanComplete, REST_ACTIVITIES, timeToMinute } from '../utils/weeklyPlan'
import { DAY_MODES } from '../utils/dayModes'

const props = defineProps({
  days: { type: Array, required: true },
  selectedDate: { type: String, required: true },
  wakeTimes: { type: Object, default: () => ({}) },
  wakeSteps: { type: Object, default: () => ({}) },
  confirmedAt: { type: String, default: null },
  unscheduledTasks: { type: Array, default: () => [] },
  workouts: { type: Array, default: () => [] }
})
const emit = defineEmits([
  'wake-time', 'wake-step', 'day-mode', 'toggle-class-attendance', 'schedule-task', 'add-workout-block',
  'remove-workout-block', 'add-rest-block', 'remove-rest-block', 'confirm'
])

const plannerRoot = ref(null)
const selectedDateKey = ref('')
const selectedTime = ref('')
const hasSelectedSlot = ref(false)
const selectedPlanItem = ref(null)
const draggedPlanItem = ref(null)
const draggingOverDate = ref('')
const announcement = ref('')
const hours = Array.from({ length: 24 }, (_, hour) => hour)
const wakeCount = computed(() => props.days.filter(day => {
  const minute = timeToMinute(props.wakeTimes[day.key])
  return minute !== null && minute < 1440
}).length)
const canConfirm = computed(() => isWakePlanComplete(props.days, props.wakeTimes))
const selectedPlanTitle = computed(() => selectedPlanItem.value?.record?.title || '')

watch(() => [props.selectedDate, props.days.map(day => day.key).join('|')], ([selectedDate, dayKeys]) => {
  const keys = dayKeys.split('|').filter(Boolean)
  selectedDateKey.value = keys.includes(selectedDate) ? selectedDate : (keys[0] || '')
  selectedTime.value = ''
  hasSelectedSlot.value = false
  selectedPlanItem.value = null
}, { immediate: true })

function padded(value) { return String(value).padStart(2, '0') }
function dateLabel(dateKey) { return format(parseISO(dateKey), 'd MMM', { locale: ru }) }
function clockAtPointer(event, day) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const slot = Math.min(47, Math.max(0, Math.floor((event.clientY - bounds.top) / (bounds.height / 48))))
  selectedDateKey.value = day.key
  return `${padded(Math.floor(slot / 2))}:${slot % 2 ? '30' : '00'}`
}
function placePlanItem(item, dateKey, startTime) {
  if (!item || !dateKey || !startTime) return
  if (item.type === 'task') emit('schedule-task', { task: item.record, dateKey, startTime })
  if (item.type === 'workout') emit('add-workout-block', { workoutId: item.record.id, dateKey, startTime })
  announcement.value = `${item.record.title} · ${dateLabel(dateKey)} · ${startTime}`
  selectedPlanItem.value = null
  draggedPlanItem.value = null
  draggingOverDate.value = ''
  hasSelectedSlot.value = false
}
function selectSlot(event, day) {
  const startTime = clockAtPointer(event, day)
  const item = draggedPlanItem.value || selectedPlanItem.value
  if (item) {
    placePlanItem(item, day.key, startTime)
    return
  }
  selectedTime.value = startTime
  hasSelectedSlot.value = true
  announcement.value = `${dateLabel(day.key)} · ${startTime}`
  plannerRoot.value?.focus({ preventScroll: true })
}
function selectTask(task) {
  selectedPlanItem.value = selectedPlanItem.value?.type === 'task' && selectedPlanItem.value.record.id === task.id
    ? null
    : { type: 'task', record: task }
}
function selectWorkout(workout) {
  selectedPlanItem.value = selectedPlanItem.value?.type === 'workout' && selectedPlanItem.value.record.id === workout.id
    ? null
    : { type: 'workout', record: workout }
}
function beginTaskDrag(task, event) {
  draggedPlanItem.value = { type: 'task', record: task }
  selectedPlanItem.value = draggedPlanItem.value
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}
function beginWorkoutDrag(workout, event) {
  draggedPlanItem.value = { type: 'workout', record: workout }
  selectedPlanItem.value = draggedPlanItem.value
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', workout.id)
  }
}
function beginScheduledTaskDrag(eventItem, event) {
  if (eventItem.type !== 'task' || !eventItem.source || eventItem.source.done) return
  draggedPlanItem.value = { type: 'task', record: eventItem.source }
  selectedPlanItem.value = draggedPlanItem.value
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', eventItem.source.id)
  }
}
function handleDrop(event, day) {
  const item = draggedPlanItem.value || selectedPlanItem.value
  if (!item) return
  placePlanItem(item, day.key, clockAtPointer(event, day))
}
function cancelDrag() {
  draggedPlanItem.value = null
  draggingOverDate.value = ''
}
function addRest(activity) {
  if (!hasSelectedSlot.value || !selectedDateKey.value || !selectedTime.value) {
    announcement.value = 'Сначала выбери время на сетке.'
    return
  }
  const day = props.days.find(item => item.key === selectedDateKey.value)
  if (!day || hasScheduleConflict(selectedTime.value, activity.duration, day.events)) {
    announcement.value = 'Время занято.'
    return
  }
  emit('add-rest-block', { dateKey: selectedDateKey.value, startTime: selectedTime.value, activityId: activity.id })
  announcement.value = `${activity.title} · ${dateLabel(selectedDateKey.value)} · ${selectedTime.value}`
}
function onKeydown(event) {
  const targetTag = event.target?.tagName?.toLowerCase()
  if (['input', 'textarea', 'select'].includes(targetTag) || event.target?.isContentEditable) return
  const activity = REST_ACTIVITIES.find(option => option.shortcut === event.key)
  if (!activity) return
  event.preventDefault()
  addRest(activity)
}
function wakeTimeChanged(day, event) { emit('wake-time', { dateKey: day.key, value: event.target.value }) }
function wakeStepChanged(day, event) { emit('wake-step', { dateKey: day.key, value: event.target.value }) }
function selectDayMode(day, mode) { emit('day-mode', { dateKey: day.key, mode: mode.id }) }
function eventStyle(event) {
  const start = timeToMinute(event.startTime)
  if (start === null || start >= 1440) return { display: 'none' }
  const end = event.endTime ? timeToMinute(event.endTime) : start + (Number(event.duration) || 30)
  if (end === null) return { display: 'none' }
  const duration = Math.max(1, Math.min(1440, end) - start)
  return { top: `${start / 60 * 42}px`, height: `${Math.max(18, duration / 60 * 42)}px` }
}
function eventClass(event) {
  const priority = event.priority === 'high' ? 'high' : event.priority === 'medium' ? 'medium' : 'normal'
  return [
    `weekly24-event-${event.type}`,
    event.type === 'task' ? `weekly24-event-priority-${priority}` : null,
    { completed: Boolean(event.source?.done) }
  ]
}
function addRestEvent(event) { emit('remove-rest-block', event.id) }
function removeWorkoutEvent(event) { emit('remove-workout-block', event.id) }
</script>

<template>
  <section ref="plannerRoot" class="weekly-routine-planner card" tabindex="0" aria-labelledby="weekly-routine-title" @keydown="onKeydown">
    <header class="weekly-routine-head">
      <div>
        <h2 id="weekly-routine-title">План недели</h2>
        <p>Нажми на пару, чтобы отметить посещение — это обновит загруженность дня.</p>
      </div>
      <span class="weekly-plan-status" :class="{confirmed:confirmedAt}">
        <Check v-if="confirmedAt" :size="14" aria-hidden="true"/>
        <LockKeyhole v-else :size="14" aria-hidden="true"/>
        {{confirmedAt ? 'Закреплён' : 'Не закреплён'}}
      </span>
    </header>

    <div class="weekly-plan-pools">
      <section class="weekly-plan-pool" aria-label="Нераспределённые задачи">
        <div class="weekly-plan-pool-head"><strong>Задачи</strong><span>{{unscheduledTasks.length}}</span></div>
        <div v-if="unscheduledTasks.length" class="weekly-plan-pool-list">
          <button v-for="task in unscheduledTasks" :key="task.id" type="button" class="weekly-plan-item weekly-plan-task" :class="[`priority-${task.priority||'normal'}`,{selected:selectedPlanItem?.type==='task'&&selectedPlanItem.record.id===task.id}]" draggable="true" :aria-pressed="selectedPlanItem?.type==='task'&&selectedPlanItem.record.id===task.id" @click="selectTask(task)" @dragstart="beginTaskDrag(task,$event)" @dragend="cancelDrag">
            <GripVertical :size="14" aria-hidden="true"/><span><strong>{{task.title}}</strong><small>{{task.duration||30}} мин</small></span>
          </button>
        </div>
        <div v-else class="weekly-plan-pool-empty">Нет задач на эту неделю</div>
      </section>
      <section class="weekly-plan-pool" aria-label="Тренировки">
        <div class="weekly-plan-pool-head"><strong>Тренировки</strong><span>{{workouts.length}}</span></div>
        <div v-if="workouts.length" class="weekly-plan-pool-list">
          <button v-for="workout in workouts" :key="workout.id" type="button" class="weekly-plan-item weekly-plan-workout" :class="{selected:selectedPlanItem?.type==='workout'&&selectedPlanItem.record.id===workout.id}" draggable="true" :aria-pressed="selectedPlanItem?.type==='workout'&&selectedPlanItem.record.id===workout.id" @click="selectWorkout(workout)" @dragstart="beginWorkoutDrag(workout,$event)" @dragend="cancelDrag">
            <GripVertical :size="14" aria-hidden="true"/><Dumbbell :size="14" aria-hidden="true"/><span><strong>{{workout.title}}</strong><small>{{workout.duration||60}} мин</small></span>
          </button>
        </div>
        <div v-else class="weekly-plan-pool-empty">Нет программ тренировок</div>
      </section>
    </div>

    <div v-if="selectedPlanItem" class="weekly-plan-selection" role="status">
      <strong>{{selectedPlanTitle}}</strong><button type="button" class="close" aria-label="Снять выбор" @click="selectedPlanItem=null"><X :size="14"/></button>
    </div>

    <div class="weekly24-scroll" aria-label="Недельный календарь">
      <div class="weekly24-grid">
        <div class="weekly24-head-spacer"><span>24 ч</span></div>
        <header v-for="day in days" :key="`head-${day.key}`" class="weekly24-day-head" :class="[{today:day.isToday,saturday:day.weekdayNumber===6},`day-mode-${day.dayMode}`]">
          <div class="weekly24-date"><strong>{{day.weekdayShort}}</strong><span>{{day.dateLabel}}</span><small v-if="day.classCount" class="weekly24-class-count">{{day.attendingClassCount}}/{{day.classCount}} пар</small></div>
          <div class="weekly24-day-modes" role="group" :aria-label="`Режим дня: ${day.weekday} ${dateLabel(day.key)}`">
            <button v-for="mode in DAY_MODES" :key="mode.id" type="button" class="weekly24-mode-dot" :class="{active:day.dayMode===mode.id}" :style="{'--day-mode-color':mode.color}" :aria-label="mode.label" :aria-pressed="day.dayMode===mode.id" :title="`${mode.label} · ${mode.description}`" @click="selectDayMode(day,mode)"></button>
          </div>
          <label class="weekly24-wake-label">Подъём
            <input type="time" :value="wakeTimes[day.key]||''" :aria-label="`Подъём: ${day.weekday} ${dateLabel(day.key)}`" @change="wakeTimeChanged(day,$event)"/>
          </label>
          <label class="weekly24-step-label">Первый шаг
            <input type="text" maxlength="80" :value="wakeSteps[day.key]||''" :aria-label="`Первый шаг: ${day.weekday} ${dateLabel(day.key)}`" placeholder="Задача" @change="wakeStepChanged(day,$event)"/>
          </label>
        </header>

        <div class="weekly24-axis" aria-hidden="true">
          <span v-for="hour in hours" :key="hour" :class="{major:hour%6===0}">{{padded(hour)}}:00</span>
          <b>24:00</b>
        </div>
        <div v-for="day in days" :key="day.key" class="weekly24-day-track" :class="[{today:day.isToday, 'drag-over':draggingOverDate===day.key},`day-mode-${day.dayMode}`]" :aria-label="`${day.weekday}, ${dateLabel(day.key)}, 00:00–24:00`" @click="selectSlot($event,day)" @dragover.prevent="draggingOverDate=day.key" @dragleave="draggingOverDate=''" @drop.prevent.stop="handleDrop($event,day)">
          <div v-if="wakeTimes[day.key]" class="weekly24-wake-marker" :style="{top:`${timeToMinute(wakeTimes[day.key])/60*42}px`}" aria-hidden="true"><span>{{wakeTimes[day.key]}}</span></div>
          <template v-for="event in day.events" :key="event.id">
            <button v-if="event.type==='rest'" type="button" class="weekly24-event" :class="[eventClass(event),{compact:Number(event.duration)<=30}]" :style="eventStyle(event)" :aria-label="`Убрать ${event.title}, ${day.weekday} ${event.startTime}`" @click.stop="addRestEvent(event)">
              <strong>{{event.title}}</strong><small>{{event.startTime}}</small><X :size="11" aria-hidden="true"/>
            </button>
            <button v-else-if="event.type==='workout'" type="button" class="weekly24-event" :class="[eventClass(event),{compact:Number(event.duration)<=30}]" :style="eventStyle(event)" :aria-label="`Убрать тренировку ${event.title}, ${day.weekday} ${event.startTime}`" @click.stop="removeWorkoutEvent(event)">
              <strong>{{event.title}}</strong><small>{{event.startTime}}</small><X :size="11" aria-hidden="true"/>
            </button>
            <button v-else-if="event.type==='class'" type="button" class="weekly24-event" :class="[eventClass(event),{attending:event.attending,'not-attending':!event.attending}]" :style="eventStyle(event)" :aria-pressed="event.attending" :aria-label="`${event.title}, ${day.weekday} ${day.dateLabel}, ${event.startTime}. ${event.attending?'Планирую пойти':'Не планирую идти'}. Нажмите, чтобы изменить посещение.`" :title="`${event.title} · ${event.startTime}–${event.endTime} · ${event.attending?'Пойду':'Не пойду'} · ${event.detail}`" @click.stop="emit('toggle-class-attendance',{dateKey:day.key,classId:event.classId})">
              <strong>{{event.title}}</strong><small>{{event.startTime}} · {{event.attending?'Иду':'Не иду'}}</small>
            </button>
            <article v-else class="weekly24-event" :class="[eventClass(event),{compact:Number(event.duration)<=30}]" :style="eventStyle(event)" :draggable="event.type==='task'&&!event.source?.done" :title="`${event.title} · ${event.startTime}${event.endTime?`–${event.endTime}`:''}`" @click.stop @dragstart="beginScheduledTaskDrag(event,$event)" @dragend="cancelDrag">
              <strong>{{event.title}}</strong><small>{{event.startTime}}<template v-if="event.detail&&event.type!=='task'"> · {{event.detail}}</template></small>
            </article>
          </template>
          <div v-if="hasSelectedSlot&&selectedDateKey===day.key" class="weekly24-selection" :style="{top:`${timeToMinute(selectedTime)/60*42}px`}" aria-hidden="true"><span>{{selectedTime}}</span></div>
        </div>
      </div>
    </div>

    <div class="weekly24-rest-tools">
      <div class="weekly24-rest-heading">
        <strong>Отдых</strong>
        <div class="weekly24-rest-time">
          <label>День
            <select v-model="selectedDateKey" aria-label="День отдыха" @change="hasSelectedSlot=true">
              <option v-for="day in days" :key="day.key" :value="day.key">{{day.weekday}} · {{day.dateLabel}}</option>
            </select>
          </label>
          <label>Время
            <input v-model="selectedTime" type="time" aria-label="Время отдыха" @change="hasSelectedSlot=Boolean(selectedTime)"/>
          </label>
        </div>
      </div>
      <div class="weekly24-rest-options" role="group" aria-label="Варианты отдыха">
        <button v-for="activity in REST_ACTIVITIES" :key="activity.id" type="button" :aria-keyshortcuts="activity.shortcut" :aria-label="`${activity.shortcut}: ${activity.title}, ${activity.duration} минут`" @click="addRest(activity)">
          <kbd>{{activity.shortcut}}</kbd><span>{{activity.title}}</span><small>{{activity.duration}} мин</small>
        </button>
      </div>
    </div>

    <footer class="weekly24-confirm">
      <span>{{wakeCount}} / 7</span>
      <button type="button" class="primary-btn" :disabled="!canConfirm" @click="emit('confirm')">
        <Check :size="15" aria-hidden="true"/> Сохранить неделю
      </button>
    </footer>
    <p class="weekly24-announcement" aria-live="polite">{{announcement}}</p>
  </section>
</template>
