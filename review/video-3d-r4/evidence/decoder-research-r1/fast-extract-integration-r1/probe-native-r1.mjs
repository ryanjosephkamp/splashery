import { chromium } from '/workspace/splashery/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const rows=[];
for(const executablePath of ['/usr/bin/chromium']) {
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-webgpu-adapter=swiftshader','--use-vulkan=swiftshader']});
 try {const page=await browser.newPage();await page.goto('http://127.0.0.1:4195/fast-extract-integration-r1/');const result=await page.evaluate(async()=>{
  const {openVideo,grabFrames,closeVideo}=await import('./src/extract.js'),{planFrames,panoSafeCrop}=await import('./src/frames.js'),{parseAvcMp4}=await import('./src/mp4.js');
  const bytes=await(await fetch('./b-sar.mp4')).arrayBuffer(),mp4=parseAvcMp4(new Uint8Array(bytes)),opened=await openVideo(new File([bytes],'b-sar.mp4',{type:'video/mp4'})),Decoder=VideoDecoder,metadata=[];
  globalThis.VideoDecoder=class extends Decoder{constructor(options){super({...options,output:frame=>{if(metadata.length<4)metadata.push({pts:frame.timestamp,coded:[frame.codedWidth,frame.codedHeight],display:[frame.displayWidth,frame.displayHeight],visible:frame.visibleRect.toJSON(),color:frame.colorSpace.toJSON()});options.output(frame);}});}};
  try{const start=performance.now(),photos=await grabFrames(opened,planFrames({duration:opened.duration,length:1.5,rate:3,maxFrames:4}),{side:160});return {elapsed:performance.now()-start,opened:[opened.width,opened.height,opened.duration],extraction:opened.extraction,failure:opened.fastDecodeFailure,config:{...mp4.config,description:undefined},crop:panoSafeCrop(opened.width,opened.height),frames:photos.map(({blob,...rest})=>rest),metadata};}finally{closeVideo(opened);globalThis.VideoDecoder=Decoder;}
 });rows.push({executablePath,browser:browser.version(),result});console.log(JSON.stringify(rows.at(-1)));}finally{await browser.close();}
}
await writeFile('/workspace/v3d-r4-media/fast-extract-integration-r1/probe-native-r1.json',JSON.stringify(rows,null,2)+'\n');
