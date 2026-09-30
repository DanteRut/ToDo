<script setup>
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowRight, BookOpen, Check, Clock3, NotebookPen, Target } from 'lucide-vue-next'

const props = defineProps({
  summary: { type: Object, required: true },
  selectedDate: { type: String, required: true },
  subjectProjects: { type: Array, default: () => [] }
})
const emit = defineEmits(['select-day', 'open-item'])
const shortDate = dateKey => format(parseISO(dateKey), 'd MMM', { locale: ru })
const formatHours = minutes => `${Math.round(minutes / 60 * 10) / 10} ч`
</script>

<template>
  <section class="study-week-overview card" aria-labelledby="study-week-heading">
    <header class="study-week-header">
      <div>
        <div class="eyebrow">Планирование и контроль</div>
        <h3 id="study-week-heading">Обзор учебной недели</h3>
        <span class="section-meta">{{summary.rangeLabel}}</span>
      </div>
    </header>

    <div class="study-week-metrics" aria-label="Итоги учебной недели">
      <article><strong>{{summary.classCount}}</strong><span>пар</span><BookOpen :size="15"/></article>
      <article><strong>{{summary.openHomeworkCount}}</strong><span>ДЗ к сдаче</span><NotebookPen :size="15"/></article>
      <article><strong>{{summary.deadlineCount}}</strong><span>дедлайнов</span><Target :size="15"/></article>
      <article><strong>{{summary.completedTaskCount}}/{{summary.taskCount}}</strong><span>задач выполнено</span><Check :size="15"/></article>
      <article><strong>{{summary.ritualsDone}}/{{summary.ritualsTotal}}</strong><span>ритуалов</span><Clock3 :size="15"/></article>
    </div>

    <div class="study-week-days" aria-label="Нагрузка по дням недели">
      <button
        v-for="day in summary.days"
        :key="day.key"
        type="button"
        class="study-week-day"
        :class="{selected:day.key===selectedDate,overload:day.overload}"
        :aria-label="`${day.weekday}, ${day.dateLabel}: ${day.classCount} пар, ${day.openHomeworkCount} ДЗ, нагрузка ${formatHours(day.plannedMinutes)}`"
        @click="emit('select-day',day.key)"
      >
        <span class="study-week-day-head"><strong>{{day.weekday}}</strong><small>{{day.dateLabel}}</small></span>
        <span class="study-week-day-stats"><span>{{day.classCount}} пар</span><span>{{day.openHomeworkCount}} ДЗ</span><span>{{day.deadlineCount}} сроков</span></span>
        <span class="study-week-load"><i :style="{width:`${day.loadPercent}%`}"></i></span>
        <span class="study-week-load-label">{{formatHours(day.plannedMinutes)}} нагрузки <b v-if="day.overload">· перегрузка</b></span>
      </button>
    </div>

    <div class="study-week-lower">
      <section class="study-week-due" aria-label="Задания со сроком на этой неделе">
        <div class="study-week-section-title"><strong>Сдать на этой неделе</strong><span>{{summary.dueItems.length}}</span></div>
        <button v-for="item in summary.dueItems.slice(0,6)" :key="item.key" type="button" class="study-week-due-item" :class="{done:item.done}" @click="emit('open-item',item)">
          <time :datetime="item.dateKey">{{shortDate(item.dateKey)}}</time>
          <span><strong>{{item.title}}</strong><small>{{item.kindLabel}} · {{item.detail}}</small></span>
          <Check v-if="item.done" :size="14" aria-label="Выполнено"/>
          <ArrowRight v-else :size="14" aria-hidden="true"/>
        </button>
        <p v-if="!summary.dueItems.length" class="study-week-empty">На этой неделе пока нет ДЗ или контрольных точек со сроком.</p>
        <p v-else-if="summary.dueItems.length>6" class="study-week-more">Показаны ближайшие 6 из {{summary.dueItems.length}}</p>
      </section>

      <section v-if="subjectProjects.length" class="study-week-subjects" aria-label="Прогресс по предметам">
        <div class="study-week-section-title"><strong>Проекты по предметам</strong><span>{{subjectProjects.length}}</span></div>
        <article v-for="project in subjectProjects" :key="project.id" class="study-week-project">
          <span><strong>{{project.subject}}</strong><small>{{project.path}}</small></span>
          <b>{{project.progress}}%</b>
          <div class="study-week-project-progress"><i :style="{width:`${project.progress}%`}"></i></div>
          <small class="study-week-project-count">{{project.done}} из {{project.total}} задач</small>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.study-week-overview{padding:18px;margin:0 0 16px;overflow:hidden}
.study-week-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.study-week-header h3{margin:4px 0;font-size:15px}
.study-week-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:13px}
.study-week-metrics article{display:grid;grid-template-columns:1fr auto;gap:3px 5px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--panel2) 75%,transparent)}
.study-week-metrics article strong{font-size:15px;line-height:1.1;font-variant-numeric:tabular-nums}
.study-week-metrics article span{grid-column:1;color:var(--muted);font-size:8px}
.study-week-metrics article svg{grid-column:2;grid-row:1/3;color:var(--purple2)}
.study-week-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.study-week-day{min-width:0;padding:10px 9px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.study-week-day:hover,.study-week-day.selected{border-color:var(--purple);background:color-mix(in srgb,var(--purple) 10%,var(--panel))}
.study-week-day.overload{border-color:#783747}
.study-week-day-head,.study-week-day-stats,.study-week-day-head strong,.study-week-day-head small{display:flex}
.study-week-day-head{justify-content:space-between;gap:4px;align-items:baseline}
.study-week-day-head strong{font-size:9px;text-transform:capitalize}
.study-week-day-head small{color:var(--muted);font-size:8px;white-space:nowrap}
.study-week-day-stats{flex-wrap:wrap;gap:3px 7px;margin-top:8px;color:#aeb0b8;font-size:7px}
.study-week-load{display:block;height:4px;margin-top:9px;border-radius:9px;background:var(--line);overflow:hidden}
.study-week-load i{display:block;height:100%;border-radius:inherit;background:var(--green)}
.study-week-day.overload .study-week-load i{background:#fb7185}
.study-week-load-label{display:block;margin-top:5px;color:var(--muted);font-size:7px}
.study-week-load-label b{color:#fb7185;font-weight:650}
.study-week-lower{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(210px,.75fr);gap:12px;margin-top:14px}
.study-week-due,.study-week-subjects{min-width:0;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:color-mix(in srgb,var(--panel) 75%,transparent)}
.study-week-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
.study-week-section-title strong{font-size:9px}
.study-week-section-title>span{min-width:18px;padding:3px 5px;border-radius:6px;background:var(--panel2);color:var(--muted);font-size:7px;text-align:center}
.study-week-due-item{display:grid;grid-template-columns:42px minmax(0,1fr) 15px;gap:7px;align-items:center;width:100%;padding:7px 0;border:0;border-top:1px solid var(--line);background:transparent;color:inherit;text-align:left;cursor:pointer}
.study-week-due-item:hover{color:var(--purple2)}
.study-week-due-item time{color:var(--purple2);font-size:8px;white-space:nowrap}
.study-week-due-item>span{display:grid;gap:2px;min-width:0}
.study-week-due-item strong,.study-week-due-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-due-item strong{font-size:8px}
.study-week-due-item small{color:var(--muted);font-size:7px}
.study-week-due-item>svg{color:var(--muted)}
.study-week-due-item.done{opacity:.62}
.study-week-due-item.done strong{text-decoration:line-through}
.study-week-empty,.study-week-more{margin:10px 0 2px;color:var(--muted);font-size:8px;line-height:1.45}
.study-week-project{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 8px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}
.study-week-project>span{display:grid;gap:2px;min-width:0}
.study-week-project>span strong,.study-week-project>span small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-project>span strong{font-size:8px}
.study-week-project>span small,.study-week-project-count{color:var(--muted);font-size:7px}
.study-week-project>b{font-size:8px;color:var(--purple2)}
.study-week-project-progress{grid-column:1/-1;height:4px;border-radius:8px;background:var(--line);overflow:hidden}
.study-week-project-progress i{display:block;height:100%;border-radius:inherit;background:var(--purple2)}
.study-week-project-count{grid-column:1/-1;text-align:right}
@media(max-width:820px){.study-week-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.study-week-days{grid-template-columns:repeat(4,minmax(0,1fr))}.study-week-lower{grid-template-columns:1fr}}
@media(max-width:560px){.study-week-overview{padding:13px}.study-week-days{grid-template-columns:1fr 1fr}.study-week-day:last-child{grid-column:1/-1}.study-week-metrics article{padding:8px}.study-week-metrics article strong{font-size:13px}}
</style>
