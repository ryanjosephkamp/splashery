// MIT. Outside-worktree fixed-input diagnostic. No runtime edits or parameter updates.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/splashery/node_modules/playwright-core/index.mjs';
import { HEAP_SORT_SRC, comparePairs, segmentCapacity } from './heapsort.mjs';
const root = '/workspace/v3d-r4-media/serial-sort-prototype', out = root + '/gpu-r1', previous = '/workspace/v3d-r4-media/tilegrad-probe-r1', repo = '/workspace/splashery', base = 'http://127.0.0.1:4173/';
const hash = b => createHash('sha256').update(b).digest('hex');
if (fs.existsSync(out)) throw new Error('Fresh output required');
fs.mkdirSync(out);
const config = JSON.parse(fs.readFileSync(previous + '/config.json'));
config.order = ['bitonic', 'heap'];
config.opts.tileGrad = true;
config.sortRepeats = 4;
config.protocol = 'Same saved1000 real seeds and96x54 training image as tileGrad probe. Only tile sorter differs. One cold+3warm sort dispatches per variant; scan/scatter refresh inputs before every dispatch, excluded from isolated sort timers. One forward warmup plus one identical fused render/backward, no chain/Adam/update. Integer-only synthetic fixture separately covers padded tails. Contended diagnostic, not production timing.';
const paramsBytes = fs.readFileSync(previous + '/input-params.f32'), imageBytes = fs.readFileSync(previous + '/input-image.f32');
assert.equal(hash(paramsBytes), '68f036739eb9b3188223f64b5164f14e6aa0cdf595ba13884dcae09ee0ff7608');
assert.equal(hash(imageBytes), 'cace76c4a9dece604c98edd306596896e7dac19b858259dbcf5653dba67d9890');
const asArray = b => Array.from(new Float32Array(b.buffer, b.byteOffset, b.length / 4));
const sourceFiles = ['vendor/splatjs/src/gs/trainer.js', 'vendor/splatjs/src/gs/shaders.js', 'vendor/splatjs/src/sfm/geometry.js', 'vendor/splatjs/src/gpu/context.js'];
async function sources() { const result = []; for (const file of sourceFiles) { const r = await fetch(new URL(file, base), { cache: 'no-store', signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`HTTP${r.status}:${file}`); const b = Buffer.from(await r.arrayBuffer()); assert.deepEqual(b, fs.readFileSync(path.join(repo, file)), 'Served/local source mismatch'); result.push({ file, bytes: b.length, sha256: hash(b) }); } return result; }
const before = await sources();
let randomState = 0xc088face;
const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return randomState >>> 0; };
const counts = [0, 1, 2, 17, 2048, 2049], starts = [0];
for (const count of counts) starts.push(starts.at(-1) + segmentCapacity(count));
const fixtureEntries = Uint32Array.from({ length: 2 * (starts.at(-1) + 13) }, random);
for (let t = 0; t < counts.length; t++) for (let i = 0; i < counts[t]; i++) { fixtureEntries[2 * (starts[t] + i)] = [0, 0x80000000, 0xffffffff, random()][i % 4]; fixtureEntries[2 * (starts[t] + i) + 1] = i % 13 === 0 ? 0xffffffff : random(); }
const fixture = { counts, starts, cursors: counts.map((c, i) => starts[i] + c), entries: Array.from(fixtureEntries), note: 'Pure integer sorter coverage, not additional training data. Includes0/1/2048/2049counts, unsigned keys/ties and13pair suffix canary.' };
const receipt = { created: new Date().toISOString(), status: 'pending', scriptSha256: hash(fs.readFileSync(import.meta.filename)), prototypeSha256: hash(Buffer.from(HEAP_SORT_SRC)), cpuProof: JSON.parse(fs.readFileSync(root + '/cpu-proof.json')), input: { source: previous, paramsSha256: hash(paramsBytes), imageSha256: hash(imageBytes) }, sourceBefore: before, environment: { cpu: os.cpus()[0].model, cpuQuota: fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(), node: process.version, chromiumWrapperSha256: hash(fs.readFileSync('/usr/bin/chromium')) }, variants: [] };
fs.writeFileSync(out + '/config.json', JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(out + '/fixture.json', JSON.stringify(fixture) + '\n', { flag: 'wx' });
fs.writeFileSync(out + '/pre-dispatch-binding.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
let browser, server, expired = false;
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-webgpu-adapter=swiftshader', '--use-vulkan=swiftshader'];
receipt.environment.launchArgs = args;
const timer = setTimeout(() => { expired = true; server?.process()?.kill('SIGKILL'); }, 600000);
try {
  server = await chromium.launchServer({ executablePath: '/usr/bin/chromium', args });
  if (expired) throw new Error('Deadline expired');
  browser = await chromium.connect(server.wsEndpoint());
  receipt.environment.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.route('**/serial-sort-empty.html', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Exact sorting diagnostic</title>' }));
  await page.goto(base + 'serial-sort-empty.html');
  const result = await page.evaluate(async ({ config, params, image, heapSource, fixture }) => {
    const { GSTrainer } = await import('/vendor/splatjs/src/gs/trainer.js'), { SORT_SRC } = await import('/vendor/splatjs/src/gs/shaders.js'), { createGpu } = await import('/vendor/splatjs/src/gpu/context.js');
    const gpu = await createGpu(), d = gpu.device, errors = [], timestamp = d.features.has('timestamp-query'), rows = [], fixtureRows = [];
    d.addEventListener('uncapturederror', e => errors.push(e.error.message));
    const raw = async (buffer, size) => { const rb = d.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), enc = d.createCommandEncoder(); enc.copyBufferToBuffer(buffer, 0, rb, 0, size); d.queue.submit([enc.finish()]); await rb.mapAsync(GPUMapMode.READ); const bytes = new Uint8Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); let bin = ''; for (let k = 0; k < bytes.length; k += 32768) bin += String.fromCharCode(...bytes.subarray(k, k + 32768)); return btoa(bin); };
    const stage = async (name, encode) => { const qs = timestamp ? d.createQuerySet({ type: 'timestamp', count: 2 }) : null, qb = timestamp ? d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null, rb = timestamp ? d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) : null, enc = d.createCommandEncoder(), pass = enc.beginComputePass(qs ? { timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}); encode(pass); pass.end(); if (qs) { enc.resolveQuerySet(qs, 0, 2, qb, 0); enc.copyBufferToBuffer(qb, 0, rb, 0, 16); } const t = performance.now(); d.queue.submit([enc.finish()]); await d.queue.onSubmittedWorkDone(); const wallMs = performance.now() - t; let gpuMs = null; if (rb) { await rb.mapAsync(GPUMapMode.READ); const q = new BigUint64Array(rb.getMappedRange().slice(0)); gpuMs = Number(q[1] - q[0]) / 1e6; rb.unmap(); rb.destroy(); qb.destroy(); qs.destroy(); } return { name, wallMs, gpuMs }; };
    const dispatch = (pipeline, bg, x, y = 1) => p => { p.setPipeline(pipeline); p.setBindGroup(0, bg); p.dispatchWorkgroups(x, y); };
    const sortBindGroup = (pipeline, starts, cursors, entries) => d.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [starts, cursors, entries].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    try {
      // Real cached input: only sorting differs; both use the unchanged tileGrad=true rasterizer.
      for (const variant of config.order) {
        const constructorStart = performance.now(), trainer = new GSTrainer(d, { ...config.opts, gpu }, gpu.info), constructorCpuMs = performance.now() - constructorStart;
        try {
          const setupStart = performance.now();
          trainer.setup({ data: Float32Array.from(params), n: config.n, dc: 'sigmoid' }, [config.camera], [{ tw: config.w, th: config.h, rgb: Float32Array.from(image) }], config.w, config.h, config.radius);
          await d.queue.onSubmittedWorkDone();
          const setupWallMs = performance.now() - setupStart, pipelineStart = performance.now(), pipeline = variant === 'bitonic' ? trainer.pipeSort : d.createComputePipeline({ layout: 'auto', compute: { module: d.createShaderModule({ code: heapSource }), entryPoint: 'main' } }), prototypePipelineCreateCpuMs = performance.now() - pipelineStart;
          const bg = variant === 'bitonic' ? trainer.bgSort : sortBindGroup(pipeline, trainer.bufTileStart, trainer.bufTileCursor, trainer.bufEntries), gx = Math.ceil(config.w / 16), gy = Math.ceil(config.h / 16), nt = trainer.maxTiles, stages = [], sort = [], snapshots = {};
          trainer._writeTrainUniforms(trainer.camUniforms[0]);
          d.queue.writeBuffer(trainer.bufTileCnt, 0, trainer.tileZero);
          stages.push(await stage('project', dispatch(trainer.pipeProject, trainer.bgProjectTrain, Math.ceil(config.n / 256))));
          for (let repeat = 0; repeat < config.sortRepeats; repeat++) {
            stages.push(await stage(`scan-${repeat}`, dispatch(trainer.pipeScan, trainer.bgScanTrain, 1)));
            stages.push(await stage(`scatter-${repeat}`, dispatch(trainer.pipeScatter, trainer.bgScatterTrain, Math.ceil(config.n / 256))));
            if (repeat === 0) snapshots.unsortedEntries = await raw(trainer.bufEntries, config.opts.entriesCap * 8);
            sort.push(await stage(repeat === 0 ? 'sort-cold-dispatch' : `sort-warm-${repeat}`, dispatch(pipeline, bg, gx * gy)));
            if (repeat === 0) snapshots.coldEntries = await raw(trainer.bufEntries, config.opts.entriesCap * 8);
          }
          snapshots.entries = await raw(trainer.bufEntries, config.opts.entriesCap * 8);
          d.queue.writeBuffer(trainer.bufStats, 0, new Uint32Array(4));
          const forward = new Float32Array(trainer.camUniforms[0]); forward[28] = 0;
          trainer._writeTrainUniforms(forward);
          stages.push(await stage('forwardColdPipeline', dispatch(trainer.pipeRender, trainer.bgRenderTrain, gx, gy)));
          trainer._writeTrainUniforms(trainer.camUniforms[0]);
          stages.push(await stage('renderBackwardWarmPipeline', dispatch(trainer.pipeRender, trainer.bgRenderTrain, gx, gy)));
          rows.push({ variant, constructorCpuMs, setupWallMs, prototypePipelineCreateCpuMs, stages, sort, n: trainer.n, cap: trainer.cap, renderFeat: trainer.renderFeat, raw: { ...snapshots, gradP: await raw(trainer.bufGradP, config.n * 16 * 4), out: await raw(trainer.bufOut, config.w * config.h * 4 * 4), stats: await raw(trainer.bufStats, 16), tileStart: await raw(trainer.bufTileStart, (nt + 1) * 4), tileCursor: await raw(trainer.bufTileCursor, nt * 4), params: await raw(trainer.bufParams, config.n * 16 * 4) } });
        } finally { trainer.dispose(); }
      }
      // Tiny integer-only fixture independently exercises the actual large padded GPU path.
      for (const variant of config.order) {
        const resources = [], make = array => { const a = Uint32Array.from(array), b = d.createBuffer({ size: a.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC }); resources.push(b); d.queue.writeBuffer(b, 0, a); return b; };
        try {
          const starts = make(fixture.starts), cursors = make(fixture.cursors), entries = make(fixture.entries), pipeline = d.createComputePipeline({ layout: 'auto', compute: { module: d.createShaderModule({ code: variant === 'bitonic' ? SORT_SRC : heapSource }), entryPoint: 'main' } }), bg = sortBindGroup(pipeline, starts, cursors, entries);
          const timing = await stage('integer-fixture-sort', dispatch(pipeline, bg, fixture.counts.length));
          fixtureRows.push({ variant, timing, raw: { entries: await raw(entries, fixture.entries.length * 4) } });
        } finally { for (const b of resources) b.destroy(); }
      }
      await d.queue.onSubmittedWorkDone();
      return { rows, fixtureRows, errors, adapter: { vendor: gpu.info.vendor, architecture: gpu.info.architecture, description: gpu.info.description }, timestamp };
    } finally { gpu.dispose(); }
  }, { config, params: asArray(paramsBytes), image: asArray(imageBytes), heapSource: HEAP_SORT_SRC, fixture });
  if (expired) throw new Error('Host deadline expired');
  assert.deepEqual(result.errors, []); assert.deepEqual(pageErrors, []);
  receipt.adapter = result.adapter; receipt.timestampQuery = result.timestamp;
  function saveRows(rows, prefix = '') { return rows.map(row => { const files = []; for (const [kind, base64] of Object.entries(row.raw)) { const bytes = Buffer.from(base64, 'base64'), file = `${prefix}${row.variant}-${kind}.bin`; fs.writeFileSync(out + '/' + file, bytes, { flag: 'wx' }); files.push({ kind, file, bytes: bytes.length, sha256: hash(bytes) }); } return { ...row, raw: undefined, files }; }); }
  receipt.variants = saveRows(result.rows); receipt.fixtureVariants = saveRows(result.fixtureRows, 'fixture-');
  const get = (variant, kind, prefix = '') => fs.readFileSync(`${out}/${prefix}${variant}-${kind}.bin`), u32 = b => new Uint32Array(b.buffer, b.byteOffset, b.length / 4);
  receipt.parity = {};
  for (const kind of ['entries', 'coldEntries', 'gradP', 'out', 'stats', 'tileStart', 'tileCursor', 'params']) { const a = get('bitonic', kind), b = get('heap', kind); receipt.parity[kind] = { byteExact: a.equals(b), bytes: a.length }; assert(a.equals(b), `GPU variant mismatch: ${kind}`); }
  receipt.parity.fixture = { byteExact: get('bitonic', 'entries', 'fixture-').equals(get('heap', 'entries', 'fixture-')) };
  assert(receipt.parity.fixture.byteExact, 'GPU padded fixture mismatch');
  const verify = (initial, actual, counts, starts) => { const expected = initial.slice(); for (let t = 0; t < counts.length; t++) { const pairs = Array.from({ length: counts[t] }, (_, i) => [initial[2 * (starts[t] + i)], initial[2 * (starts[t] + i) + 1]]).sort(comparePairs); for (let i = 0; i < pairs.length; i++) expected.set(pairs[i], 2 * (starts[t] + i)); if (counts[t] > 2048) expected.fill(0xffffffff, 2 * (starts[t] + counts[t]), 2 * starts[t + 1]); } assert.deepEqual(actual, expected, 'GPU vs independent JS sort/padding/canaries mismatch'); };
  for (const variant of config.order) { const starts = Array.from(u32(get(variant, 'tileStart'))), cursors = Array.from(u32(get(variant, 'tileCursor'))), counts = cursors.map((v, i) => v - starts[i]); for (const kind of ['entries', 'coldEntries']) verify(u32(get(variant, 'unsortedEntries')), u32(get(variant, kind)), counts, starts); verify(fixtureEntries, u32(get(variant, 'entries', 'fixture-')), fixture.counts, fixture.starts); }
  receipt.independentJsOracle = { realColdAndWarm: true, fixturePaddedTailAndCanary: true };
  receipt.realTileCounts = Array.from(u32(get('bitonic', 'tileCursor')), (v, i) => v - u32(get('bitonic', 'tileStart'))[i]);
  receipt.stats = Array.from(u32(get('bitonic', 'stats')));
  receipt.sourceAfter = await sources(); assert.deepEqual(receipt.sourceAfter, before, 'Source changed during probe');
  receipt.status = 'diagnostic-complete';
} catch (error) { receipt.status = 'diagnostic-error'; receipt.reason = String(error.stack || error); process.exitCode = 1; }
finally { clearTimeout(timer); await browser?.close().catch(() => {}); if (server) { await Promise.race([server.close().catch(() => {}), new Promise(r => setTimeout(r, 1000))]); server.process()?.kill('SIGKILL'); } fs.writeFileSync(out + '/receipt.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); }
console.log(JSON.stringify({ ...receipt, sourceBefore: undefined, sourceAfter: undefined, cpuProof: undefined }, null, 2));
