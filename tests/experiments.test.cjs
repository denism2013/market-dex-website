const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync('experiments/originals.json','utf8'));
for(const [key,meta] of Object.entries(manifest)){
 const bytes=fs.readFileSync(meta.hosted_path),html=bytes.toString();
 assert.equal(digest(bytes),meta.hosted_sha256||meta.sha256);
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
 for(const [,attr,script] of scripts)if(!attr.includes('text/plain'))new vm.Script(script);
 if(key==='atlas')assert.equal(digest(scripts[3][2]),meta.protected_sphere_sha256);
}
const wav=fs.readFileSync('assets/arcade-startup.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(40)/wav.readUInt32LE(28),3);
const index=fs.readFileSync('index.html','utf8');for(const key of ['atlas','company','chips','galaxy'])assert(index.includes(`data-lab-open="${key}"`));
console.log('Original application fingerprints, protected sphere, inline JS syntax, four launchers and 3-second WAV passed.');
