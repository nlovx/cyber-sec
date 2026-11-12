/* CYBER SEC — виджет rgb: ползунки красного, зелёного и синего. Показывает, что цвет — это три байта, а hex — их запись. */
(function () {
  'use strict';
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  CS.viz('rgb', function (box) {
    var v = [255, 136, 0], names = ['Красный', 'Зелёный', 'Синий'], cols = ['#ff5d6c', '#3ddc84', '#5a91ff'];
    var sw = h('div', 'rgb-sw'), code = h('div', 'rgb-code'), rows = h('div', 'rgb-rows'), sliders = [], vals = [], hexes = [];
    function hex2(n) { return ('0' + n.toString(16).toUpperCase()).slice(-2); }
    function draw() {
      var c = '#' + hex2(v[0]) + hex2(v[1]) + hex2(v[2]); sw.style.background = c;
      code.innerHTML = '';
      code.appendChild(h('span', 'rgb-hash', '#')); [0, 1, 2].forEach(function (i) { var s = h('span', 'rgb-b', hex2(v[i])); s.style.color = cols[i]; code.appendChild(s); });
      [0, 1, 2].forEach(function (i) { vals[i].textContent = v[i]; hexes[i].textContent = hex2(v[i]); sliders[i].value = v[i]; });
    }
    [0, 1, 2].forEach(function (i) {
      var r = h('div', 'rgb-row'), n = h('span', 'rgb-n', names[i]), s = h('input'), a = h('b', 'rgb-v'), b = h('span', 'rgb-h');
      s.type = 'range'; s.min = 0; s.max = 255; s.value = v[i]; s.style.accentColor = cols[i];
      s.oninput = function () { v[i] = +s.value; draw(); };
      sliders.push(s); vals.push(a); hexes.push(b); r.appendChild(n); r.appendChild(s); r.appendChild(a); r.appendChild(b); rows.appendChild(r);
    });
    var pre = h('div', 'viz-btns'); [['Красный', [255, 0, 0]], ['Оранжевый #FF8800', [255, 136, 0]], ['Белый', [255, 255, 255]], ['Чёрный', [0, 0, 0]], ['Фиолетовый', [150, 80, 255]]].forEach(function (p) { var b = h('button', 'btn ghost', p[0]); b.onclick = function () { v = p[1].slice(); draw(); }; pre.appendChild(b); });
    box.appendChild(sw); box.appendChild(code); box.appendChild(rows); box.appendChild(pre);
    box.appendChild(h('div', 'viz-hint', 'Каждый цвет — число от 0 до 255 (один байт). Справа от ползунка — то же число в hex: 255 = FF, 136 = 88, 0 = 00. Так и получается #FF8800.'));
    draw();
  });
})();
