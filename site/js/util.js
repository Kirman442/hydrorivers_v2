/* Small helpers, number formats, month names and the help texts. No state. */

export const params = new URLSearchParams(location.search);
// data and texts: ask the server each time (a 304 if unchanged), so renamed
// or rebuilt files never come from a stale browser cache
export const FRESH = {cache: 'no-cache'};

export const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MON1 = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export const $ = (id) => document.getElementById(id);
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
export const sum = (v) => (v ? v.reduce((a, b) => a + b, 0) : null);
export const avg = (v) => (v ? sum(v) / v.length : null);
export const fmt = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 1});
export const fmt0 = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
export const pct = (v) => `${v >= 0 ? '+' : '−'}${fmt0.format(Math.abs(v))} %`;
export const wetDry = (v) => (Math.abs(v) < 5 ? 'normal' : v > 0 ? 'nass' : 'trocken');
export const titleOf = (m) => m.name.charAt(0).toUpperCase() + m.name.slice(1);
// where the monthly values come from: GloFAS years or the model
export const srcText = (m) => (m.monthly === 'model' ? 'Modell' : m.glofas_years
  ? `GloFAS ${m.glofas_years[0] === m.glofas_years[1] ? m.glofas_years[0] : m.glofas_years.join('–')}` : 'GloFAS');

// one sentence per figure: the same text in the card, the comparison and the glossary
export const HELP = {
  area: ['Einzugsgebiet', 'Die ganze Fläche, von der Regen und Schmelzwasser in diesen Fluss gelangen.'],
  q: ['Abfluss an der Mündung', 'Wie viel Wasser im Jahresmittel pro Sekunde ins Meer (oder in den Endsee) fließt.'],
  runoff: ['Abflusshöhe', 'Der Jahresabfluss gleichmäßig über das Einzugsgebiet verteilt, als Wassersäule in mm. Mit dem Niederschlag verglichen zeigt sie, wie viel Wasser verdunstet.'],
  share: ['Abflussanteil', 'Welcher Teil des Niederschlags den Fluss erreicht; der Rest verdunstet oder versickert.'],
  pre: ['Niederschlag', 'Regen und Schnee im Einzugsgebiet, Summe eines Jahres.'],
  air: ['Lufttemperatur', 'Jahresmittel der Lufttemperatur im Einzugsgebiet.'],
  wt: ['Wassertemperatur', 'Schätzung aus der Lufttemperatur (Mohseni-Kurve), keine Messung. Angegeben ist die Spanne im Jahr an der Mündung.'],
  len: ['Längster Lauf', 'Vom entferntesten Quellbach bis zur Mündung, dem Wasser entlang gemessen. Er kann einem anderen Arm folgen als der Hauptlauf (siehe Methode).'],
  net: ['Gewässernetz', 'Alle gezeigten Flussabschnitte zusammen.'],
  dens: ['Flussdichte', 'Meter Fluss auf jedem Quadratkilometer Land. Hoch in feuchten, steilen Gebieten, niedrig in Wüsten und Ebenen.'],
  strahler: ['Strahler-Ordnung', 'Rang im Flussnetz: Quellbäche haben 1; fließen zwei gleichen Rangs zusammen, steigt er um 1. Große Ströme erreichen 9 bis 12.'],
  time: ['Längste Fließzeit', 'So lange braucht ein Wassertropfen vom entferntesten Quellbach bis zur Mündung – im Jahresmittel oder im gewählten Monat.'],
  src: ['Quelle des Hauptlaufs', 'Höhe der Quelle des Hauptlaufs über dem Meer. Der Hauptlauf folgt an jedem Zusammenfluss dem größeren Einzugsgebiet, nicht unbedingt dem bekannten Quellfluss, und die Höhe ist der tiefste Punkt um den Quellabschnitt – sie kann deshalb deutlich unter der Quelle aus dem Atlas liegen (siehe Methode).'],
  shown: ['Gezeigte Flüsse', 'Die kleinsten Bäche sind weggelassen, damit die Karte flüssig bleibt. HydroRIVERS teilt die Abschnitte nach dem Abfluss in Klassen ein, je Klasse eine Zehnerpotenz.'],
  years: ['Nassestes / trockenstes Jahr', 'Jahresmittel des GloFAS-Abflusses im Vergleich zum Mittel der geladenen Jahre (z. B. 2022–2025); kurze Reihe, keine Klimanormale.'],
  monthly: ['Monatswerte', 'GloFAS: Copernicus-Reanalyse, also berechnet mit dem Wetter der genannten Jahre. Modell: unsere Schätzung aus dem Klima, wo keine GloFAS-Daten geladen sind.'],
};
export const iBtn = (k) => `<button type="button" class="i" data-help="${k}" aria-label="Was ist ${HELP[k][0]}?">i</button>`;
