/* Reading the data files and what is computed from them: the binary basin
 * format, the downstream links and the travel times of the chosen month. */
import {FRESH, avg} from './util.js';
import {state, S, VIEWS, catalogs, speedOf} from './store.js';
import {updateTravel} from './card.js';

/* Binary basin file (pipeline/binfmt.py): "HRB1", meta JSON, then typed
 * arrays listed in meta.arrays. Paths and timestamps become views into two
 * big arrays, so nothing is copied per path. */
const TYPES = {uint8: Uint8Array, int8: Int8Array, uint16: Uint16Array, int16: Int16Array,
               uint32: Uint32Array, int32: Int32Array, float32: Float32Array};
// .bin files are gzipped by the pipeline (static hosts don't compress them)
export function gunzip(buf) {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;  // already plain
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export function decodeBin(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x31425248) throw new Error('not a HRB1 file');  // "HRB1"
  const n = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n)));
  let pos = 8 + n + ((4 - n % 4) % 4);
  const a = {};
  for (const [name, type, len] of meta.arrays) {
    const T = TYPES[type];
    a[name] = new T(buf, pos, len);
    const bytes = len * T.BYTES_PER_ELEMENT;
    pos += bytes + ((4 - bytes % 4) % 4);
  }
  const np = meta.paths, nv = meta.vertices, sp = meta.scale.p, st = meta.scale.t;
  const xy = new Float32Array(2 * nv), ts = new Float32Array(nv);
  const mOut = a.m ? new Float32Array(12 * np) : null;
  const ny = a.y ? a.y.length / np : 0;  // single years x 12 months per path
  const yOut = ny ? new Float32Array(ny * np) : null;
  const out = new Array(np);
  for (let i = 0; i < np; i++) {
    const s = a.start[i], e = a.start[i + 1];
    const x0 = a.x0y0[2 * i], y0 = a.x0y0[2 * i + 1], t0 = a.t0[i];
    for (let k = s; k < e; k++) {
      xy[2 * k] = (x0 + a.dxy[2 * k]) * sp;
      xy[2 * k + 1] = (y0 + a.dxy[2 * k + 1]) * sp;
      ts[k] = (t0 + a.dt[k]) * st;
    }
    let m;
    if (mOut) {
      for (let j = 0; j < 12; j++) mOut[12 * i + j] = a.m[12 * i + j] / 255 * a.mmax[i];
      m = mOut.subarray(12 * i, 12 * i + 12);
    }
    let yv;
    if (yOut) {
      for (let j = 0; j < ny; j++) yOut[ny * i + j] = a.y[ny * i + j] / 255 * a.ymax[i];
      yv = yOut.subarray(ny * i, ny * i + ny);
    }
    const w = a.w && a.w[12 * i] !== -128 ? a.w.subarray(12 * i, 12 * i + 12) : undefined;
    const sl = a.s && a.s[i] !== 65535 ? a.s[i] * meta.scale.s : undefined;
    out[i] = {path: xy.subarray(2 * s, 2 * e), timestamps: ts.subarray(s, e),
              q: a.q[i], u: a.u[i], o: a.o[i], m, y: yv, w, s: sl,
              v: a.v ? a.v[i] * meta.scale.v : undefined, g: a.g && a.g[i] ? a.g[i] : undefined,
              dn: a.d ? a.d[i] : -1,
              toOutlet: meta.travel_time_h - ts[e - 1]};
  }
  // timestamps of the yearly mean, kept for re-timing the months (retime)
  const base = ts.slice();
  for (let i = 0; i < np; i++) out[i].base = base.subarray(a.start[i], a.start[i + 1]);
  return {meta, rivers: out};
}

// the old JSON format (--format json)
export function decodeJson(json) {
  const meta = json.meta, sp = meta.scale.p, st = meta.scale.t;
  const rivers = json.paths.map((r) => {
    const path = new Float64Array(r.p.length);
    for (let i = 0; i < r.p.length; i++) path[i] = r.p[i] * sp;
    const timestamps = r.t.map((t) => t * st);
    return {path, timestamps, q: r.q, u: r.u, o: r.o, m: r.m, w: r.w, v: r.v, s: r.s, g: r.g,
            toOutlet: meta.travel_time_h - timestamps[timestamps.length - 1]};
  });
  return {meta, rivers};
}

// only the meta header of a .bin file (the compared basin)
export function readMeta(buf) {
  const n = new DataView(buf).getUint32(4, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n)));
}

/* The time to the outlet is summed again from the mouth upwards along "d"
 * (the downstream path), so the particles stay continuous through every
 * confluence when the speed changes with the month. */
export function link(all) {
  for (const r of all) r.down = r.dn >= 0 ? all[r.dn] || null : null;
  for (const r of all) {
    if (r.baseDur !== undefined || !r.base) continue;  // already linked (main file)
    const b = r.base;
    r.baseDur = b[b.length - 1] - b[0];
    r.baseEnd = r.toOutlet;
  }
  // mouth first: sort by the number of steps to the outlet (times can tie)
  const hops = new Map();
  const hopsOf = (r) => {
    let n = 0, x = r;
    const chain = [];
    while (x && !hops.has(x)) { chain.push(x); x = x.down; }
    n = x ? hops.get(x) : -1;
    for (let k = chain.length - 1; k >= 0; k--) hops.set(chain[k], ++n);
    return hops.get(r);
  };
  S.order = all.slice().sort((a, b) => hopsOf(a) - hopsOf(b));
}
export function retime() {
  const order = S.order;
  if (!order.length || !order[0].base) return;
  let tMax = 0;
  for (const r of order) {
    r.dur = r.baseDur / speedOf(r);
    // a path whose downstream neighbour is not drawn keeps its own scaled time
    r.end = r.down ? r.down.end + r.down.dur : r.baseEnd / speedOf(r);
    tMax = Math.max(tMax, r.end + r.dur);
  }
  for (const r of order) {
    const b = r.base, t = r.timestamps, n = b.length;
    for (let k = 0; k < n; k++) {
      const frac = r.baseDur > 0 ? (b[k] - b[0]) / r.baseDur : 1;  // 0 at the upstream end
      t[k] = tMax - (r.end + (1 - frac) * r.dur);
    }
    r.toOutlet = r.end;
  }
  S.travelH = tMax;
  state.retimed++;
  updateTravel();
}

let catalogsReady = null;
export function loadCatalogs() {
  if (!catalogsReady) {
    catalogsReady = Promise.all(Object.entries(VIEWS).filter(([, v]) => v.catalog).map(([k, v]) =>
      fetch(v.catalog, FRESH).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((c) => { if (c) catalogs[k] = c; })));
  }
  return catalogsReady;
}

// twelve calendar months of the main river: the mean, or one year (by its number)
export function hydro12(m, year) {
  const yi = year != null && m.years ? m.years.indexOf(year) : -1;
  if (yi >= 0 && m.hydrograph_years) return m.hydrograph_years[yi];
  if (!m.hydrograph || !m.months) return null;
  const out = new Array(12).fill(null);
  m.months.forEach((c, i) => { out[c - 1] = m.hydrograph[i]; });
  return out.includes(null) ? null : out;
}
// single GloFAS years against their mean: share above / below, per year
export function yearAnoms(m) {
  const yrs = m.hydrograph_years;
  if (!yrs || !m.years || yrs.length < 2) return null;
  const means = yrs.map((v) => avg(v)), all = avg(means);
  return all > 0 ? means.map((v) => 100 * (v / all - 1)) : null;
}
// water temperature at the mouth: the outlet path with the largest discharge
export function mouthTemp() {
  let best = null;
  for (const r of S.mainRivers) if (r.w && r.dn < 0 && (!best || r.q > best.q)) best = r;
  return best ? [Math.min(...best.w), Math.max(...best.w), best.w] : null;
}

// GloRiC reach type, e.g. 1012: region 10, size 1, geomorphic class 2
let gloricNames = null;
fetch('data/gloric_classes.json', FRESH).then((r) => (r.ok ? r.json() : null)).then((j) => { gloricNames = j; }).catch(() => {});
export function riverType(code) {
  if (!gloricNames) return code;
  const size = Math.floor(code / 10) % 10, geom = code % 10;
  const n = gloricNames;
  // GloRiC's climate region is left out: its classes are coarse ("warm" covers
  // the Pechora and the Rhine alike); the water temperature line says more
  return [n.size[size], n.geom[geom]].filter(Boolean).join(', ') || code;
}
