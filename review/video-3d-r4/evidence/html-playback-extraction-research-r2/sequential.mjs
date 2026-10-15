// MIT. Made by Ryan with Codex (GPT-6). Every trial must be its exact ceil source frame.
import {sharpness,fitSide,panoSafeCrop} from './src/frames.js';
import {ceilTargets,compareActual,startupAction} from './targets.mjs';
import {claimVideo,ownsVideo,playOwned,ownedSeek} from './ownership.mjs';
export async function exactPlayback(opened,plan,mp4,{side=480,tries=3,signal,onDiagnostic=()=>{}}={}){
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');const targets=ceilTargets(mp4.samples,mp4.timescale,plan,tries),{video}=opened,crop=panoSafeCrop(opened.width,opened.height),[width,height]=fitSide(crop.sw,opened.height,side),[sw,sh]=fitSide(width,height,256),canvas=document.createElement('canvas'),small=document.createElement('canvas');canvas.width=width;canvas.height=height;small.width=sw;small.height=sh;const g=canvas.getContext('2d',{willReadFrequently:true}),gs=small.getContext('2d',{willReadFrequently:true}),gray=new Float32Array(sw*sh),out=[],telemetry=[],startup=[],start=performance.now();let token,handle=null,done=false,index=0,best=null,last=-Infinity;
 const record=e=>{const row={wallMs:performance.now()-start,...e};telemetry.push(row);onDiagnostic(row);};
 try{
  const warm=await ownedSeek(video,Math.min(.5,opened.duration/4),{signal,onDiagnostic:record});startup.push({...warm,token:undefined,phase:'warm'});
  // Warm the SAME HTML→2D path while paused; this picture is never a trial or training photo.
  gs.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,sw,sh);gs.getImageData(0,0,sw,sh);g.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,width,height);g.getImageData(0,0,width,height);
  let fresh=warm;if(startupAction(warm.time,targets[0])==='rewind-once'){fresh=await ownedSeek(video,Math.min(.001,targets[0].time/4),{signal,onDiagnostic:record});startup.push({...fresh,token:undefined,phase:'single-rewind'});}
  if(compareActual(fresh.time,targets[0])>0)throw Error('Single rewind already passed first desired source frame');
  token=claimVideo(video,'continuous-exact-playback');video.playbackRate=1;
  await new Promise((resolve,reject)=>{
   const cleanup=()=>{if(handle!==null)video.cancelVideoFrameCallback(handle);handle=null;video.removeEventListener('ended',ended);signal?.removeEventListener('abort',abort);if(ownsVideo(video,token))video.pause();};
   const finish=error=>{if(done)return;done=true;cleanup();error?reject(error):resolve();};
   const abort=()=>finish(new DOMException('Stopped','AbortError')),ended=()=>finish(Error('Playback ended before every exact ceil target'));
   const arm=()=>{if(!done)handle=video.requestVideoFrameCallback((_,m)=>{handle=null;sample(m.mediaTime,'rvfc',m);});};
   const resume=()=>{if(done||!ownsVideo(video,token))return;arm();playOwned(video,token,()=>done,finish);};
   const sample=(time,origin,metadata={})=>{try{
    if(done||!ownsVideo(video,token))return;if(signal?.aborted){abort();return;}const micros=Math.round(time*1e6);record({kind:'rvfc',time,micros,origin,target:index,presentedFrames:metadata.presentedFrames});
    if(!Number.isFinite(time)||micros<=last){finish(Error('Nonmonotonic actual playback source PTS'));return;}last=micros;
    const target=targets[index],comparison=compareActual(time,target);if(comparison<0){resumeAfterEarly(origin);return;}if(comparison>0){finish(Error('Exact ceil source frame was skipped'));return;}
    const w=plan.windows[target.window];if(time<w.from||time>=w.to){finish(Error('Exact picture crossed original window'));return;}video.pause();
    gs.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,sw,sh);const px=gs.getImageData(0,0,sw,sh).data;for(let k=0;k<gray.length;k++)gray[k]=.299*px[4*k]+.587*px[4*k+1]+.114*px[4*k+2];const score=sharpness(gray,sw,sh);let blob;
    if(!best||score>best.sharpness){g.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,width,height);blob=new Promise((r,j)=>canvas.toBlob(b=>b?r(b):j(Error('JPEG encoding failed')),'image/jpeg',.92));}
    Promise.resolve(blob).then(value=>{if(done)return;if(signal?.aborted){abort();return;}if(value)best={blob:value,time,presentedTime:time,requestedTime:target.requestedTime,desiredSourcePts:target.pts,desiredSourceMicros:target.micros,sharpness:score,width,height};record({kind:'trial',window:target.window,trial:target.trial,requestedTime:target.requestedTime,actualTime:time,actualMicros:micros,desiredMicros:target.micros,desiredPts:target.pts});if(done||signal?.aborted){abort();return;}index++;
     if(target.trial===tries-1){out.push(best);record({kind:'window',done:out.length,total:plan.windows.length,selectedTime:best.time});best=null;}
     if(index===targets.length){finish();return;}resume();
    }).catch(finish);
   }catch(e){finish(e);}};
   const resumeAfterEarly=origin=>{if(origin==='confirmed-paused')resume();else arm();};
   signal?.addEventListener('abort',abort,{once:true});video.addEventListener('ended',ended,{once:true});if(signal?.aborted)abort();else if(compareActual(fresh.time,targets[0])===0)sample(fresh.time,'confirmed-paused');else{last=Math.round(fresh.time*1e6);resume();}
  });
  if(out.length!==plan.windows.length||index!==targets.length)throw Error('Incomplete exact trial budget');return {photos:out,targets,telemetry,startup,cleanup:{paused:video.paused,pendingRvfc:handle===null?0:1,completed:true}};
 }catch(error){error.exactDiagnostics={targets,telemetry,startup,completedTrials:index,completedWindows:out.length};throw error;}
 finally{done=true;if(handle!==null)video.cancelVideoFrameCallback(handle);if(token&&ownsVideo(video,token))video.pause();}
}
