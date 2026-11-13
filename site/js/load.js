/* Loading a view and a basin, and the state in the URL. */
import {$, params, FRESH} from './util.js';
import {state, S, ui, VIEWS, catalogs, fileOf, FIRST_VISIT, START} from './store.js';
import {gunzip, decodeBin, decodeJson, link, retime, loadCatalogs} from './data.js';
import {redraw, fit, tooltip, startAnimation} from './map.js';
import {renderRiver, renderCharts} from './card.js';
import {renderTabs} from './panel.js';
import {renderCompare, chooseCompare, entryOf} from './compare.js';
import {renderLegend, renderTimebar, afterTime} from './timebar.js';

/* The state lives in the URL: view, basin, month (m = 1..12), year (y),
 * compared basin (cmp = view/slug), colour (c = t). Links can be shared and
 * a reload keeps the view; old links with only view and basin still work. */
export function setUrl() {
  const meta = S.meta, p = new URLSearchParams({view: S.view});
  if (S.slug && VIEWS[S.view].catalog) p.set('basin', S.slug);
  if (meta && state.month >= 0 && meta.months) p.set('m', meta.months[state.month]);
  if (meta && state.year >= 0 && meta.years) p.set('y', meta.years[state.year]);
  if (S.cmpB) p.set('cmp', S.cmpB.entry.slug ? `${S.cmpB.entry.view}/${S.cmpB.entry.slug}` : S.cmpB.entry.view);
  if (state.color === 't') p.set('c', 't');
  history.replaceState(null, '', `?${p}`.replace(/%2F/g, '/'));
}
// what the URL asked for at the start, applied once to the first basin
let initial = {m: +params.get('m') || (FIRST_VISIT ? START.m : 0), y: +params.get('y') || 0, c: params.get('c') || (FIRST_VISIT ? START.c : null), cmp: params.get('cmp')};
function applyInitial() {
  const a = initial, meta = S.meta;
  initial = null;
  if (!a) return;
  if (a.c === 't' && meta.water_temp) state.color = 't';
  if (a.y && meta.years && meta.years.includes(a.y)) state.year = meta.years.indexOf(a.y);
  if (a.m && meta.months && meta.months.includes(a.m)) state.month = meta.months.indexOf(a.m);
  if (state.color === 't') renderLegend();
  if (state.month >= 0 || state.year >= 0) afterTime();
  if (a.cmp) {
    const [v, s] = a.cmp.split('/');
    if (VIEWS[v]) loadCatalogs().then(() => chooseCompare(entryOf(v, s || null)));
  }
}

export function renderAll() {
  renderRiver();
  renderCharts();
  renderCompare();
  renderLegend();
  renderTimebar();
  renderTabs();
}

/* ---------- loading a basin ---------- */
let loadToken = 0, started = false;
function loadBasin(url) {
  const token = ++loadToken;
  $('subtitle').textContent = 'Lädt …';
  const bin = url.endsWith('.bin');
  return fetch(url, FRESH)
    .then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return bin ? r.arrayBuffer().then(gunzip) : r.json(); })
    .then((data) => {
      if (token !== loadToken) return;  // a newer choice won
      const {meta, rivers} = bin ? decodeBin(data) : decodeJson(data);
      S.meta = meta;
      S.rivers = S.mainRivers = rivers;
      S.travelH = 0;
      link(rivers);
      S.pinned = null;
      tooltip.hidden = true;
      state.month = -1;
      state.year = -1;
      if (!meta.months && meta.water_temp) meta.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      if (!meta.water_temp && state.color === 't') state.color = 'q';
      renderAll();
      applyInitial();
      setUrl();
      fit(started ? 800 : 0);
      redraw();
      if (!started) { started = true; startAnimation(); }
      // the big rivers are on screen; now the small streams
      if (meta.detail) loadDetail(url.replace(/[^/]*$/, meta.detail), token);
    });
}

function loadDetail(url, token) {
  fetch(url, FRESH)
    .then((r) => (r.ok ? r.arrayBuffer().then(gunzip) : null))
    .then((data) => {
      if (!data || token !== loadToken) return;
      const extra = decodeBin(data).rivers;
      link(S.mainRivers.concat(extra));  // "d" counts the main file first
      S.rivers = extra.concat(S.mainRivers);  // small streams drawn below the big rivers
      if (state.month >= 0 || state.year >= 0) retime();
      redraw();
    })
    .catch((e) => console.warn('detail', e));
}

export function openView(name, basin) {
  S.view = name;
  ui.open.clear();  // the list opens at the region of the river on the map
  ui.open.add(name);
  const v = VIEWS[name];
  if (!v.catalog) { S.slug = null; return loadBasin(v.basin); }
  return loadCatalogs().then(() => {
    const cat = catalogs[name];
    const pick = cat.basins.find((b) => b.slug === basin) || cat.basins[0];
    S.slug = pick.slug;
    return loadBasin(fileOf(name, S.slug));
  });
}
