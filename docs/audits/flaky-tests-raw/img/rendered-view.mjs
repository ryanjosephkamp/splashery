const records = new WeakMap();
const view = manager => {
  const p=manager.cameraNode.getPosition(),f=manager.cameraNode.forward;
  return [p.x,p.y,p.z,f.x,f.y,f.z].join(",");
};
const managers = stage => {
  const director=stage.app.renderer.gsplatDirector;
  if(!director?.camerasMap) throw Error("Missing native splat director");
  return Array.from(director.camerasMap.values()).flatMap(camera =>
    Array.from(camera.layersMap.values()).flatMap(layer =>
      [layer.gsplatManager,layer.gsplatManagerShadow].filter(Boolean)))
    .filter(manager => [manager.world.currentVersion,manager.world.lastWorldStateVersion]
      .some(version => manager.world.getState(version)?.totalActiveSplats>0));
};
function observe(manager) {
  if(records.has(manager)) return records.get(manager);
  const sorter=manager.cpuSorter, record={error:null,applied:new Map(),requests:0,responses:0};
  records.set(manager,record);
  if(manager.renderer.usesGpuSort) return record;
  if(!sorter?.worker || !Number.isInteger(sorter.jobsInFlight)) throw Error("Missing native CPU sorter");
  const pending=Array(sorter.jobsInFlight).fill(null),orders=new WeakMap();
  if(sorter.pendingSorted) orders.set(sorter.pendingSorted.orderData,null);
  const post=sorter.worker.postMessage;
  sorter.worker.postMessage=function(message,...rest) {
    if(message.command==="sort"){pending.push(view(manager));record.requests++;}
    const result=post.call(this,message,...rest);
    if(message.command==="sort" && pending.length!==sorter.jobsInFlight)
      record.error="Native sort request count mismatch";
    return result;
  };
  sorter.worker.addEventListener("message",event=>{
    if(!event.data.order) return;
    const key=pending.shift(),next=sorter.pendingSorted;
    if(key===undefined || pending.length!==sorter.jobsInFlight)
      record.error="Native sort response has no matching request";
    else if(!next || next.orderData.buffer!==event.data.order)
      record.error="Native sort response identity mismatch";
    else {orders.set(next.orderData,key);record.responses++;}
  });
  sorter.on("sorted",(_count,version,order)=>{
    if(!orders.has(order)){record.error="Applied native order has no response";return;}
    if(manager.world.currentVersion===version && manager.world.getState(version)?.sortedBefore)
      record.applied.set(version,orders.get(order));
  });
  return record;
}
export function state(stage) {
  return managers(stage).map(manager=>{
    const record=observe(manager),version=manager.world.currentVersion;
    if(record.error) throw Error(record.error);
    return {version,latest:manager.world.lastWorldStateVersion,view:view(manager),
      applied:record.applied.get(version),sorted:!!manager.world.getState(version)?.sortedBefore,
      gpu:manager.renderer.usesGpuSort,requests:record.requests,responses:record.responses};
  });
}
export async function captureSortedFrame(stage) {
  const started=performance.now(),requested=new Set();
  for(;;) {
    for(const manager of managers(stage)) {
      observe(manager);
      if(!requested.has(manager)){manager.sortNeeded=true;requested.add(manager);}
    }
    const canvas=await stage.captureFrame(),current=state(stage);
    if(current.length && current.every(s=>s.sorted && s.version===s.latest && (s.gpu || s.view===s.applied)))
      return canvas;
    if(performance.now()-started>30000)
      throw Error("Rendered view did not finish its native sort: "+JSON.stringify(current));
  }
}
