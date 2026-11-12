// Автотесты ядра памяти (Mastery Engine). Запуск: node --test tests/mastery.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../js/mastery.js');

const DAY = 86400000;

test('retrievability: R(S) == 0.9 и убывает со временем', () => {
  assert.ok(Math.abs(M.retrievability(10, 10) - 0.9) < 1e-9);
  assert.ok(M.retrievability(10, 0) === 1);
  assert.ok(M.retrievability(10, 50) < M.retrievability(10, 10));
});

test('intervalForRetention: при target 0.9 интервал == стабильности', () => {
  assert.ok(Math.abs(M.intervalForRetention(12, 0.9) - 12) < 1e-9);
  // Выше требование удержания → короче интервал.
  assert.ok(M.intervalForRetention(12, 0.95) < M.intervalForRetention(12, 0.9));
});

test('review: первый "good" переводит из new в learning со стабильностью > 0', () => {
  const m0 = M.initMemory('c', 0);
  const m1 = M.review(m0, 'good', 0);
  assert.equal(m0.state, 'new');           // вход не мутирован
  assert.ok(m1.stability > 0);
  assert.ok(m1.due > 0);
  assert.equal(m1.reps, 1);
});

test('review: серия "good" монотонно растит стабильность и интервалы', () => {
  let m = M.initMemory('c', 0);
  let t = 0, prevS = 0, prevGap = 0;
  for (let i = 0; i < 6; i++) {
    m = M.review(m, 'good', t, 0.9);
    assert.ok(m.stability > prevS, 'стабильность должна расти');
    const gap = (m.due - t) / DAY;
    assert.ok(gap >= prevGap, 'интервал не должен сокращаться');
    prevS = m.stability; prevGap = gap; t = m.due;
  }
});

test('review: "again" роняет стабильность, растит lapses и difficulty, повтор в тот же день', () => {
  let m = M.initMemory('c', 0);
  m = M.review(m, 'good', 0);
  m = M.review(m, 'good', m.due);
  const beforeS = m.stability, beforeD = m.difficulty, t = m.due;
  const after = M.review(m, 'again', t);
  assert.ok(after.stability < beforeS, 'стабильность падает');
  assert.ok(after.difficulty > beforeD, 'сложность растёт');
  assert.equal(after.lapses, 1);
  assert.ok((after.due - t) < DAY, 'при провале повтор в тот же день');
  assert.equal(after.streak, 0, 'стрик сбрасывается');
});

test('review: "easy" даёт интервал не меньше "good" из одинакового состояния', () => {
  let base = M.initMemory('c', 0);
  base = M.review(base, 'good', 0);
  const g = M.review(base, 'good', base.due);
  const e = M.review(base, 'easy', base.due);
  assert.ok((e.due - base.due) >= (g.due - base.due));
});

test('review: difficulty всегда в [1,10]', () => {
  let m = M.initMemory('c', 0);
  let t = 0;
  for (let i = 0; i < 30; i++) { m = M.review(m, 'again', t); t = m.due; assert.ok(m.difficulty >= 1 && m.difficulty <= 10); }
  for (let i = 0; i < 30; i++) { m = M.review(m, 'easy', t); t = m.due; assert.ok(m.difficulty >= 1 && m.difficulty <= 10); }
});

test('masteryLevel: растёт с повторениями, падает со временем без повторов', () => {
  let m = M.initMemory('c', 0);
  m = M.review(m, 'good', 0);
  const early = M.masteryLevel(m, m.lastReview);
  for (let i = 0; i < 5; i++) m = M.review(m, 'good', m.due);
  const trained = M.masteryLevel(m, m.lastReview);
  assert.ok(trained > early, 'тренированный концепт прочнее');
  const faded = M.masteryLevel(m, m.lastReview + 400 * DAY);
  assert.ok(faded < trained, 'без повторов прочность падает');
});

test('successive relearning: концепт закрыт на сегодня после критерия подряд', () => {
  let m = M.initMemory('c', 0);
  assert.equal(M.clearedToday(m), false);
  m = M.review(m, 'good', 0);
  m = M.review(m, 'good', m.lastReview + 60000);
  assert.equal(M.clearedToday(m), false, 'двух мало при критерии 3');
  m = M.review(m, 'good', m.lastReview + 60000);
  assert.equal(M.clearedToday(m), true, 'трёх достаточно');
});

test('buildDailyPlan: новое не открывается, пока не освоены пререквизиты', () => {
  const graph = [
    { id: 'a', prereqs: [], courseId: 'x' },
    { id: 'b', prereqs: ['a'], courseId: 'x' }
  ];
  // Пусто: доступно только a (без пререквизитов).
  let plan = M.buildDailyPlan(graph, {}, 0);
  assert.deepEqual(plan.fresh.map(c => c.id), ['a']);
  // a не освоен (слабая стабильность) → b всё ещё закрыт.
  let ma = M.review(M.initMemory('a', 0), 'good', 0);
  plan = M.buildDailyPlan(graph, { a: ma }, ma.lastReview);
  assert.ok(!plan.fresh.some(c => c.id === 'b'), 'b закрыт, пока a не освоен');
  // Прокачиваем a до освоения → b открывается.
  let t = 0; while (!M.isMastered(ma, ma.lastReview)) { ma = M.review(ma, 'easy', ma.due); if (++t > 50) break; }
  plan = M.buildDailyPlan(graph, { a: ma }, ma.lastReview);
  assert.ok(plan.fresh.some(c => c.id === 'b'), 'b открыт после освоения a');
});

test('buildDailyPlan: лимит нового в день соблюдается', () => {
  const graph = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, prereqs: [], courseId: 'x' }));
  const plan = M.buildDailyPlan(graph, {}, 0, { maxNew: 3 });
  assert.equal(plan.fresh.length, 3);
});

test('interleaveByCourse: соседние элементы по возможности из разных курсов', () => {
  const items = [
    { id: 1, courseId: 'a' }, { id: 2, courseId: 'a' }, { id: 3, courseId: 'a' },
    { id: 4, courseId: 'b' }, { id: 5, courseId: 'b' }
  ];
  const out = M.interleaveByCourse(items);
  let adjacentSame = 0;
  for (let i = 1; i < out.length; i++) if (out[i].courseId === out[i - 1].courseId) adjacentSame++;
  assert.ok(adjacentSame <= 1, 'интерлив минимизирует соседей одного курса');
});

test('brierTerm и calibrationLabel: уверенный+верный ≈ 0, уверенный+неверный велик', () => {
  assert.ok(M.brierTerm(1, true) < 1e-9);
  assert.ok(M.brierTerm(1, false) > 0.9);
  assert.equal(M.calibrationLabel(0.05), 'отличная');
  assert.equal(M.calibrationLabel(0.3), 'переоцениваешь себя');
});

test('estimateReadiness: честная прикидка, меньше работы при большем освоении', () => {
  const graph = Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, prereqs: [], courseId: 'x' }));
  const e0 = M.estimateReadiness(graph, {}, 0, 45);
  assert.equal(e0.total, 20);
  assert.equal(e0.mastered, 0);
  assert.ok(e0.estDays > 0);
  // Половина освоена → остаток и срок меньше. Тренируем и оцениваем в единой временной базе T0.
  const T0 = Date.UTC(2026, 0, 1);
  const mems = {};
  for (let i = 0; i < 10; i++) {
    let m = M.initMemory('c' + i, T0);
    for (let k = 0; k < 20 && !M.isMastered(m, m.lastReview); k++) m = M.review(m, 'easy', m.due);
    mems['c' + i] = m;
  }
  // Оцениваем на момент последнего повтора (знания ещё свежи), как было бы в реальной сессии.
  const evalNow = Math.max(...Object.values(mems).map(m => m.lastReview));
  const e1 = M.estimateReadiness(graph, mems, evalNow, 45);
  assert.ok(e1.mastered >= 1, 'хотя бы часть концептов освоена');
  assert.ok(e1.estDays < e0.estDays, 'больше освоено — меньше осталось');
});
