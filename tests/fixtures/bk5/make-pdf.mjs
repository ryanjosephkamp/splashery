// Lane Books r5: a small test PDF made here, from nothing outside the repo.
// Page 1 is a title page (a book shows it on its cover). Page 2 has a web
// link (https://example.org/), a link to page 4, a javascript: link (which
// must never open) and a picture (a 64 x 48 sunset of our own pixels);
// pages 3 and 4 are plain text.
//
// linkPDF() -> Uint8Array. The boxes, in fractions of the page from its
// top-left corner, are in BOXES (Letter, 612 x 792 points).

export const BOXES = {
  web: [72 / 612, 1 - 700 / 792, 300 / 612, 1 - 680 / 792],
  page4: [72 / 612, 1 - 660 / 792, 300 / 612, 1 - 640 / 792],
  script: [72 / 612, 1 - 620 / 792, 300 / 612, 1 - 600 / 792],
  figure: [306 / 612, 1 - 560 / 792, 546 / 612, 1 - 380 / 792],
};

function picture(w, h) {
  // A sky that fades from orange to blue, a sun and a dark hill, with a
  // little grain (as a photo has).
  const px = [];
  const grain = (x, y, k) => (((x * 73 + y * 151 + k * 37) * 2654435761) >>> 24) / 255 - 0.5;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = y / (h - 1);
      let c = [250 - 180 * t, 150 - 40 * t, 60 + 160 * t];
      if ((x - 40) ** 2 + (y - 18) ** 2 < 64) c = [250, 230, 120];
      if (y > 34 + 6 * Math.sin(x / 9)) c = [40, 70, 45];
      px.push(...c.map((v, k) => Math.max(0, Math.min(255, Math.round(v + 16 * grain(x, y, k))))));
    }
  return String.fromCharCode(...px);
}

export function linkPDF() {
  const objs = [];
  const add = (body) => {
    objs.push(body);
    return objs.length;
  };
  const stream = (dict, data) => `<< ${dict} /Length ${data.length} >>\nstream\n${data}\nendstream`;
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const img = add(stream("/Type /XObject /Subtype /Image /Width 64 /Height 48 /ColorSpace /DeviceRGB /BitsPerComponent 8", picture(64, 48))); // prettier-ignore
  const text = (lines) =>
    "BT /F1 14 Tf " + lines.map(([x, y, s]) => `1 0 0 1 ${x} ${y} Tm (${s}) Tj`).join(" ") + " ET";
  const pagesId = objs.length + 1;
  objs.push(null); // the page tree, filled in below
  const pageIds = [];
  const page = (content, annots = []) => {
    const c = add(stream("", content));
    const a = annots.length ? ` /Annots [${annots.map((n) => `${n} 0 R`).join(" ")}]` : "";
    const id = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${c} 0 R /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${img} 0 R >> >>${a} >>`); // prettier-ignore
    pageIds.push(id);
    return id;
  };
  page(text([[72, 720, "Links test"]]));
  // The link to page 4 is filled in once page 4 has its number.
  const p1Content =
    text([
      [72, 720, "Links and a figure"],
      [76, 686, "Visit example.org"],
      [76, 646, "Go to page 4"],
      [76, 606, "Do not run this"],
    ]) + " q 240 0 0 180 306 380 cm /Im1 Do Q";
  const linkWeb = add(`<< /Type /Annot /Subtype /Link /Rect [72 680 300 700] /Border [0 0 0] /A << /S /URI /URI (https://example.org/) >> >>`); // prettier-ignore
  const linkScript = add(`<< /Type /Annot /Subtype /Link /Rect [72 600 300 620] /Border [0 0 0] /A << /S /URI /URI (javascript:alert\\(1\\)) >> >>`); // prettier-ignore
  const linkPage4 = objs.length + 1;
  objs.push(null);
  page(p1Content, [linkWeb, linkPage4, linkScript]);
  page(text([[72, 720, "Page three"]]));
  const p4 = page(text([[72, 720, "Page four"]]));
  objs[linkPage4 - 1] = `<< /Type /Annot /Subtype /Link /Rect [72 640 300 660] /Border [0 0 0] /Dest [${p4} 0 R /XYZ 0 792 0] >>`; // prettier-ignore
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
