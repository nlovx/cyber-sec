/* CYBER SEC — аккаунты и синхронизация прогресса с сервером (tools/server.mjs),
   плюс экраны «Вход» и «Мой прогресс» (история обучения, активность, треки).
   Если сервера нет (открыто двойным кликом по index.html) — всё работает локально, как раньше. */
(function () {
  'use strict';
  var U = window.CSUI && window.CSUI.helpers;
  if (!U || !window.CS) return;
  var h = U.h, clear = U.clear;
  var CRYPTO_KEY = 'cryptolab-progress';

  var A = { available: false, nick: null, invite: false, status: 'local', lastSync: 0, error: '' };
  var pushTimer = null, ready = null;

  function api(method, url, body, keepalive) {
    return fetch(url, { method: method, credentials: 'same-origin', keepalive: !!keepalive, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }

  // ---------- слияние состояний (никогда не теряем прогресс ни с одной стороны) ----------
  function mergeStates(a, b) {
    if (!a) return b; if (!b) return a;
    var o = JSON.parse(JSON.stringify(b)), i;
    o.xp = Math.max(a.xp || 0, b.xp || 0);
    o.createdAt = Math.min(a.createdAt || Infinity, b.createdAt || Infinity);
    if ((a.streak && a.streak.lastDay || 0) > (b.streak && b.streak.lastDay || 0)) o.streak = a.streak;
    o.lessons = o.lessons || {};
    for (i in (a.lessons || {})) { var x = a.lessons[i], y = o.lessons[i]; if (!y) o.lessons[i] = x; else { y.done = !!(x.done || y.done); y.mastery = Math.max(x.mastery || 0, y.mastery || 0); y.attempts = Math.max(x.attempts || 0, y.attempts || 0); y.bestAt = Math.max(x.bestAt || 0, y.bestAt || 0) || undefined; } }
    o.topics = o.topics || {};
    for (i in (a.topics || {})) { if (!o.topics[i] || (a.topics[i].mastery || 0) > (o.topics[i].mastery || 0)) o.topics[i] = a.topics[i]; }
    o.cards = o.cards || {};
    for (i in (a.cards || {})) { if (!o.cards[i] || (a.cards[i].lastReview || 0) > (o.cards[i].lastReview || 0)) o.cards[i] = a.cards[i]; }
    var seen = {}, hist = (a.history || []).concat(b.history || []).filter(function (e) { var k = e.t + '|' + e.type + '|' + e.id; if (seen[k]) return false; seen[k] = 1; return true; });
    hist.sort(function (p, q) { return p.t - q.t; }); o.history = hist.slice(-2000);
    if ((a.calib && a.calib.n || 0) > (b.calib && b.calib.n || 0)) o.calib = a.calib;
    if (a.diagnostic && !o.diagnostic) o.diagnostic = a.diagnostic;
    if (a.name && (!o.name || o.name === 'Ученик')) o.name = a.name;
    return o;
  }
  function mergeCrypto(a, b) {
    if (!a) return b; if (!b) return a;
    var o = { v: 1, nick: b.nick || a.nick || '', solved: Object.assign({}, a.solved, b.solved), srs: Object.assign({}, a.srs), notes: Object.assign({}, a.notes, b.notes), badges: Object.assign({}, a.badges, b.badges) };
    for (var k in (b.srs || {})) { var x = o.srs[k]; if (!x || (b.srs[k].t || 0) > (x.t || 0)) o.srs[k] = b.srs[k]; }
    o.days = Array.from(new Set((a.days || []).concat(b.days || []))).sort().slice(-120);
    return o;
  }
  function readCrypto() { try { return JSON.parse(localStorage.getItem(CRYPTO_KEY)); } catch (e) { return null; } }
  function hasProgress(s) { return !!(s && (s.xp > 0 || Object.keys(s.lessons || {}).length)); }

  // ---------- синхронизация ----------
  function setStatus(s, err) { A.status = s; A.error = err || ''; var el = document.getElementById('sync-dot'); if (el) { el.className = 'sync-dot ' + s; el.title = statusText(); } }
  function statusText() { return { local: 'Сохраняется только в этом браузере', synced: 'Сохранено на сервере', saving: 'Сохраняю…', error: 'Нет связи с сервером: ' + A.error + ' (прогресс сохранён локально)' }[A.status]; }

  function push(keepalive) {
    if (!A.nick) return Promise.resolve();
    setStatus('saving');
    var body = { state: JSON.parse(CS.exportProfile()), crypto: readCrypto() };
    return api('PUT', '/api/progress', body, keepalive).then(function () { A.lastSync = Date.now(); setStatus('synced'); }).catch(function (e) { if (e.status === 401) { A.nick = null; setStatus('local'); U.renderChrome(); } else setStatus('error', e.message); });
  }
  function schedulePush() { if (!A.nick) return; clearTimeout(pushTimer); pushTimer = setTimeout(function () { push(false); }, 1800); }

  function pull() {
    return api('GET', '/api/progress').then(function (rec) {
      var remote = rec && rec.state && typeof rec.state.xp === 'number' ? rec.state : null;
      var local = JSON.parse(CS.exportProfile());
      var merged = mergeStates(hasProgress(local) ? local : null, remote) || local;
      if (!hasProgress(local) && !remote) merged = local;
      CS.importProfile(JSON.stringify(merged));
      var c = mergeCrypto(readCrypto(), rec && rec.crypto);
      if (c) { try { localStorage.setItem(CRYPTO_KEY, JSON.stringify(c)); } catch (e) {} }
      return push(false);
    });
  }

  function init() {
    if (!/^https?:$/.test(location.protocol)) { ready = Promise.resolve(); return ready; }
    ready = api('GET', '/api/ping').then(function (p) {
      A.available = true; A.invite = !!p.invite;
      return api('GET', '/api/me');
    }).then(function (m) {
      if (m.nick) { A.nick = m.nick; setStatus('synced'); return pull(); }
    }).catch(function () { /* сервера нет — локальный режим */ }).then(function () { CS.onSave(schedulePush); U.renderChrome(); });
    window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && A.nick) { try { push(true); } catch (e) {} } });
    return ready;
  }

  function auth(kind, nick, password, invite) {
    return api('POST', '/api/' + kind, { nick: nick, password: password, invite: invite }).then(function (r) { A.nick = r.nick; return pull(); }).then(function () { U.renderChrome(); });
  }
  function logout() { return api('POST', '/api/logout').catch(function () {}).then(function () { A.nick = null; setStatus('local'); U.renderChrome(); }); }

  // ---------- Шапка: пилюля аккаунта ----------
  function pill() {
    if (!A.available) return null;
    var a = h('a', 'chrome-pill acc-pill'); a.href = A.nick ? '#/me' : '#/login';
    if (A.nick) { var d = h('span', 'sync-dot ' + A.status); d.id = 'sync-dot'; d.title = statusText(); a.appendChild(d); a.appendChild(document.createTextNode(' ' + A.nick)); }
    else a.textContent = 'Войти';
    return a;
  }

  // ---------- Экран входа ----------
  function viewLogin() {
    U.renderChrome(); var app = U.getApp(); clear(app);
    if (!A.available) { var c0 = h('div', 'card center'); c0.appendChild(h('h2', null, 'Аккаунты доступны на сервере')); c0.appendChild(h('p', 'muted', 'Ты открыл платформу как файл. Чтобы был вход и прогресс на сервере, запусти start.bat (или node tools/server.mjs) и открой адрес из консоли.')); app.appendChild(c0); return; }
    if (A.nick) { location.hash = '#/me'; return; }
    var mode = 'login', card = h('div', 'card auth-card');
    var logo = h('div', 'auth-logo', '⛨ CYBER SEC'); card.appendChild(logo);
    var title = h('h2', null), sub = h('p', 'muted'), err = h('div', 'auth-err');
    var nick = h('input', 'txt'), pw = h('input', 'txt'), inv = h('input', 'txt');
    nick.placeholder = 'Ник (3–24 символа)'; nick.autocomplete = 'username'; pw.type = 'password'; pw.placeholder = 'Пароль (от 6 символов)'; inv.placeholder = 'Код-приглашение';
    var go = h('button', 'btn primary big'), sw = h('button', 'btn ghost');
    function draw() {
      title.textContent = mode === 'login' ? 'С возвращением' : 'Создать аккаунт'; sub.textContent = mode === 'login' ? 'Войди, чтобы продолжить с того места, где остановился, — с любого устройства.' : 'Прогресс, повторения и история обучения будут храниться на сервере и не пропадут.';
      go.textContent = mode === 'login' ? 'Войти' : 'Создать и начать'; sw.textContent = mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти';
      pw.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; inv.style.display = mode === 'register' && A.invite ? '' : 'none'; err.textContent = '';
    }
    function submit() { go.disabled = true; err.textContent = ''; auth(mode, nick.value.trim(), pw.value, inv.value.trim()).then(function () { location.hash = '#/'; CSUI.route(); }).catch(function (e) { err.textContent = e.message; go.disabled = false; }); }
    go.onclick = submit; sw.onclick = function () { mode = mode === 'login' ? 'register' : 'login'; draw(); };
    [nick, pw, inv].forEach(function (i) { i.onkeydown = function (e) { if (e.key === 'Enter') submit(); }; });
    [title, sub, nick, pw, inv, err, go, sw].forEach(function (e) { card.appendChild(e); });
    var skip = h('a', 'muted auth-skip', 'Продолжить без аккаунта (прогресс только в этом браузере)'); skip.href = '#/'; card.appendChild(skip);
    app.appendChild(card); draw(); nick.focus();
  }

  // ---------- Экран «Мой прогресс»: история обучения ----------
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function viewMe() {
    U.renderChrome(); var app = U.getApp(); clear(app);
    app.appendChild(U.crumbs([['Главная', '#/'], ['Мой прогресс', null]]));
    var s = CS.state, L = CS.levelInfo(), hist = (s.history || []).slice();

    var top = h('section', 'me-top'), av = h('div', 'me-av', L.glyph);
    var who = h('div', 'me-who'); who.appendChild(h('h1', null, A.nick || s.name || 'Ученик'));
    who.appendChild(h('p', 'muted', L.rank + ' · уровень ' + L.level + ' · ' + L.xp + ' XP' + (A.nick ? '' : ' · гость (прогресс только в этом браузере)')));
    var bar = h('div', 'lp-bar'); var fill = h('div', 'lp-fill'); fill.style.width = L.pct + '%'; bar.appendChild(fill); who.appendChild(bar);
    top.appendChild(av); top.appendChild(who); app.appendChild(top);

    var doneL = Object.keys(s.lessons).filter(function (k) { return s.lessons[k].done; }).length, totalL = 0;
    CS.allCourses().forEach(function (c) { totalL += c.lessons.length; });
    var tiles = h('div', 'me-tiles');
    [['Уроков пройдено', doneL + ' / ' + totalL], ['Серия', (s.streak.count || 0) + ' дн.'], ['Карточек в памяти', Object.keys(s.cards).length], ['Активных дней', new Set(hist.map(function (e) { return dayKey(e.t); })).size]].forEach(function (t) { var d = h('div', 'me-tile'); d.appendChild(h('b', null, String(t[1]))); d.appendChild(h('span', null, t[0])); tiles.appendChild(d); });
    app.appendChild(tiles);

    // Тепловая карта активности (последние 18 недель).
    var cnt = {}; hist.forEach(function (e) { var k = dayKey(e.t); cnt[k] = (cnt[k] || 0) + 1; });
    var heat = h('section', 'me-sec'); heat.appendChild(h('h2', null, 'Активность'));
    var grid = h('div', 'me-heat'), today = new Date(); today.setHours(0, 0, 0, 0);
    var start = new Date(today); start.setDate(start.getDate() - (18 * 7 - 1) - ((today.getDay() + 6) % 7));
    for (var d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) { var n = cnt[dayKey(d)] || 0, c = h('i', 'hc' + Math.min(n, 4)); c.title = dayKey(d) + ': ' + n + ' ур.'; grid.appendChild(c); }
    heat.appendChild(grid); app.appendChild(heat);

    // Прогресс по направлениям.
    var tr = h('section', 'me-sec'); tr.appendChild(h('h2', null, 'Направления'));
    CS.allTracks().forEach(function (t) { var cat = CS.trackCatalog(t); if (!cat.length) return; var p = CS.trackProgress(t), meta = CS.trackMeta(t); var row = h('a', 'me-track'); row.href = '#/track/' + t; row.appendChild(h('span', 'me-tg', meta.glyph)); row.appendChild(h('span', 'me-tn', meta.name)); var b = h('div', 'bar'), f = h('div', 'bar-fill'); f.style.width = p.pct + '%'; b.appendChild(f); row.appendChild(b); row.appendChild(h('span', 'me-tp', p.pct + '%')); tr.appendChild(row); });
    app.appendChild(tr);

    // Журнал.
    var jr = h('section', 'me-sec'); jr.appendChild(h('h2', null, 'История обучения'));
    if (!hist.length) jr.appendChild(h('p', 'muted', 'Пока пусто. Пройди первый урок — он появится здесь и останется навсегда.'));
    hist.slice(-60).reverse().forEach(function (e) { var r = h('div', 'me-ev'); var dt = new Date(e.t); r.appendChild(h('span', 'me-d', dt.toLocaleDateString('ru-RU') + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))); r.appendChild(h('span', 'me-t', '✓ ' + e.title)); if (e.xp) r.appendChild(h('span', 'me-x', '+' + e.xp + ' XP')); jr.appendChild(r); });
    app.appendChild(jr);

    // Аккаунт.
    var ac = h('section', 'me-sec'); ac.appendChild(h('h2', null, 'Аккаунт'));
    if (A.nick) { ac.appendChild(h('p', 'muted', 'Вошёл как ' + A.nick + '. ' + statusText() + '.')); var lo = h('button', 'btn ghost', 'Выйти'); lo.onclick = function () { logout().then(function () { location.hash = '#/'; CSUI.route(); }); }; ac.appendChild(lo); }
    else if (A.available) { ac.appendChild(h('p', 'muted', 'Ты не вошёл — прогресс есть только в этом браузере.')); var li = h('a', 'btn primary', 'Войти / создать аккаунт'); li.href = '#/login'; ac.appendChild(li); }
    app.appendChild(ac); app.appendChild(U.footer());
  }

  window.CSAcc = { init: init, pill: pill, viewLogin: viewLogin, viewMe: viewMe, state: A, ready: function () { return ready; } };
})();
