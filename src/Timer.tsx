import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDuration } from './data'
import { playDing } from './sound'

export { parseTimerRounds } from './data'

type Props = {
  seconds: number
  rounds: number
  onCanCompleteChange?: (canComplete: boolean) => void
}

export function Timer({ seconds, rounds, onCanCompleteChange }: Props) {
  const totalRounds = Math.max(1, rounds)
  const [completedRounds, setCompletedRounds] = useState(0)
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const endAt = useRef<number | null>(null)

  const allDone = completedRounds >= totalRounds
  const currentRound = Math.min(completedRounds + 1, totalRounds)

  useEffect(() => {
    setCompletedRounds(0)
    setRemaining(seconds)
    setRunning(false)
    endAt.current = null
  }, [seconds, totalRounds])

  useEffect(() => {
    onCanCompleteChange?.(allDone)
  }, [allDone, onCanCompleteChange])

  useEffect(() => {
    if (!running) return

    const tick = () => {
      if (endAt.current == null) return
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setRunning(false)
        endAt.current = null
        setCompletedRounds((n) => Math.min(totalRounds, n + 1))
        playDing()
        try {
          navigator.vibrate?.([200, 80, 200])
        } catch {
          /* ignore */
        }
      }
    }

    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [running, totalRounds])

  const start = useCallback(() => {
    if (allDone || running) return
    setRemaining(seconds)
    endAt.current = Date.now() + seconds * 1000
    setRunning(true)
  }, [allDone, running, seconds])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div
      className={`timer ${allDone ? 'timer-done' : ''} ${running ? 'timer-run' : ''}`}
    >
      {totalRounds > 1 ? (
        <div className="timer-label">
          Подход {currentRound} из {totalRounds}
          {completedRounds > 0 ? ` · сделано ${completedRounds}` : ''}
        </div>
      ) : null}

      <div className="timer-digits" aria-live="polite">
        {allDone ? '00:00' : mm + ':' + ss}
      </div>

      <div className="timer-actions">
        {!running && !allDone ? (
          <button type="button" className="btn primary" onClick={start}>
            {completedRounds === 0 ? 'Старт' : `Старт подхода ${currentRound}`}
          </button>
        ) : null}
      </div>

      {running ? <div className="timer-hint">Жди сигнала — без паузы</div> : null}

      {!running && !allDone ? (
        <div className="timer-hint">
          {totalRounds > 1
            ? `${formatDuration(seconds)} × ${totalRounds} подхода`
            : formatDuration(seconds)}
        </div>
      ) : null}

      {allDone ? (
        <div className="timer-finish">
          {totalRounds > 1
            ? `Все ${totalRounds} подхода готовы — можно отметить`
            : 'Готово — можно отметить'}
        </div>
      ) : null}
    </div>
  )
}
