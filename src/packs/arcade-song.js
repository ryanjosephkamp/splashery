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
    const { kitModel } = api;
    const LANE_COLORS = ["#ff7a59", "#ffd166", "#7bdff2"];
    this.noteModels = LANE_COLORS.map((c) =>
      kitModel(
        (k) => {
          const c0 = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
          k.add(k.sphere(0.045), { even: true, flat: 0.5, color: (cc) => c0.map((v) => Math.min(1, v * (0.85 + 0.25 * Math.max(0, cc.n[1])) + 0.15)) }); // prettier-ignore
          k.cloud({ share: 0.35 }, (rand) => {
            const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
            const l = Math.hypot(...d) || 1;
            return {
              p: d.map((v) => (v / l) * (0.05 + 0.03 * rand())),
              color: c0,
              size: 0.9,
              opacity: 0.35,
            };
          });
        },
        { count: low ? 90 : 160 },
      ),
    );
    this.riderModel = kitModel(
      (k) => {
        // A little sled with a glowing bow.
        k.add(k.roundedBox(0.12, 0.03, 0.07, 4), { even: true, color: (cc) => [0.2, 0.22, 0.3].map((v) => v * (0.8 + 0.3 * cc.n[1])) }); // prettier-ignore
        k.add(k.sphere(0.03), { pos: [0.06, 0.02, 0], even: true, color: [1, 1, 0.9], weight: 3 });
        k.add(
          k.tube((t) => [-0.06 + 0.12 * t, -0.02, 0.03], 0.004),
          { color: [0.75, 0.78, 0.85] },
        );
        k.add(
          k.tube((t) => [-0.06 + 0.12 * t, -0.02, -0.03], 0.004),
          { color: [0.75, 0.78, 0.85] },
        );
      },
      { count: low ? 200 : 350 },
    );
    this.laneModel = kitModel(
      (k) => k.add(k.box(1, 0.006, 0.006), { color: [1, 1, 1], opacity: 0.6 }),
      { count: low ? 400 : 700 },
    );
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    this.lanes = [0, 1, 2].map(() => S.add(this.laneModel));
    this.rider = { lane: 1, shown: 1, sprite: S.add(this.riderModel) };
    this.notes = this.melody.map((n) => ({
      ...n,
      lane: this.laneOf(n.n),
      got: false,
      gone: false,
      sprite: null,
    }));
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
      } else if (dtn < -HIT) {
        n.gone = true;
        this.streak = 0;
      }
    }
    const end = (this.notes.at(-1)?.t ?? 0) + 1.2;
    if (this.t > end) this.over = true;
  }

  // Where a note (or the rider) is, for a time ahead of now and a lane.
  place(ahead, lane, view) {
    // 2D: across (x) by time, up (y) by lane. 3D: away (−z) by time, across
    // (x) by lane, on a road (y fixed).
    const x2 = -0.55 + ahead * SPEED;
    const y2 = (lane - 1) * 0.32;
    const p2 = [x2, y2, 0];
    const p3 = [(lane - 1) * 0.3, -0.25, 0.6 - ahead * SPEED];
    return [lerp(p2[0], p3[0], view), lerp(p2[1], p3[1], view), lerp(p2[2], p3[2], view)];
  }

  onView() {}

  render(view, frameDt) {
    this.view = view;
    const S = this.api.sprites;
    const r = this.rider;
    r.shown += (r.lane - r.shown) * Math.min(1, (frameDt || 0) * 14);
    r.sprite.pos = this.place(0, r.shown, view);
    r.sprite.quat = this.q.qaxis([0, 1, 0], (Math.PI / 2) * view);
    // The lanes: lines along the track.
    this.lanes.forEach((s, lane) => {
      const a = this.place(-0.2, lane, view);
      const b = this.place(2.6, lane, view);
      s.pos = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.035, (a[2] + b[2]) / 2];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len = Math.hypot(...d);
      s.quat = this.q.qfromto(
        [1, 0, 0],
        d.map((v) => v / len),
      );
      s.scale = [len, 1, 1];
      s.fade = 0.6;
    });
    // The notes in view: added as they come near, gone once past.
    for (const n of this.notes) {
      const ahead = n.t - this.t;
      const showing = !n.gone && (!n.got || ahead > -0.25) && ahead < 2.6 && ahead > -0.6;
      if (showing && !n.sprite) n.sprite = S.add(this.noteModels[n.lane]);
      if (!showing && n.sprite) {
        S.remove(n.sprite);
        n.sprite = null;
      }
      if (!n.sprite) continue;
      n.sprite.pos = this.place(ahead, n.lane, view);
      n.sprite.scale = n.got ? 1 + 3 * Math.max(0, -ahead) : 1;
      n.sprite.fade = n.got ? Math.max(0, 1 + ahead * 4) : 1;
    }
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
