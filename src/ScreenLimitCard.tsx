import { useEffect, useRef, useState } from 'react'
import {
  SCREEN_LIMITS,
  flushScreenOvertime,
  formatClock,
  formatPlayTimeWithOvertime,
  screenOvertimeSec,
} from './data'
import {
  cancelRobloxLimitNotification,
  scheduleRobloxLimitEndedAt,
} from './robloxLimitNotify'
import type { ScreenKind, ScreenSlot } from './types'

type Props = {
  kind: ScreenKind
  slot: ScreenSlot
  /** Override today's limit (e.g. streak bonus) */
  limitSeconds?: number
  bonusNote?: string
  onChange: (slot: ScreenSlot) => void
}

export function ScreenLimitCard({
  kind,
  slot,
  limitSeconds,
  bonusNote,
  onChange,
}: Props) {
  const meta = SCREEN_LIMITS[kind]
  const limitSec = limitSeconds ?? meta.seconds
  const [now, setNow] = useState(Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const finishedRef = useRef(false)
  /** Remaining seconds when the current session was started/resumed */
  const sessionStartRemaining = useRef<number | null>(null)

  const running = Boolean(slot.endsAt && !slot.finished)
  const remaining =
    running && slot.endsAt
      ? Math.max(0, Math.ceil((slot.endsAt - now) / 1000))
      : slot.remainingSec
  const timedOut = !slot.finished && !running && remaining <= 0 && slot.usedSec > 0
  const overtimeLive = screenOvertimeSec(slot, now)
  const overtimeTicking = timedOut && slot.overtimeStartedAt != null

  useEffect(() => {
    finishedRef.current = false
  }, [slot.endsAt, slot.finished])

  // After reload mid-session the ref is empty — restore from unused quota.
  useEffect(() => {
    if (!running || sessionStartRemaining.current != null) return
    sessionStartRemaining.current = Math.max(0, limitSec - slot.usedSec)
  }, [running, limitSec, slot.usedSec])

  useEffect(() => {
    if (!running && !overtimeTicking) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running, overtimeTicking])

  // Keep a system notification scheduled for the exact limit end (works in background).
  useEffect(() => {
    if (kind !== 'roblox') return
    if (running && slot.endsAt != null) {
      void scheduleRobloxLimitEndedAt(slot.endsAt)
      return
    }
    if (slot.finished) {
      void cancelRobloxLimitNotification()
    }
  }, [kind, running, slot.endsAt, slot.finished])

  // Timer hit zero — start overtime. Notification is the scheduled one at endsAt
  // (avoid a second immediate alert that doubles the nudge).
  useEffect(() => {
    if (!running || remaining > 0 || finishedRef.current) return
    finishedRef.current = true
    const started =
      sessionStartRemaining.current ?? Math.max(0, limitSec - slot.usedSec)
    sessionStartRemaining.current = null
    onChange({
      endsAt: null,
      remainingSec: 0,
      finished: false,
      usedSec: slot.usedSec + started,
      overtimeSec: slot.overtimeSec ?? 0,
      overtimeStartedAt: Date.now(),
    })
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      /* ignore */
    }
  }, [running, remaining, onChange, slot.usedSec, slot.overtimeSec, limitSec])

  // Resume overtime after reload if already timed out.
  useEffect(() => {
    if (!timedOut || slot.overtimeStartedAt != null || slot.finished) return
    onChange({
      ...slot,
      overtimeSec: slot.overtimeSec ?? 0,
      overtimeStartedAt: Date.now(),
    })
  }, [timedOut, slot, onChange])

  function start() {
    if (slot.finished || slot.remainingSec <= 0) return
    const flushed = flushScreenOvertime(slot)
    const sec = flushed.remainingSec
    sessionStartRemaining.current = sec
    onChange({
      ...flushed,
      endsAt: Date.now() + sec * 1000,
      remainingSec: sec,
      finished: false,
      usedSec: flushed.usedSec,
    })
  }

  function pause() {
    if (!slot.endsAt) return
    const left = Math.max(0, Math.ceil((slot.endsAt - Date.now()) / 1000))
    const started =
      sessionStartRemaining.current ?? Math.max(0, limitSec - slot.usedSec)
    const played = Math.max(0, started - left)
    sessionStartRemaining.current = null
    if (kind === 'roblox') {
      void cancelRobloxLimitNotification()
    }
    onChange({
      endsAt: null,
      remainingSec: left,
      finished: false,
      usedSec: slot.usedSec + played,
      overtimeSec: slot.overtimeSec ?? 0,
      overtimeStartedAt: null,
    })
  }

  function finishToday() {
    let next = flushScreenOvertime(slot)
    let played = 0
    if (next.endsAt) {
      const left = Math.max(0, Math.ceil((next.endsAt - Date.now()) / 1000))
      const started =
        sessionStartRemaining.current ?? Math.max(0, limitSec - next.usedSec)
      played = Math.max(0, started - left)
    }
    sessionStartRemaining.current = null
    setConfirmFinish(false)
    if (kind === 'roblox') {
      void cancelRobloxLimitNotification()
    }
    const usedSec = next.usedSec + played
    onChange({
      ...next,
      endsAt: null,
      remainingSec: Math.max(0, limitSec - usedSec),
      finished: true,
      usedSec,
      overtimeStartedAt: null,
    })
  }

  /** Undo accidental «finish for today» — restore leftover quota. */
  function reopenToday() {
    const left = Math.max(0, limitSec - slot.usedSec)
    onChange({
      ...slot,
      endsAt: null,
      remainingSec: left,
      finished: false,
      overtimeStartedAt: null,
    })
  }

  const playLine =
    slot.usedSec > 0 || overtimeLive > 0
      ? `Сегодня сыграно: ${formatPlayTimeWithOvertime(slot.usedSec, overtimeLive)}`
      : null

  const hasStarted =
    running ||
    timedOut ||
    slot.usedSec > 0 ||
    overtimeLive > 0 ||
    remaining < limitSec

  return (
    <section
      className={`card screen-limit-card ${slot.finished ? 'used' : ''} ${running ? 'live' : ''} ${timedOut ? 'timed-out' : ''}`}
    >
      <div className="card-title-row">
        <h2>Таймер</h2>
        <span
          className={
            slot.finished || running || timedOut ? 'pill' : 'pill muted'
          }
        >
          {slot.finished
            ? 'закрыт'
            : running
              ? 'идёт'
              : timedOut
                ? 'время вышло'
                : remaining < limitSec
                  ? 'пауза'
                  : 'не начат'}
        </span>
      </div>
      {bonusNote ? <p className="hint">{bonusNote}</p> : null}
      {playLine ? <p className="hint">{playLine}</p> : null}
      <div className={`screen-clock ${running ? 'live' : ''} ${timedOut ? 'timed-out' : ''}`}>
        {formatClock(remaining)}
      </div>

      <div className="row-gap">
        {slot.finished ? (
          <button type="button" className="btn primary" onClick={reopenToday}>
            Продолжить игру
          </button>
        ) : confirmFinish ? (
          <>
            <p className="hint" style={{ margin: 0, flexBasis: '100%' }}>
              Точно закончить на сегодня?
            </p>
            <button type="button" className="btn" onClick={finishToday}>
              Да, закончить
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setConfirmFinish(false)}
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            {!running && remaining > 0 ? (
              <button type="button" className="btn primary" onClick={start}>
                {remaining < limitSec ? 'Продолжить' : 'Начать'}
              </button>
            ) : null}
            {running ? (
              <button type="button" className="btn" onClick={pause}>
                Пауза
              </button>
            ) : null}
            {hasStarted ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setConfirmFinish(true)}
              >
                Закончить на сегодня
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
