import { Fragment, useEffect, useRef, useState } from 'react'
import { Confetti } from './Confetti'
import {
  APP_LOCKED_MUST_DO,
  CREATE_IDEAS,
  CREATE_KIND_BY_IDEA,
  CREATE_PIECE_MAX,
  createKindsFromPieces,
  EXTRA_TASK_IDEAS,
  formatCreatePieceLabel,
  toggleCreateIdea,
  MAIN_MUST_DO,
  activeExercises,
  applyMustDoFlags,
  chewDurationSec,
  formatPlayTime,
  normalizeDayLog,
  optionalMustDoItems,
  requiredMustDoItems,
  schoolDayPlanFromData,
  schoolRestLabel,
  SCHOOL_GRADES_START,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { ElectiveSchedule } from './ElectiveSchedule'
import { stampPerfectAt } from './progress'
import { SchoolGradesCard } from './SchoolGradesCard'
import { playDing } from './sound'
import type { AppData, MustDoId } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  onOpenExercises: () => void
  onOpenChew: () => void
}

export function TodayScreen({
  data,
  onChange,
  onOpenExercises,
  onOpenChew,
}: Props) {
  const key = todayKey()
  const plan = schoolDayPlanFromData(data)
  const day = normalizeDayLog(key, data.days[key])
  const requiredItems = requiredMustDoItems(key, plan)
  const optionalItems = optionalMustDoItems(key, plan)
  const restLabel = schoolRestLabel(key, plan)
  const doneCount = requiredItems.filter((i) => day.mustDo[i.id]).length
  const active = activeExercises(data.exercises)
  const exerciseDone = active.filter((e) => day.exercisesDone[e.id]).length
  const exerciseTotal = active.length
  const workoutSec = workoutDurationSec(day)
  const chewToday = (data.chewEntries ?? [])
    .filter((e) => e.date === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const chewSec = chewToday ? chewDurationSec(chewToday) : null
  const exerciseComplete =
    exerciseTotal > 0 && exerciseDone === exerciseTotal
  const chewComplete = Boolean(chewToday)
  const extraDone = day.extraTasks.filter((t) => t.done).length
  const [extraDraft, setExtraDraft] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const prevDoneRef = useRef(doneCount)

  useEffect(() => {
    if (
      prevDoneRef.current < requiredItems.length &&
      doneCount >= requiredItems.length
    ) {
      playDing()
      setCelebrate(true)
    }
    prevDoneRef.current = doneCount
  }, [doneCount, requiredItems.length])

  function patchDay(partial: Partial<typeof day>) {
    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, { ...day, ...partial }),
      plan,
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  // Auto-mark exercise/chew when done in-app; never clear a parent override
  useEffect(() => {
    const nextExercise = exerciseComplete || Boolean(day.mustDo.exercise)
    const nextChew = chewComplete || Boolean(day.mustDo.chew)
    if (
      day.mustDo.exercise === nextExercise &&
      day.mustDo.chew === nextChew
    ) {
      return
    }
    patchDay(
      applyMustDoFlags(day, {
        exercise: nextExercise,
        chew: nextChew,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exerciseComplete,
    chewComplete,
    day.mustDo.exercise,
    day.mustDo.chew,
  ])

  function toggleMust(id: MustDoId) {
    if (APP_LOCKED_MUST_DO.includes(id)) return
    patchDay(applyMustDoFlags(day, { [id]: !day.mustDo[id] }))
  }

  function isMustChecked(id: MustDoId): boolean {
    if (id === 'exercise') return exerciseComplete || Boolean(day.mustDo.exercise)
    if (id === 'chew') return chewComplete || Boolean(day.mustDo.chew)
    return Boolean(day.mustDo[id])
  }

  function isParentMarkedOnly(id: MustDoId): boolean {
    if (id === 'exercise') {
      if (!day.mustDo.exercise) return false
      // Parent partial credit or other override without full child session
      if (day.exercisePartial && !exerciseComplete) return true
      // Parent override: mustDo without child timed session (or no exercises checked)
      return !exerciseComplete || workoutSec == null
    }
    if (id === 'chew') return Boolean(day.mustDo.chew) && !chewComplete
    return false
  }

  function addExtraTask(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const already = day.extraTasks.some(
      (t) => t.text.toLowerCase() === trimmed.toLowerCase(),
    )
    if (already) return
    patchDay({
      extraTasks: [...day.extraTasks, { id: uid(), text: trimmed, done: false }],
    })
    setExtraDraft('')
  }

  function toggleExtraTask(id: string) {
    patchDay({
      extraTasks: day.extraTasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    })
  }

  function removeExtraTask(id: string) {
    const task = day.extraTasks.find((t) => t.id === id)
    if (task?.fromParent) return
    patchDay({
      extraTasks: day.extraTasks.filter((t) => t.id !== id),
      deletedExtraTaskIds: day.deletedExtraTaskIds.includes(id)
        ? day.deletedExtraTaskIds
        : [...day.deletedExtraTaskIds, id],
    })
  }

  function toggleElective(id: string) {
    patchDay({
      electiveDone: {
        ...day.electiveDone,
        [id]: !day.electiveDone[id],
      },
    })
  }

  return (
    <div className="screen">
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Сегодня</p>
        </div>
        <h1>{formatRuDate(key)}</h1>
        <p className="sub">
          Сделано {doneCount} из {requiredItems.length} · зарядка {exerciseDone}/
          {exerciseTotal || 0}
          {restLabel ? ` · ${restLabel}` : ''}
          {day.extraTasks.length
            ? ` · ещё ${extraDone}/${day.extraTasks.length}`
            : ''}
        </p>
      </header>

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{requiredItems.length}
          </span>
        </div>
        <ul className="check-list">
          {requiredItems.map((item) => {
            const locked = APP_LOCKED_MUST_DO.includes(item.id)
            const parentOnly = isParentMarkedOnly(item.id)
            return (
            <Fragment key={item.id}>
            <li
              className={MAIN_MUST_DO.includes(item.id) ? 'must-main' : undefined}
            >
              <label
                className={`check-row ${locked ? 'locked' : ''}`}
                onClick={locked ? (e) => e.preventDefault() : undefined}
              >
                <input
                  type="checkbox"
                  checked={isMustChecked(item.id)}
                  readOnly={locked}
                  tabIndex={locked ? -1 : undefined}
                  aria-readonly={locked || undefined}
                  onChange={() => toggleMust(item.id)}
                />
                <span>
                  {item.label}
                  {MAIN_MUST_DO.includes(item.id) ? (
                    <span
                      className="must-main-tag"
                      aria-label="главное"
                      title="Главное"
                    >
                      !
                    </span>
                  ) : null}
                  {parentOnly ? (
                    <span className="parent-marked"> · отметил родитель</span>
                  ) : null}
                </span>
              </label>
              {item.id === 'exercise' ? (
                <>
                  {day.exercisePartial && !exerciseComplete ? (
                    <p className="hint">
                      Зарядка частично · {exerciseDone} из {exerciseTotal}
                      {workoutSec != null
                        ? ` · ${formatPlayTime(workoutSec)}`
                        : ''}
                    </p>
                  ) : workoutSec != null ? (
                    <p className="hint">
                      Сегодня зарядка заняла {formatPlayTime(workoutSec)}
                    </p>
                  ) : null}
                  <button type="button" className="linkish" onClick={onOpenExercises}>
                    Открыть упражнения →
                  </button>
                </>
              ) : null}
              {item.id === 'chew' ? (
                <>
                  {chewSec != null ? (
                    <p className="hint">
                      Сегодня жевание заняло {formatPlayTime(chewSec)}
                    </p>
                  ) : null}
                  <button type="button" className="linkish" onClick={onOpenChew}>
                    Открыть дневник жевания →
                  </button>
                </>
              ) : null}
              {item.id === 'read' ? (
                <>
                  {(data.readingBooks ?? []).length > 0 ? (
                    <p className="hint">
                      Сейчас читаешь:{' '}
                      <strong>
                        {(data.readingBooks ?? []).map((b) => b.title).join(', ')}
                      </strong>
                    </p>
                  ) : null}
                </>
              ) : null}
              {item.id === 'create' ? (
                <div className="create-box">
                  {day.createIdeas.length ||
                  day.puzzlePieces > 0 ||
                  day.legoPieces > 0 ||
                  day.createNote.trim() ? (
                    <p className="hint create-chosen">
                      Сегодня:{' '}
                      <strong>
                        {[
                          day.puzzlePieces > 0
                            ? formatCreatePieceLabel('puzzle', day.puzzlePieces)
                            : null,
                          day.legoPieces > 0
                            ? formatCreatePieceLabel('lego', day.legoPieces)
                            : null,
                          ...day.createIdeas,
                          day.createNote.trim() || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </strong>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setCreateOpen((v) => !v)}
                  >
                    {createOpen
                      ? 'Скрыть выбор'
                      : day.createIdeas.length ||
                          day.puzzlePieces > 0 ||
                          day.legoPieces > 0 ||
                          day.createNote.trim()
                        ? 'Добавить занятие →'
                        : 'Выбрать занятие →'}
                  </button>
                  {createOpen ? (
                    <div className="create-picker">
                      <div className="create-chip-grid">
                        {CREATE_IDEAS.map((idea) => {
                          const kind = CREATE_KIND_BY_IDEA[idea]
                          if (kind === 'puzzle' || kind === 'lego') {
                            const count =
                              kind === 'puzzle'
                                ? day.puzzlePieces
                                : day.legoPieces
                            if (count > 0) {
                              return (
                                <div
                                  key={idea}
                                  className="chip active create-cart-chip"
                                  role="group"
                                  aria-label={`${idea}, ${count}`}
                                >
                                  <button
                                    type="button"
                                    className="create-cart-step"
                                    aria-label="Меньше"
                                    onClick={() => {
                                      const next = count - 1
                                      if (kind === 'puzzle') {
                                        patchDay({
                                          puzzlePieces: next,
                                          createKinds: createKindsFromPieces(
                                            next,
                                            day.legoPieces,
                                          ),
                                        })
                                      } else {
                                        patchDay({
                                          legoPieces: next,
                                          createKinds: createKindsFromPieces(
                                            day.puzzlePieces,
                                            next,
                                          ),
                                        })
                                      }
                                    }}
                                  >
                                    −
                                  </button>
                                  <span className="create-cart-label">
                                    {idea}: {count}
                                  </span>
                                  <button
                                    type="button"
                                    className="create-cart-step"
                                    aria-label="Больше"
                                    disabled={count >= CREATE_PIECE_MAX}
                                    onClick={() => {
                                      const next = Math.min(
                                        CREATE_PIECE_MAX,
                                        count + 1,
                                      )
                                      if (kind === 'puzzle') {
                                        patchDay({
                                          puzzlePieces: next,
                                          createKinds: createKindsFromPieces(
                                            next,
                                            day.legoPieces,
                                          ),
                                        })
                                      } else {
                                        patchDay({
                                          legoPieces: next,
                                          createKinds: createKindsFromPieces(
                                            day.puzzlePieces,
                                            next,
                                          ),
                                        })
                                      }
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              )
                            }
                            return (
                              <button
                                key={idea}
                                type="button"
                                className="chip"
                                onClick={() => {
                                  if (kind === 'puzzle') {
                                    patchDay({
                                      puzzlePieces: 1,
                                      createKinds: createKindsFromPieces(
                                        1,
                                        day.legoPieces,
                                      ),
                                    })
                                  } else {
                                    patchDay({
                                      legoPieces: 1,
                                      createKinds: createKindsFromPieces(
                                        day.puzzlePieces,
                                        1,
                                      ),
                                    })
                                  }
                                }}
                              >
                                {idea}
                              </button>
                            )
                          }
                          const active = day.createIdeas.includes(idea)
                          return (
                            <button
                              key={idea}
                              type="button"
                              className={active ? 'chip active' : 'chip'}
                              onClick={() => {
                                const nextIdeas = toggleCreateIdea(
                                  day.createIdeas,
                                  idea,
                                )
                                patchDay({ createIdeas: nextIdeas })
                              }}
                            >
                              {idea}
                            </button>
                          )
                        })}
                      </div>
                      <label className="field">
                        <span>Или своё</span>
                        <input
                          value={day.createNote}
                          onChange={(e) => {
                            patchDay({ createNote: e.target.value })
                          }}
                          onBlur={() => {
                            if (
                              day.createNote.trim() ||
                              day.createIdeas.length ||
                              day.puzzlePieces > 0 ||
                              day.legoPieces > 0
                            ) {
                              setCreateOpen(false)
                            }
                          }}
                          placeholder="Напиши сам"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
            </Fragment>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Роскошный максимум</h2>
          <span className="pill muted">не в звёзды</span>
        </div>
        {optionalItems.length ? (
          <ul className="check-list">
            {optionalItems.map((item) => (
              <li key={item.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={isMustChecked(item.id)}
                    onChange={() => toggleMust(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
                {item.id === 'read' && (data.readingBooks ?? []).length > 0 ? (
                  <p className="hint">
                    Сейчас читаешь:{' '}
                    <strong>
                      {(data.readingBooks ?? []).map((b) => b.title).join(', ')}
                    </strong>
                  </p>
                ) : null}
                {item.id === 'create' ? (
                  <div className="create-box">
                    {day.createIdeas.length ||
                    day.puzzlePieces > 0 ||
                    day.legoPieces > 0 ||
                    day.createNote.trim() ? (
                      <p className="hint create-chosen">
                        Сегодня:{' '}
                        <strong>
                          {[
                            day.puzzlePieces > 0
                              ? formatCreatePieceLabel(
                                  'puzzle',
                                  day.puzzlePieces,
                                )
                              : null,
                            day.legoPieces > 0
                              ? formatCreatePieceLabel('lego', day.legoPieces)
                              : null,
                            ...day.createIdeas,
                            day.createNote.trim() || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </strong>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setCreateOpen((v) => !v)}
                    >
                      {createOpen
                        ? 'Скрыть выбор'
                        : day.createIdeas.length ||
                            day.puzzlePieces > 0 ||
                            day.legoPieces > 0 ||
                            day.createNote.trim()
                          ? 'Добавить занятие →'
                          : 'Выбрать занятие →'}
                    </button>
                    {createOpen ? (
                      <div className="create-picker">
                        <div className="create-chip-grid">
                          {CREATE_IDEAS.map((idea) => {
                            const kind = CREATE_KIND_BY_IDEA[idea]
                            if (kind === 'puzzle' || kind === 'lego') {
                              const count =
                                kind === 'puzzle'
                                  ? day.puzzlePieces
                                  : day.legoPieces
                              if (count > 0) {
                                return (
                                  <div
                                    key={idea}
                                    className="chip active create-cart-chip"
                                    role="group"
                                    aria-label={`${idea}, ${count}`}
                                  >
                                    <button
                                      type="button"
                                      className="create-cart-step"
                                      aria-label="Меньше"
                                      onClick={() => {
                                        const next = count - 1
                                        patchDay(
                                          kind === 'puzzle'
                                            ? {
                                                puzzlePieces: next,
                                                createKinds:
                                                  createKindsFromPieces(
                                                    next,
                                                    day.legoPieces,
                                                  ),
                                              }
                                            : {
                                                legoPieces: next,
                                                createKinds:
                                                  createKindsFromPieces(
                                                    day.puzzlePieces,
                                                    next,
                                                  ),
                                              },
                                        )
                                      }}
                                    >
                                      −
                                    </button>
                                    <span className="create-cart-label">
                                      {idea}: {count}
                                    </span>
                                    <button
                                      type="button"
                                      className="create-cart-step"
                                      aria-label="Больше"
                                      disabled={count >= CREATE_PIECE_MAX}
                                      onClick={() => {
                                        const next = Math.min(
                                          CREATE_PIECE_MAX,
                                          count + 1,
                                        )
                                        patchDay(
                                          kind === 'puzzle'
                                            ? {
                                                puzzlePieces: next,
                                                createKinds:
                                                  createKindsFromPieces(
                                                    next,
                                                    day.legoPieces,
                                                  ),
                                              }
                                            : {
                                                legoPieces: next,
                                                createKinds:
                                                  createKindsFromPieces(
                                                    day.puzzlePieces,
                                                    next,
                                                  ),
                                              },
                                        )
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )
                              }
                              return (
                                <button
                                  key={idea}
                                  type="button"
                                  className="chip"
                                  onClick={() =>
                                    patchDay(
                                      kind === 'puzzle'
                                        ? {
                                            puzzlePieces: 1,
                                            createKinds: createKindsFromPieces(
                                              1,
                                              day.legoPieces,
                                            ),
                                          }
                                        : {
                                            legoPieces: 1,
                                            createKinds: createKindsFromPieces(
                                              day.puzzlePieces,
                                              1,
                                            ),
                                          },
                                    )
                                  }
                                >
                                  {idea}
                                </button>
                              )
                            }
                            const active = day.createIdeas.includes(idea)
                            return (
                              <button
                                key={idea}
                                type="button"
                                className={active ? 'chip active' : 'chip'}
                                onClick={() =>
                                  patchDay({
                                    createIdeas: toggleCreateIdea(
                                      day.createIdeas,
                                      idea,
                                    ),
                                  })
                                }
                              >
                                {idea}
                              </button>
                            )
                          })}
                        </div>
                        <label className="field">
                          <span>Или своё</span>
                          <input
                            value={day.createNote}
                            onChange={(e) =>
                              patchDay({ createNote: e.target.value })
                            }
                            placeholder="Напиши сам"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <ElectiveSchedule
          electives={data.electives ?? []}
          done={day.electiveDone ?? {}}
          date={key}
          onToggleDone={toggleElective}
        />
      </section>

      {key >= SCHOOL_GRADES_START ? (
        <SchoolGradesCard
          data={data}
          onChange={onChange}
          date={key}
          readOnly
        />
      ) : null}

      <section className="card">
        <div className="card-title-row">
          <h2>Планы на день</h2>
          {day.extraTasks.length ? (
            <span className="pill">
              {extraDone}/{day.extraTasks.length}
            </span>
          ) : null}
        </div>

        {day.extraTasks.length ? (
          <ul className="check-list">
            {day.extraTasks.map((task) => (
              <li key={task.id}>
                <div
                  className={
                    task.fromParent ? 'check-row' : 'check-row with-action'
                  }
                >
                  <label className="check-row-main">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleExtraTask(task.id)}
                    />
                    <span className={task.done ? 'is-done' : undefined}>
                      {task.text}
                      {task.fromParent ? (
                        <span className="hint">
                          {' '}
                          · от {task.fromParentAs?.trim() || 'родителя'}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {task.fromParent ? null : (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Удалить"
                      onClick={() => removeExtraTask(task.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="extra-picker-box">
          <button
            type="button"
            className="linkish"
            onClick={() => setExtraOpen((v) => !v)}
          >
            {extraOpen ? 'Скрыть выбор' : 'Быстро добавить →'}
          </button>
          {extraOpen ? (
            <div className="create-picker">
              <div className="create-chip-grid">
                {EXTRA_TASK_IDEAS.map((idea) => {
                  const exists = day.extraTasks.some((t) => t.text === idea)
                  return (
                    <button
                      key={idea}
                      type="button"
                      className={exists ? 'chip active' : 'chip'}
                      disabled={exists}
                      onClick={() => addExtraTask(idea)}
                    >
                      {idea}
                    </button>
                  )
                })}
              </div>
              <div className="add-row">
                <label className="field grow">
                  <span>Своё дело</span>
                  <input
                    value={extraDraft}
                    onChange={(e) => setExtraDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addExtraTask(extraDraft)
                      }
                    }}
                    placeholder="Например: разобрать стол"
                  />
                </label>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!extraDraft.trim()}
                  onClick={() => addExtraTask(extraDraft)}
                >
                  Добавить
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function formatRuDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
