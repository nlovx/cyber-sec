// Печатает уроки так, как их видит ученик (текст шагов подряд). Использование:
//   node tools/dump-lesson.mjs pc            — все уроки курса pc
//   node tools/dump-lesson.mjs pc pc-binary  — один урок
// Нужен для проверки «глазами новичка» (в том числе другими агентами) без браузера.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const courses = [];
globalThis.CS = { course(d) { courses.push(d); }, doc() {}, viz() {}, roadmap() {}, externalProgress() {} };
for (const f of fs.readdirSync(path.join(root, 'content'))) if (f.endsWith('.js')) require(path.join(root, 'content', f));
const [cid, lid] = process.argv.slice(2);
const mode = process.env.MODE || 'core';
const strip = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '');
const c = courses.find((x) => x.id === cid);
if (!c) { console.log('Курсы:', courses.map((x) => x.id).join(', ')); process.exit(0); }
console.log(`# КУРС: ${c.title}\n${strip(c.about)}\n`);
for (const l of c.lessons) {
  if (lid && l.id !== lid) continue;
  console.log(`\n=================== УРОК: ${l.title} (${l.minutes} мин) ===================\n${strip(l.subtitle)}\n`);
  const types = l.steps.map((s) => s.t);
  console.log(`[Карточка урока: шагов ${l.steps.length}, вопросов ${types.filter((t) => ['quiz', 'input', 'match', 'check', 'recall'].includes(t)).length}]`);
  console.log('Ключевые понятия урока: ' + (l.cards || []).map((x) => x[0]).join(' | ') + '\n');
  let n = 0;
  for (const s of l.steps) {
    if (s.t === 'expert' && mode !== 'deep') continue;
    if (s.t === 'deep' && mode === 'foundation') continue;
    n++;
    const head = `--- [${n}] ${s.t.toUpperCase()}${s.title ? ': ' + strip(s.title) : ''}${s.kind ? ' (интерактивный виджет: ' + s.kind + ')' : ''}`;
    console.log(head);
    if (s.simple) console.log('ПО-ПРОСТОМУ: ' + strip(s.simple));
    if (s.text) console.log(strip(s.text));
    if (s.q) console.log('ВОПРОС: ' + strip(s.q) + (s.ctx ? '\n(контекст: ' + strip(s.ctx) + ')' : ''));
    if (s.options) s.options.forEach((o, i) => console.log(`  ${i + 1}) ${strip(o)}`));
    if (s.pairs) { console.log('СОПОСТАВЬ:'); s.pairs.forEach((p) => console.log(`  ${strip(p[0])}  ↔  ${strip(p[1])}`)); }
    if (s.steps) s.steps.forEach((x) => console.log(`  $ ${x.cmd}\n    ${strip(x.text)}`));
    if (s.tasks) s.tasks.forEach((t, i) => console.log(`  Задание ${i + 1}: ${strip(t.text)}`));
    if (s.why) console.log('ОТВЕТ/ПОЯСНЕНИЕ (скрыто до ответа): ' + strip(s.why));
    console.log('');
  }
}
