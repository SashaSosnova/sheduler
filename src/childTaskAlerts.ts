import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { normalizeDayLog, todayKey } from './data'
import type { AppData } from './types'

const ENABLED_KEY = 'vacation-child-task-alerts-enabled'
const SEEN_KEY = 'vacation-child-task-alerts-seen-v1'
const SEEDED_KEY = 'vacation-child-task-alerts-seeded-v1'
const CHANNEL_ID = 'parent-tasks'
const FALLBACK_LABEL = 'родителя'

export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export function loadChildTaskAlertsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function saveChildTaskAlertsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
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

function parentLabel(task: { fromParentAs?: string }): string {
  const label = task.fromParentAs?.trim()
  return label || FALLBACK_LABEL
}

function collectEvents(data: AppData): AlertEvent[] {
  const events: AlertEvent[] = []
  const today = todayKey()

  for (const [date, raw] of Object.entries(data.days ?? {})) {
    const day = normalizeDayLog(date, raw)
    for (const task of day.extraTasks) {
      if (!task.fromParent) continue
      const label = parentLabel(task)
      const forToday = date === today
      events.push({
        key: `parent-task:${task.id}`,
        title: `Добавлено задание от ${label}: ${task.text}`,
        body: forToday
          ? 'Открой «Сегодня», чтобы отметить'
          : `Задание на ${date} — открой приложение`,
      })
    }
  }

  return events
}

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Задания от родителя',
      description: 'Когда родитель добавил новое задание',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* already exists */
  }
}

export async function hasChildTaskAlertPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  await ensureChannel()
  const perm = await LocalNotifications.checkPermissions()
  return perm.display === 'granted'
}

export async function requestChildTaskAlertPermission(): Promise<boolean> {
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

  const id = 3000 + (Date.now() % 8000)
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 400) },
        extra: { kind: 'parent-task' },
      },
    ],
  })
}

/**
 * On child device: watch synced data and fire one-shot local notifications
 * when a parent-created extra task appears. First run seeds so existing tasks
 * don't spam.
 */
export async function processChildTaskAlerts(data: AppData): Promise<void> {
  if (!notificationsSupported()) return
  if (!loadChildTaskAlertsEnabled()) return

  const events = collectEvents(data)
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

/** Call when enabling alerts so current tasks are not re-notified. */
export function seedChildTaskAlerts(data: AppData): void {
  const seen = loadSeen()
  for (const e of collectEvents(data)) seen.add(e.key)
  saveSeen(seen)
  markSeeded()
}
