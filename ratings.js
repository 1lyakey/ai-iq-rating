// ============================================================
//  6 независимых источников + консенсусный рейтинг + ТОП-10
//  Читает data/sources.json (собирается скриптом build-sources.mjs)
// ============================================================
const SRCLABEL={aiiq:'AI IQ',arena:'LMArena',swe:'SWE-bench',hf:'HF Open LLM',livebench:'LiveBench',aider:'Aider'};
let SDATA=null,curSrc='consensus';

function esc2(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v,d=1){return v==null?'—':(Math.round(v*10)/10).toFixed(d)}

async function loadSources(){
  try{
    const r=await fetch('data/sources.json',{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    SDATA=await r.json();
    renderSrcCards();
    renderTabs();
    showSource(curSrc);
    renderTop10();
    const u=new Date(SDATA.updated);
    document.getElementById('multiUpdated').textContent=
      `Обновлено: ${u.toLocaleString('ru-RU')} · источников: ${SDATA.sources.filter(s=>!s.error).length}/6 · моделей в консенсусе: ${SDATA.consensus.length}`;
  }catch(e){
    document.getElementById('multiUpdated').textContent='Не удалось загрузить data/sources.json: '+e.message;
  }
}

function renderSrcCards(){
  const box=document.getElementById('srcCards');
  box.innerHTML=SDATA.sources.map(s=>`
    <div class="src-card" data-src="${s.id}">
      <div class="nm">${esc2(s.name)} ${s.error?'❌':''}</div>
      <div class="org">${esc2(s.org||'')}</div>
      <div class="meta">
        <span class="pill ${s.fresh==='live'?'live':'snap'}">${s.fresh==='live'?'живой':'снимок'}</span>
        ${s.snapshot?`<span class="pill">${esc2(s.snapshot)}</span>`:''}
        <span class="pill">${s.count} моделей</span>
      </div>
    </div>`).join('');
  box.querySelectorAll('.src-card').forEach(c=>c.onclick=()=>showSource(c.dataset.src));
}

function renderTabs(){
  const t=document.getElementById('srcTabs');
  t.innerHTML=SDATA.sources.map(s=>`<button class="tab" data-src="${s.id}">${esc2(SRCLABEL[s.id]||s.id)}</button>`).join('')
    +`<button class="tab cons" data-src="consensus">🎯 КОНСЕНСУС (6 → 1)</button>`;
  t.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showSource(b.dataset.src));
}

function showSource(id){
  curSrc=id;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.src===id));
  document.querySelectorAll('.src-card').forEach(c=>c.classList.toggle('on',c.dataset.src===id));
  const det=document.getElementById('srcDetail');
  const body=document.getElementById('srcBody');

  if(id==='consensus'){
    det.innerHTML=`<b>🎯 Консенсус:</b> средневзвешенный перцентиль позиции модели в каждом источнике, где она встречается.
      Вес: живые источники (AI IQ, LMArena, SWE-bench, HF) — <b>1.0</b>, устаревшие снимки (LiveBench 2025-05, Aider 2025) — <b>0.5</b>.
      Модель попадает в консенсус, если подтверждена <b>минимум двумя</b> источниками. Это защита от лоббирования: один источник не может «протащить» модель.
      <span class="warn">Ограничение:</span> самые свежие модели 2026 года пока есть только в AI IQ и LMArena — поэтому у них покрытие 2/6.</b>`;
    body.innerHTML=SDATA.consensus.slice(0,100).map(c=>`
      <tr>
        <td class="rank ${c.rank===1?'r1':c.rank===2?'r2':c.rank===3?'r3':''}">${c.rank}</td>
        <td class="model">${esc2(c.name)}</td>
        <td class="company">${esc2(c.provider||'—')}</td>
        <td class="score ${c.score>=85?'s-hi':c.score>=65?'s-mid':'s-lo'}">${num(c.score)}</td>
        <td class="mini">покрытие ${c.coverage}/6${Object.keys(c.per).length?` · ${Object.entries(c.per).map(([k,v])=>SRCLABEL[k]+' #'+v.rank).join(' · ')}`:''}</td>
      </tr>`).join('');
    return;
  }

  const s=SDATA.sources.find(x=>x.id===id);
  if(!s)return;
  det.innerHTML=`<b>${esc2(s.name)}</b> · ${esc2(s.org||'')} · <a href="${esc2(s.url)}" target="_blank" style="color:var(--accent)">открыть источник</a><br>
    <b>Что измеряет:</b> ${esc2(s.method)}<br>
    <b>Уязвимое место (риск предвзятости):</b> <span class="warn">${esc2(s.risk)}</span>
    ${s.error?`<br><b>Ошибка сбора:</b> ${esc2(s.error)}`:''}`;
  body.innerHTML=s.models.map(m=>`
    <tr>
      <td class="rank ${m.rank===1?'r1':m.rank===2?'r2':m.rank===3?'r3':''}">${m.rank}</td>
      <td class="model">${esc2(m.name)}</td>
      <td class="company">${esc2(m.provider||'—')}</td>
      <td class="score ${m.pct>=85?'s-hi':m.pct>=65?'s-mid':'s-lo'}">${num(m.score)} <span class="mini">${esc2(s.unit||'')}</span></td>
      <td class="mini">перцентиль ${num(m.pct)}${m.scoreLabel?' · '+esc2(m.scoreLabel):''}${m.date?' · '+esc2(m.date):''}</td>
    </tr>`).join('');
}

function renderTop10(){
  const box=document.getElementById('topList');
  box.innerHTML=SDATA.consensus.slice(0,10).map(c=>`
    <div class="top-card ${c.rank<=3?'g'+c.rank:''}">
      <div class="place">${c.rank}</div>
      <div>
        <div class="nm">${esc2(c.name)}</div>
        <div class="sub">${esc2(c.provider||'—')}${c.release?' · релиз '+esc2(c.release):''} · консенсус ${num(c.score)}/100 · подтверждено ${c.coverage} из 6 источников${c.openSource?' · открытые веса':''}</div>
        <div class="per-src">${Object.entries(c.per).sort((a,b)=>a[1].rank-b[1].rank).map(([k,v])=>`<span class="${v.rank===1?'r1':''}">${SRCLABEL[k]}: #${v.rank}</span>`).join('')}</div>
        <div class="pc">
          <div class="pros"><div class="hdr">Плюсы</div><ul>${(c.pros||[]).map(p=>`<li>${esc2(p)}</li>`).join('')||'<li>—</li>'}</ul></div>
          <div class="cons"><div class="hdr">Минусы</div><ul>${(c.cons||[]).map(p=>`<li>${esc2(p)}</li>`).join('')||'<li>—</li>'}</ul></div>
        </div>
      </div>
    </div>`).join('');
}

loadSources();