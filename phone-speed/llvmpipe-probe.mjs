import fs from 'node:fs/promises';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
const root='/workspace/splashery',out=`${root}/.cache/phone-speed/llvmpipe-probe.json`;
const env={...process.env,PATH:`${root}/.cache/apt/root/usr/bin:${process.env.PATH}`,LD_LIBRARY_PATH:`${root}/.cache/apt/root/usr/lib/x86_64-linux-gnu`,FONTCONFIG_FILE:`${root}/.cache/phone-speed/test-fontconfig/fonts.conf`};
const args=['--use-gl=angle','--use-angle=gl','--hide-scrollbars','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--disable-gpu-driver-bug-workarounds','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-webgpu-adapter=swiftshader','--use-vulkan=swiftshader'];
const evidence={at:new Date().toISOString(),host:os.cpus()[0]?.model,args};
let display,browser,stderr='';
try{
 let number=98;while(await fs.access(`/tmp/.X${number}-lock`).then(()=>true,()=>false))number++;
 env.DISPLAY=`:${number}`;
 display=spawn(`${root}/.cache/apt/root/usr/bin/Xvfb`,[env.DISPLAY,'-screen','0','1920x1080x24','-nolisten','tcp'],{env,stdio:['ignore','ignore','pipe']});display.stderr.on('data',d=>stderr+=d);
 await new Promise(r=>setTimeout(r,1000));
 if(display.exitCode!==null)throw new Error('Xvfb exited '+display.exitCode+': '+stderr);
 browser=await chromium.launch({executablePath:process.env.SPLASHERY_CHROMIUM||'/usr/bin/chromium',headless:false,args,env});
 evidence.browser=browser.version();const page=await browser.newPage();
 evidence.webgl=await page.evaluate(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2');if(!g)throw new Error('WebGL2 unavailable');g.clearColor(.25,.5,.75,1);g.clear(g.COLOR_BUFFER_BIT);const p=new Uint8Array(4);g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,p);const ext=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),renderer:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),pixel:[...p]};});
 if(!/llvmpipe/i.test(evidence.webgl.renderer))throw new Error('Expected Mesa llvmpipe, got '+evidence.webgl.renderer);
 evidence.ok=true;
}catch(e){evidence.ok=false;evidence.error=e.stack;}
finally{await browser?.close().catch(e=>{evidence.closeError=e.message;});if(display&&display.exitCode===null&&display.signalCode===null){const ended=new Promise(r=>display.once('close',r));display.kill('SIGTERM');await ended;}evidence.xvfbStderr=stderr;await fs.writeFile(out,JSON.stringify(evidence,null,2));console.log('LLVM_PROBE '+JSON.stringify({ok:evidence.ok,renderer:evidence.webgl?.renderer,error:evidence.error}));}
