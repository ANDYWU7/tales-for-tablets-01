const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(vorbis=true,{delayed=false,rejectPlayback=false}={}) {
  const recordings=[],nodes=[],ramps=[],envelopes=[];
  let finishLoad;
  const loaded=new Promise(resolve=>{finishLoad=resolve;});
  const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(value,time){ramps.push(value);envelopes.push({value,time});},exponentialRampToValueAtTime(value){ramps.push(value);}});
  const node=(kind)=>{const result={kind,frequency:param(),gain:param(),connect(){},disconnect(){},start(...args){this.started=args;},stop(){this.stopped=true;}}; nodes.push(result);return result;};
  class AudioContext {
    constructor(){this.sampleRate=1000;this.currentTime=0;this.destination={};clock=this;}
    resume(){return Promise.resolve();}
    createGain(){return node('gain');}
    createMediaElementSource(audio){const source=node('recording');source.audio=audio;return source;}
    createOscillator(){return node('oscillator');}
    createBiquadFilter(){return node('filter');}
    createBufferSource(){return node('noise');}
    createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
    decodeAudioData(){
      const samples=new Float32Array(6000);samples.fill(.02,3500,3800);
      return Promise.resolve({sampleRate:1000,numberOfChannels:1,length:samples.length,duration:6,getChannelData:()=>samples});
    }
  }
  class Audio {
    constructor(url){this.url=url;this.plays=0;this.pauses=0;recordings.push(this);}
    canPlayType(){return vorbis ? 'probably' : '';}
    pause(){this.pauses++;}
    play(){this.plays++;if(rejectPlayback)return Promise.reject(new Error('Cannot decode'));if(!delayed)this.onplaying?.();return Promise.resolve();}
  }
  let clock;
  const fetch=async()=>{if(delayed)await loaded;if(rejectPlayback)throw new Error('Cannot load');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};
  const context=vm.createContext({window:{AudioContext},Audio,fetch});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','story-audio.js'),'utf8'),context);
  return {audio:context.window.StoryAudio,recordings,nodes,ramps,envelopes,finishLoad,settle:()=>new Promise(resolve=>setImmediate(resolve)),get clock(){return clock;}};
}

test('bark skips leading silence and its fade waits for the decoded recording',async()=>{
  const f=fixture(true,{delayed:true});f.audio.play('dog');
  assert.equal(f.envelopes.length,0);
  f.clock.currentTime=5;
  f.finishLoad();await f.settle();
  const bark=f.nodes.find(n=>n.buffer);
  assert.ok(bark.started[1]>3.4 && bark.started[1]<3.5);
  assert.equal(bark.started[2],.85);
  assert.ok(f.envelopes.some(e=>e.value===8 && e.time===5.025));
  assert.ok(f.envelopes.some(e=>e.value===0 && e.time===5.85));
});

test('failed bark playback makes a quiet woof and respects mute',async()=>{
  const f=fixture(true,{rejectPlayback:true});f.audio.play('dog');
  await f.settle();
  assert.ok(f.nodes.some(n=>n.kind==='noise'));
  assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,2);
  const muted=fixture(true,{rejectPlayback:true});
  muted.audio.play('dog');muted.audio.setEnabled(false);
  await muted.settle();
  assert.ok(!muted.nodes.some(n=>n.kind==='noise' || n.kind==='oscillator'));
});

test('leaving the page cancels a bark that is still loading',async()=>{
  const f=fixture(true,{delayed:true});f.audio.play('dog');f.audio.stop();
  f.finishLoad();await f.settle();
  assert.ok(!f.nodes.some(n=>n.buffer));
});

test('bark and assembly use decoded and media audio respectively, and mute stops both',async()=>{
  const f=fixture();
  f.audio.play('dog');f.audio.play('assemble');
  await f.settle();
  assert.equal(f.recordings[0].url,'assets/audio/assemble-soft.ogg');
  assert.ok(f.recordings.every(r=>r.plays===1));
  assert.ok(f.nodes.some(n=>n.buffer)); assert.ok(f.ramps.includes(.22));
  f.audio.setEnabled(false); f.audio.play('dog');
  assert.ok(f.recordings.every(r=>r.plays===1 && r.pauses>=2));
  assert.ok(f.nodes.filter(n=>n.buffer).every(n=>n.stopped));
  f.audio.setEnabled(true); f.audio.play('assemble');assert.equal(f.recordings[0].plays,2);
});

test('launch is a multi-second filtered exhaust roar, and stopping halts its sources',()=>{
  const f=fixture();f.audio.unlock();f.audio.play('launch');
  assert.ok(f.nodes.some(n=>n.kind==='noise' && n.buffer));
  assert.ok(f.nodes.some(n=>n.kind==='filter' && n.type==='lowpass'));
  assert.ok(f.ramps.includes(2200));
  f.audio.stop();
  assert.ok(f.nodes.filter(n=>n.kind==='noise' || n.kind==='oscillator').every(n=>n.stopped));
});

test('assembly has a quiet thud fallback if the browser cannot play Vorbis',()=>{
  const f=fixture(false);f.audio.play('assemble');
  assert.equal(f.recordings[0].plays,0);
  assert.equal(f.nodes.filter(n=>n.kind==='noise').length,1);
  assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,1);
  assert.ok(f.ramps.includes(.07));
});

test('bundled recordings have valid MP3 and Ogg headers and are nonempty',()=>{
  const root=path.join(__dirname,'..','assets','audio');
  const dog=fs.readFileSync(path.join(root,'dog-soft-bark.mp3'));
  const metal=fs.readFileSync(path.join(root,'assemble-soft.ogg'));
  assert.ok(dog.length>10000);assert.ok(metal.length>1000);
  assert.ok(dog.subarray(0,3).toString()==='ID3' || dog[0]===255);
  assert.equal(metal.subarray(0,4).toString(),'OggS');
});

test('replacement recordings have softened attacks, low-pass filters, and short playback windows',async()=>{
  const f=fixture();f.audio.play('dog');f.audio.play('assemble');
  await f.settle();
  const filters=f.nodes.filter(n=>n.kind==='filter');
  assert.deepEqual(filters.map(n=>n.frequency.value),[1600,2200]);
  assert.ok(filters.every(n=>n.type==='lowpass'));
  assert.ok(f.envelopes.some(e=>e.value===8 && e.time===.025));
  assert.ok(f.envelopes.some(e=>e.value===.22 && e.time===.025));
  assert.ok(f.envelopes.some(e=>e.value===0 && e.time===.85));
  f.recordings[0].currentTime=.8; f.recordings[0].ontimeupdate();
  assert.equal(f.recordings[0].currentTime,0);
});
