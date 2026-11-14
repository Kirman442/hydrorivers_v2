/* The map: MapLibre base map, deck.gl layers on top (network, pinned path,
 * flowing particles, river names), the tooltip and the animation loop. */
import {$, MONTHS, fmt} from './util.js?v=a7be80b2';
import {state, S, qOf, tOf, colorOf, widthOf, alphaOf, speedOf} from './store.js?v=a7be80b2';
import {riverType} from './data.js?v=a7be80b2';

const {MapboxOverlay, PathLayer, TextLayer, TripsLayer} = deck;
const TAIL = 0.45; // visible part of each particle, as a share of the spacing

/* TripsLayer draws one comet per path. FlowLayer repeats it: every
 * `trailLength` hours of travel a new particle follows, so rivers look
 * continuously flowing. currentTime can then wrap at trailLength. */
class FlowLayer extends TripsLayer {
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject['fs:#main-start'] = `
      float flowPhase = mod(trips.currentTime - vTime, trips.trailLength);
      if (flowPhase > trips.trailLength * ${TAIL.toFixed(2)}) { discard; }
    `;
    shaders.inject['fs:DECKGL_FILTER_COLOR'] = `
      color.a *= 1.0 - mod(trips.currentTime - vTime, trips.trailLength)
                       / (trips.trailLength * ${TAIL.toFixed(2)});
    `;
    return shaders;
  }
}
FlowLayer.layerName = 'FlowLayer';

export const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-66, 6],
  zoom: 5,
  attributionControl: false,  // credits line under the map, see index.html
});
map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');

export const tooltip = $('tooltip');
const overlay = new MapboxOverlay({interleaved: false, layers: [],
  pickingRadius: 5,  // thin streams: catch them within 5 px of the pointer
  onClick: (info) => {  // a click on empty map releases a pinned river
    if (info.object || !S.pinned) return;
    S.pinned = null;
    tooltip.hidden = true;
    redraw();
  }});
map.addControl(overlay);

// new layer objects with the current state; deck.gl keeps the GPU buffers
export function redraw() { overlay.setProps({layers: layers()}); }

function layers() {
  const pinned = S.pinned;
  return [
    new PathLayer({
      id: 'network',
      // always there for hover and click; hidden network = transparent
      opacity: state.network ? 1 : 0,
      data: S.rivers,
      getPath: (d) => d.path,
      positionFormat: 'XY',
      getWidth: (d) => widthOf(qOf(d)),
      widthUnits: 'pixels',
      getColor: (d) => colorOf(d, 70),
      updateTriggers: {getWidth: [state.month, state.year], getColor: [state.month, state.year, state.color]},
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 160],
      onHover: (info) => {
        map.getCanvas().style.cursor = info.object ? 'pointer' : '';
        if (!S.pinned) showTooltip(info);
      },
      onClick: (info) => { S.pinned = info.object || null; showTooltip(info); redraw(); },
    }),
    pinned && new PathLayer({
      id: 'pinned',
      data: [pinned],
      getPath: (d) => d.path,
      positionFormat: 'XY',
      getWidth: (d) => widthOf(qOf(d)) + 5,
      widthUnits: 'pixels',
      getColor: [255, 255, 255, 120],
      capRounded: true,
      jointRounded: true,
    }),
    new FlowLayer({
      id: 'flow',
      data: S.rivers,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      positionFormat: 'XY',
      getWidth: (d) => widthOf(qOf(d)) * 1.4 + 0.3,
      widthUnits: 'pixels',
      getColor: (d) => colorOf(d, alphaOf(qOf(d))),
      updateTriggers: {getWidth: [state.month, state.year], getColor: [state.month, state.year, state.color], getTimestamps: state.retimed},
      capRounded: true,
      jointRounded: true,
      fadeTrail: true,
      trailLength: state.spacing,
      currentTime: state.time,
    }),
    state.labels && S.meta && S.meta.labels && new TextLayer({
      id: 'labels',
      data: S.meta.labels,
      getPosition: (d) => [d.lon, d.lat],
      getText: (d) => d.name,
      getSize: (d) => (d.main ? 16 : 12),
      getColor: (d) => (d.main ? [235, 245, 255, 255] : [200, 215, 230, 230]),
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontWeight: 600,
      characterSet: 'auto',
      fontSettings: {sdf: true},
      outlineWidth: 3,
      outlineColor: [11, 15, 20, 230],
      getPixelOffset: [0, -10],
    }),
  ];
}

// a clicked river stays highlighted with its info until the next click
function showTooltip(info) {
  if (!info.object) { tooltip.hidden = true; return; }
  const d = info.object, meta = S.meta;
  tooltip.hidden = false;
  tooltip.classList.toggle('pinned', d === S.pinned);
  tooltip.innerHTML =
    `Abfluss ${state.month >= 0 ? MONTHS[meta.months[state.month] - 1] : 'Jahresmittel'}` +
    `${state.year >= 0 && meta.years ? ' ' + meta.years[state.year] : ''}: ` +
    `<b>${fmt.format(qOf(d))} m³/s</b><br>` +
    (state.month >= 0 ? `Jahresmittel: ${fmt.format(d.q)} m³/s<br>` : '') +
    (d.w ? `Wassertemperatur (Schätzung): ${fmt.format(tOf(d))} °C` +
           ` (im Jahr ${fmt.format(Math.min(...d.w))} bis ${fmt.format(Math.max(...d.w))} °C)<br>` : '') +
    (d.v ? `Fließgeschwindigkeit: ${fmt.format(Math.min(Math.max(d.v * speedOf(d), 0.1), 4))} m/s` + (d.s != null ? `, Gefälle ${fmt.format(d.s)} m/km` : '') + '<br>' : '') +
    (d.g ? `Flusstyp (GloRiC): ${riverType(d.g)}<br>` : '') +
    `Einzugsgebiet: ${fmt.format(d.u)} km²<br>` +
    `Bis zur Mündung: ${fmt.format(d.toOutlet / 24)} Tage` +
    (d === S.pinned ? '<div class="hint">Klick daneben schließt</div>' : '');
  // place it by its real size: right of and below the pointer, else left / above
  const w = tooltip.offsetWidth, h = tooltip.offsetHeight, W = window.innerWidth, H = window.innerHeight;
  const x = info.x + 14 + w < W - 8 ? info.x + 14 : Math.max(8, info.x - 14 - w);
  const y = info.y + 14 + h < H - 8 ? info.y + 14 : Math.max(8, info.y - 14 - h);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

let last = performance.now(), running = false;
// no animation while the window is in the background (spares the GPU);
// hidden tabs get no frames anyway, this also covers an unfocused window
let active = document.hasFocus();
window.addEventListener('focus', () => { active = true; });
window.addEventListener('blur', () => { active = false; });
document.addEventListener('visibilitychange', () => { active = !document.hidden && document.hasFocus(); });
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (state.playing && active) {
    state.time = (state.time + dt * state.speed) % state.spacing;
    redraw();
  }
  requestAnimationFrame(frame);
}
export function startAnimation() {
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

// keep the river clear of the panel, the legend and the time bar
export function fit(duration) {
  const [w, s, e, n] = S.meta.bounds;
  const P = $('panel').getBoundingClientRect(), T = $('timebar').getBoundingClientRect();
  const pad = window.innerWidth > 760
    ? {top: 40, right: 60, left: P.right + 30, bottom: window.innerHeight - T.top + 20}
    : {top: 60, right: 20, left: 20, bottom: window.innerHeight - P.top + 10};
  map.fitBounds([[w, s], [e, n]], {duration, padding: pad});
}
