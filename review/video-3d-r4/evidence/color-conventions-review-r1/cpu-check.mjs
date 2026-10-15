// MIT. Made by Ryan with Codex (GPT-6). CPU-only transfer/compositing audit.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {PNG} from '/workspace/splashery/node_modules/pngjs/lib/png.js';
import * as pc from '/workspace/splashery-r4-public/src/pc.js';
import {gaussiansToPly} from '/workspace/splashery-r4-public/vendor/splatjs/src/io/ply.js';
import {readSplatPly} from '/workspace/splashery-r4-public/src/video3d/ply.js';
const root=new URL('./',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const camera=new pc.Camera();
const halfToFloat=b=>{const sign=b&0x8000?-1:1,e=(b>>>10)&31,m=b&1023;return e===0?sign*(m/1024)*2**-14:e===31?(m?NaN:sign*Infinity):sign*(1+m/1024)*2**(e-15);};
const data=new Float32Array(257*16), expected=[];
for(let i=0;i<257;i++){
 const rgb=[(i+.2718)/257,((i*71)%257+.314159)/257,((i*151)%257+.618034)/257].map(c=>Math.min(1-1e-6,Math.max(1e-6,c)));
 data.set([0,0,2,-3,-3,-3,1,0,0,0,...rgb.map(c=>Math.log(c/(1-c))),0,0,0],i*16);expected.push(...rgb);
}
const ply=new Uint8Array(await (gaussiansToPly(data,257)).arrayBuffer()),decoded=readSplatPly(ply);
let maxError=0,halfError=0;
for(let i=0;i<expected.length;i++){
 maxError=Math.max(maxError,Math.abs(decoded.color[i]-expected[i]));
 halfError=Math.max(halfError,Math.abs(halfToFloat(pc.FloatPacking.float2Half(decoded.color[i]))-decoded.color[i]));
}
if(maxError>1e-6)throw Error('Unexpected color round-trip');
const q=(v,p)=>{const s=v.toSorted((a,b)=>a-b),x=(s.length-1)*p,i=Math.floor(x),f=x-i;return s[i]*(1-f)+s[Math.min(i+1,s.length-1)]*f;};
const quantiles=v=>Object.fromEntries([0,.05,.5,.9,.95,1].map(p=>[p,q(v,p)]));
const caseRoot='/workspace/v3d-r4-media/candidate-r8-phone/dianthus-phone',probeRoot='/workspace/v3d-r4-media/background-probe-r1';
const receiptBytes=await fs.readFile(probeRoot+'/receipt.json'),receipt=JSON.parse(receiptBytes),row=JSON.parse(await fs.readFile(caseRoot+'/result.json'));
if(receipt.status!=='diagnostic-complete'||receipt.errors?.length||receipt.exactVerification.some(v=>!v.byteIdentical))throw Error('Background proof incomplete');
const frames=[];
for(let i=0;i<receipt.frames.length;i++){
 const whiteBytes=await fs.readFile(caseRoot+`/render-${i}.png`),blackBytes=await fs.readFile(probeRoot+`/black-${i}.png`),refBytes=await fs.readFile(caseRoot+`/reference-${i}.png`);
 if(sha(whiteBytes)!==receipt.exactVerification[i].savedSha256||sha(blackBytes)!==receipt.frames[i].sha256)throw Error('Saved image changed');
 const w=PNG.sync.read(whiteBytes),b=PNG.sync.read(blackBytes),r=PNG.sync.read(refBytes);if(w.width!==b.width||w.height!==b.height)throw Error('Image size mismatch');
 const n=w.width*w.height,T=[],meanW=[0,0,0],meanB=[0,0,0],meanR=[0,0,0];let equalDeltaWithinOne=0,nonnegative=0,maxDeltaSpread=0;
 for(let p=0;p<n;p++){
  const d=[0,1,2].map(k=>w.data[p*4+k]-b.data[p*4+k]);const spread=Math.max(...d)-Math.min(...d);maxDeltaSpread=Math.max(maxDeltaSpread,spread);equalDeltaWithinOne+=spread<=1;nonnegative+=Math.min(...d)>=0;T.push(d.reduce((a,v)=>a+v,0)/(3*255));
  for(let k=0;k<3;k++){meanW[k]+=w.data[p*4+k]/(255*n);meanB[k]+=b.data[p*4+k]/(255*n);meanR[k]+=r.data[p*4+k]/(255*n);}
 }
 frames.push({index:i,width:w.width,height:w.height,whiteSha256:sha(whiteBytes),blackSha256:sha(blackBytes),referenceSha256:sha(refBytes),sourceStrictFrame:row.frames?.[i],blackDiagnosticMetrics:receipt.frames[i].metrics,nonnegativeRgbDifferenceFraction:nonnegative/n,rgbDeltaSpreadAtMostOneByteFraction:equalDeltaWithinOne/n,maxRgbDeltaSpreadBytes:maxDeltaSpread,whiteMinusBlackMeanRgbTransmittanceQuantiles:quantiles(T),meanWhiteRgb:meanW,meanBlackRgb:meanB,meanReferenceRgb:meanR,meanInferredOpacity:1-T.reduce((a,v)=>a+v,0)/n});
}
const report={created:new Date().toISOString(),codeSha256:sha(await fs.readFile(new URL(import.meta.url))),backgroundReceiptSha256:sha(receiptBytes),browserForParentsExistingProbe:receipt.browser,noBrowserOrGpuLaunchedHere:true,colorRoundTrip:{n:257,maxAbsDecodedRgbError:maxError,maxAdditionalFloat16AbsError:halfError,plySha256:sha(ply)},cpuDefaultCamera:{gammaCorrection:camera.shaderParams.gammaCorrection,shaderOutputGamma:camera.shaderParams.shaderOutputGamma,toneMapping:camera.shaderParams.toneMapping,fog:camera.shaderParams.fog,defines:Object.fromEntries(camera.shaderParams.defines),GAMMA_SRGB:pc.GAMMA_SRGB,GAMMA_NONE:pc.GAMMA_NONE,TONEMAP_NONE:pc.TONEMAP_NONE},frames,diagnosticOnly:true,limitations:['Camera defaults are CPU constructor defaults; actual live render shader defines were not queried by this helper.', 'White-minus-black lift is only approximate transmittance: measured per-pixel RGB delta spreads reach9/255, so inferred opacity is diagnostic rather than exact alpha readback.','Transmittance interpretation is conditional on the standard premultiplied compositing code; RGB-difference channel agreement independently tests its scalar-white-background implication.','Black-background metrics are separate derived diagnostics; frozen strict rows and acceptance gates remain unchanged.','No gamma, opacity, geometry, camera, shader, or product edits.']};
await fs.writeFile(new URL('cpu-check.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
