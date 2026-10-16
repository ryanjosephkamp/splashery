// Build with Zig 0.14.1's Clang: ZIG=/path/to/zig node tools/cdx-mp2-geometry-build.mjs
import { execFileSync } from "node:child_process";
execFileSync(
  process.env.ZIG || "zig",
  [
    "cc",
    "-target",
    "wasm32-freestanding",
    "-O3",
    "-msimd128",
    "-ffp-contract=off",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export=__heap_base",
    "-Wl,--export-memory",
    "-Wl,-z,stack-size=65536",
    "tools/cdx-mp2-geometry.c",
    "-o",
    "assets/toys/moving-photo-3d/clip-geometry.wasm",
  ],
  { stdio: "inherit" },
);
