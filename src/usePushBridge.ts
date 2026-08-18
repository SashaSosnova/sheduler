import { useEffect } from 'react'
import { startPushBridge } from './pushBridge'
import type { UserRole } from './types'

/** Register this phone for background push while it belongs to a family. */
export function usePushBridge(role: UserRole | null, familyCode: string | null) {
  useEffect(() => {
    if (!role || !familyCode) return
    void startPushBridge(familyCode, role)
  }, [role, familyCode])
}
