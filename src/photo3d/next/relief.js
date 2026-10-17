// MIT; made by Ryan with Codex (GPT-6). Separate color bindings; unchanged shaders.
import { ReliefMesh as ClassicReliefMesh } from "../../live/relief-mesh.js";
import { PIXELFORMAT_RGBA8, FILTER_LINEAR } from "../../pc.js";
export * from "../../live/relief-mesh.js";

export class ReliefMesh extends ClassicReliefMesh {
  setBackground(background) {
    super.setBackground(background);
    this.foregroundBackground?.destroy();
    this.foregroundBackground = null;
    this.foregroundBackgroundBytes = 0;
    if (background?.classicRgba) {
      const t = this.byteTexture(
        "p3d-classic-foreground-background",
        background.w,
        background.h,
        PIXELFORMAT_RGBA8,
        background.classicRgba,
      );
      t.minFilter = t.magFilter = FILTER_LINEAR;
      this.foregroundBackground = t;
      this.foregroundBackgroundBytes = background.classicRgba.byteLength;
      this.matS.setParameter("uBackground", t);
    }
  }

  setColor(source) {
    const ready = super.setColor(source);
    if (this.foregroundBackground) this.matS.setParameter("uBackground", this.foregroundBackground);
    return ready;
  }

  cost() {
    const base = super.cost(),
      extra = this.foregroundBackgroundBytes || 0;
    return { ...base, background: base.background + extra, total: base.total + extra };
  }

  destroy() {
    this.foregroundBackground?.destroy();
    this.foregroundBackground = null;
    super.destroy();
  }
}
