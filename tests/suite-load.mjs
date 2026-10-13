// Opt-in load for repeated flake proofs. Clean benchmarks use the original
// Playwright test object and fixtures, with no CDP connections or extra hooks.
// Example: SPLASHERY_CPU_RATE=4 npx playwright test tests/stm.spec.mjs --repeat-each=20
import { test as playwrightTest, expect } from "@playwright/test";

const rate = Number(process.env.SPLASHERY_CPU_RATE || 1);
if (!Number.isFinite(rate) || rate < 1)
  throw new Error("SPLASHERY_CPU_RATE must be a finite number greater than or equal to 1");

export { expect };
export const test =
  rate === 1
    ? playwrightTest
    : playwrightTest.extend({
        browser: [
          async ({ browser }, use) => {
            const contexts = new Map();
            const sessions = new Set();
            const originalContext = browser.newContext;
            const throttle = async (page) => {
              const session = await page.context().newCDPSession(page);
              sessions.add(session);
              const release = async () => {
                if (!sessions.delete(session)) return;
                await session.detach().catch(() => {});
              };
              page.once("close", release);
              try {
                await session.send("Emulation.setCPUThrottlingRate", { rate });
              } catch (error) {
                await release();
                throw error;
              }
            };
            const wrap = (context) => {
              if (contexts.has(context)) return context;
              const originalPage = context.newPage;
              context.newPage = async (...args) => {
                const page = await originalPage.apply(context, args);
                await throttle(page);
                return page;
              };
              const restore = () => {
                context.newPage = originalPage;
                contexts.delete(context);
              };
              contexts.set(context, restore);
              context.once("close", restore);
              return context;
            };
            browser.newContext = async (...args) =>
              wrap(await originalContext.apply(browser, args));
            // browser.newPage delegates to newContext and context.newPage, so
            // it follows the same awaited path as explicit contexts and pages.
            for (const context of browser.contexts()) wrap(context);
            try {
              await use(browser);
            } finally {
              browser.newContext = originalContext;
              for (const restore of [...contexts.values()]) restore();
              await Promise.all([...sessions].map((session) => session.detach().catch(() => {})));
              sessions.clear();
            }
          },
          { scope: "worker" },
        ],
        cpuLoad: [
          async ({}, use, testInfo) => {
            // This fixture has no browser dependency, so Node-only tests still
            // run without launching Chromium when load is enabled.
            testInfo.annotations.push({
              type: "cpu-throttle-requested",
              description: `${rate}× for fixture-created pages`,
            });
            await use();
          },
          { auto: true },
        ],
      });
