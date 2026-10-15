#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Training-only, fixed-parameter CPU diagnostic."""
import hashlib
import json
import subprocess
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT.parent
PARAM = json.loads((ROOT / 'parameters-before.json').read_text())

def sha(data):
    return hashlib.sha256(data).hexdigest()

def weighted_median(values, weights):
    result = []
    for axis in range(3):
        order = np.argsort(values[:, axis], kind='stable')
        index = np.searchsorted(np.cumsum(weights[order]), weights.sum() * .5, side='left')
        result.append(values[order[min(index, len(order)-1)], axis])
    return np.asarray(result)

def summarize(frame, index):
    height, width, _ = frame.shape
    side = PARAM['tileSide']
    rows = []
    for y in range(0, height, side):
        for x in range(0, width, side):
            tile = frame[y:y+side, x:x+side]
            valid = np.isfinite(tile).all() and (tile >= 0).all() and (tile <= 1).all()
            med = np.median(tile.reshape(-1, 3), axis=0)
            deviation = float(np.quantile(np.max(abs(tile-med), axis=2), .9))
            adjacent = []
            if tile.shape[1] > 1:
                adjacent.append(np.max(abs(tile[:, 1:]-tile[:, :-1]), axis=2).ravel())
            if tile.shape[0] > 1:
                adjacent.append(np.max(abs(tile[1:]-tile[:-1]), axis=2).ravel())
            gradient = float(np.concatenate(adjacent).mean()) if adjacent else 0
            low = valid and deviation <= PARAM['localDeviationP90Max'] and gradient <= PARAM['adjacentMeanLinfMax']
            rows.append(dict(index=index, x=x, y=y, w=tile.shape[1], h=tile.shape[0],
                             area=tile.shape[0]*tile.shape[1], med=med, low=bool(low),
                             deviation=deviation, gradient=gradient))
    return rows

def fit_mode(tiles):
    selected = [t for t in tiles if t['low']]
    if not selected:
        return None
    values = np.asarray([t['med'] for t in selected])
    weights = np.asarray([t['area'] for t in selected])
    grid = PARAM['candidateGrid']
    centers = (np.unique(np.minimum(grid-1, np.floor(values*grid)).astype(int), axis=0)+.5)/grid
    best_area, best = -1, None
    for center in centers:
        member = np.max(abs(values-center), axis=1) <= PARAM['modeLinfRadius']
        area = int(weights[member].sum())
        if area > best_area:
            best_area, best = area, member
    if best is None or not best.any():
        return None
    return weighted_median(values[best], weights[best])

def frame_stats(frame, rows, color):
    height, width, _ = frame.shape
    mask = np.zeros((height, width), dtype=bool)
    low_mask = mask.copy()
    for tile in rows:
        region = np.s_[tile['y']:tile['y']+tile['h'], tile['x']:tile['x']+tile['w']]
        low_mask[region] = tile['low']
        if tile['low'] and np.max(abs(tile['med']-color)) <= PARAM['modeLinfRadius']:
            mask[region] = True
    edge = [float(mask[0].mean()), float(mask[-1].mean()), float(mask[:, 0].mean()), float(mask[:, -1].mean())]
    residual = np.max(abs(frame[mask]-color), axis=1)
    return dict(lowTextureArea=float(low_mask.mean()), supportArea=float(mask.mean()),
                edgeSupport=dict(zip(['top', 'bottom', 'left', 'right'], edge)),
                supportedEdges=sum(x >= PARAM['edgeSupportMinFraction'] for x in edge),
                pixelResidualP50=float(np.quantile(residual, .5)) if len(residual) else None,
                pixelResidualP90=float(np.quantile(residual, .9)) if len(residual) else None,
                framePass=bool(mask.mean() >= PARAM['supportMinAreaFraction'] and sum(x >= PARAM['edgeSupportMinFraction'] for x in edge) >= PARAM['edgeCountMin'])), mask, low_mask, residual

def evaluate(label, frames, provenance, credit):
    start = time.perf_counter()
    # Do not inspect/sample frame8, including for diagnostic thumbnails/statistics.
    available = sorted(set(PARAM['fitIndices']+PARAM['validationIndices']))
    tiles = {i:summarize(frames[i], i) for i in available}
    fit_tiles = [t for i in PARAM['fitIndices'] for t in tiles[i]]
    color = fit_mode(fit_tiles)
    validation_color = fit_mode([t for i in PARAM['validationIndices'] for t in tiles[i]])
    if color is None:
        return dict(label=label, accepted=False, reason='No low-texture candidate', provenance=provenance, credit=credit,
                    lowTextureByFrame=[dict(index=i, split='fit' if i in PARAM['fitIndices'] else 'validation',
                       area=sum(t['area'] for t in tiles[i] if t['low'])/(frames[i].shape[0]*frames[i].shape[1])) for i in available],
                    cpuSeconds=time.perf_counter()-start)
    rows, masks, residuals = [], {}, []
    for i in available:
        row, mask, low, residual = frame_stats(frames[i], tiles[i], color)
        row.update(index=i, split='fit' if i in PARAM['fitIndices'] else 'validation')
        rows.append(row); masks[i]=(mask, low); residuals.append(residual)
    split = {}
    for name, indices in [('fit', PARAM['fitIndices']), ('validation', PARAM['validationIndices'])]:
        selected = [r for r in rows if r['index'] in indices]
        split[name] = dict(frames=len(selected), passing=sum(r['framePass'] for r in selected),
                           passFraction=sum(r['framePass'] for r in selected)/len(selected),
                           supportMin=min(r['supportArea'] for r in selected),
                           supportMedian=float(np.median([r['supportArea'] for r in selected])),
                           supportMax=max(r['supportArea'] for r in selected))
    drift = float(np.max(abs(color-validation_color))) if validation_color is not None else None
    combined = np.concatenate(residuals)
    p90 = float(np.quantile(combined, .9)) if len(combined) else None
    gates = dict(fit=split['fit']['passFraction'] >= PARAM['fitAndValidationFramePassMinFraction'],
                 validation=split['validation']['passFraction'] >= PARAM['fitAndValidationFramePassMinFraction'],
                 colorDrift=drift is not None and drift <= PARAM['crossSplitColorLinfMax'],
                 supportedPixelResidual=p90 is not None and p90 <= PARAM['supportedPixelResidualP90LinfMax'])
    # Training-only MSE of the constant is descriptive, not a render metric or a scored image.
    pixel_chunks = []
    for i in available:
        pixels = frames[i].reshape(-1, 3)
        pixel_chunks.append(pixels[np.isfinite(pixels).all(axis=1) & (pixels >= 0).all(axis=1) & (pixels <= 1).all(axis=1)])
    pixels = np.concatenate(pixel_chunks)
    result = dict(label=label, accepted=all(gates.values()), gates=gates,
                  color=color.tolist(), rgb255=(color*255).tolist(),
                  validationColor=validation_color.tolist() if validation_color is not None else None,
                  crossSplitColorLinf=drift, supportedPixelResidualP90=p90,
                  split=split, frames=rows,
                  allTrainingConstantMSE=float(np.square(pixels-color).mean()),
                  allTrainingBlackMSE=float(np.square(pixels).mean()),
                  allTrainingRGBP05P50P95=np.quantile(pixels, [.05, .5, .95], axis=0).tolist(),
                  cpuSeconds=time.perf_counter()-start, provenance=provenance, credit=credit,
                  interpretation='Only a dominant low-texture appearance prior; neither far-depth evidence nor object/foreground segmentation. Gate unchanged even if rejected. No render/heldout scores computed.')
    # Annotated TRAINING-only support maps; not an altered model, evaluation, or video.
    show = [0, 5, 10, 15]
    sheet = Image.new('RGB', (3*320, len(show)*(180+26)), (245,245,245))
    draw = ImageDraw.Draw(sheet)
    for row, i in enumerate(show):
        rgb = np.clip(frames[i]*255, 0, 255).astype(np.uint8)
        mask, low = masks[i]
        visuals = [rgb, np.repeat((low.astype(np.uint8)*255)[...,None], 3, axis=2),
                   np.repeat((mask.astype(np.uint8)*255)[...,None], 3, axis=2)]
        for col, visual in enumerate(visuals):
            image = Image.fromarray(visual).resize((320,180))
            sheet.paste(image, (col*320, row*206+26))
            draw.text((col*320+3,row*206+5), f'{label}: training {i} / '+['RGB','low texture','one-color support'][col], fill=(0,0,0))
    sheet.save(ROOT/f'{label}-training-support.png')
    return result

def dianthus_frames():
    metadata_path = MEDIA/'candidate-r8-phone/dianthus-phone/model.json'
    metadata_bytes = metadata_path.read_bytes()
    # Only the selected training-image times/dimensions; never evaluation.json or reference PNGs.
    training = json.loads(metadata_bytes)['observed']['trainingFrames']
    video = MEDIA/'corpus/dianthus.mp4'
    ffprobe = ['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(video)]
    pts = [float(row['best_effort_timestamp_time']) for row in json.loads(subprocess.check_output(ffprobe))['frames']]
    indices = [min(range(len(pts)), key=lambda k:abs(pts[k]-row['presentedTime'])) for row in training]
    use = sorted(set(PARAM['fitIndices']+PARAM['validationIndices']))
    wanted = [indices[i] for i in use]
    select = '+'.join(f'eq(n\\,{i})' for i in wanted)
    command = ['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(video),'-vf',f'select={select},scale=320:180:flags=bicubic',
               '-fps_mode','vfr','-pix_fmt','rgb24','-f','rawvideo','-threads','1','pipe:1']
    raw = subprocess.check_output(command)
    decoded = np.frombuffer(raw,dtype=np.uint8).reshape(len(use),180,320,3).astype(np.float32)/255
    frames = {i:frame for i,frame in zip(use,decoded)}
    (ROOT/'dianthus-training-approx.rgb24').write_bytes(raw)
    return frames, dict(kind='Approximate CPU source-frame decode at observed production training indices; NOT original JPEG/canvas/undistortion byte parity',
                        metadata=str(metadata_path), metadataSHA256=sha(metadata_bytes), input=str(video), inputSHA256=sha(video.read_bytes()),
                        sourceFrameIndicesByInput=indices, usedInputIndices=use,
                        maximumPTSDifference=max(abs(pts[indices[i]]-training[i]['presentedTime']) for i in use),
                        rawRGBSHA256=sha(raw), ffmpegCommand=command,
                        limitations='No browser canvas JPEG roundtrip; ffmpeg bicubic scaling differs. No undistortion reproduced. Only gross heterogeneity control, not production confidence evidence.')

def main():
    start=time.perf_counter()
    cache=MEDIA/'seed-probe.json'; raw=cache.read_bytes()
    assert sha(raw)=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f'
    data=json.loads(raw)
    use=sorted(set(PARAM['fitIndices']+PARAM['validationIndices']))
    frames={i:np.asarray(data['frames'][i]['rgb'],dtype=np.float32).reshape(data['frames'][i]['th'],data['frames'][i]['tw'],3) for i in use}
    manifest=json.loads((MEDIA/'corpus-manifest.json').read_text())
    credits={r['id']:{k:r[k] for k in ['id','source','license','licenseUrl','author','sha256','transformation']} for r in manifest if r['id'] in ['chameleon-flowers','dianthus']}
    rows=[evaluate('chameleon-flowers',frames,dict(kind='Cached real production Session RGB, prior standalone probe (older extraction/solve than R9)',
                 path=str(cache),sha256=sha(raw),cachedPoints=data['points'],cachedCameras=data['cameras'],excludedInternalHoldout=8),credits['chameleon-flowers'])]
    frames,provenance=dianthus_frames()
    rows.append(evaluate('dianthus',frames,provenance,credits['dianthus']))
    result=dict(parameters=PARAM,parameterSHA256=sha((ROOT/'parameters-before.json').read_bytes()),codeSHA256=sha(Path(__file__).read_bytes()),
                rows=rows,totalCPUWallSeconds=time.perf_counter()-start,noHeldoutReads='No heldout images/reference PNGs read. Frame8 excluded throughout. No source/render crop or image alignment.',
                purpose='Supplementary training-only background-color feasibility; no training, rendered quality, timing acceptance, depth, or runtime integration claim.')
    (ROOT/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'results':[{field:r[field] for field in ['label','accepted','reason','color','rgb255','split','gates','crossSplitColorLinf','supportedPixelResidualP90','cpuSeconds','lowTextureByFrame'] if field in r} for r in rows]},indent=2))

if __name__=='__main__':
    main()
