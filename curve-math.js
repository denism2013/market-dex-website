'use strict';
(() => {
 function sample(rows,limit=100,selectedDate){if(rows.length<=limit)return rows;const indices=new Set(Array.from({length:limit},(_,i)=>Math.round(i*(rows.length-1)/(limit-1))));const chosen=rows.findIndex(r=>r.date===selectedDate);if(chosen>=0&&!indices.has(chosen)){const replace=[...indices].filter(i=>i!==0&&i!==rows.length-1).sort((a,b)=>Math.abs(a-chosen)-Math.abs(b-chosen))[0];indices.delete(replace);indices.add(chosen);}return [...indices].sort((a,b)=>a-b).map(i=>rows[i]);}
 function nearest(points,x,y,radius=24){let best=null,distance=radius*radius;for(const p of points){const d=(p.x-x)**2+(p.y-y)**2;if(d<=distance){distance=d;best=p;}}return best;}
 const api={sample,nearest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.MDX_CURVE_MATH=api;
})();
