import { useEffect, useMemo, useRef, useState } from 'react'
import { Confetti } from './Confetti'
import {
  DEBUG_UNLOCK_ALL_STICKERS,
  STICKERS,
  isStickerUnlocked,
  stickerOpenedHint,
  stickerProgressFromData,
  stickerRewardText,
  stickerUnlockTitle,
  type Sticker,
} from './progress'
import { playDing } from './sound'
import type { AppData } from './types'

const CELEBRATED_KEY = 'vacation-celebrated-stickers-v1'

type Props = {
  data: AppData
  /** Parent device should not show kid wow-screens */
  enabled?: boolean
}

function loadCelebrated(): string[] | null {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return null
  }
}

function saveCelebrated(ids: string[]) {
  try {
    localStorage.setItem(
      CELEBRATED_KEY,
      JSON.stringify([...new Set(ids)]),
    )
  } catch {
    /* ignore */
  }
}

function unlockedIds(data: AppData): string[] {
  const progress = stickerProgressFromData(data)
  return STICKERS.filter((s) => isStickerUnlocked(s, progress)).map((s) => s.id)
}

export function StickerUnlockOverlay({ data, enabled = true }: Props) {
  const [queue, setQueue] = useState<string[]>([])
  const [active, setActive] = useState<Sticker | null>(null)
  const [burst, setBurst] = useState(false)
  const seededRef = useRef(false)
  const celebratedRef = useRef<Set<string>>(new Set())

  const unlocked = useMemo(
    () => unlockedIds(data),
    [
      data.days,
      data.bestStreak,
      data.bestParentTasks,
      data.chewEntries,
      data.finishedBooks,
      data.exercises,
    ],
  )

  useEffect(() => {
    if (!enabled || DEBUG_UNLOCK_ALL_STICKERS) return

    if (!seededRef.current) {
      seededRef.current = true
      const stored = loadCelebrated()
      if (stored == null) {
        // First run after update / install: don't replay old unlocks
        celebratedRef.current = new Set(unlocked)
        saveCelebrated(unlocked)
        return
      }
      // Drop celebrations for stickers that are no longer unlocked (e.g. after
      // tightening secret conditions) so a real unlock can show the wow again.
      const stillUnlocked = new Set(unlocked)
      const kept = stored.filter((id) => stillUnlocked.has(id))
      celebratedRef.current = new Set(kept)
      if (kept.length !== stored.length) saveCelebrated(kept)
    } else {
      // Keep celebrated in sync if unlocks are revoked later in the session
      const stillUnlocked = new Set(unlocked)
      let changed = false
      for (const id of [...celebratedRef.current]) {
        if (!stillUnlocked.has(id)) {
          celebratedRef.current.delete(id)
          changed = true
        }
      }
      if (changed) saveCelebrated([...celebratedRef.current])
    }

    const pending = unlocked.filter((id) => !celebratedRef.current.has(id))
    if (pending.length === 0) return
    setQueue((prev) => {
      const merged = [...prev]
      for (const id of pending) {
        if (!merged.includes(id)) merged.push(id)
      }
      return merged
    })
  }, [unlocked, enabled])

  useEffect(() => {
    if (!enabled || active || queue.length === 0) return
    const nextId = queue[0]!
    const sticker = STICKERS.find((s) => s.id === nextId) ?? null
    if (!sticker) {
      setQueue((q) => q.slice(1))
      return
    }
    setActive(sticker)
    setBurst(true)
    playDing()
  }, [queue, active, enabled])

  function dismiss() {
    if (!active) return
    celebratedRef.current.add(active.id)
    saveCelebrated([...celebratedRef.current])
    setBurst(false)
    setActive(null)
    setQueue((q) => q.filter((id) => id !== active.id))
  }

  if (!enabled || !active) return null

  const reward = stickerRewardText(active)
  const why = stickerOpenedHint(active)

  return (
    <div className="sticker-wow" role="dialog" aria-modal="true">
      <Confetti show={burst} onDone={() => setBurst(false)} />
      <button
        type="button"
        className="sticker-wow-backdrop"
        aria-label="Закрыть"
        onClick={dismiss}
      />
      <div className="sticker-wow-card">
        <p className="sticker-wow-eyebrow">{stickerUnlockTitle(active)}</p>
        <div className="sticker-wow-art-wrap">
          <img
            className="sticker-wow-art"
            src={active.image}
            alt=""
            draggable={false}
          />
        </div>
        <h2 className="sticker-wow-title">{active.label}</h2>
        <p className="sticker-wow-why">{why}</p>
        {reward ? (
          <p className="sticker-wow-reward">
            {reward.split('\n').map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>
        ) : null}
        <button type="button" className="btn primary sticker-wow-btn" onClick={dismiss}>
          Круто!
        </button>
      </div>
    </div>
  )
}
