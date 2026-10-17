// Dependency-free glTF 2.0 binary, Wavefront OBJ/MTL, and binary STL writers.
const textBytes = (s) => new TextEncoder().encode(s);
const clean = (s) =>
  String(s || "")
    .replace(/[\r\n\0]/g, " ")
    .slice(0, 2000);
const linear = (s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
const file = (name, bytes, type) => ({ name, bytes, type });

export function encodeMesh(mesh, format, metadata = {}) {
  const stem =
    String(metadata.name || "mesh")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "mesh";
  if (format === "glb") return [file(`${stem}.glb`, glb(mesh, metadata), "model/gltf-binary")];
  if (format === "obj") return obj(mesh, metadata, stem);
  if (format === "stl") return [file(`${stem}.stl`, stl(mesh, metadata), "model/stl")];
  throw new Error("Choose GLB, OBJ, or STL.");
}

function glb(mesh, metadata) {
  const { positions, normals, colors, indices } = mesh;
  const arrays = [positions, normals, Float32Array.from(colors, linear), indices];
  const offsets = [];
  let bytes = 0;
  for (const a of arrays) {
    offsets.push(bytes);
    bytes += a.byteLength;
  }
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const json = {
    asset: {
      version: "2.0",
      generator: "Splashery Splats to mesh",
      extras: { ...metadata, units: mesh.report.units, report: mesh.report },
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, ...(mesh.report.units === "mm" ? { scale: [0.001, 0.001, 0.001] } : {}) }],
    meshes: [
      {
        name: clean(metadata.name || "Mesh"),
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
    buffers: [{ byteLength: bytes }],
    bufferViews: arrays.map((a, k) => ({
      buffer: 0,
      byteOffset: offsets[k],
      byteLength: a.byteLength,
      target: k === 3 ? 34963 : 34962,
    })),
    accessors: arrays.map((a, k) => ({
      bufferView: k,
      componentType: k === 3 ? 5125 : 5126,
      count: k === 3 ? a.length : a.length / 3,
      type: k === 3 ? "SCALAR" : "VEC3",
      ...(k === 0 ? { min, max } : {}),
    })),
  };
  const text = textBytes(JSON.stringify(json)),
    padding = (4 - (text.length % 4)) % 4;
  const out = new Uint8Array(12 + 8 + text.length + padding + 8 + bytes),
    dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, text.length + padding, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(32, 20 + text.length, 20 + text.length + padding);
  const start = 20 + text.length + padding;
  dv.setUint32(start, bytes, true);
  dv.setUint32(start + 4, 0x004e4942, true);
  arrays.forEach((a, k) =>
    out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), start + 8 + offsets[k]),
  );
  return out;
}

function obj(mesh, metadata, stem) {
  const { positions: p, colors: c, normals: n, indices: idx } = mesh;
  const header = Object.entries(metadata)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `# ${clean(k)}: ${clean(v)}`);
  for (const credit of metadata.credits || [])
    header.push(
      `# Source: ${clean([credit.title, credit.author, credit.license, credit.source].filter(Boolean).join("; "))}`,
    );
  const lines = [
    ...header,
    `# Units: ${mesh.report.units}`,
    `mtllib ${stem}.mtl`,
    "o mesh",
    "usemtl surface",
  ];
  for (let i = 0; i < p.length; i += 3)
    lines.push(`v ${p[i]} ${p[i + 1]} ${p[i + 2]} ${c[i]} ${c[i + 1]} ${c[i + 2]}`);
  for (let i = 0; i < n.length; i += 3) lines.push(`vn ${n[i]} ${n[i + 1]} ${n[i + 2]}`);
  for (let i = 0; i < idx.length; i += 3)
    lines.push(
      `f ${idx[i] + 1}//${idx[i] + 1} ${idx[i + 1] + 1}//${idx[i + 1] + 1} ${idx[i + 2] + 1}//${idx[i + 2] + 1}`,
    );
  return [
    file(`${stem}.obj`, textBytes(lines.join("\n") + "\n"), "text/plain"),
    file(
      `${stem}.mtl`,
      textBytes([...header, "newmtl surface", "Kd 1 1 1", "d 1", "illum 2", ""].join("\n")),
      "text/plain",
    ),
  ];
}

function stl(mesh, metadata) {
  const { positions: p, indices: idx } = mesh,
    count = idx.length / 3;
  const out = new Uint8Array(84 + count * 50),
    dv = new DataView(out.buffer);
  out.set(
    textBytes(
      clean(`Splashery; ${mesh.report.units}; ${metadata.license || "source license"}`),
    ).subarray(0, 80),
  );
  dv.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const a = idx[i * 3] * 3,
      b = idx[i * 3 + 1] * 3,
      c = idx[i * 3 + 2] * 3;
    const u = [0, 1, 2].map((k) => p[b + k] - p[a + k]),
      v = [0, 1, 2].map((k) => p[c + k] - p[a + k]);
    const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ],
      len = Math.hypot(...normal) || 1;
    const values = [
      ...normal.map((v) => v / len),
      ...p.subarray(a, a + 3),
      ...p.subarray(b, b + 3),
      ...p.subarray(c, c + 3),
    ];
    values.forEach((v, k) => dv.setFloat32(84 + i * 50 + k * 4, v, true));
  }
  return out;
}
