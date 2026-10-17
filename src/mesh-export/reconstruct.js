import { sampleGaussians } from "./field.js";
import { checkThickness } from "./thickness.js";
import { extractSurface, resample, solidVolume } from "./surface.js";
import { inspectTopology, removeFloaters, smoothMesh, vertexNormals } from "./topology.js";

export const PROFILES = {
  desktop: {
    resolution: 112,
    maxResolution: 160,
    maxSplats: 1000000,
    triangleBudget: 100000,
    maxWork: 160000000,
    maxBytes: 200000000,
  },
  phone: {
    resolution: 72,
    maxResolution: 80,
    maxSplats: 120000,
    triangleBudget: 40000,
    maxWork: 40000000,
    maxBytes: 40000000,
  },
};

export function meshBounds(positions) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const k = i % 3;
    min[k] = Math.min(min[k], positions[i]);
    max[k] = Math.max(max[k], positions[i]);
  }
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

export function reconstruct(table, options = {}, onProgress = () => {}) {
  const started = performance.now();
  const profile = options.profile || "desktop";
  if (!PROFILES[profile]) throw new Error("Unknown device profile.");
  const settings = { ...PROFILES[profile], ...options };
  // Resource caps belong to the profile and cannot be overridden by a file.
  for (const k of ["maxResolution", "maxSplats", "maxWork", "maxBytes"])
    settings[k] = PROFILES[profile][k];
  const { resolution, triangleBudget } = settings;
  const level = options.level ?? 0.15,
    printSize = options.printSize ?? 100;
  const smoothIterations = options.smoothIterations ?? 3,
    minComponent = options.minComponent ?? 0.002;
  if (!Number.isInteger(resolution) || resolution < 16 || resolution > settings.maxResolution)
    throw new Error(`Resolution must be 16 to ${settings.maxResolution} for this device budget.`);
  if (!Number.isFinite(level) || level <= 0 || level > 100)
    throw new Error("Density level must be greater than 0 and at most 100.");
  const maxTriangles = profile === "phone" ? 80000 : 500000;
  if (!Number.isInteger(triangleBudget) || triangleBudget < 500 || triangleBudget > maxTriangles)
    throw new Error(
      `Triangle budget must be 500 to ${maxTriangles.toLocaleString("en-US")} for this device.`,
    );
  if (!Number.isInteger(smoothIterations) || smoothIterations < 0 || smoothIterations > 10)
    throw new Error("Smoothing must be 0 to 10 iterations.");
  if (!Number.isFinite(minComponent) || minComponent < 0 || minComponent > 0.2)
    throw new Error("Floater removal must be 0 to 0.2.");
  if (options.readyToPrint && (!Number.isFinite(printSize) || printSize < 5 || printSize > 1000))
    throw new Error("Choose a print size from 5 to 1,000 mm.");
  onProgress(0.02, "Checking splats and device budget…");
  const { field, sampled, work } = sampleGaussians(table, settings, onProgress);
  const density = field.dense();
  let volume = density,
    iso = level * (1 + 1e-8),
    radius = 0;
  const warnings = [];
  if (sampled < table.count)
    warnings.push(
      `Used ${sampled.toLocaleString("en-US")} of ${table.count.toLocaleString("en-US")} splats for this device budget.`,
    );
  if (options.readyToPrint) {
    onProgress(0.56, "Thickening thin features and filling enclosed cavities…");
    const mmPerCell = printSize / (resolution - 8);
    radius = Math.max(1, Math.ceil((Math.sqrt(3) * 0.75) / mmPerCell));
    if (radius > 5)
      throw new Error(
        "This print size needs more thickness than the grid can resolve. Choose a larger print size.",
      );
    volume = solidVolume(density, resolution, level, radius);
    // Keep the isovalue off the exact midpoint produced by binary resampling.
    iso = 0.5001;
  }
  let size = resolution,
    mesh;
  const peakTriangles = Math.min(500000, Math.max(triangleBudget * 2, 50000));
  while (true) {
    onProgress(0.68, "Extracting a shared-vertex surface…");
    const scalar = size === resolution ? volume : resample(volume, resolution, size);
    mesh = extractSurface(
      scalar,
      size,
      field.origin,
      (field.step * (resolution - 1)) / (size - 1),
      iso,
      field,
      peakTriangles,
      !options.readyToPrint,
    );
    if (!mesh.overflow && mesh.indices.length / 3 <= triangleBudget) break;
    const next = Math.floor(
      size *
        Math.min(
          0.85,
          Math.sqrt(triangleBudget / (mesh.triangles || mesh.indices.length / 3)) * 0.93,
        ),
    );
    if (next < 12)
      throw new Error(
        "The triangle budget is too small for this surface. Raise the triangle budget, or density level.",
      );
    size = next;
  }
  if (size < resolution)
    warnings.push(
      "The triangle budget required a coarser grid. Topology preservation could not be guaranteed; small details or disconnected pieces may be lost. Raise the triangle budget to retain more detail.",
    );
  if (!mesh.indices.length)
    throw new Error("No surface at this density level. Lower the level, or open a denser splat.");
  onProgress(0.82, "Removing small disconnected pieces and smoothing…");
  mesh = removeFloaters(mesh, minComponent);
  smoothMesh(mesh, smoothIterations);
  const bounds = meshBounds(mesh.positions);
  let printTransform = null;
  if (options.readyToPrint) {
    const scale = printSize / Math.max(...bounds.size);
    printTransform = { scale, center: bounds.min.map((v, k) => (v + bounds.max[k]) / 2) };
    for (let i = 0; i < mesh.positions.length; i++)
      mesh.positions[i] = (mesh.positions[i] - (bounds.min[i % 3] + bounds.max[i % 3]) / 2) * scale;
  }
  onProgress(0.92, "Checking edges, vertex links, and solid volume…");
  mesh.normals = vertexNormals(mesh.positions, mesh.indices);
  const topology = inspectTopology(mesh);
  const thicknessCheck = options.readyToPrint && topology.manifold ? checkThickness(mesh) : null;
  const units = options.readyToPrint ? "mm" : "source units";
  if (!topology.manifold || !topology.watertight || topology.volume <= 0)
    warnings.push("This mesh failed the closed manifold checks. It is not ready to print.");
  if (options.readyToPrint)
    warnings.push(
      "Thickness uses inward ray samples, not a full-surface certificate. Check the 1 mm minimum in your slicer; material strength and printer supports are not tested.",
    );
  if (options.readyToPrint && !thicknessCheck?.passed)
    warnings.push(
      "The 1 mm thickness check did not pass. This mesh is not ready to print. Increase the print size, or use a finer grid.",
    );
  mesh.report = {
    inputSplats: table.count,
    sampledSplats: sampled,
    triangles: mesh.indices.length / 3,
    vertices: mesh.positions.length / 3,
    resolution,
    surfaceResolution: size,
    budgetMethod: "grid resampling",
    level,
    units,
    readyToPrint: !!options.readyToPrint,
    printable:
      !!options.readyToPrint &&
      topology.watertight &&
      topology.manifold &&
      topology.volume > 0 &&
      !!thicknessCheck?.passed,
    thicknessEstimateMm: options.readyToPrint
      ? (2 * radius * printSize) / (resolution - 8) / Math.sqrt(3)
      : null,
    thicknessVerified: false,
    thicknessCheck,
    printSize: options.readyToPrint ? printSize : null,
    printTransform,
    topology,
    warnings,
    removedTriangles: mesh.removed,
    work,
    sparseBricks: field.bricks.size,
    // Typed buffers only; this is deliberately not presented as peak memory.
    // Transient arrays, maps, decoder memory, and V8 need independent profiling.
    bufferBytesEstimate:
      field.bricks.size * 8192 +
      resolution ** 3 * (options.readyToPrint ? 14 : 4) +
      mesh.positions.length * 20 +
      mesh.indices.length * 12,
    elapsedMs: performance.now() - started,
  };
  onProgress(1, "Mesh ready.");
  return mesh;
}
