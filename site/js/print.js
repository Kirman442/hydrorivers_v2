/* Print sheet (for now only with ?print=1): the map exactly as the app draws
 * it, captured large. Two captures on a hidden map of the sheet's size:
 *   1. MapLibre: base map + relief (dark: the app's style with its switches;
 *      light styles: CARTO Positron reduced to land, water and borders),
 *   2. deck.gl: network + particles from map.js, frozen at the current moment
 *      (on light paper the same colour scale, big rivers dark),
 * then composed on an A3 sheet with frame, degree grid, north arrow, scale
 * bar, overview map, legend, title, river names, twelve months, figures and
 * sources. Saved as PNG; PDF comes later. */
import {fmt} from './util.js?v=78a1ce87';
import {state, S, qOf, tOf, widthOf, alphaOf, dischargeColor, tempColor, curMonth, curYear} from './store.js?v=78a1ce87';
import {map, layers} from './map.js?v=78a1ce87';
import {basemapState} from './basemap.js?v=78a1ce87';

const {PathLayer} = deck;
const SHEETS = {quer: [420, 297], hoch: [297, 420]};
const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const P = {fmt: 'quer', dpi: 150, frame: 'basin', bg: 'dunkel', labels: 'karto', north: 'ring', grid: 'rand',
  inset: true, neat: true, months: false, facts: false, lw: 1, title: ''};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const POSITRON = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/* Sheet themes. light: rivers in the light scale (same hues, big rivers dark). */
const THEMES = {
  dunkel: {light: false, paper: '#0b0f14', ink: '#e8eef3', ink2: 'rgba(232,238,243,.62)', frame: 'rgba(232,238,243,.6)',
    name: 'rgba(220,240,250,.97)', name2: 'rgba(190,220,238,.92)', halo: 'rgba(8,12,16,.78)', box: '#f4a261'},
  hell: {light: true, paper: '#f4f5f6', land: '#eceef0', sea: '#c9d6df', border: '#a6afb6',
    shadow: '#5f6a73', highlight: '#ffffff', accent: '#9aa5ad',
    ink: '#1b252b', ink2: 'rgba(27,37,43,.62)', frame: 'rgba(27,37,43,.55)', name: '#0f3550', name2: '#244e6a', halo: 'rgba(244,245,246,.85)', box: '#c4512b'},
  silber: {light: true, paper: '#e9ecef', land: '#dde2e6', sea: '#b4c2cc', border: '#9aa4ab',
    shadow: '#56616a', highlight: '#fbfcfd', accent: '#8e99a1',
    ink: '#1c262b', ink2: 'rgba(28,38,43,.62)', frame: 'rgba(28,38,43,.55)', name: '#0d3a4d', name2: '#22526a', halo: 'rgba(233,236,239,.85)', box: '#c4512b'},
  papier: {light: true, paper: '#efe8da', land: '#e8dfcc', sea: '#c9d0cc', border: '#a89a80',
    shadow: '#6d5e47', highlight: '#fffaf0', accent: '#a29275',
    ink: '#2a2418', ink2: 'rgba(42,36,24,.62)', frame: 'rgba(42,36,24,.55)', name: '#1f3354', name2: '#34496a', halo: 'rgba(239,232,218,.85)', box: '#b5422c'},
};
const RAMP_LIGHT = [[124, 196, 226], [47, 143, 199], [31, 78, 121], [14, 40, 70]];
const rampAt = (R, f) => { f = Math.min(Math.max(f, 0), 1) * (R.length - 1); const i = Math.min(Math.floor(f), R.length - 2), t = f - i;
  return R[i].map((v, k) => Math.round(v + (R[i + 1][k] - v) * t)); };
const lightColor = (d) => (state.color === 't' ? tempColor(tOf(d), 255).slice(0, 3) : rampAt(RAMP_LIGHT, Math.log10(Math.max(qOf(d), 1)) / 4));
let dlg, preview, sheet = null, T = THEMES.dunkel;

export function initPrint() {
  const css = document.createElement('style');
  css.textContent = `
  #pr-open { float: right; display: inline-flex; align-items: center; gap: 5px; }
  /* a print sheet is work for a desktop machine */
  @media (max-width: 760px) { #pr-open { display: none; } }
  #pr-dlg { position: fixed; inset: 0; z-index: 40; background: rgba(5,8,11,.94); display: grid; grid-template-columns: 290px 1fr; color: #e8eef3; font-size: 12.5px; }
  #pr-dlg[hidden] { display: none; }
  #pr-dlg aside { padding: 14px 14px; border-right: 1px solid #26313a; display: flex; flex-direction: column; gap: 7px; overflow: auto; }
  #pr-dlg h2 { margin: 0 0 2px; font-size: 16px; }
  #pr-dlg label { display: grid; grid-template-columns: 82px minmax(0, 1fr); align-items: center; gap: 8px; color: #b9c5cf; }
  #pr-dlg .cks { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 8px; margin: 2px 0; }
  #pr-dlg .cks label { display: flex; align-items: center; gap: 6px; }
  #pr-dlg select, #pr-dlg input[type=text] { min-width: 0; background: #141c24; color: #e8eef3; border: 1px solid #33404b; border-radius: 5px; padding: 4px 6px; font: inherit; }
  #pr-dlg input[type=range] { accent-color: #2f8fc7; min-width: 0; }
  #pr-dlg .row { display: flex; gap: 6px; }
  #pr-dlg button { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #3a4652; background: #18222c; color: #e8eef3; cursor: pointer; font: inherit; }
  #pr-dlg button.main { background: #2f8fc7; border-color: #2f8fc7; color: #fff; }
  #pr-dlg button:disabled { opacity: .5; cursor: default; }
  #pr-dlg .msg { font-size: 11.5px; color: #9fb0bc; line-height: 1.4; margin: 0; }
  #pr-dlg main { overflow: auto; padding: 20px; display: flex; align-items: flex-start; justify-content: center; }
  #pr-dlg main canvas { max-width: 100%; height: auto; box-shadow: 0 10px 40px rgba(0,0,0,.6); transition: opacity .2s; }
  #pr-dlg main.busy canvas { opacity: .35; }
  #pr-dlg main { position: relative; }
  #pr-busy { position: fixed; left: calc(290px + (100vw - 290px) / 2); top: 45%; transform: translate(-50%, -50%); z-index: 2;
    display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-radius: 10px; background: rgba(15,22,30,.96);
    border: 1px solid #33404b; box-shadow: 0 10px 30px rgba(0,0,0,.5); font-size: 14px; }
  #pr-busy[hidden] { display: none; }
  #pr-busy i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #33404b; border-top-color: #6fd3ff; animation: pr-spin .8s linear infinite; }
  @keyframes pr-spin { to { transform: rotate(360deg); } }
  #pr-busy > div { display: flex; flex-direction: column; gap: 7px; min-width: 210px; }
  #pr-bar { display: block; height: 4px; border-radius: 2px; background: #26313a; overflow: hidden; }
  #pr-bar s { display: block; height: 100%; width: 0; background: #6fd3ff; transition: width .25s; }
  #pr-dlg button.hot { background: #f4a261; border-color: #f4a261; color: #1a1206; }
  @media (prefers-reduced-motion: reduce) { #pr-busy i { animation: none; } }`;
  document.head.appendChild(css);
  // in the river card, on the line of "← Alle Flüsse": the sheet is made for the river on the map
  const open = document.createElement('button');
  open.id = 'pr-open'; open.type = 'button'; open.className = 'link';
  open.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1h8v4H4zM2 6h12a1 1 0 0 1 1 1v5h-3v3H4v-3H1V7a1 1 0 0 1 1-1zm3 5v3h6v-3z" fill="currentColor"/></svg> Druckblatt';
  open.title = 'Karte dieses Flusses als Druckblatt (A3, PNG oder PDF)';
  document.getElementById('to-list').after(open);
  dlg = document.createElement('div');
  dlg.id = 'pr-dlg'; dlg.hidden = true;
  dlg.innerHTML = `<aside>
      <h2>Druckblatt</h2>
      <label>Format<select id="pr-fmt"><option value="quer">A3 quer</option><option value="hoch">A3 hoch</option></select></label>
      <label>Auflösung<select id="pr-dpi"><option value="150">150 dpi (Vorschau)</option><option value="300">300 dpi (Druck)</option></select></label>
      <label>Ausschnitt<select id="pr-frame"><option value="basin">ganzes Einzugsgebiet</option><option value="screen">wie auf dem Bildschirm</option></select></label>
      <label>Grundkarte<select id="pr-bg"><option value="dunkel">Dunkel (wie die Karte)</option><option value="hell">Hell</option><option value="silber">Silber</option><option value="papier">Papier</option></select></label>
      <label>Flussnamen<select id="pr-labels"><option value="karto">kartografisch</option><option value="app">wie in der Anwendung</option><option value="off">keine</option></select></label>
      <label>Norden<select id="pr-north"><option value="ring">Kompassring</option><option value="pfeil">Nordpfeil</option><option value="off">keiner</option></select></label>
      <label>Gradnetz<select id="pr-grid"><option value="rand">Angaben am Rand</option><option value="linien">Linien</option><option value="off">keines</option></select></label>
      <label>Linien <span id="pr-lw-v" style="display:none"></span><input id="pr-lw" type="range" min="0.6" max="2" step="0.1" value="1" title="Linienstärke, 1 = wie auf dem Bildschirm"></label>
      <div class="cks">
        <label><input id="pr-inset" type="checkbox" checked> Übersicht</label>
        <label><input id="pr-neat" type="checkbox" checked> Doppelrahmen</label>
        <label><input id="pr-months" type="checkbox"> 12 Monate</label>
        <label><input id="pr-facts" type="checkbox"> Kennzahlen</label>
        <label><input id="pr-lands" type="checkbox" checked> Meere, Gebirge</label>
      </div>
      <label>Titel<input id="pr-title" type="text"></label>
      <div class="row"><button class="main" id="pr-go">Neu zeichnen</button></div>
      <div class="row"><button id="pr-pdf" disabled>PDF speichern</button><button id="pr-save" disabled>PNG speichern</button></div>
      <p class="msg" id="pr-msg"></p>
      <p class="msg">Namen, Norden, Gradnetz, Rahmen, Titel: sofort. Format bis Kennzahlen: neue Karte über „Änderungen anwenden“. Monat, Jahr, Farbe, Relief und Grenzen kommen aus der Karte.</p>
      <div class="row"><button id="pr-close">Schließen</button></div>
    </aside><main id="pr-view"></main><div id="pr-busy" hidden><i></i><div><span id="pr-step"></span><b id="pr-bar"><s></s></b></div></div>`;
  document.body.appendChild(dlg);
  preview = dlg.querySelector('#pr-view');
  const v = (id) => dlg.querySelector('#pr-' + id);
  v('lw').oninput = () => { v('lw').title = 'Linienstärke × ' + fmt.format(+v('lw').value) + ' (1 = wie auf dem Bildschirm)'; };
  v('lw').oninput();
  // settings that need a new map (slow) and those drawn over it (instant)
  const HEAVY = ['fmt', 'dpi', 'frame', 'bg', 'lw', 'months', 'facts'];
  const read = (k) => { const el = v(k); return el.type === 'checkbox' ? el.checked : el.type === 'range' || k === 'dpi' ? +el.value : el.value; };
  const readLight = () => ({labels: read('labels'), north: read('north'), grid: read('grid'), inset: read('inset'), neat: read('neat'), lands: read('lands'), title: read('title')});
  const readHeavy = () => Object.fromEntries(HEAVY.map((k) => [k, k === 'months' ? read(k) && !!(S.meta && S.meta.months) : read(k)]));
  let pending = false;
  const setPending = (on) => { pending = on; v('go').textContent = on ? 'Änderungen anwenden' : 'Neu zeichnen'; v('go').classList.toggle('hot', on); };
  // one sheet at a time; a change during a run draws once more afterwards with the latest settings
  let busy = false, again = null;
  async function draw(heavy) {
    if (busy) { again = heavy || again || 'light'; return; }
    busy = true;
    if (heavy) { Object.assign(P, readHeavy()); setPending(false); }
    Object.assign(P, readLight());
    if (heavy === 'fresh') cache.map = cache.months = null;   // new particles, new month maps
    const msg = v('msg');
    msg.textContent = 'Karte wird gezeichnet …'; preview.classList.add('busy');
    const t0 = performance.now(), slow = setTimeout(() => { v('busy').hidden = false; }, 150);
    step('Grundkarte und Relief …', 0);
    try {
      sheet = await makeSheet();
      preview.replaceChildren(sheet.canvas);
      v('save').disabled = false; v('pdf').disabled = false;
      msg.textContent = `${sheet.canvas.width} × ${sheet.canvas.height} px, ${((performance.now() - t0) / 1000).toFixed(1)} s.`;
      try { localStorage.setItem('druckblatt', JSON.stringify({...P, title: ''})); } catch (e) { /* storage blocked */ }
    } catch (e) { msg.textContent = 'Fehler: ' + e.message; console.error(e); }
    clearTimeout(slow); preview.classList.remove('busy'); v('busy').hidden = true;
    busy = false;
    if (again) { const a = again; again = null; draw(a === 'light' ? null : a); }
  }
  // light settings at once; heavy ones wait for the button
  dlg.querySelector('aside').addEventListener('change', (e) => {
    const id = e.target.id && e.target.id.replace('pr-', '');
    if (!id || !e.target.matches('select, input')) return;
    if (HEAVY.includes(id)) setPending(JSON.stringify(readHeavy()) !== JSON.stringify(Object.fromEntries(HEAVY.map((k) => [k, P[k]]))));
    else draw();
  });
  // opening draws the sheet right away with the last settings (the map may have changed since)
  open.onclick = () => {
    dlg.hidden = false;
    v('title').value = (S.meta && S.meta.name) || '';
    v('months').disabled = !(S.meta && S.meta.months);
    preview.replaceChildren();
    draw('fresh');
  };
  v('close').onclick = () => { dlg.hidden = true; };
  v('go').onclick = () => draw(pending ? 'apply' : 'fresh');
  const fileName = (ext) => `${(S.meta && S.meta.name || 'karte').toLowerCase()}-${P.fmt}-${P.bg}-${P.dpi}dpi.${ext}`;
  v('save').onclick = () => {
    const a = document.createElement('a');
    a.download = fileName('png'); a.href = sheet.canvas.toDataURL('image/png'); a.click();
  };
  v('pdf').onclick = async () => {
    const msg = v('msg'), was = msg.textContent;
    v('pdf').disabled = true; msg.textContent = 'PDF wird erstellt …'; v('busy').hidden = false; step('PDF wird erstellt …', 0.5);
    try { (await makePdf(sheet)).save(fileName('pdf')); msg.textContent = was; } catch (e) { msg.textContent = 'Fehler: ' + e.message; console.error(e); }
    v('pdf').disabled = false; v('busy').hidden = true;
  };
  // the last settings of this browser (not the title: that is the river's name)
  try {
    const s = JSON.parse(localStorage.getItem('druckblatt') || 'null');
    if (s) for (const [key, val] of Object.entries(s)) {
      const el = v(key);
      if (!el || key === 'title') continue;
      if (el.type === 'checkbox') el.checked = !!val; else el.value = String(val);
    }
    v('lw').oninput();
  } catch (e) { /* storage blocked */ }
}
const once = (m, ev) => new Promise((r) => m.once(ev, r));
// names of seas and landscapes (pipeline/landscape_labels.py), loaded once
let landList = null;
async function landNames() {
  if (!landList) landList = await (await fetch('data/landschaften.json')).json();
  return landList;
}
// the current step and its share of the work in the progress box over the sheet
const step = (t, f) => {
  const e = document.getElementById('pr-step'), b = document.querySelector('#pr-bar s');
  if (e) e.textContent = t;
  if (b && f != null) b.style.width = `${Math.round(f * 100)}%`;
};
/* Captures kept between sheets: a new one only when what it depends on changed.
 * Light settings (names, north, grid, frame, title) then only redraw the overlay. */
const cache = {map: null, inset: null, months: null};
async function cached(slot, key, make) {
  const k = JSON.stringify(key);
  if (cache[slot] && cache[slot].key === k) return cache[slot].val;
  const val = await make();
  cache[slot] = {key: k, val};
  return val;
}
/* Web Mercator of a captured view (no bearing, no pitch), independent of the
 * hidden map, which is removed after the capture. 512 px tiles as in MapLibre. */
function projector(center, zoom, cssW, cssH, ratio) {
  const scale = 512 * Math.pow(2, zoom);
  const wx = (lon) => (lon + 180) / 360 * scale;
  const wy = (lat) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale; };
  const cx = wx(center.lng), cy = wy(center.lat);
  return {
    proj: (lon, lat) => [(wx(lon) - cx + cssW / 2) * ratio, (wy(lat) - cy + cssH / 2) * ratio],
    unproj: (x, y) => {
      const X = x / ratio - cssW / 2 + cx, Y = y / ratio - cssH / 2 + cy;
      const lng = X / scale * 360 - 180, n = Math.PI - 2 * Math.PI * Y / scale;
      return {lng, lat: 180 / Math.PI * Math.atan(Math.sinh(n))};
    },
  };
}

// the light base maps: Positron with only land, water and (if on) borders, plus our relief
let positron = null;
async function styleFor() {
  if (!T.light) return map.getStyle();
  if (!positron) positron = await (await fetch(POSITRON)).json();
  const st = JSON.parse(JSON.stringify(positron)), borders = basemapState().borders, relief = basemapState().relief;
  st.layers = st.layers.filter((l) => {
    if (l.type === 'background') { l.paint = {'background-color': T.land}; return true; }
    if (l.type === 'fill' && /water/.test(l.id)) { l.paint = {'fill-color': T.sea, 'fill-antialias': true}; return true; }
    if (borders && l.type === 'line' && l['source-layer'] === 'boundaries' && /country|admin_0|boundary_country/.test(l.id)) {
      l.paint = {...l.paint, 'line-color': T.border}; return true; }
    return false;
  });
  if (relief) {
    st.sources.dem = {type: 'raster-dem', tiles: [DEM], tileSize: 256, maxzoom: 15, encoding: 'terrarium'};
    const at = st.layers.findIndex((l) => l.type === 'line');
    st.layers.splice(at < 0 ? st.layers.length : at, 0, {id: 'relief', type: 'hillshade', source: 'dem', paint: {
      'hillshade-exaggeration': 0.45, 'hillshade-illumination-direction': 315,
      'hillshade-shadow-color': T.shadow, 'hillshade-highlight-color': T.highlight, 'hillshade-accent-color': T.accent}});
  }
  return st;
}

// a hidden MapLibre map; `place` sets the camera
async function hiddenMap(cssW, cssH, ratio, style, place) {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-30000px;top:0;width:${cssW}px;height:${cssH}px;`;
  document.body.appendChild(box);
  const m = new maplibregl.Map({container: box, style, pixelRatio: ratio, interactive: false,
    attributionControl: false, fadeDuration: 0, canvasContextAttributes: {preserveDrawingBuffer: true}});
  try {
    await once(m, 'load');
    place(m);
    await once(m, 'idle');
    const base = document.createElement('canvas'); base.width = m.getCanvas().width; base.height = m.getCanvas().height;
    base.getContext('2d').drawImage(m.getCanvas(), 0, 0);
    return {base, center: m.getCenter(), zoom: m.getZoom()};
  } finally { m.remove(); box.remove(); }
}

/* deck.gl shots of one view: one canvas per layer set (a function, called just
 * before its shot, so it can change state.month). One Deck for all shots. */
function deckShots(cssW, cssH, ratio, center, zoom, sets) {
  return new Promise((resolve, reject) => {
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:-30000px;top:0;width:${cssW}px;height:${cssH}px;`;
    const cv = document.createElement('canvas'); box.appendChild(cv); document.body.appendChild(box);
    const out = []; let i = 0, frames = 0;
    const d = new deck.Deck({canvas: cv, width: cssW, height: cssH, useDevicePixels: ratio, controller: false,
      viewState: {longitude: center.lng, latitude: center.lat, zoom, pitch: 0, bearing: 0},
      layers: sets[0](),
      onError: (e) => { box.remove(); reject(e); },
      onAfterRender: () => {
        // a few frames until the buffers are filled, then copy while the drawing buffer is valid
        if (++frames < 4) { d.redraw('print'); return; }
        const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
        c.getContext('2d').drawImage(cv, 0, 0); out.push(c);
        frames = 0;
        if (++i >= sets.length) { d.finalize(); box.remove(); resolve(out); return; }
        d.setProps({layers: sets[i]()});
      }});
  });
}

// the app's river layers; on light paper recoloured with the light scale
function riverLayers() {
  const ls = layers(true).filter(Boolean);
  if (!T.light) return ls;
  return ls.map((l) => l.clone({
    getColor: l.id === 'flow' ? (d) => [...lightColor(d), alphaOf(qOf(d))] : (d) => [...lightColor(d), 120],
    updateTriggers: {...l.props.updateTriggers, getColor: [P.bg, state.month, state.year, state.color]},
  }));
}
// small month maps: the network only, line width and colour of that month
function monthLayer(k) {
  return new PathLayer({id: 'month-' + k, data: S.rivers, getPath: (d) => d.path, positionFormat: 'XY',
    getWidth: (d) => widthOf(qOf(d)) * 0.75, widthUnits: 'pixels',
    getColor: (d) => (T.light ? [...lightColor(d), alphaOf(qOf(d))] : (state.color === 't' ? tempColor(tOf(d), alphaOf(qOf(d))) : dischargeColor(qOf(d), alphaOf(qOf(d))))),
    capRounded: true, jointRounded: true});
}

/* The map box in sheet pixels -> base and rivers. The CSS size is chosen so the
 * basin is as many CSS pixels wide as on screen: then the pixel line widths of
 * the app look the same on paper (× P.lw). */
async function captureMap(wPx, hPx, style) {
  const [w, s, e, n] = S.meta.bounds, A = map.project([w, n]), B = map.project([e, s]);
  const screenW = P.frame === 'screen' ? map.getContainer().clientWidth
    : Math.max((B.x - A.x) / 0.93, (B.y - A.y) / 0.93 * (wPx / hPx));
  const cssW = Math.round(Math.min(wPx, Math.max(400, screenW / P.lw))), ratio = wPx / cssW, cssH = Math.round(hPx / ratio);
  const h = await hiddenMap(cssW, cssH, ratio, style, (m) => {
    if (P.frame === 'screen') { const b = map.getBounds(); m.fitBounds([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]], {duration: 0}); }
    else m.fitBounds([[w, s], [e, n]], {duration: 0, padding: Math.round(cssW * 0.035)});
  });
  step('Flüsse und Teilchen …', 0.35);
  const [rivers] = await deckShots(cssW, cssH, ratio, h.center, h.zoom, [riverLayers]);
  return {base: h.base, rivers, w: h.base.width, h: h.base.height, ...projector(h.center, h.zoom, cssW, cssH, ratio)};
}
// around the sheet's own extent, so a wide screen view still fits in the overview
async function captureInset(wPx, hPx, style, [w, s, e, n]) {
  const ratio = 2;
  const h = await hiddenMap(Math.round(wPx / ratio), Math.round(hPx / ratio), ratio, style, (m) => {
    const cam = m.cameraForBounds([[w, s], [e, n]]);
    m.jumpTo({center: cam.center, zoom: Math.max(0, cam.zoom - 2.6)});
  });
  return {base: h.base, ...projector(h.center, h.zoom, Math.round(wPx / ratio), Math.round(hPx / ratio), ratio)};
}
// twelve small maps: one base, one deck shot per month
async function captureMonths(wPx, hPx, style) {
  const [w, s, e, n] = S.meta.bounds, ratio = 2, cssW = Math.round(wPx / ratio), cssH = Math.round(hPx / ratio);
  const h = await hiddenMap(cssW, cssH, ratio, style, (m) => m.fitBounds([[w, s], [e, n]], {duration: 0, padding: 4}));
  const keep = state.month, n12 = S.meta.months.length;
  try {
    const shots = await deckShots(cssW, cssH, ratio, h.center, h.zoom,
      Array.from({length: n12}, (_, k) => () => { state.month = k; step(`Zwölf Monate … ${k + 1} / ${n12}`, 0.6 + 0.35 * k / n12); return [monthLayer(k)]; }));
    return {base: h.base, shots};
  } finally { state.month = keep; }
}

function haversineKm(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- river names along the river ---------- */
// the reach a label belongs to: the nearest one of about the label's discharge
function reachOf(l) {
  let best = null, bd = Infinity;
  for (const r of S.rivers) {
    if (r.q < l.q * 0.4) continue;
    const p = r.path;
    for (let k = 0; k < p.length; k += 2) {
      const d = (p[k] - l.lon) ** 2 + (p[k + 1] - l.lat) ** 2;
      if (d < bd) { bd = d; best = r; }
    }
  }
  return best;
}
// a long line through the label: upstream along the largest inflow, downstream along `down`
function lineThrough(r, steps, up) {
  const chain = [r];
  for (let x = up.get(r), i = 0; x && i < steps; x = up.get(x), i++) chain.unshift(x);
  for (let x = r.down, i = 0; x && i < steps; x = x.down, i++) chain.push(x);
  const pts = [];
  for (const x of chain) for (let k = 0; k < x.path.length; k += 2) pts.push([x.path[k], x.path[k + 1]]);
  return pts;
}
function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay);
    let s = step - carry;
    while (s <= L) { out.push([ax + (bx - ax) * s / L, ay + (by - ay) * s / L]); s += step; }
    carry = L - (s - step);
  }
  return out;
}
function smooth(pts, k) {
  return pts.map((_, i) => {
    let x = 0, y = 0, n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) { x += pts[j][0]; y += pts[j][1]; n++; }
    return [x / n, y / n];
  });
}
/* A name along the river. Tried at several places along the line; a place is
 * taken only if every letter is inside the frame (`inside`), the line bends
 * little under the name, and no letter comes near an earlier name (`taken`,
 * circles of placed letters). The name reads left to right, and bottom to top
 * where the river runs almost vertically. Returns false if no place fits. */
function textAlong(x, pts, text, center, spacing, size, step, inside, taken) {
  const widths = [...text].map((c) => x.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  const rev = pts.slice().reverse(), len = (pts.length - 1) * step;
  const atOn = (P, d) => { const f = Math.min(Math.max(d, 0), len) / step, i = Math.min(P.length - 2, Math.floor(f)), t = f - i;
    return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; };
  const placeOn = (P, c0) => {
    let s = c0 - total / 2;
    if (s < 0 || s + total > len) return null;   // line too short here
    const a = atOn(P, s), b = atOn(P, s + total), dx = b[0] - a[0], dy = b[1] - a[1];
    const vertical = Math.abs(dx) < Math.abs(dy) * 0.35;
    if (vertical ? dy > 0 : dx < 0) return 'flip';
    const gs = [...text].map((c, k) => {
      const mid = s + (widths[k] - spacing) / 2, p = atOn(P, mid), q1 = atOn(P, mid - size * 0.7), q2 = atOn(P, mid + size * 0.7);
      s += widths[k];
      return {c, p, ang: Math.atan2(q2[1] - q1[1], q2[0] - q1[0])};
    });
    // not too curved: small turns from letter to letter and in all
    let turn = 0;
    for (let k = 1; k < gs.length; k++) {
      let d = gs[k].ang - gs[k - 1].ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.45) return null;
      turn += d;
    }
    if (Math.abs(turn) > 1.1) return null;
    // no letter upside down (a loop of the river under the name)
    if (gs.some((g) => Math.cos(g.ang) < -0.3 || (Math.cos(g.ang) < 0.2 && Math.sin(g.ang) > 0))) return null;
    if (!gs.every((g) => inside(g.p[0], g.p[1]))) return null;
    const r = size * 0.55;
    if (gs.some((g) => taken.some((o) => (o.x - g.p[0]) ** 2 + (o.y - g.p[1]) ** 2 < (o.r + r) ** 2))) return null;
    return gs;
  };
  let glyphs = null;
  for (const f of [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2, -3, 3]) {
    const c0 = center + f * total;
    let g = placeOn(pts, c0);
    if (g === 'flip') g = placeOn(rev, len - c0);
    if (g && g !== 'flip') { glyphs = g; break; }
  }
  if (!glyphs) return false;
  for (const g of glyphs) taken.push({x: g.p[0], y: g.p[1], r: size * 0.55});
  for (const pass of ['stroke', 'fill']) for (const g of glyphs) {
    x.save(); x.translate(g.p[0], g.p[1]); x.rotate(g.ang);
    if (pass === 'stroke') x.strokeText(g.c, 0, -size * 0.35); else x.fillText(g.c, 0, -size * 0.35);
    x.restore();
  }
  return true;
}
/* All text goes through this wrapper of the sheet's 2D context: it is not
 * drawn but recorded (string, position, font, colour, transform), so the PDF
 * can set it as real text over the map image and the preview draws the same
 * records onto a copy. Everything else passes straight to the context. */
function textRecorder(ctx, recs) {
  return new Proxy(ctx, {
    get(t, p) {
      if (p === 'fillText' || p === 'strokeText') {
        return (s, X, Y) => recs.push({op: p, s: String(s), X, Y, font: t.font, align: t.textAlign, lw: t.lineWidth,
          color: p === 'fillText' ? t.fillStyle : t.strokeStyle, m: t.getTransform()});
      }
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, p, val) { t[p] = val; return true; },
  });
}
function replayText(cv, recs) {
  const x = cv.getContext('2d');
  for (const r of recs) {
    x.setTransform(r.m); x.font = r.font; x.textAlign = r.align; x.lineWidth = r.lw; x.lineJoin = 'round';
    if (r.op === 'fillText') { x.fillStyle = r.color; x.fillText(r.s, r.X, r.Y); } else { x.strokeStyle = r.color; x.strokeText(r.s, r.X, r.Y); }
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
}

// "#rrggbb" or "rgba(r, g, b, a)" over the paper colour -> opaque [r, g, b]
function solid(c, paper) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const bg = hex(paper);
  if (c[0] === '#') return hex(c);
  const n = c.match(/[\d.]+/g).map(Number), a = n.length > 3 ? n[3] : 1;
  return [0, 1, 2].map((i) => Math.round(n[i] * a + bg[i] * (1 - a)));
}
let jsPDFLib = null;
function loadPdfLib() {
  if (jsPDFLib) return Promise.resolve(jsPDFLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/jspdf-2.5.2/jspdf.umd.min.js';
    s.onload = () => { jsPDFLib = window.jspdf.jsPDF; resolve(jsPDFLib); };
    s.onerror = () => reject(new Error('jsPDF konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}
/* PDF: the sheet without text as one JPEG, all text on top as PDF text in the
 * standard fonts (Helvetica, Times italic), so it stays sharp and searchable. */
async function makePdf(sheet) {
  const JsPDF = await loadPdfLib();
  const [Wmm, Hmm] = SHEETS[sheet.fmt], k = sheet.dpi / 25.4;
  const doc = new JsPDF({orientation: sheet.fmt === 'quer' ? 'landscape' : 'portrait', unit: 'mm', format: 'a3', compress: true});
  doc.addImage(sheet.bare.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, Wmm, Hmm, undefined, 'FAST');
  for (const r of sheet.texts) {
    const f = r.font, sizePx = parseFloat(f.match(/([\d.]+)px/)[1]);
    const serif = /Georgia|Times/.test(f);
    const bold = /\b(600|700|bold)\b/.test(f), italic = /italic/.test(f);
    doc.setFont(serif ? 'times' : 'helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
    doc.setFontSize(sizePx / k * 72 / 25.4);
    const m = r.m, X = (m.a * r.X + m.c * r.Y + m.e) / k, Y = (m.b * r.X + m.d * r.Y + m.f) / k;
    const ang = Math.atan2(m.b, m.a), w = doc.getTextWidth(r.s);
    const shift = r.align === 'center' ? w / 2 : r.align === 'right' ? w : 0;
    const x0 = X - shift * Math.cos(ang), y0 = Y - shift * Math.sin(ang);
    const col = solid(r.color, sheet.paper);
    const opts = {angle: -ang * 180 / Math.PI, baseline: 'alphabetic'};
    if (r.op === 'strokeText') {
      doc.setDrawColor(...col); doc.setLineWidth(r.lw / k); doc.setLineJoin('round');
      doc.text(r.s, x0, y0, {...opts, renderingMode: 'stroke'});
    } else { doc.setTextColor(...col); doc.text(r.s, x0, y0, opts); }
  }
  return doc;
}

async function makeSheet() {
  T = THEMES[P.bg];
  step('Grundkarte und Relief …', 0.05);
  const style = await styleFor();
  const [Wmm, Hmm] = SHEETS[P.fmt], k = P.dpi / 25.4, px = (mm) => Math.round(mm * k);
  const hoch = P.fmt === 'hoch', pad = 14, head = hoch ? 34 : 24, foot = hoch ? 22 : 18;
  const cols = hoch ? 4 : 12, gapM = hoch ? 4 : 2.5;
  const miniW = (Wmm - 2 * pad - (cols - 1) * gapM) / cols, miniH = miniW * (hoch ? 0.56 : 0.58);
  // under the map: the outer frame, the degree labels, a gap, then months, figures and the foot (legend, sources)
  const gapH = 1.6 + 5 + 4;   // the same with or without double frame and degree labels: those only redraw the overlay
  const monthsH = P.months ? (hoch ? 3 : 1) * (miniH + 6) + 4 : 0, factsH = P.facts ? 13 : 0;
  const mapX = px(pad), mapY = px(pad + head), mapW = px(Wmm - 2 * pad), mapH = px(Hmm - 2 * pad - head - foot - gapH - monthsH - factsH);
  // the map: new only when its size, style, view, river or the map's month, year and colour changed
  const bm = basemapState(), view = P.frame === 'screen' ? map.getBounds().toArray().flat().map((n) => +n.toFixed(4)) : null;
  const cap = await cached('map', [P.fmt, P.dpi, P.frame, P.bg, P.lw, mapW, mapH, S.meta.name, S.meta.bounds, state.month, state.year, state.color, bm, view],
    () => captureMap(mapW, mapH, style));
  const cv = document.createElement('canvas'); cv.width = px(Wmm); cv.height = px(Hmm);
  const texts = [], x = textRecorder(cv.getContext('2d'), texts);
  x.fillStyle = T.paper; x.fillRect(0, 0, cv.width, cv.height);
  x.drawImage(cap.base, mapX, mapY, mapW, mapH);
  x.drawImage(cap.rivers, mapX, mapY, mapW, mapH);
  const sx = mapW / cap.w;   // capture px -> sheet px
  const at = (lon, lat) => { const [a, b] = cap.proj(lon, lat); return [mapX + a * sx, mapY + b * sx]; };
  const inMap = (X, Y, m = 0) => X > mapX + m && X < mapX + mapW - m && Y > mapY + m && Y < mapY + mapH - m;
  const nw = cap.unproj(0, 0), se = cap.unproj(cap.w, cap.h);
  const thin = Math.max(1, px(0.25));

  // degree grid
  const span = Math.max(se.lng - nw.lng, nw.lat - se.lat);
  const gstep = span > 40 ? 10 : span > 16 ? 5 : span > 7 ? 2 : 1;
  const lons = [], lats = [];
  for (let lo = Math.ceil(nw.lng / gstep) * gstep; lo <= se.lng; lo += gstep) lons.push(lo);
  for (let la = Math.ceil(se.lat / gstep) * gstep; la <= nw.lat; la += gstep) lats.push(la);
  if (P.grid === 'linien') {
    x.save(); x.beginPath(); x.rect(mapX, mapY, mapW, mapH); x.clip();
    x.strokeStyle = T.light ? 'rgba(28,38,43,.18)' : 'rgba(232,238,243,.16)'; x.lineWidth = thin; x.setLineDash([px(1.2), px(1.2)]);
    for (const lo of lons) { const [X] = at(lo, 0); x.beginPath(); x.moveTo(X, mapY); x.lineTo(X, mapY + mapH); x.stroke(); }
    for (const la of lats) { const [, Y] = at(0, la); x.beginPath(); x.moveTo(mapX, Y); x.lineTo(mapX + mapW, Y); x.stroke(); }
    x.restore();
  }

  // river names
  const taken = [];   // letters already placed: big rivers first, the rest must keep clear
  if (P.labels !== 'off' && S.meta.labels) {
    x.lineJoin = 'round';
    const up = new Map();
    for (const r of S.rivers) if (r.down && (!up.has(r.down) || up.get(r.down).q < r.q)) up.set(r.down, r);
    for (const l of [...S.meta.labels].sort((a, b) => (b.main - a.main) || (b.q - a.q))) {
      const [X, Y] = at(l.lon, l.lat);
      if (!inMap(X, Y, px(6))) continue;
      if (P.labels === 'app') {
        x.textAlign = 'center'; x.font = `600 ${px(l.main ? 5.2 : 3.6)}px ${FONT}`;
        const half = x.measureText(l.name).width / 2, X2 = Math.min(Math.max(X, mapX + half + px(2)), mapX + mapW - half - px(2));
        x.lineWidth = px(1); x.strokeStyle = T.halo; x.strokeText(l.name, X2, Y - px(2.6));
        x.fillStyle = l.main ? T.name : T.name2; x.fillText(l.name, X2, Y - px(2.6));
        continue;
      }
      // kartografisch: italic serif, spaced, following the smoothed course of the river
      const size = px(l.main ? 6.4 : Math.min(5, 3.4 + 0.7 * (Math.log10(Math.max(l.q, 100)) - 2)));
      const text = l.main ? l.name.toUpperCase() : l.name, spacing = size * (l.main ? 0.42 : 0.14);
      x.font = `italic 400 ${size}px ${SERIF}`; x.textAlign = 'center';
      x.lineWidth = size * 0.28; x.strokeStyle = T.halo;
      x.fillStyle = l.main ? T.name : T.name2;
      const r = reachOf(l); let ok = false;
      if (r) {
        const stepPx = size * 0.25;
        let pts = lineThrough(r, 60, up).map(([lo, la]) => at(lo, la));
        // smoothed twice over about four letter heights: the name follows the course, not every meander
        // and resampled again: smoothing pulls points together in bends, letters need true distances
        pts = resample(smooth(smooth(resample(pts, stepPx), Math.round(size * 2 / stepPx)), Math.round(size * 2 / stepPx)), stepPx);
        let bi = 0, bd = Infinity;
        pts.forEach((p, i) => { const d = (p[0] - X) ** 2 + (p[1] - Y) ** 2; if (d < bd) { bd = d; bi = i; } });
        ok = textAlong(x, pts, text, bi * stepPx, spacing, size, stepPx, (a, b) => inMap(a, b, size * 0.6), taken);
      }
      if (ok !== true) {   // no calm stretch along the river: straight, inside the frame, if it is free there
        const w2 = x.measureText(text).width / 2, X2 = Math.min(Math.max(X, mapX + w2 + px(2)), mapX + mapW - w2 - px(2)), Y2 = Y - size * 0.5;
        const box = {x0: X2 - w2, x1: X2 + w2, y0: Y2 - size * 0.8, y1: Y2 + size * 0.2};
        const hit = taken.some((o) => o.x + o.r > box.x0 && o.x - o.r < box.x1 && o.y + o.r > box.y0 && o.y - o.r < box.y1);
        if (hit) continue;
        x.strokeText(text, X2, Y2); x.fillText(text, X2, Y2);
        for (let cx = box.x0; cx <= box.x1; cx += size * 0.5) taken.push({x: cx, y: Y2 - size * 0.3, r: size * 0.55});
      }
    }
  }

  // seas, gulfs, mountains, plateaus …: Natural Earth names after the rivers, where there is room.
  // Water in spaced italics, land in spaced capitals; more and smaller names on a larger scale.
  if (P.lands) {
    const L = await landNames(), span = Math.max(se.lng - nw.lng, nw.lat - se.lat);
    const maxRank = span > 60 ? 2 : span > 30 ? 3 : span > 14 ? 4 : 5;
    // corners kept free: compass, scale bar, overview map
    const blocked = [[mapX + mapW - px(28), mapY, mapX + mapW, mapY + px(30)], [mapX, mapY + mapH - px(18), mapX + px(95), mapY + mapH],
      P.inset ? [mapX + mapW - px(hoch ? 60 : 54), mapY + mapH - px(hoch ? 42 : 38), mapX + mapW, mapY + mapH] : [0, 0, 0, 0]];
    const free = (b) => !taken.some((o) => o.x + o.r > b[0] && o.x - o.r < b[2] && o.y + o.r > b[1] && o.y - o.r < b[3]) &&
      !blocked.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
    x.textAlign = 'left'; x.lineJoin = 'round';
    for (const f of L) {
      if (f.r > maxRank) continue;
      // plains and vague regions would sit on the river network itself: only deltas
      if ((f.k === 'ebene' || f.k === 'region') && !/delta/i.test(f.n)) continue;
      const water = ['meer', 'bucht', 'strasse'].includes(f.k);
      const size = px(Math.max(water ? 2.8 : 2.4, (water ? 5.4 : 3.6) - (water ? 0.5 : 0.25) * (f.r - 1) + (f.r <= maxRank - 2 ? 0.6 : 0)));
      const text = water ? f.n : f.n.toUpperCase(), sp = size * (water ? 0.12 : 0.38);
      x.font = water ? `italic 400 ${size}px ${SERIF}` : `500 ${size}px ${FONT}`;
      const ws = [...text].map((c) => x.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
      for (const [lo, la] of f.p) {
        const [cx, cy] = at(lo, la), X0 = cx - tw / 2, b = [X0, cy - size * 0.85, X0 + tw, cy + size * 0.25];
        if (b[0] < mapX + px(4) || b[2] > mapX + mapW - px(4) || b[1] < mapY + px(4) || b[3] > mapY + mapH - px(4) || !free(b)) continue;
        x.lineWidth = size * 0.25; x.strokeStyle = T.halo;
        x.fillStyle = water ? (T.light ? 'rgba(52,94,124,.85)' : 'rgba(140,186,214,.8)') : (T.light ? 'rgba(40,46,50,.55)' : 'rgba(225,232,238,.5)');
        let X = X0;
        for (const pass of [0, 1]) { X = X0; [...text].forEach((c, i) => { if (pass) x.fillText(c, X, cy); else if (T.light) x.strokeText(c, X, cy); X += ws[i] + sp; }); }
        for (let tx = b[0]; tx <= b[2]; tx += size * 0.5) taken.push({x: tx, y: cy - size * 0.3, r: size * 0.6});
        break;
      }
    }
  }

  // frame (double: a thin inner line and a heavier outer one)
  x.strokeStyle = T.frame; x.lineWidth = thin;
  x.strokeRect(mapX + .5, mapY + .5, mapW - 1, mapH - 1);
  if (P.neat) { const g = px(1.6); x.lineWidth = px(0.6); x.strokeStyle = T.ink; x.strokeRect(mapX - g, mapY - g, mapW + 2 * g, mapH + 2 * g); }
  if (P.grid !== 'off') {
    x.fillStyle = T.ink2; x.strokeStyle = T.frame; x.lineWidth = thin; x.font = `${px(2.5)}px ${FONT}`;
    const o = P.neat ? px(1.6) : 0;
    for (const lo of lons) { const [X] = at(lo, 0); x.beginPath(); x.moveTo(X, mapY + mapH); x.lineTo(X, mapY + mapH - px(2)); x.moveTo(X, mapY); x.lineTo(X, mapY + px(2)); x.stroke();
      x.textAlign = 'center'; x.fillText(`${Math.abs(lo)}°${lo >= 0 ? 'O' : 'W'}`, X, mapY + mapH + o + px(3.6)); }
    for (const la of lats) { const [, Y] = at(0, la); x.beginPath(); x.moveTo(mapX, Y); x.lineTo(mapX + px(2), Y); x.moveTo(mapX + mapW, Y); x.lineTo(mapX + mapW - px(2), Y); x.stroke();
      x.textAlign = 'left'; x.fillText(`${Math.abs(la)}°${la >= 0 ? 'N' : 'S'}`, mapX + mapW + o + px(1.2), Y + px(0.9)); }
  }
  // north
  if (P.north !== 'off') {
    const cx = mapX + mapW - px(14), cy = mapY + px(15), r = px(P.north === 'ring' ? 9 : 6);
    x.fillStyle = T.ink; x.strokeStyle = T.ink;
    if (P.north === 'ring') {
      x.lineWidth = px(0.5); x.beginPath(); x.arc(cx, cy, r, 0, 2 * Math.PI); x.stroke();
      for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36, L = i % 18 === 0 ? px(2.2) : i % 2 ? px(0.6) : px(1.1);
        x.lineWidth = i % 18 === 0 ? px(0.35) : px(0.15);
        x.beginPath(); x.moveTo(cx + Math.sin(a) * (r - px(0.6)), cy - Math.cos(a) * (r - px(0.6))); x.lineTo(cx + Math.sin(a) * (r - px(0.6) - L), cy - Math.cos(a) * (r - px(0.6) - L)); x.stroke(); }
      x.beginPath(); x.moveTo(cx, cy - r + px(3.2)); x.lineTo(cx + px(1.1), cy); x.lineTo(cx, cy - px(0.8)); x.lineTo(cx - px(1.1), cy); x.closePath(); x.fill();
      x.font = `600 ${px(3)}px ${FONT}`; x.textAlign = 'center'; x.fillText('N', cx, cy - r - px(1.4));
      x.fillStyle = T.ink2; x.font = `${px(2.2)}px ${FONT}`;
      x.fillText('S', cx, cy + r - px(3.4)); x.fillText('O', cx + r - px(4), cy + px(0.8)); x.fillText('W', cx - r + px(4), cy + px(0.8));
    } else {
      x.lineWidth = px(0.3);
      x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r * .38, cy + r * .62); x.lineTo(cx, cy + r * .3); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx - r * .38, cy + r * .62); x.lineTo(cx, cy + r * .3); x.closePath(); x.stroke();
      x.font = `600 ${px(3.2)}px ${FONT}`; x.textAlign = 'center'; x.fillText('N', cx, cy - r - px(1.4));
    }
  }
  // scale bar, true at the centre latitude
  { const c1 = cap.unproj(cap.w / 2, cap.h / 2), c2 = cap.unproj(cap.w / 2 + 100, cap.h / 2);
    const kmPerSheetPx = haversineKm(c1, c2) / (100 * sx);
    const target = mapW * 0.15 * kmPerSheetPx;
    const nice = [10, 20, 25, 50, 100, 200, 250, 300, 400, 500, 1000].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const len = nice / kmPerSheetPx, bx = mapX + px(8), by = mapY + mapH - px(10), seg = len / 4, bh = px(1.2);
    x.fillStyle = T.ink; x.strokeStyle = T.ink; x.lineWidth = thin;
    for (let i = 0; i < 4; i++) { if (i % 2 === 0) x.fillRect(bx + i * seg, by, seg, bh); x.strokeRect(bx + i * seg, by, seg, bh); }
    x.font = `${px(2.6)}px ${FONT}`; x.textAlign = 'center';
    [0, nice / 2, nice].forEach((v, i) => x.fillText(fmt.format(v), bx + i * len / 2, by - px(1.2)));
    x.textAlign = 'left';
    const denom = kmPerSheetPx * k * 1e6;   // km per mm on paper -> 1 : denom
    x.fillText(`km   1 : ${(denom / 1e6).toLocaleString('de-DE', {maximumFractionDigits: 1})} Mio.`, bx + len + px(1.5), by + bh);
    x.fillStyle = T.ink2; x.font = `${px(2.2)}px ${FONT}`;
    x.fillText(`Maßstab gilt bei ${fmt.format(Math.round(c1.lat * 10) / 10)}° ${c1.lat >= 0 ? 'N' : 'S'} · Web-Mercator`, bx, by + bh + px(3.2)); }
  // overview map
  if (P.inset) {
    const iw = px(hoch ? 52 : 46), ih = Math.round(iw * 0.68), ix = mapX + mapW - iw - px(5), iy = mapY + mapH - ih - px(5);
    step('Übersichtskarte …', 0.55);
    const ext = [nw.lng, se.lat, se.lng, nw.lat];
    const ins = await cached('inset', [P.bg, iw, ih, ext, bm], () => captureInset(iw, ih, style, ext));
    x.drawImage(ins.base, ix, iy, iw, ih);
    const f = iw / ins.base.width, [ax, ay] = ins.proj(nw.lng, nw.lat), [bx, by] = ins.proj(se.lng, se.lat);
    x.strokeStyle = T.box; x.lineWidth = px(0.45); x.strokeRect(ix + ax * f, iy + ay * f, (bx - ax) * f, (by - ay) * f);
    x.strokeStyle = T.frame; x.lineWidth = thin; x.strokeRect(ix + .5, iy + .5, iw - 1, ih - 1);
  }

  // twelve months under the map
  let yb = mapY + mapH + px(gapH);
  if (P.months) {
    step('Zwölf Monate …', 0.6);
    const mw = px(miniW), mh = px(miniH);
    const mon = await cached('months', [P.bg, P.dpi, mw, mh, S.meta.name, state.year, state.color, bm], () => captureMonths(mw, mh, style));
    S.meta.months.forEach((cal, k) => {
      const c = k % cols, r = Math.floor(k / cols), X = mapX + c * (mw + px(gapM)), Y = yb + r * (mh + px(6));
      x.drawImage(mon.base, X, Y, mw, mh); x.drawImage(mon.shots[k], X, Y, mw, mh);
      x.strokeStyle = T.frame; x.lineWidth = thin; x.strokeRect(X + .5, Y + .5, mw - 1, mh - 1);
      x.fillStyle = T.ink2; x.font = `400 ${px(2.5)}px ${FONT}`; x.textAlign = 'left';
      x.fillText(MONTHS_FULL[cal - 1], X, Y + mh + px(3.4));
    });
    yb += px(monthsH);
  }
  // figures
  if (P.facts) {
    const st = S.meta.stats, f = [
      [`${fmt.format(st.area_km2)} km²`, 'Einzugsgebiet'], [`${fmt.format(Math.round(st.discharge_cms))} m³/s`, 'Abfluss an der Mündung'],
      [`${fmt.format(st.main_length_km)} km`, 'längster Lauf'], [`${fmt.format(Math.round(S.meta.travel_time_h / 24))} Tage`, 'längste Fließzeit'],
      [st.countries ? st.countries.map((c) => c.name.replace('Volksrepublik ', '')).join(', ') : '', 'Länder']];
    let X = mapX; x.textAlign = 'left';
    for (const [val, lab] of f) {
      x.fillStyle = T.ink; x.font = `600 ${px(3.4)}px ${FONT}`; x.fillText(val, X, yb + px(3.4)); const w1 = x.measureText(val).width;
      x.fillStyle = T.ink2; x.font = `${px(2.6)}px ${FONT}`; x.fillText(lab, X, yb + px(7));
      X += Math.max(w1, x.measureText(lab).width) + px(10);
    }
  }

  // header
  const m = curMonth(), y = curYear(), what = state.color === 't' ? 'Wassertemperatur (Schätzung)' : 'Abfluss';
  const when = `${m >= 0 ? MONTHS_FULL[m] : 'Jahresmittel'}${y ? ' ' + y : ''}`;
  x.textAlign = 'left'; x.fillStyle = T.ink; x.font = `700 ${px(hoch ? 16 : 12)}px ${FONT}`;
  x.fillText(P.title || S.meta.name, px(pad), px(pad + (hoch ? 15 : 11)));
  x.fillStyle = T.ink2; x.font = `${px(hoch ? 4.2 : 3.6)}px ${FONT}`;
  x.fillText(`${what} · ${when}`, px(pad), px(pad + (hoch ? 24 : 18)));
  x.textAlign = 'right'; x.font = `${px(3)}px ${FONT}`;
  x.fillText('Flussströmung · Karten & Code', px(Wmm - pad), px(pad + (hoch ? 24 : 18)));

  // legend: the colour scale of the sheet
  { const lx = px(pad), ly = px(Hmm - pad - foot + (hoch ? 9 : 8)), lw = px(70), lh = px(2.2);
    for (let i = 0; i < lw; i++) {
      const f = i / (lw - 1);
      const c = state.color === 't' ? tempColor(f * 30, 255) : T.light ? rampAt(RAMP_LIGHT, f) : dischargeColor(Math.pow(10, f * 4), 255);
      x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(lx + i, ly, 1, lh);
    }
    x.fillStyle = T.ink2; x.font = `${px(2.5)}px ${FONT}`;
    const ticks = state.color === 't' ? ['0', '10', '20', '30 °C'] : ['1', '10', '100', '1.000', '10.000 m³/s'];
    ticks.forEach((t, i) => { x.textAlign = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center'; x.fillText(t, lx + lw * i / (ticks.length - 1), ly + lh + px(3.2)); });
    x.textAlign = 'left'; x.fillStyle = T.ink; x.font = `600 ${px(2.7)}px ${FONT}`;
    x.fillText(`${what} · Linienstärke nach Abfluss`, lx, ly - px(1.6)); }
  // sources
  x.fillStyle = T.ink2; x.font = `${px(2.3)}px ${FONT}`; x.textAlign = 'right';
  const src = ['Flüsse: HydroRIVERS v1.0 (Lehner & Grill 2013)', `Monatswerte: ${S.meta.monthly === 'glofas' ? 'GloFAS-Reanalyse, Copernicus EMS' : 'Modell aus RiverATLAS'}`,
    'Relief: Mapzen Terrain Tiles (AWS Open Data)', 'Grundkarte © CARTO, © OpenStreetMap-Mitwirkende'];
  src.forEach((s, i) => x.fillText(s, px(Wmm - pad), px(Hmm - pad - foot + 7 + i * 3.1)));
  const shown = document.createElement('canvas'); shown.width = cv.width; shown.height = cv.height;
  shown.getContext('2d').drawImage(cv, 0, 0);
  replayText(shown, texts);
  return {canvas: shown, bare: cv, texts, fmt: P.fmt, dpi: P.dpi, paper: T.paper};
}
