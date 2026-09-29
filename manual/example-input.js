// A small toy with its own typed input, for Level 5 of the Tinkerer's Manual:
// type some numbers and the toy stands them up as bars.
const LIMIT = 12;
const COLORS = ["#e8384f", "#ffc233", "#1fb59a", "#4dabf7"];

export const RECIPES = {
  "little-bars": {
    options: [
      {
        key: "numbers",
        label: "Your numbers",
        type: "text",
        default: "3 1 4 1 5 9 2 6",
        hidden: true,
      },
    ],
    input: {
      title: "Your own numbers",
      placeholder: "3 1 4 1 5 9 2 6",
      button: "Show them",
      fileButton: "Open a text file…",
      accept: ".txt,.csv",
      note: `Type up to ${LIMIT} numbers from 0 to 20, separated by spaces or commas, or open a text file with them.`,
      // Turns the typed text into option values, or throws a message that the panel shows.
      async read(text) {
        const list = String(text).match(/-?\d+(\.\d+)?/g) || [];
        if (list.length === 0) throw new Error("Type some numbers, like 3 1 4 1 5.");
        if (list.length > LIMIT) throw new Error(`That is more than ${LIMIT} numbers.`);
        if (list.some((n) => n < 0 || n > 20)) throw new Error("Use numbers from 0 to 20.");
        return { numbers: list.join(" ") };
      },
      shown: () => "Your numbers",
    },
    build(k, o) {
      const values = String(o.numbers).split(" ").map(Number);
      values.forEach((v, i) => {
        const h = 0.05 + v / 10;
        k.add(k.box(0.14, h, 0.14), {
          pos: [(i - (values.length - 1) / 2) * 0.2, h / 2, 0],
          color: COLORS[i % COLORS.length],
        });
      });
    },
  },
};
