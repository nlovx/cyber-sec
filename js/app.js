/* CYBER SEC — точка входа. Подключается последним, после движка, виджетов, UI и курсов. */
(function () {
  'use strict';
  function boot() {
    if (!window.CS) { console.error('[CS] движок не загрузился'); return; }
    CSUI.mount();
    window.addEventListener('hashchange', CSUI.route);
    // Гарантированно дописываем прогресс при уходе со страницы (на случай троттлинга записи).
    window.addEventListener('beforeunload', function () { try { CS.saveNow(); } catch (e) {} });
    window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { try { CS.saveNow(); } catch (e) {} } });
    CSUI.route();
    if (window.CSAcc) CSAcc.init().then(function () { if ((CSAcc.state.nick || CSAcc.state.available) && !/^#\/(lesson|review|diagnostic)/.test(location.hash)) CSUI.route(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
