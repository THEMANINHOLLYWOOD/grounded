// One shared room for everyone watching Grounded: the playback clock, who is here, where their cursors are,
// and the planes someone is holding or has just thrown. Plain JSON over a WebSocket.
//
// The clock is last-writer-wins: { playing, T, speed, at, set }. T is replay seconds at server time `at` (ms);
// a client works out "now" as T + (serverNow - at) / 1000 * speed, wrapped around the loop. `set` is when a
// person last changed it. Function instances do not share memory, so a client that reconnects brings the clock
// it knew and the room keeps whichever was set most recently.
import { WebSocketServer } from 'ws';

const MAX_PEERS = 250, TICK_MS = 50, NAME_MAX = 20;
// the plane colours a visitor can pick (the page shows the same swatches); anything else is refused
export const COLORS = ['#ff6b4a', '#2f80ed', '#8b5cf6', '#16a37b', '#f2a20c', '#ec4899', '#0ea5b7', '#1f2328'];
// the default clock is pinned to a fixed epoch so every fresh instance (and every offline page) agrees
export const EPOCH = Date.UTC(2026, 10, 15, 0, 0, 0);
export const defaultClock = () => ({ playing: true, T: 0, speed: 300, at: EPOCH, set: 0 });

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

export function attach(server) {
  const wss = new WebSocketServer({ server, maxPayload: 4096 });
  const peers = new Map(); // id -> { ws, id, name, color, x, z, dirty, last }
  let clock = defaultClock(), n = 0;
  const send = (ws, m) => { if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
  const all = (m, except) => { const s = JSON.stringify(m); for (const p of peers.values()) if (p !== except) send(p.ws, s); };
  const pub = (p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, y: p.y || 0, ui: p.ui || '', u: p.u ?? 0, v: p.v ?? 0, d: p.d || 0, sx: p.sx ?? null, sy: p.sy ?? null, pose: p.pose || null, marks: p.marks || null });
  // control ids the cursor can sit on, and the cursor animations everyone sees (open/close name the panel they act on)
  const UI = /^[a-z][a-z0-9]{0,15}$/i, FX = new Set(['press', 'loop', 'grab', 'drop', 'open', 'close']);

  // cursors go out together, at most 20 times a second, and only when something moved
  const tick = setInterval(() => {
    const moved = []; for (const p of peers.values()) if (p.dirty) { p.dirty = false; moved.push([p.id, p.x, p.z, p.y, p.ui || '', p.u ?? 0, p.v ?? 0, p.d || 0, p.sx ?? null, p.sy ?? null]); }
    if (moved.length) all({ t: 'cur', c: moved, now: Date.now() });
    // planes flown from a headset: world position, heading and bank, or null when they stop flying
    const poses = []; for (const p of peers.values()) if (p.poseDirty) { p.poseDirty = false; poses.push([p.id, ...(p.pose || [null])]); }
    if (poses.length) all({ t: 'pose', p: poses });
  }, TICK_MS);
  tick.unref?.();

  wss.on('connection', (ws) => {
    if (peers.size >= MAX_PEERS) { ws.close(1013, 'full'); return; }
    let me = null, budget = 60, refill = Date.now();
    const ok = () => { const t = Date.now(); budget = Math.min(60, budget + (t - refill) * 0.06); refill = t; return budget-- > 0; }; // ~60 msgs/s burst, 60/s sustained
    ws.on('message', (data) => {
      if (!ok()) return;
      let m; try { m = JSON.parse(data); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'ping') { send(ws, { t: 'pong', c: m.c, now: Date.now() }); return; }
      if (m.t === 'hello' && !me) {
        const id = (++n).toString(36) + Math.random().toString(36).slice(2, 6);
        me = { ws, id, name: clean(m.name) || 'Guest', color: COLORS.includes(m.color) ? m.color : COLORS[(peers.size + n) % COLORS.length], x: null, z: null, dirty: false };
        const c = m.clock;
        if (c && num(c.set, 0, 9e15) > clock.set && num(c.T, 0, 1e6) != null && num(c.speed, 1, 5000) && num(c.at, 0, 9e15)) clock = { playing: !!c.playing, T: c.T, speed: c.speed, at: c.at, set: c.set };
        peers.set(id, me);
        send(ws, { t: 'welcome', you: id, color: me.color, now: Date.now(), clock, peers: [...peers.values()].filter((p) => p !== me).map(pub) });
        all({ t: 'join', p: pub(me) }, me);
        return;
      }
      if (!me) return;
      // a cursor is either over the map (a world point) or over a control (its id and where on it, 0..1), so it lands on the same button on every screen
      if (m.t === 'cur') {
        // sx, sy: where that is as a fraction of the sender's screen, for a page where the control is not showing
        if (typeof m.ui === 'string' && UI.test(m.ui)) { me.ui = m.ui; me.u = num(m.u, 0, 1) ?? 0.5; me.v = num(m.v, 0, 1) ?? 0.5; me.d = m.d ? 1 : 0; me.sx = num(m.sx, 0, 1); me.sy = num(m.sy, 0, 1); me.x = me.z = null; }
        else { me.ui = ''; me.d = 0; me.sx = me.sy = null; me.x = num(m.x, -60, 60); me.z = num(m.z, -60, 60); me.y = num(m.y, 0, 5) ?? 0; }
        me.dirty = true; return;
      }
      if (m.t === 'fx') { if (FX.has(m.kind)) all({ t: 'fx', by: me.id, kind: m.kind, on: typeof m.on === 'string' && UI.test(m.on) ? m.on : '' }, me); return; }
      if (m.t === 'pose') {
        if (m.off) me.pose = null;
        else { const v = [num(m.x, -60, 60), num(m.y, -5, 30), num(m.z, -60, 60), num(m.h, -50, 50), num(m.b, -2, 2)]; if (v.some((x) => x == null)) return; me.pose = v.map((x) => Math.round(x * 1000) / 1000); }
        me.poseDirty = true; return;
      }
      // the flights someone is following, as coloured marks for everyone else: only where each is right now (lat, lon, track,
      // feet). No flight number, route or name is sent or relayed; the marks go when the flights land or the person leaves.
      if (m.t === 'marks') {
        const list = Array.isArray(m.m) ? m.m.slice(0, 12) : [], out = [];
        for (const q of list) { if (!Array.isArray(q)) continue; const v = [num(q[0], -90, 90), num(q[1], -180, 180), num(q[2], -360, 360), num(q[3], 0, 60000)]; if (v.every((x) => x != null)) out.push([Math.round(v[0] * 1e4) / 1e4, Math.round(v[1] * 1e4) / 1e4, Math.round(v[2]), Math.round(v[3] / 100) * 100]); }
        me.marks = out.length ? out : null; all({ t: 'marks', by: me.id, m: me.marks }, me); return;
      }
      if (m.t === 'color') { if (COLORS.includes(m.color)) { me.color = m.color; all({ t: 'color', id: me.id, color: me.color }); } return; }
      if (m.t === 'name') { me.name = clean(m.name) || me.name; all({ t: 'name', id: me.id, name: me.name }); return; }
      if (m.t === 'clock') {
        const T = num(m.T, 0, 1e6), speed = num(m.speed, 1, 5000); if (T == null || speed == null) return;
        const now = Date.now(); clock = { playing: !!m.playing, T, speed, at: now, set: now };
        all({ t: 'clock', clock, by: me.id, name: me.name, what: clean(m.what).slice(0, 12), now }); // to everyone, the sender too: it learns the server's `at`
        return;
      }
      if (m.t === 'grab' || m.t === 'throw') {
        const k = num(m.k, 0, 1e7), ox = num(m.ox, -40, 40), oz = num(m.oz, -40, 40); if (k == null || ox == null || oz == null) return;
        const out = { t: m.t, by: me.id, k: k | 0, ox, oz };
        const hs = num(m.hs, 0, 1e6); if (hs != null) out.hs = Math.round(hs); if (m.ms) out.ms = 1; // how long it has been held (clock seconds) and whether it missed its flight
        if (m.t === 'throw') { out.vx = num(m.vx, -200, 200) ?? 0; out.vz = num(m.vz, -200, 200) ?? 0; }
        all(out, me);
      }
    });
    ws.on('close', () => { if (me) { peers.delete(me.id); all({ t: 'leave', id: me.id }); } });
    ws.on('error', () => {});
  });
  return wss;
}
