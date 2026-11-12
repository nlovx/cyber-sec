/* CYBER SEC — «CyberBox»: учебный виртуальный ПК прямо в браузере (как лаборатории TryHackMe, но без реальных машин).
   Внутри: файловая система (сохраняется в профиле), оболочка с командами, виртуальная сеть и «сайты», которых на самом деле нет.
   Ничего не выходит наружу: curl/nmap/ping работают только с выдуманной сетью 10.10.10.0/24. */
(function () {
  'use strict';
  var VM = window.CSVM = {};

  // ---------- Файловая система ----------
  function D(c) { return { t: 'd', c: c || {} }; }
  function F(s) { return { t: 'f', s: s }; }
  function defaultFS() {
    return D({
      home: D({ student: D({
        'README.txt': F('Добро пожаловать в CyberBox — твой учебный виртуальный компьютер.\n\nЭто безопасная песочница: тут можно ломать, писать код и сохранять файлы.\nВсё хранится в твоём профиле и одинаково во всех уроках.\n\nНачни с команды:  help\n'),
        'notes.txt': F('Мои заметки\n-----------\n'),
        '.secret': F('Скрытые файлы начинаются с точки: ls их не показывает без -a.\nFLAG: CS{dotfiles_are_not_secret}\n'),
        projects: D({ 'hello.js': F('console.log("Привет из CyberBox!");\n') })
      }) }),
      etc: D({
        hostname: F('cyberbox\n'),
        hosts: F('127.0.0.1 localhost\n10.10.10.5 shop.local\n10.10.10.12 intranet.local\n'),
        passwd: F('root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n')
      }),
      var_: null,
      tmp: D({}),
      var: D({ log: D({
        'auth.log': F(authLog())
      }) }),
      usr: D({ share: D({ 'dict.txt': F('password\n123456\nqwerty\nletmein\nadmin\nwelcome\n') }) })
    });
  }
  function authLog() {
    var L = ['Nov 12 09:00:11 cyberbox sshd[811]: Accepted password for student from 10.0.0.15 port 51022',
      'Nov 12 09:14:02 cyberbox sshd[902]: Accepted publickey for deploy from 10.0.0.22 port 40122'];
    ['root', 'admin', 'test', 'oracle', 'admin', 'ubuntu', 'guest', 'root', 'postgres', 'admin'].forEach(function (u, i) {
      L.push('Nov 12 09:2' + Math.floor(i / 5) + ':' + ('0' + (10 + i * 3)).slice(-2) + ' cyberbox sshd[95' + i + ']: Failed password for ' + (u === 'admin' ? 'invalid user ' : '') + u + ' from 203.0.113.77 port 4' + (4100 + i));
    });
    L.push('Nov 12 09:21:40 cyberbox sshd[960]: Accepted password for admin from 203.0.113.77 port 44112');
    L.push('Nov 12 09:30:09 cyberbox sshd[975]: Failed password for student from 10.0.0.15 port 51030');
    L.push('Nov 12 09:30:15 cyberbox sshd[976]: Accepted password for student from 10.0.0.15 port 51031');
    return L.join('\n') + '\n';
  }
  VM.defaultFS = function () { var f = defaultFS(); delete f.c.var_; return f; };

  // ---------- Состояние (в профиле ученика) ----------
  VM.state = function () {
    var s = CS.state;
    if (!s.vm || !s.vm.fs) s.vm = { fs: VM.defaultFS(), cwd: '/home/student', hist: [], flags: {}, log: [] };
    return s.vm;
  };
  function save() { try { CS.save(); } catch (e) {} }
  VM.reset = function () { CS.state.vm = null; VM.state(); save(); };

  function parts(path) { return String(path).split('/').filter(Boolean); }
  function resolve(p) {
    var st = VM.state(), base = p.charAt(0) === '/' ? [] : parts(st.cwd);
    if (p === '~' || p.indexOf('~/') === 0) { base = ['home', 'student']; p = p.slice(1); }
    parts(p).forEach(function (x) { if (x === '..') base.pop(); else if (x !== '.') base.push(x); });
    return '/' + base.join('/');
  }
  function get(path) { var n = VM.state().fs; var ps = parts(path); for (var i = 0; i < ps.length; i++) { if (!n || n.t !== 'd' || !n.c[ps[i]]) return null; n = n.c[ps[i]]; } return n; }
  function dirOf(path) { var ps = parts(path); var name = ps.pop(); return { dir: get('/' + ps.join('/')), name: name }; }
  VM.read = function (p) { var n = get(resolve(p)); return n && n.t === 'f' ? n.s : null; };
  VM.write = function (p, text, append) {
    var r = resolve(p), d = dirOf(r); if (!d.dir || d.dir.t !== 'd' || !d.name) return 'нет такого каталога';
    var n = d.dir.c[d.name]; if (n && n.t === 'd') return 'это каталог';
    if (n && append) n.s += text; else d.dir.c[d.name] = F(text);
    save(); return null;
  };
  VM.exists = function (p) { return !!get(resolve(p)); };
  VM.tree = function () { return VM.state().fs; };

  // ---------- Виртуальная сеть и сайты ----------
  var HOSTS = { 'shop.local': '10.10.10.5', 'intranet.local': '10.10.10.12', localhost: '127.0.0.1' };
  var NET = {
    '10.10.10.5': { name: 'shop.local', ports: { 22: 'ssh OpenSSH 8.2p1', 80: 'http nginx 1.18.0' } },
    '10.10.10.12': { name: 'intranet.local', ports: { 22: 'ssh OpenSSH 8.9', 8080: 'http-alt Jetty 9.4' } }
  };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function page(title, body) { return '<h1>' + title + '</h1>' + body; }
  var PRODUCTS = { 1: ['Кружка Hacker', 450], 2: ['Футболка ROOT', 1200], 3: ['Стикеры CVE', 150] };
  function qparse(s) { var o = {}; String(s || '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); var k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1); try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; } }); return o; }
  function sqliLike(s) { return /('|%27)\s*(or|and)\s|--|#|'\s*=\s*'|\bunion\b/i.test(String(s)); }

  // Возвращает {status, headers, body}. body — безопасный HTML собственной генерации.
  VM.serve = function (host, port, method, path, data) {
    var ip = HOSTS[host] || host; var net = NET[ip];
    if (!net) return { status: 0, error: 'Could not resolve host / no route to host' };
    if (!net.ports[port]) return { status: 0, error: 'Connection refused (порт ' + port + ' закрыт)' };
    var u = path.split('?'), p = u[0] || '/', q = qparse(u[1]), form = qparse(data);
    var H = { Server: ip === '10.10.10.5' ? 'nginx/1.18.0' : 'Jetty(9.4)', 'Content-Type': 'text/html; charset=utf-8' };
    function R(status, body, extra) { var h = {}; for (var k in H) h[k] = H[k]; for (var k2 in (extra || {})) h[k2] = extra[k2]; return { status: status, headers: h, body: body }; }
    if (ip === '10.10.10.5' && port === 80) {
      H['X-Powered-By'] = 'PHP/7.4.3';
      if (p === '/') return R(200, page('ShopLocal', '<p>Магазин для хакеров. <a href="/products?id=1">Товары</a> · <a href="/login">Войти</a> · <a href="/about">О нас</a></p><!-- TODO: убрать /robots.txt из репозитория -->'));
      if (p === '/about') return R(200, page('О нас', '<p>Мы — вымышленный магазин для учебной лаборатории. Админ: <b>anna</b>.</p>'));
      if (p === '/robots.txt') return R(200, 'User-agent: *\nDisallow: /admin-panel-x7\nDisallow: /backup/\n', { 'Content-Type': 'text/plain' });
      if (p === '/admin-panel-x7') return R(200, page('Админ-панель', '<p>Вы нашли скрытую панель.</p><p class="flag">FLAG: CS{robots_txt_tells_secrets}</p>'));
      if (p === '/backup/' || p === '/backup') return R(403, page('403 Forbidden', '<p>Доступ запрещён.</p>'));
      if (p === '/products') {
        var id = q.id || '1';
        if (/'/.test(id)) return R(500, page('Ошибка БД', '<pre>SQL error: You have an error in your SQL syntax near \'' + esc(id) + '\' at line 1\nQuery: SELECT * FROM products WHERE id = ' + esc(id) + '</pre><p>Подробная ошибка раскрывает устройство запроса — так делать нельзя.</p>'));
        var pr = PRODUCTS[id]; if (!pr) return R(404, page('404', '<p>Товар не найден.</p>'));
        return R(200, page(esc(pr[0]), '<p>Цена: ' + pr[1] + ' ₽</p><p><a href="/products?id=' + (((+id) % 3) + 1) + '">Следующий товар</a></p>'));
      }
      if (p === '/login') {
        if (method !== 'POST') return R(200, page('Вход', '<form method="post" action="/login"><p><input name="user" placeholder="логин"></p><p><input name="pass" type="password" placeholder="пароль"></p><p><button>Войти</button></p></form>'));
        var user = form.user || '', pass = form.pass || '';
        var q2 = "SELECT * FROM users WHERE user='" + user + "' AND pass='" + pass + "'";
        if (sqliLike(user) || sqliLike(pass)) return R(200, page('Добро пожаловать, admin', '<p>Вход выполнен.</p><p class="flag">FLAG: CS{sqli_bypass_login}</p><pre>' + esc(q2) + '</pre>'));
        if (user === 'anna' && pass === 'pass123') return R(200, page('Привет, anna', '<p>Вы вошли как обычный пользователь.</p>'));
        return R(401, page('Ошибка входа', '<p>Неверный логин или пароль.</p>'));
      }
      return R(404, page('404 Not Found', '<p>Страница ' + esc(p) + ' не найдена.</p>'));
    }
    if (ip === '10.10.10.12' && port === 8080) {
      if (p === '/') return R(200, page('Intranet', '<p>Внутренняя сеть компании. <a href="/status">Статус</a></p><p class="flag">FLAG: CS{found_the_intranet}</p>'));
      if (p === '/status') return R(200, page('Статус', '<p>Все системы работают.</p>'));
      return R(404, page('404', '<p>Нет такой страницы.</p>'));
    }
    return R(200, 'SSH-2.0-OpenSSH banner', { 'Content-Type': 'text/plain' });
  };
  function stripTags(h) { return h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); }

  // ---------- Токенизатор и оболочка ----------
  function tokenize(line) { var out = [], cur = '', q = null, has = false; for (var i = 0; i < line.length; i++) { var c = line[i]; if (q) { if (c === q) q = null; else cur += c; } else if (c === '"' || c === "'") { q = c; has = true; } else if (c === ' ') { if (cur || has) { out.push(cur); cur = ''; has = false; } } else if (c === '|' || c === '>') { if (cur || has) { out.push(cur); cur = ''; has = false; } if (c === '>' && line[i + 1] === '>') { out.push('>>'); i++; } else out.push(c); } else cur += c; } if (cur || has) out.push(cur); return out; }
  function ls(args) {
    var all = args.indexOf('-a') > -1 || args.indexOf('-la') > -1 || args.indexOf('-al') > -1, long = args.some(function (a) { return /^-.*l/.test(a); });
    var t = args.filter(function (a) { return a[0] !== '-'; })[0] || '.', n = get(resolve(t));
    if (!n) return 'ls: нет такого файла или каталога: ' + t;
    if (n.t === 'f') return t;
    var names = Object.keys(n.c).sort().filter(function (x) { return all || x[0] !== '.'; });
    if (all) names = ['.', '..'].concat(names);
    if (!long) return names.map(function (x) { var c = n.c[x]; return c && c.t === 'd' ? x + '/' : x; }).join('  ');
    return names.map(function (x) { var c = n.c[x]; var d = !c || c.t === 'd'; return (d ? 'drwxr-xr-x' : '-rw-r--r--') + ' student student ' + ('     ' + (c ? (d ? 4096 : c.s.length) : 4096)).slice(-6) + ' Nov 12 ' + x + (d ? '/' : ''); }).join('\n');
  }
  function find(args) { var start = resolve(args[0] && args[0][0] !== '-' ? args[0] : '.'), nm = null; var i = args.indexOf('-name'); if (i > -1) nm = new RegExp('^' + String(args[i + 1]).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); var res = []; (function walk(p, n) { if (!nm || nm.test(p.split('/').pop())) res.push(p); if (n.t === 'd') Object.keys(n.c).sort().forEach(function (k) { walk((p === '/' ? '' : p) + '/' + k, n.c[k]); }); })(start, get(start) || D()); return res.join('\n'); }
  function runJS(code) {
    return new Promise(function (res) {
      var src = 'onmessage=function(e){var out=[];var log=function(){out.push([].slice.call(arguments).map(function(a){try{return typeof a==="string"?a:JSON.stringify(a)}catch(x){return String(a)}}).join(" "))};var console={log:log,error:log,warn:log,info:log};try{new Function("console",e.data)(console)}catch(x){out.push("Error: "+x.message)}postMessage(out.join("\\n"))}';
      try { var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))), done = false;
        var tm = setTimeout(function () { if (!done) { done = true; w.terminate(); res('Превышено время выполнения (2 с)'); } }, 2000);
        w.onmessage = function (e) { if (!done) { done = true; clearTimeout(tm); w.terminate(); res(e.data); } };
        w.onerror = function () { if (!done) { done = true; clearTimeout(tm); res('Ошибка выполнения'); } };
        w.postMessage(code); } catch (e) { res('Не удалось запустить код'); }
    });
  }
  VM.runJS = runJS;

  var HELP = 'Команды CyberBox:\n  Файлы:    ls [-la], cd, pwd, cat, head, tail, touch, mkdir, rm [-r], cp, mv, find -name, nano <файл>\n  Текст:    echo, grep, wc [-l], sort, uniq, base64 [-d], sha256sum\n  Сеть:     ping, nslookup, curl [-I] [-i] [-d данные] <url>, nmap [-p порты] <хост>, ifconfig\n  Система:  whoami, id, hostname, uname -a, date, ps, top, kill, df, free, uptime, env, history, clear\n  Linux:    chmod, stat, sudo, apt, systemctl, tree, which, bash <скрипт> / ./скрипт\n  Код:      node <файл.js>   (запускает JavaScript-файл)\n  Пайпы:    cmd1 | cmd2     Запись в файл:  echo текст > файл   (>> — дописать)\nПодсказка: Tab дополняет имена, стрелки ↑↓ — история.';
  var CMDS = {
    help: function () { return HELP; },
    pwd: function () { return VM.state().cwd; },
    whoami: function () { return 'student'; },
    id: function () { return 'uid=1000(student) gid=1000(student) groups=1000(student)'; },
    hostname: function () { return 'cyberbox'; },
    uname: function () { return 'Linux cyberbox 5.15.0-cs #1 SMP x86_64 GNU/Linux'; },
    date: function () { return new Date().toString(); },
    env: function () { return 'USER=student\nHOME=/home/student\nSHELL=/bin/bash\nPWD=' + VM.state().cwd + '\nTARGET=shop.local'; },
    ps: function () { return '  PID TTY          TIME CMD\n    1 ?        00:00:01 init\n  412 ?        00:00:00 sshd\n  690 pts/0    00:00:00 bash\n  731 pts/0    00:00:00 ps'; },
    ifconfig: function () { return 'eth0: inet 10.10.10.2  netmask 255.255.255.0  broadcast 10.10.10.255\n      ether 02:42:0a:0a:0a:02\nlo:   inet 127.0.0.1   netmask 255.0.0.0'; },
    ls: function (a) { return ls(a); },
    cd: function (a) { var t = resolve(a[0] || '~'), n = get(t); if (!n) return 'cd: нет такого каталога: ' + (a[0] || ''); if (n.t !== 'd') return 'cd: не каталог: ' + a[0]; VM.state().cwd = t; save(); return ''; },
    cat: function (a, c) { if (!a.length) return c.stdin || ''; return a.map(function (f) { var s = VM.read(f); return s == null ? 'cat: ' + f + ': нет такого файла' : s.replace(/\n$/, ''); }).join('\n'); },
    echo: function (a) { return a.join(' '); },
    touch: function (a) { a.forEach(function (f) { if (!VM.exists(f)) VM.write(f, ''); }); return ''; },
    mkdir: function (a) { var e = ''; a.filter(function (x) { return x[0] !== '-'; }).forEach(function (f) { var r = resolve(f), d = dirOf(r); if (!d.dir) e += 'mkdir: нет родительского каталога\n'; else if (d.dir.c[d.name]) e += 'mkdir: уже существует: ' + f + '\n'; else { d.dir.c[d.name] = D(); } }); save(); return e.trim(); },
    rm: function (a) { var e = ''; a.filter(function (x) { return x[0] !== '-'; }).forEach(function (f) { var r = resolve(f), d = dirOf(r), n = get(r); if (!n) e += 'rm: нет такого файла: ' + f + '\n'; else if (n.t === 'd' && a.join(' ').indexOf('-r') < 0) e += 'rm: ' + f + ' — каталог (нужен -r)\n'; else delete d.dir.c[d.name]; }); save(); return e.trim(); },
    cp: function (a) { var s = get(resolve(a[0] || '')); if (!s || s.t !== 'f') return 'cp: исходный файл не найден'; var e = VM.write(a[1] || '', s.s); return e ? 'cp: ' + e : ''; },
    mv: function (a) { var r = resolve(a[0] || ''), d = dirOf(r), n = get(r); if (!n) return 'mv: нет такого файла'; var t = resolve(a[1] || ''), td = dirOf(t); if (!td.dir) return 'mv: нет каталога назначения'; td.dir.c[td.name] = n; delete d.dir.c[d.name]; save(); return ''; },
    head: function (a, c) { var n = 10, f = null; a.forEach(function (x, i) { if (x === '-n') n = +a[i + 1]; else if (/^-\d+$/.test(x)) n = -x; else if (x[0] !== '-' && !(a[i - 1] === '-n')) f = x; }); var s = f ? VM.read(f) : c.stdin; return s == null ? 'head: нет файла' : s.split('\n').slice(0, n).join('\n'); },
    tail: function (a, c) { var n = 10, f = null; a.forEach(function (x, i) { if (x === '-n') n = +a[i + 1]; else if (/^-\d+$/.test(x)) n = -x; else if (x[0] !== '-' && !(a[i - 1] === '-n')) f = x; }); var s = f ? VM.read(f) : c.stdin; return s == null ? 'tail: нет файла' : s.replace(/\n$/, '').split('\n').slice(-n).join('\n'); },
    wc: function (a, c) { var f = a.filter(function (x) { return x[0] !== '-'; })[0], s = f ? VM.read(f) : c.stdin; if (s == null) return 'wc: нет файла'; var l = s.split('\n').length - (s.slice(-1) === '\n' ? 1 : 0); return a.indexOf('-l') > -1 ? String(l) : l + ' ' + (s.split(/\s+/).filter(Boolean).length) + ' ' + s.length; },
    grep: function (a, c) { var ic = a.indexOf('-i') > -1, inv = a.indexOf('-v') > -1, cnt = a.indexOf('-c') > -1, rest = a.filter(function (x) { return x[0] !== '-'; }), pat = rest[0], f = rest[1], s = f ? VM.read(f) : c.stdin; if (s == null) return 'grep: нет файла'; var re; try { re = new RegExp(pat, ic ? 'i' : ''); } catch (e) { return 'grep: неверное выражение'; } var m = s.split('\n').filter(function (l) { return l && (re.test(l) !== inv); }); return cnt ? String(m.length) : m.join('\n'); },
    sort: function (a, c) { return (c.stdin || '').replace(/\n$/, '').split('\n').sort().join('\n'); },
    uniq: function (a, c) { var o = [], p = null; (c.stdin || '').replace(/\n$/, '').split('\n').forEach(function (l) { if (l !== p) o.push(l); p = l; }); return o.join('\n'); },
    find: function (a) { return find(a); },
    base64: function (a, c) { var f = a.filter(function (x) { return x[0] !== '-'; })[0], s = f ? VM.read(f) : c.stdin; if (s == null) return 'base64: нет данных'; try { return a.indexOf('-d') > -1 ? decodeURIComponent(escape(atob(s.trim()))) : btoa(unescape(encodeURIComponent(s.replace(/\n$/, '')))); } catch (e) { return 'base64: неверные данные'; } },
    sha256sum: function (a) { return 'sha256sum: в этой версии недоступна (используй Get-FileHash у себя на ПК)'; },
    history: function () { return VM.state().hist.map(function (h, i) { return ('   ' + (i + 1)).slice(-4) + '  ' + h; }).join('\n'); },
    ping: function (a) { var h = a.filter(function (x) { return x[0] !== '-'; })[0]; var ip = HOSTS[h] || h; if (!NET[ip] && ip !== '127.0.0.1') return 'ping: ' + h + ': Name or service not known'; return 'PING ' + h + ' (' + ip + ') 56 bytes\n64 bytes from ' + ip + ': icmp_seq=1 ttl=64 time=0.4 ms\n64 bytes from ' + ip + ': icmp_seq=2 ttl=64 time=0.3 ms\n--- 2 packets transmitted, 2 received, 0% packet loss'; },
    nslookup: function (a) { var h = a[0]; return HOSTS[h] ? 'Server: 10.10.10.1\nName:    ' + h + '\nAddress: ' + HOSTS[h] : '** server can\'t find ' + h + ': NXDOMAIN'; },
    nmap: function (a) {
      var h = a.filter(function (x) { return x[0] !== '-' && !/^\d[\d,-]*$/.test(x); })[0], pi = a.indexOf('-p'), ports = pi > -1 ? String(a[pi + 1]).split(',') : null; var ip = HOSTS[h] || h;
      if (h === '10.10.10.0/24') return 'Starting Nmap 7.94 ( https://nmap.org )\nNmap scan report for 10.10.10.5 (shop.local)  Host is up\nNmap scan report for 10.10.10.12 (intranet.local)  Host is up\nNmap done: 256 IP addresses (3 hosts up)';
      var n = NET[ip]; if (!n) return 'Note: Host seems down.';
      var lines = ['Starting Nmap 7.94 ( https://nmap.org )', 'Nmap scan report for ' + h + ' (' + ip + ')', 'Host is up (0.00042s latency).', 'PORT      STATE  SERVICE'];
      var list = ports || ['21', '22', '80', '443', '3306', '8080']; list.forEach(function (p) { var s = n.ports[p]; if (s) lines.push((p + '/tcp     ').slice(0, 10) + 'open   ' + s); else if (ports) lines.push((p + '/tcp     ').slice(0, 10) + 'closed ' + ''); }); if (!ports) lines.push('(показаны только открытые)');
      return lines.join('\n');
    },
    curl: function (a) {
      var url = a.filter(function (x) { return x[0] !== '-' && a[a.indexOf(x) - 1] !== '-d' && a[a.indexOf(x) - 1] !== '-X'; })[0], head = a.indexOf('-I') > -1, inc = a.indexOf('-i') > -1 || head, di = a.indexOf('-d'), data = di > -1 ? a[di + 1] : '', method = a.indexOf('-X') > -1 ? a[a.indexOf('-X') + 1] : (di > -1 ? 'POST' : 'GET');
      if (!url) return 'curl: укажи адрес, например: curl http://shop.local/';
      var m = /^(?:https?:\/\/)?([^\/:]+)(?::(\d+))?(\/.*)?$/.exec(url); if (!m) return 'curl: неверный URL';
      var r = VM.serve(m[1], +(m[2] || 80), method, m[3] || '/', data);
      if (r.error) return 'curl: (7) ' + r.error;
      var out = ''; if (inc) { out += 'HTTP/1.1 ' + r.status + ' ' + ({ 200: 'OK', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' }[r.status] || '') + '\n'; for (var k in r.headers) out += k + ': ' + r.headers[k] + '\n'; out += '\n'; }
      return head ? out.trim() : out + r.body;
    },
    nano: null, edit: null, node: null
  };
  CMDS.edit = CMDS.nano;
  VM.commands = Object.keys(CMDS).concat(['nano', 'node', 'clear', 'man']);

  // exec: возвращает Promise<{out, clear, edit}>
  VM.exec = function (line) {
    var st = VM.state(); line = line.trim(); if (!line) return Promise.resolve({ out: '' });
    st.hist.push(line); if (st.hist.length > 200) st.hist.shift(); st.log.push(line); if (st.log.length > 300) st.log.shift(); save();
    var tk = tokenize(line), segs = [[]]; tk.forEach(function (t) { if (t === '|') segs.push([]); else segs[segs.length - 1].push(t); });
    var chain = Promise.resolve(''), clearFlag = false, editFile = null;
    segs.forEach(function (seg, si) {
      chain = chain.then(function (stdin) {
        var redir = null, app = false, args = [];
        for (var i = 0; i < seg.length; i++) { if (seg[i] === '>' || seg[i] === '>>') { app = seg[i] === '>>'; redir = seg[i + 1]; i++; } else args.push(seg[i]); }
        var cmd = args.shift(); var res;
        if (cmd === 'clear') { clearFlag = true; res = ''; }
        else if (cmd === 'man') { res = args[0] && HELP.indexOf(args[0]) > -1 ? 'Команда ' + args[0] + ': см. справку (help).' : 'Нет справки для ' + (args[0] || ''); }
        else if (cmd === 'nano' || cmd === 'edit' || cmd === 'vi' || cmd === 'vim') { editFile = resolve(args[0] || 'untitled.txt'); res = 'Открываю редактор: ' + editFile; }
        else if (VM.runScript && (cmd === 'bash' || cmd === 'sh' || (cmd && cmd.indexOf('./') === 0))) { res = VM.runScript(cmd, args); }
        else if (cmd === 'node') { var code = VM.read(args[0] || ''); res = code == null ? 'node: файл не найден: ' + (args[0] || '') : runJS(code); }
        else if (CMDS[cmd]) res = CMDS[cmd](args, { stdin: stdin });
        else res = cmd + ': команда не найдена. Введи help';
        return Promise.resolve(res).then(function (o) {
          o = String(o == null ? '' : o);
          if (redir) { var e = VM.write(redir, o + '\n', app); return e ? 'ошибка: ' + e : ''; }
          return o;
        });
      });
    });
    return chain.then(function (out) { return { out: out, clear: clearFlag, edit: editFile }; });
  };

  // ---------- Задания лабораторных ----------
  function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }
  // Проверка задания: возвращает Promise<boolean>
  VM.check = function (task, input) {
    var c = task.check || {}, st = VM.state();
    if (c.flag) return Promise.resolve(norm(input || '') === norm(c.flag));
    if (c.answer) return Promise.resolve([].concat(c.answer).some(function (a) { return norm(a) === norm(input || ''); }));
    if (c.file) { var s = VM.read(c.file); return Promise.resolve(s != null && (!c.contains || s.indexOf(c.contains) > -1)); }
    if (c.cmd) { var re = new RegExp(c.cmd, 'i'); return Promise.resolve(st.log.some(function (l) { return re.test(l); })); }
    if (c.run) return VM.exec(c.run).then(function (r) { return norm(r.out) === norm(c.out); });
    return Promise.resolve(false);
  };
  VM.note = function (t) { var st = VM.state(); st.log.push(t); if (st.log.length > 300) st.log.shift(); save(); };
  VM.done = function (id) { return !!VM.state().flags[id]; };
  VM.markDone = function (id) { var f = VM.state().flags; if (!f[id]) { f[id] = Date.now(); try { CS.addXP(15); CS.logEvent({ type: 'lab', id: id, title: 'Лаборатория: ' + id, xp: 15 }); } catch (e) {} save(); return true; } return false; };
  VM.strip = stripTags;
  // Внутренности для расширений (vm-linux.js)
  VM._int = { get: get, resolve: resolve, save: save, F: F, D: D, dirOf: dirOf };
  VM.cmds = CMDS;
})();
