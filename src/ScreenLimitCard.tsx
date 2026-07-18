import { useEffect, useRef, useState } from 'react'
import {
  SCREEN_LIMITS,
  flushScreenOvertime,
  formatClock,
  formatPlayTimeWithOvertime,
  screenOvertimeSec,
} from './data'
import type { ScreenKind, ScreenSlot } from './types'

type Props = {
  kind: ScreenKind
  slot: ScreenSlot
  /** Override today's limit (e.g. streak bonus) */
  limitSeconds?: number
  bonusNote?: string
  /** Unspent achievement bonus minutes in the bank */
  bankMinutes?: number
  onClaimBank?: (minutes: number) => void
  onChange: (slot: ScreenSlot) => void
}

export function ScreenLimitCard({
  kind,
  slot,
  limitSeconds,
  bonusNote,
  bankMinutes = 0,
  onClaimBank,
  onChange,
}: Props) {
  const meta = SCREEN_LIMITS[kind]
  const limitSec = limitSeconds ?? meta.seconds
  const [now, setNow] = useState(Date.now())
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
  const bank = Math.max(0, Math.floor(bankMinutes))
  const canClaimBank = bank > 0 && !slot.finished && Boolean(onClaimBank)
  const bankClaimOptions = [10, 15, 20, 25, 30].filter((n) => n <= bank)

  useEffect(() => {
    finishedRef.current = false
  }, [slot.endsAt, slot.finished])

  useEffect(() => {
    if (!running && !overtimeTicking) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running, overtimeTicking])

  // Timer hit zero — stop limit clock, start silent overtime.
  useEffect(() => {
    if (!running || remaining > 0 || finishedRef.current) return
    finishedRef.current = true
    const started = sessionStartRemaining.current ?? limitSec
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
    const started = sessionStartRemaining.current ?? slot.remainingSec
    const played = Math.max(0, started - left)
    sessionStartRemaining.current = null
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
      const started = sessionStartRemaining.current ?? next.remainingSec
      played = Math.max(0, started - left)
    }
    sessionStartRemaining.current = null
    onChange({
      ...next,
      endsAt: null,
      remainingSec: 0,
      finished: true,
      usedSec: next.usedSec + played,
      overtimeStartedAt: null,
    })
  }

  const status = slot.finished
    ? 'Лимит на сегодня закрыт'
    : running
      ? 'Идёт таймер — когда время выйдет, он остановится'
      : timedOut
        ? 'Время вышло — можно доиграть, потом нажми «Закончить на сегодня»'
        : remaining < limitSec
          ? 'На паузе — можно продолжить'
          : 'Ещё не запускал сегодня'

  const playLine =
    slot.usedSec > 0 || overtimeLive > 0
      ? `Сегодня сыграно: ${formatPlayTimeWithOvertime(slot.usedSec, overtimeLive)}`
      : null

  return (
    <div
      className={`screen-limit ${slot.finished ? 'used' : ''} ${running ? 'live' : ''} ${timedOut ? 'timed-out' : ''}`}
    >
      <div className="card-title-row">
        <h3>{meta.label}</h3>
        <span className="pill">{Math.round(limitSec / 60)} мин</span>
      </div>
      <p className="hint">{status}</p>
      {bonusNote ? <p className="hint">{bonusNote}</p> : null}
      {playLine ? <p className="hint">{playLine}</p> : null}
      <div className={`screen-clock ${running ? 'live' : ''} ${timedOut ? 'timed-out' : ''}`}>
        {formatClock(remaining)}
      </div>

      <div className="roblox-bank in-card">
        <p className="roblox-bank-label">
          Копилка бонусов: <strong>{bank} мин</strong>
        </p>
        {bank <= 0 ? (
          <p className="hint">
            Сюда падают бонусные минуты за серии и достижения — потом можно взять в любой день.
          </p>
        ) : canClaimBank ? (
          <div className="roblox-bank-actions">
            {bankClaimOptions.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => onClaimBank?.(n)}
              >
                +{n} мин сегодня
              </button>
            ))}
            <button
              type="button"
              className="btn primary"
              onClick={() => onClaimBank?.(bank)}
            >
              Все {bank} мин сегодня
            </button>
          </div>
        ) : (
          <p className="hint">
            Лимит на сегодня уже закрыт — бонусы можно потратить завтра.
          </p>
        )}
      </div>

      <div className="row-gap">
        {!slot.finished && !running && remaining > 0 ? (
          <button type="button" className="btn primary" onClick={start}>
            {remaining < limitSec ? 'Продолжить' : 'Начать'}
          </button>
        ) : null}
        {running ? (
          <button type="button" className="btn" onClick={pause}>
            Пауза
          </button>
        ) : null}
        {!slot.finished ? (
          <button type="button" className="btn ghost" onClick={finishToday}>
            Закончить на сегодня
          </button>
        ) : null}
      </div>
    </div>
  )
}
