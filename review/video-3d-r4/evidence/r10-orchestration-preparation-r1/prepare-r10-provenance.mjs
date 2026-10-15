// MIT. Made by Ryan with Codex (GPT-6). CPU/HTTP-only exact frozen-protocol provenance preparation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {benchmarkCohort,fingerprint} from '/workspace/splashery-v3d-bench-tools-r10/tools/v3d-bench-metrics.mjs';
import {benchmarkLaunchArgs,servedSourceFingerprint,sessionObserver,FRAME_REPLACEMENT} from '/workspace/splashery-v3d-bench-tools-r10/tools/v3d-bench.mjs';
const root='/workspace/v3d-r4-media',repo='/workspace/splashery-v3d-bench-tools-r10',control=root+'/follow-r10-v1-control',url='http://127.0.0.1:4181/',hash=b=>createHash('sha256').update(b).digest('hex');
const option=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const productCommit=option('product-commit'),toolsCommit=option('tools-commit');
if(!/^[a-f0-9]{40}$/.test(productCommit||'')||!/^[a-f0-9]{40}$/.test(toolsCommit||''))throw Error('Explicit final --product-commit and --tools-commit are required; no R9 reuse');
if(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim()!==toolsCommit)throw Error('Wrong immutable R10 tools checkout commit');
if(!fs.existsSync(control)||JSON.parse(fs.readFileSync(control+'/declaration.json')).status!=='prepared-root-freeze-and-handoff-pending')throw Error('Prepared, unlaunched R10 control required');
if(fs.existsSync(control+'/provenance-preparation.json')||(fs.existsSync(control+'/templates')&&fs.readdirSync(control+'/templates').length))throw Error('Preserve previous preparation; fresh template outputs required');
const freeze=JSON.parse(fs.readFileSync(root+'/runtime-r10-freeze.json')),raw=fs.readFileSync(repo+'/tools/v3d-corpus.json'),clips=JSON.parse(raw),cohort=benchmarkCohort(clips);
if(clips.length!==20||freeze.productCommit!==productCommit||freeze.url!==url)throw Error('Unexpected final R10 source freeze');
for(const clip of clips)if(hash(fs.readFileSync(root+'/corpus/'+clip.file))!==clip.sha256)throw Error('Input checksum mismatch:'+clip.id);
const protocolNames=['v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs'];
const protocolFiles=protocolNames.map(file=>({file,sha256:hash(fs.readFileSync(repo+'/tools/'+file))}));
for(const f of protocolFiles){if(freeze.protocolFiles.find(v=>v.file===f.file)?.sha256!==f.sha256)throw Error('Frozen protocol mismatch');if(hash(fs.readFileSync('/workspace/splashery-v3d-bench-tools/tools/'+f.file))!==f.sha256)throw Error('Old five-protocol bytes changed');}
const protocolSha256=fingerprint({version:3,files:protocolFiles,wrappers:{observer:sessionObserver.toString(),SESSION_NEEDLE:'return new Session(opts);',SESSION_REPLACEMENT:'const s = new Session(opts); globalThis.__v3dBenchObserve(s); return s;',FRAME_NEEDLE:'  return out;',FRAME_REPLACEMENT}});
if(protocolSha256!=='bf94e388a2d71f1d3f7c75dd5d1855a4d69ddd8ba946dc81905faa85746e57ad')throw Error('Frozen five-module protocol changed');
const served=await servedSourceFingerprint(url);
if(served.sha256!==freeze.servedSource.sha256||fingerprint(served.files)!==fingerprint(freeze.servedSource.files))throw Error('Actual served source disagrees with parent freeze');
const executablePath='/usr/bin/chromium',version=execFileSync(executablePath,['--version'],{encoding:'utf8',timeout:30000}).trim(),browserVersion=version.match(/\d+\.\d+\.\d+\.\d+/)?.[0];if(!browserVersion)throw Error('Cannot establish browser version');
const environment={platform:process.platform,architecture:process.arch,cpuModel:os.cpus()[0]?.model||'unknown',cpuQuota:fs.existsSync('/sys/fs/cgroup/cpu.max')?fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim():null,browserVersion,executablePath:fs.realpathSync(executablePath),executableSha256:hash(fs.readFileSync(executablePath)),launchArgs:benchmarkLaunchArgs('swiftshader'),node:process.version,ffmpeg:execFileSync('ffmpeg',['-version'],{encoding:'utf8',timeout:30000}).split('\n')[0],ffprobe:execFileSync('ffprobe',['-version'],{encoding:'utf8',timeout:30000}).split('\n')[0]};
const options={gpuMode:'swiftshader',timeout:1800000,rate:'3',setting:'auto',span:'Smallest native 5/10/20-second setting that covers the full clip',scoringSide:640,profiles:{phone:{width:390,height:844,deviceScaleFactor:1,profile:'low',mobile:true},desktop:{width:1440,height:900,deviceScaleFactor:1,profile:'high',mobile:false}}};
const reference=root+'/main-master-r1',main=JSON.parse(fs.readFileSync(reference+'/run.json')),baselineExpected='7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6';
if(main.provenanceSha256!==baselineExpected||fingerprint(main.provenance)!==baselineExpected||main.provenance.protocolSha256!==protocolSha256||fingerprint(main.cohort)!==fingerprint(cohort))throw Error('Reference/protocol/cohort mismatch');
const receipts={created:new Date().toISOString(),codeSha256:hash(fs.readFileSync(import.meta.filename)),sourceFreezeSha256:hash(fs.readFileSync(root+'/runtime-r10-freeze.json')),productCommit:freeze.productCommit,toolsCommit,servedSourceSha256:served.sha256,servedPaths:served.files.length,protocolSha256,protocolFiles,browserVersion,templates:{},noGpuOrBrowserLaunch:true,method:'Exact exported wrapper strings/functions and same five files; actual HTTP served bytes, input bytes, installed executable/version/environment; native default options. Unchanged strict runner independently recomputes before first browser.'};
fs.mkdirSync(control+'/templates',{recursive:true});
fs.copyFileSync(root+'/runtime-r10-freeze.json',control+'/runtime-freeze.json',fs.constants.COPYFILE_EXCL);
for(const [mode,ref] of [['paired',{path:reference,provenanceSha256:baselineExpected}],['unpaired',null]]){
 const provenance={protocolSha256,reference:ref,servedSource:served,url,environment,options,manifestSha256:hash(raw),inputs:clips.map(({id,sha256,duration,file})=>({id,sha256,duration,file}))};
 const template={created:new Date().toISOString(),url,manifestSha256:hash(raw),cohort,provenance,provenanceSha256:fingerprint(provenance),reference:ref,selection:{ids:[],profiles:[]},renderer:'Production toy, PlayCanvas WebGL2, swiftshader WebGPU launch; emulated phone and desktop; native tier settings. Memory is aggregate sampled browser RSS, not GPU RAM. Timing is emulator timing, not physical-phone performance.',results:[]};
 const file=control+'/templates/'+mode+'.json';fs.writeFileSync(file,JSON.stringify(template,null,2)+'\n');receipts.templates[mode]={file,sha256:hash(fs.readFileSync(file)),provenanceSha256:template.provenanceSha256};
}
fs.writeFileSync(control+'/provenance-preparation.json',JSON.stringify(receipts,null,2)+'\n');console.log(JSON.stringify(receipts,null,2));
