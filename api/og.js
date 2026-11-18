// GET /api/og?code=UA1880&date=2026-11-20 : the share image for one flight (1200 x 630 PNG): the flight number, the route and
// the map with the path, drawn the way the page draws it. Rendered with @vercel/og (satori + resvg) and cached hard at the CDN.
// It never reads anything but the flight number, the date and, when the route was not in the recordings, the two airports (&r=SXM-EWR).
import { ImageResponse } from '@vercel/og';
import { parseCode, validDate, lookup, givenRoute, land, place, greatCircle, kmBetween, fmtDate, spaced } from './_flight.js';
const h = (type, style, ...children) => ({ type, props: { style, children: children.length === 1 ? children[0] : children } });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function mapSvg(r) {
  // the lower 48 always; and whatever the route needs, with a margin
  let x0 = -10.5, x1 = 10, y0 = -6.8, y1 = 6.2; const pts = [];
  if (r) { for (const [la, lo] of greatCircle([r.o.lat, r.o.lon], [r.d.lat, r.d.lon], 96)) { const [x, y] = place(la, lo); pts.push([x, -y]); x0 = Math.min(x0, x - 1); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y - 1); y1 = Math.max(y1, y + 1); } }
  const W = 760, H = 630, s = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9, cx = (x0 + x1) / 2, cy = -(y0 + y1) / 2, tx = W / 2 - cx * s, ty = H / 2 - cy * s;
  const P = (x, y) => [(x * s + tx).toFixed(1), (y * s + ty).toFixed(1)];
  let route = '';
  if (pts.length) {
    const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + P(x, y).join(' ')).join(''), [ax, ay] = P(...pts[0]), [bx, by] = P(...pts[pts.length - 1]), m = pts[pts.length >> 1], [mx, my] = P(m[0], m[1]);
    route = `<path d="${d}" fill="none" stroke="#ff6b4a" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 13"/>`
      + `<circle cx="${ax}" cy="${ay}" r="9" fill="#16191d"/><circle cx="${bx}" cy="${by}" r="9" fill="#fff" stroke="#16191d" stroke-width="4"/>`
      + `<g transform="translate(${mx} ${my}) rotate(${(Math.atan2(pts[(pts.length >> 1) + 1][1] - m[1], pts[(pts.length >> 1) + 1][0] - m[0]) * 180 / Math.PI).toFixed(1)})"><path d="M14 0 L-10 -11 L-5 0 L-10 11 Z" fill="#ff6b4a"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g transform="translate(${tx.toFixed(1)} ${(ty + 7).toFixed(1)}) scale(${s.toFixed(3)})"><path d="${land().d}" fill="#e3e1db"/></g><g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(3)})"><path d="${land().d}" fill="#f1f0ec" stroke="#fff" stroke-width="${(1.2 / s).toFixed(4)}"/></g>${route}</svg>`;
}
export function card(f, date, r) {
  const label = { fontSize: 22, letterSpacing: 6, color: 'rgba(22,25,29,.5)', textTransform: 'uppercase' };
  const left = h('div', { display: 'flex', flexDirection: 'column', width: 470, padding: '64px 0 56px 64px', justifyContent: 'space-between' },
    h('div', { display: 'flex', flexDirection: 'column' },
      h('div', label, 'Grounded · a flight'),
      h('div', { fontSize: !f || spaced(f.code).length <= 5 ? 112 : spaced(f.code).length <= 7 ? 92 : 74, fontWeight: 700, letterSpacing: -2, marginTop: 34, color: '#16191d', lineHeight: 1, whiteSpace: 'nowrap' }, f ? spaced(f.code) : 'Your flight'), // one line, however long the number
      r ? h('div', { display: 'flex', alignItems: 'center', fontSize: 52, marginTop: 26, color: '#16191d' }, r.o.code, h('div', { color: '#ff6b4a', margin: '0 18px', display: 'flex' }, '→'), r.d.code) : h('div', { fontSize: 30, marginTop: 26, color: 'rgba(22,25,29,.55)' }, 'route to be confirmed'),
      r ? h('div', { fontSize: 24, marginTop: 14, color: 'rgba(22,25,29,.55)' }, `${r.o.city || r.o.name} to ${r.d.city || r.d.name}`) : ''),
    h('div', { display: 'flex', flexDirection: 'column' },
      date ? h('div', { fontSize: 28, color: '#16191d' }, fmtDate(date)) : '',
      r ? h('div', { fontSize: 22, marginTop: 8, color: 'rgba(22,25,29,.5)' }, `${Math.round(kmBetween([r.o.lat, r.o.lon], [r.d.lat, r.d.lon])).toLocaleString('en-US')} km · about ${Math.floor(r.dur / 60)} h ${String(r.dur % 60).padStart(2, '0')} m`) : '',
      h('div', { fontSize: 20, marginTop: 22, color: 'rgba(22,25,29,.4)' }, 'grounded.inchipala.com')));
  const map = { type: 'img', props: { src: 'data:image/svg+xml;base64,' + Buffer.from(mapSvg(r)).toString('base64'), width: 760, height: 630, style: { position: 'absolute', right: 0, top: 0 } } };
  return h('div', { display: 'flex', width: 1200, height: 630, background: '#fff', fontFamily: 'sans-serif', position: 'relative' }, map, left);
}
export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams, f = parseCode(q.get('code')), date = validDate(q.get('date')), r = f ? givenRoute(f, q.get('r')) || lookup(f).route : null;
  try {
    const img = new ImageResponse(card(f, date, r), { width: 1200, height: 630 }), buf = Buffer.from(await img.arrayBuffer());
    res.statusCode = 200; res.setHeader('content-type', 'image/png'); res.setHeader('cache-control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800, immutable'); res.end(buf);
  } catch (e) { res.statusCode = 500; res.setHeader('cache-control', 'no-store'); res.end('could not draw this flight'); }
}
