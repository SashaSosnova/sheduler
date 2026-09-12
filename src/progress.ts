import {
  SCHOOL_QUARTER_MIN_GRADES,
  isRobloxEnabled,
  isSchoolQuarterEnded,
  normalizeRobloxLimitMin,
  activeExercises,
  chewDurationSec,
  flushScreenOvertime,
  normalizeDayLog,
  parseTimerRounds,
  requiredMustDoItems,
  schoolDayPlanFromData,
  schoolQuarterKey,
  schoolSubjectKey,
  todayKey,
  workoutDurationSec,
  type SchoolDayPlan,
} from './data'
import type {
  AppData,
  ChewEntry,
  CreateKind,
  DayLog,
  Exercise,
  FinishedBook,
  ReadingBook,
  SchoolGrade,
} from './types'

/** 2 ideal days at 5 must-dos each → next level */
const STARS_PER_LEVEL = 10

/** Temporary: show every sticker as unlocked (preview). Set false before release. */
export const DEBUG_UNLOCK_ALL_STICKERS = false

/** Temporary: show every sticker as locked (preview). */
export const DEBUG_LOCK_ALL_STICKERS = false

/**
 * One-time Roblox day bonuses for first time hitting a perfect-day streak.
 * Rebuilding the same streak after a break does not pay again.
 * Longer milestones (28 aquapark / 40 chromakey) are parent gifts on stickers.
 */
export const ROBLOX_STREAK_REWARDS: { streak: number; minutes: number }[] = [
  { streak: 7, minutes: 15 },
  { streak: 14, minutes: 25 },
  { streak: 21, minutes: 20 },
]

export function dayStars(
  log: DayLog | undefined,
  plan?: SchoolDayPlan,
): number {
  if (!log) return 0
  return requiredMustDoItems(log.date, plan).filter((i) => log.mustDo[i.id])
    .length
}

export function isPerfectDay(
  log: DayLog | undefined,
  plan?: SchoolDayPlan,
): boolean {
  if (!log) return false
  const need = requiredMustDoItems(log.date, plan)
  return need.length > 0 && need.every((i) => Boolean(log.mustDo[i.id]))
}

export function countStars(
  days: Record<string, DayLog>,
  plan?: SchoolDayPlan,
): number {
  return Object.values(days).reduce((sum, log) => sum + dayStars(log, plan), 0)
}

export function countPerfectDays(
  days: Record<string, DayLog>,
  plan?: SchoolDayPlan,
): number {
  return Object.values(days).filter((log) => isPerfectDay(log, plan)).length
}

export function levelFromStars(stars: number): {
  level: number
  intoLevel: number
  need: number
} {
  const need = STARS_PER_LEVEL
  const level = 1 + Math.floor(stars / need)
  const intoLevel = stars % need
  return { level, intoLevel, need }
}

/** Consecutive perfect days: from today if perfect, else from yesterday. */
export function currentStreak(
  days: Record<string, DayLog>,
  today = todayKey(),
  plan?: SchoolDayPlan,
): number {
  let cursor = isPerfectDay(days[today], plan) ? today : shiftDayKey(today, -1)
  let streak = 0
  while (isPerfectDay(days[cursor], plan)) {
    streak++
    cursor = shiftDayKey(cursor, -1)
  }
  return streak
}

export function perfectDaysInMonth(
  days: Record<string, DayLog>,
  ref = new Date(),
  plan?: SchoolDayPlan,
): number {
  const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  return Object.values(days).filter(
    (log) => log.date.startsWith(prefix) && isPerfectDay(log, plan),
  ).length
}

export type StickerKind = 'art' | 'roblox' | 'gift'

export type StickerTrack =
  | 'streak'
  | 'exercise'
  | 'chew'
  | 'books'
  | 'create'
  | 'secret'

export const STICKER_TRACK_PAGES: {
  id: StickerTrack
  label: string
}[] = [
  { id: 'streak', label: 'Идеальные дни' },
  { id: 'exercise', label: 'Зарядка' },
  { id: 'chew', label: 'Жевание' },
  { id: 'books', label: 'Книги' },
  { id: 'create', label: 'Творчество' },
  { id: 'secret', label: 'Секреты' },
]

export type Sticker = {
  id: string
  kind: StickerKind
  /** Album page; inferred from needs if omitted */
  track?: StickerTrack
  /** Portrait in /public/stickers */
  image: string
  label: string
  /** Catchphrase shown under the name when unlocked */
  quote: string
  detail: string
  needPerfect?: number
  needStreak?: number
  /** Honest full-timer workout days (count) */
  needQualityWorkouts?: number
  /** Days with зарядка checked (total, not consecutive) */
  needExerciseDays?: number
  /** Days with a chew diary entry (total, not consecutive) */
  needChewDays?: number
  /** All chew bites above this count (left + right) */
  needChewMax?: number
  /** Finished books in the reading log */
  needBooksFinished?: number
  /** Specifically finished Tom Sawyer (reader app or parent mark) */
  needTomSawyerBook?: boolean
  /** Secret: shortcut / too-fast workout (do not explain while locked) */
  needSecretShortcut?: boolean
  /** Secret: perfect day with zero Roblox play (do not explain while locked) */
  needSecretNoRoblox?: boolean
  /** Secret: chew entry with all bites above 50 */
  needSecretChewMax?: boolean
  /**
   * Secret: total Roblox bonus minutes earned (bank lifetime / streak
   * payouts / unlocked stickers’ robloxExtraMin) reaches this value.
   */
  needSecretRobloxBonusMin?: number
  /**
   * Secret: workout finished before this local hour.
   * With needSecretPerfectByHour → full day-rhythm (both required).
   */
  needSecretEarlyPerfectHour?: number
  /**
   * Secret: day became perfect before this local hour.
   * Alone → only early perfect day; with needSecretEarlyPerfectHour → both.
   */
  needSecretPerfectByHour?: number
  /** Completed puzzles (pieces, not days) */
  needPuzzles?: number
  /** Completed Lego sets (pieces, not days) */
  needLegos?: number
  robloxExtraMin?: number
  /** Rubles credited to moneyBankRub when this sticker unlocks */
  moneyRub?: number
  /** Parent gift hint when this sticker unlocks */
  giftHint?: string
}

export const TOM_SAWYER_BOOK_TITLE = 'Приключения Тома Сойера'

function normalizeBookTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я]+/g, ' ')
    .trim()
}

/** Same book even if the parent typed a short name like «Том Сойер». */
export function isTomSawyerTitle(title: string): boolean {
  const n = normalizeBookTitle(title)
  if (!n) return false
  const sawyer = n.includes('сойер') || n.includes('sawyer')
  const tom = n.includes('том') || /(^| )tom( |$)/.test(n)
  return sawyer && tom
}

/** Identity for duplicate checks; Tom Sawyer aliases share one key. */
export function bookTitleKey(title: string): string {
  if (isTomSawyerTitle(title)) return TOM_SAWYER_BOOK_TITLE.toLowerCase()
  return normalizeBookTitle(title)
}

/** Snapshot of counters used to evaluate sticker unlocks */
export type StickerProgress = {
  perfectTotal: number
  streak: number
  bestStreak: number
  qualityWorkouts: number
  exerciseDays: number
  chewDays: number
  chewMax: boolean
  parentTasks: number
  booksFinished: number
  tomSawyerFinished: boolean
  ownTasks: number
  secretShortcut: boolean
  secretNoRoblox: boolean
  /** Perfect day closed before 20:00 (same calendar day) */
  secretPerfectByHour: boolean
  /** Workout before 10:00 and perfect day closed before 20:00 */
  secretDayRhythm: boolean
  /**
   * Roblox bonus minutes toward «Белый Кролик»:
   * max(sticker rewards, claimed streak payouts, lifetime bank credits).
   */
  achievementRobloxMin: number
  puzzles: number
  legos: number
}

/**
 * Album pages group by what the kid does, not by franchise.
 */
export const STICKERS: Sticker[] = [
  {
    id: 'hero-saitama',
    kind: 'art',
    track: 'streak',
    needPerfect: 1,
    image: './stickers/saitama.png',
    label: 'Сайтама',
    quote: 'Я герой ради хобби',
    detail: 'One Punch Man',
  },
  {
    id: 'feat-quality-1',
    kind: 'art',
    track: 'exercise',
    needQualityWorkouts: 1,
    image: './stickers/casey-jones.png',
    label: 'Кейси Джонс',
    quote: 'Бей в маске!',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-lady',
    kind: 'gift',
    track: 'books',
    needBooksFinished: 1,
    image: './stickers/lady.png',
    label: 'Леди',
    quote: 'За работу',
    detail: 'Devil May Cry',
    giftHint: 'Награда: манга на выбор',
  },
  {
    id: 'hero-megumi',
    kind: 'art',
    track: 'exercise',
    needExerciseDays: 4,
    image: './stickers/megumi.png',
    label: 'Мегуми',
    quote: 'Техника десяти теней',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-inosuke',
    kind: 'art',
    track: 'chew',
    needChewDays: 5,
    image: './stickers/inosuke.png',
    label: 'Иноске',
    quote: 'Свинья-кабан!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-tatsumaki',
    kind: 'art',
    track: 'streak',
    needStreak: 3,
    image: './stickers/tatsumaki.png',
    label: 'Тацумаки',
    quote: 'Не мешай мне!',
    detail: 'One Punch Man',
  },
  {
    id: 'hero-dante',
    kind: 'gift',
    track: 'books',
    needBooksFinished: 2,
    image: './stickers/dante.png',
    label: 'Данте',
    quote: 'Jackpot!',
    detail: 'Devil May Cry',
    giftHint: 'Подарок: кино-вечер',
  },
  {
    id: 'feat-secret-shortcut',
    kind: 'art',
    track: 'secret',
    needSecretShortcut: true,
    image: './stickers/mumen-rider.png',
    label: 'Бесправный Ездок',
    quote: 'Правосудие не сдаётся!',
    detail: 'One Punch Man',
  },
  {
    id: 'hero-genos',
    kind: 'roblox',
    track: 'streak',
    needStreak: 7,
    image: './stickers/genos.png',
    label: 'Генос',
    quote: 'Учитель Сайтама!',
    detail: 'One Punch Man',
    robloxExtraMin: 15,
  },
  {
    id: 'hero-mahoraga',
    kind: 'art',
    track: 'exercise',
    needExerciseDays: 9,
    image: './stickers/mahoraga.png',
    label: 'Мохорога',
    quote: 'Адаптация',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-quality-8',
    kind: 'art',
    track: 'exercise',
    needQualityWorkouts: 8,
    image: './stickers/karai.png',
    label: 'Карай',
    quote: 'Клан Фут не прощает слабости',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-dante-devil',
    kind: 'gift',
    track: 'books',
    needBooksFinished: 3,
    image: './stickers/dante-devil.png',
    label: 'Данте (демон)',
    quote: 'Devil Trigger!',
    detail: 'Devil May Cry',
    giftHint: 'Награда: донат на 400 ₽ в Roblox',
  },
  {
    id: 'hero-zenitsu',
    kind: 'art',
    track: 'chew',
    needChewDays: 11,
    image: './stickers/zenitsu.png',
    label: 'Зеницу',
    quote: 'Дыхание грома',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-child-emperor',
    kind: 'roblox',
    track: 'streak',
    needStreak: 14,
    image: './stickers/child-emperor.png',
    label: 'Ребёнок-император',
    quote: 'Доверься гению!',
    detail: 'One Punch Man',
    robloxExtraMin: 25,
  },
  {
    id: 'feat-quality-13',
    kind: 'art',
    track: 'exercise',
    needQualityWorkouts: 13,
    image: './stickers/splinter.png',
    label: 'Сплинтер',
    quote: 'Терпение, мой ученик',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-yuji',
    kind: 'art',
    track: 'exercise',
    needExerciseDays: 15,
    image: './stickers/yuji.png',
    label: 'Юдзи',
    quote: 'Я спасу людей по-своему',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-secret-day-rhythm',
    kind: 'art',
    track: 'secret',
    needSecretPerfectByHour: 20,
    image: './stickers/mahito.png',
    label: 'Махито',
    quote: 'Души так легко менять',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-secret-day-early',
    kind: 'art',
    track: 'secret',
    needSecretEarlyPerfectHour: 10,
    needSecretPerfectByHour: 20,
    image: './stickers/nanami.png',
    label: 'Нанами',
    quote: 'Сверхурочные — это проклятие',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-secret-no-roblox',
    kind: 'art',
    track: 'secret',
    needSecretNoRoblox: true,
    image: './stickers/king.png',
    label: 'Кинг',
    quote: 'Сильнейший на Земле',
    detail: 'One Punch Man',
  },
  {
    id: 'hero-nezuko',
    kind: 'art',
    track: 'chew',
    needChewDays: 17,
    image: './stickers/nezuko.png',
    label: 'Незуко',
    quote: 'Ммпф!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-bang',
    kind: 'roblox',
    track: 'streak',
    needStreak: 21,
    image: './stickers/bang.png',
    label: 'Серебряный Клык',
    quote: 'Путь боевых искусств',
    detail: 'One Punch Man',
    robloxExtraMin: 20,
  },
  {
    id: 'hero-inumaki',
    kind: 'gift',
    track: 'exercise',
    needExerciseDays: 22,
    image: './stickers/inumaki.png',
    label: 'Инумаки',
    quote: 'Лосось!',
    detail: 'Магическая битва',
    giftHint: 'Награда: онигири',
  },
  {
    id: 'feat-quality-20',
    kind: 'gift',
    track: 'exercise',
    needQualityWorkouts: 20,
    image: './stickers/shredder.png',
    label: 'Шредер',
    quote: 'Склонитесь передо мной!',
    detail: 'Черепашки-ниндзя',
    giftHint: 'Награда: костюм для косплея',
  },
  {
    id: 'feat-secret-chew-50',
    kind: 'art',
    track: 'secret',
    needSecretChewMax: true,
    image: './stickers/sukuna.png',
    label: 'Сукуна',
    quote: 'Знаешь ли ты… кто я?',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-tanjiro',
    kind: 'gift',
    track: 'chew',
    needChewDays: 24,
    image: './stickers/tanjiro.png',
    label: 'Танджиро',
    quote: 'Дыхание воды',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: донат на 200 ₽ в Roblox',
  },
  {
    id: 'hero-uzui',
    kind: 'gift',
    track: 'chew',
    needChewDays: 40,
    image: './stickers/uzui.png',
    label: 'Узуй',
    quote: 'Я — сама яркость!',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: набор неоновых палочек-браслетов',
  },
  {
    id: 'hero-rengoku',
    kind: 'gift',
    track: 'chew',
    needChewDays: 48,
    image: './stickers/rengoku.png',
    label: 'Ренгоку',
    quote: 'Зажги своё сердце!',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: декоративный туман для фото, 5 баллонов',
  },
  {
    id: 'hero-giyu',
    kind: 'roblox',
    track: 'chew',
    needChewDays: 60,
    image: './stickers/giyu.png',
    label: 'Гию',
    quote: 'Не сдавайся',
    detail: 'Клинок, рассекающий демонов',
    robloxExtraMin: 20,
  },
  {
    id: 'hero-shinobu',
    kind: 'gift',
    track: 'chew',
    needChewDays: 75,
    image: './stickers/shinobu.png',
    label: 'Шинобу',
    quote: 'Я улыбаюсь',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: донат 200 ₽ в Roblox',
  },
  {
    id: 'hero-mitsuri',
    kind: 'roblox',
    track: 'chew',
    needChewDays: 90,
    image: './stickers/mitsuri.png',
    label: 'Мицури',
    quote: 'Любовь — это сила',
    detail: 'Клинок, рассекающий демонов',
    robloxExtraMin: 30,
  },
  {
    id: 'hero-gyomei',
    kind: 'gift',
    track: 'chew',
    needChewDays: 105,
    image: './stickers/gyomei.png',
    label: 'Гёмей',
    quote: 'Я буду защищать',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: донат 400 ₽ в Roblox',
  },
  {
    id: 'hero-gojo',
    kind: 'gift',
    track: 'exercise',
    needExerciseDays: 27,
    image: './stickers/gojo.png',
    label: 'Годжо',
    quote: 'Расширение территории',
    detail: 'Магическая битва',
    giftHint: 'Награда: донат на 200 ₽ в Roblox',
  },
  {
    id: 'hero-garou',
    kind: 'gift',
    track: 'streak',
    needStreak: 28,
    image: './stickers/garou.png',
    label: 'Гарроу',
    quote: 'Я стану абсолютным злом',
    detail: 'One Punch Man',
    giftHint: 'Награда: поход в аквапарк',
  },
  {
    id: 'hero-toji',
    kind: 'gift',
    track: 'exercise',
    needExerciseDays: 50,
    image: './stickers/toji.png',
    label: 'Тодзи',
    quote: 'Работа есть работа',
    detail: 'Магическая битва',
    giftHint: 'Награда: кольцевая лампа 26 см со штативом',
  },
  {
    id: 'hero-nobara',
    kind: 'roblox',
    track: 'exercise',
    needExerciseDays: 60,
    image: './stickers/nobara.png',
    label: 'Нобара',
    quote: 'Забавно, да?',
    detail: 'Магическая битва',
    robloxExtraMin: 20,
  },
  {
    id: 'hero-maki',
    kind: 'gift',
    track: 'exercise',
    needExerciseDays: 75,
    image: './stickers/maki.png',
    label: 'Маки',
    quote: 'Я не колдун. Я мечник',
    detail: 'Магическая битва',
    giftHint: 'Награда: донат 200 ₽ в Roblox',
  },
  {
    id: 'hero-todo',
    kind: 'roblox',
    track: 'exercise',
    needExerciseDays: 90,
    image: './stickers/todo.png',
    label: 'Тодо',
    quote: 'Какой у тебя тип?',
    detail: 'Магическая битва',
    robloxExtraMin: 30,
  },
  {
    id: 'hero-yuta',
    kind: 'gift',
    track: 'exercise',
    needExerciseDays: 105,
    image: './stickers/yuta.png',
    label: 'Юта',
    quote: 'Я никого не потеряю',
    detail: 'Магическая битва',
    giftHint: 'Награда: донат 400 ₽ в Roblox',
  },
  {
    id: 'hero-blast',
    kind: 'gift',
    track: 'streak',
    needStreak: 40,
    image: './stickers/blast.png',
    label: 'Бласт',
    quote: 'Оставь это мне',
    detail: 'One Punch Man',
    giftHint: 'Награда: хромакей со стойкой для фотофона',
  },
  {
    id: 'hero-todoroki',
    kind: 'gift',
    track: 'streak',
    needStreak: 60,
    image: './stickers/todoroki.png',
    label: 'Тодороки',
    quote: 'Это моя сила',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: поход в кинотеатр',
  },
  {
    id: 'hero-uraraka',
    kind: 'roblox',
    track: 'streak',
    needStreak: 67,
    image: './stickers/uraraka.png',
    label: 'Урарака',
    quote: 'Я тоже стану героем',
    detail: 'Моя геройская академия',
    robloxExtraMin: 30,
  },
  {
    id: 'hero-kirishima',
    kind: 'gift',
    track: 'streak',
    needStreak: 75,
    image: './stickers/kirishima.png',
    label: 'Киришима',
    quote: 'Это по-мужски',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: донат 200 ₽ в Roblox',
  },
  {
    id: 'hero-hawks',
    kind: 'gift',
    track: 'streak',
    needStreak: 90,
    image: './stickers/hawks.png',
    label: 'Хокс',
    quote: 'Я самый быстрый',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: поход в термы',
  },
  {
    id: 'hero-deku',
    kind: 'gift',
    track: 'streak',
    needStreak: 105,
    image: './stickers/deku.png',
    label: 'Деку',
    quote: 'Я стану героем',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: донат 400 ₽ в Roblox',
  },
  {
    id: 'hero-bakugo',
    kind: 'gift',
    track: 'streak',
    needStreak: 120,
    image: './stickers/bakugo.png',
    label: 'Бакуго',
    quote: 'Я буду номером один',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: полёт в аэротрубе',
  },
  {
    id: 'hero-allmight',
    kind: 'gift',
    track: 'streak',
    needStreak: 150,
    image: './stickers/allmight.png',
    label: 'Всемогущий',
    quote: 'Я здесь!',
    detail: 'Моя геройская академия',
    giftHint: 'Награда: поход в аквапарк',
  },
  {
    id: 'feat-secret-roblox-bonus',
    kind: 'art',
    track: 'secret',
    needSecretRobloxBonusMin: 60,
    image: './stickers/white-rabbit.png',
    label: 'Белый Кролик',
    quote: 'Мы опаздываем!',
    detail: 'Devil May Cry',
  },
  {
    id: 'feat-puzzle-1',
    kind: 'art',
    track: 'create',
    needPuzzles: 1,
    image: './stickers/oei.png',
    label: 'Оэй',
    quote: 'Сначала линия — потом картина',
    detail: 'Miss Hokusai',
  },
  {
    id: 'feat-lego-1',
    kind: 'art',
    track: 'create',
    needLegos: 1,
    image: './stickers/chrome.png',
    label: 'Хром',
    quote: 'Это же наука… кубиками!',
    detail: 'Dr. Stone',
  },
  {
    id: 'feat-puzzle-3',
    kind: 'art',
    track: 'create',
    needPuzzles: 3,
    image: './stickers/kuninao.png',
    label: 'Кунинао',
    quote: 'Ещё один мазок — и сойдётся',
    detail: 'Miss Hokusai',
  },
  {
    id: 'feat-lego-3',
    kind: 'art',
    track: 'create',
    needLegos: 3,
    image: './stickers/kaseki.png',
    label: 'Касэки',
    quote: 'Хорошая работа руками!',
    detail: 'Dr. Stone',
  },
  {
    id: 'feat-puzzle-7',
    kind: 'art',
    track: 'create',
    needPuzzles: 7,
    image: './stickers/hokusai.png',
    label: 'Хокусай',
    quote: 'Большая волна из маленьких кусочков',
    detail: 'Miss Hokusai',
  },
  {
    id: 'feat-lego-7',
    kind: 'art',
    track: 'create',
    needLegos: 7,
    image: './stickers/senku.png',
    label: 'Сенку',
    quote: 'Десять миллиардов процентов собрано!',
    detail: 'Dr. Stone',
  },
]

/** Roblox avatar skin for the level card (separate from achievement stickers). */
export type LevelRank = {
  id: string
  /** Min player level for this skin (1…14) */
  level: number
  image: string
}

/**
 * Roblox avatar skins by level.
 * Levels 1–8 build up gear on the classic noob look.
 * Levels 9–14 are prestige skins (distinct characters).
 * Levels above 14 keep the phantom skin.
 */
export const LEVEL_RANKS: LevelRank[] = [
  { id: 'nub', level: 1, image: './stickers/levels/nub.png?v=2' },
  { id: 'cap', level: 2, image: './stickers/levels/cap.png?v=2' },
  { id: 'fit', level: 3, image: './stickers/levels/fit.png?v=2' },
  { id: 'sword', level: 4, image: './stickers/levels/sword.png?v=2' },
  { id: 'warrior', level: 5, image: './stickers/levels/warrior.png?v=2' },
  { id: 'wings', level: 6, image: './stickers/levels/wings.png?v=2' },
  { id: 'dark', level: 7, image: './stickers/levels/dark.png?v=2' },
  { id: 'legend', level: 8, image: './stickers/levels/legend.png?v=2' },
  { id: 'gojo', level: 9, image: './stickers/levels/gojo.png?v=2' },
  { id: 'demon', level: 10, image: './stickers/levels/demon.png?v=2' },
  { id: 'shadow', level: 11, image: './stickers/levels/shadow.png?v=2' },
  { id: 'cyber', level: 12, image: './stickers/levels/cyber.png?v=2' },
  { id: 'overlord', level: 13, image: './stickers/levels/overlord.png?v=2' },
  { id: 'phantom', level: 14, image: './stickers/levels/phantom.png?v=2' },
]

/** Skin shown for a player level (clamps to max rank). */
export function levelRank(level: number): LevelRank {
  const safe = Math.max(1, Math.floor(level))
  const rank =
    [...LEVEL_RANKS].reverse().find((r) => safe >= r.level) ?? LEVEL_RANKS[0]!
  return rank
}

function ruDays(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'день'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'дня'
  return 'дней'
}

function ruBooks(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'книга'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'книги'
  return 'книг'
}

function ruQualityWorkouts(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'качественная зарядка'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
    return 'качественные зарядки'
  }
  return 'качественных зарядок'
}

/**
 * Quality-workout ladder (1 → 8 → 13 → 20): Casey → Karai → Splinter → Shredder.
 * «Идеальная» = вся зарядка ≥ QUALITY_WORKOUT_MIN without skipping timers.
 */
function qualityWorkoutRank(n: number): string {
  if (n <= 1) return 'Ученик идеальной зарядки'
  if (n <= 8) return 'Ниндзя идеальной зарядки'
  if (n <= 13) return 'Мастер идеальной зарядки'
  return 'Сэнсэй идеальной зарядки'
}

/**
 * Exercise-days ranks by exact threshold so new stickers never rename old ones.
 */
function exerciseDaysRank(n: number): string {
  if (n === 4) return 'Колдун зарядки 4-го ранга'
  if (n === 9) return 'Колдун зарядки 3-го ранга'
  if (n === 15) return 'Колдун зарядки 2-го ранга'
  if (n === 22) return 'Колдун зарядки 1-го ранга'
  if (n === 27) return 'Особый ранг зарядки'
  if (n === 36) return 'Чистильщик зарядки'
  if (n === 44) return 'Капитан чистильщиков зарядки'
  if (n === 50) return 'Небесное ограничение зарядки'
  if (n === 60) return 'Молот зарядки'
  if (n === 75) return 'Клинок зарядки'
  if (n === 90) return 'Чёрная вспышка зарядки'
  if (n === 105) return 'Король проклятий зарядки'
  return 'Колдун зарядки'
}

/** Chew-diary ranks by exact threshold so new stickers never rename old ones. */
function chewDaysRank(n: number): string {
  if (n === 5) return 'Охотник жевания мидзуното'
  if (n === 11) return 'Охотник жевания каното'
  if (n === 17) return 'Охотник жевания киноэ'
  if (n === 24) return 'Столп жевания'
  if (n === 40) return 'Столп звука жевания'
  if (n === 48) return 'Столп пламени жевания'
  if (n === 60) return 'Столп воды жевания'
  if (n === 75) return 'Столп насекомых жевания'
  if (n === 90) return 'Столп любви жевания'
  if (n === 105) return 'Столп камня жевания'
  return 'Охотник жевания'
}

/** Books ladder (1 → 2 → 3). */
function booksRank(n: number): string {
  if (n <= 1) return 'Читатель'
  if (n <= 2) return 'Книжный охотник'
  return 'Книжный демон'
}

/** Ideal-day ranks by exact threshold so new stickers never rename old ones. */
function streakRank(n: number): string {
  if (n === 3) return 'Герой идеальных дней C-класса'
  if (n === 7) return 'Герой идеальных дней B-класса'
  if (n === 14) return 'Герой идеальных дней A-класса'
  if (n === 21) return 'Герой идеальных дней S-класса'
  if (n === 28) return 'Легенда идеальных дней'
  if (n === 40) return 'Ас мира идеальных дней'
  if (n === 48) return 'Гений мира идеальных дней'
  if (n === 56) return 'Бог идеальных дней'
  if (n === 60) return 'Император мира идеальных дней'
  if (n === 67) return 'Страйкер идеальных дней'
  if (n === 75) return 'Король мира идеальных дней'
  if (n === 90) return 'Чемпион мира идеальных дней'
  if (n === 105) return 'Легенда мира идеальных дней'
  if (n === 120) return 'Бог войны идеальных дней'
  if (n === 150) return 'Хранитель идеальных дней'
  return 'Герой идеальных дней'
}

/** Puzzle pieces ladder (1 → 3 → 7): Oei → Kuninao → Hokusai. */
function puzzlesRank(n: number): string {
  if (n <= 1) return 'Ученик мастерской'
  if (n <= 3) return 'Художник галереи'
  return 'Мастер картины'
}

/** Lego sets ladder (1 → 3 → 7): Chrome → Kaseki → Senku. */
function legosRank(n: number): string {
  if (n <= 1) return 'Ученик мастерской кубиков'
  if (n <= 3) return 'Ремесленник кубиков'
  return 'Гений строительства'
}

function ruPuzzles(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'пазл'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'пазла'
  return 'пазлов'
}

function ruLegos(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'набор Лего'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'набора Лего'
  return 'наборов Лего'
}

/**
 * Sum piece counts across days for sticker ladders.
 * Only days where must-do «творчество» is checked count — selecting
 * quantity alone does not unlock achievements.
 */
export function sumCreatePieces(
  days: Record<string, DayLog>,
  kind: CreateKind,
): number {
  let sum = 0
  for (const raw of Object.values(days)) {
    const day = normalizeDayLog(raw.date, raw)
    if (!day.mustDo.create) continue
    sum += kind === 'puzzle' ? day.puzzlePieces : day.legoPieces
  }
  return sum
}

export function resolvePuzzleCount(data: AppData): number {
  return sumCreatePieces(data.days ?? {}, 'puzzle')
}

export function resolveLegoCount(data: AppData): number {
  return sumCreatePieces(data.days ?? {}, 'lego')
}

/** Assumed length for exercises without a timer (middle of 20–30 sec). */
export const UNTIMED_EXERCISE_SEC = 25

/** Pause between exercises in the expected workout length. */
export const BETWEEN_EXERCISES_PAUSE_SEC = 10

/**
 * Expected honest workout length:
 * timed = duration × rounds; untimed ≈ UNTIMED_EXERCISE_SEC;
 * plus BETWEEN_EXERCISES_PAUSE_SEC between each pair of exercises.
 */
export function expectedWorkoutTimerSec(exercises: Exercise[]): number {
  if (exercises.length === 0) return 0
  const workSec = exercises.reduce((sum, ex) => {
    if (ex.durationSec > 0) {
      return sum + ex.durationSec * parseTimerRounds(ex.reps)
    }
    return sum + UNTIMED_EXERCISE_SEC
  }, 0)
  const pauses = Math.max(0, exercises.length - 1) * BETWEEN_EXERCISES_PAUSE_SEC
  return workSec + pauses
}

/**
 * Honest quality bar: full routine, every timer waited out, at least 20 minutes.
 * (Calibrated from a real good session — not just “faster than expected timers”.)
 */
export const QUALITY_WORKOUT_MIN_SEC = 20 * 60
const QUALITY_WORKOUT_MIN_MIN = Math.round(QUALITY_WORKOUT_MIN_SEC / 60)

export function isQualityWorkoutDay(
  day: DayLog,
  exercises: Exercise[],
): boolean {
  if (exercises.length === 0) return false
  if (!exercises.every((ex) => day.exercisesDone[ex.id])) return false
  const timed = exercises.filter((ex) => ex.durationSec > 0)
  if (timed.length === 0) return false
  if (!timed.every((ex) => day.timersHonored?.[ex.id])) return false
  const dur = workoutDurationSec(day)
  if (dur == null) return false
  return dur >= QUALITY_WORKOUT_MIN_SEC
}

export function hasQualityWorkout(
  days: Record<string, DayLog>,
  exercises: Exercise[],
): boolean {
  return countQualityWorkouts(days, exercises) > 0
}

export function countQualityWorkouts(
  days: Record<string, DayLog>,
  exercises: Exercise[],
): number {
  return Object.values(days).filter((day) =>
    isQualityWorkoutDay(day, exercises),
  ).length
}

/** Total calendar days with зарядка checked. */
export function countExerciseDays(days: Record<string, DayLog>): number {
  return Object.values(days).filter((day) => Boolean(day.mustDo.exercise)).length
}

export function countFives(grades: SchoolGrade[]): number {
  return grades.filter((g) => g.mark === 5).length
}

export function countFivesInSubject(
  grades: SchoolGrade[],
  subject: string,
): number {
  const want = schoolSubjectKey(subject)
  if (!want) return 0
  return grades.filter(
    (g) => g.mark === 5 && schoolSubjectKey(g.subject) === want,
  ).length
}

type QuarterStats = { clean: number; excellent: number }

function quarterStats(
  grades: SchoolGrade[],
  today = todayKey(),
): QuarterStats {
  const byQuarter = new Map<string, SchoolGrade[]>()
  for (const grade of grades) {
    const key = schoolQuarterKey(grade.date)
    if (!key) continue
    const list = byQuarter.get(key)
    if (list) list.push(grade)
    else byQuarter.set(key, [grade])
  }
  let clean = 0
  let excellent = 0
  for (const [key, list] of byQuarter) {
    if (!isSchoolQuarterEnded(key, today)) continue
    if (list.length < SCHOOL_QUARTER_MIN_GRADES) continue
    const worst = Math.min(...list.map((g) => g.mark))
    if (worst >= 4) clean++
    if (worst === 5) excellent++
  }
  return { clean, excellent }
}

export function countCleanQuarters(
  grades: SchoolGrade[],
  today = todayKey(),
): number {
  return quarterStats(grades, today).clean
}

export function countExcellentQuarters(
  grades: SchoolGrade[],
  today = todayKey(),
): number {
  return quarterStats(grades, today).excellent
}

/** Total unique calendar days that have at least one chew diary entry. */
export function countChewDiaryDays(entries: ChewEntry[]): number {
  return new Set(entries.map((e) => e.date)).size
}

/** Below the quality bar counts as “too fast” for the secret. */
const SHORTCUT_WORKOUT_MAX_SEC = QUALITY_WORKOUT_MIN_SEC

/**
 * Full routine done, but timers skipped and/or finished under the quality bar.
 * Requires workout timestamps so pre-tracking days (exercisesDone only) do not count.
 */
export function isShortcutWorkoutDay(
  day: DayLog,
  exercises: Exercise[],
): boolean {
  if (exercises.length === 0) return false
  if (!exercises.every((ex) => day.exercisesDone[ex.id])) return false
  // Old logs often have all exercises checked with empty timersHonored and no clock —
  // those are not "skips", just missing tracking.
  if (day.workoutStartedAt == null || day.workoutFinishedAt == null) return false
  const timed = exercises.filter((ex) => ex.durationSec > 0)
  const skippedTimer = timed.some(
    (ex) => day.exercisesDone[ex.id] && !day.timersHonored?.[ex.id],
  )
  const dur = workoutDurationSec(day)
  const tooFast = dur != null && dur < SHORTCUT_WORKOUT_MAX_SEC
  return skippedTimer || tooFast
}

export function hasShortcutWorkout(
  days: Record<string, DayLog>,
  exercises: Exercise[],
): boolean {
  return Object.values(days).some((day) => isShortcutWorkoutDay(day, exercises))
}

export function hasChewMaxEntry(
  entries: ChewEntry[],
  threshold = 50,
): boolean {
  return entries.some(
    (entry) =>
      entry.left.length > 0 &&
      entry.right.length > 0 &&
      entry.left.every((n) => n >= threshold) &&
      entry.right.every((n) => n >= threshold),
  )
}

/**
 * Stamp when the day first becomes perfect; clear if the minimum breaks.
 * Call on every day write path (not on read-only normalize).
 */
export function stampPerfectAt(
  prev: DayLog | undefined,
  next: DayLog,
  plan?: SchoolDayPlan,
): DayLog {
  if (!isPerfectDay(next, plan)) {
    return next.perfectAt == null ? next : { ...next, perfectAt: null }
  }
  if (next.perfectAt != null) return next
  if (prev && isPerfectDay(prev, plan) && prev.perfectAt != null) {
    return { ...next, perfectAt: prev.perfectAt }
  }
  return { ...next, perfectAt: Date.now() }
}

/** Perfect day closed before `perfectBeforeHour` (local clock, same day). */
export function isPerfectByHourSecret(
  day: DayLog,
  perfectBeforeHour = 20,
  plan?: SchoolDayPlan,
): boolean {
  if (!isPerfectDay(day, plan)) return false
  if (day.perfectAt == null) return false
  const perfect = new Date(day.perfectAt)
  if (todayKey(perfect) !== day.date) return false
  return perfect.getHours() < perfectBeforeHour
}

export function hasPerfectByHourSecret(
  days: Record<string, DayLog>,
  perfectBeforeHour = 20,
  plan?: SchoolDayPlan,
): boolean {
  return Object.values(days).some((day) =>
    isPerfectByHourSecret(day, perfectBeforeHour, plan),
  )
}

/**
 * Workout finished before `workoutBeforeHour`, perfect day closed before
 * `perfectBeforeHour` (local clock, same calendar day).
 */
export function isDayRhythmSecret(
  day: DayLog,
  workoutBeforeHour = 10,
  perfectBeforeHour = 20,
  plan?: SchoolDayPlan,
): boolean {
  if (!isPerfectByHourSecret(day, perfectBeforeHour, plan)) return false
  if (day.workoutFinishedAt == null) return false
  const workout = new Date(day.workoutFinishedAt)
  if (todayKey(workout) !== day.date) return false
  return workout.getHours() < workoutBeforeHour
}

export function hasDayRhythmSecret(
  days: Record<string, DayLog>,
  workoutBeforeHour = 10,
  perfectBeforeHour = 20,
  plan?: SchoolDayPlan,
): boolean {
  return Object.values(days).some((day) =>
    isDayRhythmSecret(day, workoutBeforeHour, perfectBeforeHour, plan),
  )
}

export function countOwnTasksDone(days: Record<string, DayLog>): number {
  let n = 0
  for (const day of Object.values(days)) {
    for (const task of day.extraTasks ?? []) {
      if (!task.fromParent && task.done) n++
    }
  }
  return n
}

/** Perfect day with no Roblox session started or played. */
export function isNoRobloxPerfectDay(
  day: DayLog,
  plan?: SchoolDayPlan,
): boolean {
  if (!isPerfectDay(day, plan)) return false
  // Need a modern tracked workout day — old perfect checkmarks alone are not enough.
  if (day.workoutFinishedAt == null) return false
  const slot = day.screens?.roblox
  if (!slot) return false
  return slot.usedSec === 0 && slot.endsAt == null && !slot.finished
}

/** Earliest day where Roblox play was actually recorded in the app. */
export function firstTrackedRobloxPlayDate(
  days: Record<string, DayLog>,
): string | null {
  const dates = Object.values(days)
    .filter((day) => {
      const slot = day.screens?.roblox
      return Boolean(slot && (slot.usedSec > 0 || slot.finished))
    })
    .map((day) => day.date)
    .sort()
  return dates[0] ?? null
}

/**
 * Perfect day without Roblox, but only after we have at least one day with
 * real tracked play — otherwise usedSec=0 on old perfect days is meaningless.
 * Days before the first tracked play never count.
 */
export function hasNoRobloxPerfectDay(
  days: Record<string, DayLog>,
  plan?: SchoolDayPlan,
): boolean {
  const from = firstTrackedRobloxPlayDate(days)
  if (!from) return false
  return Object.values(days).some(
    (day) => day.date >= from && isNoRobloxPerfectDay(day, plan),
  )
}

export function countParentTasksDone(days: Record<string, DayLog>): number {
  let n = 0
  for (const day of Object.values(days)) {
    for (const task of day.extraTasks ?? []) {
      if (task.fromParent && task.done) n++
    }
  }
  return n
}

export function isTomSawyerInFinishedBooks(books: FinishedBook[]): boolean {
  return books.some((b) => isTomSawyerTitle(b.title))
}

/** Minutes already paid out from streak milestones (durable even after spending). */
export function claimedStreakRobloxMinutes(
  claimedRobloxStreaks: number[] | undefined,
): number {
  const claimed = new Set(claimedRobloxStreaks ?? [])
  return ROBLOX_STREAK_REWARDS.filter((r) => claimed.has(r.streak)).reduce(
    (sum, r) => sum + r.minutes,
    0,
  )
}

/**
 * Seed / floor for lifetime earned minutes from what we already know
 * (bank balance + claimed streak payouts). Spending never lowers this.
 */
export function resolveRobloxBonusEarnedMin(data: AppData): number {
  const stored =
    typeof data.robloxBonusEarnedMin === 'number' &&
    Number.isFinite(data.robloxBonusEarnedMin)
      ? Math.max(0, Math.floor(data.robloxBonusEarnedMin))
      : 0
  const bank =
    typeof data.robloxBonusBankMin === 'number' &&
    Number.isFinite(data.robloxBonusBankMin)
      ? Math.max(0, Math.floor(data.robloxBonusBankMin))
      : 0
  return Math.max(stored, bank, claimedStreakRobloxMinutes(data.claimedRobloxStreaks))
}

export function stickerProgressFromData(data: AppData): StickerProgress {
  const plan = schoolDayPlanFromData(data)
  const streak = currentStreak(data.days, todayKey(), plan)
  const parentNow = countParentTasksDone(data.days)
  const finishedBooks = data.finishedBooks ?? []
  const exercises = activeExercises(data.exercises)
  const progress: StickerProgress = {
    perfectTotal: countPerfectDays(data.days, plan),
    streak,
    bestStreak: Math.max(data.bestStreak ?? 0, streak),
    qualityWorkouts: countQualityWorkouts(data.days, exercises),
    exerciseDays: countExerciseDays(data.days),
    chewDays: countChewDiaryDays(data.chewEntries ?? []),
    chewMax: hasChewMaxEntry(data.chewEntries ?? [], 50),
    parentTasks: Math.max(data.bestParentTasks ?? 0, parentNow),
    booksFinished: finishedBooks.length,
    tomSawyerFinished: isTomSawyerInFinishedBooks(finishedBooks),
    ownTasks: countOwnTasksDone(data.days),
    secretShortcut: hasShortcutWorkout(data.days, exercises),
    secretNoRoblox: hasNoRobloxPerfectDay(data.days, plan),
    secretPerfectByHour: hasPerfectByHourSecret(data.days, 20, plan),
    secretDayRhythm: hasDayRhythmSecret(data.days, 10, 20, plan),
    achievementRobloxMin: 0,
    puzzles: resolvePuzzleCount(data),
    legos: resolveLegoCount(data),
  }
  progress.achievementRobloxMin = totalAchievementRobloxMinutes(progress, data)
  return progress
}

/**
 * Roblox bonus minutes toward the White Rabbit secret.
 * Takes the best of: unlocked sticker rewards, claimed streak payouts,
 * and lifetime bank credits (so «час в копилке» matches the hint).
 */
export function totalAchievementRobloxMinutes(
  progress: StickerProgress,
  data?: AppData,
): number {
  const fromStickers = STICKERS.filter(
    (s) =>
      s.robloxExtraMin != null &&
      s.needSecretRobloxBonusMin == null &&
      isStickerUnlocked(s, progress),
  ).reduce((sum, s) => sum + (s.robloxExtraMin ?? 0), 0)
  if (!data) return fromStickers
  const fromClaimed = claimedStreakRobloxMinutes(data.claimedRobloxStreaks)
  const fromEarned = resolveRobloxBonusEarnedMin(data)
  return Math.max(fromStickers, fromClaimed, fromEarned)
}

export function isSecretSticker(sticker: Sticker): boolean {
  return Boolean(
    sticker.needSecretShortcut ||
      sticker.needSecretNoRoblox ||
      sticker.needSecretChewMax ||
      sticker.needSecretRobloxBonusMin != null ||
      sticker.needSecretEarlyPerfectHour != null ||
      sticker.needSecretPerfectByHour != null,
  )
}

export function stickerTrack(sticker: Sticker): StickerTrack {
  if (sticker.track) return sticker.track
  if (isSecretSticker(sticker)) return 'secret'
  if (sticker.needStreak != null || sticker.needPerfect != null) return 'streak'
  if (
    sticker.needExerciseDays != null ||
    sticker.needQualityWorkouts != null
  ) {
    return 'exercise'
  }
  if (sticker.needChewDays != null) return 'chew'
  if (sticker.needBooksFinished != null || sticker.needTomSawyerBook) {
    return 'books'
  }
  if (sticker.needPuzzles != null || sticker.needLegos != null) return 'create'
  return 'create'
}

export function stickersForTrack(track: StickerTrack): Sticker[] {
  return STICKERS.filter((s) => stickerTrack(s) === track)
}

export function visibleStickerTracks(): typeof STICKER_TRACK_PAGES {
  return STICKER_TRACK_PAGES.filter(
    (page) => stickersForTrack(page.id).length > 0,
  )
}

function progressFraction(current: number, need: number): string {
  return `${Math.min(Math.max(0, current), need)}/${need}`
}

/** Rank / title shown on the locked card (not the how-to). */
export function stickerNeedText(sticker: Sticker): string {
  if (isSecretSticker(sticker)) return '???'
  if (sticker.needQualityWorkouts != null) {
    return qualityWorkoutRank(sticker.needQualityWorkouts)
  }
  if (sticker.needExerciseDays != null) {
    return exerciseDaysRank(sticker.needExerciseDays)
  }
  if (sticker.needChewDays != null) {
    return chewDaysRank(sticker.needChewDays)
  }
  if (sticker.needBooksFinished != null) {
    return booksRank(sticker.needBooksFinished)
  }
  if (sticker.needPuzzles != null) {
    return puzzlesRank(sticker.needPuzzles)
  }
  if (sticker.needLegos != null) {
    return legosRank(sticker.needLegos)
  }
  if (sticker.needStreak != null) {
    return streakRank(sticker.needStreak)
  }
  if (sticker.needPerfect != null) return 'Герой-новичок идеальных дней'
  return '…'
}

/** Condition line for locked stickers (card hint + detail panel) */
export function stickerUnlockHint(
  sticker: Sticker,
  progress?: StickerProgress,
): string {
  // Veiled secret hints — never spell out the exact rule.
  if (sticker.needSecretNoRoblox) {
    return 'Идеальный день… но без портала в игру'
  }
  if (sticker.needSecretChewMax) {
    return 'Когда ни один укус не слабее полусотни'
  }
  if (sticker.needSecretRobloxBonusMin != null) {
    return 'Когда в копилке бонусов накопится целый час'
  }
  if (
    sticker.needSecretEarlyPerfectHour != null &&
    sticker.needSecretPerfectByHour != null
  ) {
    // Rhyme: teeth + workout before 10:00, perfect day before 20:00
    return [
      'Рот разомни, щётку бери,',
      'Успеешь до десяти — ачивка внутри.',
      'К вечеру все дела собери,',
      'Пока двадцать не пробило — смотри!',
    ].join('\n')
  }
  if (
    sticker.needSecretEarlyPerfectHour != null ||
    sticker.needSecretPerfectByHour != null
  ) {
    // Veiled Mahito-era wording (perfect-by-hour only)
    return 'Пока утро на часах ещё однозначное — и день закрыт до двух десятков'
  }
  if (isSecretSticker(sticker)) return 'Секретный способ получения'
  if (sticker.needQualityWorkouts != null) {
    const n = sticker.needQualityWorkouts
    const frac = progress
      ? ` (${progressFraction(progress.qualityWorkouts, n)})`
      : ''
    if (n === 1) {
      return `Вся зарядка ≥${QUALITY_WORKOUT_MIN_MIN} мин, не скидывая таймеры${frac}`
    }
    return `${n} ${ruQualityWorkouts(n)} ≥${QUALITY_WORKOUT_MIN_MIN} мин без скипа таймеров${frac}`
  }
  if (sticker.needExerciseDays != null) {
    const n = sticker.needExerciseDays
    const frac = progress
      ? ` (${progressFraction(progress.exerciseDays, n)})`
      : ''
    return `Делать зарядку ${n} ${ruDays(n)}${frac}`
  }
  if (sticker.needChewDays != null) {
    const n = sticker.needChewDays
    const frac = progress
      ? ` (${progressFraction(progress.chewDays, n)})`
      : ''
    return `Заполнять дневник жевания ${n} ${ruDays(n)}${frac}`
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    const frac = progress
      ? ` (${progressFraction(progress.booksFinished, n)})`
      : ''
    return `Дочитать ${n} ${ruBooks(n)}${frac}`
  }
  if (sticker.needPuzzles != null) {
    const n = sticker.needPuzzles
    const frac = progress
      ? ` (${progressFraction(progress.puzzles, n)})`
      : ''
    return `Собрать ${n} ${ruPuzzles(n)}${frac}`
  }
  if (sticker.needLegos != null) {
    const n = sticker.needLegos
    const frac = progress
      ? ` (${progressFraction(progress.legos, n)})`
      : ''
    return `Собрать ${n} ${ruLegos(n)}${frac}`
  }
  if (sticker.needStreak != null) {
    const n = sticker.needStreak
    const streakNow = progress
      ? Math.max(progress.streak, progress.bestStreak)
      : 0
    const frac = progress ? ` (${progressFraction(streakNow, n)})` : ''
    return `${n} идеальных ${ruDays(n)} подряд${frac}`
  }
  if (sticker.needPerfect === 1) {
    return '1 идеальный день (весь обязательный минимум)'
  }
  if (sticker.needPerfect != null) {
    const n = sticker.needPerfect
    const frac = progress
      ? ` (${progressFraction(progress.perfectTotal, n)})`
      : ''
    return `${n} идеальных ${ruDays(n)}${frac}`
  }
  return 'Скоро откроется'
}

/** Condition line for already unlocked stickers */
export function stickerOpenedHint(sticker: Sticker): string {
  if (sticker.needSecretShortcut) {
    return `Открыто: скип таймеров или зарядка быстрее ${QUALITY_WORKOUT_MIN_MIN} минут`
  }
  if (sticker.needSecretNoRoblox) {
    return 'Открыто: идеальный день без Roblox'
  }
  if (sticker.needSecretChewMax) {
    return 'Открыто: все укусы в записи 50 или больше'
  }
  if (sticker.needSecretRobloxBonusMin != null) {
    return `Открыто: накопил ${sticker.needSecretRobloxBonusMin}+ мин бонусов Roblox`
  }
  if (
    sticker.needSecretEarlyPerfectHour != null &&
    sticker.needSecretPerfectByHour != null
  ) {
    const w = sticker.needSecretEarlyPerfectHour
    const p = sticker.needSecretPerfectByHour
    return `Открыто: зарядка до ${w}:00 и все дела минимума до ${p}:00`
  }
  if (sticker.needSecretPerfectByHour != null) {
    return `Открыто: все дела минимума до ${sticker.needSecretPerfectByHour}:00`
  }
  if (sticker.needSecretEarlyPerfectHour != null) {
    return `Открыто: зарядка до ${sticker.needSecretEarlyPerfectHour}:00`
  }
  if (sticker.needQualityWorkouts != null) {
    const n = sticker.needQualityWorkouts
    const rank = qualityWorkoutRank(n)
    if (n === 1) {
      return `Открыто: ранг «${rank}» — зарядка ≥${QUALITY_WORKOUT_MIN_MIN} мин без скипов`
    }
    return `Открыто: ранг «${rank}» — ${n} ${ruQualityWorkouts(n)} ≥${QUALITY_WORKOUT_MIN_MIN} мин без скипов`
  }
  if (sticker.needExerciseDays != null) {
    const n = sticker.needExerciseDays
    return `Открыто: ранг «${exerciseDaysRank(n)}» — зарядка ${n} ${ruDays(n)}`
  }
  if (sticker.needChewDays != null) {
    const n = sticker.needChewDays
    return `Открыто: ранг «${chewDaysRank(n)}» — дневник ${n} ${ruDays(n)}`
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    return `Открыто: ранг «${booksRank(n)}» — ${n} ${ruBooks(n)}`
  }
  if (sticker.needPuzzles != null) {
    const n = sticker.needPuzzles
    return `Открыто: ранг «${puzzlesRank(n)}» — ${n} ${ruPuzzles(n)} 🍫`
  }
  if (sticker.needLegos != null) {
    const n = sticker.needLegos
    return `Открыто: ранг «${legosRank(n)}» — ${n} ${ruLegos(n)} 🍫`
  }
  if (sticker.needStreak != null) {
    const n = sticker.needStreak
    return `Открыто: ранг «${streakRank(n)}» — ${n} идеальных ${ruDays(n)} подряд`
  }
  if (sticker.needPerfect != null) {
    return 'Открыто: ранг «Герой-новичок идеальных дней» — 1 идеальный день'
  }
  return 'Открыто'
}

/** Prize line for the unlock wow-screen / detail panel (shown once). */
export function stickerRewardText(sticker: Sticker): string | null {
  const parts: string[] = []
  if (sticker.robloxExtraMin) {
    parts.push(`Награда: +${sticker.robloxExtraMin} мин Roblox в копилку`)
  }
  if (sticker.moneyRub) {
    parts.push(`Награда: +${sticker.moneyRub} ₽ в копилку`)
  }
  if (sticker.giftHint) {
    parts.push(sticker.giftHint)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

export function stickerUnlockTitle(sticker: Sticker): string {
  if (sticker.kind === 'gift') return 'Подарок!'
  if (sticker.kind === 'roblox') return 'Бонус к Roblox!'
  return 'Новое достижение!'
}

export function isStickerUnlocked(
  sticker: Sticker,
  progress: StickerProgress,
): boolean {
  if (DEBUG_LOCK_ALL_STICKERS) return false
  if (DEBUG_UNLOCK_ALL_STICKERS) return true
  const perfectOk =
    sticker.needPerfect == null || progress.perfectTotal >= sticker.needPerfect
  const streakReach = Math.max(progress.streak, progress.bestStreak)
  const streakOk =
    sticker.needStreak == null || streakReach >= sticker.needStreak
  const qualityOk =
    sticker.needQualityWorkouts == null ||
    progress.qualityWorkouts >= sticker.needQualityWorkouts
  const exerciseDaysOk =
    sticker.needExerciseDays == null ||
    progress.exerciseDays >= sticker.needExerciseDays
  const chewDaysOk =
    sticker.needChewDays == null || progress.chewDays >= sticker.needChewDays
  const chewOk =
    sticker.needChewMax == null || progress.chewMax
  const booksOk =
    sticker.needBooksFinished == null ||
    progress.booksFinished >= sticker.needBooksFinished
  const tomSawyerOk =
    !sticker.needTomSawyerBook || progress.tomSawyerFinished
  const secretShortcutOk =
    !sticker.needSecretShortcut || progress.secretShortcut
  const secretNoRobloxOk =
    !sticker.needSecretNoRoblox || progress.secretNoRoblox
  const secretChewMaxOk =
    !sticker.needSecretChewMax || progress.chewMax
  const secretRobloxBonusOk =
    sticker.needSecretRobloxBonusMin == null ||
    progress.achievementRobloxMin >= sticker.needSecretRobloxBonusMin
  const puzzleOk =
    sticker.needPuzzles == null || progress.puzzles >= sticker.needPuzzles
  const legoOk =
    sticker.needLegos == null || progress.legos >= sticker.needLegos
  const needEarlyWorkout = sticker.needSecretEarlyPerfectHour != null
  const needPerfectByHour = sticker.needSecretPerfectByHour != null
  const secretTimeOk =
    (!needEarlyWorkout && !needPerfectByHour) ||
    (needEarlyWorkout && needPerfectByHour
      ? progress.secretDayRhythm
      : needPerfectByHour
        ? progress.secretPerfectByHour
        : progress.secretDayRhythm)
  return (
    perfectOk &&
    streakOk &&
    qualityOk &&
    exerciseDaysOk &&
    chewDaysOk &&
    chewOk &&
    booksOk &&
    tomSawyerOk &&
    secretShortcutOk &&
    secretNoRobloxOk &&
    secretChewMaxOk &&
    secretRobloxBonusOk &&
    puzzleOk &&
    legoOk &&
    secretTimeOk
  )
}

export function unlockedStickers(progress: StickerProgress): Sticker[] {
  return STICKERS.filter((s) => isStickerUnlocked(s, progress))
}

/** Opened non-secret stickers that can be worn as «Звание». */
export function unlockedRankStickers(progress: StickerProgress): Sticker[] {
  return STICKERS.filter(
    (s) => !isSecretSticker(s) && isStickerUnlocked(s, progress),
  )
}

/**
 * Resolve equipped rank sticker: keep selection if still unlocked,
 * otherwise first unlocked non-secret (STICKERS order).
 */
export function equippedRankSticker(
  equippedStickerId: string | null | undefined,
  progress: StickerProgress,
): Sticker | null {
  const ranks = unlockedRankStickers(progress)
  if (ranks.length === 0) return null
  if (equippedStickerId) {
    const selected = ranks.find((s) => s.id === equippedStickerId)
    if (selected) return selected
  }
  return ranks[0] ?? null
}

export function normalizeReadingBooks(raw: unknown): ReadingBook[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ReadingBook | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<ReadingBook>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) return null
      const id =
        typeof row.id === 'string' && row.id
          ? row.id
          : `reading-${title.slice(0, 12)}`
      return { id, title }
    })
    .filter((b): b is ReadingBook => b !== null)
}

/** Drop reading copies of books already finished (including Tom Sawyer aliases). */
export function reconcileReadingBooks(
  books: ReadingBook[],
  finished: FinishedBook[],
): ReadingBook[] {
  const finishedKeys = new Set(finished.map((b) => bookTitleKey(b.title)))
  const byKey = new Map<string, ReadingBook>()
  for (const book of books) {
    const key = bookTitleKey(book.title)
    if (!key || finishedKeys.has(key)) continue
    if (!byKey.has(key)) byKey.set(key, book)
  }
  return [...byKey.values()]
}

/** Prefer readingBooks; fall back to legacy currentBook string. */
export function resolveReadingBooks(
  readingBooks: unknown,
  legacyCurrentBook?: unknown,
): ReadingBook[] {
  const list = normalizeReadingBooks(readingBooks)
  if (list.length > 0) return list
  const title =
    typeof legacyCurrentBook === 'string' ? legacyCurrentBook.trim() : ''
  if (!title) return []
  return [{ id: 'legacy-current-book', title }]
}

function pickFinishedBook(a: FinishedBook, b: FinishedBook): FinishedBook {
  const tom = isTomSawyerTitle(a.title) || isTomSawyerTitle(b.title)
  const finishedAt = Math.min(a.finishedAt, b.finishedAt)
  const earlier = a.finishedAt <= b.finishedAt ? a : b
  const id =
    a.id === 'book-tom-sawyer' || b.id === 'book-tom-sawyer'
      ? 'book-tom-sawyer'
      : earlier.id
  return {
    id,
    title: tom ? TOM_SAWYER_BOOK_TITLE : earlier.title,
    finishedAt,
  }
}

export function normalizeFinishedBooks(raw: unknown): FinishedBook[] {
  if (!Array.isArray(raw)) return []
  const byKey = new Map<string, FinishedBook>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<FinishedBook>
    const rawTitle = typeof row.title === 'string' ? row.title.trim() : ''
    if (!rawTitle) continue
    const title = isTomSawyerTitle(rawTitle)
      ? TOM_SAWYER_BOOK_TITLE
      : rawTitle
    const finishedAt =
      typeof row.finishedAt === 'number' && Number.isFinite(row.finishedAt)
        ? row.finishedAt
        : Date.now()
    const id =
      isTomSawyerTitle(title) && (!row.id || typeof row.id !== 'string')
        ? 'book-tom-sawyer'
        : typeof row.id === 'string' && row.id
          ? row.id
          : `book-${finishedAt}-${title.slice(0, 12)}`
    const next: FinishedBook = { id, title, finishedAt }
    const key = bookTitleKey(title)
    const prev = byKey.get(key)
    byKey.set(key, prev ? pickFinishedBook(prev, next) : next)
  }
  return [...byKey.values()].sort((a, b) => a.finishedAt - b.finishedAt)
}

export function removeReadingBookByTitle(
  books: ReadingBook[],
  title: string,
): ReadingBook[] {
  const key = bookTitleKey(title)
  if (!key) return books
  return books.filter((b) => bookTitleKey(b.title) !== key)
}

/** Merge Tom Sawyer into finished books once (idempotent by alias). */
export function ensureTomSawyerFinishedBook(
  books: FinishedBook[],
  bookComplete: boolean,
): FinishedBook[] {
  if (!bookComplete) return books
  if (isTomSawyerInFinishedBooks(books)) return normalizeFinishedBooks(books)
  return normalizeFinishedBooks([
    ...books,
    {
      id: 'book-tom-sawyer',
      title: TOM_SAWYER_BOOK_TITLE,
      finishedAt: Date.now(),
    },
  ])
}

/** Drop book-gift dismissals that were earned from a duplicate Tom Sawyer count. */
export function pruneUnearnedBookGiftIds(
  dismissedIds: string[],
  booksFinished: number,
): string[] {
  const needById = new Map<string, number>()
  for (const sticker of STICKERS) {
    if (sticker.giftHint && sticker.needBooksFinished != null) {
      needById.set(sticker.id, sticker.needBooksFinished)
    }
  }
  return dismissedIds.filter((id) => {
    const need = needById.get(id)
    return need == null || booksFinished >= need
  })
}

/** Extra Roblox minutes granted for a single day (one-time streak payout). */
export function robloxBonusMinutes(
  days: Record<string, DayLog>,
  today = todayKey(),
): number {
  const day = days[today]
  if (!day) return 0
  const n = day.robloxBonusMin
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/** Today's Roblox limit: parent base (+ bank bonuses), or 0 if blocked. */
export function robloxLimitSeconds(
  data: AppData,
  today = todayKey(),
): number {
  if (!isRobloxEnabled(data)) return 0
  const baseMin = normalizeRobloxLimitMin(data.robloxLimitMin)
  return baseMin * 60 + robloxBonusMinutes(data.days, today) * 60
}

/** Parent: update Roblox allow/limit policy (bumps sync timestamp). */
export function patchRobloxSettings(
  data: AppData,
  patch: { enabled?: boolean; limitMin?: number },
): AppData {
  const nextEnabled =
    patch.enabled !== undefined ? Boolean(patch.enabled) : isRobloxEnabled(data)
  const nextLimit =
    patch.limitMin !== undefined
      ? normalizeRobloxLimitMin(patch.limitMin)
      : normalizeRobloxLimitMin(data.robloxLimitMin)
  if (
    nextEnabled === isRobloxEnabled(data) &&
    nextLimit === normalizeRobloxLimitMin(data.robloxLimitMin)
  ) {
    return data
  }
  return {
    ...data,
    robloxEnabled: nextEnabled,
    robloxLimitMin: nextLimit,
    robloxSettingsUpdatedAt: Date.now(),
  }
}

/** Tip day of the current streak (today if perfect, else yesterday). */
function streakTipDay(
  days: Record<string, DayLog>,
  today = todayKey(),
  plan?: SchoolDayPlan,
): string | null {
  const tip = isPerfectDay(days[today], plan) ? today : shiftDayKey(today, -1)
  return isPerfectDay(days[tip], plan) ? tip : null
}

/**
 * Credit moneyBankRub for newly unlocked stickers with moneyRub.
 * Idempotent: each sticker id is claimed at most once ever.
 */
export function applyPendingStickerMoneyRewards(data: AppData): AppData {
  const progress = stickerProgressFromData(data)
  const claimed = new Set(data.claimedStickerMoneyIds ?? [])
  const newly = STICKERS.filter(
    (s) =>
      s.moneyRub != null &&
      s.moneyRub > 0 &&
      isStickerUnlocked(s, progress) &&
      !claimed.has(s.id),
  )
  if (newly.length === 0) return data

  const add = newly.reduce((sum, s) => sum + (s.moneyRub ?? 0), 0)
  return {
    ...data,
    claimedStickerMoneyIds: [...claimed, ...newly.map((s) => s.id)],
    moneyBankRub: Math.max(0, Math.floor(data.moneyBankRub ?? 0)) + add,
  }
}

/** Ids of money stickers already unlocked — used to avoid catch-up on upgrade. */
export function seedClaimedStickerMoneyIds(data: AppData): string[] {
  const progress = stickerProgressFromData(data)
  return STICKERS.filter(
    (s) =>
      s.moneyRub != null &&
      s.moneyRub > 0 &&
      isStickerUnlocked(s, progress),
  ).map((s) => s.id)
}

/**
 * Streak 7/14/21 already pay minutes via ROBLOX_STREAK_REWARDS.
 * Other stickers with robloxExtraMin credit the bank on unlock.
 */
export function stickerPaysRobloxBank(sticker: Sticker): boolean {
  if (sticker.robloxExtraMin == null || sticker.robloxExtraMin <= 0) return false
  if (
    sticker.needStreak != null &&
    ROBLOX_STREAK_REWARDS.some((r) => r.streak === sticker.needStreak)
  ) {
    return false
  }
  return true
}

/** Credit robloxBonusBankMin for newly unlocked stickers with robloxExtraMin. */
export function applyPendingStickerRobloxRewards(data: AppData): AppData {
  const progress = stickerProgressFromData(data)
  const claimed = new Set(data.claimedStickerRobloxIds ?? [])
  const newly = STICKERS.filter(
    (s) =>
      stickerPaysRobloxBank(s) &&
      isStickerUnlocked(s, progress) &&
      !claimed.has(s.id),
  )
  if (newly.length === 0) return data

  const add = newly.reduce((sum, s) => sum + (s.robloxExtraMin ?? 0), 0)
  const earnedFloor = resolveRobloxBonusEarnedMin(data)
  return {
    ...data,
    claimedStickerRobloxIds: [...claimed, ...newly.map((s) => s.id)],
    robloxBonusBankMin: Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0)) + add,
    robloxBonusEarnedMin: earnedFloor + add,
  }
}

export function seedClaimedStickerRobloxIds(data: AppData): string[] {
  const progress = stickerProgressFromData(data)
  return STICKERS.filter(
    (s) => stickerPaysRobloxBank(s) && isStickerUnlocked(s, progress),
  ).map((s) => s.id)
}

/** Credit piggy for a closed week. No longer used — cash is handed over immediately. */
export function settleWeeklyGradeWeek(
  data: AppData,
  _weekEnd: string,
): AppData {
  return data
}

/** Grades are paid in cash, not the piggy — never auto-credit moneyBankRub. */
export function applyPendingWeeklyGradeSettlements(
  data: AppData,
  _today = todayKey(),
): AppData {
  return data
}

/** Parent gift: add rubles to the shared money bank. */
export function giftMoneyBankRub(data: AppData, rub: number): AppData {
  const add = Math.max(0, Math.floor(rub))
  if (add <= 0) return data
  return {
    ...data,
    moneyBankRub: Math.max(0, Math.floor(data.moneyBankRub ?? 0)) + add,
  }
}

/** Parent marks cash as handed over — subtract from the money pool. */
export function payoutMoneyBankRub(data: AppData, rub: number): AppData {
  const bank = Math.max(0, Math.floor(data.moneyBankRub ?? 0))
  const take = Math.min(bank, Math.max(0, Math.floor(rub)))
  if (take <= 0) return data
  return {
    ...data,
    moneyBankRub: bank - take,
  }
}

/** Unlocked stickers with a giftHint that parent has not marked as given yet. */
export function pendingGiftStickers(data: AppData): Sticker[] {
  const progress = stickerProgressFromData(data)
  const dismissed = new Set(data.dismissedGiftStickerIds ?? [])
  return STICKERS.filter(
    (s) =>
      Boolean(s.giftHint) &&
      isStickerUnlocked(s, progress) &&
      !dismissed.has(s.id),
  )
}

/** Roblox donate rewards live on the extras card, not the piggy bank. */
export function isRobloxDonateGift(sticker: Sticker): boolean {
  const hint = sticker.giftHint ?? ''
  return /донат/i.test(hint) && /roblox/i.test(hint)
}

export function pendingPhysicalGiftStickers(data: AppData): Sticker[] {
  return pendingGiftStickers(data).filter((s) => !isRobloxDonateGift(s))
}

export function pendingRobloxDonateStickers(data: AppData): Sticker[] {
  return pendingGiftStickers(data).filter(isRobloxDonateGift)
}

/** Legacy upgrade: treat already-unlocked gifts as already given. */
export function seedDismissedGiftStickerIds(data: AppData): string[] {
  const progress = stickerProgressFromData(data)
  return STICKERS.filter(
    (s) => Boolean(s.giftHint) && isStickerUnlocked(s, progress),
  ).map((s) => s.id)
}

/** Parent marks a physical / non-cash gift as handed over. */
export function dismissGiftSticker(data: AppData, stickerId: string): AppData {
  const id = stickerId.trim()
  if (!id) return data
  const dismissed = data.dismissedGiftStickerIds ?? []
  if (dismissed.includes(id)) return data
  return {
    ...data,
    dismissedGiftStickerIds: [...dismissed, id],
  }
}

/**
 * Pay out newly reached streak milestones into the Roblox bonus bank.
 * Idempotent: each milestone is claimed at most once ever.
 */
export function applyPendingRobloxStreakRewards(
  data: AppData,
  today = todayKey(),
): AppData {
  const plan = schoolDayPlanFromData(data)
  const streak = currentStreak(data.days, today, plan)
  const claimed = new Set(data.claimedRobloxStreaks ?? [])
  const bestStreak = Math.max(data.bestStreak ?? 0, streak)
  const newly = ROBLOX_STREAK_REWARDS.filter(
    (r) => streak >= r.streak && !claimed.has(r.streak),
  )

  if (newly.length === 0 && bestStreak === (data.bestStreak ?? 0)) {
    return data
  }

  const earnedFloor = resolveRobloxBonusEarnedMin(data)
  const next: AppData = {
    ...data,
    claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: data.robloxBonusBankMin ?? 0,
    robloxBonusEarnedMin: earnedFloor,
    bestStreak,
  }

  if (newly.length === 0) return next

  // Only credit the bank when the streak tip day exists (same gate as before).
  if (!streakTipDay(data.days, today, plan)) return next

  const bonusMin = newly.reduce((sum, r) => sum + r.minutes, 0)
  return {
    ...next,
    claimedRobloxStreaks: [...claimed, ...newly.map((r) => r.streak)].sort(
      (a, b) => a - b,
    ),
    robloxBonusBankMin: (next.robloxBonusBankMin ?? 0) + bonusMin,
    robloxBonusEarnedMin: earnedFloor + bonusMin,
  }
}

/** Parent gift: add minutes to the shared Roblox bonus bank. */
export function giftRobloxBankMinutes(data: AppData, minutes: number): AppData {
  const add = Math.max(0, Math.floor(minutes))
  if (add <= 0) return data
  const earned = resolveRobloxBonusEarnedMin(data)
  return {
    ...data,
    robloxBonusBankMin: Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0)) + add,
    robloxBonusEarnedMin: earned + add,
  }
}

/** Parent marks bonus minutes as handed over on the computer. */
export function payoutRobloxBankMinutes(
  data: AppData,
  minutes: number,
): AppData {
  const bank = Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0))
  const take = Math.min(bank, Math.max(0, Math.floor(minutes)))
  if (take <= 0) return data
  return {
    ...data,
    robloxBonusBankMin: bank - take,
  }
}

/**
 * Move minutes from the bonus bank onto today's Roblox limit.
 * Allowed even after «Закончить» — reopens the day with the claimed minutes.
 */
export function claimRobloxBankMinutes(
  data: AppData,
  minutes: number,
  today = todayKey(),
): AppData {
  if (!isRobloxEnabled(data)) return data
  const bank = Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0))
  const claim = Math.min(bank, Math.max(0, Math.floor(minutes)))
  if (claim <= 0) return data

  const day = normalizeDayLog(today, data.days[today])
  const slot = day.screens.roblox

  const nextBonus = (day.robloxBonusMin ?? 0) + claim
  const addSec = claim * 60
  // Claiming more time ends overtime — keep what already accrued.
  const baseSlot = flushScreenOvertime(slot)
  let nextSlot: typeof slot
  if (slot.endsAt != null && !slot.finished) {
    nextSlot = {
      ...baseSlot,
      endsAt: slot.endsAt + addSec * 1000,
      remainingSec: slot.remainingSec + addSec,
      finished: false,
    }
  } else {
    nextSlot = {
      ...baseSlot,
      endsAt: null,
      remainingSec: Math.max(0, slot.remainingSec) + addSec,
      finished: false,
    }
  }

  return {
    ...data,
    robloxBonusBankMin: bank - claim,
    days: {
      ...data.days,
      [today]: {
        ...day,
        robloxBonusMin: nextBonus,
        screens: {
          ...day.screens,
          roblox: nextSlot,
        },
      },
    },
  }
}

export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}

export type DayHistoryItem = {
  date: string
  isToday: boolean
  stars: number
  perfect: boolean
  exerciseDone: number
  exerciseTotal: number
  workoutSec: number | null
  chewFood: string | null
  chewSec: number | null
}

/** Days with any activity, newest first. */
export function buildDayHistory(
  data: AppData,
  today = todayKey(),
): DayHistoryItem[] {
  const dates = new Set<string>()
  for (const key of Object.keys(data.days)) dates.add(key)
  for (const entry of data.chewEntries ?? []) dates.add(entry.date)

  const exercises = activeExercises(data.exercises)
  const exerciseTotal = exercises.length
  const items: DayHistoryItem[] = []
  const plan = schoolDayPlanFromData(data)

  for (const date of dates) {
    const day = normalizeDayLog(date, data.days[date])
    const stars = dayStars(day, plan)
    const exerciseDone = exercises.filter((e) => day.exercisesDone[e.id]).length
    const chewEntry = (data.chewEntries ?? [])
      .filter((e) => e.date === date)
      .sort((a, b) => b.createdAt - a.createdAt)[0]

    const hasActivity =
      stars > 0 ||
      exerciseDone > 0 ||
      Boolean(chewEntry) ||
      day.extraTasks.length > 0

    if (!hasActivity) continue

    items.push({
      date,
      isToday: date === today,
      stars,
      perfect: isPerfectDay(day, plan),
      exerciseDone,
      exerciseTotal,
      workoutSec: workoutDurationSec(day),
      chewFood: chewEntry?.food ?? null,
      chewSec: chewEntry ? chewDurationSec(chewEntry) : null,
    })
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
