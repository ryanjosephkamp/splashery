// Moving photo's existing solid cut geometry, compiled without a runtime.
// All intermediate arithmetic is double, as in JavaScript; stored fields are
// Float32. No fast math or fused operations: the reference fields stay exact.
typedef unsigned char u8;
typedef unsigned int u32;
static double min(double a, double b) { return a < b ? a : b; }
static double max(double a, double b) { return a > b ? a : b; }
static double absd(double a) { return a < 0 ? -a : a; }
static int imin(int a, int b) { return a < b ? a : b; }
static int imax(int a, int b) { return a > b ? a : b; }
static double sample(const u8 *__restrict src, int w, int h, double u, double v) {
  double x = max(0, min(w - 1, u * w - 0.5));
  double y = max(0, min(h - 1, v * h - 0.5));
  int i = (int)x, j = (int)y;
  double fx = x - i, fy = y - j;
  int a = j * w + i, b = j * w + imin(w - 1, i + 1);
  int c = imin(h - 1, j + 1) * w + i;
  int d = imin(h - 1, j + 1) * w + imin(w - 1, i + 1);
  return ((src[a] * (1 - fx) + src[b] * fx) * (1 - fy) +
    (src[c] * (1 - fx) + src[d] * fx) * fy) / 255;
}
static double smooth(double v) {
  double t = max(0, min(1, (v - 2) / 4));
  return t * t * (3 - 2 * t);
}
static double soften(const u8 *__restrict src, int w, int h, double u, double v, double aspect) {
  double sum = 0;
  for (int j = -2; j <= 2; j++)
    for (int k = -2; k <= 2; k++) sum += sample(src, w, h, u + k * 0.02 * aspect, v + j * 0.02);
  return sum / 25;
}
static double slope(double lo, double center, double hi, double cut) {
  int a = absd(lo - center) <= cut, b = absd(hi - center) <= cut;
  return a && b ? (hi - lo) / 2 : a ? center - lo : b ? hi - center : 0;
}
static void line(const float *__restrict input, float *__restrict output, int offset, int stride,
                 int n, int radius, int maximum, int *__restrict queue) {
  int head = 0, tail = 0, next = 0;
  for (int x = 0; x < n; x++) {
    int right = imin(n - 1, x + radius);
    while (next <= right) {
      float v = input[offset + next * stride];
      while (tail > head && (maximum ? input[offset + queue[tail - 1] * stride] <= v
                                    : input[offset + queue[tail - 1] * stride] >= v)) tail--;
      queue[tail++] = next++;
    }
    while (queue[head] < x - radius) head++;
    output[offset + x * stride] = input[offset + queue[head] * stride];
  }
}

static void axis(double *__restrict out, int count, int size, int grid, int radius, double step) {
  for (int i = 0; i < count; i++) for (int k = -radius; k <= radius; k++) {
    double u = grid ? (double)(float)((double)i / (count - 1)) : (i + 0.5) / count;
    double p = max(0, min(size - 1, (u + k * step) * size - 0.5));
    int lo = (int)p, at = (i * (radius * 2 + 1) + k + radius) * 3;
    out[at] = lo; out[at + 1] = imin(size - 1, lo + 1); out[at + 2] = p - lo;
  }
}
__attribute__((export_name("maps")))
void maps(int w, int h, int cols, int rows, double aspect,
          double *__restrict edgeX, double *__restrict edgeY, double *__restrict borderX, double *__restrict borderY,
          double *__restrict pixelX, double *__restrict pixelY) {
  axis(edgeX, cols + 1, w, 1, 1, 1.0 / cols);
  axis(edgeY, rows + 1, h, 1, 1, 1.0 / rows);
  axis(borderX, cols + 1, w, 1, 2, 0.02 * aspect);
  axis(borderY, rows + 1, h, 1, 2, 0.02);
  axis(pixelX, w, w, 0, 2, 0.02 * aspect);
  axis(pixelY, h, h, 0, 2, 0.02);
}
static double mapped(const u8 *__restrict src, int w, const double *__restrict x, const double *__restrict y) {
  int a = (int)y[0] * w, b = (int)y[1] * w;
  int lo = (int)x[0], hi = (int)x[1];
  double fx = x[2], fy = y[2];
  return ((src[a + lo] * (1 - fx) + src[a + hi] * fx) * (1 - fy) +
          (src[b + lo] * (1 - fx) + src[b + hi] * fx) * fy) / 255;
}
static double mappedSoft(const u8 *__restrict src, int w, const double *__restrict xs, const double *__restrict ys) {
  double sum = 0;
  for (int j = 0; j < 5; j++) for (int k = 0; k < 5; k++) sum += mapped(src, w, xs + k * 3, ys + j * 3);
  return sum / 25;
}

__attribute__((export_name("geometry")))
int geometry(int w, int h, int cols, int rows, int preview, double aspect,
             const u8 *__restrict src, float *__restrict heights, float *__restrict patches, float *__restrict floors,
             float *__restrict corners, float *__restrict soft, float *__restrict ids, float *__restrict rowLow,
             float *__restrict rowHigh, float *__restrict low, float *__restrict high, int *__restrict queue,
             const double *__restrict edgeX, const double *__restrict edgeY, const double *__restrict borderX, const double *__restrict borderY,
             const double *__restrict pixelX, const double *__restrict pixelY) {
  for (int y = 0; y <= rows; y++)
    for (int x = 0; x <= cols; x++) {
      double rd = imin(imin(x, y), imin(cols - x, rows - y));
      if (!preview && rd > 6) continue;
      double u = (float)((double)x / cols), v = (float)((double)y / rows);
      double raw = mapped(src, w, edgeX + x * 9 + 3, edgeY + y * 9 + 3), d = raw, edge = 0;
      if (rd <= 6) {
        double weight = smooth(rd);
        d = mappedSoft(src, w, borderX + x * 15, borderY + y * 15) * (1 - weight) + raw * weight;
      } else {
        for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++)
          edge = max(edge, absd(mapped(src, w, edgeX + x * 9 + (k + 1) * 3, edgeY + y * 9 + (j + 1) * 3) - raw));
      }
      int at = (y * (cols + 1) + x) * 4;
      soft[at] = d; soft[at + 1] = raw; soft[at + 2] = edge;
    }
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) {
      int i = y * w + x;
      double u = (x + 0.5) / w, v = (y + 0.5) / h;
      double rd = min(min(u * cols, (1 - u) * cols), min(v * rows, (1 - v) * rows));
      double d = src[i] / 255.0;
      if (rd < 6) {
        double weight = smooth(rd);
        d = mappedSoft(src, w, pixelX + x * 15, pixelY + y * 15) * (1 - weight) + d * weight;
      }
      heights[i] = d;
    }
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) {
      int i = y * w + x, at = i * 4;
      double d = heights[i];
      double gx = slope(heights[y * w + imax(0, x - 1)], d,
                         heights[y * w + imin(w - 1, x + 1)], (0.05 * cols) / w);
      double gy = slope(heights[imax(0, y - 1) * w + x], d,
                         heights[imin(h - 1, y + 1) * w + x], (0.05 * rows) / h);
      double extent = (absd(gx) + absd(gy)) / 2;
      double scale = extent > 0 ? min(1, min(d, 1 - d) / extent) : 1;
      patches[at] = d; patches[at + 1] = gx * scale;
      patches[at + 2] = gy * scale; patches[at + 3] = src[i] / 255.0;
    }
  for (int y = 0; y <= h; y++)
    for (int x = 0; x <= w; x++) {
      double bottom = 1;
      for (int dy = -1; dy <= 0; dy++) for (int dx = -1; dx <= 0; dx++) {
        int cx = imax(0, imin(w - 1, x + dx)), cy = imax(0, imin(h - 1, y + dy));
        int at = (cy * w + cx) * 4;
        double depth = patches[at] + (double)patches[at + 1] * (x - cx - 0.5) +
                                     (double)patches[at + 2] * (y - cy - 0.5);
        bottom = min(bottom, depth);
      }
      corners[y * (w + 1) + x] = bottom;
    }
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
    int at = (y * w + x) * 4, corner = y * (w + 1) + x;
    floors[at] = corners[corner]; floors[at + 1] = corners[corner + 1];
    floors[at + 2] = corners[corner + w + 1]; floors[at + 3] = corners[corner + w + 2];
  }
  double rx = (double)w / cols, ry = (double)h / rows, ratio = max(rx, ry);
  int radius = (int)__builtin_ceil(2 * ratio) + 1;
  int border = (int)__builtin_ceil(8 * ratio);
  double pad = imax(w, h) * 0x1p-22;
  int spanX = (int)__builtin_ceil(rx + pad) + 1, spanY = (int)__builtin_ceil(ry + pad) + 1;
  double gridError = imax(cols, rows) * 0x1p-23, slopeScale = 1 / (1 - gridError);
  for (int y = 0; y < h; y++) {
    line(heights, rowLow, y * w, 1, w, radius, 0, queue);
    line(heights, rowHigh, y * w, 1, w, radius, 1, queue);
  }
  for (int x = 0; x < w; x++) {
    line(rowLow, low, x, w, h, radius, 0, queue);
    line(rowHigh, high, x, w, h, radius, 1, queue);
  }
  int count = 0;
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
    int i = y * w + x;
    if (imin(imin(x, y), imin(w - 1 - x, h - 1 - y)) <= border || high[i] - (double)low[i] > 0.05 / 2)
      ids[count++] = i;
  }
  int candidates = count;
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
    int i = y * w + x;
    low[i] = absd((double)heights[y * w + imin(w - 1, x + 1)] - heights[i]);
    high[i] = absd((double)heights[imin(h - 1, y + 1) * w + x] - heights[i]);
  }
  for (int y = 0; y < h; y++) {
    line(low, rowLow, y * w, 1, w, radius, 1, queue);
    line(high, rowHigh, y * w, 1, w, radius, 1, queue);
  }
  for (int x = 0; x < w; x++) {
    line(rowLow, low, x, w, h, radius, 1, queue);
    line(rowHigh, high, x, w, h, radius, 1, queue);
  }
  count = 0;
  for (int candidate = 0; candidate < candidates; candidate++) {
    int i = ids[candidate], x = i % w, y = i / w;
    int cut = slopeScale * (spanX * (double)low[i] + spanY * (double)high[i]) > 0.05 - 1e-5;
    if (imin(imin(x, y), imin(w - 1 - x, h - 1 - y)) <= border || cut) ids[count++] = i;
  }
  return count;
}

// The JavaScript conservative pixel-center bounds, with identical double
// operations and in-place compaction. No geometric or depth value changes.
static const int face_corners[6][8] = {
  {0,0,1,0,0,1,1,1}, {0,0,0,1,0,0,0,1},
  {1,0,1,1,1,0,1,1}, {0,0,1,0,0,0,1,0},
  {0,1,1,1,0,1,1,1}, {0,0,1,0,0,1,1,1}
};
__attribute__((export_name("raster")))
int raster(int count, int w, int h, float *__restrict planes, const double *__restrict m, const double *__restrict e,
           double width, double height, double quantum) {
  int bits = 0;
  while ((1u << bits) < (u32)w) bits++;
  u32 mask = (1u << bits) - 1;
  int kept = 0;
  for (int i = 0; i < count; i++) {
    int at = i * 8;
    union { float f; u32 u; } code = { .f = planes[at + 3] };
    int face = (code.u >> 24) & 7, cx = code.u & mask, cy = (code.u & 16777215u) >> bits;
    int keep = cx == 0 || cx == w - 1 || cy == 0 || cy == h - 1;
    if (!keep) {
      double xmin = __builtin_inf(), xmax = -__builtin_inf();
      double ymin = __builtin_inf(), ymax = -__builtin_inf();
      for (int k = 0; k < 4; k++) {
        int dx = face_corners[face][k * 2], dy = face_corners[face][k * 2 + 1];
        double x = cx + dx, y = cy + dy;
        double d = face == 5 || (face > 0 && k >= 2) ? planes[at + 4 + dy * 2 + dx]
          : planes[at] + (double)planes[at + 1] * (dx - .5) + (double)planes[at + 2] * (dy - .5);
        double cw = m[3] * x + m[7] * y + m[11] * d + m[15];
        if (cw <= 2 * e[3] + 1e-3) { keep = 1; break; }
        double px = (m[0] * x + m[4] * y + m[8] * d + m[12]) / cw;
        double py = (m[1] * x + m[5] * y + m[9] * d + m[13]) / cw;
        double ex = (e[0] + absd(px) * e[3]) / (cw - e[3]);
        double ey = (e[1] + absd(py) * e[3]) / (cw - e[3]);
        xmin = min(xmin, (px - ex + 1) * width / 2);
        xmax = max(xmax, (px + ex + 1) * width / 2);
        ymin = min(ymin, (py - ey + 1) * height / 2);
        ymax = max(ymax, (py + ey + 1) * height / 2);
      }
      keep = keep || (__builtin_ceil(xmin - quantum - .5) <= __builtin_floor(xmax + quantum - .5) &&
                      __builtin_ceil(ymin - quantum - .5) <= __builtin_floor(ymax + quantum - .5));
    }
    if (keep) {
      for (int j = 0; j < 8; j++) planes[kept * 8 + j] = planes[at + j];
      kept++;
    }
  }
  return kept;
}
