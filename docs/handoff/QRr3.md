# Lane QR r3 (prefix `qr3`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State

WORKING: item 1 (sharper modules) done and pushed; item 2 (more motions) next (October 5, 2026,
Opus 5.5).

### Item 1: sharper modules (measured)

What softened them: every module was a lattice of round splats (3 to 5 per module edge), and a
lattice can only end in a soft edge about as wide as one of its splats (a fifth of a module). The
sharp kernel (labs, `kernel: "sharp"`) and the tier mattered much less (below).

The fix (`src/qr/build.js`, `crisp()`): each shape's edges are drawn by three rings of thin splats
laid along the edge (0.03, 0.06 and 0.11 of a module across, three times as long along it, finer at
square corners), and only the middle is the lattice. Sides that run into a dark neighbor get no
ring; inside corners keep clear; the light sheet is coarser and leaves out what the dark modules
cover. Bubbles' rims and the 3D side walls no longer reach past a module's edge (the small spikes
at the finder corners are gone), and Neon's tubes are crisp pieces too. Codes that would not fit
the tier's splat budget get coarser rings (one retry at the predicted scale), or the old lattice if
that is smaller. Before: up to 165,000 splats (Bricks); now 70,000 to 133,000 at the mid tier.

`node tools/qr3-sharp.mjs` (the toy in Scan view, default link): the median 10–90% rise across
every dark-light module boundary, in CSS pixels (lower is crisper):

| Style      | Phone 390×844 @2x, before → after | Desktop 1440×900, before → after |
| ---------- | --------------------------------- | -------------------------------- |
| Classic    | 1.43 → 0.68                       | 3.21 → 1.43                      |
| Dots       | 1.28 → 0.74                       | 2.91 → 1.53                      |
| Rounded    | 1.43 → 0.71                       | 3.21 → 1.45                      |
| Bricks     | 1.11 → 0.60                       | 2.46 → 1.38                      |
| Gems       | 1.15 → 0.81                       | 2.55 → 1.74                      |
| Bubbles    | 1.07 → 0.66                       | 2.35 → 1.41                      |
| Pale Neon  | 1.22 → 0.69                       | 2.77 → 1.41                      |

A module is 8.3 CSS px on the phone and 19 px on the desktop. Noise inside modules fell too
(Classic 3.3 → 0.6 gray levels on the phone). The sharp kernel on top of this changed the edge by
0.01 to 0.07 px, so the toy keeps the Gaussian. The first scan render right after a build is now
preceded by a warm-up frame: with finer edges, a frame drawn before the splat sort had finished
came out gray and hatched (it failed the Full screen test once).

`tests/qr.spec.mjs` passes (12 of 12) with the change.
