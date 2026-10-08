// Dot samples (lane Dot samples, prefix dsm): the AI-made pictures that ship as Photo to 3D samples.
// The owner made them with his own AI image tool (the "Dot" prompt pack, D01 to D40; 30 of the 40
// are here) and they are labeled AI-made beside them: in the picker's group name, in each label
// and in the credit. They are never real captures or real places (CLAUDE.md, "AI-made samples").
// Each is assets/toys/photo-3d/ai/<id>.jpg with its depth map <id>.depth (tools/dsm-depth.mjs).

const CREDITS = "https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md";

// [prompt id, file id, name, group]
const DOTS = [
  ["D01", "train", "Train on a viaduct", "Miniatures and toy worlds"],
  ["D03", "oasis", "Desert oasis", "Miniatures and toy worlds"],
  ["D04", "castle", "Castle on a lake", "Miniatures and toy worlds"],
  ["D05", "cove", "Fishing cove", "Miniatures and toy worlds"],
  ["D34", "harbor", "Toy harbor", "Miniatures and toy worlds"],
  ["D36", "paper-valley", "Paper valley", "Miniatures and toy worlds"],
  ["D37", "farm", "Felt farm", "Miniatures and toy worlds"],
  ["D02", "treehouses", "Treehouse village", "Miniatures and toy worlds"],
  ["D06", "library", "Long library", "Rooms and corridors"],
  ["D07", "workshop", "Woodworking shop", "Rooms and corridors"],
  ["D08", "cloister", "Stone cloister", "Rooms and corridors"],
  ["D10", "greenhouse", "Greenhouse", "Rooms and corridors"],
  ["D14", "attic", "Attic", "Rooms and corridors"],
  ["D16", "bamboo", "Bamboo path", "Rooms and corridors"],
  ["D11", "terraces", "Rice terraces", "Big views"],
  ["D13", "canyon", "Canyon at sunset", "Big views"],
  ["D17", "arch", "Stone arch", "Big views"],
  ["D19", "fallen-log", "Forest and fallen log", "Big views"],
  ["D20", "alpine-lake", "Alpine lake", "Big views"],
  ["D30", "ice-falls", "Frozen waterfall", "Big views"],
  ["D32", "floating-isles", "Floating islands", "Big views"],
  ["D38", "wave", "Glass wave", "Big views"],
  ["D21", "explorer-desk", "Explorer's desk", "Close-ups"],
  ["D22", "watchmaker", "Watchmaker's bench", "Close-ups"],
  ["D26", "dragonfly", "Dragonfly", "Close-ups"],
  ["D27", "mushrooms", "Mushrooms", "Close-ups"],
  ["D28", "market", "Fruit market", "Close-ups"],
  ["D31", "gears", "Giant gears", "Close-ups"],
  ["D40", "chess", "Chess board", "Close-ups"],
  ["D29", "book-city", "City of books", "Close-ups"],
];

export const AI_GROUP = "AI-made by the owner: ";

export const DOT_SAMPLES = DOTS.map(([prompt, id, name, group]) => ({
  id: `dot-${id}`,
  dir: "ai",
  file: id,
  ext: "jpg",
  prompt,
  ai: true,
  group: AI_GROUP + group.toLowerCase(),
  label: `${name} (AI-made)`,
  title: `${name}, an AI-made picture (prompt ${prompt})`,
  author: "Ryan, the owner of Splashery (made with an AI image tool)",
  source: CREDITS,
  license: "AI-made by the owner",
  licenseUrl: CREDITS,
}));
