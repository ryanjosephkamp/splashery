// MIT. Made by Ryan with Codex (GPT-6). Local generated video track experiment only.
import {parseAvcMp4} from './demux.mjs';
import {openVideo,closeVideo,seekPresented} from './src/extract.js';
import {fitSide,panoSafeCrop} from './src/frames.js';
import {decoderColor} from './src/fast-extract.js';
const hex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async b=>hex(await crypto.subtle.digest('SHA-256',b));
const b64=b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};
export async function runCase(id){
 const start=performance.now(),control=new AbortController(),counts={framesDecoded:0,framesKept:0,framesClosed:0,bridgeWrites:0,rvfcCanceled:0},pendingRvfc=new Set(),kept=new Map();
 const deadline=setTimeout(()=>control.abort(new Error('Case diagnostic90sdeadline')),90000);
 const checked=p=>new Promise((resolve,reject)=>{const stop=()=>{control.signal.removeEventListener('abort',stop);reject(control.signal.reason);};control.signal.addEventListener('abort',stop,{once:true});Promise.resolve(p).then(v=>{control.signal.removeEventListener('abort',stop);control.signal.aborted?reject(control.signal.reason):resolve(v);},e=>{control.signal.removeEventListener('abort',stop);reject(e);});if(control.signal.aborted)stop();});
 let opened,decoder,generator,track,writer,bridge,stream,playback,decoderFailure=null;const result={id,side:id==='b-sar'?160:320,requestedFractions:[.2,.5,.8],api:{MediaStreamTrackGenerator:typeof MediaStreamTrackGenerator,VideoTrackGenerator:typeof globalThis.VideoTrackGenerator},samples:[],counts};
 const close=frame=>{try{frame.close();counts.framesClosed++;}catch{}};
 try{
  if(typeof MediaStreamTrackGenerator!=='function'&&typeof globalThis.VideoTrackGenerator!=='function')throw Error('No generated video-track API in exact native browser');
  const bytes=new Uint8Array(await checked((await checked(fetch('/input/'+id))).arrayBuffer()));result.inputSha256=await hash(bytes);
  const mp4=parseAvcMp4(bytes);opened=await checked(openVideo(new File([bytes],id+'.mp4',{type:'video/mp4'}),{signal:control.signal}));result.sourceNatural={width:opened.width,height:opened.height,duration:opened.duration};result.mp4={timescale:mp4.timescale,editOffset:mp4.editOffset,sampleCount:mp4.samples.length,config:{...mp4.config,description:undefined},sar:mp4.sampleAspectRatio,trackDisplay:mp4.trackDisplay,color:mp4.colorMetadata};
  const crop=panoSafeCrop(opened.width,opened.height),[w,h]=fitSide(crop.sw,opened.height,result.side);result.crop=crop;result.output={width:w,height:h};
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d',{willReadFrequently:true});
  const picture=async(source,isFrame=false)=>{if(isFrame)g.drawImage(source,crop.sx*source.displayWidth/opened.width,0,crop.sw*source.displayWidth/opened.width,source.displayHeight,0,0,w,h);else g.drawImage(source,crop.sx,0,crop.sw,opened.height,0,0,w,h);const rgba=g.getImageData(0,0,w,h).data.slice(),blob=await checked(new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('JPEG failed')),'image/jpeg',.92))),jpeg=new Uint8Array(await blob.arrayBuffer());return {rgbaSha256:await hash(rgba),jpegSha256:await hash(jpeg),rgba:b64(rgba),jpeg:b64(jpeg),jpegBytes:jpeg.length};};
  const wanted=new Set();
  for(const fraction of result.requestedFractions){const requested=opened.duration*fraction,time=await checked(seekPresented(opened.video,requested,{signal:control.signal,timeoutMs:10000})),timestamp=Math.round(time*1e6),sample=mp4.samples.find(s=>Math.round(s.pts*1e6/mp4.timescale)===timestamp);if(!sample)throw Error('Actual source RVFC timestamp absent from MP4 inventory');if(wanted.has(timestamp))throw Error('Source verification produced repeated frame');wanted.add(timestamp);result.samples.push({requestedTime:requested,sourcePresentedTime:time,sourceTimestamp:timestamp,sourcePacket:sample,reference:await picture(opened.video)});}
  result.colorConfig=decoderColor(mp4.colorMetadata,opened.height);const config={...mp4.config,colorSpace:result.colorConfig,hardwareAcceleration:'no-preference'},supported=await checked(VideoDecoder.isConfigSupported(config));if(!supported.supported)throw Error('AVC config unsupported');
  decoder=new VideoDecoder({error:e=>{decoderFailure=e;control.abort(e);},output:frame=>{counts.framesDecoded++;if(control.signal.aborted||!wanted.has(frame.timestamp)||kept.has(frame.timestamp)){close(frame);return;}kept.set(frame.timestamp,frame);counts.framesKept++;}});decoder.configure(supported.config);const decodeStart=performance.now();
  for(const s of mp4.samples){if(control.signal.aborted)throw control.signal.reason;while(decoder.decodeQueueSize>=4)await checked(new Promise(r=>setTimeout(r,0)));decoder.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:Math.round(s.pts*1e6/mp4.timescale),data:bytes.subarray(s.offset,s.offset+s.size)}));}
  await checked(decoder.flush());result.decodeWallMs=performance.now()-decodeStart;if(decoderFailure)throw decoderFailure;if(kept.size!==wanted.size)throw Error('A wanted source picture was not decoded');decoder.close();decoder=null;
  if(typeof MediaStreamTrackGenerator==='function'){generator=new MediaStreamTrackGenerator({kind:'video'});track=generator;result.bridgeApi='MediaStreamTrackGenerator';}else{generator=new globalThis.VideoTrackGenerator();track=generator.track;result.bridgeApi='VideoTrackGenerator';}
  writer=generator.writable.getWriter();stream=new MediaStream([track]);bridge=document.createElement('video');bridge.muted=true;bridge.playsInline=true;bridge.autoplay=true;bridge.style.cssText='width:320px;max-height:240px;display:block';document.body.append(bridge);bridge.srcObject=stream;
  playback=bridge.play();playback.catch(()=>{});
  let lastPresentedFrames=-1;
  for(const row of result.samples){const frame=kept.get(row.sourceTimestamp);row.decoded={timestamp:frame.timestamp,codedWidth:frame.codedWidth,codedHeight:frame.codedHeight,displayWidth:frame.displayWidth,displayHeight:frame.displayHeight,visibleRect:frame.visibleRect.toJSON(),color:frame.colorSpace.toJSON()};row.direct=await picture(frame,true);row.directRgbaExact=row.direct.rgbaSha256===row.reference.rgbaSha256;row.directJpegExact=row.direct.jpegSha256===row.reference.jpegSha256;
   const presented=checked(new Promise((resolve,reject)=>{let handle,timer;const cleanup=()=>{clearTimeout(timer);if(handle!==undefined){bridge.cancelVideoFrameCallback(handle);pendingRvfc.delete(handle);counts.rvfcCanceled++;}control.signal.removeEventListener('abort',aborted);};const aborted=()=>{cleanup();reject(control.signal.reason);};const callback=(now,metadata)=>{pendingRvfc.delete(handle);handle=undefined;if(metadata.presentedFrames<=lastPresentedFrames){arm();return;}cleanup();lastPresentedFrames=metadata.presentedFrames;resolve({now,...metadata});};const arm=()=>{handle=bridge.requestVideoFrameCallback(callback);pendingRvfc.add(handle);};timer=setTimeout(()=>{cleanup();reject(Error('Generated stream RVFC8sdeadline'));},8000);control.signal.addEventListener('abort',aborted,{once:true});arm();}));presented.catch(()=>{});
   const send=frame.clone();try{await checked(writer.ready);await checked(writer.write(send));counts.bridgeWrites++;}finally{close(send);}
   row.bridgeCallback=await presented;row.bridgeNatural={width:bridge.videoWidth,height:bridge.videoHeight};row.bridgeTimeMinusSource=row.bridgeCallback.mediaTime-row.sourceTimestamp/1e6;row.bridge=await picture(bridge);row.bridgeRgbaExact=row.bridge.rgbaSha256===row.reference.rgbaSha256;row.bridgeJpegExact=row.bridge.jpegSha256===row.reference.jpegSha256;close(frame);kept.delete(row.sourceTimestamp);
  }
  result.bridgeAllRgbaExact=result.samples.every(s=>s.bridgeRgbaExact);result.bridgeAllJpegExact=result.samples.every(s=>s.bridgeJpegExact);result.bridgeOffsets=result.samples.map(s=>s.bridgeTimeMinusSource);result.status='completed';
 }catch(e){result.status='diagnostic-error';result.error={name:e.name,message:e.message,stack:e.stack};}
 finally{
  control.abort(Error('Diagnostic finished'));clearTimeout(deadline);if(decoder&&decoder.state!=='closed')try{decoder.close();}catch{}
  for(const frame of kept.values())close(frame);kept.clear();
  for(const handle of pendingRvfc){try{bridge?.cancelVideoFrameCallback(handle);counts.rvfcCanceled++;}catch{}}pendingRvfc.clear();
  if(writer){try{await Promise.race([writer.abort('Diagnostic finished'),new Promise(r=>setTimeout(r,1000))]);}catch{}try{writer.releaseLock();}catch{}}
  track?.stop();stream?.getTracks().forEach(t=>t.stop());if(bridge){bridge.pause();bridge.srcObject=null;bridge.remove();}
  if(opened)closeVideo(opened);result.elapsedMs=performance.now()-start;result.cleanup={kept:kept.size,rvfcPending:pendingRvfc.size,decoderClosed:!decoder||decoder.state==='closed',trackState:track?.readyState||null};
 }
 return result;
}
