// Валидатор контента курсов: грузит реальные content/*.js и проверяет структуру.
// Запуск: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(__dirname, '..', 'content');

// Виджеты, зарегистрированные в js/viz.js.
const KNOWN_VIZ = new Set(['binary', 'dns', 'packet', 'subnet', 'ascii', 'perm', 'hash', 'hwmap', 'cpu', 'memhier', 'gameloop', 'stackheap', 'code', 'tcp', 'ttl', 'lpm', 'nat', 'switch', 'http', 'tls', 'pcap', 'casefile', 'dork', 'sqli', 'xss', 'logs', 'fstree', 'rgb']);

// Собираем курсы, подсунув заглушку глобального CS, как в браузере.
const courses = [];
const roadmaps = {};
const docs = [];
globalThis.CS = {
  doc(d) { docs.push(d); return d; },
  externalProgress() {},
  course(def) { courses.push(def); return def; },
  viz() {},
  roadmap(track, items) { roadmaps[track] = items; }
};
for (const f of fs.readdirSync(contentDir)) {
  if (f.endsWith('.js')) require(path.join(contentDir, f));
}

test('курсы загрузились', () => {
  assert.ok(courses.length >= 2, 'ожидаем минимум 2 курса (pc, net)');
});

test('id курсов уникальны и валидны', () => {
  const ids = courses.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'дубли id курсов');
  ids.forEach(id => assert.match(id, /^[a-z0-9-]+$/, `плохой id курса: ${id}`));
});

test('id уроков уникальны по всему проекту', () => {
  const ids = [];
  courses.forEach(c => (c.lessons || []).forEach(l => ids.push(l.id)));
  assert.equal(new Set(ids).size, ids.length, 'дубли id уроков');
});

test('каждый курс имеет обязательные поля', () => {
  for (const c of courses) {
    for (const k of ['id', 'title', 'track', 'tagline', 'about', 'lessons']) {
      assert.ok(c[k] != null && c[k] !== '', `курс ${c.id}: нет поля ${k}`);
    }
    assert.ok(Array.isArray(c.lessons) && c.lessons.length > 0, `курс ${c.id}: нет уроков`);
  }
});

test('вопросы диагностики (assess) корректны', () => {
  for (const c of courses) {
    for (const a of (c.assess || [])) {
      assert.ok(a.id && a.q, `${c.id}: assess без id/q`);
      assert.ok(Array.isArray(a.options) && a.options.length >= 2, `${a.id}: мало вариантов`);
      assert.ok(Number.isInteger(a.correct) && a.correct >= 0 && a.correct < a.options.length, `${a.id}: correct вне диапазона`);
      assert.ok([-1, 0, 1].includes(a.b), `${a.id}: b должно быть -1/0/1`);
      assert.ok(a.why, `${a.id}: нет разбора why`);
    }
  }
});

test('каждый шаг урока структурно валиден', () => {
  for (const c of courses) {
    for (const l of c.lessons) {
      assert.ok(l.id && l.title, `${c.id}: урок без id/title`);
      assert.ok(Array.isArray(l.steps) && l.steps.length > 0, `${l.id}: нет шагов`);
      for (const s of l.steps) {
        assert.ok(s.t, `${l.id}: шаг без типа t`);
        switch (s.t) {
          case 'quiz': case 'check':
            if (s.t === 'check' && s.kind === 'input') {
              assert.ok(Array.isArray(s.answers) && s.answers.length, `${l.id}: check/input без answers`);
              assert.ok(s.why, `${l.id}: check без why`);
            } else {
              assert.ok(s.q, `${l.id}: quiz без q`);
              assert.ok(Array.isArray(s.options) && s.options.length >= 2, `${l.id}: quiz мало вариантов`);
              assert.ok(Number.isInteger(s.correct) && s.correct >= 0 && s.correct < s.options.length, `${l.id}: quiz correct вне диапазона`);
              assert.ok(s.why, `${l.id}: quiz без why`);
            }
            break;
          case 'input':
            assert.ok(s.q, `${l.id}: input без q`);
            assert.ok(Array.isArray(s.answers) && s.answers.length, `${l.id}: input без answers`);
            assert.ok(s.why, `${l.id}: input без why`);
            break;
          case 'match':
            assert.ok(Array.isArray(s.pairs) && s.pairs.length >= 2, `${l.id}: match мало пар`);
            s.pairs.forEach(p => assert.ok(Array.isArray(p) && p.length === 2, `${l.id}: пара не [a,b]`));
            assert.ok(s.why, `${l.id}: match без why`);
            break;
          case 'recall':
            assert.ok(s.q, `${l.id}: recall без q`);
            assert.ok(s.model, `${l.id}: recall без эталона model`);
            break;
          case 'viz':
            assert.ok(KNOWN_VIZ.has(s.kind), `${l.id}: неизвестный viz kind "${s.kind}"`);
            break;
          case 'real':
            assert.ok(Array.isArray(s.steps) && s.steps.length, `${l.id}: real без команд`);
            s.steps.forEach(st => assert.ok(st.cmd, `${l.id}: real-команда без cmd`));
            break;
          case 'say':
            assert.ok(s.text, `${l.id}: say без text`);
            break;
          case 'lab':
            assert.ok(Array.isArray(s.tasks) && s.tasks.length, `${l.id}: lab без заданий`);
            s.tasks.forEach(t => assert.ok(t.id && t.text && t.check, `${l.id}: задание без id/text/check`));
            break;
          case 'hook': case 'deep': case 'expert': case 'case':
            assert.ok(s.text, `${l.id}: ${s.t} без text`);
            break;
          default:
            assert.fail(`${l.id}: неизвестный тип шага "${s.t}"`);
        }
      }
    }
  }
});

test('карточки повторения — пары [вопрос, ответ]', () => {
  for (const c of courses) {
    for (const l of c.lessons) {
      for (const card of (l.cards || [])) {
        assert.ok(Array.isArray(card) && card.length === 2 && card[0] && card[1], `${l.id}: битая карточка`);
      }
    }
  }
});

test('каждый урок заканчивается проверкой (retrieval), а не текстом', () => {
  const GATE = new Set(['quiz', 'input', 'match', 'check', 'recall']);
  for (const c of courses) {
    for (const l of c.lessons) {
      const last = l.steps[l.steps.length - 1];
      assert.ok(GATE.has(last.t), `${l.id}: последний шаг типа "${last.t}", а должен быть проверкой`);
    }
  }
});

test('у каждого урока есть хотя бы один интерактивный ретривал и один hook', () => {
  for (const c of courses) {
    for (const l of c.lessons) {
      const types = l.steps.map(s => s.t);
      assert.ok(types.includes('hook'), `${l.id}: нет hook`);
      assert.ok(types.some(t => ['quiz', 'input', 'match', 'check', 'recall'].includes(t)), `${l.id}: нет ретривала`);
    }
  }
});

test('программа (roadmap): элементы валидны и id уникальны в треке', () => {
  for (const track of Object.keys(roadmaps)) {
    const items = roadmaps[track];
    assert.ok(Array.isArray(items) && items.length, `roadmap ${track} пуст`);
    const ids = items.map(i => i.id);
    assert.equal(new Set(ids).size, ids.length, `roadmap ${track}: дубли id`);
    items.forEach(i => {
      assert.ok(i.id && /^[a-z0-9-]+$/.test(i.id), `roadmap ${track}: плохой id ${i.id}`);
      assert.ok(i.title, `roadmap ${track}/${i.id}: нет title`);
      assert.ok(i.goal, `roadmap ${track}/${i.id}: нет goal`);
    });
  }
});

test('каждый реальный курс присутствует в программе своего трека', () => {
  for (const c of courses) {
    const items = roadmaps[c.track] || [];
    assert.ok(items.some(i => i.id === c.id), `курс ${c.id} (трек ${c.track}) отсутствует в roadmap`);
  }
});

test('ссылки в источниках — http(s)', () => {
  for (const c of courses) {
    for (const l of c.lessons) {
      for (const src of (l.sources || [])) {
        assert.ok(src.label && /^https?:\/\//.test(src.url || ''), `${l.id}: плохой источник ${JSON.stringify(src)}`);
      }
    }
  }
});

test('зависимости (needs) в программе ссылаются на существующие темы', () => {
  const all = new Set();
  Object.values(roadmaps).forEach(items => items.forEach(i => all.add(i.id)));
  courses.forEach(c => all.add(c.id));
  for (const track of Object.keys(roadmaps)) {
    for (const i of roadmaps[track]) {
      for (const n of (i.needs || [])) assert.ok(all.has(n), `roadmap ${track}/${i.id}: needs "${n}" не существует`);
    }
  }
  for (const c of courses) for (const n of (c.needs || [])) assert.ok(all.has(n), `курс ${c.id}: needs "${n}" не существует`);
});

test('в программе нет циклов зависимостей', () => {
  const needs = {};
  Object.values(roadmaps).forEach(items => items.forEach(i => { needs[i.id] = i.needs || []; }));
  courses.forEach(c => { if (!needs[c.id]) needs[c.id] = c.needs || []; });
  const state = {};
  const visit = (id, path) => {
    if (state[id] === 2) return;
    assert.notEqual(state[id], 1, 'цикл: ' + path.concat(id).join(' → '));
    state[id] = 1; (needs[id] || []).forEach(n => visit(n, path.concat(id))); state[id] = 2;
  };
  Object.keys(needs).forEach(id => visit(id, []));
});

test('справочник: id уникальны, есть группа, заголовок и текст', () => {
  assert.ok(docs.length >= 8, 'ожидаем минимум 8 справочных статей');
  assert.equal(new Set(docs.map(d => d.id)).size, docs.length, 'дубли id справочника');
  docs.forEach(d => { assert.ok(d.id && d.group && d.title && d.body, `битая статья справочника ${d.id}`); });
});

test('код-задания: у каждого есть fn, тесты и корректная эталонная проверка формата', () => {
  for (const c of courses) for (const l of c.lessons) for (const s of l.steps) {
    if (s.t === 'viz' && s.kind === 'code') {
      assert.ok(s.fn && Array.isArray(s.tests) && s.tests.length >= 2, `${l.id}: code-шаг без fn/tests`);
      s.tests.forEach(t => assert.ok(Array.isArray(t.args) && 'expect' in t, `${l.id}: плохой тест`));
    }
  }
});
