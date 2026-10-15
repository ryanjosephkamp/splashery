# Frozen experimental runtime overlays

The base runtime is product commit c0c9244737cc7a967cb0f00b0a9c1ab528181198.
Revision 6 replaces only src/video3d/surface-seed.js; revision 7 replaces only
src/video3d/run.js. The accompanying served-source receipts bind every requested
source URL and byte hash. These overlays retain the exact code used by their
captured runs, including rejected experiments. They are review evidence and
must never be merged into the product.

The base revision 5 runtime was frozen before the public worktree continued.
Its server handoff preserved every served byte. Later product commits do not
change a captured experiment's runtime.
