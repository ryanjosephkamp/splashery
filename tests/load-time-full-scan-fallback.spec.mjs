import { test, expect } from "@playwright/test";
import io from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

for (const id of ["sunglasses", "soda-can", "fountain-pen"])
  test(`${id} retains the original full scan at phone detail`, async () => {
    const reads = [];
    const read = io.readFile;
    io.readFile = async (file, ...args) => {
      reads.push(String(file));
      return read(file, ...args);
    };
    syncBuiltinESMExports();
    try {
      const { RECIPES } = await import(`../src/packs/real-objects.js?full-fallback-${id}`);
      await RECIPES[id].prepare({}, null, { profile: "low", count: 90000 });
      expect(reads.some((file) => file.endsWith(`/${id}.splats`))).toBe(true);
      expect(reads.some((file) => file.endsWith(`/${id}-opening.splats`))).toBe(false);
    } finally {
      io.readFile = read;
      syncBuiltinESMExports();
    }
  });
