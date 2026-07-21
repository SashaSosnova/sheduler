import { useEffect, useMemo, useState } from 'react'
import {
  EXTRA_TASK_IDEAS,
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  formatPlayTime,
  formatPlayTimeWithOvertime,
  normalizeDayLog,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { loadParentLabel } from './parentAlerts'
import { dayStars, isPerfectDay, shiftDayKey } from './progress'
import {
  ReminderSection,
  TodayTimedReminderBanner,
} from './ReminderSection'
import type { AppData, MustDoId } from './types'

type Props = {
  data: AppData
  /** Parent can mark must-dos for past/today if the child forgot */
  canEditMustDo?: boolean
  onChange?: (next: AppData) => void
}

type CalCell = {
  date: string
  dayNum: number
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  stars: number
  perfect: boolean
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

function buildMonthCells(year: number, month: number, today: string): CalCell[] {
  const first = new Date(year, month, 1)
  // Monday-first: Sun=0 → 6, Mon=1 → 0, …
  const startPad = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalCell[] = []

  for (let i = 0; i < startPad; i++) {
    const date = shiftDayKey(
      `${year}-${String(month + 1).padStart(2, '0')}-01`,
      -(startPad - i),
    )
    const d = Number(date.slice(-2))
    cells.push({
      date,
      dayNum: d,
      inMonth: false,
      isToday: date === today,
      isFuture: date > today,
      stars: 0,
      perfect: false,
    })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      date,
      dayNum: d,
      inMonth: true,
      isToday: date === today,
      isFuture: date > today,
      stars: 0,
      perfect: false,
    })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!
    const date = shiftDayKey(last.date, 1)
    const d = Number(date.slice(-2))
    cells.push({
      date,
      dayNum: d,
      inMonth: false,
      isToday: date === today,
      isFuture: date > today,
      stars: 0,
      perfect: false,
    })
  }

  return cells
}

function formatFullDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function mustDoStatusHint(
  id: MustDoId,
  detail: {
    day: ReturnType<typeof normalizeDayLog>
    exerciseDone: number
    exerciseTotal: number
    workoutSec: number | null
    chewFood: string | null
    chewSec: number | null
  },
): string {
  if (id === 'exercise') {
    return `${detail.exerciseDone} из ${detail.exerciseTotal}${
      detail.workoutSec != null
        ? ` · заняла ${formatPlayTime(detail.workoutSec)}`
        : detail.exerciseDone > 0
          ? ''
          : ' · не сделана'
    }`
  }
  if (id === 'chew') {
    if (!detail.chewFood) return 'не заполнено'
    return `${detail.chewFood}${
      detail.chewSec != null
        ? ` · заняло ${formatPlayTime(detail.chewSec)}`
        : ''
    }`
  }
  const done = Boolean(detail.day.mustDo[id])
  if (id === 'create') {
    const note = detail.day.createNote.trim()
    if (done) return note ? `сделано — ${note}` : 'сделано'
    return note ? `не сделано — ${note}` : 'не сделано'
  }
  return done ? 'сделано' : 'не сделано'
}

export function CalendarScreen({
  data,
  canEditMustDo = false,
  onChange,
}: Props) {
  const today = todayKey()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [selected, setSelected] = useState<string>(today)
  const [markingForChild, setMarkingForChild] = useState(false)
  const [extraDraft, setExtraDraft] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [bookDraft, setBookDraft] = useState('')
  const [addingBook, setAddingBook] = useState(false)

  const canEditSelected = Boolean(
    canEditMustDo && onChange && selected <= today,
  )

  useEffect(() => {
    setMarkingForChild(false)
  }, [selected])

  function patchSelected(partial: Partial<ReturnType<typeof normalizeDayLog>>) {
    if (!onChange || selected > today) return
    const day = normalizeDayLog(selected, data.days[selected])
    onChange({
      ...data,
      days: {
        ...data.days,
        [selected]: { ...day, ...partial },
      },
    })
  }

  function toggleMust(id: MustDoId) {
    if (!canEditSelected) return
    const day = normalizeDayLog(selected, data.days[selected])
    patchSelected({
      mustDo: { ...day.mustDo, [id]: !day.mustDo[id] },
    })
  }

  function addExtraTask(text: string) {
    if (!canEditSelected || !onChange) return
    const trimmed = text.trim()
    if (!trimmed) return
    const day = normalizeDayLog(selected, data.days[selected])
    const already = day.extraTasks.some(
      (t) => t.text.toLowerCase() === trimmed.toLowerCase(),
    )
    if (already) return
    patchSelected({
      extraTasks: [
        ...day.extraTasks,
        {
          id: uid(),
          text: trimmed,
          done: false,
          fromParent: true,
          fromParentAs: loadParentLabel(),
        },
      ],
    })
    setExtraDraft('')
  }

  function toggleExtraTask(id: string) {
    if (!canEditSelected) return
    const day = normalizeDayLog(selected, data.days[selected])
    patchSelected({
      extraTasks: day.extraTasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    })
  }

  function removeExtraTask(id: string) {
    if (!canEditSelected) return
    const day = normalizeDayLog(selected, data.days[selected])
    patchSelected({
      extraTasks: day.extraTasks.filter((t) => t.id !== id),
      deletedExtraTaskIds: day.deletedExtraTaskIds.includes(id)
        ? day.deletedExtraTaskIds
        : [...day.deletedExtraTaskIds, id],
    })
  }

  const readingBooks = data.readingBooks ?? []
  const finishedBooks = data.finishedBooks ?? []

  function addReadingBook() {
    if (!onChange) return
    const title = bookDraft.trim()
    if (!title) return
    const bookKey = title.toLowerCase()
    const alreadyReading = readingBooks.some(
      (b) => b.title.toLowerCase() === bookKey,
    )
    const alreadyFinished = finishedBooks.some(
      (b) => b.title.toLowerCase() === bookKey,
    )
    if (alreadyReading || alreadyFinished) {
      setBookDraft('')
      setAddingBook(false)
      return
    }
    onChange({
      ...data,
      readingBooks: [...readingBooks, { id: uid(), title }],
    })
    setBookDraft('')
    setAddingBook(false)
  }

  function finishReadingBook(id: string) {
    if (!onChange) return
    const book = readingBooks.find((b) => b.id === id)
    if (!book) return
    const exists = finishedBooks.some(
      (b) => b.title.toLowerCase() === book.title.toLowerCase(),
    )
    onChange({
      ...data,
      readingBooks: readingBooks.filter((b) => b.id !== id),
      finishedBooks: exists
        ? finishedBooks
        : [
            ...finishedBooks,
            { id: book.id, title: book.title, finishedAt: Date.now() },
          ],
    })
  }

  const cells = useMemo(() => {
    const raw = buildMonthCells(cursor.year, cursor.month, today)
    return raw.map((cell) => {
      const log = normalizeDayLog(cell.date, data.days[cell.date])
      const stars = dayStars(log)
      return {
        ...cell,
        stars,
        perfect: stars === MUST_DO_ITEMS.length,
      }
    })
  }, [cursor.year, cursor.month, data.days, today])

  const detail = useMemo(() => {
    const day = normalizeDayLog(selected, data.days[selected])
    const chewEntry = (data.chewEntries ?? [])
      .filter((e) => e.date === selected)
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    const exerciseTotal = data.exercises.length
    const exerciseDone = data.exercises.filter((e) =>
      Boolean(day.exercisesDone[e.id]),
    ).length
    const extraDone = day.extraTasks.filter((t) => t.done).length
    return {
      day,
      stars: dayStars(day),
      perfect: isPerfectDay(day),
      exerciseTotal,
      exerciseDone,
      workoutSec: workoutDurationSec(day),
      chewFood: chewEntry?.food ?? null,
      chewSec: chewEntry ? chewDurationSec(chewEntry) : null,
      robloxUsed: day.screens.roblox.usedSec,
      robloxOvertime: day.screens.roblox.overtimeSec ?? 0,
      robloxBonusMin: day.robloxBonusMin ?? 0,
      extraDone,
    }
  }, [data, selected])

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const canGoNext =
    cursor.year < Number(today.slice(0, 4)) ||
    (cursor.year === Number(today.slice(0, 4)) &&
      cursor.month < Number(today.slice(5, 7)) - 1)

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
        </div>
        <h1>Дни</h1>
        <p className="sub">Сводка и планы</p>
      </header>

      {onChange ? (
        <TodayTimedReminderBanner data={data} onChange={onChange} asParent />
      ) : null}

      <details className="parent-calendar-fold">
        <summary className="parent-calendar-fold-head">
          <span className="parent-calendar-fold-title">Календарь</span>
          <span className="pill muted">{monthLabel(cursor.year, cursor.month)}</span>
        </summary>
        <section className="calendar-card parent-calendar-body">
          <div className="calendar-head">
            <button
              type="button"
              className="btn ghost calendar-nav"
              aria-label="Предыдущий месяц"
              onClick={() => shiftMonth(-1)}
            >
              ←
            </button>
            <h2 className="calendar-title">
              {monthLabel(cursor.year, cursor.month)}
            </h2>
            <button
              type="button"
              className="btn ghost calendar-nav"
              aria-label="Следующий месяц"
              disabled={!canGoNext}
              onClick={() => shiftMonth(1)}
            >
              →
            </button>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((cell) => {
              const disabled = cell.isFuture
              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={disabled}
                  className={[
                    'calendar-day',
                    cell.inMonth ? '' : 'out',
                    cell.isToday ? 'today' : '',
                    selected === cell.date ? 'selected' : '',
                    cell.perfect ? 'perfect' : '',
                    disabled ? 'future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected(cell.date)}
                >
                  <span className="calendar-day-num">{cell.dayNum}</span>
                  {cell.inMonth && !cell.isFuture ? (
                    <span className="calendar-day-stars" aria-hidden>
                      {MUST_DO_ITEMS.map((_, i) => (
                        <span
                          key={i}
                          className={i < cell.stars ? 'on' : 'off'}
                        >
                          ★
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="calendar-day-stars empty" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </details>

      <section className="card">
        <div className="card-title-row calendar-detail-head">
          <div className="calendar-detail-title-row">
            <h2 className="calendar-detail-title">{formatFullDate(selected)}</h2>
            {canEditSelected ? (
              <button
                type="button"
                className={
                  markingForChild
                    ? 'pill calendar-mark-child-chip'
                    : 'pill muted calendar-mark-child-chip'
                }
                onClick={() => setMarkingForChild((v) => !v)}
              >
                {markingForChild ? 'Готово' : 'Отметить за ребёнка'}
              </button>
            ) : null}
          </div>
          <span className={detail.perfect ? 'pill' : 'pill muted'}>
            {detail.perfect
              ? 'идеальный'
              : `${detail.stars}/${MUST_DO_ITEMS.length}`}
          </span>
        </div>

        {markingForChild && canEditSelected ? (
          <ul className="check-list" style={{ marginTop: 10 }}>
            {MUST_DO_ITEMS.map((item) => (
              <li key={item.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(detail.day.mustDo[item.id])}
                    onChange={() => toggleMust(item.id)}
                  />
                  <span>
                    {item.label}
                    <span className="hint">
                      {' '}
                      — {mustDoStatusHint(item.id, detail)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          MUST_DO_ITEMS.map((item) => (
            <div key={item.id} className="calendar-detail-block">
              <h3>{item.label}</h3>
              <p className="hint">{mustDoStatusHint(item.id, detail)}</p>
            </div>
          ))
        )}

        <div className="calendar-detail-block">
          <h3>Roblox</h3>
          <p className="hint">
            {detail.robloxUsed > 0 || detail.robloxOvertime > 0
              ? `Сыграно ${formatPlayTimeWithOvertime(
                  detail.robloxUsed,
                  detail.robloxOvertime,
                )} из ${Math.round(
                  (SCREEN_LIMITS.roblox.seconds + detail.robloxBonusMin * 60) /
                    60,
                )} мин`
              : 'Не запускал'}
            {detail.robloxBonusMin > 0
              ? ` · бонус +${detail.robloxBonusMin} мин`
              : ''}
          </p>
        </div>
      </section>

      {canEditMustDo && onChange ? (
        <>
          <section className="card">
            <div className="card-title-row">
              <h2>Планы на день</h2>
              {detail.day.extraTasks.length ? (
                <span className="pill">
                  {detail.extraDone}/{detail.day.extraTasks.length}
                </span>
              ) : null}
            </div>

            {detail.day.extraTasks.length ? (
              <ul className="check-list">
                {detail.day.extraTasks.map((task) => (
                  <li key={task.id}>
                    <div className="check-row with-action">
                      <label className="check-row-main">
                        <input
                          type="checkbox"
                          checked={task.done}
                          disabled={!canEditSelected}
                          onChange={() => toggleExtraTask(task.id)}
                        />
                        <span className={task.done ? 'is-done' : undefined}>
                          {task.text}
                        </span>
                      </label>
                      {canEditSelected ? (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Удалить"
                          onClick={() => removeExtraTask(task.id)}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {canEditSelected ? (
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
                        const exists = detail.day.extraTasks.some(
                          (t) => t.text === idea,
                        )
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
                          placeholder="Например: пропылесосить"
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
            ) : null}
          </section>

          <ReminderSection data={data} onChange={onChange} asParent />

          <section className="card">
            <div className="card-title-row">
              <h2>Книги</h2>
              {finishedBooks.length || readingBooks.length ? (
                <span className="pill">
                  {finishedBooks.length}/
                  {finishedBooks.length + readingBooks.length}
                </span>
              ) : null}
            </div>
            {readingBooks.length || finishedBooks.length ? (
              <ul className="check-list book-list">
                {readingBooks.map((book) => (
                  <li key={book.id}>
                    <div className="check-row with-action book-reading-row">
                      <span className="book-title">{book.title}</span>
                      <button
                        type="button"
                        className="btn primary book-finish-btn"
                        onClick={() => finishReadingBook(book.id)}
                      >
                        Дочитали
                      </button>
                    </div>
                  </li>
                ))}
                {finishedBooks.map((book) => (
                  <li key={book.id}>
                    <label className="check-row book-finished-row">
                      <input type="checkbox" checked readOnly tabIndex={-1} />
                      <span className="is-done">{book.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}

            {addingBook ? (
              <div className="book-add-box">
                <label className="field">
                  <span>Название книги</span>
                  <input
                    value={bookDraft}
                    onChange={(e) => setBookDraft(e.target.value)}
                    placeholder="Что читает?"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addReadingBook()
                      }
                    }}
                  />
                </label>
                <div className="row-gap">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!bookDraft.trim()}
                    onClick={addReadingBook}
                  >
                    Сохранить название
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setAddingBook(false)
                      setBookDraft('')
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="linkish"
                style={{ marginTop: 12 }}
                onClick={() => setAddingBook(true)}
              >
                Добавить новую книгу →
              </button>
            )}
          </section>
        </>
      ) : detail.day.extraTasks.length > 0 ||
        detail.day.reminders.length > 0 ? (
        <>
          {detail.day.extraTasks.length > 0 ? (
            <div className="card">
              <div className="calendar-detail-block" style={{ marginTop: 0 }}>
                <h3>Планы на день</h3>
                <ul className="calendar-exercise-list">
                  {detail.day.extraTasks.map((t) => (
                    <li key={t.id} className={t.done ? 'done' : ''}>
                      {t.done ? '✓' : '·'} {t.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {detail.day.reminders.length > 0 ? (
            <div className="card">
              <div className="calendar-detail-block" style={{ marginTop: 0 }}>
                <h3>Не забудь</h3>
                <ul className="calendar-exercise-list">
                  {detail.day.reminders.map((r) => (
                    <li key={r.id}>
                      · {r.time ? `${r.time} · ` : ''}
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
