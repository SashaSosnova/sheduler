import {
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
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

/** 2 ideal days at 5 must-dos each → next level (e.g. Танджиро at 10★) */
const STARS_PER_LEVEL = 10

/** Temporary: show every sticker as unlocked (preview). Set false before release. */
export const DEBUG_UNLOCK_ALL_STICKERS = false

/**
 * One-time Roblox day bonuses for first time hitting a streak milestone.
 * Rebuilding the same streak after a break does not pay again.
 * Streak 30 is a single gift (Roblox donate) on the sticker — not minutes.
 */
export const ROBLOX_STREAK_REWARDS: { streak: number; minutes: number }[] = [
  { streak: 3, minutes: 20 },
  { streak: 5, minutes: 25 },
  { streak: 7, minutes: 30 },
  { streak: 14, minutes: 40 },
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
  /** At least one honest full-timer workout day */
  needQualityWorkout?: boolean
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
  /** Consecutive calendar days with a chew diary entry */
  needChewStreak?: number
  /** Secret: shortcut / too-fast workout (do not explain while locked) */
  needSecretShortcut?: boolean
  /** Secret: perfect day with zero Roblox play (do not explain while locked) */
  needSecretNoRoblox?: boolean
  robloxExtraMin?: number
  /** Parent gift hint when this sticker unlocks */
  giftHint?: string
}

export const TOM_SAWYER_BOOK_TITLE = 'Приключения Тома Сойера'

/** Snapshot of counters used to evaluate sticker unlocks */
export type StickerProgress = {
  perfectTotal: number
  streak: number
  bestStreak: number
  qualityWorkout: boolean
  chewMax: boolean
  parentTasks: number
  booksFinished: number
  tomSawyerFinished: boolean
  ownTasks: number
  chewStreak: number
  secretShortcut: boolean
  secretNoRoblox: boolean
}

/**
 * Display order ≈ unlock journey; franchises mixed where possible.
 * Roblox day bonuses (one-time): серия 3 / 5 / 7 / 14 подряд.
 * Серия 30 — единая награда (донат), см. стикер Гарроу.
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
    id: 'feat-parent-1',
    kind: 'art',
    needParentTasks: 1,
    image: './stickers/leonardo.png',
    label: 'Леонардо',
    quote: 'Черепашки, за мной!',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-tanjiro',
    kind: 'art',
    needPerfect: 2,
    image: './stickers/tanjiro.png',
    label: 'Танджиро',
    quote: 'Дыхание воды',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-gojo',
    kind: 'art',
    needPerfect: 3,
    image: './stickers/gojo.png',
    label: 'Годжо',
    quote: 'Расширение территории',
    detail: 'Магическая битва',
  },
  {
    id: 'hero-genos',
    kind: 'roblox',
    needStreak: 3,
    image: './stickers/genos.png',
    label: 'Генос',
    quote: 'Учитель Сайтама!',
    detail: 'One Punch Man',
    robloxExtraMin: 20,
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
    id: 'feat-chew-50',
    kind: 'art',
    needChewMax: 50,
    image: './stickers/nezuko.png',
    label: 'Незуко',
    quote: 'Ммпф!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'feat-chew-streak-5',
    kind: 'art',
    needChewStreak: 5,
    image: './stickers/shinobu.png',
    label: 'Шинобу',
    quote: 'Улыбнись!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'hero-zenitsu',
    kind: 'art',
    needPerfect: 4,
    image: './stickers/zenitsu.png',
    label: 'Зеницу',
    quote: 'Дыхание грома',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'feat-own-tasks-5',
    kind: 'art',
    needOwnTasks: 5,
    image: './stickers/inosuke.png',
    label: 'Иноске',
    quote: 'Свинья-кабан!',
    detail: 'Клинок, рассекающий демонов',
  },
  {
    id: 'feat-quality-workout',
    kind: 'art',
    needQualityWorkout: true,
    image: './stickers/splinter.png',
    label: 'Сплинтер',
    quote: 'Терпение, мой ученик',
    detail: 'Черепашки-ниндзя',
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
    id: 'hero-vegeta',
    kind: 'art',
    needPerfect: 5,
    image: './stickers/vegeta.png',
    label: 'Вегета',
    quote: 'Я принц всех саян!',
    detail: 'Dragon Ball',
  },
  {
    id: 'hero-megumi',
    kind: 'roblox',
    needStreak: 5,
    image: './stickers/megumi.png',
    label: 'Мегуми',
    quote: 'Техника десяти теней',
    detail: 'Магическая битва',
    robloxExtraMin: 25,
  },
  {
    id: 'feat-parent-5',
    kind: 'art',
    needParentTasks: 5,
    image: './stickers/michelangelo.png',
    label: 'Микеланджело',
    quote: 'Ковабунга!',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-roblox-ninja',
    kind: 'art',
    needPerfect: 6,
    image: './stickers/roblox-ninja.png',
    label: 'Ниндзя',
    quote: 'Тихий удар',
    detail: 'Roblox',
  },
  {
    id: 'hero-inumaki',
    kind: 'gift',
    needPerfect: 7,
    image: './stickers/inumaki.png',
    label: 'Инумаки',
    quote: 'Лосось!',
    detail: 'Магическая битва',
    giftHint: 'Подарок: онигири',
  },
  {
    id: 'hero-roblox',
    kind: 'roblox',
    needStreak: 7,
    image: './stickers/roblox-wings.png',
    label: 'Тёмный',
    quote: 'Крылья тьмы',
    detail: 'Roblox',
    robloxExtraMin: 30,
  },
  {
    id: 'feat-book-1',
    kind: 'art',
    needTomSawyerBook: true,
    image: './stickers/tom-sawyer.png',
    label: 'Том Сойер',
    quote: 'Приключения ждут!',
    detail: 'Приключения Тома Сойера',
  },
  {
    id: 'feat-books-3',
    kind: 'art',
    needBooksFinished: 3,
    image: './stickers/child-emperor.png',
    label: 'Ребёнок-император',
    quote: 'Доверься гению!',
    detail: 'One Punch Man',
  },
  {
    id: 'hero-yuji',
    kind: 'art',
    needPerfect: 10,
    image: './stickers/yuji.png',
    label: 'Юдзи',
    quote: 'Я спасу людей по-своему',
    detail: 'Магическая битва',
  },
  {
    id: 'feat-parent-10',
    kind: 'art',
    needParentTasks: 10,
    image: './stickers/raphael.png',
    label: 'Рафаэль',
    quote: 'Кто хочет кулаков?',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-goku',
    kind: 'art',
    needPerfect: 12,
    image: './stickers/goku.png',
    label: 'Гоку',
    quote: 'Камэхамэха!',
    detail: 'Dragon Ball',
  },
  {
    id: 'hero-dante',
    kind: 'gift',
    needPerfect: 14,
    image: './stickers/dante.png',
    label: 'Данте',
    quote: 'Jackpot!',
    detail: 'Devil May Cry',
    giftHint: 'Подарок: кино-вечер',
  },
  {
    id: 'hero-mahito',
    kind: 'roblox',
    needStreak: 14,
    image: './stickers/mahito.png',
    label: 'Махито',
    quote: 'Души людей… забавные',
    detail: 'Магическая битва',
    robloxExtraMin: 40,
  },
  {
    id: 'feat-parent-15',
    kind: 'art',
    needParentTasks: 15,
    image: './stickers/donatello.png',
    label: 'Донателло',
    quote: 'Это же элементарно!',
    detail: 'Черепашки-ниндзя',
  },
  {
    id: 'hero-garou',
    kind: 'gift',
    needStreak: 30,
    image: './stickers/garou.png',
    label: 'Гарроу',
    quote: 'Я стану абсолютным злом',
    detail: 'One Punch Man',
    giftHint: 'Награда: донат на 500 ₽ в Roblox',
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
  return dur >= expectedWorkoutTimerSec(exercises)
}

export function hasQualityWorkout(
  days: Record<string, DayLog>,
  exercises: Exercise[],
): boolean {
  return Object.values(days).some((day) => isQualityWorkoutDay(day, exercises))
}

const SHORTCUT_WORKOUT_MAX_SEC = 20 * 60

/**
 * Full routine done, but timers skipped and/or finished under 20 minutes.
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

/** Best run of consecutive calendar days that each have at least one chew entry. */
export function bestChewDiaryStreak(entries: ChewEntry[]): number {
  const dates = [...new Set(entries.map((e) => e.date))].sort()
  if (dates.length === 0) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1]
    const cur = dates[i]
    if (cur === shiftDayKey(prev, 1)) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  return best
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
  return {
    perfectTotal: countPerfectDays(data.days),
    streak,
    bestStreak: Math.max(data.bestStreak ?? 0, streak),
    qualityWorkout: hasQualityWorkout(data.days, data.exercises),
    chewMax: hasChewMaxEntry(data.chewEntries ?? [], 50),
    parentTasks: Math.max(data.bestParentTasks ?? 0, parentNow),
    booksFinished: finishedBooks.length,
    tomSawyerFinished: isTomSawyerInFinishedBooks(finishedBooks),
    ownTasks: countOwnTasksDone(data.days),
    chewStreak: bestChewDiaryStreak(data.chewEntries ?? []),
    secretShortcut: hasShortcutWorkout(data.days, data.exercises),
    secretNoRoblox: hasNoRobloxPerfectDay(data.days),
  }
}

/** Full unlock condition shown on the card */
export function stickerNeedText(sticker: Sticker): string {
  if (sticker.needSecretShortcut || sticker.needSecretNoRoblox) return '???'
  if (sticker.needQualityWorkout) return 'Мастер зарядки'
  if (sticker.needOwnTasks != null) return 'Сам себе хозяин'
  if (sticker.needChewMax != null) return 'Жевать — не переживать'
  if (sticker.needChewStreak != null) {
    const n = sticker.needChewStreak
    return `${n} ${ruDays(n)} дневника`
  }
  if (sticker.needParentTasks != null) {
    const n = sticker.needParentTasks
    return `${n} ${ruTasks(n)} от родителя`
  }
  if (sticker.needTomSawyerBook) return 'Приключения'
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    return `${n} ${ruBooks(n)} дочитано`
  }
  if (sticker.needStreak != null) {
    const n = sticker.needStreak
    return `${n} идеальных ${ruDays(n)} подряд`
  }
  if (sticker.needPerfect === 1) return '1 идеальный день'
  if (sticker.needPerfect != null) {
    const n = sticker.needPerfect
    return `${n} идеальных ${ruDays(n)}`
  }
  return '…'
}

/** Condition line for locked stickers in the detail panel */
export function stickerUnlockHint(sticker: Sticker): string {
  if (sticker.needSecretShortcut || sticker.needSecretNoRoblox) {
    return 'Секретный способ получения'
  }
  if (sticker.needQualityWorkout) {
    return 'Чтобы открыть: пройти всю зарядку, не скидывая таймеры'
  }
  if (sticker.needOwnTasks != null) {
    const n = sticker.needOwnTasks
    return `Чтобы открыть: выполнить ${n} ${ruTasks(n)} от себя (не от родителя)`
  }
  if (sticker.needChewMax != null) {
    return `Чтобы открыть: в дневнике все укусы больше ${sticker.needChewMax}`
  }
  if (sticker.needChewStreak != null) {
    const n = sticker.needChewStreak
    return `Чтобы открыть: ${n} ${ruDays(n)} подряд с записью в дневнике жевания`
  }
  if (sticker.needParentTasks != null) {
    const n = sticker.needParentTasks
    return `Чтобы открыть: выполнить ${n} ${ruTasks(n)} от родителя`
  }
  if (sticker.needTomSawyerBook) {
    return 'Чтобы открыть: прочитать «Приключения Тома Сойера» до конца'
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    return `Чтобы открыть: дочитать ${n} ${ruBooks(n)}`
  }
  if (sticker.needStreak != null) {
    return `Чтобы открыть: ${sticker.needStreak} идеальных ${ruDays(sticker.needStreak)} подряд`
  }
  if (sticker.needPerfect === 1) {
    return 'Чтобы открыть: 1 идеальный день (все 5 пунктов минимума)'
  }
  if (sticker.needPerfect != null) {
    return `Чтобы открыть: всего ${sticker.needPerfect} идеальных ${ruDays(sticker.needPerfect)}`
  }
  return 'Скоро откроется'
}

/** Condition line for already unlocked stickers */
export function stickerOpenedHint(sticker: Sticker): string {
  if (sticker.needSecretShortcut) {
    return 'Открыто: скип таймеров или зарядка быстрее 20 минут'
  }
  if (sticker.needSecretNoRoblox) {
    return 'Открыто: идеальный день без Roblox'
  }
  if (sticker.needQualityWorkout) return 'Открыто: супер-зарядка без скипов'
  if (sticker.needOwnTasks != null) {
    const n = sticker.needOwnTasks
    return `Открыто: ${n} ${ruTasks(n)} от себя`
  }
  if (sticker.needChewMax != null) {
    return `Открыто: все укусы > ${sticker.needChewMax}`
  }
  if (sticker.needChewStreak != null) {
    const n = sticker.needChewStreak
    return `Открыто: ${n} ${ruDays(n)} подряд с дневником жевания`
  }
  if (sticker.needParentTasks != null) {
    const n = sticker.needParentTasks
    return `Открыто: ${n} ${ruTasks(n)} от родителя`
  }
  if (sticker.needTomSawyerBook) {
    return 'Открыто: приключения Тома Сойера пройдены до конца'
  }
  if (sticker.needBooksFinished != null) {
    const n = sticker.needBooksFinished
    return `Открыто: ${n} ${ruBooks(n)} дочитано`
  }
  if (sticker.needStreak != null) {
    const n = sticker.needStreak
    return `Открыто: ${n} идеальных ${ruDays(n)} подряд`
  }
  if (sticker.needPerfect === 1) return 'Открыто: 1 идеальный день'
  if (sticker.needPerfect != null) {
    const n = sticker.needPerfect
    return `Открыто: ${n} идеальных ${ruDays(n)}`
  }
  return 'Открыто'
}

/** Prize line for the unlock wow-screen / detail panel (shown once). */
export function stickerRewardText(sticker: Sticker): string | null {
  const parts: string[] = []
  if (sticker.robloxExtraMin) {
    parts.push(
      `Награда: разово +${sticker.robloxExtraMin} мин Roblox на один день`,
    )
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
  if (DEBUG_UNLOCK_ALL_STICKERS) return true
  const perfectOk =
    sticker.needPerfect == null || progress.perfectTotal >= sticker.needPerfect
  const streakReach = Math.max(progress.streak, progress.bestStreak)
  const streakOk =
    sticker.needStreak == null || streakReach >= sticker.needStreak
  const qualityOk =
    !sticker.needQualityWorkout || progress.qualityWorkout
  const chewOk =
    sticker.needChewMax == null || progress.chewMax
  const chewStreakOk =
    sticker.needChewStreak == null ||
    progress.chewStreak >= sticker.needChewStreak
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
  return (
    perfectOk &&
    streakOk &&
    qualityOk &&
    chewOk &&
    chewStreakOk &&
    ownTasksOk &&
    parentOk &&
    booksOk &&
    tomSawyerOk &&
    secretShortcutOk &&
    secretNoRobloxOk
  )
}

export function unlockedStickers(progress: StickerProgress): Sticker[] {
  return STICKERS.filter((s) => isStickerUnlocked(s, progress))
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
 * Pay out any newly reached streak milestones as a one-day Roblox bonus.
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

  let next: AppData = {
    ...data,
    claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
    bestStreak,
  }

  if (newly.length === 0) return next

  const tip = streakTipDay(data.days, today)
  if (!tip) return next

  const bonusMin = newly.reduce((sum, r) => sum + r.minutes, 0)
  const day = normalizeDayLog(tip, data.days[tip])
  const nextBonus = (day.robloxBonusMin ?? 0) + bonusMin
  const nextLimit = SCREEN_LIMITS.roblox.seconds + nextBonus * 60
  const slot = day.screens.roblox
  const unusedFull =
    !slot.finished && !slot.endsAt && slot.usedSec === 0 && slot.remainingSec >= SCREEN_LIMITS.roblox.seconds

  next = {
    ...next,
    claimedRobloxStreaks: [...claimed, ...newly.map((r) => r.streak)].sort(
      (a, b) => a - b,
    ),
    days: {
      ...next.days,
      [tip]: {
        ...day,
        robloxBonusMin: nextBonus,
        screens: {
          ...day.screens,
          roblox: unusedFull
            ? { ...slot, remainingSec: nextLimit }
            : slot,
        },
      },
    },
  }
  return next
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
