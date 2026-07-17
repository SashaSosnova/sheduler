import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type {
  AppData,
  ChewEntry,
  DayLog,
  FinishedBook,
  ReadingBook,
} from './types'
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase'

const FAMILY_KEY = 'vacation-family-code'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type CloudPayload = {
  days: Record<string, DayLog>
  chewEntries: ChewEntry[]
  cookingLeft: number
  claimedRobloxStreaks?: number[]
  bestStreak?: number
  bestParentTasks?: number
  /** @deprecated use readingBooks */
  currentBook?: string
  readingBooks?: ReadingBook[]
  finishedBooks?: FinishedBook[]
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

export function toCloudPayload(data: AppData, updatedAt = Date.now()): CloudPayload {
  return {
    days: data.days,
    chewEntries: data.chewEntries ?? [],
    cookingLeft: data.cookingLeft,
    claimedRobloxStreaks: data.claimedRobloxStreaks ?? [],
    bestStreak: data.bestStreak ?? 0,
    bestParentTasks: data.bestParentTasks ?? 0,
    readingBooks: data.readingBooks ?? [],
    finishedBooks: data.finishedBooks ?? [],
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
    cookingLeft: remote.cookingLeft ?? 5,
    claimedRobloxStreaks: remote.claimedRobloxStreaks ?? [],
    bestStreak: remote.bestStreak ?? 0,
    bestParentTasks: remote.bestParentTasks ?? 0,
    readingBooks: remote.readingBooks,
    currentBook: remote.currentBook,
    finishedBooks: remote.finishedBooks ?? [],
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
        cookingLeft: remote.cookingLeft ?? 5,
        claimedRobloxStreaks: remote.claimedRobloxStreaks ?? [],
        bestStreak: remote.bestStreak ?? 0,
        bestParentTasks: remote.bestParentTasks ?? 0,
        readingBooks: remote.readingBooks,
        currentBook: remote.currentBook,
        finishedBooks: remote.finishedBooks ?? [],
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
