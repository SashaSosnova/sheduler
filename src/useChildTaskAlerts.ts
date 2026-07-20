import { useCallback, useEffect, useState } from 'react'
import {
  hasChildTaskAlertPermission,
  loadChildTaskAlertsEnabled,
  notificationsSupported,
  processChildTaskAlerts,
  requestChildTaskAlertPermission,
  saveChildTaskAlertsEnabled,
  seedChildTaskAlerts,
} from './childTaskAlerts'
import type { AppData } from './types'
import type { UserRole } from './types'

export function useChildTaskAlerts(role: UserRole | null, data: AppData) {
  const [enabled, setEnabledState] = useState(() => loadChildTaskAlertsEnabled())
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const supported = notificationsSupported()

  useEffect(() => {
    if (role !== 'child' || !enabled) return
    void (async () => {
      if (supported) {
        // Don't re-prompt the system dialog on every sync — only check.
        const ok = await hasChildTaskAlertPermission()
        if (!ok) {
          setDenied(true)
          return
        }
        setDenied(false)
      }
      await processChildTaskAlerts(data)
    })()
  }, [role, enabled, data, supported])

  const setEnabled = useCallback(
    async (next: boolean) => {
      setBusy(true)
      setDenied(false)
      try {
        if (!next) {
          saveChildTaskAlertsEnabled(false)
          setEnabledState(false)
          return
        }
        if (!supported) {
          saveChildTaskAlertsEnabled(true)
          setEnabledState(true)
          return
        }
        const ok = await requestChildTaskAlertPermission()
        if (!ok) {
          saveChildTaskAlertsEnabled(false)
          setEnabledState(false)
          setDenied(true)
          return
        }
        seedChildTaskAlerts(data)
        saveChildTaskAlertsEnabled(true)
        setEnabledState(true)
      } finally {
        setBusy(false)
      }
    },
    [supported, data],
  )

  return {
    enabled,
    setEnabled,
    busy,
    supported,
    denied,
  }
}
