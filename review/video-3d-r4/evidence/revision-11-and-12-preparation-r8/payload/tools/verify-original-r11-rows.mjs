
import fs from 'node:fs';import path from 'node:path';
import {fingerprint} from '/workspace/splashery-v3d-bench-tools-r11/tools/v3d-bench-metrics.mjs';
import {verifyArtifacts,assertReferenceEvidence} from '/workspace/splashery-v3d-bench-tools-r11/tools/v3d-bench.mjs';
const root='/workspace/v3d-r4-media',snapshot=root+'/candidate-r11-final-reconcile-snapshots-r1/0001';
const read=p=>JSON.parse(fs.readFileSync(p)),joined=read(snapshot+'/run.json'),baseline=read(snapshot+'/join-reference/run.json');
const expected={paired:'1b3d8c578a0c06e1b20b79e90d61af9bcbd29aacc6fbe4d4dbd972096c23de5c',unpaired:'adfcf59a89a7ce8e7fd1bb34e62696ca48f03dc4c8810402218dbfedbec0bc42'};
const rows=[];for(const name of fs.readdirSync(root+'/candidate-r11-v1-shards').sort()){
 const directory=root+'/candidate-r11-v1-shards/'+name,run=read(directory+'/run.json'),mode=name.endsWith('-unpaired')?'unpaired':'paired';
 if(fingerprint(run.provenance)!==run.provenanceSha256||run.provenanceSha256!==expected[mode]||run.results.length!==1)throw Error('Wrong captured R11 provenance/row count');
 const row=run.results[0];if(fingerprint(read(directory+'/'+row.id+'-'+row.profile+'/result.json'))!==fingerprint(row))throw Error('Row changed');
 verifyArtifacts(directory,row);
 if(mode==='paired'){
  assertReferenceEvidence(snapshot+'/join-reference',baseline,row,baseline.provenanceSha256);
  if(fingerprint(joined.results.find(r=>r.id===row.id&&r.profile===row.profile))!==fingerprint(row))throw Error('Join row changed');
 }
 rows.push({directory:name,mode,id:row.id,profile:row.profile,status:row.status,provenanceSha256:run.provenanceSha256});
}if(rows.length!==13||joined.results.length!==8||rows.filter(r=>r.mode==='unpaired').length!==5)throw Error('Unexpected R11 counts');
console.log(JSON.stringify({verified:true,rows,strictPairedRows:8,unpairedRows:5}));
