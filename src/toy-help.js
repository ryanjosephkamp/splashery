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
      "An old film camera. Inside, a roll of film coated with chemicals that change when light hits them sits behind the lens. Pressing the button opens a shutter for a split second, the lens lets in a picture of the world, and the film keeps it. Then a lever winds the film on to a fresh frame.\n\nTap it and the flash bursts, the whole scene whites out for a moment, and you hear the shutter and the whoomph of the flash powder. Early cameras needed people to sit still for minutes; a modern shutter can open for less than a thousandth of a second.",
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
  torus: {
    howTo: "Tap it to spin it on its edge. Dress it as a donut, bagel or swim ring in the Toy tab.",
    about:
      "A torus is the shape of a ring: a circle swept around a line beside it, like a hoop made of tube. Donuts, bagels, swim rings and bicycle inner tubes are all tori. In topology, the math of shapes that can stretch but not tear, a torus has exactly one hole, so a coffee mug with its handle counts as one too.\n\nTap it and it pops up onto its edge and wobbles around like a coin spun on a table, leaning lower and circling faster until it drops flat. Real rings and coins do this: as one leans lower, its low point runs around faster, so a settling coin whirs quicker just before it stops. Under Dress it as in the Toy tab, pick a plain torus, a donut, a bagel or a swim ring.",
  },
  blob: {
    howTo: "Tap it to split it into three. Make a shape of your own in the Make tab.",
    about:
      "A wobbly jelly blob, built by the computer from a few rules rather than from photos. Thousands of splats, tiny soft blobs of color, are scattered over a lumpy round shape, and a pattern called noise gives it its bumps and swirls of candy color.\n\nTap it and it splits into three smaller blobs that wobble apart, then merge back with a jelly bounce. Real jelly wobbles because it is mostly water, held in a loose net of gelatin strands. In the Make tab you can pick a shape, a palette and a seed to build a blob of your own.",
  },
  knot: {
    howTo: "Tap it to make it twist and writhe.",
    about:
      "A glowing tube tied in a trefoil knot, the simplest true knot. Tie a knot in a string and join the two ends, and you get a loop that can never be untangled without cutting it; the trefoil crosses itself three times. Mathematicians study knots like this in a field called knot theory.\n\nTap it and waves of swelling loops run around the tube, lifting and twisting it as it glows pink, then it settles back into its trefoil. Real neon signs glow because electricity makes the gas inside the glass tube shine; pure neon glows red-orange.",
  },

  // ---- Balls ----------------------------------------------------------------------------
  basketball: {
    howTo: "Tap it to dribble it, then spin it on a fingertip.",
    about:
      "A basketball is a bouncy ball with a pebbled skin for grip and dark grooves, called channels, running around it. The game was invented in 1891 by James Naismith, a teacher in Springfield, Massachusetts, who nailed up two peach baskets as the first hoops.\n\nTap it for three fast, low dribbles, then a toss onto the fingertip of a robot hand, where it spins until the hand drops away and it bounces down. A full-size ball is about 75 centimeters (29.5 inches) around. Pick its color in the Toy tab.",
  },
  "soccer-ball": {
    howTo: "Tap it for keepy-uppy: three kicks in the air, then it bounces to a stop.",
    about:
      "The classic soccer ball is stitched from 32 panels: 12 black pentagons and 20 white hexagons, a shape mathematicians call a truncated icosahedron. In most of the world the game is called football, and it is the most popular sport on Earth.\n\nTap it for keepy-uppy, the trick of keeping the ball in the air with your feet: three small kicks, each with its own spin, the last one higher, then it drops and bounces lower each time until it settles. Pick the colors of the panels and the base in the Toy tab.",
  },
  "american-football": {
    howTo: "Tap it to throw a spiral pass.",
    about:
      "An American football is a pointed oval ball of leather with a row of white laces along one side for the fingers to grip. It is often called a pigskin, though today it is made of cowhide or rubber.\n\nTap it to throw a spiral: it flies up nose first, spinning fast around its long middle line, tips over at the top and lands with a wobble. The spin is what makes a good pass: like a spinning top, a spinning ball holds its direction and cuts cleanly through the air. Pick the color of the leather in the Toy tab.",
  },
  "tennis-ball": {
    howTo: "Tap it to slam it down and watch it bounce high.",
    about:
      "A tennis ball is a hollow rubber ball filled with air under pressure and covered in fuzzy felt. The felt slows the ball in the air and helps the racket's strings grip it for spin. Bright yellow balls came in during the 1970s, because they are easier to see on television.\n\nTap it and it is slammed onto the floor: it squashes hard, shoots up high with topspin, the fuzz fluffing out at each hit, and bounces a little lower each time. Pick the color of the felt in the Toy tab.",
  },
  baseball: {
    howTo: "Tap it to pitch a curveball and hit it back.",
    about:
      "A baseball has a small cork and rubber center, wound with long strands of yarn and covered with two figure-eight pieces of white leather. They are sewn together with 108 double stitches of red thread.\n\nTap it and it is pitched as a curveball: it spins hard, and the spin makes the air push it down and to the side late in its flight, which is why curveballs are so hard to hit. Then the crack of a bat sends it looping back to its spot. A fast pitch reaches the batter in less than half a second.",
  },
  softball: {
    howTo: "Tap it to pitch it underhand in a slow, high arc.",
    about:
      "A softball is bigger than a baseball, about 30 centimeters (12 inches) around, and in spite of its name it is not soft. The game was first played indoors in Chicago in 1887, and today it is played all over the world.\n\nIn softball the pitcher throws underhand, swinging the arm down and forward past the hip. Tap it and it is pitched just like that: a swing back and through, then a high, slow arc with a little backspin. It lands with a soft thud, hardly bounces, and a gentler toss brings it back.",
  },
  "beach-ball": {
    howTo: "Tap it to toss it up and watch it float down.",
    about:
      "A beach ball is a thin plastic ball blown up with air, usually with bright stripes of color. It weighs so little for its size that the air slows it down almost at once, which makes it easy and safe to play with.\n\nTap it and it is punched up: it rises, slows, then floats down slowly, drifting and turning lazily, lands softly with a wobble and bobs to a stop. Pick its three colors in the Toy tab. Air pushes on every ball as it moves, but a light, big ball like this one feels it the most.",
  },
  "golf-ball": {
    howTo: "Tap it to chip it; the backspin pulls it back.",
    about:
      "A golf ball is small and hard, covered in hundreds of little dents called dimples. The dimples help it fly: they stir up a thin layer of air around the ball, which lets it slip through the air more easily, so it flies about twice as far as a smooth ball would.\n\nTap it for a chip, a short, high shot played close to the hole. It pops up with heavy backspin, lands, checks with a tiny hop, and then the spin grips the ground and pulls it back to where it started.",
  },
  "rugby-ball": {
    howTo: "Tap it to punt it end over end.",
    about:
      "A rugby ball is a big oval ball, rounder and larger than an American football. Rugby is named after Rugby School in England, where the game grew up in the 1800s. Players may only pass the ball backward or sideways with their hands, but they can kick it forward.\n\nTap it for a punt, a kick of the ball dropped from the hands: it tumbles end over end, up and down, lands on a point and takes an odd, awkward bounce before settling, as oval balls do. Pick the color of its bands in the Toy tab.",
  },
  volleyball: {
    howTo: "Tap it to set it up and spike it down.",
    about:
      "A volleyball is a light ball of smooth leather panels. Volleyball was invented in 1895 by William G. Morgan, a teacher in Holyoke, Massachusetts. Each team may touch the ball three times before sending it back over the net.\n\nTap it for a set and a spike, the classic attack: a soft touch sends it straight up without spin, then a spike drives it down hard with topspin, so it slams into the floor, kicks up high and bounces out. Pick its two colors in the Toy tab.",
  },
  "water-polo-ball": {
    howTo: "Tap it to toss it into the water and watch it bob.",
    about:
      "Water polo is a team game played in a swimming pool, often in water too deep to stand in, so the players tread water the whole time. Its ball is about the size of a soccer ball, with a grippy, bumpy rubber skin so it can be held in one wet hand.\n\nTap it and it is tossed up and plunges into the water with a splash. Because it is full of air it pops straight back up, then bobs on the surface, sending out rings of ripples that spread and fade.",
  },
  "ping-pong-ball": {
    howTo: "Tap it to flick it up and let it bounce to a buzz.",
    about:
      "A ping-pong ball, used in table tennis, is a hollow plastic ball 40 millimeters across that weighs less than 3 grams, about as much as a small coin. The name ping-pong comes from the sound it makes on the bat and the table.\n\nTap it and it is flicked up, then bounces on and on, each bounce a little lower and quicker, with a tik for every one, until it buzzes to a stop. A light, springy ball keeps most of its speed at each bounce. Pick a white or an orange ball in the Toy tab.",
  },
  "cricket-ball": {
    howTo: "Tap it to flick it seam up; it skids with backspin, then rolls home.",
    about:
      "A cricket ball is a hard ball with a cork center, wound tight with string and covered in leather. A raised seam of stitching runs around its middle. Red balls are used in long matches that can last days, and white ones in shorter games.\n\nBowlers hold the ball with the seam upright, because a seam that lands upright can jump sideways off the ground. Tap it for a seam-up flick: the seam stands tall while the ball spins backward, then it comes down, skids on with its backspin until the spin grips, and rolls home.",
  },
  "bowling-ball": {
    howTo: "Tap it to bowl it down the lane with a hook.",
    about:
      "A bowling ball is a heavy ball with three finger holes, rolled down a long wooden or plastic lane at ten pins. The heaviest balls allowed weigh 16 pounds (about 7 kilograms).\n\nTap it to bowl it: it drops onto the lane with a thud, rolls away straight and then hooks across, the finger holes turning over as it goes; the pins crash far off, and it rolls back home. Good bowlers spin the ball so it curves into the pins from the side, which knocks down more of them. Pick its two colors in the Toy tab.",
  },
  "pool-ball": {
    howTo: "Tap it for a draw shot: it slides out and spins back. Pick its number in the Toy tab.",
    about:
      "Pool is played on a cloth-covered table with pockets. A set has a white cue ball and 15 numbered balls: 1 to 8 are solid colors and 9 to 15 have stripes, and the 8 ball is black. Players hit the cue ball with a long stick, the cue, to knock the others into the pockets.\n\nTap it for a draw shot: struck low, it slides forward while spinning backward, stops, and the backspin pulls it back until it rolls home. Pick the cue ball or any of the 15 numbers in the Toy tab.",
  },
  pickleball: {
    howTo: "Tap it to pop it up off a paddle.",
    about:
      "Pickleball is a game played with solid paddles and a light plastic ball full of holes, over a low net on a small court. It was invented in 1965 on Bainbridge Island, near Seattle in Washington, by three fathers looking for a game for their families.\n\nTap it and an unseen paddle pops it up twice. The holes make the ball slow down fast in the air, and it wobbles as it flies instead of spinning much. It lands with a hollow click and a small, dead bounce. Pick its color in the Toy tab.",
  },
  dodgeball: {
    howTo: "Tap it to slam it down and watch it squash.",
    about:
      "A dodgeball is a soft, light ball of rubber or foam, made to be thrown at other players in a game of dodging, catching and throwing. It is soft so that it does not hurt when it hits.\n\nTap it and it is lifted and slammed down: the soft rubber squashes flat and wobbles, then it bounces up again and squashes at each landing. A soft ball squashes more than a hard one, and it loses more of its bounce while it is squashed. Pick its color in the Toy tab.",
  },
  "medicine-ball": {
    howTo: "Tap it to heave it up and drop it with a thud.",
    about:
      "A medicine ball is a heavy ball for exercise, used for throwing, catching and lifting to build strength. Most weigh from about 1 to 10 kilograms (2 to 20 pounds), and they are made of leather, rubber or tough cloth, often with a grippy surface.\n\nTap it and it is heaved up just a little, slowly, because it is heavy. It drops with a heavy thud and a big, slow squash, does not bounce at all, and a puff of dust spreads out across the floor.",
  },
  "lacrosse-ball": {
    howTo: "Tap it to slam it down; it bounces hard and fast.",
    about:
      "A lacrosse ball is a small ball of solid, hard rubber. In lacrosse, players catch, carry and throw it with a stick that has a net pocket on the end. The game began with the Indigenous peoples of North America, who played it long before Europeans arrived.\n\nTap it and it is slammed down: it rockets up and bounces hard and fast, keeping more of its speed at each bounce than any other ball on the shelf. Solid rubber stores the energy of a bounce and gives most of it back. Pick its color in the Toy tab.",
  },
  "squash-ball": {
    howTo: "Tap it to warm it up; the warmer it gets, the higher it bounces.",
    about:
      "A squash ball is a small, hollow rubber ball that hardly bounces when it is cold. Players hit it against the walls of the court for a few minutes to warm it up: as the rubber and the air inside warm, the ball gets bouncier. The ball for the best players has two yellow dots and is the least bouncy of all.\n\nTap it and see: cold, it is dropped and barely bounces. Hit over and over, it warms, glows faintly and bounces higher and faster. Left alone, it bounces out and cools again.",
  },
  "bouncy-ball": {
    howTo: "Tap it to throw it down and watch it ricochet.",
    about:
      "A bouncy ball is a small ball of very springy, hard rubber. It gives back almost all the energy of each bounce, so it can bounce nearly as high as it was dropped from. The first ones of this kind were made in the 1960s by a chemist experimenting with new rubbers.\n\nTap it and it is thrown down hard: it ricochets all over the floor, keeping nearly all its speed, its spin flipping at every bounce, then comes home and settles. Pick its three colors in the Toy tab.",
  },
  marble: {
    howTo: "Tap it to roll it around a little circle.",
    about:
      "A marble is a small, hard ball, usually of glass, with twists of color inside. Children have played games with little balls of clay and stone for thousands of years; glass marbles became common in the 1800s. A twist of colored glass is set in the middle of the ball while the glass is hot and soft.\n\nTap it and it rolls around a little circle, turning the way it rolls, so the swirl inside turns too, under a polished glass shell that catches the light at its edge. After one lap it is back exactly as it was. Pick the color of the swirl in the Toy tab.",
  },
  "hockey-puck": {
    howTo: "Tap it for a slap shot across the ice.",
    about:
      "A hockey puck is a flat disk of hard black rubber, 3 inches (about 7.6 centimeters) across and 1 inch thick. In ice hockey, pucks are frozen before a game, so they bounce less and slide better on the ice.\n\nTap it for a slap shot, the hardest shot in hockey, when the player swings the stick back high and slaps the puck. Sparkling ice chips spray from where the stick hit, and the puck glides flat across the ice, spinning fast, around a wide loop and back to its spot.",
  },
  shuttlecock: {
    howTo: "Tap it to hit it up; it flips over and floats down cork first.",
    about:
      "A shuttlecock, or shuttle, is used in badminton instead of a ball. It has a rounded cork base with a skirt of 16 feathers, or a plastic skirt. The skirt drags on the air, so the shuttle always turns to fly cork first and slows down quickly.\n\nTap it and it is hit up: it flips over cork first and flies up spinning, turns over at the top and floats back down cork first, spinning slower as it falls. Even so, a hard smash can send a shuttle off the racket faster than 400 kilometers (250 miles) an hour.",
  },
  "flying-disc": {
    howTo: "Tap it to throw it around a loop and back.",
    about:
      "A flying disc is a plastic disc with a curled rim, thrown with a flick of the wrist. It flies like a spinning wing: its curved shape makes the air lift it, and its spin keeps it flat and steady, just as a spinning top stays upright.\n\nTap it to throw it: it spins fast and flat, tilts into a curve and glides around a loop, like a throw that comes back to you, then settles in its place. Pick its color in the Toy tab. The first plastic flying discs were sold in the late 1940s.",
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
  planet: {
    howTo: "Tap it to sweep night across it. Pick a planet under Planet in the Toy tab.",
    about:
      "A tiny, made-up planet built by the computer from a sphere and a palette of planet colors: blue seas, green land and white clouds for Earth, rusty deserts and white polar caps for Mars, gray craters for the Moon, and banded storms for Jupiter and Neptune. It is a tribute to the very first version of Splashery.\n\nTap it and a band of night sweeps across it while any clouds race once around it. Day and night happen because a planet spins: at any moment, the half facing its star has day and the other half has night. Earth turns once about every 24 hours, Jupiter in under 10. Pick Earth, Mars, the Moon, Jupiter or Neptune under Planet in the Toy tab.",
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
      "A pulsar is a neutron star, the crushed core left after a giant star explodes. It is only about 20 kilometers across, the size of a city, yet it holds more matter than the Sun. It spins fast and sends out two beams of light from its magnetic poles.\n\nLike a lighthouse, it seems to flash each time a beam sweeps past. Tap it to spin it up until the flashes blur into a strobe, each with a deep pulse, then it winds down. Set its spin speed in the Toy tab. The first pulsar was found by Jocelyn Bell Burnell in 1967, and the fastest spin hundreds of times a second.",
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
    howTo: "Tap it to excite the electron. Pick any orbital up to 4f, or lobes, in the Toy tab.",
    about:
      "An electron does not circle the center of an atom like a planet. It spreads out as a cloud, called an orbital, that shows where it is most likely to be found. Orbitals come in set shapes: a ball, a dumbbell, a dumbbell with a ring, and more. The two colors show the two halves of the electron's wave.\n\nTap it and a tiny packet of light, a photon, comes in. The electron takes it in, jumps up to a bigger orbital and glows, then drops back with a flash and gives the light out again. This is how glowing gases give off light of their own colors.",
  },
  atom: {
    howTo: "Tap it to speed up the electrons. Pick any of the 118 elements in the Toy tab.",
    about:
      "Everything around you is made of atoms. Each one has a tiny heavy center, the nucleus, made of protons and neutrons, with electrons around it. The number of protons decides which element it is: carbon has 6, oxygen 8 and gold 79.\n\nThis model draws the electrons in rings called shells, an idea of Niels Bohr's from 1913; pick the Cloud style for a truer picture, or Every nucleon to see all its protons and neutrons. Tap it and the electrons whirl faster until each shell blurs into a glowing ring, then slow down. The nucleus is tens of thousands of times smaller than the whole atom, which is mostly empty space.",
  },
  molecule: {
    howTo: "Tap it to heat it up. Pick a molecule, or type your own, in the Toy tab.",
    about:
      "A molecule is a group of atoms held together by chemical bonds. This one is a ball-and-stick model: each ball is an atom, colored by its element (carbon dark gray, hydrogen white, oxygen red, nitrogen blue), and each stick is a bond.\n\nIt starts as caffeine, C8H10N4O2, the stimulant in coffee and tea; the Toy tab has sugars, medicines, vitamins and DNA too. The atoms always jiggle a little on their bonds, as real ones do; tap it to heat it up and they shake hard, the light hydrogens furthest, each bond stretching and squeezing with its atoms, then it cools. In the Toy tab, pick another molecule, or type a name, a formula or a SMILES string (a way of writing a molecule on one line) to build your own.",
  },
  protein: {
    howTo: "Tap it to pull it apart. Pick a protein, or open your own file, in the Toy tab.",
    about:
      "Proteins are the tiny machines of living things. Each is a long chain of building blocks called amino acids that folds up into its own shape: coils called helices, flat strands and loops. Hemoglobin carries oxygen in the blood, insulin helps control sugar, and a jellyfish protein, GFP, glows green.\n\nThese are real shapes from the Protein Data Bank, a free library of well over 200,000 structures that scientists share. Tap it to pull it apart into its pieces, and they come back by themselves; tap again while it is apart and they come back at once. In GFP the glowing part lights up while it is open. You can open any PDB or mmCIF file from the library in the Toy tab.",
  },
  "periodic-table": {
    howTo:
      "Tap a tile to raise its atom, again to lower it. Tap the empty board for a tour, or a 57-71 or 89-103 cell to light its row.",
    about:
      "The periodic table lists all 118 elements in order of their protons, in rows that repeat their chemistry: each column's elements behave alike. The colors are the families, from the alkali metals on the left to the noble gases on the right.\n\nTap an element and its atom rises and builds itself: the protons (red) and neutrons (gray) of its commonest isotope, then the electrons, filling their shells in the real order. Tap the atom and an electron jumps up a shell and falls back, giving off light the color of the element's brightest visible line: red for hydrogen, yellow for sodium, green for copper. Elements with no visible line measured flash white. Tap the empty board for a tour through every element. The lanthanides (57 to 71) and actinides (89 to 103) sit in the two rows under the table, to keep it narrow: tap the 57-71 or 89-103 cell and its row lights up. Turn on Wide table in the Toy tab to see them in their places in the table instead, 32 columns wide. Numbers from NIST, PubChem and IUPAC.",
  },
  "crystal-lattice": {
    howTo: "Tap to send a wave through it. Pick one of eleven crystals in the Toy tab.",
    about:
      "In a crystal, atoms are lined up in a pattern that repeats over and over, like tiles on a floor. In table salt, sodium and chlorine take turns in rows of little cubes. Diamond and graphite are both pure carbon: in diamond each atom holds on to four others, which makes it very hard, while graphite's flat sheets slide apart, which is why a pencil writes.\n\nTap it to send a wave through it: a ripple runs across, each slice of atoms rising and falling in turn, the bonds between them stretching and bending. Sound and heat travel through solids as waves like this. In ice, the water molecules spread out into an open pattern, so ice floats on water. Metals, quartz and graphene are in the Toy tab too.",
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
      "The lungs are two spongy organs in the chest that bring air into the body. Air comes down the windpipe, splits into two tubes and branches into smaller and smaller airways that end in millions of tiny air sacs, where oxygen passes into the blood and carbon dioxide passes out.\n\nThese lungs breathe gently by themselves. Tap for a deep breath: both lungs swell out big, hold, then empty further than usual and settle back into their rhythm. The Breath slider sets how deeply they breathe at rest. An adult at rest takes about 12 to 20 breaths a minute.",
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
  "anatomy-atlas": {
    howTo: "Tap to peel off a layer; after the organs, tap to put them all back. Try Labels.",
    about:
      "An anatomy atlas shows the body in layers, the way a medical textbook does. Under the skin lie the muscles that move us, red with pale tendons at their ends; under them is the skeleton, which in an adult has about 206 bones; and inside are the organs: the brain, lungs, heart, liver, stomach, intestines and kidneys.\n\nTap to peel the outer layer: the skin opens along its seams, then the muscles and the bones lift off group by group. After the organs, a tap puts every layer back. Pick a Layer in the Toy tab to go straight to one, and switch on Labels to list the parts beside the body; the part you tap is highlighted.",
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
    howTo:
      "Tap for thunder: lightning strikes under your finger. Try the Rain slider in the Toy tab.",
    about:
      "A thunderstorm cloud can tower more than 10 kilometers into the sky. Inside it, bits of ice and water crash together and build up electric charge, until a giant spark, lightning, jumps across. Lightning heats the air around it to about 30,000 degrees Celsius, hotter than the surface of the Sun, and the air bursts outward with the boom we call thunder.\n\nThis cloud rains and flashes with lightning by itself. Tap it for a big strike and a clap of thunder: the bolt comes straight down from the cloud where you tapped. Light travels much faster than sound, so count the seconds between flash and thunder: every 3 seconds is about 1 kilometer away.",
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
    about:
      "Ice cream is a frozen mix of milk or cream, sugar and flavors. It is stirred while it freezes, so the ice crystals stay tiny and air is whipped in: up to half of a scoop of soft ice cream can be air, which is why it feels light and smooth.\n\nTap it and it melts: the scoops slump and drips run down the cone, then it freezes firm again. The Warmth slider in the Toy tab melts it slowly by hand. You can also pick one, two or three scoops and their flavors, and add sprinkles and a cherry.",
  },
  watermelon: {
    howTo: "Tap it to chop it into slices that fan open.",
    about:
      "A watermelon is a big fruit that grows on a vine along the ground. Under its hard green rind is sweet red flesh dotted with black seeds, and it is about 92 percent water, which makes it a favorite on hot days. Watermelons were first grown in Africa thousands of years ago.\n\nTap it and a big knife chops the whole melon five times, then the six slices fan open like an accordion, showing the red flesh, the pale rind and the seeds, and fold shut again. Pick a whole melon, a wedge, or both in the Toy tab.",
  },
  "birthday-cake": {
    howTo: "Tap to blow out the candles; tap again to light them. Choose how many in the Toy tab.",
    about:
      "A birthday cake is a sweet, frosted cake with candles on top, often one for each year. People sing to the birthday person, who makes a wish and tries to blow out all the candles in one breath.\n\nThis cake starts with its candles lit. Tap to blow them out, with a puff of smoke from each wick, and tap again to light them. In the Toy tab, choose from one to nine candles, the colors of the frosting and the drip, and a vanilla, chocolate, red velvet or strawberry sponge. A candle flame needs air: blowing hard pushes the hot, burning gas away from the wick, and the flame goes out.",
  },
  popcorn: {
    howTo: "Tap it to pop more kernels up out of the bucket.",
    about:
      "Popcorn is a kind of corn whose kernels puff up when they are heated. Each kernel has a hard shell with a little water inside. When it gets hot, the water turns to steam, the pressure builds until the shell bursts with a pop, and the soft starch inside puffs out into a white, crunchy foam.\n\nTap it and fresh kernels pop up out of the striped bucket, tumble and land on the heap. People in the Americas were popping corn thousands of years ago, long before movie theaters.",
  },
  jelly: {
    howTo: "Tap it to poke it and watch it wobble.",
    about:
      "A jelly, or gelatin dessert, is fruit juice or sweet flavored water set with gelatin and turned out of a mold. Gelatin makes a fine, stretchy mesh that traps the water, so the jelly holds its shape but wobbles when you touch it.\n\nThis one always jiggles a little. Tap it to poke it: it squashes and wobbles hard, then settles down. In the Toy tab, pick strawberry, lime, orange, blueberry, grape or rainbow, and choose whether it has fruit set inside.",
  },
  pancakes: {
    howTo: "Tap to flip the top pancake. Set the stack and the syrup in the Toy tab.",
    about:
      "Pancakes are flat, round cakes made from a runny batter of flour, eggs and milk, cooked on a hot pan. Baking powder in the batter makes bubbles of gas, so they puff up soft and fluffy. When bubbles pop on the top, it is time to flip.\n\nTap it to flip the top pancake: it hops up, turns a full somersault in the air with its syrup and butter, and lands back on the stack. In the Toy tab, set how many pancakes are in the stack, from two to seven, and try the Syrup slider.",
  },
  cupcake: {
    howTo: "Tap it to flick the cherry up; it plops back down.",
    about:
      "A cupcake is a small cake baked in a paper cup, called a liner, and topped with swirls of frosting. Because it is small, it bakes quickly, and each person gets a whole cake of their own.\n\nTap it and the springy frosting flicks the cherry up: it tumbles and drops back with a plop, the frosting squashes and wobbles, and the sprinkles jump off and rain back down. In the Toy tab, pick the colors of the frosting and the liner, a vanilla, chocolate or red velvet cake, and the topping.",
  },
  lollipop: {
    howTo: "Tap it to spin it fast; the swirl seems to pour inward.",
    about:
      "A lollipop is a hard candy on a stick. Swirl lollipops are made by twisting long ropes of soft, warm candy in different colors together and coiling them into a flat spiral before the candy cools and sets hard.\n\nIt turns slowly by itself. Tap it and the swirl whirls up to nearly three turns a second, so the spiral seems to pour inward toward the middle, then slows again. That is a trick of the eye: a turning spiral looks as if it is moving in or out. Pick its colors in the Toy tab.",
  },
  "candy-cane": {
    howTo: "Tap it to twist it until it snaps, then watch it mend.",
    about:
      "A candy cane is a stick of hard peppermint candy bent into a hook, with red and white stripes, and it is often hung on trees in the Christmas season. The stripes are made by twisting ropes of red and white candy together while they are warm and soft.\n\nTap it and each cane twists, the hook turning and the stripes winding tighter, until it snaps with a crack. The top half springs clear, sugar chips fly, then the halves come back together and mend with a glint. Pick a pair with a bow or a single cane, and the stripe color, in the Toy tab.",
  },
  macarons: {
    howTo: "Tap it and the two in front hop up onto the stack.",
    about:
      "A macaron is a small French sweet: two light, round cookies made of ground almonds, egg whites and sugar, stuck together with a creamy filling. The tops are smooth and domed, and each cookie has a frilly edge at the bottom, called the foot, that rises as it bakes.\n\nTap it and the two macarons in front hop, one after the other, up onto the stack and land with a soft tap. The tower of five sways, then they hop back down. Pick a pastel mix or one flavor in the Toy tab.",
  },
  donut: {
    howTo: "Tap it to break it apart and put it back together.",
    about:
      "A frosted donut with sprinkles, built by the computer from a simple ring shape. To a mathematician, a ring like this is a torus. In topology, the math of shapes that can stretch but not tear, a donut and a coffee mug count as the same shape, because each has exactly one hole.\n\nTap it and it snaps into chunks that fly apart and tumble, showing the dough inside, while the sprinkles spray off. Then it all flies back together. The Make tab builds shapes like this from a shape, a palette and a seed.",
  },
  "gummy-bear": {
    howTo: "Drag the bear to stretch it; let go and it springs back. Tap to squish it.",
    about:
      "A gummy bear is a small, chewy candy shaped like a bear, made of sugar, fruit flavors and gelatin. Gelatin is what makes it stretchy and springy: it forms a mesh that bends and then pulls back. Gummy bears were first made in Germany in the 1920s.\n\nDrag any part of the bear and it stretches, up to about a body length, then springs back with a few wobbles when you let go. A drag beside it turns the view instead. Tap it for a jelly squish. Pick its flavor in the Toy tab, from cherry red to a clear pineapple.",
  },
  pretzel: {
    howTo: "Tap it to twist it like a knot and let it spring back.",
    about:
      "A pretzel is a baked bread shaped from a long rope of dough into a loop with a twist in the middle. Before baking, it is dipped in a special bath of water and an alkali, such as lye or baking soda, which gives it its shiny, dark brown crust. Then it is sprinkled with coarse salt.\n\nTap it and it twists like a knot, all in one piece: its two sides wring opposite ways and its loops fold a little toward you. Let go, and it springs a little past its shape into the opposite twist and wobbles to a stop.",
  },
  croissant: {
    howTo: "Tap it to slice it open and melt a pat of butter inside.",
    about:
      "A croissant is a flaky, crescent-shaped pastry; its name is the French word for crescent. The dough is folded around a slab of butter again and again, making dozens of thin layers. In the hot oven, the water in the butter turns to steam and puffs the layers apart, so the inside is soft and full of holes and the outside is crisp.\n\nTap it and it is sliced open along its middle. The top lifts and tips back like a lid, showing the soft layers inside, where a pat of butter melts and spreads. Then the top settles back down.",
  },
  pizza: {
    howTo: "Tap to take a slice; tap again to go back.",
    about:
      "Pizza is a flat, round bread topped with tomato sauce and cheese and baked in a very hot oven. It comes from Naples, in Italy, and is now eaten all over the world. The margherita pizza, with red tomato, white mozzarella and green basil, shows the colors of the Italian flag.\n\nTap it to take a slice: it slides out with strings of melted cheese stretching behind it. Warm mozzarella stretches because the proteins in it line up in long, stringy strands. Tap again to put the slice back. Pick pepperoni, margherita, veggie or cheese in the Toy tab.",
  },
  burger: {
    howTo: "Tap to spread out the layers; tap again to stack them up.",
    about:
      "A burger is a round patty of ground meat, or of vegetables, cooked and served in a sliced bun with toppings. The name comes from the city of Hamburg, in Germany. This one has a sesame seed bun, a patty, a slice of cheese, a leaf of lettuce and tomato.\n\nTap it to spread out the layers in the air, one above the other, so every part shows, and tap again to stack them back up. Engineers call a picture like this an exploded view: it shows how the parts of a machine fit together without taking the real thing apart.",
  },
  sushi: {
    howTo: "Tap it: the chopsticks pick up a piece and dip it in soy sauce.",
    about:
      "Sushi is a Japanese dish of rice mixed with a little vinegar and sugar, served with fish, vegetables or egg. This board has nigiri, a pillow of rice with a slice of fish draped on top, and maki, rice and a filling rolled up in a sheet of dried seaweed called nori and cut into rounds.\n\nTap it and the chopsticks lift off the board as if held by an invisible hand, pinch a piece with a click, carry it to a little dish of soy sauce and dip it twice, then set it back and lie down again.",
  },
  taco: {
    howTo: "Tap it to break the shell in half; then it closes up again.",
    about:
      "A taco is a Mexican dish: a tortilla, a thin, round flatbread of corn or wheat, folded around a filling such as meat, beans, cheese, lettuce and salsa. People in Mexico have made corn tortillas for thousands of years. This one has a crunchy, fried corn shell.\n\nTap it and the shell snaps across the middle with a crunch. The halves pull apart and swing open like a book, showing the filling in each break, and bits drop out of the break onto the plate, bounce a little and slide to a stop. Then they hop back in and the halves close.",
  },
  egg: {
    howTo: "Tap to crack it open; tap again to go back.",
    about:
      "A soft-boiled egg is cooked in its shell in boiling water for only a few minutes, so the white sets firm but the yolk stays runny. It is served in an egg cup, with strips of toast for dipping into the yolk.\n\nTap it to crack it open: the top of the shell pops off, and the runny yolk shows and drips down the side. Tap again to put the top back. In the Toy tab, pick a brown or a white shell and the color of the egg cup. The color of a shell depends on the kind of hen that laid it; the egg inside is the same.",
  },
  coffee: {
    howTo: "Tap it to stir. Pick the latte art and the steam in the Toy tab.",
    about:
      "Coffee is made from the roasted seeds, called beans, of the coffee plant, which first grew wild in Ethiopia. A latte is a strong shot of coffee topped with a lot of steamed milk. Pouring the milk foam carefully draws a picture on top, called latte art: a heart, a leafy rosetta or a tulip.\n\nTap it to stir: the latte art twists into a swirl, the middle turning further than the edge, then relaxes back, with a thick curl of steam. In the Toy tab, pick the latte art and the color of the cup, and try the Steam slider.",
  },
  apple: {
    howTo: "Tap to take a bite; tap again and a worm peeks out before it's whole again.",
    about:
      "Apples grow on trees and come in thousands of kinds, from sharp green ones to sweet red and golden ones. The wild apple that most of them come from still grows in the mountains of Central Asia.\n\nTap it to take a bite: a chunk comes away, leaving a scalloped bite of pale flesh, and the apple stays bitten. Tap again and a little worm pokes out of the bite, looks about, ducks back in, and the apple grows whole again. Pick a red, green or golden apple in the Toy tab. The flesh of a cut apple turns brown in the air, much as a sliced potato does.",
  },
  banana: {
    howTo: "Tap it to pull the bananas apart and peel all three.",
    about:
      "Bananas grow in big hanging bunches on giant plants that look like trees but are not: the trunk is made of tightly rolled leaves. A banana is picked green and turns yellow as it ripens, and then brown spots appear as its starch turns to sugar and it gets sweeter.\n\nTap it and the three bananas pull apart. Each is peeled from its tip: its skin splits into three strips that curl back, showing the pale fruit. Then the strips fold back up and the bunch comes together. Pick green, just right or spotty bananas in the Toy tab.",
  },
  orange: {
    howTo: "Tap it to open it into eight wedges, like a flower.",
    about:
      "An orange is a citrus fruit. Its bright peel is dotted with tiny pockets of fragrant oil, and inside, the fruit is divided into segments packed with little sacs of juice. Oranges are full of vitamin C, and they were first grown in southern China and Southeast Asia.\n\nTap it and the whole orange opens like a flower: eight wedges fall open outward, one just after another, showing their juicy faces, while juice squirts up out of the middle. Then it closes up again. Pick a whole orange, a half, or both in the Toy tab.",
  },
  kiwi: {
    howTo: "Tap it to cut it open and show the green inside.",
    about:
      "A kiwifruit is a small fruit with thin, fuzzy brown skin and bright green flesh around a pale core ringed with tiny black seeds. It first grew wild in China. Farmers in New Zealand made it popular and named it after the kiwi, their fuzzy brown national bird.\n\nTap it and the whole kiwi is cut across the middle; the halves slide apart and turn to show their green faces and the ring of seeds, then close up again. Pick a whole kiwi, a half, or both in the Toy tab.",
  },
  pineapple: {
    howTo: "Tap it to slice it into rings.",
    about:
      "A pineapple is a tropical fruit with a tough, scaly skin and a spiky crown of leaves. It is really many small fruits grown together: each scale on the skin comes from a single flower. Pineapples first grew in South America, and a crown twisted off and planted can grow a whole new plant.\n\nTap it for four chops, top first. With each chop, everything above lifts and leans toward you, until five rings stand apart in a leaning stack, showing their golden flesh and pale cores. Then they drop back onto each other.",
  },
  cherries: {
    howTo: "Tap it to swing the cherries apart; they knock back together.",
    about:
      "Cherries are small, round fruits that grow on trees, often in pairs whose long stems are joined at the top. Each cherry has one hard stone in the middle with the seed inside, so it is called a stone fruit, like a plum or a peach.\n\nTap it and a flick swings the two cherries apart on their own stems. They swing back and knock together with a plink, bouncing apart again and again until they settle, while the joint of the stems bobs.",
  },
  grapes: {
    howTo: "Tap it: grapes drop off the bunch, bounce and hop back.",
    about:
      "Grapes grow in bunches on woody vines, from a few dozen to a few hundred on a bunch. They come in purple, green and red, and people eat them fresh, dry them into raisins and press them for juice.\n\nTap it and ten grapes on the front come off one after another, drop and bounce on the table and roll a little, each on its own path, then hop back up to their places one by one. Pick purple, green or red grapes in the Toy tab. The Photoreal shelf has a real grape that peels.",
  },
  avocado: {
    howTo: "Tap it to pop the stone into the other half and back.",
    about:
      "An avocado is a fruit with a bumpy green skin, soft, creamy green flesh and one big, round stone in the middle, which is its seed. It first grew in Mexico and Central America. Avocados are unusual: they do not ripen on the tree, only after they are picked.\n\nTap it and the stone pops out of its half, flies over and drops into the empty half with a thock, rocking it, then pops back home and the first half rocks. Pick both halves, or just the half with the stone, in the Toy tab.",
  },

  // ---- Toys -----------------------------------------------------------------------------
  bricks: {
    howTo: "Tap to build a model from the bricks; tap again to build another.",
    about:
      "Building bricks are small plastic blocks with round studs on top that press into tubes underneath the next brick, so they hold together firmly and can be pulled apart again. With enough of them you can build almost anything, and even six ordinary bricks can be stacked together in hundreds of millions of different ways.\n\nHere eighteen bricks lie spread out on the table. Each tap pops the last model apart and builds a new one in the middle, brick by brick from the bottom up, each clicking into place: a tower, a bridge, stairs, a dog or a tree. Pick a set of colors in the Toy tab.",
  },
  "rubber-duck": {
    howTo: "Tap it to squeeze it: it squeaks, hops and bobs.",
    about:
      "A rubber duck is a little yellow bath toy that floats. The first ones were made of solid rubber; today most are hollow and made of soft plastic, with a small hole underneath. Squeeze one and the air rushes out through the hole with a squeak, and when you let go it sucks air back in.\n\nTap it to squeeze it: it squashes, squeaks and hops, then bobs and rocks as if it were floating in the bath, and settles down. Pick its color in the Toy tab.",
  },
  "spinning-top": {
    howTo: "Tap it to spin it faster; it wobbles more, then steadies.",
    about:
      "A spinning top is one of the oldest toys in the world, played with in many lands for thousands of years. While it spins fast, it balances on its tiny point, because a spinning thing holds the direction of its spin. As it slows, it starts to wobble, and its handle traces a slow circle; scientists call that circling precession.\n\nThis top is always spinning. Tap it to spin it much faster: it tilts and circles more widely for a few seconds, then settles back to a steady spin. Pick one of three sets of colors in the Toy tab.",
  },
  dice: {
    howTo: "Tap to roll. Pick two six-sided dice or a d20 in the Toy tab.",
    about:
      "Dice are small shapes with a number on each face, rolled to get a number by chance. A fair die lands on each face just as often as any other. On an ordinary six-sided die the opposite faces always add up to seven: 1 and 6, 2 and 5, 3 and 4.\n\nTap to roll: the dice tumble and land on new faces, so you can use them for a real game. In the Toy tab, pick two six-sided dice or a d20, a die with 20 triangle faces used in many tabletop games, and pick their color.",
  },
  "newtons-cradle": {
    howTo: "Drag a ball out to the side and let go. Or tap to lift the end ball.",
    about:
      "Newton's cradle is a row of steel balls, each hung on two strings so it can only swing in one line. Lift the end ball and let go: it strikes the row, the ball at the far end flies out, and the balls in between barely move. Let go of two and two fly out.\n\nIt shows two rules of physics at once: in each knock both the momentum and the energy carry through the row, so the same number of balls leaves as arrived. Each clack turns a little energy into sound and heat, so the swings slowly die away. Drag any ball out (the balls beside it come too) and let go, or tap to lift the end ball.",
  },
  "teddy-bear": {
    howTo: "Tap it and it waves hello.",
    about:
      "A teddy bear is a soft, stuffed toy bear. It is named after Theodore “Teddy” Roosevelt, a president of the United States: in 1902 a newspaper cartoon showed him sparing a young bear on a hunting trip, and soon toymakers in the United States and Germany were making stuffed bears.\n\nThis bear sways its head and arms a little. Tap it and it lifts one arm and waves hello, tipping its head, then puts its arm back down. Pick the color of its fur in the Toy tab.",
  },
  "yo-yo": {
    howTo: "Tap it to throw it down; it spins down the string and climbs back up.",
    about:
      "A yo-yo is two disks joined by a short axle, with a string tied around the axle. Thrown down, it unwinds and spins fast; the spin keeps it steady, and a little tug on the string makes it wind itself back up into your hand. Children in ancient Greece played with yo-yos of wood, metal and clay.\n\nThis one bobs gently on its string. Tap it to throw it: it drops, spinning as the string unwinds, and then climbs back up the string to where it started. Pick its color in the Toy tab.",
  },
  "puzzle-cube": {
    howTo:
      "Drag across a face to turn a row or column. Tap to scramble or solve it; tap again to pause.",
    about:
      "A twisting puzzle cube: 26 small cubes around a hidden core, with one color on each of its six faces. Each turn moves a whole row or column of nine cubes, and the puzzle is to bring every face back to one color.\n\nHere every little cube is its own piece, and the cube keeps track of each turn, so you can really solve it: drag across a face to turn that row or column. A tap scrambles a solved cube, or turns a scrambled one back to solved, one layer at a time. Tap while it turns and it pauses once the turn in progress lands, so you can take over by hand: your own move ends the automatic one, and the next tap starts again from there. Solving it by hand earns a hop and a chime. The cube has about 43 quintillion arrangements, yet any of them can be solved in 20 moves or fewer.",
  },
  "spring-toy": {
    howTo: "Tap it to hurry it along; it flips end over end faster.",
    about:
      "A spring toy is a long, loose coil of metal or plastic that can walk down stairs by itself. Set one end on a lower step and it flips over, end over end, as each coil tips across in turn and the weight moves from one end to the other. It was invented in the 1940s by an engineer who saw a spring fall off a shelf and keep moving.\n\nThis one walks by itself, its coils flipping over from one side to the other. Tap it to hurry it along. Pick a rainbow, metal or pastel coil in the Toy tab.",
  },
  kite: {
    howTo: "Tap it for a gust of wind: the kite loops and the tail whips.",
    about:
      "A kite is a light frame covered with paper or cloth that flies on the wind at the end of a long line. The wind pushing under the tilted kite lifts it up, and a tail helps keep it pointing the right way. Kites were first flown in China more than 2,000 years ago.\n\nTap it for a big gust: the kite climbs around a loop, turning once while it rises, and its tail whips behind it. The line stays tied on the whole time. Pick its two colors in the Toy tab.",
  },
  "paper-plane": {
    howTo: "Tap it to do a barrel roll.",
    about:
      "A paper plane is a sheet of paper folded into a glider. It has no engine: once thrown, it slowly trades height for speed, and air flowing over its wings holds it up, while the weight at the pointed nose keeps it flying straight. Small folds at the back of the wings can make it climb, dive or turn.\n\nThis plane glides and bobs gently in place. Tap it and it does a barrel roll, one full turn around its long middle, while it lifts a little. In the Toy tab, pick the color of the paper, and choose lined paper or plain.",
  },
  "origami-crane": {
    howTo: "Tap it to flap its wings.",
    about:
      "Origami is the Japanese art of folding a single square of paper into a shape, without cutting or gluing. The crane is its most famous model, folded with a long neck, a pointed tail and wide wings. In Japan, a string of a thousand folded cranes is a traditional wish for good health and for peace.\n\nTap it to flap its wings: they beat up and down a few times, as a real crane's do. Some paper cranes are folded so that the wings really flap when you pull the tail. Pick the color of the paper in the Toy tab.",
  },
  "balloon-dog": {
    howTo: "Tap it to pop it; then it blows back up.",
    about:
      "A balloon dog is made from one long, thin balloon, twisted into a chain of bubbles and folded into a head, ears, a body, four legs and a tail. Each twist traps the air in its own bubble, so the shape holds.\n\nTap it and it pops: bits of rubber fly out and fall away. Then the dog blows back up, part by part, until it stands whole again. Pick the color of the balloon in the Toy tab.",
  },
  "soap-bubbles": {
    howTo: "Tap it to blow a stream of bubbles.",
    about:
      "A soap bubble is a very thin skin of soapy water wrapped around some air. The skin pulls itself as small as it can, and the smallest skin that can hold the air is a sphere, so bubbles are round. The swirling colors come from light bouncing off the inside and outside of the skin, which is thinner than a hair.\n\nBubbles drift up slowly from the wand by themselves. Tap it to blow, and many more stream out faster, float away and fade. Pick the color of the wand in the Toy tab.",
  },
  robot: {
    howTo: "Tap it to wind it up: its key whirs and its arms swing wide.",
    about:
      "A wind-up robot is a tin toy with a spring inside. Turning the key on its back winds the spring tight, and as the spring slowly unwinds, it turns little gears that swing the arms and move the legs. Wind-up tin robots were a favorite toy in the middle of the 1900s.\n\nThis robot always swings its arms a little, and its antenna light glows. Tap it to wind it up: the key spins fast, the arms swing wide and it rocks and bobs from side to side, then it slowly runs down again. Pick its color in the Toy tab.",
  },
  "chess-set": {
    howTo: "Tap a piece, then a square, to move it. Or press play in the bar to watch a game.",
    about:
      "Chess is a game for two players on a board of 64 squares. Each side starts with 16 pieces (a king, a queen, two rooks, two bishops, two knights and eight pawns), and the goal is to checkmate the other king: to attack it so that it has no way out.\n\nThe board is set up for the Opera Game, played in Paris in 1858 at the opera house, where Paul Morphy beat the Duke of Brunswick and Count Isouard in 17 moves. Press play in the bar under the board to watch it, or tap a piece and then a square to play your own moves. In the Toy tab you can open or paste any game written in PGN, the usual way of writing down chess games.",
  },
  // ---- Open me --------------------------------------------------------------------------
  chest: {
    howTo: "Tap to open the lid; tap again to close it.",
    about:
      "A treasure chest is a strong wooden box with metal bands, a heavy lid and a lock, made to keep coins, jewels and other precious things safe. Long ago, before banks were common, people kept their valuables in chests like this, and ships carried money and goods in them.\n\nTap it to open the lid and see the heap of gold coins and bright jewels inside, and tap again to close it. Pick the color of the wood in the Toy tab.",
  },
  book: {
    howTo: "Tap to close the book; tap again to open it.",
    about:
      "A storybook is a book of stories, with pages of words and often pictures. A book like this, with pages sewn together along one edge between two hard covers, is a way of keeping writing that people have used for about two thousand years. Printing with movable metal type, which made books much cheaper, began in Europe in the 1450s.\n\nThe book starts open. Tap to close it: the pages turn over one by one and the cover shuts. Tap again to open it. Pick the color of the cover in the Toy tab.",
  },
  laptop: {
    howTo:
      "Tap the keys, or type on your keyboard. Drag on the trackpad. Tap elsewhere to close it.",
    about:
      "A laptop is a computer small enough to carry and use on your lap. Its screen is in the lid, and the base holds the keyboard, a touch pad called a trackpad, and a battery. The order of the letters on the keyboard, starting Q, W, E, R, T, Y, comes from typewriters of the 1870s.\n\nTap any key, or type on your own keyboard, and the key goes down and the letter appears on the screen. Tap or drag on the trackpad to move the pointer and click. Tap anywhere else on the laptop to close the lid, and again to open it. Pick the color of the case in the Toy tab.",
  },
  "music-box": {
    howTo: "Tap to close the lid; tap again to open it.",
    about:
      "A music box plays a tune all by itself. Inside, a spring turns a metal cylinder covered in tiny pins. As it turns, the pins pluck the teeth of a steel comb, and each tooth rings with its own note: the longer the tooth, the lower the note.\n\nThis music box starts open, with a little dancer twirling on its stand while the tune plays and music notes float up. Tap to close the lid and stop the music, and tap again to open it. Pick the color of the wood in the Toy tab.",
  },
  clock: {
    howTo: "Tap it to ring the alarm.",
    about:
      "A wind-up alarm clock has two metal bells on top and a little hammer between them. At the set time a spring inside lets the hammer go, and it strikes the two bells back and forth very fast, loud enough to wake a sleeper. Before alarm clocks were common, some people were paid to go around town tapping on windows to wake others up.\n\nThe hands on this clock show the real time where you are, or in another time zone you pick in the Toy tab. Tap it to ring the alarm: the hammer rattles between the bells and the whole clock shakes and hops. Pick its color in the Toy tab.",
  },
  "gift-box": {
    howTo: "Tap to open the present; tap again to close it.",
    about:
      "A gift box is a present wrapped in bright paper and tied with a ribbon and a bow. People give wrapped presents for birthdays, holidays and other happy days, and the fun is not knowing what is inside until it is opened.\n\nTap it to open the present: the lid with its bow pops up and tips back, a golden star rises out of the box, and a burst of confetti fills the air. Tap again to close it. Pick the colors of the paper and the ribbon in the Toy tab.",
  },
  umbrella: {
    howTo: "Tap to close the umbrella; tap again to open it.",
    about:
      "An umbrella is a folding shade of cloth stretched over thin metal ribs, held up on a stick. When it opens, a sliding ring pushes little struts that spread the ribs out, and the cloth pulls tight to keep off the rain or the sun. People in ancient Egypt, China and Greece used umbrellas as sunshades thousands of years ago.\n\nThe umbrella starts open. Tap to close it, folding the ribs down along the stick, and tap again to open it. Pick a rainbow, striped or plain canopy and its color in the Toy tab.",
  },
  "desk-fan": {
    howTo: "Tap to switch it off or on. Turn its swing on or off in the Toy tab.",
    about:
      "A desk fan cools you by moving air: its angled blades push air forward as they spin, and moving air carries heat and sweat away from your skin faster. A fan does not make the air colder; it only makes you feel cooler.\n\nThis fan starts on, spinning and swinging slowly from side to side. Tap it to switch it off, and the blades slow to a stop; tap again to switch it on. In the Toy tab, turn the swing on or off and pick its color.",
  },
  lamp: {
    howTo: "Tap to switch the light off or on.",
    about:
      "A desk lamp has a jointed arm that bends, so you can point its shade right where you need light, over a book or a drawing. The shade stops the light from shining in your eyes and sends it down onto the desk.\n\nThe lamp starts on, with a warm glow under the shade. Tap it to switch the light off, and tap again to switch it on. Pick its color in the Toy tab.",
  },
  "potion-bottle": {
    howTo: "Tap it to pop the cork.",
    about:
      "A potion is a magic drink from fairy tales and wizard stories, said to make you fly, shrink or fall asleep. This one sits in a round glass flask with a long neck and a cork, the kind that chemists really use: the round bottom is strong and heats evenly.\n\nBubbles rise through the potion all the time. Tap it to pop the cork: it shoots up with a puff of glittering sparkles, then drops back into the neck. Pick the color of the potion in the Toy tab.",
  },
  telescope: {
    howTo: "Tap to collapse it; tap again to pull it out.",
    about:
      "A telescope uses lenses or mirrors to make faraway things look nearer and bigger. This is a sliding spyglass, the kind sailors carried: its tubes slide inside one another, so it folds up short and pulls out long, with a big lens at the far end that gathers light. Galileo Galilei used a small telescope in 1610 to see the moons of Jupiter.\n\nThe telescope starts pulled out, on a three-legged stand. Tap to collapse it, sliding the tubes together, and tap again to pull it out.",
  },

  // ---- Real objects (lane Real objects) -------------------------------------------------
  "fountain-pen": {
    howTo: "Tap it to uncap the pen and write a swirl in wet blue ink.",
    about:
      "A fountain pen carries its own ink inside. The ink runs from the barrel through a thin channel called the feed to a split metal nib, and the slit draws it down to the paper by capillary action, the same pull that lets a paper towel soak up water.\n\nThis one is made from a detailed 3D model of a real green pen. Tap it and the cap slides off and clicks onto the back end, the nib writes a looping swirl that shines while it is wet and dries darker, and the cap goes back on.",
  },
  "water-bottle": {
    howTo: "Tap it to unscrew the cap and pour water into the glass.",
    about:
      "A reusable steel bottle closes with a screw cap. The cap's thread is a ramp wrapped around a cylinder, so turning it twice pulls it down tight against the bottle's mouth and keeps the water in.\n\nThis bottle is made from a detailed 3D model of a real one. Tap it and the cap spins off in two turns and hops aside, the bottle tips and a stream of water glugs into the glass, then it all runs back and the cap screws on. The glug comes from air: bubbles have to push back into the bottle to take the place of the water that leaves.",
  },
  "soda-can": {
    howTo: "Tap it to shake the can and pop it open.",
    about:
      "A soda can holds a drink with carbon dioxide gas dissolved in it under pressure. Shaking the can makes lots of tiny bubbles, and when the ring pull opens it the pressure drops at once, so the gas rushes out of the drink and carries foam with it.\n\nThis can is made from a detailed 3D model of a real one, with a plain orange label. Tap it and it shakes, the ring pull levers up with a crack, and a jet of foam sprays out while drops spatter around it, then the tab folds back and the foam fizzes away.",
  },
  "running-shoe": {
    howTo: "Tap it to untie the laces and tie them again, then watch it tap its toe.",
    about:
      "A running shoe is laced through rows of eyelets, so the laces pull the shoe snug around the foot. The usual bow is a reef knot with two loops: if the second half is tied the wrong way round, it becomes a granny knot, which slips and comes undone much more easily.\n\nThis shoe is a photo scan of a real trail shoe. Tap it and its laces come undone, cross over and tie themselves into a bow again, and the shoe taps its toe twice. Pick a flag in the top bar and the shoe wears its colors.",
  },
  hoodie: {
    howTo: "Tap it to flip the hood and cross the sleeves.",
    about:
      "A hoodie is a sweatshirt with a hood, first made in the 1930s for people working in cold places. Its soft fleece is knitted cotton brushed on the inside, and a drawstring runs through the edge of the hood to pull it snug. This one has raglan sleeves, whose seams run from the armpit up to the collar.\n\nIt is made from a detailed 3D model of a real hoodie. Tap it and the hood flops forward and flips back up as the drawstrings swing, then the sleeves swing up, cross in front and settle back. Pick a flag in the top bar and the hoodie wears its colors.",
  },
  sunglasses: {
    howTo:
      "Tap them (the frame or a lens) to fold the arms, flip the glasses round and darken the lenses.",
    about:
      "These are round glasses with light-changing lenses. Special molecules in the lenses change shape in the sun's ultraviolet light and start to absorb light, so the lenses turn dark outdoors and clear again a few minutes after you go inside.\n\nThe frame comes from a detailed 3D model of real vintage spectacles. Tap them and the arms fold in on their hinges one after the other, the glasses flip over to face you and the lenses darken from clear to deep gray, then everything unfolds and clears. Pick a flag in the top bar and the frame wears its colors.",
  },
  "baseball-cap": {
    howTo: "Tap it to flip the cap off its stand and spin it like a flying disc.",
    about:
      "A baseball cap is a round crown sewn from six panels, with a button on top and a stiff brim that shades the eyes. Baseball players wore caps like it in the 1800s, and now people wear them everywhere.\n\nThis gray cap is made from a detailed 3D model of a real one, resting on a wooden stand. Tap it and it flips up off the stand, spins flat like a flying disc and lands brim backward, then a second flip turns it round the right way. A spinning disc stays level because its spin resists being tipped over. Pick a flag in the top bar and the cap wears its colors.",
  },
  // ---- Medieval -------------------------------------------------------------------------
  "sword-in-stone": {
    howTo: "Tap to pull the sword from the stone; tap again to go back.",
    about:
      "The sword in the stone comes from the old legends of King Arthur of Britain. A sword was stuck fast in a great stone, and only the true king could pull it out. Many strong knights tried and failed, until the young Arthur drew it out easily and was made king.\n\nTap it to try: the sword sticks at first and wiggles, then slides free and rises in a shower of golden sparkles. Tap again to put it back in the stone. The Arthur stories have been told and retold for more than 800 years.",
  },
  shield: {
    howTo: "Tap it and it blocks a blow where you tap: sparks fly and the emblem gleams.",
    about:
      "A heraldic shield carries a coat of arms, a painted design that showed who a knight was, even when a helmet hid the face. Heraldry has its own words: the background is the field, and a shape on it is a charge. A chevron is an upside-down V, a bend is a stripe from corner to corner, a saltire is an X-shaped cross, and per pale means split down the middle.\n\nTap it and it takes an unseen knock right where you tapped: it jolts and rocks away from the blow, sparks spray off the spot, and a gleam sweeps across the emblem. Pick one of seven designs and the colors of the field and the charge in the Toy tab.",
  },
  "bow-and-target": {
    howTo: "Tap to shoot an arrow; tap again to go back.",
    about:
      "Archery is the sport of shooting arrows with a bow at a target. Drawing back the string bends the bow's springy limbs, which store the energy of your pull; when the string is let go, the limbs spring back and send the arrow flying. A target has rings of color, with gold in the middle, and the closer to the center, the more points.\n\nTap to shoot: the string draws back, the arrow flies across and lands in the target, and a fresh arrow waits on the string. Tap again to go back. Archery was first part of the Olympic Games in 1900.",
  },
  trebuchet: {
    howTo: "Tap it to launch: the weight drops and the long arm flings a stone.",
    about:
      "A trebuchet is a giant throwing machine from the Middle Ages. A long wooden arm swings on an axle, with a heavy weight on its short end and a sling on its long end. When the weight falls, the long end whips up and over, the sling swings out and lets go, and the stone flies a long way. Carpenters built them from great timbers, and the biggest could throw a stone as heavy as a person.\n\nTap it to launch: the weight drops, the arm swings up and the stone sails off, then the arm comes back down, ready for the next one. Today people build trebuchets for fun, to throw pumpkins in contests.",
  },
  crossbow: {
    howTo: "Tap it to shoot a bolt; the string snaps and a new bolt loads.",
    about:
      "A crossbow is a short, strong bow fixed crosswise on a wooden stock. The drawn string is held back by a catch, so it can wait until the trigger lets it go. It shoots short, thick arrows called bolts. Crossbows were used in China more than 2,000 years ago and later all over medieval Europe, and today people shoot them at targets as a sport.\n\nTap it: the trigger lets the string go, the string snaps forward with a buzz and the bolt flies off along its groove. Then the string is drawn back and a new bolt appears.",
  },
  "knights-helmet": {
    howTo: "Tap to open the visor; tap again to close it.",
    about:
      "A knight's helmet was made of steel, hammered into shape by a skilled craftsman called an armorer. The front piece, the visor, has narrow slits and holes to see and breathe through, and it swings up on pivots at the sides so the knight could show their face. Plumes of colored feathers on top made the knight easy to spot at a tournament.\n\nTap it to open the visor, and tap again to close it. Pick the color of the plume in the Toy tab. A full suit of steel plate armor weighed about 20 to 25 kilograms (45 to 55 pounds).",
  },
  crown: {
    howTo: "Tap it: it rises and its jewels light up one by one.",
    about:
      "A crown is a ring of gold or silver worn on the head by a king or queen, a sign of their rule. Many crowns are set with jewels and lined with a soft velvet cap. Royal crowns are often kept with other treasures called the crown jewels, and some are hundreds of years old.\n\nTap it and the crown lifts and hovers. Its eight jewels light up one after another around the band, each flashing white, while golden sparkles drift up around it; then the jewels go out in turn and it settles back down. Pick the color of the velvet in the Toy tab.",
  },
  "dragon-egg": {
    howTo: "Tap to hatch the egg; tap again to go back.",
    about:
      "Dragons are creatures of legend, told of all over the world. In many European tales they are winged, fire-breathing beasts that guard treasure; in Chinese stories they are wise, long, snake-like beings that bring rain and good luck. In stories, a dragon hatches from an egg, just as lizards and snakes do.\n\nTap it to hatch the egg: cracks run across the scaly shell, it breaks open and a baby dragon peeks out in a burst of golden sparkles. Tap again to go back. Pick an emerald, ruby, sapphire or gold egg in the Toy tab.",
  },
  "wizards-orb": {
    howTo: "Tap it to cast a spell: sparks spiral out and runes circle the orb.",
    about:
      "A wizard's orb is a glass ball from stories of magic, where a wizard gazes into it to see faraway places or the future. This one sits on a stand, with glowing magic swirling inside. Runes, the letters of old alphabets once used in northern Europe, are often carved on magic things in stories.\n\nTap it to cast a spell: a flash of light fills the glass, the swirl spins up, sparks spiral out in five arms, and a ring of runes rises and circles the orb before it fades. Pick the color of the magic in the Toy tab.",
  },
  "crystal-ball": {
    howTo: "Tap it to swirl the mist and raise a glowing sign.",
    about:
      "A crystal ball is a ball of clear glass or quartz. In old stories, fortune tellers gaze into one to see visions of what is to come. A real clear ball also works like a lens: look through it and you see the room behind it, small and upside down.\n\nThis one is filled with glowing mist. Tap it and the mist whips around and thins, and a glowing sign rises out of it, turns once and fades: a star, a moon or a heart in turn. Pick the color of the mist in the Toy tab.",
  },

  // ---- Animals --------------------------------------------------------------------------
  jellyfish: {
    howTo: "Tap it to make it swim: one strong stroke jets it upward.",
    about:
      "A jellyfish is a soft sea animal with no brain, no heart and no bones; its body is mostly water. It swims by squeezing its bell-shaped body, which pushes water out behind it, and it trails long tentacles armed with tiny stingers to catch its food. Jellyfish have drifted in the oceans for more than 500 million years.\n\nTap it and one strong stroke squeezes the bell and jets it up, trailing its glowing tentacles, then it drifts slowly back down. Pick a moon jelly, a sea nettle or a blue one in the Toy tab.",
  },
  "fish-school": {
    howTo: "Tap it: the school swirls into a ball, bursts apart and swims back.",
    about:
      "A school is a big group of fish swimming together, all turning at once. Each fish keeps pace with its neighbors by watching them and by feeling the water move along a line of special sense organs down its sides. Being one of many makes it much harder for a hunter to pick out any single fish.\n\nThese 48 fish each swim on their own. Tap it and the school tightens into a spinning bait ball, the shape small fish make when a hunter comes near, then bursts outward in every direction and swims back into place. Pick silver or tropical fish in the Toy tab.",
  },
  butterfly: {
    howTo: "Tap it to make it flutter faster.",
    about:
      "A butterfly is an insect with four large wings covered in tiny, overlapping scales, and the scales make its colors and patterns. Every butterfly starts life as a caterpillar, which wraps itself in a case called a chrysalis and comes out as a butterfly. Some colors, like the shining blue of the blue morpho, come from the shape of the scales, not from any paint-like color in them.\n\nIt flaps its wings slowly all the time. Tap it to flutter, beating its wings faster and wider for a moment. Pick a monarch, a blue morpho, a swallowtail or a rose butterfly in the Toy tab.",
  },
  pufferfish: {
    howTo: "Tap it to poke it. Try the Puff slider in the Toy tab.",
    about:
      "A pufferfish is a slow swimmer with a clever defense: when it is frightened, it gulps water and swells up into a ball several times its normal size, and in many kinds, spines stand out all over it. That makes it very hard for a hungry fish to swallow. Many pufferfish are also poisonous to eat.\n\nThis one rests slim. Tap it to poke it: it puffs up into a big, spiky ball, holds it, then lets the water out with a sputter and shrinks back. Try the Puff slider in the Toy tab too.",
  },
  nautilus: {
    howTo: "Tap it to startle it: it hides its tentacles, then peeks out again.",
    about:
      "A nautilus is a sea animal related to the octopus and the squid, but it lives in a coiled, striped shell. Inside, the shell is split into chambers: the nautilus lives in the biggest, newest one and fills the older ones with gas and a little water to float up or sink down. It has up to 90 small tentacles and swims by squirting water. Animals like it have lived in the sea for about 500 million years.\n\nTap it and, startled, it jets back a little and pulls its tentacles in behind its hood. It waits, peeks out halfway, then slowly reaches out again.",
  },
  ladybug: {
    howTo: "Tap to open the wings; tap again to close them.",
    about:
      "A ladybug is a small, round beetle. Its red, spotted back is really a pair of hard wing cases, and under them, thin flying wings lie folded up. Its bright colors warn birds that it tastes bad. Gardeners love ladybugs, because they eat the tiny aphids that harm plants.\n\nTap it to open the wings: the red wing cases lift and spread, and the thin wings unfold beneath them, ready to fly. Tap again to fold them away. Counting its spots will not tell you how old a ladybug is: the number depends on the kind of ladybug.",
  },
  snail: {
    howTo: "Tap to make it hide in its shell; tap again to bring it out.",
    about:
      "A snail carries its home on its back: a coiled shell it can pull its whole body into. It glides along on one long, muscular foot over a thin layer of slime, and its eyes sit at the tips of its two long upper tentacles. In dry weather, a snail can seal its shell with a layer of dried slime and wait for rain.\n\nTap it and it hides, as a real snail does: the eye stalks roll in first, then the head and the foot are drawn in through the shell's opening, and the shell settles on the ground. Tap again and it slides back out, the eye stalks unrolling last.",
  },
  octopus: {
    howTo: "Tap it to squirt ink.",
    about:
      "An octopus is a soft-bodied sea animal with eight arms lined with suckers. It has three hearts and blue blood, no bones at all, and it can change the color of its skin in a split second to hide or to signal.\n\nWhen something scares it, an octopus squirts a cloud of dark ink and jets away behind it. Tap this one and it does just that: the ink billows out while it shoots up and away with its arms streaming, then it drifts back as the ink thins. You can pick its color in the Toy tab.",
  },
  starfish: {
    howTo: "Tap it to wave its arms.",
    about:
      "A starfish, or sea star, is not a fish at all but a relative of the sea urchin. It has no brain and no blood; seawater flows through its body instead. Under each arm are hundreds of tiny tube feet that let it creep along and grip rocks, and at the tip of each arm is a simple eye. If it loses an arm, it can grow a new one.\n\nTap it and its five arms lift and curl in turn, like a slow wave, then settle back. Pick an orange, red, purple or blue starfish in the Toy tab.",
  },
  "sea-urchin": {
    howTo: "Tap it: its spines sweep in waves and it creeps along.",
    about:
      "A sea urchin is a round, spiny sea animal, a relative of the starfish. Its spines protect it, and between them it has long, thin tube feet with suckers that it uses to walk and to hold on. Its mouth is underneath, with five strong teeth for scraping seaweed off rocks.\n\nTap it and its spines sweep around it in waves, each tilting on its base, while pink tube feet reach out, and it creeps a little way to the side and back. Pick a purple, black, red or green urchin in the Toy tab.",
  },
  frog: {
    howTo: "Tap it: a fly buzzes in and the frog catches it with its tongue.",
    about:
      "A frog is an amphibian: it starts life as a tadpole swimming in water and grows legs and lungs to live on land as well. It catches insects with a long, sticky tongue that flips out of its mouth in a flash. To swallow, a frog pulls its big eyes down into its head, and they help push the food down its throat.\n\nTap it: a fly buzzes in and hovers, the frog's tongue shoots out, catches it and snaps back, its eyes sink to swallow, and it croaks twice with a puff of its throat. Pick a green, red, blue or yellow frog in the Toy tab.",
  },
  penguin: {
    howTo: "Tap it to flap its flippers.",
    about:
      "A penguin is a bird that cannot fly, but it is a superb swimmer: its wings are stiff, strong flippers that it uses to fly through the water. Almost all penguins live in the southern half of the world. The largest, the emperor penguin, stands about 1.1 meters (3.7 feet) tall.\n\nTap it and it flaps its flippers up and down. Its colors help it hide in the sea: from above, its black back blends with the dark water below, and from below, its white front blends with the bright surface.",
  },
  owl: {
    howTo: "Tap it and it turns its head to look behind.",
    about:
      "Owls are birds that mostly hunt at night. Their big eyes cannot move in their sockets, so an owl turns its whole head instead, as far as about 270 degrees, three-quarters of the way around. Soft, fringed edges on its feathers let it fly almost without a sound.\n\nThis owl sits on a branch. Tap it and it turns its head far around to look behind it, holds there a moment, then turns back to face you.",
  },

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
    howTo:
      "Tap it: the knot pulls loose and springs back. Drag to turn it. Pick a knot in the Toy tab.",
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
  "splat-equation": {
    howTo: "Tap to play time t. Pick a program, or type your own equations, in the Toy tab.",
    about:
      "Every splat has a place and a color. Here you program them with math: each splat gets two numbers, u and v, and your equations x, y and z turn them into its place, while hue (or r, g and b) gives its color. Time t runs from 0 to 2π, so the shape can move.\n\nTap it to play one cycle of t and watch the shape move. Pick a sphere, a torus, a Möbius strip, a seashell, a trefoil knot, a wave, a spiral galaxy or a Klein bottle in the Toy tab, or type your own, such as z = sin(u + t). Under Splats, Solid shows a clean surface, Fine a finer one, and Dots every splat on its own. The Tinkerer's Manual explains the whole language.",
  },
  "pythagoras-proof": {
    howTo: "Tap it to slide the triangles and show that a² + b² = c².",
    about:
      "In a right triangle, the two short sides a and b and the long side c always fit a rule: a² + b² = c². So a square drawn on the long side has the same area as the squares on the two short sides put together. It is named after Pythagoras, a Greek thinker of about 2,500 years ago, though people in Babylon knew it even earlier.\n\nThis is one of the oldest proofs. Four copies of the triangle fill a big square, leaving two empty squares, a² and b². Tap it and the triangles slide into the corners, and the empty space becomes one tilted square, c², so a² + b² must equal c². Then they slide back.",
  },

  // ---- AI and computing ----------------------------------------------------------------
  perceptron: {
    howTo: "Tap it to watch it try an example, get it wrong, and learn.",
    about:
      "A perceptron is the simplest artificial neuron, invented by Frank Rosenblatt in 1958. It takes a few inputs, multiplies each by a weight (how much that input counts), and adds them up. If the sum passes a threshold, it fires: its answer is 1, otherwise 0. It learns by nudging its weights each time it gets an answer wrong.\n\nTap it: inputs X1 and X3 light up and send pulses along wires as thick as their weights. The sum fills the gauge but stays under the threshold line, so the lamp flashes red. The two live wires thicken, the pulses go again, the gauge passes the line and the lamp lights gold. Pick the flat poster or a 3D model in the Toy tab.",
  },
  "multilayer-perceptron": {
    howTo: "Tap it to try all four inputs and fill in the XOR truth table.",
    about:
      "One perceptron can only split its inputs with a single straight line, so it cannot learn XOR, “exclusive or”, which is 1 when exactly one of two inputs is 1. Put neurons in layers and it can. Here an OR neuron and a NAND (“not both”) neuron feed an AND neuron, and together they give XOR. Blue wires add to a neuron's sum and red wires subtract.\n\nTap it and it tries the inputs 00, 01, 10 and 11 in turn, lighting each neuron that fires, and fills in the truth table: 0, 1, 1, 0. Pick the poster or a 3D model in the Toy tab.",
  },
  "neural-network": {
    howTo: "Tap it to send signals forward, then learn backward. Set its size in the Toy tab.",
    about:
      "A neural network is made of simple artificial neurons in layers. Each neuron adds up the signals coming in, each multiplied by a weight, and passes on a signal of its own; the weights are what the network learns. In training, a forward pass makes a guess, and backpropagation sends the error back through the network, nudging every weight a little to do better next time.\n\nTap it: pulses run from the inputs through the hidden layer to the outputs, each neuron glowing as strongly as it fires, and one output wins. Then red pulses run back and the wires thicken or thin as the weights change. In the Toy tab, set the number of inputs, hidden layers, neurons and outputs, and pick the poster or a 3D model.",
  },
  cnn: {
    howTo: "Tap it to read the digit. Draw your own digit in the Toy tab.",
    about:
      "A convolutional network, or CNN, is a neural network built for pictures. It slides small filters across the picture: each filter is a little grid of weights that lights up where it finds its pattern, such as a slanted stroke, and makes a feature map. Pooling shrinks the map, keeping the strongest signal in each patch, and later layers combine the features to recognize the whole shape.\n\nTap it: a glowing 3-by-3 filter slides over a handwritten 7, stamping a feature map tile by tile; the tiles pool into a smaller map, and the scores for the digits 0 to 9 rise with 7 on top. In the Toy tab, pick a 3D view, or draw a digit and a small trained network reads it. Each square on the drawing pad is one pixel of the small 8-by-8 picture the network reads: the lighter its gray, the more ink it holds, and the pad starts with the sample 7.",
  },
  rnn: {
    howTo: "Tap it to read a sentence one word at a time. Try the LSTM style in the Toy tab.",
    about:
      "A recurrent network, or RNN, reads a sequence, like the words of a sentence, one piece at a time. It keeps a memory called the hidden state: after each word, the state loops back in with the next word, so what it knows builds up as it reads. An LSTM (long short-term memory) adds gates that decide what to forget, what to take in and what to pass on.\n\nTap it: THE, CAT and SAT rise into the cell one at a time. The cell flashes, and the glowing orb, the hidden state, takes on the word's color mixed with what it carried and runs around the loop. In the Toy tab, pick the LSTM style to see its three gates open and shut like shutters, or a 3D model.",
  },
  transformer: {
    howTo: "Tap it to predict the next word. Try the Encoder–decoder diagram in the Toy tab.",
    about:
      "A transformer is a neural network for language, first described in 2017. It splits text into tokens, and in each layer every token uses attention: it looks at all the others and weighs how much each one matters to it. After many layers, it predicts the next token. Tap it: arcs jump between THE CAT SAT ON, thicker where attention is stronger, one color for each of two heads; the tiles rise through the layers, and MAT drops in.\n\nThe Encoder–decoder diagram in the Toy tab is the classic design. Its key: an eye is attention; a lidded eye, masked attention (it only looks back); +, add and norm; », feed forward; a vector, embedding; a wave, positional encoding; a slash, linear; bars, softmax; N×, repeated N times. HELLO WORLD goes in, and given START HOLA, it predicts MUNDO.",
  },
  "looped-transformer": {
    howTo: "Tap it: the tiles loop through one block, sharper each lap, until 3 + 4 = 7.",
    about:
      "A looped transformer runs the same transformer block again and again, feeding its output back in as its next input, instead of stacking many different layers. Each pass through the loop can refine the answer a little more, a bit like checking your work, so a small model can spend longer thinking about a harder problem.\n\nTap it: five tiles ride three laps around a track through one block. Each pass sharpens every tile one step, from noise to a blocky mosaic, to nearly right, to exact, until “3 + 4 = 7” settles with the 7 in gold. Pick the poster or a 3D model in the Toy tab.",
  },
  "diffusion-model": {
    howTo: "Tap it: the noise clears, step by step, into a rubber duck.",
    about:
      "A diffusion model makes pictures out of noise. It is trained by taking real pictures, adding random noise to them a little at a time until only specks are left, and learning to undo each step. To make a new picture, it starts from pure noise and takes a little away at each of many steps, until a clear picture appears.\n\nTap it: a cloud of random specks clears in ten steps into a rubber duck while the STEP counter runs down from 50 to 0, then the noise washes back over it. It suits Splashery well: every toy here is drawn from many soft, blurry points too. Pick the poster or a 3D model in the Toy tab.",
  },
  "gradient-descent": {
    howTo: "Tap it to roll the ball downhill. Try the Learning rate in the Toy tab.",
    about:
      "Gradient descent is how most neural networks learn. Picture the network's error as a hilly landscape: the lower the ground, the better its answers. At each step, it works out which way is downhill, the gradient, and steps that way. The learning rate sets how big each step is, and momentum lets it keep some speed from step to step.\n\nTap it: the ball takes 21 hopping steps downhill, leaving a trail of dots, overshoots the valley and settles in it. In the Toy tab, set the Learning rate: too low, and it creeps down the slope; too high, and it bounces from wall to wall; just right, and it settles.",
  },
  "gaussian-splatting": {
    howTo: "Tap it: random splats learn the photo. Pick another View in the Toy tab.",
    about:
      "Gaussian splatting draws a scene with many soft, colored blobs called splats. Each one has a place, a size in three directions, a turn, a color and an opacity. A scan's splats are trained the way a network learns: start from a random cloud, compare the picture it makes with the photos, and nudge every splat a little, again and again, until they match.\n\nTap it: a cloud of random splats slides, stretches and recolors into the strawberry photo, a real fit of 2,400 splats, while its error falls on the chart. Other views show one splat with its three axes, which a tap trains: it starts from a wrong guess and gradient steps move its place, turn, sizes, color and opacity toward the target outline, big steps first and then smaller ones, as in a real fit; a duck whose splats shrink to dots, and the back-to-front order splats are drawn in.",
  },
  "word-vectors": {
    howTo: "Tap it to work out king − man + woman. Type your own words in the Toy tab.",
    about:
      "Word vectors turn each word into a list of numbers, a point in a space with many directions, so that words used in similar ways land near each other. These have 50 numbers per word, learned from a huge amount of text. Directions in the space can carry meaning: the step from man to woman is much like the step from king to queen.\n\nTap it: an arrow runs out to KING, the step from MAN to WOMAN is added on from there, and it lands right next to QUEEN, which lights up. Type your own A − B + C in the Toy tab, with any of 24,000 common words, and it finds the nearest word to the answer.",
  },
  "sorting-machine": {
    howTo: "Tap it to sort the bars. Pick one of eight ways to sort in the Toy tab.",
    about:
      "A sorting algorithm is a step-by-step recipe a computer follows to put things in order. There are many: bubble sort keeps swapping neighbors that are the wrong way around; quicksort picks one item and splits the rest into smaller and bigger piles; merge sort sorts small groups, then merges them. On a long list, some need far fewer steps than others.\n\nTap it: eight bars of different heights sort themselves, each bar gliding to its new place, while a counter counts the swaps; then they shuffle back. Pick one of eight algorithms in the Toy tab, from bubble sort to heap sort, and watch how differently they work.",
  },
  "half-adder": {
    howTo: "Tap it to add 1 + 1 in binary: the answer is 10.",
    about:
      "A half adder is a tiny circuit that adds two bits, binary digits that are each 0 or 1. It uses two logic gates: an XOR gate gives the sum bit, which is 1 when exactly one input is 1, and an AND gate gives the carry bit, which is 1 when both are. Two half adders make a full adder, and a chain of full adders lets a computer add numbers of any size.\n\nTap it: switches A and B flip to 1, and light runs along the wires into the gates. The XOR gives 0, so the sum lamp stays dark, and the AND lights the carry lamp. The board reads 1 + 1 = 10, which is two in binary. Then the switches flip back.",
  },
  // ---- Machines that compute (lane Machines A) ----
  "turing-machine": {
    howTo: "Tap it to run the program on the tape. Type your own number in the Toy tab.",
    about:
      "In 1936 the mathematician Alan Turing imagined the simplest possible computer: a long tape of squares, a head that reads and writes one square at a time, and a short table of rules. Each rule says: in this state, reading this symbol, write this, move left or right, and switch to that state. Anything a modern computer can work out, a machine like this can too, given enough tape and time.\n\nTap it: the head reads a tile, flips it to write, and the tape slides, following the lit row of the rule card, until the machine halts with a bell. Add one turns 1011 into 1100 as the carry ripples left; tap again to count on. The busy beavers write as many 1s as a machine of their size can and still halt.",
  },
  "difference-engine": {
    howTo:
      "Tap to turn the crank once; tap again to keep cranking. Type your own polynomial in the Toy tab.",
    about:
      "Charles Babbage designed his Difference Engine No. 2 in the 1840s to print mathematical tables without human mistakes. It was never built in his lifetime. In 1991, a team at a museum in London finished its calculating section from his drawings, and it worked. It uses the method of differences: for a polynomial, the differences between neighboring values settle into a pattern, so each new value needs nothing but addition.\n\nTap it: the crank turns, each difference is added into its neighbor, the wheels click round, and carries ripple up with little levers. For n², the value column shows 1, 4, 9, 16 and 25 in turn. Type your own polynomial, up to x³, and pick the starting x.",
  },
  "enigma-machine": {
    howTo:
      "Tap the keys or type to code letters. Tap the machine to decode. Tap the pad to clear it.",
    about:
      "The Enigma was a cipher machine that German forces used to keep radio messages secret in World War II. Each key press steps the rotors on like an odometer, and an electric current runs through the plugboard, three wired rotors and a reflector, lighting a different letter on the lampboard. Because the rotors keep turning, the same letter comes out differently each time. Polish mathematicians first broke it in 1932.\n\nTap a key, or type: the key goes down, the rotors step (with the middle rotor's real double step), and the coded letter lights up and is written on the pad under yours. Tap the machine off the keys: the coded letters, typed from the same start, give your message back. With nothing typed, that tap types the message on the pad (HELLO, or your own from the Toy tab) and the next one decodes it. Tap the pad for a clean sheet. On a keyboard, hold Shift for P and R. It uses the historical wirings of rotors I, II and III and reflector B.",
  },
  bombe: {
    howTo: "Tap it to search for the Enigma setting. Type a message to break in the Toy tab.",
    about:
      "The Bombe was the codebreaking machine of Bletchley Park in England. Alan Turing designed it in 1939, building on a Polish machine, and Gordon Welchman added the diagonal board that made it far faster. Its rows of drums copy Enigma rotors. From a crib, a few words the codebreakers guessed were in a message, it tried rotor settings at great speed and stopped when the logic held. About 200 were built, run day and night mostly by members of the Women's Royal Naval Service, the Wrens.\n\nTap it: the drums spin through the settings, stop, and the lamp lights; then the message reads out. Simplified here: the plugboard is taken as known, and the drums turn far slower than the real ones.",
  },

  // ---- Pictures and pages ---------------------------------------------------------------
  "picture-lab": {
    howTo:
      "Tap the right of the page to go on, the left to go back; tap a video to play it. Open your own in the Toy tab.",
    about:
      "The Picture lab shows a page, a photo, a GIF or a video as Gaussian splats: thousands of small, flat, colored discs, the same stuff every toy here is made of. A document's paper becomes a smooth sheet of large splats in the paper's own color, and every pixel of ink becomes one small splat of its own color, a hair in front. A photo gets one splat per pixel.\n\nDouble-tap the page to fill the screen with it. Zoom in and the page is rebuilt sharper; zoom out and it gets coarser, so nothing vanishes. Open a PDF, a photo, a GIF or a video of your own in the Toy tab, or paste a web address. Your files stay on your device: nothing is uploaded.",
  },
  "your-book": {
    howTo:
      "Tap the right page to turn on, the left to go back, or pull one over. Double-tap a page to read it up close.",
    about:
      "A book is a stack of pages bound along one edge, so you can turn them one at a time. People have bound pages this way for about two thousand years; before that, long texts were rolled up as scrolls.\n\nOpen any PDF of your own in the Toy tab, as long as you like, and tap to turn its pages (the right page turns forward, the left goes back), or take a page by its edge and pull it over: let go past halfway and it turns, otherwise it falls back. Each page curls as it goes over. Stapled paper flips up over the top: tap near the top of the page to go back. Double-tap a page to fill the screen with it, and again to see both; Reading: One page goes a page at a time. Only the pages you reach are made into splats, so a long book stays light. Pick hardcover, paperback, magazine, stapled paper or spiral notebook in the Toy tab. Your file stays on your device.",
  },
  "photo-album": {
    howTo:
      "Tap the right page to turn on, the left to go back, or pull one over. Double-tap a page to see it up close.",
    about:
      "A photo album keeps printed photos on thick pages. Small paper corners hold each photo by its four corners, so nothing is glued to the picture and it can be slipped out again. Albums like this were common from the late 1800s, when cameras first let families take their own pictures.\n\nPick several photos of your own at once in the Toy tab and turn through them with a tap, or pull a page over by hand (the thick pages are heavier than a book's): two wide photos share a page, one above the other, and two tall ones sit side by side. Double-tap a page to fill the screen with it, or set Reading to One page to go through a page at a time. Pick a leather, linen or scrapbook cover, and turn the file names under the photos on or off. Your photos stay on your device.",
  },
  "picture-frame": {
    howTo:
      "Tap the frame to set it swinging on its nail. Open your own photo, GIF or video in the Toy tab.",
    about:
      "A picture frame protects a photo and sets it apart from the wall. Many hang from a single nail on a wire stretched across the back, so the frame can tilt a little either way until it hangs straight.\n\nTap it and the frame swings on its wire like a pendulum, back and forth, smaller each time, until it settles. Double-tap it to fill the screen with the photo, and again to step back. Pick a wood, gold, modern or digital frame in the Toy tab; the digital frame fades from one photo to the next, in order or at random. Open a photo, a GIF or a video of your own (a GIF or a video plays on a loop), or several photos for the digital frame. Your files stay on your device.",
  },
  screen: {
    howTo:
      "Tap to switch on, then the picture to play or pause. Tap the knob, button, curtains or base to switch off.",
    about:
      "A screen made of splats shows a video or a GIF: every pixel of the picture is a small splat whose color changes with each frame. It comes in four styles: an old TV with a walnut cabinet and a curved glass face, a flat TV on a stand, a cinema with velvet curtains and rows of seats, and a hologram floating above its projector.\n\nTap it to switch it on: the old TV's picture opens from a bright line, the flat TV fades up, the curtains part, or the hologram flickers up from its beam. Tap the picture to pause and play. To switch off, tap the old TV's power knob (the picture shrinks to a bright dot, as old tube sets did), the small button beside the flat TV's red light, the curtains (they close) or the hologram's base, or use the button in the Toy tab. Turn on the sound with the speaker button, and open your own video or GIF in the Toy tab.",
  },

  // ---- Studio ---------------------------------------------------------------------------
  "chladni-plate": {
    howTo:
      "Tap to bow the plate and watch the sand find its still lines. Pick a mode in the Toy tab.",
    about:
      "In 1787 Ernst Chladni sprinkled sand on a metal plate and drew a violin bow along its edge. The plate shook, and the sand jumped away from the places that moved and gathered on the lines that stayed still, a different picture for each pitch. Those still lines are called nodal lines.\n\nTap to bow the plate: it hums at the mode's pitch and every grain of sand, a splat of its own, hops and slides until the figure appears. Tap again to stir the sand up. The Mode choice picks the pitch and the pattern. This toy uses the classic square-plate model, cos(nπx)·cos(mπy) ± cos(mπx)·cos(nπy) = 0, with a pitch that grows with n² + m².",
  },
  // Lane Live input.
  "room-echo": {
    howTo:
      "Tap “Use my microphone” in the Toy tab, then clap once: the echo time shows on the back wall.",
    about:
      "When a sound stops, a room keeps ringing for a moment as the sound bounces between its walls, fading a little at each bounce. The reverberation time, RT60, is how long it takes to fade by 60 dB, to a millionth of its energy. A living room with a sofa and curtains is around half a second; a stone church can be several seconds.\n\nTap “Use my microphone” and clap once, sharply. The page listens to your clap fade away, takes away the room's background hum, and fits a straight line to the decay (Schroeder's method, the one acousticians use), then shows the RT60 on the back wall. The rings on the floor are the sound spreading out, each as bright as the room still was at that moment, at half speed. If the room is too noisy for the clap to stand out, it says so. The sound stays on this device; nothing is recorded or sent.",
  },
  "splat-mirror": {
    howTo:
      "Tap “Use my camera” in the Toy tab to see yourself in splats; turn the picture to see its depth.",
    about:
      "A mirror made of splats. Tap “Use my camera” and each splat takes the color of its place in the picture, so the mirror shows you, live.\n\nA depth model, Depth Anything V2 Small, then works out how near each part of the picture is, as often as your device can (several times a second on a computer), and each splat moves toward you by that much: your nose comes forward and the wall behind you stays back. Turn the picture to see the relief. It is a guess from one camera, so the depth is relative, like a sculptor's relief, not exact distances. The model (about 27 MB) loads only after you tap, and the pictures stay on this device; nothing is recorded or sent.",
  },
  "song-landscape": {
    howTo:
      "Tap to play the song as a landscape. View: Live scrolls it with the music. Open your own song in the Toy tab.",
    about:
      "A song is a wave, but you can also see what it is made of. This toy cuts the sound into short slices, measures how loud each pitch is in every slice (a short-time Fourier transform) and stands the answer up as a landscape of splats: time runs away from you, pitch runs across from low to high, and loudness is height.\n\nTap to play it: a glowing line and the camera glide along the landscape in time with the music. View: Live turns it into a scrolling waterfall like an audio tool's: the part playing now sits on a line at the front, the next seconds come toward you from the back, what has played fades away, and a row of small caps rises with the loudness at the line. Open a song of your own in the Toy tab; it is read on your device and never uploaded. Long songs make longer, coarser landscapes.",
  },

  "model-splats": {
    howTo:
      "Tap to lift the splats off the model and watch them settle back. Open your own 3D model in the Toy tab.",
    about:
      "A 3D model is usually a mesh: a net of flat triangles with colors or a picture (a texture) painted on them. This toy turns a mesh into splats. It scatters points across the surface, more of them where the shape bends sharply or is finely made, and lays a small flat splat on each one, facing the way the surface does. Each splat is sized to its neighbors so the surface closes with no gaps, and takes its color from the texture at that spot. Sharp edges stay sharp.\n\nTap to lift every splat into a loose cloud and watch each one settle back into its own place. Show: Wireframe draws the mesh's own edges as thin splats, so you can see what the splats were made from. Open a .glb, .gltf, .obj or .stl in the Toy tab (select a model's other files with it); it is converted on your device and never uploaded.",
  },

  "photo-3d": {
    howTo:
      "Tap to lift the picture's depth out of it, then tap again to lay it flat. Open your own photo in the Toy tab.",
    about:
      "A photo is flat, but a computer can guess how far away each part of it is. A depth model, a small neural network trained on millions of pictures, looks at your photo and gives every spot a distance: the path is near, the trees are far. This toy runs that model right on your device, and then rebuilds the photo as splats. Each splat takes the photo's color at its place and sits at its guessed depth, so when you turn the toy, near things move across far ones, the way they do when you move your head.\n\nWhere the depth jumps, a near leaf against a far tree, the surface is cut, so the leaf stands as its own layer instead of being smeared to the background. Tap to raise the layers one after another and sway. Layers pulls them apart. Depth sets how deep the relief is. Open a JPEG, PNG or WebP in the Toy tab (the model, 27 MB, loads the first time). Your photo never leaves your device.",
  },

  "video-3d": {
    howTo:
      "Tap to fly the video's own camera path, then drag to roam off it. Open your own video in the Toy tab.",
    about:
      "A video is a string of photos taken from a moving camera. If the scene stands still, each photo shows it from a slightly different place, and that is enough to rebuild it in 3D. This toy picks the sharpest frames of the stretch you choose, finds the same small features (corners, specks, edges) in many of them, and works out where the camera must have been for each frame so that they all line up. That is called structure from motion. Then it trains 3D Gaussian splats: it starts from the points it found and keeps nudging each splat's place, size, shape and color until the scene, seen from each camera, looks like the frame taken there.\n\nIt all runs on your device's graphics card (WebGPU), and nothing is uploaded. It takes minutes, longer on a phone. Things that move while the camera films (cars, people, water) blur or vanish, and blank walls or sky give it nothing to match. Tap Replay flight to fly the video's path with its sound, or save the splats as a PLY.",
  },

  // ---- Lab (lane Lab) -------------------------------------------------------------------
  "splat-field": {
    howTo: "Tap to send a pulse through it; tap again for another. Pick a Field in the Toy tab.",
    about:
      "Nearly 300,000 splats, and the graphics chip works out where every one of them is, and its color, again every frame. Each splat only knows its own two numbers, u and v; a small program turns them and the time into a place. That is why so many splats can move smoothly at once.\n\nThe galaxy's stars each follow an oval orbit, turned a little more the farther out it is, so the ovals crowd into two spiral arms that stay while every star keeps moving. The ocean is four waves added together, each splat tilted to the water's slope, and the knot is a flow along a knotted tube. Tap to send a bright ring out through the galaxy, drop a stone in the sea where you tap, or push the flow once more around the knot. Each tap adds its own: tap the sea in a few places and the rings cross.",
  },

  // ---- Science (lane Science) -----------------------------------------------------------
  "thermal-ellipsoids": {
    howTo:
      "Tap to make the atoms jiggle. Zoom in, then tap an atom to look there. Open your own CIF in the Toy tab.",
    about:
      "X-ray crystallography measures each atom as a place and a spread: heat makes it jiggle, so it is smeared into a small cloud, a 3D Gaussian written in the file as six numbers, the displacement tensor U. Each atom here is exactly that Gaussian; its long axis is the way it moves most.\n\nCrystallographers draw it as an ellipsoid that holds the atom 50% of the time (as ORTEP and Mercury do); the dark lines are its principal planes. Hydrogens are placed by rule, so they are small spheres. The samples are aspirin at room temperature (Crystallography Open Database) and crambin, a small protein (Protein Data Bank). Jiggle moves each atom through places drawn from its own Gaussian, slowed down a trillion times. For looking and sharing, not for measuring.",
  },
  "smlm-microscope": {
    howTo:
      "Tap a spot to zoom in to single molecules; tap again to zoom out. Open your own file in the Toy tab.",
    about:
      "A light microscope can't see things smaller than about 250 nanometers, but super-resolution microscopy (STORM, PALM, PAINT) gets around that: dye molecules blink on a few at a time, and each blink is pinned down to within a few nanometers. The result is a table of positions, each with its uncertainty, which is already a Gaussian. So each one here is a splat exactly as wide as its precision.\n\nThe sample is a 12 µm square of a cell's microtubules and clathrin pits, a subset of a record by Christophe Leterrier on ShareLoc.XYZ (CC BY 4.0). Tap to dive in about 60 times: each fuzzy spot is then one blink of one molecule. Scientists use ThunderSTORM and napari for this; this toy is for looking and sharing, not for measuring.",
  },
  "galaxy-box": {
    howTo: "Tap the gas to zoom in; tap again to zoom out.",
    about:
      "Galaxy simulations follow gas as millions of particles, each with a bit of mass and a smoothing length, the size its gas is spread over. This is the gas of a Milky Way–mass galaxy today from the FIRE-2 simulations (CC BY 4.0), a subset cut to a box round it. Each particle is the Gaussian with the same spread as the simulation's smoothing kernel, colored by temperature (cold blue, hot orange and red) and brighter where denser, so the spiral arms stand out.\n\nTap to zoom into the gas; Only the cold gas peels away the hot. This is an approximation: the simulation's kernel isn't a Gaussian, and blended splats aren't the column density that tools like SPLASH and yt compute. It shows the shape of the gas, not measurements.",
  },

  // ---- Fluid lab (lane Fluids) ---------------------------------------------------------
  "fluid-lab": {
    howTo:
      "Tap to pour, drop a splash, or blow on the candle or the cup. Pick a Scene and a Liquid in the Toy tab.",
    about:
      "Everything that flows here is a crowd of small particles, each drawn as a splat. For the liquids, the computer keeps every particle from crowding its neighbors, so the crowd keeps its volume the way water does, and it evens out the particles' speeds to make them thick: a little for water, a lot for honey and lava. Where the flow is fast and breaks up, it throws off drops, foam and, for soda, rising bubbles. Smoke and steam are lighter particles that rise, swirl in a gently turning breeze, spread and fade. A flame is a stream of short-lived hot particles that rise, narrow to a tongue and cool from blue at the base to yellow, orange and a dull red.\n\nPick a Scene: pour into a glass (the third tap empties it first), splash into a basin, blow out a candle, or blow across a hot cup. Pick a Liquid to see how thickness changes a pour. This is graphics physics: it moves believably, but it is not a validated scientific simulation.",
  },

  // ---- Holidays -------------------------------------------------------------------------
  "jack-o-lantern": {
    howTo: "Tap to lift the lid; tap again to put it back.",
    about:
      "A jack-o'-lantern is a pumpkin carved with a face and lit from inside by a candle, a symbol of Halloween. The custom comes from Ireland and Britain, where people once carved faces into turnips and potatoes; in North America, the big, soft pumpkin turned out to be much easier to carve.\n\nThis one glows through its carved eyes and grin. Tap to lift the lid off the top, and tap again to put it back. The name comes from an old Irish tale of a man called Stingy Jack, who wandered the night carrying a lantern.",
  },
  snowman: {
    howTo: "Tap to melt it and build it again. Try the Warmth slider in the Toy tab.",
    about:
      "A snowman is built from big balls of snow rolled across the ground, stacked up and given a face of coal, a carrot nose, stick arms, a scarf and a hat. Snow packs best when it is just at the melting point and a little wet, so the flakes stick together. Fresh snow is mostly air, which is why it is so light and fluffy.\n\nTap it and it melts: the snowballs shrink, the head first, drips fall, and the hat, nose, coals, arms and scarf drop off one by one, and the meltwater spreads into a puddle around it. Then it builds itself again from the bottom up. The Warmth slider in the Toy tab melts it the same way.",
  },
  fireworks: {
    howTo: "Tap it to launch a firework; tap quickly for a few at once.",
    about:
      "Fireworks were invented in China more than a thousand years ago. A firework shell is shot high into the air, where it bursts and throws out little pellets called stars, which burn in bright colors. The colors come from metals mixed in: strontium burns red, barium green, copper blue and sodium yellow.\n\nTap it to launch: a rocket rises from one of the tubes in the crate and bursts in that tube's color. Each tap fires a different tube and a different shell: a round peony, a ring, a drooping willow or a star, so no two in a row look alike. Tap quickly and up to three fly at once, one from each tube.",
  },
  "decorated-tree": {
    howTo: "Tap to switch the lights on or off.",
    about:
      "A decorated tree is an evergreen tree, such as a fir or a pine, brought indoors and hung with lights, ornaments and a star on top for the Christmas season. The custom began in Germany about 500 years ago and spread around the world. Evergreens stay green all winter, so they became a sign of life in the darkest time of the year.\n\nThe tree starts with its lights off. Tap to switch them on: they sweep up the tree, stay on and cycle through chasing, rippling and steady patterns, while the star glows. Tap again to switch them off. The first electric tree lights were made in 1882.",
  },
  "patterned-egg": {
    howTo: "Tap it to spin it. Pick a pattern and its colors in the Toy tab.",
    about:
      "Decorating eggs with bright patterns is a spring tradition in many countries, especially at Easter. In Ukraine and nearby lands, painted eggs called pysanky are made by drawing lines in melted wax, dipping the egg in dye, and repeating with darker colors; the wax keeps each color where it was drawn.\n\nTap it to spin it. Pick a folk, striped, dotted, zigzag, flower or star pattern and its two colors in the Toy tab. Try spinning a real hard-boiled egg: it spins smoothly, while a raw one wobbles and stops, because the runny inside sloshes.",
  },
  "paper-lantern": {
    howTo: "Tap it to set it swinging on its string; tap again for another push.",
    about:
      "A paper lantern is a light made of thin paper stretched over a frame of ribs, glowing from a light inside. In China and many other places, red lanterns stand for luck and happiness, and thousands are hung up for the Lantern Festival, which ends the Lunar New Year celebrations on the first full moon of the year.\n\nTap it and it swings on its string like a pendulum, back and forth, slowing a little on each swing until it hangs still again. Tap while it swings to give it another push. Pick a red, gold, teal or purple lantern in the Toy tab.",
  },
  diya: {
    howTo: "Tap to light the ring of diyas; tap again to put them out.",
    about:
      "A diya is a small clay lamp that holds oil or butter and a cotton wick. Rows of diyas are lit for Diwali, the festival of lights celebrated by Hindus, Sikhs and Jains, to welcome light and good fortune. Homes are also decorated with rangoli, bright patterns of colored powder or flowers on the floor.\n\nThis diya sits on a rangoli. Tap it and its flame flares and grows, and eight small diyas around the pattern light one after another and stay lit. Tap again to put them out. In the Toy tab, set the size of the flame, or blow on it.",
  },
  menorah: {
    howTo: "Tap to put out the candles; tap again to light them one by one.",
    about:
      "A Hanukkah menorah is a candle holder with nine branches, lit during Hanukkah, the Jewish festival of lights. Hanukkah lasts eight nights, and one more candle is lit each night. The ninth candle, the helper called the shamash, stands apart and is used to light the others. The festival remembers the rededication of the Temple in Jerusalem, when, the story says, one day's oil burned for eight days.\n\nThe menorah starts with every candle lit. Tap to put them out, and tap again to light them: the helper candle first, then the others one by one.",
  },

  // ---- Music ----------------------------------------------------------------------------
  guitar: {
    howTo: "Tap it to strum a few chords.",
    about:
      "An acoustic guitar has six strings stretched over a hollow wooden body. Plucking a string makes it vibrate, and the body and the round soundhole make the sound bigger and warmer. Pressing a string down against the metal frets on the neck makes it shorter, and a shorter string plays a higher note.\n\nTap it to strum: the guitar rocks with the stroke, the strings bend and shake one after another, and rings of light pulse out of the soundhole as it plays four chords. Pick a sunburst, natural or cherry finish in the Toy tab. The six strings are usually tuned, from lowest to highest, to E, A, D, G, B and E.",
  },
  drum: {
    howTo: "Tap it for a drum roll; tap again quickly for a faster, longer roll.",
    about:
      "A snare drum is a shallow drum with a skin, called a head, stretched across each side. Under the bottom head runs a set of thin metal wires, the snares, which rattle against it every time the top is hit, giving the drum its crisp, buzzing crack. A drum roll is many fast strokes, played one stick after the other so quickly that they blur into one sound.\n\nTap it and the sticks play a roll. Tap again quickly, and each tap steps the roll up to a faster speed and makes it last longer, through four speeds in all. Pick the color of the shell in the Toy tab.",
  },
  xylophone: {
    howTo:
      "Tap a bar, or drag across the bars for a glissando. Tap the mallet or frame to play a scale.",
    about:
      "A xylophone is a row of tuned wooden bars that you strike with a mallet. Each bar's length sets its note: the shorter the bar, the higher it sounds. The name comes from the Greek for “wood” and “sound”.\n\nThis toy one has eight colored bars, a scale from C up to the next C. Tap a bar and the mallet swings over and strikes it, and the bar jumps and plays its note, so you can play a tune. Tap the mallet, a wheel or the ends of the frame instead, and it plays the whole scale.",
  },
  "grand-piano": {
    howTo:
      "Tap or drag along the keys to play them. Tap elsewhere for a song; the song bar plays it all.",
    about:
      "A grand piano is a keyboard instrument whose strings lie flat under a lid shaped like a wing. Each of its 88 keys throws a felt hammer up against its strings, and a damper lifts off them so the note rings until the key comes up. The right pedal lifts every damper at once. Bartolomeo Cristofori built the first pianos in Italy around 1700.\n\nTap a key and it dips, its hammer strikes and its damper lifts. Tap anywhere else for the opening of Für Elise, or pick Clair de lune, Gymnopédie No. 1 or Ode to Joy in the Toy tab. The song bar plays, pauses, loops and slows a song, and you can open a MIDI file of your own or paste a tune in ABC notation.",
  },
  "upright-piano": {
    howTo:
      "Tap or drag along the keys to play them. Tap elsewhere for a ragtime; the song bar plays it all.",
    about:
      "An upright piano stands its strings on end, so a full piano fits against a wall. Its hammers swing forward onto the strings instead of flying up, and a spring brings them back. Uprights filled homes, schools and dance halls, and a slightly out-of-tune one gives the bright, jangly honky-tonk sound of ragtime.\n\nThis one has its upper front panel off, so you see the row of hammers, the dampers above them and the strings behind. Tap a key and its hammer strikes. Tap anywhere else for the opening of The Entertainer, a rag Scott Joplin published in 1902. Open a MIDI file of your own, or paste a tune in ABC notation, in the Toy tab.",
  },
  harpsichord: {
    howTo: "Tap a key to pluck its string, or drag along the keys. Tap anywhere else for a minuet.",
    about:
      "A harpsichord plucks its strings instead of striking them. Each key lifts a thin wooden jack, and a small quill on the jack catches the string on the way up. Because a pluck sounds the same however hard you press, players shape their music by timing. Harpsichords were the main keyboard of the 1600s and 1700s.\n\nThis one is painted in the French style, with black naturals and pale sharps. Tap a key and its jack rises, plucks, and the string quivers until the jack's felt stops it. Tap anywhere else for the Minuet in G from the notebook Bach kept for his wife, Anna Magdalena. Open a MIDI file of your own in the Toy tab.",
  },
  "electronic-keyboard": {
    howTo:
      "Tap or drag along the keys; a colored button changes the voice. Tap elsewhere for a song.",
    about:
      "An electronic keyboard makes its sounds with circuits instead of strings. It can sound like a piano, an organ, a synthesizer or vibes, and many can play a drum beat along with you. Learning keyboards light up the key to play next.\n\nThis one has 61 keys. The four colored buttons pick its voice: piano, organ, synth and vibes. Tap anywhere else and a song starts: each key lights up just before its note, the little screen scrolls the title and the drum pads flash with the beat. Pick Ode to Joy, Twinkle, Twinkle, Little Star or Frère Jacques in the Toy tab, or open a MIDI file of your own.",
  },
  "toy-piano": {
    howTo: "Tap or drag along the keys to play them, or tap the case to play Twinkle, Twinkle.",
    about:
      "A toy piano is a small piano with no strings. Each key works a tiny hammer, and the hammer strikes a metal rod held at one end, which rings like a little bell. Shorter rods sound higher, so the rods get shorter from left to right. Toy pianos were first made in the 1800s, and the composer John Cage wrote a whole suite for one in 1948.\n\nThis one has 18 keys, from C up to the F an octave and a half higher, and its back and lid are open so you can see inside. Tap a key and its hammer swings up and strikes its rod, which shivers as the note rings. Tap anywhere else to hear “Twinkle, Twinkle, Little Star.” Pick its color in the Toy tab.",
  },
  // ---- Vehicles -------------------------------------------------------------------------
  rocket: {
    howTo: "Tap it to launch the rocket.",
    about:
      "A rocket flies by pushing hot gas out of its engine very fast. As the gas rushes down, it pushes the rocket up, just as a balloon zooms off when you let its air out. A rocket carries its own oxygen to burn its fuel, so unlike a plane it can fly where there is no air at all, out in space.\n\nTap it to launch: the arm of the tower swings away, the engine lights, clouds of smoke billow across the pad, and the rocket shakes, lifts off and climbs faster and faster until it is gone. Then a new one stands ready on the pad. Pick its color in the Toy tab.",
  },
  helicopter: {
    howTo: "Tap to take off; tap again to land.",
    about:
      "A helicopter lifts itself with a big rotor on top: its long blades are thin, spinning wings. By tilting the blades, the pilot can fly up, down, forward, backward or sideways, or hover in one place. The small rotor on the tail stops the body from spinning around the other way.\n\nIts rotors are always turning. Tap to take off: it lifts into the air, tips its nose down a little and hovers, bobbing gently. Tap again to land. Pick its color in the Toy tab. Helicopters can land in places planes cannot, so they are used for rescues at sea and in the mountains.",
  },
  "hot-air-balloon": {
    howTo: "Tap it to fire the burner: the balloon swells and climbs.",
    about:
      "A hot-air balloon flies because hot air is lighter than the cool air around it. A burner under the big fabric envelope heats the air inside, and the balloon floats up; as the air cools, it sinks again. Pilots can only go up and down, so they steer by finding winds at different heights that blow the way they want to go. The first people to fly in a hot-air balloon took off in Paris in 1783.\n\nTap it to fire the burner: a big flame roars, the envelope swells and glows warm, and the balloon climbs well up, then drifts back down. Pick stripes or a rainbow, and two colors, in the Toy tab.",
  },
  "steam-train": {
    howTo: "Tap it to blow the whistle.",
    about:
      "A steam locomotive burns coal or wood to boil water in a long boiler. The steam pushes pistons back and forth, and rods turn that push into the turning of the big driving wheels. The first steam locomotive to pull a train on rails ran in Wales in 1804, and for more than a hundred years steam trains carried people and goods around the world.\n\nThe engine puffs smoke from its chimney. Tap it to blow the whistle: a jet of white steam shoots up from the whistle and a big cloud billows from the chimney. Pick the color of the engine in the Toy tab.",
  },
  "ocean-liner": {
    howTo: "Tap it to sound the horn.",
    about:
      "An ocean liner is a big passenger ship that sailed on a regular route, or line, across an ocean. Before airliners, liners were the way to cross the Atlantic, and the fastest took about five days. The largest carried thousands of people, with dining rooms, lounges and decks for walking.\n\nThe liner rocks gently on the waves, smoke drifting from its funnels. Tap it to sound the horn: steam blasts from the horn and the funnels smoke harder. Pick the color of the funnels in the Toy tab. A ship's horn is deep and loud so that other ships can hear it from miles away, even in fog.",
  },
  "sports-car": {
    howTo: "Tap it to rev the engine.",
    about:
      "A sports car is a small, light car with a powerful engine, built for speed and for taking corners well. It sits low to the ground, which helps it stay steady, and the wing on its back works like an upside-down airplane wing: at speed, the air pushes the car down onto the road, so its tires grip better.\n\nTap it to rev the engine: the car rocks on its springs, the wheels spin and a puff of exhaust shoots out of the back. In the Toy tab, pick its color and turn its racing stripes on or off.",
  },
  bus: {
    howTo: "Tap it to stop for passengers: the lights flash and the doors open.",
    about:
      "A bus carries many people along a set route, stopping to let them on and off. In the United States and Canada, school buses are painted a bright yellow that is easy to see, and when they stop, red lights flash and a stop sign swings out so that traffic waits while children cross. Double-decker buses have two floors, and they are a famous sight in London.\n\nTap it: the school bus stops, its warning lights flash, the stop sign swings out and the doors open onto the lit doorway, then everything folds away again. Pick the school bus or a double-decker, which flashes its lights and opens its middle door, in the Toy tab.",
  },
  "propeller-plane": {
    howTo: "Tap it to loop the loop.",
    about:
      "This propeller plane is a biplane: it has two sets of wings, one above the other, held together by struts and wires. Two wings give a lot of lift for a light, slow plane. The spinning propeller at the front pulls it through the air. The first airplane to fly with a pilot, the Wright brothers' Flyer of 1903, was a biplane too.\n\nTap it to loop the loop: it climbs, flies up and over on its back in a big circle, and comes out level again. Pick the colors of the body and the wings in the Toy tab.",
  },
  jet: {
    howTo: "Tap it to climb and bank left, then right.",
    about:
      "A jet airliner is a big passenger plane driven by jet engines. Each engine sucks in air, squeezes it, burns fuel in it and blasts it out of the back, pushing the plane forward. Airliners cruise about 10 to 12 kilometers (6 to 7 miles) high, where the thin air lets them fly fast while burning less fuel.\n\nTap it and it climbs nose up while banking hard to the left, then hard to the right. Banking means tilting the wings: a plane turns by leaning into the turn, just as a bicycle does. Pick the color of the tail in the Toy tab.",
  },
  sailboat: {
    howTo: "Tap it for a gust of wind: it heels over, then rocks back upright.",
    about:
      "A sailboat is pushed along by the wind in its sails. A sail works like a wing, so a sailboat can even sail at an angle toward the wind. Under the water, a heavy fin called a keel stops the boat from sliding sideways and keeps it from tipping over.\n\nTap it for a big gust: the boat heels over, leaning far to one side, with spray flying at the bow and the stern, then it rocks back upright. Sailors lean out over the high side to help hold the boat up. Pick the colors of the sails and the stripe in the Toy tab.",
  },
  submarine: {
    howTo: "Tap it to dive; then it surfaces and raises its periscope.",
    about:
      "A submarine is a ship that can travel underwater. To dive, it lets seawater into big tanks, making it heavy enough to sink; to come back up, it blows the water out with compressed air. A periscope, a long tube with mirrors inside, lets the crew see above the surface while the submarine stays hidden below.\n\nTap it to dive: the periscope drops, bubbles rush from the hull and it sinks under the water. Then it rises back to the surface and raises its periscope again. Pick its color in the Toy tab.",
  },
  bicycle: {
    howTo: "Tap it to ring the bell and spin the wheels.",
    about:
      "A bicycle has two wheels, one behind the other, and pedals that turn a chain, which turns the back wheel. It stays up while it moves, because the rider keeps steering the front wheel a little under the bike, balancing it without thinking. The first bicycles with pedals were built in France in the 1860s.\n\nTap it: the bell shakes and rings, the wheels spin through five fast turns, and the pedals go around twice. Bicycles are among the most efficient ways to travel ever invented: a rider uses less energy to go a mile than a walker does. Pick the color of the frame in the Toy tab.",
  },
  tractor: {
    howTo: "Tap it to make it chug: it shakes and puffs smoke.",
    about:
      "A tractor is a strong farm machine for pulling heavy things: plows, trailers and all kinds of tools. Its big back wheels have deep treads to grip soft, muddy ground, and its small front wheels steer. Tractors are built for pulling power, not speed.\n\nIts wheels turn slowly and smoke rises from its exhaust pipe. Tap it to make it chug: the engine shakes the tractor, the wheels turn faster and thick puffs of smoke rise from the pipe. Pick its color in the Toy tab. Before tractors, farmers used horses and oxen to pull their plows.",
  },
  ufo: {
    howTo: "Tap to switch the beam off or on.",
    about:
      "A flying saucer is an imaginary spaceship from science fiction, shaped like a round, flat saucer. The name was first used in 1947, after a pilot said he had seen shiny objects skimming across the sky. Anything seen in the sky that no one can identify is called a UFO, an unidentified flying object; most turn out to be planes, balloons, birds or bright planets.\n\nThis saucer hovers over a field with its rim lights turning, and its glowing beam lifts a cow into the air. Tap to switch the beam off, and the cow settles back on the grass; tap again to switch it on.",
  },

  // ---- Landmarks ------------------------------------------------------------------------
  "eiffel-tower": {
    howTo: "Tap it for its night show of lights and fireworks.",
    about:
      "The Eiffel Tower is an iron lattice tower in Paris, built by the engineer Gustave Eiffel's company for the World's Fair of 1889. It is about 330 meters (1,083 feet) tall, and it was the tallest structure in the world until 1930.\n\nTap it for a night show: the ironwork lights up gold, sparkling white lights climb the tower, and four fireworks burst around it. The real tower sparkles like this for five minutes every hour after dark.",
  },
  "washington-monument": {
    howTo: "Tap it for a day in a few seconds: the sun crosses and the shadow swings around.",
    about:
      "The Washington Monument is a tall stone obelisk in Washington, D.C., built to honor George Washington, the first president of the United States. It is about 169 meters (555 feet) tall. Building began in 1848, stopped for more than 20 years, and was finished in 1884; the stone above the point where work paused is a slightly different color.\n\nTap it for a whole day in a few seconds, like a giant sundial: the sun rises behind the monument, arcs over and sets, the obelisk's shadow swings around the lawn in front, and the flags ripple in the breeze.",
  },
  pyramids: {
    howTo: "Tap it: a tiny flying saucer beams up a camel made of sand.",
    about:
      "The Pyramids of Giza stand at the edge of the desert near Cairo, in Egypt. They were built about 4,500 years ago as tombs for three kings, or pharaohs: Khufu, Khafre and Menkaure. The Great Pyramid of Khufu was first about 146 meters (481 feet) tall, and for almost 4,000 years it was the tallest building in the world. It is the only one of the Seven Wonders of the Ancient World still standing.\n\nTap it for a playful visitor: a tiny flying saucer glides in and switches on its beam, sand streams up into the shape of a camel, which floats up into the saucer, and the saucer wobbles happily and zips away.",
  },
  supertall: {
    howTo: "Tap it to twist the tower further and send light up its glass.",
    about:
      "A supertall is a skyscraper more than 300 meters (about 1,000 feet) tall. Some are built to twist as they rise: each floor sits turned a little from the one below. The twist is not just for looks: wind flowing past a tall building makes it sway, and a twisted shape breaks the wind up, so the tower sways less.\n\nTap it and the floors wring around further, in twelve solid bands with the top turning most, while a ring of light runs up the glass; then they unwind with a little sway as a second ring runs up. Pick the color of the glass in the Toy tab.",
  },
  lighthouse: {
    howTo: "Tap to switch the light off or on.",
    about:
      "A lighthouse is a tower with a bright light at the top that guides ships at night and warns them away from rocks and dangerous coasts. Each lighthouse flashes in its own pattern and is painted in its own stripes or colors, so sailors can tell which one they are looking at, by night or by day. Many use a special lens, invented by Augustin Fresnel in the 1820s, that gathers the light into a strong beam.\n\nThis lighthouse starts with its beam sweeping around. Tap to switch the light off, and tap again to switch it on. Pick the color of its stripes in the Toy tab.",
  },
  "statue-of-liberty": {
    howTo: "Tap it to make the torch flare and send up golden sparks.",
    about:
      "The Statue of Liberty stands on Liberty Island in New York Harbor. It was a gift from the people of France to the United States and was dedicated in 1886. The sculptor Frédéric Auguste Bartholdi designed it, and Gustave Eiffel, the engineer of the Eiffel Tower, designed its iron frame. Its skin is thin copper, which slowly turned green in the weather.\n\nTap it and the torch flares: the flame leaps to twice its size in a halo of light, a warm glow spreads down the statue, and golden sparks drift up and away on the breeze and burn out.",
  },
  "white-house": {
    howTo: "Tap it: the fountain shoots up and the windows light up one by one.",
    about:
      "The White House, in Washington, D.C., is the home and office of the president of the United States. It was designed by the architect James Hoban and built from 1792 to 1800, and John Adams was the first president to live there. It has 132 rooms, and its walls are painted white.\n\nTap it for an evening scene: the fountain on the south lawn shoots up a tall jet that falls back as spray, the lights come on in the windows one by one and the flag ripples at the top of its pole; then the jet sinks and the lights go out again.",
  },
  "leaning-tower": {
    howTo: "Tap to drop two balls from the top. Set the lean in the Toy tab.",
    about:
      "The Leaning Tower of Pisa, in Italy, is the bell tower of the city's cathedral. Building began in 1173, and the tower started to lean while it was still being built, because the ground under it is soft; it took about 200 years to finish. Engineers straightened it a little from 1990 to 2001, and it now leans about 4 degrees.\n\nThe story goes that Galileo dropped two balls of different weights from the top to show that they fall together. Tap it and try it: a big iron ball and a small bronze one roll off the top and land at the same moment. Set the lean with the Lean slider in the Toy tab.",
  },
  colosseum: {
    howTo: "Tap it for a chariot race around the arena.",
    about:
      "The Colosseum is a huge oval arena in Rome, Italy, built of stone and concrete about 2,000 years ago, and finished in the year 80. It could seat about 50,000 people, who came to watch shows and games. Much of it still stands, and it is one of the most visited places in the world.\n\nTap it for a chariot race: a crowd fills the seats, and four chariots in the old racing teams' colors, red, white, blue and green, race around the arena, swapping the lead, while the crowd jumps and cheers. In ancient Rome, the big chariot races were really held at the Circus Maximus, a long racetrack nearby.",
  },
  parthenon: {
    howTo: "Tap it for a procession. Pick the temple today or as it was in the Toy tab.",
    about:
      "The Parthenon is a marble temple on the Acropolis, the rocky hill above Athens, in Greece. It was built from 447 to 432 BC for the goddess Athena, the city's protector. Its rows of columns look perfectly straight, but they bulge and lean very slightly, so that from a distance they look straighter.\n\nTap it for a procession like the great festival the people of Athens held for Athena: eight robed figures, some carrying baskets and jars on their heads, walk in single file along the temple and across its steps. In the Toy tab, see the temple as it stands today or as it looked when it was new.",
  },
  stonehenge: {
    howTo: "Tap it for the midsummer sunrise shining through the stones.",
    about:
      "Stonehenge is a ring of great standing stones on Salisbury Plain, in England. It was built in stages from about 5,000 years ago; some of its smaller stones, the bluestones, were brought from Wales, more than 200 kilometers (140 miles) away. Its biggest stones stand in pairs with a stone laid across the top, called trilithons.\n\nStonehenge is lined up with the sun: on the summer solstice, the longest day of the year, the sun rises in line with its entrance. Tap it: the sun comes up over the far bank, framed by the great trilithon, a golden beam shines through the stones, and they glow gold.",
  },
  "big-ben": {
    howTo: "Tap it: the hands spin around, the dials glow and the bell swings.",
    about:
      "Big Ben is the nickname of the great bell in the clock tower of the Houses of Parliament in London, England, and people often use it for the whole tower. The tower was finished in 1859 and, since 2012, has been called the Elizabeth Tower. The bell weighs about 13.7 tonnes, and the clock has four huge dials, one on each side.\n\nThe hands show the real time where you are. Tap it: the hands spin all the way around and land back on the right time, all four dials glow, and the bell swings in the open belfry.",
  },
  "taj-mahal": {
    howTo: "Tap it for moonlight: night falls and the white dome glows.",
    about:
      "The Taj Mahal is a white marble tomb in Agra, in India. The emperor Shah Jahan had it built in memory of his wife, Mumtaz Mahal; the work took from about 1632 to 1653, and about 20,000 workers built it. Its white marble is inlaid with patterns of colored stone, and it stands in a garden with a long reflecting pool.\n\nTap it for moonlight: night falls over the garden and the buildings, the moon rises behind the Taj, the great dome glows white against the night sky, and moonlight shimmers on the rippling pool; then the day comes back.",
  },
  castle: {
    howTo: "Tap to lower the drawbridge; tap again to raise it.",
    about:
      "A castle is a strong stone home for a lord or a king, built in the Middle Ages with thick walls, tall towers and a moat. The drawbridge across the moat could be pulled up on chains, so the gate was closed off. Castles were small towns inside: kitchens, stables, a hall for feasts and a well for water.\n\nThe drawbridge starts up. Tap to lower it, and five small knights march out, the leader carrying a banner; tap again and they march back in and the drawbridge rises. Pick the color of the roofs in the Toy tab.",
  },
  pagoda: {
    howTo: "Tap it to ring the wind chimes; lanterns and doors light up.",
    about:
      "A pagoda is a tower of many roofs, one above the other, built at Buddhist temples across China, Korea, Japan and much of Asia. The idea came from the stupa, a mound that held holy relics in ancient India. Tall wooden pagodas in Japan have stood through many earthquakes for centuries, partly thanks to a great central pillar that helps them sway without falling.\n\nTap it: wind chimes at the corners of every roof swing, one tier after another, and two stone lanterns by the path light up while the doors glow. Pick the color of the timber in the Toy tab.",
  },
  windmill: {
    howTo: "Tap it for a gust of wind that spins the sails hard.",
    about:
      "A windmill uses the wind to do work. The wind turns its big sails, and gears inside turn that into the turning of heavy millstones, which grind grain into flour; some windmills pump water instead. In the Netherlands, windmills pumped water out of low land for hundreds of years, so that people could live and farm there.\n\nIts sails always turn in the breeze. Tap it for a gust of wind that spins the sails up hard for three extra turns, then they slow back to their steady pace.",
  },
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
