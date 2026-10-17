import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compareRuns} from '../../tools/phone-speed-compare.mjs';
import {TOYS} from '../../src/toys.js';
const root='.cache/phone-speed',read=async name=>JSON.parse(await fs.readFile(`${root}/${name}`,'utf8'));
const plan=await read('late-main-plan.json'),ids=plan.newIDs,frozen=await read('all-toys.json');
await fs.writeFile(`${root}/merged-catalog.json`,JSON.stringify(TOYS.map(({id,label,kind,pack})=>({id,label,kind,pack})),null,2));
assert.deepEqual(TOYS.filter(t=>!frozen.some(r=>r.id===t.id)).map(t=>t.id),ids);
execFileSync('git',['diff','--exit-code',plan.after,'--','src','vendor','index.html','styles.css','assets']);
execFileSync('git',['diff','--exit-code',plan.before,'--','src','vendor','index.html','styles.css','assets'],{cwd:'/workspace/phone-speed-upstream'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [path,url] of [['/workspace/phone-speed-upstream',plan.beforeURL],['/workspace/splashery',plan.afterURL]]){
 for(const file of ['src/player.js','src/stage.js','src/rig.js','src/packs/neuron.js','src/pc.js','src/toys.js','index.html','styles.css']){
  const response=await fetch(new URL(file,url));
  assert.ok(response.ok,`Served module unavailable: ${url}${file}`);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(await fs.readFile(`${path}/${file}`)),`Served module mismatch: ${url}${file}`);
 }
}
const run=async(args)=>{
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
 if(code!==0)throw new Error('Late-main measurement exited '+code);
};
for(const count of plan.repetitions){
 const args=['tools/phone-speed-paired.mjs',`--targets=${root}/late-main-targets.json`,`--out=${root}/late-main-paired`,`--runs=${count}`,'--duration=2500',`--before=${plan.beforeURL}`,`--after=${plan.afterURL}`,`--before-source=${plan.before}`,`--after-source=${plan.after}`];
 if(await fs.access(`${root}/late-main-paired/protocol.json`).then(()=>true,()=>false))args.push('--resume');
 await run(args);
 const before=await read('late-main-paired/before.json'),after=await read('late-main-paired/after.json');
 for(const row of [...before,...after])assert.ok(row.heapBytes>0&&row.transferBytes>0&&row.heap?.usedSize>0,'Missing measured memory/transfer');
 const report=compareRuns(before,after,[],[],ids,Object.fromEntries(ids.map(id=>[id,count])));
 const evidence={sources:{before:plan.before,after:plan.after},generatedAt:new Date().toISOString(),repetitions:count,rows:report.rows,regressions:report.regressions,gates:{coverage:report.gates.coverage,noRegressions:report.gates.noRegressions}};
 await fs.writeFile(`${root}/late-main-${count}-gates.json`,JSON.stringify(evidence,null,2));
 await fs.writeFile(`${root}/late-main-gates.json`,JSON.stringify(evidence,null,2));
 console.log('LATE_MAIN '+JSON.stringify({count,gates:evidence.gates}));
 if(Object.values(evidence.gates).every(Boolean))break;
}
const proof={at:new Date().toISOString(),measuredCatalog:frozen.length+ids.length,sources:plan,runtimeFiles:{}};
for(const [label,path] of [['original-main','/workspace/phone-speed-upstream'],['merged-candidate','/workspace/splashery']]){
 const files=execFileSync('git',['ls-files','src','vendor','index.html','styles.css'],{cwd:path,encoding:'utf8'}).trim().split('\n');
 proof.runtimeFiles[label]=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await fs.readFile(`${path}/${file}`)).digest('hex')])));
}
await fs.writeFile(`${root}/late-main-runtime-manifest.json`,JSON.stringify(proof,null,2));
if(!Object.values((await read('late-main-gates.json')).gates).every(Boolean))process.exitCode=1;
