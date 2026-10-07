// The splat mirror's footage (lane Live input r3): records the stage, as
// the person sees it, into a video in this page's memory, and saves it only
// when they tap Save. A small recorder of the toy's own: UI r5's Record
// button (#177) does this for every toy once it is merged.
//
// MediaRecorder on the canvas's captureStream (MP4 where the browser can
// make it, else WebM), at most MAX_SECONDS. Nothing is sent anywhere.

export const MAX_SECONDS = 30;
const WAIT = 8; // seconds a stop waits for the take's first frame (StageRecorder)

const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]; // prettier-ignore

export function canRecord(canvas) {
  return typeof MediaRecorder !== "undefined" && !!canvas?.captureStream && TYPES.some((t) => MediaRecorder.isTypeSupported(t)); // prettier-ignore
}

export class StageRecorder {
  // stage (optional): the player's stage. Live r7 (a recording that came out
  // empty on a slow, busy machine, October 6): each frame the stage draws is
  // handed to the video as it is drawn (postrender: a tick that draws
  // nothing leaves the canvas empty to read), and a still or slow stage is asked
  // for a few frames a second, so the take gets frames however few the page
  // draws; a stop first asks the encoder for what it holds, and an empty take
  // waits a moment for its last piece, as the app's own recorder does
  // (src/exports.js).
  constructor(canvas, { onStop, stage = null } = {}) {
    this.type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    this.stream = canvas.captureStream(stage ? 0 : 30);
    this.track = this.stream.getVideoTracks()[0];
    this.rec = new MediaRecorder(this.stream, { mimeType: this.type, videoBitsPerSecond: 6_000_000 }); // prettier-ignore
    this.chunks = [];
    this.blob = null;
    this.started = performance.now();
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    const app = stage?.app;
    this.frames = 0;
    const kick = () => {
      if (this.rec.state !== "recording") return;
      this.track?.requestFrame?.();
      this.frames++;
      // (A stop asked for before any frame was drawn waits for this one.)
      if (this.stopAsked) this.finishStop();
    };
    if (app) app.on("postrender", kick);
    this.ticker = stage ? setInterval(() => stage.requestRender(0), 250) : 0;
    this.rec.onstop = () => {
      clearInterval(this.ticker);
      if (app) app.off("postrender", kick);
      for (const t of this.stream.getTracks()) t.stop();
      const finish = (tries) => {
        if (!this.chunks.length && tries > 0) return setTimeout(() => finish(tries - 1), 250);
        this.blob = new Blob(this.chunks, { type: this.type.split(";")[0] });
        this.chunks = [];
        onStop?.(this);
      };
      finish(8);
    };
    this.stage = stage;
    this.rec.start(500);
    stage?.requestRender();
    this.timer = setTimeout(() => this.stop(), MAX_SECONDS * 1000);
  }

  get seconds() {
    return (performance.now() - this.started) / 1000;
  }

  get recording() {
    return this.rec.state === "recording";
  }

  // A stop before the stage has drawn a frame of the take (a slow machine
  // can take seconds over one) waits for the first, at most WAIT seconds,
  // so the video isn't empty.
  stop() {
    clearTimeout(this.timer);
    if (this.rec.state === "inactive") return;
    if (this.stage && !this.frames && !this.stopAsked) {
      this.stopAsked = true;
      this.stage.requestRender();
      this.waitTimer = setTimeout(() => this.finishStop(), WAIT * 1000);
      return;
    }
    this.finishStop();
  }

  finishStop() {
    clearTimeout(this.waitTimer);
    this.stopAsked = false;
    if (this.rec.state === "inactive") return;
    try {
      this.rec.requestData(); // what the encoder holds so far
    } catch {
      // Not recording any more.
    }
    this.rec.stop();
  }

  get ext() {
    return this.type.startsWith("video/mp4") ? "mp4" : "webm";
  }
}
