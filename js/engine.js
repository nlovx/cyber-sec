/* CYBER SEC — движок: реестр курсов, виджеты, хранилище прогресса.
   Глобальный объект CS. Курсы (content/*.js) вызывают CS.course(...) при загрузке. */
(function () {
  'use strict';
  var L = (typeof window !== 'undefined' && window.CSLogic) || (typeof CSLogic !== 'undefined' && CSLogic);
  var M = (typeof window !== 'undefined' && window.CSM) || (typeof CSM !== 'undefined' && CSM); // ядро памяти

  var STORE_KEY = 'cybersec.state.v1';
  var courses = [];           // зарегистрированные курсы (в порядке регистрации)
  var courseById = {};
  var vizRegistry = {};       // kind -> renderFn(container, step, api)

  // ---------- Хранилище ----------
  function defaultState() {
    return {
      v: 1,
      createdAt: Date.now(),
      name: 'Ученик',
      xp: 0,
      streak: { count: 0, lastDay: null },
      mode: 'core',                 // foundation | core | deep (глубина по умолчанию)
      lessons: {},                  // lessonId -> {done, mastery, attempts, bestAt}
      topics: {},                   // courseId -> {mastery, placed}
      cards: {},                    // cardKey -> память (FSRS Mastery Engine)
      diagnostic: null,             // результат входной диагностики платформы
      calib: { sum: 0, n: 0 },      // калибровка уверенности (Brier): среднее sum/n
      settings: { minutesPerDay: 45, maxNew: 4 },
      log: [],                      // последние события (для серии/аналитики)
      history: []                   // журнал обучения: [{t, type, id, title, courseId, xp}] — вечная история
    };
  }

  // Старые карточки SM-2 (reps/ease/intervalDays) → формат памяти FSRS.
  function migrateCard(c, key) {
    if (c && typeof c.stability === 'number') return c; // уже новый формат
    var m = M.initMemory(key, (c && c.due) || Date.now());
    if (c) { m.front = c.front; m.back = c.back; m.lessonId = c.lessonId; m.courseId = c.courseId; m.due = c.due || m.due; }
    return m;
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      return migrate(s);
    } catch (e) {
      console.warn('[CS] не удалось прочитать прогресс, старт с чистого:', e);
      return defaultState();
    }
  }
  function migrate(s) {
    var d = defaultState();
    for (var k in d) if (!(k in s)) s[k] = d[k];
    // Перегоняем карточки в формат памяти FSRS (разово, безопасно для старых профилей).
    if (s.cards) for (var key in s.cards) s.cards[key] = migrateCard(s.cards[key], key);
    if (!s.calib) s.calib = { sum: 0, n: 0 };
    if (!s.settings) s.settings = { minutesPerDay: 45, maxNew: 4 };
    return s;
  }
  var saveTimer = null;
  function save() {
    // Троттлим запись, чтобы не дёргать диск на каждый клик.
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { console.warn('[CS] не удалось сохранить прогресс:', e); }
      notifySave();
    }, 150);
  }
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    notifySave();
  }
  var saveHooks = [];
  function onSave(fn) { saveHooks.push(fn); }
  function notifySave() { saveHooks.forEach(function (f) { try { f(); } catch (e) {} }); }
  function logEvent(ev) {
    state.history = state.history || [];
    ev.t = ev.t || Date.now(); state.history.push(ev);
    if (state.history.length > 2000) state.history = state.history.slice(-2000);
  }

  // ---------- Регистрация курсов/виджетов ----------
  function course(def) {
    if (!def || !def.id) { console.error('[CS] курс без id пропущен', def); return; }
    if (courseById[def.id]) { console.warn('[CS] дубль курса', def.id, '— перезаписан'); }
    normalizeCourse(def);
    if (!courseById[def.id]) courses.push(def);
    else courses[courses.indexOf(courseById[def.id])] = def;
    courseById[def.id] = def;
    return def;
  }

  // Приводим курс к согласованному виду и ставим ссылки lesson.courseId.
  function normalizeCourse(def) {
    def.track = def.track || 'base';
    def.order = def.order || 999;
    def.lessons = (def.lessons || []).filter(function (l) { return l && l.id; });
    def.assess = def.assess || [];
    def.lessons.forEach(function (l, i) {
      l.courseId = def.id;
      l.idx = i;
      l.steps = (l.steps || []).filter(Boolean);
      l.cards = l.cards || [];
      l.sources = l.sources || [];
    });
  }

  function viz(kind, fn) { vizRegistry[kind] = fn; }
  function getViz(kind) { return vizRegistry[kind]; }

  // ---------- Программа (roadmap): план курсов по трекам ----------
  // content/roadmap.js вызывает CS.roadmap('net', [{id,title,goal,ready}]).
  // ready:true должен указывать на реально зарегистрированный курс (content/*.js).
  var roadmapByTrack = {};
  function roadmap(trackId, items) { roadmapByTrack[trackId] = items || []; }
  // Полный каталог трека: план из roadmap + авто-добавление реальных курсов, которых нет в плане.
  function trackCatalog(trackId) {
    var planned = (roadmapByTrack[trackId] || []).slice();
    var plannedIds = {};
    planned.forEach(function (it) { plannedIds[it.id] = true; });
    coursesByTrack(trackId).forEach(function (c) {
      if (!plannedIds[c.id]) planned.push({ id: c.id, title: c.title, goal: c.tagline, ready: true });
    });
    // Отмечаем ready по факту регистрации курса.
    planned.forEach(function (it) { it.ready = !!courseById[it.id] || !!it.href; });
    return planned;
  }
  function trackHasCatalog(trackId) { return trackCatalog(trackId).length > 0; }
  function catalogStats(trackId) {
    var cat = trackCatalog(trackId);
    var ready = cat.filter(function (i) { return i.ready; }).length;
    return { total: cat.length, ready: ready, planned: cat.length - ready };
  }

  function allCourses() {
    return courses.slice().sort(function (a, b) {
      if (a.track !== b.track) return trackOrder(a.track) - trackOrder(b.track);
      return a.order - b.order;
    });
  }
  function getCourse(id) { return courseById[id]; }
  function getLesson(courseId, lessonId) {
    var c = courseById[courseId];
    if (!c) return null;
    for (var i = 0; i < c.lessons.length; i++) if (c.lessons[i].id === lessonId) return c.lessons[i];
    return null;
  }

  var TRACK_ORDER = ['base', 'sysadmin', 'net', 'programming', 'security', 'crypto', 'osint', 'forensics', 'cloud', 'webdev', 'gamedev', 'ai', 'hardware', 'redteam', 'reverse'];
  function trackOrder(t) { var i = TRACK_ORDER.indexOf(t); return i < 0 ? 50 : i; }
  // tier: ярус в карте навыков (0 фундамент → дальше ветвление). needs: треки-пререквизиты.
  var TRACK_META = {
    base:        { name: 'Фундамент',          glyph: '◆', tier: 0, needs: [],                  blurb: 'Железо, биты, как компьютер считает — база для всего' },
    sysadmin:    { name: 'Системы и ОС',        glyph: '▤', tier: 1, needs: ['base'],            blurb: 'Windows и Linux, терминал, процессы, права' },
    net:         { name: 'Сети',                glyph: '◈', tier: 1, needs: ['base'],            blurb: 'DNS, IP, маршруты, пакеты — как всё связано' },
    programming: { name: 'Код и автоматизация', glyph: '⌘', tier: 1, needs: ['base'],            blurb: 'Скрипты, логика, автоматизация рутины' },
    security:    { name: 'Безопасность',        glyph: '⛉', tier: 2, needs: ['net', 'sysadmin'], blurb: 'Криптография, защита, модель угроз, Blue Team' },
    forensics:   { name: 'Форензика',           glyph: '⚲', tier: 2, needs: ['sysadmin'],        blurb: 'Расследование инцидентов, логи, восстановление цепочки' },
    crypto:      { name: 'Криптография',       glyph: '⊕', tier: 2, needs: ['base'],            blurb: 'От XOR и RSA до эллиптических кривых, блокчейнов, квантов и ZK (CryptoLab)' },
    osint:       { name: 'OSINT',               glyph: '◉', tier: 2, needs: ['net'],             blurb: 'Разведка по открытым источникам (учебные кейсы)' },
    cloud:       { name: 'Облака',              glyph: '☁', tier: 2, needs: ['net', 'sysadmin'], blurb: 'Серверы, инфраструктура, DevSecOps' },
    webdev:      { name: 'Веб-разработка',      glyph: '❖', tier: 2, needs: ['programming', 'net'], blurb: 'Фронтенд, бэкенд, базы данных, деплой' },
    gamedev:     { name: 'Геймдев',             glyph: '✦', tier: 2, needs: ['programming'],     blurb: 'Игровой цикл, графика, физика, движки' },
    ai:          { name: 'Данные и ИИ',         glyph: '❂', tier: 2, needs: ['programming'],     blurb: 'Данные, статистика, машинное обучение' },
    hardware:    { name: 'Железо и встраиваемое', glyph: '⏚', tier: 2, needs: ['base'],          blurb: 'Электроника, микроконтроллеры, IoT' },
    redteam:     { name: 'Red Team / Пентест',  glyph: '⚑', tier: 3, needs: ['security', 'net'], blurb: 'Наступательная безопасность — строго в лаборатории' },
    reverse:     { name: 'Реверс и малварь',    glyph: '⌬', tier: 3, needs: ['security', 'programming'], blurb: 'Разбор программ и вредоносов в изолированной лабе' }
  };
  var docs = [];
  function doc(d) { if (d && d.id) docs.push(d); return d; }
  function allDocs() { return docs.slice(); }
  function trackMeta(t) { return TRACK_META[t] || { name: t, glyph: '•', tier: 1, needs: [], blurb: '' }; }
  function allTracks() { return TRACK_ORDER.slice(); }
  function coursesByTrack(t) { return allCourses().filter(function (c) { return c.track === t; }); }
  function trackHasContent(t) { return coursesByTrack(t).length > 0; }
  // Агрегированный прогресс трека по всем его курсам.
  var extProgress = {};
  function externalProgress(trackId, fn) { extProgress[trackId] = fn; }
  function itemProgress(item) { var f = item && item.href && extProgress[item.track]; return f ? f(item) : null; }
  function trackProgress(t) {
    if (extProgress[t]) { var e = extProgress[t](null); return { courses: e.items || 0, done: e.done, total: e.total, pct: e.total ? Math.round(e.done / e.total * 100) : 0, mastery: e.total ? e.done / e.total : 0 }; }
    var cs = coursesByTrack(t), done = 0, total = 0, mSum = 0;
    cs.forEach(function (c) { var p = courseProgress(c.id); done += p.done; total += p.total; mSum += p.mastery; });
    return { courses: cs.length, done: done, total: total,
             pct: total ? Math.round(done / total * 100) : 0,
             mastery: cs.length ? mSum / cs.length : 0 };
  }
  // Трек «разблокирован», если фундамент начат (≥1 урок базы пройден) или это сам фундамент.
  // Пререквизит-треки должны иметь прогресс, чтобы открыть зависимый (Duolingo-подобные ворота).
  function trackUnlocked(t) {
    var meta = trackMeta(t);
    if (meta.tier === 0) return true;
    if (trackProgress(t).done > 0) return true; // уже начатый трек не блокируем
    return (meta.needs || []).every(function (n) {
      var p = trackProgress(n);
      return p.done > 0 || !trackHasContent(n); // пустой пререквизит не блокирует (ещё нет контента)
    });
  }

  // ---------- Прогресс ----------
  function lessonState(id) {
    if (!state.lessons[id]) state.lessons[id] = { done: false, mastery: 0, attempts: 0, bestAt: null };
    return state.lessons[id];
  }
  function topicState(courseId) {
    if (!state.topics[courseId]) state.topics[courseId] = { mastery: 0, placed: false };
    return state.topics[courseId];
  }

  // Ретривал-ответ: обновляем мастерство урока и курса, начисляем XP.
  function recordAnswer(lesson, correct, difficulty) {
    var ls = lessonState(lesson.id);
    ls.attempts += 1;
    ls.mastery = L.updateMastery(ls.mastery, correct, difficulty);
    var ts = topicState(lesson.courseId);
    ts.mastery = L.updateMastery(ts.mastery, correct, difficulty);
    if (correct) addXP(10 + Math.round((difficulty || 0) * 4 + 4));
    save();
    return ls;
  }

  function completeLesson(lesson) {
    var ls = lessonState(lesson.id);
    var firstTime = !ls.done;
    ls.done = true;
    ls.bestAt = Date.now();
    if (firstTime) { addXP(60); logEvent({ type: 'lesson', id: lesson.id, title: lesson.title, courseId: lesson.courseId, xp: 60 }); }
    // Карточки урока — в ядро памяти (FSRS). Первый контакт был в уроке, поэтому
    // засеиваем как «good»: уже встречено, но ещё не закреплено разносом по дням.
    (lesson.cards || []).forEach(function (pair, i) {
      var key = lesson.id + '#' + i;
      if (!state.cards[key]) {
        var mem = M.review(M.initMemory(key, Date.now()), 'good', Date.now());
        mem.front = pair[0]; mem.back = pair[1];
        mem.lessonId = lesson.id; mem.courseId = lesson.courseId;
        state.cards[key] = mem;
      }
    });
    touchStreak();
    saveNow();
    return ls;
  }

  // Оценка карточки в повторении. grade: again|hard|good|easy.
  function gradeCard(key, grade) {
    var c = state.cards[key];
    if (!c) return;
    var upd = M.review(c, grade, Date.now());
    upd.front = c.front; upd.back = c.back; upd.lessonId = c.lessonId; upd.courseId = c.courseId;
    state.cards[key] = upd;
    if (grade !== 'again') addXP(5);
    touchStreak();
    save();
  }

  // Записать калибровку: confidence 0..1 против фактической верности (Brier).
  function recordConfidence(confidence, correct) {
    state.calib.sum += M.brierTerm(confidence, correct);
    state.calib.n += 1;
    save();
  }
  function calibration() {
    var n = state.calib.n;
    var mean = n ? state.calib.sum / n : null;
    return { n: n, mean: mean, label: M.calibrationLabel(mean) };
  }

  function dueCards() {
    var now = Date.now(), out = [];
    for (var k in state.cards) if (M.isDue(state.cards[k], now)) out.push(state.cards[k]);
    return out.sort(function (a, b) { return a.due - b.due; });
  }

  function addXP(n) { state.xp += n; save(); }

  // ---------- Уровни / ранги (геймификация) ----------
  // Кумулятивный XP до уровня L = 50*L^2. Уровень = floor(sqrt(xp/50)).
  var RANKS = [
    { min: 0,  name: 'Новобранец', glyph: '△' },
    { min: 3,  name: 'Оператор',   glyph: '◇' },
    { min: 6,  name: 'Аналитик',   glyph: '◆' },
    { min: 10, name: 'Инженер',    glyph: '⬡' },
    { min: 15, name: 'Специалист', glyph: '✦' },
    { min: 22, name: 'Эксперт',    glyph: '✸' },
    { min: 30, name: 'Мастер',     glyph: '⯁' }
  ];
  function levelInfo() {
    var xp = state.xp || 0;
    var level = Math.floor(Math.sqrt(xp / 50));
    var curBase = 50 * level * level;
    var nextBase = 50 * (level + 1) * (level + 1);
    var rank = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (level >= RANKS[i].min) rank = RANKS[i];
    return {
      level: level, xp: xp, rank: rank.name, glyph: rank.glyph,
      inLevel: xp - curBase, span: nextBase - curBase,
      toNext: nextBase - xp,
      pct: Math.round((xp - curBase) / (nextBase - curBase) * 100)
    };
  }

  // ---------- Достижения ----------
  var ACHIEVEMENTS = [
    { id: 'first',      icon: '🎯', name: 'Первый шаг',        desc: 'Пройти первый урок',            test: function () { return anyLessonDone(); } },
    { id: 'diagnostic', icon: '🧭', name: 'Знай себя',         desc: 'Пройти диагностику',            test: function () { return !!state.diagnostic; } },
    { id: 'recall',     icon: '🧠', name: 'Вспомнил сам',       desc: 'Сделать первое повторение',     test: function () { return anyCardReviewed(); } },
    { id: 'streak3',    icon: '🔥', name: 'Три дня подряд',     desc: 'Серия 3 дня',                   test: function () { return (state.streak.count || 0) >= 3; } },
    { id: 'streak7',    icon: '⚡', name: 'Неделя дисциплины',  desc: 'Серия 7 дней',                  test: function () { return (state.streak.count || 0) >= 7; } },
    { id: 'cards20',    icon: '🗂️', name: 'Картотека',          desc: '20 карточек в памяти',          test: function () { return Object.keys(state.cards).length >= 20; } },
    { id: 'course',     icon: '🏅', name: 'Курс закрыт',        desc: 'Пройти курс полностью',         test: function () { return anyCourseComplete(); } },
    { id: 'level5',     icon: '⬆️', name: 'Уровень 5',          desc: 'Достичь 5 уровня',              test: function () { return levelInfo().level >= 5; } },
    { id: 'expert',     icon: '🧪', name: 'Экспертный режим',    desc: 'Позаниматься в Expert Lab',     test: function () { return state.mode === 'deep' || state._usedExpert; } },
    { id: 'calibrated', icon: '🎚️', name: 'Трезвая оценка',     desc: 'Калибровка уверенности ≥ 15 ответов', test: function () { return (state.calib.n || 0) >= 15; } }
  ];
  function anyLessonDone() { for (var k in state.lessons) if (state.lessons[k].done) return true; return false; }
  function anyCardReviewed() { for (var k in state.cards) if ((state.cards[k].reps || 0) > 1) return true; return false; }
  function anyCourseComplete() {
    var done = false;
    courses.forEach(function (c) { if (courseProgress(c.id).pct === 100) done = true; });
    return done;
  }
  function achievements() {
    return ACHIEVEMENTS.map(function (a) {
      var unlocked = false; try { unlocked = !!a.test(); } catch (e) {}
      return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, unlocked: unlocked };
    });
  }

  function touchStreak() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var t = today.getTime();
    var last = state.streak.lastDay;
    if (last === t) return;
    if (last === t - L.DAY) state.streak.count += 1;
    else state.streak.count = 1;
    state.streak.lastDay = t;
    save();
  }

  // Применяем итог диагностики курса к стартовому мастерству темы.
  function placeTopic(courseId, theta) {
    var ts = topicState(courseId);
    ts.placed = true;
    // theta 0..1 -> стартовое мастерство до 0.6 (не «дарим» полное освоение).
    ts.mastery = Math.max(ts.mastery, Math.min(0.6, theta * 0.6));
    save();
  }

  // ---------- Агрегаты для UI ----------
  function courseProgress(courseId) {
    var c = courseById[courseId]; if (!c) return { done: 0, total: 0, pct: 0, mastery: 0 };
    var total = c.lessons.length, done = 0;
    c.lessons.forEach(function (l) { if (state.lessons[l.id] && state.lessons[l.id].done) done++; });
    return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0,
             mastery: topicState(courseId).mastery };
  }
  function nextLesson(courseId) {
    var c = courseById[courseId]; if (!c) return null;
    for (var i = 0; i < c.lessons.length; i++) {
      var l = c.lessons[i];
      if (!(state.lessons[l.id] && state.lessons[l.id].done)) return l;
    }
    return c.lessons[c.lessons.length - 1] || null;
  }
  function lessonLocked(lesson) {
    // Урок открыт, если предыдущий в курсе пройден (boss требует все прочие).
    var c = courseById[lesson.courseId]; if (!c) return false;
    if (lesson.boss) {
      return !c.lessons.every(function (l) {
        return l.boss || (state.lessons[l.id] && state.lessons[l.id].done);
      });
    }
    if (lesson.idx === 0) return false;
    var prev = c.lessons[lesson.idx - 1];
    return !(state.lessons[prev.id] && state.lessons[prev.id].done);
  }

  // ---------- Граф компетенций, дневной план, готовность ----------
  // Концепт = урок. Пререквизиты: предыдущий урок курса + последний урок needed-курсов.
  function conceptGraph() {
    var nodes = [];
    allCourses().forEach(function (c) {
      c.lessons.forEach(function (l, i) {
        var prereqs = [];
        if (i > 0) prereqs.push(c.lessons[i - 1].id);
        (c.needs || []).forEach(function (needId) {
          var nc = courseById[needId];
          if (nc && nc.lessons.length) prereqs.push(nc.lessons[nc.lessons.length - 1].id);
        });
        nodes.push({ id: l.id, courseId: c.id, prereqs: prereqs, lesson: l });
      });
    });
    return nodes;
  }

  // Прочность концепта (урока) = среднее masteryLevel его карточек; если карточек нет —
  // по мастерству урока из ответов. Урок «освоен», если пройден и прочность >= порога.
  function conceptMemoryLevel(lessonId) {
    var now = Date.now(), vals = [];
    for (var k in state.cards) {
      var c = state.cards[k];
      if (c.lessonId === lessonId) vals.push(M.masteryLevel(c, now));
    }
    if (vals.length) return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var ls = state.lessons[lessonId];
    return ls ? ls.mastery : 0;
  }
  function conceptMastered(lessonId) {
    var ls = state.lessons[lessonId];
    return !!(ls && ls.done) && conceptMemoryLevel(lessonId) >= M.MASTER_LEVEL;
  }

  // Дневной план: добить слабое (due relearning-карточки) → разнесённые повторения
  // (интерлив по курсам) → новые уроки на фронтире (пререквизиты освоены), с лимитом.
  function dailyPlan() {
    var now = Date.now();
    var due = dueCards();
    var relearn = [], review = [];
    due.forEach(function (c) {
      if (c.state === 'relearning' || (c.lapses || 0) > 0) relearn.push(c);
      else review.push(c);
    });
    review = M.interleaveByCourse(review.map(function (c) { return { ref: c, courseId: c.courseId }; }))
      .map(function (x) { return x.ref; });

    // Новые уроки: открытые (пререквизит освоен/пройден) и ещё не пройденные.
    var maxNew = (state.settings && state.settings.maxNew) || 4;
    var fresh = [];
    conceptGraph().forEach(function (node) {
      if (fresh.length >= maxNew) return;
      var ls = state.lessons[node.id];
      if (ls && ls.done) return;
      if (lessonLocked(node.lesson)) return;
      fresh.push(node.lesson);
    });
    return { relearn: relearn, review: review, fresh: fresh,
             counts: { relearn: relearn.length, review: review.length, fresh: fresh.length } };
  }

  // Сводка мастерства по всему графу + честная оценка готовности.
  function masteryStats(minutesPerDay) {
    var graph = conceptGraph();
    var now = Date.now();
    var memories = {};
    graph.forEach(function (n) {
      // Представляем концепт псевдо-памятью со стабильностью, эквивалентной его уровню,
      // чтобы переиспользовать честную оценку из ядра.
      var lvl = conceptMemoryLevel(n.id);
      memories[n.id] = { id: n.id, stability: conceptMastered(n.id) ? M.MASTER_STABILITY : lvl * M.MASTER_STABILITY * 0.9, lastReview: now };
    });
    var mpd = minutesPerDay || (state.settings && state.settings.minutesPerDay) || 45;
    var est = M.estimateReadiness(graph, memories, now, mpd);
    return est;
  }

  // ---------- Экспорт/импорт ----------
  function exportProfile() { return JSON.stringify(state, null, 2); }
  function importProfile(json) {
    try {
      var s = JSON.parse(json);
      if (!s || typeof s !== 'object') throw new Error('не объект');
      state = migrate(s);
      saveNow();
      return true;
    } catch (e) { console.error('[CS] импорт не удался:', e); return false; }
  }
  function resetProfile() { state = defaultState(); saveNow(); }

  // Публичный API.
  var CS = {
    logic: L,
    course: course, viz: viz, getViz: getViz,
    doc: doc, allDocs: allDocs, externalProgress: externalProgress, itemProgress: itemProgress, roadmap: roadmap, trackCatalog: trackCatalog, trackHasCatalog: trackHasCatalog, catalogStats: catalogStats,
    allCourses: allCourses, getCourse: getCourse, getLesson: getLesson,
    trackMeta: trackMeta, trackOrder: trackOrder, TRACK_ORDER: TRACK_ORDER,
    allTracks: allTracks, coursesByTrack: coursesByTrack, trackHasContent: trackHasContent,
    trackProgress: trackProgress, trackUnlocked: trackUnlocked,
    // прогресс
    get state() { return state; },
    lessonState: lessonState, topicState: topicState,
    recordAnswer: recordAnswer, completeLesson: completeLesson,
    gradeCard: gradeCard, dueCards: dueCards, addXP: addXP,
    recordConfidence: recordConfidence, calibration: calibration,
    levelInfo: levelInfo, achievements: achievements,
    placeTopic: placeTopic,
    courseProgress: courseProgress, nextLesson: nextLesson, lessonLocked: lessonLocked,
    // ядро памяти / план
    mem: M, conceptGraph: conceptGraph, conceptMemoryLevel: conceptMemoryLevel,
    conceptMastered: conceptMastered, dailyPlan: dailyPlan, masteryStats: masteryStats,
    setMode: function (m) { state.mode = m; if (m === 'deep') state._usedExpert = true; save(); },
    setName: function (n) { state.name = n; save(); },
    setMinutesPerDay: function (n) { state.settings.minutesPerDay = n; save(); },
    // профиль
    exportProfile: exportProfile, importProfile: importProfile, resetProfile: resetProfile,
    save: save, saveNow: saveNow, onSave: onSave, logEvent: logEvent,
    os: function () { return state.os || 'win'; }, setOS: function (o) { state.os = o === 'linux' ? 'linux' : 'win'; save(); }
  };
  if (typeof window !== 'undefined') window.CS = CS;
})();
