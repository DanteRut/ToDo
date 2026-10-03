<script setup>
import { computed, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Check, LockKeyhole, X } from 'lucide-vue-next'
import { hasScheduleConflict, isWakePlanComplete, REST_ACTIVITIES, timeToMinute } from '../utils/weeklyPlan'

const props = defineProps({
  days: { type: Array, required: true },
  selectedDate: { type: String, required: true },
  wakeTimes: { type: Object, default: () => ({}) },
  wakeSteps: { type: Object, default: () => ({}) },
  confirmedAt: { type: String, default: null }
})
const emit = defineEmits(['wake-time', 'wake-step', 'add-rest-block', 'remove-rest-block', 'confirm'])
const plannerRoot = ref(null)
const selectedDateKey = ref('')
const selectedTime = ref('')
const hasSelectedSlot = ref(false)
const announcement = ref('Нажми на свободное место в расписании, затем выбери отдых клавишей 1–7.')
const hours = Array.from({ length: 24 }, (_, hour) => hour)
const wakeCount = computed(() => props.days.filter(day => timeToMinute(props.wakeTimes[day.key]) !== null && timeToMinute(props.wakeTimes[day.key]) < 1440).length)
const canConfirm = computed(() => isWakePlanComplete(props.days, props.wakeTimes))

watch(() => [props.selectedDate, props.days.map(day => day.key).join('|')], ([selectedDate, dayKeys]) => {
  const keys = dayKeys.split('|').filter(Boolean)
  selectedDateKey.value = keys.includes(selectedDate) ? selectedDate : (keys[0] || '')
  selectedTime.value = ''
  hasSelectedSlot.value = false
}, { immediate: true })

function padded(value) { return String(value).padStart(2, '0') }
function dateLabel(dateKey) { return format(parseISO(dateKey), 'd MMM', { locale: ru }) }
function selectSlot(event, dateKey) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const slotHeight = bounds.height / 48
  const slot = Math.min(47, Math.max(0, Math.floor((event.clientY - bounds.top) / slotHeight)))
  selectedDateKey.value = dateKey
  selectedTime.value = `${padded(Math.floor(slot / 2))}:${slot % 2 ? '30' : '00'}`
  hasSelectedSlot.value = true
  announcement.value = `Выбрано ${dateLabel(dateKey)} в ${selectedTime.value}. Нажми клавишу 1–7, чтобы добавить отдых.`
  plannerRoot.value?.focus({ preventScroll: true })
}
function eventStyle(event) {
  const start = timeToMinute(event.startTime)
  if (start === null || start >= 1440) return { display: 'none' }
  const end = event.endTime ? timeToMinute(event.endTime) : start + (Number(event.duration) || 30)
  if (end === null) return { display: 'none' }
  const height = 42
  const duration = Math.max(1, Math.min(1440, end) - start)
  return { top: `${start / 60 * height}px`, height: `${Math.max(18, duration / 60 * height)}px` }
}
function eventClass(event) { return `weekly24-event-${event.type}` }
function addRest(activity) {
  if (!hasSelectedSlot.value || !selectedDateKey.value || !selectedTime.value) {
    announcement.value = 'Сначала выбери день и время для отдыха на сетке или в полях ниже.'
    return
  }
  const day = props.days.find(item => item.key === selectedDateKey.value)
  if (!day || hasScheduleConflict(selectedTime.value, activity.duration, day.events)) {
    announcement.value = 'В это время уже есть событие или отдых не помещается до 24:00. Выбери другой слот.'
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
</script>

<template>
  <section ref="plannerRoot" class="weekly-routine-planner card" tabindex="0" aria-labelledby="weekly-routine-title" @keydown="onKeydown">
    <header class="weekly-routine-head">
      <div>
        <div class="eyebrow">План недели · удобно в субботу</div>
        <h2 id="weekly-routine-title">Подъём и отдых · вся неделя</h2>
        <p>Задай время подъёма на каждый день; первый шаг после пробуждения — по желанию. Кликни на свободное время и нажми 1–7, чтобы добавить отдых. Расписание — 00:00–24:00.</p>
      </div>
      <span class="weekly-plan-status" :class="{confirmed:confirmedAt}">
        <Check v-if="confirmedAt" :size="14" aria-hidden="true"/>
        <LockKeyhole v-else :size="14" aria-hidden="true"/>
        {{confirmedAt ? 'План закреплён' : 'План ещё не закреплён'}}
      </span>
    </header>

    <div class="weekly24-scroll" aria-label="Недельное расписание с 00:00 до 24:00">
      <div class="weekly24-grid">
        <div class="weekly24-head-spacer"><span>24 часа</span></div>
        <header v-for="day in days" :key="`head-${day.key}`" class="weekly24-day-head" :class="{today:day.isToday,saturday:day.weekdayNumber===6}">
          <div class="weekly24-date"><strong>{{day.weekdayShort}}</strong><span>{{day.dateLabel}}</span><small v-if="day.isToday">Сегодня</small></div>
          <label class="weekly24-wake-label">Подъём
            <input type="time" :value="wakeTimes[day.key]||''" :aria-label="`Время подъёма: ${day.weekday} ${dateLabel(day.key)}`" @change="wakeTimeChanged(day,$event)"/>
          </label>
          <label class="weekly24-step-label">Первый шаг
            <input type="text" maxlength="80" :value="wakeSteps[day.key]||''" :aria-label="`Первый шаг после подъёма: ${day.weekday} ${dateLabel(day.key)}`" placeholder="Например, вода и душ" @change="wakeStepChanged(day,$event)"/>
          </label>
        </header>

        <div class="weekly24-axis" aria-hidden="true">
          <span v-for="hour in hours" :key="hour" :class="{major:hour%6===0}">{{padded(hour)}}:00</span>
          <b>24:00</b>
        </div>
        <div v-for="day in days" :key="day.key" class="weekly24-day-track" :class="{today:day.isToday}" :aria-label="`${day.weekday}, ${dateLabel(day.key)}, 00:00–24:00`" @click="selectSlot($event,day.key)">
          <div v-if="wakeTimes[day.key]" class="weekly24-wake-marker" :style="{top:`${timeToMinute(wakeTimes[day.key])/60*42}px`}" aria-hidden="true"><span>Подъём {{wakeTimes[day.key]}}</span></div>
          <template v-for="event in day.events" :key="event.id">
            <button v-if="event.type==='rest'" type="button" class="weekly24-event" :class="[eventClass(event),{compact:Number(event.duration)<=30}]" :style="eventStyle(event)" :title="`${event.title} · ${event.startTime} · ${event.duration} мин. Нажми, чтобы убрать`" :aria-label="`Убрать отдых ${event.title}, ${day.weekday} в ${event.startTime}`" @click.stop="emit('remove-rest-block',event.id)">
              <strong>{{event.title}}</strong><small>{{event.startTime}} · {{event.duration}} мин</small><X :size="11" aria-hidden="true"/>
            </button>
            <article v-else class="weekly24-event" :class="[eventClass(event),{compact:Number(event.duration)<=30}]" :style="eventStyle(event)" :title="`${event.title} · ${event.startTime}${event.endTime?`–${event.endTime}`:''}`" @click.stop>
              <strong>{{event.title}}</strong><small>{{event.detail||event.startTime}}</small>
            </article>
          </template>
          <div v-if="hasSelectedSlot&&selectedDateKey===day.key" class="weekly24-selection" :style="{top:`${timeToMinute(selectedTime)/60*42}px`}" aria-hidden="true"><span>{{selectedTime}}</span></div>
        </div>
      </div>
    </div>

    <div class="weekly24-rest-tools">
      <div class="weekly24-rest-heading">
        <div><strong>Запланировать восстановление</strong><span>Выбери свободное время на сетке. Затем нажми цифру 1–7 или кнопку.</span></div>
        <div class="weekly24-rest-time">
          <label>День
            <select v-model="selectedDateKey" aria-label="День для отдыха" @change="hasSelectedSlot=true">
              <option v-for="day in days" :key="day.key" :value="day.key">{{day.weekday}} · {{day.dateLabel}}</option>
            </select>
          </label>
          <label>Время · 24 ч
            <input v-model="selectedTime" type="time" aria-label="Время начала отдыха" @change="hasSelectedSlot=Boolean(selectedTime)"/>
          </label>
        </div>
      </div>
      <div class="weekly24-rest-options" role="group" aria-label="Варианты отдыха. Используй клавиши от 1 до 7">
        <button v-for="activity in REST_ACTIVITIES" :key="activity.id" type="button" :aria-keyshortcuts="activity.shortcut" :aria-label="`${activity.shortcut}: ${activity.title}, ${activity.duration} минут`" @click="addRest(activity)">
          <kbd>{{activity.shortcut}}</kbd><span>{{activity.title}}</span><small>{{activity.duration}} мин</small>
        </button>
      </div>
      <p class="weekly24-announcement" aria-live="polite">{{announcement}}</p>
    </div>

    <footer class="weekly24-confirm">
      <span>{{wakeCount}} из 7 дней имеют время подъёма. Чтобы план был определённым, задай время на каждый день.</span>
      <button type="button" class="primary-btn" :disabled="!canConfirm" @click="emit('confirm')">
        <Check :size="15" aria-hidden="true"/> Закрепить план недели
      </button>
    </footer>
  </section>
</template>
