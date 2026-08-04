/** Soft-guidance catalog for the Roblox Studio game project. */

export type StudioMoodImage = {
  src: string
  caption: string
}

/** One frame in a visual build guide (room overview or puzzle step) */
export type StudioGuideFrame = {
  src: string
  caption: string
}

export type StudioVisualGuide = {
  title: string
  frames: StudioGuideFrame[]
  /** Short Studio tips: which Parts / Materials / services to use */
  helpers?: string[]
}

/** One puzzle mechanic option for a level sprint */
export type StudioPuzzleChoice = {
  id: string
  title: string
  /** Short how-it-works for the child */
  summary: string
  /** Optional 2–3 visual steps: what to place → click → reward */
  steps?: StudioGuideFrame[]
}

export type StudioSprintDef = {
  id: string
  title: string
  /** What should feel done when the sprint is ready for review */
  goal: string
  /** Short acceptance line for parent review */
  parentCheck: string
  /** Folded «Описание» — short guidance, not a second tips list */
  description: string[]
  /** Optional room mockups + Studio helpers for this sprint */
  visualGuide?: StudioVisualGuide
  /**
   * Puzzle mechanics to pick from (levels with progression).
   * Child chooses one (or mixes lightly) — not all at once.
   */
  puzzleChoices?: StudioPuzzleChoice[]
}

export type StudioProjectDef = {
  title: string
  pitch: string
  /** Compact checklist for parent Награды screen */
  parentBrief: string[]
  /** Plot — fixed story spine */
  story: string[]
  /** Core gameplay rules that make the time loop work */
  mechanic: string[]
  /** Visual style checklist */
  visualStyle: string[]
  /** Meta framing so the child doesn’t redesign the whole game every day */
  fixedRules: string[]
  moodImages: StudioMoodImage[]
  sprints: StudioSprintDef[]
}

export const STUDIO_PROJECT: StudioProjectDef = {
  title: 'Игра в Roblox Studio',
  pitch:
    'Петля времени в башне Хранителя Времени: стимпанк + мистика, большие часы, тиканье. Собери 3 кристалла и почини часы — иначе петля зациклит тебя навсегда. Загадки внутри этой истории — твои.',
  parentBrief: [
    'Башня мага, стимпанк, большие часы + тиканье.',
    'Петля ~2 минуты: на нуле комната и обычный инвентарь сбрасываются, кристаллы остаются.',
    '3 кристалла через загадки с прогрессией → починка часов и экран победы.',
  ],
  story: [
    'Игрок просыпается в заброшенной башне древнего Хранителя Времени.',
    'Часы на стене сломаны: каждые 2 минуты время отматывается назад — комната меняется, предметы возвращаются на места.',
    'Цель: починить часы, собрав 3 магических кристалла, пока петля не зациклила игрока навсегда.',
  ],
  mechanic: [
    'Это петля времени, а не просто «таймер обнулился». На нуле мир откатывается: предметы снова на стартовых местах.',
    'У игрока инвентарь на 3 слота.',
    'При перемотке времени всё из инвентаря пропадает — кроме кристаллов. Кристаллы остаются с игроком между петлями.',
    'Из-за этого нужно действовать быстро и запоминать порядок действий: ключи и обычные вещи не «копятся» между петлями.',
  ],
  visualStyle: [
    'Стиль: стимпанк + мистика (не чистый sci-fi и не яркий мультфильм).',
    'Цвета: тёплое золото, состаренная медь, тёмно-синий (ночь), фиолетовое свечение магии.',
    'Свет: в целом темно; много свечей и летающих светящихся частиц (ParticleEmitter).',
    'Детали: шестерёнки на стенах, маятники, книги на цепях, большие часы + фоновое тиканье.',
  ],
  fixedRules: [
    'Мир — башня Хранителя Времени с уровнями (этажами).',
    'Обязательно: большие (сломанные) часы в мире + тиканье на фоне (Sound, Looping).',
    'Не меняй сюжет и рамку каждый день. Новые идеи — внутрь башни, петли и стимпанка.',
    'На уровнях с загадками выбери одну механику из списка (или слегка смешай две) — не делай все сразу.',
  ],
  moodImages: [
    {
      src: './studio/tower-exterior.png',
      caption: 'Башня снаружи — уровни и часы на фасаде',
    },
    {
      src: './studio/clock-room.png',
      caption: 'Комната с большими часами — тиканье и петля',
    },
    {
      src: './studio/lab-level.png',
      caption: 'Этаж-лаборатория — загадки и стимпанк',
    },
    {
      src: './studio/finale-chamber.png',
      caption: 'Финал — кристаллы и механизм часов',
    },
  ],
  sprints: [
    {
      id: 'sprint-1-foundation',
      title: 'Спринт 1 · Фундамент башни',
      goal: 'Этаж башни: стимпанк, большие сломанные часы, тиканье. Можно погулять по комнате.',
      parentCheck: 'Комната-башня в стимпанке, большие часы, слышно тиканье.',
      description: [
        'Сначала башня снаружи, потом один этаж внутри — где игрок гуляет.',
        'В комнате обязательно: большие сломанные часы + тиканье. Остальной декор — по вкусу.',
        'Цвета из брифа: золото, медь, ночь, фиолетовое свечение.',
      ],
      visualGuide: {
        title: 'Как выглядит фундамент',
        frames: [
          {
            src: './studio/sprint1/tower-outside.png',
            caption: 'Снаружи: высокая башня с часами на фасаде',
          },
          {
            src: './studio/sprint1/room-interior.png',
            caption: 'Внутри: тёмный этаж, где можно ходить',
          },
          {
            src: './studio/sprint1/big-clock.png',
            caption: 'Большие «сломанные» часы на стене',
          },
          {
            src: './studio/sprint1/decor-pipes.png',
            caption: 'Декор: трубы, шестерёнки, свечи',
          },
        ],
        helpers: [
          'Снаружи: высокий цилиндр или стопка Part (Slate) + крыша (Wedge/Cone) + дверь внизу.',
          'Часы на фасаде: большой Cylinder + стрелки из тонких Part; можно криво — они «сломанные».',
          'Комната: пол и стены Part (Slate / Cobblestone), пол желательно Anchored.',
          'Трубы: Cylinder, Material = Metal, цвет меди; шестерёнки — тонкий Cylinder + зубцы Part.',
          'Свечи: Cylinder + маленький Neon-огонёк и PointLight.',
          'Тиканье: вставь Sound в часы или Workspace, возьми звук из Toolbox, включи Looping и PlayOnRemove = false; Play при старте.',
          'Проверь в Play: персонаж проходит в дверь/по полу, ничего не проваливается.',
        ],
      },
    },
    {
      id: 'sprint-2-time',
      title: 'Спринт 2 · Петля времени',
      goal: 'На экране таймер 2:00. На нуле — петля: таймер снова 2:00, предметы возвращаются на места.',
      parentCheck: 'Таймер 2:00; на нуле петля — предметы/таймер откатываются.',
      description: [
        'Сделай таймер 02:00 на экране и цикл 120 секунд.',
        'На нуле — петля: таймер снова 02:00, предметы на стартовые места.',
        '2 минуты специально короткие: успеть цепочку действий, а не гулять полчаса.',
      ],
      visualGuide: {
        title: 'Как работает петля',
        frames: [
          {
            src: './studio/sprint2/timer-ui.png',
            caption: 'На экране таймер 02:00 (ScreenGui → TextLabel)',
          },
          {
            src: './studio/sprint2/script-places.png',
            caption: 'Где лежит логика: UI в StarterGui, цикл в ServerScriptService',
          },
          {
            src: './studio/sprint2/loop-reset.png',
            caption: 'На нуле предметы возвращаются на места',
          },
        ],
        helpers: [
          'UI: StarterGui → ScreenGui → TextLabel. Текст вида 02:00, крупно, сверху по центру.',
          'Скрипт цикла: Script в ServerScriptService (не LocalScript). Он считает секунды от 120 до 0.',
          'Каждую секунду обновляй текст таймера (через RemoteEvent в клиент или общий NumberValue — как удобнее).',
          'Стартовые места: для каждого важного предмета запомни Position/CFrame при старте (атрибут или таблица в скрипте).',
          'На нуле: верни предметы на сохранённые места, таймер снова 120, цикл повторяется.',
          'Чтобы петля чувствовалась: короткая вспышка (яркость Lighting) или звук «отмотки» из Toolbox.',
          'Пока без инвентаря и кристаллов — только комната + таймер + откат предметов.',
        ],
      },
    },
    {
      id: 'sprint-3-level1',
      title: 'Спринт 3 · Уровень 1 + инвентарь',
      goal: 'Инвентарь на 3 слота. Короткая загадка → 1-й кристалл. Петля сбрасывает обычные вещи, кристалл остаётся.',
      parentCheck:
        'Инвентарь 3 слота; загадка с обычным предметом → 1-й кристалл; петля сбрасывает вещи, кристалл остаётся.',
      description: [
        'Выбери одну загадку. До кристалла игрок берёт 1–2 обычных предмета — иначе непонятно, зачем сброс инвентаря.',
        'При петле убирай из инвентаря всё, кроме кристалла; ключи и шестерни возвращай в мир.',
      ],
      visualGuide: {
        title: 'Как выглядит уровень',
        frames: [
          {
            src: './studio/level1/room-overview.png',
            caption: 'Комната: часы, полка, стол, сундук, кристалл на пьедестале',
          },
          {
            src: './studio/level1/room-inventory.png',
            caption: 'Инвентарь — 3 слота внизу экрана (ScreenGui)',
          },
          {
            src: './studio/level1/room-crystal-stays.png',
            caption: 'Петля: обычные вещи пропадают, кристалл остаётся',
          },
        ],
        helpers: [
          'Стены/пол: Part, Material = Slate или Cobblestone; дерево стола — Wood.',
          'Медь и золото: Part, Material = Metal или Foil; цвет тёплый коричневый/жёлтый.',
          'Свечи: Cylinder + Neon (огонёк) и PointLight внутри.',
          'Кристалл: Part/Wedge с Material = Neon, фиолетовый цвет + PointLight.',
          'Клик по предмету: добавь ClickDetector внутрь Part (или возьми модель из Toolbox).',
          'Инвентарь: StarterGui → ScreenGui → три Frame-слота; предметы клади туда скриптом.',
        ],
      },
      puzzleChoices: [
        {
          id: 'l1-book',
          title: 'Книжный тайник',
          summary:
            'Книга → ключ → сундук → кристалл. Без ключа сундук не открывается.',
          steps: [
            {
              src: './studio/level1/puzzle-book-1.png',
              caption: 'На полке книги (Part или модель из Toolbox)',
            },
            {
              src: './studio/level1/puzzle-book-2.png',
              caption: 'Клик по книге → появляется ключ',
            },
            {
              src: './studio/level1/puzzle-book-3.png',
              caption: 'Ключ открывает сундук → кристалл',
            },
          ],
        },
        {
          id: 'l1-painting',
          title: 'Картина и ларец',
          summary:
            'Картина открывает нишу с ключом → ларец на столе → кристалл.',
          steps: [
            {
              src: './studio/level1/puzzle-painting-1.png',
              caption: 'Картина на стене (Frame + Part-холст)',
            },
            {
              src: './studio/level1/puzzle-painting-2.png',
              caption: 'Клик — картина открывается, в нише ключ',
            },
            {
              src: './studio/level1/puzzle-painting-3.png',
              caption: 'Ключ открывает ларец на столе → кристалл',
            },
          ],
        },
        {
          id: 'l1-candle',
          title: 'Свеча и спички',
          summary:
            'Спички + правильная свеча → тайник с кристаллом. Без спичек клик ничего не даёт.',
          steps: [
            {
              src: './studio/level1/puzzle-candle-1.png',
              caption: 'Спички на столе + несколько свечей',
            },
            {
              src: './studio/level1/puzzle-candle-2.png',
              caption: 'Со спичками зажги нужную свечу (Neon + Light)',
            },
            {
              src: './studio/level1/puzzle-candle-3.png',
              caption: 'Открывается тайник → кристалл',
            },
          ],
        },
        {
          id: 'l1-gear',
          title: 'Недостающая шестерня',
          summary:
            'Найди шестерню → вставь в механизм на стене → отсек с кристаллом.',
          steps: [
            {
              src: './studio/level1/puzzle-gear-1.png',
              caption: 'Шестерня лежит в комнате (Cylinder + зубцы)',
            },
            {
              src: './studio/level1/puzzle-gear-2.png',
              caption: 'На стене механизм с пустым гнездом',
            },
            {
              src: './studio/level1/puzzle-gear-3.png',
              caption: 'Вставил шестерню → отсек с кристаллом',
            },
          ],
        },
        {
          id: 'l1-chain',
          title: 'Два ключа к шкафу',
          summary:
            'Первый ключ → шкатулка → второй ключ → шкаф с кристаллом. Петля особенно заметна.',
          steps: [
            {
              src: './studio/level1/puzzle-chain-1.png',
              caption: 'Первый ключ в комнате',
            },
            {
              src: './studio/level1/puzzle-chain-2.png',
              caption: 'Ключ открывает шкатулку → второй ключ',
            },
            {
              src: './studio/level1/puzzle-chain-3.png',
              caption: 'Второй ключ открывает шкаф → кристалл',
            },
          ],
        },
      ],
    },
    {
      id: 'sprint-4-level2',
      title: 'Спринт 4 · Уровень 2 башни',
      goal: 'Новый этаж: загадка сложнее первой и 2-й кристалл. Петля по-прежнему сбрасывает обычные предметы.',
      parentCheck: '2-й кристалл; загадка сложнее первой (другая механика / больше шагов).',
      description: [
        'Выбери механику из списка — она должна отличаться от загадки уровня 1.',
        'Память, порядок, логика: ошибаться больнее из‑за петли. При ошибке сбрасывай загадку сразу.',
      ],
      puzzleChoices: [
        {
          id: 'l2-levers',
          title: 'Рычаги по порядку',
          summary:
            '4 рычага; записка или гобелен подсказывает порядок. Ошибка — сброс.',
        },
        {
          id: 'l2-colors',
          title: 'Цветовой код',
          summary:
            'Кнопки цветов; подсказка в комнате (витраж, книги). Нажать в верном порядке.',
        },
        {
          id: 'l2-weights',
          title: 'Весы Хранителя',
          summary:
            'Предметы разного веса на чашу; нужная сумма открывает сейф с кристаллом.',
        },
        {
          id: 'l2-pipes',
          title: 'Пар по трубам',
          summary:
            'Вентили направляют пар; одна комбинация зажигает котёл и выдаёт кристалл.',
        },
        {
          id: 'l2-memory',
          title: 'Эхо маятников',
          summary:
            'Маятники мигают последовательность — повтори кликами. После петли та же цепочка.',
        },
      ],
    },
    {
      id: 'sprint-5-finale',
      title: 'Спринт 5 · Починка часов',
      goal: '3-й кристалл + финал: часы чинятся, петля останавливается, экран победы.',
      parentCheck: '3-й кристалл; часы чинятся; есть экран победы; петля останавливается.',
      description: [
        'Выбери одно финальное испытание — самое напряжённое: время жмёт.',
        'Когда всё собрано: останови петлю и покажи победу («Время восстановлено!» или своё).',
      ],
      puzzleChoices: [
        {
          id: 'l3-platforms',
          title: 'Платформы-шестерни',
          summary:
            'Исчезающие платформы к кристаллу. Можно ужать петлю до 1:00.',
        },
        {
          id: 'l3-lasers',
          title: 'Лучи механизма',
          summary:
            'Вращающиеся красные лучи вокруг кристалла — проскочи в безопасный момент.',
        },
        {
          id: 'l3-slots',
          title: 'Три гнезда часов',
          summary:
            'Вставь собранные кристаллы в гнёзда больших часов + добудь третий рядом.',
        },
        {
          id: 'l3-chase',
          title: 'Гонка с петлёй',
          summary:
            'Третий кристалл виден только короткое окно перед обнулением — успей взять.',
        },
        {
          id: 'l3-combine',
          title: 'Ритуал починки',
          summary:
            'Три алтаря по очереди принимают кристаллы — потом победа и стоп петли.',
        },
      ],
    },
  ],
}

export function studioSprintIds(): string[] {
  return STUDIO_PROJECT.sprints.map((s) => s.id)
}
