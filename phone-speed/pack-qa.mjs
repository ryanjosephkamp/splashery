import fs from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out='.cache/phone-speed/pack-qa',ids=['video-3d','photo-album'];
const source=process.argv.find(a=>a.startsWith('--source='))?.slice(9)||'HEAD';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),originals=new Map();
const evidence={source,started:new Date().toISOString(),thumbs:{},checks:{}};
for(const id of ids){const path=`assets/toys/${id}/thumb.webp`,original=execFileSync('git',['show',`${source}:${path}`]);originals.set(path,original);await fs.writeFile(`${out}/${id}-original-thumb.webp`,original);evidence.thumbs[id]={originalSHA256:sha(original)};}
const run=async(label,args)=>{
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
 evidence.checks[label]={args,code};if(code!==0)throw new Error(`${label} exited ${code}`);
};
try{
 await run('check-packs',['tools/check-packs.mjs','video3d','pictures']);
 await run('make-thumbnails',['tools/make-thumbs.mjs',...ids]);
 for(const id of ids){const thumbnail=await fs.readFile(`assets/toys/${id}/thumb.webp`);await fs.writeFile(`${out}/${id}-rerendered-thumb.webp`,thumbnail);evidence.thumbs[id].rerenderedSHA256=sha(thumbnail);}
 await run('contact-sheet',['tools/contact-sheet.mjs',`${out}/contact-sheet.png`,...ids]);
 evidence.completed=new Date().toISOString();
}finally{
 for(const [path,original]of originals)await fs.writeFile(path,original);
 for(const id of ids)evidence.thumbs[id].restoredSHA256=sha(await fs.readFile(`assets/toys/${id}/thumb.webp`));
 await fs.writeFile(`${out}/checks.json`,JSON.stringify(evidence,null,2));
}
