// Keep the Operator pack selector aware of "qr-picture" checks in shared helpers.
// Task 101: register the unchanged cases here so failure reports point to this file.
import { test } from "@playwright/test";
import { themeCases } from "./cdx-qr-themes-cases.mjs";
for (const [title, run] of themeCases("seasons")) test(title, run);
