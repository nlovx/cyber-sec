/* CYBER SEC — интерфейс «CyberBox»: терминал + браузер выдуманной сети + редактор файлов,
   шаг урока t:'lab' с заданиями (флаги, файлы, код) и страница #/lab. Один и тот же виртуальный ПК во всех уроках. */
(function () {
  'use strict';
  var U = window.CSUI && window.CSUI.helpers, VM = window.CSVM;
  if (!U || !VM) return;
  var h = U.h, clear = U.clear;

  function promptText() { var wp = VM.prompt && VM.prompt(); if (wp) return wp; var c = VM.state().cwd; if (c === '/home/student') c = '~'; else if (c.indexOf('/home/student/') === 0) c = '~' + c.slice(13); return 'student@cyberbox:' + c + '$ '; }

  // ---------- Панель ВМ ----------
  function mountVM(host, opts) {
    opts = opts || {}; if (VM.setMode) VM.setMode(opts.mode || (CS.os && CS.os()) || 'linux');
    var root = h('div', 'vm'); host.appendChild(root);
    var bar = h('div', 'vm-bar'), tabs = h('div', 'vm-tabs'), tTerm = h('button', 'vm-tab on', 'Терминал'), tWeb = h('button', 'vm-tab', 'Браузер'), tFiles = h('button', 'vm-tab', 'Файлы');
    tabs.appendChild(tTerm); tabs.appendChild(tWeb); tabs.appendChild(tFiles);
    var title = h('span', 'vm-title', 'CyberBox · 10.10.10.2'), reset = h('button', 'vm-reset', 'Сбросить ВМ');
    bar.appendChild(tabs); bar.appendChild(title); bar.appendChild(reset); root.appendChild(bar);

    // терминал
    var term = h('div', 'vm-term'), out = h('div', 'vm-out'), line = h('div', 'vm-line'), pr = h('span', 'vm-prompt'), inp = h('input', 'vm-input');
    inp.spellcheck = false; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; line.appendChild(pr); line.appendChild(inp); term.appendChild(out); term.appendChild(line); root.appendChild(term);
    // браузер
    var web = h('div', 'vm-web'), nav = h('div', 'vm-nav'), url = h('input', 'vm-url'), go = h('button', 'vm-go', 'Перейти'), status = h('div', 'vm-status'), pageEl = h('div', 'vm-page');
    url.value = 'http://shop.local/'; url.spellcheck = false; nav.appendChild(url); nav.appendChild(go); web.appendChild(nav); web.appendChild(status); web.appendChild(pageEl); root.appendChild(web); web.style.display = 'none';
    // файлы
    var files = h('div', 'vm-files'); root.appendChild(files); files.style.display = 'none';

    function showTab(t) { tTerm.classList.toggle('on', t === 'term'); tWeb.classList.toggle('on', t === 'web'); tFiles.classList.toggle('on', t === 'files'); term.style.display = t === 'term' ? '' : 'none'; web.style.display = t === 'web' ? '' : 'none'; files.style.display = t === 'files' ? '' : 'none'; if (t === 'term') inp.focus(); if (t === 'files') drawFiles(); }
    tTerm.onclick = function () { showTab('term'); }; tWeb.onclick = function () { showTab('web'); }; tFiles.onclick = function () { showTab('files'); };
    reset.onclick = function () { if (confirm('Сбросить виртуальный ПК к исходному состоянию? Твои файлы в нём будут удалены.')) { VM.reset(); clear(out); welcome(); setPrompt(); if (opts.onChange) opts.onChange(); } };

    function setPrompt() { pr.textContent = promptText(); }
    function print(text, cls) { var d = h('pre', 'vm-pre' + (cls ? ' ' + cls : '')); d.textContent = text; out.appendChild(d); term.scrollTop = term.scrollHeight; }
    function welcome() { print((VM.isWin && VM.isWin() ? 'CyberBox — учебный Windows PowerShell (всё выдуманное и безопасное).' : 'CyberBox — учебная виртуальная машина Linux (всё выдуманное и безопасное).') + '\nВведи  help  — список команд. Целевой сайт: http://shop.local\n', 'vm-dim'); }
    welcome(); setPrompt();
    var hi = -1;
    function run(cmd) {
      print(promptText() + cmd, 'vm-cmd');
      VM.exec(cmd).then(function (r) {
        if (r.clear) clear(out); else if (r.out) print(r.out);
        if (r.edit) openEditor(r.edit);
        setPrompt(); if (opts.onChange) opts.onChange(cmd);
      });
    }
    inp.onkeydown = function (e) {
      var H = VM.state().hist;
      if (e.key === 'Enter') { var c = inp.value; inp.value = ''; hi = -1; run(c); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (H.length) { hi = hi < 0 ? H.length - 1 : Math.max(0, hi - 1); inp.value = H[hi]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi >= 0) { hi++; inp.value = hi >= H.length ? '' : H[hi]; if (hi >= H.length) hi = -1; } }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clear(out); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        var v = inp.value, sp = v.lastIndexOf(' '), word = v.slice(sp + 1), first = sp < 0, cands;
        if (first) cands = (VM.isWin && VM.isWin() ? VM.commandsWin : VM.commands).filter(function (x) { return x.indexOf(word) === 0; });
        else { var slash = word.lastIndexOf('/'), dir = slash < 0 ? '.' : word.slice(0, slash + 1), pre = slash < 0 ? word : word.slice(slash + 1); cands = fileNames(dir).filter(function (x) { return x.indexOf(pre) === 0; }).map(function (x) { return (slash < 0 ? '' : dir) + x; }); }
        if (cands.length === 1) inp.value = v.slice(0, sp + 1) + cands[0] + (first ? ' ' : ''); else if (cands.length > 1) print(cands.join('  '));
      }
    };
    function fileNames(dir) { var n = VM.tree(); var p = dir === '.' ? VM.state().cwd : (dir.charAt(0) === '/' ? dir : VM.state().cwd + '/' + dir); var ps = p.split('/').filter(Boolean), c = n; for (var i = 0; i < ps.length; i++) { if (ps[i] === '..') continue; c = c && c.c && c.c[ps[i]]; } return c && c.c ? Object.keys(c.c).map(function (k) { return c.c[k].t === 'd' ? k + '/' : k; }) : []; }
    root.addEventListener('click', function (e) { if (term.style.display !== 'none' && !window.getSelection().toString() && /vm-term|vm-out|vm-pre|vm-line/.test(e.target.className)) inp.focus(); });

    // редактор
    function openEditor(path) {
      var ov = h('div', 'vm-ed'), box = h('div', 'vm-ed-box'), hd = h('div', 'vm-ed-h', 'Редактор · ' + path), ta = h('textarea', 'vm-ed-ta'), btns = h('div', 'viz-btns'), msg = h('span', 'vm-ed-msg');
      ta.value = VM.read(path) || ''; ta.spellcheck = false;
      function save() { var e = VM.write(path, ta.value); msg.textContent = e ? 'Ошибка: ' + e : 'Сохранено ✓'; if (opts.onChange) opts.onChange('save ' + path); drawFiles(); }
      var bs = h('button', 'btn primary', 'Сохранить (Ctrl+S)'), bc = h('button', 'btn ghost', 'Закрыть');
      bs.onclick = save; bc.onclick = function () { ov.remove(); inp.focus(); };
      ta.onkeydown = function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } if (e.key === 'Tab') { e.preventDefault(); var a = ta.selectionStart; ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = a + 2; } };
      btns.appendChild(bs); btns.appendChild(bc); btns.appendChild(msg); box.appendChild(hd); box.appendChild(ta); box.appendChild(btns); ov.appendChild(box); root.appendChild(ov); ta.focus();
    }
    // файлы
    function drawFiles() {
      clear(files); files.appendChild(h('div', 'vm-dim', 'Файловая система ВМ (клик по файлу — открыть в редакторе)'));
      (function walk(n, path, depth) {
        Object.keys(n.c).sort().forEach(function (k) {
          var c = n.c[k], full = (path === '/' ? '' : path) + '/' + k, row = h('div', 'vm-f' + (c.t === 'd' ? ' d' : ''));
          row.style.paddingLeft = (depth * 16 + 8) + 'px'; row.textContent = (c.t === 'd' ? '▸ ' : '· ') + k + (c.t === 'd' ? '/' : '');
          if (c.t === 'f') row.onclick = function () { openEditor(full); };
          files.appendChild(row); if (c.t === 'd') walk(c, full, depth + 1);
        });
      })(VM.tree(), '/', 0);
    }

    // браузер выдуманной сети
    function navigate(u, method, data) {
      var m = /^(?:https?:\/\/)?([^\/:]+)(?::(\d+))?(\/.*)?$/.exec(u.trim()); if (!m) { status.textContent = 'Неверный адрес'; return; }
      var path = m[3] || '/', r = VM.serve(m[1], +(m[2] || 80), method || 'GET', path, data || '');
      url.value = 'http://' + m[1] + (m[2] && m[2] !== '80' ? ':' + m[2] : '') + path; clear(pageEl);
      if (r.error) { status.textContent = 'Ошибка'; var er = h('div', 'vm-err'); er.appendChild(h('b', null, 'Не удалось открыть сайт')); er.appendChild(h('p', null, r.error)); pageEl.appendChild(er); }
      else {
        status.textContent = r.status + ' · ' + m[1] + ' · ' + (r.headers.Server || '');
        if ((r.headers['Content-Type'] || '').indexOf('text/plain') === 0) { var pre = h('pre'); pre.textContent = r.body; pageEl.appendChild(pre); }
        else pageEl.innerHTML = r.body; // HTML сгенерирован самим симулятором, ввод пользователя экранирован внутри serve()
      }
      VM.note('browse ' + (method || 'GET') + ' ' + url.value + ' ' + (data || ''));
    }
    pageEl.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (!a) return; e.preventDefault(); var hr = a.getAttribute('href'); navigate(hr.indexOf('http') === 0 ? hr : url.value.replace(/^(https?:\/\/[^\/]+).*$/, '$1') + (hr.charAt(0) === '/' ? hr : '/' + hr)); });
    pageEl.addEventListener('submit', function (e) { e.preventDefault(); var f = e.target, kv = []; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) kv.push(encodeURIComponent(x.name) + '=' + encodeURIComponent(x.value)); }); var act = f.getAttribute('action') || '/'; navigate(url.value.replace(/^(https?:\/\/[^\/]+).*$/, '$1') + act, (f.getAttribute('method') || 'GET').toUpperCase(), kv.join('&')); });
    go.onclick = function () { navigate(url.value); }; url.onkeydown = function (e) { if (e.key === 'Enter') navigate(url.value); };
    navigate('http://shop.local/');
    return { focus: function () { inp.focus(); }, showTab: showTab, run: run };
  }

  // ---------- Шаг урока t:'lab' ----------
  function renderLab(box, step, onResolved) {
    var wantWin = CS.os && CS.os() === 'win', labMode = wantWin && step.winOk ? 'win' : 'linux', isWin = labMode === 'win';
    box.classList.add('lab');
    box.appendChild(h('div', 'step-kick', 'Лаборатория · виртуальный ПК'));
    if (step.title) box.appendChild(h('h2', 'step-h', step.title));
    if (step.text) { String(step.text).split('\n').forEach(function (l) { if (l.trim()) { var p = h('p'); p.innerHTML = U.mdInline(l); box.appendChild(p); } }); }
    if (wantWin && !step.winOk) box.appendChild(h('p', 'lab-osnote', 'Это задание пока только для Linux — терминал ниже работает в режиме Linux. Уроки курса «Старт» поддерживают Windows.'));
    var cmdList = isWin && step.cmdsWin ? step.cmdsWin : step.cmds;
    if (cmdList && cmdList.length) {
      box.appendChild(h('div', 'sheet-h', 'Команды, которые понадобятся' + (isWin ? ' (Windows PowerShell)' : '')));
      var cm = h('div', 'lab-cmds');
      cmdList.forEach(function (c) { var r = h('div', 'lab-cmd'); r.appendChild(h('code', null, c[0])); r.appendChild(h('span', null, c[1])); if (c[2]) { var ex = h('pre', 'lab-ex'); ex.textContent = c[2]; r.appendChild(ex); } cm.appendChild(r); });
      box.appendChild(cm);
    }
    box.appendChild(h('p', 'lab-how', 'Как это работает: кликни в чёрное окно ниже и вводи команды (Enter — выполнить). Нашёл флаг или ответ — впиши в поле под нужным заданием и нажми «Сдать».'));
    var list = h('div', 'lab-tasks'); box.appendChild(list);
    var tasks = step.tasks || [], rows = {};
    tasks.forEach(function (t0, i) {
      var t = isWin && t0.win ? Object.assign({}, t0, t0.win) : t0;
      var row = h('div', 'lab-task'), ck = h('span', 'lab-ck'), body = h('div', 'lab-body'), tx = h('div', 'lab-tx'), res = h('div', 'lab-res');
      tx.innerHTML = '<b>Задание ' + (i + 1) + '.</b> ' + U.mdInline(t.text); body.appendChild(tx);
      var needsInput = t.check && (t.check.flag || t.check.answer), field = null;
      var ctl = h('div', 'lab-ctl');
      if (needsInput) { field = h('input', 'inp'); field.placeholder = t.check.flag ? 'Флаг: CS{...}' : 'Ответ'; ctl.appendChild(field); }
      var bt = h('button', 'btn ghost', needsInput ? 'Сдать' : 'Проверить'); ctl.appendChild(bt);
      if (t.hint) { var hb = h('button', 'btn ghost', 'Подсказка'); hb.onclick = function () { res.className = 'lab-res hint'; res.textContent = t.hint; }; ctl.appendChild(hb); }
      body.appendChild(ctl); body.appendChild(res);
      function setDone() { row.classList.add('done'); ck.textContent = '✓'; res.className = 'lab-res ok'; res.textContent = 'Выполнено'; }
      bt.onclick = function () { VM.check(t, field ? field.value : '').then(function (ok) { if (ok) { var first = VM.markDone(t.id); setDone(); refreshReward(); if (first) U.renderChrome(); } else { res.className = 'lab-res bad'; res.textContent = needsInput ? 'Не подходит. Проверь ответ.' : 'Пока не выполнено — проверь, что сделал всё по заданию.'; } }); };
      if (field) field.onkeydown = function (e) { if (e.key === 'Enter') bt.click(); };
      if (VM.done(t.id)) setDone();
      row.appendChild(ck); row.appendChild(body); list.appendChild(row); rows[t.id] = row;
    });
    var reward = h('div', 'lab-reward'); box.appendChild(reward);
    function refreshReward() {
      if (!tasks.length || !tasks.every(function (t) { return VM.done(t.id); })) { reward.style.display = 'none'; return; }
      var code = 'CS{' + (step.reward || ('lab_' + tasks[0].id.replace(/[^a-z0-9]/gi, '_') + '_complete')) + '}';
      clear(reward); reward.style.display = '';
      reward.appendChild(h('b', null, '⚑ Лаборатория пройдена — твой флаг-награда'));
      reward.appendChild(h('code', null, code));
      reward.appendChild(h('span', null, 'Все задания выполнены. Можешь идти дальше.'));
    }
    refreshReward();
    var host = h('div', 'lab-vm'); box.appendChild(host); mountVM(host, { mode: labMode });
    onResolved();
  }

  // ---------- Страница #/lab ----------
  function viewLab() {
    U.renderChrome(); var app = U.getApp(); clear(app);
    app.appendChild(U.crumbs([['Главная', '#/'], ['Лаборатория', null]]));
    var hero = h('section', 'rmap-hero'); hero.appendChild(h('h1', null, 'Лаборатория CyberBox')); hero.appendChild(h('p', null, 'Твой виртуальный ПК: терминал, файлы, код и выдуманный сайт shop.local. Он один на все уроки — всё, что ты сохранил, остаётся.')); app.appendChild(hero);
    var host = h('div', 'lab-vm'); app.appendChild(host); mountVM(host, {});
    var tasks = [];
    CS.allCourses().forEach(function (c) { c.lessons.forEach(function (l) { l.steps.forEach(function (s) { if (s.t === 'lab') (s.tasks || []).forEach(function (t) { tasks.push({ t: t, lesson: l, course: c }); }); }); }); });
    if (tasks.length) {
      var done = tasks.filter(function (x) { return VM.done(x.t.id); }).length;
      app.appendChild(h('h2', 'lab-h', 'Задания по урокам · ' + done + ' / ' + tasks.length));
      var ul = h('div', 'lab-all');
      tasks.forEach(function (x) { var a = h('a', 'lab-row' + (VM.done(x.t.id) ? ' done' : '')); a.href = '#/lesson/' + x.course.id + '/' + x.lesson.id; a.appendChild(h('span', 'lab-ck', VM.done(x.t.id) ? '✓' : '')); a.appendChild(h('span', null, x.t.text.replace(/[`*]/g, ''))); a.appendChild(h('em', null, x.lesson.title)); ul.appendChild(a); });
      app.appendChild(ul);
    }
    app.appendChild(U.footer());
  }

  window.CSVMUI = { renderLab: renderLab, viewLab: viewLab, mount: mountVM };
})();
