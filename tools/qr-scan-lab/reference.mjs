// Reference QR renders drawn from a pinned encoder (qrcode-generator, MIT), used until the
// real toy is available and as the control group afterwards. Each style stands in for a family
// of looks: crisp cells, round dots, merged rounded cells, raised bricks with depth shadows,
// and glowing tubes whose light bleeds into the light modules.
import qrcode from "qrcode-generator";
import { newImage, blur } from "./sim.mjs";

export const REF_STYLES = ["classic", "dots", "rounded", "bricks", "glow"];

export const REF_SCHEMES = {
  bw: { fg: [0, 0, 0], bg: [255, 255, 255] },
  navy: { fg: [20, 36, 92], bg: [250, 244, 224] },
  red: { fg: [186, 40, 40], bg: [255, 255, 255] },
  pastel: { fg: [120, 150, 200], bg: [255, 255, 255] },
  gray: { fg: [128, 128, 128], bg: [255, 255, 255] },
  inverted: { fg: [255, 255, 255], bg: [0, 0, 0] },
};

export const luminance = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export function encode(text, ec) {
  const qr = qrcode(0, ec);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const m = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
  return { n, m, version: (n - 17) / 4 };
}

// Draw the code: 4 quiet-zone modules around n x n, px pixels per module.
export function renderReference({ text, ec, style, scheme, px = 16 }) {
  const { n, m, version } = encode(text, ec);
  const total = n + 8;
  const W = total * px;
  const { fg, bg } = REF_SCHEMES[scheme];
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  const img = newImage(W, W, bg);
  const mask = new Float32Array(W * W);
  const shade = new Float32Array(W * W); // brick edge shading, -1..1
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const gx = x / px - 4;
      const gy = y / px - 4;
      const r = Math.floor(gy);
      const c = Math.floor(gx);
      if (!dark(r, c)) continue;
      const fx = gx - c;
      const fy = gy - r;
      let inside = true;
      if (style === "dots") inside = Math.hypot(fx - 0.5, fy - 0.5) <= 0.46;
      else if (style === "glow") inside = Math.hypot(fx - 0.5, fy - 0.5) <= 0.34;
      else if (style === "rounded") {
        const rad = 0.38;
        const top = !dark(r - 1, c);
        const bot = !dark(r + 1, c);
        const lef = !dark(r, c - 1);
        const rig = !dark(r, c + 1);
        const corner = (cx, cy, on) =>
          on &&
          Math.hypot(fx - cx, fy - cy) > rad &&
          (cx === 0 ? fx < rad : fx > 1 - rad) &&
          (cy === 0 ? fy < rad : fy > 1 - rad);
        if (
          corner(0, 0, top && lef) ||
          corner(1, 0, top && rig) ||
          corner(0, 1, bot && lef) ||
          corner(1, 1, bot && rig)
        )
          inside = false;
      } else if (style === "bricks") {
        inside = fx > 0.06 && fx < 0.94 && fy > 0.06 && fy < 0.94;
        if (inside) shade[y * W + x] = fx < 0.2 || fy < 0.2 ? 1 : fx > 0.8 || fy > 0.8 ? -1 : 0;
      }
      if (inside) mask[y * W + x] = 1;
    }
  }
  const mix = (a, b, t) => a + (b - a) * t;
  let glow = null;
  if (style === "glow") glow = blurMask(mask, W, px * 0.45);
  const sh = style === "bricks" ? shadowMask(mask, W, Math.round(px * 0.28)) : null;
  for (let i = 0; i < W * W; i++) {
    const o = i * 4;
    let col = bg;
    if (style === "glow") {
      // Neon: the dark plate is the code's light color; the glowing tube is the dark color, with a halo.
      col = [0, 1, 2].map((k) => mix(bg[k], fg[k], Math.min(1, glow[i] * 1.4)));
    } else if (sh && sh[i] > 0) col = [0, 1, 2].map((k) => mix(bg[k], 0, sh[i] * 0.45));
    if (mask[i]) {
      const s = shade[i];
      col =
        style === "bricks"
          ? fg.map((v) => Math.max(0, Math.min(255, v + (s > 0 ? 60 : s < 0 ? -30 : 0))))
          : fg;
    }
    img.data[o] = col[0];
    img.data[o + 1] = col[1];
    img.data[o + 2] = col[2];
  }
  return { img, modules: total, n, version };
}

function blurMask(mask, W, sigma) {
  const im = newImage(W, W, [0, 0, 0]);
  for (let i = 0; i < mask.length; i++) im.data[i * 4] = mask[i] * 255;
  const b = blur(im, sigma);
  const out = new Float32Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = b.data[i * 4] / 255;
  return out;
}

// A drop shadow: the mask shifted down and right by d pixels, softened.
function shadowMask(mask, W, d) {
  const sh = new Float32Array(mask.length);
  for (let y = d; y < W; y++) for (let x = d; x < W; x++) sh[y * W + x] = mask[(y - d) * W + x - d];
  return blurMask(sh, W, d * 0.6);
}
