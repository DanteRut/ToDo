<script setup>
import { computed, ref } from 'vue'
import { Check, ChevronDown, Pill, Plus, Pencil, Trash2, X } from 'lucide-vue-next'
import { normalizeSupplementMeals, SUPPLEMENT_MEALS } from '../utils/supplementPlan'

const props = defineProps({
  supplements: { type: Array, default: () => [] },
  plan: { type: Object, default: null }
})
const emit = defineEmits(['toggle-planned', 'toggle-taken', 'add-supplement', 'edit-supplement', 'remove-supplement'])

const managementOpen = ref(false)
const editingId = ref('')
const draftTitle = ref('')
const draftDose = ref('')
const mealPlan = computed(() => normalizeSupplementMeals(props.plan?.meals))
const progress = computed(() => {
  const activeIds = new Set(props.supplements.map(item => item.id))
  const planned = SUPPLEMENT_MEALS.reduce((sum, meal) => sum + mealPlan.value[meal.id].plannedIds.filter(id => activeIds.has(id)).length, 0)
  const taken = SUPPLEMENT_MEALS.reduce((sum, meal) => sum + mealPlan.value[meal.id].takenIds.filter(id => activeIds.has(id)).length, 0)
  return { planned, taken, percent: planned ? Math.round(taken / planned * 100) : 0 }
})

function isPlanned(mealId, supplementId) {
  return mealPlan.value[mealId].plannedIds.includes(supplementId)
}
function isTaken(mealId, supplementId) {
  return mealPlan.value[mealId].takenIds.includes(supplementId)
}
function mealProgress(mealId) {
  const activeIds = new Set(props.supplements.map(item => item.id))
  const meal = mealPlan.value[mealId]
  return {
    planned: meal.plannedIds.filter(id => activeIds.has(id)).length,
    taken: meal.takenIds.filter(id => activeIds.has(id)).length
  }
}
function setPlanned(mealId, supplement, event) {
  emit('toggle-planned', { mealId, supplementId: supplement.id, checked: event.target.checked })
}
function setTaken(mealId, supplement, event) {
  emit('toggle-taken', { mealId, supplementId: supplement.id, checked: event.target.checked })
}
function resetDraft() {
  editingId.value = ''
  draftTitle.value = ''
  draftDose.value = ''
}
function startEdit(supplement) {
  editingId.value = supplement.id
  draftTitle.value = supplement.title || ''
  draftDose.value = supplement.dose || ''
  managementOpen.value = true
}
function submitSupplement() {
  const title = draftTitle.value.trim()
  if (!title) return
  const payload = { title, dose: draftDose.value.trim() }
  if (editingId.value) emit('edit-supplement', { id: editingId.value, ...payload })
  else emit('add-supplement', payload)
  resetDraft()
}
function cancelEdit() {
  resetDraft()
}
function removeSupplement(id) {
  if (editingId.value === id) resetDraft()
  emit('remove-supplement', id)
}
</script>

<template>
  <section class="supplement-planner card" aria-labelledby="supplement-planner-title">
    <header class="supplement-planner-heading">
      <div class="supplement-planner-title">
        <span class="supplement-planner-icon"><Pill :size="17" aria-hidden="true"/></span>
        <div><div class="eyebrow">Мой список и расписание</div><h2 id="supplement-planner-title">Добавки по приёмам пищи</h2></div>
      </div>
      <div class="supplement-intake-summary"><strong>{{progress.taken}} факт</strong><span>{{progress.planned}} запланировано</span></div>
    </header>

    <p class="supplement-planner-note">Ты сам задаёшь названия и дозы. Это только планировщик и журнал приёма — не рекомендация препарата, дозировки или времени.</p>

    <div v-if="supplements.length" class="supplement-meal-grid">
      <section v-for="meal in SUPPLEMENT_MEALS" :key="meal.id" class="supplement-meal-card">
        <header><h3>{{meal.label}}</h3><small>{{mealProgress(meal.id).taken}} факт · {{mealProgress(meal.id).planned}} план</small></header>
        <div v-for="supplement in supplements" :key="supplement.id" class="supplement-meal-row">
          <label class="supplement-plan-check">
            <input type="checkbox" :checked="isPlanned(meal.id, supplement.id)" :aria-label="`Запланировать ${supplement.title} на ${meal.label.toLowerCase()}`" @change="setPlanned(meal.id, supplement, $event)"/>
            <span><strong>{{supplement.title}}</strong><small v-if="supplement.dose">{{supplement.dose}}</small></span>
          </label>
          <label class="supplement-taken-check">
            <input type="checkbox" :checked="isTaken(meal.id, supplement.id)" :aria-label="`Отметить фактический приём: ${supplement.title}, ${meal.label.toLowerCase()}`" @change="setTaken(meal.id, supplement, $event)"/>
            <Check :size="13" aria-hidden="true"/> Факт
          </label>
        </div>
        <p v-if="!mealProgress(meal.id).planned" class="supplement-empty-meal">Ничего не запланировано</p>
      </section>
    </div>

    <div v-else class="supplement-empty-state">
      <Pill :size="18" aria-hidden="true"/><span>Добавь свой список, чтобы планировать приём на завтрак, обед или ужин.</span>
    </div>

    <div class="supplement-management">
      <button type="button" class="supplement-management-toggle" :aria-expanded="managementOpen" @click="managementOpen=!managementOpen">
        <span><Plus v-if="!supplements.length" :size="14" aria-hidden="true"/><Pencil v-else :size="13" aria-hidden="true"/> {{supplements.length?'Изменить мой список':'Добавить добавку'}}</span>
        <ChevronDown :size="15" :class="{rotated:managementOpen}" aria-hidden="true"/>
      </button>
      <div v-if="managementOpen" class="supplement-management-panel">
        <form class="supplement-form" @submit.prevent="submitSupplement">
          <label>Название<input v-model="draftTitle" class="input" type="text" maxlength="80" placeholder="Например, магний" required/></label>
          <label>Доза или заметка <span>(необязательно)</span><input v-model="draftDose" class="input" type="text" maxlength="120" placeholder="Запись по собственному плану"/></label>
          <div class="supplement-form-actions"><button type="submit" class="primary-btn"><Check :size="14"/> {{editingId?'Сохранить':'Добавить'}}</button><button v-if="editingId" type="button" class="ghost-btn" @click="cancelEdit"><X :size="14"/> Отмена</button></div>
        </form>
        <ul v-if="supplements.length" class="supplement-list">
          <li v-for="supplement in supplements" :key="supplement.id">
            <span><strong>{{supplement.title}}</strong><small v-if="supplement.dose">{{supplement.dose}}</small></span>
            <div><button type="button" class="icon-btn" :aria-label="`Изменить ${supplement.title}`" @click="startEdit(supplement)"><Pencil :size="14"/></button><button type="button" class="icon-btn danger" :aria-label="`Удалить ${supplement.title} из списка`" @click="removeSupplement(supplement.id)"><Trash2 :size="14"/></button></div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
