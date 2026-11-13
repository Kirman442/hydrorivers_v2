/* The panel's tabs, the river list (catalog and "compare with" share it) and
 * the Methode text. */
import {$, esc, fmt0, FRESH} from './util.js';
import {S, ui, VIEWS, catalogs} from './store.js';
import {loadCatalogs} from './data.js';
import {renderRiver} from './card.js';
import {renderCompare} from './compare.js';

/* ---------- tabs ---------- */
export function renderTabs() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  for (const t of ['rivers', 'compare', 'method', 'info']) $('v-' + t).hidden = ui.tab !== t;
  $('cmp-n').hidden = !S.cmpB;
}
export function setTab(t) {
  ui.tab = t;
  if (t === 'compare') renderCompare();
  if (t === 'rivers') renderRiver();
  if (t === 'method') loadMethod();
  renderTabs();
}
// the Methode text lives in methode.html (plain markup), fetched once
let methodLoaded = false;
function loadMethod() {
  if (methodLoaded) return;
  methodLoaded = true;
  fetch('methode.html', FRESH).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .then((html) => { $('v-method').innerHTML = html; })
    .catch(() => { methodLoaded = false; $('v-method').innerHTML = '<p class="dim">Der Text konnte nicht geladen werden.</p>'; });
}

/* ---------- river list: the catalog and "compare with" use the same one ---------- */
function listItems(mode) {
  const q = ui.q[mode].trim().toLowerCase();
  const hit = (b) => !q || b.name.toLowerCase().includes(q) ||
    (b.countries || []).some((c) => c.name.toLowerCase().includes(q)) ||
    (b.tributaries || []).some((t) => t && t.name && t.name.toLowerCase().includes(q));
  const isA = (v, s) => v === S.view && (!VIEWS[v].catalog || s === S.slug);
  const isB = (v, s) => S.cmpB && S.cmpB.entry.view === v && (S.cmpB.entry.slug || null) === (s || null);
  const li = (v, s, name, area, g) => `<li class="${isA(v, s) ? 'a' : isB(v, s) ? 'b' : ''}" data-v="${v}" data-s="${s || ''}">` +
    `<span class="nm">${esc(name)}</span>${g ? '<span class="g-badge" title="Monatswerte aus GloFAS">G</span>' : ''}` +
    (area ? `<span class="ar">${fmt0.format(area / 1000)} Tsd. km²</span>` : '') + '</li>';
  let html = '';
  if (!q || 'orinoco volles netz prototyp glofas'.includes(q)) {
    html += `<details class="region" data-c="orinoco" ${ui.open.has('orinoco') || q ? 'open' : ''}><summary>Volles Netz<span class="cnt">1</span></summary>` +
      `<ul class="rivers">${li('orinoco', null, 'Orinoco · volles Netz', 0, true)}</ul></details>`;
  }
  for (const [k, v] of Object.entries(VIEWS)) {
    const c = catalogs[k];
    if (!v.catalog || !c) continue;
    let bs = c.basins.filter(hit);
    if (!bs.length) continue;
    bs = bs.slice().sort(ui.sort === 'az' ? (x, y) => x.name.localeCompare(y.name, 'de') : (x, y) => y.area_km2 - x.area_km2);
    html += `<details class="region" data-c="${k}" ${q || ui.open.has(k) ? 'open' : ''}><summary>${esc(v.label)}<span class="cnt">${bs.length}</span></summary>` +
      `<ul class="rivers">${bs.map((b) => li(k, b.slug, b.name, b.area_km2, b.monthly && b.monthly !== 'model')).join('')}</ul></details>`;
  }
  return html || '<ul class="rivers"><li class="empty">Nichts gefunden</li></ul>';
}
const listPick = {};  // what a click in each list does (set on every render)
export function renderList(box, mode, onPick) {
  listPick[mode] = onPick;
  const fill = () => {
    box.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === ui.sort));
    const items = box.querySelector('.items');
    items.innerHTML = listItems(mode);
    // one region open at a time (while searching, every region with a hit stays open)
    const regions = items.querySelectorAll('details.region');
    regions.forEach((d) => d.ontoggle = () => {
      if (ui.q[mode]) return;
      if (!d.open) { ui.open.delete(d.dataset.c); return; }
      ui.open.clear();
      ui.open.add(d.dataset.c);
      regions.forEach((o) => { if (o !== d && o.open) o.open = false; });
      // the opened region starts at the top of its scrolling panel
      // (scrollIntoView would also try to scroll the page)
      let sc = d.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) sc.scrollTop += d.getBoundingClientRect().top - sc.getBoundingClientRect().top - 4;
    });
    items.querySelectorAll('li[data-v]').forEach((el) => el.onclick = () => listPick[mode](el.dataset.v, el.dataset.s || null));
  };
  if (!box.dataset.built) {  // built once, so typing keeps the focus
    box.innerHTML = `<input type="search" placeholder="Fluss, Nebenfluss oder Land suchen" autocomplete="off">
      <div class="tools"><span><span class="g-badge">G</span> = Monatswerte aus GloFAS</span>
      <span class="seg"><button type="button" data-s="az">A–Z</button><button type="button" data-s="size">Größe</button></span></div>
      <div class="items"></div>`;
    box.dataset.built = '1';
    const input = box.querySelector('input');
    input.oninput = () => { ui.q[mode] = input.value; fill(); };
    box.querySelectorAll('.seg button').forEach((b) => b.onclick = () => { ui.sort = b.dataset.s; fill(); });
  }
  loadCatalogs().then(fill);
}
