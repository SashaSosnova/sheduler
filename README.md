# Sheduler

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

Готовый APK также собирается на GitHub и лежит тут:

**https://github.com/SashaSosnova/sheduler/releases/latest/download/sheduler.apk**

### Как ставить / обновлять с файла (без adb)

1. Удали старое Sheduler из списка приложений (иначе старая подпись может мешать).
2. Настройки → Безопасность и конфиденциальность → **Автоблокировка** → выкл.
3. Настройки → Приложения → **Мои файлы** → Установка неизвестных приложений → разрешить.
4. Скачай `sheduler.apk` и открой из Downloads.

Дальше новые версии с этой же ссылки ставятся поверх — подпись в репозитории одна и та же.

### Полезные команды

| Команда | Что делает |
|---------|------------|
| `npm run cap:sync` | Сборка веба + копирование в Android |
| `npm run cap:open` | Открыть проект в Android Studio |
| `npm run apk:debug` | Собрать debug APK |

После изменений в React-коде всегда делай `npm run cap:sync` (или `apk:debug`), чтобы оболочка Android получила новую версию.

## Экраны

- **Сегодня** — обязательный минимум, планы, лимиты экранов
- **Прогресс** — уровень, скины, стикеры-достижения (только у ребёнка)
- **Дни** — календарь со звёздочками и сводкой за выбранный день
- **Зарядка** — упражнения из ДЗ №28 с таймерами
- **Жевание** — дневник жевания и сводка для миотерапевта

Данные хранятся на устройстве (localStorage). Чтобы синхронизировать телефон и планшет, в **Настройках** есть блок «Облако — все устройства»: создай семью на одном устройстве и введи тот же код на другом.

## Firebase (синхронизация между устройствами)

Ключи уже лежат в локальном `.env` (в git не попадает). В [Firebase Console](https://console.firebase.google.com/project/kid-sheduler) нужно один раз включить:

1. **Authentication** → Sign-in method → **Anonymous** → Enable.
2. **Firestore Database** → Create database (режим production).
3. **Firestore** → Rules → вставь правила из файла `firestore.rules` в репозитории и Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyCode} {
      allow read, write: if request.auth != null;
    }
  }
}
```

После этого: `npm run dev` → **Создать семью** → на втором устройстве **Войти по коду**.

Синхронизируются: дни (чек-лист, задания, напоминания, Roblox), дневник жевания, копилки и достижения. Зарядка берётся из кода приложения.
