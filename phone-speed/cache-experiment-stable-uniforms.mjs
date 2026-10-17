import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
await page.goto('http://127.0.0.1:4173/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=toy-trex');
await page.waitForFunction(()=>window.__splashery?.ready,{timeout:120000});
const rows=await page.evaluate(async()=>{
 const {measureFrames}=await import('/tools/pages/phone-speed-metrics.js');
 const pc=await import('/src/pc.js');
 const {app,player}=window.__splashery;
 app.sound.setEnabled(false); player.opts.idleDelay=1e9; player.idle.weight=0; app.setAutoplay({turntable:false});
 await new Promise(r=>setTimeout(r,1500));
 const rows=[]; const originalUniforms=player.stage.setUniforms;
 for(let run=0;run<3;run++)for(const mode of ['always','auto']){
   const g=player.stage.toy.entity.gsplat;
   g.workBufferUpdate=mode==='always'?pc.WORKBUFFER_UPDATE_ALWAYS:pc.WORKBUFFER_UPDATE_AUTO;
   player.stage.setUniforms=mode==='always'?originalUniforms:()=>{};
   const measurement=await measureFrames(player,2000);
   rows.push({mode,run,...measurement});
 }
 return rows;
});
await fs.writeFile('.cache/phone-speed/cache-experiment-stable-uniforms.json',JSON.stringify(rows,null,2));
console.log(rows.map(r=>[r.mode,r.median,r.work.median]));
await browser.close();
