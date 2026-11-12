/* CYBER SEC — расширение CyberBox «Linux»: права и chmod, sudo, пакеты (apt), службы (systemctl), процессы, диски, запуск скриптов.
   Всё имитация: ничего реального не устанавливается и не запускается. */
(function () {
  'use strict';
  var VM = window.CSVM;
  if (!VM || !VM._int) return;
  var I = VM._int, C = VM.cmds;

  function rootOwned(p) { return /^\/(etc|var|usr|root|bin|sbin|proc)(\/|$)/.test(String(p).replace(/\/+/g, '/')); }
  function modeOf(n) { return n.m || (n.t === 'd' ? '755' : '644'); }
  function mstr(m, isDir) { var o = ''; String(m).split('').forEach(function (d) { d = +d; o += (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-'); }); return (isDir ? 'd' : '-') + o; }
  function pad(x, n) { return ('        ' + x).slice(-n); }

  // Дополняем файловую систему, не стирая файлы ученика.
  VM.ensureLinux = function () {
    var fs = VM.state().fs, F = I.F, D = I.D, changed = false;
    function ensure(dir, name, node) { if (!dir.c[name]) { dir.c[name] = node; changed = true; } }
    var etc = fs.c.etc; if (etc) {
      ensure(etc, 'os-release', F('NAME="CyberBox Linux"\nVERSION="20.04 (учебная)"\nID=cyberbox\n'));
      ensure(etc, 'shadow', F('root:!:19000:0:99999:7:::\nstudent:$6$salt$hashhashhash:19000:0:99999:7:::\n'));
      etc.c.shadow && (etc.c.shadow.m = etc.c.shadow.m || '640');
    }
    ensure(fs, 'root', D({ 'flag.txt': F('FLAG: CS{only_root_can_read_this}\n') }));
    if (fs.c.root && fs.c.root.c['flag.txt'] && !fs.c.root.c['flag.txt'].m) fs.c.root.c['flag.txt'].m = '600';
    var st = fs.c.home && fs.c.home.c.student;
    if (st) {
      ensure(st, 'scripts', D({ 'backup.sh': F('# Учебный скрипт резервного копирования\nmkdir -p /tmp/backup\necho Копирую файлы...\ncp /home/student/notes.txt /tmp/backup/notes.txt\necho Готово: резервная копия создана\n') }));
    }
    if (changed) I.save();
  };

  // ---- ls с реальными правами и владельцами ----
  C.ls = function (args) {
    var all = args.some(function (a) { return /^-.*a/.test(a); }), long = args.some(function (a) { return /^-.*l/.test(a); });
    var t = args.filter(function (a) { return a[0] !== '-'; })[0] || '.', abs = I.resolve(t), n = I.get(abs);
    if (!n) return 'ls: нет такого файла или каталога: ' + t;
    function row(name, c, p) { var d = c.t === 'd'; return mstr(modeOf(c), d) + ' ' + (rootOwned(p) ? 'root    root   ' : 'student student') + ' ' + pad(d ? 4096 : c.s.length, 6) + ' Nov 12 ' + name + (d ? '/' : ''); }
    if (n.t === 'f') return long ? row(t, n, abs) : t;
    var names = Object.keys(n.c).sort().filter(function (x) { return all || x[0] !== '.'; });
    if (!long) return (all ? ['.', '..'] : []).concat(names.map(function (x) { return n.c[x].t === 'd' ? x + '/' : x; })).join('  ');
    var lines = names.map(function (x) { return row(x, n.c[x], (abs === '/' ? '' : abs) + '/' + x); });
    if (all) lines = [mstr('755', true) + ' student student   4096 Nov 12 ./', mstr('755', true) + ' student student   4096 Nov 12 ../'].concat(lines);
    return lines.join('\n');
  };
  var oldCat = C.cat;
  C.cat = function (a, c) {
    if (!c.root) { for (var i = 0; i < a.length; i++) { var p = I.resolve(a[i]); var n = I.get(p); if (n && n.t === 'f' && (n.m === '600' || n.m === '640') && rootOwned(p)) return 'cat: ' + a[i] + ': Отказано в доступе (файл только для root — попробуй sudo cat ' + a[i] + ')'; } }
    return oldCat(a, c);
  };
  C.whoami = function (a, c) { return c && c.root ? 'root' : 'student'; };
  C.id = function (a, c) { return c && c.root ? 'uid=0(root) gid=0(root) groups=0(root)' : 'uid=1000(student) gid=1000(student) groups=1000(student),27(sudo)'; };

  C.chmod = function (a, c) {
    var mode = a[0], f = a[1]; if (!mode || !f) return 'chmod: нужен режим и файл, например: chmod 755 script.sh  или  chmod +x script.sh';
    var r = I.resolve(f), n = I.get(r); if (!n) return 'chmod: нет такого файла: ' + f;
    if (rootOwned(r) && !c.root) return 'chmod: изменение прав на «' + f + '»: Операция не позволена (файл принадлежит root, нужен sudo)';
    var cur = modeOf(n).split('').map(Number);
    if (/^[0-7]{3}$/.test(mode)) n.m = mode;
    else {
      var m = /^([ugoa]*)([+\-=])([rwx]+)$/.exec(mode); if (!m) return 'chmod: неверный режим: ' + mode;
      var who = m[1] || 'a', bits = 0; m[3].split('').forEach(function (ch) { bits |= ch === 'r' ? 4 : ch === 'w' ? 2 : 1; });
      ['u', 'g', 'o'].forEach(function (w, i) { if (who.indexOf('a') > -1 || who.indexOf(w) > -1) cur[i] = m[2] === '+' ? (cur[i] | bits) : m[2] === '-' ? (cur[i] & ~bits) : bits; });
      n.m = cur.join('');
    }
    I.save(); return '';
  };
  C.stat = function (a) { var f = a[0], n = f && I.get(I.resolve(f)); if (!n) return 'stat: нет такого файла'; return '  File: ' + f + '\n  Size: ' + (n.t === 'f' ? n.s.length : 4096) + '\nAccess: (0' + modeOf(n) + '/' + mstr(modeOf(n), n.t === 'd') + ')  Uid: (' + (rootOwned(I.resolve(f)) ? '0/root' : '1000/student') + ')'; };
  C.sudo = function (a, c) {
    if (!a.length) return 'usage: sudo команда';
    var f = C[a[0]]; if (!f) return 'sudo: в CyberBox доступно для chmod, cat, apt, systemctl, kill, whoami, id. Команда «' + a[0] + '» не поддерживается.';
    return f(a.slice(1), { stdin: c && c.stdin, root: true });
  };
  C.apt = function (a, c) {
    var sub = a[0], pkg = a[1], root = c && c.root;
    if (sub === 'update') return root ? 'Hit:1 http://archive.cyberbox.local focal InRelease\nReading package lists... Done' : 'E: Нужны права root. Попробуй: sudo apt update';
    if (sub === 'install') { if (!root) return 'E: Не удалось получить блокировку — нужны права root. Попробуй: sudo apt install ' + (pkg || 'пакет'); var st = VM.state(); st.pkgs = st.pkgs || {}; st.pkgs[pkg] = 1; I.save(); return 'Reading package lists... Done\nSetting up ' + pkg + ' ...\n' + pkg + ' установлен.'; }
    if (sub === 'list') { var inst = Object.keys((VM.state().pkgs) || {}); return 'установлено: ' + (inst.length ? inst.join(', ') : '(ничего из доп. пакетов)') + '\nдоступно: nmap, htop, cowsay, tree'; }
    return 'apt: команды update, install <пакет>, list';
  };
  C.systemctl = function (a, c) {
    var sub = a[0], svc = a[1] || 'ssh', st = VM.state(); st.svc = st.svc || { ssh: 'active', nginx: 'inactive', cron: 'active' };
    if (sub === 'status') return '● ' + svc + '.service\n   Active: ' + (st.svc[svc] === 'active' ? 'active (running)' : 'inactive (dead)');
    if (sub === 'start' || sub === 'stop' || sub === 'restart') { if (!(c && c.root)) return 'Failed: нужны права root. Попробуй: sudo systemctl ' + sub + ' ' + svc; st.svc[svc] = sub === 'stop' ? 'inactive' : 'active'; I.save(); return ''; }
    return 'systemctl: status | start | stop | restart <служба>';
  };
  C.top = function () { return 'top - 09:30:01 up 3 days,  load average: 0.12, 0.10, 0.08\nTasks:  4 total,  1 running\n  PID USER      %CPU %MEM COMMAND\n  412 root       0.0  0.4 sshd\n  690 student    0.1  0.2 bash\n  731 student    0.3  0.1 top\n    1 root       0.0  0.1 init'; };
  C.kill = function (a, c) { var pid = a[a.length - 1]; if (!/^\d+$/.test(pid)) return 'kill: укажи PID, например: kill 731'; if ((pid === '1' || pid === '412') && !(c && c.root)) return 'kill: (' + pid + ') — Операция не позволена (процесс root)'; return 'Процесс ' + pid + ' завершён (учебная имитация)'; };
  C.df = function () { return 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        20G  4.1G   15G  22% /\ntmpfs           498M     0  498M   0% /dev/shm'; };
  C.free = function () { return '              total        used        free\nMem:        1017224      312004      402120\nSwap:       1048572           0     1048572'; };
  C.uptime = function () { return ' 09:30:01 up 3 days, 2 users, load average: 0.12, 0.10, 0.08'; };
  C.which = function (a) { return VM.commands.indexOf(a[0]) > -1 ? '/usr/bin/' + a[0] : a[0] + ' не найден'; };
  C.tree = function () {
    var out = []; (function walk(n, pre) { var ks = Object.keys(n.c).sort().filter(function (k) { return k[0] !== '.'; }); ks.forEach(function (k, i) { var last = i === ks.length - 1, c = n.c[k]; out.push(pre + (last ? '└── ' : '├── ') + k + (c.t === 'd' ? '/' : '')); if (c.t === 'd') walk(c, pre + (last ? '    ' : '│   ')); }); })(I.get(I.resolve('.')), '');
    return '.\n' + out.join('\n');
  };

  // ---- запуск скриптов: bash file / ./file (нужно право x) ----
  VM.runScript = function (cmd, args) {
    var f = cmd.indexOf('./') === 0 ? cmd : args[0], n = f && I.get(I.resolve(f));
    if (!n || n.t !== 'f') return cmd + ': файл не найден: ' + (f || '');
    if (cmd.indexOf('./') === 0 && (+modeOf(n).charAt(0) & 1) === 0) return 'bash: ' + f + ': Отказано в доступе (у файла нет права на выполнение — chmod +x ' + f.replace('./', '') + ')';
    var vars = {}, acc = [];
    var lines = n.s.split('\n').filter(function (l) { return l.trim() && l.trim()[0] !== '#'; });
    return lines.reduce(function (p, l) {
      return p.then(function () {
        var m = /^(\w+)=(.*)$/.exec(l.trim());
        if (m) { vars[m[1]] = m[2].replace(/^["']|["']$/g, ''); return; }
        l = l.replace(/\$(\w+)/g, function (x, v) { return vars[v] != null ? vars[v] : ''; });
        return VM.exec(l).then(function (r) { if (r.out) acc.push(r.out); });
      });
    }, Promise.resolve()).then(function () { return acc.join('\n'); });
  };

  VM.commands = Object.keys(C).concat(['nano', 'node', 'clear', 'man', 'bash']);
  VM.ensureLinux();
})();
(function () {
  var VM = window.CSVM; if (!VM || !VM.ensureLinux) return;
  var oldReset = VM.reset; VM.reset = function () { oldReset(); VM.ensureLinux(); };
})();
