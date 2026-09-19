const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
async function txt(url){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),10000);
  try{const r=await fetch(url,{headers:UA,signal:ctl.signal});clearTimeout(t);return r.ok?await r.text():'';}
  catch(e){clearTimeout(t);return '';}
}
// свежесть LiveBench CSV
const cands=['table_2025_11_30.csv','table_2026_05_30.csv','table_2026_06_30.csv','table_2026_09_01.csv','table_2026_08_30.csv','table_latest.csv'];
for(const c of cands){
  const body=await txt('https://livebench.ai/'+c);
  console.log('LiveBench',c,body?('OK '+body.length+'b :: '+body.slice(0,110).replace(/\n/g,' | ')):'-');
}
// SWE-bench results.json структура
const r=await txt('https://raw.githubusercontent.com/SWE-bench/experiments/main/evaluation/verified/20260901_mini-v2.4.2_gemini-3-5-flash/results/results.json');
console.log('\nSWE results.json (first 400):');
console.log(r.slice(0,400));