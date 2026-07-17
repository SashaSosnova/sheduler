import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './types'
import {
  loadNotificationsEnabled,
  notificationsSupported,
  saveNotificationsEnabled,
  setNotificationsEnabled,
  syncRemindersForRole,
} from './notifications'

export function useNotifications(role: UserRole | null) {
  const [enabled, setEnabledState] = useState(() => loadNotificationsEnabled())
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const supported = notificationsSupported()

  useEffect(() => {
    void syncRemindersForRole(role)
  }, [role])

  const setEnabled = useCallback(
    async (next: boolean) => {
      setBusy(true)
      setDenied(false)
      try {
        // Daily reminders only run on the child device
        if (role !== 'child') {
          saveNotificationsEnabled(next)
          setEnabledState(next)
          return
        }
        const ok = await setNotificationsEnabled(next)
        if (ok) {
          setEnabledState(next)
        } else {
          setEnabledState(false)
          saveNotificationsEnabled(false)
          setDenied(true)
        }
      } finally {
        setBusy(false)
      }
    },
    [role],
  )

  return { enabled, setEnabled, busy, supported, denied }
}
