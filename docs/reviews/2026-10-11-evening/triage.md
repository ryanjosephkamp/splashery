# Triage of the October 11 evening walkthrough

The owner walked through the Splashery site (`/site/`) and the Tinkerer's Manual on October 11,
2026, at about 6:30 p.m. ET (22:30 UTC). His notes stay private. This file is the Operator's summary
of the site and manual items, in the Operator's words, with the lane that owns each. Ops #540
(Manual r6, Site r4 and its engine PR) merged after the walkthrough, so the site he saw didn't have
it yet.

He is holding every wording change until the manual is finished and audited: one rewording pass for
the manual and the site's Learn pages comes then. No lane rewords anything now except where a fix
needs it.

## Approved as they are

Search, Credits, Contact, Privacy, Terms of use, About, the Learn pages (How 3D Gaussian splats
work, What Splashery can do, the lab notebook, How Splashery is made, Embed and share), Studio,
Science, Tools, Toys and Home. What's new is approved too, with one addition (below). The manual's
new page layout is approved.

## Site r5 (`st5`, Sonnet)

1. **What's new: the feature cards and the before-and-after cards open their toy.** Tapping anywhere
   on a card opens the most relevant toy in the Splashery Playground in a new tab (for a
   before-and-after, the toy in its pictures; for a feature, the toy on its card). The new-toy
   gallery keeps opening each toy's site page.
2. **The Learn pages that restate the manual:** a report of each page, the manual section it
   mirrors, and where they differ in substance. After the manual's final audit, they are brought in
   line with it (no separate audit needed if they mirror the audited text).

## Manual r7a (`man7a`, Sonnet): crisp demos and pictures

1. **Every demo crisp on a phone.** The demos' text, axes, numbers and lines look grainy on a phone,
   blurrier than the page text. Cause: the demo canvases ignore the screen's pixel density. Only
   splats meant to be soft may stay soft.
2. **Chapter 1, "one splat, one control for each number":** the size sliders run from 0 to 1.60 and
   start at 0.80, so the splat starts larger.
3. **Chapter 3, the rainbow torus figure ("each dot on the grid is one splat"):** it moves on the
   web page; the PDF keeps a still.
4. **Chapter 3's last demo:** its text is sharp (item 1).
5. **"What else Splashery does now":** a picture for each item.
6. **"What Splashery can do that other splat tools can't":** a visual companion for every item.
7. **"How Splashery is built":** one diagram that sums up the page, easy to update.

## Manual r7b (`man7b`, Sonnet): Chapters 6 to 10 and the back matter

1. **Chapters 6 to 10 written** (they are placeholders today): moving things, real data, photos and
   video into 3D, codes and pages, and making your own.
2. **The glossary, Further reading, References and the Quick reference expanded.** Further reading
   adds more papers and projects with Gaussian splats, including robotics and other applications,
   linked and credited correctly.
3. **"Level" and "Chapter":** "What comes later" still says "Level 2"; the naming becomes
   consistent.
4. **The footer link:** "Splashery" in "Part of Splashery, …" opens the site's home page (the front
   door), in a new tab. "Back to the Splashery Playground" keeps opening the Playground in a new
   tab.

## The manual's audit cycle from here

1. Manual r6 (#536, merged in #540) fixed Codex task 35's second audit (all 14 new findings and the
   ones it marked partly fixed).
2. Manual r7a and r7b add the pictures, the crisp demos, Chapters 6 to 10 and the back matter.
3. Codex then audits the whole manual (text, figures, demos and the PDF) as task 36, and a lane
   fixes what it finds.
4. The owner does his walkthrough and the single rewording pass, for the manual and the Learn pages
   together.

## Privacy of the owner's notes

The owner's notes and files (walkthroughs, reviews, answers, ideas) are private and internal. A
version goes into the repo or onto the site only after it is cleaned up and he approves it.
CLAUDE.md now says so. Raw notes filed in the repo before this rule are being removed (Ops).

## Elsewhere

His plans for outside agents (what they may build for Splashery and the rules they follow) are being
worked out with him on a private page, not here.
