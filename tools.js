/* ПЛАТФОРМА · единые каталоги рубрик v0.8
   Общий список для всех: catalogs.json, для Инструментов: tools.json.
   Кнопка + создаёт локальный черновик. Публикация для всех — через GitHub. */
(function () {
  'use strict';

  const SECTION_IDS = ['system','method','tools','projects','analytics','knowledge','development'];
  const DRAFTS_KEY = 'platform-rubric-drafts-v1';
  const OLD_TOOLS_KEY = 'platform-tool-drafts-v1';
  let published = Object.fromEntries(SECTION_IDS.map(id => [id, []]));
  let drafts = Object.fromEntries(SECTION_IDS.map(id => [id, []]));
  let editingId = null;
  let editingSection = null;

  function isRubric(id){return SECTION_IDS.includes(id);}
  function sectionInfo(id){return sections.find(s=>s.id===id);}
  function esc(value){
    return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function normalize(raw){
    if (!raw || typeof raw!=='object' || typeof raw.name!=='string')return null;
    const id=String(raw.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,85);
    const name=raw.name.trim().slice(0,80);
    if(!id || !name)return null;
    return {id,name,url:typeof raw.url==='string'?raw.url.trim().slice(0,600):''};
  }
  function address(raw){
    if(!raw || !raw.trim())return '';
    try{
      const u=new URL(raw.trim(),window.location.origin);
      return u.protocol==='https:'?u.href:'';
    }catch(e){return '';}
  }
  function jsonInStorage(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}
    catch(e){return fallback;}
  }
  function cleanItems(list){return Array.isArray(list)?list.map(normalize).filter(Boolean):[];}
  const stored=jsonInStorage(DRAFTS_KEY,{});
  for(const id of SECTION_IDS){ drafts[id]=cleanItems(stored&&stored[id]); }
  // Миграция локальных кнопок, добавленных в старой версии раздела Инструменты.
  const oldTools=cleanItems(jsonInStorage(OLD_TOOLS_KEY,[]));
  const seen=new Set(drafts.tools.map(t=>t.id));
  for(const tool of oldTools){if(!seen.has(tool.id)){drafts.tools.push(tool);seen.add(tool.id);}}

  function save(){
    try{localStorage.setItem(DRAFTS_KEY,JSON.stringify(drafts));}
    catch(e){alert('Браузер не разрешил сохранить каталог.');}
  }
  function itemsFor(sectionId){
    const items=new Map();
    (published[sectionId]||[]).forEach(t=>items.set(t.id,{...t,published:true}));
    (drafts[sectionId]||[]).forEach(t=>items.set(t.id,{...t,published:false}));
    return Array.from(items.values());
  }
  function itemNoun(sectionId){return sectionId==='tools'?'инструмент':'материал';}
  function addLabel(sectionId){return sectionId==='tools'?'Добавить инструмент':'Добавить материал';}

  function pageFor(sectionId){
    const section=sectionInfo(sectionId);
    if(!section)return '';
    const items=itemsFor(sectionId);
    const cards=items.map(t=>{
      const name=esc(t.name);
      const linked=!!address(t.url);
      return '<article class="tool-card">'
        +'<div class="tool-card-top"><h2>'+name+'</h2></div>'
        +'<div class="tool-state"><span class="dot"></span>'
        +(linked?'Ссылка подключена':'Ссылка пока не назначена')
        +(t.published?' · опубликовано':' · черновик')+'</div>'
        +'<div class="tool-card-actions">'
        +'<button class="tool-open" type="button" data-open-item="'+t.id+'">'+(linked?'Открыть':'Назначить ссылку')+'</button>'
        +'<button class="tool-edit" type="button" data-edit-item="'+t.id+'" title="Редактировать" aria-label="Редактировать '+name+'">'+icon('pencil')+'</button>'
        +'</div>'
        +'</article>';
    }).join('');
    return '<div class="wrap">'
      +'<div class="path">ПЛАТФОРМА / '+esc(section.name)+'</div>'
      +'<section class="hero tool-intro"><div>'
      +'<div class="eyebrow">'+esc(section.tag)+'</div>'
      +'<h1>'+esc(section.name)+'</h1>'
      +'<p class="lead">'+esc(section.desc)+'</p>'
      +'<p class="tool-count">В каталоге: '+items.length+'</p>'
      +'</div></section>'
      +'<div class="tool-toolbar"><button class="tool-primary" type="button" data-add-item>'+icon('plus')+' '+addLabel(sectionId)+'</button></div>'
      +(items.length?'':'<div class="tools-empty"><strong>В разделе пока нет материалов</strong>Нажмите «+», задайте название. Ссылку на опубликованную страницу можно добавить сейчас или позже.</div>')
      +'<div class="tool-grid">'+cards
      +'<button class="tool-card tool-add-card" type="button" data-add-item>'
      +'<span class="plus-large">'+icon('plus')+'</span><span>'+addLabel(sectionId)+'</span></button>'
      +'</div><div class="footer">ПЛАТФОРМА · '+esc(section.name)+'</div></div>';
  }
  const modal=[
    '<dialog class="tool-dialog" id="tool-dialog" aria-labelledby="tool-modal-title">',
    '<form id="tool-form">',
      '<div class="tool-dialog-head"><h2 id="tool-modal-title">Добавить материал</h2>',
        '<button id="tool-close" class="dialog-close" type="button" aria-label="Закрыть">×</button></div>',
      '<label for="tool-name">Название</label>',
      '<input id="tool-name" type="text" maxlength="80" autocomplete="off" required placeholder="Название">',
      '<label for="tool-url">Ссылка на сайт или материал (необязательно)</label>',
      '<input id="tool-url" type="text" inputmode="url" autocomplete="off" placeholder="/название-папки/">',
      '<p id="tool-error" class="tool-error" hidden></p>',
      '<p class="tool-hint">Ссылку можно назначить позднее. Новая кнопка пока будет сохранена только в этом браузере. Чтобы она появилась у всех, опубликуйте каталог в GitHub.</p>',
      '<div class="tool-dialog-actions">',
        '<button id="tool-delete" class="delete-tool" type="button" hidden>Удалить</button>',
        '<button id="tool-cancel" type="button">Отмена</button>',
        '<button class="save-tool" type="submit">Сохранить</button>',
      '</div>',
    '</form>',
    '</dialog>'
  ].join('');
  document.body.insertAdjacentHTML('beforeend',modal);

  const originalNav=navMarkup;
  navMarkup=function(){
    if(!isRubric(current))return originalNav();
    const section=sectionInfo(current);
    const items=itemsFor(current);
    const entries=items.map(t=>
      '<button type="button" data-open-item="'+t.id+'" title="'+esc(t.name)+'">'
      +icon(section.icon)+'<span>'+esc(t.name)+'</span></button>'
    ).join('');
    return '<button type="button" data-go="home" title="Вернуться к разделам">'
      +icon('left')+'<span>К разделам</span></button>'
      +'<div class="sidebar-divider"></div>'
      +entries
      +'<button class="sidebar-add" type="button" data-add-item title="'+addLabel(current)+'">'
      +icon('plus')+'<span>'+addLabel(current)+'</span></button>';
  };
  const originalSection=renderSection;
  renderSection=function(section){
    return isRubric(section.id)?pageFor(section.id):originalSection(section);
  };
  const originalRender=render;
  render=function(){
    originalRender();
    const label=document.querySelector('.side-label');
    if(label)label.textContent=isRubric(current)?sectionInfo(current).name:'Разделы';
  };

  function editor(id){
    if(!isRubric(current))return;
    const found=id?itemsFor(current).find(t=>t.id===id):null;
    editingId=found?found.id:null;
    editingSection=current;
    $('tool-modal-title').textContent=(found?'Редактировать: ':'Добавить в раздел «')+(found?sectionInfo(current).name:sectionInfo(current).name+'»');
    $('tool-name').value=found?found.name:'';
    $('tool-url').value=found?found.url:'';
    $('tool-url').placeholder='/'+(current==='knowledge'?'standards':current)+'/название/';
    $('tool-error').hidden=true;
    $('tool-delete').hidden=!(found && !found.published);
    if(typeof $('tool-dialog').showModal==='function')$('tool-dialog').showModal();
    else $('tool-dialog').setAttribute('open','');
    $('tool-name').focus();
  }
  function closeEditor(){
    if(typeof $('tool-dialog').close==='function')$('tool-dialog').close();
    else $('tool-dialog').removeAttribute('open');
  }
  function openItem(id){
    const item=itemsFor(current).find(t=>t.id===id);
    if(!item)return;
    const href=address(item.url);
    if(!href){editor(id);return;}
    audioStarted=true;
    playSound('navigate');
    window.open(href,'_blank','noopener,noreferrer');
  }
  document.addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-item]');
    if(edit){editor(edit.dataset.editItem);return;}
    const add=e.target.closest('[data-add-item]');
    if(add){editor(null);return;}
    const open=e.target.closest('[data-open-item]');
    if(open)openItem(open.dataset.openItem);
  });

  $('tool-form').addEventListener('submit',e=>{
    e.preventDefault();
    if(!isRubric(editingSection))return;
    const name=$('tool-name').value.trim();
    const raw=$('tool-url').value.trim();
    const href=address(raw);
    const error=$('tool-error');
    if(!name){error.hidden=false;error.textContent='Введите название.';return;}
    if(raw && !href){error.hidden=false;error.textContent='Укажите HTTPS-ссылку либо путь /раздел/папка/.';return;}
    const id=editingId||('item-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
    drafts[editingSection]=drafts[editingSection].filter(t=>t.id!==id);
    drafts[editingSection].push({id,name:name.slice(0,80),url:href});
    save();closeEditor();render();playSound('navigate');
  });
  $('tool-close').onclick=closeEditor;
  $('tool-cancel').onclick=closeEditor;
  $('tool-delete').onclick=()=>{
    if(!editingId || !isRubric(editingSection))return;
    drafts[editingSection]=drafts[editingSection].filter(t=>t.id!==editingId);
    save();closeEditor();render();
  };

  function removePublishedMatches(){
    for(const id of SECTION_IDS){
      const indexed=new Map((published[id]||[]).map(t=>[t.id,t]));
      drafts[id]=drafts[id].filter(t=>{
        const p=indexed.get(t.id);
        return !p || p.name!==t.name || p.url!==t.url;
      });
    }
    save();
  }
  async function fetchCatalog(path){
    try{
      const response=await fetch(path,{cache:'no-store'});
      if(!response.ok)return null;
      return await response.json();
    }catch(e){return null;}
  }
  async function refreshPublished(){
    const results=await Promise.all([fetchCatalog('catalogs.json'),fetchCatalog('tools.json')]);
    const other=results[0],tools=results[1];
    if(other && typeof other==='object' && !Array.isArray(other)){
      for(const id of SECTION_IDS){if(id!=='tools')published[id]=cleanItems(other[id]);}
    }
    if(Array.isArray(tools))published.tools=cleanItems(tools);
    removePublishedMatches();
    if(isRubric(current))render();
  }
  refreshPublished();
})();