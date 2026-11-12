// CYBER SEC — сервер для хостинга на своём ПК: статика + аккаунты + синхронизация прогресса.
// Запуск:  node tools/server.mjs            (порт 8080, слушает всю локальную сеть)
// Настройка через переменные окружения:
//   PORT=8080          порт
//   HOST=0.0.0.0       0.0.0.0 = доступен друзьям; 127.0.0.1 = только с этого ПК
//   INVITE_CODE=xxxx   если задан — регистрация только по коду-приглашению
// Данные лежат в папке data/ (users.json, progress/<ник>.json) — это и есть вся «база».
// Пароли хранятся только как scrypt-хеш с солью, сессии — в HttpOnly cookie.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, 'data');
const progDir = path.join(dataDir, 'progress');
fs.mkdirSync(progDir, { recursive: true });
const PORT = Number(process.env.PORT || process.argv[2]) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const INVITE = process.env.INVITE_CODE || '';
const SECURE_COOKIE = process.env.SECURE_COOKIE === '1'; // включить, если стоит за HTTPS (туннель/прокси)

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const PRIVATE = new Set(['data', 'tools', 'tests', '.git', '_backup_2026-10-08', 'node_modules']);

// ---------- хранилище ----------
const usersFile = path.join(dataDir, 'users.json');
const sessFile = path.join(dataDir, 'sessions.json');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJSON = (f, v) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); };
let users = readJSON(usersFile, {});
let sessions = readJSON(sessFile, {});
const saveUsers = () => writeJSON(usersFile, users);
const saveSessions = () => writeJSON(sessFile, sessions);
const key = (nick) => nick.toLowerCase();
const progFile = (nick) => path.join(progDir, crypto.createHash('sha1').update(key(nick)).digest('hex') + '.json');

function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function checkPw(pw, u) {
  const h = crypto.scryptSync(pw, u.salt, 64);
  const b = Buffer.from(u.hash, 'hex');
  return b.length === h.length && crypto.timingSafeEqual(b, h);
}

// ---------- защита от перебора ----------
const fails = new Map(); // ip -> [timestamps]
function tooMany(ip) { const now = Date.now(); const a = (fails.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000); fails.set(ip, a); return a.length >= 8; }
function noteFail(ip) { const a = fails.get(ip) || []; a.push(Date.now()); fails.set(ip, a); }

// ---------- утилиты HTTP ----------
function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function cookie(req, name) { const m = (req.headers.cookie || '').split(/;\s*/).map((x) => x.split('=')).find((x) => x[0] === name); return m ? decodeURIComponent(m[1] || '') : ''; }
function authed(req) { const t = cookie(req, 'cs_session'); const s = t && sessions[t]; if (!s) return null; if (Date.now() - s.t > 90 * 86400e3) { delete sessions[t]; return null; } return users[s.k] ? { token: t, k: s.k, nick: users[s.k].nick } : null; }
function startSession(res, k) {
  const token = crypto.randomBytes(32).toString('hex'); sessions[token] = { k, t: Date.now() }; saveSessions();
  return { 'set-cookie': `cs_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 86400}${SECURE_COOKIE ? '; Secure' : ''}` };
}

// ---------- API ----------
async function api(req, res, url) {
  const ip = req.socket.remoteAddress || '?';
  const route = req.method + ' ' + url.pathname;
  try {
    if (route === 'GET /api/ping') return send(res, 200, { ok: true, invite: !!INVITE });
    if (route === 'GET /api/me') { const a = authed(req); return send(res, 200, a ? { nick: a.nick } : { nick: null }); }

    if (route === 'POST /api/register') {
      if (tooMany(ip)) return send(res, 429, { error: 'Слишком много попыток, подожди несколько минут.' });
      const b = await readBody(req, 4096);
      const nick = String(b.nick || '').trim(), pw = String(b.password || '');
      if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(nick)) return send(res, 400, { error: 'Ник: 3–24 символа — буквы, цифры, _ или -.' });
      if (pw.length < 6 || pw.length > 200) return send(res, 400, { error: 'Пароль — минимум 6 символов.' });
      if (INVITE && b.invite !== INVITE) { noteFail(ip); return send(res, 403, { error: 'Нужен верный код-приглашение.' }); }
      if (users[key(nick)]) return send(res, 409, { error: 'Этот ник уже занят.' });
      users[key(nick)] = { nick, ...hashPw(pw), created: Date.now() }; saveUsers();
      return send(res, 200, { nick }, startSession(res, key(nick)));
    }
    if (route === 'POST /api/login') {
      if (tooMany(ip)) return send(res, 429, { error: 'Слишком много попыток, подожди несколько минут.' });
      const b = await readBody(req, 4096); const u = users[key(String(b.nick || '').trim())];
      if (!u || !checkPw(String(b.password || ''), u)) { noteFail(ip); return send(res, 401, { error: 'Неверный ник или пароль.' }); }
      return send(res, 200, { nick: u.nick }, startSession(res, key(u.nick)));
    }
    if (route === 'POST /api/logout') { const a = authed(req); if (a) { delete sessions[a.token]; saveSessions(); } return send(res, 200, { ok: true }, { 'set-cookie': 'cs_session=; Path=/; HttpOnly; Max-Age=0' }); }

    const a = authed(req);
    if (!a) return send(res, 401, { error: 'Нужно войти.' });
    if (route === 'GET /api/progress') { return send(res, 200, readJSON(progFile(a.nick), { state: null, crypto: null, updated: 0 })); }
    if (route === 'PUT /api/progress') {
      const b = await readBody(req);
      if (!b || typeof b.state !== 'object') return send(res, 400, { error: 'Нет state.' });
      const rec = { state: b.state, crypto: b.crypto && typeof b.crypto === 'object' ? b.crypto : null, updated: Date.now() };
      // Резервная копия предыдущей версии раз в сутки — чтобы историю обучения нельзя было потерять случайно.
      const f = progFile(a.nick);
      if (fs.existsSync(f)) { const bak = f.replace(/\.json$/, '.' + new Date().toISOString().slice(0, 10) + '.bak'); if (!fs.existsSync(bak)) fs.copyFileSync(f, bak); }
      writeJSON(f, rec); return send(res, 200, { ok: true, updated: rec.updated });
    }
    return send(res, 404, { error: 'Нет такого метода.' });
  } catch (e) { return send(res, 400, { error: 'Ошибка запроса.' }); }
}

// ---------- статика ----------
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
  const fp = path.join(root, path.normalize(rel));
  const top = path.relative(root, fp).split(path.sep)[0];
  if (!fp.startsWith(root) || PRIVATE.has(top) || top.startsWith('.')) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return void api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveStatic(req, res, url);
}).listen(PORT, HOST, () => {
  console.log(`CYBER SEC запущен → http://localhost:${PORT}   (слушает ${HOST})`);
  console.log(INVITE ? 'Регистрация: по коду-приглашению.' : 'Регистрация: открытая (задай INVITE_CODE, чтобы ограничить).');
  console.log('Данные учеников: ' + dataDir);
});
