import {
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  flushScreenOvertime,
  normalizeDayLog,
  parseTimerRounds,
  todayKey,
  workoutDurationSec,
} from './data'
import type {
  AppData,
  ChewEntry,
  DayLog,
  Exercise,
  FinishedBook,
  ReadingBook,
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
 * Longer milestones (21 donate / 28 aquapark) are parent gifts on stickers.
 */
export const ROBLOX_STREAK_REWARDS: { streak: number; minutes: number }[] = [
  { streak: 7, minutes: 15 },
  { streak: 14, minutes: 25 },
  { streak: 21, minutes: 20 },
]

export function dayStars(log: DayLog | undefined): number {
  if (!log) return 0
  return MUST_DO_ITEMS.filter((i) => log.mustDo[i.id]).length
}

export function isPerfectDay(log: DayLog | undefined): boolean {
  return dayStars(log) === MUST_DO_ITEMS.length
}

export function countStars(days: Record<string, DayLog>): number {
  return Object.values(days).reduce((sum, log) => sum + dayStars(log), 0)
}

export function countPerfectDays(days: Record<string, DayLog>): number {
  return Object.values(days).filter((log) => isPerfectDay(log)).length
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
): number {
  let cursor = isPerfectDay(days[today]) ? today : shiftDayKey(today, -1)
  let streak = 0
  while (isPerfectDay(days[cursor])) {
    streak++
    cursor = shiftDayKey(cursor, -1)
  }
  return streak
}

export function perfectDaysInMonth(
  days: Record<string, DayLog>,
  ref = new Date(),
): number {
  const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  return Object.values(days).filter(
    (log) => log.date.startsWith(prefix) && isPerfectDay(log),
  ).length
}

export type StickerKind = 'art' | 'roblox' | 'gift'

export type Sticker = {
  id: string
  kind: StickerKind
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
  /** Completed parent-assigned extra tasks */
  needParentTasks?: number
  /** Finished books in the reading log */
  needBooksFinished?: number
  /** Specifically finished Tom Sawyer (reader app or parent mark) */
  needTomSawyerBook?: boolean
  /** Completed extra tasks created by the child (not from parent) */
  needOwnTasks?: number
  /** Secret: shortcut / too-fast workout (do not explain while locked) */
  needSecretShortcut?: boolean
  /** Secret: perfect day with zero Roblox play (do not explain while locked) */
  needSecretNoRoblox?: boolean
  /** Secret: chew entry with all bites above 50 */
  needSecretChewMax?: boolean
  /**
   * Secret: total Roblox bonus minutes from other achievements
   * (sum of unlocked stickers’ robloxExtraMin) reaches this value.
   */
  needSecretRobloxBonusMin?: number
  robloxExtraMin?: number
  /** Rubles credited to moneyBankRub when this sticker unlocks */
  moneyRub?: number
  /** Parent gift hint when this sticker unlocks */
  giftHint?: string
}

export const TOM_SAWYER_BOOK_TITLE = 'Приключения Тома Сойера'

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
  /** Sum of robloxExtraMin from unlocked reward stickers */
  achievementRobloxMin: number
}

/**
 * Display order mixes franchises (not grouped by series).
 * Roughly easier → harder; secrets sprinkled through the list.
 * Ladders: OPM streaks · JJK exercise days · Клинок chew days ·
 * TMNT quality · TMNT parent · DB own tasks · DMC books · secrets
 */
export const STICKERS: Sticker[] = [
  {
    id: 'hero-saitama',
    kind: 'art',
    needPerfect: 1,
    image: './stickers/saitama.png',
    label: 'Сайтама',
    quote: 'Я герой ради хобби',
    detail: 'One Punch Man',
  },
  {
    id: 'feat-quality-1',
    kind: 'art',
    needQualityWorkouts: 1,
    image: './stickers/casey-jones.png',
    label: 'Кейси Джонс',
    quote: 'Бей в маске!',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-lady',
    kind: 'gift',
    needBooksFinished: 1,
    image: './stickers/lady.png',
    label: 'Леди',
    quote: 'За работу',
    detail: 'Devil May Cry',
    giftHint: 'Награда: манга на выбор',
  },
  {
    id: 'feat-parent-2',
    kind: 'art',
    needParentTasks: 2,
    image: './stickers/leonardo.png',
    label: 'Леонардо',
    quote: 'Черепашки, за мной!',
    detail: 'Черепашки-ниндзя',
    moneyRub: 100,
  },
  {
    id: 'hero-megumi',
    kind: 'art',
    needExerciseDays: 4,
    image: './stickers/megumi.png',
    label: 'Мегуми',
    quote: 'Техника десяти теней',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-vegeta',
    kind: 'art',
    needOwnTasks: 4,
    image: './stickers/vegeta.png',
    label: 'Вегета',
    quote: 'Я принц всех саян!',
    detail: 'Dragon Ball',
  },
  {
    id: 'hero-inosuke',
    kind: 'art',
    needChewDays: 5,
    image: './stickers/inosuke.png',
    label: 'Иноске',
    quote: 'Свинья-кабан!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-tatsumaki',
    kind: 'art',
    needStreak: 3,
    image: './stickers/tatsumaki.png',
    label: 'Тацумаки',
    quote: 'Не мешай мне!',
    detail: 'One Punch Man',
  },
  {
    id: 'hero-dante',
    kind: 'gift',
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
    needSecretShortcut: true,
    image: './stickers/mumen-rider.png',
    label: 'Бесправный Ездок',
    quote: 'Правосудие не сдаётся!',
    detail: 'One Punch Man',
  },
  {
    id: 'feat-parent-6',
    kind: 'art',
    needParentTasks: 6,
    image: './stickers/michelangelo.png',
    label: 'Микеланджело',
    quote: 'Ковабунга!',
    detail: 'Черепашки-ниндзя',
    moneyRub: 200,
  },
  {
    id: 'hero-genos',
    kind: 'roblox',
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
    needExerciseDays: 9,
    image: './stickers/mahoraga.png',
    label: 'Мохорога',
    quote: 'Адаптация',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-beerus',
    kind: 'art',
    needOwnTasks: 8,
    image: './stickers/beerus.png',
    label: 'Бирус',
    quote: 'Развлеки меня',
    detail: 'Dragon Ball',
  },
  {
    id: 'feat-quality-8',
    kind: 'art',
    needQualityWorkouts: 8,
    image: './stickers/karai.png',
    label: 'Карай',
    quote: 'Клан Фут не прощает слабости',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-dante-devil',
    kind: 'gift',
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
    needChewDays: 11,
    image: './stickers/zenitsu.png',
    label: 'Зеницу',
    quote: 'Дыхание грома',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'feat-parent-11',
    kind: 'art',
    needParentTasks: 11,
    image: './stickers/raphael.png',
    label: 'Рафаэль',
    quote: 'Кто хочет кулаков?',
    detail: 'Черепашки-ниндзя',
    moneyRub: 300,
  },
  {
    id: 'hero-child-emperor',
    kind: 'roblox',
    needStreak: 14,
    image: './stickers/child-emperor.png',
    label: 'Ребёнок-император',
    quote: 'Доверься гению!',
    detail: 'One Punch Man',
    robloxExtraMin: 25,
  },
  {
    id: 'hero-goku',
    kind: 'art',
    needOwnTasks: 12,
    image: './stickers/goku.png',
    label: 'Гоку',
    quote: 'Камэхамэха!',
    detail: 'Dragon Ball',
  },
  {
    id: 'feat-quality-13',
    kind: 'art',
    needQualityWorkouts: 13,
    image: './stickers/splinter.png',
    label: 'Сплинтер',
    quote: 'Терпение, мой ученик',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-yuji',
    kind: 'art',
    needExerciseDays: 15,
    image: './stickers/yuji.png',
    label: 'Юдзи',
    quote: 'Я спасу людей по-своему',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-secret-no-roblox',
    kind: 'art',
    needSecretNoRoblox: true,
    image: './stickers/king.png',
    label: 'Кинг',
    quote: 'Сильнейший на Земле',
    detail: 'One Punch Man',
  },
  {
    id: 'feat-parent-16',
    kind: 'art',
    needParentTasks: 16,
    image: './stickers/donatello.png',
    label: 'Донателло',
    quote: 'Это же элементарно!',
    detail: 'Черепашки-ниндзя',
    moneyRub: 500,
  },
  {
    id: 'hero-nezuko',
    kind: 'art',
    needChewDays: 17,
    image: './stickers/nezuko.png',
    label: 'Незуко',
    quote: 'Ммпф!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-bang',
    kind: 'roblox',
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
    needSecretChewMax: true,
    image: './stickers/sukuna.png',
    label: 'Сукуна',
    quote: 'Знаешь ли ты… кто я?',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-tanjiro',
    kind: 'gift',
    needChewDays: 24,
    image: './stickers/tanjiro.png',
    label: 'Танджиро',
    quote: 'Дыхание воды',
    detail: 'Клинок, рассекающий демонов',
    giftHint: 'Награда: донат на 200 ₽ в Roblox',
  },
  {
    id: 'hero-gojo',
    kind: 'gift',
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
    needStreak: 28,
    image: './stickers/garou.png',
    label: 'Гарроу',
    quote: 'Я стану абсолютным злом',
    detail: 'One Punch Man',
    giftHint: 'Награда: поход в аквапарк',
  },
  {
    id: 'feat-secret-roblox-bonus',
    kind: 'art',
    needSecretRobloxBonusMin: 60,
    image: './stickers/white-rabbit.png',
    label: 'Белый Кролик',
    quote: 'Мы опаздываем!',
    detail: 'Devil May Cry',
  },
]

/** Roblox avatar skin for the level card (separate from achievement stickers). */
export type LevelRank = {
  id: string
  /** Min player level for this skin (1…8) */
  level: number
  image: string
}

/**
 * Cumulative Roblox avatar: each level adds gear on top of the previous look.
 * Levels above 8 keep the legend skin.
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

function ruTasks(n: number): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'задание'
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'задания'
  return 'заданий'
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

/** Parent tasks ladder (2 → 6 → 11 → 16): Leo → Mikey → Raph → Don. */
function parentTasksRank(n: number): string {
  if (n <= 2) return 'Сэмпай помощи родителям'
  if (n <= 6) return 'Сэнсэй помощи родителям'
  if (n <= 11) return 'Шихан помощи родителям'
  return 'Сокэ помощи родителям'
}

/** Own tasks ladder (4 → 8 → 12): Vegeta → Beerus → Goku. */
function ownTasksRank(n: number): string {
  if (n <= 4) return 'Воин низшего класса дел'
  if (n <= 8) return 'Воин среднего класса дел'
  return 'Элитный воин дел'
}

/**
 * Exercise-days ladder (4 → 9 → 15 → 22 → 27).
 * Jujutsu Kaisen sorcerer grades: Megumi → Mahoraga → Yuji → Inumaki → Gojo.
 */
function exerciseDaysRank(n: number): string {
  if (n <= 4) return 'Колдун зарядки 4-го ранга'
  if (n <= 9) return 'Колдун зарядки 3-го ранга'
  if (n <= 15) return 'Колдун зарядки 2-го ранга'
  if (n <= 22) return 'Колдун зарядки 1-го ранга'
  return 'Особый ранг зарядки'
}

/** Chew-diary ladder (5 → 11 → 17 → 24): Inosuke → Zenitsu → Nezuko → Tanjiro. */
function chewDaysRank(n: number): string {
  if (n <= 5) return 'Охотник жевания мидзуното'
  if (n <= 11) return 'Охотник жевания каното'
  if (n <= 17) return 'Охотник жевания киноэ'
  return 'Столп жевания'
}

/** Books ladder (1 → 2 → 3). */
function booksRank(n: number): string {
  if (n <= 1) return 'Читатель'
  if (n <= 2) return 'Книжный охотник'
  return 'Книжный демон'
}

/** Ideal-day streak ladder (3 → 7 → 14 → 21 → 28). */
function streakRank(n: number): string {
  if (n <= 3) return 'Герой идеальных дней C-класса'
  if (n <= 7) return 'Герой идеальных дней B-класса'
  if (n <= 14) return 'Герой идеальных дней A-класса'
  if (n <= 21) return 'Герой идеальных дней S-класса'
  return 'Легенда идеальных дней'
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
      entry.left.every((n) => n > threshold) &&
      entry.right.every((n) => n > threshold),
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
export function isNoRobloxPerfectDay(day: DayLog): boolean {
  if (!isPerfectDay(day)) return false
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
export function hasNoRobloxPerfectDay(days: Record<string, DayLog>): boolean {
  const from = firstTrackedRobloxPlayDate(days)
  if (!from) return false
  return Object.values(days).some(
    (day) => day.date >= from && isNoRobloxPerfectDay(day),
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
  const target = TOM_SAWYER_BOOK_TITLE.toLowerCase()
  return books.some((b) => b.title.trim().toLowerCase() === target)
}

export function stickerProgressFromData(data: AppData): StickerProgress {
  const streak = currentStreak(data.days)
  const parentNow = countParentTasksDone(data.days)
  const finishedBooks = data.finishedBooks ?? []
  const progress: StickerProgress = {
    perfectTotal: countPerfectDays(data.days),
    streak,
    bestStreak: Math.max(data.bestStreak ?? 0, streak),
    qualityWorkouts: countQualityWorkouts(data.days, data.exercises),
    exerciseDays: countExerciseDays(data.days),
    chewDays: countChewDiaryDays(data.chewEntries ?? []),
    chewMax: hasChewMaxEntry(data.chewEntries ?? [], 50),
    parentTasks: Math.max(data.bestParentTasks ?? 0, parentNow),
    booksFinished: finishedBooks.length,
    tomSawyerFinished: isTomSawyerInFinishedBooks(finishedBooks),
    ownTasks: countOwnTasksDone(data.days),
    secretShortcut: hasShortcutWorkout(data.days, data.exercises),
    secretNoRoblox: hasNoRobloxPerfectDay(data.days),
    achievementRobloxMin: 0,
  }
  progress.achievementRobloxMin = totalAchievementRobloxMinutes(progress)
  return progress
}

/** Roblox bonus minutes granted by already-unlocked stickers (excludes bonus-min secrets). */
export function totalAchievementRobloxMinutes(progress: StickerProgress): number {
  return STICKERS.filter(
    (s) =>
      s.robloxExtraMin != null &&
      s.needSecretRobloxBonusMin == null &&
      isStickerUnlocked(s, progress),
  ).reduce((sum, s) => sum + (s.robloxExtraMin ?? 0), 0)
}

export function isSecretSticker(sticker: Sticker): boolean {
  return Boolean(
    sticker.needSecretShortcut ||
      sticker.needSecretNoRoblox ||
      sticker.needSecretChewMax ||
      sticker.needSecretRobloxBonusMin != null,
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
  if (sticker.needOwnTasks != null) {
    return ownTasksRank(sticker.needOwnTasks)
  }
  if (sticker.needParentTasks != null) {
    return parentTasksRank(sticker.needParentTasks)
  }
  if (sticker.needBooksFinished != null) {
    return booksRank(sticker.needBooksFinished)
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
    return 'Когда на часах увидишь целый накопленный час'
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
  if (sticker.needOwnTasks != null) {
    const n = sticker.needOwnTasks
    const frac = progress
      ? ` (${progressFraction(progress.ownTasks, n)})`
      : ''
    return `Выполнить ${n} ${ruTasks(n)} от себя${frac}`
  }
  if (sticker.needParentTasks != null) {
    const n = sticker.needParentTasks
    const frac = progress
      ? ` (${progressFraction(progress.parentTasks, n)})`
      : ''
    return `Выполнить ${n} ${ruTasks(n)} от родителя${frac}`
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    const frac = progress
      ? ` (${progressFraction(progress.booksFinished, n)})`
      : ''
    return `Дочитать ${n} ${ruBooks(n)}${frac}`
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
    return '1 идеальный день (все 5 пунктов минимума)'
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
    return 'Открыто: все укусы в записи больше 50'
  }
  if (sticker.needSecretRobloxBonusMin != null) {
    return `Открыто: суммарно больше ${sticker.needSecretRobloxBonusMin} мин Roblox с ачивок`
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
  if (sticker.needOwnTasks != null) {
    const n = sticker.needOwnTasks
    return `Открыто: ранг «${ownTasksRank(n)}» — ${n} ${ruTasks(n)} от себя`
  }
  if (sticker.needParentTasks != null) {
    const n = sticker.needParentTasks
    return `Открыто: ранг «${parentTasksRank(n)}» — ${n} ${ruTasks(n)} от родителя`
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    return `Открыто: ранг «${booksRank(n)}» — ${n} ${ruBooks(n)}`
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
    parts.push(
      `Награда: +${sticker.robloxExtraMin} мин Roblox в копилку (можно потратить в любой день)`,
    )
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
  const ownTasksOk =
    sticker.needOwnTasks == null || progress.ownTasks >= sticker.needOwnTasks
  const parentOk =
    sticker.needParentTasks == null ||
    progress.parentTasks >= sticker.needParentTasks
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
  return (
    perfectOk &&
    streakOk &&
    qualityOk &&
    exerciseDaysOk &&
    chewDaysOk &&
    chewOk &&
    ownTasksOk &&
    parentOk &&
    booksOk &&
    tomSawyerOk &&
    secretShortcutOk &&
    secretNoRobloxOk &&
    secretChewMaxOk &&
    secretRobloxBonusOk
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

export function normalizeFinishedBooks(raw: unknown): FinishedBook[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): FinishedBook | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<FinishedBook>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) return null
      const finishedAt =
        typeof row.finishedAt === 'number' && Number.isFinite(row.finishedAt)
          ? row.finishedAt
          : Date.now()
      const id =
        typeof row.id === 'string' && row.id
          ? row.id
          : `book-${finishedAt}-${title.slice(0, 12)}`
      return { id, title, finishedAt }
    })
    .filter((b): b is FinishedBook => b !== null)
}

export function removeReadingBookByTitle(
  books: ReadingBook[],
  title: string,
): ReadingBook[] {
  const key = title.trim().toLowerCase()
  return books.filter((b) => b.title.trim().toLowerCase() !== key)
}

/** Merge Tom Sawyer into finished books once (idempotent by title). */
export function ensureTomSawyerFinishedBook(
  books: FinishedBook[],
  bookComplete: boolean,
): FinishedBook[] {
  if (!bookComplete) return books
  if (isTomSawyerInFinishedBooks(books)) return books
  return [
    ...books,
    {
      id: 'book-tom-sawyer',
      title: TOM_SAWYER_BOOK_TITLE,
      finishedAt: Date.now(),
    },
  ]
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

/** Today's Roblox limit including one-day streak bonus */
export function robloxLimitSeconds(
  days: Record<string, DayLog>,
  today = todayKey(),
): number {
  return SCREEN_LIMITS.roblox.seconds + robloxBonusMinutes(days, today) * 60
}

/** Tip day of the current streak (today if perfect, else yesterday). */
function streakTipDay(
  days: Record<string, DayLog>,
  today = todayKey(),
): string | null {
  const tip = isPerfectDay(days[today]) ? today : shiftDayKey(today, -1)
  return isPerfectDay(days[tip]) ? tip : null
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

/**
 * Pay out newly reached streak milestones into the Roblox bonus bank.
 * Idempotent: each milestone is claimed at most once ever.
 */
export function applyPendingRobloxStreakRewards(
  data: AppData,
  today = todayKey(),
): AppData {
  const streak = currentStreak(data.days, today)
  const claimed = new Set(data.claimedRobloxStreaks ?? [])
  const bestStreak = Math.max(data.bestStreak ?? 0, streak)
  const newly = ROBLOX_STREAK_REWARDS.filter(
    (r) => streak >= r.streak && !claimed.has(r.streak),
  )

  if (newly.length === 0 && bestStreak === (data.bestStreak ?? 0)) {
    return data
  }

  const next: AppData = {
    ...data,
    claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: data.robloxBonusBankMin ?? 0,
    bestStreak,
  }

  if (newly.length === 0) return next

  // Only credit the bank when the streak tip day exists (same gate as before).
  if (!streakTipDay(data.days, today)) return next

  const bonusMin = newly.reduce((sum, r) => sum + r.minutes, 0)
  return {
    ...next,
    claimedRobloxStreaks: [...claimed, ...newly.map((r) => r.streak)].sort(
      (a, b) => a - b,
    ),
    robloxBonusBankMin: (next.robloxBonusBankMin ?? 0) + bonusMin,
  }
}

/** Parent gift: add minutes to the shared Roblox bonus bank. */
export function giftRobloxBankMinutes(data: AppData, minutes: number): AppData {
  const add = Math.max(0, Math.floor(minutes))
  if (add <= 0) return data
  return {
    ...data,
    robloxBonusBankMin: Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0)) + add,
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

  const exerciseTotal = data.exercises.length
  const items: DayHistoryItem[] = []

  for (const date of dates) {
    const day = normalizeDayLog(date, data.days[date])
    const stars = dayStars(day)
    const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id])
      .length
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
      perfect: stars === MUST_DO_ITEMS.length,
      exerciseDone,
      exerciseTotal,
      workoutSec: workoutDurationSec(day),
      chewFood: chewEntry?.food ?? null,
      chewSec: chewEntry ? chewDurationSec(chewEntry) : null,
    })
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
