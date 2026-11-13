'use strict';
const D=window.CATALOGUE_DATA,$=id=>document.getElementById(id);
let FX={},FXCheckedAt=-Infinity;
const legacyView={key:null,rows:[],next:null,error:null,pending:false,names:null,namesPending:null};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{let b=node('button',text,cls);b.type='button';b.onclick=fn;return b;};
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem('atlas:'+k))??fallback;}catch{return fallback;}};
const save=(k,v)=>{try{localStorage.setItem('atlas:'+k,JSON.stringify(v));}catch{}};
const finishRu={'Case Hardened':'Поверхностная закалка','Heat Treated':'Термическая обработка','Solitude':'Уединение','Acid Fade':'Кислотный градиент','Fade':'Градиент','Amber Fade':'Янтарный градиент','Crimson Web':'Кровавая паутина','Marble Fade':'Мраморный градиент','Slaughter':'Убийство','PAW':'ЛАПКИ','Midnight Lily':'Полуночная лилия','Gamma Doppler':'Гамма-волны','Doppler':'Волны','Nocts':'Ноктс','Emerald':'Изумруд','Ocean Drive':'Океанское побережье'};
const aliases={'M4A1-S':['м4а1','м4а1с','эмка','эм четыре','m4a1s','m4a1'], 'XM1014':['хм','икс эм','xm','хм1014'], 'Five-SeveN':['файв севен','файвсевен','файв сэвэн','файв сэвен','пять семь','57','fiveseven','five seven'], 'Desert Eagle':['дигл','дезерт игл','дезерт','deagle'], 'SSG 08':['ссг','муха','скаут','ssg08'], 'AK-47':['ак','калаш','ак47','ak47'], 'Bayonet':['штык нож','байонет'], 'Karambit':['керамбит','карамбит'], 'Butterfly Knife':['бабочка'], 'Nomad Knife':['бродяга'], 'Skeleton Knife':['скелетный нож'], 'Kukri Knife':['кукри'], 'Classic Knife':['классический нож'], 'Stiletto Knife':['стилет'], 'Talon Knife':['коготь'], 'Survival Knife':['нож выживания'], 'Paracord Knife':['паракорд'], 'Ursus Knife':['медвежий нож'], 'Flip Knife':['складной нож'], 'Gut Knife':['нож с лезвием крюком'], 'Huntsman Knife':['охотничий нож'], 'Bowie Knife':['нож боуи'], 'Falchion Knife':['фальшион'], 'Shadow Daggers':['тычковые ножи'], 'MAC-10':['мак','мак10'], 'P2000':['п2000'], 'AWP':['авп','авапа'], 'Glock-18':['глок'], 'Case Hardened':['закалка','поверхностная','поверхостная закалка','кейс харденед','кейсхарденед','blue gem','блю гем','блюгем'], 'Heat Treated':['термичка','термическая','хит тритед'], 'Solitude':['уединение'], 'Acid Fade':['кислотный градиент']};
const groupRu={'Dark Blue Mountains':'Тёмно-синие горы','Blue Mountains':'Синие горы','Green Mountains':'Зелёные горы','Orange Sun':'Оранжевое солнце','Double Sun':'Двойное солнце','Triple Sun':'Тройное солнце','Sun':'Солнце','Blue Gem':'Голубой самоцвет','Scar':'Шрам','named family':'Именная группа'};
const ru=s=>{let out=String(s??'');for(const [a,b] of Object.entries(groupRu))out=out.replaceAll(a,b);for(const [a,b] of Object.entries(finishRu).sort((a,b)=>b[0].length-a[0].length))out=out.replaceAll(a,b);return out;};
const title=s=>ru(s);
const normalize=s=>String(s??'').toLowerCase().replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,'');
let names=[...new Set(D.groups.map(g=>g.skin))].sort((a,b)=>a.localeCompare(b));
function searchText(s){return [s,title(s),...Object.entries(aliases).filter(([k])=>s.includes(k)).flatMap(([,v])=>v)].map(normalize).join(' ');}
function searchNames(query){let tokens=String(query).trim().split(/\s+/).map(normalize).filter(Boolean);return names.filter(n=>tokens.every(t=>searchText(n).includes(t))).filter(n=>!$('favoritesOnly').checked||state.favorites.includes(n));}
const feedStore=new AtlasFeedV2.Store();
const wholeSkinRequests={};
const state={feedSort:load('feedSortV2',{key:'ingestion_sequence',dir:'desc'}),tableSort:load('tableSort',{key:'observed_at',dir:'desc'}),skin:'M4A1-S | Solitude',seed:null,tab:'catalogue',favorites:load('favorites',[]),queue:load('queue',[]),compare:[],view:'Front',connected:false,cursor:null,feed:[],pending:[],paused:false,liveRows:new Map(),queueJobs:[],catalogue:null,catalogueKey:null,catalogueRevision:null,older:false,suggestIndex:-1,suggestions:[],groupViews:new Map(),catalogueReveal:null,feedPage:{limit:50,key:'feed'}};
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function date(t){if(!t)return 'Дата неизвестна';let d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):t;}
function age(t){let m=(Date.now()-new Date(t))/60000;return !Number.isFinite(m)?'Дата неизвестна':m<0?'Часы источника впереди':m<15?'До 15 минут':m<1440?Math.floor(m/60)+' ч назад':'Архив · '+Math.floor(m/1440)+' дн.';}
function nativeMoney(value,currency){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:currency||'USD',maximumFractionDigits:currency==='USD'||currency==='EUR'?3:2}).format(Number(value));}
function rubCents(value,rate){function fraction(v){let s=String(v);if(!/^\d+(\.\d+)?$/.test(s))return null;let [a,b='']=s.split('.');return [BigInt(a+b),10n**BigInt(b.length)];}let a=fraction(value),b=fraction(rate);if(!a||!b)return null;let n=a[0]*b[0],d=a[1]*b[1];return (n*100n*2n+d)/(2n*d);}
function price(r){if(r.price==null)return r.raw_reported_price_text!=null?String(r.raw_reported_price_text)+' · единицы не подтверждены':'Цена неизвестна';let native=nativeMoney(r.price,r.currency);if(r.currency==='RUB')return native;let f=FX[r.currency],c=f&&rubCents(r.price,f.rub_per_unit);if(c===null||c===undefined)return native+' · курс ₽ неизвестен';let stale=Date.now()-new Date(f.observed_at)>86400000;return (stale?'≈ ':'')+nativeMoney(Number(c)/100,'RUB')+' ('+native+')'+(stale?' · архивный курс':'');}
function fxDescription(r){if(r.currency==='RUB')return 'Исходная цена площадки в рублях';let f=FX[r.currency];return f?'Курс: 1 '+r.currency+' = '+f.rub_per_unit+' ₽ · действует с '+date(f.effective_at)+' · получен '+date(f.observed_at)+(f.basis==='same_cached_rate_as_Telegram'?' · тот же справочный курс, что в Telegram':' · официальный справочный курс ЦБ'):'Проверенного курса для пересчёта нет';}

function safeURL(s){try{let u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function link(text,url){let a=node('a',text);const u=safeURL(url);if(u){a.href=u;a.target='_blank';a.rel='noopener noreferrer';}else return node('span','Нет точной ссылки','muted');return a;}
function priceCell(r){const cell=node('td',undefined,'price');cell.title=fxDescription(r);let url=r.price_url??r.display_url;if(!expiredSnapshotOffer(r)&&safeURL(url))cell.append(link(price(r),url));else cell.textContent=price(r);return cell;}
function setTab(tab){state.tab=tab;for(let n of ['catalogue','feed','queue','findings'])$(n).hidden=n!==tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('pageTitle').textContent={catalogue:'Каталог паттернов',feed:'Новые записи',queue:'Приоритетные обновления',findings:'Подробная карточка'}[tab];if(tab==='feed')renderFeed();if(tab==='queue')renderQueue();if(tab==='findings')renderFinding();writeHash();}
function writeHash(){const p=new URLSearchParams({tab:state.tab,skin:state.skin});if(state.seed!==null)p.set('seed',state.seed);if($('wear').value)p.set('wear',$('wear').value);if($('archive').checked)p.set('archive','1');if($('variant').value!=='normal')p.set('variant',$('variant').value);history.replaceState(null,'','#'+p);}
function readHash(){let p=new URLSearchParams(location.hash.slice(1));if(p.get('skin')&&p.get('skin').includes(' | ')&&p.get('skin').length<=200)state.skin=p.get('skin');let n=p.get('seed');if(n!==null&&/^\d+$/.test(n)&&+n<=1000)state.seed=+n;else state.seed=null;$('wear').value=['FN','MW','FT','WW','BS','cap:0.0001','cap:0.001','cap:0.01'].includes(p.get('wear'))?p.get('wear'):'';$('archive').checked=p.get('archive')==='1';$('variant').value=['normal','stattrak','souvenir'].includes(p.get('variant'))?p.get('variant'):'normal';$('seedInput').value=state.seed??'';setTab(['catalogue','feed','queue','findings'].includes(p.get('tab'))?p.get('tab'):'catalogue');renderCatalogue();}
function selectSkin(s){state.catalogueAnchor=null;state.skin=s;state.seed=null;$('seedInput').value='';if(!D.active[s.toLowerCase()])$('archive').checked=true;closeSuggest();renderCatalogue();}
function selectSeed(seed,skin=state.skin){const saved=skin===state.skin&&state.tab==='catalogue'?catalogueViewport():null;state.catalogueReveal=null;state.skin=skin;state.seed=Number(seed);$('seedInput').value=seed;if(!D.active[skin.toLowerCase()])$('archive').checked=true;state.catalogueAnchor=saved?{...saved,selection:scopeQuery().toString()}:null;renderCatalogue();if(state.tab==='findings')renderFinding();}

// Presentation state is independent of refreshed source data and grouped by
// item/wear/variant/group. It never changes the source queue or stored prices.
function groupView(g){
 const key=JSON.stringify([g.skin,g.id,$('wear').value,$('variant').value]);
 if(!state.groupViews.has(key)){
  if(state.groupViews.size>=256)state.groupViews.delete(state.groupViews.keys().next().value);
  state.groupViews.set(key,{key,tab:'ask',offerMode:'confirmed',disclosures:{},filters:{venue:'',seed:false,clean:false},tables:{ask:{limit:10,key:key+'|ask'},history:{limit:10,key:key+'|history'}}});
 }
 return state.groupViews.get(key);
}
function bindDisclosure(element,view,key,defaultOpen){
 element.dataset.atlasFocus=view.key+'|'+key;
 element.dataset.atlasView=view.key;element.dataset.atlasDisclosure=key;
 element.open=Object.hasOwn(view.disclosures,key)?view.disclosures[key]:defaultOpen;
 element.ontoggle=()=>{if(element.isConnected)view.disclosures[key]=element.open;};
}
function groupControl(element,view,key){element.dataset.atlasFocus=view.key+'|'+key;return element;}
function catalogueViewport(){
 const cards=$('groupCards'),selection=scopeQuery().toString();
 for(const element of cards.querySelectorAll('details[data-atlas-view]')){
  const view=state.groupViews.get(element.dataset.atlasView);if(view)view.disclosures[element.dataset.atlasDisclosure]=element.open;
 }
 if(state.tab!=='catalogue'||cards.dataset.selection!==selection)return null;
 const active=document.activeElement,control=cards.contains(active)?active?.closest('[data-atlas-focus]'):null;
 const article=cards.contains(active)?active?.closest('article[data-group]'):null;const anchor=article||[...cards.querySelectorAll('article[data-group]')].find(e=>e.getBoundingClientRect().bottom>0);
 return {selection,x:window.scrollX,y:window.scrollY,focus:control?.dataset.atlasFocus,group:anchor?.dataset.group,top:anchor?.getBoundingClientRect().top};
}
function restoreCatalogueViewport(saved){
 if(!saved||state.tab!=='catalogue'||saved.selection!==scopeQuery().toString())return;
 if(saved.focus){
  const match=[...$('groupCards').querySelectorAll('[data-atlas-focus]')].find(e=>e.dataset.atlasFocus===saved.focus);
  (match?.tagName==='DETAILS'?match.querySelector('summary'):match)?.focus({preventScroll:true});
 }
 const anchor=saved.group?[...$('groupCards').querySelectorAll('article[data-group]')].find(e=>e.dataset.group===saved.group):null;
 window.scrollTo(saved.x,anchor&&Number.isFinite(saved.top)?window.scrollY+anchor.getBoundingClientRect().top-saved.top:saved.y);
}
function settleCatalogueAnchor(){const saved=state.catalogueAnchor;if(!saved)return;if(state.tab!=='catalogue'||saved.selection!==scopeQuery().toString()){state.catalogueAnchor=null;return;}if(cataloguePending||String(state.catalogue?.seed??'')!==String(state.seed??''))return;const groups=groupsForSkin(state.skin).filter(g=>state.seed===null||g.seeds.includes(state.seed));if(groups.some(g=>groupView(g).dataPending))return;restoreCatalogueViewport(saved);state.catalogueAnchor=null;}
function openFeedPattern(row){state.catalogueAnchor=null;
 if(typeof row.skin!=='string'||!row.skin.includes(' | ')||row.skin.length>200){toast('Предмет этой записи не определён.');return;}
 if(!['normal','stattrak','souvenir'].includes(row.variant)){toast('Разновидность этой записи не подтверждена. Точный переход недоступен.');return;}
 state.skin=row.skin;
 const raw=row.seed,valid=typeof raw==='number'&&Number.isInteger(raw)||typeof raw==='string'&&/^\d{1,4}$/.test(raw);
 state.seed=valid&&Number(raw)>=0&&Number(raw)<=1000?Number(raw):null;
 $('seedInput').value=state.seed??'';
 $('wear').value=['FN','MW','FT','WW','BS'].includes(row.wear)?row.wear:'';
 $('variant').value=row.variant;
 if(!D.active[state.skin.toLowerCase()])$('archive').checked=true;
 state.catalogueReveal=state.seed===null?null:{selection:scopeQuery().toString()};
 for(const g of groupsForSkin(state.skin))if(g.seeds.includes(state.seed)){
  const view=groupView(g);view.disclosures.seeds=true;view.disclosures.quotes=true;
 }
 setTab('catalogue');renderCatalogue();
}
function revealCataloguePattern(){
 const pending=state.catalogueReveal;if(!pending)return;
 if(state.tab!=='catalogue'||pending.selection!==scopeQuery().toString()){state.catalogueReveal=null;return;}
 const group=$('groupCards').querySelector('.selected-group');if(!group)return;
 group.scrollIntoView({block:'start'});
 const seed=group.querySelector('.seed-button.selected')||group.querySelector('.seed-main');
 seed?.focus({preventScroll:true});state.catalogueReveal=null;
}
function offerSourceSummary(packet){
 const labels={receiving:'принимает данные',connecting:'подключается',needs_review:'нужна проверка',not_activated:'не подключено',disabled:'выключено',paused:'приостановлено'};
 return [['Market','market_source'],['LIS','lis_source']].map(([name,key])=>{
  const source=packet[key]||{},age=Date.now()-new Date(source.observed_at).getTime();
  const label=source.state==='receiving'&&(!Number.isFinite(age)||age>120000||age<0)?'нет свежего подтверждения потока':labels[source.state]||'статус неизвестен';
  return name+': '+label;
 }).join('; ')+'. Потоки объявлений частичные.';
}

function snapshotSummary(packet,now=Date.now()){
 const stamp=Date.parse(packet.public_snapshot_at);
 if(!Number.isFinite(stamp)||stamp>now)return 'Время снимка не подтверждено.';
 const minutes=Math.floor((now-stamp)/60000);
 const elapsed=minutes<1?'меньше минуты назад':minutes<60?minutes+' мин назад':
  minutes<1440?Math.floor(minutes/60)+' ч '+minutes%60+' мин назад':Math.floor(minutes/1440)+' дн. назад';
 const labels={receiving:'принимал данные',receiving_no_selected_candidate:'принимал поток',connecting:'подключался',
  needs_review:'требовал проверки',capacity_wait:'ждал места в базе',paused_by_owner:'был на паузе',
  disabled:'был выключен',not_activated:'не был подключён'};
 const sources=[['Market',packet.market_source],['LIS',packet.lis_source]].map(([name,source])=>{
  const seen=Date.parse(source?.observed_at);
  const label=!Number.isFinite(seen)||seen>stamp?'нет подтверждённого статуса':
   ['receiving','receiving_no_selected_candidate'].includes(source.state)&&stamp-seen>120000?'нет свежей квитанции':labels[source.state]||'статус неизвестен';
  return name+' — '+label;
 });
 return 'Снимок '+date(packet.public_snapshot_at)+' · '+elapsed+'. На момент снимка '+sources.join(', ')+'.';
}

function suggestions(){const matches=searchNames($('skinSearch').value);state.suggestions=matches.slice(0,40);state.suggestIndex=-1;$('suggestions').replaceChildren();for(const s of state.suggestions){let b=button(title(s),()=>selectSkin(s));b.setAttribute('role','option');b.append(node('small',s+' · '+(D.active[s.toLowerCase()]?'Текущий каталог':'Исследовательский архив')));$('suggestions').append(b);}if(!matches.length)$('suggestions').append(node('div','Не найдено. Попробуй название оружия или раскраски.','search-empty'));$('suggestions').hidden=false;$('skinSearch').setAttribute('aria-expanded','true');}
function closeSuggest(){$('suggestions').hidden=true;$('skinSearch').setAttribute('aria-expanded','false');}
function seedButton(seed){let b=button('#'+seed,()=>selectSeed(seed),'seed-button'+(state.seed===seed?' selected':''));b.setAttribute('aria-pressed',String(state.seed===seed));if(!(D.active[state.skin.toLowerCase()]||[]).includes(seed)){b.classList.add('inactive');b.title='Исследовательский номер; не включён в текущий поиск';}return b;}
function seedList(seeds){let div=node('div',undefined,'numbers');for(let s of seeds)div.append(seedButton(s));return div;}


// One V2 projection. A scope or revision change invalidates successful and
// failed requests; late replies cannot replace the current selection.
let catalogueGeneration=0,cataloguePending=null;
function useFX(packet){const checked=Date.parse(packet?.fx?.checked_at);if(FXCheckedAt!==-Infinity&&(!Number.isFinite(checked)||checked<FXCheckedAt))return;FX=packet?.fx?.state==='fresh'?(packet.fx.rates||{}):{};if(Number.isFinite(checked))FXCheckedAt=checked;}
function scopeQuery(){let wear=$('wear').value;return new URLSearchParams({item:state.skin,wear:wear.startsWith('cap:')?'FN':wear,seed:state.seed===null?'':state.seed,variant:$('variant').value,older:state.older?'1':'0'});}
async function loadSavedCatalogue(){
 const query=scopeQuery(),key=query.toString()+'|'+state.catalogueRevision;
 if(state.catalogueKey===key||cataloguePending===key)return;
 const previousCatalogue=state.catalogue,generation=++catalogueGeneration;cataloguePending=key;state.catalogueKey=null;state.catalogue=null;state.catalogueError=null;D.asks=[];D.sales=[];
 try{const res=await AtlasSnapshot.fetch('/atlas/api/v2/catalogue?'+query,{cache:'no-store'}),v=await res.json();
  if(!res.ok||v.schema!=='atlas_v2_catalogue_v1'||v.item!==query.get('item')||v.wear!==query.get('wear')||v.variant!==query.get('variant')||v.seed!==query.get('seed')||!Array.isArray(v.sales)||v.sales.length>100||v.old_archive_mixed!==false)throw Error('v2_catalogue_rejected');
  if(generation!==catalogueGeneration||scopeQuery().toString()!==query.toString())return;
  const prior=previousCatalogue,sameHistory=prior&&prior.item===v.item&&prior.wear===v.wear&&prior.variant===v.variant&&prior.seed===v.seed&&(prior.history_revision??prior.revision)===(v.history_revision??v.revision);if(sameHistory&&prior.sales.length>v.sales.length){const keep=new Map([...prior.sales,...v.sales].map(r=>[r.id,r]));v.sales=[...keep.values()];v.next_offset=prior.next_offset;}useFX(v);state.catalogue=v;state.catalogueKey=key;D.asks=v.asks;D.sales=v.sales;renderCatalogue();if(state.tab==='findings')renderFinding();
 }catch{if(generation===catalogueGeneration){state.catalogueError='Данные выбранной категории недоступны. Отсутствие записей не подтверждено.';$('connectionNote').textContent=state.catalogueError;renderCatalogue();if(state.tab==='findings')renderFinding();}}
 finally{if(generation===catalogueGeneration){cataloguePending=null;settleCatalogueAnchor();}}
}
async function nextHistoryPage(){const v=state.catalogue;if(!v||v.next_offset===null)return;
 const query=scopeQuery(),original=query.toString();query.set('offset',v.next_offset);const generation=catalogueGeneration;
 try{const res=await AtlasSnapshot.fetch('/atlas/api/v2/catalogue?'+query,{cache:'no-store'}),next=await res.json();
  if(!res.ok||next.schema!=='atlas_v2_catalogue_v1'||(next.history_revision??next.revision)!==(v.history_revision??v.revision)||next.item!==query.get('item')||next.wear!==query.get('wear')||next.variant!==query.get('variant')||next.seed!==query.get('seed')||next.old_archive_mixed!==false||!Array.isArray(next.sales)||next.sales.length>100)throw Error('history_revision_changed');
  if(generation!==catalogueGeneration||scopeQuery().toString()!==original)return;
  const byId=new Map([...D.sales,...next.sales].map(r=>[r.id,r]));D.sales=[...byId.values()];state.catalogue={...next,sales:D.sales};renderCatalogue();if(state.tab==='findings')renderFinding();
 }catch{state.catalogueKey=null;toast('История изменилась или недоступна. Загружается актуальный срез.');loadSavedCatalogue();}
}
function historyCoverage(){const v=state.catalogue;if(!v)return node('p',state.catalogueError||'Загружаются данные выбранной категории…','muted');
 const box=node('div',undefined,'notice'),reported=v.reported_history;box.append(node('p',(v.wear||'Любой износ')+' · '+v.total_sales+' записей истории · '+v.display_sales+' в выбранном окне · '+D.sales.length+' загружено. Покрытие: '+(v.total_sales?'неполное':'ещё не подтверждено')+'.'));if(reported&&(reported.reported_origin_facts||reported.unverified_reference_records))box.append(node('p','Прямые продажи CSFloat: '+reported.direct_qualified_sales+'. История SkinFlow: '+reported.reported_visible_sales+' продаж по сообщению источника и '+reported.unverified_reference_records+' непроверенных записей. Совпадающие ID показаны один раз с приоритетом прямого источника. К истории расчёта допущено: '+reported.reported_qualified_sales_added+'. Конкретное N зависит от выбранного окна; непроверенные и аукционные записи вне расчёта.','muted'));
 if(!v.wear)box.append(node('p','Показ всех сохранённых качеств. Контрольные продажи и расчёты остаются раздельными по износу. Для заявки выбери точный износ.','muted'));
 if(v.contexts?.length){box.append(button(state.older?'Показать последние 2 месяца':'Показать всю сохранённую историю',()=>{state.older=!state.older;state.catalogueKey=null;renderCatalogue();}));if(v.next_offset!==null)box.append(button('Загрузить ещё до 100 продаж',nextHistoryPage));}
 if($('wear').value.startsWith('cap:'))box.append(node('p','Заявка относится ко всему FN; выбранный диапазон флоата фильтрует только показ.','muted'));
 box.append(node('p',v.offers_state==='partial_stream'?'Подключённые площадки: неполный поток наблюдений. Цена и наличие относятся ко времени наблюдения; доступность покупки не подтверждена.'+(v.has_more_asks?' Показаны первые 300 сохранённых предложений.':''):'Предложения ещё не подключены. Пустая таблица не означает отсутствия рынка.','muted'));return box;
}

// Proposal fragment for the existing Atlas image selector, not a second runtime.
// No HTTP, timer, DOM, store, catalogue fetch or publication authority.
function visualReference(ctx, side, data) {
  if (!Number.isInteger(ctx.def_index) || !Number.isInteger(ctx.paint_index) ||
      !Number.isInteger(ctx.seed) || !['Front','Back','Top','Butt'].includes(side))
    return {kind:'missing', reason:'invalid_reference_identity'};
  const phase=ctx.phase ?? '';
  const descriptors=Object.entries(data.descriptor_bindings).filter(([,b]) =>
    b.item===ctx.item && b.def_index===ctx.def_index && b.paint_index===ctx.paint_index && b.phase===phase
  ).map(([name])=>name);
  for (const descriptor of descriptors) {
    const key=`${descriptor}/${side}/${ctx.seed}`;
    const path=data.exact_images[key];
    if (path) return {kind:'exact_seed_reference',image_key:key,
      url:'assets/'+path,seed:ctx.seed,side,
      current_object_or_wear_photo:false,price_authority:false};
  }
  const generic=data.generic_images[`${ctx.def_index}:${ctx.paint_index}:${phase}`];
  if (generic && generic.item===ctx.item) return {kind:'model_generic',url:generic.url,
    seed:null,side:null,caption:'Общий вид скина — не изображение выбранного seed',
    current_object_or_wear_photo:false,seed_comparison_allowed:false,price_authority:false};
  return {kind:'missing',reason:'no_exact_or_model_generic_reference'};
}

function imageReference(g,seed,view){const b=D.descriptor_bindings[g.descriptor];if(!b||b.item!==g.skin)return {kind:'missing'};return visualReference({...b,seed},view,{exact_images:D.images,descriptor_bindings:D.descriptor_bindings,generic_images:D.generic_images});}
function imageURL(g,seed,view){const ref=imageReference(g,seed,view);return ref.kind==='exact_seed_reference'?ref.url:null;}
function picture(g,seed,view){const ref=imageReference(g,seed,view);if(ref.kind==='missing')return node('div','Оригинал этого ракурса пока не сохранён','missing');const img=node('img');img.src=ref.url;img.loading='lazy';img.onerror=()=>img.replaceWith(node('div','Изображение недоступно','missing'));if(ref.kind==='model_generic'){img.alt=ref.caption;const figure=node('figure');figure.append(img,node('figcaption',ref.caption,'muted'));return figure;}img.alt=title(g.skin)+' · #'+seed+' · '+view;img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Увеличить '+img.alt);img.onclick=()=>openImage(g,seed,view);img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openImage(g,seed,view);}};return img;}
function openImage(g,seed,view){state.preview={g,seed,view};const src=imageURL(g,seed,view);if(!src){toast('Оригинал этого ракурса пока не сохранён.');return;}$('largeImage').src=src;$('largeImage').alt=title(g.skin)+' · #'+seed+' · '+(view==='Front'?'Лицевая сторона':'Обратная сторона');$('imageCaption').textContent=$('largeImage').alt;for(const [id,v] of [['imageFront','Front'],['imageBack','Back']]){$(id).disabled=!imageURL(g,seed,v);$(id).classList.toggle('primary',v===view);}if(!$('imageDialog').open)$('imageDialog').showModal();}
function renderTile(g,seed,view=state.view){let box=node('div',undefined,'render'+(state.seed===seed?' selected':''));let h=node('div',undefined,'render-head');let main=button('#'+seed,()=>selectSeed(seed),'seed-main');main.setAttribute('aria-label','Выбрать паттерн '+seed);const compare=button('+ Сравнить',()=>addCompare(g,seed),'tiny');compare.disabled=imageReference(g,seed,view).kind!=='exact_seed_reference';if(compare.disabled)compare.title='Для общего вида сравнение seed недоступно';h.append(main,compare);box.append(h,picture(g,seed,view),node('span',imageReference(g,seed,view).kind==='model_generic'?'Общий вид':view==='Front'?'Лицевая сторона':'Обратная сторона','view-label'));return box;}
function addCompare(g,seed){if(imageReference(g,seed,'Front').kind!=='exact_seed_reference'&&imageReference(g,seed,'Back').kind!=='exact_seed_reference'){toast('Общий вид не участвует в сравнении seed.');return;}if(state.compare.some(x=>x.skin===g.skin&&x.seed===seed))return;if(state.compare.length>=2)state.compare.shift();state.compare.push({skin:g.skin,seed,group:g.id});renderCompareTray();}
function renderCompareTray(){$('compareTray').hidden=!state.compare.length;$('compareLabel').textContent=state.compare.map(r=>'#'+r.seed).join(' ↔ ');}
function openCompare(){$('compareContent').replaceChildren();for(const x of state.compare){let g=D.groups.find(g=>g.id===x.group);let c=node('div');c.append(node('h3',title(x.skin)+' · #'+x.seed));for(const v of ['Front','Back'])c.append(picture(g,x.seed,v),node('p',v==='Front'?'Лицевая сторона':'Обратная сторона','muted'));c.append(button('Открыть цены и историю',()=>{$('compareDialog').close();selectSeed(x.seed,x.skin);setTab('findings');}));$('compareContent').append(c);}$('compareDialog').showModal();}
function allAsks(){return D.asks.filter(r=>['current','recent_observed_ask'].includes(r.status)&&new Date(r.valid_until)>Date.now());}
function decimalCompare(a,b){let sa=String(a),sb=String(b);if(!/^\d+(\.\d+)?$/.test(sa)||!/^\d+(\.\d+)?$/.test(sb))return null;let [ai,af='']=sa.split('.'),[bi,bf='']=sb.split('.'),len=Math.max(af.length,bf.length);let av=BigInt(ai+af.padEnd(len,'0')),bv=BigInt(bi+bf.padEnd(len,'0'));return av<bv?-1:av>bv?1:0;}
function matchesWear(r,value=$('wear').value){if(!value)return true;if(!value.startsWith('cap:'))return r.wear===value;if(r.wear!=='FN'||r.float_text==null)return false;let upper=value.slice(4),lower={'0.0001':'0','0.001':'0.0001','0.01':'0.001'}[upper];if(lower===undefined)return false;let lo=decimalCompare(r.float_text,lower),hi=decimalCompare(r.float_text,upper);if(lo===null||hi===null)return false;if(decimalCompare(r.float_text,'0')===0&&r.float_precision_mode!=='exact')return false;return (lower==='0'?lo>=0:lo>0)&&hi<=0;}
function inConfirmation(r,now=Date.now()){
 const observed=Date.parse(r.observed_at),until=Date.parse(r.valid_until);
 return Number.isFinite(observed)&&observed<=now&&Number.isFinite(until)&&until>now;
}
function expiredSnapshotOffer(r){return r.snapshot_offer===true&&!inConfirmation(r);}
function groupOffers(packet,mode,now=Date.now()){
 const current=packet.asks||[],observed=mode==='latest'?[...current,...(packet.best_observed_asks||[])]:current.filter(r=>inConfirmation(r,now));
 return [...new Map(observed.filter(r=>!r.historical_only&&['recent_observed_ask','older_observed_ask'].includes(r.status))
  .map(r=>[r.id,{...r,snapshot_offer:true}])).values()];
}
function filterRows(rows,g,options={}){return rows.filter(r=>(options.includeExpiredSnapshotOffers&&r.snapshot_offer===true||!r.valid_until||new Date(r.valid_until)>Date.now())&&r.skin===g.skin&&g.seeds.includes(Number(r.seed))&&r.variant===$('variant').value&&matchesWear(r)&&(!options.venue||r.venue===options.venue)&&(!options.clean||r.accessory_state==='verified'&&!r.accessory_present)&&(!options.seed||Number(r.seed)===state.seed));}
function sortValue(r,key){
 if(key==='price') {if(r.price==null)return null;if(!FX[r.currency])return r.currency+':'+String(r.price).padStart(24,'0');if(r.currency==='RUB')return Number(r.price);const f=FX[r.currency],c=f&&rubCents(r.price,f.rub_per_unit);return c===null||c===undefined?null:Number(c)/100;}
 if(key==='ingestion_sequence')return BigInt(r.ingestion_sequence);
 if(key==='seed')return r.seed===null||r.seed===undefined?null:Number(r.seed);
 if(key==='float_text')return r.float_text==null?null:Number(r.float_text);
 if(key==='observed_at'||key==='known_at'||key==='sold_at'){const n=new Date(r[key]).getTime();return Number.isFinite(n)?n:null;}
 return r[key]??null;
}
function sortedRows(rows,sort){return [...rows].sort((a,b)=>{if(sort.key==='price'&&a.price!=null&&b.price!=null){const cmp=a.currency.localeCompare(b.currency)||decimalCompare(a.price,b.price)||0;return sort.dir==='asc'?cmp:-cmp;}let av=sortValue(a,sort.key),bv=sortValue(b,sort.key);if(av===null)return bv===null?String(a.id).localeCompare(String(b.id)):1;if(bv===null)return -1;let cmp=typeof av==='bigint'?(av<bv?-1:av>bv?1:0):typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'ru');if(cmp)return sort.dir==='asc'?cmp:-cmp;return String(a.id).localeCompare(String(b.id));});}
function rowsTable(input,historyRows=false,max=10,sort=state.tableSort||{key:'observed_at',dir:'desc'},feedMode=false,tableView=null){
 if(tableView){max=tableView.limit;sort=tableView.sort||sort;}
 if(!input.length&&!feedMode&&!state.catalogue)return node('div',state.catalogueError||'Данные выбранной категории загружаются…','muted');
 if(!input.length)return node('div',historyRows?'В полученной истории нет записей для этих условий.':feedMode?'Записей с такими условиями в полученных данных нет.':'Объявлений с такими условиями в полученных данных нет.','empty');
 if(historyRows&&sort.key==='observed_at')sort={...sort,key:'sold_at'};let rows=sortedRows(input,sort),wrap=node('div',undefined,'table-wrap'),t=node('table'),head=node('thead'),tr=node('tr');
 const columns=[['venue',feedMode?'Площадка / скин':'Площадка'],[historyRows?'sold_at':feedMode?'ingestion_sequence':'observed_at',historyRows?'Дата продажи¹':feedMode?'В базе / замечено':'Замечено'],['seed','Паттерн'],['float_text','Флоат / износ'],['price','Цена'],[null,'Состояние'],[null,'Ссылка']];
 for(const [key,label]of columns){let th=node('th');if(key){let active=sort.key===key;th.setAttribute('aria-sort',active?(sort.dir==='asc'?'ascending':'descending'):'none');let b=button(label+' '+(active?(sort.dir==='asc'?'↑':'↓'):'↕'),()=>{let next={key,dir:active&&sort.dir==='asc'?'desc':'asc'};if(feedMode){state.feedSort=next;save('feedSortV2',next);}else{state.tableSort=next;save('tableSort',next);}if(tableView)tableView.sort=next;wrap.replaceWith(rowsTable(input,historyRows,max,next,feedMode,tableView));},'sort-button');if(tableView)b.dataset.atlasFocus=tableView.key+'|sort:'+key;b.title='Сортировать по '+label.toLowerCase()+(key==='price'?' в исходной валюте, валюты отдельно':'');th.append(b);}else th.textContent=label;tr.append(th);}head.append(tr);t.append(head);
 let body=node('tbody');for(const r of rows.slice(0,max)){
  let tr=node('tr'),source=node('td');if(feedMode)source.append(button(feedVenueLabel(r.venue)+' · '+title(r.skin),()=>openFeedPattern(r),'tiny'));else source.textContent=r.venue;
  let timeCell=node('td',date(historyRows?r.sold_at:feedMode?r.known_at:r.observed_at));if(historyRows){timeCell.append(node('div',(r.reported_reference?'Получено источником: ':'Получено: ')+date(r.observed_at),'muted'));if(r.reported_reference){timeCell.append(node('div','Добавлено в Atlas: '+date(r.imported_at),'muted'));if(r.admitted_at)timeCell.append(node('div','Допущено к расчёту: '+date(r.admitted_at),'muted'));if(r.reported_raw_date!=null)timeCell.append(node('div','Дата в источнике: '+String(r.reported_raw_date),'muted'));}}if(feedMode)timeCell.append(node('div',(r.kind==='ask'?'Замечено: ':'Продано: ')+date(r.observed_at),'muted'));tr.append(source,timeCell);let seed=node('td');if(r.seed===null||r.seed===undefined)seed.textContent='Не указан';else seed.append(button('#'+r.seed,()=>feedMode?openFeedPattern(r):selectSeed(r.seed,r.skin),'seed-button'+(state.seed===Number(r.seed)?' selected':'')));
  const floatCell=node('td',(r.float_display??r.float_text??'Не указан')+' · '+r.wear,'float');floatCell.title=r.float_text??'';tr.append(seed,floatCell,priceCell(r));
  let st=node('td');if(!r.snapshot_offer||historyRows)st.append(node('span',r.status==='reported_material_conflict_review'?'Конфликт с прямыми данными CSFloat · вне расчёта':r.status==='unverified_history_reference'?'Запись SkinFlow · продажа не подтверждена':r.reported_reference?(r.qualified_for_pricing?'SkinFlow сообщает о продаже · допущена к расчёту':'SkinFlow сообщает о продаже · справочно'):historyRows||feedMode&&r.kind==='sale'?'Источник сообщает о продаже':age(r.observed_at),historyRows||feedMode&&r.kind==='sale'?'muted':((Date.now()-new Date(r.observed_at))<900000?'fresh':'old')));
  if(r.reported_reference&&r.sale_type)st.append(node('div',r.sale_type==='auction'?'Аукцион · вне расчёта':(r.qualified_for_pricing?'Продажа по фиксированной цене · история расчёта':'Продажа по фиксированной цене · справочно'),'muted'));if(r.reported_reference&&!r.qualified_for_pricing)st.append(node('div','Не включено в расчёт количества продаж','muted'));if(r.accessory_state==='unknown')st.append(node('div','Аксессуары: нет точных данных','muted'));else if(r.accessory_present)st.append(node('div',r.reported_reference?'Источник сообщает об аксессуарах':'Аксессуары · учитывать как конкурента','muted'));
  if(!historyRows&&r.snapshot_offer){
   const until=Date.parse(r.valid_until),confirmed=inConfirmation(r);
   st.append(node('div',!Number.isFinite(until)?'Срок подтверждения неизвестен':confirmed?'Подтверждение до '+date(r.valid_until):'Подтверждение истекло '+date(r.valid_until),'old'));
   st.append(node('div','Наличие сейчас не проверено','muted'));
  }if(!historyRows&&r.status==='owner_bought')st.append(node('div','Выкуплен владельцем · архив','old'));if(!historyRows&&['removed','missing','inactive','disappeared'].includes(r.status))st.append(node('div','Лот недоступен по последней записи','old'));
  if(!historyRows)st.append(node('div',r.origin==='manual'?'Ручное наблюдение':r.origin==='live_core'?'Новая запись базы':r.origin==='reference_api_snapshot'?'Справочник CSFloat':'Срез базы','muted'));tr.append(st);let a=node('td');let label=r.reported_reference?'Запись источника SkinFlow':r.price_link_kind==='atlas_pattern_history'?'История паттерна в Atlas':historyRows?(r.display_link_kind==='item_history'?'Страница лота':'Источник продажи'):r.display_link_kind==='exact_lot'?'Открыть лот':r.display_link_kind==='filtered_lots'?'Найти по фильтрам':r.display_link_kind==='item_page'?'Открыть этот скин':'Ссылка недоступна';let target=expiredSnapshotOffer(r)?node('span','Сохранённое наблюдение','muted'):link(label,r.price_url??r.display_url);if(r.display_link_kind==='filtered_lots'&&!expiredSnapshotOffer(r))target.title='Фильтр для поиска экземпляра; сверь seed, float и ID с этой строкой';a.append(target);if(!historyRows&&r.external_id)a.append(node('div','ID '+r.external_id,'muted'));if(historyRows&&r.reported_reference&&r.external_id)a.append(node('div','Заявленный ID CSFloat: '+r.external_id,'muted'));tr.append(a);body.append(tr);
 }t.append(body);wrap.append(t);if(rows.length>max){wrap.append(node('p','Показано '+max+' из '+rows.length+'. Сортировка учитывает все '+rows.length+' строк.','muted'),button('Показать ещё 50',()=>{if(tableView)tableView.limit=max+50;wrap.replaceWith(rowsTable(input,historyRows,max+50,sort,feedMode,tableView));}));}return wrap;
}

function groupsForSkin(skin){let groups=D.groups.filter(g=>g.skin===skin);if(groups.length)return groups;let seeds=[...new Set(allAsks().filter(r=>r.skin===skin&&r.seed!=null).map(r=>Number(r.seed)))].sort((a,b)=>a-b);if(!seeds.length)return [];return [{id:'unclassified:'+skin,item_key:skin.toLowerCase(),skin,descriptor:'',title_ru:'Поступления вне классифицированного каталога',seeds,active:false,active_seeds:[],source_family_claims:[],visual_criteria_ru:'Эти предметы видны в новой ленте, но визуальные группы для них ещё не подготовлены. Здесь показаны только полученные записи.'}];}
function renderCatalogue(){const viewport=state.catalogueAnchor||catalogueViewport(),reveal=!!state.catalogueReveal;loadSavedCatalogue(state.skin);writeHash();$('skinSearch').value=title(state.skin);$('favorite').textContent=state.favorites.includes(state.skin)?'★':'☆';$('favorite').setAttribute('aria-pressed',String(state.favorites.includes(state.skin)));$('favorite').setAttribute('aria-label',state.favorites.includes(state.skin)?'Убрать скин из избранного':'Добавить скин в избранное');let all=groupsForSkin(state.skin);let groups=all.filter(g=>($('archive').checked||D.active[state.skin.toLowerCase()])&&(state.seed===null||g.seeds.includes(state.seed)));$('scopeSummary').textContent=(state.dashboard?.history?.scopes??'—')+' категорий · '+(state.dashboard?.counts?.configured_contexts??'—')+' настроенных контекстов; это не покрытие рынка';$('skinIntro').replaceChildren();let intro=node('div',undefined,'skin-heading'),name=node('div');name.append(node('h2',title(state.skin)),node('div',state.skin,'muted'));intro.append(name);let side=node('div');side.append(button(state.view==='Front'?'↺ Обратная сторона':'↺ Лицевая сторона',()=>{state.view=state.view==='Front'?'Back':'Front';renderCatalogue();}));side.append(wholeSkinControl());intro.append(side);$('skinIntro').append(intro,historyCoverage(),historyRoles());$('groupCards').replaceChildren();if(state.seed!==null){let p=node('p','Выбран #'+state.seed+' · '+groups.length+' групп','muted');p.append(button('Сбросить номер',()=>{state.seed=null;$('seedInput').value='';renderCatalogue();},'tiny'));$('skinIntro').append(p);}for(const g of groups)renderGroup(g);if(!groups.length){let x=node('div','Этот номер не включён в показанные группы. Это не доказывает, что он обычный или дешёвый.','empty');if(!$('archive').checked)x.append(button('Посмотреть исследовательские группы',()=>{$('archive').checked=true;renderCatalogue();}));$('groupCards').append(x);}renderLegacyArchive();$('groupCards').dataset.selection=scopeQuery().toString();if(reveal)revealCataloguePattern();else restoreCatalogueViewport(viewport);}
function historyRoles(){
 const box=node('section',undefined,'history-roles');const roles=state.catalogue?.history_roles||[];
 box.append(node('h3','Исторические контрольные продажи'),node('p','До 5 дешёвых наблюдавшихся продаж без подтверждённых аксессуаров за 14 дней. Средняя область float разделена на три диапазона; это рабочее правило сравнения, рыночная граница не доказана. Текущие предложения сюда не входят.','muted'));
 if(!roles.length){box.append(node('p',!state.catalogue?(state.catalogueError||'Загружаются контрольные продажи…'):'Контрольные продажи для выбранной разновидности ещё не подключены.'));return box;}
 for(const r of roles){
  box.append(node('h4','Износ: '+r.scope.wear));
  if(r.state==='not_observed'){box.append(node('p','Контрольные продажи ещё не получены новым чтением истории; их отсутствие на рынке не подтверждено.'));continue;}
  box.append(node('p','Контрольных продаж: '+r.ordinary.length+' из максимум 5 · данные приняты '+date(r.knowledge_as_of)+' · покрытие частичное','muted'));
  if(r.float_support?.qualification!=='central_float_heuristic')box.append(node('p','Диапазон float не квалифицирован. Сравнение неизвестно.','muted'));
  for(const e of r.ordinary)box.append(node('p','#'+e.seed+' · '+price({price:e.display_price??String(e.price_minor/100),currency:'USD'})+' · float '+(e.float_display??e.float_text)+' · продан '+date(e.sold_at)+' · продажа '+e.sale_id));
  box.append(node('h3','На изучение · '+r.discovery.length+' из максимум 10'),node('p','Цена от 1,4 медианы 1–5 доступных исторических контролей того же диапазона float. Премия за паттерн не подтверждена; в поиск и сигналы записи не добавляются.','muted'));
  const labels={review_unexplained_under_declared_exclusions:'Причина разницы не установлена',review_accessories_unknown:'Аксессуары неизвестны',review_accessories_present:'Есть аксессуары'};
  for(const w of r.discovery){const e=r.events[w.event_id],b=w.baseline,card=node('details');card.append(node('summary','#'+e.seed+' · '+price({price:e.display_price??String(e.price_minor/100),currency:'USD'})+' · '+(labels[w.status]||'Нужна проверка')),node('p','Продажа '+e.sale_id+' · float '+(e.float_display??e.float_text)+' · продан '+date(e.sold_at)+' · наблюдение до '+date(w.expires_at)),node('p','Контролей N = '+b.N+' · медиана '+price({price:b.display_price??String(b.numerator/b.denominator/100),currency:'USD'})+' · продажи: '+b.input_ids.join(', ')),node('p','Конец окна продаж контролей: '+date(b.control_window_end)+' · сравнение стало известно '+date(b.knowledge_as_of),'muted'));box.append(card);}
  const d=r.diagnostics;box.append(node('p','В последнем окне вне центральной области float: '+d.float_heuristic_excluded+'; аксессуары неизвестны: '+d.accessory_unknown+'; без подходящих контролей: '+d.discovery_base_unknown+'. Это неполная выборка, глубина и следующие страницы неизвестны.','muted'));
 }
 return box;
}
function groupDataQuery(g){const q=scopeQuery();q.set('seed','');q.set('group',g.id);return q;}
async function loadGroupData(g,view,nextPage=false){
 const query=groupDataQuery(g),scope=query.toString(),key=scope+'|'+state.catalogueRevision;
 if(view.dataPending||(!nextPage&&view.dataKey===key))return;
 const previous=view.packet,offset=nextPage?previous?.next_offset:null;if(nextPage&&offset==null)return;
 if(nextPage)query.set('offset',offset);view.dataPending=true;view.dataError=null;const token=(view.dataGeneration||0)+1;view.dataGeneration=token;
 try{const response=await AtlasSnapshot.fetch('/atlas/api/v2/catalogue?'+query,{cache:'no-store'}),v=await response.json();
  if(!response.ok||v.schema!=='atlas_v2_catalogue_v1'||v.group_scope?.id!==g.id||v.group_scope?.display_only!==true||v.item!==g.skin||v.wear!==query.get('wear')||v.variant!==query.get('variant')||v.seed!==''||!Array.isArray(v.sales)||v.sales.length>100||v.old_archive_mixed!==false)throw Error('group_scope_unqualified');
  if(token!==view.dataGeneration||groupDataQuery(g).toString()!==scope)return;
  const same=previous&&previous.group_scope?.ref===v.group_scope.ref&&(previous.history_revision??previous.revision)===(v.history_revision??v.revision);
  if(nextPage&&!same)throw Error('group_history_changed');
  if(nextPage||same&&previous.sales.length>v.sales.length){v.sales=[...new Map([...previous.sales,...v.sales].map(r=>[r.id,r])).values()];if(!nextPage)v.next_offset=previous.next_offset;}
  view.packet=v;view.dataScope=scope;view.dataKey=key;renderCatalogue();
 }catch{if(token===view.dataGeneration)view.dataError='История группы сейчас не подтверждена. Отсутствие продаж не установлено.';}
 finally{if(token===view.dataGeneration){view.dataPending=false;settleCatalogueAnchor();}}
}
function renderGroup(g){
 const view=groupView(g);loadGroupData(g,view);
 let box=node('article',undefined,'group-card'+(state.seed!==null?' selected-group':''));box.dataset.group=g.id;
 let header=node('div',undefined,'section-head'),h=node('div');h.append(node('h2',ru(g.title_ru)));
 h.append(node('span',g.active?'Есть номера текущего поиска':'Исследовательский архив','badge'+(g.active?'':' archive')));
 if(g.blue_selected)h.append(node('span','Blue Gem · отдельный список','badge blue'));
 h.append(node('span','Равная цена группы не доказана','badge amber'));header.append(h);box.append(header,node('p',ru(g.visual_criteria_ru),'criteria'));
 let renders=node('div',undefined,'renders');
 if(state.seed===null){for(const seed of g.seeds.slice(0,3))renders.append(renderTile(g,seed));}
 else{for(const side of ['Front','Back'])renders.append(renderTile(g,state.seed,side));}
 box.append(renders);
 let det=node('details'),selected=state.seed!==null?' · выбран #'+state.seed:'';
 det.append(node('summary','Все '+g.seeds.length+' номеров и исходные тиры'+selected));
 bindDisclosure(det,view,'seeds',state.seed!==null);det.append(seedList(g.seeds));
 for(const [index,f]of(g.source_family_claims||[]).entries()){
  let claim=node('details',undefined,'source-claim');
  claim.append(node('summary',ru(f.group||'Исходная группа')+' · '+ru(String(f.tier||'Тир не указан').replaceAll('Tier','Тир').replaceAll('T1','Тир 1').replaceAll('T2','Тир 2').replaceAll('T3','Тир 3').replaceAll('Blue Mountains','Голубые горы').replaceAll('Orange Sun','Оранжевое солнце'))));
  bindDisclosure(claim,view,'claim:'+index,state.seed!==null&&(f.overlap_seeds||[]).includes(state.seed));
  claim.append(seedList(f.overlap_seeds||[]));if(f.url)claim.append(link('Исходная классификация',f.url));det.append(claim);
 }
 box.append(det);
 const type=view.tab;
 let tabs=node('div',undefined,'price-tabs'),area=node('div');
 const refresh=()=>{if(!area.isConnected){view.offerExpiry=null;return;}const active=document.activeElement,inside=area.contains(active),focus=inside?active.closest('[data-atlas-focus]')?.dataset.atlasFocus:null;
  const left=area.querySelector('.table-wrap')?.scrollLeft??0;
  const viewport=catalogueViewport();update();
  const table=area.querySelector('.table-wrap');if(table)table.scrollLeft=left;
  if(inside&&(!focus||!area.querySelector('[data-atlas-focus="'+CSS.escape(focus)+'"]')))modes.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  restoreCatalogueViewport(viewport);
 };
 for(const [value,label]of[['ask','Предложения'],['history','История продаж']]){
  tabs.append(groupControl(button(label,()=>{view.tab=value;renderCatalogue();},value===type?'active':''),view,'tab:'+value));
 }
 let quotes=node('details');quotes.append(node('summary','Предложения и история этой группы'),tabs);
 bindDisclosure(quotes,view,'quotes',state.seed!==null);
 let filters=node('div',undefined,'filters'),venue=groupControl(node('select'),view,'venue');venue.setAttribute('aria-label','Площадка группы');
 venue.append(new Option('Все площадки',''));for(const v of [...new Set([...venues,...(view.packet?.sales||D.sales).map(r=>r.venue)])])venue.append(new Option(feedVenueLabel(v),v));
 let only=groupControl(node('input'),view,'only');only.type='checkbox';only.disabled=state.seed===null;
 let label=node('label','Только выбранный номер ');label.append(only);
 let clean=groupControl(node('input'),view,'clean');clean.type='checkbox';let cl=node('label','Без аксессуаров ');cl.append(clean);
 filters.append(venue,label,cl);
 venue.value=view.filters.venue;only.checked=view.filters.seed&&state.seed!==null;clean.checked=view.filters.clean;
 const modes=node('div',undefined,'offer-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Срок подтверждения предложений');
 if(type==='ask')for(const [value,caption] of [['confirmed','В сроке подтверждения'],['latest','Последние наблюдения']]){
  const control=groupControl(button(caption,()=>{const viewport=catalogueViewport();view.offerMode=value;update();restoreCatalogueViewport(viewport);},'offer-mode'),view,'offers:'+value);
  control.dataset.offerMode=value;modes.append(control);
 }
 const update=()=>{
  view.filters={venue:venue.value,seed:state.seed!==null&&only.checked,clean:clean.checked};
  for(const control of modes.children){const active=control.dataset.offerMode===view.offerMode;control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));}
  const packet=view.dataScope===groupDataQuery(g).toString()?view.packet:null;if(!packet){area.replaceChildren(node('div',view.dataError||'Загружается история всей группы…','muted'));return;}
  const input=type==='history'?packet.sales:groupOffers(packet,view.offerMode);
  const rows=filterRows(input,g,{...view.filters,includeExpiredSnapshotOffers:type==='ask'&&view.offerMode==='latest'});
  rows.sort((a,b)=>(b.sold_at||b.observed_at).localeCompare(a.sold_at||a.observed_at));
  if(type==='ask'){
   const now=Date.now(),at=Math.min(Infinity,...rows.filter(r=>inConfirmation(r,now)).map(r=>Date.parse(r.valid_until)));
   view.offerExpiry=at===Infinity?null:{refresh,at};
  }
  if(type==='ask'&&view.offerMode==='confirmed'&&!rows.length){
   area.replaceChildren(node('div','В этом снимке нет предложений в сроке подтверждения для выбранных условий.','empty'));return;
  }
  area.replaceChildren(rowsTable(rows,type==='history',10,undefined,false,view.tables[type]));
  if(type==='history'){area.append(node('p','История группы: загружено '+packet.sales.length+' из '+packet.display_sales+' записей в выбранном окне. Фильтры действуют на загруженные страницы.','muted'));if(packet.next_offset!==null){const more=button(view.dataPending?'Загружается…':'Загрузить ещё до 100 продаж группы',()=>loadGroupData(g,view,true));more.disabled=!!view.dataPending;area.append(more);}}
  if(view.dataError)area.append(node('p',view.dataError,'muted'));
 };
 for(const element of[venue,only,clean])element.onchange=update;
 if(type!=='ask')view.offerExpiry=null;
 if(type==='ask')quotes.append(modes);
 quotes.append(filters,area);box.append(quotes);update();
 if(type==='history')quotes.append(node('p','¹ Время продажи источника показано отдельно от времени приёма. Расчёт продавцу не проверен. Исходная валюта сохранена; неподтверждённый курс не применяется.','muted'));
 let actions=node('div',undefined,'actions');
 actions.append(button('Подробная карточка',()=>{if(state.seed===null){toast('Выбери точный номер паттерна для карточки.');return;}setTab('findings');}),button('Скопировать ссылку',()=>copyLink(g)));
 box.append(actions);$('groupCards').append(box);
}
const venues=['Steam','CS.MONEY Market','Market.CSGO','LIS-SKINS','CSFloat'];

function wholeSkinKey(){return JSON.stringify([state.skin,$('variant').value]);}
function wholeSkinSave(){save('wholeSkinRequestsV1',wholeSkinRequests);}
function wholeSkinControl(){return node('p','Публичный снимок · только просмотр. Обновлением источников управляет прежнее приложение.','muted');}
function queueLabel(s){return ({queued:'в очереди',connected:'подключено',reading:'чтение',ready_capture:'приём данных',partial:'неполный проход завершён',paused_unknown:'неизвестный результат — повтор запрещён',action_unknown:'неизвестный результат',needs_review:'нужна проверка',paused_source:'сбор выключен',outside_activation_scope:'вне текущего запуска',interval_wait:'ожидание следующего прохода',quota_wait:'ожидание общей квоты',paused_window:'вне ночного окна',quota_reservation_unknown:'резерв квоты требует проверки'})[s]||s;}
function renderQueue(){const jobs=state.queueJobs||[];$('queueCount').textContent=jobs.filter(j=>j.manual_pending).length;$('queueList').replaceChildren();
 for(const j of jobs){const c=node('div',undefined,'queue-card');c.append(node('h3',title(j.scope.item)+' · '+j.scope.wear),node('span',queueLabel(j.state),'badge amber'),node('p','Следующий срок: '+date(j.next_due?j.next_due*1000:null),'muted'));if(j.blocked_ref)c.append(node('p','Сохранён прежний неизвестный результат. Повтор не выполняется.','muted'));$('queueList').append(c);}
 if(!jobs.length)$('queueList').append(node('div',state.connected?'Очередь ещё не настроена.':'Очередь недоступна; приём заявок не подтверждён.','empty'));
 for(const r of state.queue){const c=node('div',undefined,'queue-card');c.append(node('h3',title(r.skin)),node('span','Прежний локальный черновик · не отправлен','badge amber'),node('p','Износ: '+r.wear+' · номера: '+r.seeds.join(', ')),button('Удалить черновик',()=>{state.queue=state.queue.filter(q=>q.request_id!==r.request_id);save('queue',state.queue);renderQueue();}));$('queueList').append(c);}
}

function copyLink(){writeHash();if(navigator.clipboard?.writeText)navigator.clipboard.writeText(location.href).then(()=>toast('Ссылка скопирована')).catch(()=>toast('Адрес выбранного паттерна находится в строке браузера.'));else toast('Адрес выбранного паттерна находится в строке браузера.');}

function modelReason(reason){const reasons={above_ordinary_cap_2B:'цена выше допустимого предела',remaining_minimum_below_1_4P:'порог по истории продаж не достигнут',source_expired:'срок подтверждения предложения истёк',no_qualified_history:'в принятой локальной модели нет пригодных продаж',ordinary_rejected:'условия отбора не выполнены',notification_wear_not_enabled:'уведомления для этого покрытия и износа выключены',notification_purchase_below_1000_RUB:'покупка дешевле1000 ₽ для дополнительного износа',notification_floor_FX_unavailable:'для порога1000 ₽ нет пригодного текущего курса',category_fewer_than_three_peer_seeds:'в категории меньше трёх других сидов с пригодными продажами',three_other_peer_seed_medians_at_or_below_purchase:'найдены три других сида с медианами не дороже покупки',category_median_not_above_purchase:'ориентир категории не выше покупки',category_adjusted_value_below_1_4P:'итог W не достигает1,4 цены покупки',crosswear_current_FN_B_unavailable:'для переноса нет текущего обычного FN-ориентира B',crosswear_actual_FN_category_unavailable:'для переноса нет пригодной реальной FN-категории',crosswear_historical_ordinary_unqualified:'нет пригодного исторического обычного ориентира того же износа',crosswear_fewer_than_three_independent_donors:'для переноса меньше трёх независимых доноров одного износа',crosswear_fewer_than_three_clean_independent_donors:'для переноса меньше трёх независимых доноров без аксессуаров',qualified_category_adjusted_threshold:'порог W и защита категорией выполнены',exact_rarest_appearance:'появление exact-rarest без ценового подтверждения'};return reasons[reason]||'условия отбора не выполнены';}
function evaluationMessage(v){
 const h=v?.latest_evaluation;
 if(h?.state==='needs_review')return 'Последний расчёт требует проверки. Прежняя находка не считается текущей.';
 if(h?.state==='evidence_expired')return 'Срок хранения подробностей прежнего расчёта истёк. Текущая находка не подтверждена.';
 if(h?.disposition==='empty')return 'Последняя проверка: подходящих текущих предложений нет · '+date(h.checked_at)+'. Это не подтверждает отсутствие предложений на всём рынке.';
 if(h?.disposition==='transient'){
  const reasons={above_ordinary_cap_2B:'цена выше допустимого предела',remaining_minimum_below_1_4P:'порог по истории продаж не достигнут',source_expired:'срок подтверждения предложения истёк',no_qualified_history:'в принятой локальной модели нет пригодных продаж',ordinary_rejected:'условия отбора не выполнены'};
  return 'Последний расчёт: '+modelReason(h.last_reason)+' · '+date(h.checked_at)+'. Подробный архив этого отказа не сохраняется.';
 }
 return v&&!v.wear?'Выбери точный износ для расчётной модели.':'Новый расчёт для точного seed/износа ещё не подтверждён. Историческая наценка не подтверждена.';
}
function historicalMessage(h){
 if(h.evidence_state==='evidence_expired')return 'Срок хранения подробного архива истёк: '+date(h.expired_at)+' · исходная дата расчёта неизвестна. Справочная запись, не текущая находка.';
 return 'Последний подробный архив: '+(h.as_of?date(h.as_of):'дата расчёта неизвестна')+' · справочная запись, не текущая находка.';
}
function renderFinding(){loadSavedCatalogue();let g=groupsForSkin(state.skin).find(g=>g.seeds.includes(state.seed));$('findingContent').replaceChildren();if(!g){$('findingContent').append(node('div','Сначала выбери номер паттерна в каталоге или новой записи.','empty'));return;}
 const card=node('article',undefined,'finding');card.append(node('span','Карточка точного паттерна','badge'),node('h2',title(state.skin)+' · #'+state.seed),node('p',ru(g.title_ru),'muted'));const imgs=node('div',undefined,'renders');for(const v of ['Front','Back'])imgs.append(picture(g,state.seed,v));card.append(imgs,historyCoverage());
 const v=state.catalogue,d=v?.decision;card.append(node('h3','Сохранённая модель этой категории'),node('p',d?'N = '+d.N+' · исключено формулой '+d.k+' нижних продаж · расчёт от '+date(d.as_of):evaluationMessage(v),'muted'));
 if(!d&&v?.historical_decision)card.append(node('p',historicalMessage(v.historical_decision),'muted'));
 if(v?.retention)card.append(node('p','В формуле участвует сохранённая история за '+v.retention.months+' месяцев; показ последних двух месяцев не ограничивает расчёт.','muted'));
 for(const decision of d?.decisions||[]){if(decision.risk_display){const values=decision.risk_display;card.append(node('p',(decision.risk_basis==='crosswear_estimate'||decision.kind==='crosswear_price_estimate'?'Частичная оценка переноса E = ':'Точная история E = ')+values.E+' · Категория C = '+values.C+' · Итог W = '+values.W,'muted'),node('p',modelReason(decision.reason),'muted'));}const basis=decision.basis_ref;if(basis)card.append(node('p','Основание: '+basis.venue+' · продажа '+basis.source_sale_id+' · '+date(basis.sold_at)+(basis.show_older_basis?' · основание старше двух месяцев':''),'muted'));}
 if(d?.crosswear_display){const x=d.crosswear_display,donors=x.wears.map(v=>v.wear+' · '+v.independent_donors+' независимых продаж').join('; ');card.append(node('p','N_FN = 0 в расчётном окне. '+(donors?'Доноры: '+donors+'. ':'')+(x.state==='ready'?'Это расчётная оценка по продажам другого износа, а не фактические FN-продажи или подтверждённая цена продажи FN.':modelReason(x.reason)),'muted'));}
 const exact=D.sales.filter(r=>r.skin===state.skin&&r.seed===state.seed&&r.variant===$('variant').value&&matchesWear(r)).sort((a,b)=>b.sold_at.localeCompare(a.sold_at));card.append(node('h3','Последние три загруженные продажи'),rowsTable(exact.slice(0,3),true),node('h3','Текущие предложения этой категории'),rowsTable(filterRows(allAsks(),g)),button('Скопировать ссылку на карточку',copyLink));$('findingContent').append(card);
}

function shortFloat(value){if(value===null||value===undefined)return 'Не указан';const raw=String(value);if(!/^\d+(\.\d+)?$/.test(raw))return 'Не подтверждён';const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1||n===0&&/[1-9]/.test(raw))return 'Не подтверждён';return n===0?'0':'≈ '+Number(n.toPrecision(6)).toString();}
function feedVenueLabel(venue){return venue==='CSFloat'?'CSFloat · история продаж':venue;}
function selectFeedVenue(venue){$('feedVenue').value=venue;state.feedPage.limit=50;renderFeed();}
function legacyFeedRow(r){return {...r,id:r.venue+':'+r.observation_id,skin:r.instrument,external_id:r.listing_id,float_text:r.float,float_display:shortFloat(r.float),known_at:r.received_at,observed_at:r.source_at,valid_until:r.valid_until,snapshot_offer:r.price_kind==='ask',kind:r.price_kind,origin:'feed_v2',display_url:r.link,display_link_kind:r.link?'exact_lot':'unavailable',accessory_state:'unknown',availability_verified:false};}
function ingestFeed(packet){
 feedStore.apply(packet);state.liveRows=new Map(feedStore.rows().map(r=>{let v=legacyFeedRow(r);return [v.id,v];}));
 if(state.paused){state.pendingPacket=packet;$('feedApply').hidden=false;$('feedApply').textContent='Показать последние записи';return;}
 state.feed=feedStore.rows().map(legacyFeedRow);state.feedStatus=feedStore.summary();state.feedFixture=packet.fixture===true;renderFeed();
}
function renderFeed(){
 let query=normalize($('feedSearch').value),rows=state.feed.filter(r=>(!$('feedVenue').value||r.venue===$('feedVenue').value)&&(!$('feedScope').checked||(D.active[r.skin.toLowerCase()]||[]).includes(Number(r.seed)))&&(!query||normalize([r.skin,title(r.skin),r.seed,r.float_text,r.external_id,r.observation_id,r.asset_id].join(' ')).includes(query)));
 $('feedCount').textContent=state.feed.length;
 const known=state.feedStatus||[],order=[...venues,...known.map(s=>s.venue).filter(v=>!venues.includes(v))],statuses=order.map(v=>known.find(s=>s.venue===v)||{venue:v,count:0,state:'unknown'}),capacity=statuses.length*200,incomplete=statuses.some(s=>s.state!=='complete')||!state.connected;
 $('feedMeta').textContent=(state.feedFixture?'Тестовые данные · ':'')+state.feed.length+'/'+capacity+' в окне · '+rows.length+' записей в фильтре'+(incomplete?' · неполная выборка':'')+' · '+(state.paused?'Показ приостановлен':'опубликованный снимок')+' · до 200 каждой площадки · принятые продажи и текущий top3, не полный архив событий';
 const selectedVenue=$('feedVenue').value,all=button('Все площадки',()=>selectFeedVenue(''),'badge'+(!selectedVenue?' primary':''));all.setAttribute('aria-pressed',String(!selectedVenue));
 $('feedStatus').replaceChildren(all,...statuses.map(s=>{let active=selectedVenue===s.venue,el=button(feedVenueLabel(s.venue)+': '+s.count+' · '+({complete:'получено',incomplete:'неполно',error:'ошибка',unknown:'нет актуальных данных'}[s.state]||'неизвестно')+(s.retained_stale?' · сохранены прежние':''),()=>selectFeedVenue(active?'':s.venue),'badge'+(active?' primary':s.state==='complete'?'':' amber'));el.dataset.venue=s.venue;el.setAttribute('aria-pressed',String(active));el.title=(s.error==='no_current_qualified_rows_in_snapshot'?'В текущем срезе нет актуальных записей':s.error||'Последние записи; не полное покрытие рынка')+' · '+(active?'Нажмите, чтобы показать все площадки':'Нажмите, чтобы выбрать площадку');return el;}));
 $('feedTable').replaceChildren(rowsTable(rows,false,50,state.feedSort,true,state.feedPage));
}
function resumeFeed(){state.paused=false;$('pauseFeed').textContent='Ⅱ Пауза';state.pendingPacket=null;$('feedApply').hidden=true;state.feed=feedStore.rows().map(legacyFeedRow);state.feedStatus=feedStore.summary();renderFeed();}

let pollPending=false;
// UI preferences only. Source records and durable command journals are excluded.
const CLIENT_VIEW_KEY='atlas:clientViewV1';
const clientDelivery={release:document.querySelector?.('meta[name="atlas-release"]')?.content||null,checkedAt:0,pending:false,available:null};
function clientViewSnapshot(){
 const viewport=catalogueViewport(),groups=[];
 for(const [key,v]of [...state.groupViews].slice(-128))groups.push({key,tab:v.tab,disclosures:{...v.disclosures},filters:{...v.filters},tables:{ask:{limit:v.tables.ask.limit},history:{limit:v.tables.history.limit}}});
 return {version:1,at:Date.now(),path:location.pathname,hash:location.hash,groups,view:state.view,older:state.older,
  favoritesOnly:$('favoritesOnly').checked,feed:{venue:$('feedVenue').value,query:$('feedSearch').value,scope:$('feedScope').checked,paused:state.paused,limit:state.feedPage.limit},
  viewport:viewport?{...viewport}:null};
}
function saveClientView(){
 try{const raw=JSON.stringify(clientViewSnapshot());if(raw.length>65536)return false;sessionStorage.setItem(CLIENT_VIEW_KEY,raw);return sessionStorage.getItem(CLIENT_VIEW_KEY)===raw;}catch{return false;}
}
function restoreClientView(){
 try{
  const raw=sessionStorage.getItem(CLIENT_VIEW_KEY);if(!raw||raw.length>65536)return null;const v=JSON.parse(raw);
  if(v.version!==1||v.path!==location.pathname||!Number.isFinite(v.at)||Date.now()-v.at<0||Date.now()-v.at>86400000||!Array.isArray(v.groups)||v.groups.length>128)return null;
  const boundedLimit=(n,fallback)=>Number.isInteger(n)&&n>=10&&n<=1000?n:fallback;
  for(const g of v.groups){
   if(typeof g.key!=='string'||g.key.length>1024)continue;let key;try{key=JSON.parse(g.key);}catch{continue;}
   if(!Array.isArray(key)||key.length!==4||key.some(x=>typeof x!=='string'||x.length>300)||!['normal','stattrak','souvenir'].includes(key[3]))continue;
   const disclosures={};for(const k of ['seeds','quotes'])if(typeof g.disclosures?.[k]==='boolean')disclosures[k]=g.disclosures[k];
   const filters={venue:venues.includes(g.filters?.venue)?g.filters.venue:'',seed:g.filters?.seed===true,clean:g.filters?.clean===true,fresh:g.filters?.fresh===true};
   state.groupViews.set(g.key,{key:g.key,tab:g.tab==='history'?'history':'ask',disclosures,filters,tables:{ask:{limit:boundedLimit(g.tables?.ask?.limit,10),key:g.key+'|ask'},history:{limit:boundedLimit(g.tables?.history?.limit,10),key:g.key+'|history'}}});
  }
  if(['Front','Back'].includes(v.view))state.view=v.view;if(typeof v.older==='boolean')state.older=v.older;
  $('favoritesOnly').checked=v.favoritesOnly===true;
  if(v.feed){$('feedVenue').value=venues.includes(v.feed.venue)?v.feed.venue:'';$('feedSearch').value=typeof v.feed.query==='string'?v.feed.query.slice(0,500):'';$('feedScope').checked=v.feed.scope===true;state.paused=v.feed.paused===true;state.feedPage.limit=boundedLimit(v.feed.limit,50);$('pauseFeed').textContent=state.paused?'▶ Продолжить':'Ⅱ Пауза';}
  return v.hash===location.hash?v:null;
 }catch{return null;}
}
function clientUpdateNotice(){
 let box=$('interfaceUpdate');if(!box){box=node('div',undefined,'notice interface-update');box.id='interfaceUpdate';box.setAttribute('role','status');$('connectionNote').after(box);}
 box.hidden=!clientDelivery.available;if(box.hidden)return;
 box.replaceChildren(node('span','Доступно обновление интерфейса. Выбранный скин, фильтры и раскрытые разделы сохранятся.'),button('Обновить интерфейс',reloadClientView));
}
function reloadClientView(){
 if(Object.values(wholeSkinRequests).some(v=>v.state==='sending')){toast('Дождись ответа по отправляемой заявке. Обновление её не повторяет.');return false;}
 if(!saveClientView()){toast('Не удалось сохранить настройки этой вкладки. Обновление пока не выполнено.');return false;}
 location.reload();return true;
}
async function checkClientRelease(force=false){
 if(!/^[a-f0-9]{24}$/.test(clientDelivery.release||'')||clientDelivery.pending||!force&&Date.now()-clientDelivery.checkedAt<60000)return;
 clientDelivery.pending=true;clientDelivery.checkedAt=Date.now();
 try{const r=await AtlasSnapshot.fetch('/atlas/api/health',{cache:'no-store'}),v=await r.json();if(!r.ok||v.state!=='atlas_available'||v.financial_actions!==false||!/^[a-f0-9]{24}$/.test(v.release||''))return;
  clientDelivery.available=v.release===clientDelivery.release?null:v.release;clientUpdateNotice();
 }catch{}finally{clientDelivery.pending=false;}
}

async function pollOnce(){if(pollPending||document.hidden)return;pollPending=true;
 try{const response=await AtlasSnapshot.fetch('/atlas/api/v2/dashboard',{cache:'no-store'}),j=await response.json();if(!response.ok||j.schema!=='atlas_v2_dashboard_v1'||j.old_archive_mixed!==false)throw Error('v2_unavailable');
  useFX(j);ingestFeed(j.feed);state.connected=true;state.dashboard=j;state.queueJobs=j.history.rows;renderQueue();

  if(state.catalogueRevision!==j.revision){state.catalogueRevision=j.revision;state.catalogueKey=null;state.catalogueError=null;loadSavedCatalogue();}
  for(const v of feedStore.enabled)if(![...$('feedVenue').options].some(o=>o.value===v))$('feedVenue').append(new Option(feedVenueLabel(v),v));
  $('connection').textContent='Опубликованный снимок';$('connection').classList.remove('online');$('connectionNote').textContent=snapshotSummary(j);
  if(state.tab==='catalogue')for(const view of state.groupViews.values()){
   if(view.offerExpiry?.at<=Date.now())view.offerExpiry.refresh();
  }
 }catch{state.connected=false;$('connection').textContent='База V2 недоступна';$('connection').classList.remove('online');$('connectionNote').textContent='Свежий ответ V2 не получен. Показанные прежние записи могут быть устаревшими; старый архив не подмешивается.';}
 finally{pollPending=false;renderFeed();checkClientRelease();}
}
async function poll(){await pollOnce();setTimeout(poll,60000);}

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$('skinSearch').oninput=suggestions;$('skinSearch').onfocus=()=>{$('skinSearch').select();suggestions();};$('skinSearch').onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if($('suggestions').hidden)suggestions();state.suggestIndex=Math.max(0,Math.min(state.suggestions.length-1,state.suggestIndex+(e.key==='ArrowDown'?1:-1)));[...$('suggestions').querySelectorAll('button')].forEach((b,i)=>{b.classList.toggle('focused',i===state.suggestIndex);b.setAttribute('aria-selected',String(i===state.suggestIndex));if(i===state.suggestIndex)b.scrollIntoView({block:'nearest'});});}if(e.key==='Enter'&&state.suggestions.length){e.preventDefault();selectSkin(state.suggestions[Math.max(0,state.suggestIndex)]);}if(e.key==='Escape'){e.preventDefault();closeSuggest();}};
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))closeSuggest();});
$('seedInput').oninput=()=>{let s=$('seedInput').value;if(s===''){state.seed=null;}else if(!/^\d+$/.test(s)||+s>1000){$('seedInput').setCustomValidity('Номер паттерна: целое число от 0 до 1000');$('seedInput').reportValidity();return;}else state.seed=+s;$('seedInput').setCustomValidity('');renderCatalogue();};
for(const id of ['wear','archive','variant'])$(id).onchange=()=>{state.catalogueAnchor=null;renderCatalogue();if(state.tab==='findings')renderFinding();};
$('favoritesOnly').onchange=suggestions;$('favorite').onclick=()=>{state.favorites=state.favorites.includes(state.skin)?state.favorites.filter(s=>s!==state.skin):[...state.favorites,state.skin];save('favorites',state.favorites);renderCatalogue();};
for(const v of venues)$('feedVenue').append(new Option(feedVenueLabel(v),v));for(const id of ['feedVenue','feedScope','feedSearch'])$(id).addEventListener('input',renderFeed);
$('pauseFeed').onclick=()=>{if(state.paused)resumeFeed();else{state.paused=true;$('pauseFeed').textContent='▶ Продолжить';renderFeed();}};$('feedApply').onclick=resumeFeed;
$('exportQueue').onclick=()=>{let blob=new Blob([JSON.stringify({schema:'v2_history_queue_export_v1',observed_at:state.dashboard?.observed_at,jobs:state.queueJobs,legacy_local_drafts:state.queue},null,2)],{type:'application/json'});let u=URL.createObjectURL(blob),a=node('a');a.href=u;a.download='Приоритетные_обновления.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('openCompare').onclick=openCompare;$('clearCompare').onclick=()=>{state.compare=[];renderCompareTray();};$('closeCompare').onclick=()=>$('compareDialog').close();
$('closeImage').onclick=()=>$('imageDialog').close();$('imageDialog').addEventListener('click',e=>{const r=$('imageDialog').getBoundingClientRect();if(e.target===$('imageDialog')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))$('imageDialog').close();});for(const [id,v] of [['imageFront','Front'],['imageBack','Back']])$(id).onclick=()=>{const p=state.preview;openImage(p.g,p.seed,v);};
window.addEventListener('hashchange',readHash);
const restoredClientView=restoreClientView();
readHash();if(restoredClientView?.viewport&&state.tab==='catalogue'&&restoredClientView.viewport.selection===scopeQuery().toString())state.catalogueAnchor=restoredClientView.viewport;renderQueue();renderFeed();poll();
window.addEventListener('pagehide',saveClientView);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveClientView();else checkClientRelease(true);});

// Historical migration output has its own state and never enters D.sales/asks.

function legacyBox(){let box=$('legacyArchive');if(!box){box=node('section',undefined,'notice');box.id='legacyArchive';$('catalogue').append(box);}return box;}
function legacyQuery(){const q=scopeQuery();q.delete('offset');q.delete('older');q.set('limit','10');return q;}
async function readLegacy(next=false){
 const q=legacyQuery(),key=q.toString();if(legacyView.pending)return;
 if(next&&legacyView.next)q.set('cursor',legacyView.next);
 legacyView.pending=true;legacyView.error=null;renderLegacyArchive();
 try{const r=await AtlasSnapshot.fetch('/atlas/api/v2/legacy-archive?'+q,{cache:'no-store'}),v=await r.json();
  if(!r.ok||v.schema!=='legacy_archive_page_v2'||v.historical_only!==true||v.automatic_price_eligible!==false||v.old_database_opened!==false||v.scope.item!==q.get('item')||v.scope.wear!==q.get('wear')||v.scope.variant!==q.get('variant')||v.scope.seed!==q.get('seed')||!Array.isArray(v.rows)||v.rows.length>10)throw Error('archive_scope');
  if(legacyQuery().toString()!==key)return;
  legacyView.key=key;legacyView.rows=next?[...legacyView.rows,...v.rows].slice(-100):v.rows;legacyView.next=v.next_cursor;
 }catch{legacyView.key=key;legacyView.error='Архив пока недоступен. Отсутствие записей не подтверждено.';}
 finally{legacyView.pending=false;renderLegacyArchive();}
}
async function readLegacyNames(force=false){
 if(legacyView.namesPending)return legacyView.namesPending;if(!force&&legacyView.names!==null)return;
 legacyView.names=[];legacyView.namesPending=(async()=>{try{const r=await AtlasSnapshot.fetch('/atlas/api/v2/legacy-archive?list=items',{cache:'no-store'}),v=await r.json();if(r.ok&&v.schema==='legacy_archive_items_v2'&&Array.isArray(v.items)&&v.items.length<=4096&&v.items.every(x=>typeof x==='string'&&x.length<=180)){legacyView.names=v.items;names=[...new Set([...names,...v.items])].sort((a,b)=>a.localeCompare(b));}}catch{}finally{legacyView.namesPending=null;renderLegacyArchive();}})();return legacyView.namesPending;
}
function legacyPrice(r){
 if(r.price_text===null||r.price_text===undefined)return 'Цена не квалифицирована';
 const text=String(r.price_text),original=text+(r.price_includes_currency?'':' '+(r.currency||''));
 if(r.price_includes_currency||text.length>64||!/^\d+(\.\d+)?$/.test(text)||!['USD','RUB'].includes(r.currency))return original+' · пересчёт не квалифицирован';
 return price({price:text,currency:r.currency})+' · исходно '+text+' '+r.currency;
}
function renderLegacyArchive(){
 const box=legacyBox();box.hidden=!$('archive').checked;if(box.hidden)return;
 box.replaceChildren(node('h3','Архив до V2'));
 box.append(node('p','Старые наблюдения и записи источников. Они сохраняют исходную степень подтверждения и не входят в расчёты V2. Объявления показаны за сохранённое 72-часовое окно и по обязательным старым ссылкам; остальная старая история сохранена отдельно.'));
 box.append(button('Показать архив выбранного предмета',async()=>{if(!legacyView.names?.length)await readLegacyNames(true);legacyView.key=null;legacyView.rows=[];legacyView.next=null;await readLegacy();}));
 box.append(node('p','Сохранённые названия доступны в общем поиске. Для архива используется выбранный износ и seed, все флоаты.','muted'));
 if(legacyView.names===null)readLegacyNames();
 const key=legacyQuery().toString();if(legacyView.key!==key&&!legacyView.pending){legacyView.rows=[];legacyView.next=null;box.append(node('p','Нажми «Показать архив», чтобы прочитать выбранный предмет и износ. Все флоаты; тип и неизвестный вариант отмечены в строках.'));return;}
 if(legacyView.pending)box.append(node('p','Читаю сохранённые записи…'));
 if(legacyView.error)box.append(node('p',legacyView.error));
 if(legacyView.rows.length){const wrap=node('div',undefined,'table-wrap'),table=node('table'),head=node('tr');for(const t of ['Дата · МСК','Источник / запись','Износ / seed','Флоат','Цена · ₽ и исходная','Подтверждение'])head.append(node('th',t));const th=node('thead');th.append(head);table.append(th);const tb=node('tbody');
  const kinds={ask_observation:'объявление',name_wear_history:'история имени/износа',reported_history:'сторонняя запись',reported_ask:'стороннее объявление',weak_reported_history:'старая запись браузера'};
  for(const r of legacyView.rows){const tr=node('tr'),quality=r.context.wear+' / '+(r.seed===null?'seed неизвестен':'#'+r.seed),proof=r.scope_review?.state==='HOLD'?'Идентичность исходной записи не подтверждена':r.context.variant==='unknown'?'Вариант не подтверждён':r.kind==='ask_observation'?'Архивное наблюдение':r.kind==='name_wear_history'?'Без подтверждения seed/флоата':'Расчёт по сделке не подтверждён';
   for(const text of [new Date(r.clock).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}),r.source+' · '+(kinds[r.kind]||'архив'),quality,shortFloat(r.float_text),legacyPrice(r),proof])tr.append(node('td',text));tr.children[3].title=r.float_text??'';tb.append(tr);}
  table.append(tb);wrap.append(table);box.append(wrap);
 }else if(legacyView.key===key&&!legacyView.pending&&!legacyView.error)box.append(node('p','В этой странице архивного индекса совпадений нет. Это не подтверждение отсутствия записей на рынке.'));
 if(legacyView.next)box.append(button('Следующая страница архива',()=>readLegacy(true)));
}

for(const event of ['wheel','touchmove'])window.addEventListener(event,()=>{state.catalogueAnchor=null;},{passive:true});
window.addEventListener('keydown',event=>{if(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown'].includes(event.key))state.catalogueAnchor=null;});
window.addEventListener('pointerdown',event=>{if(event.clientX>=window.innerWidth-20)state.catalogueAnchor=null;},{passive:true});
