const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(preference='on',block=false,savedVolume=null){
 const handlers={},els={},storage={'mdx-arcade-sound':preference,'mdx-arcade-volume':savedVolume};
 function element(){return {textContent:'',volume:1,muted:false,currentTime:0,plays:0,events:{},classList:{active:false,add(){this.active=true},remove(){this.active=false}},addEventListener(k,f){this.events[k]=f;},setAttribute(k,v){this[k]=v;},pause(){},showModal(){this.open=true;},play(){this.plays++;if(block)return Promise.reject({name:'NotAllowedError'});this.events.play?.();this.events.playing?.();return Promise.resolve();}};}
 for(const id of ['soundToggle','soundStatus','audioPlaybackStatus','startupAudio','soundVolume','soundVolumeValue','soundReplay','soundSettings','soundDialog'])els['#'+id]=element();els['.hero-logo']=element();
 class Audio{constructor(){Object.assign(this,element());}}
 vm.runInNewContext(fs.readFileSync('sound.js','utf8'),{Audio,window:{addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem(k,v){storage[k]=v;}},document:{querySelector:s=>els[s],addEventListener(k,f){handlers[k]=f;}},console});
 handlers.DOMContentLoaded();return {handlers,els,storage,unblock(){block=false;}};
}
(async()=>{
 const a=setup();assert.equal(a.els['#startupAudio'].plays,0);a.els['#soundToggle'].events.click();assert.equal(a.els['#startupAudio'].plays,1);assert.equal(a.els['.hero-logo'].classList.active,true);
 a.els['#startupAudio'].events.ended();assert.equal(a.els['.hero-logo'].classList.active,false);
 a.els['#soundReplay'].events.click();assert.equal(a.els['#startupAudio'].plays,2);assert.equal(a.els['#soundDialog'].open,true);
 a.els['#soundToggle'].events.click();assert.equal(a.storage['mdx-arcade-sound-v2'],'off');assert.equal(a.els['#startupAudio'].muted,true);
 a.els['#soundToggle'].events.click();assert.equal(a.els['#startupAudio'].plays,3);
 a.els['#soundVolume'].events.input({target:{value:'25'}});assert.equal(a.els['#startupAudio'].volume,.25);
 const b=setup('on',true);assert.equal(b.els['#startupAudio'].plays,0);b.els['#soundReplay'].events.click();await Promise.resolve();assert.match(b.els['#soundStatus'].textContent,/Autoplay blocked/);assert.equal(b.els['.hero-logo'].classList.active,false);b.unblock();b.handlers.pointerdown({target:{closest:()=>null}});assert.equal(b.els['#startupAudio'].plays,2);assert.equal(b.els['.hero-logo'].classList.active,true);
 const c=setup('off',false,'0');assert.equal(c.els['#startupAudio'].plays,0);assert.equal(c.els['#startupAudio'].volume,0);c.handlers.pointerdown({target:{closest:()=>null}});assert.equal(c.els['#startupAudio'].plays,0);
 console.log('Audio passed: default-off, explicit play, blocked fallback, logo synchronization, replay, mute, saved-off and zero volume.');
})().catch(e=>{console.error(e);process.exitCode=1;});
