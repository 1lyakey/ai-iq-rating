// ============================================================
//  Сборщик рейтингов из 6 независимых источников + консенсус
//  Запуск: node scripts/build-sources.mjs
//  Пишет: data/sources.json
// ============================================================
import fs from 'fs';
import path from 'path';

const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
const OUT='data/sources.json';

async function get(url,ms=20000,json=false){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms);
  try{
    const r=await fetch(url,{headers:UA,signal:ctl.signal});
    clearTimeout(t);
    if(!r.ok)throw new Error('HTTP '+r.status);
    return json?await r.json():await r.text();
  }catch(e){clearTimeout(t);throw e;}
}

// ---------- нормализация имён моделей ----------
function canon(raw){
  let s=String(raw).toLowerCase()
    .replace(/[_/]/g,' ')
    .replace(/\b(high|max|xhigh|medium|low|thinking|reasoning|base|preview|beta|latest|\d+k)\b/g,' ')
    .replace(/\b20\d{6}\b/g,' ')
    .replace(/\(.*?\)/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  // убираем префиксы вендоров
  s=s.replace(/^(anthropic|openai|google|meta|moonshot|alibaba|deepseek|mistral|z\.ai|zai|xai|spacexai)\s+/,'');
  // ключевые семейства → канон
  const rules=[
    [/^(claude[- ])?fable[- ]?5\.1/, 'fable-5.1'],
    [/^(claude[- ])?fable[- ]?5/, 'fable-5'],
    [/^(claude[- ])?opus[- ]?5/, 'opus-5'],
    [/^(claude[- ])?opus[- ]?4\.8/, 'opus-4.8'],
    [/^(claude[- ])?opus[- ]?4\.7/, 'opus-4.7'],
    [/^(claude[- ])?opus[- ]?4\.6/, 'opus-4.6'],
    [/^(claude[- ])?opus[- ]?4\.5/, 'opus-4.5'],
    [/^(claude[- ])?opus[- ]?4\.1/, 'opus-4.1'],
    [/^(claude[- ])?opus[- ]?4\b/, 'opus-4'],
    [/^(claude[- ])?sonnet[- ]?5/, 'sonnet-5'],
    [/^(claude[- ])?sonnet[- ]?4\.6/, 'sonnet-4.6'],
    [/gpt[- ]?6[- ]?astra/, 'gpt-6-astra'],
    [/gpt[- ]?5\.6[- ]?sol/, 'gpt-5.6-sol'],
    [/gpt[- ]?5\.6[- ]?terra/, 'gpt-5.6-terra'],
    [/gpt[- ]?5\.6[- ]?luna/, 'gpt-5.6-luna'],
    [/gpt[- ]?5\.5/, 'gpt-5.5'],
    [/gpt[- ]?5\.4/, 'gpt-5.4'],
    [/gpt[- ]?5\.3/, 'gpt-5.3'],
    [/gpt[- ]?5\.2/, 'gpt-5.2'],
    [/gpt[- ]?5\.1\b/, 'gpt-5.1'],
    [/gpt[- ]?5\b/, 'gpt-5'],
    [/gemini[- ]?3\.8/, 'gemini-3.8-flash'],
    [/gemini[- ]?3\.7/, 'gemini-3.7-flash'],
    [/gemini[- ]?3\.6/, 'gemini-3.6-flash'],
    [/gemini[- ]?3\.5/, 'gemini-3.5-flash'],
    [/gemini[- ]?3\.1[- ]?pro/, 'gemini-3.1-pro'],
    [/gemini[- ]?3[- ]?pro/, 'gemini-3-pro'],
    [/gemini[- ]?3[- ]?flash/, 'gemini-3-flash'],
    [/muse[- ]?spark[- ]?1\.3/, 'muse-spark-1.3'],
    [/muse[- ]?spark[- ]?1\.2/, 'muse-spark-1.2'],
    [/muse[- ]?spark[- ]?1\.1/, 'muse-spark-1.1'],
    [/muse[- ]?spark/, 'muse-spark'],
    [/kimi[- ]?k3|kimi[- ]?k[- ]?3/, 'kimi-k3'],
    [/kimi[- ]?k2\.6/, 'kimi-k2.6'],
    [/kimi[- ]?k2\.5/, 'kimi-k2.5'],
    [/kimi[- ]?k2\b/, 'kimi-k2'],
    [/glm[- ]?5\.3/, 'glm-5.3'],
    [/glm[- ]?5\.2/, 'glm-5.2'],
    [/glm[- ]?5\.1/, 'glm-5.1'],
    [/glm[- ]?5\b/, 'glm-5'],
    [/qwen[- ]?3\.8[- ]?max/, 'qwen3.8-max'],
    [/qwen[- ]?3\.8/, 'qwen3.8'],
    [/qwen[- ]?3\.7/, 'qwen3.7'],
    [/qwen[- ]?3\.6/, 'qwen3.6'],
    [/qwen[- ]?3\.5/, 'qwen3.5'],
    [/grok[- ]?4\.6/, 'grok-4.6'],
    [/grok[- ]?4\.5/, 'grok-4.5'],
    [/grok[- ]?4\.2/, 'grok-4.2'],
    [/grok[- ]?4\.1/, 'grok-4.1'],
    [/grok[- ]?4\b/, 'grok-4'],
    [/grok[- ]?3\b/, 'grok-3'],
    [/deepseek[- ]?v?4\.1/, 'deepseek-v4.1'],
    [/deepseek[- ]?v?4\b/, 'deepseek-v4'],
    [/deepseek[- ]?v?3\.2/, 'deepseek-v3.2'],
    [/deepseek[- ]?r1/, 'deepseek-r1'],
    [/mistral[- ]?large[- ]?3/, 'mistral-large-3'],
    [/minimax[- ]?m3/, 'minimax-m3'],
    [/minimax[- ]?m2\.7/, 'minimax-m2.7'],
    [/minimax[- ]?m2\.5/, 'minimax-m2.5']
  ];
  for(const [re,key] of rules) if(re.test(s)) return key;
  return s.replace(/[^a-z0-9.]+/g,'-').replace(/^-|-$/g,'')||'unknown';
}

// ---------- ИСТОЧНИК 1: aiiq.org (композитный IQ) ----------
async function srcAiiq(){
  const d=await get('https://www.aiiq.org/api/v1/models',25000,true);
  const models=d.models.filter(m=>m.iq!=null).sort((a,b)=>b.iq-a.iq).slice(0,80).map(m=>({
    name:m.name,key:canon(m.name),score:m.iq,provider:m.provider,country:m.country,
    release:m.releaseDate,openSource:m.openSource,
    dims:m.dimensions||{},cost:(m.cost&&m.cost.effectivePer1M)||null,
    speed:(m.speed&&m.speed.medianTokensPerSecond)||null,ctx:m.contextWindow||null
  }));
  return {id:'aiiq',name:'AI IQ (aiiq.org)',org:'Liberated Software LLC',fresh:'live',
    url:'https://aiiq.org',method:'Композитный IQ по ~40 публичным бенчмаркам (ARC Prize, FrontierMath, LiveCodeBench, Terminal-Bench, OSWorld и др.)',
    risk:'Агрегатор сам выбирает набор бенчмарков и веса → результат зависит от методики оператора',
    unit:'IQ',models};
}

// ---------- ИСТОЧНИК 2: LMArena (голоса людей) ----------
async function srcArena(){
  const html=await get('https://lmarena.ai/leaderboard/text',30000);
  const models=[];
  const re=/(\d{1,3})\s+\d+\s+\d+\s+([A-Za-z0-9 .\-]+?)\s+([a-z0-9.\-_]+)\s+[A-Za-z0-9 .·\-]+\s+(\d{3,4})\s+±/g;
  let m;
  while((m=re.exec(html))!==null){
    const rank=+m[1],name=m[3],score=+m[4];
    if(score>900&&score<1700&&!models.some(x=>x.name===name)){
      models.push({name,key:canon(name),score,rank});
    }
    if(models.length>=120)break;
  }
  models.sort((a,b)=>b.score-a.score);
  models.forEach((x,i)=>x.rank=i+1);
  return {id:'arena',name:'LMArena / Arena Intelligence',org:'Arena Intelligence (LMSYS-проект)',fresh:'live',
    url:'https://lmarena.ai/leaderboard/text',method:'Слепые парные сравнения: 8.1 млн голосов живых пользователей → ELO-рейтинг',
    risk:'Голоса людей = вкусовщина: красивое оформление и стиль ответа влияет на оценку; накрутка вендорами',
    unit:'ELO',models};
}

// ---------- ИСТОЧНИК 3: SWE-bench Verified (Princeton) ----------
async function srcSwe(){
  const tree=await get('https://api.github.com/repos/SWE-bench/experiments/git/trees/main?recursive=1',25000,true);
  const files=(tree.tree||[]).filter(x=>/^evaluation\/verified\/.+\/results\/results\.json$/.test(x.path));
  // берём самую свежую оценку на каждую модель
  const byModel={};
  for(const f of files){
    const mm=f.path.match(/^evaluation\/verified\/(\d{8})_([a-z0-9.\-]+?)_(.+?)\/results\/results\.json$/);
    if(!mm)continue;
    const [,date,harness,model]=mm;
    const k=canon(model);
    if(!byModel[k]||byModel[k].date<date) byModel[k]={date,harness,model,path:f.path};
  }
  const entries=Object.entries(byModel).slice(0,60);
  const models=[];
  for(const [key,info] of entries){
    try{
      const res=await get('https://raw.githubusercontent.com/SWE-bench/experiments/main/'+info.path,15000,true);
      const resolved=(res.resolved||[]).length;
      const total=resolved+(res.unresolved||[]).length+(res.no_generation||[]).length+(res.no_logs||[]).length;
      if(total>0&&resolved>0){
        models.push({name:info.model.replace(/-/g,' '),key,score:Math.round(resolved/total*1000)/10,
          scoreLabel:resolved+'/'+total,date:info.date,harness:info.harness});
      }
    }catch(e){/* пропускаем битый файл */}
  }
  models.sort((a,b)=>b.score-a.score);
  models.forEach((x,i)=>x.rank=i+1);
  return {id:'swe',name:'SWE-bench Verified',org:'Princeton NLP',fresh:'live',
    url:'https://www.swebench.com',method:'Реальные баг-фиксы из GitHub (500 задач), проверка автотестами. Агентные оценки (mini-swe-agent и др.)',
    risk:'Измеряет только программирование; результат зависит от выбранного агент-харнесса',
    unit:'% решённых',models};
}

// ---------- ИСТОЧНИК 4: HF Open LLM Leaderboard ----------
async function srcHf(){
  const d=await get('https://datasets-server.huggingface.co/first-rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train',25000,true);
  const rows=d.rows||[];
  const cols=((d.features||[]).map(f=>f.name));
  const scoreCol=cols.find(c=>/average|overall|score/i.test(c))||'Average ⬆️';
  const models=rows.map(r=>{
    const o=r.row,name=o['fullname']||o['model']||o['Model']||'';
    const sc=parseFloat(o[scoreCol]);
    return name&&!isNaN(sc)?{name:String(name),key:canon(name),score:Math.round(sc*100)/100}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,60);
  models.forEach((x,i)=>x.rank=i+1);
  return {id:'hf',name:'HF Open LLM Leaderboard',org:'Hugging Face',fresh:'live',
    url:'https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard',
    method:'Воспроизводимые прогоны открытых моделей на стандартных наборах (MMLU-Pro, GPQA, IFEval, MATH, MUSR)',
    risk:'Только модели с открытыми весами → флагманы OpenAI/Anthropic/Google в рейтинг не попадают',
    unit:'средний балл',models};
}

// ---------- ИСТОЧНИК 5: LiveBench ----------
async function srcLiveBench(){
  const csv=await get('https://livebench.ai/table_2025_05_30.csv',25000);
  const lines=csv.trim().split('\n');
  const models=[];
  for(let i=1;i<lines.length;i++){
    const cells=lines[i].split(',');
    if(cells.length<5)continue;
    const nums=cells.slice(1).map(Number).filter(n=>!isNaN(n));
    if(!nums.length)continue;
    models.push({name:cells[0].replace(/-/g,' ').trim(),key:canon(cells[0]),
      score:Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100});
  }
  models.sort((a,b)=>b.score-a.score);
  const top=models.slice(0,60);
  top.forEach((x,i)=>x.rank=i+1);
  return {id:'livebench',name:'LiveBench',org:'Abacus.AI + NYU / UMD / USC',fresh:'snapshot',snapshot:'2025-05-30',
    url:'https://livebench.ai',
    method:'Задачи с ответами, обновляемые каждый выпуск → защита от загрязнения обучением. 20 категорий, автопроверка без судей-людей',
    risk:'Последний доступный снимок — май 2025: моделей 2026 года здесь нет',
    unit:'средний балл',models:top};
}

// ---------- ИСТОЧНИК 6: Aider Polyglot ----------
async function srcAider(){
  const html=await get('https://aider.chat/docs/leaderboards/',30000);
  const models=[],seen=new Set();
  const re=/▶\s*([A-Za-z0-9][A-Za-z0-9 ._\-()]{1,40}?)\s+(\d{1,3}\.\d)%/g;
  let m;
  while((m=re.exec(html))!==null){
    const name=m[1].trim().replace(/\s*\(.*?\)\s*/g,' ').trim();
    const score=+m[2],key=canon(name);
    if(score>=5&&!seen.has(key)){seen.add(key);models.push({name,key,score});}
  }
  models.sort((a,b)=>b.score-a.score);
  const top=models.slice(0,60);
  top.forEach((x,i)=>x.rank=i+1);
  return {id:'aider',name:'Aider Polyglot',org:'Aider (открытый проект)',fresh:'snapshot',snapshot:'2025',
    url:'https://aider.chat/docs/leaderboards/',
    method:'225 сложных задач по C++, Go, Java, JS, Python, Rust: модель сама редактирует файлы и проходит тесты',
    risk:'Снимок 2025 года и узкий фокус — редактирование кода',
    unit:'% решённых',models:top};
}