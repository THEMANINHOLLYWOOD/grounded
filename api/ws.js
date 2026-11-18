// wss://grounded.inchipala.com/api/ws : the shared room (see _room.js)
import http from 'node:http';
import { attach } from './_room.js';

const server = http.createServer((req, res) => { res.writeHead(426, { 'content-type': 'text/plain' }); res.end('websocket only'); });
attach(server);
export default server;
