# Splashery Review 2026-09-25 (after Phase E2)

The owner's review of Phase E2 (PR #29) and of the E1c clips, word for word. It came in two parts:
marks and notes on the private Effect review page (its `verdicts` database), and a chat message. The
chat message had three screenshots (the sapphire's star, twice, and the solar system's planets
overlapping); they did not reach the session as files, so they are not saved here.

The fixes for the E2 toys are in PR #29. The other requests are in the stacked PRs
`claude/quirky-pasteur-modo55-2` (settings panel, reset, laptop keys, chess) and `-3` (molecules
from formulas and files, the protein toy).

## Marks on the Effect review page

"Looks right" (33): the Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, the
aurora world, the asteroid, the comet, the meteor, the star, the pulsar, the black hole, the star
cluster, the ring nebula, the nebula, the spiral galaxy, the diamond, the ruby, the emerald and the
opal (E2); the phone panel, the chess panel, the elephant, the horse, the cat, the hockey puck,
Newton's cradle, the xylophone and the tomatoes (E1c).

"Needs work" (9), with the notes as written:

- **Moon (e2-moon):** Please come up with a different effect (e.g., rocket landing on moon,
  astronauts planting a flag – perhaps a chosen country flag, etc.).
- **Solar system (e2-solar-system):** Looks almost perfect, but the planets need to be spaced out
  more. I've attached a screenshot. The planets overlap unnaturally right now. We should space them
  out more by default (not only during effect).
- **Sapphire (e2-sapphire):** The star looks unnatural... see the attached screenshots.
- **Quartz cluster (e2-quartz-cluster):** The stars almost look like crosses; can you change their
  rotation/orientation to be at different angles or something?
- **Electron orbital (e2-orbital):** This looks fantastic. I don't think that I want to change this
  specific electron orbital toy per se, but it would be nice if we could (at some point, not
  necessarily now) expand the chemistry "set" (so to speak) to include more atoms?
- **Atom (e2-atom):** This looks fantastic. I don't think that I want to change this specific atom
  toy per se, but it would be nice if we could (at some point, not necessarily now) expand the
  chemistry "set" (so to speak) to include more atoms, and have the protons, neutrons, and electrons
  (with orbits, etc.) be realistic? It would be super cool if someone could pick an element from the
  periodic table here.
- **Molecule (e2-molecule):** This looks fantastic. I don't think that I want to change this
  specific molecule toy per se, but it would be nice if we could (at some point, not necessarily
  now) expand the chemistry "set" (so to speak) to include more molecules?
- **Crystal lattice (e2-crystal-lattice):** This looks fantastic. I don't think that I want to
  change this specific crystal lattice toy per se, but it would be nice if we could (at some point,
  not necessarily now) expand the chemistry "set" (so to speak) to include more lattices?
- **Chess from a PGN file (e1c-chess):**

  > This seems nearly perfect. Great work! There are only two real requests that I have regarding
  > the PGN uploads:
  >
  > 1. Currently, if I upload a PGN game, the title and game metadata info appears under the board
  >    but then disappears; I'd like to have it stay on the screen and not disappear like that. It
  >    would also be nice if the user could edit the name and metadata, if applicable.
  > 2. I hope this doesn't complicate things too much, but it would be great if there were buttons
  >    (either by the board or in the settings panel) for the user to pause, play, rewind by one
  >    move, rewind to the beginning, advance by one move, and advance to the end of the game. Maybe
  >    we can make this work such that clicking/tapping the board is equivalent to the pause/play
  >    button, and if the game is over and the user clicks on the board, the game resets and begins
  >    again?
  >
  > Oh, one more thing... Can we make the flag color theme for the chess board also apply to the
  > pieces and checkered board squares?

## Chat message

> Thank you for your help. I've completed my manual review. Please see the artifact:
> https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi
>
> I'm also thinking about making some small changes to the settings UI area, especially for desktop
> view. It would be nice if the user could expand the settings / thumbnail gallery bar to make it
> bigger on the screen. Additionally, I appreciate the purpose of the Play/Make/Look/Share/About
> tabs of the settings, but I'd like you to think about a better UI/UX approach that looks and feels
> less cramped and cluttered (but without removing any features or functionalities). We could have a
> main tab or something with all of the essential toggles and settings for the toy; alongside other
> appropriate settings, I definitely want the "Detail" buttons and "Slow turntable when idle" toggle
> to be on the main tab, and I'd prefer that we rename/change the "Slow turntable when idle"
> checkbox to a toggle (ON/OFF). Can we also add a full settings reset button or something like
> that, so that if I want to remove the country flag colors or erase all paint or clay or anything
> else, I can do that? Some other things...
>
> - Can we make the laptop keys have better resolution? They look a bit blurry.
> - For the molecules, if it isn't too ridiculously complicated, could we allow users to upload or
>   paste some kind of chemical formula?
> - Can we add a protein structure toy and allow users to upload a PDB file?
>
> Thanks again for all of your help. This is looking awesome so far!
