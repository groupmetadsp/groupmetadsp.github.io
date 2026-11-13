/* ПЛАТФОРМА · каталог инструментов v1
   Опубликованные карточки: tools.json; личные черновики: localStorage. */
(function(){
'use strict';

const DRAFTS_KEY='platform-tool-drafts-v1';
let publicTools=[];
let drafts=[];
let editingId=null;

function esc(value){
  return String(value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function normalize(raw){
  if(!raw || typeof raw!=='object' || typeof raw.name!=='string') return null;
  const id=String(raw.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,85);
  const name=raw.name.trim().slice(0,80);
  if(!id || !name)return null;
  return {id:id,name:name,url:typeof raw.url==='string'?raw.url.trim().slice(0,600):''};
}
function address(value){
  if(!value || !value.trim())return '';
  try{
    const u=new URL(value.trim(),window.location.origin);
    return u.protocol==='https:'?u.href:'';
  }catch(e){return '';}
}
try{
  const data=JSON.parse(localStorage.getItem(DRAFTS_KEY)||'[]');
  if(Array.isArray(data)) drafts=data.map(normalize).filter(Boolean);
}catch(e){}
function catalog(){
  const combined=new Map();
  publicTools.forEach(function(t){combined.set(t.id,{...t,published:true});});
  drafts.forEach(function(t){combined.set(t.id,{...t,published:false});});
  return Array.from(combined.values());
}
function store(){
  try{localStorage.setItem(DRAFTS_KEY,JSON.stringify(drafts));}
  catch(e){alert('Браузер не разрешил сохранить новый инструмент.');}
}

const toolModal=[
  '<dialog class="tool-dialog" id="tool-dialog" aria-labelledby="tool-modal-title">',
    '<form id="tool-form">',
      '<div class="tool-dialog-head"><h2 id="tool-modal-title">Добавить инструмент</h2>',
        '<button id="tool-close" class="dialog-close" type="button" aria-label="Закрыть">×</button></div>',
      '<label for="tool-name">Название инструмента</label>',
      '<input id="tool-name" type="text" maxlength="80" autocomplete="off" required placeholder="Например, МЕТАПОТОК">',
      '<label for="tool-url">Ссылка на опубликованный сайт (необязательно)</label>',
      '<input id="tool-url" type="text" inputmode="url" autocomplete="off" placeholder="https://groupmetadsp.github.io/metapotok/">',
      '<p id="tool-error" class="tool-error" hidden></p>',
      '<p class="tool-hint">Ссылку можно назначить позже. Добавленная здесь карточка сохраняется только в этом браузере. Чтобы она появилась у всех, каталог нужно опубликовать в GitHub.</p>',
      '<div class="tool-dialog-actions">',
        '<button id="tool-delete" class="delete-tool" type="button" hidden>Удалить</button>',
        '<button id="tool-cancel" type="button">Отмена</button>',
        '<button class="save-tool" type="submit">Сохранить</button>',
      '</div>',
    '</form>',
  '</dialog>'
].join('');
document.body.insertAdjacentHTML('beforeend',toolModal);

function toolsPage(){
  const items=catalog();
  const cards=items.map(function(t){
    const name=esc(t.name);
    const connected=!!address(t.url);
    return '<article class="tool-card">'
      +'<div class="tool-card-top"><h2>'+name+'</h2></div>'
      +'<div class="tool-state"><span class="dot"></span>'
      +(connected?'Сайт подключён':'Ссылка пока не назначена')
      +(t.published?' · опубликовано':' · черновик')+'</div>'
      +'<div class="tool-card-actions">'
      +'<button class="tool-open" data-open-tool="'+t.id+'" type="button">'+(connected?'Открыть инструмент':'Назначить ссылку')+'</button>'
      +'<button class="tool-edit" data-edit-tool="'+t.id+'" type="button" aria-label="Редактировать '+name+'" title="Редактировать">'+icon('pencil')+'</button>'
      +'</div></article>';
  }).join('');
  return '<div class="wrap">'
    +'<div class="path">ПЛАТФОРМА / Инструменты</div>'
    +'<section class="hero tool-intro"><div>'
      +'<div class="eyebrow">Цифровые инструменты</div>'
      +'<h1>Инструменты</h1>'
      +'<p class="lead">Единый каталог приложений и расчётных модулей Платформы.</p>'
      +'<p class="tool-count">В каталоге: '+items.length+'</p>'
    +'</div></section>'
    +'<div class="tool-toolbar"><button class="tool-primary" data-add-tool type="button">'+icon('plus')+' Добавить инструмент</button></div>'
    +(items.length?'':'<div class="tools-empty"><strong>Каталог пока пуст</strong>Добавьте первую кнопку инструмента с помощью «+». Название можно задать сразу, а ссылку — позднее.</div>')
    +'<div class="tool-grid">'+cards
      +'<button class="tool-card tool-add-card" data-add-tool type="button"><span class="plus-large">'+icon('plus')+'</span><span>Добавить инструмент</span></button>'
    +'</div><div class="footer">ПЛАТФОРМА · каталог инструментов</div></div>';
}
const oldNav=navMarkup;
navMarkup=function(){
  if(current!=='tools')return oldNav();
  const entries=catalog().map(function(t){
    return '<button data-open-tool="'+t.id+'" title="'+esc(t.name)+'">'
      +icon('tool')+'<span>'+esc(t.name)+'</span></button>';
  }).join('');
  return '<button data-go="home" title="Вернуться к разделам">'+icon('left')+'<span>К разделам</span></button>'
    +'<div class="sidebar-divider"></div>'
    +entries
    +'<button class="sidebar-add" data-add-tool type="button" title="Добавить инструмент">'+icon('plus')+'<span>Добавить инструмент</span></button>';
};
const oldSection=renderSection;
renderSection=function(section){
  return section.id==='tools'?toolsPage():oldSection(section);
};
const oldRender=render;
render=function(){
  oldRender();
  const label=document.querySelector('.side-label');
  if(label)label.textContent=current==='tools'?'Инструменты':'Разделы';
};

function editTool(id){
  const t=id?catalog().find(function(x){return x.id===id;}):null;
  editingId=t?t.id:null;
  $('tool-modal-title').textContent=t?'Редактировать инструмент':'Добавить инструмент';
  $('tool-name').value=t?t.name:'';
  $('tool-url').value=t?t.url:'';
  $('tool-error').hidden=true;
  $('tool-delete').hidden=!(t && !t.published);
  if(typeof $('tool-dialog').showModal==='function')$('tool-dialog').showModal();
  else $('tool-dialog').setAttribute('open','');
  $('tool-name').focus();
}
function closeEditor(){
  if(typeof $('tool-dialog').close==='function')$('tool-dialog').close();
  else $('tool-dialog').removeAttribute('open');
}
function openTool(id){
  const t=catalog().find(function(x){return x.id===id;});
  if(!t)return;
  const href=address(t.url);
  if(!href){editTool(id);return;}
  audioStarted=true;playSound('navigate');
  window.open(href,'_blank','noopener,noreferrer');
}
document.addEventListener('click',function(e){
  const edit=e.target.closest('[data-edit-tool]');
  if(edit){editTool(edit.dataset.editTool);return;}
  const add=e.target.closest('[data-add-tool]');
  if(add){editTool();return;}
  const open=e.target.closest('[data-open-tool]');
  if(open)openTool(open.dataset.openTool);
});
$('tool-form').addEventListener('submit',function(e){
  e.preventDefault();
  const name=$('tool-name').value.trim();
  const raw=$('tool-url').value.trim();
  const url=address(raw);
  const error=$('tool-error');
  if(!name){error.hidden=false;error.textContent='Введите название инструмента.';return;}
  if(raw && !url){error.hidden=false;error.textContent='Укажите HTTPS-ссылку либо относительный путь /metapotok/.';return;}
  const id=editingId || ('tool-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
  drafts=drafts.filter(function(t){return t.id!==id;});
  drafts.push({id:id,name:name.slice(0,80),url:url});
  store();closeEditor();render();playSound('navigate');
});
$('tool-close').onclick=closeEditor;
$('tool-cancel').onclick=closeEditor;
$('tool-delete').onclick=function(){
  if(!editingId)return;
  drafts=drafts.filter(function(x){return x.id!==editingId;});
  store();closeEditor();render();
};

async function refreshPublished(){
  try{
    const response=await fetch('tools.json',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json();
    if(!Array.isArray(data))return;
    publicTools=data.map(normalize).filter(Boolean);
    const byId=new Map(publicTools.map(function(t){return [t.id,t];}));
    drafts=drafts.filter(function(t){
      const p=byId.get(t.id);
      return !p || p.name!==t.name || p.url!==t.url;
    });
    store();
    if(current==='tools')render();
  }catch(e){ /* Offline: local drafts remain accessible. */ }
}
refreshPublished();
})();
