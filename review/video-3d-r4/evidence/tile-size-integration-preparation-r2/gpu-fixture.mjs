// MIT. Made by Ryan with Codex (GPT-6). Shared fixture for actual GPU parity, no timing assertion.
export async function tileGpuFixture(base) {
  const {GSTrainer}=await import(base+'/src/gs/trainer.js'),{createGpu}=await import(base+'/src/gpu/context.js');
  const gpu=await createGpu(),d=gpu.device,errors=[],cases=[];
  d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const read=async(buffer,size)=>{
    const rb=d.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try{const enc=d.createCommandEncoder();enc.copyBufferToBuffer(buffer,0,rb,0,size);d.queue.submit([enc.finish()]);await rb.mapAsync(GPUMapMode.READ);return new Uint8Array(rb.getMappedRange().slice(0));}
    finally{try{rb.unmap();}catch{}rb.destroy();}
  };
  try{
    for(const [w,h,ssimWeight,serialSort]of [[35,27,0,true],[47,31,.2,true],[32,24,0,false]]){
      const n=48,params=new Float32Array(n*16),image=new Float32Array(w*h*3),variants=[],raws=[];
      for(let i=0;i<n;i++)params.set([
        i%11===0?4:((i%8)-3.5)*.065,(Math.floor(i/8)-2.5)*.055,i%13===0?-.2:1.5+(i%3)*.02,
        -3.2,-3.8,-4.2,1,0,0,0,-.6,.3,-.2,i===3?-20:.5,0,0,
      ],i*16);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const parity=(Math.floor(x/2)+Math.floor(y/2))%2;
        image.set(x===0&&y===0?[-1,-1,-1]:[.2+parity*.2+x/w*.1,.25+y/h*.2,.3],3*(y*w+x));
      }
      const camera={imgIdx:0,R:[1,0,0,0,1,0,0,0,1],t:[0,0,0],f:43,cx:w/2,cy:h/2,w,h};
      for(const tileSize of [16,8]){
        d.pushErrorScope('validation');
        const t=new GSTrainer(d,{shDeg:0,tileGrad:false,tileSize,serialSort,ssimWeight,seed:777,maxIters:1200,maxSplats:n,capMult:1,entriesCap:16384,camGrads:false,useStats:false},gpu.info);
        try{
          t.setup({data:params.slice(),n,dc:'sigmoid'},[camera],[{tw:w,th:h,rgb:image.slice()}],w,h,1);
          for(let i=0;i<4;i++){t.stepOnce();await d.queue.onSubmittedWorkDone();}
          const state={};
          for(const [name,buffer,size]of [['params',t.bufParams,n*64],['adamM',t.bufM,n*64],['adamV',t.bufV,n*64],['gradP',t.bufGradP,n*64],['gradF',t.bufGradF,n*64],['out',t.bufOut,w*h*16],['stats',t.bufStats,16]])state[name]=await read(buffer,size);
          const data=new Float32Array(state.params.buffer);
          variants.push({tileSize,iters:t.iter,maxTiles:t.maxTiles,expectedTiles:Math.ceil(w/tileSize)*Math.ceil(h/tileSize),finite:Array.from(data).every(Number.isFinite),changed:data.some((v,i)=>v!==params[i]),entryOverflow:new Uint32Array(state.stats.buffer)[3]});raws.push(state);
        }finally{t.dispose();const error=await d.popErrorScope();if(error)errors.push(error.message);}
      }
      const exact={};for(const k of Object.keys(raws[0]))exact[k]=raws[0][k].length===raws[1][k].length&&raws[0][k].every((v,i)=>v===raws[1][k][i]);
      cases.push({w,h,ssimWeight,serialSort,variants,exact});
    }
    await d.queue.onSubmittedWorkDone();return {cases,errors,storageBindings:d.limits.maxStorageBuffersPerShaderStage};
  }finally{gpu.dispose();}
}
