// Where the Playground and the site's home page are, for the Tinkerer's Manual's links
// (manual/build-pages.mjs writes them into the pages; tests/man7b.spec.mjs reads them here too).
import { TOYS, holdsStill } from "../src/toys.js";
import { SITE, FRONT_DOOR } from "../tools/site-pages.mjs";

// ---- Where the Playground and the site's home page are --------------------------------------------
// Before the front door swap the Playground is the root (`../`) and the site's home page is site/.
// After it (FRONT_DOOR on) the site's home page is the root and the Playground is playground/.
const ROOT = SITE.origin + SITE.base.replace(/site\/$/, "");
export const HOME_URL = FRONT_DOOR ? ROOT : `${ROOT}site/`;
export const PLAYGROUND_URL = FRONT_DOOR ? `${ROOT}playground/` : ROOT;
export const PLAYGROUND_REL = FRONT_DOOR ? "../playground/" : "../";

// A link that opens a toy in the Playground: a version 3 scene in the plain JSON form (#s=j.…),
// with the toy's own camera and, for a toy that holds still, the turntable off, as the site's
// "Open in Splashery" buttons make them (tools/site-build.mjs). It works whether or not the labs
// switch is on, and the home page after the swap forwards it to playground/.
export function toyHref(id) {
  const t = TOYS.find((x) => x.id === id);
  if (!t) throw new Error(`manual: a link names a toy that does not exist: ${id}`);
  const scene = { app: "splashery", version: 3, toy: { kind: "builtin", id: t.id } };
  if (t.camera) scene.camera = { ...t.camera };
  if (holdsStill(t)) scene.autoplay = { turntable: false, effect: "none" };
  return `${PLAYGROUND_URL}#s=j.${Buffer.from(JSON.stringify(scene)).toString("base64url")}`;
}
