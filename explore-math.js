'use strict';
(() => {
 const MAG7=['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA'];
 const finite=n=>Number.isFinite(n)&&n>0;
 function lookup(series){return new Map((series?.history||[]).filter(b=>finite(b.close)).map(b=>[b.date,b.close]));}
 function endpoints(series,days){const h=series?.history||[];return h.length>days?[h[h.length-1-days].date,h.at(-1).date]:null;}
 function change(series,pair){if(!pair)return null;const m=lookup(series),a=m.get(pair[0]),b=m.get(pair[1]);return finite(a)&&finite(b)?(b/a-1)*100:null;}
 function ratio(series,top,bottom){const names=[...(top==='MAG7'?MAG7:[top]),bottom],maps=names.map(n=>lookup(series[n]));if(maps.some(m=>!m.size))return[];const dates=[...maps[0].keys()].filter(d=>maps.every(m=>m.has(d))).sort();if(!dates.length)return[];const base=maps.map(m=>m.get(dates[0]));return dates.map(date=>{const numerator=top==='MAG7'?MAG7.reduce((s,_,i)=>s+maps[i].get(date)/base[i],0)/7:maps[0].get(date)/base[0];const denominator=maps.at(-1).get(date)/base.at(-1);return {date,close:numerator/denominator*100};});}
 function ranking(index,series,pair){return (index?.members||[]).map(m=>({...m,value:change(series[m.symbol],pair),status:series[m.symbol]?.status})).filter(m=>Number.isFinite(m.value)).sort((a,b)=>b.value-a.value||a.symbol.localeCompare(b.symbol));}
 function project(lat,lon,rotation,tilt){const a=lat*Math.PI/180,b=(lon+rotation)*Math.PI/180,c=tilt*Math.PI/180,x=Math.cos(a)*Math.sin(b),y=Math.sin(a),z=Math.cos(a)*Math.cos(b);return {x,y:y*Math.cos(c)-z*Math.sin(c),z:y*Math.sin(c)+z*Math.cos(c)};}
 const api={MAG7,lookup,endpoints,change,ratio,ranking,project};if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.MDX_EXPLORE_MATH=api;
})();
