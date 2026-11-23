# Flussströmung – HydroRIVERS v2

An animated map of water flowing through the world's large river basins, from
the sources to the mouth: particles follow every river segment at the speed
the water would have there, month by month. Page in German.

Live: https://gis.krmn.app/hydrorivers_v2/ (GitHub Pages with a custom domain,
published by the workflow below; the custom domain is set in the repository's
Pages settings, there is no CNAME file).

The site is static: HTML, CSS and plain JavaScript modules, no build step and
no server code. Development (data pipeline, tools) happens in a separate
repository; this one only holds what the site needs and is generated from it.

## Run locally

```bash
cd site
python -m http.server 8000
# open http://localhost:8000
```

The page uses JavaScript modules, so it has to be served over http; opening
`index.html` as a file does not work.

## Layout

```
site/
  index.html, methode.html, style.css
  legal.html Impressum and Datenschutz (shown in a window, links in the credits line)
  js/        page code (entry: js/main.js)
  vendor/    MapLibre GL 5.24.0, deck.gl 9.3.12 and jsPDF 2.5.2 with their licences
  data/      basin files per continent (.bin, gzipped typed arrays) and catalog.json;
             landschaften.json: names of seas and landscapes for the print sheet
.github/workflows/pages.yml   publishes site/ with GitHub Pages
```

URL parameters: `?view=<continent or orinoco>&basin=<slug>&m=<month 1–12>&y=<year>&cmp=<view/slug>&c=t`
(continents: `sa`, `na`, `eu`, `af`, `as`, `si`, `au`).

## Print sheet

"⎙ Druckblatt" in the river card (desktop) makes an A3 sheet of the river on
the map, portrait or landscape, 150 or 300 dpi, saved as PNG or PDF. The map is
drawn by the page itself (MapLibre and deck.gl on a hidden map of the sheet's
size, particles frozen at that moment), on the dark base map or a light one;
frame, north arrow, scale, legend, river names, names of seas and landscapes,
twelve month maps and key figures are added on top. In the PDF the map is one
image and all text is real text. Everything runs in the browser; jsPDF is
loaded only when a PDF is saved.

## Publishing

Every push to `main` deploys `site/` to GitHub Pages
(Settings → Pages → Source: GitHub Actions).

## Data and credits

- HydroRIVERS v1.0 – Lehner, B., Grill, G. (2013), Hydrological Processes 27(15): 2171–2186. CC BY 4.0.
- RiverATLAS v1.0 – Linke, S. et al. (2019), Scientific Data 6: 283. CC BY 4.0.
- GloRiC v1.0 – Ouellet Dallaire, C. et al. (2019), Environmental Research Letters 14: 024003. CC BY 4.0.
- GloFAS reanalysis – Copernicus Emergency Management Service, via the Early Warning Data Store (EWDS).
- Natural Earth – river names, countries, names of seas and landscapes (public domain).
- Base map © CARTO, © OpenStreetMap contributors (dark: Dark Matter; light print sheets: Positron). Relief: Mapzen Terrain Tiles (AWS Open Data).
- Libraries: MapLibre GL JS (BSD-3-Clause), deck.gl (MIT), jsPDF (MIT); licence files in `site/vendor/`.

Flow speeds, travel times, water temperatures and modelled monthly values are
estimates; the Methode tab of the page explains how each number is computed.
