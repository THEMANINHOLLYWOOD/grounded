// GET /api/live : airline flights over the lower 48 right now, from the adsb.fi open data API
// (https://adsb.fi, personal non-commercial use, 1 request per second). The API only answers circles of up to
// 250 NM, so one refresh walks 22 circles, one request every 1.2 s, and the CDN keeps the result for 30 s and
// serves it stale while the next walk runs. A page polls this every few seconds and dead-reckons in between.
const CELLS = [
  [47, -119.5], [47, -108.9], [47, -98.3], [47, -87.7], [47, -77.1], [47, -68.5],
  [41, -122.5], [41, -113], [41, -103.5], [41, -94], [41, -84.5], [41, -75],
  [35, -120.5], [35, -111.7], [35, -102.9], [35, -94.1], [35, -85.3], [35, -76.5],
  [29, -107.5], [29, -99], [29, -90.8], [29, -82.6],
  [61.2, -149.9], [64.8, -147.9], [57.8, -134.8], [20.8, -157.3], // Alaska (Anchorage, Fairbanks, the Southeast) and Hawaii
];
const AIRLINE = /^[A-Z]{3}\d[0-9A-Z]{0,4}$/, GAP = 1200, FRESH = 25000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cache = null, inflight = null; // per instance: never walk twice at once, and reuse a fresh walk

async function walk() {
  const seen = new Map(); let ok = 0, last = 0;
  for (const [lat, lon] of CELLS) {
    const wait = last + GAP - Date.now(); if (wait > 0) await sleep(wait); last = Date.now();
    try {
      const r = await fetch(`https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/250`, { headers: { 'user-agent': 'grounded-viewer (non-commercial)' }, signal: AbortSignal.timeout(8000) });
      if (r.status === 429) { await sleep(2500); continue; }
      if (!r.ok) continue;
      const d = await r.json(), now = d.now || Date.now(); ok++;
      for (const a of d.ac || []) {
        const cs = (a.flight || '').trim();
        if (!AIRLINE.test(cs) || a.lat == null || a.lon == null || a.alt_baro === 'ground' || typeof a.alt_baro !== 'number' || (a.seen_pos ?? 99) > 60) continue;
        const ak = a.lat > 51 && (a.lon < -129 || a.lon > 170), hi = a.lat > 17 && a.lat < 24.5 && a.lon > -162.5 && a.lon < -153;
        if (!ak && !hi && (a.lat < 23 || a.lat > 50.5 || a.lon < -128 || a.lon > -64)) continue;
        const t = Math.round(now - (a.seen_pos || 0) * 1000), prev = seen.get(a.hex);
        if (prev && prev[8] >= t) continue;
        seen.set(a.hex, [a.hex, cs, +a.lat.toFixed(4), +a.lon.toFixed(4), Math.round(a.alt_baro), Math.round(a.gs || 0), Math.round(a.track ?? 0), a.t || '', t, a.r || '', typeof a.baro_rate === 'number' ? Math.round(a.baro_rate) : null, a.squawk || '']); // registration, climb rate and squawk for the card (never owner or operator)
      }
    } catch { /* one circle missing is fine */ }
  }
  return { now: Date.now(), cells: ok, of: CELLS.length, source: 'adsb.fi', ac: [...seen.values()] };
}

async function get() {
  if (cache && Date.now() - cache.now < FRESH) return cache;
  if (!inflight) inflight = walk().then((d) => { if (d.cells) cache = d; return cache || d; }).finally(() => { inflight = null; });
  return inflight;
}

export default async function handler(req, res) {
  try {
    const d = await get();
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', d.cells ? 'public, max-age=5, s-maxage=30, stale-while-revalidate=300' : 'no-store');
    res.statusCode = d.cells ? 200 : 503;
    res.end(JSON.stringify(d));
  } catch (e) {
    res.statusCode = 502; res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify({ error: 'live feed unavailable' }));
  }
}
