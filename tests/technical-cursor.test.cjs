const assert=require('node:assert/strict'),cursor=require('../technical-cursor.js');
const w=980,left=12,right=58,n=63,rect={left:100,width:980};
for(const i of [0,1,17,31,61,62])assert.equal(cursor.nearestIndex(100+12+i*(w-70)/(n-1),rect,w,left,right,n),i);
// A CSS-scaled canvas must identify the same dated bar as its internal plot.
const scaled={left:40,width:490};for(const i of [0,12,31,62])assert.equal(cursor.nearestIndex(40+(12+i*(w-70)/(n-1))*.5,scaled,w,left,right,n),i);
assert.equal(cursor.nearestIndex(-500,rect,w,left,right,n),0);assert.equal(cursor.nearestIndex(5000,rect,w,left,right,n),62);assert.equal(cursor.nearestIndex(200,{left:0,width:0},w,left,right,n),null);assert.equal(cursor.nearestIndex(200,rect,w,left,right,0),null);
assert.equal(cursor.valueAt({values:[null,123.456],prefix:'$'},0),'Unavailable');assert.equal(cursor.valueAt({values:[null,123.456],prefix:'$'},1),'$123.46');assert.equal(cursor.valueAt({values:['Doji']},0),'Doji');assert.equal(cursor.valueAt({text:'Window proxy'},50),'Window proxy');
console.log('Chart cursor: exact plotted coordinates, CSS scaling, clamped bounds and unavailable/static value labels passed.');
