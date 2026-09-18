import { carregarTarefas } from './js/api.js';
import { STAGES, STAGE_LABELS, PRIORITIES, ACTIONS, NOTES, selectTasks, deadline, nextDeadline, normalizarTarefas, cloneTasks } from './js/estados.js';
import { renderizarEstado } from './js/renderizacao.js';

// Interface: estado local, elementos de texto e controles nativos.
const $ = selector => document.querySelector(selector);
const root = document.documentElement;
const board = $('#board');
const tasks = [];
let initialTasks = [];
let loadingState = { tipo: 'carregando', mensagem: '' };
const filters = {search:'',priority:'',status:'',sort:'prazo-asc'};
const nodes = new Map();
const template = $('#task-template');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let userMotion = true;
let lightningOn = true;
let busy = false;
let undoAction = null;
let toastTimer = 0;
let currentLetterId = null;
let noraTimer = 0;
let noraBusy = false;
let highlightTimer = 0;
const canMove = () => userMotion && !reducedMotion.matches && !document.hidden;
const activeAnimations = new Set();
const animate = (node, frames, options) => {
  if (!canMove() || typeof node.animate !== 'function') return Promise.resolve();
  const animation = node.animate(frames,options);
  activeAnimations.add(animation);
  return animation.finished.catch(()=>{}).finally(()=>activeAnimations.delete(animation));
};
const taskDateFormatter = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'});
const letterDateFormatter = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
function updateOwlLetter() {
  const available = loadingState.tipo === 'sucesso';
  $('#owl-toggle').disabled = !available;
  if (!available) {
    $('#owl-hint').textContent = loadingState.tipo === 'erro' ? 'Prazos indisponíveis.' : 'Carregando prazos…';
    setLetterOpen(false);
    currentLetterId = null;
    return;
  }
  const next=nextDeadline(tasks);
  const previous=currentLetterId;
  currentLetterId=next?next.id:null;
  const lateCount=tasks.filter(task=>task.status!=='concluida'&&deadline(task).late).length;
  $('#owl-hint').textContent=lateCount
    ?lateCount+(lateCount===1?' tarefa em atraso':' tarefas em atraso')
    :next?'Próxima entrega: '+deadline(next).label.toLocaleLowerCase('pt-BR'):'Todas as tarefas entregues.';
  $('#owl-eyebrow').textContent=next?'LEMBRETE DE ENTREGA':'CORRESPONDÊNCIA EM DIA';
  $('#owl-title').textContent=next?next.title:'Nenhum prazo pendente.';
  $('#owl-course').textContent=next?next.course:'A coruja pode descansar por enquanto.';
  $('#owl-deadline').hidden=!next;
  $('#owl-meta').hidden=!next;
  $('#owl-find').hidden=!next;
  $('#owl-note').textContent=next?'Prazos vencidos vêm primeiro. A carta considera todas as tarefas.':'Uma tarefa reaberta volta a aparecer nos lembretes.';
  if(next){
    const due=deadline(next);
    $('#owl-relative').textContent=due.label;
    $('#owl-deadline').classList.toggle('late',due.late);
    $('#owl-date').dateTime=next.date;
    $('#owl-date').textContent=letterDateFormatter.format(new Date(next.date+'T12:00:00'));
    $('#owl-meta').textContent='Prioridade '+PRIORITIES[next.priority].toLocaleLowerCase('pt-BR')+' · '+STAGE_LABELS[next.status];
    $('#owl-find').setAttribute('aria-label','Localizar no quadro: '+next.title);
  }
  if(previous!==currentLetterId&&!$('#owl-letter').hidden){
    $('#owl-announcement').textContent=next?'Carta atualizada: '+next.title+'. '+deadline(next).label+'.':'Todas as tarefas estão concluídas. Nenhum prazo pendente.';
  }
}
function setLetterOpen(open,returnFocus=false) {
  $('#owl-toggle').setAttribute('aria-expanded',String(open));
  $('#owl-letter').hidden=!open;
  $('#owl-action-label').textContent=open?'Fechar carta':'Abrir carta';
  if(open)updateOwlLetter();
  if(returnFocus)$('#owl-toggle').focus({preventScroll:true});
}
function setLight(lumos) {
  root.dataset.light=lumos?'lumos':'nox';
  $('#light-toggle').setAttribute('aria-pressed',String(lumos));
  $('#light-label').textContent=lumos?'Nox · apagar':'Lumos · acender';
}
function updateCard(task) {
  const node = nodes.get(task.id);
  const paper = node.querySelector('.paper');
  paper.classList.toggle('is-done',task.status==='concluida');
  const action = node.querySelector('.task-action');
  action.textContent = ACTIONS[task.status];
  action.setAttribute('aria-label',ACTIONS[task.status]+': '+task.title);
  node.querySelector('.receipt-note').textContent = NOTES[task.status];
  const due = deadline(task);
  const dueNode = node.querySelector('.due-relative');
  dueNode.textContent = due.label;
  dueNode.classList.toggle('late',due.late);
}
function createCard(task) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = String(task.id);
  const paper = node.querySelector('.paper');
  const heading = node.querySelector('h4');
  heading.id = 'task-title-'+task.id;
  heading.textContent = task.title;
  paper.setAttribute('aria-labelledby',heading.id);
  node.querySelector('.folio-id').textContent = 'FICHA '+String(task.id).padStart(2,'0');
  const priority = node.querySelector('.priority');
  priority.textContent = PRIORITIES[task.priority].toLocaleUpperCase('pt-BR');
  priority.dataset.priority = task.priority;
  priority.setAttribute('aria-label','Prioridade '+PRIORITIES[task.priority]);
  node.querySelector('.course').textContent = task.course;
  const time = node.querySelector('time');
  time.dateTime = task.date;
  time.textContent = taskDateFormatter.format(new Date(task.date+'T12:00:00')).replace('.','').toLocaleUpperCase('pt-BR');
  node.querySelector('.description').textContent = task.description;
  const detail = node.querySelector('.scroll-detail');
  detail.id = 'task-details-'+task.id;
  const detailButton = node.querySelector('.details-button');
  detailButton.setAttribute('aria-controls',detail.id);
  detailButton.setAttribute('aria-label','Ver detalhes: '+task.title);
  detailButton.addEventListener('click',()=>{
    const expanded = detailButton.getAttribute('aria-expanded') !== 'true';
    detailButton.setAttribute('aria-expanded',String(expanded));
    detailButton.querySelector('span').textContent = expanded?'Ocultar detalhes':'Ver detalhes';
    detailButton.setAttribute('aria-label',(expanded?'Ocultar detalhes: ':'Ver detalhes: ')+task.title);
    detail.inert = !expanded;
    detail.setAttribute('aria-hidden',String(!expanded));
    detail.classList.toggle('open',expanded);
  });
  const checklist = node.querySelector('.checklist');
  task.checklist.forEach((text,index)=>{
    const li=document.createElement('li'), label=document.createElement('label'), check=document.createElement('input'), span=document.createElement('span');
    check.type='checkbox'; check.checked=task.checks[index];
    check.addEventListener('change',()=>{task.checks[index]=check.checked;});
    span.textContent=text; label.append(check,span); li.append(label); checklist.append(li);
  });
  const resetTilt = () => {paper.style.setProperty('--pitch','0deg');paper.style.setProperty('--yaw','0deg');};
  paper.addEventListener('pointermove',event=>{
    if (!canMove() || !finePointer.matches || busy || paper.contains(document.activeElement)) return;
    const r=paper.getBoundingClientRect();
    paper.style.setProperty('--pitch',((.5-(event.clientY-r.top)/r.height)*3.5)+'deg');
    paper.style.setProperty('--yaw',(((event.clientX-r.left)/r.width-.5)*3.5)+'deg');
  });
  paper.addEventListener('pointerleave',resetTilt);
  paper.addEventListener('focusin',resetTilt);
  node.querySelector('.task-action').addEventListener('click',()=>{
    const index=STAGES.indexOf(task.status);
    moveTask(task,STAGES[(index+1)%STAGES.length]);
  });
  nodes.set(task.id,node);
  updateCard(task);
  return node;
}
function updateSummary() {
  const done=tasks.filter(t=>t.status==='concluida').length;
  const percent=tasks.length?Math.round(done/tasks.length*100):0;
  $('#stat-done').textContent=loadingState.tipo==='sucesso'?done:'—';
  $('#stat-pending').textContent=loadingState.tipo==='sucesso'?tasks.length-done:'—';
  $('#progress-label').textContent=percent+'%';
  $('#progress-fill').style.width=percent+'%';
  $('#progress').setAttribute('aria-valuenow',String(percent));
  updateOwlLetter();
}
function render() {
  if (!renderizarEstado(loadingState, tasks)) {
    updateSummary();
    return;
  }
  const visible=selectTasks(tasks,filters);
  const visibleIds=new Set(visible.map(t=>t.id));
  for(const task of tasks) {
    if(!nodes.has(task.id))createCard(task);
    nodes.get(task.id).hidden=!visibleIds.has(task.id);
    updateCard(task);
  }
  for(const status of STAGES) {
    const stage=document.querySelector('[data-stage="'+status+'"]');
    const list=$('#list-'+status);
    const group=visible.filter(t=>t.status===status);
    const inactive=tasks.filter(t=>t.status===status&&!visibleIds.has(t.id));
    for(const task of [...group,...inactive])list.append(nodes.get(task.id));
    stage.hidden=!!filters.status&&filters.status!==status;
    stage.querySelector('.stage-count').textContent=String(group.length).padStart(2,'0');
    stage.querySelector('.stage-empty').hidden=group.length>0;
  }
  board.classList.toggle('single',!!filters.status);
  board.hidden=visible.length===0;
  $('#no-results').hidden=visible.length!==0;
  $('#results').textContent=visible.length+' de '+tasks.length+' tarefas'+(filters.status?' · '+STAGE_LABELS[filters.status]:'');
  document.querySelectorAll('[data-status-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.statusFilter===filters.status)));
  updateSummary();
}
function notify(message,change) {
  clearTimeout(toastTimer);
  undoAction=change||null;
  $('#toast').hidden=false;
  $('#toast-message').textContent=message;
  $('#undo').hidden=!change;
  toastTimer=window.setTimeout(()=>{
    if(!$('#toast').contains(document.activeElement))$('#toast').hidden=true;
  },11000);
}
async function moveTask(task,next,record=true) {
  if(busy||task.status===next)return;
  busy=true;
  const previous=task.status;
  const focused=document.activeElement;
  const measured=[...nodes.values()].filter(n=>!n.hidden&&n.getClientRects().length);
  const before=new Map(measured.map(n=>[n,n.getBoundingClientRect()]));
  task.status=next;
  render();
  const node=nodes.get(task.id), paper=node.querySelector('.paper');
  paper.style.setProperty('--pitch','0deg');paper.style.setProperty('--yaw','0deg');
  const action=node.querySelector('.task-action');
  action.disabled=true;
  node.style.zIndex='5';
  const promises=[];
  if(canMove()){
    for(const item of measured) {
      if(item.hidden||!item.getClientRects().length)continue;
      const old=before.get(item), now=item.getBoundingClientRect();
      const dx=old.left-now.left,dy=old.top-now.top;
      if(Math.abs(dx)+Math.abs(dy)>1)promises.push(animate(item,[
        {transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}
      ],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'}));
    }
    if(next==='concluida'&&!node.hidden&&node.getClientRects().length){
      promises.push(animate(node.querySelector('.wax-seal'),[
        {opacity:0,transform:'scale(1.65) rotate(-16deg)'},
        {opacity:1,transform:'scale(.94) rotate(-8deg)',offset:.8},
        {opacity:1,transform:'scale(1) rotate(-8deg)'}
      ],{duration:420,delay:220,fill:'backwards',easing:'ease-out'}));
      promises.push(animate(node.querySelector('.seal-ring'),[
        {opacity:0,transform:'scale(.5)'},{opacity:.7,transform:'scale(2)',offset:.3},
        {opacity:0,transform:'scale(7)'}
      ],{duration:630,delay:410,fill:'backwards',easing:'ease-out'}));
    }
  }
  await Promise.all(promises);
  action.disabled=false; node.style.zIndex=''; busy=false;
  if(focused===action || focused===$('#undo')) {
    if(!node.hidden&&!node.closest('.stage').hidden&&!board.hidden)action.focus({preventScroll:true});
    else document.querySelector('[data-status-filter][aria-pressed="true"]').focus({preventScroll:true});
  }
  notify('“'+task.title+'” → '+STAGE_LABELS[next]+'.',record?{id:task.id,previous}:null);
}
function clearFilters(){
  filters.search='';filters.priority='';filters.status='';filters.sort='prazo-asc';
  $('#search').value='';$('#priority-filter').value='';$('#sort').value='prazo-asc';
  render();
}
$('#light-toggle').addEventListener('click',()=>setLight(root.dataset.light!=='lumos'));
$('#owl-toggle').addEventListener('click',()=>setLetterOpen($('#owl-letter').hidden));
$('#owl-close').addEventListener('click',()=>setLetterOpen(false,true));
$('#owl-mail').addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('#owl-letter').hidden){event.preventDefault();setLetterOpen(false,true);}
});
$('#owl-find').addEventListener('click',()=>{
  const task=tasks.find(item=>item.id===currentLetterId&&item.status!=='concluida');
  if(!task){updateOwlLetter();return;}
  // Revela a ficha mesmo quando a busca ou os marcadores a estavam escondendo.
  clearFilters();
  setLetterOpen(false);
  const node=nodes.get(task.id), paper=node.querySelector('.paper');
  const detailButton=node.querySelector('.details-button');
  if(detailButton.getAttribute('aria-expanded')!=='true')detailButton.click();
  clearTimeout(highlightTimer);
  for(const card of nodes.values())card.querySelector('.paper').classList.remove('located');
  paper.classList.add('located');
  detailButton.focus({preventScroll:true});
  node.scrollIntoView({behavior:canMove()?'smooth':'instant',block:'center'});
  highlightTimer=window.setTimeout(()=>paper.classList.remove('located'),4800);
});
$('#nora-greet').addEventListener('click',async()=>{
  if(noraBusy)return;
  noraBusy=true;
  clearTimeout(noraTimer);
  $('#nora-thought').hidden=false;
  noraTimer=window.setTimeout(()=>{$('#nora-thought').hidden=true;},4300);
  await Promise.all([
    animate($('.nora-pose'),[
      {transform:'scale(1)'},{transform:'scale(.96,1.07)',offset:.38},
      {transform:'scale(1.02,.98)',offset:.76},{transform:'scale(1)'}
    ],{duration:1650,easing:'ease-in-out'}),
    animate($('.nora-head'),[
      {transform:'rotate(0)'},{transform:'rotate(-10deg)',offset:.42},
      {transform:'rotate(-5deg)',offset:.7},{transform:'rotate(0)'}
    ],{duration:1800,easing:'ease-in-out'})
  ]);
  noraBusy=false;
});
$('#filters').addEventListener('submit',event=>event.preventDefault());
$('#search').addEventListener('input',event=>{filters.search=event.target.value;render();});
$('#priority-filter').addEventListener('change',event=>{filters.priority=event.target.value;render();});
$('#sort').addEventListener('change',event=>{filters.sort=event.target.value;render();});
document.querySelectorAll('[data-status-filter]').forEach(button=>button.addEventListener('click',()=>{filters.status=button.dataset.statusFilter;render();}));
$('#clear-filters').addEventListener('click',clearFilters);
$('#clear-empty').addEventListener('click',()=>{clearFilters();$('#search').focus();});
$('#undo').addEventListener('click',()=>{
  if(!undoAction||busy)return;
  const change=undoAction;undoAction=null;
  moveTask(tasks.find(t=>t.id===change.id),change.previous,false);
});
$('#close-toast').addEventListener('click',()=>{
  $('#toast').hidden=true;document.querySelector('[data-status-filter][aria-pressed="true"]').focus({preventScroll:true});
});
$('#load-retry').addEventListener('click',iniciar);
$('#reset-board').addEventListener('click',()=>{
  if(busy)return;
  for(const animation of activeAnimations)animation.cancel();
  for(const node of nodes.values())node.remove();
  nodes.clear();
  tasks.splice(0,tasks.length,...cloneTasks(initialTasks));
  clearFilters();notify('Quadro restaurado com as tarefas carregadas do arquivo.',null);
});
render();

// Cenário procedural: Canvas 2D, chuva limitada à janela e iluminação gradual.
const canvas=$('#weather');
const context=canvas.getContext('2d');
const weatherState={width:260,height:254,dpr:1,rain:[],glassDrops:[],raf:0,last:0,time:0,visible:true,bolt:null,flashStart:-Infinity,nextLightning:performance.now()+9000,lastStrike:-Infinity};
const random=(min,max)=>min+Math.random()*(max-min);
function buildRain(){
  const density=window.innerWidth<570?58:88;
  weatherState.rain=Array.from({length:density},()=>({x:random(-25,weatherState.width+20),y:random(-weatherState.height,weatherState.height),speed:random(150,330),length:random(9,23),alpha:random(.09,.28)}));
  weatherState.glassDrops=Array.from({length:9},()=>({x:random(15,weatherState.width-15),y:random(0,weatherState.height),speed:random(4,15),length:random(8,31)}));
}
function resizeWeather(){
  if(!context)return;
  const rect=canvas.getBoundingClientRect();
  weatherState.width=rect.width;weatherState.height=rect.height;
  weatherState.dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(rect.width*weatherState.dpr));canvas.height=Math.max(1,Math.round(rect.height*weatherState.dpr));
  context.setTransform(weatherState.dpr,0,0,weatherState.dpr,0,0);
  buildRain();drawWeather(performance.now(),0);
}
function tower(x,base,width,height){
  const c=context;const top=base-height;
  c.fillRect(x,top,width,height);
  c.beginPath();c.moveTo(x-3,top);c.lineTo(x+width/2,top-width*.82);c.lineTo(x+width+3,top);c.closePath();c.fill();
}
function strike(){
  const now=performance.now();
  if(!context||!canMove()||!lightningOn||now-weatherState.lastStrike<7000)return;
  weatherState.lastStrike=now;weatherState.flashStart=now;
  weatherState.nextLightning=now+random(24000,42000);
  const w=weatherState.width,h=weatherState.height;
  let x=random(w*.62,w*.83),y=8;
  weatherState.bolt=[{x,y}];
  for(let i=1;i<7;i++){y+=h*.065;x+=random(-15,8);weatherState.bolt.push({x,y});}
}
function drawWeather(now,delta){
  if(!context)return;
  const c=context,w=weatherState.width,h=weatherState.height;
  const elapsed=now-weatherState.flashStart;
  const flash=elapsed>=0&&elapsed<1500&&canMove()&&lightningOn?Math.sin(Math.PI*elapsed/1500)*.24:0;
  c.clearRect(0,0,w,h);
  const sky=c.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'#14263d');sky.addColorStop(1,'#2c4157');
  c.fillStyle=sky;c.fillRect(0,0,w,h);
  if(flash){c.fillStyle='rgba(169,188,214,'+flash+')';c.fillRect(0,0,w,h);}
  c.fillStyle='#c5d2cc';c.globalAlpha=.53;c.beginPath();c.arc(w*.3,h*.26,19,0,Math.PI*2);c.fill();
  c.fillStyle='#192d43';c.beginPath();c.arc(w*.3+7,h*.26-4,18,0,Math.PI*2);c.fill();c.globalAlpha=1;
  c.fillStyle='#cddbe3';
  for(let i=0;i<16;i++){const x=((i*67+19)%251)/251*w,y=((i*41+13)%91)/160*h;c.globalAlpha=.12+(i%3)*.07;c.fillRect(x,y,1,1);}
  c.globalAlpha=1;
  c.fillStyle='rgba(16,29,45,.28)';c.beginPath();c.ellipse(w*.55+Math.sin(weatherState.time*.03)*17,h*.28,w*.65,18,-.08,0,Math.PI*2);c.fill();
  if(flash>.015&&weatherState.bolt){
    const bolt=weatherState.bolt;c.strokeStyle='rgba(213,224,234,'+(flash*2.2)+')';c.lineWidth=1.35;
    c.beginPath();c.moveTo(bolt[0].x,bolt[0].y);bolt.slice(1).forEach(p=>c.lineTo(p.x,p.y));c.stroke();
    const branch=bolt[3];c.lineWidth=.7;c.beginPath();c.moveTo(branch.x,branch.y);c.lineTo(branch.x+17,branch.y+8);c.lineTo(branch.x+22,branch.y+25);c.stroke();
  }
  c.fillStyle='#122638';c.beginPath();c.moveTo(0,h);c.lineTo(0,h*.85);c.quadraticCurveTo(w*.25,h*.68,w*.5,h*.87);c.quadraticCurveTo(w*.8,h*.74,w,h*.82);c.lineTo(w,h);c.fill();
  c.fillStyle=flash>.07?'#1e3349':'#0f1d2d';
  c.fillRect(w*.2,h*.73,w*.58,h*.27);
  tower(w*.19,h,w*.105,h*.35);tower(w*.37,h,w*.1,h*.5);tower(w*.56,h,w*.14,h*.42);tower(w*.76,h,w*.075,h*.32);
  c.fillStyle='rgba(204,166,95,.54)';
  [[.23,.76],[.415,.6],[.415,.68],[.61,.69],[.645,.78],[.78,.79],[.34,.88],[.7,.9]].forEach(([x,y])=>c.fillRect(w*x,h*y,2.3,4));
  const haze=c.createLinearGradient(0,h*.7,0,h);haze.addColorStop(0,'#243b4900');haze.addColorStop(1,'#34465670');c.fillStyle=haze;c.fillRect(0,h*.7,w,h*.3);
  for(const drop of weatherState.rain){
    if(delta){drop.y+=drop.speed*delta;drop.x-=drop.speed*.24*delta;if(drop.y>h+drop.length||drop.x< -30){drop.y=random(-40,-5);drop.x=random(0,w+40);}}
    c.strokeStyle='rgba(196,216,232,'+drop.alpha+')';c.lineWidth=.65;c.beginPath();c.moveTo(drop.x,drop.y);c.lineTo(drop.x-3.5,drop.y+drop.length);c.stroke();
  }
  for(const drop of weatherState.glassDrops){
    if(delta){drop.y+=drop.speed*delta;if(drop.y>h+30){drop.y=-20;drop.x=random(10,w-10);}}
    c.strokeStyle='rgba(184,212,228,.16)';c.lineWidth=1.2;c.beginPath();c.moveTo(drop.x,drop.y);c.lineTo(drop.x-.6,drop.y+drop.length);c.stroke();
    c.fillStyle='rgba(202,219,231,.3)';c.beginPath();c.ellipse(drop.x-.6,drop.y+drop.length,1.3,2.6,0,0,Math.PI*2);c.fill();
  }
}
function weatherFrame(now){
  weatherState.raf=0;
  if(!canMove()||!weatherState.visible||!context)return;
  if(now-weatherState.last>=33){
    const delta=weatherState.last?Math.min((now-weatherState.last)/1000,.06):0;
    weatherState.last=now;weatherState.time+=delta;
    if(lightningOn&&now>=weatherState.nextLightning)strike();
    drawWeather(now,delta);
  }
  weatherState.raf=requestAnimationFrame(weatherFrame);
}
function syncWeather(){
  if(weatherState.raf)cancelAnimationFrame(weatherState.raf);
  weatherState.raf=0;weatherState.last=0;
  if(canMove()&&weatherState.visible&&context)weatherState.raf=requestAnimationFrame(weatherFrame);
  else{weatherState.flashStart=-Infinity;drawWeather(performance.now(),0);}
}
function syncMotion(){
  const enabled=userMotion&&!reducedMotion.matches;
  root.dataset.motion=enabled?'on':'off';
  $('#motion-toggle').setAttribute('aria-pressed',String(enabled));
  $('#motion-toggle').disabled=reducedMotion.matches;
  $('#motion-label').textContent=reducedMotion.matches?'Movimento reduzido pelo sistema':enabled?'Animações ligadas':'Animações desligadas';
  $('#lightning-toggle').setAttribute('aria-pressed',String(enabled&&lightningOn));
  $('#lightning-toggle').disabled=!enabled;
  $('#lightning-label').textContent=enabled&&lightningOn?'Relâmpagos ligados':'Relâmpagos desligados';
  $('#test-lightning').disabled=!enabled||!lightningOn||!context;
  $('#weather-label').textContent=enabled?'CHUVA NA TORRE NORTE':'TORRE NORTE · CENA ESTÁTICA';
  if(!enabled){
    for(const animation of activeAnimations)animation.cancel();
    for(const node of nodes.values()){const paper=node.querySelector('.paper');paper.style.setProperty('--pitch','0deg');paper.style.setProperty('--yaw','0deg');}
    weatherState.flashStart=-Infinity;
  }
  syncWeather();
}
$('#motion-toggle').addEventListener('click',()=>{userMotion=!userMotion;syncMotion();});
$('#lightning-toggle').addEventListener('click',()=>{lightningOn=!lightningOn;weatherState.flashStart=-Infinity;syncMotion();});
$('#test-lightning').addEventListener('click',()=>{
  strike();$('#test-lightning').disabled=true;
  window.setTimeout(()=>{$('#test-lightning').disabled=!canMove()||!lightningOn||!context;},7000);
});
if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',syncMotion);
document.addEventListener('visibilitychange',()=>{
  root.dataset.pageHidden=String(document.hidden);
  if(document.hidden)for(const animation of activeAnimations)animation.cancel();
  syncWeather();
});
if('ResizeObserver' in window)new ResizeObserver(resizeWeather).observe(canvas);
else window.addEventListener('resize',resizeWeather);
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
  weatherState.visible=entries[0].isIntersecting;syncWeather();
},{rootMargin:'80px'}).observe(canvas);
resizeWeather();syncMotion();

// Mantém o carregamento por fetch e os estados de rede da atividade original.
async function iniciar() {
  const returnFocus = document.activeElement === $('#load-retry');
  loadingState = { tipo: 'carregando', mensagem: '' };
  render();
  try {
    initialTasks = normalizarTarefas(await carregarTarefas());
    tasks.splice(0, tasks.length, ...cloneTasks(initialTasks));
    loadingState = { tipo: 'sucesso', mensagem: '' };
  } catch (erro) {
    loadingState = { tipo: 'erro', mensagem: erro.message };
  }
  render();
  if (returnFocus) {
    const target = loadingState.tipo === 'sucesso' && tasks.length ? $('#search') : $('#load-retry');
    target.focus({ preventScroll: true });
  }
}
iniciar();
