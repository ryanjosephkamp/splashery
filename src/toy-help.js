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
      "A marble is a small, hard ball, usually of glass, with twists of color inside. Children have played games with little balls of clay and stone for thousands of years; glass marbles became common in the 1800s. A twist of colored glass is set in the middle of the ball while the glass is hot and soft.\n\nTap it and it rolls around a little circle, turning the way it rolls, so the swirl inside turns too. After one lap it is back exactly as it was. Pick the color of the swirl in the Toy tab.",
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
      "Pancakes are flat, round cakes made from a runny batter of flour, eggs and milk, cooked on a hot pan. Baking powder in the batter makes bubbles of gas, so they puff up soft and fluffy. When bubbles pop on the top, it is time to flip.\n\nTap it to flip the top pancake: it hops up, turns a full somersault in the air and lands back on the stack. In the Toy tab, set how many pancakes are in the stack, from two to seven, and try the Syrup slider.",
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
      "A burger is a round patty of ground meat, or of vegetables, cooked and served in a sliced bun with toppings. The name comes from the city of Hamburg, in Germany. This one has a sesame bun, a patty, a slice of cheese, lettuce and tomato.\n\nTap it to spread out the layers in the air, one above the other, so every part shows, and tap again to stack them back up. Engineers call a picture like this an exploded view: it shows how the parts of a machine fit together without taking the real thing apart.",
  },
  sushi: {
    howTo: "Tap it: the chopsticks pick up a piece and dip it in soy sauce.",
    about:
      "Sushi is a Japanese dish of rice mixed with a little vinegar and sugar, served with fish, vegetables or egg. This board has nigiri, a pillow of rice with a slice of fish draped on top, and maki, rice and a filling rolled up in a sheet of dried seaweed called nori and cut into rounds.\n\nTap it and the chopsticks lift off the board as if held by an invisible hand, pinch a piece with a click, carry it to a little dish of soy sauce and dip it twice, then set it back and lie down again.",
  },
  taco: {
    howTo: "Tap it to break the shell in half; then it closes up again.",
    about:
      "A taco is a Mexican dish: a tortilla, a thin, round flatbread of corn or wheat, folded around a filling such as meat, beans, cheese, lettuce and salsa. People in Mexico have made corn tortillas for thousands of years. This one has a crunchy, fried corn shell.\n\nTap it and the shell snaps across the middle with a crunch. The halves pull apart and swing open like a book, showing the filling in each break, and bits spill onto the plate and bounce. Then they hop back in and the halves close.",
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
    howTo: "Drag across a face to turn a row or column. Tap to scramble or solve it.",
    about:
      "A twisting puzzle cube: 26 small cubes around a hidden core, with one color on each of its six faces. Each turn moves a whole row or column of nine cubes, and the puzzle is to bring every face back to one color.\n\nHere every little cube is its own piece, and the cube keeps track of each turn, so you can really solve it: drag across a face to turn that row or column. A tap scrambles a solved cube, or turns a scrambled one back to solved, one layer at a time, and solving it by hand earns a hop and a chime. The cube has about 43 quintillion arrangements, yet any of them can be solved in 20 moves or fewer.",
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
      "A wind-up alarm clock has two metal bells on top and a little hammer between them. At the set time a spring inside lets the hammer go, and it strikes the two bells back and forth very fast, loud enough to wake a sleeper. Before alarm clocks were common, some people were paid to go around town tapping on windows to wake others up.\n\nThe hands on this clock show the real time where you are. Tap it to ring the alarm: the hammer rattles between the bells and the whole clock shakes and hops. Pick its color in the Toy tab.",
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

  // ---- Medieval -------------------------------------------------------------------------
  "sword-in-stone": {
    howTo: "Tap to pull the sword from the stone; tap again to go back.",
    about:
      "The sword in the stone comes from the old legends of King Arthur of Britain. A sword was stuck fast in a great stone, and only the true king could pull it out. Many strong knights tried and failed, until the young Arthur drew it out easily and was made king.\n\nTap it to try: the sword sticks at first and wiggles, then slides free and rises in a shower of golden sparkles. Tap again to put it back in the stone. The Arthur stories have been told and retold for more than 800 years.",
  },
  shield: {
    howTo: "Tap it and it blocks a blow: sparks fly and the emblem gleams.",
    about:
      "A heraldic shield carries a coat of arms, a painted design that showed who a knight was, even when a helmet hid the face. Heraldry has its own words: the background is the field, and a shape on it is a charge. A chevron is an upside-down V, a bend is a stripe from corner to corner, a saltire is an X-shaped cross, and per pale means split down the middle.\n\nTap it and it takes an unseen knock: it jolts and rocks, sparks spray off its iron rim, and a gleam sweeps across the emblem. Pick one of seven designs and the colors of the field and the charge in the Toy tab.",
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
