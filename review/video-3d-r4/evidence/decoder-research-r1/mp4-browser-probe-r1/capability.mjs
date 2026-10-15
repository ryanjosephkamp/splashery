import { chromium } from '/workspace/splashery/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-dev-shm-usage']});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4195/mp4-browser-probe-r1/');
 const result=await page.evaluate(async()=>({secure:isSecureContext,videoDecoder:typeof VideoDecoder,videoFrame:typeof VideoFrame,config:typeof VideoDecoder==='function'?await VideoDecoder.isConfigSupported({codec:'avc1.64001f',codedWidth:1280,codedHeight:720,hardwareAcceleration:'prefer-software'}):null}));
 await writeFile('/workspace/v3d-r4-media/mp4-browser-probe-r1/capability.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),flags:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-dev-shm-usage'],result},null,2)+'\n');
 console.log(result);
} finally {await browser.close();}
