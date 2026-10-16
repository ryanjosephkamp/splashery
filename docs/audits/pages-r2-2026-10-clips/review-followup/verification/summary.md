# Suite run

- 20 of 20 files, 323 tests: 322 passed, 1 failed, 0 skipped.
- Time in files (one after another): 1 h 32 min. Wall time of this run: 36 min (2 at once).

## Failed

- `smoke:856` Splashery v3 engine (WebGL2) › a scan rig moves a part of a captured toy: the cat
  statue turns its head: failed. Error: expect(received).toEqual(expected) // deep equality

## Slowest files

| File               | Seconds | Tests |
| ------------------ | ------: | ----: |
| smoke              |    1391 |    62 |
| kit                |     826 |    10 |
| pages-r2-occlusion |     825 |     6 |
| bk                 |     538 |    36 |
| man4-pages         |     303 |    14 |
| bk5                |     300 |     9 |
| help               |     293 |    14 |
| pg6                |     280 |    16 |
| pages-r2           |     184 |    11 |
| pic                |     184 |    13 |
| taps               |      88 |    64 |
| pg6-engine         |      84 |     8 |
| bk5-engine         |      77 |     7 |
| hh3-pictures       |      43 |     2 |
| hta                |      29 |     3 |
| fx13               |      28 |     3 |
| hh3-storybook      |      25 |     1 |
| unit               |      18 |    20 |
| pages-r2-engine    |      11 |    13 |
| pol-pages          |       6 |    11 |

## Slowest tests

| Test                                                                                                       | Seconds |
| ---------------------------------------------------------------------------------------------------------- | ------: |
| `kit:139` every kit toy has a recipe that builds deterministically and fits the unit ball                  |     816 |
| `pages-r2-occlusion:137` all bindings and album covers keep full turns inside the sortable volume (webgpu) |     378 |
| `pages-r2-occlusion:137` all bindings and album covers keep full turns inside the sortable volume (webgl2) |     208 |
| `pg6:740` Pop out (in the app) › Your book: two figures up at once, one laid back; the switch holds        |     123 |
| `pages-r2-occlusion:3` photo-album: the turning cover occludes its pages (webgpu)                          |     110 |
| `man4-pages:302` every page works › each page loads with no error, its demos start, and it does not scroll |     103 |
| `bk5:454` links and pop-out (in the app) › Your book: a web link asks first, javascript: is refused,       |      96 |
| `bk5:564` links and pop-out (in the app) › Photo album: a photo pops out with its depth and lies bac       |      87 |
| `bk5:512` links and pop-out (in the app) › Your book: the PDF's picture pops out with its depth and        |      76 |
| `pg6:828` Pop out (in the app) › a depth saved in a scene comes back when the figure is raised             |      75 |
| `smoke:893` Splashery v3 engine (WebGL2) › rigs pick splats by `colour`, run effects and show add-ons; s   |      68 |
| `help:327` the line stays clear of the toy at 1440x900                                                     |      64 |
| `pages-r2-occlusion:3` your-book: the turning cover occludes its pages (webgpu)                            |      64 |
| `smoke:254` Splashery app (WebGL2) › clay adds and erases blobs on a generated toy and survives a JSON     |      63 |
| `bk:1376` your book, the album and the frame (in the app) › screenshots of the three toys at 1440x90       |      58 |
| `smoke:1818` Splashery on a phone › dragging the shelf up opens a grid, and picking a toy folds it back    |      54 |
| `smoke:2032` Splashery on WebGPU › auto picks WebGPU when an adapter exists and effects render             |      54 |
| `help:327` the line stays clear of the toy at 390x844                                                      |      52 |
| `smoke:1716` Splashery on a phone › has no horizontal overflow at 390px and the sheet opens                |      52 |
| `bk:1081` your book, the album and the frame (in the app) › the frame swings and settles; the digita       |      51 |
| `bk:1156` your book, the album and the frame (in the app) › a pointer pulls a page over only when pu       |      50 |
| `bk:963` your book, the album and the frame (in the app) › a 300-page PDF is as light as a 3-page o        |      50 |
| `bk:1376` your book, the album and the frame (in the app) › screenshots of the three toys at 390x844       |      48 |
| `pages-r2:561` a closed album cover hides its picture faces (webgpu)                                       |      47 |
| `smoke:395` Splashery app (WebGL2) › the embed page loads a scene from the hash                            |      47 |
