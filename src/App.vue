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
  CheckCircle2, Target, Timer, ArrowRight, Menu, SlidersHorizontal, GripVertical, Copy,
  GitBranch, Repeat2, Archive, TrendingUp, BarChart3, Save, Maximize2, Minimize2, PlusCircle
} from 'lucide-vue-next'
import { isBlocked, smartNext, nextRecurringDate, computeChainTimes, pluralize } from './utils/planner'

const nav = [
  { id:'today', label:'Сегодня', icon:Sun }, { id:'tasks', label:'План', icon:ListTodo },
  { id:'calendar', label:'Календарь', icon:CalendarDays }, { id:'workouts', label:'Тренировки', icon:Dumbbell },
  { id:'habits', label:'Привычки', icon:Sparkles }, { id:'settings', label:'Настройки', icon:Settings }
]
const mobileNav = nav
const view = ref('today')
const quickOpen = ref(false), taskOpen = ref(false), workoutOpen = ref(false), cloudOpen = ref(false)
const chainOpen = ref(false), habitOpen = ref(false), focusOpen = ref(false), workoutEditOpen = ref(false)
const toast = ref(''), lastDeleted = ref(null), updateAvailable = ref(false)
const search = ref('')
const taskFilter = ref('all'), selectedTag = ref('all')
const calendarMonth = ref(new Date()), calendarMode = ref('month')
const selectedDate = ref(store.today())
const editingTask = ref(null), editingChain = ref(null), editingHabit = ref(null), editingWorkout = ref(null)
const selectedWorkout = ref(null), workoutTab = ref('programs'), selectedExerciseStat = ref('all')
const timerSeconds = ref(0), timerRunning = ref(false)
const focusSeconds = ref(25*60), focusRunning = ref(false)
let focusInterval
const dragTaskId = ref(null)
let timerInterval

const iconMap = { briefcase:BriefcaseBusiness, dumbbell:Dumbbell, activity:Activity, 'cup-soda':CupSoda, droplets:Droplets, 'heart-pulse':HeartPulse }
const todayKey = computed(() => store.today())
const dayTasks = computed(() => store.tasks.value.filter(t => t.date === selectedDate.value).sort(sortTask))
const dayChains = computed(() => store.chains.value.filter(c => c.date === selectedDate.value).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')))
const looseTasks = computed(() => dayTasks.value.filter(t => !t.chainId))
const completedCount = computed(() => dayTasks.value.filter(t => t.done).length)
const progress = computed(() => dayTasks.value.length ? Math.round(completedCount.value/dayTasks.value.length*100) : 0)
const activeTask = computed(() => smartNext(store.tasks.value.filter(t => t.date <= selectedDate.value), new Date()))
const overdueTasks = computed(() => store.tasks.value.filter(t => !t.done && t.date < todayKey.value))
const allTags = computed(() => [...new Set(store.tasks.value.flatMap(t => t.tags || []))].sort())
const allFilteredTasks = computed(() => store.tasks.value.filter(t => {
  const matchesSearch = !search.value || `${t.title} ${t.notes||''} ${(t.tags||[]).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())
  const matchesTag = selectedTag.value === 'all' || t.tags?.includes(selectedTag.value)
  const matchesFilter = taskFilter.value === 'all' || (taskFilter.value === 'overdue' && !t.done && t.date < todayKey.value) || (taskFilter.value === 'blocked' && isBlocked(t, store.tasks.value)) || (taskFilter.value === 'quick' && !t.done && t.duration <= 15) || (taskFilter.value === 'important' && t.priority === 'high' && !t.done)
  return matchesSearch && matchesTag && matchesFilter
}).sort((a,b)=>(a.date+(a.startTime||'')).localeCompare(b.date+(b.startTime||''))))
const workoutSessions = computed(() => store.state.records.filter(r=>r.type==='session').sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)))
const exerciseOptions = computed(() => store.workouts.value.flatMap(w=>w.exercises.map(e=>({id:e.id,title:e.title,workoutId:w.id}))))
const exerciseStats = computed(() => {
  const result = []
  for (const session of [...workoutSessions.value].reverse()) {
    if(selectedExerciseStat.value==='all'){
      const completed=(session.log||[]).flatMap(item=>(item.sets||[]).filter(s=>s.done&&+s.weight&&+s.reps))
      if(completed.length)result.push({date:session.date,exercise:'Вся тренировка',best:Math.max(...completed.map(s=>+s.weight)),volume:completed.reduce((sum,s)=>sum+(+s.weight*+s.reps),0)})
      continue
    }
    for (const item of session.log||[]) {
      if (item.exerciseId !== selectedExerciseStat.value) continue
      const exercise = exerciseOptions.value.find(e=>e.id===item.exerciseId)
      const completed=(item.sets||[]).filter(s=>s.done && +s.weight && +s.reps)
      if (!completed.length) continue
      result.push({date:session.date,exercise:exercise?.title||'Упражнение',best:Math.max(...completed.map(s=>+s.weight)),volume:completed.reduce((sum,s)=>sum+(+s.weight*+s.reps),0)})
    }
  }
  return result
})
const dateTitle = computed(() => isToday(parseISO(selectedDate.value)) ? 'Сегодня' : format(parseISO(selectedDate.value), 'd MMMM, EEEE', {locale:ru}))
const monthDays = computed(() => {
  if (calendarMode.value === 'week') {
    const gridStart = startOfWeek(parseISO(selectedDate.value), {weekStartsOn:1})
    return Array.from({length:7}, (_,i)=>addDays(gridStart,i))
  }
  const monthStart = startOfMonth(calendarMonth.value)
  const gridStart = startOfWeek(monthStart, {weekStartsOn:1})
  return Array.from({length:42}, (_,i)=>addDays(gridStart,i))
})
const timelineTasks = computed(() => dayTasks.value.filter(t=>t.startTime).sort(sortTask))
const pageTitle = computed(() => nav.find(n=>n.id===view.value)?.label || 'Сегодня')

function sortTask(a,b){ return ((a.startTime||'99:99')+(a.order||0)).localeCompare((b.startTime||'99:99')+(b.order||0)) }
function flash(message){ toast.value=message; setTimeout(()=>{toast.value='';lastDeleted.value=null},3500) }
async function undoDelete(){if(!lastDeleted.value)return;await store.save({...lastDeleted.value,deleted:0});lastDeleted.value=null;toast.value='Действие восстановлено';syncSoon()}
function applyUpdate(){window.__momentumUpdate?.(true)}
function tasksForChain(id){ return dayTasks.value.filter(t=>t.chainId===id).sort((a,b)=>(a.order||0)-(b.order||0)) }
function chainProgress(id){ const list=tasksForChain(id); return list.length ? `${list.filter(t=>t.done).length}/${list.length}` : '0/0' }
async function toggleTask(task){
  const done=!task.done
  await store.save({...task,done,completedAt:done?new Date().toISOString():null})
  if(done){
    const nextDate=nextRecurringDate(task)
    if(nextDate && !store.tasks.value.some(t=>t.seriesId===(task.seriesId||task.id)&&t.date===nextDate)) {
      const {id:_id,updatedAt:_u,dirty:_d,completedAt:_c,...copy}=task
      await store.add({...copy,chainId:null,date:nextDate,done:false,seriesId:task.seriesId||task.id,subtasks:(task.subtasks||[]).map(s=>({...s,id:uid(),done:false}))})
    }
    navigator.vibrate?.(35); flash('Готово. Следующий доступный шаг обновлён')
  }
  syncSoon()
}
async function toggleSubtask(task, sub){ const subtasks=(task.subtasks||[]).map(s=>s.id===sub.id?{...s,done:!s.done}:s); await store.save({...task,subtasks}); syncSoon() }
function blocked(task){ return isBlocked(task,store.tasks.value) }
async function toggleHabit(habit){ const history={...(habit.history||{})}; const current=history[todayKey.value]||0; history[todayKey.value]=current>=habit.target?0:current+1; await store.save({...habit,history}); navigator.vibrate?.(25); syncSoon() }
function habitValue(h){return h.history?.[todayKey.value]||0}
function habitStreak(h){ let streak=0; for(let i=0;i<365;i++){const d=format(addDays(new Date(),-i),'yyyy-MM-dd'); if((h.history?.[d]||0)>=h.target)streak++;else if(i>0)break;else if(i===0)continue} return streak }
function stageLabel(s){return ({prepare:'Подготовка',action:'Действие',finish:'Завершение'}[s]||'Действие')}
function dayRecords(date){const key=format(date,'yyyy-MM-dd');return [...store.tasks.value.filter(t=>t.date===key),...store.chains.value.filter(c=>c.date===key)]}
function changeDay(delta){selectedDate.value=format(addDays(parseISO(selectedDate.value),delta),'yyyy-MM-dd')}
function selectCalendarDay(date){selectedDate.value=format(date,'yyyy-MM-dd'); view.value='today'}
function openTask(task=null){
  editingTask.value=task?{...task,subtasks:(task.subtasks||[]).map(s=>({...s})),tagsText:(task.tags||[]).join(', ')}:{id:null,type:'task',title:'',date:selectedDate.value,startTime:'',duration:30,priority:'normal',stage:'action',done:false,tags:[],tagsText:'',notes:'',recurrence:'none',dependsOn:[],subtasks:[],energy:'medium'}
  taskOpen.value=true
}
function addSubtask(){editingTask.value.subtasks.push({id:uid(),title:'',done:false})}
function dependencyReaches(startId,targetId,seen=new Set()){if(startId===targetId)return true;if(seen.has(startId))return false;seen.add(startId);const node=store.tasks.value.find(t=>t.id===startId);return (node?.dependsOn||[]).some(id=>dependencyReaches(id,targetId,seen))}
function toggleDependency(id){const list=editingTask.value.dependsOn||[];if(!list.includes(id)&&editingTask.value.id&&dependencyReaches(id,editingTask.value.id)){flash('Эта связь создаст цикл');return}editingTask.value.dependsOn=list.includes(id)?list.filter(x=>x!==id):[...list,id]}
async function saveTask(){
  if(!editingTask.value.title.trim())return
  const clean={...editingTask.value,tags:editingTask.value.tagsText.split(',').map(x=>x.trim()).filter(Boolean)};delete clean.tagsText
  clean.subtasks=clean.subtasks.filter(s=>s.title.trim())
  clean.id?await store.save(clean):await store.add(clean)
  taskOpen.value=false; flash(clean.id?'Изменения сохранены':'Добавлено в план'); syncSoon()
}
async function deleteTask(){lastDeleted.value={...editingTask.value};delete lastDeleted.value.tagsText;await store.remove(editingTask.value.id);taskOpen.value=false;flash('Задача удалена');syncSoon()}

function openChain(chain){editingChain.value={...chain};chainOpen.value=true}
async function saveChainEdit(){
  const old=store.chains.value.find(c=>c.id===editingChain.value.id)
  const shift=timeToMin(editingChain.value.startTime)-timeToMin(old?.startTime||editingChain.value.startTime)
  await store.save(editingChain.value)
  for(const task of store.tasks.value.filter(t=>t.chainId===editingChain.value.id))await store.save({...task,date:editingChain.value.date,startTime:minToTime(Math.max(0,timeToMin(task.startTime||editingChain.value.startTime)+shift))})
  chainOpen.value=false;flash('Цепочка и её шаги обновлены');syncSoon()
}
async function duplicateChain(){
  const source=editingChain.value, newId=uid(); const newDate=format(addDays(parseISO(source.date),1),'yyyy-MM-dd')
  await store.save({...source,id:newId,date:newDate,title:`${source.title} · копия`})
  for(const task of store.tasks.value.filter(t=>t.chainId===source.id)){const {id:_id,...rest}=task;await store.save({...rest,id:uid(),chainId:newId,date:newDate,done:false,dependsOn:[]})}
  chainOpen.value=false;flash('Копия добавлена на завтра');syncSoon()
}
async function deleteChain(){if(!confirm('Удалить цепочку и все её действия?'))return;for(const task of store.tasks.value.filter(t=>t.chainId===editingChain.value.id))await store.remove(task.id);await store.remove(editingChain.value.id);chainOpen.value=false;flash('Цепочка удалена');syncSoon()}
function dragStart(task){dragTaskId.value=task.id}
async function dropOnChain(chainId){const task=store.tasks.value.find(t=>t.id===dragTaskId.value);if(!task)return;const siblings=store.tasks.value.filter(t=>t.chainId===chainId);await store.save({...task,chainId,order:siblings.length+1,date:selectedDate.value});dragTaskId.value=null;syncSoon()}
async function dropOnTask(target){const source=store.tasks.value.find(t=>t.id===dragTaskId.value);if(!source||source.id===target.id)return;const siblings=store.tasks.value.filter(t=>t.chainId===target.chainId&&t.id!==source.id).sort((a,b)=>(a.order||0)-(b.order||0));const at=siblings.findIndex(t=>t.id===target.id);siblings.splice(at,0,source);for(let i=0;i<siblings.length;i++)await store.save({...siblings[i],chainId:target.chainId,order:i+1,date:target.date});dragTaskId.value=null;syncSoon()}
async function moveOverdue(task,days=0){await store.save({...task,date:days?format(addDays(new Date(),days),'yyyy-MM-dd'):todayKey.value});syncSoon()}
async function moveAllOverdue(){for(const task of overdueTasks.value)await moveOverdue(task);flash(`${overdueTasks.value.length} действий перенесено на сегодня`)}
function startFocus(){focusOpen.value=true;focusRunning.value=true;clearInterval(focusInterval);focusInterval=setInterval(()=>{if(focusSeconds.value>0)focusSeconds.value--;else{focusRunning.value=false;clearInterval(focusInterval);navigator.vibrate?.([200,100,200]);flash('Фокус-блок завершён')}},1000)}
function toggleFocusTimer(){if(focusRunning.value){clearInterval(focusInterval);focusRunning.value=false}else startFocus()}
function resetFocus(){clearInterval(focusInterval);focusRunning.value=false;focusSeconds.value=Math.max(5,(activeTask.value?.duration||25))*60}

function openHabit(h=null){editingHabit.value=h?{...h,schedule:h.schedule||[1,2,3,4,5,6,0]}:{id:null,type:'habit',title:'',subtitle:'',icon:'activity',color:'#8b5cf6',target:1,history:{},schedule:[1,2,3,4,5,6,0]};habitOpen.value=true}
function toggleHabitDay(day){const list=editingHabit.value.schedule||[];editingHabit.value.schedule=list.includes(day)?list.filter(d=>d!==day):[...list,day]}
async function saveHabit(){if(!editingHabit.value.title)return;editingHabit.value.id?await store.save(editingHabit.value):await store.add({...editingHabit.value,order:store.habits.value.length+1});habitOpen.value=false;flash('Привычка сохранена');syncSoon()}
async function archiveHabit(){await store.save({...editingHabit.value,deleted:1});habitOpen.value=false;flash('Привычка архивирована');syncSoon()}
function habitRate(h,days=30){let done=0;for(let i=0;i<days;i++){const d=format(addDays(new Date(),-i),'yyyy-MM-dd');if((h.history?.[d]||0)>=h.target)done++}return Math.round(done/days*100)}

function editWorkout(w){editingWorkout.value=JSON.parse(JSON.stringify(w));workoutEditOpen.value=true}
function addExercise(){editingWorkout.value.exercises.push({id:uid(),title:'Новое упражнение',sets:3,reps:'8–12',rest:90})}
async function saveWorkout(){await store.save(editingWorkout.value);workoutEditOpen.value=false;flash('Программа обновлена');syncSoon()}
async function removeSession(session){if(!confirm('Удалить запись тренировки?'))return;await store.remove(session.id);flash('Запись тренировки удалена');syncSoon()}
function statMax(){return Math.max(1,...exerciseStats.value.map(s=>selectedExerciseStat.value==='all'?s.volume:s.best))}
function statPoints(){const arr=exerciseStats.value.slice(-12);if(!arr.length)return '';return arr.map((s,i)=>`${arr.length===1?50:i/(arr.length-1)*100},${92-(selectedExerciseStat.value==='all'?s.volume:s.best)/statMax()*82}`).join(' ')}

const quick = reactive({title:'',date:store.today(),startTime:'09:00',template:'focus',steps:[]})
const templates = {
 focus:{title:'Глубокая работа',icon:'briefcase',color:'#8b5cf6',steps:[['Приготовить чай и выпить витамины','prepare',10],['Определить результат блока','prepare',5],['Фокус без отвлечений','action',90],['Записать итог и следующий шаг','finish',10]]},
 workout:{title:'Тренировка',icon:'dumbbell',color:'#22c55e',steps:[['Свекольный порошок + креатин','prepare',5],['Разминка и мобилизация','prepare',10],['Основная тренировка','action',75],['Заминка и запись результатов','finish',10]]},
 custom:{title:'Новая цепочка',icon:'activity',color:'#06b6d4',steps:[['Подготовка','prepare',10],['Главное действие','action',45],['Зафиксировать результат','finish',5]]}
}
function chooseTemplate(type){const t=templates[type];quick.template=type;quick.title=t.title;quick.steps=t.steps.map(([title,stage,duration])=>({id:uid(),title,stage,duration}))}
function openQuick(){quick.date=selectedDate.value;quick.startTime='09:00';chooseTemplate('focus');quickOpen.value=true}
function addQuickStep(){quick.steps.push({id:uid(),title:'',stage:'action',duration:15})}
async function saveChain(){if(!quick.title.trim())return;const t=templates[quick.template];const chainId=uid();const timed=computeChainTimes(quick.steps,quick.startTime);await store.save({id:chainId,type:'chain',title:quick.title,date:quick.date,startTime:quick.startTime,icon:t.icon,color:t.color,order:Date.now()});for(let i=0;i<timed.length;i++){const s=timed[i];if(!s.title.trim())continue;await store.save({id:uid(),type:'task',chainId,title:s.title,stage:s.stage,date:quick.date,startTime:s.startTime,duration:+s.duration||0,priority:s.stage==='action'?'high':'normal',done:false,order:i+1,recurrence:'none',subtasks:[],dependsOn:[]})}quickOpen.value=false;selectedDate.value=quick.date;view.value='today';flash('Цепочка добавлена в день');syncSoon()}
function timeToMin(v){const [h,m]=(v||'00:00').split(':').map(Number);return h*60+m}function minToTime(v){return `${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}

function openWorkout(w){
  selectedWorkout.value=JSON.parse(JSON.stringify(w))
  selectedWorkout.value.sessionNote=''
  const previous=store.state.records.filter(r=>r.type==='session'&&r.workoutId===w.id).sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt))[0]
  selectedWorkout.value.log=w.exercises.map(ex=>{
    const old=previous?.log?.find(item=>item.exerciseId===ex.id)?.sets||[]
    return {exerciseId:ex.id,sets:Array.from({length:ex.sets},(_,i)=>({weight:'',reps:'',rir:'',done:false,previous:old[i]?.weight?`${old[i].weight} кг × ${old[i].reps}`:''}))}
  })
  workoutOpen.value=true
}
function toggleSet(set, rest=90){set.done=!set.done;if(set.done){startTimer(rest);navigator.vibrate?.(30)}}
async function finishWorkout(){await store.add({type:'session',workoutId:selectedWorkout.value.id,date:store.today(),finishedAt:new Date().toISOString(),note:selectedWorkout.value.sessionNote,log:selectedWorkout.value.log});workoutOpen.value=false;stopTimer();flash('Тренировка записана. Сильная работа!');syncSoon()}
function startTimer(seconds){timerSeconds.value=seconds;timerRunning.value=true;clearInterval(timerInterval);timerInterval=setInterval(()=>{if(timerSeconds.value>0)timerSeconds.value--;else{stopTimer();navigator.vibrate?.([200,100,200]);flash('Отдых окончен')}} ,1000)}
function stopTimer(){clearInterval(timerInterval);timerRunning.value=false}
function timerText(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}

const auth = reactive({email:'',password:'',url:cloud.url,key:cloud.key,mode:'signin',busy:false})
async function saveCloudConfig(){try{await configureCloud(auth.url,auth.key);flash('Подключение сохранено');cloudOpen.value=true}catch(e){flash(e.message)}}
async function submitAuth(){auth.busy=true;try{if(auth.mode==='signin'){await signIn(auth.email,auth.password);flash('Данные синхронизированы')}else{await signUp(auth.email,auth.password);flash('Проверьте почту для подтверждения')} }catch(e){flash(e.message)}finally{auth.busy=false}}
async function doSync(){await syncNow();flash(cloud.error||'Синхронизация завершена')}
async function exportData(){const records=await store.allWithDeleted();const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`momentum-backup-${store.today()}.json`;a.click();URL.revokeObjectURL(a.href);flash('Резервная копия скачана')}
function importData(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.records)||data.version!==1)throw new Error('Неверный формат');await exportData();await store.replaceAll(data.records.map(r=>({...r,dirty:1})));flash('Данные восстановлены');syncSoon()}catch(e){flash('Не удалось прочитать резервную копию')}};reader.readAsText(file)}
async function resetData(){if(!confirm('Удалить локальные данные и начать заново?'))return;await store.reset();location.reload()}
let syncTimer;function syncSoon(){if(!cloud.connected)return;clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,1200)}
function formatSync(){if(!cloud.lastSync)return 'ещё не было';return format(new Date(cloud.lastSync),'HH:mm, d MMM',{locale:ru})}
function setView(id){view.value=id;if(id==='today')selectedDate.value=store.today()}

onMounted(async()=>{await store.init();await initCloud();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow()});window.addEventListener('momentum:update-ready',()=>{updateAvailable.value=true;toast.value='Доступна новая версия'});window.addEventListener('momentum:offline-ready',()=>flash('Приложение готово к работе без сети'))})
onBeforeUnmount(()=>{clearInterval(timerInterval);clearInterval(focusInterval);clearTimeout(syncTimer)})
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
          <div v-if="overdueTasks.length && selectedDate===todayKey" class="overdue-banner card" role="alert"><div><strong>{{overdueTasks.length}} {{pluralize(overdueTasks.length,['незавершённое действие','незавершённых действия','незавершённых действий'])}}</strong><div class="section-meta">Разбери хвост осознанно — ничего не переносится без твоего решения.</div></div><div class="row" style="flex:0"><button class="ghost-btn" @click="view='tasks';taskFilter='overdue'">Разобрать</button><button class="primary-btn" @click="moveAllOverdue">На сегодня</button></div></div>
          <div class="grid-dashboard">
            <section>
              <div class="card hero-card">
                <div class="eyebrow">Фокус дня</div>
                <h2 style="font-size:21px;margin:7px 0 5px">{{activeTask?.title || 'День свободен — выбери главное'}}</h2>
                <div style="font-size:11px;color:#858894">{{activeTask ? `${activeTask.startTime||'Без времени'} · ${activeTask.duration||0} мин · ${stageLabel(activeTask.stage)}` : 'Добавь цепочку действий, и план станет ясным'}}</div>
                <div class="progress-row"><div class="progress-track"><div class="progress-fill" :style="{width:progress+'%'}"></div></div><div class="progress-label">{{progress}}%</div></div>
                <button v-if="activeTask" class="focus-launch" @click="resetFocus();startFocus()"><Maximize2 :size="15"/> Режим «Сейчас»</button>
              </div>

              <div class="section-head"><h2>Цепочки действий</h2><span class="section-meta">{{dayChains.length}} потоков · {{completedCount}}/{{dayTasks.length}} действий</span></div>
              <article v-for="chain in dayChains" :key="chain.id" class="card chain" :style="{'--chain':chain.color}" @dragover.prevent @drop="dropOnChain(chain.id)">
                <div class="chain-head"><div class="chain-icon"><component :is="iconMap[chain.icon]||Activity" :size="18"/></div><div><div class="chain-title">{{chain.title}}</div><div class="chain-sub">Начало {{chain.startTime}} · {{chainProgress(chain.id)}} готово</div></div><button class="chain-more" :aria-label="`Настроить ${chain.title}`" @click="openChain(chain)"><MoreHorizontal :size="18"/></button></div>
                <div><div v-for="task in tasksForChain(chain.id)" :key="task.id" class="task-row" :class="{blocked:blocked(task)}" draggable="true" @dragstart="dragStart(task)" @dragover.prevent @drop.stop="dropOnTask(task)"><GripVertical class="drag-handle" :size="14"/><button class="check" :disabled="blocked(task)" :aria-label="task.done?'Вернуть действие':'Завершить действие'" :class="{done:task.done}" @click="toggleTask(task)"><Check v-if="task.done" :size="13" stroke-width="3"/><Link2 v-else-if="blocked(task)" :size="10"/></button><span class="task-time">{{task.startTime}}</span><div @click="openTask(task)" style="min-width:0;cursor:pointer"><div class="task-title" :class="{done:task.done}">{{task.title}}</div><div class="task-stage">{{blocked(task)?'Ожидает связанных действий':stageLabel(task.stage)}}<span v-if="task.subtasks?.length"> · {{task.subtasks.filter(s=>s.done).length}}/{{task.subtasks.length}}</span></div></div><span class="duration">{{task.duration}}м</span></div></div>
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
          <div class="section-head" style="margin-top:0"><div class="input search" style="display:flex;align-items:center;gap:8px"><Search :size="15"/><input v-model="search" aria-label="Поиск действий" placeholder="Найти действие…" style="border:0;background:none;outline:0;width:100%;color:white"/></div><button class="ghost-btn" @click="openTask()"><Plus :size="16"/> Быстрое действие</button></div>
          <div class="filter-bar"><button v-for="f in [{id:'all',t:'Все'},{id:'overdue',t:'Просрочено'},{id:'blocked',t:'Ожидают'},{id:'quick',t:'≤ 15 минут'},{id:'important',t:'Важные'}]" :key="f.id" class="filter-chip" :class="{active:taskFilter===f.id}" @click="taskFilter=f.id">{{f.t}}<span v-if="f.id==='overdue'&&overdueTasks.length">{{overdueTasks.length}}</span></button><select v-if="allTags.length" class="select compact" v-model="selectedTag"><option value="all">Все теги</option><option v-for="tag in allTags" :key="tag">{{tag}}</option></select></div>
          <div class="card" style="overflow:hidden"><div v-for="task in allFilteredTasks" :key="task.id" class="task-row plan-row" :class="{blocked:blocked(task)}"><button class="check" :disabled="blocked(task)" :class="{done:task.done}" @click="toggleTask(task)"><Check v-if="task.done" :size="13"/><Link2 v-else-if="blocked(task)" :size="10"/></button><span class="task-time">{{format(parseISO(task.date),'d MMM',{locale:ru})}}</span><div @click="openTask(task)" style="cursor:pointer;min-width:0"><div class="task-title" :class="{done:task.done}">{{task.title}}</div><div class="task-stage">{{blocked(task)?'Ожидает зависимость':(task.startTime||'Без времени')}} · {{stageLabel(task.stage)}} <span v-for="tag in (task.tags||[]).slice(0,2)" :key="tag">· #{{tag}}</span></div></div><div class="row" style="flex:0"><button v-if="task.date<todayKey&&!task.done" class="mini-btn" @click="moveOverdue(task)">Сегодня</button><span class="tag" :style="task.priority==='high'?{color:'#fda4af',background:'#3a1820'}:{}">{{task.priority==='high'?'Важно':task.duration+'м'}}</span></div></div><div v-if="!allFilteredTasks.length" class="empty">Ничего не найдено</div></div>
        </template>

        <template v-else-if="view==='calendar'">
          <div class="section-head" style="margin-top:0"><div><strong>{{calendarMode==='day'?format(parseISO(selectedDate),'d MMMM, EEEE',{locale:ru}):format(calendarMonth,'LLLL yyyy',{locale:ru})}}</strong><div class="section-meta">Планируй визуально и замечай перегрузку</div></div><div class="row" style="flex:0"><div class="segmented"><button v-for="m in [{id:'month',t:'Месяц'},{id:'week',t:'Неделя'},{id:'day',t:'День'}]" :key="m.id" :class="{active:calendarMode===m.id}" @click="calendarMode=m.id">{{m.t}}</button></div><button class="icon-btn" @click="calendarMode==='month'?calendarMonth=subMonths(calendarMonth,1):changeDay(-7)"><ChevronLeft :size="17"/></button><button class="icon-btn" @click="calendarMode==='month'?calendarMonth=addMonths(calendarMonth,1):changeDay(7)"><ChevronRight :size="17"/></button></div></div>
          <div v-if="calendarMode!=='day'" class="calendar-grid" :class="{'week-grid':calendarMode==='week'}"><div v-for="w in ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']" :key="w" class="weekday">{{w}}</div><button v-for="d in monthDays" :key="d.toISOString()" class="day" :class="{muted:calendarMode==='month'&&!isSameMonth(d,calendarMonth),today:isToday(d),selected:format(d,'yyyy-MM-dd')===selectedDate}" @click="selectedDate=format(d,'yyyy-MM-dd');calendarMode='day'"><span class="day-number">{{format(d,'d')}}</span><div class="dots"><span v-for="r in dayRecords(d).slice(0,8)" :key="r.id" class="dot" :style="{background:r.type==='chain'?(r.color||'#8b5cf6'):r.done?'#34d399':r.priority==='high'?'#fb7185':'#52525b'}"></span></div><div v-if="calendarMode==='week'" class="week-items"><div v-for="t in store.tasks.value.filter(t=>t.date===format(d,'yyyy-MM-dd')).slice(0,5)" :key="t.id">{{t.startTime}} {{t.title}}</div></div></button></div>
          <div v-else class="day-timeline card"><div v-for="hour in Array.from({length:16},(_,i)=>i+7)" :key="hour" class="time-slot"><span>{{String(hour).padStart(2,'0')}}:00</span><div class="slot-line"></div><button v-for="task in timelineTasks.filter(t=>+t.startTime.split(':')[0]===hour)" :key="task.id" class="timeline-event" :style="{left:(+task.startTime.split(':')[1]/60*60)+'px',width:Math.max(90,(task.duration||30)*2)+'px'}" @click="openTask(task)">{{task.startTime}} · {{task.title}}</button></div><button class="quick-add" style="margin:12px;width:calc(100% - 24px)" @click="openQuick"><Plus :size="14"/> Добавить цепочку</button></div>
        </template>

        <template v-else-if="view==='workouts'">
          <div class="card hero-card" style="margin-bottom:18px"><div class="eyebrow">Твоя система</div><h2 style="margin:7px 0">Сила растёт там, где виден прогресс</h2><p class="quote" style="max-width:600px;margin:0">Каждый рабочий подход сохраняется. Смотри динамику веса и объёма, а не полагайся на память.</p></div>
          <div class="segmented tabs"><button v-for="t in [{id:'programs',n:'Программы'},{id:'history',n:'История'},{id:'stats',n:'Прогресс'}]" :key="t.id" :class="{active:workoutTab===t.id}" @click="workoutTab=t.id">{{t.n}}</button></div>
          <div v-if="workoutTab==='programs'" class="workout-grid"><article v-for="w in store.workouts.value" :key="w.id" class="card workout-card"><div class="workout-day">День {{w.day}}</div><div class="workout-name">{{w.title}}</div><div v-for="ex in w.exercises.slice(0,4)" :key="ex.id" class="exercise-preview">{{ex.sets}} × {{ex.reps}} · {{ex.title}}</div><div class="row" style="margin-top:12px"><button class="primary-btn" @click="openWorkout(w)"><Play :size="14"/> Начать</button><button class="icon-btn" aria-label="Редактировать программу" @click="editWorkout(w)"><Pencil :size="14"/></button></div><div style="position:absolute;width:100px;height:100px;border-radius:50%;right:-40px;top:-40px" :style="{background:w.color+'18'}"></div></article></div>
          <div v-else-if="workoutTab==='history'" class="history-list"><article v-for="s in workoutSessions" :key="s.id" class="card history-card"><div><strong>{{store.workouts.value.find(w=>w.id===s.workoutId)?.title||'Тренировка'}}</strong><div class="section-meta">{{format(parseISO(s.date),'d MMMM yyyy',{locale:ru})}}</div></div><div style="display:flex;align-items:center;gap:12px"><div><strong>{{s.log?.reduce((n,e)=>n+e.sets.filter(x=>x.done).length,0)||0}}</strong><div class="section-meta">подходов</div></div><button class="close" aria-label="Удалить тренировку" @click="removeSession(s)"><Trash2 :size="13"/></button></div></article><div v-if="!workoutSessions.length" class="empty card">Заверши первую тренировку — здесь появится история</div></div>
          <div v-else class="stats-layout"><div class="card card-pad"><div class="section-head" style="margin-top:0"><div><h2>Динамика упражнения</h2><div class="section-meta">{{selectedExerciseStat==='all'?'Общий объём тренировок':'Лучший рабочий вес'}}</div></div><select class="select compact" v-model="selectedExerciseStat"><option value="all">Общий объём</option><option v-for="ex in exerciseOptions" :key="ex.id" :value="ex.id">{{ex.title}}</option></select></div><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="График прогресса"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".45"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient></defs><polyline v-if="statPoints()" :points="`0,100 ${statPoints()} 100,100`" fill="url(#chartFill)" stroke="none"/><polyline v-if="statPoints()" :points="statPoints()" fill="none" stroke="#a78bfa" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div v-if="!exerciseStats.length" class="empty">Запиши вес и повторы в выполненных подходах</div><div v-else class="stat-cards"><div><strong>{{exerciseStats.at(-1)?.best}} кг</strong><span>Последний лучший вес</span></div><div><strong>{{Math.round(exerciseStats.at(-1)?.volume||0)}} кг</strong><span>Объём последней сессии</span></div><div><strong>{{exerciseStats.length}}</strong><span>Точек данных</span></div></div></div></div>
        </template>

        <template v-else-if="view==='habits'">
          <div class="card hero-card" style="margin-bottom:18px"><div class="eyebrow">Основа формы</div><h2 style="margin:7px 0">Маленькие действия, большой накопительный эффект</h2><div class="progress-row"><div class="progress-track"><div class="progress-fill" :style="{width:(store.habits.value.filter(h=>habitValue(h)>=h.target).length/store.habits.value.length*100)+'%'}"></div></div></div></div>
          <div class="section-head"><h2>Мои ритуалы</h2><button class="ghost-btn" @click="openHabit()"><Plus :size="15"/> Новая привычка</button></div>
          <div class="settings-grid"><div v-for="h in store.habits.value" :key="h.id" class="card setting-card"><div style="display:flex;align-items:center;gap:13px"><div class="habit-icon" :style="{color:h.color,background:h.color+'18'}"><component :is="iconMap[h.icon]||Activity" :size="19"/></div><div><h3 style="margin:0">{{h.title}}</h3><div class="habit-sub">{{h.subtitle}}</div></div><button class="habit-toggle" style="margin-left:auto" :class="{done:habitValue(h)>=h.target}" @click="toggleHabit(h)"><Check v-if="habitValue(h)>=h.target" :size="14"/><span v-else>{{habitValue(h)}}/{{h.target}}</span></button><button class="chain-more" aria-label="Редактировать привычку" @click="openHabit(h)"><MoreHorizontal :size="17"/></button></div><div class="habit-calendar"><span v-for="i in 21" :key="i" :title="format(addDays(new Date(),i-21),'d MMM',{locale:ru})" :class="{done:(h.history?.[format(addDays(new Date(),i-21),'yyyy-MM-dd')]||0)>=h.target}"></span></div><div style="margin-top:13px;display:flex;justify-content:space-between" class="section-meta"><span>Серия · <strong style="color:#f59e0b">{{habitStreak(h)}} дней</strong></span><span>30 дней · <strong style="color:#34d399">{{habitRate(h)}}%</strong></span></div></div></div>
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
      <div class="field"><label>Шаги — время рассчитается автоматически</label><div v-for="step in quick.steps" :key="step.id" class="row" style="margin-bottom:7px"><select class="select" v-model="step.stage" style="max-width:125px"><option value="prepare">Подготовка</option><option value="action">Действие</option><option value="finish">Финиш</option></select><input class="input" v-model="step.title"/><input class="input" type="number" v-model="step.duration" style="max-width:72px"/></div><button class="quick-add" @click="addQuickStep"><Plus :size="14"/> Добавить шаг</button></div><div class="form-actions"><button class="ghost-btn" @click="quickOpen=false">Отмена</button><button class="primary-btn" @click="saveChain">Добавить в день <ArrowRight :size="15"/></button></div>
    </div></div></Transition>

    <Transition name="fade"><div v-if="taskOpen" class="modal-backdrop" @click.self="taskOpen=false"><div class="modal"><div class="modal-head"><div class="modal-title">{{editingTask.id?'Изменить действие':'Быстрое действие'}}</div><button class="close" @click="taskOpen=false"><X :size="17"/></button></div><div class="field"><label>Что нужно сделать?</label><input class="input" v-model="editingTask.title" autofocus/></div><div class="field"><label>Цепочка</label><select class="select" v-model="editingTask.chainId"><option :value="null">Без цепочки</option><option v-for="chain in store.chains.value.filter(c=>c.date===editingTask.date)" :key="chain.id" :value="chain.id">{{chain.title}}</option></select></div><div class="row"><div class="field"><label>Дата</label><input type="date" class="input" v-model="editingTask.date"/></div><div class="field"><label>Время</label><input type="time" class="input" v-model="editingTask.startTime"/></div><div class="field"><label>Минут</label><input type="number" class="input" v-model="editingTask.duration"/></div></div><div class="row"><div class="field"><label>Этап</label><select class="select" v-model="editingTask.stage"><option value="prepare">Подготовка</option><option value="action">Действие</option><option value="finish">Завершение</option></select></div><div class="field"><label>Приоритет</label><select class="select" v-model="editingTask.priority"><option value="normal">Обычный</option><option value="medium">Средний</option><option value="high">Высокий</option></select></div></div><div class="row"><div class="field"><label>Повторение</label><select class="select" v-model="editingTask.recurrence"><option value="none">Не повторять</option><option value="daily">Каждый день</option><option value="weekdays">По будням</option><option value="weekly">Каждую неделю</option></select></div><div class="field"><label>Энергия</label><select class="select" v-model="editingTask.energy"><option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option></select></div></div><div class="field"><label>Теги через запятую</label><input class="input" v-model="editingTask.tagsText" placeholder="работа, компьютер, фокус"/></div><div class="field"><label>Чек-лист</label><div v-for="sub in editingTask.subtasks" :key="sub.id" class="row" style="margin-bottom:6px"><button class="check" :class="{done:sub.done}" @click="sub.done=!sub.done"><Check v-if="sub.done" :size="12"/></button><input class="input" v-model="sub.title" placeholder="Промежуточный результат"/></div><button class="quick-add" @click="addSubtask"><Plus :size="13"/> Добавить пункт</button></div><details class="dependency-box"><summary><GitBranch :size="14"/> Зависимости · {{editingTask.dependsOn?.length||0}}</summary><p class="section-meta">Действие будет заблокировано, пока выбранные пункты не завершены.</p><label v-for="candidate in store.tasks.value.filter(t=>t.id!==editingTask.id&&t.date<=editingTask.date).slice(-30)" :key="candidate.id" class="dependency-row"><input type="checkbox" :checked="editingTask.dependsOn?.includes(candidate.id)" @change="toggleDependency(candidate.id)"/><span>{{candidate.title}}</span><small>{{candidate.date}}</small></label></details><div class="field"><label>Заметка / критерий готовности</label><textarea class="textarea" rows="3" v-model="editingTask.notes" placeholder="Контекст, ссылка или ожидаемый результат"></textarea></div><div class="form-actions"><button v-if="editingTask.id" class="ghost-btn danger-btn" style="margin-right:auto" @click="deleteTask"><Trash2 :size="15"/></button><button class="ghost-btn" @click="taskOpen=false">Отмена</button><button class="primary-btn" @click="saveTask">Сохранить</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="workoutOpen" class="modal-backdrop" @click.self="workoutOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">День {{selectedWorkout.day}}</div><div class="modal-title">{{selectedWorkout.title}}</div></div><button class="close" @click="workoutOpen=false"><X :size="17"/></button></div><div v-for="(ex,ei) in selectedWorkout.exercises" :key="ex.id" style="margin-bottom:21px"><div style="display:flex;justify-content:space-between"><strong style="font-size:13px">{{ex.title}}</strong><span class="section-meta">{{ex.reps}} · отдых {{Math.round(ex.rest/60)}}м</span></div><div v-for="(set,si) in selectedWorkout.log[ei].sets" :key="si" class="row" style="align-items:center;margin-top:7px"><span class="section-meta" style="max-width:20px">{{si+1}}</span><input class="input" type="number" v-model="set.weight" :placeholder="set.previous||'кг'"/><input class="input" type="number" v-model="set.reps" placeholder="повт."/><input class="input" type="number" min="0" max="5" v-model="set.rir" placeholder="RIR" title="Повторов в запасе"/><button class="check" :class="{done:set.done}" @click="toggleSet(set, ex.rest)"><Check v-if="set.done" :size="13"/></button></div></div><div class="field"><label>Самочувствие и заметка тренировки</label><textarea class="textarea" rows="2" v-model="selectedWorkout.sessionNote" placeholder="Энергия, техника, что изменить в следующий раз"></textarea></div><div v-if="timerSeconds" class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px"><div><div class="eyebrow">Отдых</div><div style="font-size:25px;font-weight:800">{{timerText(timerSeconds)}}</div></div><div class="row" style="flex:0"><button class="ghost-btn" @click="startTimer(90)">1:30</button><button class="ghost-btn" @click="startTimer(150)">2:30</button><button class="ghost-btn" @click="startTimer(180)">3:00</button><button class="close" @click="stopTimer();timerSeconds=0"><X :size="15"/></button></div></div><div class="form-actions"><button class="ghost-btn" @click="workoutOpen=false">Закрыть</button><button class="primary-btn" @click="finishWorkout"><Check :size="16"/> Завершить тренировку</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="chainOpen" class="modal-backdrop" @click.self="chainOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Управление потоком</div><div class="modal-title">Настроить цепочку</div></div><button class="close" @click="chainOpen=false"><X :size="17"/></button></div><div class="field"><label>Название</label><input class="input" v-model="editingChain.title"/></div><div class="row"><div class="field"><label>Дата</label><input class="input" type="date" v-model="editingChain.date"/></div><div class="field"><label>Старт</label><input class="input" type="time" v-model="editingChain.startTime"/></div><div class="field"><label>Цвет</label><input class="input color-input" type="color" v-model="editingChain.color"/></div></div><p class="quote">Перетаскивай действия за маркер, чтобы менять порядок или переносить между параллельными цепочками.</p><div class="form-actions"><button class="ghost-btn danger-btn" @click="deleteChain"><Trash2 :size="15"/> Удалить</button><button class="ghost-btn" @click="duplicateChain"><Copy :size="15"/> На завтра</button><button class="primary-btn" @click="saveChainEdit"><Save :size="15"/> Сохранить</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="habitOpen" class="modal-backdrop" @click.self="habitOpen=false"><div class="modal"><div class="modal-head"><div class="modal-title">{{editingHabit.id?'Настроить привычку':'Новая привычка'}}</div><button class="close" @click="habitOpen=false"><X :size="17"/></button></div><div class="field"><label>Название</label><input class="input" v-model="editingHabit.title" autofocus/></div><div class="field"><label>Краткая цель</label><input class="input" v-model="editingHabit.subtitle" placeholder="Например, 5 × 500 мл"/></div><div class="row"><div class="field"><label>Количество в день</label><input class="input" type="number" min="1" v-model.number="editingHabit.target"/></div><div class="field"><label>Цвет</label><input class="input color-input" type="color" v-model="editingHabit.color"/></div></div><div class="field"><label>Дни выполнения</label><div class="weekday-picker"><button v-for="d in [{v:1,t:'Пн'},{v:2,t:'Вт'},{v:3,t:'Ср'},{v:4,t:'Чт'},{v:5,t:'Пт'},{v:6,t:'Сб'},{v:0,t:'Вс'}]" :key="d.v" :class="{active:editingHabit.schedule?.includes(d.v)}" @click="toggleHabitDay(d.v)">{{d.t}}</button></div></div><div class="form-actions"><button v-if="editingHabit.id" class="ghost-btn danger-btn" style="margin-right:auto" @click="archiveHabit"><Archive :size="15"/> Архив</button><button class="ghost-btn" @click="habitOpen=false">Отмена</button><button class="primary-btn" @click="saveHabit">Сохранить</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="workoutEditOpen" class="modal-backdrop" @click.self="workoutEditOpen=false"><div class="modal"><div class="modal-head"><div class="modal-title">Редактор программы</div><button class="close" @click="workoutEditOpen=false"><X :size="17"/></button></div><div class="field"><label>Название</label><input class="input" v-model="editingWorkout.title"/></div><div class="field"><label>Упражнения</label><div v-for="(ex,i) in editingWorkout.exercises" :key="ex.id" class="exercise-editor"><GripVertical :size="14"/><input class="input" v-model="ex.title"/><input class="input small" type="number" v-model.number="ex.sets" title="Подходы"/><input class="input small" v-model="ex.reps" title="Повторения"/><button class="close" @click="editingWorkout.exercises.splice(i,1)"><X :size="13"/></button></div><button class="quick-add" @click="addExercise"><Plus :size="14"/> Добавить упражнение</button></div><div class="form-actions"><button class="ghost-btn" @click="workoutEditOpen=false">Отмена</button><button class="primary-btn" @click="saveWorkout">Сохранить программу</button></div></div></div></Transition>

    <Transition name="fade"><div v-if="focusOpen" class="focus-overlay"><button class="focus-close" aria-label="Закрыть режим сейчас" @click="focusOpen=false;clearInterval(focusInterval)"><Minimize2 :size="20"/></button><div class="focus-content"><div class="eyebrow">Сейчас имеет значение только это</div><h1>{{activeTask?.title}}</h1><p v-if="activeTask?.notes">{{activeTask.notes}}</p><div v-if="activeTask?.subtasks?.length" class="focus-checklist"><button v-for="sub in activeTask.subtasks" :key="sub.id" @click="toggleSubtask(activeTask,sub)"><span class="check" :class="{done:sub.done}"><Check v-if="sub.done" :size="13"/></span>{{sub.title}}</button></div><div class="focus-timer">{{timerText(focusSeconds)}}</div><div class="focus-actions"><button class="icon-btn big" @click="resetFocus"><RotateCcw :size="20"/></button><button class="primary-btn big" @click="toggleFocusTimer"><component :is="focusRunning?Pause:Play" :size="21"/>{{focusRunning?'Пауза':'Продолжить'}}</button><button class="primary-btn big success" @click="toggleTask(activeTask);focusOpen=false;clearInterval(focusInterval)"><Check :size="21"/>Готово</button></div><div class="section-meta">Следующий шаг появится автоматически после завершения</div></div></div></Transition>

    <Transition name="fade"><div v-if="cloudOpen" class="modal-backdrop" @click.self="cloudOpen=false"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Единый план на всех устройствах</div><div class="modal-title">Облачная синхронизация</div></div><button class="close" @click="cloudOpen=false"><X :size="17"/></button></div>
      <template v-if="cloud.connected"><div class="card card-pad" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:12px"><div class="habit-icon" style="background:#13382d;color:#34d399"><Cloud :size="19"/></div><div><strong style="font-size:13px">{{cloud.user?.email}}</strong><div class="habit-sub">Последнее обновление: {{formatSync()}}</div></div></div></div><p class="quote">Изменения сохраняются локально сразу и отправляются в облако при наличии сети. На другом устройстве войдите в этот же аккаунт.</p><div v-if="cloud.error" class="tag" style="color:#fda4af">{{cloud.error}}</div><div class="form-actions"><button class="ghost-btn" @click="signOut"><LogOut :size="15"/> Выйти</button><button class="primary-btn" @click="doSync"><RefreshCw :size="15"/> Обновить сейчас</button></div></template>
      <template v-else><div v-if="!cloud.configured"><p class="quote">Для синхронизации нужен бесплатный проект Supabase. Вставьте URL и публичный anon key. Эти параметры не дают административного доступа к базе.</p><div class="field"><label>Supabase Project URL</label><input class="input" v-model="auth.url" placeholder="https://….supabase.co"/></div><div class="field"><label>Public anon key</label><textarea class="textarea" rows="3" v-model="auth.key" placeholder="eyJ…"></textarea></div><button class="primary-btn" style="width:100%" @click="saveCloudConfig">Сохранить подключение</button></div><div v-else><div class="templates" style="grid-template-columns:1fr 1fr"><button class="template" :style="auth.mode==='signin'?{borderColor:'#7455b5'}:{}" @click="auth.mode='signin'">Войти</button><button class="template" :style="auth.mode==='signup'?{borderColor:'#7455b5'}:{}" @click="auth.mode='signup'">Создать аккаунт</button></div><div class="field"><label>Email</label><input type="email" class="input" v-model="auth.email"/></div><div class="field"><label>Пароль (минимум 6 символов)</label><input type="password" class="input" v-model="auth.password"/></div><div v-if="cloud.error" style="font-size:11px;color:#fb7185;margin-bottom:10px">{{cloud.error}}</div><button class="primary-btn" style="width:100%" :disabled="auth.busy" @click="submitAuth">{{auth.mode==='signin'?'Войти и синхронизировать':'Создать защищённый аккаунт'}}</button></div></template>
    </div></div></Transition>

    <Transition name="fade"><div v-if="toast" class="toast" role="status">{{toast}} <button v-if="lastDeleted" @click="undoDelete">Отменить</button><button v-if="updateAvailable" @click="applyUpdate">Обновить</button></div></Transition>
  </div>
</template>
