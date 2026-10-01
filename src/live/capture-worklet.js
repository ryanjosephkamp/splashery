// Live input (lane Live input): the microphone's samples, handed from the
// audio thread to the page in blocks of 1024 (about 21 ms), so the page can
// read every sample (a clap's decay, a sung note). Loaded only once the
// microphone is on. Nothing is kept here.
class SplasheryCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1024);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf);
          this.buf = new Float32Array(1024);
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("splashery-capture", SplasheryCapture);
