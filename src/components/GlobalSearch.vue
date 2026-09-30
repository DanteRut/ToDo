<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Search, X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'select'])
const query = ref('')
const input = ref(null)

const normalize = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ')
const results = computed(() => {
  const search = normalize(query.value)
  if (!search) return []
  return props.items.map(item => {
    const title = normalize(item.title)
    const text = normalize(`${item.kindLabel || ''} ${item.searchText || ''} ${item.detail || ''} ${item.title}`)
    if (!text.includes(search)) return null
    const score = title === search ? 0 : title.startsWith(search) ? 1 : title.includes(search) ? 2 : 3
    return { item, score }
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title, 'ru')).slice(0, 30).map(entry => entry.item)
})

watch(() => props.open, async isOpen => {
  if (!isOpen) return
  query.value = ''
  await nextTick()
  input.value?.focus()
})

function selectResult(item = results.value[0]) {
  if (item) emit('select', item)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="modal-backdrop global-search-backdrop" @click.self="emit('close')">
      <section class="modal global-search-modal" role="dialog" aria-modal="true" aria-label="Глобальный поиск">
        <div class="modal-head">
          <div>
            <div class="eyebrow">Задачи · цепочки · проекты · ДЗ · ритуалы</div>
            <div class="modal-title">Поиск по приложению</div>
          </div>
          <button class="close" type="button" aria-label="Закрыть поиск" @click="emit('close')"><X :size="17"/></button>
        </div>

        <div class="global-search-input-wrap">
          <Search :size="17" aria-hidden="true"/>
          <input
            ref="input"
            v-model="query"
            class="input global-search-input"
            type="search"
            placeholder="Название, предмет, проект, заметка…"
            aria-label="Поиск задач, проектов, ДЗ и ритуалов"
            @keydown.enter.prevent="selectResult()"
            @keydown.esc.stop.prevent="emit('close')"
          />
          <kbd>Esc</kbd>
        </div>

        <p v-if="!query.trim()" class="global-search-hint">Начни вводить запрос. Поиск охватывает задачи, заметки, цепочки, проекты, домашние задания, ритуалы, входящие и тренировки.</p>
        <div v-else-if="results.length" class="global-search-results" role="listbox" aria-label="Результаты поиска">
          <button v-for="item in results" :key="item.key" class="global-search-result" type="button" role="option" @click="selectResult(item)">
            <span class="global-search-icon"><component :is="item.icon" :size="16" aria-hidden="true"/></span>
            <span class="global-search-copy"><strong>{{item.title}}</strong><small>{{item.detail}}</small></span>
            <span class="global-search-kind">{{item.kindLabel}}</span>
            <ChevronRight :size="15" class="global-search-arrow" aria-hidden="true"/>
          </button>
        </div>
        <div v-else class="global-search-empty">Ничего не найдено. Попробуй другое слово.</div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.global-search-modal{width:min(680px,100%);padding:19px}
.global-search-input-wrap{display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid #393341;border-radius:13px;background:#101116;color:#a78bfa}
.global-search-input{min-width:0;padding:7px 0;border:0;background:transparent;box-shadow:none!important;color:#f4f4f5;font-size:13px}
.global-search-input:focus{border:0;box-shadow:none!important}
.global-search-input-wrap kbd{flex:0 0 auto;padding:4px 6px;border:1px solid #30313a;border-radius:6px;color:#858895;font-size:9px}
.global-search-hint,.global-search-empty{margin:0;padding:22px 8px 8px;color:#858895;font-size:11px;line-height:1.55}
.global-search-results{display:grid;gap:3px;max-height:min(55vh,460px);margin-top:11px;overflow:auto}
.global-search-result{display:grid;grid-template-columns:30px minmax(0,1fr) auto 16px;align-items:center;gap:10px;width:100%;padding:10px;border:1px solid transparent;border-radius:10px;background:transparent;color:#ededf0;text-align:left;cursor:pointer}
.global-search-result:hover,.global-search-result:focus-visible{border-color:#4a3b61;background:#201a2b;outline:0}
.global-search-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#25202f;color:#c4b5fd}
.global-search-copy{display:grid;gap:3px;min-width:0}
.global-search-copy strong,.global-search-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.global-search-copy strong{font-size:11px}
.global-search-copy small{color:#828591;font-size:9px}
.global-search-kind{color:#a78bfa;font-size:8px;white-space:nowrap}
.global-search-arrow{color:#6d707b}
@media(max-width:560px){.global-search-modal{padding:15px}.global-search-result{grid-template-columns:28px minmax(0,1fr) 14px;gap:8px;padding:8px}.global-search-kind{display:none}}
</style>
