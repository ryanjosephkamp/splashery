// Lane Arcade, G10: Note Rider, ride a song. The song's melody comes down
// a three-lane track as glowing notes, low notes in the low lane and high
// notes in the high one; steer the rider into each note's lane as it
// arrives to catch it, and the note plays. Catch them all and you have
// played the tune; a missed note is silent. Play the built-in tunes or
// open a MIDI file of your own (src/songs.js reads it).
//
// 2D: the track from the side, the notes sliding in from the right and the
// lanes stacked by pitch. 3D: the track becomes a road running away from
// you, the lanes side by side, the notes coming toward you, by the same
// rules (the low lane is the left one).

import { songFromText } from "../songs.js";
import { crispModel } from "./arcade-crisp.js";

export const RIDE = { song: null, name: "" };

const TUNES = {
  ode: {
    title: "Ode to Joy (Beethoven)",
    bpm: 112,
    text:
      "E4/4 E4/4 F4/4 G4/4 | G4/4 F4/4 E4/4 D4/4 | C4/4 C4/4 D4/4 E4/4 | E4/4 D4/8 D4/4:3 | " +
      "E4/4 E4/4 F4/4 G4/4 | G4/4 F4/4 E4/4 D4/4 | C4/4 C4/4 D4/4 E4/4 | D4/4 C4/8 C4/4:3 | " +
      "D4/4 D4/4 E4/4 C4/4 | D4/4 E4/8 F4/8 E4/4 C4/4 | D4/4 E4/8 F4/8 E4/4 D4/4 | C4/4 D4/4 G3/2 | " +
      "E4/4 E4/4 F4/4 G4/4 | G4/4 F4/4 E4/4 D4/4 | C4/4 C4/4 D4/4 E4/4 | D4/4 C4/8 C4/4:3",
  },
  twinkle: {
    title: "Twinkle, Twinkle, Little Star (traditional)",
    bpm: 108,
    text:
      "C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2 | " +
      "G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | " +
      "C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2",
  },
  jacques: {
    title: "Frère Jacques (traditional)",
    bpm: 120,
    text:
      "F4/4 G4/4 A4/4 F4/4 | F4/4 G4/4 A4/4 F4/4 | A4/4 Bb4/4 C5/2 | A4/4 Bb4/4 C5/2 | " +
      "C5/8 D5/8 C5/8 Bb4/8 A4/4 F4/4 | C5/8 D5/8 C5/8 Bb4/8 A4/4 F4/4 | F4/4 C4/4 F4/2 | F4/4 C4/4 F4/2",
  },
};

const LEAD = 2.0; // seconds before the first note
const SPEED = 0.9; // world units a second the notes travel
const HIT = 0.09; // how close in time (seconds) counts as a catch
const TRACK = 2.8; // seconds of track in view (0.2 behind the catch line)
const LANE_GAP = 0.3; // lane to lane
const LANE_W = 0.27;
const LANE_COLORS = ["#ff7a59", "#ffd166", "#7bdff2"];
// The track's turn in 3D: its length (x) runs away from you (−z) and its
// face (z) up (+y), so its y runs to the left (−x). Each lane is placed on
// its own (the low lane on the left), and every track model is the same
// on both sides of its middle, so the mirror never shows.
const ROAD = [-0.5, 0.5, 0.5, 0.5];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createSong(api) {
  return new NoteRider(api);
}

class NoteRider {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    const o = api.options;
    let song;
    if (o.tune === "own" && RIDE.song) song = RIDE.song;
    else {
      const t = TUNES[o.tune] || TUNES.ode;
      song = songFromText({ title: t.title, text: t.text, bpm: t.bpm });
    }
    this.song = song;
    // The melody: the highest note at each moment (the tune you'd sing).
    const byT = new Map();
    for (const n of song.notes) {
      if (n.drum) continue;
      const k = Math.round(n.t * 50);
      if (!byT.has(k) || byT.get(k).n < n.n) byT.set(k, n);
    }
    let mel = [...byT.values()].sort((a, b) => a.t - b.t);
    // Not too close together to catch (at least a tenth of a second apart).
    mel = mel.filter((n, i) => i === 0 || n.t - mel[i - 1].t > 0.1);
    this.melody = mel;
    // Three lanes by pitch: the melody's lowest third, middle and top.
    const sorted = mel.map((n) => n.n).sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length / 3)] ?? 60;
    const q2 = sorted[Math.floor((2 * sorted.length) / 3)] ?? 64;
    this.laneOf = (n) => (n < q1 ? 0 : n < q2 || q1 === q2 ? 1 : 2);
    const low = api.profile === "low";
    // Crisp grids (src/packs/arcade-crisp.js), the owner's "much sharper
    // and improve design": tinted lanes with clean edges, a pad per lane at
    // the catch line that presses down as it plays a note, crisp gems with
    // a tail as long as the note is held, and a ring that bursts on a catch.
    const fine = low ? 0.006 : 0.004;
    const opt = { fine, coarse: 0.03 };
    const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    this.colors = LANE_COLORS.map(rgb);
    const LEN = TRACK * SPEED;
    this.laneModels = this.colors.map(
      (c) =>
      crispModel((k) => k.rect(LEN, LANE_W, { pos: [LEN / 2 - 0.2 * SPEED, 0, 0], color: c.map((v) => 0.1 + v * 0.13) }), opt), // prettier-ignore
    );
    this.edgeModel = crispModel((k) => {
      for (const y of [-1.5, -0.5, 0.5, 1.5]) k.line([-0.2 * SPEED, y * LANE_GAP, 0.004], [LEN - 0.2 * SPEED, y * LANE_GAP, 0.004], 0.006, { color: [0.42, 0.45, 0.6] }); // prettier-ignore
      // the catch line, across the lanes
      k.line([0, -1.5 * LANE_GAP, 0.006], [0, 1.5 * LANE_GAP, 0.006], 0.01, {
        color: [0.95, 0.95, 1],
      });
    }, opt);
    this.padModels = this.colors.map(
      (c) =>
      crispModel((k) => k.box(0.07, LANE_W * 0.86, 0.035, { pos: [0, 0, 0.018], color: (q, n) => c.map((v) => v * (0.55 + 0.3 * n[2] + 0.15 * n[1])) }), opt), // prettier-ignore
    );
    // A note: a glossy bead in its lane's color, lit from above left.
    const L = [-0.35, 0.6, 0.72];
    const ll = Math.hypot(...L);
    this.noteModels = this.colors.map((c) =>
      crispModel((k) =>
        k.sphere(0.055, {
          step: 0.0075,
          color: (q, n) => {
            const l = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll);
            const spec = Math.pow(l, 24) * 0.9;
            return c.map((v) => Math.min(1, v * (0.55 + 0.5 * l) + spec));
          },
        }),
      ),
    );
    // A held note's tail, built per length (a tenth of a second apart).
    this.tails = new Map();
    this.tailOf = (lane, len) => {
      const key = `${lane}:${Math.round(len * 10)}`;
      if (!this.tails.has(key)) {
        const L = Math.max(0.05, Math.round(len * 10) / 10);
        const c = this.colors[lane];
        this.tails.set(key, crispModel((k) => k.rect(L, 0.026, { pos: [L / 2, 0, 0.002], color: c.map((v) => v * 0.75) }), { fine: 0.004, coarse: 0.02 })); // prettier-ignore
      }
      return this.tails.get(key);
    };
    this.ringModels = this.colors.map(
      (c) =>
      crispModel((k) => k.disc(0.07, { inner: 0.058, color: c.map((v) => Math.min(1, v + 0.2)) }), { fine: 0.003, coarse: 0.012 }), // prettier-ignore
    );
    this.riderModel = crispModel((k) => {
      // A little sled with a glowing bow, on two runners.
      k.box(0.12, 0.03, 0.07, {
        color: (q, n) => [0.22, 0.24, 0.34].map((v) => v * (0.8 + 0.3 * n[1])),
      });
      k.sphere(0.022, { pos: [0.06, 0.02, 0], step: 0.004, color: [1, 1, 0.9] });
      for (const z of [-0.03, 0.03])
        k.box(0.14, 0.006, 0.006, { pos: [0, -0.02, z], color: [0.75, 0.78, 0.85] });
    }, opt);
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    // The track: lanes below their lines, both below what moves on them.
    this.lanes = this.laneModels.map((m) => {
      const sp = S.add(m);
      sp.sortBias = [0, 0, -0.12];
      return sp;
    });
    this.edges = S.add(this.edgeModel);
    this.edges.sortBias = [0, 0, -0.06];
    this.pads = this.padModels.map((m) => ({ sprite: S.add(m), press: 0 }));
    this.rider = { lane: 1, shown: 1, sprite: S.add(this.riderModel) };
    this.notes = this.melody.map((n) => ({ ...n, lane: this.laneOf(n.n), got: false, gone: false, sprite: null, tail: null })); // prettier-ignore
    this.bursts = [];
    this.t = -LEAD;
    this.score = 0;
    this.streak = 0;
    this.caught = 0;
    this.over = false;
  }

  step(dt, ctl) {
    this.view = ctl.view;
    if (this.over) return;
    this.t += dt;
    const r = this.rider;
    for (const a of ctl.pressed) {
      if (a === "up" || a === "right") r.lane = Math.min(2, r.lane + 1);
      if (a === "down" || a === "left") r.lane = Math.max(0, r.lane - 1);
    }
    const sw = ctl.input.takeSwipe?.();
    if (sw === "up" || sw === "right") r.lane = Math.min(2, r.lane + 1);
    if (sw === "down" || sw === "left") r.lane = Math.max(0, r.lane - 1);
    // A finger held on the track picks the lane under it.
    const ptr = ctl.input.pointer;
    if (ptr?.down && ptr.kind !== "mouse") r.lane = this.view > 0.5 ? (ptr.x < 0.36 ? 0 : ptr.x > 0.64 ? 2 : 1) : ptr.y > 0.62 ? 0 : ptr.y < 0.42 ? 2 : 1; // prettier-ignore
    if (ctl.demo) {
      // the attract mode moves to the next note's lane
      const next = this.notes.find((n) => !n.got && !n.gone && n.t > this.t - HIT);
      if (next && next.t - this.t < 0.5) r.lane = next.lane;
    }
    for (const n of this.notes) {
      if (n.got || n.gone) continue;
      const dtn = n.t - this.t;
      if (Math.abs(dtn) <= HIT && n.lane === r.lane) {
        n.got = true;
        this.caught++;
        this.streak++;
        this.score += 10 + Math.min(40, this.streak * 2);
        this.api.sound({ voice: "grand", f: 440 * 2 ** ((n.n - 69) / 12), vol: 0.5 + 0.4 * n.v, decay: Math.min(2, 0.4 + n.d) }); // prettier-ignore
        // its lane's pad presses down for as long as the note is held
        this.pads[n.lane].press = Math.max(0.12, Math.min(0.6, n.d));
        this.bursts.push({ lane: n.lane, age: 0, sprite: null });
      } else if (dtn < -HIT) {
        n.gone = true;
        this.streak = 0;
      }
    }
    for (const p of this.pads) p.press = Math.max(0, p.press - dt);
    const end = (this.notes.at(-1)?.t ?? 0) + 1.2;
    if (this.t > end) this.over = true;
  }

  // Where a note (or the rider) is, for a time ahead of now and a lane.
  place(ahead, lane, view) {
    // 2D: across (x) by time, up (y) by lane. 3D: away (−z) by time, across
    // (x) by lane, on a road (y fixed).
    const p2 = [-0.55 + ahead * SPEED, (lane - 1) * LANE_GAP, 0];
    const p3 = [(lane - 1) * LANE_GAP, -0.25, 0.6 - ahead * SPEED];
    return [lerp(p2[0], p3[0], view), lerp(p2[1], p3[1], view), lerp(p2[2], p3[2], view)];
  }

  onView() {}

  render(view, frameDt) {
    this.view = view;
    const S = this.api.sprites;
    const q = this.q;
    const flat = q.qslerp([0, 0, 0, 1], ROAD, view); // the track's turn
    const up = q.qrot(flat, [0, 0, 1]); // its face's normal
    const along = (p, d) => [p[0] + up[0] * d, p[1] + up[1] * d, p[2] + up[2] * d];
    this.lanes.forEach((s, lane) => {
      s.pos = this.place(0, lane, view);
      s.quat = flat;
    });
    this.edges.pos = this.place(0, 1, view);
    this.edges.quat = flat;
    this.pads.forEach((p, lane) => {
      const k = Math.min(1, p.press / 0.08);
      p.sprite.pos = along(this.place(0, lane, view), -0.014 * k);
      p.sprite.quat = flat;
      p.sprite.tint = k > 0 ? [1, 1, 1, 0.45 * k] : null;
    });
    const r = this.rider;
    r.shown += (r.lane - r.shown) * Math.min(1, (frameDt || 0) * 14);
    r.sprite.pos = along(this.place(-0.06, r.shown, view), 0.055);
    r.sprite.quat = q.qaxis([0, 1, 0], (Math.PI / 2) * view);
    // The notes in view: added as they come near, gone once past. A gem
    // stands just off the track (up off the road in 3D), its tail lies on it.
    const lift = (p) => [p[0], p[1] + 0.06 * view, p[2] + 0.06 * (1 - view)];
    for (const n of this.notes) {
      const ahead = n.t - this.t;
      const showing = !n.gone && !n.got && ahead < TRACK - 0.2 && ahead > -0.3;
      const tailLen = n.d > 0.3 ? (n.d - 0.12) * SPEED : 0;
      if (showing && !n.sprite) {
        n.sprite = S.add(this.noteModels[n.lane]);
        if (tailLen) n.tail = S.add(this.tailOf(n.lane, tailLen));
      }
      if (!showing && n.sprite) {
        S.remove(n.sprite);
        if (n.tail) S.remove(n.tail);
        n.sprite = n.tail = null;
      }
      if (!n.sprite) continue;
      const at = this.place(ahead, n.lane, view);
      n.sprite.pos = lift(at);
      if (n.tail) {
        n.tail.pos = at;
        n.tail.quat = flat;
      }
    }
    // A caught note's ring bursts outward from its pad and fades.
    for (const b of this.bursts) {
      b.age += frameDt || 0;
      if (!b.sprite) b.sprite = S.add(this.ringModels[b.lane]);
      if (!b.sprite) continue;
      const t = Math.min(1, b.age / 0.4);
      b.sprite.pos = lift(this.place(0, b.lane, view));
      b.sprite.scale = 1 + 1.4 * t;
      b.sprite.fade = 1 - t;
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.age < 0.4) return true;
      if (b.sprite) S.remove(b.sprite);
      return false;
    });
  }

  camera(view, aspect) {
    const d2 = this.api.fitDistance(2.6, 1.3, aspect);
    return {
      target: [lerp(0.55, 0, view), lerp(0, -0.2, view), lerp(0, -0.4, view)],
      yaw: 0,
      pitch: lerp(0, 0.35, view),
      distance: lerp(d2, 2.2, view),
    };
  }

  stats() {
    return { score: this.score, caught: `${this.caught}/${this.notes.length}` };
  }

  status() {
    const all = this.caught === this.notes.length;
    return { over: this.over, won: all, title: all ? "Every note!" : "The song's end", lines: [`${this.caught} of ${this.notes.length} notes · score ${this.score}`] }; // prettier-ignore
  }
}
