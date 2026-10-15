// MIT. Made by Ryan with Codex (GPT-6). Read-only exact-ceil playback experiment.
import {openVideo,closeVideo} from './src/extract.js';
import {planFrames,tierSettings,panoSafeCrop} from './src/frames.js';
import {parseAvcMp4} from './demux.mjs';
import {exactPlayback} from './sequential.mjs';
import {sourceFrameReceipts} from './source-pixels.mjs';
const b64=b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function runCase({id,sourceTimes,researchLimitMs=90000,abortAfterTrials=null}){
 const start=performance.now(),controller=new AbortController(),progress=[],result={id,profile:'phone',method:'exact-ceil-continuous-html-playback',startedAt:new Date().toISOString(),researchLimitMs,abortAfterTrials};let opened,extractStart;
 const timer=setTimeout(()=>controller.abort(),researchLimitMs),diagnostic=e=>{progress.push(e);if(abortAfterTrials&&progress.filter(x=>x.kind==='trial').length>=abortAfterTrials)controller.abort();};
 try{
  const bytes=new Uint8Array(await(await fetch('/input/'+id)).arrayBuffer());result.inputSha256=await hash(bytes);let mp4;const parseStart=performance.now();
  try{mp4=parseAvcMp4(bytes);}catch(e){result.status='unsupported-table-immediate-fallback';result.error={name:e.name,message:e.message};return result;}
  result.parseMs=performance.now()-parseStart;result.table={timescale:mp4.timescale,samples:mp4.samples.length,editOffset:mp4.editOffset};
  opened=await openVideo(new File([bytes],id+'.mp4',{type:'video/mp4'}),{signal:controller.signal});const tier=tierSettings('phone'),length=opened.duration<=5?5:opened.duration<=10?10:20,plan=planFrames({duration:opened.duration,start:0,length,rate:3,maxFrames:tier.maxFrames});result.tier=tier;result.plan=plan;result.natural={width:opened.width,height:opened.height,duration:opened.duration};result.crop=panoSafeCrop(opened.width,opened.height);result.prepareMs=performance.now()-start;
  console.log(JSON.stringify({phase:'extraction-start',id,frames:plan.windows.length,trialTargets:plan.windows.length*3}));extractStart=performance.now();
  const s=await exactPlayback(opened,plan,mp4,{side:tier.frameSide,tries:3,signal:controller.signal,onDiagnostic:diagnostic});result.extractMs=performance.now()-extractStart;result.telemetry=s.telemetry;result.startup=s.startup;result.targets=s.targets;result.captureCleanup=s.cleanup;result.photos=[];
  for(const p of s.photos){if(controller.signal.aborted)throw new DOMException('Stopped','AbortError');const data=new Uint8Array(await p.blob.arrayBuffer());result.photos.push({...p,blob:undefined,sha256:await hash(data),jpeg:b64(data)});}
  result.completeExtractionReturned=true;console.log(JSON.stringify({phase:'proof-start',id,extractMs:result.extractMs,photos:result.photos.length}));const proofStart=performance.now();
  result.receipts=await sourceFrameReceipts({base64:b64(bytes),sourceTimes,times:[],trainingFrames:result.photos,crop:result.crop});result.proofMs=performance.now()-proofStart;
  const violations=[];for(const[i,p]of result.photos.entries()){const m=result.receipts.matchedTraining[i];if(p.sha256!==m.sha256||m.sha256!==m.repeatedSha256||!Number.isFinite(p.presentedTime)||Math.abs(m.sourceTime-p.presentedTime)>1e-6||Math.round(p.presentedTime*1e6)!==p.desiredSourceMicros)violations.push({index:i,recorded:p.presentedTime,source:m.sourceTime,desired:p.desiredSourceMicros,jpegExact:p.sha256===m.sha256&&m.sha256===m.repeatedSha256});}
  result.identityViolations=violations;result.status=violations.length?'independent-proof-failed-fallback':'verified-exact-ceil';result.receiptScope='No held-out images read; only independent identity of every selected source JPEG and actual source PTS.';
 }catch(e){result.status=controller.signal.aborted?'research-abort-fallback':'extraction-or-proof-fallback';result.error={name:e.name,message:e.message,stack:e.stack};result.exactDiagnostics=e.exactDiagnostics;if(extractStart&&!result.extractMs)result.attemptedExtractionMs=performance.now()-extractStart;result.noPartialExtractionReturned=!result.completeExtractionReturned;}
 finally{clearTimeout(timer);controller.abort();if(opened){result.cleanup={pausedBeforeClose:opened.video.paused,readyStateBeforeClose:opened.video.readyState};closeVideo(opened);result.cleanup.srcRemoved=!opened.video.getAttribute('src');result.cleanup.pausedAfterClose=opened.video.paused;}else result.cleanup={noOpenedVideo:true};result.progress=progress;result.elapsedMs=performance.now()-start;}
 return result;
}
