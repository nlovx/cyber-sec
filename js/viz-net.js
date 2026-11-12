/* CYBER SEC — сетевые виджеты и OSINT: tcp, ttl, lpm, nat, switch, http, tls, pcap, casefile, dork. */
(function () {
  'use strict';
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function md(el, str) { el.innerHTML = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'); return el; }
  function btn(t, cls, fn) { var b = h('button', cls || 'btn ghost', t); b.onclick = fn; return b; }

  // ---------- tcp: рукопожатие, передача, потеря, закрытие ----------
  CS.viz('tcp', function (box) {
    var loss = false, n = 0, list = h('div', 'tcp-list'), note = h('div', 'sh-note');
    function events() {
      var e = [
        ['c', 'SYN  seq=100', 'Клиент: «хочу соединиться, мои номера начну со 100».'],
        ['s', 'SYN+ACK  seq=300 ack=101', 'Сервер: «согласен, мои номера со 300, жду от тебя 101».'],
        ['c', 'ACK  ack=301', 'Клиент подтвердил. Соединение открыто — рукопожатие из 3 пакетов.'],
        ['c', 'DATA  seq=101 len=5  «GET /»', 'Клиент отправляет запрос. Каждый байт нумеруется.'],
        ['s', 'ACK  ack=106', 'Сервер: «получил до 105 включительно, жду 106».']
      ];
      if (!loss) e.push(['s', 'DATA  seq=301 len=1000  «200 OK…»', 'Сервер отправляет ответ.'], ['c', 'ACK  ack=1301', 'Клиент подтвердил 1000 байт.']);
      else e.push(['s', 'DATA  seq=301 len=1000  ✗ ПОТЕРЯН в пути', 'Пакет пропал где-то у роутера. Клиент ничего не получил и ничего не подтвердил.'], ['s', '…таймер RTO истёк: сервер шлёт DATA seq=301 повторно', 'Нет ACK за отведённое время → **ретрансмиссия**. Поэтому TCP надёжен, но при потерях «тормозит» — ждёт таймеры.'], ['c', 'ACK  ack=1301', 'Теперь дошло и подтверждено.']);
      e.push(['c', 'FIN', 'Клиент закончил отправку и закрывает свою сторону.'], ['s', 'ACK', 'Сервер подтвердил.'], ['s', 'FIN', 'Сервер тоже закончил.'], ['c', 'ACK', 'Соединение закрыто (после короткого TIME_WAIT).']);
      return e;
    }
    var ev = events();
    function draw() {
      clear(list); ev = events();
      var head = h('div', 'tcp-head'); head.appendChild(h('span', null, 'КЛИЕНТ')); head.appendChild(h('span', null, 'СЕРВЕР')); list.appendChild(head);
      ev.forEach(function (x, i) {
        if (i >= n) return;
        var r = h('div', 'tcp-msg ' + (x[0] === 'c' ? 'right' : 'left') + (x[1].indexOf('✗') > -1 ? ' lost' : '') + (i === n - 1 ? ' last' : ''));
        r.appendChild(h('span', 'tcp-arrow', (x[0] === 'c' ? '' : '◂ ') + x[1] + (x[0] === 'c' ? ' ▸' : '')));
        list.appendChild(r);
      });
      md(clear(note), n ? ev[n - 1][2] : 'Нажми «Следующий пакет», чтобы шаг за шагом пройти жизнь TCP-соединения.');
    }
    var bar = h('div', 'viz-btns');
    bar.appendChild(btn('Следующий пакет ▸', 'btn primary', function () { if (n < ev.length) { n++; draw(); } }));
    bar.appendChild(btn('Сначала', 'btn ghost', function () { n = 0; draw(); }));
    var lw = h('label', 'gl-s'), cb = h('input'); cb.type = 'checkbox'; cb.onchange = function () { loss = cb.checked; n = Math.min(n, 5); draw(); };
    lw.appendChild(cb); lw.appendChild(h('span', null, ' Потерять пакет с ответом сервера'));
    bar.appendChild(lw);
    box.appendChild(list); box.appendChild(note); box.appendChild(bar); draw();
  });

  // ---------- ttl: путь пакета и tracert ----------
  CS.viz('ttl', function (box) {
    var hops = [['Твой ПК', '192.168.1.42'], ['Домашний роутер', '192.168.1.1'], ['Узел провайдера', '10.20.0.1'], ['Магистраль', '72.14.1.1'], ['Граница сети сервера', '142.250.1.1'], ['Сервер', '142.250.185.78']];
    var ttl = 3, pos = -1, timer = null, path = h('div', 'ttl-path'), out = h('div', 'sh-note'), tr = h('pre', 'ttl-tr');
    function draw() {
      clear(path);
      hops.forEach(function (x, i) { var d = h('div', 'ttl-hop' + (i === pos ? ' on' : '') + (i < pos ? ' passed' : '')); d.appendChild(h('b', null, x[0])); d.appendChild(h('span', null, x[1])); path.appendChild(d); });
    }
    function send() {
      clearInterval(timer); pos = 0; var t = ttl; draw(); md(clear(out), 'Пакет вышел с TTL = **' + t + '**.');
      timer = setInterval(function () {
        pos++;
        if (pos >= hops.length - 1 && t > 0) { pos = hops.length - 1; clearInterval(timer); draw(); md(clear(out), '✅ Пакет дошёл до сервера (TTL остался ' + Math.max(t - (hops.length - 2), 0) + ').'); return; }
        t--; draw();
        if (t <= 0) { clearInterval(timer); md(clear(out), '💀 TTL = 0 на узле **' + hops[pos][1] + '**. Роутер выбросил пакет и отправил тебе ICMP «Time Exceeded». Ты узнал адрес этого узла — на этом и работает tracert.'); }
      }, 650);
    }
    function trace() {
      var lines = ['tracert 142.250.185.78', ''];
      for (var t = 1; t <= 5; t++) lines.push('  ' + t + '   ' + (8 + t * 6 + (t * 7) % 5) + ' мс   ' + hops[t][1] + '   ← ответил ICMP Time Exceeded при TTL=' + t);
      lines.push('  6   34 мс   142.250.185.78   ← ответил сам сервер'); tr.textContent = lines.join('\n');
    }
    var ctl = h('div', 'gl-ctl'), w = h('label', 'gl-s'), v = h('b', null, 'TTL = ' + ttl), inp = h('input');
    inp.type = 'range'; inp.min = 1; inp.max = 8; inp.value = ttl; inp.oninput = function () { ttl = +inp.value; v.textContent = 'TTL = ' + ttl; };
    w.appendChild(h('span', null, 'Начальный TTL пакета')); w.appendChild(inp); w.appendChild(v); ctl.appendChild(w);
    var bar = h('div', 'viz-btns'); bar.appendChild(btn('Отправить пакет ▸', 'btn primary', send)); bar.appendChild(btn('Сымитировать tracert', 'btn ghost', trace));
    box.appendChild(ctl); box.appendChild(bar); box.appendChild(path); box.appendChild(out); box.appendChild(tr);
    box.appendChild(h('div', 'viz-hint', 'Поставь TTL = 2 и 4. Каждый роутер вычитает 1; кто получил 0 — «сдаёт» свой адрес. tracert шлёт пакеты с TTL 1, 2, 3… и собирает эти ответы.'));
    draw();
  });

  // ---------- lpm: таблица маршрутов, самый длинный префикс ----------
  CS.viz('lpm', function (box) {
    var T = [['10.0.0.0', 8, 'eth1 → филиал'], ['10.1.0.0', 16, 'eth2 → серверная'], ['10.1.5.0', 24, 'eth3 → бухгалтерия'], ['192.168.1.0', 24, 'eth0 → локальная сеть'], ['0.0.0.0', 0, 'шлюз провайдера → весь интернет']];
    function ip2n(s) { var p = String(s).trim().split('.'); if (p.length !== 4) return null; var n = 0; for (var i = 0; i < 4; i++) { var o = +p[i]; if (!(o >= 0 && o <= 255) || p[i] === '') return null; n = n * 256 + o; } return n; }
    function match(addr, net, len) { if (len === 0) return true; var sh = Math.pow(2, 32 - len); return Math.floor(addr / sh) === Math.floor(ip2n(net) / sh); }
    var inp = h('input', 'inp'); inp.value = '10.1.5.77'; inp.placeholder = 'IP назначения';
    var tbl = h('div', 'lpm-t'), out = h('div', 'sh-note');
    function draw() {
      clear(tbl); var a = ip2n(inp.value), best = -1, bl = -1;
      if (a != null) T.forEach(function (r, i) { if (match(a, r[0], r[1]) && r[1] > bl) { bl = r[1]; best = i; } });
      T.forEach(function (r, i) {
        var m = a != null && match(a, r[0], r[1]);
        var row = h('div', 'lpm-r' + (m ? ' m' : '') + (i === best ? ' win' : ''));
        row.appendChild(h('span', 'mono', r[0] + '/' + r[1])); row.appendChild(h('span', null, r[2])); row.appendChild(h('span', 'lpm-tag', i === best ? 'ПОБЕДИЛ' : (m ? 'подходит' : '—')));
        tbl.appendChild(row);
      });
      md(clear(out), a == null ? 'Введи корректный IPv4 (четыре числа 0–255).' : 'Подходят несколько строк? Роутер берёт **самый длинный префикс** (самую конкретную): здесь `/' + bl + '` → **' + T[best][2] + '**.');
    }
    inp.oninput = draw;
    var bar = h('div', 'viz-btns'); ['10.1.5.77', '10.1.9.1', '10.200.0.1', '192.168.1.5', '8.8.8.8'].forEach(function (x) { bar.appendChild(btn(x, 'btn ghost', function () { inp.value = x; draw(); })); });
    box.appendChild(inp); box.appendChild(bar); box.appendChild(tbl); box.appendChild(out); draw();
  });

  // ---------- nat: таблица трансляции ----------
  CS.viz('nat', function (box) {
    var hosts = ['192.168.1.10', '192.168.1.11', '192.168.1.12'], pub = '203.0.113.5', table = [], port = 40001, log = h('div', 'nat-log'), tbl = h('div', 'lpm-t');
    function draw() {
      clear(tbl); var hd = h('div', 'lpm-r hd'); ['Внутри (до NAT)', 'Снаружи (после NAT)', 'Куда'].forEach(function (x) { hd.appendChild(h('span', null, x)); }); tbl.appendChild(hd);
      table.forEach(function (r) { var row = h('div', 'lpm-r'); row.appendChild(h('span', 'mono', r[0])); row.appendChild(h('span', 'mono', r[1])); row.appendChild(h('span', 'mono', r[2])); tbl.appendChild(row); });
      if (!table.length) tbl.appendChild(h('div', 'sh-empty', 'Таблица пуста — пока никто не выходил наружу.'));
    }
    function go(hip) {
      var ip = hip + ':' + (50000 + Math.floor(Math.random() * 9000)), ext = pub + ':' + (port++);
      table.push([ip, ext, '93.184.216.34:443']);
      clear(log); [['→ ' + ip + ' шлёт пакет на 93.184.216.34:443', ''], ['роутер (NAT) подменил источник: ' + ip + ' → ' + ext + ' и запомнил пару', ''], ['сервер видит только ' + ext + ' — про ' + hip + ' он не знает', ''], ['← ответ приходит на ' + ext + '; роутер ищет в таблице и отдаёт обратно ' + ip, '']].forEach(function (l) { log.appendChild(h('div', null, l[0])); });
      draw();
    }
    var bar = h('div', 'viz-btns'); hosts.forEach(function (x) { bar.appendChild(btn('Открыть сайт с ' + x, 'btn ghost', function () { go(x); })); });
    bar.appendChild(btn('Очистить', 'btn ghost', function () { table = []; clear(log); draw(); }));
    box.appendChild(bar); box.appendChild(tbl); box.appendChild(log);
    box.appendChild(h('div', 'viz-hint', 'Три устройства — один публичный адрес ' + pub + '. Различает их только порт. Входящее соединение «с улицы» без записи в таблице роутеру некому отдать — отсюда «NAT как бесплатный фаервол».'));
    draw();
  });

  // ---------- switch: коммутатор учит MAC ----------
  CS.viz('switch', function (box) {
    var pcs = [['A', 'AA:AA', 1], ['B', 'BB:BB', 2], ['C', 'CC:CC', 3], ['D', 'DD:DD', 4]], mac = {}, src = 0, dst = 1, log = h('div', 'nat-log'), tbl = h('div', 'lpm-t'), ports = h('div', 'sw-ports');
    function draw(hit) {
      clear(ports); pcs.forEach(function (p) { var d = h('div', 'sw-p' + (hit && hit.indexOf(p[2]) > -1 ? ' hit' : '') + (p[2] === pcs[src][2] ? ' src' : '')); d.appendChild(h('b', null, 'ПК ' + p[0])); d.appendChild(h('span', null, 'порт ' + p[2])); ports.appendChild(d); });
      clear(tbl); var hd = h('div', 'lpm-r hd'); ['MAC', 'Порт'].forEach(function (x) { hd.appendChild(h('span', null, x)); }); tbl.appendChild(hd);
      Object.keys(mac).forEach(function (m) { var r = h('div', 'lpm-r'); r.appendChild(h('span', 'mono', m)); r.appendChild(h('span', null, 'порт ' + mac[m])); tbl.appendChild(r); });
      if (!Object.keys(mac).length) tbl.appendChild(h('div', 'sh-empty', 'Таблица MAC пуста — коммутатор ничего не знает.'));
    }
    function send() {
      if (src === dst) { clear(log); log.appendChild(h('div', null, 'Выбери разные ПК.')); return; }
      var S = pcs[src], D = pcs[dst]; mac[S[1]] = S[2]; clear(log);
      log.appendChild(h('div', null, 'Кадр ' + S[1] + ' → ' + D[1] + ' пришёл на порт ' + S[2] + '. Коммутатор запомнил: ' + S[1] + ' живёт на порту ' + S[2] + '.'));
      var hit;
      if (mac[D[1]]) { hit = [mac[D[1]]]; log.appendChild(h('div', null, 'Получатель известен → кадр уходит ТОЛЬКО на порт ' + mac[D[1]] + ' (unicast).')); }
      else { hit = pcs.filter(function (p) { return p[2] !== S[2]; }).map(function (p) { return p[2]; }); log.appendChild(h('div', null, 'Получатель неизвестен → кадр рассылается на ВСЕ порты, кроме входящего (flood): ' + hit.join(', ') + '.')); }
      draw(hit);
    }
    function pick(label, get, set) { var w = h('label', 'gl-s'); w.appendChild(h('span', null, label)); var s = h('select'); pcs.forEach(function (p, i) { var o = h('option', null, 'ПК ' + p[0] + ' (' + p[1] + ')'); o.value = i; s.appendChild(o); }); s.value = get(); s.onchange = function () { set(+s.value); draw(); }; w.appendChild(s); return w; }
    var bar = h('div', 'viz-btns'); bar.appendChild(pick('От', function () { return src; }, function (v) { src = v; })); bar.appendChild(pick('Кому', function () { return dst; }, function (v) { dst = v; }));
    bar.appendChild(btn('Отправить кадр ▸', 'btn primary', send)); bar.appendChild(btn('Сбросить таблицу', 'btn ghost', function () { mac = {}; clear(log); draw(); }));
    box.appendChild(bar); box.appendChild(ports); box.appendChild(tbl); box.appendChild(log);
    box.appendChild(h('div', 'viz-hint', 'Отправь A→B (flood), потом B→A (теперь точно в порт 1), потом A→B ещё раз (уже unicast). Так коммутатор учится сам, без настройки.'));
    draw();
  });

  // ---------- http: сырые запрос/ответ с пояснениями ----------
  CS.viz('http', function (box) {
    var SC = {
      'GET страницы (200)': { req: [['GET /index.html HTTP/1.1', 'Метод `GET` («дай»), путь и версия протокола.'], ['Host: example.com', 'Обязательный заголовок: на одном IP живут сотни сайтов, по Host сервер понимает, какой нужен.'], ['User-Agent: Mozilla/5.0 …', 'Кто спрашивает (браузер/версия).'], ['Accept: text/html', 'Какой формат ответа клиент готов принять.'], ['Cookie: session=abc123', 'Браузер сам прикладывает cookie этого сайта — так сервер «помнит» тебя.']], res: [['HTTP/1.1 200 OK', 'Статус `200` — всё хорошо.'], ['Content-Type: text/html; charset=utf-8', 'Тип и кодировка тела — браузер знает, как его показать.'], ['Cache-Control: max-age=3600', 'Можно хранить в кэше час — повторный заход без запроса.'], ['', '(пустая строка отделяет заголовки от тела)'], ['<html>…</html>', 'Тело ответа — сам документ.']] },
      'Вход (POST → 302)': { req: [['POST /login HTTP/1.1', '`POST` — отправить данные на обработку.'], ['Host: example.com', ''], ['Content-Type: application/x-www-form-urlencoded', 'Формат тела: пары ключ=значение.'], ['Content-Length: 29', 'Сколько байт в теле.'], ['', ''], ['user=anna&pass=hunter2', 'Тело запроса. Без HTTPS это уходит открытым текстом — поэтому логины только по TLS!']], res: [['HTTP/1.1 302 Found', '`302` — «иди по другому адресу» (редирект).'], ['Location: /account', 'Куда перейти. Браузер сам сделает новый GET /account.'], ['Set-Cookie: session=xyz; HttpOnly; Secure; SameSite=Lax', 'Сервер выдаёт сессию. `HttpOnly` — скрипты не прочитают (защита от кражи через XSS), `Secure` — только по HTTPS.']] },
      'Нет страницы (404)': { req: [['GET /old-page HTTP/1.1', ''], ['Host: example.com', '']], res: [['HTTP/1.1 404 Not Found', 'Сервер работает, но по этому пути ничего нет. Коды 4xx — «ошибка клиента».'], ['Content-Type: text/html', ''], ['', ''], ['<h1>Страница не найдена</h1>', '']] },
      'Перенос на HTTPS (301)': { req: [['GET / HTTP/1.1', ''], ['Host: example.com', 'Запрос по обычному http:// (порт 80).']], res: [['HTTP/1.1 301 Moved Permanently', '`301` — навсегда переехали, запомни.'], ['Location: https://example.com/', 'Браузер повторит запрос уже по защищённому каналу.'], ['Strict-Transport-Security: max-age=31536000', 'HSTS: целый год ходи сюда только по HTTPS, не пытайся по http.']] },
      'Сервер упал (500)': { req: [['GET /report?id=5 HTTP/1.1', ''], ['Host: example.com', '']], res: [['HTTP/1.1 500 Internal Server Error', '`5xx` — «ошибка сервера»: сломался код на стороне сервера, не твоя вина.'], ['Content-Type: text/plain', ''], ['', ''], ['Something went wrong', 'Хорошая практика — не показывать наружу трассу ошибки: она выдаёт устройство системы атакующему.']] }
    };
    var sel = h('select'); Object.keys(SC).forEach(function (k) { var o = h('option', null, k); o.value = k; sel.appendChild(o); });
    var req = h('div', 'http-pane'), res = h('div', 'http-pane'), exp = h('div', 'sh-note');
    function pane(el, title, lines, cls) {
      clear(el); el.appendChild(h('div', 'http-h ' + cls, title));
      lines.forEach(function (l) { var r = h('div', 'http-l', l[0] || ' '); r.onclick = function () { Array.prototype.forEach.call(box.querySelectorAll('.http-l'), function (x) { x.classList.remove('on'); }); r.classList.add('on'); md(clear(exp), l[1] ? l[1] : '(пояснения к этой строке нет — служебная или пустая)'); }; el.appendChild(r); });
    }
    function draw() { var s = SC[sel.value]; pane(req, 'ЗАПРОС  браузер → сервер', s.req, 'rq'); pane(res, 'ОТВЕТ  сервер → браузер', s.res, 'rs'); md(clear(exp), 'Кликай по строкам — разберём, что каждая значит.'); }
    sel.onchange = draw;
    var two = h('div', 'http-two'); two.appendChild(req); two.appendChild(res);
    box.appendChild(sel); box.appendChild(two); box.appendChild(exp); draw();
  });

  // ---------- tls: рукопожатие TLS 1.3 ----------
  CS.viz('tls', function (box) {
    var S = [
      { m: 'ClientHello', d: 'клиент → сервер', know: 'Клиент: список шифров, случайное число, **key_share** (его половина ключа Диффи–Хеллмана) и **SNI** — имя сайта.', wire: 'Всё открыто! Наблюдатель видит имя сайта (SNI), версии и шифры. Ключа ещё нет.' },
      { m: 'ServerHello', d: 'сервер → клиент', know: 'Сервер выбрал шифр и прислал свою половину ключа (key_share). Теперь **обе стороны вычисляют общий секрет**, который по сети не передавался.', wire: 'Видна половина ключа сервера — но по двум половинам общий секрет без приватных значений не восстановить (Диффи–Хеллман).' },
      { m: 'Certificate + Finished (уже зашифровано)', d: 'сервер → клиент', know: 'Сервер доказывает личность: присылает **сертификат**, подписанный удостоверяющим центром, и подпись всего диалога. Клиент проверяет цепочку до доверенного корня и что имя в сертификате = нужный сайт.', wire: 'Тут и дальше — шифротекст. Даже сертификат в TLS 1.3 не виден наблюдателю.' },
      { m: 'Finished клиента', d: 'клиент → сервер', know: 'Клиент подтверждает, что получил тот же ключ. Рукопожатие завершено — всего **1 круг** туда-обратно (TLS 1.3).', wire: 'Шифротекст.' },
      { m: 'Application Data (HTTP внутри)', d: 'в обе стороны', know: 'Внутри шифрованного канала идёт обычный HTTP: запросы, cookie, пароли. Каждый пакет зашифрован и защищён от подмены (AEAD).', wire: 'Видно только: кто с кем (IP), размер и время пакетов, SNI из первого шага. Содержимого — нет.' }
    ];
    var i = 0, list = h('div', 'tls-steps'), k = h('div', 'sh-note'), w = h('div', 'tls-wire');
    function draw() {
      clear(list);
      S.forEach(function (s, n) { var r = h('div', 'tls-s' + (n === i ? ' on' : '') + (n < i ? ' done' : '')); r.appendChild(h('b', null, (n + 1) + '. ' + s.m)); r.appendChild(h('span', null, s.d)); r.onclick = function () { i = n; draw(); }; list.appendChild(r); });
      md(clear(k), '**Кто что знает:** ' + S[i].know); md(clear(w), '👁 **Что видит наблюдатель в сети:** ' + S[i].wire);
    }
    var bar = h('div', 'viz-btns'); bar.appendChild(btn('Дальше ▸', 'btn primary', function () { if (i < S.length - 1) { i++; draw(); } })); bar.appendChild(btn('Сначала', 'btn ghost', function () { i = 0; draw(); }));
    box.appendChild(list); box.appendChild(k); box.appendChild(w); box.appendChild(bar); draw();
  });

  // ---------- pcap: учебный «Wireshark» с фильтром ----------
  CS.viz('pcap', function (box, step) {
    var me = '192.168.1.42', gw = '192.168.1.1', P = [];
    function add(src, dst, proto, info, o) { o = o || {}; P.push({ n: P.length + 1, t: (P.length * 0.137 + 0.001).toFixed(3), src: src, dst: dst, proto: proto, info: info, sport: o.sp || '', dport: o.dp || '', flags: o.fl || '', q: o.q || '', mac: o.mac || '' }); }
    add(me, gw, 'ARP', 'Who has 192.168.1.1? Tell 192.168.1.42', { mac: 'ARP request' }); add(gw, me, 'ARP', '192.168.1.1 is at 3c:84:6a:11:22:33', { mac: 'ARP reply' });
    add(me, '8.8.8.8', 'DNS', 'Standard query A example.com', { sp: 53211, dp: 53, q: 'example.com' }); add('8.8.8.8', me, 'DNS', 'Standard query response A 93.184.216.34', { sp: 53, dp: 53211, q: 'example.com' });
    add(me, '93.184.216.34', 'TCP', '51000 → 80 [SYN] Seq=0', { sp: 51000, dp: 80, fl: 'S' }); add('93.184.216.34', me, 'TCP', '80 → 51000 [SYN, ACK] Seq=0 Ack=1', { sp: 80, dp: 51000, fl: 'SA' }); add(me, '93.184.216.34', 'TCP', '51000 → 80 [ACK] Seq=1 Ack=1', { sp: 51000, dp: 80, fl: 'A' });
    add(me, '93.184.216.34', 'HTTP', 'GET / HTTP/1.1  Host: example.com', { sp: 51000, dp: 80, fl: 'PA', q: 'GET / HTTP/1.1 example.com' }); add('93.184.216.34', me, 'HTTP', 'HTTP/1.1 200 OK  (text/html)', { sp: 80, dp: 51000, fl: 'PA', q: 'HTTP/1.1 200 OK' });
    add(me, '142.250.185.78', 'TCP', '51010 → 443 [SYN] Seq=0', { sp: 51010, dp: 443, fl: 'S' }); add('142.250.185.78', me, 'TCP', '443 → 51010 [SYN, ACK]', { sp: 443, dp: 51010, fl: 'SA' }); add(me, '142.250.185.78', 'TLS', 'Client Hello  SNI=www.google.com', { sp: 51010, dp: 443, fl: 'PA', q: 'www.google.com' }); add('142.250.185.78', me, 'TLS', 'Server Hello, Change Cipher Spec, Application Data', { sp: 443, dp: 51010, fl: 'PA' }); add(me, '142.250.185.78', 'TLS', 'Application Data (зашифровано)', { sp: 51010, dp: 443, fl: 'PA' });
    add(me, '1.1.1.1', 'ICMP', 'Echo (ping) request id=0x0001'); add('1.1.1.1', me, 'ICMP', 'Echo (ping) reply id=0x0001');
    [[21, 'ftp'], [22, 'ssh'], [23, 'telnet'], [80, 'http'], [445, 'smb']].forEach(function (p) { add('192.168.1.77', me, 'TCP', '44321 → ' + p[0] + ' [SYN]', { sp: 44321, dp: p[0], fl: 'S' }); add(me, '192.168.1.77', 'TCP', p[0] + ' → 44321 [RST, ACK]', { sp: p[0], dp: 44321, fl: 'RA' }); });
    ['a9f3k2x8q1z7m4v0', 'b7d2n5c1w9e3r6t8', 'c1x4y8u2i5o0p3l7'].forEach(function (s) { var nm = s + '.cdn-sync.tk'; add(me, '8.8.8.8', 'DNS', 'Standard query TXT ' + nm, { sp: 53300, dp: 53, q: nm }); });
    add(gw, '255.255.255.255', 'UDP', 'DHCP Offer', { sp: 67, dp: 68 });

    function atom(a, p) {
      a = a.trim(); var neg = false; if (a.charAt(0) === '!') { neg = true; a = a.slice(1).trim(); }
      var m, r = false, L = a.toLowerCase();
      if ((m = a.match(/^ip\.addr\s*==\s*([\d.]+)$/))) r = p.src === m[1] || p.dst === m[1];
      else if ((m = a.match(/^ip\.src\s*==\s*([\d.]+)$/))) r = p.src === m[1];
      else if ((m = a.match(/^ip\.dst\s*==\s*([\d.]+)$/))) r = p.dst === m[1];
      else if ((m = a.match(/^tcp\.port\s*==\s*(\d+)$/))) r = /TCP|HTTP|TLS/.test(p.proto) && (p.sport == m[1] || p.dport == m[1]);
      else if ((m = a.match(/^udp\.port\s*==\s*(\d+)$/))) r = /DNS|UDP/.test(p.proto) && (p.sport == m[1] || p.dport == m[1]);
      else if ((m = L.match(/^tcp\.flags\.(syn|ack|rst|fin)\s*==\s*(0|1)$/))) { var c = { syn: 'S', ack: 'A', rst: 'R', fin: 'F' }[m[1]]; var has = /TCP|HTTP|TLS/.test(p.proto) && p.flags.indexOf(c) > -1; r = m[2] === '1' ? has : !has; }
      else if ((m = a.match(/^(?:frame|dns\.qry\.name|http\.request\.uri|tls\.handshake\.extensions_server_name)\s+contains\s+"([^"]*)"$/i))) r = (p.info + ' ' + p.q).toLowerCase().indexOf(m[1].toLowerCase()) > -1;
      else if (/^(arp|dns|http|tls|tcp|udp|icmp)$/.test(L)) r = L === 'tcp' ? /TCP|HTTP|TLS/.test(p.proto) : (L === 'udp' ? /DNS|UDP/.test(p.proto) : p.proto.toLowerCase() === L);
      else return null;
      return neg ? !r : r;
    }
    function compile(f) {
      f = f.trim(); if (!f) return function () { return true; };
      var ors = f.split(/\|\||\bor\b/i).map(function (o) { return o.split(/&&|\band\b/i); }), bad = false;
      ors.forEach(function (ands) { ands.forEach(function (a) { if (atom(a, P[0]) === null) bad = true; }); });
      if (bad) return null;
      return function (p) { return ors.some(function (ands) { return ands.every(function (a) { return atom(a, p); }); }); };
    }
    var inp = h('input', 'inp'); inp.placeholder = 'Фильтр, например: tcp.flags.syn==1 && ip.dst==192.168.1.42'; inp.value = step && step.filter || '';
    var tbl = h('div', 'pc-tbl'), det = h('div', 'pc-det'), st = h('div', 'viz-hint');
    function draw() {
      var fn = compile(inp.value); clear(tbl);
      inp.classList.toggle('bad', !fn);
      if (!fn) { st.textContent = 'Фильтр не распознан. Поддерживается: ip.addr/ip.src/ip.dst==X, tcp.port==N, udp.port==N, tcp.flags.syn|ack|rst|fin==1, arp/dns/http/tls/tcp/udp/icmp, frame contains "текст", && || !'; return; }
      var shown = P.filter(fn); st.textContent = 'Показано ' + shown.length + ' из ' + P.length + ' пакетов.';
      var hd = h('div', 'pc-r hd'); ['№', 'Время', 'Источник', 'Назначение', 'Протокол', 'Инфо'].forEach(function (x) { hd.appendChild(h('span', null, x)); }); tbl.appendChild(hd);
      shown.forEach(function (p) {
        var r = h('div', 'pc-r p-' + p.proto.toLowerCase() + (/R/.test(p.flags) && /TCP/.test(p.proto) ? ' rst' : ''));
        [p.n, p.t, p.src, p.dst, p.proto, p.info].forEach(function (x) { r.appendChild(h('span', null, String(x))); });
        r.onclick = function () { Array.prototype.forEach.call(tbl.querySelectorAll('.pc-r'), function (x) { x.classList.remove('sel'); }); r.classList.add('sel'); details(p); };
        tbl.appendChild(r);
      });
    }
    function details(p) {
      clear(det); var L = [['Frame ' + p.n, p.t + ' с от начала захвата']];
      L.push([p.proto === 'ARP' ? 'Ethernet II / ARP' : 'Ethernet II', p.proto === 'ARP' ? p.mac : 'MAC источника → MAC назначения (меняется на каждом хопе)']);
      if (p.proto !== 'ARP') L.push(['Internet Protocol v4', p.src + ' → ' + p.dst + ' · TTL, протокол']);
      if (p.sport) L.push([/DNS|UDP/.test(p.proto) ? 'UDP' : 'Transmission Control Protocol', 'порт ' + p.sport + ' → ' + p.dport + (p.flags ? ' · флаги: ' + p.flags.split('').map(function (c) { return { S: 'SYN', A: 'ACK', P: 'PSH', R: 'RST', F: 'FIN' }[c]; }).join(', ') : '')]);
      if (/DNS|HTTP|TLS/.test(p.proto)) L.push([p.proto === 'DNS' ? 'Domain Name System' : (p.proto === 'HTTP' ? 'Hypertext Transfer Protocol' : 'Transport Layer Security'), p.info]);
      L.forEach(function (l, i) { var d = h('div', 'pc-layer'); d.style.marginLeft = (i * 14) + 'px'; d.appendChild(h('b', null, '▸ ' + l[0])); d.appendChild(h('span', null, ' — ' + l[1])); det.appendChild(d); });
    }
    inp.oninput = draw;
    var bar = h('div', 'viz-btns'); [['всё', ''], ['dns', 'dns'], ['только SYN', 'tcp.flags.syn==1 && tcp.flags.ack==0'], ['RST', 'tcp.flags.rst==1'], ['tls', 'tls'], ['соседний хост', 'ip.addr==192.168.1.77']].forEach(function (b) { bar.appendChild(btn(b[0], 'btn ghost', function () { inp.value = b[1]; draw(); })); });
    box.appendChild(inp); box.appendChild(bar); box.appendChild(tbl); box.appendChild(st); box.appendChild(det);
    box.appendChild(h('div', 'viz-hint', 'Это учебный (выдуманный) захват. Кликни пакет — раскроются слои. Твой ПК: 192.168.1.42, роутер: 192.168.1.1.'));
    draw();
  });

  // ---------- casefile: папка с материалами дела (данные в шаге) ----------
  CS.viz('casefile', function (box, step) {
    var docs = step.docs || [], picked = {}, cur = 0, list = h('div', 'cf-list'), view = h('div', 'cf-view'), cnt = h('div', 'viz-hint');
    function draw() {
      clear(list); docs.forEach(function (d, i) { var r = h('div', 'cf-item' + (i === cur ? ' on' : '') + (picked[i] ? ' pin' : '')); r.appendChild(h('span', 'cf-k', d.kind || 'док.')); r.appendChild(h('span', null, d.title)); r.onclick = function () { cur = i; draw(); }; list.appendChild(r); });
      clear(view); var d = docs[cur]; if (!d) return; view.appendChild(h('div', 'cf-t', d.title));
      var b = h('div', 'cf-b'); String(d.body).split('\n').forEach(function (l) { md(b.appendChild(h('p')), l); }); view.appendChild(b);
      var pin = btn(picked[cur] ? '📌 В деле (убрать)' : '📌 Приложить к делу', picked[cur] ? 'btn primary' : 'btn ghost', function () { picked[cur] = !picked[cur]; draw(); }); view.appendChild(pin);
      var n = Object.keys(picked).filter(function (k) { return picked[k]; }).length; cnt.textContent = 'В деле: ' + n + ' из ' + docs.length + '. Прикладывай только то, что реально подтверждает вывод.';
    }
    var row = h('div', 'cf-row'); row.appendChild(list); row.appendChild(view); box.appendChild(row); box.appendChild(cnt); draw();
  });

  // ---------- dork: конструктор поисковых операторов ----------
  CS.viz('dork', function (box) {
    var F = [['site', 'site:', 'example.org', 'только этот сайт/домен'], ['filetype', 'filetype:', 'pdf', 'только файлы этого типа'], ['intitle', 'intitle:', 'отчёт', 'слово в заголовке страницы'], ['inurl', 'inurl:', 'archive', 'слово в адресе страницы'], ['phrase', '"', 'годовой отчёт 2023', 'точная фраза целиком'], ['minus', '-', 'реклама', 'исключить слово']];
    var vals = {}, outEl = h('div', 'dk-out mono'), exp = h('div', 'dk-exp'), form = h('div', 'dk-form'), link = h('a', 'btn primary', 'Открыть поиск в новой вкладке');
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    function build() {
      var parts = [], ex = [];
      F.forEach(function (f) { var v = (vals[f[0]] || '').trim(); if (!v) return; var s = f[0] === 'phrase' ? '"' + v + '"' : (f[0] === 'minus' ? '-' + v : f[1] + v); parts.push(s); ex.push([s, f[3]]); });
      var q = parts.join(' '); outEl.textContent = q || '(заполни хотя бы одно поле)'; clear(exp);
      ex.forEach(function (e) { var r = h('div'); r.appendChild(h('code', null, e[0])); r.appendChild(h('span', null, ' — ' + e[1])); exp.appendChild(r); });
      link.href = q ? 'https://www.google.com/search?q=' + encodeURIComponent(q) : '#'; link.style.opacity = q ? 1 : .4;
    }
    F.forEach(function (f) { var w = h('label', 'dk-f'); w.appendChild(h('span', null, f[0] === 'phrase' ? '"фраза"' : (f[0] === 'minus' ? '−исключить' : f[1]))); var i = h('input', 'inp'); i.placeholder = f[2]; i.oninput = function () { vals[f[0]] = i.value; build(); }; w.appendChild(i); form.appendChild(w); });
    box.appendChild(form); box.appendChild(outEl); box.appendChild(exp); box.appendChild(link);
    box.appendChild(h('div', 'viz-hint', 'Операторы поисковика — это просто способ задать запрос точнее. Это публичный поиск; ищи только то, что открыто и не нарушает чужую приватность.'));
    build();
  });
})();
