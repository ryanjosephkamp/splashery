// Lane Pages r6: a small test PDF made here, from nothing outside the repo.
// Page 1 is a title page; page 2 has two pictures apart (two figures: a
// sunset and a hill pattern of our own pixels) and a line of text; page 3 is
// plain text.
//
// twoFigurePDF() -> Uint8Array. The figure boxes, in fractions of the page
// from its top-left corner, are in BOXES (Letter, 612 x 792 points).

export const BOXES = {
  a: [72 / 612, 1 - 640 / 792, 282 / 612, 1 - 480 / 792],
  b: [330 / 612, 1 - 400 / 792, 540 / 612, 1 - 240 / 792],
};

function picture(w, h, seed) {
  const px = [];
  const grain = (x, y, k) => (((x * 73 + y * 151 + k * 37 + seed) * 2654435761) >>> 24) / 255 - 0.5;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = y / (h - 1);
      let c = seed
        ? [90 + 120 * t, 160 - 60 * t, 220 - 150 * t]
        : [250 - 180 * t, 150 - 40 * t, 60 + 160 * t];
      if ((x - 40) ** 2 + (y - 18) ** 2 < 64) c = [250, 230, 120];
      if (y > 30 + 8 * Math.sin(x / (seed ? 5 : 9))) c = seed ? [120, 80, 50] : [40, 70, 45];
      px.push(...c.map((v, k) => Math.max(0, Math.min(255, Math.round(v + 18 * grain(x, y, k))))));
    }
  return String.fromCharCode(...px);
}

export function twoFigurePDF() {
  const objs = [];
  const add = (body) => {
    objs.push(body);
    return objs.length;
  };
  const stream = (dict, data) => `<< ${dict} /Length ${data.length} >>\nstream\n${data}\nendstream`;
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const im = "/Type /XObject /Subtype /Image /Width 64 /Height 48 /ColorSpace /DeviceRGB /BitsPerComponent 8"; // prettier-ignore
  const img1 = add(stream(im, picture(64, 48, 0)));
  const img2 = add(stream(im, picture(64, 48, 7)));
  const text = (lines) =>
    "BT /F1 14 Tf " + lines.map(([x, y, s]) => `1 0 0 1 ${x} ${y} Tm (${s}) Tj`).join(" ") + " ET";
  const pagesId = objs.length + 1;
  objs.push(null);
  const pageIds = [];
  const page = (content) => {
    const c = add(stream("", content));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${c} 0 R /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${img1} 0 R /Im2 ${img2} 0 R >> >> >>`)); // prettier-ignore
  };
  page(text([[72, 720, "Two figures"]]));
  page(text([[72, 720, "Two figures on a page"], [72, 200, "Tap a picture to raise it."]]) + " q 210 0 0 160 72 480 cm /Im1 Do Q q 210 0 0 160 330 240 cm /Im2 Do Q"); // prettier-ignore
  page(text([[72, 720, "Page three"]]));
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageIds.length} >>`; // prettier-ignore
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((body, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}
