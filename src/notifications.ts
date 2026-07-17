import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const ENABLED_KEY = 'vacation-notifications-enabled'
const CHANNEL_ID = 'daily-reminders'

export type ReminderId = 'wash-am' | 'exercise' | 'chew'

export type ReminderDef = {
  id: ReminderId
  notificationId: number
  hour: number
  minute: number
  title: string
  body: string
}

/** Old notification ids to cancel after schedule changes */
const LEGACY_NOTIFICATION_IDS = [1004]

/** Daily reminder times (local device time) */
export const REMINDERS: ReminderDef[] = [
  {
    id: 'wash-am',
    notificationId: 1001,
    hour: 8,
    minute: 0,
    title: 'Почистить зубы',
    body: 'Не забудь почистить зубы.',
  },
  {
    id: 'exercise',
    notificationId: 1002,
    hour: 9,
    minute: 0,
    title: 'Сделать зарядку',
    body: 'Пора сделать комплекс упражнений.',
  },
  {
    id: 'chew',
    notificationId: 1003,
    hour: 15,
    minute: 0,
    title: 'Заполнить дневник жевания',
    body: 'Не забудь заполнить жевание после обеда.',
  },
]

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function loadNotificationsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function saveNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform()
}

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Напоминания на день',
      description: 'Зубы, зарядка и дневник жевания',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* channel may already exist */
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!notificationsSupported()) return
  await LocalNotifications.cancel({
    notifications: [
      ...REMINDERS.map((r) => ({ id: r.notificationId })),
      ...LEGACY_NOTIFICATION_IDS.map((id) => ({ id })),
    ],
  })
}

export async function scheduleReminders(): Promise<boolean> {
  if (!notificationsSupported()) return false

  await ensureChannel()

  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') {
    return false
  }

  await cancelAllReminders()

  await LocalNotifications.schedule({
    notifications: REMINDERS.map((r) => ({
      id: r.notificationId,
      title: r.title,
      body: r.body,
      channelId: CHANNEL_ID,
      schedule: {
        on: { hour: r.hour, minute: r.minute },
        allowWhileIdle: true,
      },
      extra: { reminderId: r.id },
    })),
  })

  return true
}

/** Enable/disable and (re)schedule. Returns false if permission denied. */
export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  saveNotificationsEnabled(enabled)
  if (!enabled) {
    await cancelAllReminders()
    return true
  }
  return scheduleReminders()
}

/**
 * Sync schedules with stored preference.
 * Only active for child role on native platforms.
 */
export async function syncRemindersForRole(
  role: 'child' | 'parent' | null,
): Promise<void> {
  if (!notificationsSupported()) return
  if (role !== 'child' || !loadNotificationsEnabled()) {
    await cancelAllReminders()
    return
  }
  await scheduleReminders()
}
