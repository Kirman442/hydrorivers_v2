# Flussströmung – HydroRIVERS v2

An animated map of water flowing through the world's large river basins, from
the sources to the mouth: particles follow every river segment at the speed
the water would have there, month by month. Page in German.

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
  js/        page code (entry: js/main.js)
  vendor/    MapLibre GL 5.24.0 and deck.gl 9.3.12 with their licences
  data/      basin files per continent (.bin, gzipped typed arrays) and catalog.json
.github/workflows/pages.yml   publishes site/ with GitHub Pages
```

URL parameters: `?view=<continent or orinoco>&basin=<slug>&m=<month 1–12>&y=<year>&cmp=<view/slug>&c=t`
(continents: `sa`, `na`, `eu`, `af`, `as`, `si`, `au`).

## Publishing

Every push to `main` deploys `site/` to GitHub Pages
(Settings → Pages → Source: GitHub Actions).

## Data and credits

- HydroRIVERS v1.0 – Lehner, B., Grill, G. (2013), Hydrological Processes 27(15): 2171–2186. CC BY 4.0.
- RiverATLAS v1.0 – Linke, S. et al. (2019), Scientific Data 6: 283. CC BY 4.0.
- GloRiC v1.0 – Ouellet Dallaire, C. et al. (2019), Environmental Research Letters 14: 024003. CC BY 4.0.
- GloFAS reanalysis – Copernicus Emergency Management Service, via the Early Warning Data Store (EWDS).
- Natural Earth – river names and countries (public domain).
- Base map © CARTO, © OpenStreetMap contributors. Relief: Mapzen Terrain Tiles (AWS Open Data).
- Libraries: MapLibre GL JS (BSD-3-Clause), deck.gl (MIT); licence files in `site/vendor/`.

Flow speeds, travel times, water temperatures and modelled monthly values are
estimates; the Methode tab of the page explains how each number is computed.
