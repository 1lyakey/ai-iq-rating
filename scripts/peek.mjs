import fs from 'fs';
const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
async function get(url){const r=await fetch(url,{headers:UA});return await r.text();}

const lb=await get('https://livebench.ai/table_2025_05_30.csv');
console.log('=== LIVEBENCH CSV (first 1200) ===');
console.log(lb.slice(0,1200));

const arc=await get('https://arcprize.org/leaderboard');
const arcText=arc.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log('\n=== ARC PRIZE (first 1500 of text) ===');
console.log(arcText.slice(0,1500));

const sc=await get('https://www.superclueai.com/');
console.log('\n=== SUPERCLUE (first 800) ===');
console.log(sc.slice(0,800));