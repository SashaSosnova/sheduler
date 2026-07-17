import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_EXERCISES, ROUTINE_ID, defaultAppData } from './data'
import {
  createFamily,
  joinFamily,
  leaveFamily,
  loadFamilyCode,
  pushFamilyData,
  subscribeFamily,
  ensureAuth,
  type CloudPayload,
  type FamilyStatus,
} from './familySync'
import { isFirebaseConfigured } from './firebase'
import {
  ROBLOX_STREAK_REWARDS,
  applyPendingRobloxStreakRewards,
  currentStreak,
} from './progress'
import type { AppData, ChewEntry, DayLog } from './types'

const STORAGE_KEY = 'vacation-planner-v2'

type StoredData = {
  days?: Record<string, DayLog>
  chewEntries?: ChewEntry[]
  cookingLeft?: number
  routineId?: string
  claimedRobloxStreaks?: number[]
  bestStreak?: number
  exercises?: unknown
}

function normalizeStreakInts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map((n) => Math.floor(n))
    .filter((n) => n > 0)
}

function hydrateAppData(partial: Partial<AppData>): AppData {
  const base = defaultAppData()
  return applyPendingRobloxStreakRewards({
    ...base,
    ...partial,
    exercises: DEFAULT_EXERCISES,
    days: partial.days ?? {},
    chewEntries: partial.chewEntries ?? [],
    cookingLeft: partial.cookingLeft ?? 5,
    routineId: ROUTINE_ID,
    claimedRobloxStreaks: normalizeStreakInts(partial.claimedRobloxStreaks),
    bestStreak:
      typeof partial.bestStreak === 'number' && Number.isFinite(partial.bestStreak)
        ? Math.max(0, Math.floor(partial.bestStreak))
        : 0,
  })
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const legacy = !raw ? localStorage.getItem('vacation-planner-v1') : null
    const source = raw ?? legacy
    if (!source) return defaultAppData()

    const parsed = JSON.parse(source) as StoredData
    const days = parsed.days ?? {}
    const streak = currentStreak(days)
    // Legacy saves had no claim list — mark already-reached tiers as claimed
    // so upgrade doesn't dump a huge catch-up Roblox bonus in one day.
    const claimedRobloxStreaks = Array.isArray(parsed.claimedRobloxStreaks)
      ? parsed.claimedRobloxStreaks
      : ROBLOX_STREAK_REWARDS.filter((r) => streak >= r.streak).map(
          (r) => r.streak,
        )
    const bestStreak =
      typeof parsed.bestStreak === 'number' && Number.isFinite(parsed.bestStreak)
        ? Math.max(0, Math.floor(parsed.bestStreak), streak)
        : streak
    return hydrateAppData({
      days,
      chewEntries: parsed.chewEntries ?? [],
      cookingLeft: parsed.cookingLeft ?? 5,
      claimedRobloxStreaks,
      bestStreak,
    })
  } catch {
    return defaultAppData()
  }
}

function applyCloud(prev: AppData, payload: CloudPayload): AppData {
  const days = payload.days ?? {}
  const streak = currentStreak(days)
  const claimedRobloxStreaks =
    payload.claimedRobloxStreaks ??
    prev.claimedRobloxStreaks ??
    ROBLOX_STREAK_REWARDS.filter((r) => streak >= r.streak).map((r) => r.streak)
  const bestStreak = Math.max(
    payload.bestStreak ?? 0,
    prev.bestStreak ?? 0,
    streak,
  )
  return hydrateAppData({
    ...prev,
    days,
    chewEntries: payload.chewEntries ?? [],
    cookingLeft: payload.cookingLeft ?? prev.cookingLeft,
    claimedRobloxStreaks,
    bestStreak,
  })
}

/** Replace local state with cloud on family join (no merge with previous family). */
function replaceFromCloud(payload: CloudPayload): AppData {
  const days = payload.days ?? {}
  const streak = currentStreak(days)
  return hydrateAppData({
    days,
    chewEntries: payload.chewEntries ?? [],
    cookingLeft: payload.cookingLeft ?? 5,
    claimedRobloxStreaks: payload.claimedRobloxStreaks ?? [],
    bestStreak: Math.max(payload.bestStreak ?? 0, streak),
  })
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => load())
  const [family, setFamily] = useState<FamilyStatus>(() => ({
    code: loadFamilyCode(),
    connected: false,
    syncing: false,
    error: null,
    lastSyncedAt: null,
  }))

  const dataRef = useRef(data)
  const skipPushUntil = useRef(0)
  const pushTimer = useRef<number | null>(null)
  const lastRemoteAt = useRef(0)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    const toStore: StoredData = {
      days: data.days,
      chewEntries: data.chewEntries,
      cookingLeft: data.cookingLeft,
      routineId: ROUTINE_ID,
      claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
      bestStreak: data.bestStreak ?? 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  }, [data])

  const schedulePush = useCallback((next: AppData) => {
    const code = loadFamilyCode()
    if (!code || !isFirebaseConfigured()) return
    if (Date.now() < skipPushUntil.current) return

    if (pushTimer.current) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(async () => {
      setFamily((f) => ({ ...f, syncing: true, error: null }))
      try {
        const updatedAt = await pushFamilyData(code, next)
        lastRemoteAt.current = updatedAt
        setFamily((f) => ({
          ...f,
          syncing: false,
          connected: true,
          lastSyncedAt: updatedAt,
          error: null,
        }))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Не удалось сохранить в облако'
        setFamily((f) => ({ ...f, syncing: false, error: message }))
      }
    }, 700)
  }, [])

  const setDataAndSync = useCallback(
    (action: AppData | ((prev: AppData) => AppData)) => {
      setData((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        const normalized = hydrateAppData(next)
        schedulePush(normalized)
        return normalized
      })
    },
    [schedulePush],
  )

  useEffect(() => {
    if (!isFirebaseConfigured()) return
    const code = loadFamilyCode()
    if (!code) return

    setFamily((f) => ({ ...f, code, syncing: true, error: null }))
    let unsub = () => {}

    ;(async () => {
      try {
        await ensureAuth()
        unsub = subscribeFamily(
          code,
          (payload) => {
            if (payload.updatedAt && payload.updatedAt <= lastRemoteAt.current) {
              setFamily((f) => ({
                ...f,
                connected: true,
                syncing: false,
                lastSyncedAt: payload.updatedAt,
              }))
              return
            }
            lastRemoteAt.current = payload.updatedAt
            skipPushUntil.current = Date.now() + 1200
            setData((prev) => applyCloud(prev, payload))
            setFamily((f) => ({
              ...f,
              code,
              connected: true,
              syncing: false,
              lastSyncedAt: payload.updatedAt,
              error: null,
            }))
          },
          (message) => {
            setFamily((f) => ({
              ...f,
              syncing: false,
              connected: false,
              error: message,
            }))
          },
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Ошибка подключения к семье'
        setFamily((f) => ({ ...f, syncing: false, connected: false, error: message }))
      }
    })()

    return () => {
      unsub()
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
    }
  }, [family.code])

  const createFamilyCloud = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setFamily((f) => ({
        ...f,
        error: 'Firebase не настроен. Проверь .env и консоль Firebase.',
      }))
      return
    }
    setFamily((f) => ({ ...f, syncing: true, error: null }))
    try {
      const code = await createFamily(dataRef.current)
      lastRemoteAt.current = Date.now()
      setFamily({
        code,
        connected: true,
        syncing: false,
        error: null,
        lastSyncedAt: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать семью'
      setFamily((f) => ({ ...f, syncing: false, error: message }))
    }
  }, [])

  const joinFamilyCloud = useCallback(async (code: string) => {
    if (!isFirebaseConfigured()) {
      setFamily((f) => ({
        ...f,
        error: 'Firebase не настроен. Проверь .env и консоль Firebase.',
      }))
      return
    }
    setFamily((f) => ({ ...f, syncing: true, error: null }))
    try {
      const payload = await joinFamily(code)
      lastRemoteAt.current = payload.updatedAt
      skipPushUntil.current = Date.now() + 1200
      setData(replaceFromCloud(payload))
      setFamily({
        code: code.trim().toUpperCase(),
        connected: true,
        syncing: false,
        error: null,
        lastSyncedAt: payload.updatedAt,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось войти по коду'
      setFamily((f) => ({ ...f, syncing: false, error: message }))
    }
  }, [])

  const leaveFamilyCloud = useCallback(() => {
    leaveFamily()
    setFamily({
      code: null,
      connected: false,
      syncing: false,
      error: null,
      lastSyncedAt: null,
    })
  }, [])

  return {
    data,
    setData: setDataAndSync,
    family,
    createFamilyCloud,
    joinFamilyCloud,
    leaveFamilyCloud,
    firebaseReady: isFirebaseConfigured(),
  }
}
