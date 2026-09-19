const API_URL='https://www.aiiq.org/api/v1/models';
const REFRESH_MS=60000; // обновление раз в минуту
const FLAG={'United States':'🇺🇸','China':'🇨🇳','Japan':'🇯🇵','Singapore':'🇸🇬','South Korea':'🇰🇷','France':'🇫🇷','Canada':'🇨🇦','United Kingdom':'🇬🇧','Germany':'🇩🇪','Israel':'🇮🇱','India':'🇮🇳','Russia':'🇷🇺','United Arab Emirates':'🇦🇪'};
let MODELS=[]; // name, provider, flag, iq, releaseDate

const tbody=document.getElementById('tbody');
const searchEl=document.getElementById('search');
const compSel=document.getElementById('companyFilter');
const sortSel=document.getElementById('sortSel');
let chart=null,lastUpdate=null;

function statusBadge(txt,ok){
  const b=document.getElementById('liveBadge');
  if(b){b.textContent=txt;b.style.borderColor=ok?'#3ddc84':'#ff6b6b';}
}

async function loadData(silent){
  try{
    const r=await fetch(API_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    const top=d.models.filter(m=>m.iq!=null).sort((a,b)=>b.iq-a.iq).slice(0,100)
      .map(m=>[m.name,m.provider,FLAG[m.country]||'🏳️',m.iq,m.releaseDate||'']);
    if(!top.length)throw new Error('empty');
    MODELS=top;lastUpdate=new Date(d.updatedAt||Date.now());
    rebuildCompanyFilter();
    statusBadge('🟢 Live · данные aiiq.org от '+lastUpdate.toLocaleString('ru-RU'),true);
    render();
    if(!chart)buildChart();else updateChart();
  }catch(e){
    statusBadge('🔴 Ошибка обновления ('+e.message+') — показаны последние данные',false);
    if(!MODELS.length){
      if(typeof MODELS_SNAPSHOT!=='undefined'&&MODELS_SNAPSHOT.length){MODELS=MODELS_SNAPSHOT;rebuildCompanyFilter();render();if(!chart)buildChart();}
      else tbody.innerHTML='<tr><td colspan="7" style="padding:24px;text-align:center;color:#ff9d9d">Не удалось загрузить данные: '+e.message+'</td></tr>';
    }
  }
}

function rebuildCompanyFilter(){
  const cur=compSel.value;
  compSel.innerHTML='<option value="">Все компании</option>';
  [...new Set(MODELS.map(m=>m[1]))].sort().forEach(c=>{
    const o=document.createElement('option');o.value=o.textContent=c;compSel.appendChild(o);
  });
  if([...compSel.options].some(o=>o.value===cur))compSel.value=cur;
}

function iqClass(iq){return iq>=125?'hi':iq>=95?'mid':'lo';}
function render(){
  const q=searchEl.value.trim().toLowerCase();
  const comp=compSel.value;
  let rows=MODELS.filter(m=>(!comp||m[1]===comp)&&(!q||m[0].toLowerCase().includes(q)||m[1].toLowerCase().includes(q)));
  const s=sortSel.value;
  if(s==='iq-desc')rows.sort((a,b)=>b[3]-a[3]);
  else if(s==='iq-asc')rows.sort((a,b)=>a[3]-b[3]);
  else if(s==='name')rows.sort((a,b)=>a[0].localeCompare(b[0]));
  else if(s==='date')rows.sort((a,b)=>(b[4]||'').localeCompare(a[4]||''));
  else rows.sort((a,b)=>a[1].localeCompare(b[1]));
  const max=Math.max(...MODELS.map(m=>m[3]),1);
  tbody.innerHTML=rows.map((m,i)=>{
    const rc=(s==='iq-desc'&&!q&&!comp)?(i===0?'r1':i===1?'r2':i===2?'r3':''):'';
    const w=Math.round(m[3]/max*100);
    return `<tr><td class="rank ${rc}">${i+1}</td>
      <td class="model">${m[0]}</td>
      <td class="company">${m[1]}</td><td><span class="flag">${m[2]}</span></td>
      <td class="company">${m[4]||'—'}</td>
      <td class="iq ${iqClass(m[3])}">${m[3]}</td>
      <td><span class="bar" style="width:${w}px"></span></td></tr>`;
  }).join('');
  const top=[...MODELS].sort((a,b)=>b[3]-a[3])[0];
  document.getElementById('stats').innerHTML=`
    <div class="stat"><div class="num">${rows.length}</div><div class="lbl">моделей показано</div></div>
    <div class="stat"><div class="num">${MODELS.length}</div><div class="lbl">всего в рейтинге</div></div>
    <div class="stat"><div class="num">${max}</div><div class="lbl">макс. IQ — ${top?top[0]:'—'}</div></div>
    <div class="stat"><div class="num">${[...new Set(MODELS.map(m=>m[1]))].length}</div><div class="lbl">компаний</div></div>`;
}
searchEl.addEventListener('input',render);
compSel.addEventListener('change',render);
sortSel.addEventListener('change',render);
document.querySelectorAll('thead th[data-k]').forEach(th=>th.addEventListener('click',()=>{
  const k=th.dataset.k;
  if(k==='iq')sortSel.value='iq-desc';
  else if(k==='name')sortSel.value='name';
  else if(k==='company')sortSel.value='company';
  else if(k==='date')sortSel.value='date';
  render();
}));

function chartData(){
  const top25=[...MODELS].sort((a,b)=>b[3]-a[3]).slice(0,25);
  return{labels:top25.map(m=>m[0]),data:top25.map(m=>m[3]),
    colors:top25.map((m,i)=>i<3?'rgba(255,209,102,.85)':`hsla(${230+i*3},70%,60%,.75)`)};
}
function buildChart(){
  const c=chartData();
  chart=new Chart(document.getElementById('chart'),{
    type:'bar',
    data:{labels:c.labels,datasets:[{data:c.data,backgroundColor:c.colors,borderRadius:6}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:t=>` IQ: ${t.raw}  (${t.label})`}}},
      scales:{x:{min:0,max:150,grid:{color:'#243049'},ticks:{color:'#8b95a9'},
        title:{display:true,text:'IQ (aiiq.org)',color:'#8b95a9'}},
        y:{grid:{display:false},ticks:{color:'#e5e9f0',font:{size:11}}}}}
  });
}
function updateChart(){
  const c=chartData();
  chart.data.labels=c.labels;
  chart.data.datasets[0].data=c.data;
  chart.data.datasets[0].backgroundColor=c.colors;
  chart.update('none');
}

loadData();
setInterval(()=>loadData(true),REFRESH_MS);
