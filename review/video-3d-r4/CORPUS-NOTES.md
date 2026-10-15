# Task 88 real-clip corpus handoff

Frozen on October 15, 2026, at 04:45:44 UTC. The accepted manifest is `corpus-manifest.json`;
`corpus/` contains exactly its 20 silent H.264 MP4 clips. Total accepted video size: 26,807,550
bytes. Manifest SHA-256: `3b76812b6bc098c6ab4e340e942f7493872c648e3da4b854e582ad5f8073c606`.

All accepted source pages were opened live on Wikimedia Commons, and their HTML receipts are
retained in `evidence/`. Each entry records the author, license, license URL, download URL, download
checksum, source span, output checksum, transformation, and source/license/contact-sheet receipt
hashes. API metadata receipts are also retained when available from discovery. License pages were
opened and saved. No network proxy or CA setting was changed. One burst of discovery requests
received HTTP 429, so further requests were spaced out; no licensing claims were inferred from an
unavailable page.

Each clip comes from a distinct source upload; none comes from the six existing Video to 3D sample
captures. The selected material is real footage. No generated imagery, synthetic camera movement,
stabilization, exposure changes, or sharpening was added. Common preparation was a trim, audio
removal, scaling to 480 pixels high, and 24 fps H.264 encoding at CRF 23. Source timestamps and the
downloaded representation are recorded. Some downloads use Commons' 480p VP9 transcode, so the
capture URL and checksum refer to that actual representation. Original source-page URLs still
identify the distinct upload.

Eight evenly spaced frames per accepted span were visually inspected in `contact-sheets/`;
`corpus-overview.jpg` is a compact index. No identifiable people, readable brand names, or
recognizable logos were found in accepted footage. Some outdoor monument footage contains tiny
distant incidental visitors or silhouettes whose faces and identities are not discernible; people
are never the subject. The library's copyright and attribution notices are preserved per asset in
the manifest. Keep the BY-SA license notices with those clips and their derivatives.

The nine entries tagged `camera-translation` are palace-statue, oa-street, ullard, fremantle-orbit,
ihasalu-orbit, royal-sovereign, viljandi-ruins, kakerdi-bog, and fjoloy. Their scene content is
mostly static. The remaining clips deliberately include rotation, low light, moving animals, object
motion, and insufficient camera motion. These cases were retained as authentic consumer-footage
challenges. The final four were selected for authentic camera translation before any per-candidate
sharpness or SSIM comparison was available. No benchmark outcome was used to choose or transform
clips.

Coverage includes:

- Object orbit and translation: two close lighthouses, a lighthouse at sunset, a rocky island flyby,
  castle ruins, a bog/lake pass, a residential street pass, a statue approach, and entry into a
  stone court.
- Room: a church interior with a genuine camera sweep, a lighthouse lens chamber, and an indoor cat
  scene. The stone court is an architectural interior without a roof.
- Street: a residential street seen from a moving aerial camera. Dense pedestrian streets and retail
  corridors were excluded because inspected candidates showed people or brands.
- Plants: flowering branches with a chameleon, flowers filmed handheld, vegetation around the bog,
  and landscaped statue settings.
- Pet: an indoor cat, an outdoor cat filmed with a handheld tablet, and a sleeping dog close-up.
- Statue: a Buddha, a generic palace statue, and a horse sculpture.
- Still-held camera: the Buddha, indoor cat, and sleeping dog.
- Shaky/fast camera: the palace approach, flowers, outdoor cat, stone court, church sweep, and fast
  island drone pass. Camera behavior is directly observed; hardware is not claimed to be a phone
  unless the source explicitly identifies it.
- Low light: sunset lighthouse orbit, dark church areas, and a dim lighthouse lens chamber. These
  are unaltered exposures, not artificially darkened challenges.

Coverage limitations: aerial footage supplies much of the useful translation, and a real
ground-level phone orbit around a small tabletop object is absent. There is no accepted busy
pedestrian street. Device hardware is unknown for most uploads. The set is a source-backed
exploratory corpus, not a statistically representative sample of all phone recordings.

`corpus-verification.json` records the completed hash, stream, duration, unique-source, and count
checks. Every accepted duration is between 5 and 20 seconds. `unselected-candidates/` contains all
other prepared MP4s and must not be copied into the accepted corpus. Full downloaded captures,
discovery files, and preparation helpers remain outside the repository. No branch was switched, and
no repository files, commits, pushes, or GPU browser training were performed by this sourcing
helper.

Rule check: none.
