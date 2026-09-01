import { useState } from 'react'
import {
  WEEKDAY_MON1,
  electiveLabel,
  electiveWeekdayHint,
  electivesOnDate,
  normalizeElectiveTime,
  uid,
} from './data'
import type { Elective } from './types'

const HOURS_24 = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, '0'),
)
const MINUTES_5 = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, '0'),
)

function splitTime(raw: string): { hour: string; minute: string } {
  const time = normalizeElectiveTime(raw) ?? '18:00'
  const [hour, minute] = time.split(':')
  return { hour, minute }
}

function minuteOptions(current: string): string[] {
  if (MINUTES_5.includes(current)) return MINUTES_5
  return [...MINUTES_5, current].sort()
}

type TimeSelectProps = {
  value: string
  onChange: (time: string) => void
}

function ElectiveTimeSelect({ value, onChange }: TimeSelectProps) {
  const { hour, minute } = splitTime(value)
  const minutes = minuteOptions(minute)

  function emit(nextHour: string, nextMinute: string) {
    const time = normalizeElectiveTime(`${nextHour}:${nextMinute}`)
    if (time) onChange(time)
  }

  return (
    <div className="elective-time-select">
      <select
        aria-label="Часы"
        value={hour}
        onChange={(e) => emit(e.target.value, minute)}
      >
        {HOURS_24.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="elective-time-colon" aria-hidden>
        :
      </span>
      <select
        aria-label="Минуты"
        value={minute}
        onChange={(e) => emit(hour, e.target.value)}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}

type ListProps = {
  electives: Elective[]
  done: Record<string, boolean>
  date: string
  onToggleDone?: (id: string) => void
}

export function ElectiveSchedule({
  electives,
  done,
  date,
  onToggleDone,
}: ListProps) {
  const todayItems = electivesOnDate(electives, date)

  if (!todayItems.length) {
    return (
      <p className="hint" style={{ marginTop: 8 }}>
        Сегодня факультативов нет
      </p>
    )
  }

  return (
    <ul className="check-list" style={{ marginTop: 10 }}>
      {todayItems.map((item) => (
        <li key={item.id}>
          <label className="check-row">
            <input
              type="checkbox"
              checked={Boolean(done[item.id])}
              readOnly={!onToggleDone}
              tabIndex={onToggleDone ? undefined : -1}
              onChange={() => onToggleDone?.(item.id)}
            />
            <span>
              {electiveLabel(item)}
              <span className="hint"> · {electiveWeekdayHint(item)}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

type EditorProps = {
  electives: Elective[]
  onChange: (next: Elective[]) => void
}

export function ElectiveEditor({ electives, onChange }: EditorProps) {
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTime, setDraftTime] = useState('18:00')
  const [draftDays, setDraftDays] = useState<number[]>([1])

  function patch(id: string, next: Partial<Elective>) {
    onChange(
      electives.map((item) => (item.id === id ? { ...item, ...next } : item)),
    )
  }

  function toggleDay(id: string, weekday: number, current: number[]) {
    const has = current.includes(weekday)
    const weekdays = has
      ? current.filter((d) => d !== weekday)
      : [...current, weekday].sort((a, b) => a - b)
    if (weekdays.length === 0) return
    patch(id, { weekdays })
  }

  function addElective() {
    const title = draftTitle.trim()
    const time = normalizeElectiveTime(draftTime)
    if (!title || !time || draftDays.length === 0) return
    onChange([
      ...electives,
      { id: uid(), title, time, weekdays: [...draftDays].sort((a, b) => a - b) },
    ])
    setDraftTitle('')
    setDraftTime('18:00')
    setDraftDays([1])
  }

  return (
    <div className="elective-editor">
      {electives.map((item) => (
        <div key={item.id} className="elective-editor-card">
          <div className="elective-editor-head">
            <label className="field grow">
              <span>Сходить на</span>
              <input
                value={item.title}
                onChange={(e) => patch(item.id, { title: e.target.value })}
              />
            </label>
            <label className="field elective-time-field">
              <span>Время</span>
              <ElectiveTimeSelect
                value={item.time}
                onChange={(time) => patch(item.id, { time })}
              />
            </label>
            <button
              type="button"
              className="icon-btn"
              aria-label="Удалить факультатив"
              onClick={() =>
                onChange(electives.filter((row) => row.id !== item.id))
              }
            >
              ×
            </button>
          </div>
          <div className="chip-row elective-days">
            {WEEKDAY_MON1.map((day) => (
              <button
                key={day.id}
                type="button"
                className={
                  item.weekdays.includes(day.id) ? 'chip active' : 'chip'
                }
                onClick={() => toggleDay(item.id, day.id, item.weekdays)}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="elective-editor-card">
        <div className="elective-editor-head">
          <label className="field grow">
            <span>Новый: сходить на</span>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="брейк-данс"
            />
          </label>
          <label className="field elective-time-field">
            <span>Время</span>
            <ElectiveTimeSelect value={draftTime} onChange={setDraftTime} />
          </label>
        </div>
        <div className="chip-row elective-days">
          {WEEKDAY_MON1.map((day) => (
            <button
              key={day.id}
              type="button"
              className={draftDays.includes(day.id) ? 'chip active' : 'chip'}
              onClick={() =>
                setDraftDays((prev) => {
                  const has = prev.includes(day.id)
                  const next = has
                    ? prev.filter((d) => d !== day.id)
                    : [...prev, day.id]
                  return next.length ? next.sort((a, b) => a - b) : prev
                })
              }
            >
              {day.short}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 10 }}
          disabled={
            !draftTitle.trim() ||
            !normalizeElectiveTime(draftTime) ||
            draftDays.length === 0
          }
          onClick={addElective}
        >
          Добавить факультатив
        </button>
      </div>
    </div>
  )
}
