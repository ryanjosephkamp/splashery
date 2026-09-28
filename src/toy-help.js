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

  // ---- Balls --------------------------------------------------------------------------
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
