import { useEffect, useState } from 'react'
import {
  EXTRA_TASK_IDEAS,
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  formatPlayTime,
  normalizeDayLog,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { robloxLimitSeconds } from './progress'
import type { AppData, MustDoId } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  onOpenExercises: () => void
  onOpenChew: () => void
  onOpenSettings: () => void
}

export function ParentSummaryScreen({
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
  const workoutSec = workoutDurationSec(day)
  const extraDone = day.extraTasks.filter((t) => t.done).length
  const chewToday = (data.chewEntries ?? [])
    .filter((e) => e.date === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const chewSec = chewToday ? chewDurationSec(chewToday) : null

  const roblox = day.screens.roblox
  const limitSec = robloxLimitSeconds(data.days, key)
  const running = Boolean(roblox.endsAt && !roblox.finished)
  const [now, setNow] = useState(Date.now())
  const [extraDraft, setExtraDraft] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [bookDraft, setBookDraft] = useState('')
  const [addingBook, setAddingBook] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const livePlayed =
    running && roblox.endsAt
      ? Math.max(
          0,
          Math.floor((now - (roblox.endsAt - roblox.remainingSec * 1000)) / 1000),
        )
      : 0
  const displayUsed = Math.min(limitSec, roblox.usedSec + livePlayed)
  const statusLabel = roblox.finished
    ? 'лимит'
    : running
      ? 'сейчас играет'
      : roblox.usedSec > 0
        ? 'пауза'
        : 'ещё не играл'

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

  function addExtraTask(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const already = day.extraTasks.some(
      (t) => t.text.toLowerCase() === trimmed.toLowerCase(),
    )
    if (already) return
    patchDay({
      extraTasks: [
        ...day.extraTasks,
        { id: uid(), text: trimmed, done: false, fromParent: true },
      ],
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

  const readingBooks = data.readingBooks ?? []
  const finishedBooks = data.finishedBooks ?? []

  function addReadingBook() {
    const title = bookDraft.trim()
    if (!title) return
    const key = title.toLowerCase()
    const alreadyReading = readingBooks.some(
      (b) => b.title.toLowerCase() === key,
    )
    const alreadyFinished = finishedBooks.some(
      (b) => b.title.toLowerCase() === key,
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

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
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
          Минимум {doneCount}/{MUST_DO_ITEMS.length} · зарядка {exerciseDone}/
          {exerciseTotal || 0}
          {day.extraTasks.length
            ? ` · ещё ${extraDone}/${day.extraTasks.length}`
            : ''}
        </p>
      </header>

      <section className="card parent-screen-card">
        <div className="card-title-row">
          <h2>Компьютер / {SCREEN_LIMITS.roblox.label}</h2>
          <span className={roblox.finished || running ? 'pill' : 'pill muted'}>
            {statusLabel}
          </span>
        </div>
        <p className="parent-play-time">{formatPlayTime(displayUsed)}</p>
        <p className="hint">из {Math.round(limitSec / 60)} мин на сегодня</p>
        <div className="play-bar" aria-hidden>
          <div
            className="play-bar-fill"
            style={{ width: `${Math.min(100, (displayUsed / limitSec) * 100)}%` }}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <p className="hint">
          Можно отметить за ребёнка, если сделал, но забыл поставить галочку.
        </p>
        <ul className="check-list">
          {MUST_DO_ITEMS.map((item) => (
            <li key={item.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(day.mustDo[item.id])}
                  onChange={() => toggleMust(item.id)}
                />
                <span>
                  {item.label}
                  {item.id === 'create' && day.createNote ? (
                    <span className="hint"> — {day.createNote}</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Книги</h2>
          {finishedBooks.length || readingBooks.length ? (
            <span className="pill">
              {finishedBooks.length}/{finishedBooks.length + readingBooks.length}
            </span>
          ) : null}
        </div>
        <p className="hint">
          Добавь книгу, которую сейчас читает ребёнок. Когда дочитаете — нажми
          «Дочитали».
        </p>

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
        ) : (
          <p className="hint" style={{ marginTop: 10 }}>
            Пока нет книг в списке.
          </p>
        )}

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
          Задания для ребёнка сверх минимума. Появятся у него на сегодня через
          облако.
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
                    <span className={task.done ? 'is-done' : undefined}>
                      {task.text}
                    </span>
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
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Зарядка</h2>
          <span className="pill">
            {exerciseDone}/{exerciseTotal || 0}
          </span>
        </div>
        <p className="hint">
          {exerciseDone === 0
            ? 'Пока ничего не отмечено в упражнениях.'
            : exerciseDone === exerciseTotal
              ? 'Весь комплекс отмечен.'
              : `Сделано ${exerciseDone} из ${exerciseTotal}.`}
        </p>
        {workoutSec != null ? (
          <p className="sub" style={{ marginTop: 8 }}>
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
        <div className="row-gap">
          <button type="button" className="btn" onClick={onOpenExercises}>
            Смотреть упражнения →
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Дневник жевания</h2>
          <span className={chewToday ? 'pill' : 'pill muted'}>
            {chewToday ? 'есть' : 'нет'}
          </span>
        </div>
        {chewToday ? (
          <>
            <p>
              <strong>{chewToday.food}</strong>
            </p>
            <p className="hint">Левая: {chewToday.left.join(', ')}</p>
            <p className="hint">Правая: {chewToday.right.join(', ')}</p>
            {chewSec != null ? (
              <p className="sub" style={{ marginTop: 8 }}>
                Сегодня жевание заняло {formatPlayTime(chewSec)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="hint">Сегодня ещё не заполнено.</p>
        )}
        <div className="row-gap">
          <button type="button" className="btn" onClick={onOpenChew}>
            Открыть дневник →
          </button>
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
