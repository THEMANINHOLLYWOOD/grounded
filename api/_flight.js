// Shared by /api/route, /api/og and /api/flight: reading a flight code, finding its route in the recorded schedules,
// and the map projection (a copy of grounded-data/proj.mjs, so the share image draws the route where the page does).
// static imports, so the function bundler ships the two data files with the function
import ROUTES from './_routes.json' with { type: 'json' };
import LAND from './_land.json' with { type: 'json' };
import AIRPORTS from './_airports.json' with { type: 'json' };
export const routes = () => ROUTES;
export const land = () => LAND;
// airline designators: the two-character codes on tickets and the three-letter codes they fly under (callsigns)
export const IATA_ICAO = { AA: 'AAL', UA: 'UAL', DL: 'DAL', WN: 'SWA', B6: 'JBU', AS: 'ASA', NK: 'NKS', F9: 'FFT', G4: 'AAY', HA: 'HAL', SY: 'SCX', MX: 'MXY', XP: 'CXP',
  OO: 'SKW', YX: 'RPA', MQ: 'ENY', '9E': 'EDV', OH: 'JIA', PT: 'PDT', ZW: 'AWI', QX: 'QXE', YV: 'ASH', G7: 'GJS', C5: 'UCA', EV: 'ASQ', CP: 'CPZ', AX: 'LOF', KS: 'PEN', '3M': 'SIL', '9K': 'KAP',
  FX: 'FDX', '5X': 'UPS', '5Y': 'GTI', K4: 'CKS', AC: 'ACA', WS: 'WJA', PD: 'POE', TS: 'TSC', F8: 'FLE', AM: 'AMX', Y4: 'VOI', VB: 'VIV', CM: 'CMP', AV: 'AVA', LA: 'LAN', JJ: 'TAM', AD: 'AZU',
  BA: 'BAW', VS: 'VIR', LH: 'DLH', AF: 'AFR', KL: 'KLM', IB: 'IBE', EI: 'EIN', LX: 'SWR', OS: 'AUA', SK: 'SAS', AY: 'FIN', TP: 'TAP', AZ: 'ITY', TK: 'THY', FI: 'ICE', LO: 'LOT', DY: 'NOZ',
  EK: 'UAE', QR: 'QTR', EY: 'ETD', SV: 'SVA', LY: 'ELY', AI: 'AIC', NH: 'ANA', JL: 'JAL', KE: 'KAL', OZ: 'AAR', CX: 'CPA', BR: 'EVA', CI: 'CAL', CA: 'CCA', MU: 'CES', CZ: 'CSN', SQ: 'SIA', PR: 'PAL', QF: 'QFA', NZ: 'ANZ', FJ: 'FJI',
  XE: 'JSX', LF: 'VTE', QK: 'JZA', RV: 'ROU', WG: 'SWG', '8C': 'ATN', GB: 'ABX', KH: 'AAH', '4B': 'BTQ', M6: 'AJT', PO: 'PAC', CV: 'CLX', UP: 'BHS', BW: 'BWA', DE: 'CFG', ET: 'ETH', MS: 'MSR', RJ: 'RJA', AT: 'RAM', SA: 'SAA', VN: 'HVN', '5J': 'CEB' };
export const ICAO_IATA = Object.fromEntries(Object.entries(IATA_ICAO).map(([a, b]) => [b, a]));
// airline names as people write them on tickets and in emails -> the code on the ticket
export const NAMES = [['UNITED', 'UA'], ['AMERICAN', 'AA'], ['DELTA', 'DL'], ['SOUTHWEST', 'WN'], ['JETBLUE', 'B6'], ['JET BLUE', 'B6'], ['ALASKA', 'AS'], ['SPIRIT', 'NK'], ['FRONTIER', 'F9'],
  ['ALLEGIANT', 'G4'], ['HAWAIIAN', 'HA'], ['SUN COUNTRY', 'SY'], ['BREEZE', 'MX'], ['AVELO', 'XP'], ['SKYWEST', 'OO'], ['REPUBLIC', 'YX'], ['ENVOY', 'MQ'], ['ENDEAVOR', '9E'], ['PSA', 'OH'],
  ['PIEDMONT', 'PT'], ['HORIZON', 'QX'], ['MESA', 'YV'], ['GOJET', 'G7'], ['COMMUTEAIR', 'C5'], ['AIR WISCONSIN', 'ZW'], ['FEDEX', 'FX'], ['UPS', '5X'], ['AIR CANADA', 'AC'], ['WESTJET', 'WS'], ['PORTER', 'PD'],
  ['AEROMEXICO', 'AM'], ['VOLARIS', 'Y4'], ['VIVA AEROBUS', 'VB'], ['COPA', 'CM'], ['AVIANCA', 'AV'], ['BRITISH AIRWAYS', 'BA'], ['BRITISH', 'BA'], ['VIRGIN ATLANTIC', 'VS'], ['LUFTHANSA', 'LH'], ['AIR FRANCE', 'AF'], ['KLM', 'KL'],
  ['AER LINGUS', 'EI'], ['IBERIA', 'IB'], ['SWISS', 'LX'], ['ICELANDAIR', 'FI'], ['TURKISH', 'TK'], ['EMIRATES', 'EK'], ['QATAR', 'QR'], ['ETIHAD', 'EY'], ['ALL NIPPON', 'NH'], ['ANA', 'NH'],
  ['JAPAN AIRLINES', 'JL'], ['JAL', 'JL'], ['KOREAN AIR', 'KE'], ['CATHAY', 'CX'], ['EVA AIR', 'BR'], ['SINGAPORE', 'SQ'], ['QANTAS', 'QF'], ['AIR NEW ZEALAND', 'NZ'], ['JSX', 'XE'], ['CONTOUR', 'LF'], ['SILVER', '3M'], ['CAPE AIR', '9K']];
// the regional airlines that fly a mainline carrier's flights. They often fly under their own callsign with the same number
// (United 5432 flown by SkyWest as SKW5432), but not always, so a match through them is only offered, never assumed.
export const PARTNERS = { UA: ['SKW', 'RPA', 'ASH', 'GJS', 'UCA', 'AWI'], AA: ['ENY', 'JIA', 'PDT', 'SKW', 'RPA', 'AWI'], DL: ['EDV', 'SKW', 'RPA'], AS: ['QXE', 'SKW'], AC: ['JZA'] };
export const OPERATORS = { SKW: 'SkyWest', RPA: 'Republic', ASH: 'Mesa', GJS: 'GoJet', UCA: 'CommuteAir', AWI: 'Air Wisconsin', ENY: 'Envoy', JIA: 'PSA', PDT: 'Piedmont', EDV: 'Endeavor', QXE: 'Horizon', JZA: 'Jazz' };
// "UA1880", "ua 1880", "UAL1880", "UA 01880", "United 1880", "UAL1880A" -> { iata: 'UA', icao: 'UAL', num: '1880', code: 'UA1880', cs: 'UAL1880' }
// (and sfx: 'A' when the callsign carries a letter after the number); null if it is not a flight code
export function parseCode(s) {
  const up = String(s || '').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  let al = '', num = '', sfx = '';
  // a name first: "United 1880", "Delta Air Lines flight 691", "jetBlue #1"
  const words = up.replace(/[^A-Z0-9]+/g, ' ').replace(/\b(AIR ?LINES?|AIRWAYS|FLIGHT|FLT|NO|NUMBER)\b/g, ' ').replace(/\s+/g, ' ').trim(), wm = words.match(/^([A-Z][A-Z ]*?) ?0*(\d{1,4})([A-Z]{0,2})$/);
  const named = wm && NAMES.find(([n]) => n === wm[1].trim() || n.replace(/ /g, '') === wm[1].replace(/ /g, ''));
  if (named) { al = named[1]; num = wm[2]; sfx = wm[3]; }
  else { const m = up.replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{3}|[A-Z0-9]{2})0*(\d{1,4})([A-Z]{0,2})$/); if (!m) return null; [, al, num, sfx] = m; }
  if (al.length === 3) { const ia = ICAO_IATA[al]; return { iata: ia || '', icao: al, num, code: (ia || al) + num + sfx, cs: al + num + sfx, ...(sfx ? { sfx } : {}) }; }
  if (!/[A-Z]/.test(al)) return null;
  const ic = IATA_ICAO[al]; return { iata: al, icao: ic || '', num, code: al + num + sfx, cs: ic ? ic + num + sfx : '', ...(sfx ? { sfx } : {}) };
}
export const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d + 'T00:00:00Z')) ? d : '';
const apOut = (A) => ({ code: A[0], name: A[1], city: A[2], region: A[3], lat: A[4], lon: A[5], country: A[6] });
let AP = null; // IATA code -> airport, worldwide (for routes typed by hand, and the airports that line up with a partly seen leg)
export const airport = (code) => { if (!AP) AP = new Map(AIRPORTS.map((A) => [A[0], { code: A[0], name: A[1], city: A[2], country: A[3], lat: A[4], lon: A[5] }])); return AP.get(String(code || '').toUpperCase()) || null; };
// one recorded leg: both airports when it was seen whole; one airport, where it was seen and the airports on that line when seen in part
function legOut(x) {
  const R = routes(), o = x[0] >= 0 ? apOut(R.airports[x[0]]) : null, d = x[1] >= 0 ? apOut(R.airports[x[1]]) : null;
  const L = { o, d, dur: x[2], tods: x[3], arrs: x[4], n: x[5] };
  if (!o || !d) { L.seen = x[6]; L.near = (x[7] || []).map(airport).filter(Boolean); }
  return L;
}
export const legsOf = (cs) => { const x = cs ? routes().r[cs] : null; return x ? x.map(legOut) : []; };
// what the recordings know about a flight: its legs (the most often seen whole leg first), under which callsign they were found, and,
// when there is nothing under its own callsign, the same number flown by one of the airline's regional partners (offered only)
export function lookup(f) {
  if (!f) return { route: null, legs: [], as: '', partners: [] };
  let as = f.cs, legs = legsOf(as);
  if (!legs.length && f.sfx) { as = f.cs.slice(0, -f.sfx.length); legs = legsOf(as); }
  const partners = [];
  if (!legs.length) for (const p of PARTNERS[f.iata] || []) { const l = legsOf(p + f.num); if (l.length) partners.push({ cs: p + f.num, op: OPERATORS[p] || p, legs: l }); }
  const whole = legs.find((l) => l.o && l.d) || null;
  return { route: whole ? { o: whole.o, d: whole.d, dur: whole.dur, tods: whole.tods, src: 'schedule' } : null, legs, as: legs.length ? as : '', partners };
}
// a route given in the flight's link ("EWR-IAD"), when both are real airports; its minutes from the recordings when that leg was seen
export function givenRoute(f, r) {
  const m = String(r || '').toUpperCase().match(/^([A-Z]{3})-([A-Z]{3})$/); if (!m || m[1] === m[2]) return null; const o = airport(m[1]), d = airport(m[2]); if (!o || !d) return null;
  const seen = f ? [...legsOf(f.cs), ...lookup(f).partners.flatMap((p) => p.legs)].find((l) => l.o && l.d && l.o.code === o.code && l.d.code === d.code) : null;
  return { o, d, dur: seen ? seen.dur : Math.round(kmBetween([o.lat, o.lon], [d.lat, d.lon]) / 13.2 + 22), tods: seen ? seen.tods : null, src: seen ? 'schedule' : 'given' };
}
// ---------- the page's map: Albers for the lower 48, true distance and direction beyond (see grounded-data/proj.mjs) ----------
const R_ = Math.PI / 180, p1 = 29.5 * R_, p2 = 45.5 * R_, p0 = 37.5 * R_, l0 = -96 * R_, n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n, K = 27.7;
const C0 = [39.5, -97.5], RC = 0.44, TURN = 0.3, sC = Math.sin(C0[0] * R_), cC = Math.cos(C0[0] * R_), sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const albers = (lat, lon) => { const rho = Math.sqrt(Math.max(0, C - 2 * n * Math.sin(lat * R_))) / n, th = n * (lon * R_ - l0); return [K * rho * Math.sin(th), K * (rho0 - rho * Math.cos(th))]; };
export function place(lat, lon) {
  const sp = Math.sin(lat * R_), cp = Math.cos(lat * R_), dl = (lon - C0[1]) * R_, d = Math.acos(Math.max(-1, Math.min(1, sC * sp + cC * cp * Math.cos(dl))));
  if (d <= RC) return albers(lat, lon);
  const b = Math.atan2(Math.sin(dl) * cp, cC * sp - sC * cp * Math.cos(dl)), sq = sC * Math.cos(RC) + cC * Math.sin(RC) * Math.cos(b), qlat = Math.asin(sq), qlon = C0[1] * R_ + Math.atan2(Math.sin(b) * Math.sin(RC) * cC, Math.cos(RC) - sC * sq), cq = Math.cos(qlat);
  const dq = lon * R_ - qlon, a = Math.atan2(Math.sin(dq) * cp, cq * sp - sq * cp * Math.cos(dq)), lean = n * (qlon - l0), e = d - RC, r = a - lean * (1 - sm(e / TURN)), [qx, qy] = albers(qlat / R_, qlon / R_);
  return [qx + K * e * Math.sin(r), qy + K * e * Math.cos(r)];
}
// points along the great circle from a to b ([lat, lon] each)
export function greatCircle(a, b, N = 64) {
  const v = (la, lo) => [Math.cos(la * R_) * Math.cos(lo * R_), Math.cos(la * R_) * Math.sin(lo * R_), Math.sin(la * R_)], A = v(...a), B = v(...b), om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), out = [];
  for (let i = 0; i <= N; i++) { const f = i / N, s0 = om > 1e-9 ? Math.sin((1 - f) * om) / Math.sin(om) : 1 - f, s1 = om > 1e-9 ? Math.sin(f * om) / Math.sin(om) : f, x = A[0] * s0 + B[0] * s1, y = A[1] * s0 + B[1] * s1, z = A[2] * s0 + B[2] * s1; out.push([Math.atan2(z, Math.hypot(x, y)) / R_, Math.atan2(y, x) / R_]); }
  return out;
}
export const kmBetween = (a, b) => { const h = Math.sin((b[0] - a[0]) * R_ / 2) ** 2 + Math.cos(a[0] * R_) * Math.cos(b[0] * R_) * Math.sin((b[1] - a[1]) * R_ / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(h))); };
export const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const spaced = (code) => code.replace(/^([A-Z0-9]{2,3}?)(\d)/, '$1 $2');
