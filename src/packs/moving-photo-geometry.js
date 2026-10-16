// Clip-only acceleration of the unchanged solid-cell construction. The module
// has no imports, runtime, threads, or network access; its source and build
// command are tools/cdx-mp2-geometry.c and tools/cdx-mp2-geometry-build.mjs.
let ready;
export function surfaceDepth(field) {
  const values = new Float32Array(field.soft.length / 4);
  for (let i = 0; i < values.length; i++) values[i] = field.soft[i * 4];
  return values;
}

// Classify the existing grid triangles before drawing. The old fragment
// shader computed these same edge and slope cuts at every covered pixel.
// Supporting observed cells are needed beside those cuts and at sub-cell
// depth features, rather than throughout a conservative gradient square.
export function drawFields(field, cellCount, cols, rows) {
  const { w, h, soft, heights, ids } = field,
    stride = cols + 1;
  const output = new Uint32Array(cols * rows * 6);
  const reach = new Int32Array((w + 1) * (h + 1)),
    pitch = w + 1;
  let n = 0;
  const cut = (a, b, c, slope) =>
    soft[a * 4 + 2] > 0.05 || soft[b * 4 + 2] > 0.05 || soft[c * 4 + 2] > 0.05 || slope > 0.05;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const a = y * stride + x,
        b = a + 1,
        c = a + stride,
        d = c + 1;
      const da = soft[a * 4],
        db = soft[b * 4],
        dc = soft[c * 4],
        dd = soft[d * 4];
      const inside = x >= 6 && y >= 6 && x < cols - 6 && y < rows - 6;
      let one, two;
      if ((x + y) & 1) {
        one = inside && cut(a, c, b, Math.abs(db - da) + Math.abs(dc - da));
        two = inside && cut(b, c, d, Math.abs(dd - dc) + Math.abs(dd - db));
        if (!one) {
          output[n++] = a;
          output[n++] = c;
          output[n++] = b;
        }
        if (!two) {
          output[n++] = b;
          output[n++] = c;
          output[n++] = d;
        }
      } else {
        one = inside && cut(a, c, d, Math.abs(dc - da) + Math.abs(dd - dc));
        two = inside && cut(a, d, b, Math.abs(db - da) + Math.abs(dd - db));
        if (!one) {
          output[n++] = a;
          output[n++] = c;
          output[n++] = d;
        }
        if (!two) {
          output[n++] = a;
          output[n++] = d;
          output[n++] = b;
        }
      }
      if (one || two) {
        // Native lower curves can reach beyond the cut triangle's grid
        // footprint. Keep four supporting cells so those joins stay closed.
        const x0 = Math.max(0, Math.floor((x * w) / cols) - 4),
          x1 = Math.min(w, Math.ceil(((x + 1) * w) / cols) + 4);
        const y0 = Math.max(0, Math.floor((y * h) / rows) - 4),
          y1 = Math.min(h, Math.ceil(((y + 1) * h) / rows) + 4);
        reach[y0 * pitch + x0]++;
        reach[y0 * pitch + x1]--;
        reach[y1 * pitch + x0]--;
        reach[y1 * pitch + x1]++;
      }
    }
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      const at = y * pitch + x;
      row += reach[at];
      reach[at] = row + (y ? reach[at - pitch] : 0);
    }
  }
  let kept = 0;
  for (let k = 0; k < cellCount; k++) {
    const id = ids[k],
      x = id % w,
      y = Math.floor(id / w);
    let needed = reach[y * pitch + x] > 0 || Math.min(x, y, w - 1 - x, h - 1 - y) <= 1;
    if (!needed) {
      const u = ((x + 0.5) * cols) / w,
        v = ((y + 0.5) * rows) / h;
      const gx = Math.min(cols - 1, Math.floor(u)),
        gy = Math.min(rows - 1, Math.floor(v));
      const fx = u - gx,
        fy = v - gy,
        a = gy * stride + gx;
      const da = soft[a * 4],
        db = soft[(a + 1) * 4],
        dc = soft[(a + stride) * 4],
        dd = soft[(a + stride + 1) * 4];
      const surface =
        (gx + gy) & 1
          ? fx + fy <= 1
            ? da + fx * (db - da) + fy * (dc - da)
            : dd + (1 - fx) * (dc - dd) + (1 - fy) * (db - dd)
          : fy >= fx
            ? da + fx * (dd - dc) + fy * (dc - da)
            : da + fx * (db - da) + fy * (dd - db);
      needed = Math.abs(heights[id] - surface) > 0.025;
    }
    if (needed) ids[kept++] = id;
  }
  return {
    indices: planarIndices(field, output.subarray(0, n), cols, rows),
    instances: instancePlanes(field, kept),
    cells: kept,
  };
}

// Retriangulate exactly planar, uncut grid tiles. Every original boundary
// vertex remains, so adjacent curved tiles meet without a T-junction. The
// affine depth at every grid vertex must match exactly; no error allowance,
// depth smoothing, color resampling, or reduced silhouette is introduced.
function planarIndices(field, indices, cols, rows) {
  const stride = cols + 1,
    depth = field.soft;
  const present = new Uint8Array(cols * rows),
    used = new Uint8Array(cols * rows);
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at],
      b = indices[at + 1],
      c = indices[at + 2];
    const x = Math.min(a % stride, b % stride, c % stride);
    const y = Math.min(Math.floor(a / stride), Math.floor(b / stride), Math.floor(c / stride));
    present[y * cols + x]++;
  }
  const result = new Uint32Array(indices.length);
  let n = 0;
  for (const size of [16, 8, 4])
    for (let y = 0; y + size <= rows; y += size) {
      for (let x = 0; x + size <= cols; x += size) {
        const first = y * stride + x,
          base = depth[first * 4];
        const gx = (depth[(first + size) * 4] - base) / size;
        const gy = (depth[(first + size * stride) * 4] - base) / size;
        let planar = true;
        for (let j = 0; j < size && planar; j++)
          for (let i = 0; i < size; i++) {
            const at = (y + j) * cols + x + i;
            if (used[at] || present[at] !== 2) {
              planar = false;
              break;
            }
          }
        for (let j = 0; j <= size && planar; j++)
          for (let i = 0; i <= size; i++) {
            if (depth[(first + j * stride + i) * 4] !== base + gx * i + gy * j) {
              planar = false;
              break;
            }
          }
        if (!planar) continue;
        for (let j = 0; j < size; j++)
          for (let i = 0; i < size; i++) used[(y + j) * cols + x + i] = 1;
        const center = first + (size / 2) * (stride + 1),
          ring = [];
        for (let j = 0; j < size; j++) ring.push(first + j * stride);
        for (let i = 0; i < size; i++) ring.push(first + size * stride + i);
        for (let j = size; j > 0; j--) ring.push(first + j * stride + size);
        for (let i = size; i > 0; i--) ring.push(first + i);
        for (let i = 0; i < ring.length; i++) {
          result[n++] = center;
          result[n++] = ring[i];
          result[n++] = ring[(i + 1) % ring.length];
        }
      }
    }
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at],
      b = indices[at + 1],
      c = indices[at + 2];
    const x = Math.min(a % stride, b % stride, c % stride);
    const y = Math.min(Math.floor(a / stride), Math.floor(b / stride), Math.floor(c / stride));
    if (!used[y * cols + x]) {
      result[n++] = a;
      result[n++] = b;
      result[n++] = c;
    }
  }
  return result.slice(0, n);
}

// Require every Float32 association of the plane to equal the lower curve.
export function coincidentCaps(patches, floors, p) {
  for (let corner = 0; corner < 4; corner++) {
    const ax = Math.fround(patches[p + 1] * (corner & 1 ? 0.5 : -0.5));
    const ay = Math.fround(patches[p + 2] * (corner & 2 ? 0.5 : -0.5));
    const d = patches[p];
    const a = Math.fround(Math.fround(d + ax) + ay);
    const b = Math.fround(d + Math.fround(ax + ay));
    const c = Math.fround(Math.fround(d + ay) + ax);
    if (a !== b || a !== c || a !== Math.fround(d + ax + ay) || a !== floors[p + corner])
      return false;
  }
  return true;
}

// Remove only a wall covered over its whole area by an included neighboring
// solid. Their lower corner curve is shared, and both upper endpoints must
// be covered. Caps are retained unless they coincide exactly.
export function instancePlanes(field, count) {
  const { w, h, ids, patches, floors } = field;
  const xBits = Math.ceil(Math.log2(w));
  const active = (field.active ||= new Uint8Array(w * h));
  active.fill(0);
  for (let k = 0; k < count; k++) active[ids[k]] = 1;
  const masks = (field.faceMasks ||= new Uint8Array(w * h));
  let faces = 0;
  for (let k = 0; k < count; k++) {
    const id = ids[k],
      p = id * 4;
    const x = id % w,
      y = Math.floor(id / w);
    // Identical caps have identical UVs and native filtering. Keep the
    // lower cap (the later depth-tie winner), and omit the duplicate top.
    let mask = coincidentCaps(patches, floors, p) ? 32 : 33;
    for (let side = 0; side < 4; side++) {
      const horizontal = side < 2,
        direction = side % 2 === 0 ? -1 : 1;
      const nx = x + (horizontal ? direction : 0),
        ny = y + (horizontal ? 0 : direction);
      const neighbor = ny * w + nx,
        n = neighbor * 4;
      let covered = false;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && active[neighbor]) {
        const normal = horizontal ? 1 : 2,
          tangent = horizontal ? 2 : 1;
        const a = patches[p] + (patches[p + normal] * direction) / 2;
        const b = patches[n] - (patches[n + normal] * direction) / 2;
        const lo = a - patches[p + tangent] / 2,
          hi = a + patches[p + tangent] / 2;
        const nl = b - patches[n + tangent] / 2,
          nh = b + patches[n + tangent] / 2;
        covered = (lo === nl && hi === nh) || (lo < nl - 1e-6 && hi < nh - 1e-6);
      }
      const pair = side === 0 ? [0, 2] : side === 1 ? [1, 3] : side === 2 ? [0, 1] : [2, 3];
      const zero =
        patches[p + 1] === 0 &&
        patches[p + 2] === 0 &&
        floors[p + pair[0]] === patches[p] &&
        floors[p + pair[1]] === patches[p];
      if (!covered && !zero) mask |= 1 << (side + 1);
    }
    masks[id] = mask;
    for (let face = 0; face < 6; face++) faces += (mask >> face) & 1;
  }
  const values = new Float32Array(faces * 8),
    codes = new Uint32Array(values.buffer);
  let index = 0;
  // Adjacent instances share a face orientation, keeping the vertex shader's
  // side selection coherent across a GPU batch. Only draw order changes.
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < count; k++) {
      const id = ids[k],
        p = id * 4;
      if (!(masks[id] & (1 << face))) continue;
      const at = index++ * 8;
      values[at] = patches[p];
      values[at + 1] = patches[p + 1];
      values[at + 2] = patches[p + 2];
      // X and Y share 24 bits; the bounded clip area needs at most 21.
      // A marker keeps the word a normal finite float, including face zero.
      codes[at + 3] = 0x08000000 | (id % w) | (Math.floor(id / w) << xBits) | (face << 24);
      for (let c = 0; c < 4; c++) values[at + 4 + c] = floors[p + c];
    }
  }
  return values;
}
// Index the shared lower curve and upper planes whose Float32 result is
// unambiguous. Keep all outer cells and ambiguous upper planes as quads.
// Each indexed cap preserves its original two triangles and native UVs.
export function indexClipCaps(planes, w, h) {
  const codes = new Uint32Array(planes.buffer, planes.byteOffset, planes.length);
  const bits = Math.ceil(Math.log2(w)),
    mask = 2 ** bits - 1;
  const types = new Uint8Array(planes.length / 8),
    depths = new Float32Array(types.length * 4);
  let lower = 0,
    upper = 0;
  for (let at = 0; at < planes.length; at += 8) {
    const code = codes[at + 3],
      face = (code >>> 24) & 7;
    const x = code & mask,
      y = (code & 16777215) >>> bits,
      id = at / 8;
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;
    if (face === 5) {
      types[id] = 1;
      lower++;
    } else if (face === 0) {
      let unique = true;
      for (let k = 0; k < 4; k++) {
        const ax = Math.fround(planes[at + 1] * (k & 1 ? 0.5 : -0.5));
        const ay = Math.fround(planes[at + 2] * (k & 2 ? 0.5 : -0.5)),
          d = planes[at];
        const v = Math.fround(Math.fround(d + ax) + ay);
        if (
          v !== Math.fround(d + Math.fround(ax + ay)) ||
          v !== Math.fround(Math.fround(d + ay) + ax) ||
          v !== Math.fround(d + ax + ay)
        ) {
          unique = false;
          break;
        }
        depths[id * 4 + k] = v;
      }
      if (unique) {
        types[id] = 2;
        upper++;
      }
    }
  }
  if (!lower && !upper) return { instances: planes, caps: null, tops: null };
  const bucket = (count) => ({
    map: new Int32Array((w + 1) * (h + 1)),
    positions: new Float32Array(count * 12),
    indices: new Uint32Array(count * 6),
    vertices: 0,
    n: 0,
  });
  const caps = bucket(lower),
    tops = bucket(upper),
    buckets = [null, caps, tops];
  const instances = new Float32Array(planes.length - (lower + upper) * 8),
    corners = new Uint32Array(4);
  let n = 0;
  for (let at = 0; at < planes.length; at += 8) {
    const id = at / 8,
      type = types[id];
    if (!type) {
      for (let j = 0; j < 8; j++) instances[n++] = planes[at + j];
      continue;
    }
    const target = buckets[type],
      code = codes[at + 3],
      x = code & mask,
      y = (code & 16777215) >>> bits;
    for (let k = 0; k < 4; k++) {
      const cx = x + (k & 1),
        cy = y + (k >>> 1),
        key = cy * (w + 1) + cx;
      const depth = type === 1 ? planes[at + 4 + k] : depths[id * 4 + k];
      let vertex = target.map[key] - 1;
      if (vertex < 0 || target.positions[vertex * 3 + 2] !== depth) {
        vertex = target.vertices++;
        target.map[key] = vertex + 1;
        target.positions[vertex * 3] = cx;
        target.positions[vertex * 3 + 1] = cy;
        target.positions[vertex * 3 + 2] = depth;
      }
      corners[k] = vertex;
    }
    for (const corner of [0, 2, 1, 1, 2, 3]) target.indices[target.n++] = corners[corner];
  }
  const finish = (target) =>
    target.n
      ? { positions: target.positions.slice(0, target.vertices * 3), indices: target.indices }
      : null;
  return { instances, caps: finish(caps), tops: finish(tops) };
}

export function prepareGeometry() {
  return (ready ||= fetch(
    new URL("../../assets/toys/moving-photo-3d/clip-geometry.wasm", import.meta.url),
  )
    .then((r) => {
      if (!r.ok) throw new Error("Clip geometry unavailable");
      return r.arrayBuffer();
    })
    .then((bytes) => WebAssembly.compile(bytes)));
}

export function geometryField(module, w, h, cols, rows) {
  const { exports } = new WebAssembly.Instance(module);
  const per = w * h;
  const layout = [
    ["source", Uint8Array, per],
    ["heights", Float32Array, per],
    ["patches", Float32Array, per * 4],
    ["floors", Float32Array, per * 4],
    ["corners", Float32Array, (w + 1) * (h + 1)],
    ["soft", Float32Array, (cols + 1) * (rows + 1) * 4],
    ["ids", Float32Array, per],
    ["rowLow", Float32Array, per],
    ["rowHigh", Float32Array, per],
    ["low", Float32Array, per],
    ["high", Float32Array, per],
    ["queue", Int32Array, Math.max(w, h)],
    ["edgeX", Float64Array, (cols + 1) * 9],
    ["edgeY", Float64Array, (rows + 1) * 9],
    ["borderX", Float64Array, (cols + 1) * 15],
    ["borderY", Float64Array, (rows + 1) * 15],
    ["pixelX", Float64Array, w * 15],
    ["pixelY", Float64Array, h * 15],
  ];
  let offset = Number(exports.__heap_base.value);
  const pointers = layout.map(([, Type, length]) => {
    offset = Math.ceil(offset / Type.BYTES_PER_ELEMENT) * Type.BYTES_PER_ELEMENT;
    const start = offset;
    offset += length * Type.BYTES_PER_ELEMENT;
    return start;
  });
  const grow = Math.ceil((offset - exports.memory.buffer.byteLength) / 65536);
  if (grow > 0) exports.memory.grow(grow);
  const field = Object.fromEntries(
    layout.map(([key, Type, length], i) => [
      key,
      new Type(exports.memory.buffer, pointers[i], length),
    ]),
  );
  field.w = w;
  field.h = h;
  let lastAspect = null;
  field.compute = (data, preview, aspect) => {
    if (lastAspect !== aspect) {
      exports.maps(w, h, cols, rows, aspect, ...pointers.slice(-6));
      lastAspect = aspect;
    }
    field.source.set(data);
    return exports.geometry(w, h, cols, rows, Number(preview), aspect, ...pointers);
  };
  return field;
}

// A separate, reusable arena avoids detaching the geometry field's views
// when a larger set of face bounds needs memory. The compiled module is shared.
export function geometryRaster(module) {
  const { exports } = new WebAssembly.Instance(module);
  if (!exports.raster) return null;
  const start = Math.ceil(Number(exports.__heap_base.value) / 8) * 8;
  const dataStart = start + 20 * 8;
  let capacity = 0,
    values,
    matrix,
    error;
  return {
    pack(planes, w, h, view) {
      if (!view) return planes;
      if (capacity < planes.length || !values) {
        capacity = 2 ** Math.ceil(Math.log2(Math.max(1, planes.length)));
        const pages = Math.ceil(
          (dataStart + capacity * 4 - exports.memory.buffer.byteLength) / 65536,
        );
        if (pages > 0) exports.memory.grow(pages);
        matrix = new Float64Array(exports.memory.buffer, start, 16);
        error = new Float64Array(exports.memory.buffer, start + 16 * 8, 4);
        values = new Float32Array(exports.memory.buffer, dataStart, capacity);
      }
      matrix.set(view.matrix);
      error.set(view.error);
      values.set(planes);
      const count = exports.raster(
        planes.length / 8,
        w,
        h,
        dataStart,
        start,
        start + 16 * 8,
        view.width,
        view.height,
        view.quantum,
      );
      return values.slice(0, count * 8);
    },
  };
}

// A small lookahead, never a whole movie's geometry. Results are accepted
// only for the exact retained depth array and grid that requested them.
export function geometryCache(clip, cols, rows, aspect) {
  const entries = new Map(),
    pending = new Map();
  const limit = 24 * 1024 * 1024;
  const stats = {
    hits: 0,
    misses: 0,
    completed: 0,
    workers: 1,
    workMs: 0,
    consumed: 0,
    evictions: 0,
    roundTripMs: 0,
    aheadFrames: 1,
  };
  const frameMs = clip.delays?.length
    ? Math.max(1, Math.min(...clip.delays))
    : (clip.duration * 1000) / clip.n;
  let serial = 0,
    bytes = 0,
    latest = null,
    closed = false,
    consumed = null,
    lastRoundTrip = 0;
  const lead = () =>
    Math.min(
      clip.n - 1,
      1 +
        Math.ceil(
          (Math.max(lastRoundTrip, stats.roundTripMs) +
            (latest ? performance.now() - latest.at : 0)) /
            frameMs,
        ),
    );
  const slots = Array.from({ length: 1 }, () => ({
    worker: new Worker(new URL("./moving-photo-geometry-worker.js", import.meta.url), {
      type: "module",
    }),
    busy: false,
    failed: false,
  }));
  const pump = () => {
    if (closed || !latest || clip.transition) return;
    for (const slot of slots) {
      if (slot.failed || slot.busy) continue;
      // A slow worker cannot catch a playhead by repeatedly starting on its
      // already current frame. Aim beyond the observed round trip instead;
      // get() still accepts only the exact current depth-array identity.
      const ahead = lead();
      stats.aheadFrames = ahead;
      for (const step of new Set([ahead, ahead + 1, ahead + 2, 0, 1])) {
        const frame = (latest.frame + step) % clip.n,
          source = clip.near[frame],
          cached = entries.get(source),
          raster = latest.raster;
        if (
          !source ||
          source === consumed ||
          cached ||
          [...pending.values()].some((r) => r.source === source && r.rasterKey === raster?.key)
        )
          continue;
        const id = ++serial;
        pending.set(id, { frame, source, rasterKey: raster?.key, sentAt: performance.now() });
        slot.busy = true;
        slot.worker.postMessage({ id, source, raster });
        break;
      }
    }
  };
  for (const slot of slots) {
    slot.worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      pending.delete(data.id);
      slot.busy = false;
      if (data.error) {
        slot.failed = true;
        slot.worker.terminate();
        pump();
        return;
      }
      if (request) {
        lastRoundTrip = performance.now() - request.sentAt;
        stats.roundTripMs = stats.completed
          ? stats.roundTripMs * 0.75 + lastRoundTrip * 0.25
          : lastRoundTrip;
      }
      if (request && clip.near[request.frame] === request.source) {
        const result = { ...data, source: request.source };
        stats.completed++;
        stats.workMs += data.workMs;
        result.bytes =
          data.instances.byteLength +
          data.soft.byteLength +
          data.indices.byteLength +
          (data.raster?.instances.byteLength || 0) +
          (data.raster?.caps?.positions.byteLength || 0) +
          (data.raster?.caps?.indices.byteLength || 0) +
          (data.raster?.tops?.positions.byteLength || 0) +
          (data.raster?.tops?.indices.byteLength || 0);
        const previous = entries.get(request.source);
        if (previous) bytes -= previous.bytes;
        entries.delete(request.source);
        entries.set(request.source, result);
        bytes += result.bytes;
        while (bytes > limit && entries.size > 1) {
          const first = entries.keys().next().value;
          bytes -= entries.get(first).bytes;
          entries.delete(first);
          stats.evictions++;
        }
      }
      pump();
    };
    slot.worker.onerror = () => {
      slot.failed = true;
      slot.busy = false;
      slot.worker.terminate();
      pump();
    };
    slot.worker.postMessage({ init: true, w: clip.w, h: clip.h, cols, rows, aspect });
  }
  return {
    clip,
    aspect,
    stats,
    get active() {
      return !closed && slots.some((slot) => !slot.failed);
    },
    get(frame, source) {
      const result = entries.get(source);
      if (!result) {
        stats.misses++;
        return null;
      }
      stats.hits++;
      stats.consumed++;
      consumed = source;
      entries.delete(source);
      bytes -= result.bytes;
      return result;
    },
    ahead(frame, raster) {
      latest = { frame, raster, at: performance.now() };
      const horizon = Math.min(clip.n - 1, lead() + 2),
        useful = new Set(
          Array.from({ length: horizon + 1 }, (_, step) => clip.near[(frame + step) % clip.n]),
        );
      for (const [source, result] of entries)
        if (!useful.has(source)) {
          bytes -= result.bytes;
          entries.delete(source);
        }
      pump();
    },
    close() {
      closed = true;
      for (const slot of slots) slot.worker.terminate();
      entries.clear();
      pending.clear();
    },
  };
}

// Color guidance and geometry use one frozen decoded picture in a worker.
// The returned bitmap and depth always travel together. The playing video
// remains the sound clock; this adds no decoder and retains a synchronous
// path for previews, paused seeks, and browsers without transferable frames.
export function videoGeometryStream(clip, cols, rows, aspect, wake) {
  const video = clip.video;
  const slots = Array.from({ length: 2 }, () => ({
    worker: new Worker(new URL("./moving-photo-video-worker.js", import.meta.url), {
      type: "module",
    }),
    busy: null,
    failed: false,
  }));
  let enabled = false,
    closed = false,
    raster = null,
    waiting = null,
    serial = 0,
    lastDelivered = 0,
    callback = null;
  let delivered = false,
    lastSubmitted = -Infinity,
    lastSignal = 0,
    lastFallback = -Infinity,
    lastDecoded = -1;
  const stats = {
    workers: 2,
    framesClosed: 0,
    retired: 0,
    submitted: 0,
    completed: 0,
    delivered: 0,
    dropped: 0,
    superseded: 0,
    nativeSignals: 0,
    workerTotalMs: 0,
    phaseTotals: {},
    workerMs: [],
    phases: [],
    frameAgesMs: [],
  };
  const retire = (slot) => {
    if (slot.retired) return;
    slot.retired = true;
    clearTimeout(slot.closeTimer);
    slot.worker.terminate();
    stats.retired++;
  };
  const back = (D, i) => {
    for (let j = Math.min(i, D.n - 1); j >= 0; j--) if (D.frames[j]) return D.frames[j];
    return null;
  };
  const submit = (time) => {
    const submittedAt = performance.now();
    const D = clip.depth,
      slot = slots.find((slot) => !slot.failed && !slot.busy);
    if (!enabled || closed || !slot || !D.ms || !D.ready || video.seeking || video.readyState < 2)
      return false;
    let frame;
    try {
      // A callback can arrive after another picture has decoded. Preserve
      // this frozen picture's own native clock instead of relabeling it.
      frame = new VideoFrame(video);
      time = frame.timestamp / 1e6;
      if (!Number.isFinite(time)) throw Error("The native picture clock is unavailable");
      if (time === lastSubmitted) {
        frame.close();
        return false;
      }
      const k = Math.max(0, time * D.rate - (D.offset ?? 0.5)),
        a = Math.min(D.n - 1, Math.floor(k)),
        b = Math.min(D.n - 1, a + 1),
        A = back(D, a),
        B = back(D, b) || A;
      if (!A) {
        frame.close();
        return false;
      }
      const id = ++serial;
      slot.busy = { id, depthState: D, submittedAt };
      slot.worker.postMessage(
        {
          id,
          time,
          frame,
          raster,
          depth: { ms: D.ms, n: 4, frames: [back(D, a - 1) || A, A, B, back(D, b + 1) || B] },
          blend: k - a,
          guided: !!D.colorGuide,
        },
        [frame],
      );
      frame.close();
      frame = null;
      lastSubmitted = time;
      lastDecoded = video.getVideoPlaybackQuality?.().totalVideoFrames ?? lastDecoded;
      stats.submitted++;
      return true;
    } catch (error) {
      stats.error = error.message;
      frame?.close();
      slot.busy = null;
      slot.failed = true;
      retire(slot);
      return false;
    }
  };
  for (const slot of slots) {
    slot.worker.onmessage = ({ data }) => {
      if (data.frameClosed) stats.framesClosed++;
      const request = slot.busy;
      slot.busy = null;
      if (data.error) {
        stats.error = data.error;
        slot.failed = true;
        retire(slot);
        return;
      }
      if (!request || request.id !== data.id || closed) {
        data.bitmap?.close();
        if (closed) retire(slot);
        return;
      }
      stats.completed++;
      stats.workerTotalMs += data.workerMs;
      stats.workerMs.push(data.workerMs);
      stats.phases.push(data.phases);
      for (const [name, ms] of Object.entries(data.phases))
        stats.phaseTotals[name] = (stats.phaseTotals[name] || 0) + ms;
      if (stats.workerMs.length > 120) stats.workerMs.shift();
      if (stats.phases.length > 120) stats.phases.shift();
      if (!enabled || data.id <= lastDelivered || (waiting && data.id < waiting.id)) {
        data.bitmap.close();
        stats.dropped++;
        return;
      }
      if (waiting) {
        waiting.bitmap.close();
        stats.superseded++;
      }
      waiting = {
        ...data,
        depthState: request.depthState,
        roundTripMs: performance.now() - request.submittedAt,
      };
      wake();
    };
    slot.worker.onerror = (error) => {
      stats.error = error.message;
      slot.failed = true;
      slot.busy = null;
      retire(slot);
    };
    slot.worker.postMessage({ init: true, w: clip.w, h: clip.h, cols, rows, aspect });
  }
  const tick = (_, metadata) => {
    if (closed) return;
    stats.nativeSignals++;
    lastSignal = performance.now();
    submit(metadata.mediaTime);
    if (!closed) callback = video.requestVideoFrameCallback(tick);
  };
  if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(tick);
  return {
    clip,
    stats,
    view(value) {
      raster = value;
    },
    play() {
      const wasEnabled = enabled;
      enabled = true;
      const now = performance.now();
      const decoded = video.getVideoPlaybackQuality?.().totalVideoFrames;
      if (
        !wasEnabled ||
        (now - lastSignal > 150 && (decoded > lastDecoded || now - lastFallback >= 100))
      )
        if (submit(video.currentTime)) lastFallback = now;
      return !closed && slots.some((slot) => !slot.failed);
    },
    pause() {
      enabled = false;
      waiting?.bitmap.close();
      waiting = null;
    },
    take(time) {
      if (!waiting) return null;
      const result = waiting;
      waiting = null;
      const age = Math.abs(time - result.time);
      // Always present the newest matching picture/depth packet. When its
      // processing itself takes more than 250 ms, that fixed cutoff would
      // discard every answer forever. Allow the measured trip plus two
      // source-frame intervals, still bounded by the first-picture limit.
      const deadline = delivered
        ? Math.min(1, Math.max(0.25, result.roundTripMs / 1000 + 2 / Math.max(1, clip.fps || 24)))
        : 1;
      const frameAge = Math.min(age, Math.abs(age - clip.duration));
      if (result.depthState !== clip.depth || frameAge >= deadline) {
        result.bitmap.close();
        stats.dropped++;
        return null;
      }
      delivered = true;
      lastDelivered = result.id;
      stats.delivered++;
      stats.frameAgesMs.push(frameAge * 1000);
      if (stats.frameAgesMs.length > 120) stats.frameAgesMs.shift();
      return result;
    },
    close() {
      if (closed) return;
      enabled = false;
      closed = true;
      if (callback !== null) video.cancelVideoFrameCallback?.(callback);
      for (const slot of slots) {
        if (slot.busy && !slot.failed) {
          // Let the transferred frame close before stopping its owner.
          slot.worker.postMessage({ close: true });
          slot.closeTimer = setTimeout(() => retire(slot), 2000);
        } else retire(slot);
      }
      waiting?.bitmap.close();
      waiting = null;
    },
  };
}
