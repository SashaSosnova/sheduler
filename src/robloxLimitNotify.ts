import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const CHANNEL_ID = 'roblox-limit'
const NOTIFICATION_ID = 4001

export function robloxLimitNotifySupported(): boolean {
  return Capacitor.isNativePlatform()
}

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Лимит Roblox',
      description: 'Когда закончилось время на Roblox',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* already exists */
  }
}

async function ensurePermission(): Promise<boolean> {
  if (!robloxLimitNotifySupported()) return false
  await ensureChannel()
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

/** Cancel a pending «limit ended» notification. */
export async function cancelRobloxLimitNotification(): Promise<void> {
  if (!robloxLimitNotifySupported()) return
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: NOTIFICATION_ID }],
    })
  } catch {
    /* ignore */
  }
}

/**
 * Schedule a one-shot alert for when today's Roblox limit ends.
 * Replaces any previous schedule. Call again if endsAt changes (pause/resume/bonus).
 */
export async function scheduleRobloxLimitEndedAt(
  endsAt: number,
): Promise<void> {
  if (!robloxLimitNotifySupported()) return
  const ok = await ensurePermission()
  if (!ok) return

  await cancelRobloxLimitNotification()

  const at = new Date(endsAt)
  // Already past — the in-app timeout path shows the alert; don't double-fire here.
  if (at.getTime() <= Date.now() + 800) return


  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: 'Ты ещё играешь в Roblox?',
        body: 'Ты превысил лимит. Если уже закончил — нажми «Закончить на сегодня».',
        channelId: CHANNEL_ID,
        schedule: { at },
        extra: { kind: 'roblox-limit' },
      },
    ],
  })
}

/** Immediate alert (e.g. timer hit zero while the app is open). */
export async function notifyRobloxLimitExceeded(): Promise<void> {
  if (!robloxLimitNotifySupported()) return
  const ok = await ensurePermission()
  if (!ok) return

  await cancelRobloxLimitNotification()
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: 'Ты ещё играешь в Roblox?',
        body: 'Ты превысил лимит. Если уже закончил — нажми «Закончить на сегодня».',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 400) },
        extra: { kind: 'roblox-limit' },
      },
    ],
  })
}
