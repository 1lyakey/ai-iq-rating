// Параллельная проверка доступности источников (server-side, без CORS)
const URLS=[
  ['aiiq','https://www.aiiq.org/api/v1/models'],
  ['arena','https://lmarena.ai/leaderboard/text'],
  ['livebench','https://livebench.ai/'],
  ['livebench-csv','https://livebench.ai/table_2025_05_30.csv'],
  ['matharena','https://matharena.ai/'],
  ['arcprize','https://arcprize.org/leaderboard'],
  ['swebench','https://www.swebench.com/'],
  ['epoch','https://epoch.ai/data/ai_benchmarking_dashboard'],
  ['openrouter','https://openrouter.ai/rankings'],
  ['aa','https://artificialanalysis.ai/leaderboards/models'],
  ['aider','https://aider.chat/docs/leaderboards/'],
  ['superclue','https://www.superclueai.com/'],
  ['helm','https://crfm.stanford.edu/helm/classic/latest/'],
  ['vals','https://vals.ai/']
];

async function probe(name,url){
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),9000);
  try{
    const r=await fetch(url,{signal:ctl.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'}});
    const txt=await r.text();
    clearTimeout(t);
    return {name,url,status:r.status,size:txt.length,ok:r.ok};
  }catch(e){
    clearTimeout(t);
    return {name,url,status:0,size:0,ok:false,err:e.name};
  }
}

const res=await Promise.all(URLS.map(([n,u])=>probe(n,u)));
res.forEach(r=>{
  const mark=r.ok?'OK  ':'FAIL';
  console.log(`${mark} ${String(r.status).padEnd(4)} ${String(r.size).padStart(8)}b  ${r.name.padEnd(16)} ${r.err||''}`);
});