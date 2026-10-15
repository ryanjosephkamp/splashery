// MIT. Made by Ryan with Codex (GPT-6). A single exact prefix, then unchanged canonical seeks.
import {sharpness,fitSide,panoSafeCrop,windowTimes}from './src/frames.js';
import {seekPresented}from './src/extract.js';
import {ceilTargets,compareActual,startupAction}from './targets.mjs';
import {claimVideo,ownsVideo,playOwned,ownedSeek}from './ownership.mjs';
class PrefixMiss extends Error{}
export async function hybridPlayback(opened,plan,mp4,{side=480,tries=3,signal,onDiagnostic=()=>{}}={}){
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');const{video}=opened,crop=panoSafeCrop(opened.width,opened.height),[width,height]=fitSide(crop.sw,opened.height,side),[sw,sh]=fitSide(width,height,256),canvas=document.createElement('canvas'),small=document.createElement('canvas');canvas.width=width;canvas.height=height;small.width=sw;small.height=sh;
 const g=canvas.getContext('2d',{willReadFrequently:true}),gs=small.getContext('2d',{willReadFrequently:true}),gray=new Float32Array(sw*sh),out=[],telemetry=[],startup=[],start=performance.now();let targets,index=0,best=null,token,handle=null,fastDone=false,last=-Infinity,transition=null;
 const record=e=>{const row={wallMs:performance.now()-start,...e};telemetry.push(row);onDiagnostic(row);};
 const stop=()=>{if(handle!==null)video.cancelVideoFrameCallback(handle);handle=null;video.pause();};
 const abortCheck=()=>{if(signal?.aborted)throw new DOMException('Stopped','AbortError');};
 const consume=async(time,target,path)=>{abortCheck();if(!Number.isFinite(time))throw Error('No actual source PTS for training trial');
  gs.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,sw,sh);const px=gs.getImageData(0,0,sw,sh).data;for(let k=0;k<gray.length;k++)gray[k]=.299*px[4*k]+.587*px[4*k+1]+.114*px[4*k+2];const score=sharpness(gray,sw,sh);
  if(!best||score>best.sharpness){g.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,width,height);const blob=await new Promise((r,j)=>canvas.toBlob(b=>b?r(b):j(Error('JPEG encoding failed')),'image/jpeg',.92));abortCheck();best={blob,time,presentedTime:time,requestedTime:target.requestedTime,desiredSourcePts:target.pts??null,desiredSourceMicros:target.micros??null,path,sharpness:score,width,height};}
  abortCheck();record({kind:'trial',window:target.window,trial:target.trial,path,requestedTime:target.requestedTime,actualTime:time,actualMicros:Math.round(time*1e6),desiredMicros:target.micros??null,desiredPts:target.pts??null});abortCheck();index++;
  if(target.trial===tries-1){out.push(best);record({kind:'window',done:out.length,total:plan.windows.length,selectedTime:best.time,selectedPath:best.path});best=null;abortCheck();}
 };
 try{
  if(mp4){try{targets=ceilTargets(mp4.samples,mp4.timescale,plan,tries);}catch(e){record({kind:'table-target-fallback',message:e.message});mp4=null;}}
  if(!mp4)targets=plan.windows.flatMap((w,window)=>windowTimes(w,tries).map((requestedTime,trial)=>({window,trial,requestedTime})));
  if(mp4){try{
   let warm;try{warm=await ownedSeek(video,Math.min(.5,opened.duration/4),{signal,onDiagnostic:record});}catch(e){if(e.name==='AbortError')throw e;throw new PrefixMiss('Startup presentation failed: '+e.message);}startup.push({...warm,token:undefined,phase:'warm'});
   gs.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,sw,sh);gs.getImageData(0,0,sw,sh);g.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,width,height);g.getImageData(0,0,width,height);
   let fresh=warm;if(startupAction(warm.time,targets[0])==='rewind-once'){try{fresh=await ownedSeek(video,Math.min(.001,targets[0].time/4),{signal,onDiagnostic:record});}catch(e){if(e.name==='AbortError')throw e;throw new PrefixMiss('Single rewind failed: '+e.message);}startup.push({...fresh,token:undefined,phase:'single-rewind'});}
   if(compareActual(fresh.time,targets[0])>0)throw new PrefixMiss('Single rewind already passed first desired frame');token=claimVideo(video,'continuous-exact-prefix');video.playbackRate=1;
   await new Promise((resolve,reject)=>{
    const cleanup=()=>{if(handle!==null)video.cancelVideoFrameCallback(handle);handle=null;video.removeEventListener('ended',ended);signal?.removeEventListener('abort',abort);if(ownsVideo(video,token))video.pause();};
    const finish=e=>{if(fastDone)return;fastDone=true;cleanup();e?reject(e):resolve();};
    const abort=()=>finish(new DOMException('Stopped','AbortError')),ended=()=>finish(new PrefixMiss('Playback ended before every exact target'));
    const arm=()=>{if(!fastDone)handle=video.requestVideoFrameCallback((_,m)=>{handle=null;sample(m.mediaTime,'rvfc',m);});};
    const resume=()=>{if(fastDone||!ownsVideo(video,token))return;arm();playOwned(video,token,()=>fastDone,e=>finish(new PrefixMiss('Playback failed: '+e.message)));};
    const sample=(time,origin,m={})=>{try{if(fastDone||!ownsVideo(video,token))return;abortCheck();const micros=Math.round(time*1e6);record({kind:'rvfc',time,micros,origin,target:index,presentedFrames:m.presentedFrames});if(!Number.isFinite(time)||micros<=last){finish(new PrefixMiss('Nonmonotonic actual prefix PTS'));return;}last=micros;
     const target=targets[index],comparison=compareActual(time,target);if(comparison<0){origin==='confirmed-paused'?resume():arm();return;}if(comparison>0){finish(new PrefixMiss('Exact ceil source frame was skipped'));return;}const w=plan.windows[target.window];if(time<w.from||time>=w.to){finish(new PrefixMiss('Exact picture crossed original window'));return;}video.pause();
     consume(time,target,'exact-prefix').then(()=>{if(fastDone)return;if(index===targets.length)finish();else resume();}).catch(finish);
    }catch(e){finish(e);}};
    signal?.addEventListener('abort',abort,{once:true});video.addEventListener('ended',ended,{once:true});if(signal?.aborted)abort();else if(compareActual(fresh.time,targets[0])===0)sample(fresh.time,'confirmed-paused');else{last=Math.round(fresh.time*1e6);resume();}
   });
  }catch(e){if(!(e instanceof PrefixMiss))throw e;abortCheck();stop();token=claimVideo(video,'canonical-fallback-retire-prefix');transition={reason:e.message,retainedTrials:index,retainedWindows:out.length,retainedCurrentBest:Boolean(best),missedTarget:targets[index],lastActual:telemetry.filter(x=>x.kind==='rvfc').at(-1)??null};record({kind:'transition',...transition});}}
  else{stop();token=claimVideo(video,'canonical-all-retire-prefix');transition={reason:'Unsupported source table; canonical whole plan',retainedTrials:0,retainedWindows:0,retainedCurrentBest:false,missedTarget:targets[0]};record({kind:'transition',...transition});}
  // Exactly one transition. Canonical seekPresented source bytes are unchanged; no second prefix.
  for(;index<targets.length;){abortCheck();const target=targets[index];record({kind:'canonical-seek-start',target:index,window:target.window,trial:target.trial,requestedTime:target.requestedTime});const time=await seekPresented(video,target.requestedTime,{signal});abortCheck();await consume(time,target,'canonical-seek');}
  abortCheck();if(out.length!==plan.windows.length||index!==targets.length)throw Error('Incomplete full native trial budget');return{photos:out,targets,telemetry,startup,transition,cleanup:{paused:video.paused,pendingRvfc:handle===null?0:1,completed:true}};
 }catch(e){e.hybridDiagnostics={targets,telemetry,startup,transition,completedTrials:index,completedWindows:out.length};throw e;}
 finally{fastDone=true;stop();claimVideo(video,'terminal-retired-hybrid');}
}
