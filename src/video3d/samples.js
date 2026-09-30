// Video to 3D (lane Video 3D): the sample scenes, each trained from a CC BY video by
// tools/v3d-sample.mjs (assets/toys/video-3d/<id>.ply and <id>.json): the trained splats and the
// solved camera path. The videos themselves are not shipped. Credits are in CREDITS.md and
// tools/assets.json too; each license was checked on its live Wikimedia Commons page on September
// 30, 2026.

const CC_BY_3 = {
  license: "CC BY 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
};

export const SAMPLES = [
  {
    id: "liberty",
    label: "Statue, flown around",
    title: "Statue Of Liberty 4k Drone (20 s from 3:18)",
    author: "the Dronalist",
    source: "https://commons.wikimedia.org/wiki/File:Statue_Of_Liberty_4k_Drone.webm",
    ...CC_BY_3,
  },
  {
    id: "edinburgh",
    label: "Street, walked",
    title: "Walking in EDINBURGH - Scotland (UK) - 4K 60fps (UHD) (15 s from 7:32)",
    author: "POPtravel",
    source:
      "https://commons.wikimedia.org/wiki/File:Walking_in_EDINBURGH_-_Scotland_(UK)_-_4K_60fps_(UHD).webm",
    ...CC_BY_3,
  },
  {
    id: "nicosia",
    label: "City, by drone",
    title: "Central Nicosia drone footage overlooking UN buffer zone (12 s from 0:45)",
    author: "The Track Record - BTS",
    source:
      "https://commons.wikimedia.org/wiki/File:Central_Nicosia_drone_footage_overlooking_UN_buffer_zone.webm",
    ...CC_BY_3,
  },
];
