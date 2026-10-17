// Task 101: register the unchanged cases here so failure reports point to this file.
import { test } from "@playwright/test";
import { pictureCases } from "./cdx-pics-cases.mjs";
for (const [title, run] of pictureCases(5)) test(title, run);
