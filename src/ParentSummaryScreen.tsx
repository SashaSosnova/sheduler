import { useEffect, useState } from 'react'
import {
  EXTRA_TASK_IDEAS,
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  flushScreenOvertime,
  formatPlayTime,
  formatPlayTimeWithOvertime,
  screenOvertimeSec,
  normalizeDayLog,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { loadParentLabel } from './parentAlerts'
import {
  dismissGiftSticker,
  giftMoneyBankRub,
  giftRobloxBankMinutes,
  payoutMoneyBankRub,
  pendingGiftStickers,
  robloxLimitSeconds,
  stampPerfectAt,
} from './progress'
import {
  ReminderSection,
  TodayTimedReminderBanner,
} from './ReminderSection'
import type { AppData, MustDoId } from './types'

const PARENT_BANK_GIFTS = [5, 10, 15, 30] as const
const PARENT_MONEY_GIFTS = [100, 200, 300] as const
const PARENT_MONEY_PAYOUTS = [100, 200, 300, 500] as const

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  onOpenExercises: () => void
  onOpenChew: () => void
}

export function ParentSummaryScreen({
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

  const timedOut =
    !roblox.finished && !running && roblox.remainingSec <= 0 && roblox.usedSec > 0
  const overtimeTicking = timedOut && roblox.overtimeStartedAt != null

  useEffect(() => {
    if (!running && !overtimeTicking) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running, overtimeTicking])

  const livePlayed =
    running && roblox.endsAt
      ? Math.max(
          0,
          Math.floor((now - (roblox.endsAt - roblox.remainingSec * 1000)) / 1000),
        )
      : 0
  const displayUsed = Math.min(limitSec, roblox.usedSec + livePlayed)
  const overtimeLive = screenOvertimeSec(roblox, now)
  const statusLabel = roblox.finished
    ? 'лимит закрыт'
    : running
      ? 'сейчас играет'
      : timedOut
        ? overtimeLive > 0 || overtimeTicking
          ? 'доигрывает сверх лимита'
          : 'время вышло'
        : roblox.usedSec > 0
          ? 'пауза'
          : 'ещё не играл'

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
  const pendingGifts = pendingGiftStickers(data)
  const moneyBank = Math.floor(data.moneyBankRub ?? 0)

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

      <TodayTimedReminderBanner data={data} onChange={onChange} asParent />

      <section className="card parent-screen-card">
        <div className="card-title-row">
          <h2>Компьютер / {SCREEN_LIMITS.roblox.label}</h2>
          <span className={roblox.finished || running ? 'pill' : 'pill muted'}>
            {statusLabel}
          </span>
        </div>
        <p className="parent-play-time">
          {formatPlayTimeWithOvertime(displayUsed, overtimeLive)}
        </p>
        <p className="hint">из {Math.round(limitSec / 60)} мин на сегодня</p>
        <div className="parent-roblox-bank">
          <p className="hint">
            Копилка бонусов:{' '}
            <strong>{Math.floor(data.robloxBonusBankMin ?? 0)} мин</strong>
            {(data.robloxBonusBankMin ?? 0) > 0
              ? ' (ребёнок ещё не потратил)'
              : ''}
          </p>
          <p className="hint">Поблагодарить сверх ачивок — закинуть минуты:</p>
          <div className="row-gap">
            {PARENT_BANK_GIFTS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => onChange(giftRobloxBankMinutes(data, n))}
              >
                +{n} мин
              </button>
            ))}
          </div>
        </div>
        <div className="play-bar" aria-hidden>
          <div
            className="play-bar-fill"
            style={{ width: `${Math.min(100, (displayUsed / limitSec) * 100)}%` }}
          />
        </div>
        {overtimeLive > 0 || overtimeTicking || (timedOut && !roblox.finished) ? (
          <div className="row-gap" style={{ marginTop: 12 }}>
            {overtimeLive > 0 || overtimeTicking ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  patchDay({
                    screens: {
                      ...day.screens,
                      roblox: {
                        ...flushScreenOvertime(roblox),
                        overtimeSec: 0,
                        overtimeStartedAt: null,
                      },
                    },
                  })
                }
              >
                Сбросить превышение
              </button>
            ) : null}
            {!roblox.finished ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  patchDay({
                    screens: {
                      ...day.screens,
                      roblox: {
                        ...flushScreenOvertime(roblox),
                        endsAt: null,
                        remainingSec: 0,
                        finished: true,
                        overtimeSec: 0,
                        overtimeStartedAt: null,
                      },
                    },
                  })
                }
              >
                Закрыть день без превышения
              </button>
            ) : null}
          </div>
        ) : null}
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
          <h2>Планы на день</h2>
          {day.extraTasks.length ? (
            <span className="pill">
              {extraDone}/{day.extraTasks.length}
            </span>
          ) : null}
        </div>
        <p className="hint">Сверх минимума · появятся у ребёнка через облако</p>

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

      <ReminderSection data={data} onChange={onChange} asParent />

      <section className="card piggy-bank-card">
        <div className="card-title-row">
          <h2 className="piggy-bank-title">
            <svg
              className="piggy-bank-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
              <path d="M2 9v1c0 1.1.9 2 2 2h1" />
              <path d="M16 11h.01" />
            </svg>
            Свинья-копилка
          </h2>
          <span
            className={
              moneyBank > 0 || pendingGifts.length > 0 ? 'pill' : 'pill muted'
            }
          >
            {moneyBank} ₽
            {pendingGifts.length > 0 ? ` · ${pendingGifts.length}` : ''}
          </span>
        </div>
        <p className="hint">
          Деньги и подарки за ачивки. Наличные спиши после выдачи, подарки —
          нажми «Выдать».
        </p>
        <div className="parent-roblox-bank">
          <p className="hint">Поблагодарить сверх ачивок — закинуть:</p>
          <div className="row-gap">
            {PARENT_MONEY_GIFTS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => onChange(giftMoneyBankRub(data, n))}
              >
                +{n} ₽
              </button>
            ))}
          </div>
          {moneyBank > 0 ? (
            <>
              <p className="hint" style={{ marginTop: 10 }}>
                Выдал наличные — списать:
              </p>
              <div className="row-gap">
                {PARENT_MONEY_PAYOUTS.filter((n) => n <= moneyBank).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn ghost"
                    onClick={() => onChange(payoutMoneyBankRub(data, n))}
                  >
                    −{n} ₽
                  </button>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() => onChange(payoutMoneyBankRub(data, moneyBank))}
                >
                  Списать всё
                </button>
              </div>
            </>
          ) : null}

          <p className="hint" style={{ marginTop: 14 }}>
            Подарки к выдаче:
            {pendingGifts.length === 0 ? ' пока нет' : ''}
          </p>
          {pendingGifts.length > 0 ? (
            <ul className="gift-pending-list">
              {pendingGifts.map((gift) => (
                <li key={gift.id} className="gift-pending-item">
                  <div className="gift-pending-main">
                    <span className="gift-pending-title">{gift.label}</span>
                    <span className="hint">{gift.giftHint}</span>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => onChange(dismissGiftSticker(data, gift.id))}
                  >
                    Выдать
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
