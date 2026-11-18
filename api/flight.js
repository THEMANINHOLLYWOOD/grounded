// GET /f/<code>/<date> (rewritten here by vercel.json): the page itself, with this flight's title, description and share image in
// the head so link previews show the flight. The page reads the flight from its address and tracks it. Only the flight number
// and the date ever appear in the address, and the two airports (?r=EWR-IAD) when the route was read from a pass or typed by hand.
import fs from 'node:fs';
import { parseCode, validDate, lookup, givenRoute, fmtDate, spaced } from './_flight.js';
let PAGE = null;
// the page itself: shipped with the function (vercel.json includeFiles), or else fetched from the site once
async function page(host) {
  if (PAGE) return PAGE;
  try { PAGE = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'); } catch { /* not shipped alongside */ }
  if (!PAGE) for (const f of [new URL('../../index.html', import.meta.url), process.cwd() + '/index.html']) { try { PAGE = fs.readFileSync(f, 'utf8'); break; } catch { /* next */ } }
  if (!PAGE && host) PAGE = await (await fetch(`https://${host}/index.html`)).text();
  return PAGE;
}
const attr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x'), parts = u.pathname.split('/').filter(Boolean), q = u.searchParams;
  const f = parseCode(q.get('code') || (parts[0] === 'f' ? parts[1] : '')), date = validDate(q.get('date') || (parts[0] === 'f' ? parts[2] : ''));
  let html = await page(req.headers && req.headers.host);
  if (f) {
    const given = givenRoute(f, q.get('r')), r = given || lookup(f).route, host = req.headers && req.headers.host ? `https://${req.headers.host}` : 'https://grounded.inchipala.com', path = `/f/${f.code}${date ? '/' + date : ''}${q.get('r') && givenRoute(f, q.get('r')) ? '?r=' + q.get('r').toUpperCase() : ''}`;
    const title = `${spaced(f.code)}${r ? ` · ${r.o.code} → ${r.d.code}` : ''}${date ? ` · ${fmtDate(date).replace(/, \d{4}$/, '')}` : ''}`;
    const desc = r ? `Follow ${spaced(f.code)} from ${r.o.city || r.o.name} to ${r.d.city || r.d.name}${date ? ` on ${fmtDate(date)}` : ''}: where it is, and the path it flies.` : `Follow ${spaced(f.code)}${date ? ` on ${fmtDate(date)}` : ''} on Grounded.`;
    const img = `${host}/api/og?code=${encodeURIComponent(f.code)}${date ? '&date=' + date : ''}${given ? `&r=${given.o.code}-${given.d.code}` : ''}`;
    const set = (re, rep) => { html = html.replace(re, rep); };
    set(/<title>[^<]*<\/title>/, `<title>${attr(title)} · Grounded</title>`);
    set(/(<meta name="description" content=")[^"]*"/, `$1${attr(desc)}"`);
    set(/(<meta property="og:title" content=")[^"]*"/, `$1${attr(title)}"`); set(/(<meta name="twitter:title" content=")[^"]*"/, `$1${attr(title)}"`);
    set(/(<meta property="og:description" content=")[^"]*"/, `$1${attr(desc)}"`); set(/(<meta name="twitter:description" content=")[^"]*"/, `$1${attr(desc)}"`);
    set(/(<meta property="og:image" content=")[^"]*"/, `$1${attr(img)}"`); set(/(<meta name="twitter:image" content=")[^"]*"/, `$1${attr(img)}"`);
    set(/(<meta property="og:url" content=")[^"]*"/, `$1${attr(host + path)}"`);
  }
  if (!html.includes('<base href=')) html = html.replace('<head>', '<head>\n<base href="/">'); // the page's files are addressed from the site root, not from /f/...
  res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'); res.end(html);
}
