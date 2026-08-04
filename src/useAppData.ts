import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ROUTINE_ID,
  defaultAppData,
  isRobloxEnabled,
  migrateLegacyMedicationName,
  normalizeMedications,
  normalizeRobloxLimitMin,
  mergeChewEntries,
  mergeDaysMaps,
  mergeExerciseControls,
  mergeExercises,
  mergeStudioSprintStates,
  normalizeExerciseControls,
  normalizeStudioSprintStates,
  resolveExercises,
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
  resolveLegoCount,
  resolvePuzzleCount,
  resolveRobloxBonusEarnedMin,
  seedClaimedStickerMoneyIds,
  seedDismissedGiftStickerIds,
} from './progress'
import type {
  AppData,
  ChewEntry,
  DayLog,
  FinishedBook,
  ReadingBook,
  StudioSprintState,
} from './types'

const STORAGE_KEY = 'vacation-planner-v2'

type StoredData = {
  days?: Record<string, DayLog>
  chewEntries?: ChewEntry[]
  cookingLeft?: number
  routineId?: string
  claimedRobloxStreaks?: number[]
  robloxBonusBankMin?: number
  robloxBonusEarnedMin?: number
  robloxEnabled?: boolean
  robloxLimitMin?: number
  robloxSettingsUpdatedAt?: number
  medications?: unknown
  /** @deprecated migrated into medications */
  medicationName?: string
  medicationUpdatedAt?: number
  moneyBankRub?: number
  banksUpdatedAt?: number
  claimedStickerMoneyIds?: string[]
  dismissedGiftStickerIds?: string[]
  equippedStickerId?: string | null
  bestStreak?: number
  bestParentTasks?: number
  /** @deprecated use readingBooks */
  currentBook?: string
  readingBooks?: ReadingBook[]
  finishedBooks?: FinishedBook[]
  studioSprintStates?: Record<string, StudioSprintState>
  puzzleCount?: number
  legoCount?: number
  exercises?: unknown
  exerciseControls?: unknown
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

function resolveMedications(
  medications: unknown,
  legacyName?: unknown,
): ReturnType<typeof normalizeMedications> {
  const list = normalizeMedications(medications)
  if (list.length > 0) return list
  return migrateLegacyMedicationName(legacyName)
}

function medicationsSignature(
  list: ReturnType<typeof normalizeMedications>,
): string {
  return JSON.stringify(
    list.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      slots: [...m.slots].sort(),
    })),
  )
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
      exercises: resolveExercises(partial.exercises ?? base.exercises),
      days,
      chewEntries: partial.chewEntries ?? [],
      exerciseControls: normalizeExerciseControls(
        partial.exerciseControls ?? base.exerciseControls,
      ),
      cookingLeft: partial.cookingLeft ?? 5,
      routineId: ROUTINE_ID,
      claimedRobloxStreaks: normalizeStreakInts(partial.claimedRobloxStreaks),
      robloxBonusBankMin: normalizeNonNegInt(partial.robloxBonusBankMin),
      robloxBonusEarnedMin: resolveRobloxBonusEarnedMin({
        ...base,
        ...partial,
        claimedRobloxStreaks: normalizeStreakInts(partial.claimedRobloxStreaks),
        robloxBonusBankMin: normalizeNonNegInt(partial.robloxBonusBankMin),
        robloxBonusEarnedMin: normalizeNonNegInt(partial.robloxBonusEarnedMin),
      } as AppData),
      robloxEnabled: partial.robloxEnabled !== false,
      robloxLimitMin: normalizeRobloxLimitMin(
        partial.robloxLimitMin ?? base.robloxLimitMin,
      ),
      robloxSettingsUpdatedAt: normalizeNonNegInt(
        partial.robloxSettingsUpdatedAt,
      ),
      medications: resolveMedications(
        partial.medications,
        (partial as { medicationName?: string }).medicationName,
      ),
      medicationUpdatedAt: normalizeNonNegInt(partial.medicationUpdatedAt),
      moneyBankRub: normalizeNonNegInt(partial.moneyBankRub),
      banksUpdatedAt: normalizeNonNegInt(partial.banksUpdatedAt),
      claimedStickerMoneyIds: normalizeStringIds(partial.claimedStickerMoneyIds),
      dismissedGiftStickerIds: normalizeStringIds(
        partial.dismissedGiftStickerIds,
      ),
      equippedStickerId: normalizeEquippedStickerId(partial.equippedStickerId),
      bestStreak:
        typeof partial.bestStreak === 'number' && Number.isFinite(partial.bestStreak)
          ? Math.max(0, Math.floor(partial.bestStreak))
          : 0,
      bestParentTasks,
      readingBooks: resolveReadingBooks(partial.readingBooks, partial.currentBook),
      finishedBooks: normalizeFinishedBooks(partial.finishedBooks),
      studioSprintStates: normalizeStudioSprintStates(partial.studioSprintStates),
      puzzleCount: resolvePuzzleCount({
        ...base,
        ...partial,
        days: partial.days ?? base.days,
        puzzleCount: normalizeNonNegInt(partial.puzzleCount),
      } as AppData),
      legoCount: resolveLegoCount({
        ...base,
        ...partial,
        days: partial.days ?? base.days,
        legoCount: normalizeNonNegInt(partial.legoCount),
      } as AppData),
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
    const chewEntries = parsed.chewEntries ?? []
    const finishedBooks = parsed.finishedBooks ?? []
    const readingBooks = resolveReadingBooks(
      parsed.readingBooks,
      parsed.currentBook,
    )
    // Legacy: already-unlocked gift stickers count as already given.
    const dismissedGiftStickerIds = Array.isArray(
      parsed.dismissedGiftStickerIds,
    )
      ? normalizeStringIds(parsed.dismissedGiftStickerIds)
      : seedDismissedGiftStickerIds({
          ...defaultAppData(),
          days,
          chewEntries,
          finishedBooks,
          readingBooks,
          bestParentTasks,
          bestStreak,
        })
    return hydrateAppData({
      days,
      chewEntries,
      exercises: resolveExercises(parsed.exercises),
      exerciseControls: normalizeExerciseControls(parsed.exerciseControls),
      cookingLeft: parsed.cookingLeft ?? 5,
      claimedRobloxStreaks,
      robloxBonusBankMin: normalizeNonNegInt(parsed.robloxBonusBankMin),
      robloxBonusEarnedMin: normalizeNonNegInt(parsed.robloxBonusEarnedMin),
      robloxEnabled: parsed.robloxEnabled !== false,
      robloxLimitMin: normalizeRobloxLimitMin(parsed.robloxLimitMin),
      robloxSettingsUpdatedAt: normalizeNonNegInt(
        parsed.robloxSettingsUpdatedAt,
      ),
      medications: resolveMedications(
        parsed.medications,
        parsed.medicationName,
      ),
      medicationUpdatedAt: normalizeNonNegInt(parsed.medicationUpdatedAt),
      moneyBankRub: normalizeNonNegInt(parsed.moneyBankRub),
      banksUpdatedAt: normalizeNonNegInt(parsed.banksUpdatedAt),
      claimedStickerMoneyIds,
      dismissedGiftStickerIds,
      equippedStickerId: normalizeEquippedStickerId(parsed.equippedStickerId),
      bestStreak,
      bestParentTasks,
      readingBooks,
      finishedBooks,
      studioSprintStates: normalizeStudioSprintStates(parsed.studioSprintStates),
      puzzleCount: normalizeNonNegInt(parsed.puzzleCount),
      legoCount: normalizeNonNegInt(parsed.legoCount),
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

function resolveDismissedGiftStickerIds(
  raw: unknown,
  seedFrom: Partial<AppData>,
): string[] {
  if (!Array.isArray(raw)) {
    return seedDismissedGiftStickerIds({
      ...defaultAppData(),
      ...seedFrom,
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
  const chewEntries = mergeChewEntries(
    prev.chewEntries ?? [],
    payload.chewEntries ?? [],
  )
  const remoteDismissed = resolveDismissedGiftStickerIds(
    payload.dismissedGiftStickerIds,
    {
      days,
      chewEntries,
      finishedBooks,
      readingBooks,
      bestParentTasks,
      bestStreak,
    },
  )
  const dismissedGifts = new Set([
    ...(prev.dismissedGiftStickerIds ?? []),
    ...remoteDismissed,
  ])
  const remoteBanksAt = normalizeNonNegInt(
    payload.banksUpdatedAt ?? payload.updatedAt,
  )
  const localBanksAt = normalizeNonNegInt(prev.banksUpdatedAt)
  const preferRemoteBanks = remoteBanksAt >= localBanksAt
  const remoteRobloxSettingsAt = normalizeNonNegInt(
    payload.robloxSettingsUpdatedAt,
  )
  const localRobloxSettingsAt = normalizeNonNegInt(prev.robloxSettingsUpdatedAt)
  const preferRemoteRobloxSettings =
    remoteRobloxSettingsAt >= localRobloxSettingsAt
  const remoteMedAt = normalizeNonNegInt(payload.medicationUpdatedAt)
  const localMedAt = normalizeNonNegInt(prev.medicationUpdatedAt)
  const preferRemoteMed = remoteMedAt >= localMedAt
  // Remote order wins (parent add/reorder); see mergeExercises.
  const exercises = mergeExercises(
    prev.exercises ?? [],
    resolveExercises(payload.exercises ?? prev.exercises),
  )
  const exerciseControls = mergeExerciseControls(
    normalizeExerciseControls(prev.exerciseControls),
    normalizeExerciseControls(payload.exerciseControls),
  )
  return hydrateAppData({
    ...prev,
    days,
    chewEntries,
    exercises,
    exerciseControls,
    cookingLeft: payload.cookingLeft ?? prev.cookingLeft,
    claimedRobloxStreaks,
    robloxBonusBankMin: preferRemoteBanks
      ? normalizeNonNegInt(payload.robloxBonusBankMin ?? prev.robloxBonusBankMin)
      : normalizeNonNegInt(prev.robloxBonusBankMin),
    robloxBonusEarnedMin: Math.max(
      normalizeNonNegInt(prev.robloxBonusEarnedMin),
      normalizeNonNegInt(payload.robloxBonusEarnedMin),
    ),
    robloxEnabled: preferRemoteRobloxSettings
      ? payload.robloxEnabled !== false
      : isRobloxEnabled(prev),
    robloxLimitMin: preferRemoteRobloxSettings
      ? normalizeRobloxLimitMin(
          payload.robloxLimitMin ?? prev.robloxLimitMin,
        )
      : normalizeRobloxLimitMin(prev.robloxLimitMin),
    robloxSettingsUpdatedAt: Math.max(
      remoteRobloxSettingsAt,
      localRobloxSettingsAt,
    ),
    medications: preferRemoteMed
      ? resolveMedications(payload.medications, payload.medicationName)
      : resolveMedications(prev.medications, undefined),
    medicationUpdatedAt: Math.max(remoteMedAt, localMedAt),
    moneyBankRub: preferRemoteBanks
      ? normalizeNonNegInt(payload.moneyBankRub ?? prev.moneyBankRub)
      : normalizeNonNegInt(prev.moneyBankRub),
    banksUpdatedAt: Math.max(remoteBanksAt, localBanksAt),
    claimedStickerMoneyIds: [...claimedMoney],
    dismissedGiftStickerIds: [...dismissedGifts],
    equippedStickerId:
      payload.equippedStickerId !== undefined
        ? normalizeEquippedStickerId(payload.equippedStickerId)
        : normalizeEquippedStickerId(prev.equippedStickerId),
    bestStreak,
    bestParentTasks,
    readingBooks,
    finishedBooks,
    studioSprintStates: mergeStudioSprintStates(
      prev.studioSprintStates,
      payload.studioSprintStates,
    ),
    puzzleCount: Math.max(
      resolvePuzzleCount(prev),
      normalizeNonNegInt(payload.puzzleCount),
    ),
    legoCount: Math.max(
      resolveLegoCount(prev),
      normalizeNonNegInt(payload.legoCount),
    ),
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
  const chewEntries = payload.chewEntries ?? []
  const finishedBooks = payload.finishedBooks ?? []
  const readingBooks = resolveReadingBooks(
    payload.readingBooks,
    payload.currentBook,
  )
  return hydrateAppData({
    days,
    chewEntries,
    exercises: resolveExercises(payload.exercises),
    exerciseControls: normalizeExerciseControls(payload.exerciseControls),
    cookingLeft: payload.cookingLeft ?? 5,
    claimedRobloxStreaks: payload.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: payload.robloxBonusBankMin ?? 0,
    robloxBonusEarnedMin: normalizeNonNegInt(payload.robloxBonusEarnedMin),
    robloxEnabled: payload.robloxEnabled !== false,
    robloxLimitMin: normalizeRobloxLimitMin(payload.robloxLimitMin),
    robloxSettingsUpdatedAt: normalizeNonNegInt(
      payload.robloxSettingsUpdatedAt,
    ),
    medications: resolveMedications(
      payload.medications,
      payload.medicationName,
    ),
    medicationUpdatedAt: normalizeNonNegInt(payload.medicationUpdatedAt),
    moneyBankRub: payload.moneyBankRub ?? 0,
    banksUpdatedAt: normalizeNonNegInt(
      payload.banksUpdatedAt ?? payload.updatedAt,
    ),
    claimedStickerMoneyIds: resolveClaimedStickerMoneyIds(
      payload.claimedStickerMoneyIds,
      days,
      bestParentTasks,
      bestStreak,
    ),
    dismissedGiftStickerIds: resolveDismissedGiftStickerIds(
      payload.dismissedGiftStickerIds,
      {
        days,
        chewEntries,
        finishedBooks,
        readingBooks,
        bestParentTasks,
        bestStreak,
      },
    ),
    equippedStickerId: normalizeEquippedStickerId(payload.equippedStickerId),
    bestStreak,
    bestParentTasks,
    readingBooks,
    finishedBooks,
    studioSprintStates: normalizeStudioSprintStates(payload.studioSprintStates),
    puzzleCount: normalizeNonNegInt(payload.puzzleCount),
    legoCount: normalizeNonNegInt(payload.legoCount),
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
      exercises: data.exercises ?? [],
      exerciseControls: data.exerciseControls ?? [],
      claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
      robloxBonusBankMin: data.robloxBonusBankMin ?? 0,
      robloxBonusEarnedMin: data.robloxBonusEarnedMin ?? 0,
      robloxEnabled: data.robloxEnabled !== false,
      robloxLimitMin: normalizeRobloxLimitMin(data.robloxLimitMin),
      robloxSettingsUpdatedAt: data.robloxSettingsUpdatedAt ?? 0,
      medications: data.medications ?? [],
      medicationUpdatedAt: data.medicationUpdatedAt ?? 0,
      moneyBankRub: data.moneyBankRub ?? 0,
      banksUpdatedAt: data.banksUpdatedAt ?? 0,
      claimedStickerMoneyIds: data.claimedStickerMoneyIds ?? [],
      dismissedGiftStickerIds: data.dismissedGiftStickerIds ?? [],
      equippedStickerId: data.equippedStickerId ?? null,
      bestStreak: data.bestStreak ?? 0,
      bestParentTasks: data.bestParentTasks ?? 0,
      readingBooks: data.readingBooks ?? [],
      finishedBooks: data.finishedBooks ?? [],
      studioSprintStates: data.studioSprintStates ?? {},
      puzzleCount: data.puzzleCount ?? 0,
      legoCount: data.legoCount ?? 0,
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
        const banksChanged =
          normalizeNonNegInt(next.robloxBonusBankMin) !==
            normalizeNonNegInt(prev.robloxBonusBankMin) ||
          normalizeNonNegInt(next.moneyBankRub) !==
            normalizeNonNegInt(prev.moneyBankRub)
        const robloxSettingsChanged =
          isRobloxEnabled(next) !== isRobloxEnabled(prev) ||
          normalizeRobloxLimitMin(next.robloxLimitMin) !==
            normalizeRobloxLimitMin(prev.robloxLimitMin)
        let withMeta = banksChanged
          ? { ...next, banksUpdatedAt: Date.now() }
          : next
        if (
          robloxSettingsChanged &&
          normalizeNonNegInt(withMeta.robloxSettingsUpdatedAt) ===
            normalizeNonNegInt(prev.robloxSettingsUpdatedAt)
        ) {
          withMeta = { ...withMeta, robloxSettingsUpdatedAt: Date.now() }
        }
        const medsNext = resolveMedications(withMeta.medications, undefined)
        const medsPrev = resolveMedications(prev.medications, undefined)
        if (
          medicationsSignature(medsNext) !== medicationsSignature(medsPrev) &&
          normalizeNonNegInt(withMeta.medicationUpdatedAt) ===
            normalizeNonNegInt(prev.medicationUpdatedAt)
        ) {
          withMeta = {
            ...withMeta,
            medications: medsNext,
            medicationUpdatedAt: Date.now(),
          }
        }
        const normalized = hydrateAppData(withMeta)
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
