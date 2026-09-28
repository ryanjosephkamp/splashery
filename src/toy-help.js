// Toy help: the short "how to play" line that shows when a toy opens, and the
// "About this toy" text in the About tab. Loaded by src/ui.js when the first
// toy opens (never on first paint), so the page stays light.
//
// One entry per shelf toy, keyed by its id (as in src/toys.js):
//
//   "puzzle-cube": {
//     howTo: "Drag across a face to turn a row or column. Tap to scramble or solve.",
//     about: "What it is and what it shows, then a fact or two.\n\nA second paragraph.",
//   },
//
// Both are optional. A toy without `howTo` gets a line built from what it has
// (its tap, a drag, typing, options: see defaultHowTo below), and one without
// `about` gets a short note that its description is still to come. Like
// src/toy-sounds.js, each lane edits only its own toys' entries.
//
// The style guide for these texts is in docs/handoff/Help.md ("Style guide").
// In short: American English; a how-to line of one or two short sentences
// (under about 90 characters), starting with what to do ("Tap", "Drag",
// "Type"); an about text of 60 to 140 words in plain words, checked against
// the toy's recipe and against a real source for every fact.

export const TOY_HELP = {
  // ---- Photoreal ----------------------------------------------------------------------
  grape: {
    howTo: "Tap it to peel back the skin.",
    about:
      "A real grape, captured from many photos and drawn with many thousands of tiny, soft splats. Grapes grow in bunches on woody vines; people eat them fresh, dry them into raisins and press them for juice.\n\nTap it and four strips of the dark skin peel back from the stem end to show the pale flesh underneath, then the skin closes again. The color of a grape is almost all in its skin: under it, the flesh of red and green grapes alike is pale and see-through.",
  },
  lantern: { howTo: "Tap to light the lantern; tap again to put it out." },
  "pencil-real": {
    howTo: "Tap it to spin it on the desk. Pick its color under Look in the Toy tab.",
  },
  "tin-can-real": {
    howTo: "Tap it to knock it into a spin. Pick its label under Look in the Toy tab.",
  },

  // ---- Space --------------------------------------------------------------------------
  moon: {
    howTo:
      "Tap to land a lunar module; tap again to pack up and lift off. Pick the flag in the Toy tab.",
  },
  star: { howTo: "Tap to run the star's life, sped up. Pick the kind of star in the Toy tab." },
  pulsar: { howTo: "Tap it to spin it up. Set its spin speed in the Toy tab." },
  "black-hole": {
    howTo: "Tap it to feed it a star.",
    about:
      "A black hole is a place where gravity is so strong that nothing that crosses its edge, the event horizon, can get out again, not even light. Gas that falls toward it swirls into a flat disk and gets hot enough to glow.\n\nTap it to feed it a star: the star spirals in faster and faster, is stretched into a streak and plunges in, and the disk flares. In 2019 astronomers showed the first picture of a black hole's shadow, at the heart of the galaxy M87, made with radio telescopes spread across the Earth.",
  },
  "spiral-galaxy": { howTo: "Tap to swirl the arms. Pick a galaxy style in the Toy tab." },

  // ---- Tiny world -----------------------------------------------------------------------
  bacterium: { howTo: "Tap it to make it divide in two. Try the Swim slider in the Toy tab." },
  neuron: { howTo: "Tap it to fire a signal. Try the Signal slider in the Toy tab." },
  paramecium: { howTo: "Tap it to swim a loop. Try the Swim slider in the Toy tab." },
  snowflake: {
    howTo: "Tap to melt it and grow a new flake. Pick the kind of crystal in the Toy tab.",
  },
  tardigrade: {
    howTo: "Tap it to make it wiggle.",
    about:
      "Tardigrades, or water bears, are tiny animals, most about half a millimeter long, with a plump body and eight stubby legs that end in claws. They live all over the world, in moss, soil, ponds and the sea.\n\nWhen their home dries out, they pull in their legs, curl into a dry little ball called a tun and wait, sometimes for years, until water brings them back. In 2007 some were even taken into space on the outside of a satellite, and a few came back alive.",
  },

  // ---- Atoms ----------------------------------------------------------------------------
  orbital: {
    howTo: "Tap it to excite the electron. Pick another orbital, or lobes, in the Toy tab.",
  },
  atom: {
    howTo: "Tap it to speed up the electrons. Pick any of 44 elements in the Toy tab.",
  },
  molecule: {
    howTo: "Tap it to heat it up. Pick a molecule, or type your own, in the Toy tab.",
    about:
      "A molecule is a group of atoms held together by chemical bonds. This one is a ball-and-stick model: each ball is an atom, colored by its element (carbon dark gray, hydrogen white, oxygen red, nitrogen blue), and each stick is a bond.\n\nIt starts as caffeine, C8H10N4O2, the stimulant in coffee and tea. The atoms always jiggle a little on their bonds, as real ones do; tap it to heat it up and they shake hard, the light hydrogens furthest, then it cools. In the Toy tab, pick another molecule, or type a name, a formula or a SMILES string (a way of writing a molecule on one line) to build your own.",
  },
  protein: {
    howTo: "Tap it to pull it apart. Pick a protein, or open your own file, in the Toy tab.",
  },
  "crystal-lattice": {
    howTo: "Tap to send a wave through it. Pick salt, diamond, graphite or ice in the Toy tab.",
  },

  // ---- Body -----------------------------------------------------------------------------
  heart: {
    howTo: "Tap it to set it racing. Set its beat, or pick a love heart, in the Toy tab.",
    about:
      "The heart is a muscle that pumps blood around the body. It has four chambers: the two atria on top fill with blood, then the two ventricles below squeeze it out, the right side to the lungs and the left side to the rest of the body.\n\nThis heart beats by itself, the atria first and then the ventricles. Tap it and it races, as it does when you run, then calms down again. A resting adult heart beats about 60 to 100 times a minute, which is about 100,000 beats a day.",
  },
  brain: { howTo: "Tap it to think. Try the Sparks slider in the Toy tab." },
  eye: { howTo: "Tap it to blink. Try the Pupil slider in the Toy tab." },
  lungs: { howTo: "Tap for a deep breath. Try the Breath slider in the Toy tab." },

  // ---- Nature ---------------------------------------------------------------------------
  saguaro: {
    howTo: "Tap for the spines, then a look inside. Set its arms and flowers in the Toy tab.",
  },
  rocks: { howTo: "Tap to tumble and stack them. Pick a pile or a cairn in the Toy tab." },

  // ---- Weather and fire -----------------------------------------------------------------
  campfire: { howTo: "Tap it to stoke the fire. Set the fire's size in the Toy tab." },
  "storm-cloud": { howTo: "Tap for thunder. Try the Rain slider in the Toy tab." },
  "lava-lamp": {
    howTo: "Tap to heat it up. Pick colors, blobs and flow in the Toy tab.",
  },
  "ice-statue": {
    howTo: "Tap to melt the swan and refreeze it. Try the Temperature slider in the Toy tab.",
  },
  candle: { howTo: "Tap to blow out the candle; tap again to light it." },
  tornado: { howTo: "Tap to spin it up. Set its power in the Toy tab." },
  volcano: {
    howTo: "Tap it to make it erupt.",
    about:
      "A volcano is an opening in the Earth's crust where melted rock, called magma, comes up from deep below. Once it reaches the surface it is called lava. Gas trapped in the magma can make an eruption explosive, blasting out ash and rock.\n\nTap it to make it erupt. Most volcanoes sit where the great plates of the Earth's crust meet, and about 1,350 on land may still erupt; many more lie hidden under the sea.",
  },

  // ---- Food -----------------------------------------------------------------------------
  "ice-cream": {
    howTo: "Tap to melt it and refreeze it. Pick scoops and flavors in the Toy tab.",
  },
  "birthday-cake": {
    howTo: "Tap to blow out the candles; tap again to light them. Choose how many in the Toy tab.",
  },
  pancakes: { howTo: "Tap to flip the top pancake. Set the stack and the syrup in the Toy tab." },
  pizza: { howTo: "Tap to take a slice; tap again to go back." },
  burger: { howTo: "Tap to spread out the layers; tap again to stack them up." },
  egg: { howTo: "Tap to crack it open; tap again to go back." },
  coffee: { howTo: "Tap it to stir. Pick the latte art and the steam in the Toy tab." },
  apple: { howTo: "Tap to take a bite; tap again and a worm peeks out before it's whole again." },
  "gummy-bear": {
    howTo: "Drag the bear to stretch it; let go and it springs back. Tap to squish it.",
  },

  // ---- Toys -----------------------------------------------------------------------------
  bricks: {
    howTo: "Tap to build a model from the bricks; tap again to build another.",
  },
  dice: { howTo: "Tap to roll. Pick two six-sided dice or a d20 in the Toy tab." },
  "newtons-cradle": {
    howTo: "Drag a ball out to the side and let go. Or tap to lift the end ball.",
    about:
      "Newton's cradle is a row of steel balls, each hung on two strings so it can only swing in one line. Lift the end ball and let go: it strikes the row, the ball at the far end flies out, and the balls in between barely move. Let go of two and two fly out.\n\nIt shows two rules of physics at once: in each knock both the momentum and the energy carry through the row, so the same number of balls leaves as arrived. Each clack turns a little energy into sound and heat, so the swings slowly die away. Drag any ball out (the balls beside it come too) and let go, or tap to lift the end ball.",
  },
  "puzzle-cube": {
    howTo: "Drag across a face to turn a row or column. Tap to scramble or solve it.",
    about:
      "A twisting puzzle cube: 26 small cubes around a hidden core, with one color on each of its six faces. Each turn moves a whole row or column of nine cubes, and the puzzle is to bring every face back to one color.\n\nHere every little cube is its own piece, and the cube keeps track of each turn, so you can really solve it: drag across a face to turn that row or column. A tap scrambles a solved cube, or turns a scrambled one back to solved, one layer at a time, and solving it by hand earns a hop and a chime. The cube has about 43 quintillion arrangements, yet any of them can be solved in 20 moves or fewer.",
  },
  "chess-set": {
    howTo: "Tap a piece, then a square, to move it. Or press play in the bar to watch a game.",
    about:
      "Chess is a game for two players on a board of 64 squares. Each side starts with 16 pieces (a king, a queen, two rooks, two bishops, two knights and eight pawns), and the goal is to checkmate the other king: to attack it so that it has no way out.\n\nThe board is set up for the Opera Game, played in Paris in 1858 at the opera house, where Paul Morphy beat the Duke of Brunswick and Count Isouard in 17 moves. Press play in the bar under the board to watch it, or tap a piece and then a square to play your own moves. In the Toy tab you can open or paste any game written in PGN, the usual way of writing down chess games.",
  },

  // ---- Open me --------------------------------------------------------------------------
  chest: { howTo: "Tap to open the lid; tap again to close it." },
  book: { howTo: "Tap to close the book; tap again to open it." },
  laptop: {
    howTo:
      "Tap the keys, or type on your keyboard. Drag on the trackpad. Tap elsewhere to close it.",
  },
  "music-box": { howTo: "Tap to close the lid; tap again to open it." },
  "gift-box": { howTo: "Tap to open the present; tap again to close it." },
  umbrella: { howTo: "Tap to close the umbrella; tap again to open it." },
  "desk-fan": { howTo: "Tap to switch it off or on. Turn its swing on or off in the Toy tab." },
  lamp: { howTo: "Tap to switch the light off or on." },
  telescope: { howTo: "Tap to collapse it; tap again to pull it out." },

  // ---- Medieval -------------------------------------------------------------------------
  "sword-in-stone": { howTo: "Tap to pull the sword from the stone; tap again to go back." },
  "bow-and-target": { howTo: "Tap to shoot an arrow; tap again to go back." },
  "knights-helmet": { howTo: "Tap to open the visor; tap again to close it." },
  "dragon-egg": { howTo: "Tap to hatch the egg; tap again to go back." },

  // ---- Animals --------------------------------------------------------------------------
  octopus: {
    howTo: "Tap it to squirt ink.",
    about:
      "An octopus is a soft-bodied sea animal with eight arms lined with suckers. It has three hearts and blue blood, no bones at all, and it can change the color of its skin in a split second to hide or to signal.\n\nWhen something scares it, an octopus squirts a cloud of dark ink and jets away behind it. Tap this one and it does just that: the ink billows out while it shoots up and away with its arms streaming, then it drifts back as the ink thins. You can pick its color in the Toy tab.",
  },
  pufferfish: { howTo: "Tap it to poke it. Try the Puff slider in the Toy tab." },
  ladybug: { howTo: "Tap to open the wings; tap again to close them." },
  snail: { howTo: "Tap to make it hide in its shell; tap again to bring it out." },

  // ---- Math -----------------------------------------------------------------------------
  lorenz: { howTo: "Tap to race along the path. Set the glow in the Toy tab." },
  mobius: { howTo: "Tap to send the rider round. Pick a rider in the Toy tab." },
  "klein-bottle": { howTo: "Tap to send water through. Set the glow in the Toy tab." },
  "menger-sponge": { howTo: "Tap to close and carve the holes. Pick the level in the Toy tab." },
  hypercube: { howTo: "Tap to turn it inside out. Try the 4D turn slider in the Toy tab." },
  "torus-knot": { howTo: "Tap to pull it and let go. Pick another knot in the Toy tab." },
  gyroid: { howTo: "Tap to make it breathe. Pick a cube or a ball in the Toy tab." },
  sierpinski: {
    howTo: "Tap to explode it; tap again to put it back. Pick the level in the Toy tab.",
  },
  platonic: {
    howTo:
      "Tap to explode it; tap again to put it back. Pick one of the five solids in the Toy tab.",
  },
  "graph-plotter": {
    howTo: "Tap to draw the curve. Pick a curve, or type your own, in the Toy tab.",
  },
  "surface-plotter": {
    howTo: "Tap to raise the surface. Pick one, or type your own, in the Toy tab.",
  },
  "unit-circle": {
    howTo: "Tap to send the point round. Try 3D, or type your own path, in the Toy tab.",
  },
  "fourier-circles": {
    howTo: "Tap to spin the circles. Type a word or a curve in the Toy tab.",
    about:
      "Circles turning on circles can draw any closed shape. Each circle spins a whole number of times per loop while riding on the rim of the one before, and the tip of the last one traces the drawing. This is a Fourier series, named after Joseph Fourier, who showed in the early 1800s that repeating patterns can be built by adding up simple waves.\n\nTap to spin them and watch the shape drawn again. Few circles draw a wobbly shape and many draw a crisp one: set how many in the Toy tab, pick a heart, a star or a square wave, stack them in 3D, or type a word and each letter gets its own chain of circles.",
  },

  // ---- Holidays -------------------------------------------------------------------------
  "jack-o-lantern": { howTo: "Tap to lift the lid; tap again to put it back." },
  snowman: { howTo: "Tap to melt it and build it again. Try the Warmth slider in the Toy tab." },
  "decorated-tree": { howTo: "Tap to switch the lights on or off." },
  diya: { howTo: "Tap to light the ring of diyas; tap again to put them out." },
  menorah: { howTo: "Tap to put out the candles; tap again to light them one by one." },

  // ---- Music ----------------------------------------------------------------------------
  xylophone: {
    howTo: "Tap a bar to play its note, or tap the mallet or frame to play a scale.",
    about:
      "A xylophone is a row of tuned wooden bars that you strike with a mallet. Each bar's length sets its note: the shorter the bar, the higher it sounds. The name comes from the Greek for “wood” and “sound”.\n\nThis toy one has eight colored bars, a scale from C up to the next C. Tap a bar and the mallet swings over and strikes it, and the bar jumps and plays its note, so you can play a tune. Tap the mallet, a wheel or the ends of the frame instead, and it plays the whole scale.",
  },

  // ---- Vehicles -------------------------------------------------------------------------
  helicopter: { howTo: "Tap to take off; tap again to land." },
  ufo: { howTo: "Tap to switch the beam off or on." },

  // ---- Landmarks ------------------------------------------------------------------------
  "eiffel-tower": {
    howTo: "Tap it for its night show of lights and fireworks.",
    about:
      "The Eiffel Tower is an iron lattice tower in Paris, built by the engineer Gustave Eiffel's company for the World's Fair of 1889. It is about 330 meters (1,083 feet) tall, and it was the tallest structure in the world until 1930.\n\nTap it for a night show: the ironwork lights up gold, sparkling white lights climb the tower, and four fireworks burst around it. The real tower sparkles like this for five minutes every hour after dark.",
  },
  lighthouse: { howTo: "Tap to switch the light off or on." },
  castle: { howTo: "Tap to lower the drawbridge; tap again to raise it." },
  "leaning-tower": { howTo: "Tap to drop two balls from the top. Set the lean in the Toy tab." },
};

// ---- What a toy has, read from its recipe -----------------------------------------

function firstUpper(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function sentence(s) {
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

// The options and controls a toy shows in the Toy tab (not its tap's own
// control, not hidden data options).
function settingLabels(info) {
  const r = info?.recipe;
  const out = [];
  for (const o of info?.optionDefs || r?.options || []) if (!o.hidden) out.push(o.label);
  for (const c of r?.controls || []) {
    if (c.type === "pulse" || !c.label) continue;
    if (c.type === "toggle" && r.action?.key === c.key) continue;
    out.push(c.label);
  }
  return out;
}

// A line from what the toy has. It only says what is sure: a tap plays the
// recipe's action (or makes the toy hop), a recipe drag or grab is the toy's
// own, typing is in the Toy tab's input panel.
export function defaultHowTo(info) {
  const r = info?.recipe || null;
  const parts = [];
  if (r?.drag) parts.push("Drag on the toy to play with it.");
  else if (r?.grab) parts.push("Drag the toy to stretch it.");
  if (r?.action?.label) parts.push(`Tap it: ${sentence(firstUpper(r.action.label))}`);
  else parts.push("Tap it to make it hop.");
  if (r?.input) {
    parts.push(
      r.input.placeholder ? "Type your own in the Toy tab." : "Open your own file in the Toy tab.",
    );
  } else if (settingLabels(info).length) {
    parts.push("More in the Toy tab.");
  } else if (info?.kind === "procedural" && !info.id) {
    parts.push("Change it in the Make tab.");
  }
  return parts.join(" ");
}

// What you can do with the toy, as short lines for the About section.
export function toyAbilities(info) {
  const r = info?.recipe || null;
  const out = [];
  if (r?.action?.label) out.push(["Tap", sentence(firstUpper(r.action.label))]);
  else out.push(["Tap", "It hops."]);
  if (r?.drag) out.push(["Drag", "Plays with the toy itself; a drag beside it turns the view."]);
  else if (r?.grab) out.push(["Drag", "Stretches it; let go and it springs back."]);
  const settings = settingLabels(info);
  if (settings.length) out.push(["Toy tab", `${settings.join(", ")}.`]);
  if (r?.input?.title) out.push(["Your own", `${sentence(r.input.title)} (in the Toy tab)`]);
  return out;
}

// The entry for the toy on the stage. A shelf shape edited into another
// shape (no longer its rig) or a toy of your own gets no entry.
function entryFor(info) {
  if (!info?.id) return null;
  if (info.kind === "procedural" && !info.rig) return null;
  return TOY_HELP[info.id] || null;
}

// Everything the help UI shows for one toy.
export function toyHelp(info) {
  const entry = entryFor(info);
  const howTo = entry?.howTo || defaultHowTo(info);
  let about = entry?.about || "";
  if (!about && info?.kind === "file")
    about =
      "Your own splat file, drawn in your browser. It stays on your device: nothing is uploaded.";
  if (!about && info?.kind === "procedural" && !info.id)
    about =
      "A toy you made in the Make tab: a shape, a palette and a seed, built in your browser from splats.";
  return {
    label: info?.label || "",
    howTo,
    about: about ? about.split(/\n\s*\n/) : [],
    hasEntry: !!entry,
    abilities: toyAbilities(info),
  };
}
