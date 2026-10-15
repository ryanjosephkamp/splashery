
@group(0) @binding(0) var<storage, read> tileStart: array<u32>;
@group(0) @binding(1) var<storage, read> tileCursor: array<u32>;
@group(0) @binding(2) var<storage, read_write> entries: array<u32>;

fn greater(a: u32, b: u32) -> bool {
  let ak = entries[2u * a];
  let bk = entries[2u * b];
  return ak > bk || (ak == bk && entries[2u * a + 1u] > entries[2u * b + 1u]);
}
fn exchangePair(a: u32, b: u32) {
  let key = entries[2u * a];
  let id = entries[2u * a + 1u];
  entries[2u * a] = entries[2u * b];
  entries[2u * a + 1u] = entries[2u * b + 1u];
  entries[2u * b] = key;
  entries[2u * b + 1u] = id;
}
fn siftDown(base: u32, initialRoot: u32, size: u32) {
  var root = initialRoot;
  loop {
    let left = root * 2u + 1u;
    if (left >= size) { break; }
    var child = left;
    if (left + 1u < size && greater(base + left + 1u, base + left)) {
      child = left + 1u;
    }
    if (!greater(base + child, base + root)) { break; }
    exchangePair(base + root, base + child);
    root = child;
  }
}
@compute @workgroup_size(1)
fn main(@builtin(workgroup_id) wg: vec3u) {
  let tile = wg.x;
  let base = tileStart[tile];
  let segCap = tileStart[tile + 1u] - base;
  if (segCap == 0u) { return; }
  let count = tileCursor[tile] - base;
  // Scan guarantees count <= segCap. Do not truncate a segment or drop rows.
  // The large bitonic path materializes this exact sentinel tail.
  for (var i = count; i < segCap; i += 1u) {
    entries[2u * (base + i)] = 0xFFFFFFFFu;
    entries[2u * (base + i) + 1u] = 0xFFFFFFFFu;
  }
  if (count < 2u) { return; }
  // Build a max heap. Decrement only after checking to avoid u32 underflow.
  var parent = count / 2u;
  loop {
    if (parent == 0u) { break; }
    parent -= 1u;
    siftDown(base, parent, count);
  }
  // Move the maximum to the sorted suffix, preserving each pair atomically
  // with respect to this single invocation. Tiles own disjoint segments.
  var end = count;
  loop {
    if (end <= 1u) { break; }
    end -= 1u;
    exchangePair(base, base + end);
    siftDown(base, 0u, end);
  }
}
