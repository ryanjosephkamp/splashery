// MIT. Made by Ryan with Codex (GPT-6). Matching math stays in the vendored SIFT module.
import { matchSift } from "../../vendor/splatjs/src/sfm/sift.js";
import { verifyPair } from "./graph.js";

self.onmessage = ({ data }) => {
  const { i, j, a, b, ka, kb } = data;
  const features = [],
    calibration = [];
  features[i] = a;
  features[j] = b;
  calibration[i] = ka;
  calibration[j] = kb;
  const raw = matchSift(a.desc, a.n, b.desc, b.n, 0.8);
  self.postMessage(verifyPair(i, j, raw, features, calibration));
};
