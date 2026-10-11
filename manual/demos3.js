// The share-link demo of "Share links and QR codes" (web version only; the PDF prints a still and
// a link). It runs the real codec (src/codec.js), the real scene check (normalizeScene in
// src/state.js) and the real QR sizing (shareCode in src/qr/share-code.js) on a tiny scene.

import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { shareCode } from "../src/qr/share-code.js";
import { QUIET } from "../src/qr/encode.js";

const $ = (id) => document.getElementById(id);

// A scene about as small as a real one can be: the app fills in everything it leaves out.
export const TINY = {
  app: "splashery",
  version: 3,
  seed: 7,
  toy: { kind: "builtin", id: "cactus" },
  camera: { yaw: 0.55, pitch: 0.3, roll: 0, distance: 4.5 },
};

// The base of a link made here: this page's folder, one level up (the app's own address when the
// manual is served beside it).
const base = () => new URL("../", document.baseURI).href;

export function flipOne(hash, at) {
  // Change the character at `at` (after the "d." prefix) to a different one of the 64 safe ones.
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const i = Math.max(2, Math.min(hash.length - 1, at));
  const next = ALPHABET[(ALPHABET.indexOf(hash[i]) + 1) % 64];
  return { text: hash.slice(0, i) + next + hash.slice(i + 1), index: i, from: hash[i], to: next };
}

function drawQR(canvas, code) {
  const total = code.size + 2 * QUIET;
  const ppm = Math.max(1, Math.floor(260 / total));
  canvas.width = canvas.height = total * ppm;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.imageRendering = "pixelated"; // square modules stay sharp at any pixel ratio
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#000000";
  for (let r = 0; r < code.size; r++)
    for (let c = 0; c < code.size; c++)
      if (code.dark[r * code.size + c]) g.fillRect((QUIET + c) * ppm, (QUIET + r) * ppm, ppm, ppm);
}

function shareDemo() {
  if (!$("sh-json")) return;
  const json = $("sh-json");
  const hashBox = $("sh-hash");
  const decoded = $("sh-decoded");
  let good = ""; // the hash made from the scene, before any change of a character
  let seq = 0;

  const show = (text, cls = "") => {
    decoded.className = `readout ${cls}`;
    decoded.textContent = text;
  };

  async function readBack() {
    const my = ++seq;
    const value = hashBox.value.trim();
    try {
      const scene = await decodeSceneHash(value);
      if (my !== seq) return;
      let out = `Read back from the link:\n${JSON.stringify(scene)}`;
      try {
        const { normalizeScene } = await import("../src/state.js");
        const clean = normalizeScene(scene);
        const extra = Object.keys(clean).length;
        out += `\n\nAfter the app's check (normalizeScene): ${extra} top-level keys, every missing one filled with its default, and every number kept in its range. For example, seed ${clean.seed}, toy ${clean.toy?.id}, camera distance ${clean.camera?.distance}.`; // prettier-ignore
      } catch (e) {
        out += `\n\nThe app would refuse it: ${e.message}`;
      }
      show(out, "ok");
    } catch (e) {
      if (my !== seq) return;
      // A damaged deflate stream surfaces as a stream error ("Failed to fetch" in Chromium).
      const why = e instanceof SyntaxError ? `the text is not valid JSON (${e.message})` : /fetch|data|inflate|decompress/i.test(String(e.message)) ? "the compressed data is damaged, so the decoder stopped" : String(e.message || e); // prettier-ignore
      show(`The link can't be read: ${why}.\n(The app would show "Could not read the shared scene".)`, "bad"); // prettier-ignore
    }
  }

  async function encode() {
    const my = ++seq;
    let scene;
    try {
      scene = JSON.parse(json.value);
    } catch (e) {
      $("sh-sizes").textContent = `That is not valid JSON yet: ${e.message}`;
      hashBox.value = "";
      show("Fix the JSON to get a link.");
      // No link means no code: hide the old one, so it can't pass for this scene's, and forget the
      // old link, so "Change one character" has nothing to change.
      good = "";
      $("sh-qr").hidden = true;
      $("sh-qr-note").textContent =
        "No QR code: there is no link to draw until the JSON can be read.";
      return;
    }
    const hash = await encodeSceneHash(scene);
    if (my !== seq) return;
    good = hash;
    hashBox.value = hash;
    const bytes = new TextEncoder().encode(JSON.stringify(scene)).length;
    const link = `${base()}#s=${hash}`;
    $("sh-sizes").textContent = `${bytes} bytes of JSON became ${hash.length} characters of link (the prefix "${hash.slice(0, 2)}" says ${hash[0] === "d" ? "compressed with raw deflate" : "not compressed"}). The whole link is ${link.length} characters.`; // prettier-ignore
    const made = shareCode(link);
    if (made.ok) {
      drawQR($("sh-qr"), made.code);
      $("sh-qr").hidden = false;
      $("sh-qr-note").textContent = `As a QR code: version ${made.code.version}, error correction ${made.level}, for ${made.bytes} bytes. It is the same code the Share tab would make for this link.`; // prettier-ignore
    } else {
      $("sh-qr").hidden = true;
      $("sh-qr-note").textContent = `This link is ${made.bytes} bytes, more than one QR code holds (2,953). The Share tab would say so and offer Save JSON.`; // prettier-ignore
    }
    await readBack();
  }

  json.addEventListener("input", encode);
  hashBox.addEventListener("input", readBack);
  $("sh-reset").addEventListener("click", () => {
    json.value = JSON.stringify(TINY);
    encode();
  });
  $("sh-pretty").addEventListener("click", () => {
    try {
      json.value = JSON.stringify(JSON.parse(json.value), null, 2);
    } catch {
      /* leave the text alone: the message above says what is wrong */
    }
    encode();
  });
  let n = 0;
  $("sh-break").addEventListener("click", () => {
    if (!good) return;
    // Each press changes a different character, spread along the link.
    const at = 2 + Math.floor(((n++ * 0.381966) % 1) * (good.length - 2));
    const f = flipOne(good, at);
    hashBox.value = f.text;
    readBack().then(() => {
      decoded.textContent = `Character ${f.index + 1} changed from "${f.from}" to "${f.to}".\n\n${decoded.textContent}`; // prettier-ignore
    });
  });
  $("sh-undo").addEventListener("click", () => {
    hashBox.value = good;
    readBack();
  });
  json.value = JSON.stringify(TINY);
  encode();
}

shareDemo();
