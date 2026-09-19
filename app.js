const API_URL='https://www.aiiq.org/api/v1/models';
const REFRESH_MS=60000;

// ============================================
// 💰 ВСТАВЬ СВОИ РЕФЕРАЛЬНЫЕ КОДЫ СЮДА
// ============================================
// 1. Зарегистрируйся у провайдера (ссылки ниже)
// 2. Найди реф-код в личном кабинете
// 3. Замени null на свой код в кавычках: openrouter: "abc123"
// 4. Закоммить и запушь — сайт обновится автоматически
const REF_CODES={
  openrouter: null,  // https://openrouter.ai/settings/referrals
  together: null,    // https://www.together.ai/settings/referrals
  fireworks: null,   // https://fireworks.ai/account/referrals
  deepinfra: null    // https://deepinfra.com/referrals
};

const REF_PROVIDERS=[
  {key:'openrouter',name:'OpenRouter',icon:'🚀',url:'https://openrouter.ai/?ref=',desc:'10% от комиссии навсегда'},
  {key:'together',name:'Together AI',icon:'⚡',url:'https://www.together.ai/?ref=',desc:'Кредиты за регистрации'},
  {key:'fireworks',name:'Fireworks AI',icon:'🔥',url:'https://fireworks.ai/?ref=',desc:'Партнёрская программа'},
  {key:'deepinfra',name:'DeepInfra',icon:'💎',url:'https://deepinfra.com/?ref=',desc:'Реферальные бонусы'}
];
const FLAG={'United States':'🇺🇸','China':'🇨🇳','Japan':'🇯🇵','Singapore':'🇸🇬','South Korea':'🇰🇷','France':'🇫🇷','Canada':'🇨🇦'};
let MODELS=[];

const tbody=document.getElementById('tbody');
const searchEl=document.getElementById('search');
const compSel=document.getElementById('companyFilter');
const sortSel=document.getElementById('sortSel');
const weightsEl=document.getElementById('weights');

const PROFILES={
  universal:{label:'⚖️ Универсал',w:{iq:.30,code:.15,math:.10,acad:.10,abs:.10,rel:.10,comp:.05,speed:.05,price:.03,ctx:.02}},
  coder:{label:'💻 Кодер',w:{iq:.10,code:.40,math:.10,acad:.05,abs:.05,rel:.10,comp:.10,speed:.05,price:.03,ctx:.02}},
  budget:{label:'💰 Бюджет',w:{iq:.15,code:.10,math:.05,acad:.05,abs:.05,rel:.10,comp:.05,speed:.10,price:.30,ctx:.05}},
  speed:{label:'⚡ Скорость',w:{iq:.15,code:.10,math:.05,acad:.05,abs:.05,rel:.10,comp:.05,speed:.30,price:.10,ctx:.05}}
};
let profile='universal';

function statusBadge(txt,ok){
  const b=document.getElementById('liveBadge');
  b.textContent=txt;b.className='badge '+(ok?'live':'err');
}

async function loadData(){
  try{
    const r=await fetch(API_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    const raw=d.models.filter(m=>m.iq!=null).sort((a,b)=>b.iq-a.iq).slice(0,100);
    MODELS=raw.map(m=>({
      name:esc(m.name), provider:esc(m.provider), flag:FLAG[m.country]||'🏳️',
      iq:m.iq, dims:m.dimensions||{}, cost:(m.cost&&m.cost.effectivePer1M)||null,
      speed:(m.speed&&m.speed.medianTokensPerSecond)||null,
      ctx:m.contextWindow||null, os:m.openSource||false
    }));
    calcScores();
    rebuildCompanyFilter();
    statusBadge('🟢 Live · '+new Date(d.updatedAt||Date.now()).toLocaleString('ru-RU'),true);
    render();
  }catch(e){
    statusBadge('🔴 Ошибка: '+e.message,false);
    if(!MODELS.length&&typeof MODELS_SNAPSHOT!=='undefined'){
      MODELS=MODELS_SNAPSHOT.map(m=>({name:m[0],provider:m[1],flag:m[2],iq:m[3],dims:{},cost:null,speed:null,ctx:null,os:false}));
      calcScores();rebuildCompanyFilter();render();
    }
  }
}

function norm(v,min,max,invert){
  if(v==null||min==max)return 50;
  let x=(v-min)/(max-min)*100;
  return invert?100-x:x;
}

function calcScores(){
  const iqs=MODELS.map(m=>m.iq);
  const minI=Math.min(...iqs),maxI=Math.max(...iqs);
  const prices=MODELS.map(m=>m.cost).filter(v=>v!=null);
  const minP=prices.length?Math.min(...prices):0,maxP=prices.length?Math.max(...prices):1;
  const speeds=MODELS.map(m=>m.speed).filter(v=>v!=null);
  const minS=speeds.length?Math.min(...speeds):0,maxS=speeds.length?Math.max(...speeds):1;
  const ctxs=MODELS.map(m=>m.ctx).filter(v=>v!=null);
  const minC=ctxs.length?Math.min(...ctxs):0,maxC=ctxs.length?Math.max(...ctxs):1;
  const P=PROFILES[profile].w;
  MODELS.forEach(m=>{
    m.score=Math.round(P.iq*norm(m.iq,minI,maxI)+P.code*norm(m.dims['programmatic-reasoning'],60,150)+P.math*norm(m.dims['mathematical-reasoning'],60,150)+P.acad*norm(m.dims['academic-reasoning'],60,150)+P.abs*norm(m.dims['abstract-reasoning'],60,150)+P.rel*norm(m.dims['reliability'],60,150)+P.comp*norm(m.dims['computer-use'],60,150)+P.speed*norm(m.speed,minS,maxS)+P.price*norm(m.cost,minP,maxP,true)+P.ctx*norm(m.ctx,minC,maxC));
  });
}

function rebuildCompanyFilter(){
  const cur=compSel.value;
  compSel.innerHTML='<option value="">Все компании</option>';
  [...new Set(MODELS.map(m=>esc(m.provider)))].sort().forEach(c=>{
    const o=document.createElement('option');o.value=o.textContent=c;compSel.appendChild(o);
  });
  if([...compSel.options].some(o=>o.value===cur))compSel.value=cur;
}

function sClass(s){return s>=75?'s-hi':s>=55?'s-mid':'s-lo'}
function fmt(v){return v==null?'—':v}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function render(){
  const q=searchEl.value.trim().toLowerCase();
  const comp=compSel.value;
  let rows=MODELS.filter(m=>(!comp||esc(m.provider)===comp)&&(!q||esc(m.name).toLowerCase().includes(q)||esc(m.provider).toLowerCase().includes(q)));
  const s=sortSel.value;
  if(s==='iq')rows.sort((a,b)=>b.iq-a.iq);
  else if(s==='priceAsc')rows.sort((a,b)=>(a.cost??999)-(b.cost??999));
  else if(s==='speed')rows.sort((a,b)=>(b.speed??0)-(a.speed??0));
  else if(s==='context')rows.sort((a,b)=>(b.ctx??0)-(a.ctx??0));
  else if(s==='name')rows.sort((a,b)=>a.name.localeCompare(b.name));
  else rows.sort((a,b)=>b.score-a.score);

  tbody.innerHTML=rows.map((m,i)=>{
    const rc=(s==='score'&&!q&&!comp)?(i===0?'r1':i===1?'r2':i===2?'r3':''):'';
    return `<tr><td class="rank ${rc}">${i+1}</td>
      <td class="model" title="${esc(m.name)}">${esc(m.name)}</td>
      <td class="company">${esc(m.provider)}</td>
      <td class="score ${sClass(m.score)}">${m.score}</td>
      <td class="score">${m.iq}</td>
      <td class="mini">${fmt(m.dims['abstract-reasoning'])}</td>
      <td class="mini">${fmt(m.dims['mathematical-reasoning'])}</td>
      <td class="mini">${fmt(m.dims['academic-reasoning'])}</td>
      <td class="mini">${fmt(m.dims['programmatic-reasoning'])}</td>
      <td class="mini">${fmt(m.dims['computer-use'])}</td>
      <td class="mini">${fmt(m.dims['reliability'])}</td>
      <td class="mini">${m.cost!=null?'$'+m.cost.toFixed(2):'—'}</td>
      <td class="mini">${fmt(m.speed)}</td>
      <td class="mini">${m.ctx?Math.round(m.ctx/1000)+'K':'—'}</td>
      <td>${m.os?'<span class="tag os">OS</span>':''}</td></tr>`;
  }).join('');

  if(rows.length){
    const top=[...MODELS].sort((a,b)=>b.score-a.score)[0];
    document.getElementById('heroName').textContent=top.name;
    document.getElementById('heroSub').textContent=`${top.provider} · IQ ${top.iq} · $${top.cost?top.cost.toFixed(2):'—'}/1M · ${top.speed||'—'} т/с · ${top.ctx?Math.round(top.ctx/1000)+'K':'—'} контекст`;
    document.getElementById('heroScore').textContent=top.score;
    document.getElementById('heroDims').innerHTML=`
      <div class="dim"><span>🧠 IQ</span><b>${top.iq}</b></div>
      <div class="dim"><span>💻 Код</span><b>${fmt(top.dims['programmatic-reasoning'])}</b></div>
      <div class="dim"><span>🔢 Математика</span><b>${fmt(top.dims['mathematical-reasoning'])}</b></div>
      <div class="dim"><span>🎓 Академич.</span><b>${fmt(top.dims['academic-reasoning'])}</b></div>
      <div class="dim"><span>💡 Абстрактн.</span><b>${fmt(top.dims['abstract-reasoning'])}</b></div>
      <div class="dim"><span>🛡️ Надёжность</span><b>${fmt(top.dims['reliability'])}</b></div>`;
  }
}

Object.entries(PROFILES).forEach(([k,p])=>{
  const b=document.createElement('button');
  b.className='wbtn'+(k===profile?' on':'');b.textContent=p.label;
  b.onclick=()=>{profile=k;calcScores();render();document.querySelectorAll('.wbtn').forEach(x=>x.classList.remove('on'));b.classList.add('on');};
  weightsEl.appendChild(b);
});

searchEl.addEventListener('input',render);
compSel.addEventListener('change',render);
sortSel.addEventListener('change',render);
document.querySelectorAll('thead th[data-k]').forEach(th=>th.addEventListener('click',()=>{
  const k=th.dataset.k;
  sortSel.value=(k==='score'||k==='iq'||k==='name')?k:'score';
  render();
}));

loadData();
setInterval(loadData,REFRESH_MS);

// === НОВОСТИ ===
function renderNews(){
  const grid=document.getElementById('newsGrid');
  if(!grid)return;
  const recent=[...MODELS].filter(m=>m.releaseDate).sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate)).slice(0,5);
  const staticNews=[
    {date:'2026-09-19',title:'Cline Desktop — 4 модели бесплатно',desc:'Kimi K3, DeepSeek V4.1 Flash, Muse Spark 1.3 Contributor и GLM 5.3 Flash доступны без оплаты',badge:'free',link:'https://cline.bot'},
    {date:'2026-09-18',title:'OpenRouter — расширен free-tier',desc:'Новые бесплатные модели с лимитом 50 запросов/день',badge:'free',link:'https://openrouter.ai'},
    {date:'2026-09-15',title:'Gemini 3.5 Flash — бесплатный доступ',desc:'Google открыл бесплатный tier в AI Studio',badge:'free',link:'https://aistudio.google.com'},
    {date:'2026-09-12',title:'DeepSeek V4.1 Flash — open weights',desc:'Веса опубликованы под Apache 2.0',badge:'new',link:'https://huggingface.co/deepseek-ai'},
    {date:'2026-09-10',title:'Anthropic Fable 5.1 — новый SOTA',desc:'Fable 5.1 обогнал GPT-5.5 по IQ (137 vs 133)',badge:'new',link:'https://www.anthropic.com'}
  ];
  const apiNews=recent.map(m=>({
    date:m.releaseDate,
    title:`${esc(m.name)} — релиз`,
    desc:`${esc(m.provider)} · IQ ${m.iq}${m.os?' · Open Source':''} · ${m.ctx?Math.round(m.ctx/1000)+'K контекст':''}`,
    badge:'new',
    link:`https://www.aiiq.org/models/${esc(m.name)}/`
  }));
  const all=[...staticNews,...apiNews].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  grid.innerHTML=all.map(n=>`
    <div class="news-item">
      <div class="date">${n.date}</div>
      <div class="title">${n.title}${n.badge==='free'?'<span class="badge-free">FREE</span>':'<span class="badge-new">NEW</span>'}</div>
      <div class="desc">${n.desc}</div>
      ${n.link?`<a href="${n.link}" target="_blank" style="color:var(--accent);font-size:.72rem;margin-top:8px;display:inline-block">Подробнее →</a>`:''}
    </div>
  `).join('');
}

const origLoad=loadData;
loadData=async function(){
  await origLoad();
  renderNews();
};
loadData();

// === РЕФЕРАЛЬНЫЕ ССЫЛКИ ===
function renderRefLinks(){
  const container=document.getElementById('refLinks');
  if(!container)return;
  
  container.innerHTML=REF_PROVIDERS.map(p=>{
    const code=REF_CODES[p.key];
    const url=code?p.url+encodeURIComponent(code):p.url.replace('?ref=','');
    const hasCode=!!code;
    return `<a href="${esc(url)}" target="_blank" ${hasCode?'':'class="alt"'} title="${esc(p.desc)}${hasCode?'':' (код не настроен)'}">${p.icon} ${esc(p.name)}${hasCode?' ✓':''}</a>`;
  }).join('');
}

renderRefLinks();

