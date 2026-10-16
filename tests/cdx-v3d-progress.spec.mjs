import { test, expect } from "@playwright/test";

test("slow training shows its remaining time limit and explains finishing", async ({ page }) => {
  await page.goto("/tests/fixtures/v3d/");
  const notes = await page.evaluate(async () => {
    const { progressCard } = await import("/src/video3d/panel.js");
    const card = progressCard(),
      original = performance.now.bind(performance),
      notes = [];
    let now = 1000;
    performance.now = () => now;
    const update = (done, extra = {}) => {
      card.progress({
        stage: "train",
        done,
        total: 1200,
        note: "15000 splats",
        timeLimitMinutes: 8,
        ...extra,
      });
      notes.push(document.querySelector("#v3d-card .v3d-note").textContent);
    };
    try {
      card.reset();
      update(0);
      now += 1000;
      update(1);
      now += 60000;
      update(10);
      now += 390000;
      update(20);
      update(20, { finishing: true });
      card.reset();
      update(0);
      now += 1000;
      update(1000);
      now += 6000;
      update(1100);
      return notes;
    } finally {
      performance.now = original;
      card.hide();
    }
  });
  expect(notes[0]).toContain("up to 8 min before keeping the result");
  expect(notes[2]).toContain("up to 7 min before keeping the result");
  expect(notes[3]).toContain("under a minute before keeping the result");
  expect(notes[4]).toBe("Finishing with what has been trained…");
  expect(notes.at(-1)).toContain("under a minute left");
});
