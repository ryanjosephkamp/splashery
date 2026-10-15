// MIT. Outside-repository decoder/JPEG identity research, made with Codex.
import { parseAvcMp4 } from '../mp4-decode-research-r1/demux.mjs';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function probe(file,{indices,side=480,signal}={}) {
 const start=performance.now(),bytes=new Uint8Array(await (await fetch('/corpus/'+file,{signal})).arrayBuffer()),mp4=parseAvcMp4(bytes);
 const order=mp4.samples.map((s,i)=>({...s,decodeIndex:i})).sort((a,b)=>a.pts-b.pts),chosen=indices??[0,1,Math.floor(order.length/4),Math.floor(order.length/2),order.length-2,order.length-1];
 const requested=new Map(chosen.map(i=>[Math.round(order[i].pts*1e6/mp4.timescale),{sourceIndex:i,sample:order[i]}]));
 const w=mp4.config.codedWidth,h=mp4.config.codedHeight,f=Math.min(1,side/Math.max(w,h)),width=Math.max(2,2*Math.round(w*f/2)),height=Math.max(2,2*Math.round(h*f/2));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const g=canvas.getContext('2d',{willReadFrequently:true});
 const config={...mp4.config,hardwareAcceleration:'prefer-software'},supported=await VideoDecoder.isConfigSupported(config);if(!supported.supported)throw Error('Decoder unsupported');
 let error,outputs=0,closed=0;const images=[],encodes=[];const decoder=new VideoDecoder({error:e=>{error=e;},output:frame=>{
  try {outputs++;const choice=requested.get(frame.timestamp);if(!choice)return;
   if(frame.displayWidth!==w||frame.displayHeight!==h)throw Error('Display geometry differs from strict square-pixel parser');
   g.drawImage(frame,0,0,w,h,0,0,width,height);
   const pixels=g.getImageData(0,0,width,height).data.slice(),promise=new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('JPEG encoder returned null')),'image/jpeg',.92));
   encodes.push(promise.then(async blob=>images.push({sourceIndex:choice.sourceIndex,decodeIndex:choice.sample.decodeIndex,pts:choice.sample.pts,time:frame.timestamp/1e6,width,height,sha256:await hash(await blob.arrayBuffer()),pixelSha256:await hash(pixels),jpegBytes:blob.size,displayWidth:frame.displayWidth,displayHeight:frame.displayHeight})));
  } catch(e){error=e;} finally {frame.close();closed++;}
 }});
 const abort=()=>{error=new DOMException('Stopped','AbortError');try{decoder.close();}catch{}};signal?.addEventListener('abort',abort,{once:true});
 try {decoder.configure(supported.config);for(const s of mp4.samples){if(signal?.aborted)abort();if(error)throw error;while(decoder.decodeQueueSize>=8){await new Promise(r=>setTimeout(r,0));if(error)throw error;}
  decoder.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:Math.round(s.pts*1e6/mp4.timescale),duration:Math.round(s.duration*1e6/mp4.timescale),data:bytes.subarray(s.offset,s.offset+s.size)}));}
  await decoder.flush();await Promise.all(encodes);if(error)throw error;if(images.length!==requested.size)throw Error('Requested decoded frames missing');
 } finally {signal?.removeEventListener('abort',abort);if(decoder.state!=='closed')decoder.close();}
 images.sort((a,b)=>a.sourceIndex-b.sourceIndex);return {file,inputSha256:await hash(bytes),config:{...config,descriptionSha256:await hash(config.description),description:undefined},timescale:mp4.timescale,editOffset:mp4.editOffset,sourceTimes:order.map(s=>s.pts/mp4.timescale),outputs,closed,images,decodeMs:performance.now()-start};
}
export async function independent(file,decoded,{signal}={}) {
 const url=URL.createObjectURL(await (await fetch('/corpus/'+file,{signal})).blob()),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';
 const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true}),out=[];
 try {await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Metadata timeout')),15000);v.onloadedmetadata=()=>{clearTimeout(t);resolve();};v.onerror=()=>{clearTimeout(t);reject(Error('Metadata failed'));};v.src=url;});
 for(const d of decoded.images){if(signal?.aborted)throw new DOMException('Stopped','AbortError');canvas.width=d.width;canvas.height=d.height;const time=decoded.sourceTimes[d.sourceIndex],next=decoded.sourceTimes[d.sourceIndex+1],target=time+Math.min(.005,(next==null?1/120:next-time)/4);
 const mediaTime=await new Promise((resolve,reject)=>{let cb;const finish=(e,x)=>{clearTimeout(t);if(cb!==undefined)v.cancelVideoFrameCallback(cb);e?reject(e):resolve(x);};const t=setTimeout(()=>finish(Error('Independent presentation timeout at '+time)),4000);const callback=(_,m)=>{if(Math.abs(m.mediaTime-time)<.0001)finish(null,m.mediaTime);else cb=v.requestVideoFrameCallback(callback);};cb=v.requestVideoFrameCallback(callback);v.currentTime=target;});
 g.drawImage(v,0,0,v.videoWidth,v.videoHeight,0,0,d.width,d.height);const px=g.getImageData(0,0,d.width,d.height).data,blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.92));out.push({sourceIndex:d.sourceIndex,mediaTime,videoWidth:v.videoWidth,videoHeight:v.videoHeight,sha256:await hash(await blob.arrayBuffer()),pixelSha256:await hash(px),jpegExact:d.sha256===await hash(await blob.arrayBuffer()),pixelsExact:d.pixelSha256===await hash(px)});
 }
 return out;
 } finally {v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
}
