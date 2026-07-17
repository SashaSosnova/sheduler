import { useEffect, useState } from 'react'
import {
  doc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ensureAuth } from './familySync'
import { getFirebaseDb, isFirebaseConfigured } from './firebase'
import { todayKey } from './data'

/**
 * Family code from Tom Sawyer (Parent → «Облако — код семьи»).
 * Override via VITE_TOM_SAWYER_FAMILY_CODE in .env if the family is recreated.
 */
export const TOM_SAWYER_FAMILY_CODE = (
  (import.meta.env.VITE_TOM_SAWYER_FAMILY_CODE as string | undefined) ??
  'FSXXWH'
)
  .trim()
  .toUpperCase()

const COLLECTION = 'tomSawyerFamilies'
const STREAK_KEY = 'tom-sawyer-streak'
const COMPLETED_KEY = 'tom-sawyer-completed'
const BOOK_BONUS_KEY = 'tom-sawyer-book-bonus'
/** chapters.length in tom-sawyer-reader (1–35 + заключение) */
export const TOM_SAWYER_CHAPTER_COUNT = 36

export type TomSawyerCloudPayload = {
  data: Record<string, string | null | undefined>
  updatedAt: number
}

function familyRef(code: string) {
  return doc(getFirebaseDb(), COLLECTION, code)
}

export function isReadDoneToday(
  payload: TomSawyerCloudPayload | null | undefined,
  today = todayKey(),
): boolean {
  if (!payload?.data) return false
  const raw = payload.data[STREAK_KEY]
  if (!raw || typeof raw !== 'string') return false
  try {
    const streak = JSON.parse(raw) as { lastEarnDate?: string | null }
    return streak.lastEarnDate === today
  } catch {
    return false
  }
}

export function isTomSawyerBookComplete(
  payload: TomSawyerCloudPayload | null | undefined,
): boolean {
  if (!payload?.data) return false
  if (payload.data[BOOK_BONUS_KEY] === '1') return true
  const raw = payload.data[COMPLETED_KEY]
  if (!raw || typeof raw !== 'string') return false
  try {
    const completed = JSON.parse(raw) as unknown
    return Array.isArray(completed) && completed.length >= TOM_SAWYER_CHAPTER_COUNT
  } catch {
    return false
  }
}

export function subscribeTomSawyerFamily(
  code: string,
  onData: (payload: TomSawyerCloudPayload) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    familyRef(code),
    (snap) => {
      if (!snap.exists()) {
        onError('Семья Тома Сойера не найдена')
        return
      }
      const remote = snap.data() as {
        app?: string
        data?: Record<string, string | null | undefined>
        updatedAt?: number
      }
      if (remote.app && remote.app !== 'tom-sawyer') {
        onError('Этот код от другого приложения')
        return
      }
      onData({
        data: remote.data ?? {},
        updatedAt: remote.updatedAt ?? Date.now(),
      })
    },
    (err) => {
      onError(err.message || 'Ошибка синхронизации Тома Сойера')
    },
  )
}

export type TomSawyerLive = {
  readDoneToday: boolean
  bookComplete: boolean
}

/** Live flags from Tom Sawyer cloud family doc. */
export function useTomSawyerLive(
  code: string = TOM_SAWYER_FAMILY_CODE,
): TomSawyerLive {
  const [state, setState] = useState<TomSawyerLive>({
    readDoneToday: false,
    bookComplete: false,
  })

  useEffect(() => {
    if (!code || !isFirebaseConfigured()) {
      setState({ readDoneToday: false, bookComplete: false })
      return
    }

    let unsub: Unsubscribe | null = null
    let cancelled = false

    ensureAuth()
      .then(() => {
        if (cancelled) return
        unsub = subscribeTomSawyerFamily(
          code,
          (payload) => {
            setState({
              readDoneToday: isReadDoneToday(payload),
              bookComplete: isTomSawyerBookComplete(payload),
            })
          },
          () => {
            setState({ readDoneToday: false, bookComplete: false })
          },
        )
      })
      .catch(() => {
        if (!cancelled) {
          setState({ readDoneToday: false, bookComplete: false })
        }
      })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [code])

  return state
}

/** Live flag: a chapter quiz was earned in Tom Sawyer today. */
export function useTomSawyerReadToday(
  code: string = TOM_SAWYER_FAMILY_CODE,
): boolean {
  return useTomSawyerLive(code).readDoneToday
}
