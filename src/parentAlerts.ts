import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  formatPlayTime,
  normalizeDayLog,
  todayKey,
  workoutDurationSec,
} from './data'
import type { AppData } from './types'

const ENABLED_KEY = 'vacation-parent-alerts-enabled'
const CHILD_NAME_KEY = 'vacation-child-name'
const SEEN_KEY = 'vacation-parent-alerts-seen-v1'
const SEEDED_KEY = 'vacation-parent-alerts-seeded-v1'
const CHANNEL_ID = 'parent-activity'
const DEFAULT_CHILD_NAME = 'Даня'

export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export function loadParentAlertsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function saveParentAlertsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

export function loadChildName(): string {
  try {
    const raw = localStorage.getItem(CHILD_NAME_KEY)
    const trimmed = raw?.trim()
    return trimmed || DEFAULT_CHILD_NAME
  } catch {
    return DEFAULT_CHILD_NAME
  }
}

export function saveChildName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) localStorage.removeItem(CHILD_NAME_KEY)
  else localStorage.setItem(CHILD_NAME_KEY, trimmed)
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}

function isSeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1'
  } catch {
    return false
  }
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    /* ignore */
  }
}

type AlertEvent = {
  key: string
  title: string
  body: string
}

function collectEvents(data: AppData, childName: string): AlertEvent[] {
  const today = todayKey()
  const day = normalizeDayLog(today, data.days[today])
  const events: AlertEvent[] = []

  if (day.workoutFinishedAt != null) {
    const sec = workoutDurationSec(day)
    events.push({
      key: `workout:${today}:${day.workoutFinishedAt}`,
      title: `${childName} сделал зарядку`,
      body:
        sec != null
          ? `Зарядка заняла ${formatPlayTime(sec)}`
          : 'Комплекс упражнений отмечен',
    })
  }

  for (const entry of data.chewEntries ?? []) {
    if (entry.date !== today) continue
    events.push({
      key: `chew:${entry.id}`,
      title: `${childName} заполнил дневник жевания`,
      body: entry.food?.trim()
        ? `Еда: ${entry.food.trim()}`
        : 'Запись за сегодня сохранена',
    })
  }

  return events
}

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Прогресс ребёнка',
      description: 'Когда ребёнок сделал зарядку или заполнил дневник',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* already exists */
  }
}

export async function requestParentAlertPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  await ensureChannel()
  const perm = await LocalNotifications.requestPermissions()
  return perm.display === 'granted'
}

async function showAlert(title: string, body: string): Promise<void> {
  if (!notificationsSupported()) return
  await ensureChannel()
  const perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') return

  const id = 2000 + (Date.now() % 8000)
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 400) },
        extra: { kind: 'parent-activity' },
      },
    ],
  })
}

/**
 * On parent device: watch synced data and fire one-shot local notifications
 * when the child finishes workout or saves chew diary for today.
 * First run seeds current state so already-done items don't spam.
 */
export async function processParentAlerts(data: AppData): Promise<void> {
  if (!notificationsSupported()) return
  if (!loadParentAlertsEnabled()) return

  const childName = loadChildName()
  const events = collectEvents(data, childName)
  const seen = loadSeen()

  if (!isSeeded()) {
    for (const e of events) seen.add(e.key)
    saveSeen(seen)
    markSeeded()
    return
  }

  const fresh = events.filter((e) => !seen.has(e.key))
  if (fresh.length === 0) return

  for (const e of fresh) {
    seen.add(e.key)
    await showAlert(e.title, e.body)
  }
  saveSeen(seen)
}

/** Call when enabling alerts so current completions are not re-notified. */
export function seedParentAlerts(data: AppData): void {
  const childName = loadChildName()
  const seen = loadSeen()
  for (const e of collectEvents(data, childName)) seen.add(e.key)
  saveSeen(seen)
  markSeeded()
}
