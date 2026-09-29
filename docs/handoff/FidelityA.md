# Lane Fidelity A: toys people won't recognize as splats

Prefix `fa`. Branch `claude/lane-fidelity-a`. PR title "Phase Fidelity A: the grainy-toy audit and
the worst toys made sharp". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fidelity A, "Toys people won't recognize as splats" (prefix
`fa`). Branch: claude/lane-fidelity-a. PR title: "Phase Fidelity A: the grainy-toy audit and the
worst toys made sharp". Handoff file: docs/handoff/FidelityA.md.

### Brief (written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and his answers on the Splashery Universe page the same night)

The owner's words: "I almost want to make things so incredible with this that people won't even
realize that they're looking at Gaussian splats … There are some where we could improve the fidelity
or the quality, like they could at least seem to be rendered at higher resolution. You know, for
example, like the desk lamp, or maybe like the football, or the hockey puck … Those are examples …
some of the stuff, just, like, the resolution isn't great. It just looks grainy."

Do two things:

1. **Audit every toy at phone size.** Render each toy's rest view and its tap at 390×844 (the
   contact sheet and effect clip tools), and rank every kit toy and scan by how grainy, speckled,
   soft or see-through it looks at a glance. Use the effect quality rule "Materials look like the
   real material: no see-through solids, no blur, no speckle". Write the ranked list, with one line
   per toy saying what's wrong, into your handoff file under "## Audit". A later lane, Fidelity B,
   fixes the rest from your list.
2. **Fix the worst, starting with the three the owner named**: the desk lamp (`lamp`), the American
   football (`american-football`) and the hockey puck (`hockey-puck`). Then work down your list for
   as long as each fix is clearly better: aim for about 25 toys.
   - Use the recipe's own tools: splat density and count within the tier budgets, splat sizes and
     orientation (flat splats on flat surfaces, thin ones along edges), opacity (solid things fully
     solid), cleaner colors from functions instead of noise, and sharper seams and edges.
   - A fix must not change what the toy is or how its tap moves. The owner approved those effects.
   - Keep each toy within its tier's splat budget and its load time.
   - Scans can only be improved within their recipe and our engine. Note in the audit any scan that
     needs a better capture.
   - If a fix truly needs an engine change (for example anti-aliasing, or a sharper splat kernel),
     don't make it. Describe it to the Operator in your message; a Lab lane is testing sharper
     kernels.

Clips and cards: one before-and-after card per changed toy, at 390×844 (a still pair of the rest
view, plus the tap clip when the tap changed), in groups by shelf, ids `fa-<toy-id>`. These toys are
public, so the owner's "good" marks decide each merge. Don't mix unrelated changes into the same
toy's card.

### You own

- the toy packs of the toys you change (src/packs/\*.js, except the packs of the picture, screen,
  splatting and splat-equation toys, which other lanes own), their assets/toys/<id>/ thumbnails, and
  their entries in the shared lists if any change;
- tests/fa.spec.mjs, your `fa-*` screenshots and docs/handoff/FidelityA.md.

Keep sounds as they are: two sound lanes will edit src/toy-sounds.js at the same time. Lanes Books,
Screens, Viewer and Worlds run at the same time; leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time. CLAUDE.md still says "Opus 5.5 only" until the Operator's rules PR
  merges; this brief is the owner's newer word.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: every toy audited at phone size (below). 20 toys fixed so far, starting with
  the three the owner named: desk lamp, American football, hockey puck, then penguin, alarm clock,
  desk fan, jet, sailboat, shuttlecock, snowman, coffee, jelly (its plate), taco, pancakes, Newton's
  cradle, kite, owl, flying saucer, origami crane and paper plane. Their before-and-after cards are
  on the Effect review page (`fa-<toy id>`, lane FidelityA, grouped by shelf). Thumbnails
  re-rendered.
- Draft PR: #77. Next: more toys from the top of the list (Klein bottle, snow globe, ocean liner,
  Washington Monument, marble, white blood cell, and the grade-3 toys with speckled white parts).

## Audit

How: each toy's rest view rendered at the phone tier (`?profile=mid`, 140,000 splats for a kit toy)
in a 780 px square, the size of a 390-wide phone screen at 2x, once on black and once on white. The
difference between the two gives each pixel's see-through amount; a high-pass of the black render
inside the toy gives its speckle. The numbers found the candidates; every toy was then judged by eye
in montages. Grade 5 is grainy at a glance, 4 clearly speckled in parts, 3 some speckle or softness,
2 minor or by design (glows, fur, sparks, glass), 1 clean. Scans are marked "scan". Taps were judged
from clips only for the changed toys: none of the taps changed.

What makes a kit toy grainy, in order of how often:

1. **Random placement.** Most recipes place surface splats at random (no `even: true`). The thin
   spots let the dark back of the toy, or its dark core, show through light surfaces as black flecks
   (the penguin's belly, the clock's dial, white plates, sails, fuselages). `even: true`,
   `opacity: 1` and low color noise (`jitter` 0.01 to 0.015) fix most of it.
2. **Low density.** A few recipes build well under the tier's splats (`density` 0.16 to 0.8).
3. **Mirror chrome on thin parts.** Each splat of a thin chrome wire catches a different reflection:
   black and white speckle. Softly lit steel reads as smooth metal.
4. **See-through shells.** The faint `rim()` shell (squash ball, medicine ball, formerly the puck)
   reads as a gray haze around the outline at phone size.
5. **Faint clouds.** Light beams and glows made of random faint splats look blotchy.

Scans: none needs a better capture to pass at phone size except the Mandelbrot torus (its fractal
detail reads as blue noise); the planet's cloud shell has a ragged edge.

1. Klein bottle (`klein-bottle`, kit, 5): Heavy dark speckle all over the tube and see-through gaps;
   **Fixed in this lane.** density 0.8 and random placement.
2. Desk lamp (`lamp`, kit, 5): Base and shade speckled with see-through holes, blotchy light beam;
   **Fixed in this lane.** built at density 0.45. **Fixed in this lane.**
3. Alarm clock (`clock`, kit, 5): White dial covered in dark speckle and gray blobs from the case's
   **Fixed in this lane.** inside; chrome rim speckled. **Fixed in this lane.**
4. Kite (`kite`, kit, 5): Sail heavily speckled and sparse (density 0.16). **Fixed in this lane.**
5. Penguin (`penguin`, kit, 5): White belly and face heavily speckled with dark flecks from the
   **Fixed in this lane.** black back. **Fixed in this lane.**
6. Hockey puck (`hockey-puck`, kit, 5): Gray see-through haze around the outline, mottled top, harsh
   **Fixed in this lane.** stripe knurling; small in its frame. **Fixed in this lane.**
7. Snow globe (`snow-globe`, kit, 4): Base heavily speckled; the dome's snow reads as noise; the
   **Fixed in this lane.** tree and snowman are fine.
8. White blood cell (`white-blood-cell`, kit, 4): Membrane (k.radial) mottled and see-through in
   places; nucleus shows as blur.
9. Desk fan (`desk-fan`, kit, 4): Chrome cage wires speckled black and white; blades speckled.
   **Fixed in this lane.** **Fixed in this lane.**
10. Sailboat (`sailboat`, kit, 4): White sails and hull heavily speckled with dark flecks; the sea
    **Fixed in this lane.** is grainy. **Fixed in this lane.**
11. Paper plane (`paper-plane`, kit, 4): Lined paper speckled with dark flecks; density 0.5. **Fixed
    **Fixed in this lane.** in this lane.**
12. Ocean liner (`ocean-liner`, kit, 4): White superstructure and hull speckled; the sea around it
    grainy.
13. Marble (`marble`, kit, 4): Glass marble reads as white speckle over the blue swirl.
14. Washington Monument (`washington-monument`, kit, 4): Marble shaft speckled dark; flag ring busy.
    **Fixed in this lane.**
15. Jet airliner (`jet`, kit, 4): White fuselage speckled with dark flecks. **Fixed in this lane.**
16. Shuttlecock (`shuttlecock`, kit, 4): White feathers speckled with dark flecks; the blue band
    **Fixed in this lane.** grainy. **Fixed in this lane.**
17. Coffee (`coffee`, kit, 4): White saucer and cup speckled dark; the foam art speckled. **Fixed in
    **Fixed in this lane.** this lane.**
18. Jelly (`jelly`, kit, 4): White plate heavily speckled; the jelly's highlights are blotchy.
    **Fixed in this lane.** **Fixed in this lane.**
19. Newton's cradle (`newtons-cradle`, kit, 4): Chrome balls speckled black and white; the rails a
    **Fixed in this lane.** little speckled. **Fixed in this lane.**
20. Taco (`taco`, kit, 4): White plate heavily speckled. **Fixed in this lane.**
21. Owl (`owl`, kit, 4): Cream belly and face speckled with dark flecks. **Fixed in this lane.**
22. Snowman (`snowman`, kit, 4): White snowballs speckled; the scarf speckled. **Fixed in this
    **Fixed in this lane.** lane.**
23. Pancakes (`pancakes`, kit, 4): White plate heavily speckled. **Fixed in this lane.**
24. Origami crane (`origami-crane`, kit, 4): Paper speckled and sparse (density 0.18); small in its
    **Fixed in this lane.** frame. **Fixed in this lane.**
25. American football (`american-football`, kit, 4): Pebbled leather reads as grain; the laces
    **Fixed in this lane.** speckled. **Fixed in this lane.**
26. Butterfly (`butterfly`, kit, 3): Wing pattern reads as fine noise at phone size; white rim dots
    speckle.
27. Soap bubbles (`soap-bubbles`, kit, 3): See-through by design, but the film looks blotchy and
    grainy rather than smooth; density 0.7.
28. Flying saucer (`ufo`, kit, 3): Saucer speckled with dark flecks; the beam is soft but blotchy.
    **Fixed in this lane.** **Fixed in this lane.**
29. Paramecium (`paramecium`, kit, 3): Cilia fringe reads as fuzz (by design); body speckled.
30. Amoeba (`amoeba`, kit, 3): Body translucent by design but its surface is speckled white.
31. Storybook (`book`, kit, 3): Paper pages speckled; letters fine.
32. Word vectors (`word-vectors`, kit, 3): Floor grid and labels a little grainy; labels read.
33. Saturn (`saturn`, kit, 3): Rings grainy with dark gaps; the planet is fine.
34. Candy cane (`candy-cane`, kit, 3): White stripes flecked with red and dark specks.
35. Mitochondrion (`mitochondrion`, kit, 3): Inner folds speckled.
36. Bow and target (`bow-and-target`, kit, 3): Target face speckled; the grass is fine.
37. Acorns (`acorn`, kit, 3): Leaf behind and the cups a bit speckled.
38. Animal cell (`animal-cell`, kit, 3): Cytoplasm translucent by design but mottled; organelles
    speckled.
39. Big Ben (`big-ben`, kit, 3): Stone tower speckled; the clock faces are fine.
40. Rainbow (`rainbow`, kit, 3): Bands speckled with white dots; the clouds are clean.
41. Windmill (`windmill`, kit, 3): Sails' lattice fine; the tower and ground speckled.
42. Chess set (`chess-set`, kit, 3): Board squares flecked; the pieces are fine.
43. Patterned egg (`patterned-egg`, kit, 3): White pattern flecked; the red shell speckled.
44. Umbrella (`umbrella`, kit, 3): Canopy speckled at the edges; density 0.65.
45. Diatom (`diatom`, kit, 3): Shell pattern speckled.
46. Lighthouse (`lighthouse`, kit, 3): White tower speckled; the beam is soft by design; the sea
    grainy.
47. Bus (`bus`, kit, 3): Yellow body flecked dark; the windows are fine.
48. Twisting supertall (`supertall`, kit, 3): Glass facade speckled.
49. Geyser (`geyser`, kit, 3): White sinter rim speckled; the spray is fine.
50. Nautilus (`nautilus`, kit, 3): White shell speckled; the stripes are fine.
51. Ladybug (`ladybug`, kit, 3): White head spots and the black body speckled.
52. Crystal ball (`crystal-ball`, kit, 3): Glass reads as white speckle over the mist.
53. Wizard's orb (`wizards-orb`, kit, 3): Glass orb speckled; the sparkles by design.
54. Seashell spiral (`seashell-spiral`, kit, 3): Shell speckled; density 0.85.
55. Music box (`music-box`, kit, 3): Mirror in the lid speckled; the box is fine.
56. Avocado (`avocado`, kit, 3): Pale flesh speckled dark.
57. Pearl (`pearl`, kit, 3): Shell interior speckled; the pearl is fine.
58. White House (`white-house`, kit, 3): White walls speckled; the grounds are fine.
59. Dice (`dice`, kit, 3): White pips and the red faces flecked.
60. Emerald (`emerald`, kit, 3): Facets flecked with white specks.
61. Xylophone (`xylophone`, kit, 3): Bars flecked with white specks.
62. Sports car (`sports-car`, kit, 3): Red body flecked; the windows speckled.
63. Knight's helmet (`knights-helmet`, kit, 3): Steel speckled black and white.
64. Heraldic shield (`shield`, kit, 3): Painted face speckled; the rivets are fine.
65. Snare drum (`drum`, kit, 3): White skin flecked; the red shell speckled.
66. Colosseum (`colosseum`, kit, 3): Stone speckled and soft.
67. Leaning Tower of Pisa (`leaning-tower`, kit, 3): White stone speckled.
68. Wind-up robot (`robot`, kit, 3): Blue body flecked dark.
69. Platonic solids (`platonic`, kit, 3): Faces flecked with white.
70. Sapphire (`sapphire`, kit, 3): Facets flecked with white.
71. Crown (`crown`, kit, 3): Ermine white speckled; the gold is fine.
72. Mandeltorus (`mandeltorus`, scan, 3): Scan: fractal detail reads as blue noise at phone size;
    needs a smoother capture.
73. Rocket (`rocket`, kit, 3): White body speckled.
74. Croissant (`croissant`, kit, 3): Baking tray speckled; the croissant is fine.
75. Brain (`brain`, kit, 3): Surface speckled white.
76. Gummy bear (`gummy-bear`, kit, 3): Translucent red body reads as speckle.
77. Apple (`apple`, kit, 3): Red skin flecked with white.
78. Tooth (`tooth`, kit, 3): White enamel flecked with yellow.
79. Candle (`candle`, kit, 3): White wax speckled. **Fixed in this lane.**
80. Boiled egg (`egg`, kit, 3): Egg cup and shell flecked with white.
81. Squash ball (`squash-ball`, kit, 3): A gray see-through haze around the outline (the rim shell)
    makes it look blurred.
82. Acoustic guitar (`guitar`, kit, 2): Clean body; the fine strings and rosette read as busy
    texture (by design). Top edge dots.
83. Comet (`comet`, kit, 2): Soft glow and tail by design; the tail streaks read as fine grain.
84. Honeybee (`bee`, scan, 2): Scan: sharp; hairs read as fine texture. Needs nothing within the
    recipe.
85. Supernova (`supernova`, kit, 2): Glowing cloud by design; outer speckle is intended debris.
86. Basket (`basket`, scan, 2): Scan: sharp shells; a soft haze around the basket's rim.
87. Sea urchin (`sea-urchin`, kit, 2): Spines fine and busy by design; body clean.
88. Meteor (`meteor`, kit, 2): Trail is a spray of sparks by design.
89. Lava lamp (`lava-lamp`, kit, 2): Glass see-through by design; clean blobs.
90. Star (`star`, kit, 2): Glow by design; clean.
91. Fireworks (`fireworks`, kit, 2): Sparks by design; the base is fine.
92. Star cluster (`star-cluster`, kit, 2): Stars by design.
93. Lorenz attractor (`lorenz`, kit, 2): Ribbons fine; slight grain on the white stripe.
94. Bicycle (`bicycle`, kit, 2): Thin tubes and spokes fine; tires a little grainy.
95. Sushi (`sushi`, kit, 2): Board and rice slightly grainy.
96. Bacterium (`bacterium`, kit, 2): Pili fine; the body fuzzy by design.
97. Storm cloud (`storm-cloud`, kit, 2): Cloud and rain soft by design.
98. Pretzel (`pretzel`, kit, 2): Salt reads as specks (by design); dough clean.
99. Cherry blossom (`cherry-blossom`, kit, 2): Blossom clusters busy by design; the ground petals
    speckle.
100. Ocean wave (`ocean-wave`, kit, 2): Foam spray by design; the water is fine.
101. Kelp (`kelp`, kit, 2): Fronds fine; the sand is a little grainy.
102. Amethyst geode (`amethyst-geode`, kit, 2): Crystal sparkle reads as grain in the rim.
103. Ruby (`ruby`, kit, 2): Facets sharp.
104. Snail (`snail`, kit, 2): Shell fine; body clean.
105. Volcano (`volcano`, kit, 2): Slope texture fine.
106. Mandelbulb (`mandelbulb`, kit, 2): Fractal detail busy by design.
107. Spinning top (`spinning-top`, kit, 2): Stripes clean; the white a little flecked.
108. Steam train (`steam-train`, kit, 2): Small details busy; smoke soft by design.
109. Pineapple (`pineapple`, kit, 2): Texture by design.
110. Sun (`sun`, kit, 2): Glow by design.
111. Saguaro cactus (`saguaro`, kit, 2): Clean.
112. Puzzle cube (`puzzle-cube`, kit, 2): Stickers flecked at the edges.
113. Bacteriophage (`bacteriophage`, kit, 2): Clean.
114. Ice cream (`ice-cream`, kit, 2): Mostly clean; the chips read.
115. Astrocyte (`astrocyte`, kit, 2): Clean.
116. Octopus (`octopus`, kit, 2): Skin speckled white a little.
117. Solar system (`solar-system`, kit, 2): Orbits fine; small in frame.
118. Propeller plane (`propeller-plane`, kit, 2): Small speckle on the wings.
119. Sunflower (`sunflower`, kit, 2): Petals busy by design.
120. Dandelion (`dandelion`, kit, 2): Seed head soft by design.
121. Statue of Liberty (`statue-of-liberty`, kit, 2): Clean; the sea a little grainy.
122. Helicopter (`helicopter`, kit, 2): Clean; the pad a little grainy.
123. Tractor (`tractor`, kit, 2): Clean; the glass speckled a little.
124. Pizza (`pizza`, kit, 2): Toppings by design; clean crust.
125. Decorated tree (`decorated-tree`, kit, 2): Needles busy by design.
126. Birthday cake (`birthday-cake`, kit, 2): White frosting a little flecked.
127. Pebbles (`rocks`, kit, 2): Stone texture by design.
128. Taj Mahal (`taj-mahal`, kit, 2): White marble a little speckled.
129. Kiwi (`kiwi`, kit, 2): Clean.
130. Coral reef (`coral`, kit, 2): Busy by design.
131. Pufferfish (`pufferfish`, kit, 2): Clean.
132. Crossbow (`crossbow`, kit, 2): Clean.
133. Rugby ball (`rugby-ball`, kit, 2): White panels a little flecked.
134. Gift box (`gift-box`, kit, 2): Clean.
135. Quartz cluster (`quartz-cluster`, kit, 2): Clean.
136. Iceberg (`iceberg`, kit, 2): Clean.
137. Diya (`diya`, kit, 2): Rangoli busy by design.
138. Palm tree (`palm`, kit, 2): Sand a little grainy.
139. Opal (`opal`, kit, 2): Sparkle by design.
140. Snowflake (`snowflake`, kit, 2): Clean.
141. Yo-yo (`yo-yo`, kit, 2): Clean.
142. Pagoda (`pagoda`, kit, 2): Roofs clean.
143. Toadstool (`mushroom`, kit, 2): Clean.
144. Sword in the stone (`sword-in-stone`, kit, 2): Clean.
145. Jellyfish (`jellyfish`, kit, 2): Soft bell by design.
146. Eye (`eye`, kit, 2): White flecked a little.
147. Menger sponge (`menger-sponge`, kit, 2): Clean.
148. Submarine (`submarine`, kit, 2): Yellow body flecked a little.
149. Daisies (`daisy`, kit, 2): Petals busy by design.
150. Earth (`earth`, kit, 2): Clouds soft by design.
151. Chromosome (`chromosome`, kit, 2): Clean.
152. Paper lantern (`paper-lantern`, kit, 2): Paper speckled a little.
153. Popcorn (`popcorn`, kit, 2): Clean.
154. Aurora world (`aurora-planet`, kit, 2): Glow by design.
155. Ring nebula (`planetary-nebula`, kit, 2): Glow by design.
156. Dragon egg (`dragon-egg`, kit, 2): Scales by design.
157. Burger (`burger`, kit, 2): Clean.
158. Nebula (`nebula`, kit, 2): Glow by design.
159. Teddy bear (`teddy-bear`, kit, 2): Fur by design.
160. Diamond (`diamond`, kit, 2): Clean.
161. Maple tree (`maple`, kit, 2): Leaves busy by design.
162. Rose (`rose`, kit, 2): Clean.
163. Parthenon (`parthenon`, kit, 2): Stone soft.
164. Telescope (`telescope`, kit, 2): Clean; density 0.6.
165. Campfire (`campfire`, kit, 2): Sparks by design.
166. Macarons (`macarons`, kit, 2): Clean.
167. Eiffel Tower (`eiffel-tower`, kit, 2): Lattice busy by design.
168. Pythagoras proof (`pythagoras-proof`, kit, 2): Squares flecked with white.
169. Cupcake (`cupcake`, kit, 2): Clean.
170. Lotus (`lotus`, kit, 2): Water grainy.
171. Tulips (`tulip`, kit, 2): Clean.
172. Stonehenge (`stonehenge`, kit, 2): Clean.
173. Grapes (`grapes`, kit, 2): Clean.
174. Potion bottle (`potion-bottle`, kit, 2): Glass by design.
175. Watermelon (`watermelon`, kit, 2): Rind flecked a little.
176. Succulent (`succulent`, kit, 2): Clean.
177. Frog (`frog`, kit, 2): Clean.
178. Tiny planet (`planet`, kit, 2): Scan: the cloud shell's edge is ragged.
179. Fern (`fern`, kit, 2): Clean.
180. Ice swan (`ice-statue`, kit, 2): Clean.
181. Hot-air balloon (`hot-air-balloon`, kit, 2): Clean.
182. Castle (`castle`, kit, 2): Clean.
183. Bonsai (`bonsai`, kit, 2): Clean.
184. Weeping willow (`willow`, kit, 2): Clean.
185. Medicine ball (`medicine-ball`, kit, 2): A soft gray haze around the outline (the rim shell).
186. Treasure chest (`chest`, kit, 2): Clean.
187. Waterfall (`waterfall`, kit, 2): Clean.
188. Balloon dog (`balloon-dog`, kit, 2): Clean.
189. Oak tree (`oak`, kit, 2): Clean.
190. Pyramids of Giza (`pyramids`, kit, 2): Sand soft.
191. Tornado (`tornado`, kit, 2): Clean.
192. Electron orbital (`orbital`, kit, 2): Glow by design.
193. Spiral galaxy (`spiral-galaxy`, kit, 2): Glow by design.
194. Gyroid (`gyroid`, kit, 2): Clean.
195. Uranus (`uranus`, kit, 2): Rings grainy.
196. May beetle (`may-beetle`, scan, 1): Scan: sharp, reads as a photo.
197. Cluster fly (`cluster-fly`, scan, 1): Scan: sharp.
198. Laptop (`laptop`, kit, 1): Locked toy; screen text sharp. Leave as is.
199. Millipede (`millipede`, scan, 1): Scan: sharp.
200. Ukulele (`ukulele`, scan, 1): Scan: sharp.
201. Cactus (`cactus`, scan, 1): Scan: sharp.
202. Multilayer perceptron (`multilayer-perceptron`, kit, 1): Diagram sharp.
203. School of fish (`fish-school`, kit, 1): Clean.
204. Transformer (`transformer`, kit, 1): Diagram sharp.
205. Black hole (`black-hole`, kit, 1): Clean.
206. Alarm clock (`alarm-clock`, scan, 1): Scan: sharp.
207. Sorting machine (`sorting-machine`, kit, 1): Clean.
208. Carder bumblebee (`bumblebee`, scan, 1): Scan: sharp.
209. Cricket ball (`cricket-ball`, kit, 1): Clean.
210. Circle and waves (`unit-circle`, kit, 1): Diagram sharp.
211. Perceptron (`perceptron`, kit, 1): Diagram sharp.
212. Graph plotter (`graph-plotter`, kit, 1): Diagram sharp.
213. Building bricks (`bricks`, kit, 1): Clean.
214. Spring toy (`spring-toy`, kit, 1): Clean.
215. Hypercube (`hypercube`, kit, 1): Clean.
216. Asteroid (`asteroid`, kit, 1): Clean.
217. Strawberry (`strawberry`, scan, 1): Scan: sharp.
218. Garden gnome (`garden-gnome`, scan, 1): Scan: sharp.
219. Fourier circles (`fourier-circles`, kit, 1): Diagram sharp.
220. Microglia (`microglia`, kit, 1): Clean.
221. Cat statue (`cat-statue`, scan, 1): Scan: sharp.
222. Raspberry (`raspberry`, scan, 1): Scan: sharp.
223. Half adder (`half-adder`, kit, 1): Diagram sharp.
224. Recurrent network (`rnn`, kit, 1): Diagram sharp.
225. Starfish (`starfish`, kit, 1): Clean.
226. Soccer ball (`soccer-ball`, kit, 1): Clean.
227. DNA (`dna`, kit, 1): Clean.
228. Neural network (`neural-network`, kit, 1): Diagram sharp.
229. Real tin can (`tin-can-real`, scan, 1): Scan: sharp.
230. Baseball (`baseball`, kit, 1): Clean.
231. Lollipop (`lollipop`, kit, 1): Clean.
232. Sierpinski tetrahedron (`sierpinski`, kit, 1): Clean.
233. Blackberry (`blackberry`, scan, 1): Scan: sharp.
234. Molecule (`molecule`, kit, 1): Clean.
235. Convolutional network (`cnn`, kit, 1): Diagram sharp.
236. Atom (`atom`, kit, 1): Clean.
237. Pinecone (`pinecone`, kit, 1): Clean.
238. Real pencil (`pencil-real`, scan, 1): Scan: sharp.
239. Boombox (`boombox`, scan, 1): Scan: sharp.
240. Bamboo (`bamboo`, kit, 1): Clean.
241. Looped transformer (`looped-transformer`, kit, 1): Diagram sharp.
242. Horse statue (`horse-statue`, scan, 1): Scan: sharp.
243. Carrot cake (`carrot-cake`, scan, 1): Scan: sharp.
244. Vintage camera (`vintage-camera`, scan, 1): Scan: sharp.
245. Pool ball (`pool-ball`, kit, 1): Clean.
246. Tardigrade (`tardigrade`, kit, 1): Clean.
247. Tomatoes (`tomatoes`, scan, 1): Scan: sharp.
248. Volleyball (`volleyball`, kit, 1): Clean.
249. Möbius strip (`mobius`, kit, 1): Clean.
250. Bowling ball (`bowling-ball`, kit, 1): Clean.
251. Softball (`softball`, kit, 1): Clean.
252. Rubber duck (`rubber-duck`, kit, 1): Clean.
253. Neuron (`neuron`, kit, 1): Clean.
254. Water polo ball (`water-polo-ball`, kit, 1): Clean.
255. Basketball (`basketball`, kit, 1): Clean.
256. Pollen grain (`pollen`, kit, 1): Clean.
257. Marble bust (`marble-bust`, scan, 1): Scan: sharp.
258. Real croissant (`croissant-real`, scan, 1): Scan: sharp.
259. Moon (`moon`, kit, 1): Clean.
260. Neon knot (`knot`, kit, 1): Scan: sharp.
261. Diffusion model (`diffusion-model`, kit, 1): Noise by design.
262. Virus (`virus`, kit, 1): Clean.
263. Crystal lattice (`crystal-lattice`, kit, 1): Clean.
264. Pulsar (`pulsar`, kit, 1): Glow by design.
265. Mercury (`mercury`, kit, 1): Clean.
266. Blueberry (`blueberry`, scan, 1): Scan: sharp.
267. Menorah (`menorah`, kit, 1): Clean.
268. Donut (`donut`, kit, 1): Scan: sharp.
269. Lantern (`lantern`, scan, 1): Scan: sharp.
270. Trebuchet (`trebuchet`, kit, 1): Clean.
271. Protein (`protein`, kit, 1): Clean.
272. Orange (`orange`, kit, 1): Clean.
273. Bananas (`banana`, kit, 1): Clean.
274. Flying disc (`flying-disc`, kit, 1): Clean.
275. Venus (`venus`, kit, 1): Clean.
276. Gradient descent (`gradient-descent`, kit, 1): Clean.
277. Mars (`mars`, kit, 1): Clean.
278. Beating heart (`heart`, kit, 1): Clean.
279. Red blood cell (`red-blood-cell`, kit, 1): Clean.
280. Bouncy ball (`bouncy-ball`, kit, 1): Clean.
281. Cherries (`cherries`, kit, 1): Clean.
282. Cinnamon star cookie (`star-cookie`, scan, 1): Scan: sharp.
283. Heart cookie (`cookie`, scan, 1): Scan: sharp.
284. Torus knot (`torus-knot`, kit, 1): Clean.
285. Jack-o'-lantern (`jack-o-lantern`, kit, 1): Clean.
286. Jupiter (`jupiter`, kit, 1): Clean.
287. Pickleball (`pickleball`, kit, 1): Clean.
288. Pomegranate (`pomegranate`, scan, 1): Scan: sharp.
289. Beach ball (`beach-ball`, kit, 1): Clean.
290. Tennis ball (`tennis-ball`, kit, 1): Clean.
291. Lungs (`lungs`, kit, 1): Clean.
292. Grape (`grape`, scan, 1): Scan: sharp.
293. Neptune (`neptune`, kit, 1): Clean.
294. Surface plotter (`surface-plotter`, kit, 1): Clean.
295. Kidney (`kidney`, kit, 1): Clean.
296. Real rubber duck (`rubber-duck-real`, scan, 1): Scan: sharp.
297. Golf ball (`golf-ball`, kit, 1): Clean.
298. Pine tree (`pine`, kit, 1): Clean.
299. Jelly blob (`blob`, kit, 1): Scan: sharp.
300. Picture lab (`picture-lab`, kit, 1): Labs toy; not judged.
301. Wooden elephant (`wooden-elephant`, scan, 1): Scan: sharp.
302. Dodgeball (`dodgeball`, kit, 1): Clean.
303. Lacrosse ball (`lacrosse-ball`, kit, 1): Clean.
304. Ping-pong ball (`ping-pong-ball`, kit, 1): Clean.
305. Splat equation (`splat-equation`, kit, 1): Labs toy; not judged.

## Notes

- `even: true` suits spheres, ellipsoids, lathes and `k.param` surfaces (including the packs'
  `revolve`, `quad` and parametric helpers). It makes a visible lattice on `k.cone`, uncapped
  `k.cylinder`, `k.box`-like helpers (`roundBox`) and on shapes that don't declare how many random
  numbers they use: the kit then uses a 3D sequence on a 2D surface. Declare `dims: 2` on a custom
  shape (the paper toys' `triShape` now does), or build a cone as a two-point lathe (the
  shuttlecock). `k.torus` (rejection sampling), `k.disc` and `k.tube` ignore it or spiral; an even
  torus is a `k.param` (`evenTorus()` in `src/packs/objects.js`), and a one-sided dial is a
  `k.param` disc.
- **The two-pixel cull.** The engine skips splats under about 2 screen pixels (`minPixelSize` 2,
  `minContribution` 3; `setPictureCulling` in `src/stage.js`). Raising a toy's density makes its
  splats smaller, so it looks sharper on a phone but thins out in 256 px thumbnails and small embeds
  (the kite at density 0.6 lost its bows in its thumbnail). Prefer even placement to more density,
  and check a 256 px render (`profile=high`) as well as the phone view.
- See-through surfaces placed exactly evenly (the Klein bottle's glass) show a moiré where front and
  back layers overlap. Nudge each even point by about half a cell (`nudgedEven()` in
  `src/packs/maths.js`, a fixed hash) to keep the coverage without the pattern.
- Interior splats fill the whole shape, so a face built just inside a solid (the clock's dial) has
  core splats in front of it: put the face at or outside the surface.
- Faint clouds: splats under about 1/255 alpha are dropped, so very faint big splats turn into
  blobs. Streaks along the light (`dir`, `stretch`) read as a light shaft.
- Tools (not committed; rewrite if needed): an audit script (render each toy at the phone tier on
  black and on white, measure see-through and speckle), a before-and-after phone pair renderer, and
  a helper that adds `even`/`opacity`/`jitter` to a recipe's `k.add` calls.

## Known issues

- The jelly's translucent body still has blotchy highlights; only its plate changed.
- The flying saucer changed only a little; its beam is still a soft, blotchy cloud.
- The hockey puck and origami crane are small in their frames (the puck's hidden spray and the
  crane's pose set the fit); fixing that would change the tap's scale, so it was left.
- Thin chrome tubes (the cradle's rails, the lamp's springs) still speckle a little.

## For the Operator

- Engine idea (not made): the two-pixel cull hurts every dense kit toy in thumbnails and embeds. A
  lower `minPixelSize` for kit toys (as picture toys already get), or one that scales with the
  canvas size, would let the Lab lane test sharper, denser toys without holes at small sizes.
- The timing race in lane Studio Sound's song test is fixed on main ("Tests: the song test polls for
  the pause too"); the full suite on this branch with that main merged passed 356 of 356.
- Also seen once, then not again with a fresh server: `tests/smoke.spec.mjs`, "rigs pick splats by
  colour…" (the strawberry had not settled 3 s after its tap). It passed on this branch in two later
  runs.
- A PACKS.md lesson: the `even: true` notes above (which shapes take it, the lattice, `dims: 2`) and
  the two-pixel cull.
