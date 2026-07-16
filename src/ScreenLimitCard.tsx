import { useEffect, useRef, useState } from 'react'
import { SCREEN_LIMITS, formatClock } from './data'
import type { ScreenKind, ScreenSlot } from './types'

type Props = {
  kind: ScreenKind
  slot: ScreenSlot
  onChange: (slot: ScreenSlot) => void
}

export function ScreenLimitCard({ kind, slot, onChange }: Props) {
  const limit = SCREEN_LIMITS[kind]
  const [now, setNow] = useState(Date.now())
  const finishedRef = useRef(false)

  const running = Boolean(slot.endsAt && !slot.finished)
  const remaining =
    running && slot.endsAt
      ? Math.max(0, Math.ceil((slot.endsAt - now) / 1000))
      : slot.remainingSec

  useEffect(() => {
    finishedRef.current = false
  }, [slot.endsAt, slot.finished])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running || remaining > 0 || finishedRef.current) return
    finishedRef.current = true
    onChange({
      endsAt: null,
      remainingSec: 0,
      finished: true,
    })
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      /* ignore */
    }
  }, [running, remaining, onChange])

  function start() {
    if (slot.finished) return
    const sec = slot.remainingSec > 0 ? slot.remainingSec : limit.seconds
    onChange({
      endsAt: Date.now() + sec * 1000,
      remainingSec: sec,
      finished: false,
    })
  }

  function pause() {
    if (!slot.endsAt) return
    const left = Math.max(0, Math.ceil((slot.endsAt - Date.now()) / 1000))
    onChange({
      endsAt: null,
      remainingSec: left,
      finished: false,
    })
  }

  function finishToday() {
    onChange({
      endsAt: null,
      remainingSec: 0,
      finished: true,
    })
  }

  function resetToday() {
    if (!confirm(`Сбросить лимит «${limit.label}» на сегодня?`)) return
    onChange({
      endsAt: null,
      remainingSec: limit.seconds,
      finished: false,
    })
  }

  const status = slot.finished
    ? 'Лимит на сегодня использован'
    : running
      ? 'Идёт таймер — когда прозвенит, стоп'
      : remaining < limit.seconds
        ? 'На паузе — можно продолжить'
        : 'Ещё не запускал сегодня'

  return (
    <div className={`screen-limit ${slot.finished ? 'used' : ''} ${running ? 'live' : ''}`}>
      <div className="card-title-row">
        <h3>{limit.label}</h3>
        <span className="pill">{Math.round(limit.seconds / 60)} мин</span>
      </div>
      <p className="hint">{status}</p>
      <div className={`screen-clock ${running ? 'live' : ''}`}>{formatClock(remaining)}</div>
      <div className="row-gap">
        {!slot.finished && !running ? (
          <button type="button" className="btn primary" onClick={start}>
            {remaining < limit.seconds ? 'Продолжить' : 'Начать'}
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
        ) : (
          <button type="button" className="btn ghost" onClick={resetToday}>
            Сбросить (если ошибся)
          </button>
        )}
      </div>
    </div>
  )
}
