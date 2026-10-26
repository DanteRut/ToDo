<script setup>
import { computed, ref, watch } from 'vue'
import { Activity, CalendarDays, Footprints, Moon, SlidersHorizontal } from 'lucide-vue-next'
import { calculateDayBalance, normalizeDayBalanceTargets } from '../utils/dayWellbeing'

const props = defineProps({
  loadMinutes: { type: Number, default: 0 },
  sleepMinutes: { type: Number, default: null },
  plannedSleepMinutes: { type: Number, default: null },
  sleepSource: { type: String, default: 'не задано' },
  bedTime: { type: String, default: '' },
  plannedWakeTime: { type: String, default: '' },
  walkMinutes: { type: Number, default: 0 },
  restMinutes: { type: Number, default: 0 },
  restBlocks: { type: Array, default: () => [] },
  targets: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['save-targets', 'edit-sleep', 'edit-measurement', 'open-weekly'])

const targetsOpen = ref(false)
const targetDraft = ref(normalizeDayBalanceTargets(props.targets))
const balance = computed(() => calculateDayBalance({
  loadMinutes: props.loadMinutes,
  sleepMinutes: props.sleepMinutes,
  walkMinutes: props.walkMinutes,
  restMinutes: props.restMinutes,
  targets: props.targets
}))
const recoveryClass = computed(() => `status-${balance.value.status}`)
const roundedLoadMinutes = computed(() => Math.round(props.loadMinutes))
const displaySleepMinutes = computed(() => props.sleepMinutes ?? props.plannedSleepMinutes)
const sleepHoursLabel = computed(() => displaySleepMinutes.value === null || displaySleepMinutes.value === undefined
  ? 'не задано'
  : `${(displaySleepMinutes.value / 60).toFixed(1).replace('.', ',')} ч`)
const plannedSleepLabel = computed(() => props.plannedSleepMinutes === null || props.plannedSleepMinutes === undefined
  ? ''
  : `Окно сна на ночь: ${(props.plannedSleepMinutes / 60).toFixed(1).replace('.', ',')} ч`)
const sleepScheduleLabel = computed(() => props.bedTime && props.plannedWakeTime
  ? `Режим: отбой ${props.bedTime} → подъём ${props.plannedWakeTime}`
  : '')

watch([() => props.targets.sleepHours, () => props.targets.walkMinutes, () => props.targets.restMinutes], ([sleepHours, walkMinutes, restMinutes]) => {
  targetDraft.value = normalizeDayBalanceTargets({ sleepHours, walkMinutes, restMinutes })
})

function saveTargets() {
  const targets = normalizeDayBalanceTargets(targetDraft.value)
  targetDraft.value = targets
  emit('save-targets', targets)
  targetsOpen.value = false
}
function formatBlock(block) {
  const duration = Math.max(1, Number(block.duration) || 0)
  return `${block.startTime || 'Время не задано'} · ${duration} мин`
}
</script>

<template>
  <section class="day-balance-card card" aria-labelledby="day-balance-title">
    <header class="day-balance-heading">
      <div>
        <div class="eyebrow">План нагрузки и восстановления</div>
        <h2 id="day-balance-title">Баланс дня</h2>
      </div>
      <button type="button" class="ghost-btn day-balance-settings-toggle" :aria-expanded="targetsOpen" @click="targetsOpen=!targetsOpen">
        <SlidersHorizontal :size="14" aria-hidden="true"/> Ориентиры
      </button>
    </header>

    <div class="day-balance-status" :class="recoveryClass" role="status">
      <strong>{{balance.statusTitle}}</strong>
      <span>{{balance.statusDescription}}</span>
    </div>

    <div class="day-balance-bars">
      <div class="day-balance-bar-block load">
        <div class="day-balance-bar-label"><span><Activity :size="14" aria-hidden="true"/> Нагрузка</span><strong>{{roundedLoadMinutes}} / {{balance.loadTargetMinutes}} мин · {{balance.loadPercent}}%</strong></div>
        <div class="day-balance-progress" role="meter" aria-label="Плановая нагрузка относительно цели шесть часов" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.min(balance.loadPercent,100)" :aria-valuetext="`${roundedLoadMinutes} из ${balance.loadTargetMinutes} минут, ${balance.loadPercent} процентов`"><span :style="{width:`${Math.min(balance.loadPercent,100)}%`}"></span></div>
      </div>
      <div class="day-balance-bar-block recovery">
        <div class="day-balance-bar-label"><span><Moon :size="14" aria-hidden="true"/> Восстановление к личным целям</span><strong>{{balance.recoveryPercent}}%</strong></div>
        <div class="day-balance-progress" role="meter" aria-label="Выполнение личных целей восстановления" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="balance.recoveryPercent" :aria-valuetext="`${balance.recoveryPercent} процентов от личных целей сна, движения и отдыха`"><span :style="{width:`${balance.recoveryPercent}%`}"></span></div>
      </div>
    </div>

    <div class="day-balance-metrics">
      <div class="day-balance-metric" :class="{missing:balance.sleepPercent===0}">
        <Moon :size="14" aria-hidden="true"/><span><strong>Сон · {{sleepHoursLabel}}</strong><small>{{sleepSource==='факт'?'Факт из чек-ина':sleepSource==='план'?'Факта нет — показан запланированный интервал':'Сон не задан'}}</small></span><b v-if="balance.sleepPercent!==null">{{balance.sleepPercent}}%</b>
      </div>
      <div class="day-balance-metric" :class="{missing:balance.walkPercent===0}" v-if="balance.walkPercent!==null">
        <Footprints :size="14" aria-hidden="true"/><span><strong>Прогулка/лёгкая активность · {{walkMinutes}} / {{balance.walkTargetMinutes}} мин</strong><small>План в дневном расписании</small></span><b>{{balance.walkPercent}}%</b>
      </div>
      <div class="day-balance-metric" :class="{missing:balance.restPercent===0}" v-if="balance.restPercent!==null">
        <Activity :size="14" aria-hidden="true"/><span><strong>Отдых и перерывы · {{restMinutes}} / {{balance.restTargetMinutes}} мин</strong><small>Личный ориентир на день</small></span><b>{{balance.restPercent}}%</b>
      </div>
    </div>

    <div v-if="plannedSleepLabel || sleepSource==='факт' || sleepScheduleLabel" class="day-balance-sleep-note">
      <span v-if="sleepScheduleLabel">{{sleepScheduleLabel}}</span>
      <span v-if="plannedSleepLabel">{{plannedSleepLabel}}</span>
      <span v-if="sleepSource==='факт'">Факт: {{sleepHoursLabel}}</span>
      <button type="button" class="section-link" @click="emit('edit-sleep')">Настроить отбой и подъём</button>
      <button type="button" class="section-link" @click="emit('edit-measurement')">Записать сон</button>
    </div>
    <div v-else class="day-balance-sleep-note">
      <span>Задай отбой и подъём, чтобы оценить окно сна на ночь.</span>
      <button type="button" class="section-link" @click="emit('edit-sleep')">Задать сон</button>
      <button type="button" class="section-link" @click="emit('edit-measurement')">Записать факт</button>
    </div>

    <div class="day-balance-rest-plan">
      <div class="day-balance-rest-heading"><strong>Восстановительные активности</strong><button type="button" class="section-link" @click="emit('open-weekly')">Добавить в расписание</button></div>
      <ul v-if="restBlocks.length">
        <li v-for="block in restBlocks" :key="block.id"><span>{{block.title}}</span><small>{{formatBlock(block)}}</small></li>
      </ul>
      <p v-else>Пока нет запланированных прогулок или отдыха.</p>
    </div>

    <details class="day-balance-targets" :open="targetsOpen" @toggle="targetsOpen=$event.target.open">
      <summary><SlidersHorizontal :size="13" aria-hidden="true"/> Настроить личные цели</summary>
      <div class="day-balance-target-fields">
        <label>Сон, ч<input v-model.number="targetDraft.sleepHours" class="input" type="number" min="5" max="12" step="0.5" inputmode="decimal"/></label>
        <label>Прогулка, мин<input v-model.number="targetDraft.walkMinutes" class="input" type="number" min="0" max="360" step="5" inputmode="numeric"/></label>
        <label>Отдых/перерывы, мин<input v-model.number="targetDraft.restMinutes" class="input" type="number" min="0" max="360" step="5" inputmode="numeric"/></label>
        <button type="button" class="primary-btn" @click="saveTargets">Сохранить цели</button>
      </div>
    </details>

    <p class="day-balance-disclaimer">Нагрузка и восстановление не вычитаются друг из друга. Сон и регулярное движение — общие опоры здоровья; ориентир ВОЗ для взрослых — 150–300 минут умеренной активности в неделю. Лёгкая активность здесь не приравнивается к умеренной, цели прогулки и отдыха персональные, а эффект каждого досуга не гарантируется. Не медицинская оценка и не замена индивидуальной рекомендации.</p>
    <details class="day-balance-method">
      <summary>Как рассчитаны шкалы и итог?</summary>
      <ul>
        <li><strong>Нагрузка:</strong> минуты задач, занятий, домашней работы и тренировок относительно 360 минут. Шесть часов — ориентир планировщика, а не предел безопасной нагрузки; свыше него шкала показывает больше 100%.</li>
        <li><strong>Восстановление:</strong> среднее арифметическое выполнения активных личных целей сна, движения и отдыха; каждая цель ограничена 100%, цель с нулём минут исключается. Для сна берётся фактическая запись, если она есть, иначе — окно между запланированными отбоем и подъёмом. Движение и отдых считаются по расписанию.</li>
        <li>Режим сна виден по запланированному времени отбоя и подъёма; стабильность расписания между днями отдельно не оценивается.</li>
        <li><strong>Условный итог:</strong> «сбалансирован» — нагрузка не выше 360 минут и все активные цели закрыты; метка «дефицит» появляется, если нагрузка выше ориентира, а среднее покрытие целей ниже 60%. Порог 60% — только правило интерфейса, не клиническая граница.</li>
        <li>Это не валидированный индекс и не медицинская оценка: минуты нагрузки и восстановления несопоставимы, а план не подтверждает, что активность действительно выполнена.</li>
      </ul>
    </details>
    <a class="day-balance-source" href="https://www.who.int/initiatives/behealthy/physical-activity" target="_blank" rel="noopener noreferrer">ВОЗ: рекомендации по физической активности <CalendarDays :size="12" aria-hidden="true"/></a>
  </section>
</template>
