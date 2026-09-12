import { useEffect, useMemo, useState } from 'react'
import {
  formatCreatePieceLabel,
  activeExercises,
  applyMustDoFlags,
  chewDurationSec,
  controlsForDate,
  formatPlayTime,
  formatTimeOfDay,
  clearExercisesCredit,
  markAllExercisesDone,
  markExercisesPartialCredit,
  normalizeDayLog,
  optionalMustDoItems,
  requiredMustDoItems,
  schoolDayPlanFromData,
  schoolRestLabel,
  isRestDay,
  isWeekendDate,
  NEW_DAY_PLAN_START,
  toggleSchoolBreakDay,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { ElectiveEditor, ElectiveSchedule } from './ElectiveSchedule'
import {
  bookTitleKey,
  dayStars,
  isPerfectDay,
  shiftDayKey,
  stampPerfectAt,
} from './progress'
import type { AppData, Elective, MustDoId } from './types'

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
  need: number
  perfect: boolean
  rest?: boolean
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
      need: 0,
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
      need: 0,
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
      need: 0,
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
    workoutFinishedAt: number | null
    chewFood: string | null
    chewSec: number | null
    chewSavedAt: number | null
  },
): string {
  if (id === 'exercise') {
    if (detail.exerciseDone === 0 && !detail.day.mustDo.exercise) {
      return 'не сделана'
    }
    // Legacy parent checkbox (mustDo only) or parent markAll without a timed session
    const parentMarked =
      Boolean(detail.day.mustDo.exercise) &&
      !detail.day.exercisePartial &&
      (detail.exerciseDone === 0 ||
        (detail.exerciseTotal > 0 &&
          detail.exerciseDone === detail.exerciseTotal &&
          detail.workoutSec == null &&
          detail.workoutFinishedAt == null))
    if (parentMarked && detail.exerciseDone === 0) return 'отметил родитель'
    if (parentMarked) {
      return `${detail.exerciseDone} из ${detail.exerciseTotal} · отметил родитель`
    }
    if (
      detail.day.exercisePartial &&
      detail.exerciseDone < detail.exerciseTotal
    ) {
      const parts = [
        `частично ${detail.exerciseDone} из ${detail.exerciseTotal}`,
        'отметил родитель',
      ]
      const at = detail.day.mustDoAt?.exercise
      if (at != null) parts.push(`зачёт в ${formatTimeOfDay(at)}`)
      if (detail.workoutSec != null) {
        parts.push(`заняла ${formatPlayTime(detail.workoutSec)}`)
      }
      return parts.join(' · ')
    }
    const doneAt =
      detail.workoutFinishedAt ?? detail.day.mustDoAt?.exercise ?? null
    const parts = [`${detail.exerciseDone} из ${detail.exerciseTotal}`]
    if (doneAt != null) {
      parts.push(`сделана в ${formatTimeOfDay(doneAt)}`)
    }
    if (detail.workoutSec != null) {
      parts.push(`заняла ${formatPlayTime(detail.workoutSec)}`)
    }
    return parts.join(' · ')
  }
  if (id === 'chew') {
    if (!detail.chewFood) {
      const at = detail.day.mustDoAt?.chew
      if (detail.day.mustDo.chew) {
        return at != null
          ? `отмечено родителем в ${formatTimeOfDay(at)}`
          : 'отмечено родителем'
      }
      return 'не заполнено'
    }
    const doneAt = detail.chewSavedAt ?? detail.day.mustDoAt?.chew ?? null
    const parts = [detail.chewFood]
    if (doneAt != null) {
      parts.push(`заполнено в ${formatTimeOfDay(doneAt)}`)
    }
    if (detail.chewSec != null) {
      parts.push(`заняло ${formatPlayTime(detail.chewSec)}`)
    }
    return parts.join(' · ')
  }
  const done = Boolean(detail.day.mustDo[id])
  const at = detail.day.mustDoAt?.[id]
  const atHint = at != null ? ` в ${formatTimeOfDay(at)}` : ''
  if (id === 'create') {
    const note = [
      detail.day.puzzlePieces > 0
        ? formatCreatePieceLabel('puzzle', detail.day.puzzlePieces)
        : null,
      detail.day.legoPieces > 0
        ? formatCreatePieceLabel('lego', detail.day.legoPieces)
        : null,
      ...(detail.day.createIdeas ?? []),
      detail.day.createNote.trim(),
    ]
      .filter(Boolean)
      .join(' · ')
    if (done) {
      return note
        ? `сделано${atHint} — ${note}`
        : `сделано${atHint}`
    }
    return note ? `не сделано — ${note}` : 'не сделано'
  }
  return done ? `сделано${atHint}` : 'не сделано'
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
  const [bookDraft, setBookDraft] = useState('')
  const [addingBook, setAddingBook] = useState(false)

  const canEditSelected = Boolean(
    canEditMustDo && onChange && selected <= today,
  )
  const plan = useMemo(
    () => schoolDayPlanFromData(data),
    [data.extraBreakDates, data.extraSchoolDates],
  )
  const restLabel = schoolRestLabel(selected, plan)
  const selectedIsRest = isRestDay(selected, plan)

  useEffect(() => {
    setMarkingForChild(false)
  }, [selected])

  function patchSelected(partial: Partial<ReturnType<typeof normalizeDayLog>>) {
    if (!onChange || selected > today) return
    const day = normalizeDayLog(selected, data.days[selected])
    const next = stampPerfectAt(
      day,
      normalizeDayLog(selected, { ...day, ...partial }),
      plan,
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [selected]: next,
      },
    })
  }

  function toggleMust(id: MustDoId) {
    if (!canEditSelected || !onChange) return
    const day = normalizeDayLog(selected, data.days[selected])
    const nextChecked = !day.mustDo[id]
    if (id === 'exercise' && nextChecked) {
      const marked = stampPerfectAt(
        day,
        markAllExercisesDone(day, data.exercises),
        plan,
      )
      onChange({
        ...data,
        days: {
          ...data.days,
          [selected]: marked,
        },
      })
      return
    }
    if (id === 'exercise' && !nextChecked) {
      const cleared = stampPerfectAt(day, clearExercisesCredit(day), plan)
      onChange({
        ...data,
        days: {
          ...data.days,
          [selected]: cleared,
        },
      })
      return
    }
    patchSelected(applyMustDoFlags(day, { [id]: nextChecked }))
  }

  function toggleExercisePartial() {
    if (!canEditSelected || !onChange) return
    const day = normalizeDayLog(selected, data.days[selected])
    const active = activeExercises(data.exercises)
    const everyDone =
      active.length > 0 && active.every((e) => day.exercisesDone[e.id])
    if (everyDone) return
    const next = day.exercisePartial
      ? clearExercisesCredit(day)
      : markExercisesPartialCredit(day)
    onChange({
      ...data,
      days: {
        ...data.days,
        [selected]: stampPerfectAt(day, next, plan),
      },
    })
  }

  function toggleElective(id: string) {
    if (!canEditSelected) return
    const day = normalizeDayLog(selected, data.days[selected])
    patchSelected({
      electiveDone: {
        ...day.electiveDone,
        [id]: !day.electiveDone[id],
      },
    })
  }

  function saveElectives(next: Elective[]) {
    if (!onChange) return
    onChange({
      ...data,
      electives: next,
      electivesUpdatedAt: Date.now(),
    })
  }

  const readingBooks = data.readingBooks ?? []
  const finishedBooks = data.finishedBooks ?? []

  function addReadingBook() {
    if (!onChange) return
    const title = bookDraft.trim()
    if (!title) return
    const bookKey = bookTitleKey(title)
    const alreadyReading = readingBooks.some(
      (b) => bookTitleKey(b.title) === bookKey,
    )
    const alreadyFinished = finishedBooks.some(
      (b) => bookTitleKey(b.title) === bookKey,
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
      (b) => bookTitleKey(b.title) === bookTitleKey(book.title),
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
      const stars = dayStars(log, plan)
      const need = requiredMustDoItems(cell.date, plan).length
      return {
        ...cell,
        stars,
        need,
        perfect: isPerfectDay(log, plan),
        rest: isRestDay(cell.date, plan),
      }
    })
  }, [
    cursor.year,
    cursor.month,
    data.days,
    data.extraBreakDates,
    data.extraSchoolDates,
    plan,
    today,
  ])

  const detail = useMemo(() => {
    const day = normalizeDayLog(selected, data.days[selected])
    const chewEntry = (data.chewEntries ?? [])
      .filter((e) => e.date === selected)
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    const active = activeExercises(data.exercises)
    const exerciseTotal = active.length
    const exerciseDone = active.filter((e) =>
      Boolean(day.exercisesDone[e.id]),
    ).length
    const dayControls = controlsForDate(data.exerciseControls, selected)
    return {
      day,
      stars: dayStars(day, plan),
      perfect: isPerfectDay(day, plan),
      exerciseTotal,
      exerciseDone,
      workoutSec: workoutDurationSec(day),
      workoutFinishedAt: day.workoutFinishedAt,
      chewFood: chewEntry?.food ?? null,
      chewSec: chewEntry ? chewDurationSec(chewEntry) : null,
      chewSavedAt: chewEntry?.createdAt ?? null,
      dayControls,
    }
  }, [data, plan, selected])

  const selectedRequired = requiredMustDoItems(selected, plan)
  const selectedOptional = optionalMustDoItems(selected, plan)

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const canGoNext = (() => {
    const limit = new Date(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)) - 1 + 18,
      1,
    )
    const cursorDate = new Date(cursor.year, cursor.month, 1)
    return cursorDate < limit
  })()

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
        </div>
        <h1>Дни</h1>
        <p className="sub">Сводка, оценки и планы</p>
      </header>

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
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={[
                    'calendar-day',
                    cell.inMonth ? '' : 'out',
                    cell.isToday ? 'today' : '',
                    selected === cell.date ? 'selected' : '',
                    cell.perfect ? 'perfect' : '',
                    cell.rest ? 'rest' : '',
                    cell.isFuture ? 'future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected(cell.date)}
                >
                  <span className="calendar-day-num">{cell.dayNum}</span>
                  {cell.inMonth ? (
                    <span className="calendar-day-stars" aria-hidden>
                      {Array.from({ length: cell.need }, (_, i) => (
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
              : `${detail.stars}/${requiredMustDoItems(selected, plan).length}`}
          </span>
        </div>

        {selected >= NEW_DAY_PLAN_START ? (
          isWeekendDate(selected) ? (
            <p className="hint" style={{ marginTop: 10 }}>
              Выходной · домашки и рюкзака нет, план как в субботу
            </p>
          ) : onChange ? (
            <label className="check-row" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={selectedIsRest}
                onChange={() => onChange(toggleSchoolBreakDay(data, selected))}
              />
              <span>
                Каникулы
                <span className="hint">
                  {restLabel
                    ? ` · ${restLabel}, домашки и рюкзака нет`
                    : ' — план как в выходной, без домашки и рюкзака'}
                </span>
              </span>
            </label>
          ) : restLabel ? (
            <p className="hint" style={{ marginTop: 10 }}>
              {restLabel} · домашки и рюкзака нет
            </p>
          ) : null
        ) : null}

        {markingForChild && canEditSelected ? (
          <ul className="check-list" style={{ marginTop: 10 }}>
            {selectedRequired.map((item) => (
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
                {item.id === 'exercise' &&
                detail.exerciseTotal > 0 &&
                detail.exerciseDone < detail.exerciseTotal ? (
                  <label className="check-row" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(detail.day.exercisePartial)}
                      onChange={toggleExercisePartial}
                    />
                    <span>
                      Частичный зачёт
                      <span className="hint">
                        {' '}
                        — звезда без полного комплекса
                      </span>
                    </span>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          selectedRequired.map((item) => (
            <div key={item.id} className="calendar-detail-block">
              <h3>{item.label}</h3>
              <p className="hint">{mustDoStatusHint(item.id, detail)}</p>
            </div>
          ))
        )}

        {detail.dayControls.length > 0 ? (
          <div className="calendar-detail-block">
            <h3>Контроль (видео)</h3>
            <ul className="calendar-exercise-list">
              {detail.dayControls.map((c) => {
                const name =
                  data.exercises.find((e) => e.id === c.exerciseId)?.name ??
                  c.exerciseId
                return (
                  <li key={c.id} className={c.filmed ? 'done' : ''}>
                    {c.filmed ? '✓' : '·'} {name}
                    {c.filmed ? ' · снято' : ' · снять на видео'}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Роскошный максимум</h2>
          <span className="pill muted">не в звёзды</span>
        </div>
        {markingForChild && canEditSelected && selectedOptional.length ? (
          <ul className="check-list" style={{ marginTop: 10 }}>
            {selectedOptional.map((item) => (
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
          selectedOptional.map((item) => (
            <div key={item.id} className="calendar-detail-block">
              <h3>{item.label}</h3>
              <p className="hint">{mustDoStatusHint(item.id, detail)}</p>
            </div>
          ))
        )}
        <ElectiveSchedule
          electives={data.electives ?? []}
          done={detail.day.electiveDone ?? {}}
          date={selected}
          onToggleDone={canEditSelected ? toggleElective : undefined}
        />
      </section>

      {canEditMustDo && onChange ? (
        <details className="parent-calendar-fold">
          <summary className="parent-calendar-fold-head">
            <span className="parent-calendar-fold-title">
              Расписание факультативов
            </span>
            <span
              className={
                (data.electives ?? []).length ? 'pill' : 'pill muted'
              }
            >
              {(data.electives ?? []).length}
            </span>
          </summary>
          <div className="parent-fold-body">
            <p className="hint">
              Ребёнок видит занятия только в нужный день
            </p>
            <ElectiveEditor
              electives={data.electives ?? []}
              onChange={saveElectives}
            />
          </div>
        </details>
      ) : null}

      {canEditMustDo && onChange ? (
        <>
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
      ) : null}
    </div>
  )
}
