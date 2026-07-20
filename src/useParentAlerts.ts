import { useCallback, useEffect, useState } from 'react'
import {
  hasParentAlertPermission,
  loadChildName,
  loadParentAlertsEnabled,
  loadParentLabel,
  notificationsSupported,
  processParentAlerts,
  requestParentAlertPermission,
  saveChildName,
  saveParentAlertsEnabled,
  saveParentLabel,
  seedParentAlerts,
} from './parentAlerts'
import type { AppData } from './types'
import type { UserRole } from './types'

export function useParentAlerts(role: UserRole | null, data: AppData) {
  const [enabled, setEnabledState] = useState(() => loadParentAlertsEnabled())
  const [childName, setChildNameState] = useState(() => loadChildName())
  const [parentLabel, setParentLabelState] = useState(() => loadParentLabel())
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const supported = notificationsSupported()

  useEffect(() => {
    if (role !== 'parent' || !enabled) return
    void (async () => {
      if (supported) {
        const ok = await hasParentAlertPermission()
        if (!ok) {
          setDenied(true)
          return
        }
        setDenied(false)
      }
      await processParentAlerts(data)
    })()
  }, [role, enabled, data, supported])

  const setEnabled = useCallback(
    async (next: boolean) => {
      setBusy(true)
      setDenied(false)
      try {
        if (!next) {
          saveParentAlertsEnabled(false)
          setEnabledState(false)
          return
        }
        if (!supported) {
          saveParentAlertsEnabled(true)
          setEnabledState(true)
          return
        }
        const ok = await requestParentAlertPermission()
        if (!ok) {
          saveParentAlertsEnabled(false)
          setEnabledState(false)
          setDenied(true)
          return
        }
        seedParentAlerts(data)
        saveParentAlertsEnabled(true)
        setEnabledState(true)
      } finally {
        setBusy(false)
      }
    },
    [supported, data],
  )

  const setChildName = useCallback((name: string) => {
    saveChildName(name)
    setChildNameState(loadChildName())
  }, [])

  const setParentLabel = useCallback((label: string) => {
    saveParentLabel(label)
    setParentLabelState(loadParentLabel())
  }, [])

  return {
    enabled,
    setEnabled,
    childName,
    setChildName,
    parentLabel,
    setParentLabel,
    busy,
    supported,
    denied,
  }
}
