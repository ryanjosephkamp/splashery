// MIT. CPU resource-ownership controls; fake frames do not establish decoder image quality.
import { test, expect } from "@playwright/test";
import { grabFastFrames, selectedSamples, decoderColor } from "../src/video3d/fast-extract.js";
import { fixture } from "./helpers/v3d-mp4-fixture.mjs";

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const plan = { windows: [{ from: 0, to: 0.03, t: 0.015 }] };
const data = fixture();
const buffer = () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
const opened = () => ({
  file: { size: data.length, arrayBuffer: async () => buffer() },
  duration: 0.05,
  width: 96,
  height: 64,
  video: { requestVideoFrameCallback() {} },
});
const globals = {};
let created, closed, framesClosed, options, mode, flush, blobs, draws;
function setup() {
  created = closed = framesClosed = 0;
  mode = "normal";
  blobs = [];
  draws = [];
  for (const key of ["VideoDecoder", "EncodedVideoChunk", "document"])
    globals[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  class Decoder {
    static async isConfigSupported(config) {
      return { supported: true, config };
    }
    constructor(value) {
      created++;
      options = value;
      this.state = "unconfigured";
      this.decodeQueueSize = 0;
    }
    configure() {
      this.state = "configured";
    }
    decode(chunk) {
      if (mode === "decode-error") {
        options.error(new Error("Codec rejected chunk"));
        return;
      }
      options.output({
        codedWidth: 96,
        codedHeight: 64,
        displayWidth: mode === "changed-geometry" && chunk.timestamp === 10000 ? 95 : 96,
        displayHeight: 64,
        timestamp: chunk.timestamp,
        colorSpace: { toJSON: () => ({ matrix: "bt709" }) },
        close() {
          framesClosed++;
        },
      });
    }
    flush() {
      return flush ? flush.promise : Promise.resolve();
    }
    close() {
      closed++;
      this.state = "closed";
    }
  }
  globalThis.VideoDecoder = Decoder;
  globalThis.EncodedVideoChunk = class {
    constructor(value) {
      Object.assign(this, value);
    }
  };
  globalThis.document = {
    createElement() {
      const canvas = { width: 0, height: 0, frame: false };
      canvas.getContext = () => ({
        drawImage(source) {
          canvas.frame = "timestamp" in source;
          draws.push(source);
        },
        getImageData() {
          const pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          if (mode === "wrong-pixels" && canvas.frame) pixels.fill(1);
          return { data: pixels };
        },
      });
      canvas.toBlob = (callback) => {
        if (mode === "pending-blob") blobs.push(callback);
        else
          queueMicrotask(() =>
            callback(mode === "null-blob" ? null : new Blob(["CPU fixture only"])),
          );
      };
      return canvas;
    },
  };
}
function restore() {
  for (const [key, descriptor] of Object.entries(globals))
    descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  flush = null;
}
test.beforeEach(setup);
test.afterEach(restore);
const run = (source, extra = {}) => {
  let n = 0;
  return grabFastFrames(source, plan, {
    side: 96,
    tries: 3,
    present: async () => (n++ ? 0.02 : 0),
    ...extra,
  });
};

test("B-order and VFR select the actual containing presentation interval", () => {
  const result = selectedSamples(
    [{ pts: 0 }, { pts: 30 }, { pts: 10 }],
    1000,
    { windows: [{ from: 0, to: 0.05, t: 0.025 }] },
    3,
  );
  expect([...result.wanted]).toEqual([
    [0, [{ window: 0, requestedTime: 0.008 }]],
    [10000, [{ window: 0, requestedTime: 0.025 }]],
    [30000, [{ window: 0, requestedTime: 0.042 }]],
  ]);
  expect(() => selectedSamples([{ pts: 0 }, { pts: 1 }], 1e9, plan, 3)).toThrow("Ambiguous");
});
test("color metadata is explicit, defaults follow resolution, and unsupported HDR falls back", () => {
  expect(decoderColor(null, 480)).toEqual({
    primaries: "smpte170m",
    transfer: "smpte170m",
    matrix: "smpte170m",
    fullRange: false,
  });
  expect(decoderColor(null, 720).matrix).toBe("bt709");
  expect(decoderColor({ primaries: 1, transfer: 13, matrix: 6, fullRange: true }, 480)).toEqual({
    primaries: "bt709",
    transfer: "iec61966-2-1",
    matrix: "smpte170m",
    fullRange: true,
  });
  expect(() => decoderColor({ primaries: 9, transfer: 16, matrix: 9 }, 480)).toThrow("Unsupported");
});
test("an unsupported path never reads the file or allocates a decoder", async () => {
  const source = opened();
  let reads = 0;
  source.file.arrayBuffer = () => {
    reads++;
    throw Error("Unexpected read");
  };
  source.duration = 31;
  expect(await run(source)).toBeNull();
  source.duration = 1;
  source.file.size = 64 * 1024 * 1024 + 1;
  expect(await run(source)).toBeNull();
  expect(reads).toBe(0);
  expect(created).toBe(0);
});
test("canceling a file read rejects immediately and ignores its late result", async () => {
  const source = opened(),
    read = deferred(),
    controller = new AbortController();
  source.file.arrayBuffer = () => read.promise;
  const result = run(source, { signal: controller.signal });
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  read.resolve(buffer());
  await turn();
  expect(created).toBe(0);
  expect(source.extraction).toBeUndefined();
});
test("canceling support discovery cannot create a late decoder", async () => {
  const support = deferred(),
    controller = new AbortController(),
    source = opened();
  let called = 0;
  VideoDecoder.isConfigSupported = () => {
    called++;
    return support.promise;
  };
  const result = run(source, { signal: controller.signal });
  await turn();
  expect(called).toBe(1);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  support.resolve({ supported: true, config: {} });
  await turn();
  expect(created).toBe(0);
});
test("codec failures return no partial photographs and close their owned decoder", async () => {
  mode = "decode-error";
  const source = opened();
  expect(await run(source)).toBeNull();
  expect(created).toBe(1);
  expect(closed).toBe(1);
  expect(source.extraction).toBeUndefined();
});
test("canceling a flush closes current and late frames without applying results", async () => {
  flush = deferred();
  const source = opened(),
    controller = new AbortController(),
    result = run(source, { signal: controller.signal });
  await turn();
  expect(created).toBe(1);
  const before = framesClosed;
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(closed).toBe(1);
  options.output({
    close() {
      framesClosed++;
    },
  });
  flush.resolve();
  await turn();
  expect(framesClosed).toBe(before + 1);
  expect(source.extraction).toBeUndefined();
});
test("late JPEG completion after cancellation cannot publish a result", async () => {
  mode = "pending-blob";
  const source = opened(),
    controller = new AbortController(),
    result = run(source, { signal: controller.signal });
  await turn();
  expect(blobs.length).toBeGreaterThan(0);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  for (const callback of blobs) callback(new Blob(["late"]));
  await turn();
  expect(closed).toBe(1);
  expect(source.extraction).toBeUndefined();
});
test("failed source-pixel equality and null JPEGs both preserve fallback", async () => {
  for (const failure of ["wrong-pixels", "null-blob", "changed-geometry"]) {
    mode = failure;
    const source = opened();
    expect(await run(source)).toBeNull();
    expect(source.extraction).toBeUndefined();
  }
  expect(closed).toBe(3);
  expect(framesClosed).toBeGreaterThan(0);
});
test("a successful bounded extraction reports decoded PTS without claiming RVFC evidence", async () => {
  const source = opened(),
    result = await run(source);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    time: 0,
    decodedTime: 0,
    requestedTime: 0.005,
    presentedTime: null,
    timestampSource: "decoded-presentation-time",
    width: 96,
    height: 64,
  });
  expect(source.extraction.independentlyPresentedColorChecks).toBe(2);
  expect(created).toBe(1);
  expect(closed).toBe(1);
  expect(framesClosed).toBe(3);
});
