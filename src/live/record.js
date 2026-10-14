// The splat mirror's footage (lane Live input r3): records the stage, as
// the person sees it, into a video in this page's memory, and saves it only
// when they tap Save. A small recorder of the toy's own: UI r5's Record
// button (#177) does this for every toy once it is merged.
//
// MediaRecorder on the canvas's captureStream (MP4 where the browser can
// make it, else WebM), at most MAX_SECONDS. Nothing is sent anywhere.

export const MAX_SECONDS = 30;
const HOLD = 10; // seconds a stop can wait for the video's first piece (StageRecorder)
const SOME = 1024; // bytes: more than a file's header, so some of the picture

const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]; // prettier-ignore

export function canRecord(canvas) {
  return typeof MediaRecorder !== "undefined" && !!canvas?.captureStream && TYPES.some((t) => MediaRecorder.isTypeSupported(t)); // prettier-ignore
}

export class StageRecorder {
  // stage (optional): the player's stage. Live r7 (a recording that came out
  // empty on a slow, busy machine, October 6 and 7): each frame the stage
  // draws is handed to the video as it is drawn (postrender: a tick that
  // draws nothing leaves the canvas empty to read), and a still or slow stage
  // is asked for a few frames a second. A stop is held until the recorder has
  // handed over some of the video (it keeps recording, asking for frames and
  // for its data, at most HOLD seconds longer); the take is finished only on
  // the recorder's stop event, after its last piece; and an empty take is
  // never offered: `empty` is set and the panel says so.
  constructor(canvas, { onStop, stage = null } = {}) {
    this.type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    this.stream = canvas.captureStream(stage ? 0 : 30);
    this.track = this.stream.getVideoTracks()[0];
    this.rec = new MediaRecorder(this.stream, { mimeType: this.type, videoBitsPerSecond: 6_000_000 }); // prettier-ignore
    this.chunks = [];
    this.blob = null;
    this.empty = false;
    this.stage = stage;
    this.started = performance.now();
    this.bytes = 0;
    this.rec.ondataavailable = (e) => {
      if (e.data?.size) {
        this.chunks.push(e.data);
        this.bytes += e.data.size;
      }
      if (this.stopAsked && this.bytes >= SOME) this.finishStop();
    };
    const app = stage?.app;
    const kick = () => {
      if (this.rec.state === "recording") this.track?.requestFrame?.();
    };
    if (app) app.on("postrender", kick);
    this.ticker = setInterval(() => {
      stage?.requestRender(0);
      // (While a stop waits for the video's first piece, ask for it.)
      if (this.stopAsked && this.rec.state === "recording") this.rec.requestData();
    }, 250);
    this.rec.onstop = () => {
      clearInterval(this.ticker);
      clearTimeout(this.waitTimer);
      if (app) app.off("postrender", kick);
      for (const t of this.stream.getTracks()) t.stop();
      if (this.bytes) this.blob = new Blob(this.chunks, { type: this.type.split(";")[0] });
      else this.empty = true;
      this.chunks = [];
      onStop?.(this);
    };
    this.rec.start(500);
    stage?.requestRender();
    this.timer = setTimeout(() => this.stop(), MAX_SECONDS * 1000);
  }

  get seconds() {
    return (performance.now() - this.started) / 1000;
  }

  // Recording, or finishing a stop (the panel shows it as recording until
  // the take is done).
  get recording() {
    return this.rec.state === "recording";
  }

  // Stops once the recorder has handed over some of the video: at once if it
  // has, else as soon as it does (at most HOLD seconds later).
  stop() {
    clearTimeout(this.timer);
    if (this.rec.state === "inactive" || this.stopAsked) return;
    if (this.bytes >= SOME) return this.finishStop();
    this.stopAsked = true;
    this.stage?.requestRender();
    try {
      this.rec.requestData();
    } catch {
      // Not recording any more.
    }
    this.waitTimer = setTimeout(() => this.finishStop(), HOLD * 1000);
  }

  finishStop() {
    clearTimeout(this.waitTimer);
    this.stopAsked = false;
    if (this.rec.state === "inactive") return;
    this.rec.stop(); // its last piece comes before its stop event
  }

  get ext() {
    return this.type.startsWith("video/mp4") ? "mp4" : "webm";
  }
}
