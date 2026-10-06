# laz-perf 0.0.7

A LAZ (compressed LAS) reader by Hobu, Inc., compiled to WebAssembly (Apache License 2.0, `LICENSE`
beside this file), https://github.com/hobuinc/laz-perf, from the npm package `laz-perf@0.0.7`
(`lib/worker/laz-perf.js` and `lib/worker/laz-perf.wasm`). Two comment lines were added at the top
of the JavaScript and one `export default createLazPerf;` line at its end, so it loads as an ES
module; nothing else was changed.

The Point clouds toy (lane Viewers) loads it only when someone opens a .laz file.
