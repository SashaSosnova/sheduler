# Каникулы — план и зарядка

Мобильное приложение для каникул: план дня, календарь, зарядка с таймерами и дневник жевания.

Репозиторий: https://github.com/SashaSosnova/sheduler

Сделано по тому же принципу, что и `home-garden`: веб-приложение на Vite + React, упакованное в Android через **Capacitor**.

## Запуск в браузере

```bash
npm install
npm run dev
```

Открой адрес из терминала. На телефоне в той же Wi‑Fi сети — `http://<IP-компьютера>:5173`.

## Мобильное приложение (Android)

Нужны: [Android Studio](https://developer.android.com/studio) (или Android SDK) и JDK 21.

```bash
npm install
npm run cap:sync
npm run cap:open
```

В Android Studio: Run на эмуляторе или телефоне.

Собрать debug APK из терминала (Windows):

```bash
npm run apk:debug
```

APK появится примерно здесь:

`android/app/build/outputs/apk/debug/app-debug.apk`

Его можно скопировать на телефон и установить (разрешить установку из неизвестных источников).

### Полезные команды

| Команда | Что делает |
|---------|------------|
| `npm run cap:sync` | Сборка веба + копирование в Android |
| `npm run cap:open` | Открыть проект в Android Studio |
| `npm run apk:debug` | Собрать debug APK |

После изменений в React-коде всегда делай `npm run cap:sync` (или `apk:debug`), чтобы оболочка Android получила новую версию.

## Экраны

- **Сегодня** — обязательный минимум, планы, лимиты экранов
- **Месяц** — календарь и сводка по дням
- **Зарядка** — упражнения из ДЗ №28 с таймерами
- **Жевание** — дневник жевания и сводка для миотерапевта

Данные хранятся на устройстве (localStorage).
