// SPDX-License-Identifier: MIT
// Made by Ryan with Codex (GPT-6). Node-only bounded file wrapper for browser-pure core.
import fs from 'node:fs';
import {demuxAvc,LIMITS,UnsupportedMp4} from './demux.mjs';
export function demuxFile(file){const s=fs.statSync(file);if(!s.isFile()||s.size>LIMITS.fileBytes)throw new UnsupportedMp4('File size outside bounded prototype');return demuxAvc(fs.readFileSync(file));}
