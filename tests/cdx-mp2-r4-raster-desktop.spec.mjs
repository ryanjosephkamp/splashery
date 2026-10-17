import { test } from "@playwright/test";
import { rasterCases } from "./cdx-mp2-r4-raster-cases.mjs";

for (const [title, run] of rasterCases("desktop")) test(title, run);
