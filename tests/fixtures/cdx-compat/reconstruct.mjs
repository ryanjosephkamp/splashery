// Reconstruct task 65's additions from public repository history. Existing
// task 05 fixtures are preserved byte for byte. This is not a recovered save.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./", import.meta.url));
const COMMIT = "2734137f308d792277fed2f8135f4b6e1b9be292";
const WORLD = "9778fdea6613adead30e977794b18d0585a253f4";
const git = (...args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-compat-history-"));
try {
  for (const commit of [COMMIT, WORLD]) git("merge-base", "--is-ancestor", commit, "origin/main");
  execFileSync("tar", ["-x", "-C", tmp], { input: git("archive", COMMIT, "src") });
  fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}\n');
  const { normalizeScene } = await import(pathToFileURL(path.join(tmp, "src/state.js")));
  const { TOYS } = await import(pathToFileURL(path.join(tmp, "src/toys.js")));
  const { normalizeWorld } = await import(
    pathToFileURL(path.join(tmp, "src/worlds/world-file.js"))
  );
  const write = (name, data) => {
    const content = JSON.stringify(data, null, 2) + "\n";
    const target = path.join(FIX, name + ".json");
    // A regeneration may verify existing additions, never silently replace them.
    if (fs.existsSync(target)) {
      if (JSON.stringify(JSON.parse(fs.readFileSync(target))) !== JSON.stringify(data))
        throw new Error(`Existing fixture differs: ${name}`);
    } else fs.writeFileSync(target, content);
  };
  let seed = 6500;
  const sceneCase = (name, toy, extra = {}, metadata = {}) => {
    const scene = {
      version: 3,
      createdAt: "2026-10-12T18:50:40.000Z",
      seed: ++seed,
      toy: { kind: "builtin", ...toy },
      autoplay: { turntable: false, effect: "none" },
      ...extra,
    };
    const expected = normalizeScene(scene, "weak");
    delete expected.createdAt;
    const prefix = seed % 2 ? "d." : "j.";
    const bytes = Buffer.from(JSON.stringify(scene));
    const file = metadata.file || "src/toys.js";
    const description =
      metadata.description ||
      `Reconstructed scene using the historical ${toy.id} shelf id and schema defaults; seed and timestamp pinned.`;
    const category = TOYS.find((t) => t.id === toy.id)?.category;
    write(name, {
      $comment: `Source: ${COMMIT}:${file}. ${description}`,
      $compat: {
        commit: COMMIT,
        file,
        description,
        origin: "historical reconstruction",
        reconstruction: "task 65, October 14, 2026",
        ...(category && { category }),
        hash: prefix + (prefix === "d." ? deflateRawSync(bytes) : bytes).toString("base64url"),
        expected,
        ...metadata,
      },
      ...scene,
    });
  };
  const shelves = [
    ["balls", "basketball"],
    ["tiny", "virus"],
    ["atoms", "orbital"],
    ["gems", "diamond"],
    ["nature", "oak"],
    ["weather", "campfire"],
    ["toys", "bricks"],
    ["clothing", "hoodie"],
    ["animals", "jellyfish"],
    ["computing", "perceptron"],
    ["pictures", "picture-lab"],
    ["studio", "photo-3d"],
    ["lab", "splat-field"],
    ["arcade", "shardball"],
    ["science", "contour-lab"],
    ["imaging", "airport-xray"],
    ["geo", "tide-harbor"],
    ["holidays", "snowman"],
    ["music", "drum"],
    ["vehicles", "rocket"],
    ["landmarks", "eiffel-tower"],
  ];
  for (const [category, id] of shelves) {
    if (TOYS.find((t) => t.id === id)?.category !== category)
      throw new Error(`Missing historical shelf: ${category}`);
    sceneCase(
      `r2-shelf-${category}`,
      {
        id,
        ...(id === "photo-3d" && {
          options: { source: "forest", detail: "photo", view: "splats" },
        }),
      },
      {},
      id === "photo-3d" ? { renderView: "splats" } : {},
    );
  }
  sceneCase(
    "r2-photo-sharp",
    { id: "photo-3d", options: { source: "forest", view: "sharp", depth: 0.25 } },
    {},
    {
      file: "src/packs/photo-sharp.js",
      renderView: "sharp",
      description:
        "Reconstructed saved Sharp picture choice, sample source, and depth from the historical Photo to 3D contract.",
    },
  );
  sceneCase(
    "r2-moving-photo",
    { id: "moving-photo-3d", options: { source: "bunny", view: "splats" } },
    {},
    {
      file: "src/packs/moving-photo.js",
      renderView: "splats",
      description:
        "Reconstructed saved Moving photo sample and Splats view; original clip bytes are not embedded in a scene.",
    },
  );
  sceneCase(
    "r2-video-camera",
    { id: "video-3d", options: { source: "liberty", original: "off" } },
    {
      camera: { yaw: 0.8, pitch: 0.2, roll: 0.1, distance: 4.2, pan: [0.1, -0.1, 0.05] },
    },
    {
      file: "src/video3d/flight.js",
      description:
        "Reconstructed saved Video to 3D sample with a nondefault orbit and pan; test the downloaded camera after the real flight driver runs.",
    },
  );
  sceneCase(
    "r2-model-output",
    { id: "model-splats", options: { source: "burger" } },
    {},
    {
      file: "src/packs/studio-models.js",
      description:
        "Reconstructed saved Model to splats sample source; scene settings rebuild its sample, rather than including a GLB or PLY.",
    },
  );
  sceneCase(
    "r2-studio-file-settings",
    { id: "photo-3d", options: { source: "custom", photoName: "Fixture photo", view: "sharp" } },
    {},
    {
      file: "src/packs/photo-3d.js",
      renderView: "sharp",
      description:
        "Reconstructed own-file Photo to 3D settings in a fresh visitor context; the absent private photo is not claimed to survive or be tested.",
    },
  );
  sceneCase(
    "r2-picture-file-settings",
    { id: "picture-lab", media: { file: { name: "fixture.png", bytes: 1234 } } },
    {},
    {
      file: "src/state.js",
      embedDropsMedia: true,
      description:
        "Reconstructed picture-file metadata: the app retains the reference and warns; the embed intentionally uses the sample without the file reference.",
    },
  );
  sceneCase(
    "r2-page-figures",
    { id: "your-book", figures: [{ page: 0, box: [0.1, 0.2, 0.6, 0.55], depth: 2.5 }] },
    {},
    {
      file: "src/state.js",
      description:
        "Reconstructed historical page figure coordinates and depth from the documented scene contract.",
    },
  );
  sceneCase(
    "r2-camera-pan",
    { id: "blob" },
    {
      camera: { yaw: -0.6, pitch: 0.4, roll: 0.2, distance: 3.5, pan: [0.25, -0.3, 0.1] },
    },
    {
      file: "src/state.js",
      description:
        "Reconstructed post-pan camera contract, with off-center coordinates retained in actual downloads and reloads.",
    },
  );
  sceneCase(
    "r2-empty-v2",
    {},
    { version: 2, toy: {} },
    {
      file: "src/state.js",
      description:
        "Reconstructed empty v2 scene: defaults to the blob; this is not an empty rendered world.",
    },
  );
  sceneCase(
    "r2-unknown-toy",
    { id: "unknown-historical-toy" },
    {},
    {
      file: "src/player.js",
      builtId: "blob",
      description:
        "Reconstructed unknown toy id: keep the saved id and settings, and render the documented blob fallback.",
    },
  );
  sceneCase(
    "r2-extra-fields",
    { id: "blob", futureToyKey: "discard" },
    {
      version: 2,
      futureSceneKey: { value: true },
      look: { theme: "dark", futureLookKey: 9 },
    },
    {
      file: "src/state.js",
      description:
        "Reconstructed v2 extra-field input: discard unknown structural keys while preserving recognized settings.",
    },
  );
  const file = "worlds/test-island/world.json";
  const scene = JSON.parse(git("show", `${WORLD}:${file}`));
  write("r2-world-test-island", {
    $comment: `Source: ${WORLD}:${file}. Copied historical world file, loaded through /worlds/ and its fetched world-file route, not #s= or Load JSON.`,
    $compat: {
      commit: WORLD,
      file,
      origin: "copied world file",
      route: "world",
      description:
        "Historical Test island world file; world schema v1 is independent of scene schema v1 refusal.",
      worldId: "test-island",
      expected: normalizeWorld(scene),
    },
    ...scene,
  });
  console.log(
    "Reconstructed 32 scene additions and one copied world case; preserved all task 05 fixtures.",
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
