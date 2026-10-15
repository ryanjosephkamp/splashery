// The one-link page (lane Pitch): site/about/splashery/, Splashery in about two minutes of
// scrolling, with a live toy in each section. tools/site-build.mjs turns the page entry in
// tools/site-pages.mjs into HTML through pitchPage(); site/assets/pitch.js starts each live toy
// only near the viewport and unloads it again off it, and site/assets/pitch.css lays it out.
//
// Each toy's still is site/assets/pitch/<id>.webp, rendered by tools/pit-stills.mjs.
//
// Every live toy is the site's own player (site/play/?toy=…), the embed path, in an iframe. The
// claims list is the manual's own six, from "What Splashery can do that other splat tools can't"
// (manual/unique.html).

// The live toys, in page order. `q` is the player's query (after ?toy=<id>); `still` leaves the
// turntable off for a toy that is read face on.
export const PITCH_DEMOS = [
  { id: "grape", q: "", label: "A grape, captured from photos: drag to turn it, tap to peel it" }, // prettier-ignore
  { id: "toy-piano", q: "&sound=on", label: "A toy piano built from a recipe: tap or drag along the keys to play it" }, // prettier-ignore
  { id: "photo-3d", q: "&turntable=off", label: "A photo turned into 3D: tap to lift its depth, drag to turn it" }, // prettier-ignore
  { id: "walnut-ct", q: "&zoom=0.55", label: "A real CT scan of a walnut: drag up or down to cut into it" }, // prettier-ignore
  { id: "qr-code", q: "&turntable=off&zoom=0.72", label: "A QR code made of splats that a phone camera reads" }, // prettier-ignore
];

export function pitchPage(page, ctx) {
  const { up, esc, toyPath, arrow, countToys, TOYS, galleryHref, galleryHash } = ctx;
  const toy = (id) => {
    const t = TOYS.find((x) => x.id === id);
    if (!t) throw new Error(`The pitch page names an unknown toy: ${id}`);
    return t;
  };
  // A live toy: a still of it (the static fallback, and what shows until it starts), and the
  // player's address in data-src for pitch.js to load near the viewport.
  const live = (id, { hero = false } = {}) => {
    const d = PITCH_DEMOS.find((x) => x.id === id);
    const t = toy(id);
    return `<div class="pit-stage${hero ? " pit-hero-stage" : ""}" data-pit-demo="${esc(id)}">
<img class="pit-still" src="${up}assets/pitch/${esc(id)}.webp" alt="" width="640" height="480" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
<iframe data-src="${up}play/?toy=${esc(id)}${d.q}&controls=0" title="${esc(d.label)}" allow="fullscreen" tabindex="0" hidden></iframe>
<button type="button" class="pit-start" hidden>Start the live toy</button>
<p class="pit-note" role="status" aria-live="polite"></p>
</div>`;
  };
  const links = (id, more = "") => {
    const t = toy(id);
    // A toy still in labs keeps its Playground link but not its page, which shows the labs screen
    // to anyone without the switch (the owner's call, October 14, 2026); it returns when the toy
    // leaves labs.
    const page = t.labs ? "" : `<a href="${up}${toyPath(t)}">Its page</a>`;
    return `<p class="pit-links"><a href="${up}${galleryHref(t)}">Open it in the Playground${arrow}</a>${page}${more}</p>`; // prettier-ignore
  };
  const grape = toy("grape");
  const linkChars = `${grape ? "#s=" + galleryHash(grape) : ""}`.length;

  return `<article class="pit">
<section class="pit-hero" aria-labelledby="h-pit">
<div class="pit-hero-text">
<p class="pit-eyebrow">Splashery</p>
<h1 id="h-pit">A 3D Gaussian splat engine and studio, in a browser tab.</h1>
<p class="pit-lead">Everything here is drawn from soft, colored splats, sorted by depth and blended on your own device. There is nothing to install, and nothing you open leaves your device.</p>
<p class="pit-stats"><span><b>${countToys("all")}</b> scenes and tools</span><span><b>0</b> installs</span><span><b>0</b> uploads</span></p>
</div>
<figure class="pit-figure">
${live("grape", { hero: true })}
<figcaption>A grape, captured from photos. Drag to turn it; tap it to peel the skin.<span class="pit-credit">Grape: Dany Bittel, <a href="https://superspl.at/scene/4ae563ac">SuperSplat</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, converted for Splashery.</span></figcaption>
</figure>
</section>

<section class="pit-sec" aria-labelledby="h-pit-one">
<div class="pit-text">
<p class="pit-num">01</p>
<h2 id="h-pit-one">One splat</h2>
<p>A splat is a soft blob with a position, a shape, a color, and an opacity. Change its shape and opacity here. Every scene on the site is this, repeated a few hundred thousand times and sorted back to front.</p>
<p class="pit-links"><a href="${up}../manual/splat.html">The manual, from one splat up${arrow}</a><a href="${up}learn/splats/">How splats work</a></p>
</div>
<figure class="pit-figure">
<div class="pit-one" data-pit-one>
<canvas width="480" height="480" role="img" aria-label="One splat: a soft colored ellipse that fades out from its center"></canvas>
<div class="pit-sliders">
<label>Width <input type="range" min="0.06" max="0.42" step="0.01" value="0.26" data-k="sx" /></label>
<label>Height <input type="range" min="0.06" max="0.42" step="0.01" value="0.14" data-k="sy" /></label>
<label>Turn <input type="range" min="0" max="180" step="1" value="30" data-k="rot" /></label>
<label>Opacity <input type="range" min="0.05" max="1" step="0.01" value="0.9" data-k="a" /></label>
</div>
</div>
<figcaption>One splat, drawn the way the engine blends it: brightest at the center, fading as a bell curve.</figcaption>
</figure>
</section>

<section class="pit-sec" aria-labelledby="h-pit-recipe">
<div class="pit-text">
<p class="pit-num">02</p>
<h2 id="h-pit-recipe">Built from recipes, not downloaded</h2>
<p>Most objects here were never captured. A recipe of a few kilobytes says what an object is made of and which parts move, and your device builds the splats. Parts move as solid pieces on hinges, pivots, and sliders, inside one splat cloud.</p>
<p>The piano is played: each key goes down as it sounds.</p>
${links("toy-piano", `<a href="${up}learn/recipes/">Writing a recipe</a>`)}
</div>
<figure class="pit-figure">
${live("toy-piano")}
<figcaption>A toy piano, built from a recipe on your device. Tap or drag along the keys. Sound plays only after you tap.</figcaption>
</figure>
</section>

<section class="pit-sec" aria-labelledby="h-pit-photo">
<div class="pit-text">
<p class="pit-num">03</p>
<h2 id="h-pit-photo">A photo becomes 3D, on the device</h2>
<p>A depth model runs in the page and lifts a single photo into a relief you can turn. It downloads only when you ask for it, and the photo is never sent anywhere. A short video becomes a scene you can fly through: the camera path is solved and the splats are trained on your device, in a browser with WebGPU.</p>
<p class="pit-own" hidden><button type="button" class="button" data-pit-own>Use your own photo</button><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Your own photo" data-pit-own-file hidden /><span>Or drop one on the picture. It stays on this device; the depth model (about 27 MB) downloads the first time.</span></p>
${links("photo-3d", `<a href="${up}studio/">The Studio</a>`)}
</div>
<figure class="pit-figure">
${live("photo-3d")}
<figcaption>A sample photo with its depth. Tap to lift it out of the picture; tap again to lay it flat.</figcaption>
</figure>
</section>

<section class="pit-sec" aria-labelledby="h-pit-data">
<div class="pit-text">
<p class="pit-num">04</p>
<h2 id="h-pit-data">Real data</h2>
<p>Some of the science toys use measured data. This is a real walnut, scanned with X-ray CT at CWI in Amsterdam: more than a thousand X-ray pictures, worked back into a volume. Each splat is one small block of it, 0.3 mm across.</p>
${links("walnut-ct", `<a href="${up}science/">Science</a>`)}
<p class="pit-credit">Data: Der Sarkissian et al., CWI, <a href="https://doi.org/10.5281/zenodo.2686726">Zenodo</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, resampled to 0.3 mm.</p>
</div>
<figure class="pit-figure">
${live("walnut-ct")}
<figcaption>Drag up or down on the walnut to cut into it, slice by slice.</figcaption>
</figure>
</section>

<section class="pit-sec" aria-labelledby="h-pit-qr">
<div class="pit-text">
<p class="pit-num">05</p>
<h2 id="h-pit-qr">A code that scans</h2>
<p>Text, pictures, PDFs, and codes can all become splats. This QR code is made of them, and it still reads: point a phone's camera at it. The QR tools also show how a code works, how much damage it survives, and how to hide three in one picture.</p>
${links("qr-code")}
</div>
<figure class="pit-figure">
${live("qr-code")}
<figcaption>A QR code in splats. It opens Splashery.</figcaption>
</figure>
</section>

<section class="pit-sec pit-claims" aria-labelledby="h-pit-claims">
<div class="pit-text">
<p class="pit-num">06</p>
<h2 id="h-pit-claims">What we haven't seen elsewhere</h2>
<p>As far as we know. We have not tried every splat tool.</p>
</div>
<div class="pit-claim-wrap"><ul class="pit-claim-list">
<li><b>Toys made from rules</b><span>A recipe of a few kilobytes is built into splats on your device, with a budget of 60,000 to 400,000. The shape is never a large file to download.</span></li>
<li><b>Equations as a language</b><span>Type x, y, and z in u, v, and t, and get an animated splat shape, with plain messages instead of crashes.</span></li>
<li><b>Moving parts in one splat cloud</b><span>Hinges, pivots, sliders, morphs, and per-splat effects run on the graphics chip, so a chest opens without rebuilding anything.</span></li>
<li><b>Hands-on physics</b><span>Toss, stack, pull apart, and pour, on splats.</span></li>
<li><b>Anything as splats</b><span>Photos and videos with depth, PDFs, QR codes, real science data, the night sky, and medical volumes.</span></li>
<li><b>A whole scene in a link</b><span>The link to the grape above is ${linkChars} characters. It holds the toy and its settings, not your files, and no server stores it.</span></li>
</ul></div>
<p class="pit-links pit-end"><a class="button primary" href="${up}../">Open the Playground${arrow}</a><a class="button" href="${up}../manual/">Read the manual</a><a class="button" href="${ctx.SITE.github}">Source on GitHub</a></p>
</section>
</article>`;
}
