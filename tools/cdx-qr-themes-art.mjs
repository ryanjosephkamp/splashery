// Task 58: original SVG illustrations. No payload or QR layout enters this generator.
// Artwork: CC0 1.0, made by Ryan with Codex (GPT-6).
export const THEMES = [
  [
    "seasons",
    "Seasons",
    [
      "Spring blossom",
      "Summer sun",
      "Autumn maple",
      "Winter snowflake",
      "Tulip",
      "Pumpkin",
      "Rain umbrella",
      "Winter mittens",
      "Apple",
      "Spring buds",
      "Winter fir",
      "Autumn acorn",
    ],
  ],
  [
    "ocean",
    "Ocean",
    [
      "Scallop shell",
      "Spiral shell",
      "Rolling wave",
      "Starfish",
      "Reef fish",
      "Coral fan",
      "Seaweed",
      "Pearl shell",
      "Sea turtle",
      "Jellyfish",
    ],
  ],
  [
    "forest",
    "Forest",
    [
      "Fern frond",
      "Woodland mushroom",
      "Pinecone",
      "Fir tree",
      "Oak leaf",
      "Acorn",
      "Butterfly",
      "Woodland logs",
      "Berry branch",
      "Pond leaves",
      "Ginkgo fan",
      "Birch branch",
    ],
  ],
  [
    "space-art",
    "Space-art",
    [
      "Ringed planet",
      "Crescent moon",
      "Comet",
      "Spiral galaxy",
      "Paper rocket",
      "Orbital rings",
      "Starburst",
      "Imaginary nebula",
      "Twin planets",
      "Meteor shower",
    ],
  ],
  [
    "patterns",
    "Patterns",
    [
      "Scalloped fans",
      "Woven bands",
      "Folded ribbons",
      "Spiral tiles",
      "Petal rosette",
      "Ripple rings",
      "Mosaic diamonds",
      "Arc quilt",
      "Paper folds",
      "Wavy stripes",
      "Large chevrons",
      "Nested squares",
    ],
  ],
  [
    "celebrations",
    "Celebrations",
    [
      "Balloons",
      "Wrapped gift",
      "Party cake",
      "Paper bunting",
      "Confetti",
      "Festival lantern",
      "Ribbon bow",
      "Flower bouquet",
      "Celebration wreath",
      "Paper pinwheel",
    ],
  ],
];

const ellipse = (x, y, rx, ry, fill = "url(#main)", extra = "") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path = (d, fill = "url(#main)", extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (d, color = "#53725d", width = 1.8) =>
  path(
    d,
    "none",
    `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`,
  );
const rect = (x, y, w, h, fill = "url(#main)", r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");
function flower(cx = 54, cy = 52, count = 7, radius = 16) {
  return (
    repeat(count, (i) =>
      ellipse(
        cx,
        cy - radius,
        10,
        17,
        "url(#main)",
        `transform="rotate(${(i * 360) / count} ${cx} ${cy})"`,
      ),
    ) + ellipse(cx, cy, 9, 9, "url(#warm)")
  );
}
function leaf(d = "M54 80 Q21 66 33 41 Q43 22 65 25 Q86 62 54 80Z") {
  return (
    path(d) +
    line("M54 80 Q48 52 61 30") +
    line("M49 66 L36 52 M51 55 L70 45 M53 44 L44 36", "#527567", 1.2)
  );
}
function scallop() {
  return (
    path("M29 73 Q15 60 25 42 Q31 29 42 33 Q50 23 60 32 Q76 27 84 42 Q96 61 78 74 L55 82Z") +
    repeat(7, (i) =>
      line(
        `M55 80 Q${26 + i * 9} 57 ${27 + i * 9} ${40 - 7 * Math.sin((i * Math.PI) / 6)}`,
        "#d6b699",
        1.6,
      ),
    )
  );
}
function ringedPlanet(x = 54, y = 52, radius = 24) {
  return (
    ellipse(x, y, radius, radius) +
    ellipse(
      x,
      y,
      radius * 1.65,
      radius * 0.42,
      "none",
      `stroke="#d6a88b" stroke-width="6" transform="rotate(-25 ${x} ${y})"`,
    ) +
    path(
      `M${x - radius} ${y} Q${x} ${y + 14} ${x + radius} ${y}`,
      "none",
      'stroke="#98b4c6" stroke-width="4"',
    )
  );
}
function motif(theme, m) {
  if (theme === "seasons") {
    if (m === 10) return motif("forest", 3);
    if (m === 11) return motif("forest", 5);
    return [
      () => flower(),
      () =>
        repeat(12, (i) =>
          rect(51, 16, 5, 13, "url(#warm)", 2).replace(
            "/>",
            ` transform="rotate(${i * 30} 54 52)"/>`,
          ),
        ) + ellipse(54, 52, 23, 23, "url(#warm)"),
      () =>
        path(
          "M54 82 L48 65 L26 66 L32 54 L20 42 L40 43 L37 22 L51 35 L59 17 L67 39 L82 30 L78 49 L90 55 L69 65Z",
          "url(#warm)",
        ) + line("M54 82 L57 38 M53 61 L37 51 M55 57 L73 48", "#a77d56"),
      () =>
        repeat(
          6,
          (i) =>
            `<g transform="rotate(${i * 60} 54 53)">${line("M54 53 L54 20 M54 34 L44 26 M54 34 L64 26 M54 43 L44 35 M54 43 L64 35", "#4b91ad", 3.6)}</g>`,
        ),
      () =>
        line("M54 83 L54 53 M54 72 Q31 58 38 61 M54 67 Q76 50 77 56", "#4d9268", 4) +
        path("M32 34 Q43 47 49 27 Q58 43 69 30 L74 52 Q53 75 33 52Z"),
      () =>
        ellipse(55, 55, 29, 25, "url(#warm)") +
        repeat(4, (i) =>
          ellipse(43 + i * 8, 55, 9, 24, "none", 'stroke="#bf8b60" stroke-width="1.4"'),
        ) +
        path("M51 32 L51 21 Q59 17 61 22 L57 34Z", "#719171"),
      () =>
        path("M20 54 Q53 4 89 54 Q80 45 72 56 Q61 45 54 56 Q42 45 34 56 Q25 46 20 54Z") +
        line("M54 54 L54 81 Q51 91 43 81", "#967a62", 3) +
        line("M54 30 L54 53", "#b7d6cf", 1.7),
      () =>
        path("M30 76 L27 47 Q26 35 37 34 Q45 33 48 42 L49 51 Q60 43 62 54 Q63 62 51 68 L51 77Z") +
        path(
          "M66 78 L65 46 Q65 34 76 35 Q87 34 89 46 L87 61 Q99 60 93 71 L88 78Z",
          "url(#accent)",
        ) +
        rect(29, 72, 23, 8, "#c7a08c", 2) +
        rect(65, 73, 24, 8, "#c7a08c", 2),
      () =>
        path(
          "M55 36 Q31 27 29 53 Q23 78 46 83 Q57 78 66 82 Q86 77 82 53 Q79 27 55 36Z",
          "url(#warm)",
        ) +
        line("M55 38 Q52 27 58 20", "#786651", 3) +
        leaf("M57 31 Q62 15 77 21 Q75 35 57 31Z"),
      () =>
        line("M54 85 Q49 51 64 23 M55 63 L34 43 M55 50 L78 37", "#67917a", 3) +
        ellipse(33, 40, 9, 14, "url(#accent)", 'transform="rotate(-25 33 40)"') +
        ellipse(79, 35, 9, 14) +
        ellipse(64, 24, 9, 13),
    ][m]();
  }
  if (theme === "ocean") {
    return [
      scallop,
      () =>
        ellipse(54, 54, 30, 28, "url(#warm)") +
        line(
          "M79 61 C48 98 9 58 38 33 C72 11 94 59 64 73 C42 81 28 54 47 44 C63 34 76 53 61 61 C51 66 45 55 54 51",
          "#b78869",
          4,
        ),
      () =>
        path("M19 72 Q35 60 43 37 Q62 14 84 32 Q59 26 58 50 Q67 39 82 52 Q94 68 83 79 L19 79Z") +
        line("M29 71 Q48 71 56 53 M57 39 Q72 28 82 33", "#c1e2da", 3.5),
      () =>
        path(
          "M54 19 L63 43 L89 45 L69 60 L76 85 L54 71 L32 85 L39 60 L19 45 L45 43Z",
          "url(#warm)",
        ) +
        repeat(5, (i) => ellipse(54, 40, 2, 3, "#dfbfa5", `transform="rotate(${72 * i} 54 53)"`)),
      () =>
        path("M28 54 L16 36 L17 72Z", "url(#accent)") +
        ellipse(56, 54, 30, 21) +
        path("M47 33 L60 23 L72 36 M47 75 L62 85 L73 71", "url(#warm)") +
        ellipse(77, 50, 2.8, 2.8, "#567c82") +
        line("M42 38 Q53 54 43 70 M54 34 Q67 54 56 74", "#b4ddd3", 4),
      () =>
        repeat(9, (i) =>
          line(
            `M55 83 Q${30 + i * 6} 50 ${23 + i * 8} ${27 + Math.abs(i - 4) * 3} M${39 + i * 3} 63 L${24 + i * 8} 48`,
            "#be8295",
            4,
          ),
        ),
      () =>
        repeat(5, (i) =>
          path(
            `M${41 + i * 7} 84 Q${22 + i * 10} 62 ${39 + i * 6} 48 Q${54 + i * 6} 32 ${43 + i * 6} 21 Q${72 + i * 3} 48 ${59 + i * 5} 59 Q${42 + i * 6} 72 ${53 + i * 5} 84Z`,
            i % 2 ? "url(#accent)" : "url(#main)",
          ),
        ),
      () => scallop() + ellipse(54, 61, 15, 15, "url(#pearl)"),
      () =>
        ellipse(55, 56, 24, 28) +
        ellipse(55, 23, 9, 11, "url(#accent)") +
        repeat(4, (i) =>
          ellipse(30, 43, 8, 17, "url(#accent)", `transform="rotate(${i * 90} 55 56)"`),
        ) +
        path(
          "M55 36 L71 47 L69 65 L55 76 L40 65 L39 47Z",
          "none",
          'stroke="#aecbc5" stroke-width="2.5"',
        ),
      () =>
        repeat(7, (i) =>
          line(
            `M${34 + i * 7} 53 Q${23 + i * 11} 68 ${35 + i * 8} 88`,
            i % 2 ? "#8f99c4" : "#78a8bd",
            3.3,
          ),
        ) +
        path("M25 55 Q27 18 55 21 Q87 21 88 55 Q72 65 56 57 Q42 66 25 55Z") +
        line("M36 49 Q42 28 55 27", "#c4dcda", 3),
    ][m]();
  }
  if (theme === "forest") {
    return [
      () =>
        line("M46 84 Q47 55 65 22", "#58845f", 3) +
        repeat(
          7,
          (i) =>
            `<g transform="translate(${i * 2} ${-i * 7})">${path("M48 78 Q23 78 27 64 Q41 61 48 78Z")}${path("M49 76 Q70 53 79 61 Q75 77 49 76Z")}</g>`,
        ),
      () =>
        path("M45 80 L48 50 L63 50 L69 80 Q57 88 45 80Z", "url(#pearl)") +
        path("M20 53 Q28 19 55 23 Q81 21 90 53 Q53 67 20 53Z", "url(#warm)") +
        ellipse(43, 37, 5, 3, "#dbcab5") +
        ellipse(66, 40, 7, 4, "#dbcab5"),
      () =>
        ellipse(56, 55, 22, 32, "url(#warm)") +
        repeat(5, (j) =>
          repeat(3, (i) =>
            path(
              `M${35 + i * 14 + (j % 2) * 4} ${33 + j * 10} q7 -8 14 0 q-2 12 -7 13Z`,
              j % 2 ? "#b39678" : "#c2a383",
            ),
          ),
        ),
      () =>
        rect(51, 69, 8, 17, "#9c826b") +
        path("M54 16 L72 43 L65 43 L82 62 L72 62 L90 79 L19 79 L38 61 L29 61 L45 42 L37 42Z"),
      () =>
        leaf(
          "M54 83 Q40 82 41 70 Q25 69 32 58 Q19 49 33 45 Q25 33 41 32 Q42 15 57 22 Q72 20 70 36 Q85 39 75 51 Q87 63 69 69 Q67 81 54 83Z",
        ),
      () =>
        path("M37 49 Q37 24 56 25 Q78 25 78 49Z", "#80927b") +
        path("M38 49 L77 49 Q75 83 56 85 Q39 79 38 49Z", "url(#warm)") +
        line("M56 29 L60 18", "#7f7761", 4) +
        repeat(5, (i) => line(`M${39 + i * 8} 47 l8 -12`, "#a5b29a", 2)),
      () =>
        path(
          "M54 50 Q27 13 19 37 Q9 68 49 61 Q22 83 43 89 L55 67 Q77 92 88 73 Q93 57 61 58 Q95 35 78 21 Q62 21 54 50Z",
        ) + line("M55 35 L55 78 M55 38 L49 29 M55 38 L62 29", "#8b7269", 2.8),
      () =>
        path("M24 54 L65 29 L82 46 L42 78Z", "url(#warm)") +
        ellipse(34, 65, 16, 19, "#d1b795", 'transform="rotate(-35 34 65)"') +
        ellipse(
          34,
          65,
          9,
          11,
          "none",
          'stroke="#aa8c6c" stroke-width="2" transform="rotate(-35 34 65)"',
        ) +
        line("M43 52 L70 35 M49 62 L77 44", "#9d8066", 2),
      () =>
        line("M40 86 Q48 49 73 25 M50 62 L31 42 M59 44 L80 42", "#6e8b72", 3) +
        repeat(5, (i) =>
          ellipse(66 + (i % 3) * 7, 29 + Math.floor(i / 3) * 10, 5.8, 6.4, "url(#accent)"),
        ) +
        leaf("M48 70 Q19 76 21 56 Q42 49 48 70Z"),
      () =>
        ellipse(53, 58, 34, 27, "#8faead") +
        path("M52 32 Q88 30 84 60 Q74 90 42 80 Q20 67 23 48 Q26 32 52 32 L53 57 L67 41Z") +
        flower(45, 54, 6, 6),
      () =>
        path(
          "M54 72 Q26 68 20 43 Q24 26 39 28 Q49 22 55 32 Q64 20 75 29 Q91 30 90 45 Q82 66 54 72Z",
        ) + line("M54 84 L54 68 M54 69 L34 39 M54 69 L75 39", "#6e8b72", 2.3),
      () =>
        line("M48 84 Q49 52 60 25 M50 67 L32 50 M54 51 L74 41", "#6e8b72", 3) +
        path("M33 56 Q15 48 25 29 Q44 29 44 46 Q44 55 33 56Z") +
        path("M65 54 Q61 31 81 27 Q91 47 76 55Z", "url(#accent)") +
        path("M57 39 Q42 28 54 16 Q73 17 67 32Z", "url(#warm)"),
    ][m]();
  }
  if (theme === "space-art") {
    return [
      ringedPlanet,
      () => path("M71 24 C24 15 11 73 58 85 Q75 84 86 70 C44 85 36 39 71 24Z"),
      () =>
        path("M78 21 L58 75 L23 71Z", "url(#accent)") +
        ellipse(43, 68, 20, 17, "url(#warm)") +
        line("M51 60 L71 33 M38 57 L58 31", "#c4bdd2", 3),
      () =>
        ellipse(55, 53, 35, 20, "#afb1c3", 'transform="rotate(-25 55 53)"') +
        line(
          "M56 51 C76 26 91 54 67 70 C33 88 6 52 38 34 C69 16 99 41 76 63 C57 82 29 65 40 48 C48 38 65 39 65 50 C65 58 51 58 54 51",
          "#879cbb",
          8,
        ) +
        ellipse(55, 51, 8, 7, "url(#pearl)"),
      () =>
        path("M47 67 L34 81 L36 56 M62 68 L77 82 L77 57", "url(#accent)") +
        path("M43 67 Q33 37 56 17 Q79 37 67 67Z") +
        ellipse(55, 42, 8, 10, "url(#pearl)") +
        path("M47 71 Q52 94 60 71Z", "url(#warm)"),
      () =>
        repeat(3, (i) =>
          ellipse(
            54,
            54,
            34,
            15,
            "none",
            `stroke="${["#939fbc", "#b29abb", "#a8bcb7"][i]}" stroke-width="5" transform="rotate(${i * 60} 54 54)"`,
          ),
        ) + ellipse(54, 54, 12, 12, "url(#warm)"),
      () =>
        path("M55 17 L64 43 L91 53 L65 64 L55 91 L44 65 L17 53 L43 43Z", "url(#warm)") +
        ellipse(55, 53, 14, 14, "url(#pearl)"),
      () =>
        repeat(7, (i) =>
          ellipse(
            34 + (i % 3) * 17,
            39 + Math.floor(i / 3) * 17,
            18,
            15,
            i % 2 ? "url(#accent)" : "url(#main)",
            'opacity="0.8"',
          ),
        ) + repeat(6, (i) => ellipse(32 + ((i * 19) % 48), 33 + ((i * 13) % 42), 2, 2, "#e2d1b9")),
      () => ringedPlanet(44, 57, 22) + ellipse(77, 30, 13, 13, "url(#accent)"),
      () =>
        repeat(
          4,
          (i) =>
            line(`M${34 + i * 13} 26 L${21 + i * 13} ${64 + i * 5}`, "#aaa6bf", 7) +
            ellipse(21 + i * 13, 64 + i * 5, 6, 6, "url(#warm)"),
        ),
    ][m]();
  }
  if (theme === "patterns") {
    if (m === 10)
      return repeat(3, (i) =>
        line(
          `M24 ${31 + i * 19} L54 ${46 + i * 19} L84 ${31 + i * 19}`,
          ["url(#main)", "url(#accent)", "url(#warm)"][i],
          8,
        ),
      );
    if (m === 11)
      return repeat(
        4,
        (i) =>
          `<rect x="${24 + i * 7}" y="${24 + i * 7}" width="${62 - i * 14}" height="${62 - i * 14}" rx="${10 - i * 2}" fill="none" stroke="${i % 2 ? "url(#accent)" : "url(#main)"}" stroke-width="4.2"/>`,
      );
    return [
      () =>
        repeat(3, (j) =>
          repeat(3, (i) =>
            path(
              `M${20 + i * 23} ${44 + j * 19} q-12 -28 12 -28 q24 0 12 28Z`,
              (i + j) % 2 ? "url(#accent)" : "url(#main)",
            ),
          ),
        ),
      () =>
        repeat(4, (i) => rect(22 + i * 14, 24, 9, 59, "url(#main)", 3)) +
        repeat(4, (i) => rect(21, 26 + i * 14, 62, 8, i % 2 ? "#c3a895" : "#a0b5b0", 3)),
      () =>
        repeat(3, (i) =>
          path(
            `M${19 + i * 19} 26 L${39 + i * 19} 26 L${65 + i * 9} 77 L${42 + i * 9} 77Z`,
            i % 2 ? "url(#accent)" : "url(#main)",
          ),
        ),
      () =>
        repeat(
          4,
          (i) =>
            `<g transform="translate(${(i % 2) * 31} ${Math.floor(i / 2) * 31})">${line("M34 41 C12 41 13 12 35 14 C59 17 53 49 32 48 C15 47 18 23 34 24 C46 25 45 39 35 38", i % 2 ? "#bd92a4" : "#739eae", 6)}</g>`,
        ),
      () => flower(54, 54, 12, 18),
      () =>
        repeat(5, (i) =>
          ellipse(
            55,
            55,
            8 + i * 6,
            8 + i * 6,
            "none",
            `stroke="${i % 2 ? "#ba9aad" : "#86a9b6"}" stroke-width="4"`,
          ),
        ),
      () =>
        repeat(4, (j) =>
          repeat(4, (i) =>
            path(
              `M${25 + i * 15} ${17 + j * 17} l11 12 -11 12 -11 -12Z`,
              (i + j) % 2 ? "url(#accent)" : "url(#main)",
            ),
          ),
        ),
      () =>
        repeat(3, (j) =>
          repeat(
            3,
            (i) =>
              path(
                `M${22 + i * 22} ${23 + j * 21} h21 v20 h-21Z`,
                (i + j) % 2 ? "#a0b7ba" : "#c7a6a4",
              ) +
              path(
                `M${22 + i * 22} ${43 + j * 21} q0 -20 21 -20 v20Z`,
                (i + j) % 2 ? "url(#accent)" : "url(#main)",
              ),
          ),
        ),
      () =>
        path("M22 72 L54 22 L86 72 L54 83Z") +
        path("M54 22 L54 83 L37 60Z", "url(#accent)") +
        path("M54 22 L72 61 L54 83Z", "url(#warm)"),
      () =>
        repeat(5, (i) =>
          line(
            `M22 ${29 + i * 11} Q40 ${12 + i * 11} 55 ${29 + i * 11} T88 ${29 + i * 11}`,
            i % 2 ? "#b58fa5" : "#719fad",
            6,
          ),
        ),
    ][m]();
  }
  return [
    () =>
      line("M35 51 Q38 71 53 86 M75 54 Q73 73 53 86 M56 53 L53 86", "#9a887b", 1.4) +
      ellipse(35, 41, 15, 21, "url(#accent)") +
      ellipse(74, 43, 15, 21, "url(#warm)") +
      ellipse(56, 32, 16, 22),
    () =>
      rect(25, 39, 60, 42, "url(#accent)", 3) +
      rect(22, 34, 66, 12) +
      rect(51, 34, 9, 47, "url(#warm)") +
      path("M55 34 Q15 28 31 18 Q45 11 55 34 Q65 9 80 18 Q94 32 55 34Z", "url(#warm)"),
    () =>
      rect(25, 42, 62, 37, "url(#accent)", 6) +
      path(
        "M25 47 Q32 62 39 48 Q48 65 55 48 Q63 60 69 48 Q80 64 87 47 L87 42 L25 42Z",
        "url(#pearl)",
      ) +
      repeat(
        3,
        (i) =>
          rect(38 + i * 17, 27, 4, 17, "url(#main)", 1) +
          ellipse(40 + i * 17, 21, 3, 5, "url(#warm)"),
      ) +
      ellipse(56, 80, 37, 4, "#a6b4b4"),
    () =>
      line("M18 30 Q54 53 91 29 M20 59 Q54 80 89 57", "#8b969e", 1.5) +
      repeat(4, (i) =>
        path(
          `M${22 + i * 17} ${33 + Math.sin((i * Math.PI) / 3) * 8} l15 4 -12 19Z`,
          i % 2 ? "url(#warm)" : "url(#main)",
        ),
      ) +
      repeat(3, (i) =>
        path(
          `M${29 + i * 19} ${64 + Math.sin((i * Math.PI) / 2) * 6} l15 0 -8 16Z`,
          "url(#accent)",
        ),
      ),
    () =>
      repeat(25, (i) =>
        rect(
          24 + ((i * 23) % 60),
          25 + ((i * 17) % 59),
          5 + (i % 3),
          9,
          ["url(#main)", "url(#accent)", "url(#warm)"][i % 3],
          1,
        ).replace(
          "/>",
          ` transform="rotate(${i * 31} ${27 + ((i * 23) % 60)} ${29 + ((i * 17) % 59)})"/>`,
        ),
      ),
    () =>
      ellipse(55, 52, 27, 31, "url(#warm)") +
      repeat(4, (i) =>
        ellipse(42 + i * 8, 52, 9, 29, "none", 'stroke="#c4a083" stroke-width="1.4"'),
      ) +
      rect(36, 20, 39, 6, "url(#main)", 2) +
      rect(39, 79, 32, 6, "url(#main)", 2) +
      repeat(5, (i) => line(`M${43 + i * 6} 85 v8`, "#ab8987", 1.5)),
    () =>
      path("M55 52 Q9 21 24 57 Q30 72 55 52 Q70 19 88 36 Q104 69 55 52Z") +
      path("M50 55 L30 82 L49 80 L56 61 L65 85 L83 82 L60 54Z", "url(#accent)") +
      ellipse(55, 53, 8, 9, "url(#warm)"),
    () =>
      line("M38 42 L54 83 M70 44 L54 83 M54 31 L54 83", "#76967b", 4) +
      flower(35, 40, 6, 6) +
      flower(72, 43, 6, 7) +
      flower(54, 28, 6, 6) +
      path("M38 60 L73 60 L64 87 L46 87Z", "url(#accent)"),
    () =>
      repeat(
        10,
        (i) =>
          `<g transform="rotate(${i * 36} 55 55)">${ellipse(55, 28, 9, 14)}${ellipse(65, 30, 4, 4, "url(#accent)")}</g>`,
      ) + path("M54 73 Q31 60 33 80 Q47 89 54 73 Q79 59 78 79 Q63 90 54 73Z", "url(#warm)"),
    () =>
      line("M55 54 L55 90", "#928272", 3) +
      repeat(
        4,
        (i) =>
          `<g transform="rotate(${i * 90} 55 53)">${path("M55 53 L55 18 L24 25Z", i % 2 ? "url(#accent)" : "url(#main)")}${path("M55 53 L24 25 L32 51Z", "url(#warm)")}</g>`,
      ) +
      ellipse(55, 53, 5, 5, "url(#pearl)"),
  ][m]();
}

// Extra independent palette treatments after the initial 120-candidate screen.
// These subjects needed more alternatives to fill Seasons without lowering its scan gate.
const EXTRA_TREATMENTS = { seasons: [0, 4, 5] };
export function candidates() {
  return THEMES.flatMap(([theme, group, names]) =>
    names.flatMap((name, motif) =>
      (EXTRA_TREATMENTS[theme]?.includes(motif) ? [0, 1, 2, 3] : [0, 1]).map((variant) => ({
        id: `cdx-theme-${theme}-${motif + 1}-${variant + 1}`,
        theme,
        group,
        motif,
        variant,
        name: `${name}${["", " · soft", " · warm", " · dusk"][variant]}${theme === "space-art" ? " (imaginary art)" : ""}`,
      })),
    ),
  );
}

export function artwork({ theme, motif: m, variant: v }) {
  const baseColors = {
    seasons: ["#779bb5", "#bd7f9f", "#e0a568"],
    ocean: ["#529da9", "#8c9cbd", "#d1a88c"],
    forest: ["#729d76", "#a883a5", "#bd9470"],
    "space-art": ["#7899ba", "#ad8eb5", "#d5ad83"],
    patterns: ["#6b9fb1", "#b688a8", "#d1a382"],
    celebrations: ["#76a5b2", "#c08ca8", "#d8ab7d"],
  }[theme];
  const colors =
    v < 2
      ? baseColors
      : v === 2
        ? ["#819da2", "#b89886", "#c2a878"]
        : ["#818fad", "#b28da6", "#c0a888"];
  const paperCenter = ["#b9bab7", "#c4c5c3", "#c0b6aa", "#aaaeba"][v];
  const paperEdge = ["#aaaeb4", "#aeb8bb", "#b2aaa2", "#939cac"][v];
  const gradients = ["main", "accent", "warm"]
    .map(
      (id, i) =>
        `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[i]}"/><stop offset="1" stop-color="${colors[(i + 1) % 3]}"/></linearGradient>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 100 100"><defs>${gradients}<radialGradient id="paper"><stop stop-color="${paperCenter}"/><stop offset="1" stop-color="${paperEdge}"/></radialGradient><radialGradient id="pearl" cx="35%" cy="25%"><stop stop-color="#e1d9c9"/><stop offset="1" stop-color="#b2b9bb"/></radialGradient></defs><rect width="100" height="100" fill="url(#paper)"/>${ellipse(56, 87, 25, 2.5, "#9ca6aa", 'opacity="0.35"')}<g opacity="${v === 1 ? 0.82 : 1}">${motif(theme, m)}</g></svg>`;
}
