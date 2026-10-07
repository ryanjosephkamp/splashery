// Real elements (lane Elements, prefix rel): where each element's sample photo comes from, or why
// an element has none. Every license was read on the photo's live page (October 5, 2026): Images of
// Elements' element pages say "The images are licensed under a Creative Commons Attribution 3.0
// Unported License, unless otherwise noted. Attribution by linking … to the according element
// page."; the Wikimedia Commons photos were checked on their file pages. tools/rel-samples.mjs
// turns each photo into the toy's 3D sample (cut out, with its depth from the Photo to 3D tool's
// depth model).
//
// Each entry: z -> { src: "ioe" | "commons", file, page, author, license, what, crop } or
// { none: why }. `crop` is [x0, y0, x1, y1] as fractions of the photo, for photos that show more
// than one view.

const IOE = "Images of Elements (Jumk.de Webprojects)";
const BY3 = "CC BY 3.0";
const ioe = (slug, file, what, extra = {}) => ({
  src: "ioe",
  file: `https://images-of-elements.com/${file}`,
  page: `https://images-of-elements.com/${slug}.php`,
  author: IOE,
  license: BY3,
  what,
  ...extra,
});
const commons = (title, author, license, what, extra = {}) => ({
  src: "commons",
  file: title,
  page: `https://commons.wikimedia.org/wiki/File:${title.replace(/ /g, "_")}`,
  author,
  license,
  what,
  ...extra,
});

// Why some tiles have no photo.
const SYNTHETIC =
  "No one has seen a visible amount: it has been made only a few atoms at a time, and they decay within moments.";
const TINY =
  "No photo of a real sample: only tiny amounts have ever been made, and they are fiercely radioactive.";

// prettier-ignore
export const SAMPLES = {
  1: ioe("hydrogen", "hydrogen.jpg", "Ultrapure hydrogen gas glowing in a sealed glass vial"),
  2: ioe("helium", "helium.jpg", "Ultrapure helium gas glowing in a sealed glass vial"),
  3: ioe("lithium", "lithium.jpg", "Half a gram of lithium rods kept under argon"),
  4: ioe("beryllium", "beryllium.jpg", "A bead of pure beryllium, 2.5 grams"),
  5: ioe("boron", "boron.jpg", "A piece of pure crystalline boron"),
  6: ioe("carbon", "carbon.jpg", "Ultrapure carbon as a rod of graphite"),
  7: ioe("nitrogen", "nitrogen.jpg", "Ultrapure nitrogen gas glowing in a sealed glass vial"),
  8: ioe("oxygen", "oxygen.jpg", "Ultrapure oxygen gas glowing in a sealed glass vial"),
  9: commons("Liquid fluorine.jpg", "Prof B. G. Mueller", "CC BY-SA 3.0", "Liquid fluorine in a tube in a cold bath", { crop: [0.3, 0.2, 0.58, 0.72] }),
  10: ioe("neon", "neon.jpg", "Ultrapure neon gas glowing in a sealed glass vial"),
  11: ioe("sodium", "sodium.jpg", "Half a gram of sodium under paraffin oil, with a white crust", { crop: [0.22, 0, 0.83, 1] }),
  12: ioe("magnesium", "magnesium.jpg", "An ultrapure magnesium crystal"),
  13: ioe("aluminium", "aluminium.jpg", "A ball of pure aluminum foil"),
  14: ioe("silicon", "silicon.jpg", "A chunk of ultrapure silicon"),
  15: ioe("phosphorus", "phosphorus.jpg", "Two pieces of purple phosphorus in a glass tube"),
  16: ioe("sulfur", "sulfur.jpg", "A natural sulfur crystal, 5 grams"),
  17: ioe("chlorine", "chlorine.jpg", "Liquid chlorine in a sealed tube under pressure", { crop: [0.05, 0.1, 0.65, 0.95] }),
  18: ioe("argon", "argon.jpg", "Ultrapure argon gas glowing in a sealed glass vial"),
  19: ioe("potassium", "potassium.jpg", "Pearls of potassium under paraffin oil"),
  20: ioe("calcium", "calcium.jpg", "Half a gram of calcium pieces in a glass tube"),
  21: ioe("scandium", "scandium.jpg", "Ultrapure crystalline scandium, 5 grams"),
  22: ioe("titanium", "titanium-crystal.jpg", "A titanium crystal bar, 87 grams"),
  23: ioe("vanadium", "vanadium.jpg", "Pieces of pure vanadium with a colored oxide layer"),
  24: ioe("chromium", "chromium.jpg", "A piece of pure chromium, about 20 grams"),
  25: ioe("manganese", "manganese.jpg", "Chips of ultrapure manganese"),
  26: ioe("iron", "iron.jpg", "Fragments of an iron meteorite, about 92% iron"),
  27: ioe("cobalt", "cobalt.jpg", "A fragment of a cobalt cathode"),
  28: ioe("nickel", "nickel.jpg", "A button of pure nickel, about 20 grams"),
  29: ioe("copper", "copper.jpg", "A natural copper nugget, 44 grams"),
  30: ioe("zinc", "zinc.jpg", "A piece of zinc, 30 grams"),
  31: ioe("gallium", "gallium.jpg", "Ultrapure gallium, part liquid and part crystal"),
  32: ioe("germanium", "germanium.jpg", "A chunk of polycrystalline germanium, 12 grams"),
  33: ioe("arsenic", "arsenic.jpg", "Metallic arsenic sealed under argon"),
  34: ioe("selenium", "selenium.jpg", "A disc of black, amorphous selenium"),
  35: ioe("bromine", "bromine.jpg", "Liquid bromine in a sealed glass vial"),
  36: ioe("krypton", "krypton.jpg", "Ultrapure krypton gas glowing in a sealed glass vial"),
  37: ioe("rubidium", "rubidium.jpg", "One gram of rubidium in a sealed glass ampoule"),
  38: ioe("strontium", "strontium.jpg", "Strontium with a dark nitride layer, kept under oil"),
  39: ioe("yttrium", "yttrium.jpg", "An ultrapure yttrium crystal"),
  40: ioe("zirconium", "zirconium.jpg", "Two pieces of ultrapure zirconium, 2.5 grams"),
  41: ioe("niobium", "niobium.jpg", "A bead of ultrapure niobium"),
  42: ioe("molybdenum", "molybdenum.jpg", "A crystal of pure molybdenum, about 20 grams"),
  43: commons("Technetium-sample.jpg", "Marco Cardin", "CC BY-SA 4.0", "Technetium-99 on a gold foil, sealed in a glass ampoule"),
  44: ioe("ruthenium", "ruthenium.jpg", "A piece of pure etched ruthenium, 1.8 grams"),
  45: ioe("rhodium", "s/rhodium.jpg", "A bead of pure rhodium, 1 gram"),
  46: ioe("palladium", "palladium.jpg", "A palladium crystal, about 1 gram"),
  47: ioe("silver", "silver.jpg", "A piece of pure silver, about 1 gram"),
  48: ioe("cadmium", "cadmium.jpg", "Pieces of pure cadmium"),
  49: ioe("indium", "indium.jpg", "An ingot of indium, 40 grams"),
  50: ioe("tin", "tin.jpg", "A blob of ultrapure tin"),
  51: ioe("antimony", "antimony.jpg", "A piece of ultrapure metallic antimony"),
  52: ioe("tellurium", "tellurium.jpg", "A disc of metallic tellurium, 3.5 cm across"),
  53: ioe("iodine", "iodine.jpg", "Crystals of pure iodine"),
  54: ioe("xenon", "xenon.jpg", "Ultrapure xenon gas glowing in a sealed glass vial"),
  55: ioe("caesium", "caesium.jpg", "One gram of cesium in a sealed glass ampoule", { crop: [0, 0, 1, 0.24] }),
  56: ioe("barium", "barium.jpg", "Barium with a gray oxide layer, under argon"),
  57: ioe("lanthanum", "lanthanum.jpg", "Pure lanthanum, 1.5 grams, in a glass tube"),
  58: ioe("cerium", "cerium.jpg", "Ultrapure cerium under argon, 1.5 grams"),
  59: ioe("praseodymium", "praseodymium.jpg", "Ultrapure praseodymium pieces under argon"),
  60: ioe("neodymium", "neodymium.jpg", "Ultrapure neodymium under argon, 5 grams"),
  61: commons("Promethium Metal Buttons.png", "E. J. Wheelwright, U.S. Atomic Energy Commission", "Public domain", "The first two buttons of promethium-147 metal (beside a coin, cropped out here)", { crop: [0, 0, 1, 0.6] }),
  62: ioe("samarium", "samarium.jpg", "Ultrapure samarium, 2 grams, in a glass tube"),
  63: ioe("europium", "europium.jpg", "A strongly oxidized piece of europium, 1 gram"),
  64: ioe("gadolinium", "gadolinium.jpg", "Ultrapure gadolinium, 12 grams"),
  65: ioe("terbium", "terbium.jpg", "Pure terbium, 3 grams"),
  66: ioe("dysprosium", "dysprosium-2.jpg", "Dendrites of ultrapure dysprosium"),
  67: ioe("holmium", "holmium.jpg", "Ultrapure holmium, 17 grams"),
  68: ioe("erbium", "erbium.jpg", "Ultrapure erbium, 25 grams"),
  69: ioe("thulium", "thulium.jpg", "Ultrapure crystalline thulium, 22 grams"),
  70: ioe("ytterbium", "ytterbium.jpg", "Ultrapure ytterbium, 2 grams"),
  71: ioe("lutetium", "lutetium.jpg", "A piece of ultrapure lutetium, 3 grams"),
  72: ioe("hafnium", "hafnium.jpg", "Electrolytic hafnium, 22 grams"),
  73: ioe("tantalum", "tantalum.jpg", "Pieces of tantalum, 20 grams"),
  74: ioe("tungsten", "tungsten-rod.jpg", "A tungsten rod with an oxidized surface, 80 grams"),
  75: ioe("rhenium", "rhenium-3.jpg", "An arc-melted bead of pure rhenium, 21 grams"),
  76: ioe("osmium", "osmium.jpg", "A bead of pure osmium, about 4 grams"),
  77: ioe("iridium", "iridium.jpg", "Pieces of pure iridium, 1 gram"),
  78: ioe("platinum", "platinum.jpg", "Two ultrapure platinum crystals"),
  79: ioe("gold", "gold.jpg", "Leaves of ultrapure gold, 0.5 to 1 cm long"),
  80: ioe("mercury", "hydrargyrum.jpg", "Six grams of liquid mercury in a dish"),
  81: ioe("thallium", "thallium.jpg", "Pure thallium, 8 grams, sealed under argon"),
  82: ioe("lead", "lead.jpg", "A bead of ultrapure lead"),
  83: ioe("bismuth", "bismuth.jpg", "A bismuth crystal with a thin colored oxide"),
  84: { none: "No photo of a real sample: polonium is so radioactive that a visible piece heats itself and glows." },
  85: { none: "No one has seen a visible amount: astatine is the rarest natural element, and a piece would vaporize from its own heat." },
  86: { none: "No photo of a real sample: radon is a colorless radioactive gas." },
  87: { none: "No one has seen a visible amount: francium's longest-lived form lasts only 22 minutes." },
  88: commons("Radium226.jpg", "grenadier", "CC BY 3.0", "Radium plated on a tiny piece of copper foil, under a clear coat"),
  89: { none: "No openly licensed photo of a real sample was found (the known photos are all rights reserved)." },
  90: { none: "No photo of thorium metal under a license this site can use was found." },
  91: commons("Protactinium-233.jpg", "U.S. Department of Energy", "Public domain", "Protactinium-233 (the dark area) in the light of its own radiation"),
  92: commons("Depleted Uranium.jpg", "范皓程", "CC BY 4.0", "One gram of depleted uranium metal sealed in an argon-filled ampoule", { crop: [0.13, 0.37, 0.9, 0.63] }),
  93: commons("Neptunium2.jpg", "Los Alamos National Laboratory", "Public domain", "A 6 kg sphere of neptunium-237", { crop: [0.36, 0.2, 0.59, 0.52] }),
  94: commons("Plutonium3.jpg", "U.S. Department of Energy", "Public domain", "A button of plutonium metal", { crop: [0, 0.06, 0.52, 0.66] }),
  95: commons("Americium microscope.jpg", "Bionerd", "CC BY 3.0", "A small disc of americium-241 under a microscope"),
  96: { none: "No openly licensed photo of a real curium sample was found." },
  97: commons("Berkelium metal.jpg", "Oak Ridge National Laboratory, U.S. Department of Energy", "Public domain", "The first bulk berkelium ever isolated: 1.7 micrograms, 0.1 mm across"),
  98: commons("Californium.jpg", "U.S. Department of Energy", "Public domain", "A disc of californium-249 metal, about 1 mm across"),
  99: commons("EinsteiniumGlow.JPG", "R. G. Haire, U.S. Department of Energy", "Public domain", "About 300 micrograms of einsteinium-253, glowing from its own radiation", { crop: [0.28, 0.08, 0.6, 1] }),
  100: { none: TINY },
  101: { none: SYNTHETIC },
  102: { none: SYNTHETIC },
  103: { none: SYNTHETIC },
};
for (let z = 104; z <= 118; z++) SAMPLES[z] = { none: SYNTHETIC };

export const LICENSE_URL = {
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "Public domain": "https://creativecommons.org/publicdomain/mark/1.0/",
};

// Stand-in pictures (the owner's plan of October 5, 2026) for the elements with no photo of a real
// sample: the person, place or flag the element is named for, or a mineral or object that holds
// traces of it. A portrait is shown flat and in black and white, a flag as waving cloth, a coat
// of arms cut out by its own outline. Each license was checked on its Wikimedia Commons file page.
// z -> { kind: "portrait" | "flag" | "arms" | "photo", src, file, page, author, license, what, crop }
// prettier-ignore
export const STANDINS = {
  84: {"kind":"flag","src":"commons","file":"Flag of Poland.svg","page":"https://commons.wikimedia.org/wiki/File:Flag_of_Poland.svg","author":"Wikimedia Commons contributors","license":"Public domain","what":"The flag of Poland, Marie Curie's homeland, for which polonium is named"},
  85: {"kind":"photo","src":"commons","file":"Autunite-20885.jpg","page":"https://commons.wikimedia.org/wiki/File:Autunite-20885.jpg","author":"Robert M. Lavinsky (iRocks.com)","license":"CC BY-SA 3.0","what":"Autunite, a uranium mineral that holds tiny traces of astatine"},
  86: {"kind":"photo","src":"commons","file":"Granite 5 (48674315157).jpg","page":"https://commons.wikimedia.org/wiki/File:Granite_5_%2848674315157%29.jpg","author":"James St. John","license":"CC BY 2.0","what":"A block of granite; its uranium and thorium traces give off radon gas"},
  87: {"kind":"photo","src":"commons","file":"Thorite-288916.jpg","page":"https://commons.wikimedia.org/wiki/File:Thorite-288916.jpg","author":"Robert M. Lavinsky (iRocks.com)","license":"CC BY-SA 3.0","what":"A thorite crystal, a thorium mineral that holds trace francium","crop":[0,0,1,0.85]},
  104: {"kind":"portrait","src":"commons","file":"Ernest Rutherford LOC.jpg","page":"https://commons.wikimedia.org/wiki/File:Ernest_Rutherford_LOC.jpg","author":"George Grantham Bain Collection (Library of Congress)","license":"Public domain","what":"Ernest Rutherford, for whom rutherfordium is named"},
  105: {"kind":"arms","src":"commons","file":"Coat of arms of Dubna.svg","page":"https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Dubna.svg","author":"City of Dubna","license":"Public domain","what":"The coat of arms of Dubna, the Russian science city for which dubnium is named"},
  106: {"kind":"portrait","src":"commons","file":"Glenn Seaborg - 1964.jpg","page":"https://commons.wikimedia.org/wiki/File:Glenn_Seaborg_-_1964.jpg","author":"U.S. Atomic Energy Commission","license":"Public domain","what":"Glenn T. Seaborg, for whom seaborgium is named"},
  107: {"kind":"portrait","src":"commons","file":"Niels Bohr.jpg","page":"https://commons.wikimedia.org/wiki/File:Niels_Bohr.jpg","author":"AB Lagrelius & Westphal","license":"Public domain","what":"Niels Bohr, for whom bohrium is named"},
  108: {"kind":"arms","src":"commons","file":"Coat of arms of Hesse.svg","page":"https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Hesse.svg","author":"State of Hesse","license":"Public domain","what":"The coat of arms of Hesse, the German state for which hassium is named"},
  109: {"kind":"portrait","src":"commons","file":"Lise Meitner NatGeo.jpg","page":"https://commons.wikimedia.org/wiki/File:Lise_Meitner_NatGeo.jpg","author":"Harris & Ewing","license":"Public domain","what":"Lise Meitner, for whom meitnerium is named","crop":[0.12,0.04,0.88,0.6]},
  110: {"kind":"arms","src":"commons","file":"Wappen Darmstadt.svg","page":"https://commons.wikimedia.org/wiki/File:Wappen_Darmstadt.svg","author":"City of Darmstadt (Hessisches Staatsarchiv)","license":"Public domain","what":"The coat of arms of Darmstadt, the city for which darmstadtium is named"},
  111: {"kind":"portrait","src":"commons","file":"Roentgen2.jpg","page":"https://commons.wikimedia.org/wiki/File:Roentgen2.jpg","author":"Unknown photographer","license":"Public domain","what":"Wilhelm Röntgen, for whom roentgenium is named"},
  112: {"kind":"portrait","src":"commons","file":"Nikolaus Kopernikus.jpg","page":"https://commons.wikimedia.org/wiki/File:Nikolaus_Kopernikus.jpg","author":"Unknown painter (Toruń Town Hall portrait, c. 1580)","license":"Public domain","what":"Nicolaus Copernicus, for whom copernicium is named"},
  113: {"kind":"flag","src":"commons","file":"Flag of Japan.svg","page":"https://commons.wikimedia.org/wiki/File:Flag_of_Japan.svg","author":"Government of Japan","license":"Public domain","what":"The flag of Japan; nihonium is named for Nihon, Japan"},
  114: {"kind":"portrait","src":"commons","file":"RUSMARKA-1660 (cropped).jpg","page":"https://commons.wikimedia.org/wiki/File:RUSMARKA-1660_%28cropped%29.jpg","author":"Russian Post (Marka); designer A. Povarikhin","license":"Public domain","what":"Georgy Flerov on a 2013 stamp; flerovium is named for his lab","crop":[0.08,0.1,0.95,1]},
  115: {"kind":"flag","src":"commons","file":"Flag of Moscow, Russia.svg","page":"https://commons.wikimedia.org/wiki/File:Flag_of_Moscow%2C_Russia.svg","author":"City of Moscow","license":"Public domain","what":"The flag of Moscow; moscovium is named for the Moscow region"},
  116: {"kind":"photo","src":"commons","file":"Downtown Livermore California.jpg","page":"https://commons.wikimedia.org/wiki/File:Downtown_Livermore_California.jpg","author":"LPS.1","license":"CC0","what":"Downtown Livermore, California, home of the lab that livermorium is named for"},
  117: {"kind":"flag","src":"commons","file":"Flag of Tennessee.svg","page":"https://commons.wikimedia.org/wiki/File:Flag_of_Tennessee.svg","author":"State of Tennessee; drawn by -xfi-","license":"Public domain","what":"The flag of Tennessee, the state for which tennessine is named"},
  118: {"kind":"portrait","src":"commons","file":"Yuri Oganessian (cropped).jpg","page":"https://commons.wikimedia.org/wiki/File:Yuri_Oganessian_%28cropped%29.jpg","author":"VPRO","license":"CC BY-SA 3.0","what":"Yuri Oganessian, for whom oganesson is named"},
  89: {"kind":"photo","src":"commons","file":"Uraninite-225146.jpg","page":"https://commons.wikimedia.org/wiki/File:Uraninite-225146.jpg","author":"Robert M. Lavinsky (iRocks.com)","license":"CC BY-SA 3.0","what":"Uraninite crystals, a uranium ore that holds trace actinium"},
  90: {"kind":"photo","src":"commons","file":"Thorianite-729924.jpg","page":"https://commons.wikimedia.org/wiki/File:Thorianite-729924.jpg","author":"Kelly Nash","license":"CC BY 3.0","what":"A thorianite crystal, a thorium oxide mineral (Smithsonian collection)","crop":[0.25,0.08,0.78,0.62]},
  96: {"kind":"portrait","src":"commons","file":"Marie Curie c1920.jpg","page":"https://commons.wikimedia.org/wiki/File:Marie_Curie_c1920.jpg","author":"Henri Manuel","license":"Public domain","what":"Marie Curie; curium is named for her and Pierre Curie"},
  100: {"kind":"portrait","src":"commons","file":"Enrico Fermi 1943-49.jpg","page":"https://commons.wikimedia.org/wiki/File:Enrico_Fermi_1943-49.jpg","author":"U.S. Department of Energy","license":"Public domain","what":"Enrico Fermi, for whom fermium is named","crop":[0.15,0,0.9,0.62]},
  101: {"kind":"portrait","src":"commons","file":"DIMendeleevCab.jpg","page":"https://commons.wikimedia.org/wiki/File:DIMendeleevCab.jpg","author":"Unknown photographer","license":"Public domain","what":"Dmitri Mendeleev, for whom mendelevium is named","crop":[0.35,0.1,1,0.75]},
  102: {"kind":"portrait","src":"commons","file":"AlfredNobel2.jpg","page":"https://commons.wikimedia.org/wiki/File:AlfredNobel2.jpg","author":"Unknown photographer","license":"Public domain","what":"Alfred Nobel, for whom nobelium is named"},
  103: {"kind":"portrait","src":"commons","file":"Ernest Lawrence.jpg","page":"https://commons.wikimedia.org/wiki/File:Ernest_Lawrence.jpg","author":"Nobel Foundation","license":"Public domain","what":"Ernest O. Lawrence, for whom lawrencium is named"},
};

// What a tile shows: the sample photo, or the stand-in picture (null for neither).
export const pictureOf = (z) => (SAMPLES[z]?.none ? STANDINS[z] || null : SAMPLES[z]);

// How deep a picture's relief is, against a sample's: portraits and flags stay nearly flat.
export const reliefOf = (z) => ({ portrait: 0.22, flag: 0.35, arms: 0.3 })[pictureOf(z)?.kind] ?? 1;

// The elements that have a sample photo, in order.
export const WITH_PHOTO = Object.keys(SAMPLES)
  .map(Number)
  .filter((z) => !SAMPLES[z].none)
  .sort((a, b) => a - b);

// Every element with a picture on its tile (a sample photo or a stand-in), in order: their places
// in the tile atlas.
export const PICTURED = Object.keys(SAMPLES)
  .map(Number)
  .filter((z) => pictureOf(z))
  .sort((a, b) => a - b);
