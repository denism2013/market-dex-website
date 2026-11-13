'use strict';
(() => {
 const $=id=>document.querySelector(id);let enabled=true,volume=.65,started=false,intro=null,pool=[],cursor=0;
 try{enabled=localStorage.getItem('mdx-arcade-sound')!=='off';const saved=Number(localStorage.getItem('mdx-arcade-volume'));if(saved>0&&saved<=1)volume=saved;}catch{}
 function save(){try{localStorage.setItem('mdx-arcade-sound',enabled?'on':'off');localStorage.setItem('mdx-arcade-volume',String(volume));}catch{}}
 function status(message){$('#soundStatus').textContent=message;$('#audioPlaybackStatus').textContent=message;}
 function paint(){const b=$('#soundToggle');b.textContent=enabled?'♪ Sound on':'♪ Sound off';b.setAttribute('aria-pressed',String(enabled));b.title='Enable or mute arcade audio. Test sound opens a real audio player.';}
 function volumes(){for(const a of [intro,...pool])if(a){a.volume=volume;a.muted=!enabled;}$('#soundVolume').value=String(Math.round(volume*100));$('#soundVolumeValue').textContent=Math.round(volume*100)+'%';}
 function failed(error){status(error?.name==='NotAllowedError'?'Playback blocked. Press Play in the audio player to allow sound.':'Audio could not play. Try opening the tune directly below.');}
 function playIntro(){enabled=true;save();paint();volumes();intro.pause();intro.currentTime=0;const promise=intro.play();promise?.catch(failed);}
 function click(){if(!enabled||!started)return;const a=pool[cursor++%pool.length];a.currentTime=0;a.play()?.catch(()=>{});}
 function activate(event){if(event.target.closest('#soundToggle,#soundReplay,#soundSettings,#soundDialog'))return;if(intro&&enabled&&!started){started=true;playIntro();}}
 document.addEventListener('pointerdown',activate,{capture:true,passive:true});document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))activate(event);},true);
 document.addEventListener('click',event=>{if(!event.target.closest('#soundToggle,#soundReplay,#soundSettings,#soundDialog')&&event.target.closest('button,a,select,summary,[role="tab"]'))click();},true);window.addEventListener('mdx:ui-click',click);
 document.addEventListener('DOMContentLoaded',()=>{
  intro=$('#startupAudio');pool=Array.from({length:3},()=>{const a=new Audio('assets/arcade-click.wav');a.preload='auto';return a;});paint();volumes();status(enabled?'Sound enabled. First interaction starts the tune; Test sound opens the player.':'Sound muted.');
  intro.addEventListener('playing',()=>{started=true;status('Playing the original arcade startup tune.');});intro.addEventListener('ended',()=>status('Startup tune finished. Interface click sounds are enabled.'));intro.addEventListener('error',()=>failed());intro.addEventListener('play',()=>{enabled=true;save();paint();volumes();});
  $('#soundToggle').addEventListener('click',()=>{if(enabled){enabled=false;for(const a of [intro,...pool])a.pause();save();paint();volumes();status('Sound muted.');}else{started=true;playIntro();}});
  $('#soundReplay').addEventListener('click',()=>{$('#soundDialog').showModal();started=true;playIntro();});$('#soundSettings').addEventListener('click',()=>$('#soundDialog').showModal());$('#soundVolume').addEventListener('input',event=>{volume=Number(event.target.value)/100;save();volumes();});
 });
})();
