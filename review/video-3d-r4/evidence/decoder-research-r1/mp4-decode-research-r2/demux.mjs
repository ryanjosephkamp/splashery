// SPDX-License-Identifier: MIT
// Made by Ryan with Codex (GPT-6). Original bounded research implementation.
// No decoding, browser, mutation, external code, or fragmented/encrypted MP4 support.
export const LIMITS=Object.freeze({fileBytes:128*1024*1024,samples:100000,boxes:10000,tableRows:100000,depth:12,sampleBytes:32*1024*1024,aspectSpacing:1000000,aspectRatio:64,trackDisplaySide:32768});
export class UnsupportedMp4 extends Error {}
const fail=s=>{throw new UnsupportedMp4(s);};
export function demuxAvc(bytes){
 if(!(bytes instanceof Uint8Array))throw TypeError('Expected Uint8Array bytes');
 const b=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const text=(start,end)=>String.fromCharCode(...b.subarray(start,end));
 if(b.length<8||b.length>LIMITS.fileBytes)fail('File size outside bounded prototype');
 let nboxes=0;
 const need=(at,n,end=b.length)=>{if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||at+n>end||end>b.length)fail('Truncated or unsafe box/table bounds');};
 const u32=(at,end)=>{need(at,4,end);return view.getUint32(at);};
 const i32=(at,end)=>{need(at,4,end);return view.getInt32(at);};
 const u64=(at,end)=>{need(at,8,end);const v=view.getBigUint64(at);if(v>BigInt(Number.MAX_SAFE_INTEGER))fail('Unsafe 64-bit integer');return Number(v);};
 const i64=(at,end)=>{need(at,8,end);const v=view.getBigInt64(at);if(v>BigInt(Number.MAX_SAFE_INTEGER)||v<BigInt(Number.MIN_SAFE_INTEGER))fail('Unsafe signed 64-bit integer');return Number(v);};
 const boxes=(start,end,depth=0)=>{if(depth>LIMITS.depth)fail('Box nesting limit');const out=[];let p=start;while(p<end){if(++nboxes>LIMITS.boxes)fail('Box count limit');need(p,8,end);let size=u32(p,end),header=8;const type=text(p+4,p+8);if(size===1){size=u64(p+8,end);header=16;}else if(size===0)size=end-p;if(size<header)fail('Invalid box size');need(p,size,end);out.push({type,start:p,data:p+header,end:p+size,size,depth});p+=size;}if(p!==end)fail('Box boundary mismatch');return out;};
 const children=x=>boxes(x.data,x.end,x.depth+1);
 const one=(xs,t,optional=false)=>{const found=xs.filter(x=>x.type===t);if(found.length!==1){if(optional&&found.length===0)return null;fail('Expected one '+t);}return found[0];};
 const full=(x,versions=[0])=>{need(x.data,4,x.end);const version=b[x.data];if(!versions.includes(version))fail('Unsupported '+x.type+' version '+version);if(b[x.data+1]||b[x.data+2]||b[x.data+3])fail('Unsupported '+x.type+' flags');return version;};
 const table=(x,stride,versions=[0])=>{const v=full(x,versions),n=u32(x.data+4,x.end);if(n>LIMITS.tableRows||x.data+8+n*stride!==x.end)fail('Invalid '+x.type+' table length');return {n,p:x.data+8,v};};
 const top=boxes(0,b.length),ftyp=one(top,'ftyp'),moov=one(top,'moov');
 if(top.some(x=>['moof','mfra','sidx'].includes(x.type)))fail('Fragmented/indexed MP4 unsupported');
 need(ftyp.data,8,ftyp.end);if((ftyp.end-ftyp.data)%4||ftyp.end-ftyp.data>264)fail('Malformed/oversized ftyp');
 const brands=[];for(let p=ftyp.data;p<ftyp.end;p+=4)if(p!==ftyp.data+4)brands.push(text(p,p+4));
 const mc=children(moov);if(mc.some(x=>x.type==='mvex'))fail('Fragmented MP4 mvex unsupported');
 const mvhd=one(mc,'mvhd'),mv=full(mvhd,[0,1]),movieTimescale=u32(mvhd.data+(mv?20:12),mvhd.end);if(!movieTimescale)fail('Invalid movie timescale');
 const tracks=[];
 for(const trak of mc.filter(x=>x.type==='trak')){const tc=children(trak),mdia=one(tc,'mdia'),md=children(mdia),hdlr=one(md,'hdlr');full(hdlr);need(hdlr.data,12,hdlr.end);if(text(hdlr.data+8,hdlr.data+12)==='vide')tracks.push({trak,tc,md});}
 if(tracks.length!==1)fail('Need exactly one video track');
 const {tc,md}=tracks[0],tkhd=one(tc,'tkhd');need(tkhd.data,4,tkhd.end);const tv=b[tkhd.data];if(tv!==0&&tv!==1)fail('Unsupported tkhd version');
 const matrixStart=tkhd.data+(tv?52:40),identity=[65536,0,0,0,65536,0,0,0,1073741824];need(matrixStart,44,tkhd.end);
 for(let i=0;i<9;i++)if(i32(matrixStart+4*i,tkhd.end)!==identity[i])fail('Rotation/nonidentity track matrix unsupported');
 const widthFixed16=u32(matrixStart+36,tkhd.end),heightFixed16=u32(matrixStart+40,tkhd.end),trackWidth=widthFixed16/65536,trackHeight=heightFixed16/65536;
 if(!widthFixed16||!heightFixed16||trackWidth>LIMITS.trackDisplaySide||trackHeight>LIMITS.trackDisplaySide)fail('Unsafe track display dimensions');
 const mdhd=one(md,'mdhd'),dv=full(mdhd,[0,1]),timescale=u32(mdhd.data+(dv?20:12),mdhd.end),mediaDuration=dv?u64(mdhd.data+24,mdhd.end):u32(mdhd.data+16,mdhd.end);
 if(!timescale||timescale>1000000000||!mediaDuration)fail('Invalid media clock');
 let mediaTimeOffset=0,editDuration=null;
 const edts=one(tc,'edts',true);
 if(edts){const elst=one(children(edts),'elst'),ev=full(elst,[0,1]),n=u32(elst.data+4,elst.end),stride=ev?20:12;if(n!==1||elst.data+8+stride!==elst.end)fail('Nontrivial edit list unsupported');let p=elst.data+8;const segment=ev?u64(p,elst.end):u32(p,elst.end);p+=ev?8:4;mediaTimeOffset=ev?i64(p,elst.end):i32(p,elst.end);p+=ev?8:4;need(p,4,elst.end);if(mediaTimeOffset<0||view.getInt16(p)!==1||view.getInt16(p+2)!==0||!segment)fail('Empty/nonunit edit unsupported');editDuration=segment*timescale/movieTimescale;if(!Number.isSafeInteger(segment*timescale)||!Number.isFinite(editDuration))fail('Unsafe edit clock conversion');}
 const minf=one(md,'minf'),stbl=one(children(minf),'stbl'),sc=children(stbl);
 for(const x of sc)if(['senc','saiz','saio','stz2','sgpd','sbgp'].includes(x.type))fail('Unsupported encrypted/compact/grouped samples: '+x.type);
 const stsd=one(sc,'stsd');full(stsd);if(u32(stsd.data+4,stsd.end)!==1)fail('Multiple sample descriptions unsupported');const entries=boxes(stsd.data+8,stsd.end,stsd.depth+1);if(entries.length!==1)fail('Sample description count mismatch');const entry=entries[0];if(!['avc1','avc3'].includes(entry.type))fail('Unsupported video codec '+entry.type);
 need(entry.data,78,entry.end);if(view.getUint16(entry.data+6)!==1)fail('External data reference unsupported');const width=view.getUint16(entry.data+24),height=view.getUint16(entry.data+26);if(!width||!height||width>8192||height>8192)fail('Unsafe sample dimensions');
 const ec=boxes(entry.data+78,entry.end,entry.depth+1);if(ec.some(x=>['sinf','tenc','encv','clap'].includes(x.type)))fail('Encrypted/cropped sample unsupported');
 const pasp=one(ec,'pasp',true);if(pasp&&pasp.end-pasp.data!==8)fail('Malformed pasp size');
 const hSpacing=pasp?u32(pasp.data,pasp.end):1,vSpacing=pasp?u32(pasp.data+4,pasp.end):1;
 if(!hSpacing||!vSpacing||hSpacing>LIMITS.aspectSpacing||vSpacing>LIMITS.aspectSpacing||hSpacing>LIMITS.aspectRatio*vSpacing||vSpacing>LIMITS.aspectRatio*hSpacing)fail('Zero/extreme pixel aspect unsupported');
 const gcd=(a,b)=>{while(b){const t=a%b;a=b;b=t;}return a;},darW=width*hSpacing,darH=height*vSpacing,divisor=gcd(darW,darH),displayAspectWidth=darW/divisor,displayAspectHeight=darH/divisor;
 if(!Number.isSafeInteger(darW)||!Number.isSafeInteger(darH)||displayAspectWidth>0xffffffff||displayAspectHeight>0xffffffff)fail('Unsafe display aspect integer');
 // Each stored 16.16 track dimension may differ from ideal by less than one LSB.
 const delta=BigInt(widthFixed16)*BigInt(displayAspectHeight)-BigInt(heightFixed16)*BigInt(displayAspectWidth),tolerance=BigInt(displayAspectWidth)+BigInt(displayAspectHeight);
 if(delta>tolerance||delta< -tolerance)fail('Track/sample display geometry inconsistent');
 const sampleAspectRatio={hSpacing,vSpacing},trackDisplay={width:trackWidth,height:trackHeight,widthFixed16,heightFixed16};
 const colr=one(ec,'colr',true);let colorMetadata=null;
 if(colr){need(colr.data,4,colr.end);const type=text(colr.data,colr.data+4),expected=type==='nclc'?10:type==='nclx'?11:0;if(!expected)fail('Unsupported colr type '+type);if(colr.end-colr.data!==expected)fail('Malformed '+type+' colr size');if(type==='nclx'&&(b[colr.data+10]&127))fail('Nonzero nclx reserved bits');colorMetadata={type,primaries:view.getUint16(colr.data+4),transfer:view.getUint16(colr.data+6),matrix:view.getUint16(colr.data+8),fullRange:type==='nclx'?!!(b[colr.data+10]&128):null};}
 const avcC=one(ec,'avcC');need(avcC.data,7,avcC.end);if(avcC.end-avcC.data>65536)fail('Oversized AVC configuration');if(b[avcC.data]!==1||b[avcC.data+4]>>2!==63||b[avcC.data+5]>>5!==7)fail('Invalid AVC configuration');const lengthSize=(b[avcC.data+4]&3)+1;if(lengthSize===3)fail('Reserved AVC NAL length size');let ap=avcC.data+6;const sps=b[avcC.data+5]&31;if(!sps)fail('In-band-only SPS unsupported');const parameterSets=count=>{for(let i=0;i<count;i++){need(ap,2,avcC.end);const len=view.getUint16(ap);ap+=2;if(!len)fail('Empty AVC parameter set');need(ap,len,avcC.end);ap+=len;}};parameterSets(sps);need(ap,1,avcC.end);const pps=b[ap++];if(!pps)fail('In-band-only PPS unsupported');parameterSets(pps);
 const codec=entry.type+'.'+Array.from(b.subarray(avcC.data+1,avcC.data+4),x=>x.toString(16).padStart(2,'0')).join(''),description=b.slice(avcC.data,avcC.end);
 const stsz=one(sc,'stsz');full(stsz);const fixed=u32(stsz.data+4,stsz.end),count=u32(stsz.data+8,stsz.end);if(!count||count>LIMITS.samples||stsz.data+12+(fixed?0:4*count)!==stsz.end)fail('Invalid sample count/size table');const sizes=new Uint32Array(count);for(let i=0;i<count;i++){const sz=fixed||u32(stsz.data+12+i*4,stsz.end);if(!sz||sz>LIMITS.sampleBytes)fail('Invalid/oversized sample');sizes[i]=sz;}
 const durations=new Uint32Array(count),composition=new Float64Array(count);
 const expand=(x,target,signed=false)=>{const t=table(x,8,signed?[0,1]:[0]);let index=0;for(let i=0;i<t.n;i++){const p=t.p+i*8,n=u32(p,x.end),value=signed&&t.v===1?i32(p+4,x.end):u32(p+4,x.end);if(!n||n>count-index||(!signed&&!value))fail('Invalid '+x.type+' run');target.fill(value,index,index+n);index+=n;}if(index!==count)fail(x.type+' sample count mismatch');};
 expand(one(sc,'stts'),durations);const ctts=one(sc,'ctts',true);if(ctts)expand(ctts,composition,true);
 const stsc=one(sc,'stsc'),t=table(stsc,12);if(!t.n)fail('Empty stsc');const chunkRuns=[];for(let i=0;i<t.n;i++){const p=t.p+i*12,first=u32(p,stsc.end),per=u32(p+4,stsc.end),desc=u32(p+8,stsc.end);if((i===0&&first!==1)||(i&&first<=chunkRuns[i-1].first)||!per||per>count||desc!==1)fail('Invalid stsc mapping');chunkRuns.push({first,per});}
 const stco=one(sc,'stco',true),co64=one(sc,'co64',true);if(!!stco===!!co64)fail('Need exactly one chunk-offset table');const co=stco||co64,ct=table(co,co64?8:4);if(!ct.n||ct.n>count||chunkRuns.at(-1).first>ct.n)fail('Invalid chunk count');
 const key=new Uint8Array(count);const stss=one(sc,'stss',true);if(!stss)key.fill(1);else{const kt=table(stss,4);let last=0;for(let i=0;i<kt.n;i++){const k=u32(kt.p+4*i,stss.end);if(k<=last||k>count)fail('Invalid sync sample index');key[k-1]=1;last=k;}}if(!key[0])fail('First sample not random access');
 const mdats=top.filter(x=>x.type==='mdat');if(!mdats.length||mdats.length>64)fail('Missing/excessive mdat count');let index=0,run=0,dts=0;const samples=[];
 for(let c=1;c<=ct.n;c++){while(run+1<chunkRuns.length&&chunkRuns[run+1].first<=c)run++;let offset=co64?u64(ct.p+(c-1)*8,co.end):u32(ct.p+(c-1)*4,co.end);for(let j=0;j<chunkRuns[run].per;j++){if(index>=count)fail('Chunk mapping exceeds sample count');const size=sizes[index],duration=durations[index],rawPts=dts+composition[index],pts=rawPts-mediaTimeOffset;if(!Number.isSafeInteger(dts+duration)||!Number.isSafeInteger(rawPts))fail('Unsafe media timestamp');if(!mdats.some(m=>offset>=m.data&&offset+size<=m.end))fail('Sample outside mdat');if(editDuration!==null&&(pts<0||pts>=editDuration))fail('Edit excludes a retained sample');samples.push({offset,size,dts:dts-mediaTimeOffset,pts,duration,key:!!key[index]});offset+=size;dts+=duration;index++;}}
 if(index!==count||dts!==mediaDuration)fail('Sample timeline/count differs from mdhd');
 const ordered=[...samples].sort((a,b)=>a.offset-b.offset);for(let i=1;i<ordered.length;i++)if(ordered[i].offset<ordered[i-1].offset+ordered[i-1].size)fail('Overlapping sample storage');
 return {config:{codec,description,codedWidth:width,codedHeight:height,displayAspectWidth,displayAspectHeight},codec,description,width,height,sampleAspectRatio,trackDisplay,trackDisplayWidth:trackWidth,trackDisplayHeight:trackHeight,colorMetadata,timescale,mediaDuration,movieTimescale,mediaTimeOffset,editOffset:mediaTimeOffset,editDuration,brands,lengthSize,samples,limits:LIMITS};
}
// Track-tick timestamps have the single linear edit offset already subtracted.
export const parseAvcMp4=demuxAvc;
