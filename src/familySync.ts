import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { DEFAULT_ROBLOX_LIMIT_MIN } from './data'
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

export function toCloudPayload(data: AppData, updatedAt = Date.now()): CloudPayload {
  return {
    days: data.days,
    chewEntries: data.chewEntries ?? [],
    schoolGrades: data.schoolGrades ?? [],
    deletedSchoolGradeIds: data.deletedSchoolGradeIds ?? [],
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
  const snap = await getDoc(familyRef(code))
  if (!snap.exists()) throw new Error('Семья с таким кодом не найдена')

  const remote = snap.data() as CloudPayload & { code?: string }
  saveFamilyCode(code)

  // Cloud is the source of truth on join — never seed an empty family from
  // leftover local data (that would copy the previous family into this one).
  return {
    days: remote.days ?? {},
    chewEntries: remote.chewEntries ?? [],
    schoolGrades: remote.schoolGrades ?? [],
    deletedSchoolGradeIds: remote.deletedSchoolGradeIds ?? [],
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
    // Keep undefined when absent so clients can seed legacy families.
    claimedStickerMoneyIds: remote.claimedStickerMoneyIds,
    claimedStickerRobloxIds: remote.claimedStickerRobloxIds,
    dismissedGiftStickerIds: remote.dismissedGiftStickerIds,
    equippedStickerId: remote.equippedStickerId ?? null,
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

export async function pushFamilyData(code: string, data: AppData): Promise<number> {
  await ensureAuth()
  const updatedAt = Date.now()
  await setDoc(
    familyRef(code),
    {
      code,
      ...toCloudPayload(data, updatedAt),
    },
    { merge: true },
  )
  return updatedAt
}

export function subscribeFamily(
  code: string,
  onData: (payload: CloudPayload) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    familyRef(code),
    (snap) => {
      if (!snap.exists()) {
        onError('Семья не найдена')
        return
      }
      const remote = snap.data() as CloudPayload
      onData({
        days: remote.days ?? {},
        chewEntries: remote.chewEntries ?? [],
        schoolGrades: remote.schoolGrades ?? [],
        deletedSchoolGradeIds: remote.deletedSchoolGradeIds ?? [],
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
