import { MUST_DO_ITEMS, todayKey } from './data'
import type { DayLog } from './types'

const STARS_PER_LEVEL = 18

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

export type ProgressMilestone = {
  id: string
  label: string
  done: boolean
}

export function progressMilestones(input: {
  streak: number
  perfectTotal: number
  level: number
  stars: number
}): ProgressMilestone[] {
  const { streak, perfectTotal, level, stars } = input
  return [
    { id: 'streak3', label: '3 дня подряд', done: streak >= 3 },
    { id: 'perfect10', label: '10 идеальных дней', done: perfectTotal >= 10 },
    { id: 'level3', label: 'Уровень 3', done: level >= 3 },
    { id: 'streak7', label: 'Неделя подряд', done: streak >= 7 },
    { id: 'stars54', label: '54 звезды', done: stars >= 54 },
  ]
}

export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}
