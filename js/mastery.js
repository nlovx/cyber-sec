/* CYBER SEC — ядро памяти (Mastery Engine).
   Доказательные механизмы долговременного запоминания:
   - FSRS-подобная модель забывания: стабильность S (дни) и вероятность вспоминания R(t).
   - Successive relearning: доведение концепта до критерия (N подряд) в сессии, затем разнос по дням.
   - Граф компетенций: новое открывается только когда освоены пререквизиты (mastery learning).
   - Калибровка уверенности (метапознание) и интерливинг в ежедневном плане.
   Чистая логика, без DOM. UMD: браузер → window.CSM, Node → module.exports. Покрыта tests/mastery.test.mjs. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CSM = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;

  // Кривая забывания FSRS: R(t) = (1 + t/(9S))^-1. При t=S вероятность вспоминания R=0.9.
  function retrievability(stability, elapsedDays) {
    if (stability <= 0) return 0;
    var t = Math.max(0, elapsedDays);
    return 1 / (1 + t / (9 * stability));
  }

  // Интервал (дни) до падения R к целевому удержанию r*: I = 9S(1/r* - 1).
  function intervalForRetention(stability, target) {
    var r = clamp(target || 0.9, 0.5, 0.99);
    return 9 * stability * (1 / r - 1);
  }

  // Начальная стабильность и сложность по первой оценке.
  var INIT_S = { again: 0.4, hard: 1.2, good: 3.0, easy: 8.0 };
  var INIT_D = { again: 7.5, hard: 6.5, good: 5.0, easy: 4.0 };

  function initMemory(id, now) {
    return {
      id: id, state: 'new',
      stability: 0, difficulty: 5,
      reps: 0, lapses: 0,
      lastReview: null, due: now == null ? Date.now() : now,
      streak: 0 // критерийный стрик внутри сессии (successive relearning)
    };
  }

  // Один осознанный повтор. rating: again|hard|good|easy. Чистая функция (не мутирует вход).
  // target — целевое удержание для расчёта следующего срока (по умолчанию 0.9).
  function review(mem, rating, now, target) {
    now = now == null ? Date.now() : now;
    target = target || 0.9;
    var m = {
      id: mem.id, state: mem.state, stability: mem.stability, difficulty: mem.difficulty,
      reps: mem.reps, lapses: mem.lapses, lastReview: mem.lastReview, due: mem.due, streak: mem.streak || 0
    };
    var success = rating !== 'again';

    if (m.state === 'new' || !m.stability) {
      // Первый контакт: задаём стартовую стабильность и сложность.
      m.stability = INIT_S[rating];
      m.difficulty = INIT_D[rating];
      m.state = success ? 'learning' : 'relearning';
    } else {
      var elapsedDays = m.lastReview ? (now - m.lastReview) / DAY : m.stability;
      var R = retrievability(m.stability, elapsedDays);
      // Сложность дрейфует: ошибка усложняет, лёгкость упрощает.
      var dDelta = { again: 1.0, hard: 0.4, good: 0.0, easy: -0.4 }[rating];
      m.difficulty = clamp(m.difficulty + dDelta, 1, 10);

      if (success) {
        // Прирост стабильности тем больше, чем: легче оценка, ниже R на момент повтора
        // (разнёс подольше и всё равно вспомнил = сильнее закрепил — эффект интервала),
        // и чем ниже сложность. Всегда строго растёт (>= *1.05).
        var ease = { hard: 0.12, good: 0.5, easy: 1.0 }[rating];
        var hardnessBoost = (11 - m.difficulty) / 10;      // 0.1..1.0
        var spacingBoost = 1 + (1 - R);                    // 1..2 — за «желательную трудность»
        var factor = 1 + ease * hardnessBoost * spacingBoost;
        m.stability = Math.max(m.stability * 1.05, m.stability * factor);
        m.state = 'review';
      } else {
        // Забыл: стабильность резко падает (но не до нуля), сложность растёт, lapses++.
        m.lapses += 1;
        m.stability = Math.max(0.4, m.stability * 0.35 * (0.5 + R / 2));
        m.state = 'relearning';
      }
    }

    m.reps += 1;
    m.lastReview = now;
    m.streak = success ? (m.streak || 0) + 1 : 0;
    var intervalDays = Math.max(success ? 1 : 0, Math.round(intervalForRetention(m.stability, target)));
    // Провал — повтор в тот же день (короткий лаг), успех — минимум через сутки.
    m.due = success ? now + Math.max(1, intervalDays) * DAY : now + 10 * 60 * 1000;
    return m;
  }

  // Прочность «на сейчас»: сочетание текущей вероятности вспоминания и достигнутой стабильности.
  // 1.0 ≈ концепт помнится и закреплён на недели. Используется для графа компетенций.
  function masteryLevel(mem, now) {
    if (!mem || !mem.stability) return 0;
    now = now == null ? Date.now() : now;
    var elapsed = mem.lastReview ? (now - mem.lastReview) / DAY : 0;
    var R = retrievability(mem.stability, elapsed);
    var durable = clamp(mem.stability / MASTER_STABILITY, 0, 1); // 0..1 к «21-дневной» прочности
    return clamp(R * (0.35 + 0.65 * durable), 0, 1);
  }

  var MASTER_STABILITY = 21;   // дни стабильности, считаем концепт «прочно освоенным»
  var MASTER_LEVEL = 0.8;      // порог освоения
  var SESSION_CRITERION = 3;   // сколько верных подряд в сессии = «закрыт на сегодня» (relearning)

  function isMastered(mem, now) { return masteryLevel(mem, now) >= MASTER_LEVEL; }
  function isDue(mem, now) { return mem && mem.due <= (now == null ? Date.now() : now); }

  // ----- Successive relearning: критерий внутри сессии -----
  // clearedToday: концепт на сегодня закрыт, если набран стрик >= критерия.
  function clearedToday(mem) { return (mem.streak || 0) >= SESSION_CRITERION; }

  // ----- Граф компетенций и ежедневный план -----
  // graph: [{id, prereqs:[id...], courseId, kind:'concept'}]. memories: {id -> mem}.
  // Возвращает структуру дневной сессии: что добить, что повторить, что открыть новое.
  function buildDailyPlan(graph, memories, now, opts) {
    now = now == null ? Date.now() : now;
    opts = opts || {};
    var maxNew = opts.maxNew != null ? opts.maxNew : 4;     // ограничение нового в день (когнитивная нагрузка)
    var mem = function (id) { return memories[id]; };

    var relearn = [], review_ = [], fresh = [];
    graph.forEach(function (c) {
      var m = mem(c.id);
      if (!m || m.state === 'new') {
        // Новое доступно, только если все пререквизиты освоены.
        var ready = (c.prereqs || []).every(function (p) { var pm = mem(p); return pm && isMastered(pm, now); });
        if (ready) fresh.push(c);
      } else if (m.state === 'relearning' || !clearedToday(m)) {
        if (isDue(m, now) || m.state === 'relearning') relearn.push(c);
        else if (isDue(m, now)) review_.push(c);
      } else if (isDue(m, now)) {
        review_.push(c);
      }
    });
    // Сначала добить слабое (relearning), затем разнесённые повторения, потом новое (лимит).
    fresh = fresh.slice(0, maxNew);
    // Интерлив: перемешиваем повторения разных тем, чтобы тренировать различение.
    review_ = interleaveByCourse(review_);
    var queue = relearn.concat(review_).concat(fresh);
    return { relearn: relearn, review: review_, fresh: fresh, queue: queue,
             counts: { relearn: relearn.length, review: review_.length, fresh: fresh.length } };
  }

  // Перемешать так, чтобы соседние элементы были из разных курсов (интерливинг).
  function interleaveByCourse(items) {
    var buckets = {};
    items.forEach(function (it) { (buckets[it.courseId] = buckets[it.courseId] || []).push(it); });
    var keys = Object.keys(buckets), out = [], any = true;
    while (any) {
      any = false;
      for (var i = 0; i < keys.length; i++) {
        var b = buckets[keys[i]];
        if (b.length) { out.push(b.shift()); any = true; }
      }
    }
    return out;
  }

  // ----- Калибровка уверенности (метапознание) -----
  // confidence 0..1, correct bool. Возвращает вклад в Brier-оценку (меньше — лучше калибровка).
  function brierTerm(confidence, correct) {
    var c = clamp(confidence, 0, 1);
    var o = correct ? 1 : 0;
    return (c - o) * (c - o);
  }
  function calibrationLabel(brierMean) {
    if (brierMean == null) return '—';
    if (brierMean < 0.08) return 'отличная';
    if (brierMean < 0.15) return 'хорошая';
    if (brierMean < 0.25) return 'средняя';
    return 'переоцениваешь себя';
  }

  // ----- Честная оценка готовности (НЕ обещание) -----
  // Прикидка, сколько дней при minutesPerDay нужно, чтобы довести граф до освоения.
  // Основана на числе ещё не освоенных концептов и грубой стоимости концепта в минутах.
  function estimateReadiness(graph, memories, now, minutesPerDay) {
    now = now == null ? Date.now() : now;
    var mpd = minutesPerDay || 45;
    var total = graph.length;
    var mastered = graph.filter(function (c) { var m = memories[c.id]; return m && isMastered(m, now); }).length;
    var remaining = total - mastered;
    // Концепт до прочного освоения требует ~нескольких заходов: первичное изучение + несколько relearning.
    var minutesPerConcept = 28; // первое изучение ~13 мин + ~3 коротких повтора — эмпирическая прикидка
    var newMinutesLeft = remaining * minutesPerConcept;
    // Повторения уже освоенного тоже отъедают время, но меньше — учитываем надбавкой.
    var daysNeeded = Math.ceil(newMinutesLeft / (mpd * 0.7)); // 70% времени на новое, 30% на поддержание
    return {
      total: total, mastered: mastered, remaining: remaining,
      pct: total ? Math.round(mastered / total * 100) : 0,
      estDays: daysNeeded, minutesPerDay: mpd,
      note: 'Оценка, а не обещание: реальный срок зависит от дисциплины повторений и результатов экзаменов.'
    };
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  return {
    DAY: DAY, MASTER_STABILITY: MASTER_STABILITY, MASTER_LEVEL: MASTER_LEVEL, SESSION_CRITERION: SESSION_CRITERION,
    retrievability: retrievability, intervalForRetention: intervalForRetention,
    initMemory: initMemory, review: review,
    masteryLevel: masteryLevel, isMastered: isMastered, isDue: isDue, clearedToday: clearedToday,
    buildDailyPlan: buildDailyPlan, interleaveByCourse: interleaveByCourse,
    brierTerm: brierTerm, calibrationLabel: calibrationLabel,
    estimateReadiness: estimateReadiness, clamp: clamp
  };
});
