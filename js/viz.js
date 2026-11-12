/* CYBER SEC — интерактивные визуализации для шагов t:'viz'.
   Регистрируются через CS.viz(kind, render). render(container, step).
   Неизвестный kind деградирует до текста (обрабатывается в ui.js). */
(function () {
  'use strict';
  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  // ---------- binary: 8 переключаемых бит ----------
  CS.viz('binary', function (box, step) {
    var bits = [0, 0, 0, 0, 0, 0, 0, 0]; // старший слева (128..1)
    var weights = [128, 64, 32, 16, 8, 4, 2, 1];
    var row = h('div', 'bitrow');
    var readout = h('div', 'bit-readout');

    function render() {
      clear(row);
      bits.forEach(function (b, i) {
        var cell = h('div', 'bit' + (b ? ' on' : ''));
        cell.appendChild(h('div', 'bit-w', String(weights[i])));
        cell.appendChild(h('div', 'bit-v', b ? '1' : '0'));
        cell.setAttribute('role', 'button');
        cell.tabIndex = 0;
        cell.onclick = function () { bits[i] ^= 1; render(); };
        cell.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); bits[i] ^= 1; render(); } };
        row.appendChild(cell);
      });
      var dec = bits.reduce(function (s, b, i) { return s + (b ? weights[i] : 0); }, 0);
      var hex = ('0' + dec.toString(16).toUpperCase()).slice(-2);
      var binStr = bits.join('').replace(/(\d{4})(\d{4})/, '$1 $2');
      clear(readout);
      readout.appendChild(badge('DEC', String(dec)));
      readout.appendChild(badge('HEX', '0x' + hex));
      readout.appendChild(badge('BIN', binStr));
    }
    function badge(k, v) {
      var b = h('div', 'rb');
      b.appendChild(h('span', 'rb-k', k));
      b.appendChild(h('span', 'rb-v', v));
      return b;
    }
    box.appendChild(row);
    box.appendChild(readout);
    var hint = h('div', 'viz-hint', 'Щёлкай биты. Собери 255 (все включены), затем 128 (только левый).');
    box.appendChild(hint);
    render();
  });

  // ---------- dns: этапы разрешения имени ----------
  CS.viz('dns', function (box, step) {
    var stages = [
      { k: 'Браузер', t: 'Нужен IP для google.com. Сначала смотрю свой кэш и файл hosts.', q: 'Запрос: A google.com?' },
      { k: 'Resolver (ISP/8.8.8.8)', t: 'Рекурсивный резолвер. Если нет в кэше — пойду спрашивать по цепочке сверху вниз.', q: 'google.com → ?' },
      { k: 'Root (.)', t: 'Я не знаю google.com, но знаю, кто отвечает за зону .com. Вот адреса TLD-серверов.', q: 'Кто держит .com?' },
      { k: 'TLD (.com)', t: 'За google.com отвечают вот эти authoritative-серверы (ns1.google.com...). Иди к ним.', q: 'Кто authoritative для google.com?' },
      { k: 'Authoritative (ns.google)', t: 'Это моя зона. google.com = 142.250.x.x, TTL 300с.', q: 'A google.com = 142.250.x.x' },
      { k: 'Соединение', t: 'Резолвер вернул IP браузеру, тот кэширует на TTL и открывает TCP/TLS к 142.250.x.x.', q: 'TCP 443 → 142.250.x.x' }
    ];
    var nodes = h('div', 'dns-flow');
    var detail = h('div', 'dns-detail');
    var active = -1;

    function showDetail(i) {
      active = i;
      Array.prototype.forEach.call(nodes.children, function (c, idx) {
        c.classList.toggle('active', idx === i);
      });
      clear(detail);
      var s = stages[i];
      detail.appendChild(h('div', 'dns-d-k', s.k));
      detail.appendChild(h('div', 'dns-d-q', s.q));
      detail.appendChild(h('div', 'dns-d-t', s.t));
    }
    stages.forEach(function (s, i) {
      var n = h('div', 'dns-node');
      n.appendChild(h('div', 'dns-n-i', String(i + 1)));
      n.appendChild(h('div', 'dns-n-k', s.k));
      n.onclick = function () { showDetail(i); };
      n.tabIndex = 0;
      n.onkeydown = function (ev) { if (ev.key === 'Enter') showDetail(i); };
      nodes.appendChild(n);
      if (i < stages.length - 1) nodes.appendChild(h('div', 'dns-arrow', '→'));
    });
    box.appendChild(nodes);
    box.appendChild(detail);
    box.appendChild(h('div', 'viz-hint', 'Кликай по этапам — увидишь, какой запрос уходит и что возвращается. Запрос идёт сверху вниз, ответ кэшируется.'));
    showDetail(0);
  });

  // ---------- packet: слои инкапсуляции ----------
  CS.viz('packet', function (box, step) {
    var layers = [
      { k: 'Ethernet (L2)', c: 'l2', fields: 'MAC получателя | MAC отправителя | тип (0x0800=IPv4)', t: 'Кадр внутри одной сети. MAC-адреса меняются на каждом участке (от роутера к роутеру).' },
      { k: 'IP (L3)', c: 'l3', fields: 'IP источника | IP назначения | TTL | протокол (6=TCP)', t: 'Адресация между сетями. IP-адреса сквозные — не меняются по пути (без NAT). TTL убывает на каждом хопе.' },
      { k: 'TCP (L4)', c: 'l4', fields: 'порт источника | порт 443 | seq | ack | флаги (SYN/ACK)', t: 'Порт определяет приложение. SYN→SYN/ACK→ACK — рукопожатие. Seq/ack обеспечивают надёжность.' },
      { k: 'TLS / HTTP (L7)', c: 'l7', fields: 'GET / HTTP/1.1 | Host: google.com (внутри TLS — зашифровано)', t: 'Собственно данные приложения. С TLS содержимое шифруется, виден только адрес сервера и объём трафика.' }
    ];
    var stack = h('div', 'pkt-stack');
    var detail = h('div', 'pkt-detail');
    function show(i) {
      Array.prototype.forEach.call(stack.children, function (c, idx) { c.classList.toggle('active', idx === i); });
      clear(detail);
      detail.appendChild(h('div', 'pkt-d-k', layers[i].k));
      detail.appendChild(h('code', 'pkt-d-f', layers[i].fields));
      detail.appendChild(h('div', 'pkt-d-t', layers[i].t));
    }
    layers.forEach(function (ly, i) {
      var seg = h('div', 'pkt-seg ' + ly.c);
      seg.appendChild(h('span', 'pkt-k', ly.k));
      seg.onclick = function () { show(i); };
      stack.appendChild(seg);
    });
    box.appendChild(h('div', 'viz-hint', 'Данные упакованы слоями, как матрёшка. Кликай слой — увидишь его заголовок и зачем он.'));
    box.appendChild(stack);
    box.appendChild(detail);
    show(3);
  });

  // ---------- subnet: калькулятор подсети ----------
  CS.viz('subnet', function (box, step) {
    var inp = h('input', 'subnet-in');
    inp.value = '192.168.1.10/24';
    inp.spellcheck = false;
    var out = h('div', 'subnet-out');

    function ipToInt(ip) {
      var p = ip.split('.').map(Number);
      if (p.length !== 4 || p.some(function (x) { return isNaN(x) || x < 0 || x > 255; })) return null;
      return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
    }
    function intToIp(n) {
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    function calc() {
      clear(out);
      var m = String(inp.value).trim().match(/^(\d+\.\d+\.\d+\.\d+)\s*\/\s*(\d+)$/);
      if (!m) { out.appendChild(h('div', 'subnet-err', 'Формат: A.B.C.D/маска, например 10.0.0.5/24')); return; }
      var ip = ipToInt(m[1]), bits = parseInt(m[2], 10);
      if (ip == null || bits < 0 || bits > 32) { out.appendChild(h('div', 'subnet-err', 'Неверный IP или маска (0–32).')); return; }
      var mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
      var network = (ip & mask) >>> 0;
      var broadcast = (network | (~mask >>> 0)) >>> 0;
      var hosts = bits >= 31 ? 0 : (broadcast - network - 1);
      function rowEl(k, v) {
        var r = h('div', 'subnet-row');
        r.appendChild(h('span', 'subnet-k', k));
        r.appendChild(h('span', 'subnet-v', v));
        return r;
      }
      out.appendChild(rowEl('Маска', intToIp(mask) + '  (/' + bits + ')'));
      out.appendChild(rowEl('Адрес сети', intToIp(network)));
      out.appendChild(rowEl('Broadcast', intToIp(broadcast)));
      out.appendChild(rowEl('Диапазон хостов', bits >= 31 ? '— (служебная /' + bits + ')' : intToIp(network + 1) + ' … ' + intToIp(broadcast - 1)));
      out.appendChild(rowEl('Хостов', String(hosts)));
    }
    inp.oninput = calc;
    box.appendChild(h('div', 'viz-hint', 'Введи адрес с маской — увидишь, где граница сети, broadcast и сколько влезет хостов. Поменяй /24 на /26 и сравни.'));
    box.appendChild(inp);
    box.appendChild(out);
    calc();
  });

  // ---------- ascii: символ → код → hex → двоичный ----------
  CS.viz('ascii', function (box, step) {
    var inp = h('input', 'subnet-in'); inp.value = 'Hi! Привет'; inp.spellcheck = false; inp.maxLength = 24;
    var out = h('div', 'ascii-out');
    function render() {
      clear(out);
      var chars = Array.from(String(inp.value).slice(0, 16));
      chars.forEach(function (ch) {
        var code = ch.codePointAt(0);
        var cell = h('div', 'ascii-cell');
        cell.appendChild(h('div', 'ascii-ch', ch === ' ' ? '␠' : ch));
        cell.appendChild(h('div', 'ascii-dec', String(code)));
        cell.appendChild(h('div', 'ascii-hex', '0x' + code.toString(16).toUpperCase()));
        // UTF-8 байты
        var bytes = utf8bytes(ch);
        cell.appendChild(h('div', 'ascii-bytes', bytes.map(function (b) { return ('0' + b.toString(16).toUpperCase()).slice(-2); }).join(' ')));
        cell.classList.add(code < 128 ? 'ascii-1' : 'ascii-multi');
        out.appendChild(cell);
      });
    }
    function utf8bytes(ch) { return Array.from(new TextEncoder().encode(ch)); }
    inp.oninput = render;
    box.appendChild(h('div', 'viz-hint', 'Печатай — каждый символ это число. Латиница влезает в 1 байт (<128), кириллица и эмодзи — в 2–4 байта UTF-8 (подсвечены). Вот откуда «кракозябры» при неверной кодировке.'));
    box.appendChild(inp);
    box.appendChild(out);
    render();
  });

  // ---------- perm: права rwx → chmod (octal + symbolic) ----------
  CS.viz('perm', function (box, step) {
    var who = ['Владелец', 'Группа', 'Остальные'];
    var bitsPerm = [['r', 4], ['w', 2], ['x', 1]];
    var grid = [[1, 0, 0], [1, 0, 0], [1, 0, 0]]; // rwx по умолчанию 400-ish
    grid = [[1, 1, 1], [1, 0, 1], [1, 0, 1]]; // 755 по умолчанию
    var table = h('div', 'perm-grid');
    var readout = h('div', 'perm-readout');
    function render() {
      clear(table);
      who.forEach(function (w, wi) {
        var rowEl = h('div', 'perm-row');
        rowEl.appendChild(h('div', 'perm-who', w));
        bitsPerm.forEach(function (bp, bi) {
          var on = grid[wi][bi];
          var cell = h('button', 'perm-cell' + (on ? ' on' : ''), bp[0]);
          cell.onclick = function () { grid[wi][bi] ^= 1; render(); };
          rowEl.appendChild(cell);
        });
        table.appendChild(rowEl);
      });
      var octal = grid.map(function (r) { return r[0] * 4 + r[1] * 2 + r[2] * 1; }).join('');
      var sym = grid.map(function (r) { return (r[0] ? 'r' : '-') + (r[1] ? 'w' : '-') + (r[2] ? 'x' : '-'); }).join('');
      clear(readout);
      var b1 = h('div', 'rb'); b1.appendChild(h('span', 'rb-k', 'chmod')); b1.appendChild(h('span', 'rb-v', octal));
      var b2 = h('div', 'rb'); b2.appendChild(h('span', 'rb-k', 'ls -l')); b2.appendChild(h('span', 'rb-v', '-' + sym));
      readout.appendChild(b1); readout.appendChild(b2);
    }
    box.appendChild(h('div', 'viz-hint', 'Кликай биты прав для владельца / группы / остальных. r=4, w=2, x=1 — сумма даёт цифру. 755 = владелец всё, остальные читают и выполняют. Это и есть chmod.'));
    box.appendChild(table);
    box.appendChild(readout);
    render();
  });

  // ---------- hash: реальный SHA-256 + эффект лавины ----------
  CS.viz('hash', function (box, step) {
    var inp = h('input', 'subnet-in'); inp.value = 'password'; inp.spellcheck = false;
    var out = h('div', 'hash-out');
    var prev = null;
    function render() {
      var text = String(inp.value);
      var hexNow = sha256(text);
      var hexAlt = sha256(text + '!'); // тот же текст + 1 символ — показываем лавину
      clear(out);
      out.appendChild(hashRow('SHA-256(«' + text + '»)', hexNow, prev));
      out.appendChild(hashRow('SHA-256(«' + text + '!»)  — добавили 1 символ', hexAlt, hexNow));
      var diff = hamdiffHex(hexNow, hexAlt);
      out.appendChild(h('div', 'hash-note', 'Изменили всего один символ — а совпало лишь ' + diff.same + ' из 64 hex-знаков (' + Math.round(diff.same / 64 * 100) + '%). Это «эффект лавины»: по хешу нельзя понять, насколько близок был вход.'));
      prev = hexNow;
    }
    function hashRow(label, hex, cmp) {
      var r = h('div', 'hash-row');
      r.appendChild(h('div', 'hash-label', label));
      var hx = h('div', 'hash-hex');
      for (var i = 0; i < hex.length; i++) {
        var sp = h('span', null, hex[i]);
        if (cmp && hex[i] !== cmp[i]) sp.className = 'hx-diff';
        hx.appendChild(sp);
      }
      r.appendChild(hx);
      return r;
    }
    function hamdiffHex(a, b) { var same = 0; for (var i = 0; i < a.length; i++) if (a[i] === b[i]) same++; return { same: same }; }
    inp.oninput = render;
    box.appendChild(h('div', 'viz-hint', 'Это настоящий SHA-256. Печатай — хеш всегда 64 hex-знака (256 бит), какой бы длины ни был вход. Отличия от «+1 символ» подсвечены красным.'));
    box.appendChild(inp);
    box.appendChild(out);
    render();
  });

  // Компактная синхронная реализация SHA-256 (работает и по file://, без crypto.subtle).
  function sha256(ascii) {
    function rrot(x, n) { return (x >>> n) | (x << (32 - n)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), result = '';
    var words = [], asciiBitLength;
    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    // UTF-8 кодирование входа.
    var bytes = Array.from(new TextEncoder().encode(ascii));
    var asciiStr = bytes.map(function (b) { return String.fromCharCode(b); }).join('');
    ascii = asciiStr;
    var h0 = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (var i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bytes.length * 8 / maxWord) | 0);
    words[words.length] = (bytes.length * 8);
    var w = [], a, b, c, d, e, f, g, hh;
    for (var j = 0; j < words.length;) {
      var chunk = words.slice(j, j += 16);
      var old = h0.slice(0);
      a = old[0]; b = old[1]; c = old[2]; d = old[3]; e = old[4]; f = old[5]; g = old[6]; hh = old[7];
      for (var i = 0; i < 64; i++) {
        if (i < 16) w[i] = chunk[i] | 0;
        else {
          var s0 = rrot(w[i - 15], 7) ^ rrot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          var s1 = rrot(w[i - 2], 17) ^ rrot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        var S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + k[i] + w[i]) | 0;
        var S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      h0[0] = (h0[0] + a) | 0; h0[1] = (h0[1] + b) | 0; h0[2] = (h0[2] + c) | 0; h0[3] = (h0[3] + d) | 0;
      h0[4] = (h0[4] + e) | 0; h0[5] = (h0[5] + f) | 0; h0[6] = (h0[6] + g) | 0; h0[7] = (h0[7] + hh) | 0;
    }
    for (var i = 0; i < 8; i++) {
      result += ('00000000' + (h0[i] >>> 0).toString(16)).slice(-8);
    }
    return result;
  }
})();
