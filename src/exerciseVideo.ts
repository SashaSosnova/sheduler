import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { todayKey } from './data'

export type ExerciseVideoClip = {
  id: string
  exerciseId: string
  exerciseName: string
  /** YYYY-MM-DD */
  date: string
  fileName: string
  mimeType: string
  /** Kept for web / fallback when Cache write is unavailable */
  blob: Blob
}

type SessionStore = {
  date: string
  clips: ExerciseVideoClip[]
}

let session: SessionStore = { date: '', clips: [] }

function ensureTodaySession(): SessionStore {
  const date = todayKey()
  if (session.date !== date) {
    session = { date, clips: [] }
  }
  return session
}

export function getExerciseVideoClips(date = todayKey()): ExerciseVideoClip[] {
  const store = ensureTodaySession()
  if (store.date !== date) return []
  return store.clips.slice()
}

export function getExerciseVideoClipsForExercises(
  exerciseIds: string[],
  date = todayKey(),
): ExerciseVideoClip[] {
  const idSet = new Set(exerciseIds)
  return getExerciseVideoClips(date).filter((c) => idSet.has(c.exerciseId))
}

export function removeExerciseVideoClips(
  clipIds: string[],
  date = todayKey(),
) {
  const store = ensureTodaySession()
  if (store.date !== date) return
  const remove = new Set(clipIds)
  store.clips = store.clips.filter((c) => !remove.has(c.id))
}

export function clearExerciseVideoClips(date = todayKey()) {
  if (session.date === date) {
    session = { date, clips: [] }
  }
}

const RECORDER_MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const mime of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

export function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  return 'video'
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'exercise'
}

/** Persist a finished clip for later share (survives tab switches in-session). */
export async function saveExerciseVideoClip(input: {
  exerciseId: string
  exerciseName: string
  blob: Blob
}): Promise<ExerciseVideoClip> {
  const store = ensureTodaySession()
  const mimeType = input.blob.type || 'video/webm'
  const ext = extensionForMime(mimeType)
  const fileName = `control-${slugifyName(input.exerciseName)}-${Date.now()}.${ext}`

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(input.blob)
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
  }

  const clip: ExerciseVideoClip = {
    id: `${input.exerciseId}-${Date.now()}`,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    date: store.date,
    fileName,
    mimeType,
    blob: input.blob,
  }

  store.clips = [
    ...store.clips.filter((c) => c.exerciseId !== input.exerciseId),
    clip,
  ]
  return clip
}

async function shareNativeClips(
  clips: ExerciseVideoClip[],
): Promise<'shared' | 'cancelled'> {
  const uris: string[] = []
  /** Temp copies for the share sheet — session clip files stay intact. */
  const tempNames: string[] = []

  try {
    for (const clip of clips) {
      const base64 = await blobToBase64(clip.blob)
      const tempName = `share-tmp-${Date.now()}-${clip.fileName}`
      const written = await Filesystem.writeFile({
        path: tempName,
        data: base64,
        directory: Directory.Cache,
      })
      uris.push(written.uri)
      tempNames.push(tempName)
    }

    await Share.share({
      title: 'Видео контроля зарядки',
      files: uris,
      dialogTitle: 'Отправить видео',
    })
    // Android often resolves even on dismiss — caller must not delete clips.
    return 'shared'
  } catch (err) {
    if (err instanceof Error && /cancel|abort/i.test(err.message)) {
      return 'cancelled'
    }
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
    if (/cancel|abort/i.test(message)) return 'cancelled'
    throw err
  } finally {
    for (const name of tempNames) {
      try {
        await Filesystem.deleteFile({
          path: name,
          directory: Directory.Cache,
        })
      } catch {
        /* ignore */
      }
    }
  }
}

async function shareWebClips(
  clips: ExerciseVideoClip[],
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = clips.map(
    (clip, i) =>
      new File([clip.blob], clip.fileName || `control-${i + 1}.webm`, {
        type: clip.mimeType || 'video/webm',
      }),
  )

  const canShareFiles =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })

  if (canShareFiles) {
    try {
      await navigator.share({
        files,
        title: 'Видео контроля зарядки',
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
      throw err instanceof Error
        ? err
        : new Error('Не удалось открыть окно отправки')
    }
  }

  // No Web Share API — offer download without treating it as "sent & done"
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  return 'downloaded'
}

export async function shareExerciseVideos(
  clips = getExerciseVideoClips(),
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (clips.length === 0) {
    throw new Error('Нет записанных видео')
  }

  if (Capacitor.isNativePlatform()) {
    return shareNativeClips(clips)
  }
  return shareWebClips(clips)
}

export async function openFrontCamera(
  opts: { audio?: boolean; timeoutMs?: number } = {},
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Камера недоступна на этом устройстве')
  }

  const audio = opts.audio === true
  const timeoutMs = opts.timeoutMs ?? 8000

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: 'user' }, audio },
    { video: true, audio },
  ]

  let lastError: unknown = null

  for (const constraints of attempts) {
    let settled = false
    let timer: number | undefined
    const mediaPromise = navigator.mediaDevices.getUserMedia(constraints)

    // Drop a late grant if we already moved on (timeout / next attempt).
    void mediaPromise.then(
      (stream) => {
        if (settled) stopMediaStream(stream)
      },
      () => {
        /* ignore */
      },
    )

    try {
      const stream = await Promise.race([
        mediaPromise,
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            reject(new Error('Камера не ответила — проверь разрешение'))
          }, timeoutMs)
        }),
      ])
      settled = true
      if (timer != null) window.clearTimeout(timer)
      return stream
    } catch (err) {
      if (timer != null) window.clearTimeout(timer)
      lastError = err
      // Leave settled=false so a late grant is stopped by the then() above.
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error('Не удалось открыть камеру')
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  }
}
