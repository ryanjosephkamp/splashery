// Lane Baked engine (docs/handoff/BakedEngine.md): the example of a baked asset in a kit toy
// (labs). The chest was baked offline (tools/bkd-bake-chest.mjs) into a 3DGS PLY with a parts
// sidecar, the way an outside agent's bake arrives, and converted by tools/port-convert.mjs into
// assets/toys/baked-chest/ at two tiers (30,000 and 100,001 splats). prepare() loads the tier the
// splat budget picks (src/baked.js), build() emits it through the kit with its lid as a part, and
// the lid swings on its hinge like any kit part.

import { loadBaked, addBaked } from "../baked.js";

const MANIFEST = new URL("../../assets/toys/baked-chest/manifest.json", import.meta.url);
let ASSET = null;

const OPEN = 1.85; // radians the lid swings back

export const RECIPES = {
  "baked-chest": {
    alive: false,
    turntable: true,
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    credits: [
      {
        label: "Chest",
        title: "Baked chest (built with Splashery's kit and baked to splats)",
        source: "tools/bkd-bake-chest.mjs",
        author: "Made by Ryan with Claude Code (Opus 5.5)",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    // The budget (the splat menu or Auto) picks the tier; with no budget (the Node tools), the
    // manifest's default tier.
    async prepare(_o, _help, ctx) {
      ASSET = await loadBaked(MANIFEST, { budget: ctx?.count });
    },
    build(k) {
      if (!ASSET) throw new Error("The baked chest is not loaded (prepare() loads it).");
      addBaked(k, ASSET);
      // The open lid's far edge and top, so the camera frames them, and the same depth in front
      // and below, so the closed chest stays in the middle of the frame.
      for (const x of [-0.8, 0.8]) {
        k.reach([x, 0.86 + 1.02, -0.5 - 0.32]);
        k.reach([x, 0.86 + 0.95, -0.5 - 0.66]);
        k.reach([x, -0.35, 1.16]);
      }
      k.data.tier = { splats: ASSET.tier.splats, used: ASSET.n };
    },
    drive(_t, c, out) {
      // The toggle eases it open and shut about the hinge.
      out.parts.lid = { angle: -OPEN * c.open };
    },
  },
};
