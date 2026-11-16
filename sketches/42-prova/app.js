// Co-Modification · sketch 42
// A 3D reading of Bangkok, 20–28 January 2025: observed PM2.5 (purple), reported releases (cyan),
// modelled temperature layers (amber). Three separate records on one clock. Nothing here simulates physics.
//
// Units: 1 scene unit = 1 km horizontally. Heights are exaggerated VZ times (labels give true metres).
// Scene axes: x = east, y = up, z = south (so north is −z). Time t = hours since 2025-01-20 00:00 local.

import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const VZ = 8;                        // vertical exaggeration
const alt = m => (m / 1000) * VZ;    // metres above ground → scene units
const PM_MAX = 100;                  // µg/m³ at which the purple cloud is full (just above the period's peak, 88.4)
const visualDensity = c => Math.min(Math.max(c / PM_MAX, 0), 1);
const T_MAIN = 48, T_END = 216;      // 22 Jan 00:00 → 29 Jan 00:00
const FLIGHT_FT = 3000 * 0.3048;     // 914 m: inner-Bangkok ceiling reported by The Nation, 24 Jan
const FLIGHT_DRAWN = 850;            // drawn altitude, inside that ceiling
const AFP_M = 1500;                  // altitude reported by AFP
const SLOTS = [10, 14];              // reported daily slots (The Nation, 24 Jan; Thai PBS, 27 Jan)
const SLOT_H = 1;                    // drawn length of each slot (reported: 20–30 min to 1–2 h)
const FIRST_FLIGHT_DAY = 4;          // day index: 24 Jan (0 = 20 Jan)
const small = window.matchMedia('(max-width: 760px)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const xyz = ([x, y], h = 0) => new THREE.Vector3(x, h, -y);   // geo km (east, north) → scene

// ---------------------------------------------------------------- data
const [pm, meteo, geo, events, archive] = await Promise.all(
  ['data/pm25.json', 'data/meteo.json', 'data/geo.json', 'data/events.json', 'data/sources.json']
    .map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); })));

const srcIndex = new Map(archive.sources.map((s, i) => [s.id, i + 1]));
const bulletins = pm.days.map(d => ({ ...d, t: dayIndex(d.date) * 24 + 7 }));
function dayIndex(date) { return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2025-01-20T00:00:00Z')) / 864e5); }
const DAYS = ['20', '21', '22', '23', '24', '25', '26', '27', '28'];
const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'];

function pmAt(t, interp) {
  let prev = bulletins[0], next = null;
  for (const b of bulletins) { if (b.t <= t) prev = b; else { next = b; break; } }
  if (!interp || !next || t < bulletins[0].t) return { value: prev.citywide, prev, next, mode: t < bulletins[0].t ? 'before' : 'step' };
  const f = (t - prev.t) / (next.t - prev.t);
  return { value: prev.citywide + f * (next.citywide - prev.citywide), prev, next, mode: 'interp' };
}
function meteoAt(t) {
  const i = Math.min(Math.max(Math.floor(t), 0), meteo.n - 1), j = Math.min(i + 1, meteo.n - 1), f = t - Math.floor(t);
  const lerp = k => meteo[k][i] + f * (meteo[k][j] - meteo[k][i]);
  return { i, blh: lerp('blh'), ws: lerp('ws10'), wd: meteo.wd10[i], t2m: lerp('t2m'), inv: meteo.inversions[i], temps: meteo.temps.map(a => a[i]) };
}

// ---------------------------------------------------------------- renderer, scene
const canvas = $('#view');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('#fail').hidden = false; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const BG = new THREE.Color('#e8e7e3'), BG_PM = new THREE.Color('#d7d0e3');
const scene = new THREE.Scene();
scene.background = BG.clone();
scene.fog = new THREE.Fog(BG.clone(), 70, 220);
const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.4; controls.maxDistance = 160;
scene.add(new THREE.HemisphereLight('#ffffff', '#b9b6ae', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(-20, 30, 10); scene.add(sun);

// ---------------------------------------------------------------- city (cartographic + schematic)
const CBD = new THREE.Vector3(1.5, 0, 1.2);  // between Mahanakhon and Baiyoke Tower II

const groundMat = new THREE.MeshLambertMaterial({ color: '#dcdbd6' });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);

function ringShape(ring) { const s = new THREE.Shape(); ring.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }
for (const ring of geo.bangkok) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(ringShape(ring)), new THREE.MeshLambertMaterial({ color: '#f1f0ec' }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002; scene.add(m);
}
{ // district outlines
  const pts = [];
  for (const d of geo.districts) for (const r of d.outline) for (let i = 0; i < r.length - 1; i++) pts.push(xyz(r[i], 0.006), xyz(r[i + 1], 0.006));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#b3b1aa' })));
}
{ // Chao Phraya as a ribbon (width exaggerated to stay visible)
  for (const line of geo.river) {
    const v = [], idx = [], w = 0.32;
    line.forEach((p, i) => {
      const a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, line.length - 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
      v.push(p[0] + nx, 0.008, -(p[1] + ny), p[0] - nx, 0.008, -(p[1] - ny));
      if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#a9b4b9', side: THREE.DoubleSide })));
  }
}

// seeded random so the schematic city is the same on every visit
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function inside(x, y, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const inBangkok = (x, y) => geo.bangkok.some(r => inside(x, y, r));
{ // generated low-rise and mid-rise fabric: NOT real buildings
  const R = rng(42), N = small ? 1800 : 4200, box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: '#ffffff' }), N);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0, guard = 0;
  const river = geo.river.flat();
  const nearRiver = (x, y) => river.some(([rx, ry]) => (rx - x) ** 2 + (ry - y) ** 2 < 0.35 ** 2);
  while (n < N && guard++ < N * 20) {
    let x, y;
    if (R() < 0.45) { const a = R() * Math.PI * 2, r = Math.sqrt(-2 * Math.log(R() + 1e-9)) * 2.6; x = CBD.x + Math.cos(a) * r; y = -CBD.z + Math.sin(a) * r; }
    else { x = -26 + R() * 56; y = -22 + R() * 44; }
    if (!inBangkok(x, y) || nearRiver(x, y)) continue;
    const d = Math.hypot(x - CBD.x, y + CBD.z);
    const hm = d < 7 ? 25 + 210 * Math.exp(-d / 2.2) * R() ** 1.6 : 6 + 30 * R() ** 2;   // metres
    const fw = 0.05 + R() * (d < 7 ? 0.12 : 0.2), fd = 0.05 + R() * 0.14;
    m4.makeRotationY((R() - 0.5) * 0.3).premultiply(new THREE.Matrix4().makeTranslation(x, 0, -y)).multiply(new THREE.Matrix4().makeScale(fw, alt(hm), fd));
    mesh.setMatrixAt(n, m4);
    col.setHSL(0.1, 0.02, 0.36 + 0.34 * (1 - Math.min(hm / 200, 1)));
    mesh.setColorAt(n, col); n++;
  }
  mesh.count = n; scene.add(mesh);
}
// landmarks: real positions and heights, stylised forms, footprints exaggerated ×2
function landmark(l) {
  const g = new THREE.Group(), [x, y] = l.xy, H = alt(l.height);
  if (l.id === 'mahanakhon') { // stacked, offset blocks: a nod to the 'pixelated' cut, not a model
    const R = rng(7), seg = 18;
    for (let i = 0; i < seg; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, H / seg, 0.09), new THREE.MeshLambertMaterial({ color: '#f7f6f2' }));
      const cut = (i > 5 && R() < 0.6) ? 0.018 : 0; b.position.set(cut * (R() < .5 ? 1 : -1), H / seg * (i + 0.5), cut * (R() < .5 ? 1 : -1)); g.add(b);
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, H * 0.93, 0.07), new THREE.MeshLambertMaterial({ color: '#4a4a4c' }));
    body.position.y = H * 0.465; g.add(body);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.07, H * 0.07, 0.05), new THREE.MeshLambertMaterial({ color: '#6b6b6e' }));
    crown.position.y = H * 0.965; g.add(crown);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, alt(l.tip - l.height)), new THREE.MeshBasicMaterial({ color: '#333' }));
    spire.position.y = H + alt(l.tip - l.height) / 2; g.add(spire);
  }
  g.position.set(x, 0, -y); scene.add(g);
  return g;
}
const marks = Object.fromEntries(geo.landmarks.map(l => [l.id, { l, g: landmark(l) }]));
const dmk = geo.airports[0];
{ const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.01, 3.4), new THREE.MeshBasicMaterial({ color: '#9b9a95' })); m.position.copy(xyz(dmk.xy, 0.01)); m.rotation.y = -0.14; scene.add(m); }
// directions to the regional bases (far outside the frame)
const baseRays = geo.bases.map(b => {
  const dir = new THREE.Vector3(b.xy[0], 0, -b.xy[1]).normalize(), dist = Math.hypot(...b.xy);
  const a = dir.clone().multiplyScalar(19).setY(0.02), z = dir.clone().multiplyScalar(30).setY(0.02);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, z]), new THREE.LineDashedMaterial({ color: '#77756f', dashSize: 0.6, gapSize: 0.4 }));
  line.computeLineDistances(); scene.add(line);
  return { b, end: z, dist };
});

// ---------------------------------------------------------------- PM2.5 (purple, observed, symbolic)
const EXT = new THREE.Vector2(22, 17);             // half-extent of the cloud in km
const NPM = small ? 14000 : 36000;
const pmGeo = new THREE.BufferGeometry();
{
  const R = rng(2025), seed = new Float32Array(NPM * 4), pos = new Float32Array(NPM * 3);
  for (let i = 0; i < NPM; i++) seed.set([R() * 2 - 1, R() * 2 - 1, R(), R()], i * 4);
  pmGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pmGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  pmGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
}
const pmMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uExt: { value: EXT }, uDrift: { value: new THREE.Vector2() }, uMix: { value: 1 }, uTime: { value: 0 },
    uColor: { value: new THREE.Color('#6b3fc6') }, uSize: { value: 2.0 * renderer.getPixelRatio() }, uAlpha: { value: 0.8 },
  }]),
  vertexShader: /* glsl */`
    attribute vec4 aSeed; uniform vec2 uExt; uniform vec2 uDrift; uniform float uMix; uniform float uTime; uniform float uSize;
    varying float vFade;
    #include <fog_pars_vertex>
    void main() {
      vec2 p = aSeed.xy * uExt + uDrift;
      p = mod(p + uExt, 2.0 * uExt) - uExt;                              // wrap inside the extent
      float h = uMix * pow(aSeed.z, 1.7);                                  // most particles low, under the mixing height
      if (aSeed.w > 0.93) h = uMix + (aSeed.w - 0.93) * 40.0 * aSeed.z;    // a thin tail above it
      h += 0.04 * sin(uTime * 0.7 + aSeed.w * 40.0);
      vec4 mvPosition = modelViewMatrix * vec4(p.x, max(h, 0.01), p.y, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = clamp(uSize * 22.0 / -mvPosition.z, 1.0, 5.0);
      vFade = smoothstep(1.0, 0.82, max(abs(p.x) / uExt.x, abs(p.y) / uExt.y));
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; uniform float uAlpha; varying float vFade;
    #include <fog_pars_fragment>
    void main() {
      vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;
      gl_FragColor = vec4(uColor, uAlpha * vFade);
      #include <fog_fragment>
    }`,
});
const pmPoints = new THREE.Points(pmGeo, pmMat); pmPoints.position.copy(CBD).setY(0); scene.add(pmPoints);
// translucent violet haze: stacked sheets up to the mixing height
const haze = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(EXT.x * 2, EXT.y * 2), new THREE.MeshBasicMaterial({ color: '#8a6bd0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(CBD); scene.add(m); haze.push(m);
}
// district bars: only the highest districts named in each bulletin
const barMat = new THREE.MeshLambertMaterial({ color: '#6b3fc6', transparent: true, opacity: 0.85 });
const bars = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 16), barMat); m.visible = false; scene.add(m); return m; });
const BAR_UNITS_PER_UG = 0.03;   // bar height: 1 µg/m³ = 30 m of scene height; not an altitude

// ---------------------------------------------------------------- temperature layers (amber, modelled)
// Drawn as a section plane through the city centre: full width from the side, a strip from above.
const SECTION_D = 2.5;
const invSlabs = Array.from({ length: 6 }, () => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(34, 1, SECTION_D), new THREE.MeshBasicMaterial({ color: '#e08a1e', transparent: true, opacity: 0, depthWrite: false }));
  m.position.copy(CBD); m.visible = false; scene.add(m); return m;
});
const blhFrame = (() => {
  const w = 17, d = SECTION_D / 2, pts = [[-w, -d], [w, -d], [w, d], [-w, d], [-w, -d]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#c06f0c', dashSize: 0.8, gapSize: 0.5 }));
  l.computeLineDistances(); l.position.copy(CBD); scene.add(l); return l;
})();
// altitude scale on the west edge of the section
const SCALE_X = CBD.x - 17, SCALE_Z = CBD.z + SECTION_D / 2;
const TICKS = [0, 250, 500, 1000, 1500];
{
  const pts = [new THREE.Vector3(SCALE_X, 0, SCALE_Z), new THREE.Vector3(SCALE_X, alt(1600), SCALE_Z)];
  for (const m of TICKS) pts.push(new THREE.Vector3(SCALE_X, alt(m), SCALE_Z), new THREE.Vector3(SCALE_X + 0.6, alt(m), SCALE_Z));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#333' })));
}

// ---------------------------------------------------------------- aircraft + release (cyan, reported, schematic)
const FLIGHT_C = CBD.clone();   // no track is published: the spiral is centred on the city centre, schematically
function slotAt(t) {           // which reported slot (if any) covers time t, plus the plume tail after it
  const d = Math.floor(t / 24);
  if (d < FIRST_FLIGHT_DAY || d > 8) return null;
  for (const s of SLOTS) { const t0 = d * 24 + s; if (t >= t0 && t < t0 + SLOT_H + 1.5) return { t0, d, s, p: (t - t0) / SLOT_H }; }
  return null;
}
function flightPos(p, out = new THREE.Vector3()) {   // spiral inwards ('opening the lid', Thai PBS), schematic
  const a = p * Math.PI * 6, r = 7 - 5.5 * p;
  return out.set(FLIGHT_C.x + Math.cos(a) * r, alt(FLIGHT_DRAWN), FLIGHT_C.z + Math.sin(a) * r);
}
const plane = new THREE.Group();
{
  const m = new THREE.MeshLambertMaterial({ color: '#f4f4f1' }), k = new THREE.MeshLambertMaterial({ color: '#2a2a2c' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.09), m); plane.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.95), m); wing.position.x = 0.05; plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), k); tail.position.set(-0.32, 0.08, 0); plane.add(tail);
  const tw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.3), m); tw.position.set(-0.32, 0.02, 0); plane.add(tw);
  plane.visible = false; scene.add(plane);
}
const pathLine = (() => {
  const pts = []; for (let i = 0; i <= 300; i++) pts.push(flightPos(i / 300));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#19b6d2', dashSize: 0.3, gapSize: 0.3, transparent: true, opacity: 0.6 }));
  l.computeLineDistances(); l.visible = false; scene.add(l); return l;
})();
function ring(h, color, dashed) {
  const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(FLIGHT_C.x + Math.cos(a) * 8, alt(h), FLIGHT_C.z + Math.sin(a) * 8)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.35 }) : new THREE.LineBasicMaterial({ color }));
  if (dashed) l.computeLineDistances(); l.visible = false; scene.add(l); return l;
}
const ringCeil = ring(FLIGHT_FT, '#0e8aa0', true), ringAFP = ring(AFP_M, '#0e8aa0', true);
const band = (() => {   // reported altitude range as a faint cylinder wall
  const g = new THREE.CylinderGeometry(8, 8, alt(AFP_M - FLIGHT_FT), 96, 1, true);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#19b6d2', transparent: true, opacity: 0.025, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(FLIGHT_C.x, alt((AFP_M + FLIGHT_FT) / 2), FLIGHT_C.z); m.visible = false; scene.add(m); return m;
})();
const NREL = small ? 2500 : 6000, LIFE = 1.5;   // plume particles per slot; drawn lifetime in hours
const relGeo = new THREE.BufferGeometry();
const relPos = new Float32Array(NREL * 3), relA = new Float32Array(NREL), relSeed = new Float32Array(NREL * 3);
{ const R = rng(15); for (let i = 0; i < NREL * 3; i++) relSeed[i] = R() * 2 - 1; }
relGeo.setAttribute('position', new THREE.BufferAttribute(relPos, 3));
relGeo.setAttribute('aAlpha', new THREE.BufferAttribute(relA, 1));
relGeo.boundingSphere = new THREE.Sphere(FLIGHT_C, 30);
const relMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uSize: { value: 2.4 * renderer.getPixelRatio() } },
  vertexShader: `attribute float aAlpha; varying float vA; uniform float uSize;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(uSize*22.0/-mv.z, 1.0, 6.0); vA = aAlpha; }`,
  fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; if(dot(c,c)>0.25||vA<=0.0) discard; gl_FragColor = vec4(0.10,0.71,0.82,vA); }`,
});
scene.add(new THREE.Points(relGeo, relMat));
const tmp = new THREE.Vector3();
function updateRelease(t, slot) {
  if (!slot) { relA.fill(0); relGeo.attributes.aAlpha.needsUpdate = true; return; }
  for (let i = 0; i < NREL; i++) {
    const te = slot.t0 + (i / NREL) * SLOT_H, age = t - te;          // each particle has a fixed release time
    if (age < 0 || age > LIFE) { relA[i] = 0; continue; }
    flightPos((te - slot.t0) / SLOT_H, tmp);
    const s = 0.25 + age * 1.6;                                           // schematic spread, km
    relPos[i * 3] = tmp.x + relSeed[i * 3] * s;
    relPos[i * 3 + 1] = Math.max(tmp.y - alt(260) * age + relSeed[i * 3 + 1] * 0.25 * s, 0.02); // schematic sinking
    relPos[i * 3 + 2] = tmp.z + relSeed[i * 3 + 2] * s;
    relA[i] = 0.85 * (1 - age / LIFE);
  }
  relGeo.attributes.position.needsUpdate = true; relGeo.attributes.aAlpha.needsUpdate = true;
}

// ---------------------------------------------------------------- labels (HTML, projected each frame)
const labelLayer = $('#labels');
const labels = [];
function label(text, cls, pos, when = () => true) { const el = document.createElement('div'); el.className = 'lab ' + (cls || ''); el.textContent = text; labelLayer.append(el); const L = { el, pos, when }; labels.push(L); return L; }
label('King Power Mahanakhon · 314 m', '', () => marks.mahanakhon.g.position.clone().setY(alt(330)));
label('Baiyoke Tower II · 309 m', '', () => marks.baiyoke.g.position.clone().setY(alt(420)));
label('Chao Phraya', 'far', () => { const r = geo.river[0]; return xyz(r[Math.floor(r.length * 0.62)], 0.05); });
label('Don Mueang Airport', 'far', () => xyz(dmk.xy, 0.1));
for (const r of baseRays) label(`${r.b.name} · ${Math.round(r.dist)} km${r.b.confirmed ? '' : ' (airfield unconfirmed)'}`, 'far', () => r.end);
for (const m of TICKS) label(`${m} m`, 'tick', () => new THREE.Vector3(SCALE_X + 0.6, alt(m), SCALE_Z));
const blhLabel = label('', 'heat', () => new THREE.Vector3(CBD.x - 9, alt(state.blh) + 0.1, CBD.z + SECTION_D / 2));
const ceilLabel = label('3,000 ft · inner-Bangkok ceiling (The Nation)', 'release', () => new THREE.Vector3(FLIGHT_C.x + 8, alt(FLIGHT_FT), FLIGHT_C.z), () => ringCeil.visible);
const afpLabel = label('≈1,500 m · release height (AFP)', 'release', () => new THREE.Vector3(FLIGHT_C.x + 8, alt(AFP_M), FLIGHT_C.z), () => ringAFP.visible);
const planeLabel = label('aircraft · path schematic', 'release', () => plane.position.clone().setY(plane.position.y + 0.3), () => plane.visible);
const barLabels = bars.map(b => label('', 'pm', () => b.position.clone().setY(b.scale.y + 0.25), () => b.visible));
const invLabels = invSlabs.map(s => label('', 'heat', () => new THREE.Vector3(CBD.x + 12, s.position.y, CBD.z + SECTION_D / 2), () => s.visible));
const v = new THREE.Vector3();
function placeLabels() {
  const w = labelLayer.clientWidth, h = labelLayer.clientHeight;
  for (const L of labels) {
    if (!L.when()) { L.el.style.display = 'none'; continue; }
    v.copy(L.pos()).project(camera);
    const off = v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05;
    L.el.style.display = off ? 'none' : '';
    if (!off) L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(${L.el.classList.contains('tick') ? '6px, -50%' : '-50%, -100%'})`;
  }
}

// ---------------------------------------------------------------- cameras
const CAMS = {
  section: { pos: [CBD.x, alt(700), CBD.z + 62], target: [CBD.x, alt(650), CBD.z - 2], fov: 26 },
  city: { pos: [CBD.x - 26, 30, CBD.z + 34], target: [CBD.x + 1, 0, CBD.z - 3], fov: 30 },
  ground: { pos: [0.55, 0.012, 7.2], target: [1.6, alt(260), 0.5], fov: 48 },
  orbit: null, follow: null,
};
let camMode = 'section', tween = null;
function setCam(mode) {
  camMode = mode;
  document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === mode)));
  const c = CAMS[mode];
  controls.enabled = mode !== 'follow';
  if (!c) { tween = null; return; }
  tween = { t: 0, p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(...c.pos), q1: new THREE.Vector3(...c.target), f0: camera.fov, f1: c.fov };
}
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => setCam(b.dataset.cam)));
camera.position.set(...CAMS.section.pos); controls.target.set(...CAMS.section.target); camera.fov = CAMS.section.fov;
const ease = x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
const followPos = new THREE.Vector3(), followLook = new THREE.Vector3();

// ---------------------------------------------------------------- UI: readouts, events, chart, archive
const fmt = (x, d = 1) => x.toFixed(d);
const compass = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(d / 22.5) % 16];
const cite = ids => ids.map(id => `<a href="#src-${id}" title="${archive.sources[srcIndex.get(id) - 1]?.publisher ?? ''}">[${srcIndex.get(id)}]</a>`).join('');

$('#source-list').innerHTML = archive.sources.map(s =>
  `<li id="src-${s.id}"><a href="${s.url}">${s.title}</a> <span class="chk">${s.checked}</span><br><span class="meta">${s.publisher}${s.date ? ' · ' + s.date : ''}${s.lang === 'th' ? ' · in Thai' : ''}. ${s.supports}</span></li>`).join('');

let lastEventKey = '';
function renderEvents(t) {
  const d = Math.floor(t / 24), date = `2025-01-${DAYS[Math.min(d, 8)]}`, h = t % 24;
  const key = date + (d === 4 && h >= 10 ? 'b' : '');
  if (key === lastEventKey) return; lastEventKey = key;
  let list = events.entries.filter(e => e.date === date);
  if (d <= 3) list = events.entries.filter(e => e.context).concat(list);
  $('#events').innerHTML = `<p class="label">${d <= 3 ? 'Before the 24 January announcement' : WEEKDAY[d] + ' ' + DAYS[d] + ' January'}</p>` + list.map(e =>
    `<div class="ev ${e.layer}"><span class="tag">${events.layers[e.layer]}${e.context ? ' · ' + e.date.slice(8) + ' Jan' : ''}${e.time ? ' · ' + e.time : ''}</span>${e.text} <span class="cite">${cite(e.sources)}</span></div>`).join('');
}

const chart = $('#chart'); let chartW = 1000;
function drawChart() {
  const t0 = tMin(), W = chartW = Math.max(chart.clientWidth, 300), H = 78, X = t => (t - t0) / (T_END - t0) * W, Y = c => H - 7 - c / PM_MAX * (H - 20);
  chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let s = '';
  pm.standards.forEach((x, i) => { s += `<line x1="0" x2="${W}" y1="${Y(x.value)}" y2="${Y(x.value)}" stroke="#888" stroke-dasharray="3 3"/><text x="${i ? 4 : W - 4}" y="${Y(x.value) - 2}" text-anchor="${i ? 'start' : 'end'}" fill="#666">${x.label} ${x.value} ${cite([x.source]).replace(/<[^>]+>/g, '')}</text>`; });
  for (let d = Math.ceil(t0 / 24); d < 9; d++) s += `<line x1="${X(d * 24)}" x2="${X(d * 24)}" y1="0" y2="${H}" stroke="#0003" vector-effect="non-scaling-stroke"/><text x="${X(d * 24) + 3}" y="10">${DAYS[d]} Jan</text>`;
  for (let d = FIRST_FLIGHT_DAY; d < 9; d++) for (const sl of SLOTS) s += `<rect x="${X(d * 24 + sl)}" y="${H - 5}" width="${Math.max(X(d * 24 + sl + SLOT_H) - X(d * 24 + sl), 2)}" height="5" fill="#19b6d2"><title>Reported slot, schematic</title></rect>`;
  const vis = bulletins.filter(b => b.t >= t0 - 24);
  s += `<polyline fill="none" stroke="#6b3fc6" stroke-width="1.5" stroke-dasharray="${$('#interp').checked ? '4 3' : '0'}" vector-effect="non-scaling-stroke" points="${
    $('#interp').checked ? vis.map(b => `${X(b.t)},${Y(b.citywide)}`).join(' ') : vis.map((b, i) => `${X(b.t)},${Y(b.citywide)} ${X(vis[i + 1]?.t ?? T_END)},${Y(b.citywide)}`).join(' ')}"/>`;
  for (const b of vis) s += `<circle cx="${X(b.t)}" cy="${Y(b.citywide)}" r="3.2" fill="${b.status === 'verified' ? '#6b3fc6' : '#fff'}" stroke="#6b3fc6" vector-effect="non-scaling-stroke"><title>${b.date} 07:00 · ${b.citywide} µg/m³ · ${b.status}</title></circle>`;
  s += `<line id="cursor" x1="0" x2="0" y1="0" y2="${H}" stroke="#000" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  chart.innerHTML = s;
}
function drawProfile(m) {
  const W = 220, H = 120, tLo = 14, tHi = 34, X = c => 24 + (c - tLo) / (tHi - tLo) * (W - 34), Y = z => H - 14 - z / 1600 * (H - 24);
  const pts = meteo.heights.map((z, i) => [X(m.temps[i]), Y(z)]);
  let s = `<line x1="24" y1="${H - 14}" x2="${W - 8}" y2="${H - 14}" stroke="#000"/><line x1="24" y1="6" x2="24" y2="${H - 14}" stroke="#000"/>`;
  for (const z of [0, 500, 1000, 1500]) s += `<text x="20" y="${Y(z) + 3}" text-anchor="end">${z}</text>`;
  for (const c of [15, 20, 25, 30]) s += `<text x="${X(c)}" y="${H - 3}" text-anchor="middle">${c}°</text>`;
  for (const [z0, z1] of m.inv) s += `<rect x="24" y="${Y(z1)}" width="${W - 32}" height="${Y(z0) - Y(z1)}" fill="#e08a1e" opacity=".22"/>`;
  s += `<line x1="24" x2="${W - 8}" y1="${Y(m.blh)}" y2="${Y(m.blh)}" stroke="#c06f0c" stroke-dasharray="3 2"/>`;
  s += `<polyline fill="none" stroke="#c06f0c" stroke-width="1.6" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
  s += pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#c06f0c"/>`).join('');
  s += `<circle cx="${X(m.t2m)}" cy="${Y(2)}" r="2.4" fill="#fff" stroke="#555"><title>ERA5 2 m temperature</title></circle>`;
  $('#profile').innerHTML = s;
}

// ---------------------------------------------------------------- state and update
const state = { t: 55, playing: !reduced, speed: 3, blh: 100, drift: new THREE.Vector2() };
const tMin = () => $('#early').checked ? 0 : T_MAIN;
const scrub = $('#scrub');
function setT(t) { state.t = Math.min(Math.max(t, tMin()), T_END - 0.01); scrub.value = state.t; }
scrub.addEventListener('input', () => setT(+scrub.value));
$('#play').addEventListener('click', () => { if (state.t >= T_END - 0.02) setT(tMin()); state.playing = !state.playing; syncPlay(); });
function syncPlay() { $('#play').textContent = state.playing ? 'Pause' : 'Play'; $('#play').classList.toggle('on', state.playing); }
$('#speed').addEventListener('change', e => state.speed = +e.target.value);
$('#interp').addEventListener('change', drawChart);
$('#early').addEventListener('change', () => { scrub.min = tMin(); setT(state.t); drawChart(); });
addEventListener('keydown', e => { if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('#play').click(); } });
syncPlay();

function update(t, dtHours) {
  const d = Math.floor(t / 24), h = t - d * 24;
  const interp = $('#interp').checked;
  const p = pmAt(t, interp), m = meteoAt(t), dens = visualDensity(p.value);
  // clock and phase
  $('#clock-date').textContent = `${WEEKDAY[d]} ${DAYS[d]} January 2025`;
  $('#clock-time').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  $('#phase').textContent = d < 2 ? 'Background · 20–21 January' : d < 4 ? 'Prelude · before the 24 January announcement' : 'Main phase · emergency campaign and aftermath';
  // purple
  pmGeo.setDrawRange(0, Math.round(dens * NPM));
  state.blh += (Math.max(m.blh, 100) - state.blh) * Math.min(1, dtHours * 4 + 0.02);
  pmMat.uniforms.uMix.value = alt(state.blh);
  const wv = m.ws * 0.25 * dtHours;                               // drift shows direction and relative speed only
  state.drift.x += -Math.sin(m.wd * Math.PI / 180) * wv; state.drift.y += Math.cos(m.wd * Math.PI / 180) * wv;  // wind FROM wd → moves away
  pmMat.uniforms.uDrift.value.set(state.drift.x, state.drift.y);
  pmMat.uniforms.uTime.value = performance.now() / 1000;
  haze.forEach((s, i) => { s.position.y = alt(state.blh) * (i + 0.5) / haze.length; s.material.opacity = dens * 0.055 * (1 - i / haze.length * 0.6); });
  scene.background.copy(BG).lerp(BG_PM, dens * 0.8); scene.fog.color.copy(scene.background); scene.fog.far = 220 - dens * 80;
  // district bars for the most recent bulletin
  const bul = p.prev;
  bars.forEach((b, i) => {
    const row = t >= bul.t - 7 ? bul.districts[i] : null, dist = row && geo.districts.find(x => x.name === row[0]);
    b.visible = !!dist;
    if (dist) { b.scale.y = row[1] * BAR_UNITS_PER_UG; b.position.copy(xyz(dist.c, b.scale.y / 2)); barLabels[i].el.textContent = `${row[0]} ${fmt(row[1])}`; }
  });
  // amber
  invSlabs.forEach((s, i) => {
    const L = m.inv[i]; s.visible = !!L;
    if (L) { s.scale.y = alt(L[1] - L[0]); s.position.y = alt((L[0] + L[1]) / 2); s.material.opacity = 0.08 + 0.3 * Math.min(L[2] / 0.6, 1); invLabels[i].el.textContent = `inversion ${L[0]}–${L[1]} m · +${fmt(L[2])} °C`; }
  });
  blhFrame.position.y = alt(state.blh); blhLabel.el.textContent = `ERA5 mixing height ${Math.round(m.blh)} m`;
  // cyan
  const slot = slotAt(t), flying = slot && slot.p >= 0 && slot.p < 1;
  plane.visible = !!flying; pathLine.visible = ringCeil.visible = ringAFP.visible = band.visible = t >= FIRST_FLIGHT_DAY * 24 + SLOTS[0];
  if (flying) { flightPos(slot.p, plane.position); const ahead = flightPos(Math.min(slot.p + 0.01, 1), new THREE.Vector3()); plane.lookAt(ahead); plane.rotateY(-Math.PI / 2); }
  updateRelease(t, slot);
  // readouts
  $('#pm-value').textContent = fmt(p.value);
  const b = p.prev, bTxt = `${+b.date.slice(8)} Jan bulletin (07:00): ${fmt(b.citywide)} · ${b.status === 'verified' ? 'checked' : 'not independently checked'} ${cite([b.source])}`;
  $('#pm-note').innerHTML = (p.mode === 'interp' ? `Interpolated for display between morning bulletins. Last: ${bTxt}` : p.mode === 'before' ? `Before the first bulletin shown. Holding ${bTxt}` : `Holding the last bulletin. ${bTxt}`) + ` · ${Math.round(dens * 100)}% of particles drawn`;
  $('#inv-note').innerHTML = (m.inv.length ? 'Inversion: ' + m.inv.map(([a, z, dT]) => `${a}–${z} m (+${fmt(dT)} °C)`).join(', ') : 'No inversion between model levels') + `. ERA5 mixing height ${Math.round(m.blh)} m. ${cite(['era5', 'openmeteo-hf'])}`;
  $('#flight-note').innerHTML = t < FIRST_FLIGHT_DAY * 24 + SLOTS[0]
    ? `No inner-Bangkok flight is drawn before the 24 January announcement (10:00). Operations were already under way in January (AFP photo, 15 Jan). ${cite(['afp-star-0124', 'khaosod-0106'])}`
    : flying ? `Reported ${String(slot.s).padStart(2, '0')}:00 slot. Path, timing within the slot, altitude (850 m drawn) and plume are schematic. Reported altitude: below 3,000 ft or about 1,500 m. ${cite(['nation-0124-flights', 'afp-malaymail-0124', 'thaipbs-0127'])}`
    : slot ? `Plume after the ${slot.s}:00 slot, schematic. Where the water and ice went is not known.`
    : `Outside the reported 10:00 and 14:00 slots. No Bangkok flight log is published. ${cite(['nation-0124-flights'])}`;
  $('#wind-note').innerHTML = `ERA5 surface wind ${fmt(m.ws)} m/s from ${compass(m.wd)} · 2 m air ${fmt(m.t2m)} °C. Purple drift follows this direction; its speed is not to scale.`;
  if (Math.floor(t * 4) !== update.q) { update.q = Math.floor(t * 4); drawProfile(m); }
  renderEvents(t);
  const cur = chart.querySelector('#cursor'); if (cur) { const x = (t - tMin()) / (T_END - tMin()) * chartW; cur.setAttribute('x1', x); cur.setAttribute('x2', x); }
  // follow camera
  if (camMode === 'follow') {
    const sp = slot && slot.p < 1 ? slot.p : 0.15;
    flightPos(Math.max(sp - 0.03, 0), followPos); flightPos(Math.min(sp + 0.02, 1), followLook);
    const back = followPos.clone().sub(followLook).setY(0).normalize().multiplyScalar(1.1);
    camera.position.lerp(followPos.clone().add(back).add(new THREE.Vector3(0, 0.35, 0)), 0.1);
    controls.target.lerp(followLook, 0.08); camera.fov += (50 - camera.fov) * 0.1; camera.updateProjectionMatrix();
  }
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement); resize();
new ResizeObserver(() => { if (Math.abs(chart.clientWidth - chartW) > 4) drawChart(); }).observe(chart);

let last = performance.now();
drawChart(); setT(state.t);
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  let dh = 0;
  if (state.playing) { dh = dt * state.speed; setT(state.t + dh); if (state.t >= T_END - 0.02) { state.playing = false; syncPlay(); } }
  if (tween) {
    tween.t = Math.min(tween.t + dt / 1.6, 1); const k = ease(tween.t);
    camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.q0, tween.q1, k);
    camera.fov = tween.f0 + (tween.f1 - tween.f0) * k; camera.updateProjectionMatrix();
    if (tween.t >= 1) tween = null;
  }
  update(state.t, dh);
  if (camMode !== 'follow') controls.update();
  renderer.render(scene, camera);
  placeLabels();
});
window.__comod = { state, setT, setCam };   // for checks and screenshots
