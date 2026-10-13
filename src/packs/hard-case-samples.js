// Task 57: AI-made hard-case samples, loaded only when a picker choice asks for them.
// This additive registry hook keeps the files owned by tasks 53 and 54 untouched.
import { HARD_CASE_PICTURES } from "./hard-case-pictures.js";

const CREDITS = "https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md";
export const HARD_CASE_GROUP = "AI-made by the owner: Hard cases";
export const HARD_CASE_SAMPLES = HARD_CASE_PICTURES.map(({ prompt, file, name, category }) => ({
  id: file,
  dir: "hard-cases",
  file,
  ext: "jpg",
  prompt,
  category,
  ai: true,
  group: HARD_CASE_GROUP,
  label: `${name} (AI-made)`,
  title: `${name}, an AI-made picture (prompt ${prompt}; ${category})`,
  author: "Ryan, the owner of Splashery (made with an AI image tool)",
  source: CREDITS,
  license: "AI-made by the owner",
  licenseUrl: CREDITS,
}));

export function addHardCaseSamples(pack) {
  const recipe = pack.RECIPES["photo-3d"];
  const choices = recipe.options.find((o) => o.key === "source").choices;
  const known = new Set(pack.ALL_SAMPLES.map((s) => s.id));
  const additions = HARD_CASE_SAMPLES.filter((s) => !known.has(s.id));
  pack.ALL_SAMPLES.push(...additions);
  const custom = choices.findIndex((c) => c.id === "custom");
  choices.splice(
    custom < 0 ? choices.length : custom,
    0,
    ...additions.map(({ id, label, group }) => ({ id, label, group })),
  );
  recipe.credits.push(
    ...additions.map(({ label, title, source, author, license, licenseUrl }) => ({
      label,
      title,
      source,
      author,
      license,
      licenseUrl,
    })),
  );
}
