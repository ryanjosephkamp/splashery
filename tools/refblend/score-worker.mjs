import { readPack } from "./contract.mjs";
import { scoreLite } from "./score-lite.mjs";
const [pack, out] = process.argv.slice(2);
await scoreLite(pack, out, await readPack(pack));
