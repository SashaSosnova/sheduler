import { useEffect, useRef, useState } from 'react'
import { Confetti } from './Confetti'
import {
  APP_LOCKED_MUST_DO,
  CREATE_IDEAS,
  EXTRA_TASK_IDEAS,
  MAIN_MUST_DO,
  MUST_DO_ITEMS,
  chewDurationSec,
  formatPlayTime,
  normalizeDayLog,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { stampPerfectAt } from './progress'
import {
  ReminderSection,
  TodayTimedReminderBanner,
} from './ReminderSection'
import { playDing } from './sound'
import { useTomSawyerReadToday } from './tomSawyerSync'
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
  const day = normalizeDayLog(key, data.days[key])
  const doneCount = MUST_DO_ITEMS.filter((i) => day.mustDo[i.id]).length
  const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const exerciseTotal = data.exercises.length
  const workoutSec = workoutDurationSec(day)
  const chewToday = (data.chewEntries ?? [])
    .filter((e) => e.date === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const chewSec = chewToday ? chewDurationSec(chewToday) : null
  const exerciseComplete =
    exerciseTotal > 0 && exerciseDone === exerciseTotal
  const chewComplete = Boolean(chewToday)
  const readComplete = useTomSawyerReadToday()
  const extraDone = day.extraTasks.filter((t) => t.done).length
  const [extraDraft, setExtraDraft] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const prevDoneRef = useRef(doneCount)

  useEffect(() => {
    if (
      prevDoneRef.current < MUST_DO_ITEMS.length &&
      doneCount >= MUST_DO_ITEMS.length
    ) {
      playDing()
      setCelebrate(true)
    }
    prevDoneRef.current = doneCount
  }, [doneCount])

  function patchDay(partial: Partial<typeof day>) {
    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, { ...day, ...partial }),
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  // Auto-mark exercise/chew/read when done in-app; never clear a parent override
  useEffect(() => {
    const nextExercise = exerciseComplete || Boolean(day.mustDo.exercise)
    const nextChew = chewComplete || Boolean(day.mustDo.chew)
    const nextRead = readComplete || Boolean(day.mustDo.read)
    if (
      day.mustDo.exercise === nextExercise &&
      day.mustDo.chew === nextChew &&
      day.mustDo.read === nextRead
    ) {
      return
    }
    patchDay({
      mustDo: {
        ...day.mustDo,
        exercise: nextExercise,
        chew: nextChew,
        read: nextRead,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exerciseComplete,
    chewComplete,
    readComplete,
    day.mustDo.exercise,
    day.mustDo.chew,
    day.mustDo.read,
  ])

  function toggleMust(id: MustDoId) {
    if (APP_LOCKED_MUST_DO.includes(id)) return
    patchDay({
      mustDo: { ...day.mustDo, [id]: !day.mustDo[id] },
    })
  }

  function isMustChecked(id: MustDoId): boolean {
    if (id === 'exercise') return exerciseComplete
    if (id === 'chew') return chewComplete
    if (id === 'read') return readComplete || Boolean(day.mustDo.read)
    return Boolean(day.mustDo[id])
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
          Сделано {doneCount} из {MUST_DO_ITEMS.length} · зарядка {exerciseDone}/
          {exerciseTotal || 0}
          {day.extraTasks.length
            ? ` · ещё ${extraDone}/${day.extraTasks.length}`
            : ''}
        </p>
      </header>

      <TodayTimedReminderBanner data={data} onChange={onChange} />

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <p className="hint">
          Зарядку, жевание и книгу отмечает приложение. Остальное можно отметить
          самому.
        </p>
        <ul className="check-list">
          {MUST_DO_ITEMS.map((item) => {
            const locked = APP_LOCKED_MUST_DO.includes(item.id)
            return (
            <li
              key={item.id}
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
                    <span className="must-main-tag"> главное</span>
                  ) : null}
                </span>
              </label>
              {item.id === 'exercise' ? (
                <>
                  {workoutSec != null ? (
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
                  {day.createNote ? (
                    <p className="hint create-chosen">
                      Сегодня: <strong>{day.createNote}</strong>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setCreateOpen((v) => !v)}
                  >
                    {createOpen
                      ? 'Скрыть выбор'
                      : day.createNote
                        ? 'Сменить занятие →'
                        : 'Выбрать занятие →'}
                  </button>
                  {createOpen ? (
                    <div className="create-picker">
                      <div className="create-chip-grid">
                        {CREATE_IDEAS.map((idea) => (
                          <button
                            key={idea}
                            type="button"
                            className={
                              day.createNote === idea ? 'chip active' : 'chip'
                            }
                            onClick={() => {
                              patchDay({
                                createNote: idea,
                                mustDo: { ...day.mustDo, create: true },
                              })
                              setCreateOpen(false)
                            }}
                          >
                            {idea}
                          </button>
                        ))}
                      </div>
                      <label className="field">
                        <span>Или своё</span>
                        <input
                          value={
                            CREATE_IDEAS.includes(day.createNote)
                              ? ''
                              : day.createNote
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            patchDay({
                              createNote: v,
                              mustDo: {
                                ...day.mustDo,
                                create: Boolean(v.trim()),
                              },
                            })
                          }}
                          onBlur={() => {
                            if (day.createNote.trim()) setCreateOpen(false)
                          }}
                          placeholder="Напиши сам"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Планы на день</h2>
          {day.extraTasks.length ? (
            <span className="pill">
              {extraDone}/{day.extraTasks.length}
            </span>
          ) : null}
        </div>
        <p className="hint">Сверх минимума · только на сегодня</p>

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

      <ReminderSection data={data} onChange={onChange} />
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
