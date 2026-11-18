// GET /api/route?code=UA1880 : what the recordings (Nov 13-14 2026, adsb.lol, ODbL) know about a flight number: every leg flown under
// it, whole or seen in part, and, when nothing flew under its own callsign, the same number flown by one of the airline's regional
// partners (offered for the person to confirm, never assumed). `route` is the most often seen whole leg, or null.
// No third-party route database is used: the free ones found do not allow their route data to be republished.
import { parseCode, lookup } from './_flight.js';
export default function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams, f = parseCode(q.get('code') || q.get('cs'));
  res.setHeader('content-type', 'application/json');
  if (!f) { res.statusCode = 400; res.setHeader('cache-control', 'public, s-maxage=86400'); res.end(JSON.stringify({ error: 'not a flight code' })); return; }
  const { route, legs, as, partners } = lookup(f);
  res.statusCode = 200; // an unknown flight is an answer too (route: null, legs: []), not an error
  res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.end(JSON.stringify({ ...f, known: !!f.cs, route, legs, as, partners }));
}
