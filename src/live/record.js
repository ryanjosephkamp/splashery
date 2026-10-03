// The splat mirror's footage (lane Live input r3): records the stage, as
// the person sees it, into a video in this page's memory, and saves it only
// when they tap Save. A small recorder of the toy's own: UI r5's Record
// button (#177) does this for every toy once it is merged.
//
// MediaRecorder on the canvas's captureStream (MP4 where the browser can
// make it, else WebM), at most MAX_SECONDS. Nothing is sent anywhere.

export const MAX_SECONDS = 30;

const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]; // prettier-ignore

export function canRecord(canvas) {
  return typeof MediaRecorder !== "undefined" && !!canvas?.captureStream && TYPES.some((t) => MediaRecorder.isTypeSupported(t)); // prettier-ignore
}

export class StageRecorder {
  constructor(canvas, { onStop } = {}) {
    this.type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    this.stream = canvas.captureStream(30);
    this.rec = new MediaRecorder(this.stream, { mimeType: this.type, videoBitsPerSecond: 6_000_000 }); // prettier-ignore
    this.chunks = [];
    this.blob = null;
    this.started = performance.now();
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => {
      this.blob = new Blob(this.chunks, { type: this.type.split(";")[0] });
      this.chunks = [];
      for (const t of this.stream.getTracks()) t.stop();
      onStop?.(this);
    };
    this.rec.start(500);
    this.timer = setTimeout(() => this.stop(), MAX_SECONDS * 1000);
  }

  get seconds() {
    return (performance.now() - this.started) / 1000;
  }

  get recording() {
    return this.rec.state === "recording";
  }

  stop() {
    clearTimeout(this.timer);
    if (this.rec.state !== "inactive") this.rec.stop();
  }

  get ext() {
    return this.type.startsWith("video/mp4") ? "mp4" : "webm";
  }
}
