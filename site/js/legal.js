/* Impressum and Datenschutz: one window with two pages and a switch between
 * them, opened from the credits line under the map. The texts live in
 * legal.html (two <section>s), fetched once. #impressum / #datenschutz in the
 * URL open the window directly. */
import {$, FRESH} from './util.js?v=78a1ce87';

let pages = null;
async function load() {
  if (pages) return pages;
  const html = await (await fetch('legal.html', FRESH)).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  pages = {};
  for (const s of doc.querySelectorAll('section[data-page]')) pages[s.dataset.page] = s.innerHTML;
  return pages;
}

async function show(page) {
  const box = $('legal');
  box.hidden = false;
  document.querySelectorAll('#legal-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.page === page));
  try { $('legal-body').innerHTML = (await load())[page] || ''; } catch (e) { $('legal-body').textContent = 'Der Text konnte nicht geladen werden.'; }
  $('legal-body').scrollTop = 0;
  if (location.hash !== '#' + page) history.replaceState(null, '', location.pathname + location.search + '#' + page);
}
function hide() {
  $('legal').hidden = true;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

export function initLegal() {
  document.querySelectorAll('.legal-link').forEach((a) => a.onclick = (e) => { e.preventDefault(); show(a.dataset.page); });
  $('legal-tabs').onclick = (e) => { const b = e.target.closest('button[data-page]'); if (b) show(b.dataset.page); };
  $('legal-close').onclick = hide;
  $('legal').onclick = (e) => { if (e.target.id === 'legal') hide(); };   // a click beside the card
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('legal').hidden) hide(); });
  const h = location.hash.slice(1);
  if (h === 'impressum' || h === 'datenschutz') show(h);
}
