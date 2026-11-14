/* Welcome window: what the page is and where to click, in German and English.
 * Shown once on a first visit (no view in the URL); the "?" button under the
 * zoom buttons opens it again. The river keeps flowing behind it. */
import {FIRST_VISIT} from './store.js?v=a7be80b2';

const TEXT = {
  de: {
    title: 'Flussströmung',
    lead: 'Wie Wasser durch die großen Flusssysteme der Welt fließt, vom kleinsten Quellbach bis zur Mündung. Jedes Teilchen bewegt sich mit der geschätzten Geschwindigkeit des Wassers an dieser Stelle.',
    steps: [
      ['Fluss wählen', 'Tab „Flüsse“ → „Alle Flüsse“: nach Kontinent oder über die Suche.'],
      ['Monat und Jahr', 'In der Zeitleiste unten. Bei Hochwasser fließen die Flüsse breiter und schneller.'],
      ['Auf einen Fluss klicken', 'Abfluss, Geschwindigkeit, Fließzeit bis zur Mündung. Ein Klick auf einen Monat in den Diagrammen färbt die Karte.'],
      ['Vergleich und Methode', 'Zwei beliebige Flüsse nebeneinander; wie jede Zahl berechnet wird.'],
      ['Relief und Namen', 'Unten links in der Legende: „Relief“ zeigt Gebirge und Täler als Schummerung, „Namen“ die Orte der Grundkarte. Mehr Schalter im Tab „Info“.'],
    ],
    now: 'Gerade zu sehen: der Ganges im Juli, mitten im Monsun, gefärbt nach der geschätzten Wassertemperatur.',
    data: 'Daten: HydroRIVERS, RiverATLAS, GloRiC, GloFAS (Copernicus). Geschwindigkeiten und Temperaturen sind Schätzungen.',
    go: 'Los geht’s',
  },
  en: {
    title: 'The River’s Flow',
    lead: 'How water flows through the world’s large river systems, from the smallest source stream to the mouth. Every particle moves at the estimated speed of the water at that spot.',
    steps: [
      ['Pick a river', 'Tab „Flüsse“ (rivers) → „Alle Flüsse“: by continent or with the search.'],
      ['Month and year', 'In the time bar at the bottom. In flood season the rivers run wider and faster.'],
      ['Click a river', 'Discharge, speed, travel time to the mouth. A click on a month in the charts colours the map.'],
      ['Compare and method', '„Vergleich“: any two rivers side by side; „Methode“: how every number is computed.'],
      ['Relief and names', 'Bottom left in the legend: „Relief“ shades mountains and valleys, „Namen“ shows the place names of the base map. More switches in the „Info“ tab.'],
    ],
    now: 'Now showing: the Ganges in July, in the middle of the monsoon, coloured by estimated water temperature.',
    data: 'Data: HydroRIVERS, RiverATLAS, GloRiC, GloFAS (Copernicus). Speeds and temperatures are estimates. The page itself is in German.',
    go: 'Let’s go',
  },
};

const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

let box = null, lang = get('intro-lang') || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en');

function render(showNow) {
  const t = TEXT[lang];
  box.querySelector('.intro-card').innerHTML = `
    <div class="intro-head"><h2>${t.title}</h2>
      <span class="seg intro-lang"><button type="button" data-l="de" class="${lang === 'de' ? 'on' : ''}">DE</button><button type="button" data-l="en" class="${lang === 'en' ? 'on' : ''}">EN</button></span></div>
    <p class="intro-lead">${t.lead}</p>
    <ol class="intro-steps">${t.steps.map(([h, x]) => `<li><b>${h}</b><span>${x}</span></li>`).join('')}</ol>
    ${showNow ? `<p class="intro-now">${t.now}</p>` : ''}
    <p class="intro-data">${t.data}</p>
    <button type="button" class="intro-go">${t.go}</button>`;
}

function open(showNow) {
  box.hidden = false;
  render(showNow);
  box.querySelector('.intro-go').focus();
  box.dataset.now = showNow ? '1' : '';
}
function close() {
  box.hidden = true;
  put('intro-seen', '1');
}

// "?" as a map control, under the zoom buttons
class HelpControl {
  onAdd() {
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    el.innerHTML = '<button type="button" class="help-btn" title="Hilfe / Help" aria-label="Hilfe / Help">?</button>';
    el.firstChild.onclick = () => open(false);
    return el;
  }
  onRemove() {}
}

export function initIntro(map) {
  box = document.createElement('div');
  box.id = 'intro';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="intro-card"></div>';
  document.body.appendChild(box);
  box.onclick = (e) => {
    const l = e.target.closest('button[data-l]');
    if (l) { lang = l.dataset.l; put('intro-lang', lang); render(!!box.dataset.now); return; }
    if (e.target === box || e.target.closest('.intro-go')) close();  // backdrop or button
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
  map.addControl(new HelpControl(), 'top-right');
  if (FIRST_VISIT && !get('intro-seen')) open(true);
}
