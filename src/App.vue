<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { format, parseISO, isToday, startOfMonth, startOfWeek, addDays, addMonths, subMonths, isSameMonth, differenceInCalendarDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { store, uid } from './services/storage'
import { cloud, initCloud, configureCloud, signIn, signUp, signOut, syncNow } from './services/cloud'
import {
  Check, Plus, Sun, CalendarDays, Dumbbell, Sparkles, Settings, ListTodo, MoreHorizontal,
  BriefcaseBusiness, Activity, CupSoda, Droplets, HeartPulse, ChevronLeft, ChevronRight,
  X, Zap, Coffee, Flame, Search, Cloud, CloudOff, RefreshCw, Download, Upload, Trash2,
  Play, Pause, RotateCcw, Clock3, Link2, CircleDot, LogOut, ShieldCheck, WifiOff, Pencil,
  CheckCircle2, Target, Timer, ArrowRight, Menu, SlidersHorizontal
} from 'lucide-vue-next'

const nav = [
  { id:'today', label:'Сегодня', icon:Sun }, { id:'tasks', label:'План', icon:ListTodo },
  { id:'calendar', label:'Календарь', icon:CalendarDays }, { id:'workouts', label:'Тренировки', icon:Dumbbell },
  { id:'habits', label:'Привычки', icon:Sparkles }, { id:'settings', label:'Настройки', icon:Settings }
]
const mobileNav = nav
const view = ref('today')
const quickOpen = ref(false), taskOpen = ref(false), workoutOpen = ref(false), cloudOpen = ref(false)
const toast = ref('')
const search = ref('')
const calendarMonth = ref(new Date())
const selectedDate = ref(store.today())
const editingTask = ref(null)
const selectedWorkout = ref(null)
const timerSeconds = ref(0), timerRunning = ref(false)
let timerInterval

const iconMap = { briefcase:BriefcaseBusiness, dumbbell:Dumbbell, activity:Activity, 'cup-soda':CupSoda, droplets:Droplets, 'heart-pulse':HeartPulse }
const todayKey = computed(() => store.today())
const dayTasks = computed(() => store.tasks.value.filter(t => t.date === selectedDate.value).sort(sortTask))
const dayChains = computed(() => store.chains.value.filter(c => c.date === selectedDate.value).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')))
const looseTasks = computed(() => dayTasks.value.filter(t => !t.chainId))
const completedCount = computed(() => dayTasks.value.filter(t => t.done).length)
const progress = computed(() => dayTasks.value.length ? Math.round(completedCount.value/dayTasks.value.length*100) : 0)
const activeTask = computed(() => dayTasks.value.find(t => !t.done && t.stage === 'action') || dayTasks.value.find(t => !t.done))
const allFilteredTasks = computed(() => store.tasks.value.filter(t => !search.value || t.title.toLowerCase().includes(search.value.toLowerCase())).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime)))
const dateTitle = computed(() => isToday(parseISO(selectedDate.value)) ? 'Сегодня' : format(parseISO(selectedDate.value), 'd MMMM, EEEE', {locale:ru}))
const monthDays = computed(() => {
  const monthStart = startOfMonth(calendarMonth.value)
  const gridStart = startOfWeek(monthStart, {weekStartsOn:1})
  return Array.from({length:42}, (_,i)=>addDays(gridStart,i))
})
const pageTitle = computed(() => nav.find(n=>n.id===view.value)?.label || 'Сегодня')

function sortTask(a,b){ return ((a.startTime||'99:99')+(a.order||0)).localeCompare((b.startTime||'99:99')+(b.order||0)) }
function flash(message){ toast.value=message; setTimeout(()=>toast.value='',2200) }
function tasksForChain(id){ return dayTasks.value.filter(t=>t.chainId===id).sort((a,b)=>(a.order||0)-(b.order||0)) }
function chainProgress(id){ const list=tasksForChain(id); return list.length ? `${list.filter(t=>t.done).length}/${list.length}` : '0/0' }
async function toggleTask(task){ await store.save({...task,done:!task.done}); if(!task.done){navigator.vibrate?.(35); flash('Готово. Продолжай движение')} syncSoon() }
async function toggleHabit(habit){ const history={...(habit.history||{})}; const current=history[todayKey.value]||0; history[todayKey.value]=current>=habit.target?0:current+1; await store.save({...habit,history}); navigator.vibrate?.(25); syncSoon() }
function habitValue(h){return h.history?.[todayKey.value]||0}
function habitStreak(h){ let streak=0; for(let i=0;i<365;i++){const d=format(addDays(new Date(),-i),'yyyy-MM-dd'); if((h.history?.[d]||0)>=h.target)streak++;else if(i>0)break;else if(i===0)continue} return streak }
function stageLabel(s){return ({prepare:'Подготовка',action:'Действие',finish:'Завершение'}[s]||'Действие')}
function dayRecords(date){const key=format(date,'yyyy-MM-dd');return [...store.tasks.value.filter(t=>t.date===key),...store.chains.value.filter(c=>c.date===key)]}
function changeDay(delta){selectedDate.value=format(addDays(parseISO(selectedDate.value),delta),'yyyy-MM-dd')}
function selectCalendarDay(date){selectedDate.value=format(date,'yyyy-MM-dd'); view.value='today'}
function openTask(task=null){ editingTask.value=task?{...task}:{id:null,type:'task',title:'',date:selectedDate.value,startTime:'',duration:30,priority:'normal',stage:'action',done:false,tags:[],notes:''}; taskOpen.value=true }
async function saveTask(){ if(!editingTask.value.title.trim())return; editingTask.value.id?await store.save(editingTask.value):await store.add(editingTask.value); taskOpen.value=false; flash(editingTask.value.id?'Изменения сохранены':'Добавлено в план'); syncSoon() }
async function deleteTask(){await store.remove(editingTask.value.id);taskOpen.value=false;flash('Задача удалена');syncSoon()}

const quick = reactive({title:'',date:store.today(),startTime:'09:00',template:'focus',steps:[]})
const templates = {
 focus:{title:'Глубокая работа',icon:'briefcase',color:'#8b5cf6',steps:[['Приготовить чай и выпить витамины','prepare',10],['Определить результат блока','prepare',5],['Фокус без отвлечений','action',90],['Записать итог и следующий шаг','finish',10]]},
 workout:{title:'Тренировка',icon:'dumbbell',color:'#22c55e',steps:[['Свекольный порошок + креатин','prepare',5],['Разминка и мобилизация','prepare',10],['Основная тренировка','action',75],['Заминка и запись результатов','finish',10]]},
 custom:{title:'Новая цепочка',icon:'activity',color:'#06b6d4',steps:[['Подготовка','prepare',10],['Главное действие','action',45],['Зафиксировать результат','finish',5]]}
}
function chooseTemplate(type){const t=templates[type];quick.template=type;quick.title=t.title;quick.steps=t.steps.map(([title,stage,duration])=>({id:uid(),title,stage,duration}))}
function openQuick(){quick.date=selectedDate.value;quick.startTime='09:00';chooseTemplate('focus');quickOpen.value=true}
function addQuickStep(){quick.steps.push({id:uid(),title:'',stage:'action',duration:15})}
async function saveChain(){if(!quick.title.trim())return;const t=templates[quick.template];const chainId=uid();let cursor=timeToMin(quick.startTime);await store.save({id:chainId,type:'chain',title:quick.title,date:quick.date,startTime:quick.startTime,icon:t.icon,color:t.color,order:Date.now()});for(let i=0;i<quick.steps.length;i++){const s=quick.steps[i];if(!s.title.trim())continue;await store.save({id:uid(),type:'task',chainId,title:s.title,stage:s.stage,date:quick.date,startTime:minToTime(cursor),duration:+s.duration||0,priority:s.stage==='action'?'high':'normal',done:false,order:i+1});cursor+=+s.duration||0}quickOpen.value=false;selectedDate.value=quick.date;view.value='today';flash('Цепочка добавлена в день');syncSoon()}
function timeToMin(v){const [h,m]=(v||'00:00').split(':').map(Number);return h*60+m}function minToTime(v){return `${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}

function openWorkout(w){
  selectedWorkout.value=JSON.parse(JSON.stringify(w))
  const previous=store.state.records.filter(r=>r.type==='session'&&r.workoutId===w.id).sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt))[0]
  selectedWorkout.value.log=w.exercises.map(ex=>{
    const old=previous?.log?.find(item=>item.exerciseId===ex.id)?.sets||[]
    return {exerciseId:ex.id,sets:Array.from({length:ex.sets},(_,i)=>({weight:'',reps:'',done:false,previous:old[i]?.weight?`${old[i].weight} кг × ${old[i].reps}`:''}))}
  })
  workoutOpen.value=true
}
function toggleSet(set, rest=90){set.done=!set.done;if(set.done){startTimer(rest);navigator.vibrate?.(30)}}
async function finishWorkout(){await store.add({type:'session',workoutId:selectedWorkout.value.id,date:store.today(),finishedAt:new Date().toISOString(),log:selectedWorkout.value.log});workoutOpen.value=false;stopTimer();flash('Тренировка записана. Сильная работа!');syncSoon()}
function startTimer(seconds){timerSeconds.value=seconds;timerRunning.value=true;clearInterval(timerInterval);timerInterval=setInterval(()=>{if(timerSeconds.value>0)timerSeconds.value--;else{stopTimer();navigator.vibrate?.([200,100,200]);flash('Отдых окончен')}} ,1000)}
function stopTimer(){clearInterval(timerInterval);timerRunning.value=false}
function timerText(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}

const auth = reactive({email:'',password:'',url:cloud.url,key:cloud.key,mode:'signin',busy:false})
async function saveCloudConfig(){try{await configureCloud(auth.url,auth.key);flash('Подключение сохранено');cloudOpen.value=true}catch(e){flash(e.message)}}
async function submitAuth(){auth.busy=true;try{if(auth.mode==='signin'){await signIn(auth.email,auth.password);flash('Данные синхронизированы')}else{await signUp(auth.email,auth.password);flash('Проверьте почту для подтверждения')} }catch(e){flash(e.message)}finally{auth.busy=false}}
async function doSync(){await syncNow();flash(cloud.error||'Синхронизация завершена')}
async function exportData(){const records=await store.allWithDeleted();const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`momentum-backup-${store.today()}.json`;a.click();URL.revokeObjectURL(a.href);flash('Резервная копия скачана')}
function importData(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.records))throw new Error('Неверный формат');await store.replaceAll(data.records.map(r=>({...r,dirty:1})));flash('Данные восстановлены');syncSoon()}catch(e){flash('Не удалось прочитать резервную копию')}};reader.readAsText(file)}
async function resetData(){if(!confirm('Удалить локальные данные и начать заново?'))return;await indexedDB.deleteDatabase('momentum-personal-os');location.reload()}
let syncTimer;function syncSoon(){if(!cloud.connected)return;clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,1200)}
function formatSync(){if(!cloud.lastSync)return 'ещё не было';return format(new Date(cloud.lastSync),'HH:mm, d MMM',{locale:ru})}
function setView(id){view.value=id;if(id==='today')selectedDate.value=store.today()}

onMounted(async()=>{await store.init();await initCloud();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow()})})
onBeforeUnmount(()=>{clearInterval(timerInterval);clearTimeout(syncTimer)})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark"><Check :size="19" stroke-width="3"/></span>Momentum</div>
      <nav class="nav">
        <button v-for="item in nav" :key="item.id" class="nav-btn" :class="{active:view===item.id}" @click="setView(item.id)"><component :is="item.icon" :size="18"/><span class="nav-label">{{item.label}}</span></button>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-btn" style="width:100%" @click="cloudOpen=true"><Cloud :size="18"/><span class="nav-label">Облако</span></button>
        <div class="sync-pill"><span class="sync-dot" :class="{ok:cloud.connected,spin:cloud.syncing}"></span>{{cloud.syncing?'Синхронизация':cloud.connected?'Все устройства связаны':'Только это устройство'}}</div>
      </div>
    </aside>

    <main class="main">
      <div class="page">
        <header class="topbar">
          <div><div class="eyebrow">{{ view==='today' ? format(new Date(),'EEEE, d MMMM',{locale:ru}) : 'Momentum' }}</div><h1 class="page-title">{{view==='today'?dateTitle:pageTitle}}</h1></div>
          <div class="header-actions">
            <button v-if="view==='today'" class="icon-btn" @click="changeDay(-1)"><ChevronLeft :size="17"/></button><button v-if="view==='today'" class="icon-btn" @click="changeDay(1)"><ChevronRight :size="17"/></button>
            <button class="ghost-btn" @click="cloudOpen=true"><component :is="cloud.connected?Cloud:CloudOff" :size="16"/><span>{{cloud.connected?'В облаке':'Подключить'}}</span></button>
            <button class="primary-btn" @click="openQuick"><Plus :size="17"/><span>Запланировать</span></button>
          </div>
        </header>

        <template v-if="!store.state.ready"><div class="card card-pad skeleton" style="height:180px"></div></template>

        <template v-else-if="view==='today'">
          <div class="grid-dashboard">
            <section>
              <div class="card hero-card">
                <div class="eyebrow">Фокус дня</div>
                <h2 style="font-size:21px;margin:7px 0 5px">{{activeTask?.title || 'День свободен — выбери главное'}}</h2>
                <div style="font-size:11px;color:#858894">{{activeTask ? `${activeTask.startTime||'Без времени'} · ${activeTask.duration||0} мин · ${stageLabel(activeTask.stage)}` : 'Добавь цепочку действий, и план станет ясным'}}</div>
                <div class="progress-row"><div class="progress-track"><div class="progress-fill" :style="{width:progress+'%'}"></div></div><div class="progress-label">{{progress}}%</div></div>
              </div>

              <div class="section-head"><h2>Цепочки действий</h2><span class="section-meta">{{dayChains.length}} потоков · {{completedCount}}/{{dayTasks.length}} действий</span></div>
              <article v-for="chain in dayChains" :key="chain.id" class="card chain" :style="{'--chain':chain.color}">
                <div class="chain-head"><div class="chain-icon"><component :is="iconMap[chain.icon]||Activity" :size="18"/></div><div><div class="chain-title">{{chain.title}}</div><div class="chain-sub">Начало {{chain.startTime}} · {{chainProgress(chain.id)}} готово</div></div><button class="chain-more"><MoreHorizontal :size="18"/></button></div>
                <div><div v-for="task in tasksForChain(chain.id)" :key="task.id" class="task-row" @dblclick="openTask(task)"><button class="check" :class="{done:task.done}" @click="toggleTask(task)"><Check v-if="task.done" :size="13" stroke-width="3"/></button><span class="task-time">{{task.startTime}}</span><div @click="openTask(task)" style="min-width:0;cursor:pointer"><div class="task-title" :class="{done:task.done}">{{task.title}}</div><div class="task-stage">{{stageLabel(task.stage)}}</div></div><span class="duration">{{task.duration}}м</span></div></div>
              </article>
              <div v-for="task in looseTasks" :key="task.id" class="card loose-task task-row"><button class="check" :class="{done:task.done}" @click="toggleTask(task)"><Check v-if="task.done" :size="13"/></button><span class="task-time">{{task.startTime||'—'}}</span><div @click="openTask(task)" style="cursor:pointer"><div class="task-title" :class="{done:task.done}">{{task.title}}</div><div class="task-stage">{{stageLabel(task.stage)}}</div></div><span class="duration">{{task.duration}}м</span></div>
              <button class="quick-add" @click="openQuick"><Plus :size="15"/> Добавить цепочку или действие</button>
            </section>

            <aside class="side-column">
              <div class="card side-card"><div class="section-head" style="margin:0 0 8px"><h3>Ритуалы сегодня</h3><span class="section-meta">{{store.habits.value.filter(h=>habitValue(h)>=h.target).length}}/{{store.habits.value.length}}</span></div>
                <div v-for="habit in store.habits.value" :key="habit.id" class="habit"><div class="habit-icon" :style="{color:habit.color,background:habit.color+'18'}"><component :is="iconMap[habit.icon]||Activity" :size="17"/></div><div><div class="habit-title">{{habit.title}}</div><div class="habit-sub">{{habit.subtitle}} <span v-if="habitStreak(habit)">· 🔥 {{habitStreak(habit)}}</span></div></div><button class="habit-toggle" :class="{done:habitValue(habit)>=habit.target}" @click="toggleHabit(habit)"><Check v-if="habitValue(habit)>=habit.target" :size="14"/><span v-else-if="habit.target>1" style="font-size:9px">{{habitValue(habit)}}/{{habit.target}}</span></button></div>
              </div>
              <div class="card side-card" :class="{'focus-card':activeTask}">
                <div style="display:flex;align-items:center;gap:8px"><Target :size="16" color="#a78bfa"/><h3>Следующий шаг</h3></div><p class="quote" style="margin:12px 0">{{activeTask ? 'Не думай обо всём плане. Сделай только это:' : 'Пространство в плане — тоже ресурс.'}}<br><strong>{{activeTask?.title}}</strong></p>
                <button v-if="activeTask" class="primary-btn" style="width:100%" @click="toggleTask(activeTask)"><CheckCircle2 :size="16"/> Завершить шаг</button>
              </div>
              <div class="card side-card"><p class="quote" style="margin:0">«Система должна освобождать внимание, а не требовать его». Сегодня достаточно двигаться по одному следующему шагу.</p></div>
            </aside>
          </div>
        </template>

        <template v-else-if="view==='tasks'">
          <div class="section-head" style="margin-top:0"><div class="input search" style="display:flex;align-items:center;gap:8px"><Search :size="15"/><input v-model="search" placeholder="Найти действие…" style="border:0;background:none;outline:0;width:100%;color:white"/></div><button class="ghost-btn" @click="openTask()"><Plus :size="16"/> Быстрое действие</button></div>
          <div class="card" style="overflow:hidden"><div v-for="task in allFilteredTasks" :key="task.id" class="task-row"><button class="check" :class="{done:task.done}" @click="toggleTask(task)"><Check v-if="task.done" :size="13"/></button><span class="task-time">{{format(parseISO(task.date),'d MMM',{locale:ru})}}</span><div @click="openTask(task)" style="cursor:pointer"><div class="task-title" :class="{done:task.done}">{{task.title}}</div><div class="task-stage">{{task.startTime||'Без времени'}} · {{stageLabel(task.stage)}}</div></div><span class="tag" :style="task.priority==='high'?{color:'#fda4af',background:'#3a1820'}:{}">{{task.priority==='high'?'Важно':task.duration+'м'}}</span></div><div v-if="!allFilteredTasks.length" class="empty">Ничего не найдено</div></div>
        </template>

        <template v-else-if="view==='calendar'">
          <div class="section-head" style="margin-top:0"><div><strong>{{format(calendarMonth,'LLLL yyyy',{locale:ru})}}</strong><div class="section-meta">Нажми на день, чтобы открыть план</div></div><div class="row" style="flex:0"><button class="icon-btn" @click="calendarMonth=subMonths(calendarMonth,1)"><ChevronLeft :size="17"/></button><button class="icon-btn" @click="calendarMonth=addMonths(calendarMonth,1)"><ChevronRight :size="17"/></button></div></div>
          <div class="calendar-grid"><div v-for="w in ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']" :key="w" class="weekday">{{w}}</div><button v-for="d in monthDays" :key="d.toISOString()" class="day" :class="{muted:!isSameMonth(d,calendarMonth),today:isToday(d),selected:format(d,'yyyy-MM-dd')===selectedDate}" @click="selectCalendarDay(d)"><span class="day-number">{{format(d,'d')}}</span><div class="dots"><span v-for="r in dayRecords(d).slice(0,8)" :key="r.id" class="dot" :style="{background:r.type==='chain'?(r.color||'#8b5cf6'):r.done?'#34d399':r.priority==='high'?'#fb7185':'#52525b'}"></span></div></button></div>
        </template>

        <template v-else-if="view==='workouts'">
          <div class="card hero-card" style="margin-bottom:18px"><div class="eyebrow">Твоя система</div><h2 style="margin:7px 0">4-дневная ротация силы и формы</h2><p class="quote" style="max-width:600px;margin:0">Результаты каждого подхода сохраняются. В следующий раз приложение подскажет прошлый вес, чтобы прогресс был измеримым.</p></div>
          <div class="workout-grid"><article v-for="w in store.workouts.value" :key="w.id" class="card workout-card" @click="openWorkout(w)"><div class="workout-day">День {{w.day}}</div><div class="workout-name">{{w.title}}</div><div v-for="ex in w.exercises.slice(0,3)" :key="ex.id" class="exercise-preview">{{ex.sets}} × {{ex.reps}} · {{ex.title}}</div><button class="ghost-btn" style="margin-top:12px"><Play :size="14"/> Начать</button><div style="position:absolute;width:100px;height:100px;border-radius:50%;right:-40px;top:-40px" :style="{background:w.color+'18'}"></div></article></div>
        </template>

        <template v-else-if="view==='habits'">
          <div class="card hero-card" style="margin-bottom:18px"><div class="eyebrow">Основа формы</div><h2 style="margin:7px 0">Маленькие действия, большой накопительный эффект</h2><div class="progress-row"><div class="progress-track"><div class="progress-fill" :style="{width:(store.habits.value.filter(h=>habitValue(h)>=h.target).length/store.habits.value.length*100)+'%'}"></div></div></div></div>
          <div class="settings-grid"><div v-for="h in store.habits.value" :key="h.id" class="card setting-card"><div style="display:flex;align-items:center;gap:13px"><div class="habit-icon" :style="{color:h.color,background:h.color+'18'}"><component :is="iconMap[h.icon]||Activity" :size="19"/></div><div><h3 style="margin:0">{{h.title}}</h3><div class="habit-sub">{{h.subtitle}}</div></div><button class="habit-toggle" style="margin-left:auto" :class="{done:habitValue(h)>=h.target}" @click="toggleHabit(h)"><Check v-if="habitValue(h)>=h.target" :size="14"/><span v-else>{{habitValue(h)}}</span></button></div><div style="margin-top:17px" class="section-meta">Текущая серия · <strong style="color:#f59e0b">{{habitStreak(h)}} дней</strong></div></div></div>
        </template>

        <template v-else-if="view==='settings'">
          <div class="settings-grid">
            <div class="card setting-card"><Cloud :size="21" color="#a78bfa"/><h3 style="margin-top:12px">Синхронизация устройств</h3><p>{{cloud.connected?`Выполнен вход: ${cloud.user?.email}. Последняя синхронизация ${formatSync()}.`:'Подключите бесплатный Supabase, чтобы один план был доступен на iPhone и компьютере.'}}</p><button class="primary-btn" @click="cloudOpen=true">{{cloud.connected?'Управление облаком':'Подключить облако'}}</button></div>
            <div class="card setting-card"><ShieldCheck :size="21" color="#34d399"/><h3 style="margin-top:12px">Резервная копия</h3><p>Полная копия задач, связей, привычек и истории тренировок в переносимом JSON.</p><div class="row"><button class="ghost-btn" @click="exportData"><Download :size="15"/> Скачать</button><label class="ghost-btn"><Upload :size="15"/> Восстановить<input type="file" accept="application/json" hidden @change="importData"/></label></div></div>
            <div class="card setting-card"><RefreshCw :size="21" color="#60a5fa"/><h3 style="margin-top:12px">Обновление данных</h3><p>Принудительно отправить локальные изменения и получить свежий план со всех устройств.</p><button class="ghost-btn" :disabled="!cloud.connected" @click="doSync"><RefreshCw :size="15" :class="{spin:cloud.syncing}"/> Синхронизировать</button></div>
            <div class="card setting-card"><Trash2 :size="21" color="#fb7185"/><h3 style="margin-top:12px">Начать заново</h3><p>Удаляет данные только на текущем устройстве. Используйте осторожно.</p><button class="ghost-btn danger-btn" @click="resetData">Сбросить локальные данные</button></div>
          </div>
        </template>
      </div>
    </main>

    <button class="fab" @click="openQuick"><Plus :size="23"/></button>
    <nav class="mobile-nav"><button v-for="item in mobileNav" :key="item.id" :class="{active:view===item.id}" @click="setView(item.id)"><component :is="item.icon" :size="20"/><span>{{item.label}}</span></button></nav>

    <Transition name="fade"><div v-if="quickOpen" class="modal-backdrop" @click.self="quickOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Быстрый планировщик</div><div class="modal-title">Собрать цепочку</div></div><button class="close" @click="quickOpen=false"><X :size="17"/></button></div>
      <div class="templates"><button class="template" @click="chooseTemplate('focus')"><Coffee :size="20"/>Фокус-работа</button><button class="template" @click="chooseTemplate('workout')"><Dumbbell :size="20"/>Тренировка</button><button class="template" @click="chooseTemplate('custom')"><Zap :size="20"/>Своя цепочка</button></div>
      <div class="field"><label>Результат / название потока</label><input class="input" v-model="quick.title" autofocus/></div><div class="row"><div class="field"><label>Дата</label><input type="date" class="input" v-model="quick.date"/></div><div class="field"><label>Начало</label><input type="time" class="input" v-model="quick.startTime"/></div></div>
      <div class="field"><label>Шаги — время рассчитается автоматически</label><div v-for="(step,i) in quick.steps" :key="step.id" class="row" style="margin-bottom:7px"><select class="select" v-model="step.stage" style="max-width:125px"><option value="prepare">Подготовка</option><option value="action">Действие</option><option value="finish">Финиш</option></select><input class="input" v-model="step.title"/><input class="input" type="number" v-model="step.duration" style="max-width:72px"/></div><button class="quick-add" @click="addQuickStep"><Plus :size="14"/> Добавить шаг</button></div><div class="form-actions"><button class="ghost-btn" @click="quickOpen=false">Отмена</button><button class="primary-btn" @click="saveChain">Добавить в день <ArrowRight :size="15"/></button></div>
    </div></div></Transition>

    <Transition name="fade"><div v-if="taskOpen" class="modal-backdrop" @click.self="taskOpen=false"><div class="modal"><div class="modal-head"><div class="modal-title">{{editingTask.id?'Изменить действие':'Быстрое действие'}}</div><button class="close" @click="taskOpen=false"><X :size="17"/></button></div><div class="field"><label>Что нужно сделать?</label><input class="input" v-model="editingTask.title" autofocus/></div><div class="row"><div class="field"><label>Дата</label><input type="date" class="input" v-model="editingTask.date"/></div><div class="field"><label>Время</label><input type="time" class="input" v-model="editingTask.startTime"/></div><div class="field"><label>Минут</label><input type="number" class="input" v-model="editingTask.duration"/></div></div><div class="row"><div class="field"><label>Этап</label><select class="select" v-model="editingTask.stage"><option value="prepare">Подготовка</option><option value="action">Действие</option><option value="finish">Завершение</option></select></div><div class="field"><label>Приоритет</label><select class="select" v-model="editingTask.priority"><option value="normal">Обычный</option><option value="medium">Средний</option><option value="high">Высокий</option></select></div></div><div class="field"><label>Заметка</label><textarea class="textarea" rows="3" v-model="editingTask.notes" placeholder="Контекст, ссылка или критерий готовности"></textarea></div><div class="form-actions"><button v-if="editingTask.id" class="ghost-btn danger-btn" style="margin-right:auto" @click="deleteTask"><Trash2 :size="15"/></button><button class="ghost-btn" @click="taskOpen=false">Отмена</button><button class="primary-btn" @click="saveTask">Сохранить</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="workoutOpen" class="modal-backdrop" @click.self="workoutOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">День {{selectedWorkout.day}}</div><div class="modal-title">{{selectedWorkout.title}}</div></div><button class="close" @click="workoutOpen=false"><X :size="17"/></button></div><div v-for="(ex,ei) in selectedWorkout.exercises" :key="ex.id" style="margin-bottom:21px"><div style="display:flex;justify-content:space-between"><strong style="font-size:13px">{{ex.title}}</strong><span class="section-meta">{{ex.reps}} · отдых {{Math.round(ex.rest/60)}}м</span></div><div v-for="(set,si) in selectedWorkout.log[ei].sets" :key="si" class="row" style="align-items:center;margin-top:7px"><span class="section-meta" style="max-width:20px">{{si+1}}</span><input class="input" type="number" v-model="set.weight" :placeholder="set.previous||'кг'"/><input class="input" type="number" v-model="set.reps" placeholder="повт."/><button class="check" :class="{done:set.done}" @click="toggleSet(set, ex.rest)"><Check v-if="set.done" :size="13"/></button></div></div><div v-if="timerSeconds" class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px"><div><div class="eyebrow">Отдых</div><div style="font-size:25px;font-weight:800">{{timerText(timerSeconds)}}</div></div><div class="row" style="flex:0"><button class="ghost-btn" @click="startTimer(90)">1:30</button><button class="ghost-btn" @click="startTimer(150)">2:30</button><button class="ghost-btn" @click="startTimer(180)">3:00</button><button class="close" @click="stopTimer();timerSeconds=0"><X :size="15"/></button></div></div><div class="form-actions"><button class="ghost-btn" @click="workoutOpen=false">Закрыть</button><button class="primary-btn" @click="finishWorkout"><Check :size="16"/> Завершить тренировку</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="cloudOpen" class="modal-backdrop" @click.self="cloudOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Единый план на всех устройствах</div><div class="modal-title">Облачная синхронизация</div></div><button class="close" @click="cloudOpen=false"><X :size="17"/></button></div>
      <template v-if="cloud.connected"><div class="card card-pad" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:12px"><div class="habit-icon" style="background:#13382d;color:#34d399"><Cloud :size="19"/></div><div><strong style="font-size:13px">{{cloud.user?.email}}</strong><div class="habit-sub">Последнее обновление: {{formatSync()}}</div></div></div></div><p class="quote">Изменения сохраняются локально сразу и отправляются в облако при наличии сети. На другом устройстве войдите в этот же аккаунт.</p><div v-if="cloud.error" class="tag" style="color:#fda4af">{{cloud.error}}</div><div class="form-actions"><button class="ghost-btn" @click="signOut"><LogOut :size="15"/> Выйти</button><button class="primary-btn" @click="doSync"><RefreshCw :size="15"/> Обновить сейчас</button></div></template>
      <template v-else><div v-if="!cloud.configured"><p class="quote">Для синхронизации нужен бесплатный проект Supabase. Вставьте URL и публичный anon key. Эти параметры не дают административного доступа к базе.</p><div class="field"><label>Supabase Project URL</label><input class="input" v-model="auth.url" placeholder="https://….supabase.co"/></div><div class="field"><label>Public anon key</label><textarea class="textarea" rows="3" v-model="auth.key" placeholder="eyJ…"></textarea></div><button class="primary-btn" style="width:100%" @click="saveCloudConfig">Сохранить подключение</button></div><div v-else><div class="templates" style="grid-template-columns:1fr 1fr"><button class="template" :style="auth.mode==='signin'?{borderColor:'#7455b5'}:{}" @click="auth.mode='signin'">Войти</button><button class="template" :style="auth.mode==='signup'?{borderColor:'#7455b5'}:{}" @click="auth.mode='signup'">Создать аккаунт</button></div><div class="field"><label>Email</label><input type="email" class="input" v-model="auth.email"/></div><div class="field"><label>Пароль (минимум 6 символов)</label><input type="password" class="input" v-model="auth.password"/></div><div v-if="cloud.error" style="font-size:11px;color:#fb7185;margin-bottom:10px">{{cloud.error}}</div><button class="primary-btn" style="width:100%" :disabled="auth.busy" @click="submitAuth">{{auth.mode==='signin'?'Войти и синхронизировать':'Создать защищённый аккаунт'}}</button></div></template>
    </div></div></Transition>

    <Transition name="fade"><div v-if="toast" class="toast">{{toast}}</div></Transition>
  </div>
</template>
