# The Playground on a phone: an audit and proposals (lane UX1, October 2026)

Lane UX1 (Opus 5.5), report only. Main at `c36c4dcd`, October 17, 2026. Mockups of the top five:
[`tools/pages/ux1/index.html`](../../tools/pages/ux1/index.html) (open it from the static server on
4173).

## Summary

On a phone the Playground has every feature the desktop has, but they fight over one bottom sheet.
When the settings are open, the shelf and the tool row stay on top of them, so the settings get a
window of **215 pixels at 390 × 844** and **101 pixels at 360 × 740**, while the Toy tab alone is
834 pixels tall. The eight top buttons are unlabeled icons (desktop explains them with hover titles,
which phones never show), wrap into two rows at 360 pixels, and disappear while the sheet is open. A
tool's options (Paint's colors, Clay's Add and Erase) are four taps and a scroll from the tool. Full
screen hides everything but the toy, so you can't change tool, play a song, or record there. A phone
on its side gets the desktop layout, with a settings strip about 120 pixels tall.

The top five proposals, by value to a phone user against effort:

1. **The settings get the sheet**: the shelf folds into a chip with the toy's name while the
   settings are open (small; the rule already exists for short screens).
2. **Four buttons on top, the rest in a labeled menu**: Toys, Sound, Full screen, Help, and More;
   they stay in view when the sheet is open (small).
3. **A tool's options sit on the tool**: a slim tray above the tool row when Paint, Clay, Magnet, or
   Poke is picked (medium).
4. **Full screen keeps a small control bar**: the tool row and REC1's stage row on a see-through bar
   that fades (small, after REC1).
5. **A phone on its side gets a phone layout**: a full-height side sheet, the top buttons in a
   column (medium).

Nothing is removed in any proposal: each control keeps its id and stays reachable. Ten more
proposals follow, smaller or later.

## How the audit was done

- Headless Chromium with touch and a phone user agent (`isMobile`, `hasTouch`), at 390 × 844, 360 ×
  740, and 844 × 390, with labs off and on, plus 1440 × 900 for the desktop comparison. The sizes
  below were measured on the page (`getBoundingClientRect`).
- Flows: the shelf (search, Featured, categories, Surprise me, the grid), the tool row, More and
  each tab (Toy, Share, Tools, Look, Make, About), Fill the screen, full screen, the top bar (flag,
  help, hands-on), the Grand piano's song bar, the Chess set's game bar, and Photo to 3D (labs) with
  its depth slider.
- Not done: a real phone. Safari's toolbars, the iPhone's home bar, and real thumbs change reach a
  little; Codex task 112 (a real-browser playtest) should check the proposals that land.

## What is hard now, and why

Sizes at 390 × 844 unless a size is named.

### The sheet

- **The settings get a quarter of the screen.** With the sheet closed, the stage is 448 pixels tall
  and the sheet's peek 260. With More, the sheet grows to 523 pixels, but the shelf's chips (44),
  the toy strip (117), the tool row (52), and the tabs (49) stay on top, leaving the settings 215
  pixels. At 360 × 740 that is 101 pixels, under two rows of controls. The Toy tab is 834 pixels, so
  each tab is four to eight screens of scrolling in a small window.
- **The shelf is in the way of the settings and the settings are in the way of the toy.** Changing a
  setting and seeing it on the toy means the toy sits in the top 38% of the screen, under the
  sheet's shadow.
- **"Fill the screen" exists but is hidden.** The small square button beside Done fills the screen
  with the settings and does hide the shelf, but it is an unlabeled icon, and it then covers almost
  all of the toy.
- **Done wraps** to its own line at 360 pixels, pushing the tabs down another 52 pixels.
- **A short screen already gets the fix.** `styles.css` (the
  `max-width: 760px and max-height: 650px` block) hides the shelf while the settings are open on
  short phones. Taller phones keep the shelf.

### The top bar

- **Eight unlabeled icons**: toys (grid), flag, full screen, reset view, tilt lock, turntable, help,
  sound; Pop out joins them on picture toys (labs). On desktop their names show on hover; phones
  have no hover, so the turntable's ring, the lock, and the reset arrow are guesses.
- **Two rows at 360 pixels.** The bar wraps into two rows of four, right-aligned, and pushes the
  credit line down to 160 pixels.
- **Hidden while the sheet is open.** Sound, full screen, and help can't be reached from the
  settings; you close the sheet first.
- **The credit line takes two lines** under the bar ("Cactus · 120k splats · by … (CC0 1.0)"), above
  the toy, at every size.

### The stage

- **Zoom buttons** (+ and −) sit at the bottom left, 44 pixels each, on a touch screen where pinch
  already zooms. They help people who can't pinch, so they should stay possible, not on by default.
- **The hands bar** (Play, the hand, Reset) is a column at the bottom right. REC1 is reworking it.
- **The depth slider** (Photo to 3D, Splat mirror, One splat) is a tall card over the stage's right
  edge, over the photo itself, and duplicates the Depth slider in the Toy tab.
- **The song bar covers the toy's base.** On the Grand piano the song bar is 170 pixels over the
  bottom of the stage, so the piano's keys and the bar overlap, and there are two Play buttons (the
  stage's and the song's). REC1 is adding a close button and Play switching to Pause.
- **The tool stays picked across toys.** Paint picked on the Grand piano is still on when you open
  Photo to 3D, and the first drag paints instead of turning the view. Only the tool row shows it.

### The shelf

- **Twenty-six category chips** in one row that scrolls sideways; at 390 pixels you see three.
  "Featured" is the second chip, so it is easy to find; Studio (labs) is fourth; Landmarks is
  twenty-sixth.
- **The strip shows four and a half toys** of the category, scrolling sideways. The full grid is two
  taps away (More, then Fill the screen), or the top bar's grid button, which opens a gallery page.
  Two ways to one grid, both unlabeled icons.
- **Search is behind an icon** on phones (always shown on desktop). Search works well once open:
  "piano" finds three toys at once.

### The tabs

- **Toy, Share, Tools, Look, Make, and About.** "Tools" (the tab) and the tool row are two different
  things with one name. The Toy tab holds "Quick settings" (Detail, Reset everything), which people
  look for in Look.
- **Share is long**: Record and its countdown, Save a clip (Video or GIF, length, motion, and size),
  Save picture, Copy link, QR code (labs), Save scene, Open a scene, Save PDF (labs), and the embed
  options. About 20 controls in a 215-pixel window. Copy link is about 500 pixels down.

### Full screen and landscape

- **Full screen shows only the toy and an exit button.** You can orbit and tap the toy, but not
  change tool, play a song, play the effect, or record.
- **A phone on its side gets the desktop layout** (the phone rules start at 760 pixels wide). At 844
  × 390 the panel takes the right 45% of the screen, its settings show about 120 pixels at a time
  under the shelf and tool row, the top buttons sit over the stage, and the toy is small.

### The Studio on a phone

- **Photo to 3D's Toy tab**: Raise or flatten the depth, Layers, Photo, Depth, Show the original,
  Detail, then the "Your own photo" box (Use my camera, Splats or Sharp picture, Open photo). The
  main reason to come, opening your own photo, is about 400 pixels down in a 215-pixel window.
- **The other Studio toys** (Moving photo to 3D, Video to 3D, Sound lab, QR code) follow the same
  pattern: the sample's options first, your own file last.

### Taps for common tasks (390 × 844, from a closed sheet)

| Task                          | Now                                  | With the proposals   |
| ----------------------------- | ------------------------------------ | -------------------- |
| Change the paint color        | Paint, More, Tools, scroll, color: 4 | Paint, color: 2      |
| Copy the link                 | More, Share, scroll ×3, Copy link: 3 | More, Share, Copy: 3 |
| Turn the sound on in settings | Done, sound: 2                       | sound: 1             |
| Open your own photo (Studio)  | More, scroll ×2, Open photo: 2       | More, Open photo: 2  |
| Record in full screen         | not possible                         | Record: 1 (prop. 4)  |

Copy link and Open photo keep their tap count but lose the scrolling (proposals 7 and 8); proposal 2
saves the sound tap.

## Compared with the desktop and other apps

**The desktop layout** (1440 × 900) has room for the same parts at once: the toy, the top bar (with
hover titles), and a 344-pixel panel on the right with the search box, the shelf's grid, the tool
row, and the tabs, whose settings get about 550 pixels. It works because nothing has to give way.
The phone layout stacks the same parts in one sheet, so each part takes room from the others.

**Patterns from well-made phone apps** (described in words; no assets copied):

- **Map apps** (Google Maps, Apple Maps): one bottom sheet with three resting heights (a peek, half,
  and full). The thing on top (the map) stays live above the sheet, and the sheet shows one thing at
  a time: search results, or a place's details, never both stacked.
- **Phone sculpting apps** (Nomad Sculpt): the canvas fills the screen; the current tool's few
  options (size, strength) sit in a slim strip by the tool, and the deep settings are in a panel
  that slides over one edge. Top menus have words, not only icons.
- **3D capture viewers** (Polycam, Scaniverse, Luma): the model fills the screen with a handful of
  floating controls; sharing is one sheet of a few large actions (video, link, file), with formats
  and options one level down.
- **Phone drawing apps** (Procreate Pocket): one "more" button opens a labeled menu of less-used
  actions; the canvas keeps a small, always-visible tool row in full screen.

## Proposals, ranked

Value is to a phone user; effort is S (a day or less), M (two or three days), or L (more). Every
proposal keeps the controls' ids, so the specs that find them by id keep working, and none applies
above 760 pixels wide except proposal 5.

### 1. The settings get the sheet (S, high value)

- **Changes:** while the settings are open on a phone, the shelf's chips and toy strip hide and a
  chip with the toy's picture and name takes their row, beside Done. Tapping the chip shows the
  shelf over the settings.
- **Replaces:** the shelf staying above the settings; Fill the screen's need to hide it.
- **Stays reachable:** the shelf (one tap on the chip), search, Surprise me, Fill the screen.
- **Code:** `styles.css` (make the short-screen block's rule apply to every phone), `src/ui.js`
  `setMode` (the chip), `index.html` (the chip in `.dock`).
- **Risk:** low. People who switch toys from the settings take one more tap.
- **Gain:** settings window about 410 pixels at 390 × 844 (from 215), about 290 at 360 × 740 (from
  101).

### 2. Four buttons on top, the rest in a labeled menu (S, high value)

- **Changes:** the top bar shows Toys, Sound, Full screen, Help, and a More button. More opens a
  menu with words and their state: Turntable (On), Tilt lock (Off), Reset the view, Flag colors, and
  Pop out (when the toy has it). The bar stays in view, slimmer, while the sheet is open. The credit
  line shortens to the toy's name and splat count; a tap shows the full credit.
- **Replaces:** four of the eight round icons; the two-row bar at 360 pixels.
- **Stays reachable:** every button, as a menu item that toggles the same state (the old buttons can
  stay in the page, hidden, so keyboard shortcuts and specs still work).
- **Code:** `index.html` (the view buttons and a new menu), `styles.css` (the top bar's phone
  rules), `src/ui.js` (Pop out's placement, the menu).
- **Risk:** low to medium. Many specs find these buttons by id and check they're visible on phones;
  those specs need the menu opened first, so the PR changes specs (other than `tests/taps.spec.mjs`,
  untouched) with the Operator's OK.

### 3. A tool's options sit on the tool (M, high value)

- **Changes:** picking Paint, Clay, Magnet, or Poke opens a slim tray above the tool row: Paint's
  colors, Brush, and Clear; Clay's Add, Erase, and Blob size; Magnet's Strength and Radius; Poke's
  Strength. Orbit closes it; a swipe down hides it until the next tool change.
- **Replaces:** the trip to the Tools tab for the common options.
- **Stays reachable:** the Tools tab, unchanged (Splash, Wobble, Poke it, Reset view, Effects).
- **Code:** `src/ui.js` (`renderToolParams` and the tool switching), `index.html` (`#tool-group`
  pieces), `styles.css`.
- **Risk:** medium. The tray takes 44 pixels of stage while a tool is picked.

### 4. Full screen keeps a small control bar (S, medium-high value)

- **Changes:** full screen shows the tool row and REC1's stage row (Play or Pause, the hand, Reset,
  Record) on a dark, see-through bar at the bottom. They fade after three seconds with no touch and
  come back with a tap near the bottom edge.
- **Replaces:** full screen's toy-only view (kept as the faded state).
- **Stays reachable:** the exit button, unchanged.
- **Code:** `src/ui.js` `setFocus`, `styles.css` (`body.focus`), the hands bar REC1 reworks.
- **Risk:** low, after REC1 merges. It builds on REC1's row; it must not start before it.

### 5. A phone on its side gets a phone layout (M, high value in landscape)

- **Changes:** a short, touch screen on its side (`max-height: 500px` and `pointer: coarse`) gets a
  full-height side sheet on the right (about 330 pixels), the top buttons in a column on the left,
  and the tool row under the toy. The sheet closes to the right edge.
- **Replaces:** the desktop panel at 844 × 390.
- **Stays reachable:** everything in the panel, in the same order.
- **Code:** `styles.css` (the "short wide screens" block), `src/ui.js` (the `narrow` query and Pop
  out's placement).
- **Risk:** medium: a third layout to keep in the specs (a 844 × 390 screenshot spec).

### 6. Three sheet heights you can drag between (M)

A peek (the tool row), half, and full, like the map apps, with the last height remembered on the
device; the handle already exists (`#sheet-handle`). It replaces More and Done as the only way to
change height; both stay. Code: `src/ui.js` (`setMode`), `styles.css`. Risk: medium (drag versus
scroll inside the sheet).

### 7. Share's main actions first (M)

A row of four big actions at the top of Share: Record, Save video, Save picture, and Copy link.
Below them, "More ways to share" opens the rest (GIF, length, size, scene files, QR code, PDF,
embed). Copy link moves from about 500 pixels down to the first row. Code: `index.html` (the Share
pane), `styles.css`. Risk: medium: lane EXP1 is changing the exporters' defaults and moving "Open a
scene"; this should wait for EXP1 and be done with it.

### 8. Your own file first in the Studio (S)

On Studio toys, the "Your own …" box (Open photo, Use my camera) moves to the top of the Toy tab,
above the sample's options. Code: `src/ui.js` (the order of `renderInputMedia` and the live input in
the Toy tab). Risk: low.

### 9. The depth slider as a short bar (S)

The depth slider over the stage becomes a horizontal bar above the tool row on phones (not a tall
card over the photo), with its × as now. Code: `styles.css` (`.stage-dial` phone rules). Risk: low.
Lane MP1 and TF1 own toys with this slider; the change is styles only.

### 10. One way to the toy grid (S)

The top bar's grid button and Fill the screen both open the same full-screen grid, with search open
at the top and the category chips below it. The gallery page stays for desktop. Code: `src/ui.js`
(`toggleGallery`, `setMode`). Risk: low.

### 11. A compact song and game bar (S)

On phones the song bar is one row (title, Play or Pause, the seek bar) until tapped, and it sits
under the toy, not over its base. Builds on REC1's close button and Play or Pause; after REC1. Code:
`styles.css` (`.game-bar` phone rules). Risk: low.

### 12. The picked tool shows on the stage (S)

When a tool other than Orbit stays picked after a toy change, a small label ("Paint is on") shows on
the stage for two seconds. Nothing changes the tool by itself. Code: `src/ui.js` (the toy change).
Risk: low.

### 13. Zoom buttons as an option on touch screens (S)

On touch screens, + and − move behind "Show zoom buttons" (on by default for keyboard and mouse, off
for touch; remembered on the device). Code: `styles.css`, `src/ui.js`, Look tab. Risk: low, but ask
the owner, since the buttons help people who can't pinch.

### 14. "Quick settings" moves to Look (S)

Detail and Reset everything move from the Toy tab to Look, where people look for them; the Toy tab
keeps the toy's own controls. Code: `index.html`. Risk: low (specs find them by id).

### 15. "Tools" tab renamed (S)

The "Tools" tab becomes "Tool" or "Effects" so it isn't confused with the tool row. A wording change
for the owner. Code: `index.html`. Risk: low.

## What REC1 already does (not repeated here)

Lane REC1 adds a Record button on the stage beside Play, puts the stage's buttons in one row on
phones, makes Play switch to Pause while an effect or a song plays, and gives the media panel (the
song player) a close button. Proposals 4 and 11 build on that work and should start after it merges.
REC1 r2 (the black-video hotfix) runs first.

## Suggested order

1. Proposals 1 and 2 in one lane (the sheet and the top bar; small, styles and `src/ui.js`).
2. Proposal 3 (the tool tray).
3. After REC1: proposals 4 and 11.
4. Proposal 5 (landscape), then 6 (drag heights).
5. After EXP1: proposal 7. The small ones (8 to 15) fit wherever a lane touches that file.

Each lane makes a real-device-style recording of the change at 390 × 844 for the owner, and Codex
task 112's playtest repeats the flows above on a real browser.
