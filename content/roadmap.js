/* CYBER SEC — ПРОГРАММА (roadmap): полный план по всем направлениям.
   Путь: ФУНДАМЕНТ (что должен знать каждый) → ядро (сети, ОС, код) → ветвление по специализациям.
   `needs` — зависимости между темами: из них строится граф на экране «Карта».
   ready:true проставляется автоматически, если курс реально зарегистрирован (content/*.js);
   остальное честно показывается как «скоро», без фейка. */

// ФУНДАМЕНТ — нужен для всего остального.
CS.roadmap('base', [
  { id: 'start-here', title: 'Старт: компьютер с нуля',          goal: 'Для совсем новичков: что внутри ПК, биты и цвета, как открывается сайт, первый код и безопасность', needs: [] },
  { id: 'pc',        title: 'Как устроен компьютер',            goal: 'Биты, процессор, память, загрузка — что внутри корпуса', needs: ['start-here'] },
  { id: 'hw',        title: 'Железо: каждый компонент',         goal: 'CPU, ОЗУ, GPU, накопители, плата, питание — роль и узкие места', needs: ['pc'] },
  { id: 'data-repr', title: 'Данные: кодировки, числа, файлы',  goal: 'UTF-8, представление чисел, форматы, «кракозябры»', needs: ['pc'] },
  { id: 'sw-runs',   title: 'Как программа становится процессом', goal: 'Компиляция, стек и куча, процессы, потоки, системные вызовы', needs: ['hw', 'data-repr'] },
  { id: 'games',     title: 'Как работают игры',                goal: 'Игровой цикл, FPS, графический конвейер, сеть и читы', needs: ['hw', 'sw-runs'] },
  { id: 'apps-web',  title: 'Как работают приложения и сайты',  goal: 'Клиент-сервер, HTTP, бэкенд, базы данных, API, сессии', needs: ['sw-runs'] },
  { id: 'logic-base', title: 'Логика и дискретка для технаря',  goal: 'Булева логика, системы счисления, множества — рабочий минимум', needs: ['data-repr'] }
]);

// СИСТЕМЫ И ОС — Windows, Linux, терминал, администрирование.
CS.roadmap('sysadmin', [
  { id: 'lab-terminal', title: 'Практикум: терминал и код (CyberBox)', goal: 'Виртуальный ПК: файлы, логи, скрипты, флаги', needs: ['pc'] },
  { id: 'linux-basics', title: 'Linux с нуля',                 goal: 'Папки, права, sudo, процессы, службы, скрипты — в виртуальной машине', needs: ['lab-terminal'] },
  { id: 'os-intro',      title: 'Как устроена операционная система', goal: 'Ядро, процессы, память, файловая система, прерывания', needs: ['sw-runs'] },
  { id: 'cli-shell',     title: 'Командная строка и оболочка',  goal: 'bash и PowerShell: навигация, пайпы, перенаправление, скрипты', needs: ['pc'] },
  { id: 'linux-perm',    title: 'Linux: файлы, права, пользователи', goal: 'rwx, владельцы, sudo, монтирование', needs: ['cli-shell'] },
  { id: 'proc-svc',      title: 'Процессы, службы, systemd',    goal: 'Запуск, сигналы, демоны, журналы, автозапуск', needs: ['linux-perm', 'os-intro'] },
  { id: 'win-internals', title: 'Windows изнутри',              goal: 'Реестр, службы, журналы событий, процессы и права', needs: ['os-intro'] }
]);

// СЕТИ — как всё связано.
CS.roadmap('net', [
  { id: 'net',          title: 'Как работают сети',             goal: 'DNS, IP и подсети, маршруты, пакеты, диагностика', needs: ['pc'] },
  { id: 'tcpip-deep',   title: 'TCP/IP глубоко',                goal: 'Порты, сокеты, состояния, надёжность, UDP, ARP, DHCP', needs: ['net'] },
  { id: 'routing-sw',   title: 'Коммутация и маршрутизация',    goal: 'Коммутаторы, VLAN, таблицы маршрутов, NAT, фаервол', needs: ['tcpip-deep'] },
  { id: 'http-tls',     title: 'HTTP, TLS и веб-запрос',        goal: 'Путь запроса, HTTPS, сертификаты, что видит наблюдатель', needs: ['tcpip-deep', 'apps-web'] },
  { id: 'net-analysis', title: 'Анализ трафика (Wireshark)',    goal: 'Фильтры, сканирование портов, DNS-туннели на учебном захвате', needs: ['routing-sw', 'http-tls'] }
]);

// КОД И АВТОМАТИЗАЦИЯ.
CS.roadmap('programming', [
  { id: 'prog-base',    title: 'Основы программирования',       goal: 'Переменные, условия, циклы, функции, структуры — с автопроверкой', needs: ['pc'] },
  { id: 'git-basics',   title: 'Git и работа с кодом',          goal: 'Коммиты, ветки, слияния, откаты — без страха', needs: ['prog-base'] },
  { id: 'python-auto',  title: 'Python для автоматизации',      goal: 'Файлы, запросы, парсинг, маленькие полезные инструменты', needs: ['prog-base'] },
  { id: 'bash-scripts', title: 'Скрипты оболочки',              goal: 'bash/PowerShell: автоматизировать рутину и задачи админа', needs: ['prog-base', 'cli-shell'] },
  { id: 'dsa-base',     title: 'Структуры данных и алгоритмы',  goal: 'Массивы, списки, словари, сложность — рабочая база', needs: ['prog-base'] },
  { id: 'c-memory',     title: 'C и работа с памятью',          goal: 'Указатели, ручное управление памятью, почему бывают уязвимости', needs: ['dsa-base', 'sw-runs'] }
]);

// БЕЗОПАСНОСТЬ — защита, модель угроз, Blue Team.
CS.roadmap('security', [
  { id: 'sec-mindset', title: 'Модель угроз и мышление',        goal: 'Как думать об атакующем, активы, риски, поверхность атаки', needs: ['net', 'apps-web'] },
  { id: 'crypto-base', title: 'Криптография на практике',       goal: 'Хеши, симметрика/асимметрика, ключи, где что применять', needs: ['pc'] },
  { id: 'authn',       title: 'Аутентификация и доступ',        goal: 'Пароли, хеширование, MFA, сессии, токены, частые ошибки', needs: ['sec-mindset', 'crypto-base'] },
  { id: 'web-sec',     title: 'Веб-уязвимости (OWASP)',         goal: 'XSS, инъекции, доступ — в локальной уязвимой лаборатории', needs: ['authn', 'http-tls'] },
  { id: 'blue-team',   title: 'Обнаружение и реагирование',     goal: 'Логи, индикаторы, разбор инцидента, что делать при атаке', needs: ['net-analysis', 'sec-mindset'] },
  { id: 'lab-recon',   title: 'Практикум: разведка и взлом учебного сайта', goal: 'nmap, robots.txt, SQL-инъекция на выдуманном shop.local', needs: ['lab-terminal', 'web-sec'] },
  { id: 'appsec',      title: 'Безопасная разработка',          goal: 'Валидация, секреты, зависимости, ревью кода на уязвимости', needs: ['web-sec', 'prog-base'] }
]);

// КРИПТОГРАФИЯ — вшитый CryptoLab: комнаты подставляются из cryptolab/content.js (см. content/cryptolab-link.js).

// OSINT — разведка по открытым источникам (этично, учебные кейсы).
CS.roadmap('osint', [
  { id: 'osint-intro', title: 'OSINT: методика и этика',        goal: 'Цикл разведки, операторы поиска, проверка фактов и фото', needs: ['net'] },
  { id: 'osint-web',   title: 'Поиск по открытым источникам',   goal: 'Домены, DNS, сертификаты, цифровой след, итоговое дело', needs: ['osint-intro', 'http-tls'] },
  { id: 'osint-geo',   title: 'Геолокация и хронолокация',      goal: 'Место и время съёмки по теням, ландшафту, вывескам', needs: ['osint-intro'] },
  { id: 'osint-social', title: 'Социальные сети и люди (этика)', goal: 'Что допустимо, корреляция аккаунтов, защита приватности', needs: ['osint-intro'] },
  { id: 'threat-intel', title: 'Threat Intelligence',           goal: 'Индикаторы, группировки, MITRE ATT&CK, отчёты', needs: ['osint-web', 'blue-team'] }
]);

// ФОРЕНЗИКА — расследование.
CS.roadmap('forensics', [
  { id: 'forensics-intro', title: 'Основы цифровой форензики',  goal: 'Артефакт, цепочка хранения, принципы расследования', needs: ['win-internals'] },
  { id: 'disk-mem',        title: 'Диск и память',              goal: 'Файловые артефакты, удалённые данные, образы, что хранит RAM', needs: ['forensics-intro'] },
  { id: 'timeline',        title: 'Таймлайн инцидента по логам', goal: 'Собрать цепочку событий из разрозненных журналов', needs: ['disk-mem', 'blue-team'] },
  { id: 'mobile-forensics', title: 'Мобильная форензика',        goal: 'Артефакты Android/iOS, резервные копии, ограничения', needs: ['disk-mem'] }
]);

// ОБЛАКА — серверы, инфраструктура, DevSecOps.
CS.roadmap('cloud', [
  { id: 'servers',    title: 'Серверы и инфраструктура',        goal: 'Поднять и обслуживать сервер, сервисы, домены', needs: ['proc-svc', 'net'] },
  { id: 'containers', title: 'Контейнеры и Docker',             goal: 'Образы, контейнеры, изоляция, зачем это нужно', needs: ['servers'] },
  { id: 'cloud-basics', title: 'Облачные платформы',            goal: 'IaaS/PaaS, роли и доступ, сеть в облаке, типичные ошибки', needs: ['containers'] },
  { id: 'devsecops',  title: 'CI/CD и DevSecOps',               goal: 'Автоматизация сборки/деплоя и безопасность в конвейере', needs: ['containers', 'git-basics'] },
  { id: 'cloud-sec',  title: 'Безопасность облака',             goal: 'IAM, секреты, публичные бакеты, мониторинг', needs: ['cloud-basics', 'sec-mindset'] }
]);

// ВЕБ-РАЗРАБОТКА.
CS.roadmap('webdev', [
  { id: 'web-front',  title: 'HTML, CSS и JavaScript',          goal: 'Страница с нуля: структура, стиль, поведение', needs: ['prog-base', 'apps-web'] },
  { id: 'web-back',   title: 'Бэкенд и API',                    goal: 'Сервер на Node.js/Python, маршруты, валидация, аутентификация', needs: ['web-front'] },
  { id: 'databases',  title: 'Базы данных и SQL',               goal: 'Таблицы, запросы, индексы, транзакции, безопасные запросы', needs: ['web-back'] },
  { id: 'web-deploy', title: 'Деплой и хостинг',                goal: 'Домен, HTTPS, сервер, CI, мониторинг', needs: ['web-back', 'servers'] },
  { id: 'web-perf',   title: 'Производительность и UX',         goal: 'Скорость загрузки, доступность, адаптивность', needs: ['web-front'] }
]);

// ГЕЙМДЕВ.
CS.roadmap('gamedev', [
  { id: 'gd-loop',    title: 'Игровой цикл на практике',        goal: 'Своя мини-игра: ввод, обновление, рисование, столкновения', needs: ['prog-base', 'games'] },
  { id: 'gd-physics', title: 'Физика и математика игр',         goal: 'Векторы, столкновения, интегрирование, фиксированный шаг', needs: ['gd-loop'] },
  { id: 'gd-engine',  title: 'Игровые движки',                  goal: 'Godot/Unity: сцены, компоненты, ассеты, сборка', needs: ['gd-loop'] },
  { id: 'gd-3d',      title: '3D и шейдеры',                    goal: 'Матрицы, камера, освещение, шейдеры', needs: ['gd-physics'] },
  { id: 'gd-net',     title: 'Сетевая игра',                    goal: 'Авторитетный сервер, предсказание, античит-основы', needs: ['gd-engine', 'tcpip-deep'] }
]);

// ДАННЫЕ И ИИ.
CS.roadmap('ai', [
  { id: 'data-stats', title: 'Статистика для данных',           goal: 'Распределения, корреляция, выборки, ошибки интерпретации', needs: ['prog-base'] },
  { id: 'py-data',    title: 'Python для данных',               goal: 'NumPy, pandas, графики, чистка данных', needs: ['python-auto', 'data-stats'] },
  { id: 'ml-basics',  title: 'Машинное обучение: основы',       goal: 'Регрессия, классификация, переобучение, метрики', needs: ['py-data'] },
  { id: 'deep-learning', title: 'Нейросети',                    goal: 'Нейрон, обратное распространение, CNN, трансформеры', needs: ['ml-basics'] },
  { id: 'ai-security', title: 'Безопасность ИИ',                goal: 'Prompt injection, отравление данных, утечки, защита', needs: ['deep-learning', 'sec-mindset'] }
]);

// ЖЕЛЕЗО И ВСТРАИВАЕМОЕ.
CS.roadmap('hardware', [
  { id: 'electronics', title: 'Основы электроники',             goal: 'Ток, напряжение, резистор, транзистор, логические вентили', needs: ['hw'] },
  { id: 'arduino',     title: 'Микроконтроллеры (Arduino)',     goal: 'Порты, датчики, прерывания, первые устройства', needs: ['electronics', 'prog-base'] },
  { id: 'iot-protocols', title: 'IoT и протоколы',              goal: 'MQTT, BLE, Wi-Fi, обновление прошивок', needs: ['arduino', 'tcpip-deep'] },
  { id: 'hw-security', title: 'Безопасность устройств',         goal: 'UART/JTAG, прошивки, физический доступ, защита', needs: ['iot-protocols', 'sec-mindset'] }
]);

// RED TEAM / ПЕНТЕСТ — самое глубокое направление. СТРОГО в лаборатории и с разрешения.
// Подход: механизм → симуляция/лаба → КАК ЧИНИТЬ и КАК ОБНАРУЖИТЬ. Без рабочих эксплойтов.
CS.roadmap('redteam', [
  { id: 'pentest-intro', title: 'Введение в пентест',           goal: 'Методология, разрешения, этапы, этика и границы закона', needs: ['web-sec', 'net-analysis'] },
  { id: 'recon-enum',    title: 'Разведка и перечисление',      goal: 'Сбор информации о цели в собственной лаборатории', needs: ['pentest-intro', 'osint-web'] },
  { id: 'web-pentest',   title: 'Тестирование веб-приложений',  goal: 'OWASP на уязвимых приложениях: поиск, доказательство, исправление', needs: ['pentest-intro'] },
  { id: 'exploit-lab',   title: 'Эксплуатация уязвимостей',     goal: 'Как работают классы уязвимостей на уязвимой VM — и как чинить', needs: ['recon-enum', 'c-memory'] },
  { id: 'privesc',       title: 'Повышение привилегий',         goal: 'Пост-эксплуатация в лабе: механизмы и их закрытие', needs: ['exploit-lab', 'win-internals'] },
  { id: 'ad-attacks',    title: 'Active Directory: атака/защита', goal: 'Как ломают и защищают доменную сеть (лаборатория)', needs: ['privesc'] },
  { id: 'redteam-ops',   title: 'Операции Red Team',            goal: 'Концептуально, с упором на обнаружение со стороны Blue Team', needs: ['ad-attacks', 'threat-intel'] }
]);

// РЕВЕРС И МАЛВАРЬ — только в изолированной лаборатории.
CS.roadmap('reverse', [
  { id: 'asm-basics',   title: 'Ассемблер x86-64',              goal: 'Регистры, стек, вызовы, чтение дизассемблера', needs: ['c-memory'] },
  { id: 're-tools',     title: 'Инструменты реверса',           goal: 'Ghidra, отладчик, статический и динамический анализ crackme', needs: ['asm-basics'] },
  { id: 'malware-static', title: 'Статический анализ малвари',  goal: 'Строки, импорты, упаковщики, YARA — в изолированной лабе', needs: ['re-tools', 'sw-runs'] },
  { id: 'malware-dynamic', title: 'Динамический анализ',        goal: 'Песочница, поведение, сетевая активность, индикаторы', needs: ['malware-static', 'net-analysis'] },
  { id: 'vuln-research', title: 'Поиск уязвимостей',            goal: 'Фаззинг, анализ крэшей, ответственное раскрытие', needs: ['re-tools', 'exploit-lab'] }
]);
