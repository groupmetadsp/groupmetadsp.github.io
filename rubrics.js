/* ПЛАТФОРМА v1.2 · пиктограммы и перетаскивание подразделов и материалов */
(function(){
'use strict';
const IDS=['system','method','tools','projects','analytics','knowledge','development'];
const STORAGE='platform-hierarchy-v2';
const DELETED_KEY='platform-hierarchy-deleted-v1';
const ORDER_KEY='platform-hierarchy-order-v1';
const LEGACY='platform-rubric-drafts-v1';
const LEGACY_TOOLS='platform-tool-drafts-v1';
const el=id=>document.getElementById(id);
const isRubric=id=>IDS.includes(id);
const sectionInfo=id=>sections.find(s=>s.id===id);
const empty=()=>Object.fromEntries(IDS.map(id=>[id,[]]));
let published=empty();
let drafts=empty();
let removed=Object.fromEntries(IDS.map(id=>[id,{subsections:[],materials:{}}]));
let chosen=Object.fromEntries(IDS.map(id=>[id,null]));
let editorType='',editorRubric='',editorSubId='',editorMaterialId='';
function esc(x){
  return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uid(prefix){
  return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
}
function material(raw){
  if(!raw || typeof raw!=='object')return null;
  const id=String(raw.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,90);
  const name=String(raw.name||'').trim().slice(0,100);
  if(!id||!name)return null;
  const url=typeof raw.url==='string'?raw.url.trim().slice(0,900):'';
  const allowedStatuses=['development','verified','update'];
  const status=allowedStatuses.includes(raw.status)?raw.status:'';
  return {id,name,url,primary:raw.primary===true,status,archived:raw.archived===true};
}
function subsection(raw){
  if(!raw || typeof raw!=='object')return null;
  const id=String(raw.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,90);
  const name=String(raw.name||'').trim().slice(0,90);
  if(!id||!name)return null;
  const materials=Array.isArray(raw.materials)?raw.materials.map(material).filter(Boolean):[];
  // В пределах одного подраздела может быть только один главный материал.
  let hasPrimary=false;
  for(const m of materials){if(m.primary){if(hasPrimary)m.primary=false;else hasPrimary=true;}}
  return {id,name,materials};
}
function sectionsList(v){return Array.isArray(v)?v.map(subsection).filter(Boolean):[];}
function storageGet(key,fallback){
  try{const val=localStorage.getItem(key);return val?JSON.parse(val):fallback;}catch(e){return fallback;}
}
// Отдельная раскладка: порядок не меняет опубликованный каталог и не теряет старые материалы.
const savedOrdering=storageGet(ORDER_KEY,{});
const ordering={
  subsections:(savedOrdering.subsections&&typeof savedOrdering.subsections==='object')?savedOrdering.subsections:{},
  materials:(savedOrdering.materials&&typeof savedOrdering.materials==='object')?savedOrdering.materials:{}
};
function orderedItems(items,ids){
  if(!Array.isArray(ids)||!ids.length)return items;
  const rank=new Map(ids.map((id,index)=>[id,index]));
  return items.map((item,index)=>({item,index})).sort((a,b)=>{
    const ra=rank.has(a.item.id)?rank.get(a.item.id):Number.MAX_SAFE_INTEGER;
    const rb=rank.has(b.item.id)?rank.get(b.item.id):Number.MAX_SAFE_INTEGER;
    return ra===rb?a.index-b.index:ra-rb;
  }).map(x=>x.item);
}
function subsectionOrder(rubric){
  return Array.isArray(ordering.subsections[rubric])?ordering.subsections[rubric]:[];
}
function materialOrder(rubric,subId){
  return Array.isArray(ordering.materials[rubric]?.[subId])?ordering.materials[rubric][subId]:[];
}
function saveOrdering(){
  try{localStorage.setItem(ORDER_KEY,JSON.stringify(ordering));return true;}
  catch(e){alert('Не удалось сохранить порядок в памяти браузера.');return false;}
}
function persist(){
  try{
    localStorage.setItem(STORAGE,JSON.stringify(drafts));
    localStorage.setItem(DELETED_KEY,JSON.stringify(removed));
    return true;
  }catch(e){alert('Не удалось сохранить изменение в этом браузере.');return false;}
}
function ensureRemoved(rubric){
  if(!removed[rubric])removed[rubric]={subsections:[],materials:{}};
  if(!Array.isArray(removed[rubric].subsections))removed[rubric].subsections=[];
  if(!removed[rubric].materials || typeof removed[rubric].materials!=='object')removed[rubric].materials={};
  return removed[rubric];
}
function materialRemoved(rubric,subId,matId){
  const deleted=ensureRemoved(rubric);
  return (deleted.materials[subId]||[]).includes(matId);
}
function subsectionRemoved(rubric,subId){
  return ensureRemoved(rubric).subsections.includes(subId);
}
function validUrl(raw){
  if(!raw||!raw.trim())return '';
  const value=raw.trim();
  if(!value.startsWith('/') && !/^https:\/\//i.test(value))return '';
  try{
    const u=new URL(value,window.location.origin);
    return u.protocol==='https:'?u.href:'';
  }catch(e){return '';}
}
const stored=storageGet(STORAGE,{});
const deleted=storageGet(DELETED_KEY,{});
for(const id of IDS){
  const record=deleted && deleted[id] ? deleted[id] : {};
  removed[id]={
    subsections:Array.isArray(record.subsections)?record.subsections.filter(x=>typeof x==='string'):[],
    materials:record.materials && typeof record.materials==='object' ? record.materials : {}
  };
}
for(const rubric of IDS)drafts[rubric]=sectionsList(stored?.[rubric]);
// Перенос карточек старой одноуровневой версии без потери данных.
function migrateLegacy(){
  const old=storageGet(LEGACY,{});
  const oldTools=storageGet(LEGACY_TOOLS,[]);
  let dirty=false;
  for(const rubric of IDS){
    if(drafts[rubric].some(x=>x.id==='legacy-'+rubric))continue;
    const contents=Array.isArray(old?.[rubric])?old[rubric].map(material).filter(Boolean):[];
    if(rubric==='tools' && Array.isArray(oldTools)){
      const existing=new Set(contents.map(x=>x.id));
      for(const x of oldTools){
        const v=material(x);
        if(v && !existing.has(v.id)){contents.push(v);existing.add(v.id);}
      }
    }
    if(contents.length){
      drafts[rubric].unshift({id:'legacy-'+rubric,name:'Ранее добавленные',materials:contents});
      dirty=true;
    }
  }
  if(dirty)persist();
}
migrateLegacy();
function mergedSections(rubric){
  const map=new Map();
  (published[rubric]||[]).forEach(s=>map.set(s.id,{...s,published:true}));
  (drafts[rubric]||[]).forEach(s=>map.set(s.id,{...s,published:false}));
  const kept=Array.from(map.values()).filter(s=>!subsectionRemoved(rubric,s.id))
    .map(s=>({
      ...s,
      materials:orderedItems(s.materials.filter(m=>!materialRemoved(rubric,s.id,m.id)),materialOrder(rubric,s.id))
    }));
  return orderedItems(kept,subsectionOrder(rubric));
}
function pick(rubric){
  const list=mergedSections(rubric);
  if(!list.length){chosen[rubric]=null;return null;}
  if(!list.some(s=>s.id===chosen[rubric]))chosen[rubric]=list[0].id;
  return list.find(s=>s.id===chosen[rubric]);
}
function copyForEditing(rubric,subId){
  let s=drafts[rubric].find(x=>x.id===subId);
  if(s)return s;
  const base=published[rubric].find(x=>x.id===subId);
  if(!base)return null;
  s={id:base.id,name:base.name,materials:base.materials.map(t=>({...t}))};
  drafts[rubric].push(s);
  return s;
}
function gripIcon(){
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';
}
function trashIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
}
// Небольшие SVG без внешних библиотек, единый стиль штриховых пиктограмм.
const badgePaths={
  star:'<path d="m12 2.6 2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-1z"/>',
  construction:'<path d="M4 20V9M20 20V9M2 9h20M3 4l4 5m2-5 4 5m2-5 4 5M4 20h16"/>',
  verified:'<path d="m12 2 2.3 1.5 2.7-.1 1.2 2.5 2.5 1.2-.1 2.7L22 12l-1.4 2.2.1 2.7-2.5 1.2-1.2 2.5-2.7-.1L12 22l-2.3-1.5-2.7.1-1.2-2.5-2.5-1.2.1-2.7L2 12l1.4-2.2-.1-2.7 2.5-1.2L7 3.4l2.7.1z"/><path d="m8.5 12 2.5 2.5 4.8-5"/>',
  update:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.4 9a7.5 7.5 0 0 1 13-2L20 12M4 12l1.6 4a7.5 7.5 0 0 0 13-1"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 13h4"/>'
};
const badgeHelp={
  development:'Тестовый режим. Продукт в разработке',
  verified:'Материал проверен и готов к применению',
  update:'Материал требует обновления',
  archive:'Архивная версия. Не использовать как актуальную'
};
function badgeSvg(type){
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(badgePaths[type]||'')+'</svg>';
}
function materialBadges(t){
  const main=t.primary===true;
  const starTip=main?'Главный материал подраздела. Нажмите, чтобы снять отметку':'Сделать главным материалом подраздела';
  let html='<div class="material-symbols" aria-label="Обозначения материала">';
  html+='<button type="button" class="material-symbol material-symbol-star'+(main?' is-on':'')+'"'
    +' data-primary-material="'+t.id+'" aria-pressed="'+(main?'true':'false')+'"'
    +' aria-label="'+esc(starTip)+'" data-tooltip="'+esc(starTip)+'">'+badgeSvg('star')+'</button>';
  if(badgeHelp[t.status]){
    html+='<span class="material-symbol material-symbol-'+t.status+'" tabindex="0" role="img"'
      +' aria-label="'+esc(badgeHelp[t.status])+'" data-tooltip="'+esc(badgeHelp[t.status])+'">'+badgeSvg(t.status)+'</span>';
  }
  if(t.archived){
    html+='<span class="material-symbol material-symbol-archive" tabindex="0" role="img"'
      +' aria-label="'+esc(badgeHelp.archive)+'" data-tooltip="'+esc(badgeHelp.archive)+'">'+badgeSvg('archive')+'</span>';
  }
  return html+'</div>';
}
const originalNav=navMarkup;
navMarkup=function(){
  if(!isRubric(current))return originalNav();
  const rubric=current;
  const active=pick(rubric);
  const rows=mergedSections(rubric).map(s=>{
    const name=esc(s.name);
    const activeClass=active&&active.id===s.id?'active':'';
    return '<div class="rubric-nav-row rubric-sortable" data-sort-id="'+s.id+'" data-sort-kind="subsections">'
      +'<button type="button" class="rubric-drag-handle" data-drag-handle="subsections" title="Перетащить подраздел для изменения порядка" aria-label="Перетащить подраздел «'+name+'». Стрелки вверх и вниз меняют порядок">'+gripIcon()+'</button>'
      +'<button type="button" data-subsection="'+s.id+'" class="rubric-nav-item '+activeClass+'" '+(activeClass?'aria-current="page"':'')+' title="'+name+'">'
        +icon('archive')+'<span>'+name+'</span>'
      +'</button>'
      +'<button type="button" class="rubric-nav-edit" data-edit-subsection="'+s.id+'" title="Редактировать подраздел" aria-label="Редактировать '+name+'">'
        +icon('pencil')+'</button>'
      +'<button type="button" class="rubric-nav-delete" data-delete-subsection="'+s.id+'" title="Удалить подраздел" aria-label="Удалить '+name+'">'
        +trashIcon()+'</button>'
      +'</div>';
  }).join('');
  return '<button type="button" data-go="home" title="Вернуться к разделам">'
    +icon('left')+'<span>К разделам</span></button>'
    +'<div class="sidebar-divider"></div>'
    +rows
    +'<button class="sidebar-add" type="button" data-new-subsection title="Добавить подраздел">'
      +icon('plus')+'<span>Добавить подраздел</span></button>';
};
function renderRubric(rubric){
  const section=sectionInfo(rubric);
  const selected=pick(rubric);
  let body='';
  if(!selected){
    body='<div class="tools-empty rubric-empty">'
      +'<strong>Подразделов пока нет</strong>'
      +'Чтобы начать, нажмите «+ Добавить подраздел» в панели слева.'
      +'</div>';
  }else{
    const cards=selected.materials.map(t=>{
      const name=esc(t.name);
      const hasLink=!!validUrl(t.url);
      const main=t.primary===true;
      return '<article class="tool-card rubric-material-card rubric-sortable'+(main?' is-primary':'')+'" data-sort-id="'+t.id+'" data-sort-kind="materials">'
        +'<div class="tool-card-top"><h2>'+name+'</h2>'
          +'<div class="material-card-head-actions">'+materialBadges(t)
          +'<button type="button" class="material-drag-handle" data-drag-handle="materials" title="Перетащить материал" aria-label="Перетащить материал «'+name+'». Стрелки меняют порядок">'+gripIcon()+'</button>'
          +'</div></div>'
        +'<div class="tool-state"><span class="dot"></span>'
           +(hasLink?'Ссылка подключена':'Ссылка пока не назначена')
        +'</div>'
        +'<div class="tool-card-actions">'
        +'<button type="button" class="tool-open" data-open-material="'+t.id+'">'+(hasLink?'Открыть':'Назначить ссылку')+'</button>'
        +'<button type="button" class="tool-edit" data-edit-material="'+t.id+'" title="Редактировать материал" aria-label="Редактировать '+name+'">'+icon('pencil')+'</button>'
        +'<button type="button" class="tool-delete" data-delete-material="'+t.id+'" title="Удалить материал" aria-label="Удалить '+name+'">'+trashIcon()+'</button>'
        +'</div></article>';
    }).join('');
    body='<div class="rubric-subheading">'
      +'<div><p class="rubric-kicker">Подраздел</p>'
      +'<h2>'+esc(selected.name)+'</h2>'
      +'<p class="tool-count">Материалов: '+selected.materials.length+'</p></div>'
      +'<button type="button" class="tool-primary" data-new-material>'+icon('plus')+' Добавить материал</button>'
      +'</div>'
      +(selected.materials.length?'':'<div class="tools-empty"><strong>Здесь пока нет материалов</strong>Нажмите «Добавить материал» — элемент будет создан внутри подраздела «'+esc(selected.name)+'».</div>')
      +'<div class="tool-grid">'+cards+'</div>';
  }
  return '<div class="wrap">'
    +'<div class="path">ПЛАТФОРМА / '+esc(section.name)+(selected?' / '+esc(selected.name):'')+'</div>'
    +'<section class="hero tool-intro"><div>'
      +'<div class="eyebrow">'+esc(section.tag)+'</div>'
      +'<h1>'+esc(section.name)+'</h1>'
      +'<p class="lead">'+esc(section.desc)+'</p>'
    +'</div></section>'
    +body
    +'<div class="footer">ПЛАТФОРМА · '+esc(section.name)+'</div>'
    +'</div>';
}
const originalSection=renderSection;
renderSection=function(section){
  return isRubric(section.id)?renderRubric(section.id):originalSection(section);
};
const originalRender=render;
render=function(){
  originalRender();
  const label=document.querySelector('.side-label');
  if(label)label.textContent=isRubric(current)?'Подразделы · '+sectionInfo(current).name:'Разделы';
};
const modal=[
  '<dialog class="tool-dialog" id="rubric-dialog" aria-labelledby="rubric-dialog-title">',
    '<form id="rubric-form">',
      '<div class="tool-dialog-head"><h2 id="rubric-dialog-title">Добавить подраздел</h2>',
        '<button type="button" class="dialog-close" id="rubric-close" aria-label="Закрыть">×</button></div>',
      '<label for="rubric-name">Название</label>',
      '<input id="rubric-name" type="text" maxlength="100" required autocomplete="off" placeholder="Название">',
      '<div id="rubric-url-wrap">',
        '<label for="rubric-url">Ссылка на материал (необязательно)</label>',
        '<input id="rubric-url" type="text" inputmode="url" autocomplete="off" placeholder="/папка/">',
      '</div>',
      '<div id="rubric-flags-wrap" class="rubric-flags-wrap">',
        '<label for="rubric-status">Состояние материала</label>',
        '<select id="rubric-status">',
          '<option value="">Не указано</option>',
          '<option value="development">В разработке / тестовый режим</option>',
          '<option value="verified">Проверен и готов к применению</option>',
          '<option value="update">Требует актуализации</option>',
        '</select>',
        '<label class="rubric-archive-check" for="rubric-archived">',
          '<input type="checkbox" id="rubric-archived"> Архивная версия',
        '</label>',
      '</div>',
      '<p class="tool-error" id="rubric-error" hidden></p>',
      '<p class="tool-hint" id="rubric-hint">Изменение сохраняется в этом браузере. Для публикации для всех пользователей обновите каталог в GitHub.</p>',
      '<div class="tool-dialog-actions">',
        '<button type="button" class="delete-tool" id="rubric-delete" hidden>Удалить</button>',
        '<button type="button" id="rubric-cancel">Отмена</button>',
        '<button type="submit" class="save-tool">Сохранить</button>',
      '</div>',
    '</form>',
  '</dialog>'
].join('');
document.body.insertAdjacentHTML('beforeend',modal);
function openDialog(type,subId=null,matId=null){
  if(!isRubric(current))return;
  editorType=type;editorRubric=current;editorSubId=subId;editorMaterialId=matId;
  const sub=subId?mergedSections(current).find(s=>s.id===subId):null;
  const mat=sub&&matId?sub.materials.find(x=>x.id===matId):null;
  const isMaterial=type==='material';
  const title=type==='subsection'
    ? (sub?'Редактировать подраздел':'Добавить подраздел')
    : (mat?'Редактировать материал':'Добавить материал');
  el('rubric-dialog-title').textContent=title;
  el('rubric-name').value=isMaterial?(mat?mat.name:''):(sub?sub.name:'');
  el('rubric-name').placeholder=isMaterial?'Название материала':'Название подраздела';
  el('rubric-url-wrap').hidden=!isMaterial;
  el('rubric-url').value=isMaterial&&mat?mat.url:'';
  el('rubric-url').placeholder=isMaterial?'/'+(current==='knowledge'?'standards':current)+'/название/':'/папка/';
  el('rubric-flags-wrap').hidden=!isMaterial;
  el('rubric-status').value=isMaterial&&mat?mat.status||'':'';
  el('rubric-archived').checked=!!(isMaterial&&mat&&mat.archived);
  el('rubric-error').hidden=true;
  el('rubric-hint').textContent=isMaterial
    ? 'Материал будет добавлен в подраздел «'+(sub?sub.name:'')+'», а не в список подразделов. Изменения в браузере — черновик до публикации в GitHub.'
    : 'Создаётся подраздел в меню слева. Материалы добавляются отдельно в его рабочем окне. Изменения в браузере — черновик.';
  const canDelete=type==='subsection'?!!sub:!!(mat && sub);
  el('rubric-delete').hidden=!canDelete;
  if(typeof el('rubric-dialog').showModal==='function')el('rubric-dialog').showModal();
  else el('rubric-dialog').setAttribute('open','');
  el('rubric-name').focus();
}
function closeDialog(){
  if(typeof el('rubric-dialog').close==='function')el('rubric-dialog').close();
  else el('rubric-dialog').removeAttribute('open');
}
// Перемещение только в пределах текущей рубрики / подраздела.
function moveSorted(kind,sourceId,targetId,after){
  if(!isRubric(current)||sourceId===targetId)return false;
  const rubric=current,sub=pick(rubric);
  const isSub=kind==='subsections';
  const list=isSub?mergedSections(rubric):(sub?sub.materials:[]);
  const ids=list.map(item=>item.id);
  const from=ids.indexOf(sourceId),to=ids.indexOf(targetId);
  if(from<0||to<0)return false;
  ids.splice(from,1);
  const dest=ids.indexOf(targetId)+(after?1:0);
  ids.splice(dest,0,sourceId);
  if(isSub){
    ordering.subsections[rubric]=ids;
  }else{
    if(!sub)return false;
    if(!ordering.materials[rubric])ordering.materials[rubric]={};
    ordering.materials[rubric][sub.id]=ids;
  }
  saveOrdering();
  render();
  return true;
}
function sortFromDOM(state){
  const ids=Array.from(state.container.children)
    .filter(node=>node.matches('[data-sort-kind="'+state.kind+'"]'))
    .map(node=>node.dataset.sortId);
  if(!ids.length)return;
  if(state.kind==='subsections')ordering.subsections[state.rubric]=ids;
  else{
    if(!ordering.materials[state.rubric])ordering.materials[state.rubric]={};
    ordering.materials[state.rubric][state.subId]=ids;
  }
  saveOrdering();
  render();
}
let dragState=null;
document.addEventListener('pointerdown',e=>{
  const handle=e.target.closest('[data-drag-handle]');
  if(!handle||!isRubric(current)||(e.pointerType==='mouse'&&e.button!==0))return;
  const source=handle.closest('[data-sort-kind][data-sort-id]');
  if(!source)return;
  const kind=source.dataset.sortKind;
  const container=source.parentElement;
  if(!container || !['subsections','materials'].includes(kind))return;
  const sub=pick(current);
  dragState={
    source,kind,container,rubric:current,subId:sub?.id||'',
    pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:false
  };
  // На телефоне отключаем прокрутку только при взаимодействии с ручкой.
  e.preventDefault();
});
document.addEventListener('pointermove',e=>{
  const d=dragState;
  if(!d||e.pointerId!==d.pointerId)return;
  if(!d.active){
    if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<7)return;
    d.active=true;
    d.source.classList.add('is-dragging');
    document.body.classList.add('rubric-drag-active');
  }
  e.preventDefault();
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-sort-kind="'+d.kind+'"][data-sort-id]');
  if(!target || target===d.source || target.parentElement!==d.container)return;
  const rect=target.getBoundingClientRect();
  const after=d.kind==='subsections'
    ?e.clientY>rect.top+rect.height/2
    : (e.clientY>rect.top+rect.height*0.75 ||
      (e.clientY>=rect.top && e.clientY<=rect.bottom && e.clientX>rect.left+rect.width/2));
  const anchor=after?target.nextSibling:target;
  if(anchor!==d.source)d.container.insertBefore(d.source,anchor);
},{passive:false});
function finishDrag(e){
  const d=dragState;
  if(!d||(e&&e.pointerId!==d.pointerId))return;
  dragState=null;
  document.body.classList.remove('rubric-drag-active');
  d.source.classList.remove('is-dragging');
  if(d.active)sortFromDOM(d);
}
document.addEventListener('pointerup',finishDrag);
document.addEventListener('pointercancel',finishDrag);
document.addEventListener('keydown',e=>{
  const handle=e.target.closest('[data-drag-handle]');
  if(!handle||!isRubric(current))return;
  const kind=handle.dataset.dragHandle;
  const relevant=kind==='subsections'
    ?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  if(!relevant.includes(e.key))return;
  const item=handle.closest('[data-sort-id]');
  const siblings=Array.from(item?.parentElement?.children||[])
    .filter(node=>node.matches('[data-sort-kind="'+kind+'"]'));
  const index=siblings.indexOf(item);
  const direction=['ArrowUp','ArrowLeft'].includes(e.key)?-1:1;
  const adjacent=siblings[index+direction];
  if(!adjacent)return;
  e.preventDefault();
  const sourceId=item.dataset.sortId,targetId=adjacent.dataset.sortId;
  const after=direction>0;
  if(moveSorted(kind,sourceId,targetId,after)){
    const next=Array.from(document.querySelectorAll('[data-sort-kind="'+kind+'"]'))
      .find(node=>node.dataset.sortId===sourceId);
    next?.querySelector('[data-drag-handle]')?.focus();
  }
});
function openMaterial(id){
  const sub=pick(current);
  if(!sub)return;
  const t=sub.materials.find(x=>x.id===id);
  if(!t)return;
  const href=validUrl(t.url);
  if(!href){openDialog('material',sub.id,t.id);return;}
  audioStarted=true;playSound('navigate');
  window.open(href,'_blank','noopener,noreferrer');
}
function removeSubsection(rubric,subId){
  const target=mergedSections(rubric).find(s=>s.id===subId);
  if(!target)return;
  const count=target.materials.length;
  const msg='Удалить подраздел «'+target.name+'»'
    +(count?' вместе с материалами ('+count+')':'')+'?\nДействие нельзя отменить.';
  if(!window.confirm(msg))return;
  drafts[rubric]=drafts[rubric].filter(s=>s.id!==subId);
  const d=ensureRemoved(rubric);
  if(!d.subsections.includes(subId))d.subsections.push(subId);
  if(chosen[rubric]===subId)chosen[rubric]=null;
  persist();render();playSound('navigate');
}
function removeMaterial(rubric,subId,matId){
  const sub=mergedSections(rubric).find(s=>s.id===subId);
  const target=sub?.materials.find(t=>t.id===matId);
  if(!target)return;
  if(!window.confirm('Удалить материал «'+target.name+'» из подраздела «'+sub.name+'»?\nДействие нельзя отменить.'))return;
  const copy=copyForEditing(rubric,subId);
  if(!copy)return;
  copy.materials=copy.materials.filter(m=>m.id!==matId);
  const d=ensureRemoved(rubric);
  if(!Array.isArray(d.materials[subId]))d.materials[subId]=[];
  if(!d.materials[subId].includes(matId))d.materials[subId].push(matId);
  persist();render();playSound('navigate');
}
function setPrimaryMaterial(rubric,subId,matId){
  const sub=mergedSections(rubric).find(s=>s.id===subId);
  const item=sub?.materials.find(m=>m.id===matId);
  if(!item)return;
  const copy=copyForEditing(rubric,subId);
  if(!copy)return;
  const next=!item.primary;
  copy.materials.forEach(m=>{m.primary=(next&&m.id===matId);});
  persist();render();playSound('navigate');
}
document.addEventListener('click',function(e){
  const choose=e.target.closest('[data-subsection]');
  if(choose){
    chosen[current]=choose.dataset.subsection;
    render();audioStarted=true;playSound('navigate');return;
  }
  const newSub=e.target.closest('[data-new-subsection]');
  if(newSub){openDialog('subsection');return;}
  const editSub=e.target.closest('[data-edit-subsection]');
  if(editSub){openDialog('subsection',editSub.dataset.editSubsection);return;}
  const deleteSub=e.target.closest('[data-delete-subsection]');
  if(deleteSub){removeSubsection(current,deleteSub.dataset.deleteSubsection);return;}
  const main=e.target.closest('[data-primary-material]');
  if(main){const sub=pick(current);if(sub)setPrimaryMaterial(current,sub.id,main.dataset.primaryMaterial);return;}
  const deleteMat=e.target.closest('[data-delete-material]');
  if(deleteMat){const sub=pick(current);if(sub)removeMaterial(current,sub.id,deleteMat.dataset.deleteMaterial);return;}
  const newMat=e.target.closest('[data-new-material]');
  if(newMat){const sub=pick(current);if(sub)openDialog('material',sub.id);return;}
  const editMat=e.target.closest('[data-edit-material]');
  if(editMat){const sub=pick(current);if(sub)openDialog('material',sub.id,editMat.dataset.editMaterial);return;}
  const open=e.target.closest('[data-open-material]');
  if(open)openMaterial(open.dataset.openMaterial);
});
el('rubric-form').addEventListener('submit',function(e){
  e.preventDefault();
  if(!isRubric(editorRubric))return;
  const name=el('rubric-name').value.trim();
  const raw=el('rubric-url').value.trim();
  const href=validUrl(raw);
  const err=el('rubric-error');
  if(!name){err.hidden=false;err.textContent='Введите название.';return;}
  if(editorType==='material' && raw && !href){
    err.hidden=false;err.textContent='Укажите HTTPS-ссылку либо путь вида /папка/.';return;
  }
  if(editorType==='subsection'){
    if(editorSubId){
      const copy=copyForEditing(editorRubric,editorSubId);
      if(!copy)return;
      copy.name=name.slice(0,90);
    }else{
      const id=uid('sub');
      drafts[editorRubric].push({id,name:name.slice(0,90),materials:[]});
      chosen[editorRubric]=id;
    }
  }else{
    const sub=copyForEditing(editorRubric,editorSubId);
    if(!sub)return;
    const id=editorMaterialId||uid('mat');
    const pos=sub.materials.findIndex(x=>x.id===id);
    const record={
      id,name:name.slice(0,100),url:href,
      primary:pos>=0?sub.materials[pos].primary===true:false,
      status:el('rubric-status').value,
      archived:el('rubric-archived').checked
    };
    if(pos>=0)sub.materials[pos]=record;else sub.materials.push(record);
  }
  persist();closeDialog();render();playSound('navigate');
});
el('rubric-close').onclick=closeDialog;
el('rubric-cancel').onclick=closeDialog;
el('rubric-delete').onclick=function(){
  if(!isRubric(editorRubric))return;
  const rubric=editorRubric, subId=editorSubId, matId=editorMaterialId, type=editorType;
  closeDialog();
  if(type==='subsection')removeSubsection(rubric,subId);
  else if(type==='material')removeMaterial(rubric,subId,matId);
};
function removeCopies(){
  for(const rubric of IDS){
    const publishedById=new Map(published[rubric].map(s=>[s.id,s]));
    drafts[rubric]=drafts[rubric].filter(s=>{
      const p=publishedById.get(s.id);
      return !p || JSON.stringify({name:s.name,materials:s.materials})!==JSON.stringify({name:p.name,materials:p.materials});
    });
  }
  persist();
}
async function fetchData(path){
  try{
    const response=await fetch(path,{cache:'no-store'});
    return response.ok?await response.json():null;
  }catch(e){return null;}
}
async function loadCatalog(){
  const [next,old,legacyTools]=await Promise.all([
    fetchData('rubrics.json'),fetchData('catalogs.json'),fetchData('tools.json')
  ]);
  if(next && typeof next==='object' && !Array.isArray(next)){
    for(const id of IDS)published[id]=sectionsList(next[id]);
  }
  // Сохраняем ранее опубликованные материалы в подразделе "Ранее добавленные".
  for(const id of IDS){
    const list=id==='tools'?legacyTools:old?.[id];
    if(!Array.isArray(list))continue;
    const saved=list.map(material).filter(Boolean);
    if(!saved.length)continue;
    if(!published[id].some(s=>s.id==='legacy-'+id)){
      published[id].push({id:'legacy-'+id,name:'Ранее добавленные',materials:saved});
    }
  }
  removeCopies();
  if(isRubric(current))render();
}
loadCatalog();
render();
})();