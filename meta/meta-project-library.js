/* МЕТА: изолированная локальная библиотека, IndexedDB v1 */
(function(){
"use strict";
if(!window.indexedDB)return;
const DB="meta-platforma-projects-v1",uid=()=>"mp"+Date.now().toString(36)+Math.random().toString(36).slice(2,8),copy=v=>JSON.parse(JSON.stringify(v)),today=()=>new Date().toISOString(),fmt=(n,d=0)=>Number(n||0).toLocaleString("ru-RU",{maximumFractionDigits:d}),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const db=new Promise((ok,fail)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{for(const n of ["projects","sites","variants"])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n,{keyPath:"id"});};r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});
async function run(store,method,value,write=false){const d=await db;return new Promise((ok,fail)=>{const t=d.transaction(store,write?"readwrite":"readonly"),r=t.objectStore(store)[method](value);r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});}
const list=n=>run(n,"getAll"),get=(n,id)=>run(n,"get",id),put=(n,x)=>run(n,"put",x,true),del=(n,id)=>run(n,"delete",id,true);
let project=null,site=null,variant=null,projects=[],sites=[],variants=[],detail=false;
const css=document.createElement("style");css.textContent="#mpLibraryOpen{margin-left:8px;background:#b95228;color:#fff;border:1px solid #b95228;border-radius:5px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}#mpLibraryOverlay{display:none;position:fixed;inset:0;z-index:999998;background:#16232baa;align-items:center;justify-content:center;padding:15px}#mpLibraryPanel{font:12px/1.5 Manrope,'Segoe UI',Arial,sans-serif;background:#fcfaf6;color:#333b38;border:1px solid #d9d5cb;border-radius:10px;padding:20px;width:min(1100px,98vw);max-height:94vh;overflow:auto}#mpLibraryPanel button{border:1px solid #d9d5cb;background:#fffdf9;border-radius:5px;padding:7px 10px;cursor:pointer;color:#333b38}#mpLibraryPanel button.primary{background:#b95228;border-color:#b95228;color:#fff}#mpLibraryPanel select{border:1px solid #d9d5cb;padding:8px;width:100%;background:#fff;border-radius:5px}#mpLibraryPanel .flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:9px 0}#mpLibraryPanel .columns{display:grid;grid-template-columns:260px minmax(0,1fr);gap:18px}#mpLibraryPanel .side{background:#f3f0e9;border-radius:8px;padding:13px}#mpLibraryPanel .hint{font-size:11px;color:#777770}#mpLibraryPanel table{border-collapse:collapse;white-space:nowrap;width:100%;font-size:11px}#mpLibraryPanel th,#mpLibraryPanel td{border-bottom:1px solid #ddd8ce;padding:7px;text-align:right}#mpLibraryPanel th:first-child,#mpLibraryPanel td:first-child{text-align:left}#mpLibraryPanel .scroll{overflow:auto;max-height:390px;border:1px solid #ddd8ce;border-radius:6px}@media(max-width:750px){#mpLibraryPanel .columns{grid-template-columns:1fr}}";document.head.appendChild(css);
const button=document.createElement("button");button.id="mpLibraryOpen";button.textContent="▤ Проекты / варианты";button.type="button";(document.querySelector(".topbar")||document.querySelector("header")||document.body).appendChild(button);
const wrap=document.createElement("div");wrap.id="mpLibraryOverlay";wrap.innerHTML='<div id="mpLibraryPanel" role="dialog" aria-modal="true" aria-label="Библиотека проектов"><div class="flex" style="justify-content:space-between"><b style="font-size:20px">МЕТА · Библиотека проектов</b><button id="mpClose">Закрыть ×</button></div><div class="columns"><div class="side"><b>Объект</b><select id="mpProject"></select><div class="flex"><button id="mpNewProject">+ Объект</button><button id="mpRenameProject">Переименовать</button></div><b>Площадка</b><select id="mpSite"></select><div class="flex"><button id="mpNewSite">+ Площадка</button><button id="mpRenameSite">Переименовать</button></div><p class="hint">Площадки хранят общую топооснову отдельно от вариантов. Все данные остаются в этом браузере.</p><b>Резервные копии</b><div class="flex"><button id="mpBackup">Выгрузить всю библиотеку JSON</button><button id="mpImport">Загрузить резервную копию</button><input type="file" id="mpFile" accept=".json,application/json" hidden></div><p class="hint">Очищение браузера может удалить IndexedDB. Регулярно сохраняйте резервные копии на диск.</p></div><div><b>Варианты компоновки</b><select id="mpVariant"></select><div class="flex"><button class="primary" id="mpSaveNew">+ Новый вариант</button><button id="mpSave">Сохранить изменения</button><button id="mpOpen">Открыть</button><button id="mpRenameVariant">Переименовать</button><button id="mpDelete">Удалить</button></div><b>Сравнение ТЭП вариантов</b><div class="flex"><label><input type="checkbox" id="mpStages"> По этапам</label><button id="mpExport">Выгрузить ТЭП в CSV / Excel</button></div><div class="scroll" id="mpTable"></div><p class="hint">Сравниваются показатели на момент последнего сохранения каждого варианта.</p><div id="mpStatus" style="min-height:20px;color:#39713d"></div></div></div></div>';document.body.appendChild(wrap);
const $=k=>wrap.querySelector("#mp"+k),notify=t=>{$("Status").textContent=t;},report=e=>{console.error(e);notify("Ошибка: "+(e.message||e));};
function current(){return variants.filter(v=>v.siteId===site).sort((a,b)=>a.name.localeCompare(b.name,"ru"));}
function stageTotals(){const out=new Map();for(const o of state.objects){if(o.surrounding)continue;let stage=Math.max(1,Math.round(Number(o.stage)||1));if(!out.has(stage))out.set(stage,{stage,sale:0,gross:0,apts:0,mm:0,land:0});let m=out.get(stage);if(o.kind==="building"){m.sale+=buildingSale(o);m.gross+=buildingGross(o);m.apts+=window.metaMassingApartmentCount?window.metaMassingApartmentCount(o):Math.floor(buildingSale(o)/(Number(o.avgApt)||product().avg));}if(o.kind==="parking")m.mm+=parkingMM(o);if(o.type==="ROAD_PATH")m.mm+=roadParkingStats(o).total;if(o.kind==="land")m.land+=landArea(o);}return [...out.values()].sort((a,b)=>a.stage-b.stage);}
const shared=()=>({underlay:copy(state.underlay||null),terrain33:copy(state.terrain33||null),insol34:copy(state.insol34||null),sun33:copy(state.sun33||null)});
const name=(question,def)=>{let s=prompt(question,def);return s&&s.trim()?s.trim().slice(0,120):null;};
async function refresh(){
 [projects,sites,variants]=await Promise.all([list("projects"),list("sites"),list("variants")]);
 projects.sort((a,b)=>a.name.localeCompare(b.name,"ru"));if(!projects.some(p=>p.id===project))project=projects[0]?.id||null;
 let ss=sites.filter(s=>s.projectId===project).sort((a,b)=>a.name.localeCompare(b.name,"ru"));if(!ss.some(x=>x.id===site))site=ss[0]?.id||null;
 let vv=current();if(!vv.some(x=>x.id===variant))variant=vv[0]?.id||null;
 $("Project").innerHTML=projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");$("Project").value=project||"";
 $("Site").innerHTML=ss.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");$("Site").value=site||"";
 $("Variant").innerHTML=vv.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+new Date(p.updatedAt).toLocaleDateString("ru-RU")+'</option>').join("");$("Variant").value=variant||"";
 draw();
}
function draw(){
 const vv=current();if(!vv.length){$("Table").innerHTML='<p class="hint" style="padding:10px">Сначала сохраните один или несколько вариантов.</p>';return;}
 const cols=[["S продаваемая, м²",v=>v.metrics.sale],["S строительная, м²",v=>v.metrics.gross],["Квартиры",v=>v.metrics.apts],["Плотность",v=>v.metrics.density,3],["КЭП",v=>v.metrics.gross?v.metrics.sale/v.metrics.gross:0,3],["ММ размещено",v=>v.metrics.haveMM],["ММ требуется",v=>v.metrics.needMM],["Благоустройство, м²",v=>v.metrics.haveLand]];
 let html='<table><thead><tr><th>Показатель</th>'+vv.map(v=>'<th>'+esc(v.name)+'</th>').join("")+'</tr></thead><tbody>';
 for(const [label,read,digits] of cols)html+='<tr><td>'+label+'</td>'+vv.map(v=>'<td>'+fmt(read(v),digits||0)+'</td>').join("")+'</tr>';
 if(detail){
  let stages=[...new Set(vv.flatMap(v=>(v.stageMetrics||[]).map(x=>x.stage)))].sort((a,b)=>a-b);
  for(let n of stages){html+='<tr><th colspan="'+(vv.length+1)+'" style="text-align:left">Этап '+n+'</th></tr>';for(const [label,k] of [["S продаваемая","sale"],["S строительная","gross"],["Квартир","apts"],["Машиномест","mm"],["Благоустройство","land"]])html+='<tr><td>'+label+'</td>'+vv.map(v=>'<td>'+fmt((v.stageMetrics||[]).find(x=>x.stage===n)?.[k])+'</td>').join("")+'</tr>';}
 }
 $("Table").innerHTML=html+'</tbody></table>';
}
async function newProject(){let n=name("Название объекта","Новый объект");if(!n)return;let p={id:uid(),name:n,createdAt:today()};await put("projects",p);project=p.id;site=null;variant=null;await refresh();}
async function newSite(){if(!project)throw Error("Создайте объект");let n=name("Название площадки","Площадка 1");if(!n)return;let s={id:uid(),projectId:project,name:n,createdAt:today(),shared:shared()};await put("sites",s);site=s.id;variant=null;await refresh();}
async function save(isNew){
 if(!project||!site)throw Error("Создайте объект и площадку");
 let old=isNew?null:await get("variants",variant);if(!isNew&&!old)throw Error("Нужно сначала сохранить новый вариант");
 let n=isNew?name("Название компоновки","Вариант "+(current().length+1)):old.name;if(!n)return;
 let data=copy(serialize()),m=copy(metrics()),v={id:old?.id||uid(),projectId:project,siteId:site,name:n,createdAt:old?.createdAt||today(),updatedAt:today(),data,metrics:m,stageMetrics:stageTotals()};
 await put("variants",v);let s=await get("sites",site);s.shared=shared();s.updatedAt=today();await put("sites",s);variant=v.id;await refresh();notify("Сохранено: "+n);
}
async function open(){
 let v=await get("variants",variant);if(!v)throw Error("Выберите вариант");
 if(!confirm("Открыть «"+v.name+"»? Несохранённые изменения рабочего поля будут заменены."))return;
 let d=copy(v.data),base=(await get("sites",v.siteId))?.shared||{};
 checkpoint();Object.assign(state,d.settings||{});state.objects=copy(d.objects||[]);
 state.objects.forEach(o=>{ensurePolygon(o);if(o.type==="BLOK")syncBlockMetrics(o);if(o.type==="ROAD_PATH")syncRoadBounds(o);});
 state.pinnedCallouts=copy(d.pinnedCallouts||[]);state.dimensionChains=copy(d.dimensionChains||[]);
 state.underlay=copy(base.underlay||null);state.terrain33=copy(base.terrain33||null);state.insol34=copy(base.insol34||null);if(base.sun33)state.sun33=copy(base.sun33);
 state.selected=null;state.calloutId=null;state.calloutPos=null;state.calloutOffset=null;
 state.seq=1+Math.max(0,...state.objects.map(o=>Number(String(o.id).replace(/\D/g,""))||0));
 for(const [k,val] of [["siteArea",state.siteArea],["densityTarget",state.densityTarget],["platformShare",state.platformShare],["individualShare",state.individualShare],["productClass",state.product]]){let e=document.getElementById(k);if(e)e.value=val;}
 resizeSite();try{localStorage.setItem("meta-rayon-last-project-v044",JSON.stringify(serialize()));}catch(e){}
 wrap.style.display="none";
}
function download(filename,data,type){let url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function backup(){let a=await Promise.all([list("projects"),list("sites"),list("variants")]);download("META_Platforma_Backup_"+today().slice(0,10)+".json",JSON.stringify({format:"meta-platforma-indexeddb",version:1,projects:a[0],sites:a[1],variants:a[2]}),"application/json");notify("Резервная копия выгружена");}
async function importBackup(file){
 let p=JSON.parse(await file.text());if(p.format!=="meta-platforma-indexeddb"||p.version!==1||!Array.isArray(p.projects)||!Array.isArray(p.sites)||!Array.isArray(p.variants))throw Error("Некорректная резервная копия");
 if(!confirm("Добавить "+p.projects.length+" объектов и "+p.variants.length+" вариантов? Действующие данные не заменяются."))return;
 let pm=new Map(),sm=new Map();
 for(const x of p.projects){let n=uid();pm.set(x.id,n);await put("projects",{...x,id:n,name:String(x.name||"Объект")+" (импорт)"});}
 for(const x of p.sites){if(!pm.has(x.projectId))continue;let n=uid();sm.set(x.id,n);await put("sites",{...x,id:n,projectId:pm.get(x.projectId)});}
 for(const x of p.variants){if(!pm.has(x.projectId)||!sm.has(x.siteId)||!x.data||!Array.isArray(x.data.objects))continue;await put("variants",{...x,id:uid(),projectId:pm.get(x.projectId),siteId:sm.get(x.siteId)});}
 await refresh();notify("Библиотека дополнена из резервной копии");
}
async function rename(typ){let store=typ==="Project"?"projects":typ==="Site"?"sites":"variants",key=typ==="Project"?project:typ==="Site"?site:variant;if(!key)return;let x=await get(store,key),n=name("Новое название",x.name);if(!n)return;x.name=n;await put(store,x);await refresh();}
async function remove(){if(!variant)return;let v=await get("variants",variant);if(!confirm("Удалить вариант «"+v.name+"»?"))return;await del("variants",variant);variant=null;await refresh();}
function action(k,fn){$(k).onclick=()=>Promise.resolve().then(fn).catch(report);}
action("NewProject",newProject);action("NewSite",newSite);action("SaveNew",()=>save(true));action("Save",()=>save(false));action("Open",open);action("Delete",remove);action("RenameProject",()=>rename("Project"));action("RenameSite",()=>rename("Site"));action("RenameVariant",()=>rename("Variant"));action("Backup",backup);
$("Project").onchange=()=>{project=$("Project").value;site=null;variant=null;refresh().catch(report);};
$("Site").onchange=()=>{site=$("Site").value;variant=null;refresh().catch(report);};
$("Variant").onchange=()=>{variant=$("Variant").value;};
$("Stages").onchange=()=>{detail=$("Stages").checked;draw();};
action("Export",()=>{let vv=current();if(!vv.length)throw Error("Нет вариантов");let rows=[["Вариант","S продаваемая","S строительная","Квартиры","Плотность","КЭП","ММ размещено","ММ требуется","Благоустройство"]];for(let v of vv){let m=v.metrics;rows.push([v.name,m.sale,m.gross,m.apts,m.density,m.gross?m.sale/m.gross:0,m.haveMM,m.needMM,m.haveLand]);}rows.push([],["Вариант","Этап","S продаваемая","S строительная","Квартиры","ММ","Благоустройство"]);for(let v of vv)for(let x of v.stageMetrics||[])rows.push([v.name,x.stage,x.sale,x.gross,x.apts,x.mm,x.land]);let csv="\uFEFF"+rows.map(a=>a.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(";")).join("\r\n");download("META_Сравнение_ТЭП.csv",csv,"text/csv;charset=utf-8");notify("CSV выгружен для Excel");});
action("Import",()=>$("File").click());
$("File").onchange=async()=>{let f=$("File").files?.[0];if(f)try{await importBackup(f);}catch(e){report(e);}finally{$("File").value="";}};
button.onclick=async()=>{wrap.style.display="flex";notify("");try{await refresh();}catch(e){report(e);}};
$("Close").onclick=()=>wrap.style.display="none";wrap.onpointerdown=e=>{if(e.target===wrap)wrap.style.display="none";};
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&wrap.style.display==="flex")wrap.style.display="none";});
})();
