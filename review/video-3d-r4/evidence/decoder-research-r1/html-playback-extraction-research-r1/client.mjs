// MIT. Made by Ryan with Codex (GPT-6). Separate extraction/proof timings, never a bake.
import {openVideo,grabFrames,closeVideo} from './src/extract.js';
import {planFrames,tierSettings,panoSafeCrop} from './src/frames.js';
import {sequentialFrames} from './sequential.mjs';
import {sourceFrameReceipts} from './source-pixels.mjs';
const b64=b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function runCase({id,profile,method,sourceTimes,abortAfterTrials=null,researchLimitMs=120000}){
 const started=performance.now(),controller=new AbortController(),progress=[],result={id,profile,method,abortAfterTrials,researchLimitMs,startedAt:new Date().toISOString()};let opened;const timer=setTimeout(()=>controller.abort(),researchLimitMs);const diagnostic=e=>{progress.push(e);if(abortAfterTrials&&progress.filter(x=>x.kind==='trial').length>=abortAfterTrials)controller.abort();};
 try{
  const bytes=new Uint8Array(await(await fetch('/input/'+id)).arrayBuffer());result.inputSha256=await hash(bytes);opened=await openVideo(new File([bytes],id+'.mp4',{type:'video/mp4'}),{signal:controller.signal});const tier=tierSettings(profile==='phone'?'phone':'high'),length=opened.duration<=5?5:opened.duration<=10?10:20,plan=planFrames({duration:opened.duration,start:0,length,rate:3,maxFrames:tier.maxFrames});result.tier=tier;result.plan=plan;result.natural={width:opened.width,height:opened.height,duration:opened.duration};result.crop=panoSafeCrop(opened.width,opened.height);result.prepareMs=performance.now()-started;
  console.log(JSON.stringify({phase:'extraction-start',id,profile,method,frames:plan.windows.length,trialTargets:plan.windows.length*3}));const t=performance.now();let photos;
  if(method==='sequential'){const s=await sequentialFrames(opened,plan,{side:tier.frameSide,tries:3,signal:controller.signal,onDiagnostic:diagnostic});photos=s.photos;result.telemetry=s.telemetry;result.sampledTrials=s.captures;result.sequentialCleanup=s.cleanup;}
  else photos=await grabFrames(opened,plan,{side:tier.frameSide,tries:3,signal:controller.signal,onFrame:(done,total)=>diagnostic({kind:'window',done,total,wallMs:performance.now()-t})});
  result.extractMs=performance.now()-t;result.photos=[];
  for(const p of photos){if(controller.signal.aborted)throw new DOMException('Stopped','AbortError');const data=new Uint8Array(await p.blob.arrayBuffer());result.photos.push({...p,blob:undefined,sha256:await hash(data),jpeg:b64(data)});}console.log(JSON.stringify({phase:'proof-start',id,profile,method,extractMs:result.extractMs,photos:result.photos.length}));
  const proofStart=performance.now();result.receipts=await sourceFrameReceipts({base64:b64(bytes),sourceTimes,times:[],trainingFrames:result.photos,crop:result.crop});result.proofMs=performance.now()-proofStart;
  const violations=[];for(const [i,p]of result.photos.entries()){const m=result.receipts.matchedTraining[i];if(p.sha256!==m.sha256||m.sha256!==m.repeatedSha256||!Number.isFinite(p.presentedTime)||Math.abs(m.sourceTime-p.presentedTime)>1e-6)violations.push({index:i,recorded:p.presentedTime,source:m.sourceTime,jpegExact:p.sha256===m.sha256&&m.sha256===m.repeatedSha256});}
  result.identityViolations=violations;result.status=violations.length?'image-or-timestamp-proof-failed':'verified';
 }catch(e){result.status=controller.signal.aborted?'research-abort-no-complete-result':'diagnostic-error-no-complete-result';result.error={name:e.name,message:e.message,stack:e.stack};result.noPartialExtractionReturned=!result.photos;}
 finally{clearTimeout(timer);controller.abort();if(opened){result.cleanup={pausedBeforeClose:opened.video.paused,readyStateBeforeClose:opened.video.readyState};closeVideo(opened);result.cleanup.srcRemoved=!opened.video.getAttribute('src');}result.progress=progress;result.elapsedMs=performance.now()-started;}
 return result;
}
