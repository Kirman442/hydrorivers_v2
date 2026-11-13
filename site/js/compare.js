/* Vergleich: the basin on the map (A) next to any other (B).
 * Of B only the meta header is read: statistics, climate, profile, hydrographs. */
import {$, esc, sum, avg, fmt, fmt0, titleOf, srcText, iBtn, MONTHS, MONL, MON1, FRESH} from './util.js';
import {S, ui, VIEWS, fileOf, curMonth, curYear} from './store.js';
import {gunzip, readMeta, hydro12} from './data.js';
import {renderList, renderTabs} from './panel.js';
import {renderTimebar} from './timebar.js';
import {openView, setUrl, renderAll} from './load.js';

export const entryOf = (v, s) => ({view: v, slug: VIEWS[v].catalog ? s : null, url: fileOf(v, s)});
export function chooseCompare(entry) {
  const token = ++S.cmpToken;
  return fetch(entry.url, FRESH)
    .then((r) => { if (!r.ok) throw new Error(`${entry.url}: ${r.status}`); return entry.url.endsWith('.bin') ? r.arrayBuffer().then(gunzip) : r.json(); })
    .then((d) => {
      if (token !== S.cmpToken) return;
      S.cmpB = {meta: d instanceof ArrayBuffer ? readMeta(d) : d.meta, entry};
      ui.picking = false;
      renderCompare();
      renderTimebar();
      renderTabs();
      setUrl();
    })
    .catch((e) => console.warn('compare', e));
}

const CMP = [
  ['area', 'Einzugsgebiet', 'km²', (m) => m.stats && m.stats.area_km2, fmt0],
  ['q', 'Abfluss Mündung', 'm³/s', (m) => m.stats && m.stats.discharge_cms, fmt0],
  ['runoff', 'Abflusshöhe', 'mm/Jahr', (m) => m.stats && m.stats.runoff_mm, fmt0],
  ['pre', 'Niederschlag', 'mm/Jahr', (m) => m.climate && sum(m.climate.pre_mm), fmt0],
  ['len', 'Längster Lauf', 'km', (m) => m.stats && m.stats.main_length_km, fmt0],
  ['time', 'Längste Fließzeit', 'Tage', (m) => m.travel_time_h / 24, fmt],
  ['src', 'Quelle des Hauptlaufs', 'm', (m) => m.profile && m.profile.ele[0], fmt0],
  ['air', 'Lufttemperatur', '°C', (m) => m.climate && avg(m.climate.air_c), fmt, 'diff'],
];
function ratioText(a, b, kind, unit, f) {
  if (a == null || b == null) return '';
  if (kind === 'diff') {
    const d = b - a;
    return Math.abs(d) < 1 ? '≈ gleich'
      : `<span style="color:var(--cmp-${d > 0 ? 'b' : 'a'})">${d > 0 ? 'B' : 'A'} ${f.format(Math.abs(d))} ${unit} wärmer</span>`;
  }
  const r = Math.max(a, b) / Math.max(Math.min(a, b), 1e-9);
  if (r < 1.15) return '≈ gleich';
  const who = b > a ? 'b' : 'a';
  return `<span style="color:var(--cmp-${who})">${who.toUpperCase()} ×${r < 10 ? fmt.format(r) : fmt0.format(r)}</span>`;
}

export function renderCompare() {
  const A = S.meta, cmpB = S.cmpB, B = cmpB && cmpB.meta;
  if (!A) return;
  const slot = !B ? 'b' : ui.picking;  // which side the list replaces
  $('pick-a-sub').textContent = `A · ${VIEWS[S.view].catalog ? VIEWS[S.view].label : 'Volles Netz'} · ändern`;
  $('pick-a-name').textContent = titleOf(A);
  $('pick-b-sub').textContent = B ? `B · ${VIEWS[cmpB.entry.view].catalog ? VIEWS[cmpB.entry.view].label : 'Volles Netz'} · ändern` : 'B · auswählen';
  $('pick-b-name').textContent = B ? titleOf(B) : '+ Fluss wählen';
  document.querySelector('.pick.b').classList.toggle('empty', !B);
  document.querySelectorAll('.pick').forEach((p) => p.classList.toggle('sel', p.dataset.slot === slot));
  $('cmp-actions').hidden = !B;
  if (B) $('cmp-open').textContent = `⇄ ${titleOf(B)} auf der Karte`;
  $('picker').hidden = !slot;
  $('picker-close').hidden = !B;
  if (slot) {
    $('picker-head').textContent = slot === 'a' ? `Statt ${titleOf(A)} …` : B ? `Statt ${titleOf(B)} …` : `${titleOf(A)} vergleichen mit …`;
    renderList($('pick-list'), 'pick', (v, s) => {
      const e = entryOf(v, s);
      const isA = v === S.view && e.slug === (VIEWS[S.view].catalog ? S.slug : null);
      const isB = S.cmpB && S.cmpB.entry.view === v && S.cmpB.entry.slug === e.slug;
      if (slot === 'a') { ui.picking = false; if (!isB) openView(v, s); else renderCompare(); }
      else if (!isA) chooseCompare(e);
    });
  }
  $('cmp-body').hidden = !B;
  if (!B) return;
  const nA = titleOf(A), nB = titleOf(B);
  $('cmp-a').textContent = nA;
  $('cmp-b').textContent = nB;

  let rows = '';
  for (const [k, label, unit, get, f, kind] of CMP) {
    const a = get(A), b = get(B);
    if (a == null && b == null) continue;
    const mx = kind === 'diff' ? 0 : Math.max(a || 0, b || 0);
    const w = (v) => (kind === 'diff' || !mx || v == null ? 0 : Math.max(2, 100 * v / mx));
    rows += `<div class="cmp-row"><div class="top"><span class="k">${label}</span>${iBtn(k)}<span class="ratio">${ratioText(a, b, kind, unit, f)}</span></div>
      <div class="bars"><div class="bar a"><i style="width:${w(a)}%"></i><span>${a == null ? '–' : f.format(a)} ${unit}</span></div>
      <div class="bar b"><i style="width:${w(b)}%"></i><span>${b == null ? '–' : f.format(b)} ${unit}</span></div></div></div>`;
  }
  rows += `<div class="cmp-row"><div class="top"><span class="k">Monatswerte</span>${iBtn('monthly')}</div>
    <div class="bars"><div><span class="chip ${A.monthly !== 'model' ? 'g' : ''}">${srcText(A)}</span></div>
    <div><span class="chip ${B.monthly !== 'model' ? 'g' : ''}">${srcText(B)}</span></div></div></div>`;
  $('cmp-rows').innerHTML = rows;
  document.querySelectorAll('#cmp-pct button').forEach((b) => b.classList.toggle('on', (b.dataset.p === '1') === ui.pct));
  drawCompareHydro();

  const W = 268, L = 26, R = 4, pw = W - L - R, step = pw / 12;
  const tick = (y, label) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>` +
    `<text x="${L - 4}" y="${y + 3}" text-anchor="end">${label}</text>`;
  const monthsAx = (H) => MON1.map((m, i) => `<text x="${L + step * (i + 0.5)}" y="${H - 1}" text-anchor="middle">${m}</text>`).join('');
  const both = [[A, 'a', nA], [B, 'b', nB]];
  const setChart = (id, html) => { const el = $(id); el.innerHTML = html; el.hidden = !html; el.previousElementSibling.hidden = !html; };
  const cm = curMonth();
  const band = (top, bot) => (cm >= 0 ? `<rect class="mon" x="${L + step * cm}" y="${top}" width="${step}" height="${bot - top}" rx="3"/>` : '');
  const head = (id, txt) => { $(id).previousElementSibling.lastElementChild.textContent = txt; };

  // precipitation: grouped bars from zero, A left, B right of each month
  const pre = both.filter(([m]) => m.climate && m.climate.pre_mm);
  if (pre.length) {
    const H = 76, top = 6, bot = H - 12, max = Math.max(1, ...pre.flatMap(([m]) => m.climate.pre_mm));
    const nice = Math.ceil(max / 50) * 50, y = (v) => bot - (v / nice) * (bot - top), bw = (step - 4) / 2;
    setChart('cmp-pre', band(top, bot) + tick(bot, 0) + tick(y(nice), nice) + monthsAx(H) + pre.map(([m, c, n]) => m.climate.pre_mm.map((v, i) =>
      `<rect class="s-${c}" x="${L + step * i + 1 + (c === 'b' ? bw + 2 : 0)}" y="${y(v)}" width="${bw}" height="${Math.max(bot - y(v), 0.5)}" rx="1.5">` +
      `<title>${esc(n)}, ${MONTHS[i]}: ${fmt0.format(v)} mm</title></rect>`).join('')).join(''));
    head('cmp-pre', cm >= 0 ? `${MONL[cm]}: ${pre.map(([m]) => fmt0.format(m.climate.pre_mm[cm])).join(' · ')} mm` : 'mm pro Monat');
  } else setChart('cmp-pre', '');

  // air temperature: two lines on one scale
  const air = both.filter(([m]) => m.climate && m.climate.air_c);
  if (air.length) {
    const H = 76, top = 8, bot = H - 12, vals = air.flatMap(([m]) => m.climate.air_c);
    const lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.max(Math.ceil(Math.max(...vals) / 5) * 5, lo + 5);
    const y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top), x = (i) => L + step * (i + 0.5);
    setChart('cmp-air', band(top, bot) + tick(y(lo), `${lo}°`) + tick(y(hi), `${hi}°`) + (lo < 0 && hi > 0 ? tick(y(0), '0°') : '') + monthsAx(H) +
      air.map(([m, c]) => `<polyline class="l-${c}" points="${m.climate.air_c.map((d, i) => `${x(i)},${y(d)}`).join(' ')}"/>`).join('') +
      air.map(([m, c, n]) => m.climate.air_c.map((d, i) => `<circle class="p-${c}" cx="${x(i)}" cy="${y(d)}" r="3.5"><title>${esc(n)}, ${MONTHS[i]}: ${fmt.format(d)} °C</title></circle>`).join('')).join(''));
    head('cmp-air', cm >= 0 ? `${MONL[cm]}: ${air.map(([m]) => fmt.format(m.climate.air_c[cm])).join(' · ')} °C` : '°C');
  } else setChart('cmp-air', '');

  // long profiles from the source, same km and height scale
  const prof = both.filter(([m]) => m.profile);
  if (prof.length) {
    const H = 96, top = 6, bot = H - 14, max = Math.max(1, ...prof.flatMap(([m]) => m.profile.ele));
    const nice = max > 1000 ? Math.ceil(max / 1000) * 1000 : Math.ceil(max / 100) * 100;
    const len = Math.max(...prof.map(([m]) => m.profile.length_km || 1));
    const x = (km) => L + (km / len) * pw, y = (v) => bot - (Math.max(v, 0) / nice) * (bot - top);
    setChart('cmp-prof', tick(bot, 0) + tick(y(nice), fmt0.format(nice)) +
      prof.map(([m, c, n]) => `<polyline class="l-${c}" points="${m.profile.km.map((k, i) => `${x(k)},${y(m.profile.ele[i])}`).join(' ')}"><title>${esc(n)}: ${fmt0.format(m.profile.length_km)} km, Quelle ${fmt0.format(m.profile.ele[0])} m</title></polyline>`).join('') +
      `<text x="${L}" y="${H - 2}">Quelle</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${fmt0.format(len)} km</text>`);
  } else setChart('cmp-prof', '');
}

// yearly course of both rivers: m³/s on one scale, or % of each river's mean
function drawCompareHydro() {
  const meta = S.meta, cmpB = S.cmpB;
  if (!cmpB || !meta) return;
  const yr = curYear();
  const series = [[hydro12(meta, yr), 'a', titleOf(meta)], [hydro12(cmpB.meta, yr), 'b', titleOf(cmpB.meta)]]
    .filter(([v]) => v).map(([v, c, n]) => {
      const mean = avg(v);
      return [ui.pct ? v.map((x) => 100 * x / mean) : v, c, n];
    });
  const svg = $('cmp-hyd');
  if (!series.length) { svg.innerHTML = ''; return; }
  const W = 268, H = 110, L = 30, R = 4, top = 8, bot = H - 14, pw = W - L - R, step = pw / 12;
  const max = Math.max(...series.flatMap(([v]) => v)) * 1.08 || 1;
  const x = (i) => L + step * (i + 0.5), y = (v) => bot - (v / max) * (bot - top);
  const lab = (v) => (ui.pct ? `${fmt0.format(v)}%` : v >= 1e4 ? `${fmt0.format(v / 1000)}k` : fmt0.format(v));
  const ticks = [0, max / 2.16, max / 1.08];
  const cm = curMonth();
  svg.innerHTML = ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 4}" y="${y(t) + 3}" text-anchor="end">${lab(t)}</text>`).join('') +
    (ui.pct ? `<line class="ref" x1="${L}" x2="${W - R}" y1="${y(100)}" y2="${y(100)}"/>` : '') +
    (cm >= 0 ? `<rect class="mon" x="${x(cm) - step / 2}" y="${top}" width="${step}" height="${bot - top}" rx="3"/>` : '') +
    MON1.map((m, i) => `<text x="${x(i)}" y="${H - 2}" text-anchor="middle">${m}</text>`).join('') +
    series.map(([v, c]) => `<polyline class="l-${c}" points="${v.map((d, i) => `${x(i)},${y(d)}`).join(' ')}"/>`).join('') +
    series.map(([v, c, n]) => v.map((d, i) => `<circle class="p-${c}" cx="${x(i)}" cy="${y(d)}" r="${i === cm ? 4.5 : 3}"><title>${esc(n)}, ${MONL[i]}: ${ui.pct ? fmt0.format(d) + ' % des Mittels' : fmt0.format(d) + ' m³/s'}</title></circle>`).join('')).join('');
  const valOf = (c) => { const s = series.find(([, k]) => k === c); return s && cm >= 0 ? `: ${fmt0.format(s[0][cm])}${ui.pct ? ' %' : ' m³/s'}` : ''; };
  $('cmp-a').textContent = titleOf(meta) + valOf('a');
  $('cmp-b').textContent = titleOf(cmpB.meta) + valOf('b');
  $('cmp-hyd-note').textContent = ui.pct
    ? 'Gleiche Skala für beide: man sieht, wann ein Fluss im Jahr viel und wann wenig Wasser führt, unabhängig von seiner Größe.'
    : 'Absolut: der größere Fluss bestimmt die Skala. Für die Form des Jahresgangs „% des Mittels“ wählen.';
}

export function bindCompare() {
  document.querySelectorAll('.pick').forEach((p) => p.onclick = () => {
    if (!S.cmpB && p.dataset.slot === 'b') return;  // the list is already open
    ui.picking = ui.picking === p.dataset.slot ? false : p.dataset.slot;
    renderCompare();
  });
  $('picker-close').onclick = () => { ui.picking = false; renderCompare(); };
  // show B on the map; the basin that was there becomes the one compared
  $('cmp-open').onclick = () => {
    if (!S.cmpB) return;
    const e = S.cmpB.entry;
    S.cmpB = {meta: S.meta, entry: entryOf(S.view, S.slug)};
    ui.picking = false;
    openView(e.view, e.slug);
  };
  $('cmp-end').onclick = () => { S.cmpB = null; ++S.cmpToken; ui.picking = false; ui.tab = 'rivers'; renderAll(); setUrl(); };
  document.querySelectorAll('#cmp-pct button').forEach((b) => b.onclick = () => {
    ui.pct = b.dataset.p === '1';
    document.querySelectorAll('#cmp-pct button').forEach((x) => x.classList.toggle('on', x === b));
    drawCompareHydro();
  });
}
