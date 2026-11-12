/* CYBER SEC ↔ CryptoLab: вшитый курс криптографии (cryptolab/) как отдельный трек.
   Комнаты, пути и прогресс берутся прямо из cryptolab/content.js и localStorage "cryptolab-progress",
   поэтому обновление CryptoLab (новые комнаты) подхватывается автоматически. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.LAB || !window.CS) return;
  var LAB = window.LAB;

  function solved() {
    try { var raw = localStorage.getItem('cryptolab-progress'); return (raw && JSON.parse(raw).solved) || {}; }
    catch (e) { return {}; }
  }
  function qsOf(room) { return (room.tasks || []).reduce(function (a, t) { return a.concat(t.qs || []); }, []); }
  function roomProgress(id) {
    var r = LAB.rooms[id], qs = r && !r.soon ? qsOf(r) : [], s = solved();
    var done = qs.filter(function (q) { return s[q.id]; }).length;
    return { done: done, total: qs.length, pct: qs.length ? Math.round(done / qs.length * 100) : 0 };
  }
  function firstSentence(t) { t = String(t || '').replace(/<[^>]+>/g, ''); var m = t.match(/^[^.!?]+[.!?]/); return (m ? m[0] : t).slice(0, 160); }

  var items = [], prevFirst = null;
  LAB.paths.forEach(function (p) {
    var prev = null, first = null;
    p.rooms.forEach(function (rid) {
      var r = LAB.rooms[rid]; if (!r) return;
      var it = { id: 'cl-' + rid, track: 'crypto', title: r.title, goal: r.soon ? 'Скоро: ' + (p.title) : firstSentence(r.intro),
                 needs: prev ? [prev] : (prevFirst ? [prevFirst] : []), roomId: rid, pathTitle: p.title };
      if (!r.soon) it.href = 'cryptolab/index.html#' + rid;
      items.push(it); if (!r.soon) prev = it.id; if (!first) first = it.id;
    });
    if (first) prevFirst = first;
  });
  CS.roadmap('crypto', items);

  CS.externalProgress('crypto', function (item) {
    if (item) return roomProgress(item.roomId);
    var done = 0, total = 0, n = 0;
    items.forEach(function (it) { if (!it.href) return; n++; var p = roomProgress(it.roomId); done += p.done; total += p.total; });
    return { done: done, total: total, items: n };
  });
})();
