/* CYBER SEC — экраны «Карта знаний» (анимированный граф) и «Справочник». */
(function () {
  'use strict';
  var U = window.CSUI && window.CSUI.helpers;
  if (!U) return;
  var h = U.h, clear = U.clear;
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }

  var TRACK_COLOR = {};

  // ---------- Граф: узлы, рёбра, раскладка ----------
  function buildGraph() {
    var nodes = [], byId = {}, tracks = CS.allTracks().filter(function (t) { return CS.trackCatalog(t).length; });
    tracks.forEach(function (t) {
      var cat = CS.trackCatalog(t), prev = null;
      cat.forEach(function (it) {
        var course = CS.getCourse(it.id);
        var n = { id: it.id, track: t, title: it.title, goal: it.goal || '', ready: !!it.ready, href: it.href || (it.ready && course ? '#/course/' + it.id : '#/track/' + t), needs: (it.needs || (course && course.needs) || []).slice(), item: it, lessons: course ? course.lessons.length : 0 };
        if (it.explicitNeeds === false) n.needs = [];
        n._prevInTrack = prev; nodes.push(n); byId[n.id] = n; prev = n;
      });
    });
    // Недостающие связи: линейная цепочка внутри трека; первый узел трека — от последних готовых узлов трека-пререквизита.
    nodes.forEach(function (n) {
      n.needs = n.needs.filter(function (id) { return byId[id]; });
      if (!n.needs.length) {
        if (n._prevInTrack) n.needs = [n._prevInTrack.id];
        else (CS.trackMeta(n.track).needs || []).forEach(function (pt) { var cat = nodes.filter(function (x) { return x.track === pt; }); var anchor = cat.filter(function (x) { return x.ready; }).pop() || cat[0]; if (anchor) n.needs.push(anchor.id); });
      }
    });
    // Глубина (длиннейший путь), защита от циклов.
    var depth = {};
    function d(n, stack) { if (depth[n.id] != null) return depth[n.id]; if (stack.indexOf(n.id) > -1) return 0; stack.push(n.id); var m = 0; n.needs.forEach(function (id) { m = Math.max(m, d(byId[id], stack) + 1); }); stack.pop(); depth[n.id] = m; return m; }
    nodes.forEach(function (n) { n.depth = d(n, []); });
    return { nodes: nodes, byId: byId, tracks: tracks };
  }

  function nodeState(n) {
    if (!n.ready) return 'soon';
    var p = n.item && n.item.href ? CS.itemProgress(n.item) : CS.courseProgress(n.id);
    if (p && p.pct === 100) return 'done';
    return 'ready';
  }

  function viewMap() {
    U.renderChrome();
    var app = U.getApp(); clear(app);
    app.appendChild(U.crumbs([['Главная', '#/'], ['Карта знаний', null]]));

    var G = buildGraph();
    var NW = 176, NH = 46, CW = 224, PAD = 30, LAB = 28;

    // Полосы (lane) по трекам: высота = макс. число узлов в одной колонке этого трека.
    var lanes = {}, y = PAD;
    G.tracks.forEach(function (t) {
      var cols = {}, mx = 1; G.nodes.filter(function (n) { return n.track === t; }).forEach(function (n) { cols[n.depth] = (cols[n.depth] || 0) + 1; mx = Math.max(mx, cols[n.depth]); });
      lanes[t] = { y: y, h: LAB + mx * (NH + 14) + 10, count: {} }; y += lanes[t].h + 12;
    });
    var maxDepth = 0; G.nodes.forEach(function (n) { maxDepth = Math.max(maxDepth, n.depth); });
    var W = PAD * 2 + (maxDepth + 1) * CW, H = y + PAD;
    G.nodes.forEach(function (n) { var L = lanes[n.track]; var k = L.count[n.depth] = (L.count[n.depth] || 0) + 1; n.x = PAD + n.depth * CW; n.y = L.y + LAB + (k - 1) * (NH + 14); });

    // Шапка с motion-фоном.
    var hero = h('section', 'map-hero');
        hero.appendChild(h('h1', null, 'Карта знаний'));
    hero.appendChild(h('p', null, 'Весь путь на одном экране: общий фундамент слева, дальше ветвление по специализациям. Бегущие линии — зависимости. Нажми на узел, чтобы открыть курс; наведи — подсветится путь к нему.'));
    var tools = h('div', 'map-tools'); hero.appendChild(tools);
    var leg = h('div', 'map-legend');
    [['#2ee6a6', 'готово к прохождению'], ['rgba(46,230,166,.45)', 'пройдено'], ['#3b4a5e', 'скоро (в плане)']].forEach(function (l) { var sp = h('span'); var i = h('i'); i.style.background = l[0]; sp.appendChild(i); sp.appendChild(document.createTextNode(l[1])); leg.appendChild(sp); });
    var stat = G.nodes.filter(function (n) { return n.ready; }).length; leg.appendChild(h('span', null, 'Готово тем: ' + stat + ' из ' + G.nodes.length));
    hero.appendChild(leg); app.appendChild(hero);

    var wrap = h('div', 'map-scroll'); var tip = h('div', 'map-tip'); document.body.appendChild(tip);
    var zoom = 1, svg = s('svg', { class: 'gmap', viewBox: '0 0 ' + W + ' ' + H });
    function applyZoom() { svg.setAttribute('width', Math.round(W * zoom)); svg.setAttribute('height', Math.round(H * zoom)); }

    var defs = s('defs'); svg.appendChild(defs);
    G.tracks.forEach(function (t) {
      var L = lanes[t], c = TRACK_COLOR[t] || '#8a8a93';
      svg.appendChild(s('rect', { class: 'lane', x: 8, y: L.y, width: W - 16, height: L.h, rx: 14 }));
      var lt = s('text', { class: 'lane-t', x: 22, y: L.y + 19, fill: c }, CS.trackMeta(t).glyph + '  ' + CS.trackMeta(t).name.toUpperCase()); svg.appendChild(lt);
    });
    var edgeEls = [];
    var gE = s('g'); svg.appendChild(gE);
    G.nodes.forEach(function (n) {
      n.needs.forEach(function (id) {
        var a = G.byId[id], x1 = a.x + NW, y1 = a.y + NH / 2, x2 = n.x, y2 = n.y + NH / 2, mx = (x1 + x2) / 2;
        var p = s('path', { class: 'edge' + (a.ready && n.ready ? ' go' : ''), d: 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 });
        gE.appendChild(p); edgeEls.push({ el: p, from: a.id, to: n.id });
      });
    });
    var nodeEls = {};
    var gN = s('g'); svg.appendChild(gN);
    G.nodes.forEach(function (n) {
      var st = nodeState(n), c = TRACK_COLOR[n.track] || '#8a8a93';
      var g = s('g', { class: 'gn ' + st, transform: 'translate(' + n.x + ',' + n.y + ')', style: 'color:' + c, tabindex: 0 });
      g.appendChild(s('rect', { width: NW, height: NH, rx: 11, stroke: c }));
      var title = n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title;
      g.appendChild(s('text', { x: 12, y: 20 }, title));
      var sub = st === 'soon' ? 'скоро' : (st === 'done' ? '✓ пройдено' : (n.lessons ? n.lessons + ' ур.' : 'играть'));
      g.appendChild(s('text', { class: 'sub', x: 12, y: 36 }, sub));
      g.appendChild(s('circle', { cx: NW - 14, cy: 14, r: 4, fill: st === 'soon' ? '#3b4a5e' : c }));
      g.onclick = function () { if (n.href.indexOf('http') === 0 || n.href.indexOf('cryptolab') === 0) location.href = n.href; else location.hash = n.href.replace(/^#/, ''); };
      g.onkeydown = function (e) { if (e.key === 'Enter') g.onclick(); };
      g.onmouseenter = function (e) { highlight(n); tip.innerHTML = ''; tip.appendChild(h('b', null, n.title)); tip.appendChild(h('span', null, n.goal || CS.trackMeta(n.track).blurb)); tip.appendChild(h('em', null, CS.trackMeta(n.track).name + (n.ready ? '' : ' · в плане'))); tip.style.display = 'block'; };
      g.onmousemove = function (e) { tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 340) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; };
      g.onmouseleave = function () { highlight(null); tip.style.display = 'none'; };
      gN.appendChild(g); nodeEls[n.id] = g;
    });
    function highlight(n) {
      if (!n) { edgeEls.forEach(function (e) { e.el.classList.remove('dim', 'hl'); }); Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove('dim'); }); return; }
      var anc = {}; anc[n.id] = 1;
      (function up(x) { x.needs.forEach(function (id) { if (!anc[id]) { anc[id] = 1; up(G.byId[id]); } }); })(n);
      var desc = {}; (function down(x) { G.nodes.forEach(function (m) { if (m.needs.indexOf(x.id) > -1 && !desc[m.id]) { desc[m.id] = 1; down(m); } }); })(n);
      edgeEls.forEach(function (e) { var on = (anc[e.from] && anc[e.to]) || (desc[e.to] && (desc[e.from] || e.from === n.id)); e.el.classList.toggle('hl', !!on); e.el.classList.toggle('dim', !on); });
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.toggle('dim', !(anc[k] || desc[k])); });
    }
    wrap.appendChild(svg); app.appendChild(wrap); applyZoom();

    // Инструменты: масштаб + прыжок к треку.
    [['−', -0.15], ['+', 0.15]].forEach(function (z) { var b = h('button', 'map-chip', 'Масштаб ' + z[0]); b.onclick = function () { zoom = Math.max(.4, Math.min(1.6, zoom + z[1])); applyZoom(); }; tools.appendChild(b); });
    G.tracks.forEach(function (t) { var b = h('button', 'map-chip', CS.trackMeta(t).glyph + ' ' + CS.trackMeta(t).name); b.onclick = function () { wrap.scrollTo({ top: lanes[t].y * zoom - 10, behavior: 'smooth' }); }; tools.appendChild(b); });
    // Перетаскивание мышью.
    var drag = null;
    wrap.onmousedown = function (e) { if (e.target.closest && e.target.closest('.gn')) return; drag = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop }; wrap.classList.add('drag'); };
    window.addEventListener('mouseup', function () { drag = null; wrap.classList.remove('drag'); });
    wrap.onmousemove = function (e) { if (!drag) return; wrap.scrollLeft = drag.sl - (e.clientX - drag.x); wrap.scrollTop = drag.st - (e.clientY - drag.y); };
    window.addEventListener('hashchange', function () { tip.remove(); }, { once: true });
    app.appendChild(U.footer());
  }

  // Анимированный фон: плывущие точки с линиями (motion graphics).
  function startParticles(cv, host) {
    var ctx = cv.getContext('2d'), P = [], w = 0, hh = 0;
    function size() { w = cv.width = host.clientWidth; hh = cv.height = host.clientHeight; }
    size();
    for (var i = 0; i < 46; i++) P.push({ x: Math.random() * w, y: Math.random() * hh, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, c: ['#2ee6a6', '#38bdf8', '#a78bfa'][i % 3] });
    (function frame() {
      if (!cv.isConnected) return;
      ctx.clearRect(0, 0, w, hh);
      for (var i = 0; i < P.length; i++) {
        var p = P[i]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > hh) p.vy *= -1;
        for (var j = i + 1; j < P.length; j++) { var q = P[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy; if (d < 9000) { ctx.strokeStyle = 'rgba(120,200,255,' + (0.22 * (1 - d / 9000)) + ')'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.3); ctx.fill();
      }
      requestAnimationFrame(frame);
    })();
  }

  // ---------- Справочник ----------
  function renderDoc(body) {
    var out = h('div', 'doc-body'), lines = String(body).split('\n'), i = 0, list = null;
    function inline(el, t) { el.innerHTML = U.mdInline(t); return el; }
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) { var code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; var pre = h('pre'); pre.appendChild(h('code', null, code.join('\n'))); out.appendChild(pre); list = null; continue; }
      if (/^## /.test(l)) { out.appendChild(h('h2', null, l.slice(3))); list = null; i++; continue; }
      if (/^\|/.test(l)) { var rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); var t = h('table'); rows.filter(function (r) { return !/^\|\s*-/.test(r); }).forEach(function (r, k) { var tr = h('tr'); r.replace(/^\||\|$/g, '').split('|').forEach(function (c) { inline(h(k === 0 ? 'th' : 'td'), c.trim()); tr.appendChild(inline(h(k === 0 ? 'th' : 'td'), c.trim())); }); t.appendChild(tr); }); out.appendChild(t); list = null; continue; }
      if (/^- /.test(l)) { if (!list) { list = h('ul'); out.appendChild(list); } list.appendChild(inline(h('li'), l.slice(2))); i++; continue; }
      list = null; if (l.trim()) out.appendChild(inline(h('p'), l)); i++;
    }
    return out;
  }

  function viewDocs(id) {
    U.renderChrome();
    var app = U.getApp(); clear(app);
    var docs = CS.allDocs(), cur = id && docs.filter(function (d) { return d.id === id; })[0];
    app.appendChild(U.crumbs([['Главная', '#/'], ['Справочник', cur ? '#/docs' : null]].concat(cur ? [[cur.title, null]] : [])));
    var wrap = h('div', 'docs-wrap'), nav = h('nav', 'docs-nav'), main = h('div');
    var q = h('input', 'inp docs-search'); q.placeholder = 'Поиск по справочнику…'; nav.appendChild(q);
    var items = h('div'); nav.appendChild(items);
    function drawNav() {
      clear(items); var f = q.value.trim().toLowerCase(), last = null;
      docs.filter(function (d) { return !f || (d.title + ' ' + d.body).toLowerCase().indexOf(f) > -1; }).forEach(function (d) {
        if (d.group !== last) { items.appendChild(h('div', 'docs-grp', d.group)); last = d.group; }
        var a = h('a', 'docs-a' + (cur && cur.id === d.id ? ' on' : ''), d.title); a.href = '#/docs/' + d.id; items.appendChild(a);
      });
    }
    q.oninput = drawNav; drawNav();
    if (cur) {
      main.appendChild(h('h1', null, cur.title));
      if (cur.sub) main.appendChild(h('p', 'lead', cur.sub));
      main.appendChild(renderDoc(cur.body));
    } else {
      main.appendChild(h('h1', null, 'Справочник'));
      main.appendChild(h('p', 'lead', 'Шпаргалки и опорные конспекты: открой, когда нужно быстро вспомнить, а не проходить урок заново.'));
      var cards = h('div', 'doc-cards');
      docs.forEach(function (d) { var a = h('a', 'doc-card'); a.href = '#/docs/' + d.id; a.appendChild(h('b', null, d.title)); a.appendChild(h('span', null, d.group + (d.sub ? ' · ' + d.sub : ''))); cards.appendChild(a); });
      main.appendChild(cards);
    }
    wrap.appendChild(nav); wrap.appendChild(main); app.appendChild(wrap); app.appendChild(U.footer());
  }

  function homeCta() {
    var d = h('div', 'home-map-cta');
    d.appendChild(h('b', null, 'Вся карта знаний'));
    d.appendChild(h('span', null, 'Анимированный граф: фундамент → сети → безопасность → криптография → специализации. Видно, что с чем связано и куда идти дальше.'));
    var a = h('a', 'btn primary', 'Открыть карту'); a.href = '#/map'; d.appendChild(a);
    var b = h('a', 'btn ghost', 'Справочник'); b.href = '#/docs'; d.appendChild(b);
    return d;
  }

  // «Твой путь»: рекомендуемая последовательность уроков от нуля. Один шаг — один урок, виден прогресс.
  var PATH = [
    ['start-here', 'st-flag'], ['start-here', 'st-files'], ['start-here', 'st-read'], ['start-here', 'st-inside'], ['start-here', 'st-bits'], ['start-here', 'st-address'], ['start-here', 'st-page'], ['start-here', 'st-os'], ['start-here', 'st-home'], ['start-here', 'st-vars'], ['start-here', 'st-code'], ['start-here', 'st-safe'], ['start-here', 'st-final'],
    ['lab-terminal', 'lt-first'], ['games', 'gm-loop'], ['lab-terminal', 'lt-logs'], ['linux-basics', 'lb-tree'], ['net', 'net-dns'], ['apps-web', 'aw-http'], ['sec-mindset', 'sm-cia'],
    ['linux-basics', 'lb-perm'], ['lab-terminal', 'lt-code'], ['prog-base', 'pb-vars'], ['pc', 'pc-binary'], ['hw', 'hw-cpu'], ['lab-recon', 'lr-scan'], ['lab-recon', 'lr-web'], ['lab-recon', 'lr-sqli']
  ];
  function pathCard() {
    var steps = PATH.map(function (p) { return { c: p[0], l: p[1], lesson: CS.getLesson(p[0], p[1]) }; }).filter(function (x) { return x.lesson; });
    var done = steps.filter(function (x) { return CS.lessonState(x.l).done; }).length;
    var next = steps.filter(function (x) { return !CS.lessonState(x.l).done; })[0];
    var d = h('section', 'path-card');
    var top = h('div', 'path-top');
    var tx = h('div'); tx.appendChild(h('div', 'step-kick', 'Твой путь с нуля'));
    tx.appendChild(h('h2', null, next ? (done ? 'Дальше: ' : 'Начни здесь: ') + next.lesson.title : 'Путь пройден — выбирай специализацию'));
    tx.appendChild(h('p', null, next ? next.lesson.subtitle : 'Ты прошёл весь стартовый маршрут. Теперь открывай ветки на карте знаний.'));
    top.appendChild(tx);
    if (next) { var go = h('a', 'btn primary big', done ? 'Продолжить →' : 'Начать →'); go.href = '#/lesson/' + next.c + '/' + next.l; top.appendChild(go); }
    d.appendChild(top);
    var bar = h('div', 'path-steps');
    steps.forEach(function (x, i) { var dot = h('a', 'path-dot' + (CS.lessonState(x.l).done ? ' done' : (next && x.l === next.l ? ' cur' : ''))); dot.href = '#/lesson/' + x.c + '/' + x.l; dot.title = (i + 1) + '. ' + x.lesson.title; dot.appendChild(h('span', null, String(i + 1))); bar.appendChild(dot); });
    d.appendChild(bar);
    var t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var today = (CS.state.history || []).filter(function (e) { return e.t >= t0.getTime() && (e.type === 'lesson' || e.type === 'lab'); }).length;
    var streak = (CS.state.streak && CS.state.streak.count) || 0;
    var goal = h('div', 'path-goal' + (today ? ' ok' : ''));
    goal.appendChild(h('b', null, today ? '✓ Цель на сегодня выполнена' : 'Цель на сегодня: 1 урок'));
    goal.appendChild(h('span', null, today ? (streak > 1 ? 'Серия: ' + streak + ' дн. подряд — так держать.' : 'Серия началась. Вернись завтра, чтобы она росла.') : (streak > 0 ? 'Не прерви серию в ' + streak + ' дн.: хватит одного урока на 15–20 минут.' : 'Пройди один урок — и начнётся твоя серия.')));
    d.appendChild(goal);
    d.appendChild(h('div', 'path-note', 'Пройдено ' + done + ' из ' + steps.length + ' · каждый шаг — 10–20 минут. Идти можно в своём темпе; прогресс сохраняется, закрыть страницу можно в любой момент.'));
    return d;
  }

  window.CSUI2 = { pathCard: pathCard, viewMap: viewMap, viewDocs: viewDocs, homeCta: homeCta, buildGraph: buildGraph, nodeState: nodeState };
})();
