from pathlib import Path
import hashlib,json

root=Path('/workspace/splashery');out=root/'.cache/flaky-tests/hh5'
original=(root/'tests/sndc-engine.spec.mjs').read_text().replace('"./helpers/playing-tune.mjs"','"../../../tests/helpers/playing-tune.mjs"')
old='''    AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
      if (this.buffer && this.buffer === window.__sndcSample)
        window.__starts.push({ at: performance.now(), when, now: this.context.currentTime });
      return start.call(this, when, ...rest);
    };'''
new='''    AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
      // Capture the request first, and dispatch native playback before the
      // observer reads metadata to identify the recorded sample.
      const at = performance.now();
      const now = this.context.currentTime;
      const result = start.call(this, when, ...rest);
      const buffer = this.buffer;
      if (buffer && buffer === window.__sndcSample)
        window.__starts.push({ at, when, now });
      return result;
    };'''
assert original.count(old)==1
candidate=original.replace(old,new)
# Save the production-sized candidate separately: controls add observations only below.
(out/'sndc-entry-candidate.spec.mjs').write_text(candidate)
getter='''
    const buffer = Object.getOwnPropertyDescriptor(AudioBufferSourceNode.prototype, "buffer");
    Object.defineProperty(AudioBufferSourceNode.prototype, "buffer", {
      ...buffer,
      get() {
        const value = buffer.get.call(this);
        if (value === window.__sndcSample && window.__tapAt !== undefined && !window.__getterMeta) {
          const ctx = this.context;
          const meta = (window.__getterMeta = { at: performance.now(), nativeAt: ctx.currentTime });
          const until = performance.now() + 80;
          while (performance.now() < until) {}
          meta.end = performance.now();
          meta.nativeEnd = ctx.currentTime;
        }
        return value;
      },
    });
'''
motion='''
    const realAct = m.act.bind(m);
    m.act = (...args) => {
      const result = realAct(...args);
      const until = performance.now() + 80;
      while (performance.now() < until) {}
      return result;
    };
'''
dispatch='''
    const sound = window.__splashery.app.sound;
    const realPlay = sound.play.bind(sound);
    sound.play = (...args) => setTimeout(() => realPlay(...args), 80);
'''
worklet='''
  // Control-only observation of actual native sample frames. The branch outputs silence.
  await page.evaluate(async () => {
    const { sound } = window.__splashery.app;
    const ctx = sound.ctx;
    const code = `class SndcNativeEdge extends AudioWorkletProcessor {
      constructor() { super(); this.sent = false; this.ready = false; }
      process(inputs, outputs) {
        if (!this.ready) { this.ready = true; this.port.postMessage({ kind: "ready", frame: currentFrame }); }
        if (!this.sent) {
          const channels = inputs[0] || [];
          for (let i = 0; i < (channels[0]?.length || 0); i++) {
            if (channels.some((c) => Math.abs(c[i]) > 0.0001)) {
              this.sent = true;
              this.port.postMessage({ kind: "edge", frame: currentFrame + i, contextTime: (currentFrame + i) / sampleRate, sampleRate });
              break;
            }
          }
        }
        for (const channel of outputs[0] || []) channel.fill(0);
        return true;
      }
    }
    registerProcessor("sndc-native-edge", SndcNativeEdge);`;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    window.__sampleEdges = [];
    const node = (window.__sampleEdgeNode = new AudioWorkletNode(ctx, "sndc-native-edge"));
    const ready = new Promise((resolve) => {
      node.port.onmessage = (event) => {
        window.__sampleEdges.push(event.data);
        if (event.data.kind === "ready") resolve();
      };
    });
    sound.master.connect(node);
    node.connect(ctx.destination);
    await ready;
  });
'''
for name,entry,fault in [
 ('sndc-entry-old-getter.spec.mjs',False,getter),
 ('sndc-entry-new-getter.spec.mjs',True,getter),
 ('sndc-entry-new-motion.spec.mjs',True,motion),
 ('sndc-entry-new-dispatch.spec.mjs',True,dispatch),
 ('sndc-entry-new-clean.spec.mjs',True,''),
]:
    text=candidate if entry else original
    text=text.replace('    window.__starts = [];\n    const start = AudioBufferSourceNode.prototype.start;','    window.__starts = [];\n    window.__nativeReturns = [];\n    const start = AudioBufferSourceNode.prototype.start;')
    if entry:
        text=text.replace('      const result = start.call(this, when, ...rest);','      const result = start.call(this, when, ...rest);\n      window.__nativeReturns.push({ at: performance.now(), when, now });')
    else:
        text=text.replace('      return start.call(this, when, ...rest);','      const result = start.call(this, when, ...rest);\n      window.__nativeReturns.push({ at: performance.now(), when, now: this.context.currentTime });\n      return result;')
    text=text.replace('    const m = window.__splashery.player.motion;','    const m = window.__splashery.player.motion;'+fault)
    assert text.count('  await page.mouse.up();')==1
    text=text.replace('  await page.mouse.up();',worklet+'  await page.mouse.up();')
    needle='''  expect(r).toBeTruthy();
  console.log(`first sample: ${r.delay.toFixed(1)} ms after the tap`);'''
    assert text.count(needle)==1
    text=text.replace(needle,'''  console.log("SNDC_ENTRY_CONTROL " + JSON.stringify(await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin, tapAt: window.__tapAt, starts: window.__starts,
    nativeReturns: window.__nativeReturns, getter: window.__getterMeta, edges: window.__sampleEdges,
  }))));
'''+needle)
    (out/name).write_text(text)
    expects=lambda s:[l for l in s.splitlines() if l.lstrip().startswith('expect(') or 'await expect.' in l]
    assert expects(text)==expects(original)
    print(json.dumps({'path':name,'sha256':hashlib.sha256(text.encode()).hexdigest(),'unchanged_expect_lines':len(expects(original))}))
print(json.dumps({'candidate_sha256':hashlib.sha256(candidate.encode()).hexdigest()}))
