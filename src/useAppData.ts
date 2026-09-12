import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ROUTINE_ID,
  defaultAppData,
  isRobloxEnabled,
  migrateLegacyMedicationName,
  normalizeElectives,
  normalizeMedications,
  normalizeRobloxLimitMin,
  mergeChewEntries,
  mergeDaysMaps,
  mergeExerciseControls,
  mergeExercises,
  mergeSchoolGrades,
  mergeWeeklyGradeWeeks,
  normalizeExerciseControls,
  normalizeSchoolGrades,
  normalizeWeeklyGradeWeeks,
  normalizeDateKeys,
  resolveExercises,
  schoolDayPlanFromData,
  todayKey,
} from './data'
import {
  createFamily,
  fetchFamilyData,
  joinFamily,
  leaveFamily,
  loadFamilyCode,
  pushFamilyData,
  subscribeFamily,
  ensureAuth,
  unregisterDeviceToken,
  wakeFamilyConnection,
  type CloudPayload,
  type FamilyStatus,
} from './familySync'
import { isFirebaseConfigured } from './firebase'
import {
  ROBLOX_STREAK_REWARDS,
  applyPendingRobloxStreakRewards,
  applyPendingStickerMoneyRewards,
  applyPendingStickerRobloxRewards,
  applyPendingWeeklyGradeSettlements,
  countParentTasksDone,
  currentStreak,
  normalizeFinishedBooks,
  pruneUnearnedBookGiftIds,
  reconcileReadingBooks,
  resolveReadingBooks,
  resolveLegoCount,
  resolvePuzzleCount,
  resolveRobloxBonusEarnedMin,
  seedClaimedStickerMoneyIds,
  seedClaimedStickerRobloxIds,
  seedDismissedGiftStickerIds,
} from './progress'
import type {
  AppData,
  ChewEntry,
  DayLog,
  FinishedBook,
  ReadingBook,
  SchoolGrade,
  WeeklyGradeWeek,
} from './types'

const STORAGE_KEY = 'vacation-planner-v2'
const PENDING_SYNC_KEY = 'vacation-planner-pending-sync'
const PUSH_DEBOUNCE_MS = 400
const PUSH_RETRY_MS = 2500
const BACKGROUND_SYNC_MS = 25_000

type StoredData = {
  days?: Record<string, DayLog>
  chewEntries?: ChewEntry[]
  schoolGrades?: SchoolGrade[]
  deletedSchoolGradeIds?: string[]
  weeklyGradeWeeks?: WeeklyGradeWeek[]
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
  electives?: unknown
  electivesUpdatedAt?: number
  moneyBankRub?: number
  banksUpdatedAt?: number
  claimedStickerMoneyIds?: string[]
  claimedStickerRobloxIds?: string[]
  dismissedGiftStickerIds?: string[]
  equippedStickerId?: string | null
  bestStreak?: number
  bestParentTasks?: number
  /** @deprecated use readingBooks */
  currentBook?: string
  readingBooks?: ReadingBook[]
  finishedBooks?: FinishedBook[]
  puzzleCount?: number
  legoCount?: number
  extraBreakDates?: string[]
  extraSchoolDates?: string[]
  schoolCalendarUpdatedAt?: number
  exercises?: unknown
  exerciseControls?: unknown
}

function loadPendingSync(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === '1'
  } catch {
    return false
  }
}

function savePendingSync(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_SYNC_KEY, '1')
    else localStorage.removeItem(PENDING_SYNC_KEY)
  } catch {
    /* ignore */
  }
}

function toStoredData(data: AppData): StoredData {
  return {
    days: data.days,
    chewEntries: data.chewEntries,
    schoolGrades: data.schoolGrades ?? [],
    deletedSchoolGradeIds: data.deletedSchoolGradeIds ?? [],
    weeklyGradeWeeks: data.weeklyGradeWeeks ?? [],
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
    electives: data.electives ?? [],
    electivesUpdatedAt: data.electivesUpdatedAt ?? 0,
    moneyBankRub: data.moneyBankRub ?? 0,
    banksUpdatedAt: data.banksUpdatedAt ?? 0,
    claimedStickerMoneyIds: data.claimedStickerMoneyIds ?? [],
    claimedStickerRobloxIds: data.claimedStickerRobloxIds ?? [],
    dismissedGiftStickerIds: data.dismissedGiftStickerIds ?? [],
    equippedStickerId: data.equippedStickerId ?? null,
    bestStreak: data.bestStreak ?? 0,
    bestParentTasks: data.bestParentTasks ?? 0,
    readingBooks: data.readingBooks ?? [],
    finishedBooks: data.finishedBooks ?? [],
    puzzleCount: data.puzzleCount ?? 0,
    legoCount: data.legoCount ?? 0,
    extraBreakDates: data.extraBreakDates ?? [],
    extraSchoolDates: data.extraSchoolDates ?? [],
    schoolCalendarUpdatedAt: data.schoolCalendarUpdatedAt ?? 0,
  }
}

function persistLocal(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredData(data)))
  } catch {
    /* quota / private mode */
  }
}

/** True when this device has chew/checklist progress the cloud snapshot lacks. */
function localAheadOfRemote(local: AppData, remote: CloudPayload): boolean {
  const remoteChew = new Set((remote.chewEntries ?? []).map((e) => e.id))
  for (const entry of local.chewEntries ?? []) {
    if (!remoteChew.has(entry.id)) return true
  }
  const remoteGrades = new Set((remote.schoolGrades ?? []).map((e) => e.id))
  for (const grade of local.schoolGrades ?? []) {
    if (!remoteGrades.has(grade.id)) return true
  }
  const remoteWeeks = new Map(
    (remote.weeklyGradeWeeks ?? []).map((w) => [w.weekEnd, w]),
  )
  for (const week of local.weeklyGradeWeeks ?? []) {
    const remoteWeek = remoteWeeks.get(week.weekEnd)
    if (!remoteWeek) return true
    if (week.updatedAt > (remoteWeek.updatedAt ?? 0)) return true
    if (week.settledAt && !remoteWeek.settledAt) return true
  }
  if (
    (local.schoolCalendarUpdatedAt ?? 0) >
    (remote.schoolCalendarUpdatedAt ?? 0)
  ) {
    return true
  }
  if (
    normalizeNonNegInt(local.banksUpdatedAt) >
    normalizeNonNegInt(remote.banksUpdatedAt ?? remote.updatedAt)
  ) {
    return true
  }
  if (
    normalizeNonNegInt(local.robloxSettingsUpdatedAt) >
    normalizeNonNegInt(remote.robloxSettingsUpdatedAt)
  ) {
    return true
  }
  if (
    normalizeNonNegInt(local.medicationUpdatedAt) >
    normalizeNonNegInt(remote.medicationUpdatedAt)
  ) {
    return true
  }
  if (
    normalizeNonNegInt(local.electivesUpdatedAt) >
    normalizeNonNegInt(remote.electivesUpdatedAt)
  ) {
    return true
  }
  for (const [date, day] of Object.entries(local.days ?? {})) {
    const remoteDay = remote.days?.[date]
    const flags = day.mustDo ?? {}
    if (!remoteDay) {
      if (Object.values(flags).some(Boolean)) return true
      continue
    }
    for (const [id, done] of Object.entries(flags)) {
      if (done && !remoteDay.mustDo?.[id as keyof typeof remoteDay.mustDo]) {
        return true
      }
    }
  }
  return false
}

function chewEntriesChanged(prev: AppData, next: AppData): boolean {
  const a = prev.chewEntries ?? []
  const b = next.chewEntries ?? []
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return true
  }
  return false
}

function weeklyGradesChanged(prev: AppData, next: AppData): boolean {
  const a = prev.weeklyGradeWeeks ?? []
  const b = next.weeklyGradeWeeks ?? []
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return true
  }
  return false
}

function schoolGradesChanged(prev: AppData, next: AppData): boolean {
  const a = prev.schoolGrades ?? []
  const b = next.schoolGrades ?? []
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return true
  }
  const da = prev.deletedSchoolGradeIds ?? []
  const db = next.deletedSchoolGradeIds ?? []
  if (da.length !== db.length) return true
  return da.join() !== db.join()
}

function schoolCalendarChanged(prev: AppData, next: AppData): boolean {
  return (
    (prev.schoolCalendarUpdatedAt ?? 0) !==
      (next.schoolCalendarUpdatedAt ?? 0) ||
    (prev.extraBreakDates ?? []).join() !==
      (next.extraBreakDates ?? []).join() ||
    (prev.extraSchoolDates ?? []).join() !== (next.extraSchoolDates ?? []).join()
  )
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

function electivesSignature(
  list: ReturnType<typeof normalizeElectives>,
): string {
  return JSON.stringify(
    list.map((e) => ({
      id: e.id,
      title: e.title,
      time: e.time,
      weekdays: [...e.weekdays],
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
  const finishedBooks = normalizeFinishedBooks(partial.finishedBooks)
  const readingBooks = reconcileReadingBooks(
    resolveReadingBooks(partial.readingBooks, partial.currentBook),
    finishedBooks,
  )
  const school = mergeSchoolGrades(
    normalizeSchoolGrades(partial.schoolGrades),
    [],
    normalizeStringIds(partial.deletedSchoolGradeIds),
    [],
  )
  return applyPendingWeeklyGradeSettlements(
  applyPendingStickerMoneyRewards(
    applyPendingStickerRobloxRewards(
    applyPendingRobloxStreakRewards({
      ...base,
      ...partial,
      exercises: resolveExercises(partial.exercises ?? base.exercises),
      days,
      chewEntries: partial.chewEntries ?? [],
      schoolGrades: school.grades,
      deletedSchoolGradeIds: school.deletedIds,
      weeklyGradeWeeks: mergeWeeklyGradeWeeks(
        normalizeWeeklyGradeWeeks(partial.weeklyGradeWeeks),
        [],
      ),
      extraBreakDates: normalizeDateKeys(partial.extraBreakDates),
      extraSchoolDates: normalizeDateKeys(partial.extraSchoolDates),
      schoolCalendarUpdatedAt: normalizeNonNegInt(
        partial.schoolCalendarUpdatedAt,
      ),
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
      claimedStickerRobloxIds: normalizeStringIds(
        partial.claimedStickerRobloxIds,
      ),
      dismissedGiftStickerIds: pruneUnearnedBookGiftIds(
        normalizeStringIds(partial.dismissedGiftStickerIds),
        finishedBooks.length,
      ),
      equippedStickerId: normalizeEquippedStickerId(partial.equippedStickerId),
      bestStreak:
        typeof partial.bestStreak === 'number' && Number.isFinite(partial.bestStreak)
          ? Math.max(0, Math.floor(partial.bestStreak))
          : 0,
      bestParentTasks,
      readingBooks,
      finishedBooks,
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
      electives: normalizeElectives(partial.electives),
      electivesUpdatedAt: normalizeNonNegInt(partial.electivesUpdatedAt),
    }),
    ),
  ),
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
    const extraBreakDates = normalizeDateKeys(parsed.extraBreakDates)
    const extraSchoolDates = normalizeDateKeys(parsed.extraSchoolDates)
    const plan = schoolDayPlanFromData({ extraBreakDates, extraSchoolDates })
    const streak = currentStreak(days, todayKey(), plan)
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
    const claimedStickerRobloxIds = Array.isArray(
      parsed.claimedStickerRobloxIds,
    )
      ? normalizeStringIds(parsed.claimedStickerRobloxIds)
      : seedClaimedStickerRobloxIds({
          ...defaultAppData(),
          days,
          chewEntries,
          schoolGrades: normalizeSchoolGrades(parsed.schoolGrades),
          finishedBooks,
          readingBooks,
          bestParentTasks,
          bestStreak,
        })
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
      schoolGrades: parsed.schoolGrades,
      deletedSchoolGradeIds: parsed.deletedSchoolGradeIds,
      weeklyGradeWeeks: parsed.weeklyGradeWeeks,
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
      claimedStickerRobloxIds,
      dismissedGiftStickerIds,
      equippedStickerId: normalizeEquippedStickerId(parsed.equippedStickerId),
      bestStreak,
      bestParentTasks,
      readingBooks,
      finishedBooks,
      puzzleCount: normalizeNonNegInt(parsed.puzzleCount),
      legoCount: normalizeNonNegInt(parsed.legoCount),
      extraBreakDates,
      extraSchoolDates,
      schoolCalendarUpdatedAt: normalizeNonNegInt(
        parsed.schoolCalendarUpdatedAt,
      ),
      electives: parsed.electives as AppData['electives'] | undefined,
      electivesUpdatedAt: parsed.electivesUpdatedAt,
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

function resolveClaimedStickerRobloxIds(
  raw: unknown,
  seedFrom: Partial<AppData>,
): string[] {
  if (!Array.isArray(raw)) {
    return seedClaimedStickerRobloxIds({
      ...defaultAppData(),
      ...seedFrom,
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
  const remoteCalAt = normalizeNonNegInt(payload.schoolCalendarUpdatedAt)
  const localCalAt = normalizeNonNegInt(prev.schoolCalendarUpdatedAt)
  let extraBreakDates: string[]
  let extraSchoolDates: string[]
  let schoolCalendarUpdatedAt: number
  if (remoteCalAt === 0 && localCalAt === 0) {
    extraBreakDates = normalizeDateKeys([
      ...(prev.extraBreakDates ?? []),
      ...(payload.extraBreakDates ?? []),
    ])
    extraSchoolDates = normalizeDateKeys([
      ...(prev.extraSchoolDates ?? []),
      ...(payload.extraSchoolDates ?? []),
    ])
    schoolCalendarUpdatedAt = 0
  } else if (remoteCalAt >= localCalAt) {
    extraBreakDates = normalizeDateKeys(payload.extraBreakDates)
    extraSchoolDates = normalizeDateKeys(payload.extraSchoolDates)
    schoolCalendarUpdatedAt = remoteCalAt
  } else {
    extraBreakDates = normalizeDateKeys(prev.extraBreakDates)
    extraSchoolDates = normalizeDateKeys(prev.extraSchoolDates)
    schoolCalendarUpdatedAt = localCalAt
  }
  const plan = schoolDayPlanFromData({ extraBreakDates, extraSchoolDates })
  const days = mergeDaysMaps(prev.days ?? {}, payload.days ?? {}, plan)
  const streak = currentStreak(days, todayKey(), plan)
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
  const school = mergeSchoolGrades(
    prev.schoolGrades ?? [],
    payload.schoolGrades ?? [],
    prev.deletedSchoolGradeIds ?? [],
    payload.deletedSchoolGradeIds ?? [],
  )
  const weeklyGradeWeeks = mergeWeeklyGradeWeeks(
    prev.weeklyGradeWeeks ?? [],
    payload.weeklyGradeWeeks ?? [],
  )
  const remoteClaimedRoblox = resolveClaimedStickerRobloxIds(
    payload.claimedStickerRobloxIds,
    {
      days,
      chewEntries,
      schoolGrades: school.grades,
      finishedBooks,
      readingBooks,
      bestParentTasks,
      bestStreak,
    },
  )
  const claimedRoblox = new Set([
    ...(prev.claimedStickerRobloxIds ?? []),
    ...remoteClaimedRoblox,
  ])
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
  const remoteElectivesAt = normalizeNonNegInt(payload.electivesUpdatedAt)
  const localElectivesAt = normalizeNonNegInt(prev.electivesUpdatedAt)
  const preferRemoteElectives = remoteElectivesAt >= localElectivesAt
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
    schoolGrades: school.grades,
    deletedSchoolGradeIds: school.deletedIds,
    weeklyGradeWeeks,
    extraBreakDates,
    extraSchoolDates,
    schoolCalendarUpdatedAt,
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
    electives: preferRemoteElectives ? payload.electives : prev.electives,
    electivesUpdatedAt: Math.max(remoteElectivesAt, localElectivesAt),
    moneyBankRub: preferRemoteBanks
      ? normalizeNonNegInt(payload.moneyBankRub ?? prev.moneyBankRub)
      : normalizeNonNegInt(prev.moneyBankRub),
    banksUpdatedAt: Math.max(remoteBanksAt, localBanksAt),
    claimedStickerMoneyIds: [...claimedMoney],
    claimedStickerRobloxIds: [...claimedRoblox],
    dismissedGiftStickerIds: [...dismissedGifts],
    equippedStickerId:
      payload.equippedStickerId !== undefined
        ? normalizeEquippedStickerId(payload.equippedStickerId)
        : normalizeEquippedStickerId(prev.equippedStickerId),
    bestStreak,
    bestParentTasks,
    readingBooks,
    finishedBooks,
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
  return normalizeFinishedBooks([...local, ...remote])
}

function mergeReadingBooks(
  local: ReadingBook[],
  remote: ReadingBook[],
  finished: FinishedBook[],
): ReadingBook[] {
  return reconcileReadingBooks([...local, ...remote], finished)
}

/** Replace local state with cloud on family join (no merge with previous family). */
function replaceFromCloud(payload: CloudPayload): AppData {
  const days = payload.days ?? {}
  const extraBreakDates = normalizeDateKeys(payload.extraBreakDates)
  const extraSchoolDates = normalizeDateKeys(payload.extraSchoolDates)
  const plan = schoolDayPlanFromData({ extraBreakDates, extraSchoolDates })
  const streak = currentStreak(days, todayKey(), plan)
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
    schoolGrades: payload.schoolGrades,
    deletedSchoolGradeIds: payload.deletedSchoolGradeIds,
    weeklyGradeWeeks: payload.weeklyGradeWeeks,
    extraBreakDates,
    extraSchoolDates,
    schoolCalendarUpdatedAt: normalizeNonNegInt(
      payload.schoolCalendarUpdatedAt,
    ),
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
    electives: payload.electives,
    electivesUpdatedAt: normalizeNonNegInt(payload.electivesUpdatedAt),
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
    claimedStickerRobloxIds: resolveClaimedStickerRobloxIds(
      payload.claimedStickerRobloxIds,
      {
        days,
        chewEntries,
        schoolGrades: normalizeSchoolGrades(payload.schoolGrades),
        finishedBooks,
        readingBooks,
        bestParentTasks,
        bestStreak,
      },
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
  const retryTimer = useRef<number | null>(null)
  const lastRemoteAt = useRef(0)
  const pendingPushRef = useRef<AppData | null>(null)
  const pushInFlightRef = useRef(false)
  const pushAgainRef = useRef(false)
  const pullInFlightRef = useRef(false)
  const lastPullAt = useRef(0)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    persistLocal(data)
  }, [data])

  const clearPushTimers = useCallback(() => {
    if (pushTimer.current) {
      window.clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    if (retryTimer.current) {
      window.clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }, [])

  const flushPush = useCallback(async (mode: 'debounce' | 'flush' | 'retry') => {
    const code = loadFamilyCode()
    if (!code || !isFirebaseConfigured()) return

    const skipWait = skipPushUntil.current - Date.now()
    // Going to background must not wait — the WebView may be killed next.
    if (skipWait > 0 && mode !== 'flush') {
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(() => {
        void flushPush('debounce')
      }, skipWait + 30)
      return
    }

    if (pushInFlightRef.current) {
      pushAgainRef.current = true
      return
    }

    const next = pendingPushRef.current ?? (loadPendingSync() ? dataRef.current : null)
    if (!next) return

    pushInFlightRef.current = true
    let ok = false
    setFamily((f) => ({ ...f, syncing: true, error: null }))
    try {
      const updatedAt = await pushFamilyData(code, next)
      lastRemoteAt.current = updatedAt
      if (pendingPushRef.current === next) {
        pendingPushRef.current = null
        savePendingSync(false)
      } else if (pendingPushRef.current == null) {
        savePendingSync(false)
      }
      ok = true
      setFamily((f) => ({
        ...f,
        syncing: false,
        connected: true,
        lastSyncedAt: updatedAt,
        error: null,
      }))
    } catch (err) {
      savePendingSync(true)
      const message =
        err instanceof Error ? err.message : 'Не удалось сохранить в облако'
      setFamily((f) => ({ ...f, syncing: false, error: message }))
      if (retryTimer.current) window.clearTimeout(retryTimer.current)
      retryTimer.current = window.setTimeout(() => {
        void flushPush('retry')
      }, PUSH_RETRY_MS)
    } finally {
      pushInFlightRef.current = false
    }
    if (ok && (pushAgainRef.current || pendingPushRef.current)) {
      pushAgainRef.current = false
      if (pendingPushRef.current) void flushPush('retry')
    }
  }, [])

  const schedulePush = useCallback(
    (next: AppData, delayMs = PUSH_DEBOUNCE_MS) => {
      const code = loadFamilyCode()
      if (!code || !isFirebaseConfigured()) return
      pendingPushRef.current = next
      savePendingSync(true)
      persistLocal(next)
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      if (delayMs <= 0) {
        void flushPush('flush')
        return
      }
      pushTimer.current = window.setTimeout(() => {
        void flushPush('debounce')
      }, delayMs)
    },
    [flushPush],
  )

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
        const electivesNext = normalizeElectives(withMeta.electives)
        const electivesPrev = normalizeElectives(prev.electives)
        if (
          electivesSignature(electivesNext) !==
            electivesSignature(electivesPrev) &&
          normalizeNonNegInt(withMeta.electivesUpdatedAt) ===
            normalizeNonNegInt(prev.electivesUpdatedAt)
        ) {
          withMeta = {
            ...withMeta,
            electives: electivesNext,
            electivesUpdatedAt: Date.now(),
          }
        }
        const normalized = hydrateAppData(withMeta)
        dataRef.current = normalized
        persistLocal(normalized)
        schedulePush(
          normalized,
          chewEntriesChanged(prev, normalized) ||
            schoolGradesChanged(prev, normalized) ||
            weeklyGradesChanged(prev, normalized) ||
            schoolCalendarChanged(prev, normalized)
            ? 0
            : PUSH_DEBOUNCE_MS,
        )
        return normalized
      })
    },
    [schedulePush],
  )

  const ingestRemote = useCallback(
    (
      payload: CloudPayload,
      options?: { force?: boolean; fromCache?: boolean },
    ) => {
      const remoteAt = payload.updatedAt || 0
      const isEcho = remoteAt > 0 && remoteAt === lastRemoteAt.current
      const isStaleCache =
        Boolean(options?.fromCache) &&
        remoteAt > 0 &&
        remoteAt < lastRemoteAt.current
      if (!options?.force && (isEcho || isStaleCache)) {
        setFamily((f) => ({
          ...f,
          connected: true,
          syncing: false,
          lastSyncedAt: remoteAt || f.lastSyncedAt,
          error: null,
        }))
        return
      }
      lastRemoteAt.current = Math.max(lastRemoteAt.current, remoteAt)
      const rawBooks = payload.finishedBooks
      const collapsedDuplicateBooks =
        Array.isArray(rawBooks) &&
        rawBooks.length > normalizeFinishedBooks(rawBooks).length
      skipPushUntil.current = collapsedDuplicateBooks
        ? 0
        : Date.now() + 1200
      setData((prev) => {
        const next = applyCloud(prev, payload)
        dataRef.current = next
        persistLocal(next)
        const shouldUpload =
          collapsedDuplicateBooks ||
          loadPendingSync() ||
          pendingPushRef.current != null ||
          localAheadOfRemote(next, payload)
        if (shouldUpload) {
          pendingPushRef.current = next
          savePendingSync(true)
          schedulePush(next, 0)
        }
        return next
      })
      setFamily((f) => ({
        ...f,
        connected: true,
        syncing: false,
        lastSyncedAt: remoteAt || f.lastSyncedAt,
        error: null,
      }))
    },
    [schedulePush],
  )

  const pullAndApply = useCallback(async (reason: 'start' | 'resume' = 'resume') => {
    const code = loadFamilyCode()
    if (!code || !isFirebaseConfigured()) return
    if (pullInFlightRef.current) return
    if (reason !== 'start' && Date.now() - lastPullAt.current < 800) return
    pullInFlightRef.current = true
    lastPullAt.current = Date.now()
    setFamily((f) => ({ ...f, syncing: true, error: null }))
    try {
      await wakeFamilyConnection()
      await ensureAuth()
      const payload = await fetchFamilyData(code)
      if (payload) ingestRemote(payload, { force: true })
      else setFamily((f) => ({ ...f, syncing: false }))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ошибка синхронизации'
      setFamily((f) => ({
        ...f,
        syncing: false,
        error: message,
      }))
    } finally {
      pullInFlightRef.current = false
    }
  }, [ingestRemote])

  useEffect(() => {
    if (!isFirebaseConfigured()) return
    const code = loadFamilyCode()
    if (!code) return

    setFamily((f) => ({ ...f, code, syncing: true, error: null }))
    let unsub = () => {}
    let cancelled = false

    ;(async () => {
      try {
        await ensureAuth()
        if (cancelled) return
        // Pull cloud first, then merge+upload. Pushing local-before-listen
        // used to overwrite the child's newer day with a stale parent copy.
        await pullAndApply('start')
        if (cancelled) return
        unsub = subscribeFamily(
          code,
          (payload, meta) => {
            ingestRemote(payload, { fromCache: meta.fromCache })
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
      cancelled = true
      unsub()
    }
  }, [family.code, ingestRemote, pullAndApply])

  useEffect(() => {
    let backgroundTick: number | null = null
    const stopBackgroundTick = () => {
      if (backgroundTick == null) return
      window.clearInterval(backgroundTick)
      backgroundTick = null
    }
    const startBackgroundTick = () => {
      if (backgroundTick != null) return
      backgroundTick = window.setInterval(() => {
        void pullAndApply('resume')
        if (pendingPushRef.current || loadPendingSync()) {
          void flushPush('retry')
        }
      }, BACKGROUND_SYNC_MS)
    }
    const onFlush = () => {
      if (!pendingPushRef.current && !loadPendingSync()) return
      clearPushTimers()
      void flushPush('flush')
    }
    const onVisible = () => {
      stopBackgroundTick()
      void pullAndApply('resume')
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onFlush()
        startBackgroundTick()
        return
      }
      onVisible()
    }
    const onOnline = () => {
      void pullAndApply('resume')
    }
    if (document.visibilityState === 'hidden') startBackgroundTick()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('pagehide', onFlush)
    window.addEventListener('online', onOnline)
    document.addEventListener('freeze', onFlush)
    return () => {
      stopBackgroundTick()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('pagehide', onFlush)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('freeze', onFlush)
    }
  }, [flushPush, clearPushTimers, pullAndApply])

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
      pendingPushRef.current = null
      savePendingSync(false)
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
      pendingPushRef.current = null
      savePendingSync(false)
      clearPushTimers()
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
  }, [clearPushTimers])

  const leaveFamilyCloud = useCallback(() => {
    const code = loadFamilyCode()
    void unregisterDeviceToken(code)
    leaveFamily()
    pendingPushRef.current = null
    savePendingSync(false)
    clearPushTimers()
    setFamily({
      code: null,
      connected: false,
      syncing: false,
      error: null,
      lastSyncedAt: null,
    })
  }, [clearPushTimers])

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
