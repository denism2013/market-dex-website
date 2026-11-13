/* Market-DEX daily-bar studies. No external dependencies, inferred bars or forecasts.
 * All averages require contiguous valid inputs. EMA seeds with an SMA; Wilder's
 * RMA seeds with an SMA then updates (prior*(n-1)+value)/n. ATR starts with H-L
 * on the first valid bar. DMI requires previous valid OHLC: DI14 starts at index
 * 14, ADX14 at index 27 (28 bars), on complete inputs. Missing values reset
 * recursive smoothing. The API preserves input indices and never sorts silently.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MDX_STUDIES=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const finite=Number.isFinite, positive=v=>finite(v)&&v>0;
 const validOHLC=b=>!!b&&['open','high','low','close'].every(k=>positive(b[k]))&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&b.low<=b.high;
 const validVolume=b=>!!b&&finite(b.volume)&&b.volume>=0;
 function average(values,n,wilder=false){let seed=[],last=null;return values.map(v=>{if(!finite(v)){seed=[];last=null;return null;}if(last===null){seed.push(v);if(seed.length<n)return null;last=seed.reduce((s,x)=>s+x,0)/n;}else last+=(v-last)*(wilder?1/n:2/(n+1));return last;});}
 function rolling(values,n,fn){return values.map((_,i)=>{if(i<n-1)return null;const w=values.slice(i-n+1,i+1);return w.every(finite)?fn(w):null;});}
 function compute(bars,options={}){
  const length=bars.length,empty=()=>Array(length).fill(null),closes=bars.map(b=>positive(b?.close)?b.close:null),ohlc=bars.map(validOHLC);
  const trueRange=empty(),plusDM=empty(),minusDM=empty(),typical=bars.map((b,i)=>ohlc[i]?(b.high+b.low+b.close)/3:null);
  for(let i=0;i<length;i++)if(ohlc[i]){const b=bars[i],a=bars[i-1];trueRange[i]=i>0&&ohlc[i-1]?Math.max(b.high-b.low,Math.abs(b.high-a.close),Math.abs(b.low-a.close)):b.high-b.low;if(i>0&&ohlc[i-1]){const up=b.high-a.high,down=a.low-b.low;plusDM[i]=up>down&&up>0?up:0;minusDM[i]=down>up&&down>0?down:0;}}
  const ema9=average(closes,9),ema21=average(closes,21),ema20=average(closes,20),atr14=average(trueRange,14,true),atr20=average(trueRange,20,true);
  // The DMI denominator has the same transitions and seed interval as +/-DM.
  const transitionTR=trueRange.map((v,i)=>i>0&&ohlc[i]&&ohlc[i-1]?v:null),tr14=average(transitionTR,14,true),p14=average(plusDM,14,true),m14=average(minusDM,14,true),plusDI=empty(),minusDI=empty(),dx=empty();
  for(let i=0;i<length;i++)if(finite(tr14[i])&&finite(p14[i])&&finite(m14[i])){plusDI[i]=tr14[i]>0?100*p14[i]/tr14[i]:0;minusDI[i]=tr14[i]>0?100*m14[i]/tr14[i]:0;const sum=plusDI[i]+minusDI[i];dx[i]=sum>0?100*Math.abs(plusDI[i]-minusDI[i])/sum:0;}
  const adx14=average(dx,14,true),stochK=empty(),cmf20=empty(),positiveFlow=empty(),negativeFlow=empty(),mfi14=empty(),obv=empty(),obvResets=[];
  const keltnerUpper=empty(),keltnerLower=empty(),donchianUpper=empty(),donchianLower=empty();
  for(let i=0;i<length;i++){
   if(i>=13&&ohlc.slice(i-13,i+1).every(Boolean)){const w=bars.slice(i-13,i+1),lo=Math.min(...w.map(b=>b.low)),hi=Math.max(...w.map(b=>b.high));if(hi>lo)stochK[i]=100*(bars[i].close-lo)/(hi-lo);}
   if(finite(ema20[i])&&finite(atr20[i])){keltnerUpper[i]=ema20[i]+2*atr20[i];keltnerLower[i]=ema20[i]-2*atr20[i];}
   if(i>=20&&ohlc.slice(i-20,i).every(Boolean)){const w=bars.slice(i-20,i);donchianUpper[i]=Math.max(...w.map(b=>b.high));donchianLower[i]=Math.min(...w.map(b=>b.low));}
   if(positive(closes[i])&&validVolume(bars[i])){if(i===0||!finite(obv[i-1])||!positive(closes[i-1])){obv[i]=0;obvResets.push(i);}else obv[i]=obv[i-1]+Math.sign(closes[i]-closes[i-1])*bars[i].volume;}
   if(i>=19&&bars.slice(i-19,i+1).every(b=>validOHLC(b)&&validVolume(b))){const w=bars.slice(i-19,i+1),vol=w.reduce((s,b)=>s+b.volume,0);if(vol>0)cmf20[i]=w.reduce((s,b)=>s+(b.high===b.low?0:((b.close-b.low)-(b.high-b.close))/(b.high-b.low))*b.volume,0)/vol;}
   if(i>0&&ohlc[i]&&ohlc[i-1]&&validVolume(bars[i])){const raw=typical[i]*bars[i].volume;positiveFlow[i]=typical[i]>typical[i-1]?raw:0;negativeFlow[i]=typical[i]<typical[i-1]?raw:0;}
   if(i>=14){const p=positiveFlow.slice(i-13,i+1),m=negativeFlow.slice(i-13,i+1);if(p.every(finite)&&m.every(finite)){const ps=p.reduce((a,b)=>a+b,0),ms=m.reduce((a,b)=>a+b,0);if(ps+ms>0)mfi14[i]=100*ps/(ps+ms);}}
  }
  const stochD=rolling(stochK,3,w=>w.reduce((a,b)=>a+b,0)/3),rollingVwap20=empty(),anchoredVwap=empty();
  const anchorDate=options.anchorDate??bars[0]?.date??null,anchorIndex=bars.findIndex(b=>b.date===anchorDate);let volumeSum=0,weightedSum=0,anchorBroken=false;
  for(let i=0;i<length;i++){
   if(i>=19){const w=bars.slice(i-19,i+1);if(w.every(b=>validOHLC(b)&&validVolume(b))){const vol=w.reduce((s,b)=>s+b.volume,0);if(vol>0)rollingVwap20[i]=w.reduce((s,b)=>s+(b.high+b.low+b.close)/3*b.volume,0)/vol;}}
   if(anchorIndex>=0&&i>=anchorIndex){if(!ohlc[i]||!validVolume(bars[i]))anchorBroken=true;if(!anchorBroken){volumeSum+=bars[i].volume;weightedSum+=typical[i]*bars[i].volume;if(volumeSum>0)anchoredVwap[i]=weightedSum/volumeSum;}}
  }
  return {plusDI14:plusDI,minusDI14:minusDI,avwap:anchoredVwap,keltnerMiddle:ema20,ema9,ema21,ema20,trueRange,atr14,atr20,plusDI,minusDI,dx,adx14,stochK,stochD,obv,obvResets,cmf20,mfi14,keltnerUpper,keltnerLower,donchianUpper,donchianLower,anchoredVwap,rollingVwap20,anchorDate,anchorIndex,anchorBroken};
 }
 // Selected-range retracements are retrospective context, not causal signals.
 function fibonacci(bars){if(!bars.length||!bars.every(validOHLC))return null;const high=Math.max(...bars.map(b=>b.high)),low=Math.min(...bars.map(b=>b.low));if(high<=low)return null;return {high,low,from:bars[0].date,to:bars.at(-1).date,levels:[0,.236,.382,.5,.618,.786,1].map(ratio=>({ratio,price:high-(high-low)*ratio}))};}
 return {compute,fibonacci,validOHLC,ema:(values,n)=>average(values,n),wilder:(values,n)=>average(values,n,true)};
});
