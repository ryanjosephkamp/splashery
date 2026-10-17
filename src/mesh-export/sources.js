import { emptyTable, readSplatFile, readPlyHeader, unzip, readSog } from "../viewers/splat-io.js";
import { getWebp } from "../viewers/engine.js";
import { PROFILES } from "./reconstruct.js";
import { checkZipBudget, boundedWebp } from "./input-budget.js";
import { bakeRestPose } from "./rest-pose.js";

const C0 = 0.28209479177387814;
export function tableFromBuffer(buf) {
  const t = emptyTable(buf.count);
  for (let i = 0; i < buf.count; i++) {
    [t.x[i], t.y[i], t.z[i]] = buf.pos.subarray(i * 3, i * 3 + 3);
    [t.s0[i], t.s1[i], t.s2[i]] = Array.from(buf.scale.subarray(i * 3, i * 3 + 3), (v) =>
      Math.log(Math.max(1e-10, v)),
    );
    [t.qx[i], t.qy[i], t.qz[i], t.qw[i]] = buf.rot.subarray(i * 4, i * 4 + 4);
    [t.r[i], t.g[i], t.b[i]] = Array.from(
      buf.color.subarray(i * 4, i * 4 + 3),
      (v) => (v - 0.5) / C0,
    );
    const a = Math.max(1e-6, Math.min(1 - 1e-6, buf.color[i * 4 + 3]));
    t.opacity[i] = Math.log(a / (1 - a));
  }
  return t;
}

async function readURL(url) {
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the built-in splat file.");
  return new Uint8Array(await r.arrayBuffer());
}

// Check declared allocation sizes before handing a file to the shared readers.
async function decode(bytes, name, files, profile) {
  const limits = PROFILES[profile],
    countCap = profile === "phone" ? 500000 : 2000000;
  if (bytes.length > limits.maxBytes)
    throw new Error(
      "This file exceeds the device memory budget. Open a smaller file, or use a computer.",
    );
  const extension = name.toLowerCase().split(".").at(-1);
  const checkCount = (n) => {
    if (!Number.isSafeInteger(n) || n <= 0 || n > countCap)
      throw new Error(
        `The file declares too many splats for this device (limit ${countCap.toLocaleString("en-US")}).`,
      );
  };
  if (extension === "ply") {
    const header = readPlyHeader(bytes);
    if (!header) throw new Error("The PLY header is missing or invalid.");
    checkCount(header.elements.find((e) => e.name === "vertex")?.count);
    let columns = 0;
    for (const element of header.elements) {
      if (
        !Number.isSafeInteger(element.count) ||
        element.count < 0 ||
        element.count > countCap ||
        element.props.length > 256
      )
        throw new Error("The PLY element count exceeds the device memory budget.");
      columns += element.count * element.props.filter((p) => !p.list).length * 8;
    }
    // The shared compressed-PLY reader reads all auxiliary columns, not only
    // vertices. Bound those allocations as well as the resulting splat table.
    const vertex = header.elements.find((e) => e.name === "vertex");
    if (columns + vertex.count * 56 > limits.maxBytes * 4)
      throw new Error("The PLY columns exceed the device memory budget.");
    if (
      header.elements.some((e) => e.name === "chunk") &&
      header.elements.some((e) => e.props.some((p) => p.list))
    )
      throw new Error("List properties in a compressed splat PLY exceed this reader's budget.");
  } else if (extension === "splat") {
    if (bytes.length % 32) throw new Error("This .splat file is cut short.");
    checkCount(bytes.length / 32);
  } else if (extension === "spz" && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // Bound expansion before the shared SPZ reader allocates columns. Its own
    // parser still handles version and property validation.
    const reader = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .getReader();
    let total = 0,
      count = null,
      headerSize = 0;
    const header = new Uint8Array(16);
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (count === null) {
          const take = Math.min(16 - headerSize, value.length);
          header.set(value.subarray(0, take), headerSize);
          headerSize += take;
          if (headerSize === 16) {
            count = new DataView(header.buffer).getUint32(8, true);
            checkCount(count);
          }
        }
        if (total > (count === null ? limits.maxBytes : 16 + count * 128))
          throw new Error("This SPZ expands beyond the device memory budget.");
      }
    } finally {
      await reader.cancel();
    }
  } else if (extension === "sog" || extension === "json") {
    if (extension === "sog") await checkZipBudget(bytes, limits.maxBytes);
    const all =
      extension === "json" ? new Map([["meta.json", bytes], ...(files || [])]) : await unzip(bytes);
    const entry = [...all].find(([k]) => k === "meta.json" || k.endsWith("/meta.json"));
    if (!entry) throw new Error("This SOG has no meta.json.");
    const meta = JSON.parse(new TextDecoder().decode(entry[1]));
    checkCount(meta.count);
    // Reconstruction has no view-dependent color: do not allocate SH rest arrays.
    delete meta.shN;
    all.set(entry[0], new TextEncoder().encode(JSON.stringify(meta)));
    const table = readSog(
      all,
      boundedWebp(await getWebp(), profile === "phone" ? 1048576 : 4194304),
    );
    table.rest = [];
    return table;
  }
  const table = await readSplatFile(bytes, name, { files, getWebp });
  checkCount(table.count);
  // Mesh output uses DC color only. Do not retain unused view-dependent data.
  table.rest = [];
  return table;
}

export async function loadSource(source, profile = "desktop", progress = () => {}) {
  if (!PROFILES[profile]) throw new Error("Unknown device profile.");
  progress(0, "Reading the source…");
  if (source.kind === "table")
    return {
      table: source.table,
      metadata: source.metadata || { name: "mesh", license: "Source license: supplied by you" },
    };
  if (source.kind === "file") {
    const { file } = source,
      files = new Map();
    const picked = source.files || [file];
    if (!file || picked.reduce((sum, f) => sum + f.size, 0) > PROFILES[profile].maxBytes)
      throw new Error(
        "These files exceed the device memory budget. Choose smaller files, or use a computer.",
      );
    for (const f of picked)
      if (f !== file) files.set(f.name, new Uint8Array(await f.arrayBuffer()));
    const table = await decode(new Uint8Array(await file.arrayBuffer()), file.name, files, profile);
    return {
      table,
      metadata: {
        name: file.name.replace(/\.[^.]+$/, ""),
        license: source.license || "Source license: keep the original license and attribution",
        author: source.author || "",
        source: source.source || "",
      },
    };
  }
  if (source.kind !== "toy") throw new Error("Choose a splat file, or a built-in toy ID.");
  const { findToy } = await import("../toys.js");
  const toy = findToy(source.id);
  if (!toy || toy.id === "splats-to-mesh") throw new Error("Choose another built-in toy ID.");
  let metadata = { name: toy.label, ...toy.credit };
  if (toy.kind === "captured") {
    const url = profile === "phone" && toy.urlWeak ? toy.urlWeak : toy.url;
    return {
      table: await decode(
        await readURL(new URL(`../../${url}`, import.meta.url)),
        url,
        null,
        profile,
      ),
      metadata,
    };
  }
  const count = profile === "phone" ? 60000 : 160000;
  let buf,
    credits = [];
  if (toy.kind === "procedural") {
    const { generateSync, normalizeGenerator } = await import("../generators.js");
    buf = generateSync(normalizeGenerator({ ...toy.generator, count })).buf;
  } else if (toy.kind === "kit") {
    const { buildRecipe } = await import("../kit.js");
    const mod = await import(`../packs/${toy.pack}.js`),
      recipe = mod.RECIPES?.[toy.id];
    if (!recipe) throw new Error("That toy has no recipe to export.");
    const options = Object.fromEntries(
      (recipe.options || []).map((o) => [o.key, source.options?.[o.key] ?? o.default]),
    );
    if (
      toy.id === "photo-3d" &&
      typeof document === "undefined" &&
      typeof OffscreenCanvas !== "undefined"
    ) {
      // The existing photo decoder's browser path needs a document. Decode the
      // shipped sample into worker pixels, then use its public input hook.
      const sample = mod.ALL_SAMPLES.find((s) => s.id === options.source) || mod.SAMPLES[0];
      const dir = sample.dir ? `${sample.dir}/` : "",
        name = sample.file || sample.id;
      const [image, depth] = await Promise.all([
        readURL(
          new URL(
            `../../assets/toys/photo-3d/${dir}${name}.${sample.ext || "jpg"}`,
            import.meta.url,
          ),
        ),
        readURL(new URL(`../../assets/toys/photo-3d/${dir}${name}.depth`, import.meta.url)),
      ]);
      const bitmap = await createImageBitmap(new Blob([image]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      mod.usePhoto(
        {
          w: canvas.width,
          h: canvas.height,
          data: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer),
        },
        mod.unpackDepth(depth),
        sample.label,
      );
      options.source = "custom";
      metadata = { ...metadata, ...sample };
    }
    await recipe.prepare?.(options, () => {}, {
      profile: profile === "phone" ? "low" : "high",
      count,
    });
    const it = buildRecipe(recipe, { seed: 7, count, options, clay: [] });
    let r = it.next();
    while (!r.done) r = it.next();
    buf = bakeRestPose(r.value, source.controls || {});
    credits = metadata.license ? [] : recipe.credits || [];
  } else
    throw new Error(
      "This toy needs an opened source file. Save its splats and open that file here.",
    );
  if (!buf?.count)
    throw new Error(
      "This toy has no splats in its default state. Save its splats after opening its input, and open that file here.",
    );
  if (!metadata.license)
    metadata = {
      ...metadata,
      author: "Ryan and Splashery contributors",
      license: "CC0 1.0",
      source: "https://github.com/ryanjosephkamp/splashery",
      credits,
    };
  const licenses = credits.map((c) => c.license || "");
  if (licenses.some((s) => /BY-SA/i.test(s)) && licenses.some((s) => /BY-NC/i.test(s)))
    throw new Error(
      "This toy lists NC and BY-SA assets. Export one source separately so their licenses stay separate.",
    );
  if (credits.length)
    metadata.license =
      [...new Set(credits.map((c) => c.license).filter(Boolean))].join("; ") || metadata.license;
  return { table: tableFromBuffer(buf), metadata };
}
