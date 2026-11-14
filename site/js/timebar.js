/* Time bar (months as the hydrograph of the river on the map, single years),
 * the map legend and the colour mode; what follows a change of month or year. */
import {$, esc, avg, fmt0, pct, wetDry, titleOf, srcText, MONTHS, MONL} from './util.js?v=a7be80b2';
import {state, S, curYear} from './store.js?v=a7be80b2';
import {retime, hydro12, yearAnoms} from './data.js?v=a7be80b2';
import {redraw} from './map.js?v=a7be80b2';
import {updateMonthRows, renderCharts} from './card.js?v=a7be80b2';
import {renderCompare} from './compare.js?v=a7be80b2';
import {setUrl} from './load.js?v=a7be80b2';

/* ---------- legend (bottom left) and colour mode ---------- */
const LEG = {
  q: ['', ['1', '10', '100', '1.000', '10.000+'], 'Abfluss in m³/s (logarithmisch)'],
  t: ['temp', ['0', '10', '20', '30 °C'], 'Wassertemperatur, geschätzt aus der Lufttemperatur'],
};
export function renderLegend() {
  const c = state.color, canT = !!(S.meta && S.meta.water_temp);
  document.querySelectorAll('#color-mode button').forEach((b) => b.classList.toggle('on', b.dataset.c === c));
  document.querySelector('#color-mode button[data-c="t"]').hidden = !canT;
  $('lg-ramp').className = 'ramp ' + LEG[c][0];
  $('lg-ticks').innerHTML = LEG[c][1].map((t) => `<span>${t}</span>`).join('');
  $('lg-note').textContent = LEG[c][2];
  document.querySelectorAll('.cchip').forEach((b) => b.classList.toggle('on', b.dataset.c === c));
}
export function setColor(c) {
  if (c === 't' && !(S.meta && S.meta.water_temp)) return;
  state.color = c;
  renderLegend();
  redraw();
  setUrl();
}

/* ---------- time bar ---------- */
export function renderTimebar() {
  const meta = S.meta;
  if (!meta) return;
  const months = meta.months || [];
  const yrs = meta.years;
  const phone = window.innerWidth <= 760;  // short names where the bar is narrow
  const mName = state.month < 0 ? (phone ? 'Jahr' : 'Jahresmittel') : (phone ? MONTHS : MONL)[months[state.month] - 1];
  $('tb-month').textContent = mName + (state.year >= 0 && yrs ? ` ${yrs[state.year]}` : '');
  let sub = `${titleOf(meta)} · ${meta.hydrograph ? srcText(meta) : months.length ? 'Temperatur' : 'ohne Monate'}`;
  if (state.year >= 0 && state.month >= 0 && meta.hydrograph_years && meta.hydrograph) {
    const c = months[state.month] - 1, v = meta.hydrograph_years[state.year][c], mean = meta.hydrograph[state.month];
    if (mean > 0) sub = `${MONTHS[c]} ${yrs[state.year]}: ${pct(100 * (v / mean - 1))} ggü. mittlerem ${MONTHS[c]}`;
  }
  $('tb-src').textContent = sub;
  $('tb-src').title = sub;  // the full text when the line is cut
  $('play').innerHTML = state.playing ? '❚❚<span class="pl"> Pause</span>' : '▶<span class="pl"> Abspielen</span>';
  $('play').title = state.playing ? 'Pause' : 'Abspielen';
  const an = yearAnoms(meta);
  $('years').innerHTML = yrs
    ? `<span class="seg yrs"><button type="button" data-y="-1" class="${state.year < 0 ? 'on' : ''}">Mittel<small>&nbsp;</small></button>` +
      yrs.map((y, i) => `<button type="button" data-y="${i}" class="${state.year === i ? 'on' : ''}"` +
        (an ? ` title="${y}: Jahresmittel ${pct(an[i])} gegenüber ${yrs[0]}–${yrs[yrs.length - 1]} (${wetDry(an[i])})"` : '') +
        `>${y}${an ? `<small class="${an[i] >= 5 ? 'wet' : an[i] <= -5 ? 'dry' : ''}">${pct(an[i])}</small>` : ''}</button>`).join('') + '</span>'
    : `<span class="chip">${meta.hydrograph ? 'ohne Einzeljahre (Modell)' : 'ohne Einzeljahre'}</span>`;
  $('cycle').disabled = !months.length;

  const box = $('months');
  if (!months.length) { box.innerHTML = '<div class="dim small" style="padding-top:28px">Für dieses Gebiet gibt es keine Monatswerte.</div>'; return; }
  const W = Math.max(box.clientWidth, 200), H = box.clientHeight || 74;
  const yrH = meta.hydrograph_years;
  const h = meta.hydrograph ? (state.year >= 0 && yrH ? months.map((m) => yrH[state.year][m - 1]) : meta.hydrograph) : null;
  const n = months.length, bw = W / (n + 1), top = 4, base = H - 14;
  // same scale for the mean and every single year, so dry and wet years compare
  const mx = h ? Math.max(...h, ...(yrH ? yrH.flat() : [])) * 1.05 : 1;
  const yA = (v) => (h ? base - (base - top) * v / mx : base - (base - top) * 0.35);
  const fill = (on, strong) => (on ? '#6fd3ff' : strong ? 'rgba(111,211,255,.42)' : 'rgba(111,211,255,.25)');
  const mean = h ? avg(h) : 0;
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  svg += `<g class="mb" data-m="-1"><rect class="bg" x="0" y="0" width="${bw * 0.95}" height="${H}" rx="5"/>
    <rect x="${bw * 0.12}" y="${yA(mean)}" width="${bw * 0.7}" height="${base - yA(mean)}" rx="3" fill="${fill(state.month < 0)}"/>
    <text x="${bw * 0.47}" y="${H - 2}" fill="${state.month < 0 ? '#e6edf3' : '#8b98a5'}" text-anchor="middle">Jahr</text>
    <title>${h ? `Jahresmittel: ${fmt0.format(mean)} m³/s` : 'Jahresmittel'}</title></g>`;
  months.forEach((m, i) => {
    const x0 = bw * (i + 1), v = h ? h[i] : 0;
    svg += `<g class="mb" data-m="${i}"><rect class="bg" x="${x0}" y="0" width="${bw}" height="${H}" rx="5"/>
      <rect x="${x0 + bw * 0.15}" y="${yA(v)}" width="${bw * 0.7}" height="${base - yA(v)}" rx="3" fill="${fill(i === state.month, true)}"/>
      <text x="${x0 + bw / 2}" y="${H - 2}" fill="${i === state.month ? '#e6edf3' : '#8b98a5'}" text-anchor="middle">${MONTHS[m - 1]}</text>
      <title>${MONL[m - 1]}${h ? `: ${fmt0.format(v)} m³/s` : ''}</title></g>`;
  });
  // the compared river as a line in its own scale: the shape of its year
  const hb = S.cmpB ? hydro12(S.cmpB.meta, curYear()) : null;
  if (hb && n === 12) {
    const mxB = Math.max(...hb) * 1.05, yB = (v) => base - (base - top) * v / mxB;
    svg += `<polyline fill="none" stroke="#ffb86b" stroke-width="2" points="${months.map((m, i) => `${bw * (i + 1.5)},${yB(hb[m - 1])}`).join(' ')}"/>` +
      `<text x="${W - 2}" y="10" fill="#ffb86b" text-anchor="end">${esc(titleOf(S.cmpB.meta))} (eigene Skala)</text>`;
  }
  if (h) svg += `<text x="${W - 2}" y="${hb ? 22 : 10}" fill="#5b6773" text-anchor="end">max ${fmt0.format(Math.max(...h))} m³/s</text>`;
  box.innerHTML = svg + '</svg>';
}

// everything that follows the chosen month or year
export function afterTime() {
  retime();
  redraw();
  renderTimebar();
  updateMonthRows();
  renderCharts();
  if (S.cmpB) renderCompare();
  setUrl();
}
export function setMonth(i) { state.month = i; afterTime(); }
export function setYear(i) { state.year = i; afterTime(); }
