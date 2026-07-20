import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatReminderDayLabel,
  listUpcomingReminders,
  normalizeDayLog,
  setDayReminders,
  todayKey,
  uid,
  type DatedReminder,
} from './data'
import { loadParentLabel } from './parentAlerts'
import type { AppData, DayReminder } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  /** Parent creates reminders marked fromParent */
  asParent?: boolean
}

const NEAR_DAY_COUNT = 3
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, '0'),
)
const WHEEL_ITEM_H = 40

/** Today's timed appointments — pin at the top of the screen. */
export function TodayTimedReminderBanner({
  data,
  onChange,
  asParent = false,
}: Props) {
  const today = todayKey()
  const items = listUpcomingReminders(data.days, today).filter(
    (r) => r.date === today && Boolean(r.time),
  )
  const [pending, setPending] = useState<DatedReminder | null>(null)

  if (!items.length) return null

  function canDelete(item: DatedReminder): boolean {
    return asParent || !item.fromParent
  }

  return (
    <>
      <section className="reminder-today-banner" aria-label="Не забудь сегодня">
        <ul className="reminder-today-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="reminder-today-item"
                onClick={() => {
                  if (canDelete(item)) setPending(item)
                }}
              >
                <span className="reminder-today-time">{item.time}</span>
                <span className="reminder-today-text">
                  {item.text}
                  {item.fromParent ? (
                    <span className="reminder-today-from">
                      {' '}
                      · от {item.fromParentAs?.trim() || 'родителя'}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {pending ? (
        <div
          className="pin-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Удалить напоминание"
          onClick={() => setPending(null)}
        >
          <div
            className="card pin-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Удалить?</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              {pending.time ? `${pending.time} · ` : ''}
              {pending.text}
            </p>
            <div className="row-gap" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  removeReminder(data, onChange, asParent, pending)
                  setPending(null)
                }}
              >
                Удалить
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPending(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** Upcoming reminders list + add form (today's timed ones live in the banner). */
export function ReminderSection({ data, onChange, asParent = false }: Props) {
  const today = todayKey()
  const upcoming = listUpcomingReminders(data.days, today)
  const listItems = upcoming.filter(
    (r) => !(r.date === today && Boolean(r.time)),
  )

  const nearDays = useMemo(
    () => Array.from({ length: NEAR_DAY_COUNT }, (_, i) => shiftKey(today, i)),
    [today],
  )

  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState(today)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [hour, setHour] = useState('09')
  const [minute, setMinute] = useState('30')

  const time = `${hour}:${minute}`
  const dateInNear = nearDays.includes(date)

  function addReminder() {
    const trimmed = text.trim()
    if (!trimmed || !date) return
    const day = normalizeDayLog(date, data.days[date])
    const already = day.reminders.some(
      (r) =>
        r.text.toLowerCase() === trimmed.toLowerCase() &&
        (r.time ?? '') === time,
    )
    if (already) return
    const next: DayReminder = {
      id: uid(),
      text: trimmed,
      time,
      ...(asParent
        ? { fromParent: true, fromParentAs: loadParentLabel() }
        : {}),
    }
    onChange(setDayReminders(data, date, [...day.reminders, next]))
    resetForm()
    setOpen(false)
  }

  function resetForm() {
    setText('')
    setHour('09')
    setMinute('30')
    setDate(today)
    setCalendarOpen(false)
  }

  function pickNearDay(key: string) {
    setDate(key)
    setCalendarOpen(false)
  }

  function pickOtherDay() {
    setCalendarOpen(true)
    if (dateInNear) setDate(shiftKey(today, NEAR_DAY_COUNT))
  }

  return (
    <section className="card">
      <div className="card-title-row">
        <h2>Ближайшие</h2>
        {listItems.length ? (
          <span className="pill muted">{listItems.length}</span>
        ) : null}
      </div>
      <p className="hint">Визиты с временем · без галочек</p>

      {listItems.length ? (
        <ul className="reminder-list">
          {listItems.map((item) => (
            <ReminderRow
              key={item.id}
              time={item.time}
              text={item.text}
              dateLabel={formatReminderDayLabel(item.date, today)}
              fromParent={item.fromParent}
              fromParentAs={item.fromParentAs}
              canDelete={asParent || !item.fromParent}
              onDelete={() => removeReminder(data, onChange, asParent, item)}
            />
          ))}
        </ul>
      ) : (
        <p className="hint">Пока пусто — например: ортодонт или миотерапевт.</p>
      )}

      <div className="extra-picker-box">
        <button
          type="button"
          className="linkish"
          onClick={() => {
            setOpen((v) => {
              if (v) resetForm()
              return !v
            })
          }}
        >
          {open ? 'Скрыть форму' : 'Добавить напоминание →'}
        </button>
        {open ? (
          <div className="create-picker">
            <label className="field">
              <span>Что не забыть</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addReminder()
                  }
                }}
                placeholder="Например: ортодонт"
                autoFocus
              />
            </label>

            <div className="reminder-pick-block">
              <p className="reminder-pick-label">День</p>
              <div className="reminder-chip-scroll" role="listbox" aria-label="День">
                {nearDays.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={date === key && !calendarOpen}
                    className={
                      date === key && !calendarOpen ? 'chip active' : 'chip'
                    }
                    onClick={() => pickNearDay(key)}
                  >
                    {dateChipLabel(key, today)}
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={!dateInNear || calendarOpen}
                  className={
                    !dateInNear || calendarOpen ? 'chip active' : 'chip'
                  }
                  onClick={pickOtherDay}
                >
                  {!dateInNear
                    ? calendarChipLabel(date)
                    : calendarOpen
                      ? 'Календарь'
                      : 'Другой день'}
                </button>
              </div>
              {calendarOpen || !dateInNear ? (
                <MiniCalendar
                  selected={date}
                  minDate={today}
                  onSelect={(key) => {
                    setDate(key)
                    if (nearDays.includes(key)) setCalendarOpen(false)
                    else setCalendarOpen(true)
                  }}
                />
              ) : null}
            </div>

            <div className="reminder-pick-block">
              <p className="reminder-pick-label">Время</p>
              <div className="reminder-time-wheels" aria-label="Часы и минуты">
                <WheelColumn
                  label="Часы"
                  options={HOURS}
                  value={hour}
                  onChange={setHour}
                />
                <span className="reminder-time-colon" aria-hidden>
                  :
                </span>
                <WheelColumn
                  label="Минуты"
                  options={MINUTES}
                  value={minute}
                  onChange={setMinute}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn primary reminder-add-btn"
              disabled={!text.trim()}
              onClick={addReminder}
            >
              {`Добавить · ${formatReminderDayLabel(date, today)}, ${time}`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function removeReminder(
  data: AppData,
  onChange: (next: AppData) => void,
  asParent: boolean,
  item: DatedReminder,
) {
  const day = normalizeDayLog(item.date, data.days[item.date])
  const target = day.reminders.find((r) => r.id === item.id)
  if (!asParent && target?.fromParent) return
  onChange(
    setDayReminders(
      data,
      item.date,
      day.reminders.filter((r) => r.id !== item.id),
    ),
  )
}

function ReminderRow({
  time,
  text,
  dateLabel,
  fromParent,
  fromParentAs,
  canDelete,
  onDelete,
}: {
  time?: string
  text: string
  dateLabel?: string
  fromParent?: boolean
  fromParentAs?: string
  canDelete: boolean
  onDelete: () => void
}) {
  const when = [dateLabel, time].filter(Boolean).join(', ')
  return (
    <li>
      <div className={canDelete ? 'reminder-row with-action' : 'reminder-row'}>
        <div className="reminder-main">
          {when ? <span className="reminder-when">{when}</span> : null}
          <span className="reminder-text">
            {text}
            {fromParent ? (
              <span className="hint">
                {' '}
                · от {fromParentAs?.trim() || 'родителя'}
              </span>
            ) : null}
          </span>
        </div>
        {canDelete ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Удалить"
            onClick={onDelete}
          >
            ×
          </button>
        ) : null}
      </div>
    </li>
  )
}

function WheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (next: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settling = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = Math.max(0, options.indexOf(value))
    settling.current = true
    el.scrollTop = idx * WHEEL_ITEM_H
    const t = window.setTimeout(() => {
      settling.current = false
    }, 80)
    return () => window.clearTimeout(t)
  }, [options, value])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timer = 0
    function settle() {
      if (settling.current) return
      const idx = Math.round(el!.scrollTop / WHEEL_ITEM_H)
      const clamped = Math.max(0, Math.min(options.length - 1, idx))
      const next = options[clamped]
      settling.current = true
      el!.scrollTo({ top: clamped * WHEEL_ITEM_H, behavior: 'smooth' })
      if (next !== value) onChange(next)
      window.setTimeout(() => {
        settling.current = false
      }, 120)
    }

    function onScroll() {
      window.clearTimeout(timer)
      timer = window.setTimeout(settle, 80)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
    }
  }, [onChange, options, value])

  return (
    <div className="reminder-wheel">
      <span className="reminder-wheel-label">{label}</span>
      <div className="reminder-wheel-frame">
        <div className="reminder-wheel-highlight" aria-hidden />
        <div ref={ref} className="reminder-wheel-scroller" tabIndex={0}>
          <div
            className="reminder-wheel-spacer"
            style={{ height: WHEEL_ITEM_H }}
          />
          {options.map((opt) => (
            <div
              key={opt}
              className={
                opt === value
                  ? 'reminder-wheel-item is-active'
                  : 'reminder-wheel-item'
              }
              style={{ height: WHEEL_ITEM_H }}
            >
              {opt}
            </div>
          ))}
          <div
            className="reminder-wheel-spacer"
            style={{ height: WHEEL_ITEM_H }}
          />
        </div>
      </div>
    </div>
  )
}

function MiniCalendar({
  selected,
  minDate,
  onSelect,
}: {
  selected: string
  minDate: string
  onSelect: (dateKey: string) => void
}) {
  const selectedParts = parseKey(selected)
  const [viewYear, setViewYear] = useState(selectedParts.y)
  const [viewMonth, setViewMonth] = useState(selectedParts.m)

  useEffect(() => {
    const p = parseKey(selected)
    setViewYear(p.y)
    setViewMonth(p.m)
  }, [selected])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    'ru-RU',
    { month: 'long', year: 'numeric' },
  )

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const minMonth = parseKey(minDate)

  return (
    <div className="reminder-calendar">
      <div className="reminder-calendar-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Предыдущий месяц"
          disabled={
            viewYear < minMonth.y ||
            (viewYear === minMonth.y && viewMonth <= minMonth.m)
          }
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <span className="reminder-calendar-month">{monthLabel}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Следующий месяц"
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="reminder-calendar-weekdays">
        {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="reminder-calendar-grid">
        {cells.map((cell, i) => {
          if (cell == null) return <span key={`e-${i}`} />
          const key = toKey(viewYear, viewMonth, cell)
          const disabled = key < minDate
          const active = key === selected
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              className={
                active
                  ? 'reminder-calendar-day is-active'
                  : 'reminder-calendar-day'
              }
              onClick={() => onSelect(key)}
            >
              {cell}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function shiftKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}

function dateChipLabel(dateKey: string, today: string): string {
  if (dateKey === today) return 'Сегодня'
  if (dateKey === shiftKey(today, 1)) return 'Завтра'
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = date.toLocaleDateString('ru-RU', { weekday: 'short' })
  return `${wd} ${d}`
}

function calendarChipLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m: m - 1, d }
}

function toKey(y: number, m: number, d: number): string {
  return todayKey(new Date(y, m, d))
}

/** Monday-first month grid; null = empty cell */
function buildMonthCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // JS: 0=Sun…6=Sat → Mon-first offset
  const mondayFirst = (first.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < mondayFirst; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
