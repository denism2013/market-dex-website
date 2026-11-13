const assert=require('node:assert/strict');
const studies=require('../technical-studies.js');
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
const bar=(i,c=10+i,v=100)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:c,high:c+1,low:c-1,close:c,volume:v});
const trend=Array.from({length:65},(_,i)=>bar(i)), result=studies.compute(trend);
// Known arithmetic seeds and a one-step Wilder update, independent of implementation.
near(result.ema9[8],14);near(result.ema9[9],15);assert.equal(result.ema9[7],null);
near(result.atr14[13],2);assert.equal(result.atr14[12],null);
const shock=trend.slice(0,15).map(b=>({...b}));shock[14]={...shock[14],open:28,high:30,low:27,close:29};near(studies.compute(shock).trueRange[14],7);near(studies.compute(shock).atr14[14],33/14);
// 14 complete transitions produce DMI at bar 15; average 14 DX values => ADX bar 28.
assert.equal(result.plusDI[13],null);near(result.plusDI[14],50);near(result.minusDI[14],0);assert.equal(result.adx14[26],null);near(result.adx14[27],100);
const down=Array.from({length:45},(_,i)=>bar(i,100-i));const bearish=studies.compute(down);near(bearish.plusDI[14],0);near(bearish.minusDI[14],50);near(bearish.adx14[27],100);
// Fast stochastic, not a slow 3,3-smoothed K. Highest24, lowest9, close23.
near(result.stochK[13],100*14/15);assert.equal(result.stochD[14],null);near(result.stochD[15],100*14/15);
near(result.obv[0],0);near(result.obv[3],300);near(result.cmf20[19],0);near(result.mfi14[14],100);
const alternate=Array.from({length:15},(_,i)=>bar(i,i%2?11:10,2));near(studies.compute(alternate).mfi14[14],100*154/(154+140));
const flat=Array.from({length:40},(_,i)=>({...bar(i,10),high:10,low:10}));const fl=studies.compute(flat);near(fl.atr14[13],0);near(fl.adx14[27],0);assert.equal(fl.stochK[13],null);assert.equal(fl.mfi14[14],null);near(fl.cmf20[19],0);
const zeros=studies.compute(trend.map(b=>({...b,volume:0})));assert.equal(zeros.anchoredVwap[30],null);assert.equal(zeros.rollingVwap20[30],null);assert.equal(zeros.cmf20[30],null);assert.equal(zeros.mfi14[30],null);near(zeros.obv[30],0);
const anchor=studies.compute(trend,{anchorDate:trend[2].date});assert.equal(anchor.anchoredVwap[1],null);near(anchor.anchoredVwap[2],12);near(anchor.anchoredVwap[3],12.5);near(anchor.rollingVwap20[19],19.5);
const missingAnchor=studies.compute(trend,{anchorDate:'2025-12-31'});assert.equal(missingAnchor.anchorIndex,-1);assert.ok(missingAnchor.anchoredVwap.every(x=>x===null));
const bad=trend.map(b=>({...b}));bad[10].high=1;bad[10].volume=null;const interrupted=studies.compute(bad);assert.equal(interrupted.atr14[23],null);near(interrupted.atr14[24],2);assert.equal(interrupted.plusDI[24],null);near(interrupted.plusDI[25],50);assert.equal(interrupted.adx14[37],null);near(interrupted.adx14[38],100);assert.equal(interrupted.obv[10],null);near(interrupted.obv[11],0);assert.deepEqual(interrupted.obvResets,[0,11]);assert.ok(interrupted.anchoredVwap.slice(10).every(x=>x===null));assert.equal(interrupted.stochK[23],null);assert.notEqual(interrupted.stochK[24],null);
// A new current-session high cannot change today's prior-20-session channel.
const breakout=trend.map(b=>({...b}));breakout[20]={...breakout[20],high:60,close:50,open:30};near(studies.compute(breakout).donchianUpper[20],30);near(result.donchianLower[20],9);assert.equal(result.donchianUpper[19],null);
const fib=studies.fibonacci(trend.slice(0,10));near(fib.high,20);near(fib.low,9);near(fib.levels.find(l=>l.ratio===.618).price,20-11*.618);assert.equal(studies.fibonacci(bad),null);assert.equal(studies.fibonacci(flat),null);
// Future bars cannot alter any already-computed causal indicator reading.
for(let n=1;n<=trend.length;n++){const prefix=studies.compute(trend.slice(0,n));for(const [key,array]of Object.entries(result)){if(!Array.isArray(array)||key==='obvResets')continue;assert.deepEqual(prefix[key],array.slice(0,n),`${key} prefix ${n}`);}}
console.log('Advanced studies: independent seeds/formulas, ATR/DMI/ADX timing, fast stochastic, CMF/MFI/OBV, exact anchors, zero/missing input recovery, prior-only channels and causal prefixes passed.');
