import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {compareRuns} from '../../tools/phone-speed-compare.mjs';
const root='.cache/phone-speed',read=async name=>JSON.parse(await fs.readFile(`${root}/${name}`,'utf8'));
assert.equal((await read('paired/paused.json')).contextOpen,false);
const targets=await read('early-regression-targets.json');
try{
 const args=['tools/phone-speed-paired.mjs',`--targets=${root}/early-regression-targets.json`,`--out=${root}/paired-regressions`,'--runs=5','--duration=2500','--before=http://127.0.0.1:4174/','--after=http://127.0.0.1:4173/','--before-source=36f5df601963f418f71b98ee460783ea6191b0bc','--after-source=072f15f3d00150825f36784b504b8b365c892cd7'];
 if(await fs.access(`${root}/paired-regressions/protocol.json`).then(()=>true,()=>false))args.push('--resume');
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
 if(code!==0)throw new Error('Early follow-up exited '+code);
 const before=await read('paired-regressions/before.json'),after=await read('paired-regressions/after.json');
 const ids=targets.map(t=>t.id),report=compareRuns(before,after,[],[],ids,Object.fromEntries(ids.map(id=>[id,5])));
 await fs.writeFile(`${root}/early-regression-gates.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({rows:report.rows.map(r=>({id:r.id,valid:r.valid,changes:r.changes})),regressions:report.regressions.map(r=>r.id)}));
}finally{await fs.rm(`${root}/paired/pause`,{force:true});console.log('RESUMED original catalog '+new Date().toISOString());}
