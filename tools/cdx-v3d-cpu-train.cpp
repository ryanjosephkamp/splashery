// MIT. Made by Ryan with Codex (GPT-6). Build-only Gaussian fitting, never
// shipped to the page. Sorted front-to-back alpha compositing, exact
// color/opacity/conic derivatives, perspective covariance chain to position and
// log scales, plus optional quaternion updates. Training
// uses full-resolution images and excludes the frozen evaluation cameras.
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <numeric>
#include <omp.h>
#include <random>
#include <string>
#include <vector>
using namespace std;
constexpr int TILE = 16, P = 14;
constexpr float DILATE = .1f;
float AMIN = .0039f, ECUT = 4.5f;
bool OPTROT = false;
int parameterSlot(int k) { return k < 6 ? k : k < 10 ? k + 4 : k - 4; }
struct G {
  array<float, 16> v;
  array<float, P> m{}, s{};
  float detail = 0;
  int birth = 0;
};
struct Cam {
  float R[9], t[3], fx, fy, cx, cy;
  uint32_t w, h, held;
  vector<uint8_t> rgb;
};
struct Pr {
  float x, y, z, A, B, C, a, b, c, J[6], axis[9], ray[3], sd[3];
  int x0, x1, y0, y1;
  bool valid = false;
};
float sig(float v) { return 1.f / (1.f + expf(-v)); }
float logit(float v) {
  v = clamp(v, 1e-6f, 1.f - 1e-6f);
  return logf(v / (1 - v));
}
template <class T> void get(ifstream &f, T &v) {
  f.read(reinterpret_cast<char *>(&v), sizeof(v));
  if (!f)
    throw runtime_error("truncated input");
}
void axes(const G &g, float *out) {
  float w = g.v[6], x = g.v[7], y = g.v[8], z = g.v[9],
        d = 1.f / sqrtf(w * w + x * x + y * y + z * z);
  w *= d;
  x *= d;
  y *= d;
  z *= d;
  float r[9] = {1 - 2 * (y * y + z * z), 2 * (x * y - w * z),
                2 * (x * z + w * y),     2 * (x * y + w * z),
                1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
                2 * (x * z - w * y),     2 * (y * z + w * x),
                1 - 2 * (x * x + y * y)};
  for (int k = 0; k < 3; k++)
    for (int j = 0; j < 3; j++)
      out[k * 3 + j] = r[j * 3 + k] * expf(g.v[k + 3]);
}
Pr project(const G &g, const Cam &c) {
  Pr p;
  float v[3];
  for (int j = 0; j < 3; j++)
    v[j] = c.t[j] + c.R[j * 3] * g.v[0] + c.R[j * 3 + 1] * g.v[1] +
           c.R[j * 3 + 2] * g.v[2];
  if (v[2] <= .01f)
    return p;
  p.z = v[2];
  p.ray[0] = v[0];
  p.ray[1] = v[1];
  p.ray[2] = v[2];
  float iz = 1 / v[2],
        rx = clamp(v[0] * iz, -.65f * c.w / c.fx, .65f * c.w / c.fx),
        ry = clamp(v[1] * iz, -.65f * c.h / c.fy, .65f * c.h / c.fy);
  p.x = c.fx * v[0] * iz + c.cx;
  p.y = c.fy * v[1] * iz + c.cy;
  for (int k = 0; k < 3; k++) {
    p.J[k] = c.fx * iz * (c.R[k] - rx * c.R[k + 6]);
    p.J[k + 3] = c.fy * iz * (c.R[k + 3] - ry * c.R[k + 6]);
  }
  axes(g, p.axis);
  p.a = DILATE;
  p.b = 0;
  p.c = DILATE;
  for (int k = 0; k < 3; k++) {
    float x = 0, y = 0;
    for (int j = 0; j < 3; j++) {
      x += p.J[j] * p.axis[k * 3 + j];
      y += p.J[j + 3] * p.axis[k * 3 + j];
    }
    p.a += x * x;
    p.b += x * y;
    p.c += y * y;
  }
  float det = p.a * p.c - p.b * p.b;
  if (!(det > 1e-12f))
    return p;
  p.A = p.c / det;
  p.B = -p.b / det;
  p.C = p.a / det;
  float op = sig(g.v[13]);
  if (op < AMIN)
    return p;
  float cut = min(ECUT, logf(op / AMIN));
  float dx = sqrtf(2 * cut * p.a), dy = sqrtf(2 * cut * p.c);
  p.x0 = max(0, int(floorf(p.x - dx)));
  p.x1 = min(int(c.w) - 1, int(ceilf(p.x + dx)));
  p.y0 = max(0, int(floorf(p.y - dy)));
  p.y1 = min(int(c.h) - 1, int(ceilf(p.y + dy)));
  p.valid = p.x0 <= p.x1 && p.y0 <= p.y1;
  return p;
}
struct Result {
  double mse, loss;
  vector<uint8_t> rgb;
  vector<array<float, P + 3>> grad;
};
Result raster(vector<G> &gs, const Cam &c, bool train, bool image = false,
              float background = 0) {
  int n = gs.size(), nx = (c.w + TILE - 1) / TILE, ny = (c.h + TILE - 1) / TILE,
      nt = nx * ny;
  vector<Pr> pr(n);
  vector<array<float, 4>> colors(n);
  vector<int> order(n);
  iota(order.begin(), order.end(), 0);
#pragma omp parallel for
  for (int i = 0; i < n; i++) {
    pr[i] = project(gs[i], c);
    colors[i] = {sig(gs[i].v[10]), sig(gs[i].v[11]), sig(gs[i].v[12]),
                 sig(gs[i].v[13])};
  }
  sort(order.begin(), order.end(),
       [&](int i, int j) { return pr[i].z < pr[j].z; });
  vector<vector<int>> tiles(nt);
  for (int i : order)
    if (pr[i].valid)
      for (int y = pr[i].y0 / TILE; y <= pr[i].y1 / TILE; y++)
        for (int x = pr[i].x0 / TILE; x <= pr[i].x1 / TILE; x++)
          tiles[y * nx + x].push_back(i);
  int threads = omp_get_max_threads();
  vector<vector<array<float, P + 3>>> grads;
  if (train)
    grads.resize(threads, vector<array<float, P + 3>>(n));
  vector<double> error(threads, 0), loss(threads, 0);
  Result result;
  if (image)
    result.rgb.resize(c.w * c.h * 3);
  const float norm = 1.f / (3.f * c.w * c.h);
#pragma omp parallel for schedule(dynamic, 1)
  for (int tile = 0; tile < nt; tile++) {
    int tid = omp_get_thread_num(), tx = (tile % nx) * TILE,
        ty = (tile / nx) * TILE;
    const auto &ids = tiles[tile];
    struct Hit {
      int i;
      float a, T, px, py, front[3];
    };
    vector<Hit> hits;
    hits.reserve(ids.size());
    for (int y = ty; y < min(ty + TILE, int(c.h)); y++)
      for (int x = tx; x < min(tx + TILE, int(c.w)); x++) {
        float T = 1, rgb[3] = {0, 0, 0};
        hits.clear();
        for (int i : ids) {
          const auto &p = pr[i];
          float dx = x + .5f - p.x, dy = y + .5f - p.y;
          float power =
              .5f * (p.A * dx * dx + 2 * p.B * dx * dy + p.C * dy * dy);
          if (power < 0 || power > ECUT)
            continue;
          float alpha = min(.99f, colors[i][3] * expf(-power));
          if (alpha < AMIN)
            continue;
          if (train)
            hits.push_back({i, alpha, T, dx, dy, {rgb[0], rgb[1], rgb[2]}});
          for (int k = 0; k < 3; k++)
            rgb[k] += T * alpha * colors[i][k];
          T *= 1 - alpha;
          if (T < 1e-4f)
            break;
        }
        int pixel = (y * c.w + x) * 3;
        for (int k = 0; k < 3; k++)
          rgb[k] += T * background;
        float grad[3];
        for (int k = 0; k < 3; k++) {
          float e = rgb[k] - c.rgb[pixel + k] / 255.f;
          error[tid] += e * e;
          loss[tid] += sqrtf(e * e + 1e-4f);
          // Charbonnier is less sensitive to a moving pixel than squared error.
          grad[k] = norm * e / sqrtf(e * e + 1e-4f);
          if (image)
            result.rgb[pixel + k] =
                uint8_t(clamp(lroundf(rgb[k] * 255), 0l, 255l));
        }
        if (train)
          for (const auto &hit : hits) {
            int i = hit.i;
            auto &g = grads[tid][i];
            const auto &p = pr[i];
            const auto &col = colors[i];
            float dAlpha = 0;
            for (int k = 0; k < 3; k++) {
              float behind = (rgb[k] - hit.front[k] - hit.T * hit.a * col[k]) /
                             max(1e-8f, hit.T * (1 - hit.a));
              dAlpha += grad[k] * hit.T * (col[k] - behind);
              g[k + 6] += grad[k] * hit.T * hit.a * col[k] * (1 - col[k]);
            }
            float e = dAlpha * hit.a;
            float muX = e * (p.A * hit.px + p.B * hit.py),
                  muY = e * (p.B * hit.px + p.C * hit.py);
            float ga = -.5f * e * hit.px * hit.px, gb = -e * hit.px * hit.py,
                  gc = -.5f * e * hit.py * hit.py;
            float va = -(p.A * p.A * ga + p.A * p.B * gb + p.B * p.B * gc);
            float vb = -(2 * p.A * p.B * ga + (p.A * p.C + p.B * p.B) * gb +
                         2 * p.B * p.C * gc);
            float vc = -(p.B * p.B * ga + p.B * p.C * gb + p.C * p.C * gc);
            // Accumulate screen-space derivatives first. The projection chain
            // runs once per splat.
            g[0] += muX;
            g[1] += muY;
            g[2] += va;
            g[3] += vb;
            g[4] += vc;
            g[9] += e * (1 - col[3]);
            g[P] += fabsf(muX) + fabsf(muY);
            g[P + 1] += fabsf(e);
            g[P + 2] += hit.T * hit.a;
          }
      }
  }
  result.mse = accumulate(error.begin(), error.end(), 0.0) * norm;
  result.loss = accumulate(loss.begin(), loss.end(), 0.0) * norm;
  if (train) {
    result.grad.resize(n);
#pragma omp parallel for
    for (int i = 0; i < n; i++) {
      array<float, P + 3> s{};
      for (int t = 0; t < threads; t++)
        for (int k = 0; k < P + 3; k++)
          s[k] += grads[t][i][k];
      const auto &p = pr[i];
      auto &g = result.grad[i];
      g[6] = s[6];
      g[7] = s[7];
      g[8] = s[8];
      g[9] = s[9];
      g[P] = s[P];
      g[P + 1] = s[P + 1];
      g[P + 2] = s[P + 2];
      if (!p.valid)
        continue;
      float inv = 1 / p.z, rx = p.ray[0] * inv, ry = p.ray[1] * inv;
      float limx = .65f * c.w / c.fx, limy = .65f * c.h / c.fy,
            cx = clamp(rx, -limx, limx), cy = clamp(ry, -limy, limy);
      for (int k = 0; k < 3; k++)
        g[k] = s[0] * c.fx * inv * (c.R[k] - rx * c.R[k + 6]) +
               s[1] * c.fy * inv * (c.R[k + 3] - ry * c.R[k + 6]);
      float rotationGrad[9] = {};
      for (int a = 0; a < 3; a++) {
        const float *axis = p.axis + a * 3;
        float vx = 0, vy = 0;
        for (int j = 0; j < 3; j++) {
          vx += p.J[j] * axis[j];
          vy += p.J[j + 3] * axis[j];
        }
        g[a + 3] = 2 * (s[2] * vx * vx + s[3] * vx * vy + s[4] * vy * vy);
        float dx = 2 * s[2] * vx + s[3] * vy, dy = s[3] * vx + 2 * s[4] * vy;
        if (OPTROT)
          for (int j = 0; j < 3; j++)
            rotationGrad[j * 3 + a] +=
                (dx * p.J[j] + dy * p.J[j + 3]) * expf(gs[i].v[a + 3]);
        for (int k = 0; k < 3; k++)
          for (int j = 0; j < 3; j++) {
            float jx =
                -c.fx * inv * inv * c.R[k + 6] * (c.R[j] - cx * c.R[j + 6]);
            float jy =
                -c.fy * inv * inv * c.R[k + 6] * (c.R[j + 3] - cy * c.R[j + 6]);
            if (fabsf(rx) < limx)
              jx -= c.fx * inv * inv * (c.R[k] - rx * c.R[k + 6]) * c.R[j + 6];
            if (fabsf(ry) < limy)
              jy -= c.fy * inv * inv * (c.R[k + 3] - ry * c.R[k + 6]) *
                    c.R[j + 6];
            g[k] += (dx * jx + dy * jy) * axis[j];
          }
      }
      if (OPTROT) {
        float norm = 0;
        for (int j = 0; j < 4; j++)
          norm += gs[i].v[j + 6] * gs[i].v[j + 6];
        norm = sqrtf(norm);
        float w = gs[i].v[6] / norm, x = gs[i].v[7] / norm,
              y = gs[i].v[8] / norm, z = gs[i].v[9] / norm;
        float derivatives[4][9] = {
            {0, -2 * z, 2 * y, 2 * z, 0, -2 * x, -2 * y, 2 * x, 0},
            {0, 2 * y, 2 * z, 2 * y, -4 * x, -2 * w, 2 * z, 2 * w, -4 * x},
            {-4 * y, 2 * x, 2 * w, 2 * x, 0, 2 * z, -2 * w, 2 * z, -4 * y},
            {-4 * z, -2 * w, 2 * x, 2 * w, -4 * z, 2 * y, 2 * x, 2 * y, 0}};
        float q[4] = {w, x, y, z}, dq[4] = {}, dot = 0;
        for (int k = 0; k < 4; k++) {
          for (int j = 0; j < 9; j++)
            dq[k] += rotationGrad[j] * derivatives[k][j];
          dot += dq[k] * q[k];
        }
        for (int k = 0; k < 4; k++)
          g[k + 10] = (dq[k] - q[k] * dot) / norm;
      }
    }
  }
  return result;
}
vector<G> loadModel(const string &file) {
  ifstream f(file, ios::binary);
  uint32_t n;
  get(f, n);
  if (!n || n > 2000000)
    throw runtime_error("invalid splat count");
  vector<G> out(n);
  for (auto &g : out) {
    get(f, g.v);
    for (float v : g.v)
      if (!isfinite(v))
        throw runtime_error("nonfinite input");
  }
  return out;
}
vector<Cam> loadCams(const string &file) {
  ifstream f(file, ios::binary);
  uint32_t n;
  get(f, n);
  if (!n || n > 1000)
    throw runtime_error("invalid camera count");
  vector<Cam> out(n);
  for (auto &c : out) {
    get(f, c.R);
    get(f, c.t);
    get(f, c.fx);
    get(f, c.fy);
    get(f, c.cx);
    get(f, c.cy);
    get(f, c.w);
    get(f, c.h);
    get(f, c.held);
    if (!c.w || !c.h || c.w * c.h > 10000000)
      throw runtime_error("invalid image size");
    c.rgb.resize(c.w * c.h * 3);
    f.read(reinterpret_cast<char *>(c.rgb.data()), c.rgb.size());
    if (!f)
      throw runtime_error("truncated image");
  }
  return out;
}
void save(const vector<G> &gs, const string &file) {
  ofstream f(file, ios::binary);
  uint32_t n = gs.size();
  f.write(reinterpret_cast<const char *>(&n), 4);
  for (const auto &g : gs)
    f.write(reinterpret_cast<const char *>(g.v.data()), 64);
  if (!f)
    throw runtime_error("write failed");
}
void ppm(const Result &r, const Cam &c, const string &file) {
  ofstream f(file, ios::binary);
  f << "P6\n" << c.w << " " << c.h << "\n255\n";
  f.write(reinterpret_cast<const char *>(r.rgb.data()), r.rgb.size());
}
int main(int argc, char **argv) {
  try {
    if (argc == 2 && string(argv[1]) == "--gradcheck") {
      // Check the smooth renderer, without the deliberate runtime
      // alpha/exponent cutoffs.
      AMIN = 1e-12f;
      ECUT = 20;
      OPTROT = true;
      omp_set_num_threads(1);
      Cam c{};
      c.R[0] = c.R[4] = c.R[8] = 1;
      c.fx = c.fy = 60;
      c.cx = c.cy = 32;
      c.w = c.h = 64;
      c.rgb.resize(64 * 64 * 3);
      for (int y = 0; y < 64; y++)
        for (int x = 0; x < 64; x++) {
          int i = (y * 64 + x) * 3;
          c.rgb[i] = 80 + x * 2;
          c.rgb[i + 1] = 70 + y * 2;
          c.rgb[i + 2] = 120;
        }
      G g{};
      g.v = {.04f, -.03f, 2.f, -1.5f, -1.7f, -2.f, .98f, .10f,
             .04f, .02f,  .2f, -.1f,  .1f,   1.f,  0,    0};
      vector<G> v{g};
      double worst = 0;
      for (float background : {0.f, 1.f}) {
        auto grad = raster(v, c, true, false, background).grad[0];
        for (int k = 0; k < P; k++) {
          int slot = parameterSlot(k);
          float h = .0005f;
          auto a = v, b = v;
          a[0].v[slot] += h;
          b[0].v[slot] -= h;
          double numerical = (raster(a, c, false, false, background).loss -
                              raster(b, c, false, false, background).loss) /
                             (2 * h),
                 analytical = grad[k];
          double relative = fabs(numerical - analytical) /
                            max(.00005, max(fabs(numerical), fabs(analytical)));
          worst = max(worst, relative);
          cout << "gradient " << slot << " analytic " << analytical
               << " numeric " << numerical << " relative " << relative << endl;
        }
      }
      cout << "worst " << worst << endl;
      return worst > .05 ? 1 : 0;
    }
    if (argc < 6)
      throw runtime_error(
          "model.bin cameras.bin output.bin iterations cap [seconds]");
    auto gs = loadModel(argv[1]);
    auto cams = loadCams(argv[2]);
    int steps = stoi(argv[4]), cap = stoi(argv[5]);
    double seconds = argc > 6 ? stod(argv[6]) : 3600;
    OPTROT = argc > 7 && string(argv[7]) == "1";
    bool opaque = argc > 9 && string(argv[9]) == "1";
    omp_set_num_threads(3);
    vector<int> train;
    for (int i = 0; i < int(cams.size()); i++)
      if (!cams[i].held)
        train.push_back(i);
    if (train.empty())
      throw runtime_error("no training cameras");
    mt19937 rng(55);
    auto start = chrono::steady_clock::now();
    int actual = 0, bestIter = 0;
    double mse = 0, best = 1e30;
    vector<G> bestGs;
    float lr[P] = {.001f, .001f, .001f, .006f, .006f, .006f, .025f,
                   .025f, .025f, .025f, .001f, .001f, .001f, .001f};
    for (int iter = 1; iter <= steps; iter++) {
      if (argc > 8 && ifstream(argv[8]).good()) {
        cout << "stop-request after " << actual << " completed steps" << endl;
        break;
      }
      if (chrono::duration<double>(chrono::steady_clock::now() - start)
              .count() > seconds)
        break;
      int ci = train[rng() % train.size()];
      // A photograph has opaque surfaces. Alternating black and white
      // backgrounds removes the color/opacity ambiguity that otherwise looks
      // washed out over a light viewer background.
      auto result =
          raster(gs, cams[ci], true, false, opaque && iter % 2 == 0 ? 1 : 0);
      mse = result.mse;
      actual = iter;
      float decay = powf(.1f, min(1.f, float(iter) / steps));
#pragma omp parallel for
      for (int i = 0; i < int(gs.size()); i++) {
        auto &g = gs[i];
        g.detail += result.grad[i][P];
        float b1 = 1 - powf(.9f, iter - g.birth),
              b2 = 1 - powf(.999f, iter - g.birth);
        for (int k = 0; k < P; k++) {
          if (k >= 10 && !OPTROT)
            continue;
          int slot = parameterSlot(k);
          float grad = result.grad[i][k];
          if (!isfinite(grad))
            continue;
          g.m[k] = .9f * g.m[k] + .1f * grad;
          g.s[k] = .999f * g.s[k] + .001f * grad * grad;
          float update = lr[k] * (k < 3 ? decay : 1) * (g.m[k] / b1) /
                         (sqrtf(g.s[k] / b2) + 1e-10f);
          g.v[slot] -= update;
          if (k >= 3 && k < 6)
            g.v[slot] = clamp(g.v[slot], -10.f, 3.f);
          if (k >= 6 && k < 10)
            g.v[slot] = clamp(g.v[slot], -12.f, 8.f);
        }
      }
      if (iter % 150 == 0 && iter < steps * .7 && int(gs.size()) < cap) {
        vector<int> ids(gs.size());
        iota(ids.begin(), ids.end(), 0);
        sort(ids.begin(), ids.end(),
             [&](int a, int b) { return gs[a].detail > gs[b].detail; });
        int grow = min(cap - int(gs.size()), int(gs.size()) / 4), grown = 0;
        for (int i : ids) {
          if (grown >= grow)
            break;
          if (gs[i].detail < 1e-8f || sig(gs[i].v[13]) < .02f)
            continue;
          auto q = gs[i];
          int a =
              max_element(q.v.begin() + 3, q.v.begin() + 6) - q.v.begin() - 3;
          float axis[9];
          axes(q, axis);
          for (int k = 0; k < 3; k++) {
            gs[i].v[k] -= .7f * axis[a * 3 + k];
            q.v[k] += .7f * axis[a * 3 + k];
          }
          gs[i].v[a + 3] += logf(.7f);
          q.v[a + 3] += logf(.7f);
          gs[i].v[13] = q.v[13] = logit(sig(q.v[13]) * .75f);
          gs[i].m = {};
          gs[i].s = {};
          q.m = {};
          q.s = {};
          gs[i].birth = q.birth = iter;
          q.detail = 0;
          gs.push_back(q);
          grown++;
        }
        for (auto &g : gs)
          g.detail = 0;
        cout << "split " << iter << " +" << grown << " -> " << gs.size()
             << endl;
      }
      if (iter % 50 == 0 || iter == steps) {
        double elapsed =
            chrono::duration<double>(chrono::steady_clock::now() - start)
                .count();
        cout << "step " << iter << "/" << steps << " splats " << gs.size()
             << " train-PSNR " << -10 * log10(max(1e-15, mse)) << " seconds "
             << elapsed << endl;
      }
      if (iter % 250 == 0 || iter == steps) {
        double score = 0;
        int n = 0;
        for (const auto &c : cams)
          if (c.held == 1) {
            score += opaque ? (raster(gs, c, false).mse +
                               raster(gs, c, false, false, 1).mse) *
                                  .5
                            : raster(gs, c, false).mse;
            n++;
          }
        if (n) {
          score /= n;
          cout << "heldout-PSNR " << -10 * log10(score) << endl;
          if (score < best) {
            best = score;
            bestGs = gs;
            bestIter = iter;
          }
        }
        save(gs, string(argv[3]) + ".checkpoint");
      }
    }
    // Retain only finite visible Gaussians; actual count and processing are
    // reported by the CLI.
    if (!bestGs.empty())
      gs = move(bestGs);
    gs.erase(remove_if(gs.begin(), gs.end(),
                       [](const G &g) {
                         return sig(g.v[13]) < .004f ||
                                any_of(
                                    g.v.begin(), g.v.end(),
                                    [](float v) { return !isfinite(v); });
                       }),
             gs.end());
    save(gs, argv[3]);
    for (int i = 0; i < int(cams.size()); i++)
      if (cams[i].held == 1)
        ppm(raster(gs, cams[i], false, true), cams[i],
            string(argv[3]) + "-" + to_string(i) + ".ppm");
    cout
        << "complete steps " << actual << " splats " << gs.size() << " seconds "
        << chrono::duration<double>(chrono::steady_clock::now() - start).count()
        << " selected " << (bestIter ? bestIter : actual) << endl;
  } catch (const exception &e) {
    cerr << e.what() << endl;
    return 1;
  }
}
