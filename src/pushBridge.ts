import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { markChildTaskAlertSeen } from './childTaskAlerts'
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from './familySync'
import { isFirebaseConfigured } from './firebase'
import { markParentAlertSeen } from './parentAlerts'
import type { UserRole } from './types'

let listenersBound = false
let currentCode: string | null = null
let currentRole: UserRole | null = null

function rememberEventKey(key: unknown) {
  if (typeof key !== 'string' || !key.trim()) return
  markParentAlertSeen(key)
  markChildTaskAlertSeen(key)
}

async function ensurePushChannels(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  const channels = [
    {
      id: 'parent-activity',
      name: 'Прогресс ребёнка',
      description: 'Когда ребёнок сделал зарядку или заполнил дневник',
    },
    {
      id: 'parent-tasks',
      name: 'Задания от родителя',
      description: 'Когда родитель добавил новое задание',
    },
  ]
  for (const ch of channels) {
    try {
      await LocalNotifications.createChannel({
        ...ch,
        importance: 5,
        visibility: 1,
        vibration: true,
      })
    } catch {
      /* already exists */
    }
  }
}

export function pushSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export async function startPushBridge(
  code: string | null,
  role: UserRole | null,
): Promise<void> {
  if (!pushSupported() || !isFirebaseConfigured()) return
  currentCode = code
  currentRole = role
  if (!code || !role) return

  await ensurePushChannels()

  if (!listenersBound) {
    listenersBound = true
    await PushNotifications.addListener('registration', (token) => {
      if (!currentCode || !currentRole || !token.value) return
      void registerDeviceToken(currentCode, currentRole, token.value)
    })
    await PushNotifications.addListener('registrationError', () => {
      /* Play services / permission — in-app alerts still work while open */
    })
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        rememberEventKey(notification.data?.eventKey)
      },
    )
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        rememberEventKey(action.notification.data?.eventKey)
      },
    )
  }

  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return
  await PushNotifications.register()
}

export async function stopPushBridge(code: string | null): Promise<void> {
  currentCode = null
  await unregisterDeviceToken(code)
}
