const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},document:{addEventListener(){}},console};vm.runInNewContext(fs.readFileSync('technical.js','utf8'),context);
const calc=context.window.MDX_TECH.indicators;
const bars=Array.from({length:220},(_,i)=>({close:100+i,volume:1000}));
let x=calc(bars);assert.equal(x.s200.at(-1),219.5);assert.equal(x.rsi,100);assert.equal(x.relativeVolume,1);assert.ok(Math.abs(x.macd.at(-1)-7)<1e-10);assert.ok(Math.abs(x.signal.at(-1)-7)<1e-10);
x=calc(bars.map(b=>({...b,close:100})));assert.equal(x.rsi,50);assert.equal(x.macd.at(-1),0);
x=calc(bars.map((b,i)=>({...b,close:400-i})));assert.equal(x.rsi,0);
x=calc(bars.slice(0,14));assert.equal(x.rsi,null);assert.equal(x.s20.at(-1),null);assert.equal(x.signal.at(-1),null);assert.equal(x.relativeVolume,null);
x=calc(bars.map((b,i)=>({...b,volume:i===210?null:1000})));assert.equal(x.relativeVolume,null);
// Wilder's published example seed and first smoothing step.
x=calc([44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00].map(close=>({close,volume:1})));assert.ok(Math.abs(x.rsi-66.2496)<.001);
console.log('Technical indicators: trend, flat, loss-only, warm-up, missing volume and Wilder reference passed.');
