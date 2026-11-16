# 42 · Co-Modification

Author: Paolo Mantecchini · Started: 2026-11-09 · Status: v0.2 · Stack: static HTML + JS, Three.js 0.170 (vendored), no build step

An interactive 3D reconstruction of Bangkok's atmosphere during the January 2025 PM2.5 crisis, setting observed pollution beside the aircraft releases meant to disperse it. It asks what happens when environmental degradation is addressed through further environmental intervention, without assuming the answer.

Part of Weather Commons (TBA21–Academy), Realtime Weather working group. The folder keeps its first name, `42-prova`, because sketch folders are never renamed.

## Run

Online, once published: https://paolomantecchini.github.io/weather-commons/42-prova/

On your computer:

```bash
cd sketches/42-prova
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` as a file won't work, because the page loads `data/`.

To rebuild `data/geo.json` and `data/meteo.json`: `node tools/prepare-data.mjs` (downloads Natural Earth and geoBoundaries into `tools/.cache/`, which git ignores).

## Files

- `index.html`, `comod.css`, `app.js`: the page. `style.css` is the shared look; `comod.css` adds the 3D stage.
- `vendor/`: Three.js 0.170.0 and its OrbitControls (MIT, `vendor/LICENSE-three.txt`), copied from npm so the sketch stands alone.
- `data/pm25.json`: observed bulletins, with status and source per day.
- `data/events.json`: timeline entries, each tagged event, intervention, mechanism, observed or uncertainty.
- `data/sources.json`: the source archive shown on the page.
- `data/meteo.json`, `data/geo.json`: made by `tools/prepare-data.mjs`.
- `data/raw/open-meteo-compact.json`: the weather values as fetched (see below).

## 1. Event

Morning PM2.5 rose from 54.1 µg/m³ (20 Jan) to 88.4 (24 Jan), then fell to 26 (28 Jan). Schools closed (53 on 22 Jan, 352 on 24 Jan); free public transport ran 25–31 January. Main view: 22–28 January; 20–21 January can be shown as background.

## 2. Simulate

Not a physical simulation. Three records share one clock:

- **Purple, observed.** `visualDensity = clamp(C / 100 µg/m³, 0, 1)`, linear; 100 was chosen just above the period's highest citywide value (88.4). It sets how many of the 36,000 symbolic particles (14,000 on phones) are drawn. Between the 07:00 bulletins the value is linearly interpolated for display only; a switch shows steps instead. Particles sit mostly below ERA5 boundary-layer height (minimum 100 m drawn) and drift in the direction of ERA5 10 m wind at a speed that is not to scale. The cloud is the same across the city; purple bars show only the districts each bulletin names, with height proportional to µg/m³ (1 µg/m³ = 30 m of scene height, not an altitude).
- **Grey dashed line, reanalysed.** ERA5 boundary-layer height (mixing height), drawn on a section plane through the centre. Inversion layers are still calculated in `data/meteo.json` but no longer drawn (decided 2026-11-16).
- **Red, reported and schematic.** Drawn only in the reported 10:00 and 14:00 slots from 24 January, as one-hour windows: in the first quarter the aircraft arrives low from the direction of Hua Hin and climbs; then it sprays in a spiral (reported durations range from 20–30 minutes to 1–2 hours). Path: an inward spiral over the centre, after Thai PBS's description; no track is published. Altitude drawn: 850 m, with rings at 3,000 ft (The Nation) and about 1,500 m (AFP). The plume sinks and spreads schematically and fades in 1.5 hours. **Claimed effect (added 2026-11-16 at Paolo's request).** While a plane sprays, an opening appears in the purple over the spray area and the dust there rises through the 'lid'. It grows during spraying and closes over three hours. It is labelled on the page as what the authorities said would happen, not a measurement. The overall amount of purple still follows only the measured bulletins, and the side panel shows the measured morning values before and after each day of flights.

Heights are exaggerated 8 times. Cameras: section (default), city, ground, aircraft, orbit.

## 3. Situate

Operations by the Department of Royal Rainmaking and Agricultural Aviation predate the period: an AFP photo is dated 15 January, and Khaosod reported Bangkok permission on 6 January. The 24 January announcement added inner-Bangkok flights. The Royal Thai Air Force joined on 26 January. Bases are shown as directions: Hua Hin (confirmed), Kanchanaburi and Rayong (airfields not confirmed). Don Mueang is marked as an airport flights were coordinated with, not as a base.

## 4. Narrate

The flights began as the morning values peaked; the values fell over the next four days. The reanalysis shows the morning inversion gone and the mixing height at 580 m on 27 January, with surface wind of 5–6 m/s from the east-northeast. The department claimed it broke the inversion; weather agencies and the governor credited wind and a cold air mass. No public measurement isolates a flight's effect. The view shows a coincidence, not a cause.

## Sources and limits

Every source, with how it was checked, is in `data/sources.json` and on the page.

- **PM2.5 (observed).** BMA Air Quality Information Centre morning bulletins, 05:00–07:00, reported about 07:00, via The Nation (read and confirmed 2026-11-16 for 20–25, 27, 28 Jan). Not 24-hour averages, not hourly. **26 Jan, 58.6 µg/m³: from the official BMA bulletin cited in the research brief; that page could not be loaded here, and The Nation gives only district values that day.** District values are the highest five each report names, not a full map. No spatial PM2.5 field is shown.
- **Weather (reanalysed, modelled).** ERA5 (Copernicus/ECMWF) via the Open-Meteo Historical Weather API, grid point 13.75° N 100.50° E: 2 m temperature, 10 m wind, boundary-layer height. Pressure-level temperatures (1000–850 hPa, kept in the data, not drawn): Open-Meteo Historical Forecast API (archived operational model runs), 13.74° N 100.50° E. Both CC BY 4.0. Fetched 2026-11-16, 20–28 Jan 2025 hourly, local time. One point stands for the whole city; vertical resolution of 200–500 m can miss thin inversions.
- **Flights (reported).** The Nation, Khaosod, The Standard, Amarin TV, Thai PBS, AFP, Bangkok Biznews, MOAC and department reports. Sources disagree on altitude and on when Bangkok flights were first allowed. There is no Bangkok flight log; ≈116 flights nationwide between the 24 and 31 January reports is a difference calculated here.
- **City (cartographic, schematic).** Chao Phraya and Bangkok outline: Natural Earth 1:10m, public domain (coarse). Districts: geoBoundaries THA ADM2 (Royal Thai Survey Department, OCHA ROAP), CC BY 3.0 IGO. Mahanakhon (314 m) and Baiyoke Tower II (309 m, tip 328.4 m) placed and sized from CTBUH and Wikipedia; forms are stylised and footprints exaggerated. All other buildings are generated from a fixed random seed and are not real.
- **What this sketch cannot show:** whether the flights changed PM2.5; where the water and ice went; differences between neighbourhoods beyond the named districts; anything between the morning bulletins; the actual flight paths, times, altitudes or quantities over Bangkok.
