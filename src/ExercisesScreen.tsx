import { useMemo } from 'react'
import {
  formatDuration,
  formatPlayTime,
  groupExercises,
  normalizeDayLog,
  parseTimerRounds,
  todayKey,
  workoutDurationSec,
} from './data'
import { stampPerfectAt } from './progress'
import { playDing } from './sound'
import { Timer } from './Timer'
import type { AppData, Exercise } from './types'

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

  const doneCount = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const total = data.exercises.length
  const workoutSec = workoutDurationSec(day)
  const groups = useMemo(() => groupExercises(data.exercises), [data.exercises])

  const current =
    data.exercises.find((e) => !day.exercisesDone[e.id]) ?? null
  const currentIndex = current
    ? data.exercises.findIndex((e) => e.id === current.id)
    : -1
  const allDone = total > 0 && current == null

  function patchDayExercises(
    exercisesDone: Record<string, boolean>,
    timersHonored: Record<string, boolean>,
  ) {
    const now = Date.now()
    const everyDone =
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
      workoutFinishedAt = everyDone
        ? (workoutFinishedAt ?? now)
        : null
    }

    if (everyDone && day.workoutFinishedAt == null) {
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
          exercise: everyDone,
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

  function markDone(ex: Exercise, withTimer: boolean) {
    if (readOnly) return
    const exercisesDone = { ...day.exercisesDone, [ex.id]: true }
    const timersHonored = { ...day.timersHonored }
    if (withTimer) timersHonored[ex.id] = true
    patchDayExercises(exercisesDone, timersHonored)
  }

  if (readOnly) {
    return (
      <ParentExerciseList
        groups={groups}
        day={day}
        doneCount={doneCount}
        total={total}
        workoutSec={workoutSec}
      />
    )
  }

  return (
    <div className="screen ex-wizard-screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Зарядка · ДЗ №28</p>
        </div>
        <h1>Комплекс упражнений</h1>
        <p className="sub">
          {allDone
            ? `Готово · ${total} из ${total}`
            : `${doneCount} из ${total}`}
        </p>
        {workoutSec != null ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
      </header>

      <div
        className="ex-wizard-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
        aria-label="Прогресс зарядки"
      >
        <div
          className="ex-wizard-progress-bar"
          style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
        />
      </div>

      {allDone ? (
        <div className="card ex-wizard-card ex-wizard-complete">
          <p className="ex-wizard-complete-title">Зарядка сделана</p>
          <p className="ex-wizard-complete-sub">
            Все {total} упражнений отмечены. Можно отдыхать.
          </p>
        </div>
      ) : current ? (
        <WizardStep
          key={current.id}
          exercise={current}
          step={currentIndex + 1}
          total={total}
          onDone={() => markDone(current, false)}
          onTimerDone={() => markDone(current, true)}
        />
      ) : null}
    </div>
  )
}

function WizardStep({
  exercise,
  step,
  total,
  onDone,
  onTimerDone,
}: {
  exercise: Exercise
  step: number
  total: number
  onDone: () => void
  onTimerDone: () => void
}) {
  const note = exercise.notes.trim()
  const hasTimer = exercise.durationSec > 0
  const rounds = hasTimer ? parseTimerRounds(exercise.reps) : 1

  return (
    <div className="card ex-wizard-card">
      <p className="ex-wizard-step">
        Упражнение {step} из {total}
      </p>
      <p className="ex-wizard-group">{exercise.group}</p>
      <h2 className="ex-wizard-name">{exercise.name}</h2>
      {note ? <p className="ex-wizard-desc">{note}</p> : null}

      <div className="ex-wizard-meta">
        {exercise.reps ? (
          <span className="pill muted">{exercise.reps}</span>
        ) : null}
        {hasTimer ? (
          <span className="pill muted">
            {rounds > 1
              ? `${formatDuration(exercise.durationSec)} × ${rounds}`
              : formatDuration(exercise.durationSec)}
          </span>
        ) : null}
      </div>

      {hasTimer ? (
        <Timer
          key={exercise.id}
          persistKey={exercise.id}
          seconds={exercise.durationSec}
          rounds={rounds}
          onFinish={onTimerDone}
        />
      ) : (
        <button type="button" className="btn primary wide" onClick={onDone}>
          Сделано
        </button>
      )}
    </div>
  )
}

function ParentExerciseList({
  groups,
  day,
  doneCount,
  total,
  workoutSec,
}: {
  groups: ReturnType<typeof groupExercises>
  day: ReturnType<typeof normalizeDayLog>
  doneCount: number
  total: number
  workoutSec: number | null
}) {
  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель · просмотр</p>
        </div>
        <h1>Зарядка</h1>
        <p className="sub">
          Сегодня {doneCount} из {total}
        </p>
        {workoutSec != null ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
      </header>

      <div className="parent-ex-groups">
        {groups.map(({ group, items }) => {
          const groupDone = items.filter((ex) => day.exercisesDone[ex.id]).length
          return (
            <details key={group} className="parent-ex-group">
              <summary className="parent-ex-group-head">
                <span className="parent-ex-group-title">{group}</span>
                <span className="pill">
                  {groupDone}/{items.length}
                </span>
              </summary>
              <ul className="parent-ex-list">
                {items.map((ex) => {
                  const checked = Boolean(day.exercisesDone[ex.id])
                  return (
                    <li
                      key={ex.id}
                      className={`parent-ex-row ${checked ? 'is-done' : ''}`}
                    >
                      <label className="parent-ex-item">
                        <input type="checkbox" checked={checked} disabled />
                        <span className="ex-name">{ex.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </div>
    </div>
  )
}
