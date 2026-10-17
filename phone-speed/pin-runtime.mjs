import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources={before:{root:'/workspace/phone-speed-baseline',url:'http://127.0.0.1:4174/',pin:'36f5df601963f418f71b98ee460783ea6191b0bc'},after:{root:'/workspace/splashery',url:'http://127.0.0.1:4173/',pin:execFileSync('git',['rev-parse',process.argv.find(a=>a.startsWith('--source='))?.slice(9)||'HEAD'],{encoding:'utf8'}).trim()}};
for(const cfg of Object.values(sources)){
 execFileSync('git',['diff','--exit-code',cfg.pin,'--','src','vendor','index.html','styles.css','assets'],{cwd:cfg.root});
 const paths=execFileSync('git',['ls-files','src','vendor','index.html','styles.css'],{cwd:cfg.root,encoding:'utf8'}).trim().split('\n');
 cfg.files=Object.fromEntries(await Promise.all(paths.map(async file=>[file,hash(await fs.readFile(`${cfg.root}/${file}`))])));
 for(const file of ['src/player.js','src/stage.js','src/rig.js','src/packs/video3d.js','src/pc.js','src/toys.js','index.html','styles.css']){
  const response=await fetch(new URL(file,cfg.url));if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==cfg.files[file])throw new Error(`Served runtime mismatch: ${cfg.url}${file}`);
 }
 cfg.digest=hash(JSON.stringify(cfg.files));
}
await fs.writeFile('.cache/phone-speed/runtime-manifest.json',JSON.stringify({at:new Date().toISOString(),sources},null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(sources).map(([phase,c])=>[phase,{pin:c.pin,files:Object.keys(c.files).length,digest:c.digest}]))));
