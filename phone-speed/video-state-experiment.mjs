import fs from "node:fs/promises";
import {chromium} from "@playwright/test";
import {PNG} from "pngjs";
import {imageMetrics} from "../../tools/cdx-v3d-clarity-metrics.mjs";
import {installFirstFrameProbe} from "../../tools/pages/phone-speed-metrics.js";
const out=".cache/phone-speed/video-state-experiment";
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.SPLASHERY_CHROMIUM,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--enable-webgl"]});
const rows=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,colorScheme:"light"});
 await context.addInitScript(installFirstFrameProbe);
 const page=await context.newPage();
 await page.goto("http://127.0.0.1:4173/?renderer=webgl2&profile=weak&labs=1&adapt=off&first-toy=video-3d");
 await page.waitForFunction(()=>window.__splashery?.ready&&window.__phoneSpeedFirstView);
 await page.evaluate(()=>{const{app,player:p}=window.__splashery;app.sound.setEnabled(false);app.setAutoplay({turntable:false});p.opts.idleDelay=1e9;p.idle.weight=0;p.frozen=true;p.stage.app.on("postrender",()=>p.stage.device.gl.finish());});
 let reference;
 for(const [variant,denominator] of [["original",255],["no-depth",255],["no-depth-alpha",255]]){
  if(variant!=="original") await page.evaluate(async variant=>{
   const pc=await import("/src/pc.js");const stage=window.__splashery.player.stage;
   const base=pc.ShaderChunks.get(stage.device,"glsl").get("gsplatCommonVS");
   const marker=/float clip = min\([^;]+;/;
   if(!marker.test(base))throw new Error("Clip function marker missing");
   let code=base.replace(marker,"float clip = min(1.0, sqrt(max(0.0, -log(alphaClipValue * (1.0 - exp(-4.0)) / alpha + exp(-4.0)) * 0.25)) + 0.002);");
   const mat=stage.app.scene.gsplat.material;
   if(variant!=="original") {
    code="flat varying float spVisibleRadiusSquared;\n"+base.replace(marker,"float radiusSquared = max(0.0, -log(alphaClipValue * (1.0 - exp(-4.0)) / alpha + exp(-4.0)) * 0.25); spVisibleRadiusSquared = min(1.0, radiusSquared + 0.002); float clip = sqrt(spVisibleRadiusSquared);");
    const ps=pc.ShaderChunks.get(stage.device,"glsl").get("gsplatPS");
    if(!/if \(A > 1.0\)/.test(ps))throw new Error("Fragment marker missing");
    mat.shaderChunks.glsl.set("gsplatPS","flat varying float spVisibleRadiusSquared;\n"+ps.replace(/if \(A > 1.0\)/,"if (A > spVisibleRadiusSquared)"));
   }
   mat.shaderChunks.glsl.set("gsplatCommonVS",code);mat.depthTest=false;mat.alphaWrite=variant!=="no-depth-alpha";mat.update();
  },variant);
  const row=await page.evaluate(async denominator=>{
   const p=window.__splashery.player;const stage=p.stage;
   stage.app.scene.gsplat.alphaClipForward=1/denominator;
   await stage.captureFrame();await stage.captureFrame();
   const{measureFrames}=await import("/tools/pages/phone-speed-metrics.js");
   const timing=await measureFrames(p,2500);
   const shot=await stage.captureFrame(390,Math.round(390*p.canvas.height/p.canvas.width));
   return{denominator,alpha:stage.app.scene.gsplat.alphaClipForward,timing,canvas:[p.canvas.width,p.canvas.height],splats:p.toyInfo.splats,image:shot.toDataURL("image/png")};
  },denominator);
  const bytes=Buffer.from(row.image.split(",")[1],"base64");delete row.image;
  await fs.writeFile(`${out}/${variant}-${denominator}.png`,bytes);
  const png=PNG.sync.read(bytes);reference??=png;
  row.variant=variant;row.visual=imageMetrics(reference,png);
  rows.push(row);await fs.writeFile(`${out}/results.json`,JSON.stringify({purpose:"Exploratory only: native-resolution Gaussian fringe cutoff, not final gate evidence",rows},null,2));
  console.log(JSON.stringify({variant,denominator,idle:row.timing.median,visual:row.visual}));
 }
}finally{await browser.close();}
