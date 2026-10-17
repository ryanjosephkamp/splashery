// Reuse Worlds' character builder off the UI thread; no copied character art.
import { buildCharacter } from "../worlds/character.js";
self.onmessage = ({ data: { count } }) => {
  try {
    const parts = buildCharacter(
      { skin: "#c99069", hair: "#3b302d", shirt: "#527c85", trousers: "#35434a", shoes: "#ddd5bd" },
      { count, seed: 115 },
    );
    const transfers = [];
    for (const b of Object.values(parts))
      for (const key of ["pos", "scale", "rot", "color"]) transfers.push(b[key].buffer);
    self.postMessage({ parts }, transfers);
  } catch (err) {
    self.postMessage({ error: err.message || String(err) });
  }
};
