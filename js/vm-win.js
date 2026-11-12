/* CYBER SEC — режим «Windows» для CyberBox: тот же виртуальный компьютер, но с PowerShell-командами и путями C:\Users\student.
   Команды переводятся в «внутренние», поэтому файлы, флаги и проверки заданий работают одинаково в обоих режимах. */
(function () {
  'use strict';
  var VM = window.CSVM;
  if (!VM || !VM._int || !VM.exec) return;
  var I = VM._int, orig = VM.exec;
  var mode = 'linux';
  VM.setMode = function (m) { mode = m === 'win' ? 'win' : 'linux'; };
  VM.getMode = function () { return mode; };
  VM.isWin = function () { return mode === 'win'; };

  // ---- пути ----
  VM.winPath = function (p) {
    p = String(p || '/');
    if (p === '/home/student') return 'C:\\Users\\student';
    if (p.indexOf('/home/student/') === 0) return 'C:\\Users\\student\\' + p.slice(14).replace(/\//g, '\\');
    return 'C:' + p.replace(/\//g, '\\');
  };
  function linPath(a) {
    a = String(a);
    a = a.replace(/^[Cc]:\\Users\\student(?=\\|$)/, '/home/student').replace(/^[Cc]:/, '');
    return a.replace(/\\/g, '/');
  }
  VM.prompt = function () {
    if (!VM.isWin()) return null;
    return 'PS ' + VM.winPath(VM.state().cwd) + '> ';
  };

  // ---- токенизатор (как в оболочке, но сохраняем кавычки для передачи дальше) ----
  function split(line) {
    var out = [], cur = '', q = null;
    for (var i = 0; i < line.length; i++) { var c = line[i];
      if (q) { cur += c; if (c === q) q = null; }
      else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === ' ') { if (cur) { out.push(cur); cur = ''; } }
      else cur += c; }
    if (cur) out.push(cur); return out;
  }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function lpad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

  function dirListing(args) {
    var force = args.some(function (a) { return /^-(force|a|la|al)$/i.test(a); });
    var t = args.filter(function (a) { return a[0] !== '-'; })[0] || '.';
    var abs = I.resolve(linPath(t)), n = I.get(abs);
    if (!n) return 'Get-ChildItem : Не удаётся найти путь «' + VM.winPath(abs) + '», так как он не существует.';
    if (n.t === 'f') return VM.winPath(abs);
    var names = Object.keys(n.c).sort().filter(function (x) { return force || x[0] !== '.'; });
    var out = ['', '    Каталог: ' + VM.winPath(abs), '', 'Mode                 LastWriteTime         Length Name', '----                 -------------         ------ ----'];
    names.forEach(function (x) { var c = n.c[x], d = c.t === 'd'; out.push(pad((d ? 'd-----' : '-a----') + (x[0] === '.' ? 'h' : ''), 8) + '    12.11.2026     09:00 ' + lpad(d ? '' : c.s.length, 10) + ' ' + x); });
    if (!names.length) return '';
    return out.join('\n');
  }

  var HELP = 'Команды учебного PowerShell:\n  Файлы:   dir (или ls) [-Force], cd, pwd, type (или cat) файл, mkdir (md), copy, move, del (rm), echo, cls\n  Текст:   echo текст > файл (>> — дописать), Select-String слово файл (поиск)\n  Сеть:    ipconfig, ping, nslookup, curl.exe адрес, curl.exe -I адрес\n  Система: whoami, tasklist, Get-Date, hostname\n  Код:     node файл.js\nПодсказка: Tab дополняет, ↑↓ — история команд.';

  function ok(out) { return Promise.resolve({ out: out }); }

  VM.exec = function (line) {
    if (!VM.isWin()) return orig(line);
    line = String(line || '').trim(); if (!line) return ok('');
    var tk = split(line), cmd = tk[0], low = cmd.toLowerCase(), rest = tk.slice(1);
    var st = VM.state();
    // собственные команды Windows
    if (low === 'help' || low === 'get-help') { st.hist.push(line); return ok(HELP); }
    if (low === 'cls' || low === 'clear' || low === 'clear-host') { st.hist.push(line); return Promise.resolve({ out: '', clear: true }); }
    if (low === 'dir' || low === 'ls' || low === 'get-childitem' || low === 'gci') { st.hist.push(line); st.log.push('ls ' + rest.join(' ').replace(/-force/i, '-a')); return ok(dirListing(rest.map(linPath))); }
    if (low === 'pwd' || low === 'get-location' || low === 'gl') { st.hist.push(line); st.log.push('pwd'); return ok('\nPath\n----\n' + VM.winPath(st.cwd) + '\n'); }
    if (low === 'whoami') { st.hist.push(line); st.log.push('whoami'); return ok('student-pc\\student'); }
    if (low === 'hostname') { st.hist.push(line); st.log.push('hostname'); return ok('STUDENT-PC'); }
    if (low === 'get-date') { st.hist.push(line); return ok(new Date().toString()); }
    if (low === 'ipconfig') { st.hist.push(line); st.log.push('ifconfig'); return ok('\nКонфигурация IP для Windows\n\nАдаптер Ethernet:\n\n   IPv4-адрес. . . . . . . . . . . . : 10.10.10.2\n   Маска подсети . . . . . . . . . . : 255.255.255.0\n   Основной шлюз. . . . . . . . . . : 10.10.10.1'); }
    if (low === 'tasklist' || low === 'get-process') { st.hist.push(line); st.log.push('ps'); return ok('Имя образа                     PID Память\n========================= ======== ==========\nSystem Idle Process              0       8 КБ\nSystem                           4      24 КБ\nexplorer.exe                  1204  96 400 КБ\nchrome.exe                    3320 210 120 КБ\npowershell.exe                4412  62 300 КБ\ntasklist.exe                  5120   8 900 КБ'); }
    if (low === 'select-string' || low === 'findstr') { st.hist.push(line); var args = rest.filter(function (a) { return !/^-/.test(a) && !/^\/[a-z]$/i.test(a); }); return orig('grep ' + args.map(linPath).join(' ')); }
    if (low === 'type' || low === 'get-content' || low === 'gc') return orig('cat ' + rest.map(linPath).join(' ')).then(function (r) { return { out: r.out.replace(/^cat: (.+?): нет такого файла/, 'Get-Content : Не удаётся найти путь «$1», так как он не существует.') }; });
    if (low === 'md' || low === 'mkdir') return orig('mkdir ' + rest.map(linPath).join(' '));
    if (low === 'copy' || low === 'cp' || low === 'copy-item') return orig('cp ' + rest.map(linPath).join(' '));
    if (low === 'move' || low === 'mv' || low === 'move-item') return orig('mv ' + rest.map(linPath).join(' '));
    if (low === 'del' || low === 'erase' || low === 'rm' || low === 'remove-item') return orig('rm ' + rest.map(linPath).join(' '));
    if (low === 'cd' || low === 'chdir' || low === 'set-location' || low === 'sl') return orig('cd ' + rest.map(linPath).join(' '));
    if (low === 'curl.exe' || low === 'curl') return orig('curl ' + rest.join(' '));
    if (low === 'ping') {
      return orig('ping ' + rest.map(function (a) { return a; }).join(' ')).then(function (r) {
        if (!/bytes from/.test(r.out)) return { out: r.out.replace(/^ping: (.*): Name or service not known/, 'Не удалось обнаружить узел $1. Проверьте имя узла и повторите запрос.') };
        var ip = (/from ([\d.]+)/.exec(r.out) || [])[1] || '';
        return { out: 'Обмен пакетами с ' + ip + ' по 32 байтами данных:\nОтвет от ' + ip + ': число байт=32 время<1мс TTL=64\nОтвет от ' + ip + ': число байт=32 время<1мс TTL=64\n\nСтатистика Ping для ' + ip + ': пакетов отправлено = 2, получено = 2, потеряно = 0 (0% потерь)' };
      });
    }
    if (low === 'nslookup' || low === 'node' || low === 'echo' || low === 'nano' || low === 'notepad' || low === 'man') {
      var c2 = low === 'notepad' ? 'nano' : low;
      return orig(c2 + ' ' + rest.map(function (a) { return a.charAt(0) === '>' ? a : (/^["']/.test(a) ? a : linPath(a)); }).join(' '));
    }
    // команды с перенаправлением и пайпами: переводим пути и пропускаем как есть
    if (/[>|]/.test(line) && /^(echo|write-output)$/i.test(cmd)) return orig(line.replace(/^write-output/i, 'echo').replace(/\\/g, '/'));
    st.hist.push(line);
    return ok(cmd + ' : Имя «' + cmd + '» не распознано. В этом учебном PowerShell есть: dir, cd, pwd, type, mkdir, copy, move, del, echo, cls, ipconfig, ping, nslookup, curl.exe, tasklist, whoami. Введи  help');
  };
  VM.commandsWin = ['dir', 'cd', 'pwd', 'type', 'mkdir', 'copy', 'move', 'del', 'echo', 'cls', 'ipconfig', 'ping', 'nslookup', 'curl.exe', 'tasklist', 'whoami', 'hostname', 'node', 'notepad', 'help', 'Get-ChildItem', 'Get-Content', 'Select-String'];
})();
