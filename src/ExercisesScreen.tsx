import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ROUTINE_NOTE,
  formatDuration,
  formatPlayTime,
  groupExercises,
  normalizeDayLog,
  todayKey,
  workoutDurationSec,
} from './data'
import { stampPerfectAt } from './progress'
import { playDing } from './sound'
import { Timer, parseTimerRounds } from './Timer'
import type { AppData } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  readOnly?: boolean
}

export function ExercisesScreen({
  data,
  onChange,
  readOnly = false,
}: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [canComplete, setCanComplete] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const doneCount = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const timedCount = data.exercises.filter((e) => e.durationSec > 0).length
  const workoutSec = workoutDurationSec(day)
  const groups = useMemo(() => groupExercises(data.exercises), [data.exercises])
  const active = data.exercises.find((e) => e.id === activeId) ?? null
  const sheetOpen = Boolean(active && active.durationSec > 0)
  const activeRounds = active ? parseTimerRounds(active.reps) : 1

  const onCanCompleteChange = useCallback((value: boolean) => {
    setCanComplete(value)
  }, [])

  useEffect(() => {
    setCanComplete(false)
  }, [activeId])

  useEffect(() => {
    if (!sheetOpen) return
    sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    sheetRef.current?.focus()
  }, [sheetOpen, activeId])

  function patchDayExercises(
    exercisesDone: Record<string, boolean>,
    timersHonored: Record<string, boolean>,
  ) {
    const now = Date.now()
    const allDone =
      data.exercises.length > 0 &&
      data.exercises.every((e) => exercisesDone[e.id])
    const anyDone = data.exercises.some((e) => exercisesDone[e.id])

    let workoutStartedAt = day.workoutStartedAt
    let workoutFinishedAt = day.workoutFinishedAt

    if (!anyDone) {
      workoutStartedAt = null
      workoutFinishedAt = null
    } else {
      if (workoutStartedAt == null) workoutStartedAt = now
      workoutFinishedAt = allDone
        ? workoutFinishedAt ?? now
        : null
    }

    if (allDone && day.workoutFinishedAt == null) {
      playDing()
    }

    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, {
        ...day,
        exercisesDone,
        timersHonored,
        workoutStartedAt,
        workoutFinishedAt,
        mustDo: {
          ...day.mustDo,
          exercise: allDone,
        },
      }),
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  function toggleDone(id: string) {
    if (readOnly) return
    const nextDone = !day.exercisesDone[id]
    const exercisesDone = { ...day.exercisesDone, [id]: nextDone }
    const timersHonored = { ...day.timersHonored }
    if (!nextDone) {
      delete timersHonored[id]
    }
    patchDayExercises(exercisesDone, timersHonored)
  }

  function completeWithTimer(id: string) {
    if (readOnly) return
    patchDayExercises(
      { ...day.exercisesDone, [id]: true },
      { ...day.timersHonored, [id]: true },
    )
  }

  return (
    <div className={`screen ${sheetOpen ? 'screen-sheet-open' : ''}`}>
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">
            {readOnly ? 'Родитель · просмотр' : 'Зарядка · ДЗ №28'}
          </p>
        </div>
        <h1>Комплекс упражнений</h1>
        <p className="sub">
          Сегодня {doneCount} из {data.exercises.length}
          {readOnly ? '' : ` · с таймером: ${timedCount}`}
        </p>
        {workoutSec != null ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
      </header>

      {readOnly ? (
        <section className="card soft">
          <p className="hint">Только просмотр — отметить упражнения можно на телефоне ребёнка.</p>
        </section>
      ) : (
        <section className="card soft">
          <p className="hint">{ROUTINE_NOTE}</p>
          <p className="hint" style={{ marginTop: 8 }}>
            Капа (трейнер) нужна только там, где в названии написано «(трейнер)».
          </p>
        </section>
      )}

      {groups.map(({ group, items }) => {
        const groupDone = items.filter((ex) => day.exercisesDone[ex.id]).length
        return (
          <section key={group} className="card">
            <div className="card-title-row">
              <h2>{group}</h2>
              <span className="pill">
                {groupDone}/{items.length}
              </span>
            </div>
            <ul className="exercise-list">
              {items.map((ex) => {
                const checked = Boolean(day.exercisesDone[ex.id])
                const isActive = activeId === ex.id
                const note = ex.notes.trim()
                const rounds = ex.durationSec > 0 ? parseTimerRounds(ex.reps) : 1
                return (
                  <li
                    key={ex.id}
                    className={`exercise-card ${checked ? 'done' : ''} ${isActive ? 'active' : ''} ${readOnly ? 'read-only' : ''}`}
                  >
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => toggleDone(ex.id)}
                      />
                      <span className="ex-name">{ex.name}</span>
                    </label>
                    {!readOnly ? (
                      <>
                        <div className="ex-meta">
                          {ex.durationSec > 0 ? (
                            <span className="pill">
                              {rounds > 1
                                ? `Таймер ${formatDuration(ex.durationSec)} × ${rounds}`
                                : `Таймер ${formatDuration(ex.durationSec)}`}
                            </span>
                          ) : null}
                          {ex.reps ? <span className="pill muted">{ex.reps}</span> : null}
                        </div>
                        {note ? <p className="hint">{note}</p> : null}
                        {ex.durationSec > 0 ? (
                          <div className="ex-actions">
                            <button
                              type="button"
                              className="btn primary"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setActiveId(ex.id)
                              }}
                            >
                              Таймер
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {!readOnly && sheetOpen && active ? (
        <div
          className="action-sheet"
          ref={sheetRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Таймер упражнения"
        >
          <div className="action-sheet-handle" />
          <div className="action-sheet-head">
            <h2>{active.name}</h2>
            <button type="button" className="btn ghost" onClick={() => setActiveId(null)}>
              Закрыть
            </button>
          </div>
          <div className="action-sheet-body">
            <p className="eyebrow">{active.group}</p>
            {active.notes.trim() ? <p className="hint">{active.notes}</p> : null}
            {active.reps ? <p className="hint">{active.reps}</p> : null}
            <Timer
              key={active.id}
              seconds={active.durationSec}
              rounds={activeRounds}
              onCanCompleteChange={onCanCompleteChange}
            />
            <button
              type="button"
              className="btn primary wide"
              disabled={!canComplete}
              onClick={() => {
                if (!canComplete) return
                completeWithTimer(active.id)
                setActiveId(null)
              }}
            >
              {canComplete
                ? 'Сделано — отметить'
                : activeRounds > 1
                  ? 'Сначала все подходы'
                  : 'Сначала дождись таймера'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
