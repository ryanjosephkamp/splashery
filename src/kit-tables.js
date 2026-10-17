// The generated toys' behavior tables: the per-splat behavior kinds, the
// morph packing range and the lever limits. Plain data with no engine and no
// DOM, so recipes, tests, tools and other projects (the Shop's bench) can
// import it in Node. src/effects.js re-exports all of it (lane SE1).
//
// Generated toys carry a per-splat "splatAnim" stream (RGBA32F): x = part
// index (0..15) + 16 when the pattern layer should skip the splat, y =
// behavior kind (see KINDS), z and w = the behavior's two parameters.
// Morph offsets are packed over +-MORPH_RANGE toy units (the fitted toy is
// 1.9 across, so any two of its points are closer than that).
export const MORPH_RANGE = 2;

export const KINDS = {
  none: 0,
  orbit: 1, // turn about the toy's up axis: z = turns per unit time at the rim, w = falloff (0 rigid, 1.5 Keplerian)
  beat: 2, // heartbeat swell from the center: z = amount, w = phase
  breathe: 3, // slow sine swell: z = amount, w = phase
  flame: 4, // rise, shrink and redden in a loop: z = height (toy radii), w = phase
  rise: 5, // drift up and fade in a loop (embers, bubbles, smoke): z = height, w = phase
  fall: 6, // fall and fade in a loop (rain, snow): z = distance, w = phase
  twinkle: 7, // brightness flicker: z = amount, w = phase
  sway: 8, // bend with height above a base (plants, tentacles): z = amount, w = base height
  grow: 9, // appear as the grow control passes z (0..1)
  melt: 10, // slump and spread toward the floor as energy rises: z = how easily
  pulse: 11, // a glow runs along a path: z = position along the path (0..1)
  wave: 12, // ripple up and down: z = amount, w = phase
  glint: 13, // sparkle as the camera moves: z = amount
  token: 14, // a game piece moved and turned by uSpTokens: z = token index (0..47)
  screen: 15, // a screen pixel colored from the uSpScreen texture: z, w = u, v
  key: 16, // a key that goes down when pressed: z = key index (uSpKitB.w = index + depth)
  // Channel kinds follow out.morph (uSpMorph, four channels), with motion on or off:
  morph: 17, // move toward a target by the channel: z = x * 4096 + y, w = z + 4096 * channel (12-bit offsets, see Kit.encodeMorphs; channel 4 to 7: 0 to 3, shrinking to 40% as it goes)
  band: 18, // glow (uSpGlowC) where the channel passes z: w = channel + band width
  fade: 19, // fade out as the channel passes z: w = channel + width (negative: fade in)
  skin: 20, // follow two tokens' offsets: z = a + 64 * b, w = blend toward b
  // Pictures (lane Pictures): a page that turns about a book's spine and curls
  // like paper (uSpLeaf): z = distance from the spine along the page, w = leaf slot (0..9)
  leaf: 21,
  // Levers (lane Pianos): keys, hammers, dampers, jacks, strings and lights
  // by the hundred, each moved by its own amount (uSpLevers) as its group
  // says (uSpLever): z = lever index (0..95) + 128 * group (0..5), w = the
  // splat's place along a string (0..1) for the vibrate mode.
  lever: 22,
  // Lane Fix4 (engine): glass. A splat's opacity follows how squarely it
  // faces the eye, seen from its part's center (the part cull's facing
  // number; the toy's center for splats on no part): mix(z, 1, (1 - |f|)^w),
  // so a thin shell is nearly clear face on (z) and solid at its edge.
  // z = opacity face on (0..1), w = sharpness (about 2 to 8).
  rim: 23,
  // Relief (lane Live input; 24 since lane Fix4 took 23): a splat lifted from its place by a live
  // height and colored from a live picture, both drawn by the recipe into
  // its screen canvas (recipe.screen): the color at (u / 2, v), the height
  // (red, 0..1) at (1 / 2 + u / 2, v). z = u + 2 * axis (0 x, 1 y, 2 z; 3:
  // a 3D offset, red, green and blue each signed about a half, along x, y
  // and z, with alpha under a half hiding the splat),
  // w = v + 2 * lift at full height (thousandths of a toy unit; see
  // Kit.encodeReliefs). A live spectrogram, a camera picture with depth.
  relief: 24,
  // Lane Hands engine C: a splat on a sheet of cloth follows four tokens
  // (the corners of its cell), blended across and down: z = a + 64 b +
  // 4096 c + 262144 d (tokens 0..47), w = 1024 s + t (each 0..1023 for
  // 0..1), moving by mix(mix(a, b, s), mix(c, d, s), t).
  skin4: 25,
  // Lane Imaging (engine): a splat in a measured volume (a CT or MRI scan).
  // z = its density (0..1). It shows only while its density is inside the
  // window and its rest place is on the near side of the cutting plane
  // (uSpVol, set from out.volume); splats on the cut face glow (uSpVolC).
  volume: 26,
};

// Levers: 96 amounts (three 8-bit channels each) and 6 groups.
export const MAX_LEVERS = 96;
export const MAX_LEVER_GROUPS = 6;
