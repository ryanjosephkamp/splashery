#!/usr/bin/env python3
"""MIT. Restore or verify immutable packet bytes; no browser, imports, or network."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

def hash_bytes(value):return hashlib.sha256(value).hexdigest()
def safe_relative(value):
    path=Path(value)
    if path.is_absolute() or not path.parts or '..' in path.parts:raise ValueError('Unsafe packet path: '+value)
    return path
def verify(packet,destination=None):
    packet=Path(packet).resolve()
    if destination is not None:
        destination=Path(destination).absolute()
        if destination.exists() or destination.is_symlink():raise ValueError('Restoration destination must be fresh.')
        if destination==packet or packet in destination.parents or destination in packet.parents:raise ValueError('Keep restoration separate from the packet.')
        destination.mkdir(parents=True)
    count=0;original=0;stored=0;compressed=0;seen=set()
    with gzip.open(packet/'mappings.jsonl.gz','rt',encoding='utf8') as stream:
        for line in stream:
            row=json.loads(line);relative=safe_relative(row['restoredPath'])
            if str(relative) in seen:raise ValueError('Duplicate restored path.')
            seen.add(str(relative))
            if row['type']=='directory':
                if destination is not None:(destination/relative).mkdir(parents=True,exist_ok=True)
                continue
            file=packet/safe_relative(row['storedPath'])
            if file.is_symlink() or not file.is_file():raise ValueError('Missing/special packet file: '+str(file))
            value=file.read_bytes()
            if len(value)!=row['storedBytes'] or hash_bytes(value)!=row['storedSha256']:raise ValueError('Stored byte/hash mismatch: '+str(file))
            if row['encoding']=='gzip':
                if len(value)<10 or value[4:8]!=b'\x00'*4:raise ValueError('Gzip timestamp is not reproducible.')
                value=gzip.decompress(value);compressed+=1
            elif row['encoding']!='identity':raise ValueError('Unknown storage encoding.')
            if len(value)!=row['originalBytes'] or hash_bytes(value)!=row['originalSha256']:raise ValueError('Restored byte/hash mismatch: '+str(file))
            if destination is not None:
                target=destination/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(value)
                if hash_bytes(target.read_bytes())!=row['originalSha256']:raise ValueError('Written restored bytes differ.')
            count+=1;original+=len(value);stored+=row['storedBytes']
    return {'verified':True,'files':count,'originalBytes':original,'storedPayloadBytes':stored,'gzipFiles':compressed,'restoredToFreshDirectory':destination is not None,'allStoredAndRestoredHashesExact':True}
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--packet',default=str(Path(__file__).resolve().parent));parser.add_argument('--restore')
    args=parser.parse_args();print(json.dumps(verify(args.packet,args.restore),indent=2))
if __name__=='__main__':main()
