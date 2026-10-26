'use strict';

window.StoryAudio = (() => {
  let context, enabled=true;
  const active=new Set();
  const recordings={assemble:['assets/audio/assemble-soft.ogg',.22]};
  const clips={};
  const recordingChains={};
  let dogRecording, dogRequest=0;
  function stop() {
    dogRequest++;
    for (const item of active) { try { if (item.pause) { item.pause(); item.currentTime=0; } else item.stop(); } catch {} }
    active.clear();
  }
  function audioContext() {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    context.resume().catch(()=>{});
    return context;
  }
  function loadBark(ctx) {
    if(!dogRecording) {
      dogRecording=fetch('assets/audio/dog-soft-bark.mp3')
        .then(response=>{if(!response.ok)throw new Error('Bark unavailable');return response.arrayBuffer();})
        .then(bytes=>ctx.decodeAudioData(bytes))
        .then(buffer=>{
          // Locate audible content rather than assuming the first seconds of
          // a field recording contain a bark. Normalize this short excerpt so
          // a quiet recording remains audible at a gentle playback level.
          const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
          const windowSize=Math.max(1,Math.floor(buffer.sampleRate*.01)),levels=[];
          let loudest=0;
          for(let start=0;start<buffer.length;start+=windowSize) {
            let energy=0,count=0;
            for(const channel of channels)for(let i=start;i<Math.min(buffer.length,start+windowSize);i++){energy+=channel[i]*channel[i];count++;}
            const level=Math.sqrt(energy/count);levels.push(level);loudest=Math.max(loudest,level);
          }
          if(loudest<.0001)throw new Error('Silent bark recording');
          const first=levels.findIndex(level=>level>=loudest*.2);
          const offset=Math.max(0,first*windowSize/buffer.sampleRate-.025);
          const duration=Math.min(.85,buffer.duration-offset);
          let peak=0;
          for(const channel of channels)for(let i=Math.floor(offset*buffer.sampleRate);i<Math.min(buffer.length,Math.ceil((offset+duration)*buffer.sampleRate));i++)peak=Math.max(peak,Math.abs(channel[i]));
          return {buffer,offset,duration,volume:Math.min(8,.38/Math.max(.001,peak))};
        }).catch(error=>{dogRecording=null;throw error;});
    }
    return dogRecording;
  }
  async function playBark() {
    const request=++dogRequest;
    try {
      const ctx=audioContext();
      const clip=await loadBark(ctx);
      if(!enabled || request!==dogRequest)return;
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),now=ctx.currentTime;
      source.buffer=clip.buffer;filter.type='lowpass';filter.frequency.value=2200;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(clip.volume,now+.025);
      gain.gain.setValueAtTime(clip.volume,now+clip.duration-.1);gain.gain.linearRampToValueAtTime(0,now+clip.duration);
      source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
      active.add(source);source.onended=()=>{active.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
      source.start(now,clip.offset,clip.duration);
    } catch {
      if(enabled && request===dogRequest){try{synth('dog');}catch{}}
    }
  }
  function synth(kind) {
    const ctx=audioContext(), now=ctx.currentTime;
    const master=ctx.createGain(); master.gain.value=.4; master.connect(ctx.destination);
    let remaining=0;
    const track=(source,duration) => {remaining++; active.add(source); source.onended=()=>{active.delete(source); if(--remaining===0)master.disconnect();}; source.start(now); source.stop(now+duration);};
    function note(frequency,duration,delay=0,volume=.12,type='sine',endFrequency=frequency) {
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,now+delay);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,endFrequency),now+delay+duration);
      gain.gain.setValueAtTime(0,now); gain.gain.setValueAtTime(0,now+delay);
      gain.gain.linearRampToValueAtTime(volume,now+delay+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);
      oscillator.connect(gain); gain.connect(master); track(oscillator,delay+duration+.01);
    }
    function noise(duration,{frequency=800,endFrequency=frequency,type='lowpass',volume=.4,delay=0,attack=.01}={}) {
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*(duration+delay)),ctx.sampleRate);
      const samples=buffer.getChannelData(0); let brown=0;
      for(let i=0;i<samples.length;i++) {const white=Math.random()*2-1; brown=(brown+.04*white)/1.04; samples[i]=kind==='launch' ? brown*4+white*.2 : white;}
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      source.buffer=buffer; filter.type=type; filter.frequency.setValueAtTime(frequency,now+delay);
      filter.frequency.exponentialRampToValueAtTime(endFrequency,now+delay+duration);
      gain.gain.setValueAtTime(0,now); gain.gain.setValueAtTime(0,now+delay);
      gain.gain.linearRampToValueAtTime(volume,now+delay+attack);
      gain.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);
      source.connect(filter); filter.connect(gain); gain.connect(master); track(source,delay+duration+.01);
    }
    if(kind==='launch') {
      noise(4.8,{frequency:140,endFrequency:2200,volume:.95,attack:1.1});
      note(32,4.7,0,.32,'sawtooth',67); note(47,4.5,.05,.2,'triangle',25);
    } else if(kind==='dog') {
      // A short, rounded woof if the recording cannot be played.
      noise(.28,{frequency:850,endFrequency:260,type:'bandpass',volume:.22,attack:.035});
      note(185,.3,0,.2,'triangle',95);
      note(275,.22,.025,.08,'triangle',145);
    } else if(kind==='assemble') {
      noise(.15,{frequency:650,endFrequency:240,volume:.12,attack:.025});
      note(170,.16,0,.07,'triangle',110);
    } else if(kind==='land') {
      noise(.9,{frequency:650,endFrequency:90,volume:.6}); note(75,.5,0,.3,'triangle',30);
    } else if(kind==='tape') {
      for(let i=0;i<8;i++) noise(.07,{frequency:2200,type:'highpass',volume:.18,delay:i*.045});
    } else if(kind==='box' || kind==='page' || kind==='snacks' || kind==='pencil') {
      noise(kind==='pencil' ? .14 : kind==='page' ? .35 : .5,{frequency:kind==='snacks' ? 3200 : 1500,type:'bandpass',volume:kind==='pencil' ? .16 : .4});
    } else if(kind==='funnel') {
      [730,1125,1960].forEach(f=>note(f,.4,0,.18,'sine',f*.98));
    } else if(kind==='pickup') {
      noise(.06,{frequency:900,volume:.22});
    } else if(kind==='success' || kind==='star') {
      (kind==='success' ? [523,659,784] : [1047,1568]).forEach((f,i)=>note(f,.24,i*.11,.16));
    } else {
      note(kind==='countdown' ? 600 : 350,.09,0,.17,'sine');
    }
  }
  function play(kind='tap') {
    if(!enabled) return;
    if(kind==='dog') {if(typeof fetch==='function')void playBark();else {try{synth('dog');}catch{}}return;}
    try {
      if(recordings[kind] && typeof Audio!=='undefined') {
        const [url,volume]=recordings[kind];
        const audio=clips[kind] ||= new Audio(url);
        if(kind==='assemble' && !audio.canPlayType('audio/ogg; codecs="vorbis"')) {synth(kind);return;}
        audio.pause(); audio.currentTime=0; audio.volume=volume;
        const duration=.7;
        audio.onplaying=null;
        try {
          const ctx=audioContext();
          if(!recordingChains[kind]) {
            const source=ctx.createMediaElementSource(audio),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
            filter.type='lowpass'; filter.frequency.value=1600;
            source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            recordingChains[kind]={gain};
          }
          // Web Audio gain also controls volume on iPads, where HTML audio's
          // volume property alone may not reduce the recording's level.
          const gain=recordingChains[kind].gain.gain;
          gain.cancelScheduledValues(ctx.currentTime); gain.setValueAtTime(0,ctx.currentTime);
          // Loading a recording can take longer than its fade envelope. Start
          // the envelope when media actually plays, including after buffering.
          audio.onplaying=()=>{
            if(!enabled || !active.has(audio)) return;
            const now=ctx.currentTime,remaining=Math.max(.05,duration-audio.currentTime);
            gain.cancelScheduledValues(now); gain.setValueAtTime(0,now);
            gain.linearRampToValueAtTime(volume,now+Math.min(.025,remaining/2));
            gain.setValueAtTime(volume,now+Math.max(remaining/2,remaining-.15));
            gain.linearRampToValueAtTime(0,now+remaining);
          };
          audio.volume=1;
        } catch { /* The low-volume HTML audio path remains available. */ }
        audio.ontimeupdate=()=>{if(audio.currentTime>=duration){audio.pause();audio.currentTime=0;active.delete(audio);}};
        active.add(audio);
        audio.onended=()=>active.delete(audio);
        const fallback=()=>{
          if(!active.delete(audio)) return;
          audio.pause();
          if(enabled) {try{synth(kind);}catch{}}
        };
        audio.onerror=fallback;
        audio.play().catch(fallback);
        return;
      }
      synth(kind);
    } catch { /* Audio is optional when a device has no available output. */ }
  }
  return {play,stop,unlock(){if(enabled){try{audioContext();}catch{}}},setEnabled(value){enabled=!!value;if(!enabled)stop();}};
})();
