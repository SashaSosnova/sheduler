import { useCallback, useState } from 'react'
import type { UserRole } from './types'

const ROLE_KEY = 'vacation-user-role'

function loadRole(): UserRole | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY)
    if (raw === 'child' || raw === 'parent') return raw
  } catch {
    /* ignore */
  }
  return null
}

export function useUserRole() {
  const [role, setRoleState] = useState<UserRole | null>(() => loadRole())

  const setRole = useCallback((next: UserRole) => {
    localStorage.setItem(ROLE_KEY, next)
    setRoleState(next)
  }, [])

  return { role, setRole }
}
