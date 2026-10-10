# 240-character fields in the splat equation toy

Lane Kit lab, October 10, 2026 (Opus 5.5). The owner approved raising the splat equation toy's field
limit from 120 to 240 characters. It changes a toy people can open with labs on, so it waits for his
"good" mark like the rest.

## What changed

- `src/packs/splat-equation.js`: `FIELD_MAX = 240`, used for each field and passed to the reader.
- `src/equation.js` (in the engine PR): `compile()` takes an optional `{ maxLength }`. The default
  stays `MAX_LENGTH` (120).
- `MAX_LENGTH` is also used by the Graph plotter (`readCurve`), the Surface plotter (`readSurface`)
  and, through `compile()`, the computing history toy. They keep 120: their inputs are one line
  each, nobody asked for longer ones, and their links stay as they are. Only the equation toy
  reads 240.

## The other guards

| Guard            | Limit            | Reached at 240 characters?                                                                                                                                                     |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nesting depth    | 32 brackets deep | Already reachable at 66 characters; unchanged.                                                                                                                                 |
| Pieces (nodes)   | 400              | Only for dense text: 200 bare letters (`uuu…`, each a piece with a × between) is 399 pieces, 201 is too many. Written-out programs stay far below (2 to 3 characters a piece). |
| Field characters | 240 (was 120)    | The limit.                                                                                                                                                                     |

So for anything a person types, 240 characters is the real limit. A field of 201 or more bare
letters gets "it is too long" from the piece guard instead of "it is over 240 characters".

## Links

All twelve fields filled with programs of the given length (random sums of terms like
`1.73sin((u + t) - 0.9v)`), the rest of the scene as usual, encoded by src/codec.js:

| Fields               | Text in the fields | Scene JSON | Link, compressed (`d.` deflate) | Link, uncompressed (about 4∕3 of the JSON, base64) |
| -------------------- | ------------------ | ---------- | ------------------------------- | -------------------------------------------------- |
| 8 expressions at 120 | 902                | 2,050      | 1,246                           | 2,734                                              |
| All 12 at 120        | 1,320              | 2,468      | 1,398                           | 3,291                                              |
| 8 expressions at 240 | 1,843              | 2,991      | 1,620                           | 3,988                                              |
| All 12 at 240        | 2,736              | 3,884      | 1,929                           | 5,179                                              |

The longest possible link grows from about 1,400 to about 1,900 characters (compressed), well under
the 24,000 a toy option may hold and the few thousand that chat apps and browsers show without
trouble. A link with 120-character fields loads exactly as before: the fields are read the same, and
tests/klab.spec.mjs round-trips a link with 240-character fields.

## Cost

Each field is evaluated for every point at every moment (13 times with t). A 240-character field is
up to twice the work of a 120-character one, so a build with every field at its longest can take
about twice as long. The presets are all under 120 characters and build as before.
