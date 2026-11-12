/* CYBER SEC — виджеты «железо и программы»: hwmap, cpu, memhier, gameloop, stackheap, code.
   Регистрируются через CS.viz(kind, render(box, step)). */
(function () {
  'use strict';
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }
  function html(el, str) { el.innerHTML = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'); return el; }

  // ---------- hwmap: интерактивная схема компьютера с потоками данных ----------
  CS.viz('hwmap', function (box) {
    var C = {
      cpu:  { n: 'Процессор (CPU)', x: 250, y: 120, w: 130, h: 90, c: '#2ee6a6', role: 'Мозг: выполняет инструкции программ. Несколько мощных ядер, каждое делает дела строго по очереди, но очень быстро (миллиарды тактов в секунду).', analogy: 'Шеф-повар: умеет всё, но готовит блюда по одному.', nums: 'Частота 3–6 ГГц · 4–24 ядра · кэш L1/L2/L3 внутри кристалла' },
      ram:  { n: 'Оперативная память (RAM)', x: 440, y: 40, w: 150, h: 60, c: '#38bdf8', role: 'Рабочий стол процессора: тут лежит всё, с чем программы работают прямо сейчас. Быстрая, но стирается при выключении питания.', analogy: 'Рабочий стол: что на нём — под рукой мгновенно, но стол не архив.', nums: '~80 нс доступ · DDR5 ≈ 50–90 ГБ/с · 16–64 ГБ в ПК' },
      gpu:  { n: 'Видеокарта (GPU)', x: 440, y: 135, w: 150, h: 70, c: '#a78bfa', role: 'Тысячи простых ядер для массовой параллельной работы: считает цвет миллионов пикселей, а также нейросети и майнинг. Имеет свою быструю память (VRAM).', analogy: 'Тысяча поваров-стажёров: каждый умеет мало, но все режут овощи одновременно.', nums: '5 000–16 000 ядер · VRAM 8–24 ГБ · ≈ 500–1000 ГБ/с внутри' },
      ssd:  { n: 'Накопитель (SSD/HDD)', x: 440, y: 235, w: 150, h: 60, c: '#f5b84f', role: 'Долгая память: файлы, ОС, игры. Не стирается без питания. SSD на флеш-памяти, HDD — вращающиеся пластины (на порядки медленнее).', analogy: 'Склад: вместительный, но за каждой вещью надо идти.', nums: 'NVMe ≈ 3–7 ГБ/с · ~80 мкс · HDD ≈ 10 мс доступ' },
      net:  { n: 'Сетевая карта (LAN/Wi-Fi)', x: 40, y: 235, w: 150, h: 60, c: '#f0607a', role: 'Превращает данные в сигнал по кабелю или радио и обратно. Умеет отправлять/принимать кадры Ethernet/Wi-Fi.', analogy: 'Почтовое окно: принимает и отправляет посылки наружу.', nums: '1–2.5 Гбит/с Ethernet · Wi-Fi 6/7 · MAC-адрес зашит в карту' },
      psu:  { n: 'Блок питания (PSU)', x: 40, y: 40, w: 150, h: 60, c: '#e7edf4', role: 'Превращает 220 В из розетки в 12 В / 5 В / 3.3 В для компонентов. Слабый или дешёвый БП — причина случайных перезагрузок и поломок.', analogy: 'Сердце, качающее кровь (электричество) по всем органам.', nums: '450–1000 Вт · сертификаты 80+ Bronze…Titanium' },
      cool: { n: 'Охлаждение', x: 40, y: 135, w: 150, h: 70, c: '#6b7a8d', role: 'Радиатор и вентиляторы отводят тепло. Перегретый CPU/GPU сам снижает частоту (throttling) — отсюда внезапные просадки FPS.', analogy: 'Пот и вентиляция: чтобы не сгореть под нагрузкой.', nums: 'CPU под нагрузкой 60–90 °C · >95–100 °C = троттлинг' }
    };
    var wires = [['cpu', 'ram', 'DDR5'], ['cpu', 'gpu', 'PCIe x16'], ['cpu', 'ssd', 'PCIe / NVMe'], ['cpu', 'net', 'чипсет'], ['psu', 'cpu', '12 В'], ['cool', 'cpu', 'тепло →']];
    var svg = s('svg', { viewBox: '0 0 640 330', class: 'hwsvg', role: 'img' });
    svg.appendChild(s('rect', { x: 14, y: 14, width: 612, height: 302, rx: 18, class: 'hw-board' }));
    svg.appendChild(s('text', { x: 28, y: 32, class: 'hw-cap' }, 'МАТЕРИНСКАЯ ПЛАТА — всё соединено шинами'));
    function ctr(k) { return [C[k].x + C[k].w / 2, C[k].y + C[k].h / 2]; }
    wires.forEach(function (w) {
      var a = ctr(w[0]), b = ctr(w[1]);
      svg.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'hw-wire' }));
      svg.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'hw-flow' }));
    });
    var info = h('div', 'hw-info');
    function show(k) {
      var c = C[k]; clear(info);
      info.appendChild(h('div', 'hw-name', c.n));
      info.appendChild(html(h('p'), c.role));
      info.appendChild(html(h('p', 'hw-an'), '**Аналогия:** ' + c.analogy));
      info.appendChild(html(h('p', 'hw-nums'), c.nums));
      Array.prototype.forEach.call(svg.querySelectorAll('.hw-node'), function (n) { n.classList.toggle('on', n.getAttribute('data-k') === k); });
    }
    Object.keys(C).forEach(function (k) {
      var c = C[k], g = s('g', { class: 'hw-node', 'data-k': k, tabindex: 0 });
      g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 12, stroke: c.c }));
      g.appendChild(s('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + 4, 'text-anchor': 'middle' }, c.n.split(' (')[0]));
      g.onclick = function () { show(k); };
      g.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(k); } };
      svg.appendChild(g);
    });
    box.appendChild(svg); box.appendChild(info);
    box.appendChild(h('div', 'viz-hint', 'Нажимай на компоненты. Бегущие точки на линиях — данные, которые идут по шинам.'));
    show('cpu');
  });

  // ---------- cpu: цикл fetch → decode → execute ----------
  CS.viz('cpu', function (box) {
    var prog = [['LOAD A, 3', 'A ← 3'], ['LOAD B, 0', 'B ← 0'], ['ADD B, A', 'B ← B + A'], ['DEC A', 'A ← A − 1'], ['JNZ 2', 'если A ≠ 0 → перейти на 2'], ['STORE [0], B', 'память[0] ← B'], ['HALT', 'стоп']];
    var st;
    function reset() { st = { pc: 0, A: 0, B: 0, Z: 0, mem: 0, stage: 0, ir: null, halted: false, ticks: 0 }; }
    reset();
    var STG = ['1. FETCH — взять инструкцию из памяти по адресу PC', '2. DECODE — понять, что она значит', '3. EXECUTE — выполнить и записать результат'];
    var left = h('div', 'cpu-prog'), right = h('div', 'cpu-state'), stg = h('div', 'cpu-stage'), btns = h('div', 'viz-btns');
    var bStep = h('button', 'btn primary', 'Шаг ▸'), bAuto = h('button', 'btn ghost', 'Прогнать до конца'), bReset = h('button', 'btn ghost', 'Сначала');
    btns.appendChild(bStep); btns.appendChild(bAuto); btns.appendChild(bReset);
    function draw() {
      clear(left); clear(right);
      prog.forEach(function (p, i) { var r = h('div', 'cpu-line' + (i === st.pc && !st.halted ? ' cur' : '')); r.appendChild(h('span', 'cpu-n', String(i))); r.appendChild(h('span', 'cpu-i', p[0])); r.appendChild(h('span', 'cpu-c', '; ' + p[1])); left.appendChild(r); });
      [['PC', st.pc], ['A', st.A], ['B', st.B], ['флаг Z', st.Z], ['память[0]', st.mem], ['тактов', st.ticks]].forEach(function (kv) { var b = h('div', 'rb'); b.appendChild(h('span', 'rb-k', kv[0])); b.appendChild(h('span', 'rb-v', String(kv[1]))); right.appendChild(b); });
      stg.textContent = st.halted ? '■ HALT — программа завершена. Итог в память[0] = ' + st.mem + ' (3+2+1).' : STG[st.stage] + (st.ir ? '   ·   IR = «' + st.ir + '»' : '');
      bStep.disabled = st.halted;
    }
    function step() {
      if (st.halted) return;
      st.ticks++;
      if (st.stage === 0) { st.ir = prog[st.pc][0]; st.stage = 1; }
      else if (st.stage === 1) { st.stage = 2; }
      else {
        var p = st.ir.split(/[ ,]+/), op = p[0];
        var next = st.pc + 1;
        if (op === 'LOAD') st[p[1]] = +p[2];
        else if (op === 'ADD') { st[p[1]] += st[p[2]]; }
        else if (op === 'DEC') { st[p[1]] -= 1; st.Z = st[p[1]] === 0 ? 1 : 0; }
        else if (op === 'JNZ') { if (!st.Z) next = +p[1]; }
        else if (op === 'STORE') st.mem = st.B;
        else if (op === 'HALT') { st.halted = true; }
        st.pc = st.halted ? st.pc : next; st.stage = 0; st.ir = null;
      }
      draw();
    }
    bStep.onclick = step;
    bAuto.onclick = function () { var n = 0; while (!st.halted && n++ < 200) step(); };
    bReset.onclick = function () { reset(); draw(); };
    var row = h('div', 'cpu-row'); row.appendChild(left); row.appendChild(right);
    box.appendChild(row); box.appendChild(stg); box.appendChild(btns);
    box.appendChild(h('div', 'viz-hint', 'Каждая инструкция = 3 фазы. Заметь, что `JNZ` двигает PC назад — так в железе рождаются циклы.'.replace(/`/g, '')));
    draw();
  });

  // ---------- memhier: лестница задержек ----------
  CS.viz('memhier', function (box) {
    var L = [['Регистр CPU', 0.3], ['Кэш L1', 1], ['Кэш L2', 4], ['Кэш L3', 15], ['Оперативная память', 80], ['NVMe SSD', 80000], ['SATA SSD', 150000], ['HDD', 10000000], ['Сеть (другой город)', 100000000]];
    var human = false;
    function fmtNs(ns) { if (ns < 1000) return ns + ' нс'; if (ns < 1e6) return (ns / 1e3) + ' мкс'; if (ns < 1e9) return (ns / 1e6) + ' мс'; return (ns / 1e9) + ' с'; }
    function fmtH(sec) { var u = [['лет', 31536000], ['мес.', 2592000], ['сут.', 86400], ['ч', 3600], ['мин', 60], ['с', 1]]; for (var i = 0; i < u.length; i++) if (sec >= u[i][1]) return (Math.round(sec / u[i][1] * 10) / 10) + ' ' + u[i][0]; return sec.toFixed(1) + ' с'; }
    var wrap = h('div', 'mh'), tog = h('button', 'btn ghost', 'Показать в «человеческом» масштабе (1 нс = 1 секунда)');
    function draw() {
      clear(wrap);
      var max = Math.log10(1e8 / 0.3);
      L.forEach(function (r) {
        var row = h('div', 'mh-row'), w = Math.max(3, Math.log10(r[1] / 0.3) / max * 100);
        row.appendChild(h('div', 'mh-n', r[0]));
        var bar = h('div', 'mh-bar'), f = h('div', 'mh-fill'); f.style.width = w + '%'; bar.appendChild(f); row.appendChild(bar);
        row.appendChild(h('div', 'mh-v', human ? fmtH(r[1]) : fmtNs(r[1])));
        wrap.appendChild(row);
      });
      tog.textContent = human ? 'Показать реальные наносекунды' : 'Показать в «человеческом» масштабе (1 нс = 1 секунда)';
    }
    tog.onclick = function () { human = !human; draw(); };
    box.appendChild(wrap); box.appendChild(tog);
    box.appendChild(h('div', 'viz-hint', 'Шкала логарифмическая — иначе HDD просто не влез бы. Переключи масштаб: если кэш L1 — это 1 секунда, то HDD — это месяцы.'));
    draw();
  });

  // ---------- gameloop: кадр = max(CPU, GPU), узкое место, FPS ----------
  CS.viz('gameloop', function (box) {
    var cpu = 8, gpu = 14, cap = 0;
    var ctl = h('div', 'gl-ctl'), out = h('div', 'gl-out'), track = h('div', 'gl-track'), dot = h('div', 'gl-dot'), bars = h('div', 'gl-bars');
    track.appendChild(dot);
    function slider(label, min, max, val, cb) {
      var w = h('label', 'gl-s'), t = h('span', null, label), v = h('b', null, val + ' мс'), inp = h('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.value = val;
      inp.oninput = function () { v.textContent = inp.value + ' мс'; cb(+inp.value); calc(); };
      w.appendChild(t); w.appendChild(inp); w.appendChild(v); return w;
    }
    ctl.appendChild(slider('Работа CPU на кадр (логика, физика, ИИ, драйвер)', 2, 40, cpu, function (v) { cpu = v; }));
    ctl.appendChild(slider('Работа GPU на кадр (пиксели, тени, разрешение)', 2, 40, gpu, function (v) { gpu = v; }));
    var capW = h('label', 'gl-s'); capW.appendChild(h('span', null, 'Лимит FPS (V-Sync / кап)'));
    var sel = h('select'); [['0', 'без лимита'], ['60', '60'], ['144', '144']].forEach(function (o) { var op = h('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    sel.onchange = function () { cap = +sel.value; calc(); }; capW.appendChild(sel); ctl.appendChild(capW);
    var fps = 60, interval = 16.7;
    function calc() {
      var frame = Math.max(cpu, gpu), raw = 1000 / frame; fps = cap ? Math.min(raw, cap) : raw; interval = 1000 / fps;
      var bott = Math.abs(cpu - gpu) < 1.5 ? 'сбалансировано' : (cpu > gpu ? 'узкое место — CPU (смена графики FPS почти не поднимет)' : 'узкое место — GPU (снизь разрешение/тени — FPS вырастет)');
      clear(out);
      [['Время кадра', frame.toFixed(1) + ' мс'], ['FPS', fps.toFixed(0)], ['Диагноз', bott]].forEach(function (kv) { var b = h('div', 'rb'); b.appendChild(h('span', 'rb-k', kv[0])); b.appendChild(h('span', 'rb-v', kv[1])); out.appendChild(b); });
      clear(bars);
      [['CPU', cpu, '#2ee6a6'], ['GPU', gpu, '#a78bfa']].forEach(function (b) { var r = h('div', 'gl-bar'); r.appendChild(h('span', null, b[0])); var f = h('i'); f.style.width = (b[1] / 40 * 100) + '%'; f.style.background = b[2]; r.appendChild(f); bars.appendChild(r); });
    }
    var x = 0, dir = 1, last = performance.now(), acc = 0;
    function tick(now) {
      if (!box.isConnected) return;
      acc += now - last; last = now;
      if (acc >= interval) { acc = acc % interval; x += dir * 6; if (x > 96) { x = 96; dir = -1; } if (x < 0) { x = 0; dir = 1; } dot.style.left = x + '%'; }
      requestAnimationFrame(tick);
    }
    box.appendChild(ctl); box.appendChild(out); box.appendChild(bars); box.appendChild(track);
    box.appendChild(h('div', 'viz-hint', 'Кадр готов, когда готовы И CPU, И GPU: время кадра = max(CPU, GPU). Шарик внизу двигается с реальной частотой кадров — почувствуй разницу 30 и 144.'));
    calc(); requestAnimationFrame(tick);
  });

  // ---------- stackheap: стек и куча по шагам ----------
  CS.viz('stackheap', function (box) {
    var code = ['function square(n) { return n * n }', 'function main() {', '  let x = 5', '  let list = [1, 2, 3]', '  let y = square(x)', '}', 'main()'];
    var S = [
      { line: 6, stack: [['main', '']], heap: [], note: 'Вызов main(): на **стек** кладётся кадр функции — место под её локальные переменные.' },
      { line: 2, stack: [['main', 'x = 5']], heap: [], note: 'Число `x` маленькое и фиксированного размера — лежит прямо в кадре на стеке.' },
      { line: 3, stack: [['main', 'x = 5\nlist → #1']], heap: [['#1', '[1, 2, 3]']], note: 'Массив может расти, поэтому его данные — в **куче**. В кадре на стеке лишь ссылка (адрес) `→ #1`.' },
      { line: 4, stack: [['main', 'x = 5\nlist → #1'], ['square', 'n = 5']], heap: [['#1', '[1, 2, 3]']], note: 'Вызов square(5): сверху на стек ложится новый кадр. Стек растёт и сжимается по принципу LIFO.' },
      { line: 4, stack: [['main', 'x = 5\nlist → #1\ny = 25']], heap: [['#1', '[1, 2, 3]']], note: 'Функция вернула 25 — её кадр **мгновенно исчез** (указатель стека сдвинулся). Это дёшево.' },
      { line: 5, stack: [], heap: [['#1', '[1, 2, 3] ← никто не ссылается']], note: 'main закончилась — кадр снят. Объект в куче остался, но ссылок на него нет: его уберёт сборщик мусора (GC) или, в C/Rust, он освобождается вручную/по правилам владения. Забыл освободить — **утечка памяти**.' }
    ];
    var i = 0, cl = h('div', 'sh-code'), stk = h('div', 'sh-col'), hp = h('div', 'sh-col'), note = h('div', 'sh-note'), btns = h('div', 'viz-btns');
    var nx = h('button', 'btn primary', 'Следующий шаг ▸'), rs = h('button', 'btn ghost', 'Сначала');
    btns.appendChild(nx); btns.appendChild(rs);
    function draw() {
      var s0 = S[i]; clear(cl); clear(stk); clear(hp);
      code.forEach(function (l, k) { var r = h('div', 'cpu-line' + (k === s0.line ? ' cur' : '')); r.appendChild(h('span', 'cpu-n', String(k + 1))); r.appendChild(h('span', 'cpu-i', l)); cl.appendChild(r); });
      stk.appendChild(h('div', 'sh-h', 'СТЕК (вверх растёт)'));
      s0.stack.slice().reverse().forEach(function (f) { var b = h('div', 'sh-frame'); b.appendChild(h('b', null, f[0] + '()')); b.appendChild(h('pre', null, f[1])); stk.appendChild(b); });
      if (!s0.stack.length) stk.appendChild(h('div', 'sh-empty', '— пусто —'));
      hp.appendChild(h('div', 'sh-h', 'КУЧА'));
      s0.heap.forEach(function (o) { var b = h('div', 'sh-obj'); b.appendChild(h('b', null, o[0])); b.appendChild(h('span', null, ' ' + o[1])); hp.appendChild(b); });
      if (!s0.heap.length) hp.appendChild(h('div', 'sh-empty', '— пусто —'));
      html(clear(note) || note, s0.note); nx.disabled = i === S.length - 1;
    }
    nx.onclick = function () { if (i < S.length - 1) { i++; draw(); } };
    rs.onclick = function () { i = 0; draw(); };
    var row = h('div', 'sh-row'); row.appendChild(cl); row.appendChild(stk); row.appendChild(hp);
    box.appendChild(row); box.appendChild(note); box.appendChild(btns); draw();
  });

  // ---------- code: мини-IDE с автотестами ----------
  var xpGiven = {};
  CS.viz('code', function (box, step) {
    var fn = step.fn || 'solve', tests = step.tests || [];
    box.appendChild(h('div', 'code-task', step.title || 'Задание'));
    if (step.text) html(box.appendChild(h('p', 'code-text')), step.text);
    var ta = h('textarea', 'code-ta'); ta.spellcheck = false; ta.value = step.starter || ('function ' + fn + '() {\n  \n}');
    ta.rows = Math.max(7, ta.value.split('\n').length + 2);
    ta.onkeydown = function (e) { if (e.key === 'Tab') { e.preventDefault(); var a = ta.selectionStart; ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = a + 2; } };
    var res = h('div', 'code-res'), btns = h('div', 'viz-btns');
    var run = h('button', 'btn primary', '▶ Запустить тесты'), rst = h('button', 'btn ghost', 'Сбросить код'), sol = h('button', 'btn ghost', 'Показать подсказку');
    var hints = step.hints || (step.hint ? [step.hint] : []), hi = 0;
    btns.appendChild(run); btns.appendChild(rst); if (hints.length) btns.appendChild(sol);
    var hintBox = h('div', 'viz-hint'); hintBox.style.display = 'none';
    sol.textContent = 'Подсказка' + (hints.length > 1 ? ' (1/' + hints.length + ')' : '');
    sol.onclick = function () { hintBox.style.display = 'block'; html(hintBox, '**Подсказка ' + (hi + 1) + (hints.length > 1 ? ' из ' + hints.length : '') + ':** ' + hints[hi]); if (hi < hints.length - 1) { hi++; sol.textContent = 'Ещё подсказка (' + (hi + 1) + '/' + hints.length + ')'; } else sol.textContent = 'Это последняя подсказка'; };
    rst.onclick = function () { ta.value = step.starter || ''; clear(res); };
    var WSRC = 'onmessage=function(e){var d=e.data,out=[];try{var f=new Function(d.code+"\\nreturn "+d.fn+";")();for(var i=0;i<d.tests.length;i++){try{var g=f.apply(null,JSON.parse(JSON.stringify(d.tests[i].args)));out.push({got:JSON.stringify(g)})}catch(x){out.push({err:String(x)})}}}catch(x){out=[{fatal:String(x)}]}postMessage(out)}';
    function show(out) {
      clear(res);
      if (out[0] && out[0].fatal) { res.appendChild(h('div', 'code-bad', 'Ошибка в коде: ' + out[0].fatal)); return; }
      var ok = 0;
      tests.forEach(function (t, i) {
        var o = out[i] || {}, want = JSON.stringify(t.expect), pass = o.got === want; if (pass) ok++;
        var r = h('div', pass ? 'code-ok' : 'code-bad');
        r.textContent = (pass ? '✓ ' : '✗ ') + fn + '(' + t.args.map(function (a) { return JSON.stringify(a); }).join(', ') + ') → ' + (o.err ? 'ошибка: ' + o.err : o.got) + (pass ? '' : '   (ждали ' + want + ')');
        res.appendChild(r);
      });
      var sum = h('div', ok === tests.length ? 'code-sum good' : 'code-sum', ok === tests.length ? '🎉 Все тесты пройдены (' + ok + '/' + tests.length + ')' : 'Пройдено ' + ok + ' из ' + tests.length);
      res.appendChild(sum);
      if (ok === tests.length) { var key = step.id || step.title; if (!xpGiven[key]) { xpGiven[key] = 1; try { CS.addXP(10); } catch (e) {} } }
    }
    function runSync() {
      try { var f = new Function(ta.value + '\nreturn ' + fn + ';')(); show(tests.map(function (t) { try { return { got: JSON.stringify(f.apply(null, JSON.parse(JSON.stringify(t.args)))) }; } catch (x) { return { err: String(x) }; } })); }
      catch (x) { show([{ fatal: String(x) }]); }
    }
    run.onclick = function () {
      clear(res);
      if (ta.value.indexOf('___') > -1) { res.appendChild(h('div', 'code-bad', 'Сначала замени «___» на нужный код — это пропуск, который надо дописать. Нужна помощь — нажми «Подсказка».')); return; }
      res.appendChild(h('div', 'muted', 'Запускаю…'));
      var w, done = false;
      try {
        w = new Worker(URL.createObjectURL(new Blob([WSRC], { type: 'application/javascript' })));
        var tm = setTimeout(function () { if (done) return; done = true; w.terminate(); clear(res); res.appendChild(h('div', 'code-bad', 'Превышено время (2 с) — похоже на бесконечный цикл.')); }, 2000);
        w.onmessage = function (e) { if (done) return; done = true; clearTimeout(tm); w.terminate(); show(e.data); };
        w.onerror = function () { if (done) return; done = true; clearTimeout(tm); runSync(); };
        w.postMessage({ code: ta.value, fn: fn, tests: tests });
      } catch (e) { runSync(); }
    };
    box.appendChild(ta); box.appendChild(btns); box.appendChild(hintBox); box.appendChild(res);
  });
})();
