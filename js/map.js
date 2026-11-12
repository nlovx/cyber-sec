/* CYBER SEC — радиальная «Карта знаний»: в центре «Как устроен компьютер», от него ветки-направления.
   Моушн: пульс ядра, вращающиеся орбиты, бегущие линии зависимостей, частицы по связям, плавная камера.
   Переопределяет CSUI2.viewMap из ui2.js. */
(function () {
  'use strict';
  var U = window.CSUI && window.CSUI.helpers, B = window.CSUI2;
  if (!U || !B) return;
  var h = U.h, clear = U.clear, NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function R(d) { return d === 0 ? 0 : 150 + (d - 1) * 150; }

  // ---------- Раскладка ----------
  function layout(G) {
    var nodes = G.nodes, byId = G.byId;
    var root = byId['start-here'] || byId.pc || nodes.filter(function (n) { return n.depth === 0; })[0];
    var maxD = 0; nodes.forEach(function (n) { maxD = Math.max(maxD, n.depth); });
    // ширины секторов по трекам
    var cnt = {}; nodes.forEach(function (n) { cnt[n.track] = (cnt[n.track] || 0) + 1; });
    var w = {}, tot = 0;
    G.tracks.forEach(function (t) { w[t] = (Math.sqrt(cnt[t] || 1) + 1.6) * (t === 'base' ? 1.5 : 1); tot += w[t]; });
    var gap = 0.03, avail = Math.PI * 2 - gap * G.tracks.length, a = -Math.PI / 2 - (w.base / tot * avail) / 2, sect = {};
    G.tracks.forEach(function (t) { var span = w[t] / tot * avail; sect[t] = { a0: a, a1: a + span, mid: a + span / 2 }; a += span + gap; });

    var pos = {};
    root.x = 0; root.y = 0; root.ang = 0; pos[root.id] = root;
    function width(n) { return n.w || (n.w = Math.min(176, 26 + n.title.length * 6.1)); }
    for (var d = 1; d <= maxD; d++) {
      G.tracks.forEach(function (t) {
        var grp = nodes.filter(function (n) { return n.track === t && n.depth === d && n !== root; });
        if (!grp.length) return;
        var S = sect[t], pad = 0.04, r = R(d);
        grp.forEach(function (n) {
          var vx = 0, vy = 0, k = 0;
          n.needs.forEach(function (id) { var p = pos[id]; if (p && p !== root) { vx += Math.cos(p.ang); vy += Math.sin(p.ang); k++; } });
          var ang = k ? Math.atan2(vy, vx) : S.mid;
          n.ang = Math.max(S.a0 + pad, Math.min(S.a1 - pad, ang));
        });
        grp.sort(function (p, q) { return p.ang - q.ang; });
        function sep(n) { return (Math.abs(Math.sin(n.ang)) * width(n) + Math.abs(Math.cos(n.ang)) * 30 + 12) / r; }
        for (var i = 1; i < grp.length; i++) { var mn = grp[i - 1].ang + (sep(grp[i - 1]) + sep(grp[i])) / 2; if (grp[i].ang < mn) grp[i].ang = mn; }
        var lim = S.a1 - pad;
        for (var j = grp.length - 1; j >= 0; j--) { if (grp[j].ang > lim) grp[j].ang = lim; lim = grp[j].ang - (j > 0 ? (sep(grp[j - 1]) + sep(grp[j])) / 2 : 0); }
        for (var m = 1; m < grp.length; m++) { var mn2 = grp[m - 1].ang + (sep(grp[m - 1]) + sep(grp[m])) / 2; if (grp[m].ang < mn2) grp[m].ang = mn2; }
        grp.forEach(function (n) { n.x = Math.cos(n.ang) * r; n.y = Math.sin(n.ang) * r; pos[n.id] = n; });
      });
    }
    return { root: root, maxD: maxD, sect: sect };
  }

  function viewMap() {
    U.renderChrome();
    var app = U.getApp(); clear(app);
    app.appendChild(U.crumbs([['Главная', '#/'], ['Карта знаний', null]]));
    var G = B.buildGraph(), L = layout(G);
    var nodes = G.nodes, byId = G.byId, rMax = R(L.maxD) + 120;

    var hero = h('section', 'rmap-hero');
    hero.appendChild(h('h1', null, 'Карта знаний'));
    hero.appendChild(h('p', null, 'В центре — «Старт». От него расходятся направления: нажми на узел, чтобы открыть курс; наведи — подсветится путь. Колесо — масштаб, перетаскивание — движение.'));
    var tools = h('div', 'map-tools'); hero.appendChild(tools);
    var ready = nodes.filter(function (n) { return n.ready; }).length;
    var leg = h('div', 'map-legend');
    [['#3d7bff', 'готово к прохождению'], ['rgba(61,123,255,.45)', 'пройдено'], ['rgba(255,255,255,.18)', 'скоро']].forEach(function (l) { var sp = h('span'); var i = h('i'); i.style.background = l[0]; sp.appendChild(i); sp.appendChild(document.createTextNode(l[1])); leg.appendChild(sp); });
    leg.appendChild(h('span', null, 'Готово тем: ' + ready + ' из ' + nodes.length));
    hero.appendChild(leg); app.appendChild(hero);

    var wrap = h('div', 'rmap'), svg = s('svg', { class: 'rmap-svg' }), tip = h('div', 'map-tip'); document.body.appendChild(tip);
    wrap.appendChild(svg); app.appendChild(wrap);

    // ---- фон: сектора, орбиты, звёзды ----
    var gBg = s('g'); svg.appendChild(gBg);
    G.tracks.forEach(function (t, i) {
      var S = L.sect[t], x0 = Math.cos(S.a0) * rMax, y0 = Math.sin(S.a0) * rMax, x1 = Math.cos(S.a1) * rMax, y1 = Math.sin(S.a1) * rMax;
      gBg.appendChild(s('path', { d: 'M0,0 L' + x0 + ',' + y0 + ' A' + rMax + ',' + rMax + ' 0 ' + ((S.a1 - S.a0) > Math.PI ? 1 : 0) + ' 1 ' + x1 + ',' + y1 + ' Z', class: 'rm-wedge' + (i % 2 ? ' alt' : '') }));
      var lx = Math.cos(S.mid) * (rMax + 34), ly = Math.sin(S.mid) * (rMax + 34), c = Math.cos(S.mid);
      gBg.appendChild(s('text', { x: lx, y: ly, class: 'rm-track', 'text-anchor': c > 0.3 ? 'start' : (c < -0.3 ? 'end' : 'middle') }, CS.trackMeta(t).glyph + '  ' + CS.trackMeta(t).name.toUpperCase()));
    });
    var orb = s('g'); gBg.appendChild(orb);
    for (var d = 1; d <= L.maxD; d++) {
      var ring = s('circle', { r: R(d), class: 'rm-orbit' + (d % 2 ? '' : ' alt') }); orb.appendChild(ring);
    }
    if (!reduce) orb.appendChild(s('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0', to: '360', dur: '320s', repeatCount: 'indefinite' }));
    for (var q = 0; q < 140; q++) {
      var an = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * (rMax + 200);
      var st = s('circle', { cx: Math.cos(an) * rr, cy: Math.sin(an) * rr, r: (Math.random() * 1.3 + 0.4).toFixed(2), class: 'rm-star' });
      if (!reduce && q % 4 === 0) st.appendChild(s('animate', { attributeName: 'opacity', values: '.15;.7;.15', dur: (3 + Math.random() * 5).toFixed(1) + 's', repeatCount: 'indefinite', begin: (Math.random() * 4).toFixed(1) + 's' }));
      gBg.appendChild(st);
    }

    // ---- рёбра ----
    var gE = s('g'), edges = [], pCount = 0; svg.appendChild(gE);
    nodes.forEach(function (n) {
      n.needs.forEach(function (id) {
        var a = byId[id]; if (!a || a.x == null || n.x == null) return;
        var mx = (a.x + n.x) / 2, my = (a.y + n.y) / 2, dx = n.x - a.x, dy = n.y - a.y;
        var dd = 'M' + a.x + ',' + a.y + ' Q' + (mx - dy * 0.1) + ',' + (my + dx * 0.1) + ' ' + n.x + ',' + n.y;
        var go = a.ready && n.ready;
        var p = s('path', { d: dd, class: 'rm-edge' + (go ? ' go' : '') }); gE.appendChild(p); edges.push({ el: p, from: a.id, to: n.id });
        if (go && !reduce && pCount < 70) {
          pCount++;
          var c = s('circle', { r: 2.4, class: 'rm-spark' });
          c.appendChild(s('animateMotion', { path: dd, dur: (3 + (pCount % 5)).toFixed(1) + 's', repeatCount: 'indefinite', begin: ((pCount * 0.37) % 4).toFixed(2) + 's' }));
          gE.appendChild(c);
        }
      });
    });

    // ---- узлы ----
    var gN = s('g'), els = {}; svg.appendChild(gN);
    var rootG = s('g', { class: 'rm-core', transform: 'translate(0,0)', tabindex: 0 });
    [0, 1.2, 2.4].forEach(function (off) {
      var pr = s('circle', { r: 46, class: 'rm-pulse' });
      if (!reduce) { pr.appendChild(s('animate', { attributeName: 'r', values: '46;96', dur: '3.6s', repeatCount: 'indefinite', begin: off + 's' })); pr.appendChild(s('animate', { attributeName: 'opacity', values: '.35;0', dur: '3.6s', repeatCount: 'indefinite', begin: off + 's' })); }
      rootG.appendChild(pr);
    });
    rootG.appendChild(s('circle', { r: 46, class: 'rm-core-c' }));
    var rt = L.root.title.split(' ');
    rootG.appendChild(s('text', { y: -4, class: 'rm-core-t' }, rt.slice(0, 2).join(' ')));
    rootG.appendChild(s('text', { y: 12, class: 'rm-core-t' }, rt.slice(2).join(' ')));
    gN.appendChild(rootG); els[L.root.id] = rootG;
    function go(n) { if (n.href.indexOf('cryptolab') === 0 || n.href.indexOf('http') === 0) location.href = n.href; else location.hash = n.href.replace(/^#/, ''); }
    var moved = false;
    nodes.forEach(function (n) {
      var st = B.nodeState(n);
      var g = n === L.root ? rootG : s('g', { class: 'rn ' + st, transform: 'translate(' + n.x + ',' + n.y + ')', tabindex: 0 });
      if (n !== L.root) {
        var w = n.w || Math.min(176, 26 + n.title.length * 6.1);
        g.appendChild(s('rect', { x: -w / 2, y: -14, width: w, height: 28, rx: 14 }));
        g.appendChild(s('circle', { cx: -w / 2 + 11, cy: 0, r: 3.2, class: 'rn-dot' }));
        g.appendChild(s('text', { x: 6, y: 4, 'text-anchor': 'middle' }, n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title));
        gN.appendChild(g); els[n.id] = g;
      } else { rootG.setAttribute('class', 'rm-core ' + st); }
      g.addEventListener('click', function () { if (!moved) go(n); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(n); });
      g.addEventListener('mouseenter', function () { hl(n); tip.innerHTML = ''; tip.appendChild(h('b', null, n.title)); tip.appendChild(h('span', null, n.goal || CS.trackMeta(n.track).blurb)); tip.appendChild(h('em', null, CS.trackMeta(n.track).name + (n.ready ? (n.lessons ? ' · ' + n.lessons + ' ур.' : '') : ' · в плане'))); tip.style.display = 'block'; });
      g.addEventListener('mousemove', function (e) { tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 340) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; });
      g.addEventListener('mouseleave', function () { hl(null); tip.style.display = 'none'; });
    });
    function hl(n) {
      if (!n) { edges.forEach(function (e) { e.el.classList.remove('dim', 'hl'); }); Object.keys(els).forEach(function (k) { els[k].classList.remove('dim'); }); return; }
      var anc = {}; anc[n.id] = 1; (function up(x) { x.needs.forEach(function (id) { if (!anc[id] && byId[id]) { anc[id] = 1; up(byId[id]); } }); })(n);
      var desc = {}; (function down(x) { nodes.forEach(function (m) { if (m.needs.indexOf(x.id) > -1 && !desc[m.id]) { desc[m.id] = 1; down(m); } }); })(n);
      edges.forEach(function (e) { var on = (anc[e.from] && anc[e.to]) || (desc[e.to] && (desc[e.from] || e.from === n.id)); e.el.classList.toggle('hl', !!on); e.el.classList.toggle('dim', !on); });
      Object.keys(els).forEach(function (k) { els[k].classList.toggle('dim', !(anc[k] || desc[k])); });
    }

    // ---- камера ----
    var cam = { x: 0, y: 0, k: 1 }, tgt = null, raf = 0;
    function dims() { return { W: wrap.clientWidth || 900, H: wrap.clientHeight || 600 }; }
    function apply() { var D = dims(); svg.setAttribute('viewBox', (cam.x - D.W * cam.k / 2) + ' ' + (cam.y - D.H * cam.k / 2) + ' ' + (D.W * cam.k) + ' ' + (D.H * cam.k)); }
    function fitK(w, hgt) { var D = dims(); return Math.max(w / D.W, hgt / D.H); }
    function flyTo(x, y, k) { tgt = { x: x, y: y, k: k }; if (!raf) raf = requestAnimationFrame(step); }
    function step() {
      raf = 0; if (!tgt) return;
      cam.x += (tgt.x - cam.x) * 0.14; cam.y += (tgt.y - cam.y) * 0.14; cam.k += (tgt.k - cam.k) * 0.14; apply();
      if (Math.abs(tgt.x - cam.x) + Math.abs(tgt.y - cam.y) > 0.5 || Math.abs(tgt.k - cam.k) > 0.002) raf = requestAnimationFrame(step); else { cam.x = tgt.x; cam.y = tgt.y; cam.k = tgt.k; tgt = null; apply(); }
    }
    function bbox(list) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; list.forEach(function (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }); return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 320, h: y1 - y0 + 220 }; }
    function home() { flyTo(0, 0, 1.05); }
    function all() { flyTo(0, 0, fitK((rMax + 260) * 2, (rMax + 260) * 2)); }
    cam.k = 1.8; apply(); home();
    window.addEventListener('resize', apply);

    function chip(label, fn) { var b = h('button', 'map-chip', label); b.onclick = fn; tools.appendChild(b); return b; }
    chip('К центру', home); chip('Показать всё', all);
    chip('Приблизить +', function () { flyTo(cam.x, cam.y, Math.max(0.25, (tgt ? tgt.k : cam.k) * 0.7)); });
    chip('Отдалить −', function () { flyTo(cam.x, cam.y, Math.min(14, (tgt ? tgt.k : cam.k) * 1.4)); });
    G.tracks.forEach(function (t) {
      if (t === 'base') return;
      chip(CS.trackMeta(t).glyph + ' ' + CS.trackMeta(t).name, function () { var list = nodes.filter(function (n) { return n.track === t && n.x != null; }); if (!list.length) return; var b = bbox(list); flyTo(b.cx, b.cy, fitK(b.w, b.h)); });
    });

    // зум колесом и перетаскивание
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault(); tgt = null;
      var D = dims(), rect = wrap.getBoundingClientRect(), px = (e.clientX - rect.left - D.W / 2) * cam.k + cam.x, py = (e.clientY - rect.top - D.H / 2) * cam.k + cam.y;
      var nk = Math.max(0.25, Math.min(14, cam.k * Math.exp(e.deltaY * 0.0015)));
      cam.x = px - (px - cam.x) * nk / cam.k; cam.y = py - (py - cam.y) * nk / cam.k; cam.k = nk; apply();
    }, { passive: false });
    var drag = null;
    wrap.addEventListener('pointerdown', function (e) { if (e.button) return; drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false; });
    wrap.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5) { moved = true; wrap.classList.add('drag'); tgt = null; try { wrap.setPointerCapture(e.pointerId); } catch (x) {} }
      if (moved) { cam.x = drag.cx - dx * cam.k; cam.y = drag.cy - dy * cam.k; apply(); }
    });
    function end() { drag = null; wrap.classList.remove('drag'); setTimeout(function () { moved = false; }, 0); }
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    window.addEventListener('hashchange', function () { tip.remove(); }, { once: true });
    app.appendChild(U.footer());
  }

  B.viewMap = viewMap;
})();
