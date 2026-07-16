import { useState } from 'react'
import {
  CREATE_IDEAS,
  EXTRA_TASK_IDEAS,
  MUST_DO_ITEMS,
  normalizeDayLog,
  todayKey,
  uid,
} from './data'
import { ScreenLimitCard } from './ScreenLimitCard'
import type { AppData, MustDoId, ScreenKind, ScreenSlot } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  onOpenExercises: () => void
  onOpenChew: () => void
  onOpenSettings: () => void
}

export function TodayScreen({
  data,
  onChange,
  onOpenExercises,
  onOpenChew,
  onOpenSettings,
}: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const doneCount = MUST_DO_ITEMS.filter((i) => day.mustDo[i.id]).length
  const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const exerciseTotal = data.exercises.length
  const extraDone = day.extraTasks.filter((t) => t.done).length
  const [extraDraft, setExtraDraft] = useState('')

  function patchDay(partial: Partial<typeof day>) {
    const next = normalizeDayLog(key, { ...day, ...partial })
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  function toggleMust(id: MustDoId) {
    patchDay({
      mustDo: { ...day.mustDo, [id]: !day.mustDo[id] },
    })
  }

  function setScreen(kind: ScreenKind, slot: ScreenSlot) {
    patchDay({
      screens: {
        ...day.screens,
        [kind]: slot,
      },
    })
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
    patchDay({
      extraTasks: day.extraTasks.filter((t) => t.id !== id),
    })
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Сегодня</p>
          <button
            type="button"
            className="btn ghost settings-btn"
            onClick={onOpenSettings}
            aria-label="Настройки"
          >
            ⚙
          </button>
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

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <p className="hint">Время можно сдвигать — главное отметить сделанное.</p>
        <ul className="check-list">
          {MUST_DO_ITEMS.map((item) => (
            <li key={item.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(day.mustDo[item.id])}
                  onChange={() => toggleMust(item.id)}
                />
                <span>{item.label}</span>
              </label>
              {item.id === 'exercise' ? (
                <button type="button" className="linkish" onClick={onOpenExercises}>
                  Открыть упражнения →
                </button>
              ) : null}
              {item.id === 'chew' ? (
                <button type="button" className="linkish" onClick={onOpenChew}>
                  Открыть дневник жевания →
                </button>
              ) : null}
              {item.id === 'create' ? (
                <div className="create-box">
                  <p className="hint">Выбери одно занятие на сегодня:</p>
                  <div className="chip-row">
                    {CREATE_IDEAS.map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        className={day.createNote === idea ? 'chip active' : 'chip'}
                        onClick={() =>
                          patchDay({
                            createNote: idea,
                            mustDo: { ...day.mustDo, create: true },
                          })
                        }
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>Или своё</span>
                    <input
                      value={CREATE_IDEAS.includes(day.createNote) ? '' : day.createNote}
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
                      placeholder="Напиши сам"
                    />
                  </label>
                </div>
              ) : null}
            </li>
          ))}
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
        <p className="hint">
          Разовые важные дела на сегодня — сверх обязательного минимума. На следующий
          день список будет пустым.
        </p>

        {day.extraTasks.length ? (
          <ul className="check-list">
            {day.extraTasks.map((task) => (
              <li key={task.id}>
                <div className="check-row with-action">
                  <label className="check-row-main">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleExtraTask(task.id)}
                    />
                    <span className={task.done ? 'is-done' : undefined}>{task.text}</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Удалить"
                    onClick={() => removeExtraTask(task.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="hint" style={{ marginTop: 12 }}>
          Быстро добавить:
        </p>
        <div className="chip-row">
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
      </section>

      <section className="card">
        <h2>Roblox — лимит времени</h2>
        <p className="hint">
          Это не «надо сделать», а ограничение. Нажми «Начать» — запустится таймер.
          Когда время вышло, на сегодня лимит использован.
        </p>
        <div className="screen-limits">
          <ScreenLimitCard
            kind="roblox"
            slot={day.screens.roblox}
            onChange={(slot) => setScreen('roblox', slot)}
          />
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
