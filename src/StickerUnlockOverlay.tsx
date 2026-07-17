import { useEffect, useMemo, useRef, useState } from 'react'
import { Confetti } from './Confetti'
import { todayKey } from './data'
import {
  STICKERS,
  countPerfectDays,
  currentStreak,
  isStickerUnlocked,
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
    return []
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

function unlockedIds(data: AppData, today: string): string[] {
  const perfectTotal = countPerfectDays(data.days)
  const streak = currentStreak(data.days, today)
  const bestStreak = Math.max(data.bestStreak ?? 0, streak)
  return STICKERS.filter((s) =>
    isStickerUnlocked(s, perfectTotal, streak, bestStreak),
  ).map((s) => s.id)
}

export function StickerUnlockOverlay({ data, enabled = true }: Props) {
  const today = todayKey()
  const [queue, setQueue] = useState<string[]>([])
  const [active, setActive] = useState<Sticker | null>(null)
  const [burst, setBurst] = useState(false)
  const seededRef = useRef(false)
  const celebratedRef = useRef<Set<string>>(new Set())

  const unlocked = useMemo(
    () => unlockedIds(data, today),
    [data.days, data.bestStreak, today],
  )

  useEffect(() => {
    if (!enabled) return

    if (!seededRef.current) {
      seededRef.current = true
      const stored = loadCelebrated()
      if (stored == null) {
        // First run after update / install: don't replay old unlocks
        celebratedRef.current = new Set(unlocked)
        saveCelebrated(unlocked)
        return
      }
      celebratedRef.current = new Set(stored)
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
        <p className="sticker-wow-quote">«{active.quote}»</p>
        {reward ? (
          <p className="sticker-wow-reward">
            {reward.split('\n').map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>
        ) : (
          <p className="sticker-wow-detail">{active.detail}</p>
        )}
        <button type="button" className="btn primary sticker-wow-btn" onClick={dismiss}>
          Круто!
        </button>
      </div>
    </div>
  )
}
