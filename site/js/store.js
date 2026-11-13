/* Shared state of the page. Modules cannot reassign each other's variables,
 * so everything that changes while the page runs lives in `state` (what the
 * user chose) or `S` (what is loaded). Also the values and colours that depend
 * on the chosen month and year. */
import {params} from './util.js';

// color: q = discharge, t = water temperature; month: index into meta.months, -1 = annual mean
export const state = {speed: 24, spacing: 24, playing: true, network: true, time: 0,
                      month: -1, year: -1, retimed: 0, color: 'q', labels: true};

/* Views: the full-network Orinoco (one file, ORD_FLOW <= 7) and the continent catalogs. */
export const VIEWS = {
  orinoco: {label: 'Orinoco · volles Netz', basin: 'data/orinoco.bin'},
  sa: {label: 'Südamerika', catalog: 'data/sa/catalog.json', dir: 'data/sa/'},
  na: {label: 'Nordamerika', catalog: 'data/na/catalog.json', dir: 'data/na/'},
  eu: {label: 'Europa', catalog: 'data/eu/catalog.json', dir: 'data/eu/'},
  af: {label: 'Afrika', catalog: 'data/af/catalog.json', dir: 'data/af/'},
  as: {label: 'Asien', catalog: 'data/as/catalog.json', dir: 'data/as/'},
  si: {label: 'Sibirien', catalog: 'data/si/catalog.json', dir: 'data/si/'},
  au: {label: 'Australien & Ozeanien', catalog: 'data/au/catalog.json', dir: 'data/au/'},
};
// a visit without a view in the URL starts with the Ganges in July (monsoon)
export const FIRST_VISIT = !params.get('view');
export const START = {view: 'as', basin: 'ganges', m: 7, c: 't'};  // coloured by water temperature
const startView = VIEWS[params.get('view')] ? params.get('view') : FIRST_VISIT ? START.view : 'orinoco';

export const S = {
  meta: null,        // header of the basin on the map
  rivers: [],        // paths drawn (detail file first, then the main file)
  mainRivers: [],    // paths of the main file
  order: [],         // all paths, mouth first (retime)
  travelH: 0,        // longest travel time in the chosen month / year
  pinned: null,      // clicked path, keeps its tooltip
  view: startView,   // 'orinoco' or a continent
  slug: null,        // basin on the map (catalog views)
  cmpB: null,        // compared basin: {meta, entry}
  cmpToken: 0,
};
export const catalogs = {};  // all catalogs, for the lists
export const ui = {tab: 'rivers', showList: false, picking: false, pct: false, sort: 'az',
                   q: {main: '', pick: ''}, open: new Set([startView])};

export const fileOf = (v, s) => (VIEWS[v].catalog
  ? VIEWS[v].dir + s + (catalogs[v] && catalogs[v].format === 'bin' ? '.bin' : '.json') : VIEWS[v].basin);

// calendar month (0..11) of the selected month, -1 for the year
export function curMonth() { return state.month >= 0 && S.meta && S.meta.months ? S.meta.months[state.month] - 1 : -1; }
export const curYear = () => (state.year >= 0 && S.meta.years ? S.meta.years[state.year] : null);

// discharge shown: a single year (GloFAS) or the mean months, a month or the year
export const qOf = (d) => {
  if (state.year >= 0 && d.y) {
    const o = 12 * state.year;
    if (state.month >= 0) return d.y[o + S.meta.months[state.month] - 1];
    let sum = 0;
    for (let k = 0; k < 12; k++) sum += d.y[o + k];
    return sum / 12;
  }
  return state.month >= 0 && d.m ? d.m[state.month] : d.q;
};
// estimated water temperature (°C): 12 calendar months in d.w
export const tOf = (d) => {
  if (!d.w) return null;
  if (state.month >= 0) return d.w[S.meta.months[state.month] - 1];
  return d.w.reduce((a, b) => a + b, 0) / 12;
};
/* Seasonal speed. Flow velocity follows Manning's equation, v ~ Q^0.2 for a
 * given channel, so in a month with discharge Q_m water moves (Q_m/Q)^0.2
 * times as fast as at the yearly mean. */
export const speedOf = (d) => ((state.month >= 0 && d.m) || (state.year >= 0 && d.y)
  ? Math.min(Math.max(Math.pow(Math.max(qOf(d), 1e-3) / Math.max(d.q, 1e-3), 0.2), 0.33), 3) : 1);

// discharge (m³/s) -> colour, log scale 1 .. 10 000
const RAMP = [[31, 78, 121], [47, 143, 199], [111, 211, 255], [232, 251, 255]];
function dischargeColor(q, alpha) {
  const x = Math.min(Math.max(Math.log10(Math.max(q, 1)) / 4, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  return [...c, alpha];
}
// water temperature (°C) -> colour, 0 .. 30 °C
const TRAMP = [[49, 54, 149], [69, 117, 180], [116, 173, 209], [254, 224, 144], [244, 109, 67], [215, 48, 39]];
function tempColor(t, alpha) {
  if (t == null) return [120, 120, 120, alpha];
  const x = Math.min(Math.max(t / 30, 0), 1) * (TRAMP.length - 1);
  const i = Math.min(Math.floor(x), TRAMP.length - 2);
  const f = x - i;
  return [...TRAMP[i].map((v, k) => Math.round(v + (TRAMP[i + 1][k] - v) * f)), alpha];
}
export const colorOf = (d, alpha) => (state.color === 't' ? tempColor(tOf(d), alpha) : dischargeColor(qOf(d), alpha));
// line width in pixels from discharge: 1 m³/s ≈ 0.4 px, 100 ≈ 1.1 px, 10 000 ≈ 3 px, 40 000 ≈ 4 px.
// The exponent is high enough that high and low water look different.
export const widthOf = (q) => Math.max(0.3, 0.4 * Math.pow(Math.max(q, 0.1), 0.22));
// small streams get fainter particles so the big rivers stand out
export const alphaOf = (q) => Math.round(90 + 165 * Math.min(Math.log10(Math.max(q, 1)) / 4, 1));
