// MIT. Validate stored and losslessly restored bytes without launching any renderer.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {verifyArchived} from './storage.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [snapshot,restore]=process.argv.slice(2);if(!snapshot)throw Error('node verify.mjs SNAPSHOT [FRESH-RESTORE-DIRECTORY]');
const root=fs.realpathSync(snapshot),freeze=JSON.parse(fs.readFileSync(path.join(root,'snapshot-freeze.json'))),mappings=JSON.parse(fs.readFileSync(path.join(root,'restore-map.json')));
for(const row of freeze.files)if(row.type==='file'){
  const b=fs.readFileSync(path.join(root,row.path));if(sha(b)!==row.sha256||b.length!==row.bytes)throw Error('Stored snapshot changed '+row.path);
}
const result=verifyArchived(root,mappings);
if(restore){
  const output=path.resolve(restore);if(fs.existsSync(output)||output===root||output.startsWith(root+path.sep)||root.startsWith(output+path.sep)||!output.startsWith('/workspace/v3d-r4-media/'))throw Error('Fresh, separate outside-repo restore directory required');
  fs.cpSync(root,output,{recursive:true,force:false,errorOnExist:true});
  for(const m of mappings){const b=gunzipSync(fs.readFileSync(path.join(output,m.storedRelativePath))),target=path.join(output,m.originalRelativePath);fs.writeFileSync(target,b,{flag:'wx'});if(sha(fs.readFileSync(target))!==m.originalSha256)throw Error('Restored bytes differ');}
  result.restoredTo=output;
}
console.log(JSON.stringify({storedFiles:freeze.files.filter(r=>r.type==='file').length,...result},null,2));
