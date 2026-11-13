/* Switches for the base map: relief, its place names and its borders.
 * All three are remembered in the browser. */
import {$} from './util.js';
import {map} from './map.js';

const stored = (key, def) => {
  try { const v = localStorage.getItem(key); return v == null ? def : v === '1'; } catch (e) { return def; }  // storage blocked
};
const store = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* storage blocked */ } };

/* ---------- relief: hillshade from elevation tiles, under the rivers ----------
 * MapLibre shades the Terrarium DEM tiles in the browser; deck.gl draws the
 * rivers on its own canvas above the map, so they stay on top. The layer
 * goes under the first label layer of the base map. */
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
let reliefOn = stored('hillshade', true);  // on unless switched off
function applyRelief() {
  if (reliefOn && !map.getLayer('relief')) {
    // before the base style is parsed addSource throws; then try again on the next style event
    try {
      if (!map.getSource('dem')) {
        map.addSource('dem', {type: 'raster-dem', tiles: [DEM], tileSize: 256, maxzoom: 15, encoding: 'terrarium'});
      }
    } catch (e) { map.once('styledata', applyRelief); return; }
    const label = map.getStyle().layers.find((l) => l.type === 'symbol');
    map.addLayer({id: 'relief', type: 'hillshade', source: 'dem', paint: {
      'hillshade-exaggeration': 0.5,
      'hillshade-illumination-direction': 315,
      'hillshade-shadow-color': '#000000',
      'hillshade-highlight-color': '#55606c',
      'hillshade-accent-color': '#161c23',
    }}, label && label.id);
  }
  if (map.getLayer('relief')) map.setLayoutProperty('relief', 'visibility', reliefOn ? 'visible' : 'none');
}
function setRelief(on, save = true) {
  reliefOn = on;
  if (save) store('hillshade', on);
  $('relief').checked = on;
  $('lg-relief').classList.toggle('on', on);
  $('cr-relief').hidden = !on;
  applyRelief();
}
map.once('load', applyRelief);

// show or hide every base map layer that `pick` selects; only real changes,
// since setLayoutProperty fires 'styledata' itself
function showLayers(pick, on) {
  const style = map.getStyle && map.getStyle();
  if (!style || !style.layers) return;
  const vis = on ? 'visible' : 'none';
  for (const l of style.layers) {
    if (pick(l) && (map.getLayoutProperty(l.id, 'visibility') || 'visible') !== vis) map.setLayoutProperty(l.id, 'visibility', vis);
  }
}

/* Place, road and water names of the base map: all its symbol layers.
 * Our own river names (deck.gl TextLayer, "Flussnamen") are separate. */
const isLabel = (l) => l.type === 'symbol';
let baseLabels = stored('basenames', false);  // off unless switched on: only our river names
function setBaseLabels(on, save = true) {
  baseLabels = on;
  if (save) store('basenames', on);
  $('baselabels').checked = on;
  $('lg-names').classList.toggle('on', on);
  try { showLayers(isLabel, on); } catch (e) { /* style not parsed yet: the style events below catch up */ }
}

/* Country, state and county borders: the layers on the source layer
 * "boundaries" of the CARTO style. */
const isBorder = (l) => l['source-layer'] === 'boundaries';
let borders = stored('borders', true);
function setBorders(on, save = true) {
  borders = on;
  if (save) store('borders', on);
  $('borders').checked = on;
  try { showLayers(isBorder, on); } catch (e) { /* style not parsed yet */ }
}

// also after a style (re)load
map.on('styledata', () => {
  try {
    if (!baseLabels) showLayers(isLabel, false);
    if (!borders) showLayers(isBorder, false);
  } catch (e) { /* not ready */ }
});

export function bindBasemap() {
  $('relief').onchange = (e) => setRelief(e.target.checked);
  $('lg-relief').onclick = () => setRelief(!reliefOn);
  $('baselabels').onchange = (e) => setBaseLabels(e.target.checked);
  $('lg-names').onclick = () => setBaseLabels(!baseLabels);
  $('borders').onchange = (e) => setBorders(e.target.checked);
  // show what was stored (or the defaults) without storing it: only a click is a choice
  setBaseLabels(baseLabels, false);
  setBorders(borders, false);
  setRelief(reliefOn, false);
}
