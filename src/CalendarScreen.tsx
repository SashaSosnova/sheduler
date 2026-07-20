import { useMemo, useState } from 'react'
import {
  MUST_DO_ITEMS,
  SCREEN_LIMITS,
  chewDurationSec,
  formatPlayTime,
  formatPlayTimeWithOvertime,
  normalizeDayLog,
  todayKey,
  workoutDurationSec,
} from './data'
import { dayStars, isPerfectDay, shiftDayKey } from './progress'
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

  function toggleMust(id: MustDoId) {
    if (!canEditMustDo || !onChange || selected > today) return
    const day = normalizeDayLog(selected, data.days[selected])
    onChange({
      ...data,
      days: {
        ...data.days,
        [selected]: {
          ...day,
          mustDo: { ...day.mustDo, [id]: !day.mustDo[id] },
        },
      },
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
          <p className="eyebrow">Сводка</p>
        </div>
        <h1>Календарь</h1>
      </header>

      <section className="card calendar-card">
        <div className="calendar-head">
          <button
            type="button"
            className="btn ghost calendar-nav"
            aria-label="Предыдущий месяц"
            onClick={() => shiftMonth(-1)}
          >
            ←
          </button>
          <h2 className="calendar-title">{monthLabel(cursor.year, cursor.month)}</h2>
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

      <section className="card">
        <div className="card-title-row">
          <h2 className="calendar-detail-title">{formatFullDate(selected)}</h2>
          <span className={detail.perfect ? 'pill' : 'pill muted'}>
            {detail.perfect
              ? 'идеальный'
              : `${detail.stars}/${MUST_DO_ITEMS.length}`}
          </span>
        </div>

        {canEditMustDo ? (
          <ul className="check-list" style={{ marginTop: 10 }}>
            {MUST_DO_ITEMS.map((item) => (
              <li key={item.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(detail.day.mustDo[item.id])}
                    disabled={selected > today}
                    onChange={() => toggleMust(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="calendar-must-list">
            {MUST_DO_ITEMS.map((item) => {
              const done = Boolean(detail.day.mustDo[item.id])
              return (
                <li
                  key={item.id}
                  className={`calendar-must-item ${done ? 'done' : ''}`}
                >
                  <span className="calendar-must-mark" aria-hidden>
                    {done ? '★' : '☆'}
                  </span>
                  <span>{item.label}</span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="calendar-detail-block">
          <h3>Зарядка</h3>
          <p className="hint">
            {detail.exerciseDone} из {detail.exerciseTotal}
            {detail.workoutSec != null
              ? ` · заняла ${formatPlayTime(detail.workoutSec)}`
              : detail.exerciseDone > 0
                ? ''
                : ' · не сделана'}
          </p>
        </div>

        <div className="calendar-detail-block">
          <h3>Жевание</h3>
          <p className="hint">
            {detail.chewFood
              ? `${detail.chewFood}${
                  detail.chewSec != null
                    ? ` · заняло ${formatPlayTime(detail.chewSec)}`
                    : ''
                }`
              : 'Не заполнено'}
          </p>
        </div>

        {detail.day.createNote ? (
          <div className="calendar-detail-block">
            <h3>Творчество</h3>
            <p className="hint">{detail.day.createNote}</p>
          </div>
        ) : null}

        {detail.day.extraTasks.length > 0 ? (
          <div className="calendar-detail-block">
            <h3>Планы на день</h3>
            <ul className="calendar-exercise-list">
              {detail.day.extraTasks.map((t) => (
                <li key={t.id} className={t.done ? 'done' : ''}>
                  {t.done ? '✓' : '·'} {t.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {detail.day.reminders.length > 0 ? (
          <div className="calendar-detail-block">
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
        ) : null}

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
    </div>
  )
}
