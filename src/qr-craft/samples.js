// Lane QR craft: the sample pictures for Picture QR. They are the Photo to 3D
// toy's CC0 samples (tools/assets.json, "photoSamples"), used from where they
// already are, loaded only when picked.

export const SAMPLES = [
  { id: "wildflowers", label: "Wildflowers", file: "assets/toys/photo-3d/wildflowers.jpg", author: "PookieFugglestein", page: "https://commons.wikimedia.org/wiki/File:Wildflowers_in_foreground.JPG" }, // prettier-ignore
  { id: "still-life", label: "Still life with cheese (a painting)", file: "assets/toys/photo-3d/still-life.jpg", author: "Antoine Vollon (Metropolitan Museum of Art Open Access)", page: "https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg" }, // prettier-ignore
  { id: "spiral-stairs", label: "A spiral staircase", file: "assets/toys/photo-3d/spiral-stairs.jpg", author: "Jorge Mendoza", page: "https://commons.wikimedia.org/wiki/File:Spiral_Staircase,_Keck_Center_(U.S._National_Academies).jpg" }, // prettier-ignore
  { id: "forest", label: "A forest path", file: "assets/toys/photo-3d/forest.jpg", author: "Seaq68 (from Pixabay, 2017)", page: "https://commons.wikimedia.org/wiki/File:Forest_Away_Path.jpg" }, // prettier-ignore
];
export const sampleById = (id) => SAMPLES.find((s) => s.id === id) || null;
