// Lane QR craft: the sample pictures for Picture QR. They are the Photo to 3D
// toy's CC0 samples (tools/assets.json, "photoSamples"), used from where they
// already are, loaded only when picked.

// Lane QR r4 (the owner's note of October 9, 2026: "maybe we should just choose a different
// background photo"): four of the owner's AI-made Studio pictures (src/packs/dot-samples.js;
// CREDITS.md, "AI-made Studio samples") come first. Their big, bold shapes stay clear in a
// halftone. They are labeled AI-made beside them, in the picker and in the credit.
const AI = (id, name, prompt) => ({ id: `ai-${id}`, label: `${name} (AI-made)`, file: `assets/toys/photo-3d/ai/${id}.jpg`, author: "Ryan, the owner of Splashery (made with an AI image tool)", page: "https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md", ai: true, prompt }); // prettier-ignore

export const SAMPLES = [
  AI("farm", "Felt farm", "D37"),
  AI("wave", "Glass wave", "D38"),
  AI("mushrooms", "Mushrooms", "D27"),
  AI("arch", "Stone arch", "D17"),
  { id: "wildflowers", label: "Wildflowers", file: "assets/toys/photo-3d/wildflowers.jpg", author: "PookieFugglestein", page: "https://commons.wikimedia.org/wiki/File:Wildflowers_in_foreground.JPG" }, // prettier-ignore
  { id: "still-life", label: "Still life with cheese (a painting)", file: "assets/toys/photo-3d/still-life.jpg", author: "Antoine Vollon (Metropolitan Museum of Art Open Access)", page: "https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg" }, // prettier-ignore
  { id: "spiral-stairs", label: "A spiral staircase", file: "assets/toys/photo-3d/spiral-stairs.jpg", author: "Jorge Mendoza", page: "https://commons.wikimedia.org/wiki/File:Spiral_Staircase,_Keck_Center_(U.S._National_Academies).jpg" }, // prettier-ignore
  { id: "forest", label: "A forest path", file: "assets/toys/photo-3d/forest.jpg", author: "Seaq68 (from Pixabay, 2017)", page: "https://commons.wikimedia.org/wiki/File:Forest_Away_Path.jpg" }, // prettier-ignore
];
export const sampleById = (id) => SAMPLES.find((s) => s.id === id) || null;
