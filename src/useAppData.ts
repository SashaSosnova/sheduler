import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_EXERCISES,
  ROUTINE_ID,
  defaultAppData,
  mergeChewEntries,
  mergeDaysMaps,
} from './data'
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
  applyPendingStickerMoneyRewards,
  countParentTasksDone,
  currentStreak,
  normalizeFinishedBooks,
  resolveReadingBooks,
  seedClaimedStickerMoneyIds,
} from './progress'
import type {
  AppData,
  ChewEntry,
  DayLog,
  FinishedBook,
  ReadingBook,
} from './types'

const STORAGE_KEY = 'vacation-planner-v2'

type StoredData = {
  days?: Record<string, DayLog>
  chewEntries?: ChewEntry[]
  cookingLeft?: number
  routineId?: string
  claimedRobloxStreaks?: number[]
  robloxBonusBankMin?: number
  moneyBankRub?: number
  claimedStickerMoneyIds?: string[]
  equippedStickerId?: string | null
  bestStreak?: number
  bestParentTasks?: number
  /** @deprecated use readingBooks */
  currentBook?: string
  readingBooks?: ReadingBook[]
  finishedBooks?: FinishedBook[]
  exercises?: unknown
}

function normalizeStringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

function normalizeNonNegInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

function normalizeEquippedStickerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim()
  return id.length > 0 ? id : null
}

function normalizeStreakInts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map((n) => Math.floor(n))
    .filter((n) => n > 0)
}

function hydrateAppData(
  partial: Partial<AppData> & { currentBook?: string },
): AppData {
  const base = defaultAppData()
  const days = partial.days ?? {}
  const parentNow = countParentTasksDone(days)
  const bestParentTasks = Math.max(
    typeof partial.bestParentTasks === 'number' &&
      Number.isFinite(partial.bestParentTasks)
      ? Math.max(0, Math.floor(partial.bestParentTasks))
      : 0,
    parentNow,
  )
  return applyPendingStickerMoneyRewards(
    applyPendingRobloxStreakRewards({
      ...base,
      ...partial,
      exercises: DEFAULT_EXERCISES,
      days,
      chewEntries: partial.chewEntries ?? [],
      cookingLeft: partial.cookingLeft ?? 5,
      routineId: ROUTINE_ID,
      claimedRobloxStreaks: normalizeStreakInts(partial.claimedRobloxStreaks),
      robloxBonusBankMin: normalizeNonNegInt(partial.robloxBonusBankMin),
      moneyBankRub: normalizeNonNegInt(partial.moneyBankRub),
      claimedStickerMoneyIds: normalizeStringIds(partial.claimedStickerMoneyIds),
      equippedStickerId: normalizeEquippedStickerId(partial.equippedStickerId),
      bestStreak:
        typeof partial.bestStreak === 'number' && Number.isFinite(partial.bestStreak)
          ? Math.max(0, Math.floor(partial.bestStreak))
          : 0,
      bestParentTasks,
      readingBooks: resolveReadingBooks(partial.readingBooks, partial.currentBook),
      finishedBooks: normalizeFinishedBooks(partial.finishedBooks),
    }),
  )
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
    const parentNow = countParentTasksDone(days)
    const bestParentTasks =
      typeof parsed.bestParentTasks === 'number' &&
      Number.isFinite(parsed.bestParentTasks)
        ? Math.max(0, Math.floor(parsed.bestParentTasks), parentNow)
        : parentNow
    // Legacy saves had no money claim list — mark already-unlocked money
    // stickers as claimed so upgrade doesn't dump a catch-up cash bonus.
    const claimedStickerMoneyIds = Array.isArray(parsed.claimedStickerMoneyIds)
      ? normalizeStringIds(parsed.claimedStickerMoneyIds)
      : seedClaimedStickerMoneyIds({
          ...defaultAppData(),
          days,
          bestParentTasks,
          bestStreak,
        })
    return hydrateAppData({
      days,
      chewEntries: parsed.chewEntries ?? [],
      cookingLeft: parsed.cookingLeft ?? 5,
      claimedRobloxStreaks,
      robloxBonusBankMin: normalizeNonNegInt(parsed.robloxBonusBankMin),
      moneyBankRub: normalizeNonNegInt(parsed.moneyBankRub),
      claimedStickerMoneyIds,
      equippedStickerId: normalizeEquippedStickerId(parsed.equippedStickerId),
      bestStreak,
      bestParentTasks,
      readingBooks: resolveReadingBooks(
        parsed.readingBooks,
        parsed.currentBook,
      ),
      finishedBooks: parsed.finishedBooks ?? [],
    })
  } catch {
    return defaultAppData()
  }
}

function resolveClaimedStickerMoneyIds(
  raw: unknown,
  days: Record<string, DayLog>,
  bestParentTasks: number,
  bestStreak: number,
): string[] {
  // Missing field = legacy cloud/local save — seed so already-unlocked
  // turtle stickers don't dump catch-up cash into the bank.
  if (!Array.isArray(raw)) {
    return seedClaimedStickerMoneyIds({
      ...defaultAppData(),
      days,
      bestParentTasks,
      bestStreak,
    })
  }
  return normalizeStringIds(raw)
}

function applyCloud(prev: AppData, payload: CloudPayload): AppData {
  const days = mergeDaysMaps(prev.days ?? {}, payload.days ?? {})
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
  const parentNow = countParentTasksDone(days)
  const bestParentTasks = Math.max(
    payload.bestParentTasks ?? 0,
    prev.bestParentTasks ?? 0,
    parentNow,
  )
  const finishedBooks = mergeFinishedBooks(
    prev.finishedBooks ?? [],
    normalizeFinishedBooks(payload.finishedBooks ?? prev.finishedBooks),
  )
  const readingBooks = mergeReadingBooks(
    resolveReadingBooks(prev.readingBooks, undefined),
    resolveReadingBooks(payload.readingBooks, payload.currentBook),
    finishedBooks,
  )
  const remoteClaimed = resolveClaimedStickerMoneyIds(
    payload.claimedStickerMoneyIds,
    days,
    bestParentTasks,
    bestStreak,
  )
  const claimedMoney = new Set([
    ...(prev.claimedStickerMoneyIds ?? []),
    ...remoteClaimed,
  ])
  return hydrateAppData({
    ...prev,
    days,
    chewEntries: mergeChewEntries(
      prev.chewEntries ?? [],
      payload.chewEntries ?? [],
    ),
    cookingLeft: payload.cookingLeft ?? prev.cookingLeft,
    claimedRobloxStreaks,
    robloxBonusBankMin:
      payload.robloxBonusBankMin ?? prev.robloxBonusBankMin ?? 0,
    moneyBankRub: payload.moneyBankRub ?? prev.moneyBankRub ?? 0,
    claimedStickerMoneyIds: [...claimedMoney],
    equippedStickerId:
      payload.equippedStickerId !== undefined
        ? normalizeEquippedStickerId(payload.equippedStickerId)
        : normalizeEquippedStickerId(prev.equippedStickerId),
    bestStreak,
    bestParentTasks,
    readingBooks,
    finishedBooks,
  })
}

function mergeFinishedBooks(
  local: FinishedBook[],
  remote: FinishedBook[],
): FinishedBook[] {
  const byKey = new Map<string, FinishedBook>()
  for (const book of [...local, ...remote]) {
    const key = book.title.trim().toLowerCase()
    const prev = byKey.get(key)
    if (!prev || book.finishedAt < prev.finishedAt) {
      byKey.set(key, book)
    }
  }
  return [...byKey.values()].sort((a, b) => a.finishedAt - b.finishedAt)
}

function mergeReadingBooks(
  local: ReadingBook[],
  remote: ReadingBook[],
  finished: FinishedBook[],
): ReadingBook[] {
  const finishedKeys = new Set(
    finished.map((b) => b.title.trim().toLowerCase()),
  )
  const byKey = new Map<string, ReadingBook>()
  for (const book of [...local, ...remote]) {
    const key = book.title.trim().toLowerCase()
    if (finishedKeys.has(key)) continue
    if (!byKey.has(key)) byKey.set(key, book)
  }
  return [...byKey.values()]
}

/** Replace local state with cloud on family join (no merge with previous family). */
function replaceFromCloud(payload: CloudPayload): AppData {
  const days = payload.days ?? {}
  const streak = currentStreak(days)
  const parentNow = countParentTasksDone(days)
  const bestStreak = Math.max(payload.bestStreak ?? 0, streak)
  const bestParentTasks = Math.max(payload.bestParentTasks ?? 0, parentNow)
  return hydrateAppData({
    days,
    chewEntries: payload.chewEntries ?? [],
    cookingLeft: payload.cookingLeft ?? 5,
    claimedRobloxStreaks: payload.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: payload.robloxBonusBankMin ?? 0,
    moneyBankRub: payload.moneyBankRub ?? 0,
    claimedStickerMoneyIds: resolveClaimedStickerMoneyIds(
      payload.claimedStickerMoneyIds,
      days,
      bestParentTasks,
      bestStreak,
    ),
    equippedStickerId: normalizeEquippedStickerId(payload.equippedStickerId),
    bestStreak,
    bestParentTasks,
    readingBooks: resolveReadingBooks(
      payload.readingBooks,
      payload.currentBook,
    ),
    finishedBooks: payload.finishedBooks ?? [],
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
      robloxBonusBankMin: data.robloxBonusBankMin ?? 0,
      moneyBankRub: data.moneyBankRub ?? 0,
      claimedStickerMoneyIds: data.claimedStickerMoneyIds ?? [],
      equippedStickerId: data.equippedStickerId ?? null,
      bestStreak: data.bestStreak ?? 0,
      bestParentTasks: data.bestParentTasks ?? 0,
      readingBooks: data.readingBooks ?? [],
      finishedBooks: data.finishedBooks ?? [],
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
