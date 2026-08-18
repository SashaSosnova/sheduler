import { useEffect } from 'react'
import {
  startFamilyBackgroundAlerts,
  stopFamilyBackgroundAlerts,
} from './familyAlertsNative'
import type { UserRole } from './types'

/** Keep a native Firestore listener alive so alerts work with the app closed. */
export function useFamilyBackgroundSync(
  role: UserRole | null,
  familyCode: string | null,
  childName: string,
  enabled: boolean,
) {
  useEffect(() => {
    if (!role || !familyCode || !enabled) {
      void stopFamilyBackgroundAlerts()
      return
    }
    void startFamilyBackgroundAlerts({
      code: familyCode,
      role,
      childName,
    })
  }, [role, familyCode, childName, enabled])
}
