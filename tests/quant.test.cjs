const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.runInNewContext(fs.readFileSync('quant-core.js','utf8'),context);const q=context.MDX_QUANT;
const bars=Array.from({length:120},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close:100+i}));
assert.ok(q.validate(bars));assert.ok(!q.validate([bars[1],bars[0]]));assert.ok(!q.validate([{date:'2025-01-01',close:NaN}]));
assert.ok(Math.abs(q.backtest(bars,Array(120).fill(1),0).total-(219/101-1))<1e-12);
const shock=[{date:'2025-01-01',close:100},{date:'2025-01-02',close:200},{date:'2025-01-03',close:200},{date:'2025-01-04',close:200}];
assert.equal(q.backtest(shock,[0,1,0,0],0).total,0); // Signal on price jump cannot capture that jump.
assert.equal(q.backtest(shock,[0,1,0,0],10).turnover,2);assert.ok(q.backtest(shock,[0,1,0,0],10).total<0);
assert.equal(q.forward(bars,Array(120).fill(1),20).length,5);assert.equal(q.bootstrap([1,2]),null);
const ci=q.bootstrap(Array(20).fill(.01));assert.ok(Math.abs(ci.low-.01)<1e-12&&Math.abs(ci.high-.01)<1e-12);
console.log('Quant: validation, lagged execution, costs, non-overlap and bootstrap passed');
