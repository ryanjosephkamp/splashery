import fs from "node:fs/promises";
import { build } from "../refbuild-blender.mjs";
process.env.REFBLEND_SUPERVISED = "1";
try {
  const completed = await build(JSON.parse(process.argv[2]));
  await fs.writeFile(process.argv[3], JSON.stringify(completed));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
