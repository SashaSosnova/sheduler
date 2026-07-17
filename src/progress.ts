import {
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  normalizeDayLog,
  todayKey,
  workoutDurationSec,
} from './data'
import type { AppData, DayLog } from './types'

/** 2 ideal days at 5 must-dos each → next level (e.g. Танджиро at 10★) */
const STARS_PER_LEVEL = 10

/**
 * One-time Roblox day bonuses for first time hitting a streak milestone.
 * Rebuilding the same streak after a break does not pay again.
 */
export const ROBLOX_STREAK_REWARDS: { streak: number; minutes: number }[] = [
  { streak: 3, minutes: 20 },
  { streak: 5, minutes: 25 },
  { streak: 7, minutes: 30 },
  { streak: 14, minutes: 40 },
  { streak: 30, minutes: 60 },
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
  robloxExtraMin?: number
  /** Parent gift hint when this sticker unlocks */
  giftHint?: string
}

/**
 * Display order ≈ unlock journey; franchises mixed where possible.
 * Roblox day bonuses (one-time): серия 3 / 5 / 7 / 14 / 30 подряд.
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
    detail: 'One Punch Man · разово +20 мин Roblox на день',
    robloxExtraMin: 20,
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
    detail: 'Магическая битва · разово +25 мин Roblox на день',
    robloxExtraMin: 25,
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
    giftHint: 'Подарок: мороженое — скажи родителю',
  },
  {
    id: 'hero-roblox',
    kind: 'roblox',
    needStreak: 7,
    image: './stickers/roblox-wings.png',
    label: 'Тёмный',
    quote: 'Крылья тьмы',
    detail: 'Roblox · разово +30 мин Roblox на день',
    robloxExtraMin: 30,
  },
  {
    id: 'hero-nezuko',
    kind: 'art',
    needPerfect: 8,
    image: './stickers/nezuko.png',
    label: 'Незуко',
    quote: 'Ммф!',
    detail: 'Клинок, рассекающий демонов',
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
    giftHint: 'Подарок: кино-вечер / аниме с родителем',
  },
  {
    id: 'hero-mahito',
    kind: 'roblox',
    needStreak: 14,
    image: './stickers/mahito.png',
    label: 'Махито',
    quote: 'Души людей… забавные',
    detail: 'Магическая битва · разово +40 мин Roblox на день',
    robloxExtraMin: 40,
  },
  {
    id: 'hero-garou',
    kind: 'roblox',
    needStreak: 30,
    image: './stickers/garou.png',
    label: 'Гарроу',
    quote: 'Я стану абсолютным злом',
    detail:
      'One Punch Man · 30 дней подряд · разово +60 мин Roblox',
    robloxExtraMin: 60,
    giftHint: 'Большой подарок-сюрприз от родителя за месяц идеальных дней!',
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

/** Full unlock condition shown on the card */
export function stickerNeedText(sticker: Sticker): string {
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

/** Same as card text — used in the detail panel */
export function stickerUnlockHint(sticker: Sticker): string {
  let base = 'Скоро откроется'
  if (sticker.needStreak != null) {
    base = `Чтобы открыть: ${sticker.needStreak} идеальных ${ruDays(sticker.needStreak)} подряд`
  } else if (sticker.needPerfect === 1) {
    base = 'Чтобы открыть: 1 идеальный день (все 5 пунктов минимума)'
  } else if (sticker.needPerfect != null) {
    base = `Чтобы открыть: всего ${sticker.needPerfect} идеальных ${ruDays(sticker.needPerfect)}`
  }
  if (sticker.robloxExtraMin) {
    return `${base}. Награда: разово +${sticker.robloxExtraMin} мин Roblox на один день`
  }
  return base
}

/** Prize line for the unlock wow-screen / detail panel */
export function stickerRewardText(sticker: Sticker): string | null {
  const parts: string[] = []
  if (sticker.robloxExtraMin) {
    parts.push(`+${sticker.robloxExtraMin} мин Roblox сегодня (разово)`)
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
  perfectTotal: number,
  streak: number,
  bestStreak = streak,
): boolean {
  const perfectOk =
    sticker.needPerfect == null || perfectTotal >= sticker.needPerfect
  const streakReach = Math.max(streak, bestStreak)
  const streakOk =
    sticker.needStreak == null || streakReach >= sticker.needStreak
  return perfectOk && streakOk
}

export function unlockedStickers(
  perfectTotal: number,
  streak: number,
  bestStreak = streak,
): Sticker[] {
  return STICKERS.filter((s) =>
    isStickerUnlocked(s, perfectTotal, streak, bestStreak),
  )
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
