/* Top 10 of the world's rivers by discharge and by length, from published
 * sources (not from our data, see Methode). Each entry opens the basin that
 * holds the river on the map; `note` says when that basin is a larger system. */

const KM3_YR = 1e9 / (365.25 * 86400);  // km³/yr -> m³/s

export const TOP = {
  q: {
    label: 'Top 10 · Abfluss',
    unit: 'm³/s',
    // Dai et al. (2009), J. Climate 22: 2773–2792, Table 1: order by river-mouth
    // outflow (Dai & Trenberth 2002); value = mean 1948–2004 at the farthest
    // downstream gauge, km³/yr
    source: 'Reihenfolge nach Abfluss an der Mündung (Dai & Trenberth 2002); Wert: Mittel 1948–2004 am untersten Pegel (Dai, Qian, Trenberth & Milliman 2009, Journal of Climate 22, Tab. 1). An der Mündung ist der Abfluss höher.',
    rivers: [
      ['Amazonas', 'sa', 'amazonas', 5444, 'Óbidos'],
      ['Kongo', 'af', 'kongo', 1270, 'Kinshasa'],
      ['Orinoco', 'sa', 'orinoco', 996, 'Puente Angostura'],
      ['Jangtsekiang', 'as', 'jangtsekiang', 907, 'Datong'],
      ['Brahmaputra', 'as', 'ganges', 643, 'Bahadurabad', 'im Becken Ganges–Brahmaputra'],
      ['Mississippi', 'na', 'mississippi', 552, 'Vicksburg'],
      ['Jenissei', 'si', 'jenissei', 588, 'Igarka'],
      ['Paraná', 'sa', 'parana', 517, 'Timbúes'],
      ['Lena', 'si', 'lena', 532, 'Kjusjur'],
      ['Mekong', 'as', 'mekong', 312, 'Pakse'],
    ].map(([name, view, slug, km3, gauge, note]) => ({name, view, slug, value: km3 * KM3_YR, gauge, note})),
  },
  len: {
    label: 'Top 10 · Länge',
    unit: 'km',
    source: 'Länge vom entferntesten Quellfluss, nach Encyclopaedia Britannica („World’s longest rivers“). Längen hängen stark von der Messweise ab; für den Amazonas gibt es auch Werte bis rund 7000 km.',
    rivers: [
      ['Nil', 'af', 'nil', 6650],
      ['Amazonas–Ucayali–Apurímac', 'sa', 'amazonas', 6400],
      ['Jangtsekiang', 'as', 'jangtsekiang', 6300],
      ['Mississippi–Missouri–Red Rock', 'na', 'mississippi', 5971],
      ['Jenissei–Baikal–Selenga', 'si', 'jenissei', 5540],
      ['Huang He', 'as', 'huang-he', 5464],
      ['Ob–Irtysch', 'si', 'ob', 5410],
      ['Paraná', 'sa', 'parana', 4880],
      ['Kongo', 'af', 'kongo', 4700],
      ['Amur–Argun', 'as', 'amur', 4444],
    ].map(([name, view, slug, value]) => ({name, view, slug, value})),
  },
};
