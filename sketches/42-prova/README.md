# 42 · Prova

Author: Paolo Mantecchini · Started: 2026-11-09 · Status: sketch · Stack: static HTML + JS

A test sketch: dots drift in a made-up steady wind. It asks what you can tell about a wind from moving dots alone, and what stays hidden.

## Run

Online, once published: `https://<github-username>.github.io/weather-commons/42-prova/`

On your computer:

```bash
cd sketches/42-prova
python -m http.server 8000
```

Then open http://localhost:8000.

## 1. Event

Which weather event, practice or intervention is this about? When and where did it happen, and who was involved?

## 2. Simulate

What does the model or visualization calculate? What goes in, what rules does it follow, and what comes out?

## 3. Situate

Where does it sit in the world: places, infrastructure, institutions, history, politics?

## 4. Narrate

The story in a few sentences. What can a viewer learn here, and what should they not conclude?

## Sources and limits

For every dataset: who made it, which version and date, when you downloaded it, its licence, and what you changed. Say whether each layer is observed, reanalysed, modelled, synthetic or interpretive. Then say what this sketch cannot show.

- Wind field in `index.html`: synthetic, made up for the starter template (steady east wind, random wobble). Describes no real place or time. Replace it.
- Dot positions: synthetic, random at each page load.
- No observed, reanalysed or modelled data yet.

What this sketch cannot show: any real weather. The wind is constant, flat and not placed on a map.
