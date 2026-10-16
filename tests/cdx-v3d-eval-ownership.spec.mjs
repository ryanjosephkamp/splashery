// MIT. Made by Ryan with Codex (GPT-6). CPU-only trainer-generation checks.
import { test, expect } from "@playwright/test";
import { Session } from "../vendor/splatjs/src/session.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

test("evaluation preserves its mean, frame metadata, and empty-set result", async () => {
  const session = new Session(),
    calls = [];
  try {
    expect(await session.evalTestPsnr()).toBeNull();
    session.trainer = {
      camMeta: Array.from({ length: 4 }, (_, i) => ({ imgIdx: i + 10 })),
      async evalCamPsnr(index) {
        calls.push(index);
        return index === 1 ? 17 : 23;
      },
      dispose() {},
    };
    session.testCams = [1, 3];
    expect(await session.evalTestPsnr()).toEqual({
      psnr: 20,
      frames: [
        { cam: 1, imgIdx: 11, psnr: 17 },
        { cam: 3, imgIdx: 13, psnr: 23 },
      ],
    });
    expect(calls).toEqual([1, 3]);
  } finally {
    session.dispose();
  }
});

test("an old awaited evaluation cannot touch a recovered trainer or replacement metadata", async () => {
  const session = new Session(),
    first = deferred(),
    oldCalls = [],
    replacementCalls = [];
  let metadataReads = 0;
  session.recon = {};
  session.testCams = [0, 1];
  session.trainer = {
    camMeta: [{ imgIdx: 10 }, { imgIdx: 11 }],
    evalCamPsnr(index) {
      oldCalls.push(index);
      return first.promise;
    },
    dispose() {},
  };
  const replacement = {
    get camMeta() {
      metadataReads++;
      return [{ imgIdx: 20 }, { imgIdx: 21 }];
    },
    async evalCamPsnr(index) {
      replacementCalls.push(index);
      return 99;
    },
    dispose() {},
  };
  // Recover's resource creation is the mock boundary. The real recovery method resets
  // session ownership, then seed installs the new trainer without creating a GPU device.
  session.seed = async () => {
    session.trainer = replacement;
    return { n: 1 };
  };
  const pending = session.evalTestPsnr();
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
    message: "Training session changed",
  });
  try {
    await Promise.resolve();
    expect(oldCalls).toEqual([0]);
    await session.recover();
    first.resolve(11);
    await rejected;
    expect(oldCalls).toEqual([0]);
    expect(replacementCalls).toEqual([]);
    expect(metadataReads).toBe(0);
  } finally {
    first.resolve(11);
    await pending.catch(() => {});
    session.dispose();
  }
});

test("disposing during an awaited evaluation does not inspect released trainer metadata", async () => {
  const session = new Session(),
    first = deferred(),
    calls = [];
  let released = false;
  session.testCams = [0, 1];
  session.trainer = {
    get camMeta() {
      if (released) throw new Error("Released metadata was accessed");
      return [{ imgIdx: 10 }, { imgIdx: 11 }];
    },
    evalCamPsnr(index) {
      calls.push(index);
      return first.promise;
    },
    dispose() {
      released = true;
    },
  };
  const pending = session.evalTestPsnr(),
    rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  try {
    await Promise.resolve();
    expect(calls).toEqual([0]);
    session.dispose();
    first.resolve(11);
    await rejected;
    expect(calls).toEqual([0]);
  } finally {
    first.resolve(11);
    await pending.catch(() => {});
    session.dispose();
  }
});
