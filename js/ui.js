/* CYBER SEC — интерфейс: роутер + рендеринг экранов и петли урока. */
(function () {
  'use strict';

  // ---------- DOM-помощники ----------
  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function frag() { return document.createDocumentFragment(); }

  // Мини-markdown: экранируем, затем **жирный**, `код`, абзацы по \n.
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mdInline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function para(container, text) {
    String(text || '').split('\n').forEach(function (line) {
      if (!line.trim()) return;
      var p = h('p');
      p.innerHTML = mdInline(line);
      container.appendChild(p);
    });
  }

  var app;
  function mount() { app = document.getElementById('app'); }

  // ---------- Роутер ----------
  function route() {
    if (!app) return;
    var hash = location.hash.replace(/^#\/?/, '');
    var parts = hash.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'track' && parts[1]) return viewTrack(parts[1]);
      if (parts[0] === 'course' && parts[1]) return viewCourse(parts[1]);
      if (parts[0] === 'lesson' && parts[1] && parts[2]) return viewLesson(parts[1], parts[2]);
      if (parts[0] === 'lab' && window.CSVMUI) return CSVMUI.viewLab();
      if (parts[0] === 'login' && window.CSAcc) return CSAcc.viewLogin();
      if (parts[0] === 'me' && window.CSAcc) return CSAcc.viewMe();
      if (parts[0] === 'map' && window.CSUI2) return CSUI2.viewMap();
      if (parts[0] === 'docs' && window.CSUI2) return CSUI2.viewDocs(parts[1]);
      if (parts[0] === 'review') return viewReview();
      if (parts[0] === 'today') return viewToday();
      if (parts[0] === 'diagnostic') return viewDiagnostic();
      return viewHome();
    } catch (e) {
      console.error('[CS] ошибка рендера:', e);
      clear(app);
      var err = h('div', 'card');
      err.appendChild(h('h2', null, 'Что-то сломалось при отрисовке'));
      err.appendChild(h('pre', 'mono', String(e && e.stack || e)));
      app.appendChild(err);
    }
    renderChrome();
  }

  // ---------- Шапка (XP / серия / повторения / режим) ----------
  function renderChrome() {
    var hdr = document.getElementById('chrome');
    if (!hdr) return;
    clear(hdr);
    var due = CS.dueCards().length;
    var s = CS.state;

    var left = h('div', 'chrome-left');
    var logo = h('a', 'brand'); logo.href = '#/';
    logo.appendChild(h('span', 'brand-mark', '⛨'));
    logo.appendChild(h('span', 'brand-name', 'CYBER SEC'));
    left.appendChild(logo);

    var right = h('div', 'chrome-right');
    right.appendChild(levelPill());
    right.appendChild(streakStat(s.streak.count || 0));
    var ap = window.CSAcc && CSAcc.pill(); if (ap) right.appendChild(ap);
    var lb = h('a', 'chrome-pill'); lb.href = '#/lab'; lb.textContent = 'Лаба'; right.appendChild(lb);
    var osb = h('button', 'chrome-pill os-pill', 'ОС: ' + (CS.os() === 'win' ? 'Windows' : 'Linux')); osb.title = 'На какой системе ты учишься: в заданиях терминала команды будут Windows (PowerShell) или Linux'; osb.onclick = function () { CS.setOS(CS.os() === 'win' ? 'linux' : 'win'); renderChrome(); route(); }; right.appendChild(osb);
    var mp = h('a', 'chrome-pill'); mp.href = '#/map'; mp.textContent = 'Карта'; right.appendChild(mp);
    var dc = h('a', 'chrome-pill'); dc.href = '#/docs'; dc.textContent = 'Справочник'; right.appendChild(dc);
    var today = h('a', 'chrome-pill'); today.href = '#/today'; today.textContent = 'Сегодня';
    right.appendChild(today);
    var rev = h('a', 'chrome-pill' + (due ? ' hot' : '')); rev.href = '#/review';
    rev.textContent = 'Повторить ' + (due ? '(' + due + ')' : '');
    right.appendChild(rev);

    // Переключатель глубины.
    var modeWrap = h('div', 'mode-switch'); modeWrap.title = 'Глубина уроков: сколько подробностей показывать';
    [['foundation', 'Foundation', 'Только основное: короткие уроки без углублений'], ['core', 'Deep Dive', 'Основное + блок «Под капотом»: как это работает внутри'], ['deep', 'Expert Lab', 'Всё + экспертные разборы: атаки и защита, сложные детали']].forEach(function (m) {
      var b = h('button', 'mode-btn' + (s.mode === m[0] ? ' on' : ''), m[1]); b.title = m[2];
      b.onclick = function () { CS.setMode(m[0]); renderChrome(); route(); };
      modeWrap.appendChild(b);
    });
    right.appendChild(modeWrap);

    var menu = h('button', 'icon-btn', '⋯');
    menu.title = 'Профиль';
    menu.onclick = profileMenu;
    right.appendChild(menu);

    hdr.appendChild(left);
    hdr.appendChild(right);
  }
  function streakStat(n) {
    var e = h('div', 'chrome-stat streak' + (n > 0 ? ' on' : ''));
    var v = h('span', 'cs-v');
    v.innerHTML = '<svg class="flame" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2c1 4-3 5.5-3 9.5 0 1.6.8 3 2 3.8-.3-1.7.6-3 2-4 .4 2.3 2.3 3.2 2.3 5.7A4.3 4.3 0 0 1 11 21a6 6 0 0 1-5-6c0-5 6-7 6-13z" fill="currentColor"/></svg><b>' + n + '</b>';
    e.appendChild(v);
    e.appendChild(h('span', 'cs-k', 'серия'));
    e.title = n > 0 ? 'Дней подряд: ' + n : 'Пройди урок сегодня — начнётся серия';
    return e;
  }
  function stat(k, v) {
    var e = h('div', 'chrome-stat');
    e.appendChild(h('span', 'cs-v', v));
    e.appendChild(h('span', 'cs-k', k));
    return e;
  }
  function levelPill() {
    var L = CS.levelInfo();
    var pill = h('div', 'level-pill'); pill.title = L.rank + ' · ' + L.xp + ' XP · до ур.' + (L.level + 1) + ': ' + L.toNext + ' XP';
    var badge = h('div', 'lp-badge'); badge.textContent = L.glyph;
    pill.appendChild(badge);
    var info = h('div', 'lp-info');
    var top = h('div', 'lp-top');
    top.appendChild(h('span', 'lp-rank', L.rank));
    top.appendChild(h('span', 'lp-lvl', 'ур.' + L.level));
    info.appendChild(top);
    var bar = h('div', 'lp-bar'); var fill = h('div', 'lp-fill'); fill.style.width = L.pct + '%'; bar.appendChild(fill);
    info.appendChild(bar);
    pill.appendChild(info);
    return pill;
  }

  // Записать ответ и тут же обновить XP/серию в шапке (живой отклик).
  function record(lesson, correct, difficulty) {
    CS.recordAnswer(lesson, correct, difficulty);
    renderChrome();
  }

  function profileMenu() {
    var ov = overlay();
    var card = h('div', 'modal');
    card.appendChild(h('h2', null, 'Профиль'));
    var nameRow = h('div', 'frow');
    var nameIn = h('input', 'txt'); nameIn.value = CS.state.name || '';
    nameIn.oninput = function () { CS.setName(nameIn.value); };
    nameRow.appendChild(h('label', null, 'Имя')); nameRow.appendChild(nameIn);
    card.appendChild(nameRow);

    var info = h('p', 'muted', 'Прогресс хранится локально в этом браузере. Экспортируй JSON, чтобы перенести на другой ПК или отдать настройку другу.');
    card.appendChild(info);

    var btns = h('div', 'frow');
    var exp = h('button', 'btn', 'Экспорт профиля');
    exp.onclick = function () {
      var blob = new Blob([CS.exportProfile()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cybersec-profile.json';
      a.click();
    };
    var imp = h('button', 'btn', 'Импорт');
    var file = h('input'); file.type = 'file'; file.accept = '.json'; file.style.display = 'none';
    file.onchange = function () {
      var f = file.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { if (CS.importProfile(r.result)) { close(ov); renderChrome(); route(); } else alert('Не удалось прочитать файл профиля.'); };
      r.readAsText(f);
    };
    imp.onclick = function () { file.click(); };
    btns.appendChild(exp); btns.appendChild(imp);
    card.appendChild(btns);

    // Код переноса: короткий способ сохранить прогресс и открыть его на другом устройстве или после очистки браузера.
    var codeBox = h('div', 'code-box');
    codeBox.appendChild(h('div', 'sheet-h', 'Код переноса прогресса'));
    codeBox.appendChild(h('p', 'muted', 'Скопируй код и сохрани его (например, в «Избранное» Telegram). Если прогресс пропал или ты зашёл с другого устройства — вставь код сюда.'));
    var codeArea = h('textarea', 'code-area'); codeArea.rows = 3; codeArea.placeholder = 'Сюда вставь код и нажми «Загрузить»';
    var codeRow = h('div', 'frow');
    var cpy = h('button', 'btn', 'Скопировать мой код');
    cpy.onclick = function () {
      var code = 'CSP1.' + btoa(unescape(encodeURIComponent(CS.exportProfile())));
      codeArea.value = code; codeArea.select();
      try { navigator.clipboard.writeText(code); cpy.textContent = 'Скопировано ✓'; setTimeout(function () { cpy.textContent = 'Скопировать мой код'; }, 1500); } catch (e) { cpy.textContent = 'Выдели и скопируй вручную'; }
    };
    var ld = h('button', 'btn primary', 'Загрузить код');
    ld.onclick = function () {
      var v = codeArea.value.trim(); if (v.indexOf('CSP1.') !== 0) { alert('Это не код прогресса. Он начинается с CSP1.'); return; }
      try { var json = decodeURIComponent(escape(atob(v.slice(5)))); if (CS.importProfile(json)) { close(ov); renderChrome(); route(); } else alert('Не удалось прочитать код.'); } catch (e) { alert('Код повреждён: скопируй его целиком.'); }
    };
    codeRow.appendChild(cpy); codeRow.appendChild(ld); codeBox.appendChild(codeArea); codeBox.appendChild(codeRow); card.appendChild(codeBox);

    var reset = h('button', 'btn danger', 'Сбросить прогресс');
    reset.onclick = function () { if (confirm('Точно сбросить весь прогресс? Это необратимо.')) { CS.resetProfile(); close(ov); renderChrome(); route(); } };
    card.appendChild(reset);
    card.appendChild(file);

    var cl = h('button', 'btn ghost', 'Закрыть'); cl.onclick = function () { close(ov); };
    card.appendChild(cl);
    ov.appendChild(card);
  }

  function overlay() {
    var ov = h('div', 'overlay');
    ov.onclick = function (e) { if (e.target === ov) close(ov); };
    document.body.appendChild(ov);
    return ov;
  }
  function close(ov) { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }

  // ---------- Главный экран: карта обучения ----------
  function viewHome() {
    renderChrome();
    clear(app);

    // Герой + «продолжить».
    var hero = h('section', 'hero');
    hero.appendChild(h('div', 'hero-kicker', 'CYBER SEC · Learning Engine'));
    hero.appendChild(h('h1', 'hero-h', 'Понять, как всё работает под капотом'));
    hero.appendChild(h('p', 'hero-sub', 'Компьютеры, ОС, сети, код и безопасность — через практику, визуализацию и проверку понимания, а не зубрёжку определений.'));

    var cont = continueCard();
    if (cont) hero.appendChild(cont);

    var cta = h('div', 'hero-cta');
    if (!CS.state.diagnostic) {
      var d = h('a', 'btn primary big'); d.href = '#/diagnostic'; d.textContent = 'Пройти диагностику (2 мин)';
      cta.appendChild(d);
      cta.appendChild(h('span', 'muted', 'Подберём стартовую глубину и отметим, что ты уже знаешь.'));
    } else {
      var t = h('a', 'btn primary big'); t.href = '#/today'; t.textContent = 'План на сегодня →';
      cta.appendChild(t);
      var dueN = CS.dueCards().length;
      cta.appendChild(h('span', 'muted', dueN ? dueN + ' карточек ждут повторения' : 'Повторений нет — можно брать новое'));
    }
    hero.appendChild(cta);
    app.appendChild(hero);

    // Панель прогресса к уровню специалиста (честная оценка).
    app.appendChild(readinessPanel(CS.masteryStats()));

    // Достижения.
    app.appendChild(achievementsStrip());

    // Карта навыков (skill tree): фундамент → ветвление по специализациям.
    if (window.CSUI2 && CSUI2.pathCard) app.appendChild(CSUI2.pathCard());
    if (window.CSUI2) app.appendChild(CSUI2.homeCta());
    app.appendChild(skillMap());

    app.appendChild(footer());
  }

  function continueCard() {
    // Ищем ближайший незаконченный урок среди начатых курсов.
    var best = null;
    CS.allCourses().forEach(function (c) {
      var p = CS.courseProgress(c.id);
      if (p.done > 0 && p.done < p.total && !best) {
        best = { course: c, lesson: CS.nextLesson(c.id) };
      }
    });
    if (!best) return null;
    var card = h('div', 'continue');
    card.appendChild(h('div', 'cont-k', 'Продолжить'));
    card.appendChild(h('div', 'cont-t', best.course.title + ' · ' + best.lesson.title));
    var go = h('a', 'btn primary'); go.href = '#/lesson/' + best.course.id + '/' + best.lesson.id; go.textContent = 'Дальше →';
    card.appendChild(go);
    return card;
  }

  // ---------- Достижения ----------
  function achievementsStrip() {
    var list = CS.achievements();
    var got = list.filter(function (a) { return a.unlocked; }).length;
    var sec = h('section', 'achv');
    var head = h('div', 'achv-head');
    head.appendChild(h('span', 'achv-title', 'Достижения'));
    head.appendChild(h('span', 'achv-count', got + ' / ' + list.length));
    sec.appendChild(head);
    var row = h('div', 'achv-row');
    list.forEach(function (a) {
      var b = h('div', 'achv-badge' + (a.unlocked ? ' on' : ''));
      b.title = a.name + ' — ' + a.desc;
      b.appendChild(h('div', 'achv-ic', a.icon));
      b.appendChild(h('div', 'achv-name', a.name));
      row.appendChild(b);
    });
    sec.appendChild(row);
    return sec;
  }

  // ---------- Карта навыков (skill tree) ----------
  var TIER_NAMES = ['Фундамент', 'Ядро специализаций', 'Прикладные направления', 'Наступательная безопасность'];
  function skillMap() {
    var wrap = h('section', 'skillmap');
    var head = h('div', 'sm-head');
    head.appendChild(h('h2', 'sm-title', 'Карта навыков'));
    head.appendChild(h('p', 'sm-sub', 'Сначала общий фундамент — он нужен для всего. Потом ветвление: открываешь специализацию, когда готов её пререквизит. Красные ветки Red Team и пентеста — самые глубокие, строго в лаборатории.'));
    wrap.appendChild(head);

    var road = h('div', 'roadmap');
    // Группируем треки по ярусам.
    var byTier = {};
    CS.allTracks().forEach(function (t) {
      var tier = CS.trackMeta(t).tier;
      (byTier[tier] = byTier[tier] || []).push(t);
    });
    Object.keys(byTier).sort(function (a, b) { return a - b; }).forEach(function (tier, ti) {
      if (ti > 0) road.appendChild(h('div', 'tier-link'));
      var band = h('div', 'tier');
      band.appendChild(h('div', 'tier-label', TIER_NAMES[tier] || ('Ярус ' + tier)));
      var row = h('div', 'tier-row');
      byTier[tier].forEach(function (t) { row.appendChild(trackNode(t)); });
      band.appendChild(row);
      road.appendChild(band);
    });
    wrap.appendChild(road);
    return wrap;
  }

  function trackNode(t) {
    var meta = CS.trackMeta(t);
    var cat = CS.catalogStats(t);         // {total, ready, planned}
    var unlocked = CS.trackUnlocked(t);
    var p = CS.trackProgress(t);
    var hasReady = cat.ready > 0;

    // Состояние узла для стиля/иконки.
    var state;
    if (!unlocked) state = 'locked';
    else if (!hasReady) state = 'soon';
    else if (p.pct === 100) state = 'done';
    else if (p.pct > 0) state = 'active';
    else state = 'open';

    var cls = 'tnode ' + state + ' tier' + meta.tier + ' trk-' + t;
    // Кликабельно всегда, когда есть что показать: даже «запертый» трек можно открыть и
    // посмотреть программу (замок — это совет «сначала фундамент», а не запрет).
    var node;
    if (cat.total > 0) {
      node = h('a', cls); node.href = '#/track/' + t;
    } else {
      node = h('div', cls);
    }

    var ring = h('div', 'tnode-ring');
    ring.appendChild(h('span', 'tnode-glyph', state === 'locked' ? '🔒' : meta.glyph));
    if (p.pct > 0) ring.style.background = 'conic-gradient(var(--accent) ' + (p.pct * 3.6) + 'deg, var(--bg-3) 0)';
    node.appendChild(ring);

    node.appendChild(h('div', 'tnode-name', meta.name));
    node.appendChild(h('div', 'tnode-blurb', meta.blurb || ''));

    var chip = h('div', 'tnode-chip');
    if (state === 'locked') chip.textContent = 'нужно: ' + (meta.needs || []).map(function (n) { return CS.trackMeta(n).name; }).join(' + ');
    else if (state === 'done') chip.textContent = '✓ пройдено';
    else if (state === 'active') chip.textContent = p.pct + '% · идёт';
    else if (hasReady) chip.textContent = cat.ready + ' из ' + cat.total + ' готово';
    else chip.textContent = 'план: ' + cat.total + ' тем';
    node.appendChild(chip);
    return node;
  }

  function courseCard(c) {
    var p = CS.courseProgress(c.id);
    var card = h('a', 'ccard'); card.href = '#/course/' + c.id;
    var top = h('div', 'ccard-top');
    top.appendChild(h('span', 'ccard-glyph', c.glyph || '▣'));
    if (p.pct > 0) top.appendChild(h('span', 'ccard-pct', p.pct + '%'));
    card.appendChild(top);
    card.appendChild(h('h3', 'ccard-title', c.title));
    card.appendChild(h('p', 'ccard-tag', c.tagline || ''));
    var bar = h('div', 'bar'); var fill = h('div', 'bar-fill'); fill.style.width = p.pct + '%'; bar.appendChild(fill);
    card.appendChild(bar);
    var meta = h('div', 'ccard-meta');
    meta.appendChild(h('span', null, c.lessons.length + ' уроков'));
    meta.appendChild(h('span', null, masteryLabel(p.mastery)));
    card.appendChild(meta);
    return card;
  }
  function masteryLabel(m) {
    if (m >= 0.8) return 'освоено';
    if (m >= 0.5) return 'уверенно';
    if (m > 0) return 'знакомо';
    return 'новое';
  }

  // ---------- Экран трека: вся программа направления (готовое + план) ----------
  function viewTrack(t) {
    renderChrome();
    clear(app);
    var meta = CS.trackMeta(t);
    var cat = CS.trackCatalog(t);
    app.appendChild(crumbs([['Карта', '#/'], [meta.name, null]]));
    var head = h('section', 'course-hero');
    head.appendChild(h('span', 'course-hero-glyph', meta.glyph));
    head.appendChild(h('h1', null, meta.name));
    head.appendChild(h('p', 'lead', meta.blurb || ''));
    if ((meta.needs || []).length) {
      var np = h('div', 'course-meta');
      np.appendChild(h('span', 'pill', 'сначала: ' + meta.needs.map(function (n) { return CS.trackMeta(n).name; }).join(' + ')));
      head.appendChild(np);
    }
    app.appendChild(head);
    if (!cat.length) { app.appendChild(notFound('В этом направлении пока нет программы')); return; }

    // Рекомендация (не блок): если пререквизит-трек ещё не начат.
    if (!CS.trackUnlocked(t)) {
      var rec = h('div', 'advisory');
      rec.appendChild(h('span', 'adv-ic', '💡'));
      rec.appendChild(h('span', null, 'Рекомендуем сначала пройти: ' + (meta.needs || []).map(function (n) { return CS.trackMeta(n).name; }).join(' + ') + '. Но выбираешь ты — программу можно смотреть и начинать в любом порядке.'));
      app.appendChild(rec);
    }

    // Программа как последовательность этапов: готовые играбельны, план — «скоро».
    var steps = h('div', 'curriculum');
    cat.forEach(function (item, i) {
      var ready = item.ready;
      var row = ready ? h('a', 'cur-step ready') : h('div', 'cur-step soon');
      if (ready) row.href = item.href || ('#/course/' + item.id);
      var num = h('div', 'cur-num', ready ? String(i + 1) : '•');
      if (ready) {
        var cp = item.href ? (CS.itemProgress(item) || { pct: 0 }) : CS.courseProgress(item.id);
        if (cp.pct === 100) { num.textContent = '✓'; num.classList.add('done'); }
        else if (cp.pct > 0) num.classList.add('active');
      }
      row.appendChild(num);
      var body = h('div', 'cur-body');
      body.appendChild(h('div', 'cur-title', item.title));
      body.appendChild(h('div', 'cur-goal', item.goal || ''));
      row.appendChild(body);
      var tag = h('div', 'cur-tag', ready ? 'играть' : 'скоро');
      tag.classList.add(ready ? 'rdy' : 'sn');
      row.appendChild(tag);
      steps.appendChild(row);
    });
    app.appendChild(steps);

    var note = h('p', 'muted cur-note', 'Готовые темы можно проходить уже сейчас. Остальные в плане — добавляю по одной полноценной теме за раз, без пустышек. Порядок — рекомендованный, но выбираешь ты.');
    app.appendChild(note);
    app.appendChild(footer());
  }

  // ---------- Экран курса ----------
  function viewCourse(id) {
    renderChrome();
    var c = CS.getCourse(id);
    clear(app);
    if (!c) { app.appendChild(notFound('Курс не найден')); return; }

    app.appendChild(crumbs([['Карта', '#/'], [c.title, null]]));

    var head = h('section', 'course-hero');
    head.appendChild(h('span', 'course-hero-glyph', c.glyph || '▣'));
    head.appendChild(h('h1', null, c.title));
    head.appendChild(h('p', 'lead', c.about || c.tagline || ''));
    var p = CS.courseProgress(c.id);
    var pm = h('div', 'course-meta');
    pm.appendChild(h('span', 'pill', p.done + '/' + p.total + ' уроков'));
    pm.appendChild(h('span', 'pill', 'мастерство: ' + Math.round(p.mastery * 100) + '%'));
    head.appendChild(pm);

    if (c.assess && c.assess.length && !CS.topicState(c.id).placed) {
      var cta = h('button', 'btn primary', 'Быстрая проверка знаний курса');
      cta.onclick = function () { runDiagnostic(c.assess, function (res) { CS.placeTopic(c.id, res.theta); route(); }, c.title); };
      head.appendChild(cta);
    }
    app.appendChild(head);

    var list = h('section', 'lesson-list');
    c.lessons.forEach(function (l, i) {
      var ls = CS.lessonState(l.id);
      var locked = CS.lessonLocked(l);
      var row = locked ? h('div', 'lrow locked') : h('a', 'lrow');
      if (!locked) row.href = '#/lesson/' + c.id + '/' + l.id;
      var ic = h('div', 'lrow-ic', ls.done ? '✓' : (locked ? '🔒' : (l.boss ? '★' : String(i + 1))));
      if (ls.done) ic.classList.add('done');
      if (l.boss) ic.classList.add('boss');
      row.appendChild(ic);
      var body = h('div', 'lrow-body');
      body.appendChild(h('div', 'lrow-title', l.title + (l.boss ? '  · босс курса' : '')));
      body.appendChild(h('div', 'lrow-sub', l.subtitle || ''));
      row.appendChild(body);
      var meta = h('div', 'lrow-meta');
      meta.appendChild(h('span', null, (l.minutes || 10) + ' мин'));
      if (ls.done) meta.appendChild(h('span', 'mini', masteryLabel(ls.mastery)));
      row.appendChild(meta);
      list.appendChild(row);
    });
    app.appendChild(list);

    app.appendChild(footer());
  }

  // ---------- Плеер урока ----------
  function viewLesson(courseId, lessonId) {
    renderChrome();
    var lesson = CS.getLesson(courseId, lessonId);
    clear(app);
    if (!lesson) { app.appendChild(notFound('Урок не найден')); return; }

    // Фильтр шагов по режиму глубины.
    var mode = CS.state.mode;
    var steps = lesson.steps.filter(function (s) {
      if (s.t === 'deep') return mode === 'core' || mode === 'deep';
      if (s.t === 'expert') return mode === 'deep';
      return true;
    });
    steps.unshift({ t: 'sheet' });

    var wasDone = !!CS.lessonState(lesson.id).done;
    var wrap = h('div', 'player scroll');
    var topbar = h('div', 'player-top');
    var crumb = h('a', 'back', '← ' + lesson.title); crumb.href = '#/course/' + courseId;
    var prog = h('div', 'player-bar'); var pf = h('div', 'player-bar-fill'); prog.appendChild(pf);
    topbar.appendChild(crumb);
    topbar.appendChild(prog);
    wrap.appendChild(topbar);
    var stage = h('div', 'stage onepage');
    wrap.appendChild(stage);
    app.appendChild(wrap);

    function isGate(s) { return s.t === 'quiz' || s.t === 'input' || s.t === 'match' || s.t === 'check' || s.t === 'recall'; }
    var gates = steps.filter(isGate).length, resolvedGates = 0, shown = 0, busy = false, finished = false;
    // Сохранение места: если закрыл урок посередине, вернёшься туда же (уже отвеченные вопросы открыты).
    var spot = (CS.state.spots && CS.state.spots[lesson.id]) || 0, keep = wasDone ? steps.length : spot;
    if (window.CSGloss) CSGloss.reset(lesson.id);
    function saveSpot(n) { if (wasDone) return; CS.state.spots = CS.state.spots || {}; CS.state.spots[lesson.id] = n; CS.save(); }
    function setProgress() { pf.style.width = (finished ? 100 : (gates ? Math.round(resolvedGates / gates * 100) : 0)) + '%'; }

    // Вся теория и вопросы — на одной странице. Следующий блок открывается, когда решён вопрос выше.
    function reveal(fromAnswer) {
      if (busy || finished) return;
      busy = true;
      var firstNew = null, lastOk = true;
      while (shown < steps.length) {
        var st = steps[shown], holder = h('section', 'block block-' + st.t), state = { ok: !isGate(st) || shown < keep };
        if (isGate(st) && state.ok) resolvedGates++;
        stage.appendChild(holder);
        if (!firstNew) firstNew = holder;
        (function (state) {
          holder.appendChild(renderStep(st, lesson, function onResolved() {
            if (!state.ok) { state.ok = true; resolvedGates++; setProgress(); saveSpot(shown); if (!busy) setTimeout(function () { reveal(true); }, 350); }
          }));
          if (window.CSGloss) { try { CSGloss.decorate(holder, lesson.id); } catch (e) {} }
        })(state);
        shown++; lastOk = state.ok;
        if (!state.ok) break;
      }
      busy = false;
      if (shown >= steps.length && lastOk) finish();
      if (fromAnswer && firstNew) {
        var r = firstNew.getBoundingClientRect();
        if (r.top > window.innerHeight - 240) window.scrollBy({ top: r.top - (window.innerHeight - 280), behavior: 'smooth' });
      }
    }

    function finish() {
      if (finished) return; finished = true; setProgress();
      CS.completeLesson(lesson);
      var done = h('section', 'block lesson-done');
      done.appendChild(h('div', 'done-mark', '✓'));
      done.appendChild(h('h2', null, 'Урок пройден'));
      var ls = CS.lessonState(lesson.id);
      done.appendChild(h('p', 'muted', 'Мастерство темы: ' + Math.round(ls.mastery * 100) + '%. ' + (lesson.cards.length ? lesson.cards.length + ' карточек добавлено в повторение.' : '')));
      if (lesson.cards && lesson.cards.length) {
        done.appendChild(h('div', 'sheet-h', 'Главное из урока — запомни'));
        var tb = h('div', 'sheet-table');
        lesson.cards.forEach(function (c, i) { var r = h('div', 'sheet-row'); r.appendChild(h('span', 'sheet-n', String(i + 1))); r.appendChild(h('span', 'sheet-q', c[0])); r.appendChild(h('span', 'sheet-a', c[1])); tb.appendChild(r); });
        done.appendChild(tb);
      }
      if (lesson.sources && lesson.sources.length) {
        var src = h('div', 'sources');
        src.appendChild(h('div', 'src-h', 'Источники'));
        lesson.sources.forEach(function (s2) { var a2 = h('a', 'src-link', s2.label); a2.href = s2.url; a2.target = '_blank'; a2.rel = 'noopener'; src.appendChild(a2); });
        done.appendChild(src);
      }
      var row = h('div', 'frow');
      var c = CS.getCourse(courseId), nextL = null;
      for (var i = lesson.idx + 1; i < c.lessons.length; i++) { if (!CS.lessonLocked(c.lessons[i])) { nextL = c.lessons[i]; break; } }
      if (nextL) { var nb = h('a', 'btn primary', 'Следующий урок →'); nb.href = '#/lesson/' + courseId + '/' + nextL.id; row.appendChild(nb); }
      var cb = h('a', 'btn ghost', 'К курсу'); cb.href = '#/course/' + courseId; row.appendChild(cb);
      if (CS.dueCards().length) { var rv = h('a', 'btn', 'Повторить карточки'); rv.href = '#/review'; row.appendChild(rv); }
      done.appendChild(row);
      stage.appendChild(done);
      renderChrome();
      setTimeout(function () { var r2 = done.getBoundingClientRect(); if (r2.top > window.innerHeight - 260) window.scrollBy({ top: r2.top - 120, behavior: 'smooth' }); }, 120);
    }

    reveal(false);
  }

  // ---------- Карточка урока: наглядная «табличка» перед началом ----------
  var STEP_KIND = { hook: ['Ситуация', 'k-hook'], say: ['Объяснение', 'k-say'], viz: ['Интерактив', 'k-viz'], quiz: ['Вопрос', 'k-q'], check: ['Проверка', 'k-q'], input: ['Ввод', 'k-q'], match: ['Сопоставь', 'k-q'], recall: ['Вспомни', 'k-q'], real: ['Практика', 'k-real'], lab: ['Лаборатория', 'k-real'], deep: ['Под капотом', 'k-deep'], expert: ['Эксперт', 'k-deep'], 'case': ['Случай', 'k-hook'] };
  function renderSheet(box, lesson) {
    box.classList.add('sheet');
    box.appendChild(h('div', 'step-kick', 'Карточка урока'));
    box.appendChild(h('h2', 'step-h', lesson.title));
    if (lesson.subtitle) box.appendChild(h('p', 'sheet-sub', lesson.subtitle));
    var st = lesson.steps || [];
    function n(types) { return st.filter(function (x) { return types.indexOf(x.t) > -1; }).length; }
    var tiles = h('div', 'sheet-tiles');
    [['⏱', '≈ ' + Math.max(10, Math.round((lesson.minutes || 10) * 1.8 / 5) * 5) + ' мин', 'время (спокойно)'], ['▦', st.length, 'шагов'], ['✎', n(['quiz', 'input', 'match', 'check', 'recall']), 'вопросов'], ['⌨', n(['real', 'lab']) + st.filter(function (x) { return x.t === 'viz' && x.kind === 'code'; }).length, 'практики'], ['◇', n(['viz']), 'интерактивов']].forEach(function (t) {
      var d = h('div', 'sheet-tile'); d.appendChild(h('span', 'sheet-ic', t[0])); d.appendChild(h('b', null, String(t[1]))); d.appendChild(h('span', 'sheet-k', t[2])); tiles.appendChild(d);
    });
    box.appendChild(tiles);
    // После урока ты сможешь…
    if (lesson.cards && lesson.cards.length) {
      var goal = h('div', 'sheet-goal'); goal.appendChild(h('div', 'sheet-h', 'После урока ты сможешь объяснить'));
      var gl = h('ul'); lesson.cards.slice(0, 3).forEach(function (c) { gl.appendChild(h('li', null, c[0].replace(/\?$/, ''))); }); goal.appendChild(gl);
      var CAREER = { base: 'База для любой IT-профессии: админ, программист, аналитик, безопасник.', net: 'Сетевой инженер, SOC-аналитик и пентестер читают такие данные каждый день.', security: 'С этого начинают специалисты по защите: аналитик SOC, пентестер, инженер ИБ.', sysadmin: 'Системный администратор и DevOps работают в терминале каждый день.', programming: 'Умение писать код нужно разработчику, аналитику данных и безопаснику.', osint: 'Аналитик угроз, журналист-расследователь и специалист по фишингу используют эти приёмы.', forensics: 'Расследователь инцидентов (DFIR) собирает такие следы после взлома.', webdev: 'Веб-разработчик делает сайты и приложения, которыми пользуются миллионы.', crypto: 'Криптограф и разработчик защищённых систем.' };
      var cr = CAREER[(CS.getCourse(lesson.courseId) || {}).track]; if (cr) goal.appendChild(h('p', 'sheet-career', 'Где пригодится: ' + cr));
      box.appendChild(goal);
    }
    // Лента: из каких частей состоит урок
    var strip = h('div', 'sheet-strip');
    st.forEach(function (x) { var k = STEP_KIND[x.t]; if (!k) return; var i = h('i', 'sd ' + k[1]); i.title = k[0] + (x.title ? ': ' + x.title : ''); strip.appendChild(i); });
    box.appendChild(h('div', 'sheet-h', 'Из чего состоит урок'));
    box.appendChild(strip);
    var lg = h('div', 'sheet-legend');
    [['Ситуация / случай', 'k-hook'], ['Объяснение', 'k-say'], ['Интерактив', 'k-viz'], ['Вопросы', 'k-q'], ['Практика', 'k-real'], ['Глубже', 'k-deep']].forEach(function (l) { var s2 = h('span'); s2.appendChild(h('i', 'sd ' + l[1])); s2.appendChild(document.createTextNode(l[0])); lg.appendChild(s2); });
    box.appendChild(lg);
    // Ключевые понятия урока (из карточек повторения)
    if (lesson.cards && lesson.cards.length) {
      box.appendChild(h('div', 'sheet-h', 'Ключевые понятия'));
      var tb = h('div', 'sheet-table');
      lesson.cards.forEach(function (c, i) { var r = h('div', 'sheet-row'); r.appendChild(h('span', 'sheet-n', String(i + 1))); r.appendChild(h('span', 'sheet-q', c[0])); r.appendChild(h('span', 'sheet-a', c[1])); tb.appendChild(r); });
      box.appendChild(tb);
      box.appendChild(h('p', 'muted sheet-note', 'Эти понятия ты разберёшь по ходу урока — в конце они попадут в карточки для повторения.'));
    }
  }

  // ---------- Рендер одного шага ----------
  function renderStep(s, lesson, onResolved) {
    var box = h('div', 'step step-' + s.t);
    switch (s.t) {
      case 'hook': {
        box.classList.add('hook');
        box.appendChild(h('div', 'step-kick', 'Ситуация'));
        if (s.title) box.appendChild(h('h2', 'step-h', s.title));
        para(box, s.text);
        onResolved();
        break;
      }
      case 'viz': {
        if (s.title) box.appendChild(h('h2', 'step-h', s.title));
        if (s.text) para(box, s.text);
        var vbox = h('div', 'vizbox');
        var fn = CS.getViz(s.kind);
        if (fn) { try { fn(vbox, s); } catch (e) { vbox.appendChild(h('p', 'muted', 'Виджет не загрузился.')); console.error(e); } }
        else vbox.appendChild(h('p', 'muted', 'Визуализация «' + s.kind + '» ещё не реализована.'));
        box.appendChild(vbox);
        onResolved();
        break;
      }
      case 'say': {
        if (s.title) box.appendChild(h('h2', 'step-h', s.title));
        if (s.simple) {
          var simp = h('div', 'say-simple');
          simp.appendChild(h('span', 'say-tag', 'по-простому'));
          var sp = h('p'); sp.innerHTML = mdInline(s.simple); simp.appendChild(sp);
          box.appendChild(simp);
        }
        var det = h('div', 'say-detail'); para(det, s.text); box.appendChild(det);
        onResolved();
        break;
      }
      case 'deep': case 'expert': {
        box.classList.add('under', 'collapsible');
        var tg = h('button', 'under-toggle');
        tg.appendChild(h('span', 'step-kick', s.t === 'deep' ? 'Для любопытных · под капотом · 2 мин' : 'Эксперт · по желанию'));
        tg.appendChild(h('b', null, s.title || 'Подробнее'));
        tg.appendChild(h('i', null, '＋'));
        var ub = h('div', 'under-body'); para(ub, s.text); ub.style.display = 'none';
        tg.onclick = function () { var open = ub.style.display === 'none'; ub.style.display = open ? '' : 'none'; tg.querySelector('i').textContent = open ? '−' : '＋'; box.classList.toggle('open', open); };
        box.appendChild(tg); box.appendChild(ub);
        onResolved();
        break;
      }
      case 'case': {
        box.classList.add('case');
        box.appendChild(h('div', 'step-kick', 'Реальный случай'));
        if (s.title) box.appendChild(h('h2', 'step-h', s.title));
        para(box, s.text);
        onResolved();
        break;
      }
      case 'real': {
        box.classList.add('real-opt');
        var rtg = h('button', 'real-toggle');
        rtg.appendChild(h('span', 'step-kick', 'На твоём компьютере · по желанию'));
        rtg.appendChild(h('b', null, s.title || 'Попробуй сам'));
        rtg.appendChild(h('i', null, '＋'));
        rtg.onclick = function () { var o = box.classList.toggle('open'); rtg.querySelector('i').textContent = o ? '−' : '＋'; };
        box.appendChild(rtg);
        var osLabel = { win: 'Windows / PowerShell', lin: 'Linux / терминал', any: 'любая ОС' }[s.os || 'any'];
        box.appendChild(h('div', 'real-os', osLabel + ' · команды безопасны, просто читают информацию'));
        var how = h('details', 'real-how');
        how.appendChild(h('summary', null, 'Как открыть терминал и вставить команду (если ни разу не делал)'));
        var hp = h('div', 'real-how-body');
        hp.innerHTML = (s.os === 'win' || !s.os ? '<p><b>Windows:</b> нажми клавишу Win, набери <code>PowerShell</code>, нажми Enter — откроется чёрное или синее окно.</p><p>Скопируй команду кнопкой «копировать», в окне нажми <b>правую кнопку мыши</b> (вставится сама) и Enter.</p>' : '<p>Открой терминал: на Linux — Ctrl+Alt+T; на Mac — Spotlight → Terminal.</p>') + '<p><b>Бояться нечего:</b> эти команды только <b>показывают</b> информацию. Красный текст — это просто сообщение об ошибке, ничего не сломалось. Закрыть окно можно крестиком.</p>';
        how.appendChild(hp); box.appendChild(how);
        (s.steps || []).forEach(function (st) {
          var card = h('div', 'cmd');
          var top = h('div', 'cmd-top');
          var code = h('code', 'cmd-code', st.cmd);
          var copy = h('button', 'cmd-copy', 'копировать');
          copy.onclick = function () {
            try { navigator.clipboard.writeText(st.cmd); copy.textContent = 'скопировано'; setTimeout(function () { copy.textContent = 'копировать'; }, 1200); }
            catch (e) { copy.textContent = '—'; }
          };
          top.appendChild(code); top.appendChild(copy);
          card.appendChild(top);
          if (st.text) { var d = h('div', 'cmd-desc'); d.innerHTML = mdInline(st.text); card.appendChild(d); }
          box.appendChild(card);
        });
        onResolved();
        break;
      }
      case 'lab': { if (window.CSVMUI) CSVMUI.renderLab(box, s, onResolved); else onResolved(); break; }
      case 'sheet': { renderSheet(box, lesson); onResolved(); break; }
      case 'quiz': case 'check': { renderQuiz(box, s, lesson, onResolved); break; }
      case 'input': { renderInputStep(box, s, lesson, onResolved); break; }
      case 'match': { renderMatch(box, s, lesson, onResolved); break; }
      case 'recall': { renderRecall(box, s, lesson, onResolved); break; }
      default: {
        if (s.title) box.appendChild(h('h2', 'step-h', s.title));
        if (s.text) para(box, s.text);
        onResolved();
      }
    }
    return box;
  }

  // Выбор одного варианта.
  function renderQuiz(box, s, lesson, onResolved) {
    box.appendChild(h('div', 'step-kick', 'Проверь себя'));
    box.appendChild(h('h2', 'step-q', s.q));
    if (s.ctx) { var c = h('p', 'step-ctx'); c.innerHTML = mdInline(s.ctx); box.appendChild(c); }
    var opts = h('div', 'opts');
    var wrong = 0, resolved = false;
    var fb = h('div', 'feedback');
    s.options.forEach(function (opt, i) {
      var b = h('button', 'opt'); b.innerHTML = mdInline(opt);
      b.onclick = function () {
        if (resolved) return;
        if (i === s.correct) {
          b.classList.add('correct'); resolved = true; lock();
          record(lesson, true, s.b || 0);
          showWhy(true);
        } else {
          b.classList.add('wrong'); b.disabled = true; wrong++;
          record(lesson, false, s.b || 0);
          if (wrong >= 2) { reveal(); }
          else { flash('Не то. Попробуй ещё раз — осталась 1 попытка.'); }
        }
      };
      opts.appendChild(b);
    });
    function lock() { Array.prototype.forEach.call(opts.children, function (b) { b.disabled = true; }); }
    function reveal() {
      resolved = true; lock();
      Array.prototype.forEach.call(opts.children, function (b, i) { if (i === s.correct) b.classList.add('correct'); });
      showWhy(false);
    }
    function showWhy(ok) {
      clear(fb);
      fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
      fb.appendChild(h('div', 'fb-head', ok ? 'Верно' : 'Правильный ответ показан'));
      var w = h('p'); w.innerHTML = mdInline(s.why || ''); fb.appendChild(w);
      onResolved();
    }
    function flash(msg) { clear(fb); fb.className = 'feedback warn'; fb.appendChild(h('p', null, msg)); }
    box.appendChild(opts);
    box.appendChild(fb);
  }

  // Свободный ввод.
  function renderInputStep(box, s, lesson, onResolved) {
    box.appendChild(h('div', 'step-kick', 'Ответь сам'));
    box.appendChild(h('h2', 'step-q', s.q));
    if (s.ctx) { var c = h('p', 'step-ctx'); c.innerHTML = mdInline(s.ctx); box.appendChild(c); }
    var row = h('div', 'input-row');
    var inp = h('input', 'txt mono'); inp.placeholder = 'твой ответ'; inp.spellcheck = false;
    var btn = h('button', 'btn', 'Проверить');
    row.appendChild(inp); row.appendChild(btn);
    box.appendChild(row);
    var fb = h('div', 'feedback');
    box.appendChild(fb);
    var wrong = 0, resolved = false;
    if (s.hint) {
      var hintBtn = h('button', 'link-btn', 'подсказка');
      hintBtn.onclick = function () { clear(fb); fb.className = 'feedback warn'; fb.appendChild(h('p', null, s.hint)); };
      box.appendChild(hintBtn);
    }
    function submit() {
      if (resolved) return;
      var ok = CS.logic.checkInput(inp.value, s.answers);
      if (ok) {
        resolved = true; inp.disabled = true; btn.disabled = true; inp.classList.add('ok');
        record(lesson, true, s.b || 0);
        clear(fb); fb.className = 'feedback ok'; fb.appendChild(h('div', 'fb-head', 'Верно'));
        var w = h('p'); w.innerHTML = mdInline(s.why || ''); fb.appendChild(w);
        onResolved();
      } else {
        wrong++; inp.classList.add('bad');
        record(lesson, false, s.b || 0);
        if (wrong >= 2) {
          resolved = true; inp.disabled = true; btn.disabled = true;
          clear(fb); fb.className = 'feedback bad';
          fb.appendChild(h('div', 'fb-head', 'Правильный ответ: ' + (s.answers[0] || '')));
          var w2 = h('p'); w2.innerHTML = mdInline(s.why || ''); fb.appendChild(w2);
          onResolved();
        } else { clear(fb); fb.className = 'feedback warn'; fb.appendChild(h('p', null, 'Пока не то. Ещё одна попытка.')); }
      }
    }
    btn.onclick = submit;
    inp.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
  }

  // Сопоставление пар (через выпадающие списки — надёжно и доступно).
  function renderMatch(box, s, lesson, onResolved) {
    box.appendChild(h('div', 'step-kick', 'Сопоставь'));
    box.appendChild(h('h2', 'step-q', s.q));
    var lefts = s.pairs.map(function (p) { return p[0]; });
    var rights = s.pairs.map(function (p) { return p[1]; });
    var shuffled = rights.slice().sort(function () { return Math.random() - 0.5; });
    var selects = [];
    var grid = h('div', 'match-grid');
    lefts.forEach(function (lft, i) {
      var r = h('div', 'match-row');
      var code = h('code', 'match-left'); code.textContent = lft;
      var sel = h('select', 'match-sel');
      sel.appendChild(h('option', null, '— выбери —'));
      shuffled.forEach(function (opt) { var o = h('option', null, opt); o.value = opt; sel.appendChild(o); });
      selects.push(sel);
      r.appendChild(code); r.appendChild(sel);
      grid.appendChild(r);
    });
    box.appendChild(grid);
    var btn = h('button', 'btn', 'Проверить');
    var fb = h('div', 'feedback');
    var wrong = 0, resolved = false;
    btn.onclick = function () {
      if (resolved) return;
      var allRight = true;
      selects.forEach(function (sel, i) {
        var ok = sel.value === rights[i];
        sel.parentNode.classList.remove('ok', 'bad');
        sel.parentNode.classList.add(ok ? 'ok' : 'bad');
        if (!ok) allRight = false;
      });
      if (allRight) {
        resolved = true; btn.disabled = true;
        record(lesson, true, s.b || 0);
        clear(fb); fb.className = 'feedback ok'; fb.appendChild(h('div', 'fb-head', 'Всё верно'));
        var w = h('p'); w.innerHTML = mdInline(s.why || ''); fb.appendChild(w);
        onResolved();
      } else {
        wrong++;
        record(lesson, false, s.b || 0);
        if (wrong >= 2) {
          resolved = true; btn.disabled = true;
          selects.forEach(function (sel, i) { sel.value = rights[i]; sel.parentNode.classList.remove('bad'); sel.parentNode.classList.add('ok'); });
          clear(fb); fb.className = 'feedback bad'; fb.appendChild(h('div', 'fb-head', 'Правильные пары показаны'));
          var w2 = h('p'); w2.innerHTML = mdInline(s.why || ''); fb.appendChild(w2);
          onResolved();
        } else { clear(fb); fb.className = 'feedback warn'; fb.appendChild(h('p', null, 'Часть пар неверна. Поправь и проверь снова.')); }
      }
    };
    box.appendChild(btn);
    box.appendChild(fb);
  }

  // Свободный вызов из памяти (free recall): сам сгенерируй ответ, потом сверь с эталоном.
  // Генерация ответа до подсказки — один из самых сильных приёмов запоминания.
  function renderRecall(box, s, lesson, onResolved) {
    box.appendChild(h('div', 'step-kick', 'Вспомни сам'));
    box.appendChild(h('h2', 'step-q', s.q));
    if (s.ctx) { var cx = h('p', 'step-ctx'); cx.innerHTML = mdInline(s.ctx); box.appendChild(cx); }
    var ta = h('textarea', 'recall-ta'); ta.placeholder = 'Напиши по памяти всё, что вспомнишь — своими словами. Не подсматривай.';
    ta.rows = 4;
    box.appendChild(ta);
    var showBtn = h('button', 'btn', 'Показать эталон');
    box.appendChild(showBtn);
    var model = h('div', 'recall-model');
    box.appendChild(model);
    showBtn.onclick = function () {
      showBtn.style.display = 'none';
      ta.disabled = true;
      model.appendChild(h('div', 'recall-m-h', 'Эталон — сверь, что упустил:'));
      var m = h('p'); m.innerHTML = mdInline(s.model || ''); model.appendChild(m);
      var self = h('div', 'recall-self');
      self.appendChild(h('div', 'recall-self-q', 'Честно: насколько совпало?'));
      var row = h('div', 'grades');
      [['Почти ничего', false, 0], ['Частично', false, 1], ['Почти всё', true, 2], ['Всё точно', true, 3]].forEach(function (g) {
        var b = h('button', 'grade');
        b.textContent = g[0];
        b.onclick = function () {
          record(lesson, g[1], s.b || 0);
          clear(self);
          self.className = 'recall-self done';
          self.appendChild(h('p', 'muted', g[1] ? 'Отлично. То, что вспомнил сам, держится в памяти в разы дольше прочитанного.' : 'Нормально — именно попытка вспомнить (даже неудачная) готовит память. Эта карточка вернётся на повторении.'));
          onResolved();
        };
        row.appendChild(b);
      });
      self.appendChild(row);
      model.appendChild(self);
    };
  }

  // ---------- Повторение (сессия с доучиванием по критерию + калибровка) ----------
  function viewReview() {
    renderChrome();
    clear(app);
    app.appendChild(crumbs([['Карта', '#/'], ['Повторение', null]]));
    var due = CS.dueCards();
    if (!due.length) {
      var empty = h('div', 'card center');
      empty.appendChild(h('div', 'big-emoji', '✓'));
      empty.appendChild(h('h2', null, 'Нет карточек к повторению'));
      empty.appendChild(h('p', 'muted', 'Возвращайся позже — карточки всплывут по расписанию интервального повторения, или пройди ещё урок. Повторять «наперёд» вредно: вспоминать на грани забывания закрепляет сильнее.'));
      var b = h('a', 'btn primary', 'К карте'); b.href = '#/'; empty.appendChild(b);
      app.appendChild(empty);
      return;
    }
    var box = h('div', 'review');
    app.appendChild(box);
    runCardSession(due, box, function () {
      clear(box);
      box.appendChild(h('div', 'big-emoji', '🎯'));
      box.appendChild(h('h2', null, 'Сессия повторения завершена'));
      var cal = CS.calibration();
      box.appendChild(h('p', 'muted', 'Всё доведено до уверенного вспоминания. Калибровка уверенности: ' + cal.label + (cal.mean != null ? ' (Brier ' + cal.mean.toFixed(2) + ')' : '') + '.'));
      var row = h('div', 'frow');
      var b1 = h('a', 'btn primary', 'К карте'); b1.href = '#/'; row.appendChild(b1);
      var b2 = h('a', 'btn ghost', 'Сегодня'); b2.href = '#/today'; row.appendChild(b2);
      box.appendChild(row);
      renderChrome();
    });
  }

  // Сессия карточек с «successive relearning»: пока карточку не вспомнил уверенно (good/easy),
  // она возвращается в конец очереди этой же сессии. Перед ответом — прогноз уверенности (калибровка).
  function runCardSession(cards, box, onEnd) {
    var queue = cards.slice();
    var initial = queue.length;
    var cleared = 0, requeues = 0, maxRequeues = initial * 4 + 10;

    function render() {
      clear(box);
      if (!queue.length) { onEnd(); return; }
      var c = queue[0];
      box.appendChild(h('div', 'rev-count', 'Освоено ' + cleared + ' / ' + initial + (queue.length > 1 ? ' · в очереди ' + queue.length : '')));
      var cc = CS.getCourse(c.courseId);
      box.appendChild(h('div', 'rev-course', cc ? cc.title : ''));
      box.appendChild(h('div', 'rev-front', c.front));

      // Шаг 1: прогноз уверенности (метапознание) ДО показа ответа.
      var confWrap = h('div', 'conf');
      confWrap.appendChild(h('div', 'conf-q', 'Прежде чем смотреть — насколько уверен, что вспомнишь?'));
      var confRow = h('div', 'conf-row');
      var chosenConf = null;
      [['Угадываю', 0.2, 'c-low'], ['Серединка', 0.55, 'c-mid'], ['Уверен', 0.9, 'c-hi']].forEach(function (cf) {
        var b = h('button', 'conf-btn ' + cf[2], cf[0]);
        b.onclick = function () { chosenConf = cf[1]; reveal(); };
        confRow.appendChild(b);
      });
      confWrap.appendChild(confRow);
      box.appendChild(confWrap);

      var backWrap = h('div', 'rev-back');
      box.appendChild(backWrap);

      function reveal() {
        clear(backWrap); confWrap.style.display = 'none';
        backWrap.appendChild(h('div', 'rev-back-t', c.back));
        var grades = h('div', 'grades');
        [['again', 'Забыл', 'g-again'], ['hard', 'Трудно', 'g-hard'], ['good', 'Норм', 'g-good'], ['easy', 'Лёгко', 'g-easy']].forEach(function (g) {
          var b = h('button', 'grade ' + g[2], g[1]);
          b.onclick = function () { grade(c, g[0]); };
          grades.appendChild(b);
        });
        backWrap.appendChild(grades);
      }

      function grade(card, rating) {
        var correct = rating === 'good' || rating === 'easy';
        if (chosenConf != null) CS.recordConfidence(chosenConf, correct);
        CS.gradeCard(card.id, rating);
        queue.shift();
        if (correct) {
          cleared += 1; // закрыт на сегодня
        } else if (requeues < maxRequeues) {
          // Не вспомнил уверенно → вернуть в конец очереди (доучивание в этой сессии).
          requeues += 1;
          queue.push(card);
        } else {
          cleared += 1; // страховка от зацикливания
        }
        renderChrome();
        render();
      }
    }
    render();
  }

  // ---------- Сегодня: дневной план (добить слабое → повторить → новое) ----------
  function viewToday() {
    renderChrome();
    clear(app);
    app.appendChild(crumbs([['Карта', '#/'], ['Сегодня', null]]));
    var plan = CS.dailyPlan();
    var est = CS.masteryStats();

    var head = h('section', 'today-head');
    head.appendChild(h('h1', null, 'Сегодня'));
    head.appendChild(h('p', 'lead', 'План собран по науке о памяти: сначала добиваем то, что начало забываться, вперемешку повторяем разные темы, и только потом берём новое — небольшими порциями, чтобы не перегрузить.'));
    app.appendChild(head);

    // Три полосы плана.
    var strip = h('div', 'plan-strip');
    strip.appendChild(planCard('Добить слабое', plan.counts.relearn, 'то, что ты недо-вспомнил — доведём до уверенного', 'relearn'));
    strip.appendChild(planCard('Повторить', plan.counts.review, 'разнесённое повторение на грани забывания', 'review'));
    strip.appendChild(planCard('Новое', plan.counts.fresh, 'новые уроки на фронтире — пререквизиты уже освоены', 'fresh'));
    app.appendChild(strip);

    // Кнопка запуска сессии карточек (relearn+review).
    var reviewCards = plan.relearn.concat(plan.review);
    var actions = h('div', 'frow');
    if (reviewCards.length) {
      var start = h('button', 'btn primary big', 'Запустить сессию памяти (' + reviewCards.length + ')');
      var sessBox = null;
      start.onclick = function () {
        clear(app);
        app.appendChild(crumbs([['Карта', '#/'], ['Сегодня', '#/today'], ['Сессия', null]]));
        sessBox = h('div', 'review'); app.appendChild(sessBox);
        runCardSession(reviewCards, sessBox, function () {
          clear(sessBox);
          sessBox.appendChild(h('div', 'big-emoji', '🎯'));
          sessBox.appendChild(h('h2', null, 'Память прокачана'));
          sessBox.appendChild(h('p', 'muted', 'Теперь — новое. Ниже уроки на фронтире.'));
          var b = h('a', 'btn primary', 'К плану'); b.href = '#/today'; sessBox.appendChild(b);
          renderChrome();
        });
      };
      actions.appendChild(start);
    }
    app.appendChild(actions);

    // Новые уроки на фронтире.
    if (plan.fresh.length) {
      var fresh = h('section', 'today-fresh');
      fresh.appendChild(h('h2', null, 'Взять новое'));
      var list = h('div', 'lesson-list');
      plan.fresh.forEach(function (l) {
        var c = CS.getCourse(l.courseId);
        var row = h('a', 'lrow'); row.href = '#/lesson/' + l.courseId + '/' + l.id;
        row.appendChild(h('div', 'lrow-ic', '+'));
        var body = h('div', 'lrow-body');
        body.appendChild(h('div', 'lrow-title', l.title));
        body.appendChild(h('div', 'lrow-sub', (c ? c.title + ' · ' : '') + (l.subtitle || '')));
        row.appendChild(body);
        row.appendChild(h('div', 'lrow-meta', (l.minutes || 10) + ' мин'));
        list.appendChild(row);
      });
      fresh.appendChild(list);
      app.appendChild(fresh);
    }

    if (!reviewCards.length && !plan.fresh.length) {
      var done = h('div', 'card center');
      done.appendChild(h('div', 'big-emoji', '✅'));
      done.appendChild(h('h2', null, 'На сегодня всё'));
      done.appendChild(h('p', 'muted', 'Нет карточек к повторению и новых открытых уроков. Загляни завтра — или открой следующую специализацию через диагностику.'));
      app.appendChild(done);
    }

    // Честная оценка готовности.
    app.appendChild(readinessPanel(est));
    app.appendChild(footer());
  }

  function planCard(title, n, sub, kind) {
    var c = h('div', 'plan-card ' + kind);
    c.appendChild(h('div', 'plan-n', String(n)));
    c.appendChild(h('div', 'plan-t', title));
    c.appendChild(h('div', 'plan-s', sub));
    return c;
  }

  function readinessPanel(est) {
    var p = h('section', 'readiness');
    p.appendChild(h('div', 'rd-h', 'Прогресс к уровню специалиста'));
    var bar = h('div', 'bar big'); var fill = h('div', 'bar-fill'); fill.style.width = est.pct + '%'; bar.appendChild(fill);
    p.appendChild(bar);
    var row = h('div', 'rd-row');
    row.appendChild(rdStat(est.mastered + '/' + est.total, 'тем освоено прочно'));
    row.appendChild(rdStat(est.pct + '%', 'граф компетенций'));
    row.appendChild(rdStat('≈ ' + est.estDays + ' дн.', 'при ' + est.minutesPerDay + ' мин/день'));
    p.appendChild(row);
    p.appendChild(h('p', 'rd-note', est.note));
    return p;
  }
  function rdStat(v, k) {
    var e = h('div', 'rd-stat');
    e.appendChild(h('div', 'rd-v', v));
    e.appendChild(h('div', 'rd-k', k));
    return e;
  }

  // ---------- Диагностика ----------
  function viewDiagnostic() {
    renderChrome();
    clear(app);
    // Банк из всех курсов (приоритет базовым), по 1–2 из каждого.
    var bank = [];
    CS.allCourses().forEach(function (c) { (c.assess || []).forEach(function (q) { bank.push(Object.assign({ courseId: c.id }, q)); }); });
    if (!bank.length) { app.appendChild(notFound('Пока нет вопросов для диагностики')); return; }
    var intro = h('div', 'card');
    intro.appendChild(h('h1', null, 'Входная диагностика'));
    intro.appendChild(h('p', 'lead', 'Несколько вопросов по одному за раз. Сложность подстраивается под твои ответы. В конце подберём стартовую глубину и отметим, что ты уже знаешь. Если не знаешь — отвечай как думаешь, ошибаться тут полезно.'));
    var start = h('button', 'btn primary big', 'Начать');
    start.onclick = function () {
      runDiagnostic(bank, function (res) {
        CS.state.diagnostic = res;
        CS.setMode(res.start === 'deep' ? 'deep' : res.start === 'core' ? 'core' : 'foundation');
        CS.saveNow();
        location.hash = '#/';
      }, 'Платформа');
    };
    intro.appendChild(start);
    app.appendChild(intro);
  }

  // Переиспользуемый раннер адаптивной диагностики.
  function runDiagnostic(bank, onDone, label) {
    var diag = CS.logic.makeDiagnostic(bank, { maxQ: Math.min(6, bank.length) });
    clear(app);
    var card = h('div', 'card diag');
    app.appendChild(card);
    function step() {
      var q = diag.pick();
      clear(card);
      if (!q) {
        var res = diag.result();
        card.appendChild(h('div', 'big-emoji', '🧭'));
        card.appendChild(h('h2', null, 'Готово'));
        card.appendChild(h('p', 'lead', verdict(res)));
        var b = h('button', 'btn primary', 'Применить и продолжить');
        b.onclick = function () { onDone(res); };
        card.appendChild(b);
        return;
      }
      card.appendChild(h('div', 'diag-meta', label + ' · сложность ' + ({ '-1': 'лёгкая', '0': 'средняя', '1': 'высокая' }[q.b])));
      card.appendChild(h('h2', 'step-q', q.q));
      var opts = h('div', 'opts');
      var done = false;

      // chosen: индекс выбранного варианта, или -1 = «не знаю».
      function resolve(chosen) {
        if (done) return; done = true;
        var ok = chosen === q.correct;
        diag.answer(q, ok);           // «не знаю» = не засчитано как знание → сложность вниз
        Array.prototype.forEach.call(opts.children, function (b, j) {
          b.disabled = true;
          if (j === q.correct) b.classList.add('correct');
          else if (j === chosen) b.classList.add('wrong');
        });
        if (dunno) dunno.disabled = true;
        var cls = ok ? 'ok' : (chosen === -1 ? 'warn' : 'bad');
        var fb = h('div', 'feedback ' + cls);
        fb.appendChild(h('div', 'fb-head', ok ? 'Верно' : (chosen === -1 ? 'Честно — это нормально. Вот ответ:' : 'Верный вариант отмечен')));
        var w = h('p'); w.innerHTML = mdInline(q.why || ''); fb.appendChild(w);
        var nx = h('button', 'btn primary', 'Дальше →'); nx.onclick = step;
        card.appendChild(fb); card.appendChild(nx);
      }

      q.options.forEach(function (opt, i) {
        var btn = h('button', 'opt'); btn.innerHTML = mdInline(opt);
        btn.onclick = function () { resolve(i); };
        opts.appendChild(btn);
      });
      card.appendChild(opts);

      // Явная кнопка «Пока не знаю» — чтобы не гадать наугад (это и честнее для оценки).
      var dunno = h('button', 'btn ghost dunno', 'Пока не знаю');
      dunno.onclick = function () { resolve(-1); };
      card.appendChild(dunno);
    }
    function verdict(res) {
      var pct = Math.round(res.accuracy * 100);
      var name = { foundation: 'Foundation — начнём с фундамента', core: 'Deep Dive — ты уверенно держишь базу', deep: 'Expert Lab — готов к глубоким разборам' }[res.start];
      return 'Точность ' + pct + '% на ' + res.answered + ' вопросах. Рекомендуемый режим: ' + name + '. Это можно сменить в любой момент переключателем вверху.';
    }
    step();
  }

  // ---------- Мелочи ----------
  function crumbs(items) {
    var c = h('nav', 'crumbs');
    items.forEach(function (it, i) {
      if (it[1]) { var a = h('a', null, it[0]); a.href = it[1]; c.appendChild(a); }
      else c.appendChild(h('span', null, it[0]));
      if (i < items.length - 1) c.appendChild(h('span', 'crumb-sep', '/'));
    });
    return c;
  }
  function notFound(msg) {
    var d = h('div', 'card center');
    d.appendChild(h('div', 'big-emoji', '🤔'));
    d.appendChild(h('h2', null, msg));
    var b = h('a', 'btn primary', 'На карту'); b.href = '#/'; d.appendChild(b);
    return d;
  }
  function footer() {
    var f = h('footer', 'foot');
    f.appendChild(h('span', null, 'CYBER SEC · локальная учебная платформа · прогресс хранится в этом браузере'));
    return f;
  }

  // ---------- Старт ----------
  window.CSUI = { route: route, mount: mount, helpers: { h: h, clear: clear, para: para, mdInline: mdInline, crumbs: crumbs, renderChrome: renderChrome, footer: footer, getApp: function () { return app; } } };
})();
