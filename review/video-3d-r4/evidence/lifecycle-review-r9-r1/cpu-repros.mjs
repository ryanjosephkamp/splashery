// MIT. Made by Ryan with Codex (GPT-6). CPU-only lifecycle repros; no browser/GPU.
import fs from 'node:fs/promises';
import {Session} from '/workspace/splashery-v3d-bench-tools-r9/vendor/splatjs/src/session.js';
import {GSTrainer} from '/workspace/splashery-v3d-bench-tools-r9/vendor/splatjs/src/gs/trainer.js';
const out={created:new Date().toISOString(),noBrowserOrGpu:true};
{
 const s=new Session({maxIters:4,itersPerFrame:1}),callbacks=[],events=[],logs=[];
 s.trainer={iter:0,n:2,opts:{},camMeta:[{}],stepOnce(){throw Error('deterministic encode failure');},async readLoss(){return .01;},dispose(){}};
 s.on('event',e=>events.push(e));s.on('log',m=>logs.push(m));
 s._ensureScheduler();s._sched.raf=fn=>callbacks.push(fn);s.start();callbacks.shift()();await s._frameRunning;await Promise.resolve();
 out.schedulerAfterEncodeError={training:s.training,framePending:s._framePending,frameRunning:!!s._frameRunning,queuedCallbacks:callbacks.length,events:[...events],logs:[...logs]};
 await s.finish();out.schedulerAfterFinish={training:s.training,events:[...events],logs:[...logs]};s.dispose();
}
{
 const points=Array.from({length:8},(_,i)=>({X:[i*.1,(i%3)*.1,2+(i%2)*.1],rgb:[.2,.4,.6]}));
 const s=new Session({lowMem:true,maskTraining:false,initTarget:16,trainer:{maxSplats:32}});let oldTrainerDisposals=0;
 s.frames=[{tw:1,th:1,fw:1,fh:1,rgb:null,name:'frame.jpg'}];
 s.recon={points,cams:[{imgIdx:0,R:[1,0,0,0,1,0,0,0,1],t:[0,0,0],f:1,cx:.5,cy:.5}]};
 s.trainer={dispose(){oldTrainerDisposals++;}};s._lost=true;s.gpu={owned:false,info:{},dispose(){}};
 s._getGpu=async()=>s.gpu||(s.gpu={owned:false,info:{},dispose(){}});
 s._createTrainer=async()=>{const tr={device:{limits:{maxStorageBufferBindingSize:128*1024*1024}},opts:{maxSplats:32},dcMode:'sigmoid',shK:0,bindLimit:128*1024*1024,dispose(){}};tr.setup=GSTrainer.prototype.setup;s.trainer=tr;return tr;};
 try{await s.recover();out.lowMemRecovery={unexpected:'success'};}catch(e){out.lowMemRecovery={error:String(e),stack:e.stack,oldTrainerDisposals,deviceLostAfterFailedRecovery:s.deviceLost,rgb:s.frames[0].rgb};}finally{s.dispose();}
}
await fs.writeFile('/workspace/v3d-r4-media/lifecycle-review-r9-r1/cpu-repros.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
