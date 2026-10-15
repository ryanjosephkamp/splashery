// MIT. Made by Ryan with Codex (GPT-6). Per-video operation leases include continuous playback.
const owners=new WeakMap();
export function claimVideo(video,stage){const token={stage};owners.set(video,token);return token;}
export const ownsVideo=(video,token)=>owners.get(video)===token;
export function playOwned(video,token,isDone,onError){let playback;try{playback=video.play();}catch(e){if(ownsVideo(video,token))onError(e);return;}Promise.resolve(playback).then(()=>{if(isDone()&&ownsVideo(video,token))video.pause();},e=>{if(!isDone()&&ownsVideo(video,token))onError(e);});}
export async function ownedSeek(video,requestedTime,{signal,timeoutMs=4000,onDiagnostic=()=>{}}={}){
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');const before=video.currentTime;if(before===requestedTime)throw Error('Startup seek must actually change position');
 const token=claimVideo(video,'startup-seek');let done=false,handle=null,recovery=null,seekedAt=null,observedSeeking=false;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);clearTimeout(recovery);if(handle!==null)video.cancelVideoFrameCallback(handle);handle=null;video.removeEventListener('seeking',arm);video.removeEventListener('seeked',settled);signal?.removeEventListener('abort',abort);if(ownsVideo(video,token))video.pause();};
  const finish=(error,time)=>{if(done)return;done=true;cleanup();error?reject(error):resolve({time,requestedTime,before,position:video.currentTime,observedSeeking,token});};
  const abort=()=>finish(new DOMException('Stopped','AbortError'));
  const arm=()=>{observedSeeking=true;handle=video.requestVideoFrameCallback((now,m)=>{handle=null;if(done||!ownsVideo(video,token))return;if(seekedAt===null||video.seeking||(Number.isFinite(m.presentationTime)&&m.presentationTime<seekedAt)){arm();return;}if(!Number.isFinite(m.mediaTime)){finish(Error('No actual startup presentation'));return;}onDiagnostic({kind:'startup-presented',requestedTime,actualTime:m.mediaTime,position:video.currentTime,presentationTime:m.presentationTime,wallNow:now});finish(null,m.mediaTime);});};
  const settled=()=>{if(video.seeking||video.readyState<2)return;seekedAt=performance.now();recovery=setTimeout(()=>{if(!done&&ownsVideo(video,token))playOwned(video,token,()=>done,finish);},100);};
  const timer=setTimeout(()=>finish(Error('Bounded startup presentation timeout')),timeoutMs);
  video.addEventListener('seeking',arm,{once:true});video.addEventListener('seeked',settled);signal?.addEventListener('abort',abort,{once:true});
  try{video.currentTime=requestedTime;if(signal?.aborted)abort();}catch(e){finish(e);}
 });
}
