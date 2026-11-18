/* META RAYON v0.44 bridge: preserve original tools, add startup choice and fixed floor transfer. */
(function(){
"use strict";
var STORE="meta-rayon-last-project-v044",ARCHIVE="meta-rayon-previous-project-archive-v044",TRANSFER="meta-floor-transfer-v1";
var active=false,queued=null,saveTimer=null,lastSaveError=false;
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function r(n){return Math.round((Number(n)||0)*100)/100;}
function validProject(d){return !!(d&&Array.isArray(d.objects));}
function meaningfulProject(d){return validProject(d)&&(d.objects.length>0||d.underlay||d.terrain33);}
function readLocal(key){try{var d=JSON.parse(localStorage.getItem(key)||"null");return validProject(d)?d:null;}catch(e){return null;}}
function stored(){
 var current=readLocal(STORE),archived=readLocal(ARCHIVE);
 // An empty new workspace must not hide the last real project kept in the archive.
 if(meaningfulProject(current))return current;
 if(archived)return archived;
 if(current)return current;
 try{var records=readSc();if(records.length&&validProject(records[records.length-1].data))return records[records.length-1].data;}catch(e){}
 return null;
}
function store(){if(!active)return;try{localStorage.setItem(STORE,JSON.stringify(serialize()));lastSaveError=false;}catch(e){if(!lastSaveError){console.warn("Автосохранение недоступно: сохраните проект кнопкой JSON.",e);lastSaveError=true;}}}
function later(){if(!active)return;clearTimeout(saveTimer);saveTimer=setTimeout(store,1200);}
var previousSync=syncBlockMetrics;
syncBlockMetrics=function(o){
 if(o&&o.metaFixed&&o.metaFloor){
  var f=o.metaFloor;
  o.saleFloor=Number(f.saleArea_m2)||0;
  o.grossFloor=Number(f.constructionArea_m2)||Math.max(0,(Number(f.grossArea_m2)||0)-(Number(f.liftShaftArea_m2)||0));
  o.kep=Number(f.kepPreliminary)||Number(f.kep)||(o.grossFloor>0?o.saleFloor/o.grossFloor:0);
  o.avgApt=f.apartmentsPerFloor>0?o.saleFloor/f.apartmentsPerFloor:50;
  o.label="СЕКЦИЯ · КОНФИГУРАТОР";
  o.avgApt=Number(f.averageApartmentArea_m2)||(Number(f.apartmentsPerFloor)>0?o.saleFloor/Number(f.apartmentsPerFloor):o.avgApt||50);
  o.blockCalc={comboKey:o.comboKey||"T3L",avgApt:o.avgApt,kep:o.kep,footprint:o.shape==="bend"&&Array.isArray(o.points)?polygonAreaPoints(o.points):o.w*o.h,saleFloor:o.saleFloor,nKv:Number(f.apartmentsPerFloor)||0,nChel:(Number(f.apartmentsPerFloor)||0)*2};
  return;
 }
 return previousSync(o);
};
// Building-level TEP: keep the configurator's exact typical-floor metrics and apply the ground-floor rule once.
function metaBlockTypicalCount(o){
 var f=o.metaFloor||{},exact=Math.floor(Number(f.apartmentsPerFloor)||0);
 if(exact>0)return exact;
 var saved=Math.round(Number(o.blockCalc&&o.blockCalc.nKv)||0);
 if(saved>0)return saved;
 var sale=Math.max(0,Number(o.saleFloor)||0),avg=Number(o.avgApt)||50;
 return avg>0?Math.max(0,Math.round(sale/avg)):0;
}
function metaBlockAverageApartmentArea(o){
 var f=o.metaFloor||{},n=metaBlockTypicalCount(o),sale=Math.max(0,Number(o.saleFloor)||0);
 return Number(f.averageApartmentArea_m2)||(n>0?sale/n:Number(o.avgApt)||50);
}
var metaPreviousBuildingSale=buildingSale;
buildingSale=function(o){
 if(!o||o.kind!=="building"||o.surrounding)return 0;
 if(o.type!=="BLOK")return metaPreviousBuildingSale(o);
 var floors=Math.max(0,Math.floor(Number(o.floors)||0)),sale=Math.max(0,Number(o.saleFloor)||0);
 if(!floors)return 0;
 if(o.groundFloorUse==="commercial")return Math.max(0,floors-1)*sale;
 return Math.max(0,floors-1)*sale+Math.max(0,sale-metaBlockAverageApartmentArea(o)-50);
};
var metaPreviousBuildingCommercial=buildingCommercial;
buildingCommercial=function(o){
 if(o&&o.kind==="building"&&!o.surrounding&&o.type==="BLOK"&&o.groundFloorUse==="commercial")return Math.max(0,Number(o.saleFloor||0)-60);
 return metaPreviousBuildingCommercial(o);
};
function buildingApartmentCount(o){
 if(!o||o.kind!=="building"||o.surrounding)return 0;
 if(o.type!=="BLOK")return Math.floor(buildingSale(o)/(Number(o.avgApt)||product().avg));
 var floors=Math.max(0,Math.floor(Number(o.floors)||0));
 if(!floors)return 0;
 var typical=metaBlockTypicalCount(o);
 return Math.max(0,floors-1)*typical+(o.groundFloorUse==="commercial"?0:Math.max(0,typical-1));
}
window.metaMassingApartmentCount=buildingApartmentCount;
var metaPreviousMetrics=metrics;
metrics=function(){
 var result=metaPreviousMetrics(),buildings=state.objects.filter(function(o){return o.kind==="building"&&!o.surrounding;});
 result.apts=buildings.reduce(function(total,o){return total+buildingApartmentCount(o);},0);
 return result;
};
/* The quarter panel lives inside the v0.38 IIFE.  It is intentionally exposed
   through window.quarter38; using that public API avoids a startup crash while
   leaving the calculation and editing algorithms unchanged. */
var metaQuarterApi=window.quarter38||{};
var metaScope=metaQuarterApi.scope;
var metaPreviousRefreshPanel=metaQuarterApi.refreshPanel;
var metaRefreshPanel=function(){
 if(typeof metaPreviousRefreshPanel==="function")metaPreviousRefreshPanel();
 var s=typeof metaScope==="function"?metaScope():{title:"Проект",objects:[]},apts=s.objects.reduce(function(total,o){return total+buildingApartmentCount(o);},0);
 var apartmentArea=s.objects.reduce(function(total,o){return total+buildingSale(o);},0);
 var commercialArea=s.objects.reduce(function(total,o){return total+buildingCommercial(o);},0);
 var stat=by("scopeMetrics38");
 if(stat)stat.textContent=s.title+(s.objects.length?" · квартирная площадь "+fmt(apartmentArea)+" м² · коммерция "+fmt(commercialArea)+" м² · квартир ≈ "+fmt(apts):"");
 var labels=localTargets.querySelectorAll("label.frow");
 labels.forEach(function(label){
  var input=label.querySelector("input"),factText=label.nextElementSibling;
  if(!input||!factText||input.type!=="number")return;
  var fact=input.step==="1"?apts:apartmentArea;
  if(fact===null)return;
  var target=Number(input.value);
  factText.textContent="Факт: "+fmt(fact)+(input.step==="1"?" кв.":" м²")+(target>0?" · Осталось: "+fmt(Math.max(0,target-fact))+(input.step==="1"?" кв.":" м²"):" · Цель не задана");
 });
};
var metaPreviousCalloutStatsHtml=calloutStatsHtml;
calloutStatsHtml=function(o){
 if(!o||o.kind!=="building"||o.surrounding)return metaPreviousCalloutStatsHtml(o);
 var bc=o.blockCalc||{},saleApts=buildingSale(o),saleCommercial=buildingCommercial(o);
 return "Площадь пятна: <b>"+fmt(bc.footprint!=null?bc.footprint:objArea(o))+" м²</b> · КЭП типового этажа: <b>"+fmt(o.kep,4)+"</b><br>S прод. квартиры (на дом): <b>"+fmt(saleApts)+" м²</b><br>Квартир (на дом): <b>"+fmt(buildingApartmentCount(o))+"</b><br>S прод. коммерция (на дом): <b>"+fmt(saleCommercial)+" м²</b>";
};
var previousResizable=isResizable;
isResizable=function(o){return !(o&&o.metaFixed)&&previousResizable(o);};
function metaConfigureButtonHtml(){return '<div class="row2" style="margin-top:10px"><button class="btn primary" id="metaConfigureSectionBtn" style="width:100%">Подобрать модули квартир в Конфигураторе →</button></div>';}
function metaSendSectionToConfigurator(o){
 if(!o||!(o.type==="BLOK"||o.metaFixed))return;
 const key=o.metaFloor&&o.metaFloor.sectionTypeKey||sectionTypeKeyFor(o.comboKey||"T3L",o.shape||"straight");
 const st=SECTION_TYPES[key]||{},family=o.metaFloor&&o.metaFloor.mopType||(o.shape==="bend"?"Г":(o.comboKey==="H3L"||o.comboKey==="T4L"?"Н":"Т"));
 const pts=Array.isArray(o.points)?o.points:[],xs=pts.map(p=>Number(p[0])||0),ys=pts.map(p=>Number(p[1])||0);
 const maxW=xs.length?Math.max(...xs)-Math.min(...xs):Number(o.w)||0,maxD=ys.length?Math.max(...ys)-Math.min(...ys):Number(o.h)||0;
 let lifts=Number(o.metaFloor&&o.metaFloor.liftCount)||Number(st.lifts)||comboLiftsNominal(o.comboKey||"T3L");
 const avg=Number(o.metaFloor&&o.metaFloor.averageApartmentArea_m2)||Number(o.avgApt)||50;
 const sale=Number(o.metaFloor&&o.metaFloor.saleArea_m2)||Number(o.saleFloor)||Number(o.blockCalc&&o.blockCalc.saleFloor)||0;
 let warning="";
 if(family==="Г"&&lifts!==1&&lifts!==2)warning="В выбранной секции Массинга указано "+lifts+" лифта; в каталоге Г-типа доступны МОП с 1 или 2 лифтами. Уточните вариант МОП перед подбором.";
 const payload={meta:{tool:"META_MASSING",purpose:"META_SECTION_CONFIGURE",created:new Date().toISOString()},section:{id:String(o.id),family:family,label:String(o.label||st.label||family+"-тип"),sectionTypeKey:key,comboKey:o.comboKey||"T3L",shape:o.shape||"straight",liftCount:lifts,mopId:String(o.metaFloor&&o.metaFloor.mopId||o.mopId||""),maxWidth_m:r(maxW||o.w),maxDepth_m:r(maxD||o.h),legWidth_m:Number(o.legWidth)||0,leg1_m:Number(o.leg1)||0,leg2_m:Number(o.leg2)||0,averageApartmentArea_m2:avg,saleFloor_m2:sale,floors:Number(o.floors)||18,groundFloorUse:o.groundFloorUse||"residential",rotation:Number(o.rot)||0,stage:Number(o.stage)||1,warning:warning}};
 if(parent===window)throw Error("Откройте Массинг через «МЕТА · Инструменты», чтобы передать секцию в Конфигуратор.");
 parent.postMessage({type:"META_SECTION_CONFIGURE",payload:payload},location.origin);
}
var previousInspector=renderInspector;
renderInspector=function(){
 var o=selected();
 if(!o||(o.type!=="BLOK"&&!o.metaFixed)){previousInspector();return;}
 var root=document.getElementById("inspector");
 if(!o.metaFixed){
  previousInspector();
  var legacyTep=root.querySelector("#sectionInspector41 .statusline");
  if(legacyTep)legacyTep.innerHTML=legacyTep.innerHTML.replace(/Квартир всего:\s*[^<]*/,"Квартир всего: "+buildingApartmentCount(o));
  root.insertAdjacentHTML("beforeend",metaConfigureButtonHtml());
 }else{
  var f=o.metaFloor||{};
  root.innerHTML='<div class="inspectorTitle" id="fixedTitle"></div>'+
   '<div class="statusline"><b>Геометрия и ТЭП закреплены Конфигуратором.</b><br>Разрешены только этажность, перемещение и поворот для посадки на участке.</div>'+
   '<div class="frow"><label>Габарит, X × Y</label><b>'+r(o.w)+' × '+r(o.h)+' м</b></div>'+
   '<div class="frow"><label>Тип МОП</label><b>'+String(f.mopName||f.mopType||"—")+'</b></div>'+
   '<div class="frow"><label>Квартир / этаж</label><b>'+r(f.apartmentsPerFloor)+'</b></div>'+
   '<div class="frow"><label>S квартир / этаж</label><b>'+r(f.saleArea_m2)+' м²</b></div>'+
   '<div class="frow"><label>Средняя площадь</label><b>'+r(f.averageApartmentArea_m2||o.avgApt)+' м²</b></div>'+
   '<div class="frow"><label>S МОП / этаж</label><b>'+r(f.mopArea_m2)+' м²</b></div>'+
   '<div class="frow"><label>Площадь по контуру / этаж</label><b>'+r(f.grossArea_m2)+' м²</b></div>'+
   '<div class="frow"><label>S строительная (контур − шахты)</label><b>'+r(f.constructionArea_m2||Math.max(0,(Number(f.grossArea_m2)||0)-(Number(f.liftShaftArea_m2)||0)))+' м²</b></div>'+
   '<div class="frow"><label>КЭП типового этажа</label><b>'+r(f.kepPreliminary||f.kep)+'</b></div>'+
   '<div class="frow"><label>Этажность</label><input id="metaFixedFloors" type="number" min="1" max="100" step="1" value="'+o.floors+'"></div>'+
   '<div class="statusline"><b>На здание:</b><br>Квартир: '+r(buildingApartmentCount(o))+'<br>S квартир: '+r(buildingSale(o))+' м²<br>S коммерции: '+r(buildingCommercial(o))+' м²<br>S строительная: '+r((Number(f.constructionArea_m2)||0)*o.floors)+' м²<br>КЭП жилья на здание: '+r(Number(f.constructionArea_m2)&&o.floors?buildingSale(o)/(Number(f.constructionArea_m2)*o.floors):0)+'</div>'+
   metaConfigureButtonHtml();
  root.querySelector("#fixedTitle").textContent=o.label+" · "+o.id;
  root.querySelector("#metaFixedFloors").onchange=function(){var v=Number(this.value);if(!Number.isInteger(v)||v<1||v>100){this.value=o.floors;return;}checkpoint();o.floors=v;renderAll();later();};
 }
 if(o.metaFixed){
   var control=document.createElement("div");control.innerHTML='<div class="frow"><label>Окружающая застройка (не учитывается в ТЭП)</label><input id="metaFixedSurrounding" type="checkbox" '+(o.surrounding?'checked':'')+'></div><div class="frow"><label>Этап</label><input id="metaFixedStage" type="number" min="1" step="1" value="'+(o.stage||1)+'"></div>';
   root.appendChild(control);
   control.querySelector("#metaFixedSurrounding").onchange=function(){checkpoint();o.surrounding=this.checked;renderAll();later();};
   control.querySelector("#metaFixedStage").onchange=function(){checkpoint();o.stage=Math.max(1,Math.round(Number(this.value)||1));renderAll();later();};
   if(o.surrounding){Array.from(root.querySelectorAll(".statusline")).forEach(function(el){if(/На здание|ТЭП закреплены/.test(el.textContent))el.innerHTML="<b>Окружающая застройка. Не учитывается в ТЭП.</b>";});}
  }
  if(o.surrounding){Array.from(root.querySelectorAll(".statusline")).forEach(function(el){if(/Площадь пятна|КЭП|Квартир|S прод|На здание|жилой/.test(el.textContent))el.innerHTML="<b>Окружающая застройка — не учитывается в ТЭП.</b>";});}
  var configureBtn=root.querySelector("#metaConfigureSectionBtn");
 if(configureBtn)configureBtn.onclick=function(){try{metaSendSectionToConfigurator(o);}catch(e){alert(e.message||e);}};
};
var previousRenderObj=renderObj;
renderObj=function(o){
 previousRenderObj(o);
 if(!o||!o.metaFixed||!Array.isArray(o.metaParts)||!o.metaParts.length)return;
 var g=Array.from(objLayer.querySelectorAll("g.obj")).find(function(el){return el.dataset.id===o.id;});
 if(!g)return;
 var anchor=g.querySelector("text");
 for(var i=0;i<o.metaParts.length;i++){
  var part=o.metaParts[i];if(!Array.isArray(part.points)||part.points.length<3)continue;
  var p=document.createElementNS("http://www.w3.org/2000/svg","polygon");
  p.setAttribute("points",part.points.map(function(q){return r(q[0])+","+r(q[1]);}).join(" "));
  p.setAttribute("fill",part.kind==="mop"?"#d5dfe2":/^(1С|1К\/2С)/.test(part.name)?"#cee5f9":/3С/.test(part.name)?"#cde8d8":"#efdac2");
  p.setAttribute("stroke","#557080");p.setAttribute("stroke-width","0.16");p.setAttribute("pointer-events","none");
  if(anchor)g.insertBefore(p,anchor);else g.appendChild(p);
 }
};
function importKey(p){var b=p.bounds||{};return String(p.meta&&p.meta.created||"")+"|"+r(b.width_m)+"|"+r(b.depth_m);}
function importSection(p){
 if(!active){queued=p;return;}
 if(!p||!p.bounds||!p.floor||!Array.isArray(p.parts))throw Error("Неверный формат секции из Конфигуратора");
 var b=p.bounds,w=Number(b.width_m),h=Number(b.depth_m),f=p.floor,key=importKey(p);
 if(!(w>0&&h>0&&w<1000&&h<1000)||!Number.isFinite(Number(f.saleArea_m2)))throw Error("Некорректные габариты или ТЭП");
 if(state.objects.some(function(o){return o.metaFixed&&o.metaImportKey===key;})){
  localStorage.removeItem(TRANSFER);if(parent!==window)parent.postMessage({type:"META_MASSING_IMPORTED",replaceTargetId:p.replaceTargetId||null,replaced:!!p.replaceTargetId},location.origin);return;
 }
 var minX=Number(b.minX_m)||0,minY=Number(b.minY_m)||0;
 var parts=p.parts.map(function(q){return{kind:String(q.kind||""),name:String(q.name||""),points:(q.points_m||[]).map(function(x){return [r(Number(x[0])-minX-w/2),r(Number(x[1])-minY-h/2)];})};}).filter(function(q){return q.points.length>=3;});
 var contour=Array.isArray(p.boundary_m)?p.boundary_m.map(function(x){return [r(Number(x[0])-minX-w/2),r(Number(x[1])-minY-h/2)];}).filter(function(x){return Number.isFinite(x[0])&&Number.isFinite(x[1]);}):null;
 if(contour&&contour.length<3)contour=null;
 var replaceId=String(p.replaceTargetId||""),target=replaceId?state.objects.find(function(o){return String(o.id)===replaceId;}):null;
 if(replaceId&&(!target||target.kind!=="building"))throw Error("Исходная секция не найдена в Массинге. Передача отменена, план на площадке не изменён.");
 var floorData={floors:Math.max(1,Math.min(100,Math.floor(Number(f.floors)||Number(target&&target.floors)||Number(p.sourceSection&&p.sourceSection.floors)||18))),apartmentsPerFloor:Number(f.apartmentsPerFloor)||0,saleArea_m2:Number(f.saleArea_m2)||0,averageApartmentArea_m2:Number(f.averageApartmentArea_m2)||(Number(f.apartmentsPerFloor)>0?Number(f.saleArea_m2)/Number(f.apartmentsPerFloor):0),mopArea_m2:Number(f.mopArea_m2)||0,grossArea_m2:Number(f.grossArea_m2)||0,constructionArea_m2:Number(f.constructionArea_m2)||Math.max(0,(Number(f.grossArea_m2)||0)-(Number(f.liftShaftArea_m2)||0)),liftShaftArea_m2:Number(f.liftShaftArea_m2)||0,kep:Number(f.kep)||0,kepPreliminary:Number(f.kepPreliminary)||Number(f.kep)||0,mopId:String(f.mopId||""),mopType:String(f.mopType||""),mopName:String(f.mopName||""),liftCount:Number(f.liftCount)||0,sectionTypeKey:String(p.sourceSection&&p.sourceSection.sectionTypeKey||"")};
 checkpoint();
 var obj;
 if(target){
  target.w=r(w);target.h=r(h);target.shape=contour?"bend":"straight";target.points=contour||defaultPolyPoints(w,h);
  target.metaFixed=true;target.metaImportKey=key;target.metaFloor=floorData;target.metaParts=parts;target.status="RESOLVED";
  target.floors=floorData.floors;
  target.avgApt=floorData.averageApartmentArea_m2||target.avgApt||50;
  target.label="СЕКЦИЯ · "+(floorData.mopName||floorData.mopType||"КОНФИГУРАТОР");
  if(!target.groundFloorUse)target.groundFloorUse=(p.sourceSection&&p.sourceSection.groundFloorUse)||"residential";
  obj=target;
 }else{
  var maxX=0,maxY=0;
  for(var i=0;i<state.objects.length;i++){var o=state.objects[i];if(o.kind==="building"){maxX=Math.max(maxX,o.x+o.w/2);maxY=Math.max(maxY,o.y+o.h/2);}}
  var x=state.objects.length?maxX+w/2+10:state.siteW*.45,y=state.objects.length?maxY+20:state.siteH*.40;
  obj=add("BLOK",x,y,{w:r(w),h:r(h),shape:contour?"bend":"straight",points:contour||undefined,comboKey:(p.sourceSection&&p.sourceSection.comboKey)||"T3L",avgApt:floorData.averageApartmentArea_m2||50,floors:Math.max(1,Math.min(100,Math.floor(Number(f.floors)||18))),groundFloorUse:(p.sourceSection&&p.sourceSection.groundFloorUse)||"residential",metaFixed:true,metaImportKey:key,metaFloor:floorData,metaParts:parts,status:"RESOLVED"});
 }
 syncBlockMetrics(obj);
 if(contour){obj.shape="bend";obj.points=contour;obj.w=r(w);obj.h=r(h);}
 state.armed=null;state.selected=obj.id;
 localStorage.removeItem(TRANSFER);
 renderAll();later();
 if(parent!==window)parent.postMessage({type:"META_MASSING_IMPORTED",replaceTargetId:replaceId||null,replaced:!!replaceId,sectionId:obj.id},location.origin);
}
function applySaved(data){
 var input=document.getElementById("importFile");
 if(!input)throw Error("Не найден штатный загрузчик сценария.");
 var file=new File([JSON.stringify(data)],"META_previous_project.json",{type:"application/json"}),dt=new DataTransfer();
 dt.items.add(file);input.files=dt.files;
 input.dispatchEvent(new Event("change",{bubbles:true}));
}
function resetNewProject(){
 clearTimeout(saveTimer);
 state.siteArea=458835.66;state.siteW=800;state.siteH=458835.66/800;
 state.densityTarget=2.5;state.platformShare=80;state.individualShare=20;state.product="standard";
 state.objects=[];state.selected=null;state.armed=null;state.seq=1;
 state.zoom=1;state.panX=0;state.panY=0;state.showSun=true;state.undo=[];
 state.drag=null;state.resize=null;state.vertex=null;state.edgeDrag=null;state.roadVertex=null;
 state.calloutId=null;state.calloutPos=null;state.calloutOffset=null;state.calloutClassOpen=false;
 state.pinnedCallouts=[];state.dimensionChains=[];state.underlay=null;state.terrain33=null;state.insol34=null;
 state.sun33={latitude:55,date:"2026-04-22",north:0,step:2,trim:0,all:true};
 state.layers={parking:true,land:true,stage:true,road:true,stylobat:true,limit:true,firegap:true,sangap:true,underlay:true,model1:true,model2:true,model3:true,model4:true};
 var values={siteArea:state.siteArea,densityTarget:state.densityTarget,platformShare:state.platformShare,individualShare:state.individualShare,productClass:state.product};
 Object.keys(values).forEach(function(id){var el=document.getElementById(id);if(el)el.value=values[id];});
 try{localStorage.removeItem(STORE);}catch(e){}
 if(typeof resizeSite==="function")resizeSite();else if(typeof renderAll==="function")renderAll();
}
var css=document.createElement("style");
css.textContent="#metaStartOverlay{position:fixed;inset:0;z-index:999999;background:rgba(243,240,233,.84);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px}"+
 "#metaStartCard{max-width:530px;width:100%;background:rgba(252,250,246,.97);border:1px solid #d9d5cb;border-radius:12px;padding:26px;box-shadow:0 20px 55px rgba(57,49,39,.14);color:#474845}"+
 "#metaStartCard h2{font-family:'Roboto Condensed','Arial Narrow',Arial,sans-serif;font-size:28px;color:#202827;margin:0 0 9px}#metaStartCard p{font-size:13px;line-height:1.5;color:#777770}"+
 ".meta-start-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.meta-start-buttons button{padding:15px;min-height:95px;text-align:left;border:1px solid #d9d5cb;background:#fffdf9;color:#474845;border-radius:8px;cursor:pointer;font-family:Manrope,'Segoe UI',Arial,sans-serif;font-weight:700}"+
 ".meta-start-buttons button:first-child{background:#b95228;border-color:#b95228;color:#fff}"+
 ".meta-start-buttons button:disabled{opacity:.4;cursor:not-allowed}.meta-start-buttons small{display:block;font-weight:400;font-size:11px;margin-top:8px;line-height:1.4}";
document.head.appendChild(css);
var overlay=document.createElement("div");overlay.id="metaStartOverlay";
overlay.innerHTML='<div id="metaStartCard" role="dialog" aria-modal="true" aria-labelledby="metaStartTitle">'+
 '<h2 id="metaStartTitle">МЕТАМАССИНГ · открыть проект</h2>'+
 '<p>Выберите, начать с чистого рабочего поля или восстановить предыдущий проект. Все инструменты версии 0.44 сохранены.</p>'+
 '<div class="meta-start-buttons"><button type="button" id="metaNew">＋ Новый проект<small>Пустое рабочее поле</small></button>'+
 '<button type="button" id="metaPrev">↩ Предыдущий проект<small>Восстановить автосохранение или последний сценарий</small></button></div></div>';
document.body.appendChild(overlay);
var snapshot=stored();
// Always show a genuinely blank workspace on startup. Keep the captured project
// only as an explicit restore option; never render it before the user asks.
if(snapshot&&meaningfulProject(snapshot)){try{localStorage.setItem(ARCHIVE,JSON.stringify(snapshot));}catch(e){}}
resetNewProject();
document.documentElement.classList.remove("meta-start-pending");
overlay.querySelector("#metaPrev").disabled=!snapshot;
 // Паркинг: переносит полную компоновку и рассчитанные ММ, не заменяя ее приближением м²/ММ.
 var PARKING_TRANSFER="meta-parking-massing-transfer-v1";
 function parkingTransferToMassing(p){
  if(!active)return;
  if(!p||p.direction!=="to-massing"||!p.layout||!Array.isArray(p.layout.items))return;
  var source=p.sourceId?state.objects.find(function(o){return String(o.id)===String(p.sourceId);}):null;
  if(p.sourceId&&(!source||source.kind!=="parking"))throw Error("Исходный паркинг не найден. Выберите предыдущий проект для возвращения редактируемого паркинга.");
  var w=Number(p.w),h=Number(p.h);if(!(w>0&&h>0&&w<10000&&h<10000))throw Error("Некорректные габариты паркинга");
  checkpoint();
  var o=source;
  if(!o){
   var x=Number.isFinite(Number(p.x))?Number(p.x):state.siteW*.5,y=Number.isFinite(Number(p.y))?Number(p.y):state.siteH*.5;
   o=add("P_AG",x,y,{w:w,h:h,levels:Math.max(1,Math.round(+p.floors||1)),stage:Math.max(1,Math.round(+p.stage||1))});
  }
  o.w=w;o.h=h;o.levels=Math.max(1,Math.round(+p.floors||1));o.stage=Math.max(1,Math.round(+p.stage||1));
  o.label="МЕТА ПАРКИНГ";o.metaParking={spaces:Math.max(0,Math.round(+p.spaces||0)),area_m2:Math.max(0,+p.area_m2||0),excluded_area_m2:Math.max(0,+p.excluded_area_m2||0),layout:p.layout};
  if(o.kind==="parking"&&Array.isArray(o.points))o.points=Array.isArray(p.contour_m)&&p.contour_m.length>=3?p.contour_m.map(function(q){return [Number(q[0])||0,Number(q[1])||0];}):defaultPolyPoints(w,h);
  if(Number.isFinite(+p.rot))o.rot=+p.rot;
  state.selected=o.id;state.calloutId=null;state.armed=null;
  localStorage.removeItem(PARKING_TRANSFER);renderAll();later();
 }
 var previousParkingInspector=renderInspector;
 renderInspector=function(){
  previousParkingInspector();
  var o=selected();if(!o||o.kind!=="parking")return;
  var root=document.getElementById("inspector");
  if(o.metaParking){
   // Конфигурация и ёмкость перенесённого паркинга редактируются только исходным инструментом.
   Array.from(root.querySelectorAll('[data-mm],[data-area],[data-k="w"],[data-k="h"],[data-k="levels"],[data-k="m2mm"]')).forEach(function(el){el.disabled=true;el.title="Параметр управляется конфигуратором Мета Паркинг";});
   var apply=root.querySelector("#applyInspector");if(apply)apply.style.display="none";
   var el=document.createElement("div");el.className="statusline";el.innerHTML="<b>По компоновке Мета Паркинг:</b> "+fmt(o.metaParking.spaces)+" ММ · S паркинга "+fmt(o.metaParking.area_m2)+" м² · исключаемая площадь "+fmt(o.metaParking.excluded_area_m2)+" м²";
   root.appendChild(el);
  }
  var btn=document.createElement("button");btn.type="button";btn.className="btn primary";btn.style.cssText="width:100%;margin-top:10px";btn.textContent="Открыть в Мета Паркинг →";
  btn.onclick=function(){
   var data={direction:"to-parking",created:Date.now(),source:{id:o.id,x:o.x,y:o.y,rot:o.rot||0,w:o.w,h:o.h,levels:o.levels,stage:o.stage,area_m2:o.metaParking&&o.metaParking.area_m2||objArea(o)},layout:o.metaParking&&o.metaParking.layout||null};
   localStorage.setItem(PARKING_TRANSFER,JSON.stringify(data));store();
   window.top.location.href="/tools/meta-parking/";
  };
  root.appendChild(btn);
 };

 // Отдельный наземный паркинг: связь с параметрическим конфигуратором автостоянки.
 var SURFACE_TRANSFER="meta-surface-parking-transfer-v1";
 function pendingSurfaceTransfer(){
   try{
     var p=JSON.parse(localStorage.getItem(SURFACE_TRANSFER)||"null");
     var age=p?Date.now()-Number(p.created):Infinity;
     return p&&p.direction==="to-massing"&&age>=0&&age<86400000?p:null;
   }catch(e){return null;}
 }
 function importSurfaceParking(p){
   if(!active)return;
   if(!p||p.direction!=="to-massing"||!p.sourceId)return;
   var o=state.objects.find(function(x){return String(x.id)===String(p.sourceId);});
   if(!o||o.type!=="P_FREE")throw Error("Исходный объект «Отдельный» не найден. Откройте предыдущий проект Массинга, не новый.");
   var w=Number(p.width_m),h=Number(p.depth_m),levels=Number(p.levels),spaces=Number(p.spaces);
   if(!(w>0&&h>0&&levels>=1&&Number.isInteger(levels)&&spaces>=0&&Number.isInteger(spaces)))throw Error("Некорректные габариты, этажность или количество ММ.");
   checkpoint();
   o.w=w;o.h=h;o.levels=levels;
   if(Array.isArray(o.points))o.points=defaultPolyPoints(w,h);
   o.metaSurfaceParking={params:p.params||null,spaces:spaces,spacesPerFloor:Number(p.spacesPerFloor)||0,areaFloor_m2:Number(p.area_m2)||w*h,totalFloorArea_m2:Number(p.totalFloorArea_m2)||w*h*levels};
   o.stage=Math.max(1,Math.round(Number(p.stage)||Number(o.stage)||1));
   state.selected=o.id;state.calloutId=null;state.armed=null;
   localStorage.removeItem(SURFACE_TRANSFER);renderAll();later();
 }
 // Встраиваем только в окно выбранного объекта, оставляя остальные панели без изменений.
 var originalSurfaceInspector=renderInspector;
 renderInspector=function(){
   originalSurfaceInspector();
   var o=selected();
   if(!o||o.type!=="P_FREE")return;
   var root=document.getElementById("inspector");
   if(o.metaSurfaceParking){
     Array.from(root.querySelectorAll('[data-mm],[data-area],[data-k="w"],[data-k="h"],[data-k="levels"],[data-k="m2mm"]')).forEach(function(el){el.disabled=true;el.title="Разрабатывается в конфигураторе наземной автостоянки";});
     var apply=root.querySelector("#applyInspector");if(apply)apply.style.display="none";
     var stat=document.createElement("div");stat.className="statusline";
     stat.innerHTML="<b>Конфигуратор наземной автостоянки:</b><br>Габариты "+fmt(o.w,2)+" × "+fmt(o.h,2)+" м · "+fmt(o.levels)+" этажей · "+fmt(o.metaSurfaceParking.spaces)+" ММ";
     root.appendChild(stat);
   }
   var btn=document.createElement("button");btn.className="btn primary";btn.type="button";
   btn.style.cssText="width:100%;margin-top:9px";
   btn.textContent="Разработать в инструменте паркинга →";
   btn.onclick=function(){
     var p={direction:"to-configurator",created:Date.now(),
       source:{id:String(o.id),type:"P_FREE",w:o.w,h:o.h,levels:o.levels,stage:o.stage,x:o.x,y:o.y},
       params:o.metaSurfaceParking&&o.metaSurfaceParking.params||null};
     localStorage.setItem(SURFACE_TRANSFER,JSON.stringify(p));
     store();
     window.top.location.href="/tools/surface-parking-configurator/";
   };
   root.appendChild(btn);
 };
 function readParkingTransfer(){try{var p=JSON.parse(localStorage.getItem(PARKING_TRANSFER)||"null");return p&&p.direction==="to-massing"&&Date.now()-Number(p.created)<86400000?p:null;}catch(e){return null;}}


function activate(usePrevious){
 overlay.remove();active=true;
 if(usePrevious&&snapshot){
  try{applySaved(snapshot);}catch(e){console.warn("Не удалось восстановить проект",e);alert("Не удалось восстановить автоматически. Загрузите прежний JSON через кнопку «Загрузить».");}
 }else{
  resetNewProject();
 }
 if(queued){var p=queued;queued=null;setTimeout(function(){try{importSection(p);}catch(e){alert("Ошибка передачи секции: "+e.message);}},usePrevious?250:25);}
 var parking=readParkingTransfer();if(parking)setTimeout(function(){try{parkingTransferToMassing(parking);}catch(e){alert("Ошибка передачи паркинга: "+e.message);}},usePrevious?350:80);
 var surface=pendingSurfaceTransfer();if(surface)setTimeout(function(){try{importSurfaceParking(surface);}catch(e){alert("Ошибка возврата наземного паркинга: "+e.message);}},usePrevious?450:160);
}
overlay.querySelector("#metaNew").onclick=function(){activate(false);};
overlay.querySelector("#metaPrev").onclick=function(){activate(true);};
window.addEventListener("message",function(e){if(e.origin!==location.origin||!e.data||e.data.type!=="META_FLOOR_IMPORT")return;try{importSection(e.data.payload);}catch(err){alert("Ошибка импорта: "+err.message);}});
try{var data=JSON.parse(localStorage.getItem(TRANSFER)||"null");if(data&&data.meta&&data.meta.purpose==="META_MASSING_PLAN_IMPORT"){var t=Date.parse(data.meta.created||"");if(!t||Date.now()-t<30*60*1000)queued=data;}}catch(e){}
document.addEventListener("pointerup",later,true);
document.addEventListener("change",later,true);
document.addEventListener("click",later,true);
window.addEventListener("pagehide",store);
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")store();});
/* Consume a single explicit choice made on /tools/meta-massing/ BEFORE
   starting the heavy Massing iframe. Direct /meta/ launches retain this menu. */
try{
 var launchRaw=sessionStorage.getItem("platforma-massing-launch-v1");
 if(launchRaw){
  sessionStorage.removeItem("platforma-massing-launch-v1");
  var launchRequest=JSON.parse(launchRaw);
  if(launchRequest&&
     (launchRequest.mode==="new"||launchRequest.mode==="previous")&&
     Date.now()-Number(launchRequest.created)<120000&&
     Date.now()-Number(launchRequest.created)>=0){
   if(launchRequest.mode==="new"||snapshot){
    activate(launchRequest.mode==="previous");
   }
   /* If there is no previous project, leave the native menu available. */
   if(window.top!==window)window.top.postMessage({type:"PLATFORMA_MASSING_ACTIVATED"},location.origin);
  }
 }
}catch(launchError){console.warn("Режим запуска: используется штатное меню",launchError);}
if(parent!==window)parent.postMessage({type:"META_MASSING_READY"},location.origin);
})();

