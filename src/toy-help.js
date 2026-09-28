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
  cactus: {
    howTo: "Tap it to open a ring of flowers around its top.",
    about:
      "A cactus is a plant built to live where rain is rare. Its thick green stem stores water, and its spines are leaves that have changed shape: they shade the stem and keep hungry animals away. The stem, not leaves, does the work of turning sunlight into food.\n\nTap it and nine magenta flowers open one after another in a ring around the top, then close again. Many cacti bloom for only a few days a year, and some flowers open for just one night.",
  },
  strawberry: {
    howTo: "Tap it to pop out its seeds.",
    about:
      "A strawberry is not quite a berry. The red part is the swollen tip of the flower's stem, and the tiny yellow specks on the outside are its real fruits, each holding one seed. A single strawberry carries about 200 of them.\n\nTap it and the seeds pop out in a wave and glow, the red flesh blushes deeper, and then everything settles back. Strawberry plants spread by sending out runners, long thin stems that take root and grow new plants.",
  },
  cookie: {
    howTo: "Tap it to make the jam heart beat.",
    about:
      "A jam cookie like this one is two thin, crumbly cookies with a layer of fruit jam between them. The top cookie has a heart cut out of it, so the red jam shows through like a window.\n\nTap it and the jam heart glows and swells twice, like a heartbeat, in time with two soft thumps. Cookies with a window of jam are baked in many countries, often for holidays, and the top is often dusted with powdered sugar.",
  },
  bee: {
    howTo: "Tap it to make it buzz its wings and lift off.",
    about:
      "Honeybees live together in large colonies of tens of thousands, with one queen who lays the eggs. Worker bees fly from flower to flower drinking nectar and gathering pollen, and back at the hive they turn the nectar into honey. As they go, they carry pollen between flowers, which helps plants make fruit and seeds.\n\nTap it and its wings buzz in a blur as it lifts off, tilts and lands again. A honeybee's wings beat about 200 times a second: that is what makes the buzz.",
  },
  "cluster-fly": {
    howTo: "Tap it to make it groom its legs and face.",
    about:
      "Cluster flies are a little larger than house flies, with golden hairs on their backs. They get their name from the way hundreds of them gather in attics and window frames in autumn to wait out the winter. Their young live in the soil, feeding on earthworms.\n\nTap it and it grooms like a real fly: the front legs rub together, reach up and wipe its face while its head dips, and then it gives a little shake. Flies clean themselves often because their legs and eyes need to stay free of dust to taste and see.",
  },
  "may-beetle": {
    howTo: "Tap it to lift its wing cases and fan its antennae.",
    about:
      "The May beetle, or cockchafer, is a big brown beetle that flies on warm evenings in late spring. Its hard wing cases cover a pair of thin flying wings folded underneath, and its antennae end in little fans that it spreads to smell the air.\n\nTap it and the wing cases lift and part with a shiver, and the fans spread, then everything folds away again. A cockchafer lives most of its life underground as a white grub, eating roots for three or four years before it digs out as a beetle.",
  },
  millipede: {
    howTo: "Tap it to send a wave down its legs.",
    about:
      'A millipede is a long, slow animal with a body made of many rings, and most of the rings carry two pairs of legs. The name means "thousand feet," though most kinds have far fewer. Millipedes munch on dead leaves and rotting wood, which helps turn them back into soil.\n\nTap it and a wave ripples down its legs as it stretches out straight, then it curls up tighter and relaxes. The leggiest millipede known, found in Australia in 2021, has more than 1,300 legs.',
  },
  bumblebee: {
    howTo: "Tap it to make it hover.",
    about:
      "This is a brown-banded carder bumblebee, a small, fuzzy bumblebee of Europe's grassy meadows. Carder bees make their nests on the ground in thick grass and cover them with bits of moss and grass that they comb into place.\n\nTap it and the fuzzy body shivers, the wings hum, and it hovers up with a slow, clumsy wobble before settling down. Bumblebees can shiver their flight muscles to warm up, so they can fly on cool mornings when many other bees stay home.",
  },
  raspberry: {
    howTo: "Tap it to drop its drupelets and put them back.",
    about:
      "A raspberry is made of many tiny round fruits called drupelets, each with its own juicy skin and one small seed inside. They grow stuck together around a soft core. When you pick a raspberry the core stays on the plant, which is why the berry is hollow.\n\nTap it and the drupelets break off one after another, tumble to the table and hop back into place. A drupelet only grows if its own part of the flower got pollen, so bees help make a full, round berry.",
  },
  blackberry: {
    howTo: "Tap it to burst off its drupelets.",
    about:
      "A blackberry, like a raspberry, is a cluster of many tiny, shiny fruits called drupelets, each with a seed inside. Blackberries grow wild on thorny, tangled bushes called brambles, and ripen from green to red to deep black.\n\nTap it and half the glossy drupelets burst off, bounce on the table and glint, then spring back. Unlike a raspberry, a blackberry keeps its soft white core when you pick it, so it is solid all the way through instead of hollow.",
  },
  blueberry: {
    howTo: "Tap it to peel back its skin.",
    about:
      "Blueberries are small round berries that grow on bushes and first come from North America. A fresh one wears a dusty, pale coat called bloom: a thin layer of wax the berry makes to protect itself. At the bottom sits a little five-pointed crown, the leftover end of the flower.\n\nTap it and the dark skin peels back toward you in five strips to show the pale green flesh, then closes again. Almost all the blue is in the skin; the inside of most blueberries is pale.",
  },
  grape: {
    howTo: "Tap it to peel back the skin.",
    about:
      "A real grape, captured from many photos and drawn with many thousands of tiny, soft splats. Grapes grow in bunches on woody vines; people eat them fresh, dry them into raisins and press them for juice.\n\nTap it and four strips of the dark skin peel back from the stem end to show the pale flesh underneath, then the skin closes again. The color of a grape is almost all in its skin: under it, the flesh of red and green grapes alike is pale and see-through.",
  },
  "star-cookie": {
    howTo: "Tap it to crumble it and put it back together.",
    about:
      "Cinnamon stars are small star-shaped cookies baked at Christmas, above all in Germany, Switzerland and Austria. They are made with ground almonds or hazelnuts, sugar, egg whites and cinnamon, with no flour, and are topped with a crisp white glaze of beaten egg white and sugar.\n\nTap it and it crumbles into pieces and crumbs that fall away, then puts itself back together. The glaze goes on before baking, and a low oven keeps it snowy white.",
  },
  tomatoes: {
    howTo: "Tap it to make the tomatoes hop and rock.",
    about:
      "Tomatoes are the fruit of a plant that first grew wild in western South America. They are cooked and eaten like vegetables, but to a botanist a tomato is a berry: a juicy fruit that grows from a flower and holds many seeds.\n\nTap it and the plate gives a little shake: a wave of small hops runs around it, and the tomatoes land in four groups, rock outward and settle with a wobble. There are thousands of kinds of tomato, from tiny cherry tomatoes to ones bigger than a fist, in red, yellow, orange, green and purple.",
  },
  mandeltorus: {
    howTo: "Tap it to spin its rings opposite ways.",
    about:
      'The mandeltorus is a fractal: a shape whose small parts repeat the pattern of the whole, over and over, smaller and smaller. It is a piece of math art, made by a computer from a formula related to the Mandelbrot set and bent into a ring, or torus.\n\nTap it and its rings turn opposite ways in bands with a cyan glow, then lock back into place. The mathematician Benoit Mandelbrot made up the word "fractal" in 1975; fractal patterns turn up in nature too, in ferns, coastlines and snowflakes.',
  },
  basket: {
    howTo: "Tap it to shake the shells.",
    about:
      "A woven basket full of seashells from the beach: sea urchins, sand dollars, starfish and a scallop. Baskets are made by weaving strips of plants, like willow, reed or grass, over and under each other, and people have woven them for thousands of years.\n\nTap it and the basket shakes: ten of the biggest shells bounce up one after another, spinning, and drop back. A sand dollar is a kind of flat sea urchin; alive, it is covered in short, soft spines that it uses to move through the sand.",
  },
  "rubber-duck-real": {
    howTo: "Tap it to squeeze it.",
    about:
      "The rubber duck is a bath toy: a hollow yellow duck that floats. Squeeze it and air rushes out through a tiny hole in its base, which often holds a small whistle that squeaks.\n\nTap it and it squeezes flat with a high squeak, then springs back up taller, wobbles and settles. Most bath ducks today are made of soft plastic rather than real rubber, but the name has stuck.",
  },
  "garden-gnome": {
    howTo: "Tap it to make it hop and light its lantern.",
    about:
      "Garden gnomes are little statues of bearded men in pointed hats, set among the flowers to look after the garden. In old European tales, gnomes were small, shy folk who lived underground and guarded treasure. The first garden gnomes were made of clay in Germany in the 1800s.\n\nTap it and the gnome gives a little hop, and the lantern in its hand lights up with a warm glow, then goes out again. This one wears the classic outfit: a red cap, a white beard and a belt around a green shirt.",
  },
  "wooden-elephant": {
    howTo: "Tap it to raise its trunk and trumpet.",
    about:
      "A carved wooden elephant, the kind of figure woodcarvers have made for a very long time, shaped by hand with knives and chisels. Elephants are the largest animals on land. Their trunk is a nose and an upper lip joined together, strong enough to lift a log and gentle enough to pick up a single peanut.\n\nTap it and the trunk uncurls straight up to trumpet with a few toots, then curls back down while the elephant rocks on its feet. An elephant's trunk has no bones at all, but tens of thousands of muscles.",
  },
  "marble-bust": {
    howTo: "Tap it to make it turn and say hello in Latin.",
    about:
      'A bust is a statue of a person\'s head, neck and shoulders. The ancient Romans carved many busts of emperors, leaders and families in marble, a stone that is soft enough to carve but polishes to a smooth, pale shine.\n\nTap it and the head turns on its neck to look at you, the jaw moves with each syllable, and a speech bubble says "SALVE, AMICE!": Latin for "Hello, friend!" Latin was the language of ancient Rome, and many English words grew from it.',
  },
  ukulele: {
    howTo: "Tap it to strum a chord.",
    about:
      "The ukulele is a small, four-stringed guitar from Hawaii. It grew from little guitars that Portuguese settlers brought to the islands in the 1870s, and its name is often said to mean \"jumping flea,\" for the way a player's fingers hop over the strings.\n\nTap it and a pick sweeps across the strings four times, and each string shakes back and forth between the two ends where it is held. A string's note depends on how long, how tight and how heavy it is: a shorter, tighter string plays higher.",
  },
  "alarm-clock": {
    howTo: "Tap it to ring the bells.",
    about:
      'An old wind-up alarm clock runs on a spring: winding the key tightens the spring, and as it slowly unwinds it turns the gears and the hands. Two metal bells sit on top, and when the alarm goes off a little hammer rattles back and forth between them.\n\nThe red second hand ticks all the time. Tap it and the twin bells ring while the clock rattles across the table. Before alarm clocks were common, some people paid a "knocker-up" to tap on windows with a long pole and wake people for work.',
  },
  "vintage-camera": {
    howTo: "Tap it to take a photo with a flash.",
    about:
      "An old film camera. Inside, a roll of film coated with chemicals that change when light hits them sits behind the lens. Pressing the button opens a shutter for a split second, the lens lets in a picture of the world, and the film keeps it. Then a lever winds the film on to a fresh frame.\n\nTap it and the flash bursts, the whole scene whites out for a moment, and you hear the shutter click and the film wind on. Early cameras needed people to sit still for minutes; a modern shutter can open for less than a thousandth of a second.",
  },
  boombox: {
    howTo: "Tap it to play a beat.",
    about:
      "A boombox is a portable stereo: a radio, a cassette tape player and two big speakers in one box with a handle, run on batteries so music could go anywhere. They were hugely popular in the 1970s and 1980s, carried to parks, streets and beaches.\n\nTap it and it plays two bars of a beat: the speakers pump and glow blue on each kick drum, and the tape reels turn. A cassette holds a thin plastic tape covered in tiny magnetic grains, and the music is stored in the pattern of their magnetism.",
  },
  "croissant-real": {
    howTo: "Tap it to tear it open.",
    about:
      'A croissant is a flaky, buttery pastry shaped like a crescent moon, and "croissant" is the French word for crescent. Its dough is folded around a slab of butter again and again, which makes dozens of thin layers. In the hot oven, water in the butter turns to steam and puffs the layers apart.\n\nTap it and it tears in half to show the soft, layered inside, a puff of steam rises, and then it closes up again. Croissants are a favorite French breakfast, but the idea came to France from Vienna, in Austria.',
  },
  "carrot-cake": {
    howTo: "Tap it to lift out a slice.",
    about:
      "Carrot cake is a spiced cake made with grated carrots, which melt into the crumb and keep it soft and moist. It is often baked with cinnamon and nuts and topped with a thick, tangy cream cheese frosting.\n\nTap it and a slice facing you lifts out of the cake, showing the layers of crumb and frosting on its cut sides and in the gap. Carrots are sweet enough to bake with because they hold a lot of natural sugar, more than most other vegetables.",
  },
  pomegranate: {
    howTo: "Tap it to split it open.",
    about:
      "A pomegranate is a round fruit with a tough, leathery skin and a little crown on top. Inside, it is packed with hundreds of seeds, each wrapped in a juicy, jewel-red coat, in pockets separated by a thin, bitter, pale skin. It first grew in the lands around Iran and has been eaten for thousands of years.\n\nTap it and it splits open like a book on a hinge at the bottom, showing faces packed with glowing red seeds, and a few tumble out. People eat the juicy seed coats and often leave out the white skin.",
  },
  lantern: {
    howTo: "Tap to light the lantern; tap again to put it out.",
    about:
      "An old oil lantern, the kind people carried on farms, on boats and on camping trips before flashlights were common. A cloth wick soaks up oil from the tank at the bottom and burns at its tip, and the glass globe keeps the flame safe from the wind while letting the light out.\n\nTap it to light a flickering flame inside that warms the glass with an orange glow; tap again to put it out. A metal frame and a wire handle let it hang from a hook or swing from a hand.",
  },
  "cat-statue": {
    howTo: "Tap it to make it look around and mew.",
    about:
      "A concrete statue of a sitting cat, wearing a red collar with a little bell. Cats have lived alongside people for about 10,000 years, since farmers first stored grain and cats came to hunt the mice it drew. People have made statues of cats for thousands of years; in ancient Egypt, cats were loved and honored.\n\nTap it and the cat comes to life: its head turns right around to look at you, tilts one way as it mews and then the other way, and turns back. Its tail stays still.",
  },
  "horse-statue": {
    howTo: "Tap it to make it rear up.",
    about:
      "A white marble statue of a horse. Horses have been carved in stone for thousands of years, from ancient Greek temples to city squares. A real horse is strong and fast, and can sleep standing up: special locks in its legs hold it steady while it dozes.\n\nTap it and the whole horse above the base rears up onto its hind hooves, prances at the top and lands again with a small bounce. Horses rear up when they are startled or excited, or to show off to other horses.",
  },
  "pencil-real": {
    howTo: "Tap it to spin it on the desk. Pick its color under Look in the Toy tab.",
    about:
      'A wooden pencil. The "lead" inside is not lead at all but graphite, a soft gray form of carbon, mixed with clay and baked into a thin stick. More clay makes a harder, lighter line and less clay a softer, darker one; the letters on a pencil tell which: H for hard and B for black, with HB in between.\n\nTap it to flick it: it spins flat on the desk about its middle for two whole turns and slows to a stop where it began. Under Look in the Toy tab, pick yellow, red, blue, green, black, plain wood or the original scan.',
  },
  "tin-can-real": {
    howTo: "Tap it to knock it into a spin. Pick its label under Look in the Toy tab.",
    about:
      "A tin can is a steel can with a thin coat of tin that keeps it from rusting. Food is sealed inside and heated to kill germs, so it stays good for years. Cans were invented in the early 1800s, but a handy can opener came only about 50 years later; before that, people used a hammer and chisel.\n\nTap it to knock it onto its bottom rim: it spins around on the rim faster and faster, like a coin settling, and drops flat with a clank. Under Look in the Toy tab, pick a peaches label, a tomatoes label, plain metal or the original scan.",
  },

  // ---- Shapes -------------------------------------------------------------------------
  blob: {
    howTo: "Tap it to split it into three. Make a shape of your own in the Make tab.",
    about:
      "A wobbly jelly blob, built by the computer from a few rules rather than from photos. Thousands of splats, tiny soft blobs of color, are scattered over a lumpy round shape, and a pattern called noise gives it its bumps and swirls of candy color.\n\nTap it and it splits into three smaller blobs that wobble apart, then merge back with a jelly bounce. Real jelly wobbles because it is mostly water, held in a loose net of gelatin strands. In the Make tab you can pick a shape, a palette and a seed to build a blob of your own.",
  },
  donut: {
    howTo: "Tap it to break it apart and put it back together.",
    about:
      "A frosted donut with sprinkles, built by the computer from a simple ring shape. To a mathematician, a ring like this is a torus. In topology, the math of shapes that can stretch but not tear, a donut and a coffee mug count as the same shape, because each has exactly one hole.\n\nTap it and it snaps into chunks that fly apart and tumble, showing the dough inside, while the sprinkles spray off. Then it all flies back together. The Make tab builds shapes like this from a shape, a palette and a seed.",
  },
  knot: {
    howTo: "Tap it to make it twist and writhe.",
    about:
      "A glowing tube tied in a trefoil knot, the simplest true knot. Tie a knot in a string and join the two ends, and you get a loop that can never be untangled without cutting it; the trefoil crosses itself three times. Mathematicians study knots like this in a field called knot theory.\n\nTap it and waves of swelling loops run around the tube, lifting and twisting it as it glows pink, then it settles back into its trefoil. Real neon signs glow because electricity makes the gas inside the glass tube shine; pure neon glows red-orange.",
  },
  planet: {
    howTo: "Tap it to spin the clouds and sweep night across it.",
    about:
      "A tiny, made-up planet with blue seas, green and sandy land and white clouds, built by the computer from a sphere and a palette of planet colors. It is a tribute to the very first version of Splashery.\n\nTap it and the clouds race once around the planet while a band of night sweeps across it. Day and night happen because a planet spins: at any moment, the half facing its star has day and the other half has night. Earth turns once about every 24 hours.",
  },

  // ---- Space --------------------------------------------------------------------------
  sun: {
    howTo: "Tap it to set off a solar flare.",
    about:
      "The Sun is the star at the center of our solar system, a huge ball of hot, glowing gas. About 1.3 million Earths could fit inside it, and its light takes about 8 minutes to reach us.\n\nThis Sun churns by itself: bright cells of hot gas swell and fade, and loops of glowing gas called prominences rise and sink at its edge. Tap it to set off a solar flare: a loop of hot gas climbs off the top edge, swells, and its top breaks away into space. Real flares are sudden bursts of energy that can disturb radio signals on the Earth.",
  },
  "solar-system": {
    howTo: "Tap to line up the planets and watch Mercury cross the Sun.",
    about:
      "The solar system is the Sun and everything that circles it: eight planets, their moons, and many asteroids and comets. All the planets go around the Sun the same way, in orbits that lie nearly in one flat plane. The inner planets go around fastest: Mercury takes 88 days, Neptune about 165 years.\n\nThis is a model, spaced out so no two planets touch. Tap it and every planet swings into one row. The model tips until you look along its plane, and Mercury passes in front of the Sun as a small dark dot, which is called a transit. Then the planets spread out again. Real transits of Mercury happen about 13 times a century.",
  },
  mercury: {
    howTo: "Tap it to spin it fast in the sunlight.",
    about:
      "Mercury is the smallest planet and the closest to the Sun, a gray rocky world covered in craters, a little bigger than our Moon. It races around the Sun once every 88 days.\n\nTap it and it spins once, fast, while the side facing the Sun glows red-hot and shimmers, then cools. The real Mercury turns slowly, and it has almost no air to hold heat, so its day side gets hot enough to melt lead, about 430 degrees Celsius, while its night side drops to about minus 180 degrees.",
  },
  venus: {
    howTo: "Tap it to whip the clouds around.",
    about:
      "Venus is the second planet from the Sun and nearly the same size as the Earth. It is wrapped in thick yellowish clouds that trap heat, so it is the hottest planet of all, about 465 degrees Celsius at the ground, even hotter than Mercury.\n\nVenus spins backward compared with most planets, and very slowly, but its cloud tops race all the way around in about four Earth days. Tap it and the clouds whip around backward: the wide band at the middle goes around twice and the caps at the poles once, so the patterns stretch where they meet, then line up again.",
  },
  earth: {
    howTo: "Tap it to turn it through one day and night.",
    about:
      "The Earth is the third planet from the Sun and our home, the only world known to have life. Oceans cover about 71 percent of its surface, and it turns once on its axis about every 24 hours, which gives us day and night.\n\nTap it to turn it through one day, with the Sun off to the left. Night falls over one half, the globe turns once, and city lights come on as the land turns into the dark, then go out again at dawn.",
  },
  moon: {
    howTo:
      "Tap to land a lunar module; tap again to pack up and lift off. Pick the flag in the Toy tab.",
    about:
      "The Moon is the Earth's only natural satellite, a gray world of craters about a quarter as wide as the Earth. Its dark patches are wide plains of old, cooled lava. Its gravity is about one sixth of the Earth's, so things weigh much less there.\n\nTap it and a lunar module lands, an astronaut climbs down, bounds over in low-gravity hops and plants a flag, which you can pick in the Toy tab. Tap again and the astronaut packs up and lifts off. Between 1969 and 1972, twelve astronauts walked on the Moon.",
  },
  mars: {
    howTo: "Tap it to raise a dust storm.",
    about:
      "Mars is the fourth planet from the Sun, a cold, dry, rocky world about half as wide as the Earth. It looks red because its dust and rocks are full of iron that has rusted. It has two small moons, Phobos and Deimos, and the biggest volcano in the solar system, Olympus Mons.\n\nTap it to raise a dust storm: billowing orange dust sweeps across, hides the dark markings, then settles and clears. Real dust storms on Mars can grow until they cover the whole planet for weeks.",
  },
  jupiter: {
    howTo: "Tap it to race the cloud bands and spin up the Great Red Spot.",
    about:
      "Jupiter is the biggest planet, a giant ball made mostly of hydrogen and helium gas, with no solid surface to stand on. More than 1,300 Earths could fit inside it. Its stripes are bands of clouds blown by strong winds, and the Great Red Spot is a storm wider than the Earth that has raged for at least 150 years.\n\nTap it and the cloud bands race, each one the opposite way to its neighbors, while the Red Spot's swirl spins up; then it all settles. Jupiter spins faster than any other planet: a day there lasts about 10 hours.",
  },
  saturn: {
    howTo: "Tap it to send ripples across the rings.",
    about:
      "Saturn is the sixth planet from the Sun, a giant ball of gas with the brightest rings in the solar system. The rings are made of countless pieces of ice and rock, from specks of dust to chunks as big as a house, and they are very wide but mostly very thin.\n\nHere the rings turn all the time, the inner rings faster, as real ones do, with dark spokes and bright clumps that show the motion. Tap it to send two sparkling waves rippling out across the rings. Saturn is so light for its size that it would float in a big enough bathtub of water.",
  },
  uranus: {
    howTo: "Tap it to roll it on its side like a wheel.",
    about:
      "Uranus is the seventh planet from the Sun, an ice giant colored blue-green by methane gas in its air. It is tipped right over on its side, so it rolls around the Sun like a ball. In 1781 William Herschel found it, the first planet discovered with a telescope.\n\nHere its thin rings turn slowly all the time. Tap it and it rolls like a wheel, to the right and back again. A year on Uranus lasts about 84 Earth years, so each pole gets about 42 years of sunlight and then about 42 years of dark.",
  },
  neptune: {
    howTo: "Tap it to race the clouds around it.",
    about:
      "Neptune is the eighth and farthest planet from the Sun, a deep blue ice giant. It has the strongest winds in the solar system, faster than 2,000 kilometers an hour. It was the first planet found by math: astronomers worked out where it must be before they saw it in 1846.\n\nTap it and belts of white cloud race around it twice while a band with a dark storm drifts the other way. The spacecraft Voyager 2 saw a great dark storm like this when it flew past in 1989. Neptune takes about 165 years to go around the Sun once.",
  },
  "aurora-planet": {
    howTo: "Tap it for a burst of bright auroras.",
    about:
      "An aurora is the glowing light that ripples across the sky near the poles, called the northern and southern lights on Earth. It happens when particles from the Sun are steered by the planet's magnetic field toward the poles and hit the gases high in the air, making them glow, mostly green, with pink and violet at the top.\n\nThis is the night side of an Earth-like world, its pole tipped toward you, with town lights below. Its curtains of light move all the time. Tap it to set off a storm of light: the ring flares, and a wider curtain bursts out toward the equator, then calms.",
  },
  asteroid: {
    howTo: "Tap it to break it apart; its pieces pull back together.",
    about:
      "Asteroids are rocky leftovers from when the planets formed, about 4.6 billion years ago. Most circle the Sun in the main asteroid belt, between Mars and Jupiter. They come in all sizes, from small boulders to worlds hundreds of kilometers wide, and most are lumpy, not round.\n\nTap it and glowing cracks flash, then it falls apart into 18 pieces that drift off, tumbling, with a puff of dust. Then gravity pulls them back together. Some real asteroids are rubble piles like this: loose heaps of rock held together only by their own weak gravity.",
  },
  comet: {
    howTo: "Tap it to swing it past the Sun and flare its tails.",
    about:
      "A comet is a lump of ice, dust and rock, often only a few kilometers wide, that travels around the Sun on a long, stretched orbit. As it comes near the Sun, its ice turns to gas, making a glowing cloud around it called a coma, and two tails: a straight blue tail of gas and a curved, pale tail of dust. The tails point away from the Sun.\n\nTap it to swing it past the Sun: jets of gas burst from the sunny side, the coma swells, and both tails flare longer and brighter, then fade back. Halley's Comet comes back about every 76 years.",
  },
  meteor: {
    howTo: "Tap it to send it streaking in to burst in a fireball.",
    about:
      "A meteor, or shooting star, is the streak of light made when a bit of space rock rushes into the air at tens of kilometers a second and burns up. Most are no bigger than a grain of sand. A very bright one is called a fireball, and a piece that survives to reach the ground is a meteorite.\n\nTap it and it streaks in and bursts in a fireball, its rock flying apart in glowing pieces that burn out. Then the next one streaks in to take its place. Many tons of space dust fall on the Earth every day.",
  },
  star: {
    howTo: "Tap to run the star's life, sped up. Pick the kind of star in the Toy tab.",
    about:
      "A star is a huge ball of hot gas that shines because, deep in its core, it squeezes hydrogen into helium and gives off energy. Its color shows how hot it is: red stars are the coolest and blue stars the hottest. The Sun is a yellow star, about halfway through its life.\n\nTap it to run the life of a star like the Sun, sped up. It swells into a red giant, puffs off its outer layers as a glowing shell and shrinks to a tiny white dwarf; then a new star lights up. A real star like the Sun takes about 10 billion years to do this. Pick the kind of star in the Toy tab.",
  },
  pulsar: {
    howTo: "Tap it to spin it up. Set its spin speed in the Toy tab.",
    about:
      "A pulsar is a neutron star, the crushed core left after a giant star explodes. It is only about 20 kilometers across, the size of a city, yet it holds more matter than the Sun. It spins fast and sends out two beams of light from its magnetic poles.\n\nLike a lighthouse, it seems to flash each time a beam sweeps past. Tap it to spin it up until the flashes blur into a strobe, each with a tick, then it winds down. Set its spin speed in the Toy tab. The first pulsar was found by Jocelyn Bell Burnell in 1967, and the fastest spin hundreds of times a second.",
  },
  "black-hole": {
    howTo: "Tap it to feed it a star.",
    about:
      "A black hole is a place where gravity is so strong that nothing that crosses its edge, the event horizon, can get out again, not even light. Gas that falls toward it swirls into a flat disk and gets hot enough to glow.\n\nTap it to feed it a star: the star spirals in faster and faster, is stretched into a streak and plunges in, and the disk flares. In 2019 astronomers showed the first picture of a black hole's shadow, at the heart of the galaxy M87, made with radio telescopes spread across the Earth.",
  },
  "star-cluster": {
    howTo: "Tap it to make the cluster breathe in and out.",
    about:
      "A globular cluster is a ball of hundreds of thousands of stars held together by their own gravity, packed tightest at the middle. Its stars are very old, among the oldest in our galaxy, and the Milky Way has about 150 of these clusters circling it.\n\nTap it and the cluster breathes: it draws in, swells out and settles, the core first and the outer stars a moment later, while a wave of sparkle runs out from the middle. Near the middle of a real cluster, the stars are packed far more tightly than the stars around the Sun.",
  },
  "planetary-nebula": {
    howTo: "Tap it to blow out a new shell of gas.",
    about:
      "A planetary nebula is a glowing shell of gas puffed off by a dying star like the Sun. The hot little star left at the middle, a white dwarf, lights up the gas so it glows. The name is an old mistake: through early telescopes these round clouds looked a bit like planets, but they have nothing to do with planets.\n\nThis one is shaped like the Ring Nebula, about 2,500 light-years away. Tap it and the star at the middle flares and blows out a thin, bright ring of gas; when it reaches the main ring, the ring glows brighter and is pushed outward, then settles.",
  },
  nebula: {
    howTo: "Tap it to light new stars in the clouds. Pick its colors in the Toy tab.",
    about:
      "A nebula is a huge cloud of gas and dust in space. In some, gravity pulls the gas into clumps that heat up and become new stars, so they are called star nurseries. The young, hot stars light up the gas around them so it glows. Tall pillars of dust, like the famous Pillars of Creation in the Eagle Nebula, are places where stars are forming.\n\nTap it to light seven new stars, one after another, three at the tips of the pillars: each flares up with spikes and settles to a bright point in a glow of lit gas, then later fades. Pick its colors in the Toy tab.",
  },
  supernova: {
    howTo: "Tap it for a flash and a blast that blows the glowing shell apart.",
    about:
      "A supernova is the explosion of a star, one of the biggest blasts in the universe. For a few weeks one exploding star can shine brighter than a whole galaxy of billions of stars. It throws the star's gas out into space as a glowing, spreading shell.\n\nTap it and the core flashes and the shell flies apart in chunks that fade, then it glows back in place. Supernovas spread elements such as iron into space, where they end up in new stars and planets, and even in the blood in your body. People saw one in the year 1054; its remains are the Crab Nebula.",
  },
  "spiral-galaxy": {
    howTo: "Tap to swirl the arms. Pick a galaxy style in the Toy tab.",
    about:
      "A galaxy is a huge family of stars, gas and dust held together by gravity. In a spiral galaxy, bright arms curl out from a glowing center. Our own galaxy, the Milky Way, is a spiral about 100,000 light-years across with hundreds of billions of stars, and the Sun takes about 230 million years to go around it once.\n\nHere the spiral turns slowly as one piece while its stars orbit, the inner ones faster. The arms are like traffic jams that the stars pass through, so they keep their shape. Tap it to swirl the arms once around, fast, while the core flares. Pick the Milky Way or Andromeda style in the Toy tab.",
  },

  // ---- Tiny world -----------------------------------------------------------------------
  virus: {
    howTo: "Tap it to make copies that bud off and drift away.",
    about:
      "A virus is a tiny bundle of genes inside a shell of protein, far smaller than a bacterium. It cannot grow or copy itself on its own: it has to get inside a living cell, which then makes new copies of it. The spikes on its shell help it latch on to the right kind of cell.\n\nThis one's spikes sway gently. Tap it and a wave ripples through them, and two smaller copies bud out from behind it, drift apart and fade away. Most viruses are so small that only an electron microscope can show them.",
  },
  bacteriophage: {
    howTo: "Tap it to land and inject its DNA.",
    about:
      "A bacteriophage, or phage, is a virus that infects only bacteria, not people. It has a head full of DNA, a hollow tail and thin legs, and it lands on a bacterium a bit like a spacecraft landing on the Moon.\n\nTap it to play the injection: the legs swing out, the sheath around the tail snaps to about half its length, the tail pokes through the base plate and a glowing strand of DNA coils out. Phages are thought to outnumber the bacteria on Earth about ten to one, and doctors are studying them as a way to treat infections.",
  },
  bacterium: {
    howTo: "Tap it to make it divide in two. Try the Swim slider in the Toy tab.",
    about:
      "A bacterium is a living thing made of just one small cell, with no nucleus: its DNA floats inside it. This one is rod-shaped, with long whips called flagella that spin like propellers to push it along. Most bacteria are harmless, and many help us, like the ones in our gut that help digest food.\n\nTap it and it divides in two, as bacteria do: it pinches in at the middle as a new wall closes across it, its DNA is shared between the halves, and the two cells come apart. Then the toy slides them back together. Some bacteria can divide every 20 minutes.",
  },
  "red-blood-cell": {
    howTo: "Tap it to curl it into a sickle shape and back.",
    about:
      "Red blood cells carry oxygen from the lungs to every part of the body. Each is a soft disc, dented in on both sides, that bends to squeeze through the tiniest blood vessels. It has no nucleus and is packed with hemoglobin, the red protein that holds the oxygen.\n\nTap it and it sickles: it stretches and curls into a stiff crescent, then relaxes back into a disc. This happens in sickle cell disease, where a change in the hemoglobin makes cells stiffen when oxygen is low. The body makes millions of new red blood cells every second.",
  },
  neuron: {
    howTo: "Tap it to fire a signal. Try the Signal slider in the Toy tab.",
    about:
      "A neuron is a nerve cell, the kind of cell that carries messages around the brain and body. Its branching dendrites pick up signals, and a long wire called the axon carries them on to the tips, where they pass to the next cell.\n\nTap it to fire a signal: a bright spark runs from the cell body down the whole axon and bursts into light at the tips. Real nerve signals are tiny electrical pulses, and some travel at over 100 meters a second. The human brain has about 86 billion neurons.",
  },
  astrocyte: {
    howTo: "Tap it to send a calcium wave out along its arms.",
    about:
      'An astrocyte is a star-shaped cell in the brain and spinal cord; its name means "star cell." Astrocytes look after the neurons around them, and the ends of their arms, called end-feet, wrap around tiny blood vessels and help control how much blood flows by.\n\nAstrocytes pass messages to each other with waves of calcium, which scientists can watch with dyes that glow. Tap it to send one: a front of green light spreads from the middle out along every arm to the end-feet, and the blood vessel they hold widens for a moment. Faint waves pass by themselves now and then.',
  },
  "animal-cell": {
    howTo: "Tap it to divide it in two. Switch off the Cutaway in the Toy tab to see it whole.",
    about:
      "Cells are the tiny building blocks of every living thing, and the human body is made of tens of trillions of them. Inside an animal cell's soft skin, its membrane, are many parts: the nucleus holds the DNA, mitochondria make energy, and the Golgi packs up things the cell makes.\n\nA wedge is cut away so you can see inside. Tap it and the cell divides: the nucleus splits in two, then the cell pinches in two, sharing out its parts. Then the toy flows the two back into one. This is how bodies grow and repair themselves.",
  },
  dna: {
    howTo: "Tap it to unzip it and zip it back up.",
    about:
      "DNA is the long molecule that carries the instructions for building and running a living thing. It is shaped like a twisted ladder, a double helix: two strands wind around each other, joined by pairs of bases, A with T and C with G, like the rungs.\n\nTap it and it unzips almost to the bottom, the bases lighting up in pairs as it opens, then zips back up. A cell unzips its DNA like this to copy it. In 1953 scientists worked out its shape, helped by Rosalind Franklin's X-ray pictures. The DNA in one human cell would stretch about 2 meters if pulled straight.",
  },
  "white-blood-cell": {
    howTo: "Tap it to catch a bacterium and eat it up.",
    about:
      'White blood cells are the body\'s defenders: they find and clear away germs. This one is a neutrophil, the most common kind, which eats bacteria by wrapping itself around them. This is called phagocytosis, which means "cell eating" in Greek.\n\nTap it and a bacterium swims in from the side. The cell reaches out a cup of its skin around it, draws it inside and closes over it; then tiny grains inside the cell gather on it and break it down until it is gone. Élie Metchnikoff first saw cells eating germs like this, and won a Nobel Prize in 1908.',
  },
  microglia: {
    howTo: "Tap it to reach out its arms and sweep them to and fro.",
    about:
      "Microglia are the brain's cleaners and guards. They are small cells with thin, branching arms, spread all through the brain, and they keep moving their arms to check the space around them, clearing away waste and worn-out parts.\n\nThis one's six arms feel about gently all the time. Tap it and every arm stretches out, sweeps to and fro twice, and draws back in. Real microglia can sweep over their whole patch of brain in a few hours, and they help keep the connections between neurons tidy.",
  },
  diatom: {
    howTo: "Tap it to make the glass shell glint and open.",
    about:
      "A diatom is a tiny alga, a single cell that lives in a shell of glass. The shell comes in two halves that fit together like a box and its lid, and it is covered in rows of fine holes. Diatoms float in oceans, lakes and rivers, and use sunlight to make food.\n\nTap it and a glint of light runs across the glass, then the shell opens like a clam to show the golden cell inside, and closes again. Diatoms make about a fifth of the oxygen on Earth.",
  },
  tardigrade: {
    howTo: "Tap it to make it wiggle.",
    about:
      "Tardigrades, or water bears, are tiny animals, most about half a millimeter long, with a plump body and eight stubby legs that end in claws. They live all over the world, in moss, soil, ponds and the sea.\n\nWhen their home dries out, they pull in their legs, curl into a dry little ball called a tun and wait, sometimes for years, until water brings them back. In 2007 some were even taken into space on the outside of a satellite, and a few came back alive.",
  },
  pollen: {
    howTo: "Tap it to burst out a puff of tiny grains. Pick the Plant in the Toy tab.",
    about:
      "Pollen is a fine powder that flowers and cones make. Each tiny grain carries what a plant needs to make seeds, and wind, bees and other animals carry it from plant to plant. Its tough outer wall has a different pattern for every kind of plant.\n\nTap it and it bursts, as pollen can when it soaks up rain: it swells, then a puff of tiny grains jets out and drifts down. In the Toy tab, pick the plant: a spiky sunflower grain, a pine grain with two air sacs that help it float on the wind, or an oval lily grain.",
  },
  snowflake: {
    howTo: "Tap to melt it and grow a new flake. Pick the kind of crystal in the Toy tab.",
    about:
      "A snowflake starts high in a cloud, when water vapor freezes onto a tiny speck of dust and grows into an ice crystal. It has six sides because of the way water molecules fit together as they freeze. How cold and damp the air is decides its shape, from simple plates to feathery stars.\n\nTap it and the arms melt back to the middle, then a new flake grows out, a new pattern each time. In the Toy tab, pick the kind of crystal. In 1885 Wilson Bentley became the first person to photograph a single snowflake.",
  },
  chromosome: {
    howTo: "Tap it to pull its two halves apart.",
    about:
      "A chromosome is a long thread of DNA, wound up tight and packed small. Most human cells have 46 of them, in 23 pairs. Before a cell divides, each chromosome copies itself, and the two copies, called sister chromatids, stay joined at a pinched spot, the centromere, making an X shape.\n\nTap it to watch them part, as they do when a cell divides: thin fibers reach in from two bright poles, hook on at the middle and pull the two halves apart to either side, arms trailing. Then the toy puts them back together. This way each new cell gets a full set.",
  },
  mitochondrion: {
    howTo: "Tap it to power it up. Switch off the Cutaway in the Toy tab to see it whole.",
    about:
      "A mitochondrion is a tiny part inside a cell, often called the powerhouse of the cell. It uses oxygen to turn the sugar from food into ATP, the small molecule that carries energy to every part of the cell. Its inner skin is folded into ridges called cristae, which gives it lots of room to work.\n\nThe top is cut away to show the ridges. Tap it and light runs along them, it swells, and bright sparks of ATP pop out and drift off. Mitochondria even have their own DNA, which children get from their mothers.",
  },
  paramecium: {
    howTo: "Tap it to swim a loop. Try the Swim slider in the Toy tab.",
    about:
      "A paramecium is a living thing made of a single cell, shaped a bit like a slipper, that lives in ponds and puddles. It is covered in thousands of tiny hairs called cilia, which beat in waves like oars to row it through the water. A groove in its side sweeps in bacteria to eat.\n\nTap it and its cilia beat hard as it swims a full loop and comes back to where it was. A paramecium is just big enough to see with a magnifying glass, as a tiny moving speck.",
  },
  amoeba: {
    howTo: "Tap it to make it crawl over and back.",
    about:
      'An amoeba is a living thing made of one soft cell with no fixed shape. It lives in ponds and damp soil and moves by pushing out a bulge called a pseudopod, which means "false foot," and flowing into it. It eats by wrapping its body around bits of food.\n\nTap it and it crawls: a pseudopod pushes out to one side, the grains inside stream into it and the cell oozes over; then it pushes out the other way and oozes back. Even at rest, its pods stretch a little.',
  },

  // ---- Atoms ----------------------------------------------------------------------------
  orbital: {
    howTo: "Tap it to excite the electron. Pick another orbital, or lobes, in the Toy tab.",
    about:
      "An electron does not circle the center of an atom like a planet. It spreads out as a cloud, called an orbital, that shows where it is most likely to be found. Orbitals come in set shapes: a ball, a dumbbell, a dumbbell with a ring, and more. The two colors show the two halves of the electron's wave.\n\nTap it and a tiny packet of light, a photon, comes in. The electron takes it in, jumps up to a bigger orbital and glows, then drops back with a flash and gives the light out again. This is how glowing gases give off light of their own colors.",
  },
  atom: {
    howTo: "Tap it to speed up the electrons. Pick any of 44 elements in the Toy tab.",
    about:
      "Everything around you is made of atoms. Each one has a tiny heavy center, the nucleus, made of protons and neutrons, with electrons around it. The number of protons decides which element it is: carbon has 6, oxygen 8 and gold 79.\n\nThis model draws the electrons in rings called shells, an idea of Niels Bohr's from 1913; pick the Cloud style for a truer picture. Tap it and the electrons whirl faster until each shell blurs into a glowing ring, then slow down. The nucleus is tens of thousands of times smaller than the whole atom, which is mostly empty space.",
  },
  molecule: {
    howTo: "Tap it to heat it up. Pick a molecule, or type your own, in the Toy tab.",
    about:
      "A molecule is a group of atoms held together by chemical bonds. This one is a ball-and-stick model: each ball is an atom, colored by its element (carbon dark gray, hydrogen white, oxygen red, nitrogen blue), and each stick is a bond.\n\nIt starts as caffeine, C8H10N4O2, the stimulant in coffee and tea. The atoms always jiggle a little on their bonds, as real ones do; tap it to heat it up and they shake hard, the light hydrogens furthest, then it cools. In the Toy tab, pick another molecule, or type a name, a formula or a SMILES string (a way of writing a molecule on one line) to build your own.",
  },
  protein: {
    howTo: "Tap it to pull it apart. Pick a protein, or open your own file, in the Toy tab.",
    about:
      "Proteins are the tiny machines of living things. Each is a long chain of building blocks called amino acids that folds up into its own shape: coils called helices, flat strands and loops. Hemoglobin carries oxygen in the blood, insulin helps control sugar, and a jellyfish protein, GFP, glows green.\n\nThese are real shapes from the Protein Data Bank, a free library of well over 200,000 structures that scientists share. Tap it to pull it apart into its pieces and put it back; in GFP the glowing part lights up while it is open. You can open any PDB or mmCIF file from the library in the Toy tab.",
  },
  "crystal-lattice": {
    howTo: "Tap to send a wave through it. Pick salt, diamond, graphite or ice in the Toy tab.",
    about:
      "In a crystal, atoms are lined up in a pattern that repeats over and over, like tiles on a floor. In table salt, sodium and chlorine take turns in rows of little cubes. Diamond and graphite are both pure carbon: in diamond each atom holds on to four others, which makes it very hard, while graphite's flat sheets slide apart, which is why a pencil writes.\n\nTap it to send a wave through it: a ripple runs across, each slice of atoms rising and falling in turn. Sound and heat travel through solids as waves like this. In ice, the water molecules spread out into an open pattern, so ice floats on water.",
  },

  // ---- Gems -----------------------------------------------------------------------------
  diamond: {
    howTo: "Tap it to turn it in the light and flash its fire.",
    about:
      "A diamond is pure carbon, squeezed into a crystal deep underground by great heat and pressure, and carried up to the surface by volcanic eruptions long ago. It is the hardest natural material. This one has a brilliant cut, with dozens of small flat faces, called facets, to catch the light.\n\nTap it and it turns one way and the other, the way you would tilt a ring: facet after facet flashes with rainbow sparks. Jewelers call these colors fire. They come from the stone splitting white light into its colors, as a prism does.",
  },
  ruby: {
    howTo: "Tap it to make it glow deep red.",
    about:
      "A ruby is a red form of the mineral corundum, which is made of aluminum and oxygen. A little chromium in the crystal gives it its red color. Corundum is very hard, second only to diamond among gems, and in any other color it is called sapphire.\n\nThe chromium also makes rubies glow red under ultraviolet light. Tap it and the stone lights up deep red from its heart outward, throbs twice and fades. In 1960 the first laser was made with a rod of ruby.",
  },
  emerald: {
    howTo: "Tap it to send green light spiraling around its steps.",
    about:
      "An emerald is a green form of the mineral beryl, colored by tiny amounts of chromium or vanadium. Most emeralds have little specks and cracks inside them, and jewelers often cut them in rows of long, flat steps. That shape is so common for emeralds that it is called the emerald cut.\n\nA step cut works like a hall of mirrors. Tap it and green light races around the edges of the steps, each one a moment behind the one outside it, so the light spirals in to the flat top, the table. Some of the finest emeralds come from Colombia.",
  },
  "amethyst-geode": {
    howTo: "Tap to close the geode; tap again to open it.",
    about:
      "A geode is a rock with a hollow inside, lined with crystals. Over a very long time, water full of dissolved minerals seeped into the hollow, and the crystals slowly grew inward from the walls. Amethyst is purple quartz; its color comes from a little iron in the crystal.\n\nThe geode starts open. Tap it to close it; tap again and it opens, its halves swing wider, and the crystals glow violet with twinkling tips, then settle. Some amethyst geodes from Brazil and Uruguay are taller than a person.",
  },
  sapphire: {
    howTo: "Tap it to catch the six-rayed star gliding across it.",
    about:
      "A sapphire is the mineral corundum, the same as ruby, but colored blue by iron and titanium. Sapphires come in many colors, from yellow to pink, but blue is the best known. They are very hard, so they last a long time in rings.\n\nSome sapphires show a star of six rays, because tiny needles of another mineral inside reflect the light. The star is called an asterism, and it moves as the stone or the light moves. Tap it to catch the star: its rays spread out from a bright center, it glides across the top, and the rays draw back in at the far side.",
  },
  "quartz-cluster": {
    howTo: "Tap it to light the crystal points one by one.",
    about:
      "Quartz is one of the most common minerals in the Earth's crust, made of silicon and oxygen. Its crystals grow as six-sided columns with pointed tips, often many together in a cluster like this one. Clear quartz is also called rock crystal.\n\nTap it and the ten points light up one by one, from left to right, each glowing from inside with a glint at its tip and a rising chime. A tiny sliver of quartz shakes at a very steady beat when electricity runs through it, so it keeps time in many watches and clocks.",
  },
  opal: {
    howTo: "Tap it to tilt it and roll flashes of color across it. Pick an opal in the Toy tab.",
    about:
      "Opal is made of tiny balls of silica, the stuff of quartz and sand, packed in neat rows with a little water between them. When light passes through the rows, it splits into flashes of color that change as the stone moves. This is called play of color. Opal is cut into a smooth dome called a cabochon, not into facets.\n\nTap it and it rocks in the light while patches of color roll across it, changing as they go. In the Toy tab, pick a white, black or fire opal. Most of the world's opal comes from Australia.",
  },
  pearl: {
    howTo: "Tap to close the oyster; tap again to open it.",
    about:
      "A pearl is a gem made by a living animal. When a bit of grit or other irritant gets inside an oyster or mussel, the animal coats it with layer after layer of nacre, or mother-of-pearl, the same shiny stuff that lines its shell. The thin layers give a pearl its soft glow, called luster.\n\nThis oyster starts open, with its pearl inside. Tap it to close the shell; tap again to open it. A pearl can take years to grow, and most pearls sold today are grown on pearl farms.",
  },
  "crystal-ball": {
    howTo: "Tap it to swirl the mist and raise a glowing sign.",
    about:
      "A crystal ball is a ball of clear glass or quartz. In old stories, fortune tellers gaze into one to see visions of what is to come. A real clear ball also works like a lens: look through it and you see the room behind it, small and upside down.\n\nThis one is filled with glowing mist. Tap it and the mist whips around and thins, and a glowing sign rises out of it, turns once and fades: a star, a moon or a heart in turn. Pick the color of the mist in the Toy tab.",
  },

  // ---- Body -----------------------------------------------------------------------------
  heart: {
    howTo: "Tap it to set it racing. Set its beat, or pick a love heart, in the Toy tab.",
    about:
      "The heart is a muscle that pumps blood around the body. It has four chambers: the two atria on top fill with blood, then the two ventricles below squeeze it out, the right side to the lungs and the left side to the rest of the body.\n\nThis heart beats by itself, the atria first and then the ventricles. Tap it and it races, as it does when you run, then calms down again. A resting adult heart beats about 60 to 100 times a minute, which is about 100,000 beats a day.",
  },
  brain: {
    howTo: "Tap it to think. Try the Sparks slider in the Toy tab.",
    about:
      "The brain is the body's control center. Its wrinkled outer layer, the cortex, is folded so that a lot of it fits inside the skull, and it is split into lobes that do different jobs: the back handles seeing, the sides hearing and memory, the top touch, and the front moving, planning and deciding. It works by sending tiny electrical signals between about 86 billion nerve cells.\n\nTap it to spark a thought: light races along the folds of the lobe you tapped, then through the others, and every lobe flashes at once. The Sparks slider sets how many sparks twinkle over it, and the Toy tab can color it by lobe or plain pink.",
  },
  eye: {
    howTo: "Tap it to blink. Try the Pupil slider in the Toy tab.",
    about:
      "The eye is how we see. Light goes in through the pupil, the black hole in the middle, and a lens focuses it onto the retina at the back, which sends a picture to the brain. The colored ring around the pupil is the iris: its muscles make the pupil smaller in bright light and bigger in the dark.\n\nThis eye glances around by itself. Tap it and it blinks, turns to look at you and snaps its pupil small. The Pupil slider sets how wide the pupil is, and you can pick the iris color. People blink about 15 to 20 times a minute, which keeps the eye wet and clean.",
  },
  lungs: {
    howTo: "Tap for a deep breath. Try the Breath slider in the Toy tab.",
    about:
      "The lungs are two spongy organs in the chest that bring air into the body. Air comes down the windpipe, splits into two tubes and branches into smaller and smaller airways that end in millions of tiny air sacs, where oxygen passes into the blood and carbon dioxide passes out.\n\nThese lungs breathe gently by themselves. Tap for a deep breath: both lungs swell out, hold, then empty further than usual and settle back into their rhythm. The Breath slider sets how deeply they breathe at rest. An adult at rest takes about 12 to 20 breaths a minute.",
  },
  tooth: {
    howTo: "Tap it to polish it until it sparkles.",
    about:
      "A tooth is made in layers. On the outside is enamel, the hardest material in the whole body. Under it is a softer, yellowish layer called dentin, and in the middle is the pulp, with the nerves and blood vessels. Roots hold the tooth in the jawbone.\n\nThis is a molar, one of the wide back teeth that grind food. Tap it to polish it: a bright sheen wipes across, star sparkles pop where it passes and twinkle while it gleams. Pick the enamel's color in the Toy tab. Children have 20 baby teeth, and adults usually have 32.",
  },
  kidney: {
    howTo: "Tap it to pump blood through it.",
    about:
      "The kidneys are two bean-shaped organs, each about the size of a fist, tucked in the back just below the ribs. They clean the blood: they filter out waste and extra water, which leave the body as urine, and send the clean blood back.\n\nTap it to pump three pulses of blood through: each comes in along the artery as light, spreads through the kidney as it swells a little, leaves along the vein, and a drop runs down the ureter, the tube to the bladder. Together, the kidneys filter all the body's blood many times a day.",
  },

  // ---- Nature ---------------------------------------------------------------------------
  oak: {
    howTo: "Tap it to shake down its leaves. Pick a season in the Toy tab.",
    about:
      "The oak is a big, broad tree with a thick trunk and wavy-edged leaves, and its seeds are acorns. Oaks grow slowly and can live for hundreds of years. A single old oak is home to hundreds of kinds of insects, birds and other animals.\n\nTap it and the crown rocks on its trunk, and leaves come loose one by one and flutter down to the grass; then fresh leaves open in their place. In the Toy tab, pick spring, summer, autumn or winter, or a Seed for a different tree. In winter some oaks keep a few dead brown leaves on their twigs, and those are the ones that fall.",
  },
  pine: {
    howTo: "Tap it to shake the snow off. Turn on Snow in the Toy tab for a snowy day.",
    about:
      "A pine is an evergreen tree: it keeps its long, thin needles all year, and its seeds grow inside woody cones. Its sloping branches help heavy snow slide off instead of breaking them, so pines grow well in cold, snowy places.\n\nTap it and the tree rocks, and the snow on its boughs drops off from the top down in puffs of powder, lies on the ground and melts. On a day without snow, a quick shower dusts the branches first. With Snow on in the Toy tab, fresh snow settles on the boughs again afterward.",
  },
  palm: {
    howTo: "Tap it to shake down the coconuts.",
    about:
      "The coconut palm grows on warm, sandy coasts all around the tropics. It has no branches: its tall, bendy trunk ends in a crown of giant feathery leaves, called fronds, with the coconuts hanging in bunches beneath them.\n\nTap it and the crown shakes, and the five coconuts drop one after another, thump into the sand, bounce and roll to a stop; then new green coconuts swell in the crown. A coconut can float, so it can drift across the sea for weeks and sprout on a faraway beach.",
  },
  "cherry-blossom": {
    howTo: "Tap it to shake down the blossom and watch it bloom again.",
    about:
      'Cherry trees flower in spring, covering their bare branches in clouds of pale pink blossom before the leaves come out. In Japan, where the blossom is called sakura, people gather under the trees for picnics to enjoy it, a custom called hanami, which means "flower viewing."\n\nTap it and every blossom drops in a flurry of petals that settle on the grass, then the bare branches bloom again. Pick a Seed in the Toy tab for a differently shaped tree. The blossom only lasts a week or two, which is part of why people treasure it.',
  },
  maple: {
    howTo: "Tap it to send a gust whirling through. Pick the leaf color in the Toy tab.",
    about:
      "The maple is a tree known for its leaves with pointed lobes, which turn fiery red, orange and gold in autumn. Leaves are green in summer because of chlorophyll, the stuff that catches sunlight; in autumn the tree stops making it, and the other colors show through. Its seeds have wings and spin down like little helicopters.\n\nTap it and a whirling gust tears leaves off and carries them around the tree in a widening spiral before they settle in a ring on the grass; then fresh leaves open. Maple syrup is made by boiling down maple sap: about 40 liters of sap make 1 liter of syrup.",
  },
  bonsai: {
    howTo: "Tap it to grow a new branch, then trim it.",
    about:
      "A bonsai is a real tree kept small by careful growing in a shallow pot. Its keeper trims the branches and roots and shapes the trunk, sometimes for many years, so it looks like a tiny old tree from the wild. The art grew in China and was refined in Japan.\n\nTap it and a new branch grows out of the trunk with a pad of leaves on its end; then a pair of bonsai scissors slides in and snips it off, the cut piece drops onto the moss and is cleared away, and the stub heals over. Pick the pot's color in the Toy tab. Some bonsai trees are hundreds of years old.",
  },
  willow: {
    howTo: "Tap it to send a breeze through the hanging branches.",
    about:
      "The weeping willow is a tree whose long, thin branches hang down almost to the ground like a curtain. It loves water and often grows on the banks of rivers and ponds. Its branches are so bendy that people have long woven them into baskets.\n\nThe strands sway gently by themselves. Tap it to send a breeze across from the left: the hanging strands swing away with it a curtain at a time, bending most at their tips, then swing back and settle while the crown leans a little. Pick a Seed in the Toy tab for a different tree.",
  },
  sunflower: {
    howTo: "Tap it to bring out the sun and watch the flower turn to face it.",
    about:
      "A sunflower's big head is not one flower but many: the dark middle is packed with hundreds of tiny flowers that each become a seed, and the yellow petals around the edge belong to flowers of their own. The seeds grow in spirals that curve both ways.\n\nThe head nods gently at rest. Tap it to bring out the sun at the top left: the head turns up to face it and its petals spread wide open; then the sun goes in, the head turns back and the petals lift again. Young sunflowers really do follow the Sun, turning from east to west during the day.",
  },
  rose: {
    howTo: "Tap it to open the bloom. Pick its color in the Toy tab.",
    about:
      "The rose is one of the best-loved flowers in the world, grown in gardens for thousands of years for its soft, layered petals and its scent. There are thousands of kinds, in almost every color. The sharp points on its stems, often called thorns, help it climb and keep animals from eating it.\n\nTap it and the bloom opens further, every petal turning outward, and one outer petal comes loose and flutters down to the grass. Then the bloom closes again and a new petal fills the gap. After the flowers fade, many roses grow round red fruits called hips.",
  },
  dandelion: {
    howTo: "Tap it to blow the seeds away.",
    about:
      'A dandelion starts as a bright yellow flower. When it is done flowering, it turns into a round, fluffy seed head called a clock. Each seed hangs from its own tiny parachute of soft white hairs, so the wind can carry it far away to grow a new plant.\n\nTap it to blow: a gust bends the stalk, the seeds fly off and drift away, and then the seed head grows back. A single clock holds about 150 to 200 seeds. The name comes from the French for "lion\'s tooth," after the jagged edges of its leaves.',
  },
  tulip: {
    howTo: "Tap it to open the tulips to the sun. Pick their color in the Toy tab.",
    about:
      "Tulips are spring flowers that grow from bulbs, each stem holding one cup-shaped flower. They first grew wild in the mountains of Central Asia. In the Netherlands in the 1600s, tulip bulbs became so prized that a single rare bulb could cost as much as a house.\n\nTap it and the three tulips open wide to the sun one after another, each petal turning out to show the dark stamens and the pale pistil inside, then they close up again. Real tulips open like this in warm sunshine and close again in the cool of the evening.",
  },
  daisy: {
    howTo: "Tap it to spin the big daisy: loves me, loves me not.",
    about:
      'A daisy looks like one flower, but its yellow middle is made of many tiny flowers, and each white petal around it is a flower too. The name comes from the old words "day\'s eye," because many daisies open in the morning and close at night.\n\nTap it and the big daisy spins like a pinwheel, twice around, flinging off eight petals one after another while the small ones bob; then new petals fill the gaps. It plays the old game of pulling off petals one by one: "loves me, loves me not," and the last petal gives the answer.',
  },
  lotus: {
    howTo: "Tap it to lift the flower out of the water and open it.",
    about:
      "The lotus is a water plant that roots in the mud at the bottom of ponds and holds its big round leaves and flowers above the water. Its leaves are covered in tiny waxy bumps, so water rolls off in beads and carries the dirt away with it. Lotus seeds can last a very long time: one more than 1,000 years old has sprouted.\n\nTap it and the flower folds into a bud, rises out of the water on its stalk as a ring of ripples spreads, and opens wide in the air, the outer petals first. Then it sinks back onto its leaf, still open.",
  },
  mushroom: {
    howTo: "Tap the big cap to puff out a cloud of spores.",
    about:
      "These red toadstools with white spots are fly agarics, perhaps the most famous mushrooms of fairy tales. A mushroom is the part of a fungus that pops up above ground; most of the fungus is a web of fine threads hidden in the soil. Fly agarics are poisonous, so they are for looking at, not eating.\n\nTap it and the big cap dips and springs back, and a cloud of glowing spores puffs out from the gills underneath and drifts away. Spores are how a fungus spreads, like tiny seeds, and one mushroom can let out billions of them. Pick the cap's color in the Toy tab.",
  },
  fern: {
    howTo: "Tap it to unroll the fiddleheads into new fronds.",
    about:
      "Ferns are some of the oldest plants on Earth: they grew long before the dinosaurs, and they still grow in shady woods today. They have no flowers or seeds. Instead they spread by spores, tiny specks that grow in brown dots under their leaves, which are called fronds.\n\nEach new frond starts as a tight coil called a fiddlehead, because it looks like the curled end of a violin. Tap it and the two fiddleheads in the middle unroll into new fronds, joint by joint from the base to the tip, then roll back up. Pick a Seed in the Toy tab for a different fern.",
  },
  saguaro: {
    howTo: "Tap for the spines, then a look inside. Set its arms and flowers in the Toy tab.",
    about:
      "The saguaro is a giant cactus of the Sonoran Desert in Arizona and Mexico. It grows very slowly but can reach about 12 meters tall and live for 150 years or more, and it may not grow its first arm until it is at least 50 years old. Its white flowers bloom on the tips in late spring.\n\nTaps take turns. The first shoots all the spines out and draws them back; the next slides a wedge out of the trunk to show the inside: wet, pale green flesh around a ring of woody ribs. Its pleats spread like an accordion to store water after rain. Set the number of arms and the flowers in the Toy tab.",
  },
  coral: {
    howTo: "Tap it to open the polyps and let the fish out.",
    about:
      "Corals may look like rocks or plants, but they are animals. Each coral is a colony of tiny soft polyps, each with a ring of tentacles, and together they build a hard skeleton of limestone. Over thousands of years, corals build reefs. Reefs cover a tiny part of the ocean floor but are home to about a quarter of all the kinds of sea life.\n\nTap it and the polyps open all over this staghorn coral, like tiny tentacled stars, and six little fish dart out of the reef, hover, turn and dart back in; then the polyps close. Pick a Seed in the Toy tab for a different reef.",
  },
  pinecone: {
    howTo: "Tap it to open the scales and drop them, then put it back together.",
    about:
      "A pinecone is the part of a pine tree that holds its seeds. Its woody scales are arranged in spirals, and under each one sit seeds with thin wings. In dry weather the scales open so the seeds can fall out and spin away on the wind; in wet weather they close up tight again.\n\nTap it and the cone opens as it does on a dry day, and winged seeds spin down like little propellers. Then the scales facing you break off one after another from the bottom up and tumble into a pile, showing the core. Then they fly back up into place and the cone closes.",
  },
  acorn: {
    howTo: "Tap it to pop the caps and sprout the acorns.",
    about:
      "An acorn is the nut of an oak tree, with a little scaly cap on top. Inside is a seed that can grow into a whole new oak. Squirrels and jays bury acorns to eat later and forget some of them, and those can sprout, so the animals help plant new oak forests.\n\nTap it and the caps pop off, flip through the air and land upside down on the leaf, and a green sprout pokes out of each acorn and opens two tiny leaves. Then the sprouts draw back in and the caps hop home. Pick an autumn or a green leaf in the Toy tab.",
  },
  succulent: {
    howTo: "Tap it to open the rosette and send up a flower.",
    about:
      "Succulents are plants with thick, fleshy leaves that store water, so they can live through long dry spells. This one grows in a rosette: a tight circle of leaves, like the petals of a rose, with new leaves coming from the middle.\n\nTap it and the rosette opens, every leaf tipping outward, and a flower stalk rises from the middle and arches over with little coral-colored bells; then it draws back and the rosette closes. Pick the color of the leaf tips in the Toy tab. Many succulents grow new plants from a single fallen leaf.",
  },
  bamboo: {
    howTo: "Tap it to make the new shoots grow up tall.",
    about:
      "Bamboo is a giant grass with tall, hollow stems split into sections by rings called nodes. It is one of the fastest-growing plants in the world: some kinds can grow almost a meter in a single day. People use its strong, light stems to build houses, scaffolding and furniture.\n\nThree young shoots sit on the ground. Tap it and they shoot up a section at a time, each new section sliding up out of the one below with a hollow knock, and a tuft of leaves opens at the top; later they sink back down.",
  },
  rocks: {
    howTo: "Tap to tumble and stack them. Pick a pile or a cairn in the Toy tab.",
    about:
      "Pebbles are small stones rounded smooth by water. As rivers and waves roll them over and over, knocking against sand and other stones, their sharp corners wear away, a process that can take hundreds or thousands of years. A cairn is a pile of stones stacked up by people, often to mark a trail.\n\nTap it and the pebbles roll out over the sand, then five of them hop one at a time onto a cairn, biggest at the bottom, with a clack each; at the end they all hop back. Pick a pebble pile or a cairn in the Toy tab, and a Seed for different stones.",
  },
  kelp: {
    howTo: "Tap it to bring fish in to nibble the kelp.",
    about:
      "Kelp is a giant seaweed, a kind of brown algae that grows in cool, shallow seas. It holds on to the rocks with rootlike grips, and little bulbs full of gas keep its long blades floating up toward the light. Kelp can grow so thick that it makes underwater forests, full of fish, snails, sea urchins and sea otters.\n\nThe kelp sways gently by itself. Tap it and three little fish swim in, each noses up to a blade for a few nibbles, and the kelp sways away from them, then swings back as they swim off. Giant kelp can grow more than half a meter in a day.",
  },

  // ---- Weather and fire -----------------------------------------------------------------
  campfire: {
    howTo: "Tap it to stoke the fire. Set the fire's size in the Toy tab.",
    about:
      "A fire needs three things: fuel to burn, heat to start it, and oxygen from the air. Take any one away and it goes out. The yellow and orange glow of the flames comes from tiny bits of soot, heated until they shine.\n\nThis campfire has logs leaning together in a ring of stones, on a bed of glowing embers. Tap it to stoke the fire and the flames leap up with more sparks, then settle down again. Set how big the fire is in the Toy tab. A ring of stones helps keep a real campfire from spreading.",
  },
  "storm-cloud": {
    howTo: "Tap for thunder. Try the Rain slider in the Toy tab.",
    about:
      "A thunderstorm cloud can tower more than 10 kilometers into the sky. Inside it, bits of ice and water crash together and build up electric charge, until a giant spark, lightning, jumps across. Lightning heats the air around it to about 30,000 degrees Celsius, hotter than the surface of the Sun, and the air bursts outward with the boom we call thunder.\n\nThis cloud rains and flashes with lightning by itself. Tap it for a big strike and a clap of thunder. Light travels much faster than sound, so count the seconds between flash and thunder: every 3 seconds is about 1 kilometer away.",
  },
  "lava-lamp": {
    howTo: "Tap to heat it up. Pick colors, blobs and flow in the Toy tab.",
    about:
      "A lava lamp is a glass bottle of liquid with blobs of colored wax inside, and a lamp in its base. When the wax is cool it is a little heavier than the liquid and rests at the bottom. The lamp warms it, the wax spreads out and gets lighter, and a blob rises; at the top it cools and sinks again.\n\nTap it to heat it up: the blobs move much faster, the wax glows and shifts color, and the liquid brightens, then it all eases back. In the Toy tab, pick a color set or your own colors, how many blobs, their size and shape, how fast they flow, and a glow from within.",
  },
  "snow-globe": {
    howTo: "Tap it to shake the globe and swirl the snow.",
    about:
      "A snow globe is a glass ball filled with water, with a little winter scene inside and white flakes that settle on the ground. Shake it and the flakes swirl up, then drift down slowly, because the water holds them back, like snow on a calm day.\n\nThis one holds a snowman with a hat, a scarf and a carrot nose, next to a snowy fir tree, and gentle snow falls all the time. Tap it to shake the globe: it wobbles, the snow swirls up and around, then settles. You can pick the color of the base in the Toy tab.",
  },
  volcano: {
    howTo: "Tap it to make it erupt.",
    about:
      "A volcano is an opening in the Earth's crust where melted rock, called magma, comes up from deep below. Once it reaches the surface it is called lava. Gas trapped in the magma can make an eruption explosive, blasting out ash and rock.\n\nTap it to make it erupt. Most volcanoes sit where the great plates of the Earth's crust meet, and about 1,350 on land may still erupt; many more lie hidden under the sea.",
  },
  "ice-statue": {
    howTo: "Tap to melt the swan and refreeze it. Try the Temperature slider in the Toy tab.",
    about:
      "An ice sculpture is carved from a big block of clear ice with saws, chisels and even small power tools. Clear ice is made by freezing water slowly, so the air bubbles can escape instead of turning it white. Swans are a favorite shape for parties, and whole towns of ice are built at winter festivals.\n\nTap it and the swan melts faster and faster: water drips into a spreading puddle, the beak wears away, the wing tips and the head crack off and fall in, and the body wears down to a lump. Then it freezes back, piece by piece, with a sweep of frost. The Temperature slider melts it partway and back.",
  },
  candle: {
    howTo: "Tap to blow out the candle; tap again to light it.",
    about:
      "A candle is a stick of wax with a string, the wick, down the middle. The flame's heat melts the wax, the melted wax soaks up the wick, and near the flame it turns into a gas, which is what really burns. The blue part at the bottom of a flame is the hottest.\n\nThis candle starts lit. Tap it to blow it out, and a thin trail of smoke rises from the wick; tap again to light it. A flame is shaped like a teardrop because its hot gases rise; in space, where nothing rises, a candle flame is a round, blue ball. You can pick the wax color in the Toy tab.",
  },
  tornado: {
    howTo: "Tap to spin it up. Set its power in the Toy tab.",
    about:
      "A tornado is a spinning column of air that reaches down from a thunderstorm to the ground. It is the most violent kind of storm on Earth: its winds can blow faster than 400 kilometers an hour, though most tornadoes are much weaker and last only a few minutes. The United States has more tornadoes than any other country, about 1,200 a year.\n\nTap it to spin it up: the funnel widens and whirls faster, dust boils up at its foot, and the planks, clods and leaves on the field are lifted one by one, spiral up around it, then fall back where they lay as it weakens.",
  },
  rainbow: {
    howTo: "Tap it to draw the rainbow again, color by color.",
    about:
      "A rainbow appears when sunlight shines into falling raindrops. Each drop bends the light, splits it into its colors and bounces it back out, so you see a rainbow when the Sun is behind you and rain is in front. Its colors always go in the same order: red on the outside, then orange, yellow, green, blue and violet on the inside.\n\nTap it and the arc blinks away, then draws itself again color by color, red first, each band sweeping from one cloud to the other behind a bright little pen. Then sparkles burst from both clouds. Seen from a plane, a rainbow can be a whole circle.",
  },
  iceberg: {
    howTo: "Tap it to break off a chunk into the sea.",
    about:
      "An iceberg is a huge piece of ice that has broken off a glacier or an ice shelf and floats out to sea. It is made of fresh water that fell as snow long ago. Ice is a little lighter than seawater, so an iceberg floats, but only about one tenth of it shows above the water.\n\nWhen a chunk breaks off, it is called calving. Tap it and a chunk cracks off, showing fresh pale ice, and tips into the sea with a splash of spray and rings of ripples. The chunk bobs, and the iceberg, now lighter, bobs and rocks. Then the chunk melts away and the toy grows it back.",
  },
  waterfall: {
    howTo: "Tap it to send a surge of water over the falls.",
    about:
      "A waterfall forms where a river runs over a steep drop, often where hard rock sits on top of softer rock. The falling water wears away the softer rock below, so over thousands of years many waterfalls slowly move back upstream. The tallest on Earth, Angel Falls in Venezuela, drops nearly 1 kilometer.\n\nTap it to send a surge: a front of white water runs along the river and over the edge, a thicker sheet of white water pours down the falls, foam spreads over the pool and a cloud of mist billows up, then it all calms again.",
  },
  "ocean-wave": {
    howTo: "Tap it to break the wave; a new one curls up behind it.",
    about:
      "Most ocean waves are made by wind blowing across the water, sometimes far out at sea. The wave's energy travels on, but the water itself mostly just rises and falls. Near the shore, the shallow bottom slows the wave, so it grows taller and steeper until its top curls over and breaks.\n\nTap it to break it: the top of the wave throws forward and crashes into the water in front, white water and spray burst up and foam spreads out as the wave flattens. Then a new swell rises behind, steepens and curls over. Surfers call the tube under a curling wave the barrel.",
  },
  geyser: {
    howTo: "Tap it to make it erupt.",
    about:
      "A geyser is a hot spring that now and then shoots water and steam high into the air. Deep underground, hot rock heats water trapped in narrow cracks until it boils and bursts up out of the hole. The word comes from Geysir, a famous geyser in Iceland.\n\nThis geyser bubbles by itself, with a bigger eruption every so often. Tap it to make it erupt, shooting up a plume of water in a cloud of steam. The bright colors around its pool are mats of tiny living things that love hot water. More than half of the world's geysers are in Yellowstone National Park.",
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
  lorenz: {
    howTo: "Tap to race along the path. Set the glow in the Toy tab.",
    about:
      "In 1963 the scientist Edward Lorenz made a very simple model of moving air: three short equations. He found that its path loops around two centers forever, never repeating and never crossing itself, in a shape like a pair of butterfly wings. This shape is called the Lorenz attractor.\n\nTap it and a bright spark races along the whole path, drawing it again in light that then fades. Two starting points that are almost the same soon follow very different paths. This is called chaos, or the butterfly effect, and it is why weather is so hard to forecast far ahead.",
  },
  mobius: {
    howTo: "Tap to send the rider round. Pick a rider in the Toy tab.",
    about:
      "A Möbius strip is a loop with a half twist in it. It has only one side and only one edge: a line drawn along its middle comes back to where it started without ever crossing an edge. It is named after August Möbius, who wrote about it in the 1850s. You can make one from a strip of paper and some tape.\n\nTap it and the rider goes along the middle of the band. After one lap it is underneath where it started, and after two it is back on top. Pick a race car, a beach ball, a duck on a bike or an ant in the Toy tab.",
  },
  "klein-bottle": {
    howTo: "Tap to send water through. Set the glow in the Toy tab.",
    about:
      "A Klein bottle is a surface with no inside and no outside. Its neck bends around and passes through its own side to join the bottom from within, so an ant crawling on it could reach every part of it without ever crossing an edge. Felix Klein described it in 1882. A true Klein bottle needs four dimensions; in our world its neck has to cut through the wall.\n\nTap it and a surge of glowing water pours in at the base, runs up the body, through the neck and around into the bottom, then fades. Set the glow, or pick the color of the glass, in the Toy tab.",
  },
  "menger-sponge": {
    howTo: "Tap to close and carve the holes. Pick the level in the Toy tab.",
    about:
      "A Menger sponge is a fractal. Start with a cube and cut it into 27 smaller cubes, like a puzzle cube. Take out the one in the middle and the six at the middle of each face, leaving 20. Then do the same to each of those 20 cubes, and again, forever. Karl Menger described it in 1926.\n\nTap it and every hole is plugged, the smallest first, until it is a plain cube. Then it is carved again: the big cubes slide out of the faces, then the next size down, then the smallest. Pick level 2 or 3 in the Toy tab: level 3 is made of 8,000 little cubes.",
  },
  hypercube: {
    howTo: "Tap to turn it inside out. Try the 4D turn slider in the Toy tab.",
    about:
      "A hypercube, or tesseract, is a cube in four dimensions. A square has 4 corners and a cube has 8; a tesseract has 16 corners and 32 edges, and its sides are 8 cubes. We can't see four dimensions, so this toy shows its shadow in our three: a cube inside a cube, with their corners joined.\n\nAt rest it rocks gently in 4D. Tap it to turn it once around through the fourth dimension: the pink inner cube swells out to become the outer one while the blue one folds inside, then it turns on back to where it started. Every edge stays perfectly straight the whole time.",
  },
  "torus-knot": {
    howTo: "Tap to pull it and let go. Pick another knot in the Toy tab.",
    about:
      "A torus knot is a knot that winds around the surface of a donut shape, called a torus. It goes around the hole a few times one way while it loops through it a few times the other way. The simplest is the trefoil, which winds 2 and 3 times; it is the simplest true knot, one that can never be untied without cutting it.\n\nTap it and the knot is pulled loose, its loops stretching and swirling; then it is let go and springs back past its rest shape and wobbles to a stop, like a spring. Pick a trefoil, a cinquefoil or another knot in the Toy tab.",
  },
  gyroid: {
    howTo: "Tap to make it breathe. Pick a cube or a ball in the Toy tab.",
    about:
      "A gyroid is a curving surface that splits space into two tangled mazes of tunnels that never meet. It has no straight lines and no flat parts, and it repeats forever in every direction. Alan Schoen, a scientist working for NASA, found it in 1970. Nature makes it too: tiny gyroid crystals in some butterfly wings give them their shiny green color.\n\nTap it and it breathes: the surface slides along itself, so one set of tunnels swells while the other narrows, then the other way, and it settles. In the Toy tab, cut it into a cube or a ball.",
  },
  mandelbulb: {
    howTo: "Tap it to turn its discs like the dials of a lock.",
    about:
      "The Mandelbulb is a 3D fractal, a cousin of the famous flat Mandelbrot set. It is made by repeating one short formula over and over for each point in space and keeping only the points that never fly away. Zoom in anywhere and there is more and more detail. It was found in 2009 by Daniel White and Paul Nylander.\n\nTap it and its seven slices turn like the dials of a combination lock, neighbors in opposite directions, then back again. Each turns one seventh of a turn, because the bulb looks the same after a seventh of a turn, so it lands on the same picture.",
  },
  sierpinski: {
    howTo: "Tap to explode it; tap again to put it back. Pick the level in the Toy tab.",
    about:
      "A Sierpinski tetrahedron is a fractal pyramid. It is made of four smaller copies of itself, each half as tall, and each of those is made of four smaller ones, and so on. It is the 3D cousin of the Sierpinski triangle, named after the mathematician Wacław Sierpiński, who described the triangle in 1915.\n\nTap it to explode it into its pieces; tap again to put it back together. Pick the level in the Toy tab: each level has four times as many little pyramids, so level 4 has 256 and level 5 has 1,024.",
  },
  platonic: {
    howTo:
      "Tap to explode it; tap again to put it back. Pick one of the five solids in the Toy tab.",
    about:
      "The Platonic solids are the only five shapes whose faces are all the same regular shape, meeting in the same way at every corner: the tetrahedron (4 triangles), the cube (6 squares), the octahedron (8 triangles), the dodecahedron (12 pentagons) and the icosahedron (20 triangles). They are named after the Greek thinker Plato, and Euclid proved there can be no others.\n\nIt starts as a dodecahedron. Tap it to explode its faces apart; tap again to put them back. Pick any of the five solids, and its colors, in the Toy tab. Many game dice come in these shapes.",
  },
  "seashell-spiral": {
    howTo: "Tap it to hear the sea in the shell.",
    about:
      "Many seashells grow in a spiral. As the animal inside grows, it adds new shell at the opening, each turn wider than the one before but the same shape, so the shell gets bigger without changing its form. Mathematicians call this a logarithmic spiral.\n\nPeople say you can hear the sea in a shell. Tap it and three soft swells of sea-blue light run down the spiral to the opening, and with each one a ripple rolls out of the mouth, widening and fading like a wave. The sound in a real shell is the noise around you, echoing inside it.",
  },
  "graph-plotter": {
    howTo: "Tap to draw the curve. Pick a curve, or type your own, in the Toy tab.",
    about:
      "A graph turns an equation into a picture. For y = x², every x along the bottom gets a height y, and joining them draws a curve. René Descartes wrote about this kind of grid in 1637. Curves can be drawn other ways too: by distance and angle (polar), or by following a moving point over time.\n\nTap it and a pen draws the curve across the grid, humming a note that follows its height; then the a slider sweeps and the curve bends with it. Pick one of 42 famous curves in the Toy tab, or type your own: y = … with x, r = … with θ, or x = …, y = … with t. Put a in it to see it bend.",
  },
  "surface-plotter": {
    howTo: "Tap to raise the surface. Pick one, or type your own, in the Toy tab.",
    about:
      "A surface plot is a graph in 3D. For each point on a flat floor, with its x and y, the equation gives a height z, so the graph becomes a landscape of hills, valleys and saddles. Colors show how high each part is.\n\nTap it and the surface lies flat, then rises out of the sheet and ripples, twists or breathes as a number called a changes. Pick one of 16 famous surfaces in the Toy tab, such as the sombrero, the saddle or Rosenbrock's banana valley, which is used to test computer methods that hunt for the lowest point. Or type your own: z = … with x and y, or with r and θ.",
  },
  "unit-circle": {
    howTo: "Tap to send the point round. Try 3D, or type your own path, in the Toy tab.",
    about:
      "The unit circle is a circle with a radius of 1. As a point goes around it, turning through an angle called θ, its height is the sine of θ and its left-right place is the cosine. Traced out over time, they make two waves, the same shapes as sound and light waves.\n\nTap it and the point goes once around while its height draws the sine wave and its left-right place draws the cosine wave. For the circle, Euler's formula, e^(iθ) = cos θ + i sin θ, lights up piece by piece. In the Toy tab, try a 3D helix, another path, up to three turns, or type your own: x = …, y = … with t, or r = … with θ.",
  },
  "fourier-circles": {
    howTo: "Tap to spin the circles. Type a word or a curve in the Toy tab.",
    about:
      "Circles turning on circles can draw any closed shape. Each circle spins a whole number of times per loop while riding on the rim of the one before, and the tip of the last one traces the drawing. This is a Fourier series, named after Joseph Fourier, who showed in the early 1800s that repeating patterns can be built by adding up simple waves.\n\nTap to spin them and watch the shape drawn again. Few circles draw a wobbly shape and many draw a crisp one: set how many in the Toy tab, pick a heart, a star or a square wave, stack them in 3D, or type a word and each letter gets its own chain of circles.",
  },
  "pythagoras-proof": {
    howTo: "Tap it to slide the triangles and show that a² + b² = c².",
    about:
      "In a right triangle, the two short sides a and b and the long side c always fit a rule: a² + b² = c². So a square drawn on the long side has the same area as the squares on the two short sides put together. It is named after Pythagoras, a Greek thinker of about 2,500 years ago, though people in Babylon knew it even earlier.\n\nThis is one of the oldest proofs. Four copies of the triangle fill a big square, leaving two empty squares, a² and b². Tap it and the triangles slide into the corners, and the empty space becomes one tilted square, c², so a² + b² must equal c². Then they slide back.",
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
