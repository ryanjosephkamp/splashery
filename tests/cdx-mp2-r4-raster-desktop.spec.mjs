// Keep the Operator pack selector aware of "moving-photo-3d" checks in shared helpers.
import { test } from "@playwright/test";
import { rasterCases } from "./cdx-mp2-r4-raster-cases.mjs";

for (const [title, run] of rasterCases("desktop")) test(title, run);
