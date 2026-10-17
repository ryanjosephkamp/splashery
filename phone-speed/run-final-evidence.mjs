import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compareRuns} from '../../tools/phone-speed-compare.mjs';
import {TOYS} from '../../src/toys.js';
const root='.cache/phone-speed', before='36f5df601963f418f71b98ee460783ea6191b0bc';
const after=process.argv.find(a=>a.startsWith('--source='))?.slice(9);
assert.match(after||'',/^[0-9a-f]{40}$/);
const read=async name=>JSON.parse(await fs.readFile(`${root}/${name}`,'utf8'));
const write=async(name,value)=>fs.writeFile(`${root}/${name}`,JSON.stringify(value,null,2)+'\n');
const exists=async name=>fs.access(`${root}/${name}`).then(()=>true,()=>false);
const copyOnce=async(from,to)=>{if(!await exists(to))await fs.copyFile(`${root}/${from}`,`${root}/${to}`);};
const writeOnce=async(name,value)=>{if(!await exists(name))await write(name,value);};
const pin={before,after};if(await exists('pipeline-pins.json'))assert.deepEqual(await read('pipeline-pins.json'),pin);else await write('pipeline-pins.json',pin);
const hash=b=>createHash('sha256').update(b).digest('hex');
const targets=await read('targets.json'), frozen=await read('freeze-readback.json');
assert.equal(hash(await fs.readFile(`${root}/targets.json`)),frozen.targetsSHA256);
const steps=await read('pipeline-steps.json').catch(e=>{if(e.code==='ENOENT')return {};throw e;});
let activeChild,stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;activeChild?.kill(signal);});
async function run(label,args,env={}){
 if(steps[label]?.ok){console.log(`REUSE ${label}`);return;}
 if(stopping)throw new Error('Stopped before next phase.');
 const prior=steps[label];
 if(label.startsWith('visual-')){const dir=args.find(a=>a.startsWith('--out='))?.slice(6);if(dir&&await fs.access(dir).then(()=>true,()=>false))await fs.rename(dir,`${dir}-interrupted-${Date.now()}`);}
 console.log(`START ${label} ${new Date().toISOString()}`);
 steps[label]={started:new Date().toISOString(),args,attempts:[...(prior?.attempts||[]),...(prior?[{...prior,attempts:undefined}]:[])]};await write('pipeline-steps.json',steps);
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env:{...process.env,...env},stdio:'inherit'});activeChild=child;child.on('error',reject);child.on('exit',(code)=>{activeChild=null;resolve(code);});});
 steps[label].ended=new Date().toISOString();steps[label].code=code;steps[label].ok=code===0&&!stopping;await write('pipeline-steps.json',steps);
 if(code!==0||stopping)throw new Error(`${label} exited ${code}`);
}
const pairArgs=(file,out,runs,resume=false)=>['tools/phone-speed-paired.mjs',`--targets=${root}/${file}`,`--out=${root}/${out}`,`--runs=${runs}`,'--duration=2500','--before=http://127.0.0.1:4174/','--after=http://127.0.0.1:4173/',`--before-source=${before}`,`--after-source=${after}`,...(resume?['--resume']:[])];
const ids=['photo-album',...targets.filter(t=>t.id!=='photo-album').map(t=>t.id)].join(',');
await run('visual-before',['tools/phone-speed-visuals.mjs',`--ids=${ids}`,`--out=${root}/visual-before`,'--url=http://127.0.0.1:4174/',`--source=${before}`,'--profile']);
await run('visual-after',['tools/phone-speed-visuals.mjs',`--ids=${ids}`,`--out=${root}/visual-after`,'--url=http://127.0.0.1:4173/',`--source=${after}`,`--compare=${root}/visual-before`,'--profile']);
const visualBefore=await read('visual-before/scores.json'),visualAfter=await read('visual-after/scores.json');
assert.equal(visualBefore.source,before);assert.equal(visualAfter.source,after);assert.deepEqual(visualBefore.protocol,visualAfter.protocol);
if(!compareRuns([],[],targets,visualAfter.rows,targets.map(t=>t.id),await read('repetitions.json'),await read('render-changes.json')).gates.appearance)throw new Error('Final stills fail the appearance gate; stop before the remaining target timings.');
await run('target-pairs',pairArgs('targets.json','paired',5,await exists('paired/protocol.json')));
for(const phase of ['before','after'])await copyOnce(`paired/${phase}.json`,`targets-${phase}.json`);
const selectedBefore=await read('targets-before.json'),selectedAfter=await read('targets-after.json');
assert.equal(selectedBefore.length,75);assert.equal(selectedAfter.length,75);
const targetReport=compareRuns(selectedBefore,selectedAfter,targets,visualAfter.rows,targets.map(t=>t.id),await read('repetitions.json'),await read('render-changes.json'));
await write('target-gates.json',targetReport);
if(!Object.values(targetReport.gates).every(Boolean))throw new Error(`Target gates failed: ${JSON.stringify(targetReport.gates)}`);
await run('phone-page-qa',[`${root}/phone-page-qa.mjs`],{PHONE_SPEED_SOURCE:after});
await run('catalog-pairs',pairArgs('all-toys.json','paired',1,true));
await run('catalog-screen',[`${root}/build-final-evidence.mjs`]);
await copyOnce('final-gates.json','catalog-screen-gates.json');
await copyOnce('flagged-others.json','catalog-screen-flags.json');
let flags=await read('catalog-screen-flags.json');
if(flags.length){
 const plan=await read('repetitions.json');for(const {id}of flags)plan[id]=5;
 await write('repetitions.json',plan);await writeOnce('regression-5-plan.json',{declaredAt:new Date().toISOString(),flags,repetitions:plan});
 await run('regression-five',pairArgs('catalog-screen-flags.json','paired-regressions',5,await exists('paired-regressions/protocol.json')));
 for(const phase of ['before','after'])await copyOnce(`paired-regressions/${phase}.json`,`regression-5-${phase}.json`);
 await run('regression-five-gates',[`${root}/build-final-evidence.mjs`]);
 await copyOnce('final-gates.json','regression-5-gates.json');
 await copyOnce('flagged-others.json','regression-10-targets.json');
 flags=await read('regression-10-targets.json');
 if(flags.length){
  for(const {id}of flags)plan[id]=10;
  await write('repetitions.json',plan);await writeOnce('regression-10-plan.json',{declaredAt:new Date().toISOString(),flags,repetitions:plan});
  await run('regression-ten',pairArgs('regression-10-targets.json','paired-regressions',10,true));
  for(const phase of ['before','after'])await fs.copyFile(`${root}/paired-regressions/${phase}.json`,`${root}/regression-10-${phase}.json`);
  await run('regression-ten-gates',[`${root}/build-final-evidence.mjs`]);
 }
}
const report=await read('final-gates.json');
console.log(JSON.stringify({finished:new Date().toISOString(),gates:report.gates,medianGain:report.medianGain,regressions:report.regressions.length}));
if(!Object.values(report.gates).every(Boolean))throw new Error('Final performance/visual gates failed; investigate all retained evidence.');
