// Keep the Operator pack selector aware of "qr-picture" checks in shared helpers.
// Task 101: register the unchanged cases here so failure reports point to this file.
import { test } from "@playwright/test";
import { pictureCases } from "./cdx-pics-cases.mjs";
for (const [title, run] of pictureCases(2)) test(title, run);
