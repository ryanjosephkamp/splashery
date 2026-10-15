// MIT. Made by Ryan with Codex (GPT-6). Research-only original HTMLVideo color path.
import {windowTimes,sharpness,fitSide,panoSafeCrop} from './src/frames.js';
export async function sequentialFrames(opened,plan,{side,tries=3,signal,onDiagnostic=()=>{}}={}){
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');
 const {video}=opened,crop=panoSafeCrop(opened.width,opened.height),[width,height]=fitSide(crop.sw,opened.height,side),[sw,sh]=fitSide(width,height,256),canvas=document.createElement('canvas'),small=document.createElement('canvas');canvas.width=width;canvas.height=height;small.width=sw;small.height=sh;const g=canvas.getContext('2d',{willReadFrequently:true}),gs=small.getContext('2d',{willReadFrequently:true}),gray=new Float32Array(sw*sh),out=[],targets=plan.windows.map(w=>windowTimes(w,tries));
 let window=0,trial=0,handle=null,done=false,last=-Infinity,best=null,captures=0;const start=performance.now(),telemetry=[];
 if(!video.requestVideoFrameCallback||!plan.windows.length||video.currentTime!==0)throw Error('Fresh sequential video required');
 const result=await new Promise((resolve,reject)=>{
  const cleanup=()=>{if(handle!==null)video.cancelVideoFrameCallback(handle);handle=null;video.pause();signal?.removeEventListener('abort',abort);video.removeEventListener('ended',ended);};
  const finish=(error)=>{if(done)return;done=true;cleanup();error?reject(error):resolve(out);};
  const abort=()=>finish(new DOMException('Stopped','AbortError')),ended=()=>finish(Error('Playback ended before all trial targets'));
  const arm=()=>{if(!done)handle=video.requestVideoFrameCallback(frame);};
  const resume=()=>{if(done)return;arm();const p=video.play();p?.catch(finish);};
  const frame=(_,metadata)=>{try{
   handle=null;if(done)return;const time=metadata.mediaTime,event={wallMs:performance.now()-start,time,presentedFrames:metadata.presentedFrames,window,trial};telemetry.push(event);
   if(!Number.isFinite(time)||time<=last){finish(Error('Nonmonotonic actual playback timestamp'));return;}last=time;
   const w=plan.windows[window],target=targets[window][trial];
   if(time<target){arm();return;}
   if(time<w.from||time>=w.to){finish(Error('Actual picture crossed its sampling window'));return;}
   if(trial+1<tries&&time>=targets[window][trial+1]){finish(Error('Playback missed a trial target'));return;}
   video.pause();event.requestedTime=target;event.captured=true;
   // Copy synchronously while paused; JPEG encoding may then await without changing the source.
   gs.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,sw,sh);const px=gs.getImageData(0,0,sw,sh).data;for(let i=0;i<gray.length;i++)gray[i]=.299*px[i*4]+.587*px[i*4+1]+.114*px[i*4+2];const score=sharpness(gray,sw,sh);let blob;
   if(!best||score>best.sharpness){g.drawImage(video,crop.sx,0,crop.sw,opened.height,0,0,width,height);blob=new Promise((r,j)=>canvas.toBlob(b=>b?r(b):j(Error('JPEG encoding failed')),'image/jpeg',.92));}
   Promise.resolve(blob).then(value=>{
    if(done)return;if(signal?.aborted){abort();return;}captures++;if(value)best={blob:value,time,presentedTime:time,requestedTime:target,sharpness:score,width,height};onDiagnostic({kind:'trial',window,trial,actualTime:time,requestedTime:target,wallMs:performance.now()-start});if(done||signal?.aborted){abort();return;}trial++;
    if(trial===tries){if(!best){finish(Error('Missing selected photograph'));return;}out.push(best);onDiagnostic({kind:'window',done:out.length,total:plan.windows.length,wallMs:performance.now()-start,selectedTime:best.time});window++;trial=0;best=null;if(window===plan.windows.length){finish();return;}}
    resume();
   }).catch(finish);
  }catch(error){finish(error);}};
  signal?.addEventListener('abort',abort,{once:true});video.addEventListener('ended',ended,{once:true});video.playbackRate=1;if(signal?.aborted)abort();else resume();
 });
 if(result.length!==plan.windows.length||captures!==plan.windows.length*tries)throw Error('Incomplete sequential extraction');
 return {photos:result,telemetry,captures,cleanup:{paused:video.paused,pendingRvfc:handle===null?0:1,completed:done}};
}
