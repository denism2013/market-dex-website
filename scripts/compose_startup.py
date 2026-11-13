"""Original Market-DEX 'Circuit Bloom' cue. Deterministic stereo synthesis, 3 seconds."""
from pathlib import Path
import wave
import numpy as np
SR=44100;N=SR*3
mix=np.zeros((N,2),dtype=np.float64)
def freq(note):return 440*2**((note-69)/12)
def add(t,d,notes,amp=.1,kind='lead',pan=0):
 n=min(int(d*SR),N-int(t*SR));x=np.arange(n)/SR
 if n<=0:return
 env=np.minimum(1,x/.009)*np.minimum(1,np.maximum(0,d-x)/(.085 if kind=='lead' else .15))
 env*=np.exp(-x*(2.1 if kind=='lead' else .6))
 tone=np.zeros(n)
 for note in notes:
  f=freq(note)
  if kind=='bass':
   v=np.sin(2*np.pi*f*x)+.19*np.sin(2*np.pi*3*f*x)/3+.1*np.sin(2*np.pi*5*f*x)/5
  elif kind=='pad':
   v=np.sin(2*np.pi*f*x)+.22*np.sin(2*np.pi*(2*f+.4)*x)
  else:
   # Band-limited, softly rounded pulse; softened upper partials instead of a raw square.
   v=np.sin(2*np.pi*f*x)+.28*np.sin(2*np.pi*2*f*x)+.13*np.sin(2*np.pi*3*f*x)+.045*np.sin(2*np.pi*5*f*x)
   v+=.09*np.sin(2*np.pi*f*1.002*x)
  tone+=v/len(notes)
 tone*=env*amp;start=int(t*SR)
 mix[start:start+n,0]+=tone*np.sqrt((1-pan)/2);mix[start:start+n,1]+=tone*np.sqrt((1+pan)/2)
# A new minor-pentatonic call-and-answer with a bright ninth in the final chord.
for t,n,d in [(0,64,.14),(.1875,67,.14),(.375,71,.20),(.65625,74,.11),(.84375,76,.25),(1.21875,79,.14),(1.40625,76,.14),(1.59375,74,.14),(1.78125,71,.18),(2.0625,74,.12),(2.25,76,.60)]:add(t,d,[n],.19,pan=-.12)
for t,ns in [(0,[52,59,66]),(.75,[48,55,64]),(1.5,[50,57,66]),(2.25,[52,59,66,71])]:add(t,.73,ns,.12,'pad',.15)
for t,n in [(0,40),(.375,52),(.75,36),(1.125,48),(1.5,38),(1.875,50),(2.25,40)]:add(t,.32 if t<2.25 else .7,[n],.2,'bass')
for i,t in enumerate(np.arange(.09375,2.5,.1875)):add(float(t),.11,[[76,83,86,83][i%4]],.035,pan=.45 if i%2 else -.45)
# Small, tactile kit: a short pitched kick plus filtered noise for a bit-crushed hi-hat.
rng=np.random.default_rng(7213)
for t in [0,.75,1.5,2.25]:
 n=int(.11*SR);x=np.arange(n)/SR;v=.15*np.sin(2*np.pi*(58*x+3.5*(1-np.exp(-x*35))))*np.exp(-x*45);i=int(t*SR);mix[i:i+n]+=v[:,None]
for t in np.arange(.1875,2.45,.375):
 n=int(.035*SR);x=np.arange(n)/SR;noise=rng.uniform(-1,1,n);noise-=np.convolve(noise,np.ones(9)/9,'same');v=.018*noise*np.exp(-x*130);i=int(t*SR);mix[i:i+n]+=v[:,None]
# Short stereo echoes and a soft master fade keep it spacious without a piercing tail.
dry=mix.copy()
for delay,gain in [(.094,.13),(.188,.08)]:
 k=int(delay*SR);mix[k:]+=dry[:-k,::-1]*gain
fade=np.minimum(1,np.arange(N)/(.006*SR))*np.minimum(1,(N-np.arange(N))/(.2*SR));mix*=fade[:,None]
mix=np.tanh(mix*1.35);mix*=.82/max(.82,np.max(np.abs(mix)))
with wave.open(str(Path(__file__).resolve().parents[1]/'assets/arcade-startup.wav'),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
