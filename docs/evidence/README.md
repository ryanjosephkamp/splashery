# Evidence: how each toy shows it is correct

The owner, October 4, 2026: "I need evidence for every single toy that is supposed to be accurately
showing something that's theoretical or mathematical or an engineering object or scientific ... I do
not want to hallucinate these things ... Anything that we find that actually isn't correct, we will
have to improve ... in some cases you have to stretch things because you can only visualize so much
in an appealing way, but we need to be transparent about that."

Each such toy gets one file here, `docs/evidence/<toy id>.json`. The toy's own page on the site (the
Site lanes, "a page for every toy") shows it in an "Is it right?" section. Nothing of it shows
inside the toy itself.

## The file

```json
{
  "toy": "sorting-machine",
  "checked": "2026-10-05",
  "summary": "Two or three plain sentences: what the toy claims to show, and how far it is right.",
  "claims": [
    {
      "claim": "Bubble sort swaps neighbors until a pass makes no swap.",
      "how": "What the code does, in one or two sentences.",
      "where": "src/packs/computing.js:1060",
      "sources": [
        {
          "title": "Bubble sort",
          "publisher": "Wikipedia",
          "url": "https://en.wikipedia.org/wiki/Bubble_sort",
          "says": "A short quote or a close paraphrase of the line that backs the claim."
        }
      ],
      "verdict": "correct",
      "test": "tests/evidence-computing.spec.mjs:12",
      "note": ""
    }
  ],
  "simplified": [
    "Where the toy stretches the truth for the picture, said plainly (for example: the bars are 8, not thousands)."
  ],
  "fixes": [
    {
      "what": "What was wrong and what it should be.",
      "where": "file:line",
      "status": "fixed in #123 | proposed"
    }
  ]
}
```

- **verdict** is one of `correct`, `close` (right within a stated tolerance), `simplified` (right in
  kind, with the simplification named in `simplified`), `wrong` (with a fix in `fixes`) or
  `unverified` (no source found yet; say what was tried).
- **sources** are pages someone actually opened: a textbook, a standard, a paper, a museum or a
  reference site. Prefer primary and well-known sources. Never a source that can't be opened.
- **test** names a test that checks the claim when one exists (an algorithm's output against known
  answers, a constant against its reference value). A claim backed by a test is stronger than one
  backed by reading.
- The file says nothing about who or what checked it: no model, agent or tool names. It is the
  site's evidence, written in plain American English for a curious reader.

## Who writes them

The correctness tasks (docs/codex/16 to 20) write the first files, shelf by shelf. A Claude lane
that changes a toy with a file here updates its file in the same PR. A toy page shows the file as it
is on `main`.
