// MIT. Made by Ryan with Codex (GPT-6). Mock event order and decoded metadata; real canvas,
// JPEG encoding and hashes. Actual corpus-decoder proofs are separate audit evidence.
import { test, expect } from "@playwright/test";
import { sourceFrameReceipts, assertPixelDisjointness } from "../tools/v3d-bench-pixels.mjs";

// Simulate the browser's missed paused-seek callback, while using the real canvas, JPEG encoder,
// and cryptographic hashes. The added mock supplies a separately tracked decoded picture time.
async function fixture(page, silent = false) {
  await page.goto("/tests/fixtures/v3d/");
  return page.evaluate((silent) => {
    const create = document.createElement.bind(document);
    const videos = (window.__receiptVideos = []);
    window.__receiptHolds = 0;
    window.__receiptReleases = 0;
    window.__splashery = {
      player: {
        stage: {
          holdRendering() {
            window.__receiptHolds++;
            return () => window.__receiptReleases++;
          },
        },
      },
    };
    class Video extends EventTarget {
      readyState = 0;
      paused = true;
      seeking = false;
      videoWidth = 8;
      videoHeight = 8;
      callbacks = new Map();
      next = 0;
      position = 0;
      actual = -1;
      playbackRate = 1;
      set src(value) {
        this.source = value;
        queueMicrotask(() => {
          if (!this.source) return;
          this.readyState = 2;
          this.dispatchEvent(new Event("loadedmetadata"));
          this.onloadedmetadata?.();
        });
      }
      get src() {
        return this.source;
      }
      set currentTime(value) {
        this.position = value;
        this.seeking = true;
        queueMicrotask(() => {
          this.seeking = false;
          this.dispatchEvent(new Event("seeked"));
        });
      }
      get currentTime() {
        return this.position;
      }
      requestVideoFrameCallback(fn) {
        this.callbacks.set(++this.next, fn);
        return this.next;
      }
      cancelVideoFrameCallback(id) {
        this.callbacks.delete(id);
      }
      async play() {
        this.paused = false;
        if (silent) {
          this.position = 999;
          return;
        }
        let index = Math.floor(this.position * 8);
        const tick = () => {
          if (this.paused || !this.source || index > 4) return;
          this.actual = index++ / 8;
          const pending = [...this.callbacks.values()];
          this.callbacks.clear();
          pending.forEach((fn) =>
            fn(performance.now(), { mediaTime: this.actual, presentationTime: performance.now() }),
          );
          this.timer = setTimeout(tick, 2);
        };
        this.timer = setTimeout(tick, 2);
      }
      pause() {
        this.paused = true;
        clearTimeout(this.timer);
      }
      removeAttribute() {
        this.source = "";
      }
      load() {
        if (!this.source) this.pause();
      }
    }
    document.createElement = (name, ...args) => {
      if (name === "video") {
        const video = new Video();
        videos.push(video);
        return video;
      }
      return create(name, ...args);
    };
    const paint = (context, time) => {
      const value = 40 + Math.round(time * 200);
      context.fillStyle = `rgb(${value},${value + 1},${value + 2})`;
      context.fillRect(0, 0, 8, 8);
      context.fillStyle = "white";
      context.fillRect(0, 0, 1, 8);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof Video) paint(this, source.actual);
      else draw.call(this, source, ...args);
    };
    const canvas = create("canvas");
    canvas.width = canvas.height = 8;
    paint(canvas.getContext("2d"), 0.125);
    return new Promise((resolve) =>
      canvas.toBlob(
        async (blob) =>
          resolve({
            width: 8,
            height: 8,
            requestedTime: 0.125,
            presentedTime: 0.125,
            sha256: Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())),
              (b) => b.toString(16).padStart(2, "0"),
            ).join(""),
          }),
        "image/jpeg",
        0.92,
      ),
    );
  }, silent);
}

async function decodedFixture(page, actual = true) {
  const training = await fixture(page, true);
  await page.evaluate((actual) => {
    window.__decodedClosed = 0;
    const create = document.createElement.bind(document);
    document.createElement = (name, ...args) => {
      const element = create(name, ...args);
      if (name === "video") {
        const position = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(element),
          "currentTime",
        );
        Object.defineProperty(element, "currentTime", {
          get() {
            return position.get.call(this);
          },
          set(value) {
            position.set.call(this, value);
            if (actual) this.actual = Math.floor(value * 8) / 8;
          },
        });
      }
      return element;
    };
    window.VideoFrame = class {
      constructor(video) {
        this.timestamp = video.actual * 1e6;
      }
      close() {
        window.__decodedClosed++;
      }
    };
  }, actual);
  return training;
}
const args = (training, times = [0.375]) => ({
  base64: "AA==",
  sourceTimes: [0, 0.125, 0.25, 0.375, 0.5],
  times,
  trainingFrames: [training],
  crop: { sx: 0, sw: 8 },
});

test("an exact decoded source picture certifies identical JPEGs when every callback is missed", async ({
  page,
}) => {
  const training = await decodedFixture(page);
  const proof = await page.evaluate(sourceFrameReceipts, args(training));
  expect(assertPixelDisjointness([training], proof, [0.375])).toBe(true);
  expect(proof.matchedTraining[0].sourceTime).toBe(0.125);
  expect(proof.views[0].mediaTime).toBe(0.375);
  expect(
    await page.evaluate(() => ({
      closed: window.__decodedClosed,
      held: window.__receiptHolds,
      released: window.__receiptReleases,
      stopped: window.__receiptVideos.every((v) => v.paused && !v.source && !v.callbacks.size),
    })),
  ).toEqual({ closed: 2, held: 1, released: 1, stopped: true });
});

test("a seek clock without an actual decoded picture cannot certify source evidence", async ({
  page,
}) => {
  const training = await decodedFixture(page, false);
  await expect(page.evaluate(sourceFrameReceipts, args(training))).rejects.toThrow(
    /actual decoded source timestamp|presented source frame/,
  );
  expect(
    await page.evaluate(() => ({
      held: window.__receiptHolds,
      released: window.__receiptReleases,
      stopped: window.__receiptVideos.every((v) => v.paused && !v.source && !v.callbacks.size),
    })),
  ).toEqual({ held: 1, released: 1, stopped: true });
});

test("an exact decoded source time cannot hide a held-out JPEG also used for training", async ({
  page,
}) => {
  const training = await decodedFixture(page);
  const proof = await page.evaluate(sourceFrameReceipts, args(training, [0.125]));
  expect(proof.views[0].sha256).toBe(training.sha256);
  expect(() => assertPixelDisjointness([training], proof, [0.125])).toThrow(
    /also used for training/,
  );
});

for (const [label, kind] of [
  ["a nonfinite", "nonfinite"],
  ["an unreadable", "unreadable"],
])
  test(`${label} decoded timestamp closes its handle and retains actual callback proof`, async ({
    page,
  }) => {
    const training = await fixture(page);
    await page.evaluate((kind) => {
      window.__decodedClosed = 0;
      window.VideoFrame = class {
        get timestamp() {
          if (kind === "unreadable") throw new TypeError("No decoded timestamp");
          return NaN;
        }
        close() {
          window.__decodedClosed++;
        }
      };
    }, kind);
    const proof = await page.evaluate(sourceFrameReceipts, args(training));
    expect(assertPixelDisjointness([training], proof, [0.375])).toBe(true);
    expect(proof.matchedTraining[0].sourceTime).toBe(0.125);
    expect(
      await page.evaluate(() => ({
        closed: window.__decodedClosed,
        released: window.__receiptReleases,
        stopped: window.__receiptVideos.every((v) => v.paused && !v.source && !v.callbacks.size),
      })),
    ).toEqual({ closed: 2, released: 1, stopped: true });
  });
