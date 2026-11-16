# Notes

Working notes for sketch 42 · Co-Modification. Read this first. Date each entry, and move items to Done when they ship.

## Next

- Check the 26 January citywide value (58.6) against the BMA bulletin page; it could not be loaded from the cloud session.
- Look for a Bangkok-specific flight log or before/after measurements (department reports, Royal Thai Air Force). If found, replace the schematic slots.
- Look for hourly station data (BMA or PCD Air4Thai) for 22–28 January; it would replace the interpolation between morning bulletins and allow a real spatial field.
- Consider OpenStreetMap river and building footprints for the centre (Overpass was down on 2026-11-16).

## Decisions

- 2026-11-16: The purple particles follow only the observed bulletins. The cyan release never changes them, so the view does not show the flights clearing the air.
- 2026-11-16: visualDensity = clamp(C / 100, 0, 1). 100 µg/m³ is just above the period's peak (88.4).
- 2026-11-16: Inversions use pressure levels from one model only (1000–850 hPa), not ERA5 2 m temperature, to avoid mixing datasets.
- 2026-11-16: Aircraft drawn at 850 m (inside the 3,000 ft ceiling), with the reported 3,000 ft and ≈1,500 m shown as rings.
- 2026-11-16: The folder stays `42-prova`; the title is Co-Modification.

## Questions

- Which bulletin values should be treated as official: the BMA pages or The Nation's reporting of them?
- Was 24 January really the first inner-Bangkok permission (The Nation), or 6 January (Khaosod)?
- Where did the Kanchanaburi and Rayong units fly from in January 2025?

## Done

- 2026-11-09: started from the template.
- 2026-11-09: first page: title, author, starter question, Sources and limits (all synthetic).
- 2026-11-16: rebuilt as Co-Modification: 3D Bangkok, observed PM2.5, reanalysis and model temperature layers, reported flights, five cameras, timeline 20–28 Jan, source archive.
