// Prepare the data files the page reads: data/geo.json and data/meteo.json.
//
//   node tools/prepare-data.mjs
//
// Inputs (downloaded into tools/.cache/ on first run, which git ignores):
//   - Natural Earth 1:10m rivers and admin-1 (public domain)
//   - geoBoundaries Thailand ADM2, simplified (CC BY 3.0 IGO; Royal Thai Survey Department, OCHA ROAP)
//   - data/raw/open-meteo-compact.json, already in git. It was fetched on 2026-11-16 from
//     the Open-Meteo Historical Weather API (ERA5) and Historical Forecast API; see README.
//
// Everything is projected to kilometres around 13.75° N, 100.52° E (equirectangular,
// fine at city scale). x grows east, y grows north.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cache = path.join(here, '.cache');
fs.mkdirSync(cache, { recursive: true });

const SOURCES = {
  rivers: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
  admin1: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
  adm2: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/THA/ADM2/geoBoundaries-THA-ADM2_simplified.geojson',
};

async function load(name) {
  const file = path.join(cache, name + '.geojson');
  if (!fs.existsSync(file)) {
    console.log('downloading', name);
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// --- projection -----------------------------------------------------------
const LAT0 = 13.75, LON0 = 100.52;
const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const proj = ([lon, lat]) => [round((lon - LON0) * KX), round((lat - LAT0) * KY)];
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// Douglas–Peucker on projected points (tolerance in km)
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      // distance to the segment's line; for a closed ring (first point = last) use distance to that point
      const d = len < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const rings = g => g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(p => p[0]);
function centroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// Bangkok's 50 districts (khet), as named in geoBoundaries
const KHET = ['Phra Nakhon','Dusit','Nong Chok','Bang Rak','Bang Khen','Bang Kapi','Pathum Wan','Pom Prap Sattru Phai','Phra Khanong','Min Buri','Lat Krabang','Yan Nawa','Samphanthawong','Phaya Thai','Thon Buri','Bangkok Yai','Huai Khwang','Khlong San','Taling Chan','Bangkok Noi','Bang Khun Thian','Phasi Charoen','Nong Khaem','Rat Burana','Bang Phlat','Din Daeng','Bueng Kum','Sathon','Bang Sue','Chatuchak','Bang Kho Laem','Prawet','Khlong Toei','Suan Luang','Chom Thong','Don Mueang','Ratchathewi','Lat Phrao','Watthana','Bang Khae','Lak Si','Sai Mai','Khan Na Yao','Saphan Sung','Wang Thonglang','Khlong Sam Wa','Bang Na','Thawi Watthana','Thung Khru','Bang Bon'];
const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');

const geo = { about: 'Projected to km around 13.75 N, 100.52 E (x east, y north). Natural Earth (public domain); geoBoundaries THA ADM2 (CC BY 3.0 IGO, Royal Thai Survey Department / OCHA ROAP). Landmark positions: CTBUH, Wikipedia, OpenAIP (see sources.json).', origin: [LON0, LAT0] };

const rivers = await load('rivers');
const cp = rivers.features.find(f => f.properties.name === 'Chao Phraya');
const lines = cp.geometry.type === 'LineString' ? [cp.geometry.coordinates] : cp.geometry.coordinates;
geo.river = lines.map(l => l.filter(([x, y]) => y > 13.4 && y < 14.15 && x > 100.3 && x < 100.8).map(proj)).filter(l => l.length > 1);

const admin1 = await load('admin1');
const bkk = admin1.features.find(f => f.properties.adm0_a3 === 'THA' && /Bangkok/.test(f.properties.name));
geo.bangkok = rings(bkk.geometry).map(r => r.map(proj));

const adm2 = await load('adm2');
const want = new Map(KHET.map(n => [norm(n), n]));
want.set(norm('Vadhana'), 'Watthana'); // geoBoundaries spelling
geo.districts = [];
for (const f of adm2.features) {
  const name = want.get(norm(f.properties.shapeName));
  if (!name) continue;
  const rs = rings(f.geometry);
  const big = rs.reduce((a, b) => (b.length > a.length ? b : a));
  const [clon, clat] = centroid(big);
  if (Math.abs(clat - LAT0) > 0.4 || Math.abs(clon - LON0) > 0.5) continue; // same name elsewhere in Thailand
  geo.districts.push({ name, c: proj([clon, clat]), outline: rs.map(r => simplify(r.map(proj), 0.12)) });
}
if (geo.districts.length !== 50) console.warn(`warning: found ${geo.districts.length} of 50 districts`);

geo.landmarks = [
  { id: 'mahanakhon', name: 'King Power Mahanakhon', height: 314, xy: proj([100.52833, 13.72361]), source: 'ctbuh-mahanakhon' },
  { id: 'baiyoke', name: 'Baiyoke Tower II', height: 309, tip: 328.4, xy: proj([100.540556, 13.754167]), source: 'wiki-baiyoke' },
];
geo.airports = [
  { id: 'dmk', name: 'Don Mueang International Airport', role: 'Flights were coordinated with it (The Standard, 6 Jan). Not a confirmed operating base.', xy: proj([100.60667, 13.9125]), source: 'wiki-dmk' },
];
geo.bases = [
  { id: 'huahin', name: 'Hua Hin (Bo Fai)', role: 'Confirmed hub, 5 aircraft (27 Jan).', confirmed: true, xy: proj([99.95139, 12.63611]), source: 'nation-0127-ops' },
  { id: 'kanchanaburi', name: 'Kanchanaburi unit', role: '3 aircraft (27 Jan). Airfield location not confirmed.', confirmed: false, xy: proj([99.44723, 14.12613]), source: 'openaip-kanchanaburi' },
  { id: 'rayong', name: 'Rayong unit', role: '2 aircraft (27 Jan). Airfield (U-Tapao?) not confirmed.', confirmed: false, xy: proj([101.005, 12.67972]), source: 'wiki-utapao' },
];
fs.writeFileSync(path.join(root, 'data/geo.json'), JSON.stringify(geo));

// --- weather ----------------------------------------------------------------
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/raw/open-meteo-compact.json'), 'utf8'));
const levels = [1000, 975, 950, 925, 900, 850];
// profile heights: the mean geopotential height of each pressure level, in metres
// Inversions use the pressure levels only, so both sides of every comparison come from the
// same model. (Comparing ERA5's 2 m temperature with another model's 1000 hPa level would mix datasets.)
const heights = levels.map(l => raw.z[l]);
const inversions = [];
for (let h = 0; h < raw.n; h++) {
  const T = levels.map(l => raw['t' + l][h]);
  const layers = [];
  for (let i = 0; i < T.length - 1; i++) {
    const dT = round(T[i + 1] - T[i], 1);
    if (dT > 0) layers.push([heights[i], heights[i + 1], dT]); // warmer above: an inversion between these levels
  }
  inversions.push(layers);
}
const meteo = {
  about: 'Hourly, local time (UTC+7), from 2025-01-20 00:00. t2m, blh, ws10, wd10: ERA5 reanalysis via Open-Meteo (reanalysed). Pressure-level temperatures: Open-Meteo Historical Forecast API, archived model runs (modelled). Inversion layers are derived here from the pressure levels only: any pair of neighbouring levels where the upper one is warmer. The heights field holds the mean geopotential heights of the levels over 20-28 Jan (m above sea level; Bangkok is about 2-8 m). Coarse vertical resolution (about 200–500 m) means thin inversions can be missed.',
  start: raw.start, n: raw.n, heights, levels,
  t2m: raw.t2m, blh: raw.blh, ws10: raw.ws10, wd10: raw.wd10,
  temps: levels.map(l => raw['t' + l]),
  inversions,
};
fs.writeFileSync(path.join(root, 'data/meteo.json'), JSON.stringify(meteo));

const at7 = d => 24 * d + 7;
console.log('geo: river', geo.river.map(l => l.length), 'districts', geo.districts.length);
for (let d = 0; d < raw.n / 24; d++) console.log(`day ${20 + d} 07:00 blh ${raw.blh[at7(d)]} m, inversions`, JSON.stringify(inversions[at7(d)]));
