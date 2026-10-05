// Lane Computing r2: the proof that the Enigma is right, and that it can be
// set like a real Enigma I. The machine decodes published historical
// messages with their published keys; it matches reference code written
// separately here on random settings and messages, for every rotor and both
// reflectors; and its stepping (the double step) and period are the known
// ones.
//
// Sources for the messages (ciphertext, key and plaintext):
// - Operation Barbarossa, July 7, 1941 (German Army, Enigma I, rotors II IV
//   V, reflector B, rings 02 21 12, plugs AV BS CG DL FU HZ IN KM OW RX;
//   part 1 indicator WXC KCH, message key BLA; part 2 message key LSD): from
//   the original intercepts, as published by Geoff Sullivan and Frode
//   Weierud ("Breaking German Army Ciphers", Cryptologia 29(3), 2005;
//   https://cryptocellar.org/bgac/) and on Franklin Heath's Enigma sample
//   messages (http://wiki.franklinheath.co.uk/index.php/Enigma/Sample_Messages).
// - The Enigma I instruction manual of 1930 (reflector A, rotors II I III,
//   rings 24 13 22, plugs AM FI NV PS TU WZ, start ABL), on the same
//   Franklin Heath page.
// - Rotors I II III, reflector B, rings and start AAA: AAAAA gives BDZGO
//   (rings BBB: EWTYX), and the double step ADU, ADV, AEW, BFX: the usual
//   checks of an Enigma simulator (Wikipedia, "Enigma rotor details").

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { RECIPES, ENIGMA } from "../src/packs/computing-history.js";

const { machine, AZ } = ENIGMA;
const n = (str) => [...str].map((c) => AZ.indexOf(c));
const type = (m, text, pos) =>
  m
    .type(text, pos)
    .map((e) => AZ[e.lamp])
    .join("");

const BARBAROSSA = {
  rotors: ["II", "IV", "V"],
  reflector: "B",
  rings: n("BUL"),
  plugs: "AV BS CG DL FU HZ IN KM OW RX",
};
// prettier-ignore
const PART1 = "EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK";
// prettier-ignore
const PLAIN1 = "AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX NORDW ESTLX SEBEZ XSEBE ZXUAF FLIEG ERSTR ASZER IQTUN GXDUB ROWKI XDUBR OWKIX OPOTS CHKAX OPOTS CHKAX UMXEI NSAQT DREIN ULLXU HRANG ETRET ENXAN GRIFF XINFX RGTX";
// prettier-ignore
const PART2 = "SFBWD NJUSE GQOBH KRTAR EEZMW KPPRB XOHDR OEQGB BGTQV PGVKB VVGBI MHUSZ YDAJQ IROAX SSSNR EHYGG RPISE ZBOVM QIEMM ZCYSG QDGRE RVBIL EKXYQ IRGIR QNRDN VRXCY YTNJR";
// prettier-ignore
const PLAIN2 = "DREIG EHTLA NGSAM ABERS IQERV ORWAE RTSXE INSSI EBENN ULLSE QSXUH RXROE MXEIN SXINF RGTXD REIXA UFFLI EGERS TRASZ EMITA NFANG XEINS SEQSX KMXKM XOSTW XKAME NECXK";
const join = (s) => s.replace(/ /g, "");

test("Operation Barbarossa, 1941: both parts decode with the published key", () => {
  const m = machine(BARBAROSSA);
  // The indicator: the message key, enciphered at the start the operator
  // chose and sent in the clear (WXC), deciphers to BLA.
  expect(type(m, "KCH", n("WXC"))).toBe("BLA");
  expect(type(m, join(PART1), n("BLA"))).toBe(join(PLAIN1));
  expect(type(m, join(PART2), n("LSD"))).toBe(join(PLAIN2));
  // And typing the plaintext at the key gives the published ciphertext.
  expect(type(m, join(PLAIN1), n("BLA"))).toBe(join(PART1));
});

test("the 1930 instruction manual's message decodes with its key (reflector A)", () => {
  const m = machine({ rotors: ["II", "I", "III"], reflector: "A", rings: n("XMV"), plugs: "AM FI NV PS TU WZ" }); // prettier-ignore
  const coded = "GCDSEAHUGWTQGRKVLFGXUCALXVYMIGMMNMFDXTGNVHVRMMEVOUYFZSLRHDRRXFJWCFHUHMUNZEFRDISIKBGPMYVXUZ"; // prettier-ignore
  expect(type(m, coded, n("ABL"))).toBe("FEINDLIQEINFANTERIEKOLONNEBEOBAQTETXANFANGSUEDAUSGANGBAERWALDEXENDEDREIKMOSTWAERTSNEUSTADT"); // prettier-ignore
});

test("the usual simulator checks: BDZGO, EWTYX and the double step", () => {
  expect(type(machine({ plugs: "" }), "AAAAA", [0, 0, 0])).toBe("BDZGO");
  expect(type(machine({ plugs: "", rings: [1, 1, 1] }), "AAAAA", [0, 0, 0])).toBe("EWTYX");
  const m = machine({ plugs: "" });
  let p = n("ADU");
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push((p = m.step(p)).map((x) => AZ[x]).join(""));
  expect(seen).toEqual(["ADV", "AEW", "BFX"]);
});

// ---- Reference code ------------------------------------------------------------------
// An Enigma I written separately, as contacts: a key's current goes in at
// the plugboard, through the right, middle and left rotors (each turned by
// its position less its ring setting), the reflector and back. Rotors step
// when the letter in the window of the rotor to the right is its turnover
// letter, as the wiring tables (Crypto Museum, Wikipedia) give them.
const WIRING = {
  I: ["EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"],
  II: ["AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"],
  III: ["BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"],
  IV: ["ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"],
  V: ["VZBRGITYUPSDNHLXAWMJQOFECK", "Z"],
};
const UKW = { B: "YRUHQSLDPXNGOKMIEBFZCWVJAT", C: "FVPJIAOYEDRZXWGCTKUQSBNMHL" };
function referenceEnigma({ rotors, reflector, rings, start, plugs }, text) {
  const win = start.map((c) => c.charCodeAt(0) - 65);
  const ring = rings.map((c) => c.charCodeAt(0) - 65);
  const swap = {};
  for (const pr of plugs) [swap[pr[0]], swap[pr[1]]] = [pr[1], pr[0]];
  const plug = (c) => swap[c] || c;
  const at = (i) => String.fromCharCode(65 + ((i % 26) + 26) % 26); // prettier-ignore
  const pass = (c, slot, back) => {
    const shift = win[slot] - ring[slot];
    const w = WIRING[rotors[slot]][0];
    const contact = at(c.charCodeAt(0) - 65 + shift);
    const out = back ? at(w.indexOf(contact)) : w[contact.charCodeAt(0) - 65];
    return at(out.charCodeAt(0) - 65 - shift);
  };
  let res = "";
  for (const ch of text) {
    const turn = (slot) => AZ[win[slot]] === WIRING[rotors[slot]][1];
    const middle = turn(1);
    const right = turn(2);
    if (middle) win[0] = (win[0] + 1) % 26;
    if (middle || right) win[1] = (win[1] + 1) % 26;
    win[2] = (win[2] + 1) % 26;
    let c = plug(ch);
    for (const slot of [2, 1, 0]) c = pass(c, slot, false);
    c = UKW[reflector][c.charCodeAt(0) - 65];
    for (const slot of [0, 1, 2]) c = pass(c, slot, true);
    res += plug(c);
  }
  return res;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

test("every rotor, both reflectors: the machine matches the reference code", () => {
  const rand = rng(1941);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const used = { rotor: new Set(), slot: new Set(), reflector: new Set() };
  for (let k = 0; k < 600; k++) {
    const names = Object.keys(WIRING).sort(() => rand() - 0.5).slice(0, 3); // prettier-ignore
    const letters = [...AZ].sort(() => rand() - 0.5);
    const plugs = [];
    for (let i = 0; i < Math.floor(rand() * 11); i++)
      plugs.push(letters[2 * i] + letters[2 * i + 1]);
    const set = {
      rotors: names,
      reflector: pick(["B", "C"]),
      rings: [pick([...AZ]), pick([...AZ]), pick([...AZ])],
      start: [pick([...AZ]), pick([...AZ]), pick([...AZ])],
      plugs,
    };
    const text = Array.from({ length: 60 + Math.floor(rand() * 300) }, () => pick([...AZ])).join(""); // prettier-ignore
    const m = machine({ rotors: set.rotors, reflector: set.reflector, rings: n(set.rings.join("")), plugs: plugs.join(" ") }); // prettier-ignore
    const got = type(m, text, n(set.start.join("")));
    expect(got, JSON.stringify(set)).toBe(referenceEnigma(set, text));
    // A letter never comes out as itself, and the same setting decodes.
    expect([...got].some((c, i) => c === text[i])).toBe(false);
    expect(type(m, got, n(set.start.join("")))).toBe(text);
    names.forEach((r, i) => used.slot.add(`${r}@${i}`));
    used.reflector.add(set.reflector);
  }
  // Every rotor has stood in every place, with both reflectors.
  expect(used.slot.size).toBe(15);
  expect(used.reflector.size).toBe(2);
});

test("the stepping: each rotor's turnover, the double step and the period", () => {
  for (const r of Object.keys(WIRING)) {
    const notch = AZ.indexOf(WIRING[r][1]);
    const others = Object.keys(WIRING).filter((x) => x !== r);
    // On the right, at its turnover letter: the middle rotor steps too.
    let m = machine({ rotors: [others[0], others[1], r], plugs: "" });
    expect(m.step([0, 0, notch])).toEqual([0, 1, (notch + 1) % 26]);
    expect(m.step([0, 0, (notch + 1) % 26])).toEqual([0, 0, (notch + 2) % 26]);
    // In the middle, at its turnover letter: it steps again with the left
    // rotor (the double step).
    m = machine({ rotors: [others[0], r, others[1]], plugs: "" });
    expect(m.step([4, notch, 9])).toEqual([5, (notch + 1) % 26, 10]);
  }
  // The rotor positions repeat after 26 x 25 x 26 = 16,900 letters (the
  // double step skips one middle position in each turn).
  const m = machine({ plugs: "" });
  let p = [0, 0, 0];
  let k = 0;
  do {
    p = m.step(p);
    k++;
  } while (p.join() !== "0,0,0" && k < 20000);
  expect(k).toBe(16900);
});

// ---- The toy -------------------------------------------------------------------------

function build(options = {}) {
  const r = RECIPES["enigma-machine"];
  const opts = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
  Object.assign(opts, options);
  const it = buildRecipe(r, { seed: 5, count: 6000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

test("the toy is set from the Toy tab, and an old link opens it as before", () => {
  // No setting (an old link): rotors I II III, reflector B, AR GK OX, AAA.
  const old = build({ message: "HELLO" });
  expect(old.data.coded).toBe("ILBDT");
  expect(old.data.line).toBe("I II III   UKW B   RINGS 01 01 01   START AAA   PLUGS AR GK OX");
  // A setting of its own: the toy's code is the reference code's.
  const set = { rotorL: "IV", rotorM: "I", rotorR: "V", reflector: "C", ringL: "C", ringM: "Q", ringR: "Z", startL: "K", startM: "E", startR: "Y", plugs: "pq, ws; ed rf tg yh uj ik ol az" }; // prettier-ignore
  const kit = build({ ...set, message: "WETTERBERICHT" });
  const st = kit.data.setting;
  expect(st.rotors).toEqual(["IV", "I", "V"]);
  expect(st.plugs).toEqual(["PQ", "WS", "ED", "RF", "TG", "YH", "UJ", "IK", "OL", "AZ"]);
  const ref = referenceEnigma({ rotors: ["IV", "I", "V"], reflector: "C", rings: ["C", "Q", "Z"], start: ["K", "E", "Y"], plugs: st.plugs }, "WETTERBERICHT"); // prettier-ignore
  expect(kit.data.coded).toBe(ref);
  expect(kit.data.rest).toEqual(n("KEY"));
  expect(kit.data.line).toBe("IV I V   UKW C   RINGS 03 17 26   START KEY   PLUGS PQ WS ED RF TG YH UJ IK OL AZ"); // prettier-ignore
  // A rotor picked twice gives way to the first one not in use; a letter
  // plugged twice keeps its first cable; at most ten cables.
  const twice = build({ rotorL: "II", rotorM: "II", rotorR: "I", plugs: "AB AC DE FF GH IJ KL MN OP QR ST UV WX" }); // prettier-ignore
  expect(twice.data.setting.rotors).toEqual(["II", "III", "I"]);
  expect(twice.data.setting.plugs).toEqual(["AB", "DE", "GH", "IJ", "KL", "MN", "OP", "QR", "ST", "UV"]); // prettier-ignore
});

test("the Barbarossa preset puts the real message on the pad, and a tap decodes it", () => {
  const kit = build({ preset: "barbarossa1" });
  expect(kit.data.msg).toBe(join(PART1).slice(0, 20));
  expect(kit.data.coded).toBe(join(PLAIN1).slice(0, 20));
  expect(kit.data.rest).toEqual(n("BLA"));
  expect(kit.data.line).toBe("II IV V   UKW B   RINGS 02 21 12   START BLA   PLUGS AV BS CG DL FU HZ IN KM OW RX"); // prettier-ignore
  const two = build({ preset: "barbarossa2" });
  expect(two.data.coded).toBe(join(PLAIN2).slice(0, 20));
  // With a preset, its key is set and the rest of the setting is hidden.
  const shown = RECIPES["enigma-machine"].options.filter((o) => !o.hidden).map((o) => o.key);
  expect(shown).toEqual(["preset"]);
  build({});
  const all = RECIPES["enigma-machine"].options.filter((o) => !o.hidden).map((o) => o.key);
  expect(all).toEqual(["preset", "rotorL", "rotorM", "rotorR", "reflector", "ringL", "ringM", "ringR", "startL", "startM", "startR", "plugs"]); // prettier-ignore
});

test("a tap types at the start positions, and the rotors go back to them", () => {
  const kit = build({ startL: "Q", startM: "E", startR: "V", message: "ABCDE" });
  const r = RECIPES["enigma-machine"];
  const E = r.controls.find((c) => c.key === "go").ease;
  const angles = [];
  let last = null;
  for (let s = 0; s <= E; s += 1 / 30) {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, cues: [], fx: {}, tokens: null };
    r.drive(1 + s, { go: Math.max(0.0004, 1 - s / E) }, out, { time: 1 + s, R: 1, tap: { n: 1 }, data: kit.data }); // prettier-ignore
    angles.push(["rotorL", "rotorM", "rotorR"].map((p) => out.parts[p].angle));
    last = out;
  }
  const step = (2 * Math.PI) / 26;
  // QEV: the right rotor at V and the middle at E, so the first letter
  // double-steps all three: R F W.
  expect(kit.data.runs[0][0].pos).toEqual(n("RFW"));
  expect(angles.some((a) => Math.abs(a[0] - 17 * step) < 1e-6)).toBe(true);
  const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, cues: [], fx: {}, tokens: null };
  r.drive(10, { go: 0 }, out, { time: 10, R: 1, tap: { n: 1 }, data: kit.data });
  expect(["rotorL", "rotorM", "rotorR"].map((p) => out.parts[p].angle / step)).toEqual([16, 4, 21]);
  expect(last).toBeTruthy();
});
