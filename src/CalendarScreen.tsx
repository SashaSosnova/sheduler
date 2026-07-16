import { useMemo, useState } from 'react'
import { MUST_DO_ITEMS, normalizeDayLog, todayKey } from './data'
import type { AppData } from './types'

type Props = {
  data: AppData
  onOpenToday: () => void
  onOpenChew: () => void
}

export function CalendarScreen({ data, onOpenToday, onOpenChew }: Props) {
  const today = todayKey()
  const now = new Date()
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [selected, setSelected] = useState(today)

  const cells = useMemo(() => buildMonth(cursor.year, cursor.month), [cursor])
  const day = normalizeDayLog(selected, data.days[selected])
  const doneCount = MUST_DO_ITEMS.filter((i) => day.mustDo[i.id]).length
  const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const chewCount = (data.chewEntries ?? []).filter((e) => e.date === selected).length

  function shiftMonth(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Календарь</p>
        <h1>Мой месяц</h1>
        <p className="sub">Сводка по дням — чеклист только на экране «Сегодня»</p>
      </header>

      <section className="card">
        <div className="cal-nav">
          <button type="button" className="btn ghost" onClick={() => shiftMonth(-1)}>
            ←
          </button>
          <h2 className="cal-title">{title}</h2>
          <button type="button" className="btn ghost" onClick={() => shiftMonth(1)}>
            →
          </button>
        </div>

        <div className="cal-weekdays">
          {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((cell, idx) => {
            if (!cell) return <span key={`e-${idx}`} className="cal-empty" />
            const log = data.days[cell]
            const score = log
              ? MUST_DO_ITEMS.filter((i) => log.mustDo[i.id]).length
              : 0
            const level =
              score === 0 ? '' : score >= 5 ? 'hot' : score >= 3 ? 'mid' : 'low'
            return (
              <button
                key={cell}
                type="button"
                className={[
                  'cal-day',
                  cell === today ? 'is-today' : '',
                  cell === selected ? 'is-selected' : '',
                  level,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelected(cell)}
              >
                {Number(cell.slice(-2))}
              </button>
            )
          })}
        </div>
        <p className="hint">Цвет дня — сколько дел из минимума отмечено.</p>
      </section>

      <section className="card">
        <h2>{formatShort(selected)}</h2>
        <p className="sub">
          Минимум {doneCount}/{MUST_DO_ITEMS.length}
        </p>
        <p className="sub">
          Зарядка {exerciseDone}/{data.exercises.length || 0} · жевание: {chewCount}{' '}
          {chewCount === 1 ? 'запись' : chewCount >= 2 && chewCount <= 4 ? 'записи' : 'записей'}
        </p>
        {day.createNote ? (
          <p className="hint">Творчество: {day.createNote}</p>
        ) : null}
        <div className="row-gap">
          {selected === today ? (
            <button type="button" className="btn primary" onClick={onOpenToday}>
              Открыть «Сегодня»
            </button>
          ) : null}
          <button type="button" className="btn ghost" onClick={onOpenChew}>
            Дневник жевания
          </button>
        </div>
      </section>
    </div>
  )
}

function buildMonth(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  let start = first.getDay() - 1
  if (start < 0) start = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < start; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month + 1).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    cells.push(`${year}-${m}-${day}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}
