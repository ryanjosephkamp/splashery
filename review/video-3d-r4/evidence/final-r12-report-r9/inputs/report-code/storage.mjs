// MIT. Lossless storage only; no image modification or telemetry rewriting.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function archiveRaw(directory,sources={}){
  const mappings=[];
  const visit=(at,relative='')=>{
    for(const item of fs.readdirSync(at,{withFileTypes:true})){
      const name=relative+item.name,file=path.join(at,item.name);
      if(item.isDirectory()){visit(file,name+'/');continue;}
      if(!item.isFile())throw Error('Special snapshot file refused');
      const raw=fs.readFileSync(file),oversizedImage=/\.(png|jpe?g|webp)$/i.test(name)&&raw.length>1_000_000;
      const machine=/(^|\/)(inputs|evidence|sample-cohorts)\//.test(name)&&/\.(json|log|txt|jsonl|md)$/i.test(name)&&!name.endsWith('/README.md')||['report.json','sample-cohorts.json','strict-comparison.json'].includes(name);
      if(!oversizedImage&&!machine)continue;
      if(oversizedImage&&!sources[name])throw Error('Oversized image lacks original source path '+name);
      const stored=name+'.gz',compressed=gzipSync(raw,{level:9,mtime:0});
      if(!gunzipSync(compressed).equals(raw))throw Error('Lossless gzip verification failed');
      fs.writeFileSync(path.join(directory,stored),compressed,{flag:'wx'});fs.unlinkSync(file);
      mappings.push({originalRelativePath:name,storedRelativePath:stored,sourcePath:sources[name]??null,originalBytes:raw.length,originalSha256:sha(raw),storedBytes:compressed.length,storedSha256:sha(compressed),restoredSha256:sha(gunzipSync(compressed)),reason:oversizedImage?'Original image above1,000,000bytes; no resizing or pixel edits':'Exact original raw machine/source text; avoids prose checking or rewriting original evidence'});
    }
  };visit(directory);return mappings;
}
export function verifyArchived(directory,mappings){
  for(const m of mappings){
    if(path.isAbsolute(m.storedRelativePath)||m.storedRelativePath.split('/').includes('..')||path.isAbsolute(m.originalRelativePath)||m.originalRelativePath.split('/').includes('..'))throw Error('Unsafe restore mapping');
    const b=fs.readFileSync(path.join(directory,m.storedRelativePath)),raw=gunzipSync(b);
    if(sha(b)!==m.storedSha256||sha(raw)!==m.originalSha256||sha(raw)!==m.restoredSha256||raw.length!==m.originalBytes)throw Error('Archived original bytes differ '+m.originalRelativePath);
  }return {files:mappings.length,originalBytes:mappings.reduce((n,m)=>n+m.originalBytes,0),allRestoredHashesExact:true};
}
