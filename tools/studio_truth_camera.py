"""MIT. Pixel-center, optical-axis depth contract shared by build-time tools.

World: Blender's right-handed Z-up meters. Camera: +X right, +Y down,
+Z forward (right-handed). K maps camera coordinates to pixel boundary
coordinates: the top-left pixel center is (.5, .5). No lens distortion.
"""

import gzip
import numpy as np


def rays(k, c2w, width, height):
    k, c2w = np.asarray(k), np.asarray(c2w)
    x, y = np.meshgrid(np.arange(width) + .5, np.arange(height) + .5)
    local = np.stack(((x-k[0, 2])/k[0, 0], (y-k[1, 2])/k[1, 1], np.ones_like(x)), axis=-1)
    local /= np.linalg.norm(local, axis=-1, keepdims=True)
    return local @ c2w[:3, :3].T


def project(points, k, w2c):
    k, w2c = np.asarray(k), np.asarray(w2c)
    local = np.asarray(points) @ w2c[:3, :3].T + w2c[:3, 3]
    z = local[..., 2]
    uv = local[..., :2] / z[..., None]
    uv = uv * [k[0, 0], k[1, 1]] + [k[0, 2], k[1, 2]]
    return uv, z


def write_depth(path, values):
    # Raw top-to-bottom, row-major IEEE-754 float32 LE; NaN for no hit.
    # A fixed gzip timestamp makes identical numeric arrays byte-identical.
    path.write_bytes(gzip.compress(np.asarray(values, dtype='<f4').tobytes(), mtime=0))


def read_depth(path, width, height):
    data = gzip.decompress(path.read_bytes())
    if len(data) != width*height*4:
        raise ValueError('Depth dimensions do not match payload')
    return np.frombuffer(data, dtype='<f4').reshape(height, width)
