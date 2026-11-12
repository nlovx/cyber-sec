/* CYBER SEC — чистая логика обучения (без DOM).
   Интервальное повторение, адаптивная диагностика, мастерство.
   UMD: в браузере вешается на window.CSLogic, в Node экспортируется через module.exports.
   Отдельно от движка, чтобы покрывать автотестами (tests/logic.test.mjs). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CSLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000; // мс в сутках

  // ----- Интервальное повторение (SM-2-подобно) -----
  // База интервалов из METHOD.md: 1 → 3 → 7 → 16 → 35 дней.
  var BASE = [1, 3, 7, 16, 35];

  // Свежая карточка.
  function newCard(id, now) {
    return { id: id, reps: 0, ease: 2.5, intervalDays: 0, due: now == null ? Date.now() : now, lapses: 0 };
  }

  // Оценка пользователя: 'again' | 'hard' | 'good' | 'easy'.
  // Возвращает НОВЫЙ объект карточки (не мутирует вход).
  function schedule(card, grade, now) {
    now = now == null ? Date.now() : now;
    var c = {
      id: card.id, reps: card.reps, ease: card.ease,
      intervalDays: card.intervalDays, due: card.due, lapses: card.lapses
    };

    if (grade === 'again') {
      // Забыл — сбрасываем прогресс, но не ease целиком; повтор завтра.
      c.reps = 0;
      c.lapses += 1;
      c.ease = clamp(c.ease - 0.2, 1.3, 3.0);
      c.intervalDays = 1;
      c.due = now + DAY;
      return c;
    }

    // Подстройка «лёгкости» по SM-2.
    if (grade === 'hard') c.ease = clamp(c.ease - 0.15, 1.3, 3.0);
    else if (grade === 'easy') c.ease = clamp(c.ease + 0.15, 1.3, 3.0);
    // 'good' — ease не меняем.

    var next;
    if (c.reps < BASE.length) {
      // Пока идём по базовой лестнице, но масштабируем ease-ом относительно 2.5.
      next = BASE[c.reps] * (c.ease / 2.5);
      if (grade === 'hard') next *= 0.7;
      if (grade === 'easy') next *= 1.3;
    } else {
      // Дальше — классический SM-2: предыдущий интервал × ease.
      next = c.intervalDays * c.ease;
      if (grade === 'hard') next *= 0.8;
      if (grade === 'easy') next *= 1.2;
    }

    c.reps += 1;
    c.intervalDays = Math.max(1, Math.round(next));
    c.due = now + c.intervalDays * DAY;
    return c;
  }

  // Карточки к повторению на момент `now`.
  function dueCards(cards, now) {
    now = now == null ? Date.now() : now;
    return Object.keys(cards || {})
      .map(function (k) { return cards[k]; })
      .filter(function (c) { return c && c.due <= now; })
      .sort(function (a, b) { return a.due - b.due; });
  }

  // ----- Мастерство темы (экспоненциальное сглаживание) -----
  // m' = m + a*(target - m); верно → target 1, неверно → target 0.
  // Вес верного ответа зависит от сложности: сложный вопрос двигает сильнее.
  function updateMastery(m, correct, difficulty) {
    if (typeof m !== 'number' || isNaN(m)) m = 0;
    var b = typeof difficulty === 'number' ? difficulty : 0; // -1..+1
    var alpha = correct ? 0.30 + 0.10 * b : 0.35 - 0.05 * b;
    alpha = clamp(alpha, 0.12, 0.5);
    var target = correct ? 1 : 0;
    return clamp(m + alpha * (target - m), 0, 1);
  }

  var MASTERED = 0.8; // порог освоения урока/темы
  function isMastered(m) { return (m || 0) >= MASTERED; }

  // ----- Адаптивная входная диагностика (лестница по сложности) -----
  // Банк: массив {id, b, ...}, b ∈ {-1,0,1}. Отдаём вопросы по одному,
  // начиная со среднего; верно → сложнее, неверно → легче. Без повторов.
  function makeDiagnostic(bank, opts) {
    opts = opts || {};
    var maxQ = opts.maxQ || Math.min(6, bank.length);
    var asked = [];      // id заданных
    var level = 0;       // текущий целевой уровень сложности
    var hits = 0, total = 0;
    var sumB = 0;        // сумма сложностей, по которым отвечали

    function pick() {
      if (total >= maxQ) return null;
      var pool = bank.filter(function (q) { return asked.indexOf(q.id) < 0; });
      if (!pool.length) return null;
      // Ближайший по сложности к текущему уровню.
      pool.sort(function (a, b) {
        return Math.abs(a.b - level) - Math.abs(b.b - level);
      });
      var q = pool[0];
      asked.push(q.id);
      return q;
    }

    function answer(q, correct) {
      total += 1;
      sumB += q.b;
      if (correct) { hits += 1; level = Math.min(1, level + 1); }
      else { level = Math.max(-1, level - 1); }
    }

    // Итоговая оценка способности θ ∈ [0,1] и рекомендованный стартовый уровень.
    function result() {
      var acc = total ? hits / total : 0;
      // Сдвиг по средней сложности отвеченного: отвечал на сложное — бонус.
      var theta = clamp(acc * 0.8 + (sumB / Math.max(1, total)) * 0.1 + 0.1, 0, 1);
      var start = theta >= 0.75 ? 'deep' : theta >= 0.4 ? 'core' : 'foundation';
      return { theta: theta, accuracy: acc, answered: total, start: start };
    }

    return { pick: pick, answer: answer, result: result,
             state: function () { return { asked: asked.slice(), level: level, total: total, hits: hits }; } };
  }

  // ----- Проверка свободного ввода -----
  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase().trim()
      .replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '');
  }
  function checkInput(given, answers) {
    var g = normalize(given);
    if (!g) return false;
    return (answers || []).some(function (a) { return normalize(a) === g; });
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  return {
    DAY: DAY, BASE_INTERVALS: BASE, MASTERED: MASTERED,
    newCard: newCard, schedule: schedule, dueCards: dueCards,
    updateMastery: updateMastery, isMastered: isMastered,
    makeDiagnostic: makeDiagnostic,
    normalize: normalize, checkInput: checkInput, clamp: clamp
  };
});
