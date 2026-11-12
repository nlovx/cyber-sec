/* CYBER SEC — виджет fstree: интерактивное дерево каталогов Linux с объяснением каждой папки. */
(function () {
  'use strict';
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var DIRS = [
    ['/', 'Корень', 'Начало всего: от него растёт всё дерево. В Linux нет букв дисков (C:, D:) — другие диски «монтируются» в папки.', 'Здесь ничего своего не храни.'],
    ['/home', 'Домашние папки', 'У каждого пользователя своя папка: /home/student. Твои документы, настройки, скрипты.', 'Только тут пользователь может свободно писать. Атакующие часто ищут тут ключи SSH и пароли.'],
    ['/etc', 'Настройки системы', 'Конфигурационные файлы: hosts, passwd, ssh, сервисы. Почти всё — обычный текст.', 'Сердце настроек: правка /etc/passwd или ssh-конфига = контроль над системой, поэтому писать сюда может только root.'],
    ['/var', 'Меняющиеся данные', 'Логи (/var/log), почта, базы данных, веб-сайты (/var/www).', 'Главное место поиска следов: /var/log/auth.log показывает входы и попытки перебора.'],
    ['/tmp', 'Временные файлы', 'Сюда может писать любой; файлы стираются при перезагрузке.', 'Любимое место вредоносов: можно записать файл без особых прав.'],
    ['/usr', 'Программы и библиотеки', 'Установленные программы и общие данные (/usr/bin, /usr/share).', 'Менять может только root: иначе любая программа подменилась бы.'],
    ['/bin /sbin', 'Системные команды', 'Базовые утилиты: ls, cat, cp (bin) и административные (sbin).', 'Подмена этих файлов — признак руткита.'],
    ['/root', 'Дом администратора', 'Домашняя папка пользователя root, закрыта для остальных.', 'Цель повышения привилегий: если читаешь /root, ты уже администратор.'],
    ['/dev', 'Устройства как файлы', 'Диски (/dev/sda), терминалы, «чёрная дыра» /dev/null.', 'Прямой доступ к диску = обход прав файловой системы.'],
    ['/proc', 'Живая информация о системе', 'Виртуальные файлы: процессы, память, процессор — их нет на диске, ядро формирует на лету.', 'Из /proc видно, что запускает процесс: полезно при расследовании.']
  ];
  CS.viz('fstree', function (box) {
    var list = h('div', 'ft-list'), info = h('div', 'hw-info');
    function show(i) {
      Array.prototype.forEach.call(list.children, function (c, k) { c.classList.toggle('on', k === i); });
      var d = DIRS[i]; clear(info);
      info.appendChild(h('div', 'hw-name', d[0] + '  ·  ' + d[1]));
      info.appendChild(h('p', null, d[2]));
      var s = h('p', 'hw-an'); s.textContent = 'Для безопасности: ' + d[3]; info.appendChild(s);
    }
    DIRS.forEach(function (d, i) { var b = h('button', 'ft-item'); b.appendChild(h('b', null, d[0])); b.appendChild(h('span', null, d[1])); b.onclick = function () { show(i); }; list.appendChild(b); });
    box.appendChild(list); box.appendChild(info); box.appendChild(h('div', 'viz-hint', 'Нажимай на папки. Запомни три главные: /home (твоё), /etc (настройки), /var/log (следы событий).'));
    show(0);
  });
})();
