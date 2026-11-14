/* Flüsse tab: the river card (figures in blocks) and its small charts. */
import {$, esc, sum, avg, fmt, fmt0, pct, titleOf, srcText, iBtn, MONTHS, MONL, MON1} from './util.js?v=a7be80b2';
import {state, S, ui, VIEWS, curMonth} from './store.js?v=a7be80b2';
import {yearAnoms, mouthTemp} from './data.js?v=a7be80b2';
import {renderList, renderTabs} from './panel.js?v=a7be80b2';
import {openView} from './load.js?v=a7be80b2';

const kv = (k, v, help, extra = '', id = '') =>
  `<div class="kv"><span class="k">${k}</span>${help ? iBtn(help) : ''}<span class="v"${id ? ` id="${id}"` : ''}>${v}</span>${extra}</div>`;
const colorChip = (c) => `<button type="button" class="cchip ${c}${state.color === c ? ' on' : ''}" data-c="${c}" title="Karte danach färben"></button>`;
// smallest discharge drawn: HydroRIVERS flow class k covers 10^(6-k) .. 10^(7-k) m³/s
const minShown = (k) => (k ? fmt.format(Math.pow(10, 6 - k)) : null);

// list and card share one scrolling panel: a different view starts at the top
let shownView = '';
export function renderRiver() {
  const meta = S.meta;
  $('river').hidden = ui.showList;
  $('list').hidden = !ui.showList;
  const viewKey = ui.showList ? 'list' : `card:${S.view}/${S.slug || ''}`;
  if (viewKey !== shownView) { $('v-rivers').scrollTop = 0; shownView = viewKey; }
  if (ui.showList) {
    $('to-river').textContent = meta ? `← zurück zu ${titleOf(meta)}` : '';
    renderList($('main-list'), 'main', (v, s) => {
      ui.showList = false;
      S.cmpB = null;  // a new river from the catalog ends the comparison
      ui.picking = false;
      renderTabs();  // the badge goes at once, not after loading
      openView(v, s);
    });
    return;
  }
  if (!meta) return;
  const st = meta.stats || {};
  const lands = (st.countries || []).map((c) => (c.share >= 0.05 ? `${c.name} ${Math.round(c.share * 100)} %` : c.name)).join(', ');
  $('title').textContent = titleOf(meta);
  $('subtitle').textContent = [VIEWS[S.view].catalog ? VIEWS[S.view].label : 'Volles Netz', lands].filter(Boolean).join(' · ');
  $('src-line').innerHTML = meta.months
    ? `<span class="chip ${meta.monthly !== 'model' ? 'g' : ''}">Monatswerte: ${meta.hydrograph ? srcText(meta) : 'nur Temperatur'}</span> ${iBtn('monthly')}` : '';
  const pre = meta.climate && meta.climate.pre_mm ? sum(meta.climate.pre_mm) : null;
  const qMouth = st.discharge_cms != null ? st.discharge_cms : Math.max(...S.mainRivers.map((r) => r.q));
  const wt = meta.water_temp ? mouthTemp() : null;

  const blocks = [];
  if (st.area_km2 != null) {
    blocks.push(`<div class="block"><h3>Größe</h3>
      ${kv('Einzugsgebiet', `${fmt0.format(st.area_km2)} <small>km²</small>`, 'area')}
      ${kv('Längster Lauf', `${fmt0.format(st.main_length_km)} <small>km</small>`, 'len')}
      ${kv('Gewässernetz', `${fmt0.format(st.network_length_km)} <small>km</small>`, 'net')}
      ${kv('Flussdichte', `${fmt0.format(st.drainage_density * 1000)} <small>m/km²</small>`, 'dens')}</div>`);
  }
  blocks.push(`<div class="block"><h3>Wasser</h3>
    ${kv('Abfluss Mündung', `${fmt0.format(qMouth)} <small>m³/s</small>`, 'q', colorChip('q'))}
    ${pre != null ? kv('Niederschlag', '', 'pre', '', 'kv-pre') : ''}
    ${st.runoff_mm != null ? kv('Abflusshöhe', `${fmt0.format(st.runoff_mm)} <small>mm/Jahr</small>`, 'runoff') : ''}
    ${pre && st.runoff_mm != null ? kv('Abflussanteil', `${fmt0.format(100 * st.runoff_mm / pre)} <small>% des Niederschlags</small>`, 'share') : ''}
    ${meta.climate && meta.climate.air_c ? kv('Lufttemperatur', '', 'air', '', 'kv-air') : ''}
    ${wt ? kv('Wassertemperatur', '', 'wt', colorChip('t'), 'kv-wt') : ''}
    ${yearRow()}
    ${st.endorheic ? kv('Mündung', 'abflusslos (endorheisch)') : ''}</div>`);
  const shown = minShown(meta.max_ord_flow);
  blocks.push(`<div class="block"><h3>Zeit &amp; Netz</h3>
    ${kv('Längste Fließzeit', '<span id="ft-val"></span> <small>Tage</small>', 'time')}
    ${meta.profile ? kv('Quelle des Hauptlaufs', `${fmt0.format(meta.profile.ele[0])} <small>m ü. M.</small>`, 'src') : ''}
    ${st.max_strahler ? kv('Strahler-Ordnung', `bis ${st.max_strahler}`, 'strahler') : ''}
    ${shown ? kv('Gezeigt', `ab ${shown} <small>m³/s</small>`, 'shown') : ''}
    <div class="note dim">${fmt0.format(meta.segments)}${meta.segments_total ? ` von ${fmt0.format(meta.segments_total)}` : ''} Abschnitten des Datensatzes</div></div>`);
  $('blocks').innerHTML = blocks.join('');
  updateMonthRows();
  updateTravel();
  const tribs = (meta.tributaries || []).filter((t) => t.name).slice(0, 8);
  $('tribs-wrap').hidden = !tribs.length;
  $('card-tribs').innerHTML = tribs.map((t) => `<li><span>${esc(t.name)}</span><span>${fmt0.format(t.discharge_cms)} m³/s</span></li>`).join('');
  $('go-cmp').textContent = S.cmpB ? `Zum Vergleich mit ${titleOf(S.cmpB.meta)}` : 'Mit einem anderen Fluss vergleichen …';
}
function yearRow() {
  const meta = S.meta, an = yearAnoms(meta);
  if (!an) return '';
  const wet = an.indexOf(Math.max(...an)), dry = an.indexOf(Math.min(...an));
  // two lines: the label is long, and this row does not change with the month
  return `<div class="kv two"><span class="k">Nassestes / trockenstes Jahr</span>${iBtn('years')}` +
    `<span class="v"><span class="wet">${meta.years[wet]} (${pct(an[wet])})</span> / <span class="dry">${meta.years[dry]} (${pct(an[dry])})</span></span></div>`;
}
// values that follow the chosen month: only their text changes, the card stays
export function updateMonthRows() {
  const meta = S.meta;
  if (!meta) return;
  const c = meta.climate || {}, cm = curMonth(), mn = cm >= 0 ? MONTHS[cm] : null;
  const set = (id, html) => { const el = $(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
  if (c.pre_mm) set('kv-pre', mn ? `${fmt0.format(c.pre_mm[cm])} <small>mm im ${mn}</small>` : `${fmt0.format(sum(c.pre_mm))} <small>mm/Jahr</small>`);
  if (c.air_c) set('kv-air', mn ? `${fmt.format(c.air_c[cm])} <small>°C im ${mn}</small>` : `${fmt.format(avg(c.air_c))} <small>°C</small>`);
  const wt = meta.water_temp ? mouthTemp() : null;
  if (wt) set('kv-wt', mn ? `${fmt.format(wt[2][cm])} <small>°C im ${mn}</small>` : `${fmt0.format(wt[0])}–${fmt0.format(wt[1])} <small>°C</small>`);
}
// the travel time follows the chosen month and year (retime)
export function updateTravel() {
  const el = $('ft-val');
  if (el && S.meta) el.textContent = fmt.format((S.travelH || S.meta.travel_time_h) / 24);
}

/* Small charts in the card, one measure each (no second y-axis):
 * precipitation and air temperature per month, elevation along the main stem. */
export function renderCharts() {
  const meta = S.meta;
  const box = $('charts');
  const c = meta.climate || {}, prof = meta.profile;
  if (!c.pre_mm && !c.air_c && !prof) { box.hidden = true; return; }
  box.hidden = false;
  const W = 268, L = 26, R = 4;  // plot from x = L to W - R
  const pw = W - L - R, step = pw / 12;
  const tick = (y, label) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>` +
    `<text x="${L - 4}" y="${y + 3}" text-anchor="end">${label}</text>`;
  const months = (H, cm = -1) => MON1.map((m, i) => `<text x="${L + step * (i + 0.5)}" y="${H - 1}" text-anchor="middle"${i === cm ? ' class="cur"' : ''}>${m}</text>`).join('');
  const show = (id, on) => { $(id).hidden = !on; $(id).previousElementSibling.hidden = !on; };

  const cm = curMonth();  // calendar month 0..11 or -1 (year)
  const band = (x0, w, top, bot) => (cm >= 0 ? `<rect class="mon" x="${x0}" y="${top}" width="${w}" height="${bot - top}" rx="3"/>` : '');
  // one click area per month over the whole height, on top of bars and points:
  // picks that month and colours the map (precipitation -> discharge, air -> water temperature)
  const canT = !!meta.water_temp;
  const hits = (H, top, bot, color, label) => MON1.map((_, i) =>
    `<rect class="mhit" data-m="${i}" data-c="${color}" x="${L + step * i}" y="${top}" width="${step}" height="${H - top}" rx="3">` +
    `<title>${label(i)} · Klick: ${MONTHS[i]}, Karte nach ${color === 't' ? 'Wassertemperatur' : 'Abfluss'}</title></rect>`).join('');
  show('chart-pre', !!c.pre_mm);
  if (c.pre_mm) {  // bars from a zero baseline
    const H = 70, top = 6, bot = H - 12, max = Math.max(...c.pre_mm, 1);
    const nice = Math.ceil(max / 50) * 50, y = (v) => bot - (v / nice) * (bot - top);
    $('chart-pre').innerHTML = band(L + step * cm, step, top, bot) + tick(bot, 0) + tick(y(nice), nice) + months(H, cm) +
      c.pre_mm.map((v, i) => `<rect class="bar${i === cm ? ' on' : ''}" x="${L + step * i + 2}" y="${y(v)}" width="${step - 4}" height="${bot - y(v)}" rx="2">` +
        `<title>${MONTHS[i]}: ${fmt0.format(v)} mm</title></rect>`).join('') +
      hits(H, top, bot, 'q', (i) => `${MONTHS[i]}: ${fmt0.format(c.pre_mm[i])} mm`);
    $('pre-sum').textContent = cm >= 0 ? `${MONL[cm]}: ${fmt0.format(c.pre_mm[cm])} mm` : `${fmt0.format(sum(c.pre_mm))} mm/Jahr`;
  }
  show('chart-air', !!c.air_c);
  if (c.air_c) {  // line, scale includes 0 °C when it is close
    const H = 70, top = 8, bot = H - 12;
    let lo = Math.min(...c.air_c), hi = Math.max(...c.air_c);
    lo = Math.floor(Math.min(lo, hi - 5) / 5) * 5; hi = Math.ceil(Math.max(hi, lo + 5) / 5) * 5;
    const y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top), x = (i) => L + step * (i + 0.5);
    $('chart-air').innerHTML = band(L + step * cm, step, top, bot) + tick(y(lo), `${lo}°`) + tick(y(hi), `${hi}°`) +
      (lo < 0 && hi > 0 ? tick(y(0), '0°') : '') + months(H, cm) +
      `<polyline class="line" points="${c.air_c.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>` +
      c.air_c.map((v, i) => `<circle class="pt${i === cm ? ' on' : ''}" cx="${x(i)}" cy="${y(v)}" r="${i === cm ? 5.5 : 4}"><title>${MONTHS[i]}: ${fmt.format(v)} °C</title></circle>`).join('') +
      hits(H, top, bot, canT ? 't' : 'q', (i) => `${MONTHS[i]}: ${fmt.format(c.air_c[i])} °C`);
    $('air-range').textContent = cm >= 0 ? `${MONL[cm]}: ${fmt.format(c.air_c[cm])} °C` : `${fmt.format(Math.min(...c.air_c))} … ${fmt.format(Math.max(...c.air_c))} °C`;
  }
  const svg = $('chart-prof');
  show('chart-prof', !!prof);
  if (prof) {  // area from sea level, source left, mouth right
    const H = 96, top = 6, bot = H - 14, max = Math.max(...prof.ele, 1);
    const nice = max > 1000 ? Math.ceil(max / 1000) * 1000 : Math.ceil(max / 100) * 100;
    const len = prof.length_km || 1, x = (km) => L + (km / len) * pw, y = (v) => bot - (Math.max(v, 0) / nice) * (bot - top);
    const pts = prof.km.map((k, i) => `${x(k)},${y(prof.ele[i])}`).join(' ');
    const tribs = (meta.tributaries || []).filter((t) => t.name && t.km_from_mouth < len)
      .map((t) => { const tx = x(len - t.km_from_mouth);
        return `<line class="trib" x1="${tx}" x2="${tx}" y1="${top}" y2="${bot}"/><text x="${tx + 2}" y="${top + 8}">${esc(t.name)}</text>`; }).join('');
    svg.innerHTML = tick(bot, 0) + tick(y(nice), `${fmt0.format(nice)}`) + tribs +
      `<polygon class="area" points="${x(0)},${bot} ${pts} ${x(len)},${bot}"/>` +
      `<text x="${L}" y="${H - 2}">Quelle</text><text x="${W - R}" y="${H - 2}" text-anchor="end">Mündung · ${fmt0.format(len)} km</text>` +
      `<g id="prof-hover" visibility="hidden"><line class="cross" y1="${top}" y2="${bot}"/><text class="val" y="${top + 18}"></text></g>` +
      `<rect class="hit" x="${L}" y="0" width="${pw}" height="${H}"/>`;
    $('prof-info').textContent = `bis ${fmt0.format(prof.ele[0])} m`;
    // crosshair: km from source and elevation under the pointer
    const g = svg.querySelector('#prof-hover'), line = g.querySelector('line'), label = g.querySelector('text');
    svg.onmousemove = (e) => {
      const r = svg.getBoundingClientRect(), sx = ((e.clientX - r.left) / r.width) * W;
      const km = Math.min(Math.max((sx - L) / pw * len, 0), len);
      let i = 0; while (i < prof.km.length - 1 && prof.km[i + 1] < km) i++;
      const cx = x(km);
      line.setAttribute('x1', cx); line.setAttribute('x2', cx);
      label.setAttribute('x', cx + (cx > W / 2 ? -4 : 4));
      label.setAttribute('text-anchor', cx > W / 2 ? 'end' : 'start');
      label.textContent = `${fmt0.format(km)} km · ${fmt0.format(prof.ele[i])} m`;
      g.setAttribute('visibility', 'visible');
    };
    svg.onmouseleave = () => g.setAttribute('visibility', 'hidden');
  } else svg.innerHTML = '';
}
