// Shared by Share, the encoders, and batch export. These are session choices,
// never scene fields. Limits bound encoded output and a few working frames.
const MiB = 1024 * 1024;
const kinds = [
  { value: "effects", label: "Effect loop" },
  { value: "turntable", label: "Turntable" },
];
const shapes = [
  { value: "square", label: "Square" },
  { value: "source", label: "Match the picture" },
];
export const EXPORT_PRESETS = {
  gif: {
    kinds,
    shapes,
    frames: [48, 72, 96, 144],
    sizes: [512, 720, 1080],
    defaults: { kind: "effects", frames: 72, size: 720, shape: "square" },
    loopSeconds: 4, // One tap cycle when the recipe does not name its own duration.
  },
  video: {
    kinds,
    shapes,
    seconds: [4, 8, 15, 30],
    sizes: [720, 1080, 1440],
    fps: [30, 60],
    defaults: { kind: "effects", seconds: 8, size: 1080, fps: 30, shape: "square" },
    queueFrames: 4, // Flush at four frames: bounded codec surfaces on slow devices.
  },
  record: {
    qualities: [
      { value: "standard", label: "Standard" },
      { value: "high", label: "High" },
      { value: "max", label: "Max (computer)" },
    ],
    defaults: { quality: "high", fps: 30 },
    maxSeconds: 600, // Ten minutes; the byte budget can end a take sooner.
    standardLongSide: 1920,
    highLongSide: 2560,
    maxLongSide: 3840,
    maxMinFps: 20,
    maxSlowSeconds: 2, // End Max after sustained slow drawing.
    audioBitrate: 128_000,
    phoneBytes: 96 * MiB,
    desktopBytes: 384 * MiB, // Encoded chunks stay in memory.
    warningFraction: 0.8,
    sliceMs: 250, // Reserve multiple timeslices for the encoder's final flush.
  },
  memory: {
    phoneBytes: 192 * MiB,
    desktopBytes: 768 * MiB, // Includes output copies and render surfaces.
    workingBytesPerPixel: 32,
    paletteBytes: 12 * MiB,
  },
};
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}
freeze(EXPORT_PRESETS);

export function isPhone() {
  return (
    !!globalThis.navigator?.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent || "") ||
    (globalThis.navigator?.maxTouchPoints > 0 &&
      Math.min(globalThis.screen?.width || 9999, globalThis.screen?.height || 9999) < 1024)
  );
}

export function memoryBudget(phone = isPhone()) {
  const m = EXPORT_PRESETS.memory;
  // deviceMemory is approximate; reserve at most one eighth of reported RAM.
  return Math.min(
    phone ? m.phoneBytes : m.desktopBytes,
    ((globalThis.navigator?.deviceMemory || 8) * 1024 * MiB) / 8,
  );
}

export function exportDimensions(size, shape = "square", source = null) {
  const aspect =
    shape === "source" && source?.width > 0 && source?.height > 0
      ? source.width / source.height
      : 1;
  // Even dimensions also work with H.264's 4:2:0 chroma planes.
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return {
    width: even(aspect >= 1 ? size : size * aspect),
    height: even(aspect >= 1 ? size / aspect : size),
  };
}

export function sourcePicture(player) {
  if (!["photo-3d", "moving-photo-3d", "video-3d"].includes(player.toyInfo?.id)) return null;
  const rect = player.toyInfo.recipe?.photo?.rect?.();
  if (rect) return { width: rect[2] - rect[0], height: rect[3] - rect[1] };
  const cam = player.toyInfo?.data?.flight?.path?.at(0);
  return cam?.w && cam?.h ? { width: cam.w, height: cam.h } : null;
}

export function gifPlan({ width, height, frames, phone = isPhone() }) {
  const pixels = width * height;
  const estimatedBytes = Math.ceil(pixels * frames * 0.35); // Content dependent; shown as an estimate.
  const worstBytes = Math.ceil(pixels * frames * 1.5 + frames * 1024);
  const workingBytes =
    pixels * EXPORT_PRESETS.memory.workingBytesPerPixel + EXPORT_PRESETS.memory.paletteBytes;
  const budget = memoryBudget(phone);
  return {
    estimatedBytes,
    worstBytes,
    workingBytes,
    maxBytes: Math.floor((budget - workingBytes) / 2),
    ok: workingBytes + 2 * worstBytes <= budget,
    budget,
  };
}

export function videoBitrate(width, height, fps = 30) {
  // 12 Mb/s at 1080 square / 30 fps, proportional to pixels and frame rate.
  return Math.round(
    Math.max(
      2_000_000,
      Math.min(80_000_000, (((12_000_000 * width * height) / (1080 * 1080)) * fps) / 30),
    ),
  );
}

export function recordingPlan({
  width,
  height,
  dpr = 1,
  tierCap = 3,
  quality = EXPORT_PRESETS.record.defaults.quality,
  phone = isPhone(),
}) {
  const r = EXPORT_PRESETS.record;
  if (quality === "max" && phone)
    throw new Error("Max recording is available on computers. Choose High on this device.");
  if (!r.qualities.some((q) => q.value === quality)) throw new Error("Choose a recording quality.");
  const long = Math.max(width, height, 1);
  const ratio =
    quality === "standard"
      ? Math.min(dpr, tierCap, r.standardLongSide / long)
      : phone
        ? dpr
        : Math.max(dpr, (quality === "max" ? r.maxLongSide : r.highLongSide) / long);
  const dims = {
    width: Math.max(2, Math.round((width * ratio) / 2) * 2),
    height: Math.max(2, Math.round((height * ratio) / 2) * 2),
  };
  return {
    ...dims,
    quality,
    fps: r.defaults.fps,
    bitrate: quality === "standard" ? 8_000_000 : videoBitrate(dims.width, dims.height),
    maxBytes: Math.min(
      phone ? r.phoneBytes : r.desktopBytes,
      Math.max(
        0,
        Math.floor(
          (memoryBudget(phone) -
            dims.width * dims.height * EXPORT_PRESETS.memory.workingBytesPerPixel) /
            2,
        ),
      ),
    ),
  };
}
