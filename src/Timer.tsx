import { useCallback, useEffect, useRef, useState } from 'react'
import { playDing } from './sound'

type Props = {
  seconds: number
  rounds: number
  /** Survive unmount (e.g. tab switch) when set */
  persistKey?: string
  /** Called when user taps «Закончить и отметить» after all rounds */
  onFinish?: () => void
}

type PersistedTimer = {
  key: string
  seconds: number
  totalRounds: number
  completedRounds: number
  endAt: number | null
}

let persisted: PersistedTimer | null = null

function clearPersisted(key?: string) {
  if (!key || persisted?.key === key) persisted = null
}

function writePersisted(next: PersistedTimer) {
  persisted = next
}

function readPersisted(
  key: string,
  seconds: number,
  totalRounds: number,
): PersistedTimer | null {
  if (!persisted || persisted.key !== key) return null
  if (persisted.seconds !== seconds || persisted.totalRounds !== totalRounds) {
    clearPersisted(key)
    return null
  }
  return persisted
}

function buzzRoundDone() {
  playDing()
  try {
    navigator.vibrate?.([200, 80, 200])
  } catch {
    /* ignore */
  }
}

function initialFromPersist(
  persistKey: string | undefined,
  seconds: number,
  totalRounds: number,
): {
  completedRounds: number
  remaining: number
  running: boolean
  endAt: number | null
  missedRound: boolean
} {
  if (!persistKey) {
    return {
      completedRounds: 0,
      remaining: seconds,
      running: false,
      endAt: null,
      missedRound: false,
    }
  }

  const p = readPersisted(persistKey, seconds, totalRounds)
  if (!p) {
    return {
      completedRounds: 0,
      remaining: seconds,
      running: false,
      endAt: null,
      missedRound: false,
    }
  }

  if (p.endAt != null) {
    const left = Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000))
    if (left <= 0) {
      const completedRounds = Math.min(totalRounds, p.completedRounds + 1)
      writePersisted({
        ...p,
        completedRounds,
        endAt: null,
      })
      return {
        completedRounds,
        remaining: seconds,
        running: false,
        endAt: null,
        missedRound: true,
      }
    }
    return {
      completedRounds: p.completedRounds,
      remaining: left,
      running: true,
      endAt: p.endAt,
      missedRound: false,
    }
  }

  return {
    completedRounds: p.completedRounds,
    remaining: seconds,
    running: false,
    endAt: null,
    missedRound: false,
  }
}

export function Timer({ seconds, rounds, persistKey, onFinish }: Props) {
  const totalRounds = Math.max(1, rounds)
  const boot = useRef(
    initialFromPersist(persistKey, seconds, totalRounds),
  ).current

  const [completedRounds, setCompletedRounds] = useState(boot.completedRounds)
  const [remaining, setRemaining] = useState(boot.remaining)
  const [running, setRunning] = useState(boot.running)
  const endAt = useRef<number | null>(boot.endAt)
  const configRef = useRef({ seconds, totalRounds })

  const allDone = completedRounds >= totalRounds
  const currentRound = Math.min(completedRounds + 1, totalRounds)

  const syncPersist = useCallback(
    (next: {
      completedRounds: number
      endAt: number | null
    }) => {
      if (!persistKey) return
      writePersisted({
        key: persistKey,
        seconds,
        totalRounds,
        completedRounds: next.completedRounds,
        endAt: next.endAt,
      })
    },
    [persistKey, seconds, totalRounds],
  )

  useEffect(() => {
    if (boot.missedRound) buzzRoundDone()
  }, [boot.missedRound])

  useEffect(() => {
    const prev = configRef.current
    if (prev.seconds === seconds && prev.totalRounds === totalRounds) return
    configRef.current = { seconds, totalRounds }
    clearPersisted(persistKey)
    setCompletedRounds(0)
    setRemaining(seconds)
    setRunning(false)
    endAt.current = null
  }, [seconds, totalRounds, persistKey])

  useEffect(() => {
    if (!running) return

    const tick = () => {
      if (endAt.current == null) return
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setRunning(false)
        endAt.current = null
        setCompletedRounds((n) => {
          const completedRounds = Math.min(totalRounds, n + 1)
          syncPersist({ completedRounds, endAt: null })
          return completedRounds
        })
        buzzRoundDone()
      }
    }

    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [running, totalRounds, syncPersist])

  const start = useCallback(() => {
    if (allDone || running) return
    const nextEnd = Date.now() + seconds * 1000
    setRemaining(seconds)
    endAt.current = nextEnd
    setRunning(true)
    syncPersist({ completedRounds, endAt: nextEnd })
  }, [allDone, running, seconds, completedRounds, syncPersist])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div
      className={`timer ${allDone ? 'timer-done' : ''} ${running ? 'timer-run' : ''}`}
    >
      {totalRounds > 1 ? (
        <div className="timer-label">
          Подход {currentRound} из {totalRounds}
        </div>
      ) : null}

      <div className="timer-digits" aria-live="polite">
        {allDone ? '00:00' : mm + ':' + ss}
      </div>

      <div className="timer-actions">
        {allDone ? (
          <button
            type="button"
            className="btn primary wide"
            onClick={() => {
              clearPersisted(persistKey)
              onFinish?.()
            }}
          >
            Закончить и отметить
          </button>
        ) : !running ? (
          <button type="button" className="btn primary wide" onClick={start}>
            {completedRounds === 0 ? 'Старт' : `Старт подхода ${currentRound}`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
