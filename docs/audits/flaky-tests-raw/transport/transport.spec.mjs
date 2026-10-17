import {test,expect} from "@playwright/test";
import crypto from "node:crypto";
test("identical actual RGBA bytes survive lossless base64 transport",async({page})=>{
  await page.goto("/?renderer=webgl2&profile=mid&adapt=off");
  await page.waitForSelector("body[data-ready='true']",{timeout:180000});
  await page.evaluate(async()=>{
    const {app,player}=window.__splashery;
    await app.chooseToy("bouncy-ball");
    player.stage.setFixedSize([390,844]);
    const canvas=await player.stage.captureFrame();
    window.__actualTransportPixels=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
    window.__actualTransportSize=[canvas.width,canvas.height];
  });
  const begin=performance.now();
  const array=await page.evaluate(()=>Array.from(window.__actualTransportPixels));
  const arrayMs=performance.now()-begin;
  const next=performance.now();
  const encoded=await page.evaluate(()=>{
    const bytes=window.__actualTransportPixels;let binary="";
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  });
  const base64Ms=performance.now()-next,old=Buffer.from(array),decoded=Buffer.from(encoded,"base64");
  const size=await page.evaluate(()=>window.__actualTransportSize);
  expect(size).toEqual([390,844]);
  expect(decoded.length).toBe(390*844*4);
  expect(decoded.equals(old)).toBe(true);
  console.log(JSON.stringify({size,bytes:decoded.length,arrayMs,base64Ms,oldSha256:crypto.createHash("sha256").update(old).digest("hex"),base64Sha256:crypto.createHash("sha256").update(decoded).digest("hex")}));
});
