// Автотесты чистой логики обучения. Запуск: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../js/srlogic.js');

const DAY = 86400000;

test('newCard: валидная свежая карточка', () => {
  const c = L.newCard('x', 1000);
  assert.equal(c.reps, 0);
  assert.equal(c.ease, 2.5);
  assert.equal(c.due, 1000);
  assert.equal(c.lapses, 0);
});

test('schedule: "good" ведёт по базовой лестнице 1→3→7→16→35', () => {
  let c = L.newCard('x', 0);
  const seen = [];
  for (let i = 0; i < 5; i++) { c = L.schedule(c, 'good', 0); seen.push(c.intervalDays); }
  assert.deepEqual(seen, L.BASE_INTERVALS);
});

test('schedule: интервалы растут, due в будущем', () => {
  const now = 1_000_000;
  let c = L.newCard('x', now);
  c = L.schedule(c, 'good', now);
  assert.ok(c.intervalDays >= 1);
  assert.equal(c.due, now + c.intervalDays * DAY);
  assert.equal(c.reps, 1);
});

test('schedule: "again" сбрасывает reps, растит lapses, повтор завтра', () => {
  let c = L.newCard('x', 0);
  c = L.schedule(c, 'good', 0);
  c = L.schedule(c, 'good', 0);
  const before = c.ease;
  c = L.schedule(c, 'again', 0);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.intervalDays, 1);
  assert.ok(c.ease < before, 'ease должен снизиться после забывания');
});

test('schedule: "easy" даёт интервал не меньше "good"', () => {
  const g = L.schedule(L.newCard('g', 0), 'good', 0);
  const e = L.schedule(L.newCard('e', 0), 'easy', 0);
  assert.ok(e.intervalDays >= g.intervalDays);
});

test('schedule: ease зажат в [1.3, 3.0]', () => {
  let c = L.newCard('x', 0);
  for (let i = 0; i < 20; i++) c = L.schedule(c, 'again', 0);
  assert.ok(c.ease >= 1.3);
  for (let i = 0; i < 40; i++) c = L.schedule(c, 'easy', 0);
  assert.ok(c.ease <= 3.0);
});

test('schedule: не мутирует входную карточку', () => {
  const c = L.newCard('x', 0);
  const snap = JSON.stringify(c);
  L.schedule(c, 'good', 0);
  assert.equal(JSON.stringify(c), snap);
});

test('dueCards: возвращает только просроченные, отсортированные по due', () => {
  const now = 10_000;
  const cards = {
    a: { id: 'a', due: now - 100 },
    b: { id: 'b', due: now + 5000 },
    c: { id: 'c', due: now - 5000 }
  };
  const due = L.dueCards(cards, now);
  assert.deepEqual(due.map(c => c.id), ['c', 'a']);
});

test('updateMastery: верные ответы растят, неверные роняют, границы [0,1]', () => {
  let m = 0;
  for (let i = 0; i < 10; i++) m = L.updateMastery(m, true, 0);
  assert.ok(m > 0.8, 'серия верных должна поднять мастерство выше 0.8');
  assert.ok(m <= 1);
  for (let i = 0; i < 10; i++) m = L.updateMastery(m, false, 0);
  assert.ok(m < 0.2, 'серия неверных должна уронить мастерство');
  assert.ok(m >= 0);
});

test('isMastered: порог 0.8', () => {
  assert.equal(L.isMastered(0.79), false);
  assert.equal(L.isMastered(0.8), true);
});

test('checkInput: регистр, пробелы и хвостовая пунктуация игнорируются', () => {
  assert.equal(L.checkInput('  255 ', ['255']), true);
  assert.equal(L.checkInput('A-запись', ['A-запись']), true);
  assert.equal(L.checkInput('Test-NetConnection.', ['test-netconnection']), true);
  assert.equal(L.checkInput('256', ['255']), false);
  assert.equal(L.checkInput('', ['255']), false);
});

test('makeDiagnostic: лестница — верно поднимает сложность, неверно опускает', () => {
  const bank = [
    { id: 'e1', b: -1, correct: 0 }, { id: 'e2', b: -1, correct: 0 },
    { id: 'm1', b: 0, correct: 0 }, { id: 'm2', b: 0, correct: 0 },
    { id: 'h1', b: 1, correct: 0 }, { id: 'h2', b: 1, correct: 0 }
  ];
  const d = L.makeDiagnostic(bank, { maxQ: 4 });
  const q1 = d.pick();
  assert.equal(q1.b, 0, 'старт со средней сложности');
  d.answer(q1, true);
  const q2 = d.pick();
  assert.equal(q2.b, 1, 'после верного — сложнее');
  d.answer(q2, false);
  const q3 = d.pick();
  assert.equal(q3.b, 0, 'после неверного — легче');
});

test('makeDiagnostic: все верно → режим deep; все неверно → foundation', () => {
  const bank = [
    { id: 'm1', b: 0, correct: 0 }, { id: 'h1', b: 1, correct: 0 },
    { id: 'h2', b: 1, correct: 0 }, { id: 'e1', b: -1, correct: 0 }
  ];
  const win = L.makeDiagnostic(bank, { maxQ: 4 });
  let q; while ((q = win.pick())) win.answer(q, true);
  assert.equal(win.result().start, 'deep');

  const lose = L.makeDiagnostic(bank, { maxQ: 4 });
  while ((q = lose.pick())) lose.answer(q, false);
  assert.equal(lose.result().start, 'foundation');
});

test('makeDiagnostic: не задаёт один вопрос дважды и не превышает maxQ', () => {
  const bank = Array.from({ length: 8 }, (_, i) => ({ id: 'q' + i, b: 0, correct: 0 }));
  const d = L.makeDiagnostic(bank, { maxQ: 5 });
  const ids = new Set(); let q, n = 0;
  while ((q = d.pick())) { assert.ok(!ids.has(q.id), 'без повторов'); ids.add(q.id); d.answer(q, true); n++; }
  assert.equal(n, 5);
});
