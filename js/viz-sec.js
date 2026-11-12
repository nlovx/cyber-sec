/* CYBER SEC — виджеты безопасности: sqli (инъекция в учебной «базе»), xss (экранирование вывода), logs (разбор журнала входов). Всё локально и выдуманное. */
(function () {
  'use strict';
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function md(el, str) { el.innerHTML = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'); return el; }
  function btn(t, cls, fn) { var b = h('button', cls || 'btn ghost', t); b.onclick = fn; return b; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---------- sqli: сравни склейку строки и параметризованный запрос ----------
  CS.viz('sqli', function (box) {
    var USERS = [['anna', 'pass123', 'user'], ['admin', 'S3cret!x', 'admin']];
    var mode = 'vulnerable';
    var u = h('input', 'inp'), p = h('input', 'inp'), q = h('pre', 'sq-q'), out = h('div', 'sh-note'), tabs = h('div', 'viz-btns');
    u.placeholder = 'логин'; p.placeholder = 'пароль'; u.value = "anna"; p.value = 'wrong';
    function run() {
      var user = u.value, pass = p.value, rows, text;
      if (mode === 'vulnerable') {
        text = "SELECT * FROM users WHERE login = '" + user + "' AND pass = '" + pass + "'";
        // учебный «разбор» без настоящего SQL: распознаём два классических шаблона
        var inj = /('|\s)or\s+'?1'?\s*=\s*'?1/i.test(user + ' ' + pass) || /--/.test(user) || /'\s*or\s*'/i.test(user + pass);
        if (inj) { rows = USERS.slice(); }
        else rows = USERS.filter(function (r) { return r[0] === user && r[1] === pass; });
        q.textContent = text;
        if (inj) md(clear(out), '⚠ Ввод изменил **смысл** запроса: условие стало всегда истинным, и база вернула **все** строки. Атакующий вошёл без пароля (' + rows.map(function (r) { return r[0]; }).join(', ') + ').');
        else md(clear(out), rows.length ? 'Вход выполнен: ' + rows[0][0] + '.' : 'Неверный логин или пароль.');
      } else {
        q.textContent = "SELECT * FROM users WHERE login = ? AND pass_hash = ?\n-- параметры: [" + JSON.stringify(user) + ", hash(" + JSON.stringify(pass) + ")]";
        rows = USERS.filter(function (r) { return r[0] === user && r[1] === pass; });
        md(clear(out), rows.length ? 'Вход выполнен: ' + rows[0][0] + '.' : 'Неверный логин или пароль. Ввод — всего лишь **данные**: кавычки и «or» внутри параметра ничего не меняют в команде.');
      }
    }
    function setMode(m) { mode = m; Array.prototype.forEach.call(tabs.children, function (b) { b.className = 'btn ' + (b.getAttribute('data-m') === m ? 'primary' : 'ghost'); }); run(); }
    [['vulnerable', 'Уязвимая склейка'], ['safe', 'Параметризованный запрос']].forEach(function (m) { var b = btn(m[1], 'btn ghost', function () { setMode(m[0]); }); b.setAttribute('data-m', m[0]); tabs.appendChild(b); });
    u.oninput = p.oninput = run;
    var ex = h('div', 'viz-btns'); [["anna / wrong", "anna", "wrong"], ["anna / ' OR '1'='1", "anna", "' OR '1'='1"], ["admin'-- / что угодно", "admin'--", "x"]].forEach(function (e) { ex.appendChild(btn(e[0], 'btn ghost', function () { u.value = e[1]; p.value = e[2]; run(); })); });
    var f = h('div', 'dk-form'); f.appendChild(u); f.appendChild(p);
    box.appendChild(tabs); box.appendChild(f); box.appendChild(ex); box.appendChild(q); box.appendChild(out);
    box.appendChild(h('div', 'viz-hint', 'Учебная имитация (никакой настоящей базы нет). Попробуй готовые примеры в обоих режимах и сравни запросы. Пробуй такие приёмы только на своих учебных лабораториях.'));
    setMode('vulnerable');
  });

  // ---------- xss: вывод без экранирования и с ним ----------
  CS.viz('xss', function (box) {
    var inp = h('input', 'inp'), esc1 = false, view = h('div', 'xss-view'), src = h('pre', 'sq-q'), out = h('div', 'sh-note');
    inp.value = 'Привет, <b>мир</b>!';
    var cb = h('input'); cb.type = 'checkbox'; var lab = h('label', 'gl-s'); lab.appendChild(cb); lab.appendChild(h('span', null, ' Экранировать вывод (безопасно)'));
    function draw() {
      var v = inp.value; esc1 = cb.checked; var html = esc1 ? esc(v) : v;
      src.textContent = '<div class="comment">' + html + '</div>';
      view.innerHTML = ''; var d = h('div'); 
      // безопасный предпросмотр: в «уязвимом» режиме показываем теги как разметку, но вырезаем реально исполняемое
      d.innerHTML = esc1 ? html : v.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '[⚠ СКРИПТ ВЫПОЛНИЛСЯ]').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' data-evil="[⚠ ОБРАБОТЧИК СОБЫТИЯ]"');
      view.appendChild(d);
      var danger = /<\s*script|\son\w+\s*=|javascript:/i.test(v);
      md(clear(out), danger ? (esc1 ? '✅ Экранирование превратило опасные символы в обычный текст — страница **не исполняет** чужой код.' : '⚠ Без экранирования браузер воспринял ввод как **код страницы**. В настоящей атаке скрипт украл бы cookie или подменил страницу (здесь показана безопасная имитация).') : 'Обычный ввод: оба режима выглядят похоже, но разница видна, как только в тексте появляются символы `<` и `>`.');
    }
    inp.oninput = draw; cb.onchange = draw;
    var ex = h('div', 'viz-btns'); [['<b>жирный</b>', '<b>жирный</b>'], ['<script>alert(1)</script>', '<script>alert(1)</script>'], ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>']].forEach(function (e) { ex.appendChild(btn(e[0], 'btn ghost', function () { inp.value = e[1]; draw(); })); });
    box.appendChild(inp); box.appendChild(ex); box.appendChild(lab); box.appendChild(h('div', 'sh-h', 'HTML, который отдаёт сервер')); box.appendChild(src); box.appendChild(h('div', 'sh-h', 'Что видит страница')); box.appendChild(view); box.appendChild(out);
    box.appendChild(h('div', 'viz-hint', 'Имитация безопасна: реальные скрипты здесь не запускаются, их выполнение только помечается. Главное правило: данные пользователя перед выводом в HTML всегда экранируются.'));
    draw();
  });

  // ---------- logs: журнал входов, найти перебор пароля ----------
  CS.viz('logs', function (box, step) {
    var L = [], t0 = 9 * 3600;
    function tm(s) { var x = t0 + s; return ('0' + Math.floor(x / 3600)).slice(-2) + ':' + ('0' + Math.floor(x % 3600 / 60)).slice(-2) + ':' + ('0' + x % 60).slice(-2); }
    function add(s, ip, user, ok, src) { L.push({ t: tm(s), ip: ip, user: user, ok: ok, src: src || 'ssh' }); }
    add(10, '10.0.0.15', 'anna', true); add(95, '10.0.0.22', 'boris', true); add(300, '10.0.0.15', 'anna', true, 'vpn');
    ['root', 'admin', 'admin', 'test', 'user', 'root', 'oracle', 'postgres', 'admin', 'root', 'ubuntu', 'guest'].forEach(function (u, i) { add(400 + i * 2, '203.0.113.77', u, false); });
    add(430, '203.0.113.77', 'admin', true);
    add(500, '10.0.0.22', 'boris', false); add(504, '10.0.0.22', 'boris', true);
    add(700, '198.51.100.9', 'anna', true, 'vpn'); add(1800, '10.0.0.30', 'carol', true);
    var inp = h('input', 'inp'), tbl = h('div', 'pc-tbl'), st = h('div', 'viz-hint');
    inp.placeholder = 'Поиск по журналу: ip, пользователь, fail, ok, ssh, vpn…'; inp.value = step && step.filter || '';
    function draw() {
      clear(tbl); var f = inp.value.trim().toLowerCase();
      var rows = L.filter(function (r) { var line = (r.t + ' ' + r.ip + ' ' + r.user + ' ' + (r.ok ? 'ok success' : 'fail failed') + ' ' + r.src).toLowerCase(); return f.split(/\s+/).every(function (w) { return !w || line.indexOf(w) > -1; }); });
      var hd = h('div', 'pc-r hd lg'); ['Время', 'Источник', 'Пользователь', 'Итог', 'Канал'].forEach(function (x) { hd.appendChild(h('span', null, x)); }); tbl.appendChild(hd);
      rows.forEach(function (r) { var d = h('div', 'pc-r lg' + (r.ok ? '' : ' rst')); [r.t, r.ip, r.user, r.ok ? 'успех' : 'ОТКАЗ', r.src].forEach(function (x) { d.appendChild(h('span', null, x)); }); tbl.appendChild(d); });
      st.textContent = 'Показано ' + rows.length + ' из ' + L.length + ' записей. Подсказка: фильтры складываются через пробел, например «203.0.113.77 fail».';
    }
    inp.oninput = draw;
    var bar = h('div', 'viz-btns'); [['всё', ''], ['только отказы', 'fail'], ['успешные', 'ok'], ['vpn', 'vpn'], ['203.0.113.77', '203.0.113.77']].forEach(function (b) { bar.appendChild(btn(b[0], 'btn ghost', function () { inp.value = b[1]; draw(); })); });
    box.appendChild(inp); box.appendChild(bar); box.appendChild(tbl); box.appendChild(st); draw();
  });
})();
