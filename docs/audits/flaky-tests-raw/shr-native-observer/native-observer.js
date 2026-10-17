// Diagnostic only: retain real recorder methods and native events.
(() => {
  const rows = window.__recordingEvents = [], ids = new WeakMap(); let serial = 0, frames = 0;
  const snapshot = () => {
    const app = window.__splashery?.app, ctx = app?.sound?.ctx, dialog = document.getElementById("rec-preview");
    return {wall:performance.now(), audio:ctx?.currentTime, audioState:ctx?.state,
      frames, rendered:window.__recordingRendered||0, stageFrames:app?.player?.stage?.frames, canvas:[app?.player?.stage?.app?.graphicsDevice?.width,app?.player?.stage?.app?.graphicsDevice?.height], recording:!!app?.recording, waiting:!!app?.recordWait,
      recorded:app?.recorded && {bytes:app.recorded.blob?.size,seconds:app.recorded.seconds},
      dialogOpen:dialog?.open, video:document.getElementById("rec-video")?.readyState,
      toast:document.getElementById("toast")?.textContent};
  };
  const log = (kind, extra={}) => {
    const row={kind,...snapshot(),...extra};rows.push(row);
    console.log("NATIVE-RECORD "+JSON.stringify(row));
  };
  for (const method of ["start","stop","requestData"]) {
    const original=MediaRecorder.prototype[method];
    MediaRecorder.prototype[method]=function(...args) {
      if(!ids.has(this)) {
        ids.set(this,++serial);
        for(const type of ["start","stop","error","dataavailable","pause","resume"]) this.addEventListener(type,event=>
          log("event:"+type,{id:ids.get(this),state:this.state,mime:this.mimeType,bytes:event.data?.size,timecode:event.timecode,error:event.error?.message}));
      }
      log("call:"+method,{id:ids.get(this),state:this.state,mime:this.mimeType,args,
        tracks:this.stream.getTracks().map(t=>({kind:t.kind,state:t.readyState,muted:t.muted}))});
      return original.apply(this,args);
    };
  }
  const proto=window.CanvasCaptureMediaStreamTrack?.prototype;
  if(proto?.requestFrame) {
    const original=proto.requestFrame;
    proto.requestFrame=function(...args){frames++;return original.apply(this,args);};
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const dialog=document.getElementById("rec-preview");
    if(dialog) {
      new MutationObserver(()=>log("dialog:open")).observe(dialog,{attributes:true,attributeFilter:["open"]});
      for(const type of ["close","cancel"]) dialog.addEventListener(type,()=>log("dialog:"+type));
    }
  });
  window.__recordingSnapshot = snapshot;
  window.__recordingLog = log;
})();
