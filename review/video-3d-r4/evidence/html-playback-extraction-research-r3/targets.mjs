// MIT. Made by Ryan with Codex (GPT-6). Exact source-table targets; no decoding or time relabelling.
import {windowTimes} from './src/frames.js';
export function ceilTargets(samples,timescale,plan,tries=3){
 if(!Number.isInteger(timescale)||timescale<=0)throw Error('Invalid source timescale');
 const ordered=[...samples].sort((a,b)=>a.pts-b.pts);let prior=-Infinity;
 for(const s of ordered){if(!Number.isSafeInteger(s.pts)||s.pts<=prior)throw Error('Ambiguous source PTS');prior=s.pts;}
 const targets=[];let previousMicros=-Infinity;
 for(const [window,w]of plan.windows.entries())for(const[trial,requestedTime]of windowTimes(w,tries).entries()){
  const req=Math.round(requestedTime*1e6),scaled=BigInt(req)*BigInt(timescale);let lo=0,hi=ordered.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(BigInt(ordered[mid].pts)*1000000n<scaled)lo=mid+1;else hi=mid;}
  const sample=ordered[lo];if(!sample)throw Error('No source ceil frame');const time=sample.pts/timescale,micros=Math.round(time*1e6);
  if(!Number.isSafeInteger(micros)||time<w.from||time>=w.to)throw Error('Ceil frame outside original window');
  if(micros<=previousMicros)throw Error('Repeated/ambiguous trial source PTS');previousMicros=micros;
  targets.push({window,trial,requestedTime,pts:sample.pts,time,micros,sourcePresentationIndex:lo});
 }
 return targets;
}
export function compareActual(time,target){if(!Number.isFinite(time))throw Error('Missing actual source PTS');const micros=Math.round(time*1e6);return micros===target.micros?0:micros<target.micros?-1:1;}
export function startupAction(warmTime,firstTarget){const c=compareActual(warmTime,firstTarget);return c===0?'capture-confirmed':c<0?'continue':'rewind-once';}
