/* River flow animation: particles travel along every river segment of a basin,
 * timed by the estimated travel time to the outlet (see pipeline/build_basin.py).
 *
 * Entry point. The page is plain ES modules, no build step:
 *   util.js     helpers, number formats, month names, help texts
 *   store.js    shared state, views, values and colours of the chosen month
 *   data.js     binary basin format, downstream links, travel times, catalogs
 *   map.js      MapLibre + deck.gl layers, tooltip, animation loop
 *   basemap.js  relief, place names and borders of the base map
 *   panel.js    tabs, river list, Methode text
 *   card.js     river card and its charts (Flüsse tab)
 *   compare.js  Vergleich tab
 *   timebar.js  time bar, legend, colour mode, month and year changes
 *   load.js     loading views and basins, state in the URL
 *   intro.js    welcome window (DE/EN) on the first visit, "?" button on the map
 */
import {$, params, HELP} from './util.js?v=a7be80b2';
import {state, S, ui, FIRST_VISIT, START} from './store.js?v=a7be80b2';
import {loadCatalogs} from './data.js?v=a7be80b2';
import {map, redraw} from './map.js?v=a7be80b2';
import {initIntro} from './intro.js?v=a7be80b2';
import {bindBasemap} from './basemap.js?v=a7be80b2';
import {setTab} from './panel.js?v=a7be80b2';
import {renderRiver} from './card.js?v=a7be80b2';
import {bindCompare} from './compare.js?v=a7be80b2';
import {renderTimebar, setColor, setMonth, setYear} from './timebar.js?v=a7be80b2';
import {openView} from './load.js?v=a7be80b2';

function bindControls() {
  // speed: the slider in Info and the one in the time bar are the same control
  const speed = $('speed'), speed2 = $('tb-speed-in'), spacing = $('spacing');
  const setSpeed = (v) => {
    state.speed = +v;
    speed.value = speed2.value = state.speed;
    $('speed-val').textContent = $('tb-speed-val').textContent = `${state.speed} h/s`;
    document.querySelectorAll('#tb-speed .presets button').forEach((b) => b.classList.toggle('on', +b.dataset.v === state.speed));
  };
  speed.oninput = () => setSpeed(speed.value);
  speed2.oninput = () => setSpeed(speed2.value);
  $('tb-speed').querySelector('.presets').onclick = (e) => { const b = e.target.closest('button[data-v]'); if (b) setSpeed(b.dataset.v); };
  spacing.oninput = () => { state.spacing = +spacing.value; $('spacing-val').textContent = `${state.spacing} h`; };
  setSpeed(speed.value);
  spacing.oninput();
  $('labels').onchange = (e) => { state.labels = e.target.checked; redraw(); };
  $('network').onchange = (e) => { state.network = e.target.checked; redraw(); };
  bindBasemap();

  $('play').onclick = () => { state.playing = !state.playing; renderTimebar(); };
  $('months').onclick = (e) => { const g = e.target.closest('.mb'); if (g) setMonth(+g.dataset.m); };
  $('years').onclick = (e) => { const b = e.target.closest('button[data-y]'); if (b) setYear(+b.dataset.y); };
  let cycleTimer = null;
  $('cycle').onchange = (e) => {
    clearInterval(cycleTimer);
    if (e.target.checked) {
      cycleTimer = setInterval(() => { if (S.meta.months) setMonth((state.month + 1) % S.meta.months.length); }, 2500);
    }
  };
  // click on a month in the precipitation or air temperature chart
  const chartMonth = (e) => {
    const r = e.target.closest('.mhit');
    if (!r || !S.meta || !S.meta.months) return;
    const i = S.meta.months.indexOf(+r.dataset.m + 1);
    if (i < 0) return;
    if (state.color !== r.dataset.c) setColor(r.dataset.c);
    setMonth(i);
  };
  $('chart-pre').onclick = chartMonth;
  $('chart-air').onclick = chartMonth;
  $('color-mode').onclick = (e) => { const b = e.target.closest('button[data-c]'); if (b) setColor(b.dataset.c); };
  // the small colour chips in the card switch the map colouring too
  $('blocks').onclick = (e) => { const b = e.target.closest('.cchip'); if (b) setColor(b.dataset.c); };
  $('lg-min').onclick = () => {
    const box = $('maplegend');
    box.classList.toggle('min');
    $('lg-min').textContent = box.classList.contains('min') ? '▸' : '▾';
  };
  document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
  $('to-list').onclick = () => { ui.showList = true; renderRiver(); };
  $('to-river').onclick = () => { ui.showList = false; renderRiver(); };
  $('go-cmp').onclick = () => setTab('compare');
  document.querySelectorAll('.to-method').forEach((b) => b.onclick = () => { setTab('method'); $('v-method').scrollTop = 0; });
  // scroll only the Info tab (scrollIntoView would also try to scroll the page)
  $('cr-more').onclick = (e) => { e.preventDefault(); setTab('info'); $('v-info').scrollTop = $('sources').offsetTop - $('v-info').offsetTop - 8; };
  // the page never scrolls; if anything (an extension, focus) moves it, put it back
  const noScroll = () => { if (scrollX || scrollY) scrollTo(0, 0); };
  window.addEventListener('scroll', noScroll);
  noScroll();
  window.addEventListener('resize', () => renderTimebar());

  // one popover for every (i)
  const pop = $('pop');
  let popFor = null;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.i');
    document.querySelectorAll('.i.on').forEach((x) => x.classList.remove('on'));
    if (!b || popFor === b) { pop.hidden = true; popFor = null; return; }
    const [t, txt] = HELP[b.dataset.help];
    pop.innerHTML = `<b>${t}</b>${txt}`;
    pop.hidden = false; popFor = b; b.classList.add('on');
    const r = b.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + pop.offsetHeight + 12 > window.innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6}px`;
  });
  $('gloss').innerHTML = Object.values(HELP).map(([t, x]) => `<dt>${t}</dt><dd>${x}</dd>`).join('');
}

bindControls();
bindCompare();
loadCatalogs();
openView(S.view, params.get('basin') || (FIRST_VISIT ? START.basin : null));
initIntro(map);
