import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  DEFAULT_ROBLOX_LIMIT_MIN,
  mergeChewEntries,
  mergeDaysMaps,
  mergeExerciseControls,
  mergeExercises,
  mergeSchoolGrades,
  mergeWeeklyGradeWeeks,
  normalizeDateKeys,
  normalizeExerciseControls,
  resolveExercises,
  schoolDayPlanFromData,
} from './data'
import {
  normalizeFinishedBooks,
  reconcileReadingBooks,
  resolveReadingBooks,
} from './progress'
import type {
  AppData,
  ChewEntry,
  DayLog,
  Exercise,
  ExerciseControl,
  FinishedBook,
  ReadingBook,
  SchoolGrade,
  UserRole,
  WeeklyGradeWeek,
} from './types'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase'

const FAMILY_KEY = 'vacation-family-code'
const DEVICE_ID_KEY = 'vacation-device-id'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type CloudPayload = {
  days: Record<string, DayLog>
  chewEntries: ChewEntry[]
  schoolGrades?: SchoolGrade[]
  deletedSchoolGradeIds?: string[]
  weeklyGradeWeeks?: WeeklyGradeWeek[]
  cookingLeft: number
  exercises?: Exercise[]
  exerciseControls?: ExerciseControl[]
  claimedRobloxStreaks?: number[]
  robloxBonusBankMin?: number
  robloxBonusEarnedMin?: number
  robloxEnabled?: boolean
  robloxLimitMin?: number
  /** When parent Roblox policy last changed — pick newer side on merge */
  robloxSettingsUpdatedAt?: number
  medications?: AppData['medications']
  /** @deprecated migrated into medications */
  medicationName?: string
  medicationUpdatedAt?: number
  electives?: AppData['electives']
  electivesUpdatedAt?: number
  moneyBankRub?: number
  /** When bank balances last changed — pick newer side on merge */
  banksUpdatedAt?: number
  claimedStickerMoneyIds?: string[]
  claimedStickerRobloxIds?: string[]
  dismissedGiftStickerIds?: string[]
  equippedStickerId?: string | null
  equippedAvatarId?: string | null
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
  updatedAt: number
}

export type FamilyStatus = {
  code: string | null
  connected: boolean
  syncing: boolean
  error: string | null
  lastSyncedAt: number | null
}

function randomCode(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export function loadFamilyCode(): string | null {
  try {
    return localStorage.getItem(FAMILY_KEY)
  } catch {
    return null
  }
}

export function saveFamilyCode(code: string | null) {
  try {
    if (!code) localStorage.removeItem(FAMILY_KEY)
    else localStorage.setItem(FAMILY_KEY, code)
  } catch {
    /* ignore */
  }
}

export async function ensureAuth(): Promise<User> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) return auth.currentUser

  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        unsub()
        if (user) {
          resolve(user)
          return
        }
        try {
          const cred = await signInAnonymously(auth)
          resolve(cred.user)
        } catch (err) {
          reject(err)
        }
      },
      reject,
    )
  })
}

function familyRef(code: string) {
  return doc(getFirebaseDb(), 'families', code)
}

function deviceRef(code: string, deviceId: string) {
  return doc(getFirebaseDb(), 'families', code, 'devices', deviceId)
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return `dev-${Date.now()}`
  }
}

export async function registerDeviceToken(
  code: string,
  role: UserRole,
  token: string,
): Promise<void> {
  if (!code || !token) return
  await ensureAuth()
  await setDoc(deviceRef(code, getDeviceId()), {
    token,
    role,
    updatedAt: Date.now(),
  })
}

export async function unregisterDeviceToken(code: string | null): Promise<void> {
  if (!code) return
  try {
    await ensureAuth()
    await deleteDoc(deviceRef(code, getDeviceId()))
  } catch {
    /* offline / already gone */
  }
}

export async function updateFamilyChildName(
  code: string | null,
  name: string,
): Promise<void> {
  if (!code) return
  const trimmed = name.trim()
  await ensureAuth()
  await setDoc(
    familyRef(code),
    { childDisplayName: trimmed || 'Даня' },
    { merge: true },
  )
}

function incomingCloudPayload(remote: Partial<CloudPayload>): CloudPayload {
  return {
    days: remote.days ?? {},
    chewEntries: remote.chewEntries ?? [],
    schoolGrades: remote.schoolGrades ?? [],
    deletedSchoolGradeIds: remote.deletedSchoolGradeIds ?? [],
    weeklyGradeWeeks: remote.weeklyGradeWeeks ?? [],
    cookingLeft: remote.cookingLeft ?? 5,
    exercises: remote.exercises,
    exerciseControls: remote.exerciseControls,
    claimedRobloxStreaks: remote.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: remote.robloxBonusBankMin ?? 0,
    robloxBonusEarnedMin: remote.robloxBonusEarnedMin,
    robloxEnabled: remote.robloxEnabled,
    robloxLimitMin: remote.robloxLimitMin,
    robloxSettingsUpdatedAt: remote.robloxSettingsUpdatedAt,
    medications: remote.medications,
    medicationName: remote.medicationName,
    medicationUpdatedAt: remote.medicationUpdatedAt,
    electives: remote.electives,
    electivesUpdatedAt: remote.electivesUpdatedAt,
    moneyBankRub: remote.moneyBankRub,
    banksUpdatedAt: remote.banksUpdatedAt,
    claimedStickerMoneyIds: remote.claimedStickerMoneyIds,
    claimedStickerRobloxIds: remote.claimedStickerRobloxIds,
    dismissedGiftStickerIds: remote.dismissedGiftStickerIds,
    equippedStickerId: remote.equippedStickerId ?? null,
    equippedAvatarId: remote.equippedAvatarId ?? null,
    bestStreak: remote.bestStreak ?? 0,
    bestParentTasks: remote.bestParentTasks ?? 0,
    readingBooks: remote.readingBooks,
    currentBook: remote.currentBook,
    finishedBooks: remote.finishedBooks ?? [],
    puzzleCount: remote.puzzleCount ?? 0,
    legoCount: remote.legoCount ?? 0,
    extraBreakDates: remote.extraBreakDates ?? [],
    extraSchoolDates: remote.extraSchoolDates ?? [],
    schoolCalendarUpdatedAt: remote.schoolCalendarUpdatedAt ?? 0,
    updatedAt: remote.updatedAt ?? Date.now(),
  }
}

export function toCloudPayload(data: AppData, updatedAt = Date.now()): CloudPayload {
  return {
    days: data.days,
    chewEntries: data.chewEntries ?? [],
    schoolGrades: data.schoolGrades ?? [],
    deletedSchoolGradeIds: data.deletedSchoolGradeIds ?? [],
    weeklyGradeWeeks: data.weeklyGradeWeeks ?? [],
    cookingLeft: data.cookingLeft,
    exercises: data.exercises ?? [],
    exerciseControls: data.exerciseControls ?? [],
    claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
    robloxBonusBankMin: data.robloxBonusBankMin ?? 0,
    robloxBonusEarnedMin: data.robloxBonusEarnedMin ?? 0,
    robloxEnabled: data.robloxEnabled !== false,
    robloxLimitMin: data.robloxLimitMin ?? DEFAULT_ROBLOX_LIMIT_MIN,
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
    equippedAvatarId: data.equippedAvatarId ?? null,
    bestStreak: data.bestStreak ?? 0,
    bestParentTasks: data.bestParentTasks ?? 0,
    readingBooks: data.readingBooks ?? [],
    finishedBooks: data.finishedBooks ?? [],
    puzzleCount: data.puzzleCount ?? 0,
    legoCount: data.legoCount ?? 0,
    extraBreakDates: data.extraBreakDates ?? [],
    extraSchoolDates: data.extraSchoolDates ?? [],
    schoolCalendarUpdatedAt: data.schoolCalendarUpdatedAt ?? 0,
    updatedAt,
  }
}

function stamp(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

function unionIds(a?: string[] | null, b?: string[] | null): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])].filter(Boolean))]
}

function unionStreaks(a?: number[] | null, b?: number[] | null): number[] {
  return [
    ...new Set(
      [...(a ?? []), ...(b ?? [])].filter(
        (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0,
      ),
    ),
  ].sort((x, y) => x - y)
}

function firestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Merge two cloud snapshots so a later parent upload cannot drop
 * the child's checklist / chew / grades from the family document.
 */
export function mergeCloudPayloads(
  remote: CloudPayload | null,
  local: CloudPayload,
): CloudPayload {
  if (!remote) return local

  const remoteCalAt = stamp(remote.schoolCalendarUpdatedAt)
  const localCalAt = stamp(local.schoolCalendarUpdatedAt)
  let extraBreakDates: string[]
  let extraSchoolDates: string[]
  let schoolCalendarUpdatedAt: number
  if (remoteCalAt === 0 && localCalAt === 0) {
    extraBreakDates = normalizeDateKeys([
      ...(remote.extraBreakDates ?? []),
      ...(local.extraBreakDates ?? []),
    ])
    extraSchoolDates = normalizeDateKeys([
      ...(remote.extraSchoolDates ?? []),
      ...(local.extraSchoolDates ?? []),
    ])
    schoolCalendarUpdatedAt = 0
  } else if (localCalAt > remoteCalAt) {
    extraBreakDates = normalizeDateKeys(local.extraBreakDates)
    extraSchoolDates = normalizeDateKeys(local.extraSchoolDates)
    schoolCalendarUpdatedAt = localCalAt
  } else {
    extraBreakDates = normalizeDateKeys(remote.extraBreakDates)
    extraSchoolDates = normalizeDateKeys(remote.extraSchoolDates)
    schoolCalendarUpdatedAt = remoteCalAt
  }
  const plan = schoolDayPlanFromData({ extraBreakDates, extraSchoolDates })
  const school = mergeSchoolGrades(
    local.schoolGrades ?? [],
    remote.schoolGrades ?? [],
    local.deletedSchoolGradeIds ?? [],
    remote.deletedSchoolGradeIds ?? [],
  )
  const finishedBooks = normalizeFinishedBooks([
    ...(remote.finishedBooks ?? []),
    ...(local.finishedBooks ?? []),
  ])
  const readingBooks = reconcileReadingBooks(
    [
      ...resolveReadingBooks(remote.readingBooks, remote.currentBook),
      ...resolveReadingBooks(local.readingBooks, local.currentBook),
    ],
    finishedBooks,
  )
  const remoteBanksAt = stamp(remote.banksUpdatedAt ?? remote.updatedAt)
  const localBanksAt = stamp(local.banksUpdatedAt)
  const preferLocalBanks = localBanksAt > remoteBanksAt
  const remoteRobloxAt = stamp(remote.robloxSettingsUpdatedAt)
  const localRobloxAt = stamp(local.robloxSettingsUpdatedAt)
  const preferLocalRoblox = localRobloxAt > remoteRobloxAt
  const remoteMedAt = stamp(remote.medicationUpdatedAt)
  const localMedAt = stamp(local.medicationUpdatedAt)
  const preferLocalMed = localMedAt > remoteMedAt
  const remoteElectivesAt = stamp(remote.electivesUpdatedAt)
  const localElectivesAt = stamp(local.electivesUpdatedAt)
  const preferLocalElectives = localElectivesAt > remoteElectivesAt

  return {
    days: mergeDaysMaps(remote.days ?? {}, local.days ?? {}, plan),
    chewEntries: mergeChewEntries(
      remote.chewEntries ?? [],
      local.chewEntries ?? [],
    ),
    schoolGrades: school.grades,
    deletedSchoolGradeIds: school.deletedIds,
    weeklyGradeWeeks: mergeWeeklyGradeWeeks(
      remote.weeklyGradeWeeks ?? [],
      local.weeklyGradeWeeks ?? [],
    ),
    cookingLeft: Math.min(local.cookingLeft ?? 5, remote.cookingLeft ?? 5),
    exercises: mergeExercises(
      resolveExercises(remote.exercises ?? []),
      resolveExercises(local.exercises ?? []),
    ),
    exerciseControls: mergeExerciseControls(
      normalizeExerciseControls(remote.exerciseControls),
      normalizeExerciseControls(local.exerciseControls),
    ),
    claimedRobloxStreaks: unionStreaks(
      remote.claimedRobloxStreaks,
      local.claimedRobloxStreaks,
    ),
    robloxBonusBankMin: preferLocalBanks
      ? stamp(local.robloxBonusBankMin)
      : stamp(remote.robloxBonusBankMin ?? local.robloxBonusBankMin),
    robloxBonusEarnedMin: Math.max(
      stamp(remote.robloxBonusEarnedMin),
      stamp(local.robloxBonusEarnedMin),
    ),
    robloxEnabled: preferLocalRoblox
      ? local.robloxEnabled !== false
      : remote.robloxEnabled !== false,
    robloxLimitMin: preferLocalRoblox
      ? (local.robloxLimitMin ?? DEFAULT_ROBLOX_LIMIT_MIN)
      : (remote.robloxLimitMin ?? local.robloxLimitMin ?? DEFAULT_ROBLOX_LIMIT_MIN),
    robloxSettingsUpdatedAt: Math.max(remoteRobloxAt, localRobloxAt),
    medications: preferLocalMed
      ? (local.medications ?? remote.medications)
      : (remote.medications ?? local.medications),
    medicationName: preferLocalMed
      ? local.medicationName ?? remote.medicationName
      : remote.medicationName ?? local.medicationName,
    medicationUpdatedAt: Math.max(remoteMedAt, localMedAt),
    electives: preferLocalElectives
      ? (local.electives ?? remote.electives)
      : (remote.electives ?? local.electives),
    electivesUpdatedAt: Math.max(remoteElectivesAt, localElectivesAt),
    moneyBankRub: preferLocalBanks
      ? stamp(local.moneyBankRub)
      : stamp(remote.moneyBankRub ?? local.moneyBankRub),
    banksUpdatedAt: Math.max(remoteBanksAt, localBanksAt),
    claimedStickerMoneyIds: unionIds(
      remote.claimedStickerMoneyIds,
      local.claimedStickerMoneyIds,
    ),
    claimedStickerRobloxIds: unionIds(
      remote.claimedStickerRobloxIds,
      local.claimedStickerRobloxIds,
    ),
    dismissedGiftStickerIds: unionIds(
      remote.dismissedGiftStickerIds,
      local.dismissedGiftStickerIds,
    ),
    equippedStickerId:
      local.equippedStickerId !== undefined
        ? local.equippedStickerId
        : remote.equippedStickerId ?? null,
    equippedAvatarId:
      local.equippedAvatarId !== undefined
        ? local.equippedAvatarId
        : remote.equippedAvatarId ?? null,
    bestStreak: Math.max(stamp(remote.bestStreak), stamp(local.bestStreak)),
    bestParentTasks: Math.max(
      stamp(remote.bestParentTasks),
      stamp(local.bestParentTasks),
    ),
    readingBooks,
    finishedBooks,
    puzzleCount: Math.max(stamp(remote.puzzleCount), stamp(local.puzzleCount)),
    legoCount: Math.max(stamp(remote.legoCount), stamp(local.legoCount)),
    extraBreakDates,
    extraSchoolDates,
    schoolCalendarUpdatedAt,
    updatedAt: Math.max(stamp(remote.updatedAt), stamp(local.updatedAt)),
  }
}

export async function createFamily(data: AppData): Promise<string> {
  if (!isFirebaseConfigured()) throw new Error('Firebase не настроен')
  await ensureAuth()

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const ref = familyRef(code)
    const existing = await getDoc(ref)
    if (existing.exists()) continue

    await setDoc(ref, {
      code,
      createdAt: Date.now(),
      ...toCloudPayload(data),
    })
    saveFamilyCode(code)
    return code
  }

  throw new Error('Не удалось создать код семьи, попробуй ещё раз')
}

export async function joinFamily(rawCode: string): Promise<CloudPayload> {
  if (!isFirebaseConfigured()) throw new Error('Firebase не настроен')
  const code = rawCode.trim().toUpperCase()
  if (code.length < 4) throw new Error('Введи код семьи')

  await ensureAuth()
  const snap = await fetchFamilySnap(code)
  if (!snap || !snap.exists()) throw new Error('Семья с таким кодом не найдена')

  const remote = snap.data() as CloudPayload & { code?: string }
  saveFamilyCode(code)

  // Cloud is the source of truth on join — never seed an empty family from
  // leftover local data (that would copy the previous family into this one).
  return incomingCloudPayload(remote)
}

/** Wake the Firestore listen channel after an Android WebView pause. */
export async function wakeFamilyConnection(): Promise<void> {
  const db = getFirebaseDb()
  try {
    await disableNetwork(db)
  } catch {
    /* already disabled */
  }
  try {
    await enableNetwork(db)
  } catch {
    /* already enabled / offline */
  }
}

async function fetchFamilySnap(code: string) {
  const ref = familyRef(code)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getDocFromServer(ref)
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
      }
    }
  }
  return getDoc(ref)
}

/** Fresh family doc from the server (falls back to cache if offline). */
export async function fetchFamilyData(
  code: string,
): Promise<CloudPayload | null> {
  await ensureAuth()
  const snap = await fetchFamilySnap(code)
  if (!snap.exists()) return null
  return incomingCloudPayload(snap.data() as CloudPayload)
}

export async function pushFamilyData(
  code: string,
  data: AppData,
): Promise<CloudPayload> {
  await ensureAuth()
  const db = getFirebaseDb()
  const ref = familyRef(code)
  const localPayload = toCloudPayload(data, Date.now())

  try {
    const merged = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const remote = snap.exists()
        ? incomingCloudPayload(snap.data() as CloudPayload)
        : null
      const payload: CloudPayload = {
        ...mergeCloudPayloads(remote, localPayload),
        updatedAt: Date.now(),
      }
      tx.set(
        ref,
        firestoreSafe({
          ...(snap.data() ?? {}),
          ...payload,
          code,
        }),
      )
      return payload
    })
    return merged
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : ''
    const message = err instanceof Error ? err.message : String(err)
    const offline =
      code.includes('unavailable') ||
      code.includes('offline') ||
      /offline|network|client is offline/i.test(message)
    if (!offline) throw err
    // Queue a merge-write so the child's check still leaves the device.
    const updatedAt = Date.now()
    const payload = { ...localPayload, updatedAt }
    await setDoc(
      ref,
      firestoreSafe({
        code,
        ...payload,
      }),
      { merge: true },
    )
    return payload
  }
}

export function subscribeFamily(
  code: string,
  onData: (
    payload: CloudPayload,
    meta: { fromCache: boolean; hasPendingWrites: boolean },
  ) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    familyRef(code),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        onError('Семья не найдена')
        return
      }
      onData(incomingCloudPayload(snap.data() as CloudPayload), {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      })
    },
    (err) => {
      onError(err.message || 'Ошибка синхронизации')
    },
  )
}

export function leaveFamily() {
  saveFamilyCode(null)
}
