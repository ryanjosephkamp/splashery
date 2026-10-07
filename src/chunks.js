// Engine (lane Powers of ten): a kit toy's own splat chunks, built only when
// its drive asks for them. A toy that shows many scenes, only a few at a
// time (the Powers of ten zoom), loads each one as the visitor comes near it
// instead of all of them when it opens.
//
// The recipe gives `chunks: { build(k, id, help) }`: an (async) build of one
// chunk with a Kit that keeps the recipe's coordinates (no fit). It may fetch
// its data first; `help.profile` is the device tier. Its drive sees
// info.chunks:
//
//   info.chunks.state(id)  // "none", "loading", "ready" or "failed"
//   info.chunks.want(id)   // starts building it (one chunk at a time, in order asked)
//   info.chunks.drop(id)   // frees it (a later want builds it again)
//
// and places the chunks it shows each frame with
//
//   out.chunks = { [id]: { scale, offset: [x, y, z], fade } }
//
// in recipe coordinates: a chunk's splat p shows at p * scale + offset, as
// if the recipe had built it there. A chunk left out of out.chunks (or with
// a fade of 0) is switched off: not drawn or sorted. `fade` (0..1) is the
// chunk's own first morph channel (uSpMorph), so splats the build gives
// kind "fade" with params [0, -0.99] (channel 0, fading in) take it as their
// opacity. Each chunk is its own splat entity, so splats of different chunks
// sort where they show, however far apart their scales are.

import { Kit } from "./kit.js";
import { hash32 } from "./noise.js";

export class ChunkHost {
  constructor(player, recipe, { id, options, transform, count, profile }) {
    this.player = player;
    this.recipe = recipe;
    this.toyId = id;
    this.options = options;
    this.transform = transform || { center: [0, 0, 0], scale: 1 };
    this.count = count;
    this.profile = profile;
    this.items = new Map();
    this.queue = [];
    this.busy = false;
    this.destroyed = false;
    this.api = {
      state: (cid) => this.items.get(String(cid))?.state || "none",
      want: (cid) => this.want(String(cid)),
      drop: (cid) => this.drop(String(cid)),
    };
  }

  want(id) {
    if (this.destroyed || this.items.has(id)) return;
    this.items.set(id, { state: "loading", slot: null });
    this.queue.push(id);
    this.pump();
  }

  drop(id) {
    const it = this.items.get(id);
    if (!it) return;
    this.items.delete(id);
    this.queue = this.queue.filter((q) => q !== id);
    if (it.slot) this.player.stage.removeSheet(it.slot);
  }

  async pump() {
    if (this.busy || this.destroyed) return;
    const id = this.queue.shift();
    if (id === undefined) return;
    this.busy = true;
    try {
      const k = new Kit(hash32(`${this.toyId}-chunk-${id}`), {
        count: this.count,
        options: this.options,
        fit: false,
      });
      await this.recipe.chunks.build(k, id, { profile: this.profile });
      const gen = k.emit();
      let n = 0;
      // (Lets a frame through now and then on a big chunk.)
      while (!gen.next().done) if (++n % 8 === 0) await new Promise((r) => setTimeout(r, 0));
      const it = this.items.get(id);
      if (!this.destroyed && it && k.buf.count) {
        const container = this.player.makeContainer(k.buf);
        const slot = this.player.stage.addSheet(container);
        if (slot) {
          slot.entity.enabled = false;
          it.slot = slot;
          it.splats = k.buf.count;
          it.state = "ready";
        } else it.state = "failed";
      } else if (it) it.state = k.buf?.count ? "failed" : "ready";
    } catch (e) {
      const it = this.items.get(id);
      if (it) it.state = "failed";
      console.warn(`Chunk ${id} of ${this.toyId} could not be built:`, e);
    }
    this.busy = false;
    this.player.stage.requestRender();
    this.pump();
  }

  // Each frame, after the toy's uniforms: places, fades or switches off
  // every ready chunk as out.chunks says.
  update(out) {
    if (this.destroyed) return;
    const T = this.transform;
    const s0 = T.scale ?? 1;
    const c = T.center || [0, 0, 0];
    let shown = "";
    for (const [id, it] of this.items) {
      if (!it.slot) continue;
      const o = out?.chunks?.[id];
      const fade = o ? Math.max(0, Math.min(1, o.fade ?? 1)) : 0;
      const sc = o ? Number(o.scale ?? 1) : 0;
      const on = fade > 0 && sc > 0 && Number.isFinite(sc);
      const e = it.slot.entity;
      if (e.enabled !== on) e.enabled = on;
      if (!on) continue;
      shown += `${id},`;
      const off = o.offset || [0, 0, 0];
      // Recipe coordinates to the toy's: (p * scale + offset - center) * fit.
      e.setLocalScale(s0 * sc, s0 * sc, s0 * sc);
      e.setLocalPosition(s0 * (off[0] - c[0]), s0 * (off[1] - c[1]), s0 * (off[2] - c[2]));
      e.gsplat.setParameter("uSpMorph", [fade, fade, fade, fade]);
    }
    // The status line counts the chunks on show: it hears when they change.
    if (shown !== this.shown) {
      this.shown = shown;
      this.player.emit("chunks", shown);
    }
  }

  // Splats in the chunks on show now (for tests and the status line).
  splats() {
    let n = 0;
    for (const it of this.items.values()) if (it.slot?.entity.enabled) n += it.splats || 0;
    return n;
  }

  // The toy's sheets (and so its chunks) go with it; builds still running
  // are thrown away when they finish.
  destroy() {
    this.destroyed = true;
    this.items.clear();
    this.queue = [];
  }
}
