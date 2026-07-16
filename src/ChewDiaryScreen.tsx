import { useEffect, useMemo, useState } from 'react'
import { CHEW_FOODS, normalizeDayLog, todayKey, uid } from './data'
import type { AppData, ChewEntry } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  readOnly?: boolean
}

const EMPTY_SIDE = (): string[] => ['', '', '', '', '']

function formatDateRu(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function sideText(values: number[]): string {
  return values.join(', ')
}

function buildReport(entries: ChewEntry[]): string {
  const lines = [
    'Дневник жевания',
    '',
    'Дата | Что жевал | Левая сторона (5 укусов) | Правая сторона (5 укусов)',
    '---',
  ]
  for (const entry of entries) {
    lines.push(
      `${formatDateRu(entry.date)} | ${entry.food} | ${sideText(entry.left)} | ${sideText(entry.right)}`,
    )
  }
  return lines.join('\n')
}

function toFields(entry: ChewEntry) {
  const known = (CHEW_FOODS as readonly string[]).includes(entry.food)
  return {
    food: known ? entry.food : '__other',
    customFood: known ? '' : entry.food,
    left: entry.left.map(String),
    right: entry.right.map(String),
  }
}

export function ChewDiaryScreen({ data, onChange, readOnly = false }: Props) {
  const key = todayKey()
  const [editing, setEditing] = useState(false)
  const [food, setFood] = useState<string>(CHEW_FOODS[0])
  const [customFood, setCustomFood] = useState('')
  const [left, setLeft] = useState(EMPTY_SIDE)
  const [right, setRight] = useState(EMPTY_SIDE)
  const [copyStatus, setCopyStatus] = useState('')

  const todayEntry = useMemo(() => {
    const list = (data.chewEntries ?? []).filter((e) => e.date === key)
    if (list.length === 0) return null
    return list.sort((a, b) => b.createdAt - a.createdAt)[0]
  }, [data.chewEntries, key])

  const allEntries = useMemo(() => {
    const byDate = new Map<string, ChewEntry>()
    for (const entry of data.chewEntries ?? []) {
      const prev = byDate.get(entry.date)
      if (!prev || entry.createdAt > prev.createdAt) {
        byDate.set(entry.date, entry)
      }
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [data.chewEntries])

  const showForm = !readOnly && (!todayEntry || editing)

  useEffect(() => {
    if (readOnly) setEditing(false)
  }, [readOnly])

  useEffect(() => {
    if (todayEntry && editing) {
      const fields = toFields(todayEntry)
      setFood(fields.food)
      setCustomFood(fields.customFood)
      setLeft(fields.left)
      setRight(fields.right)
    }
    if (!todayEntry) {
      setEditing(false)
      setFood(CHEW_FOODS[0])
      setCustomFood('')
      setLeft(EMPTY_SIDE())
      setRight(EMPTY_SIDE())
    }
  }, [todayEntry, editing])

  const selectedFood = food === '__other' ? customFood.trim() : food
  const leftNums = left.map((v) => Number(v))
  const rightNums = right.map((v) => Number(v))
  const leftOk = left.every((v) => v !== '' && Number(v) > 0)
  const rightOk = right.every((v) => v !== '' && Number(v) > 0)
  const canSave = Boolean(selectedFood) && leftOk && rightOk

  function setCell(side: 'left' | 'right', index: number, value: string) {
    const clean = value.replace(/[^\d]/g, '').slice(0, 3)
    if (side === 'left') {
      setLeft((prev) => prev.map((v, i) => (i === index ? clean : v)))
    } else {
      setRight((prev) => prev.map((v, i) => (i === index ? clean : v)))
    }
  }

  function saveEntry() {
    if (!canSave) return
    const entry: ChewEntry = {
      id: todayEntry?.id ?? uid(),
      date: key,
      food: selectedFood,
      left: leftNums,
      right: rightNums,
      createdAt: Date.now(),
    }
    const withoutToday = (data.chewEntries ?? []).filter((e) => e.date !== key)
    const day = normalizeDayLog(key, data.days[key])
    onChange({
      ...data,
      chewEntries: [entry, ...withoutToday],
      days: {
        ...data.days,
        [key]: {
          ...day,
          mustDo: { ...day.mustDo, chew: true },
        },
      },
    })
    setEditing(false)
  }

  async function copyReport() {
    const text = buildReport(allEntries)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Скопировано — можно вставить в сообщение')
    } catch {
      setCopyStatus('Не удалось скопировать. Выдели текст таблицы вручную.')
    }
    window.setTimeout(() => setCopyStatus(''), 2500)
  }

  async function shareReport() {
    const text = buildReport(allEntries)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Дневник жевания',
          text,
        })
        return
      } catch {
        /* cancelled */
      }
    }
    await copyReport()
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">{readOnly ? 'Родитель · просмотр' : 'Дневник жевания'}</p>
        <h1>{readOnly ? 'Дневник жевания' : 'Одна запись в день'}</h1>
        <p className="sub">
          {readOnly
            ? 'Сводка по дням. Заполнить можно только на телефоне ребёнка.'
            : '5 укусов слева и 5 справа. В ячейку — сколько раз жевал за укус.'}
        </p>
      </header>

      {todayEntry && !editing ? (
        <section className="card accent">
          <h2>{readOnly ? 'Сегодня' : 'Сегодня уже заполнено'}</h2>
          <p>
            <strong>{todayEntry.food}</strong>
          </p>
          <p className="hint">Левая: {sideText(todayEntry.left)}</p>
          <p className="hint">Правая: {sideText(todayEntry.right)}</p>
          {!readOnly ? (
            <div className="row-gap">
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                Исправить
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {readOnly && !todayEntry ? (
        <section className="card soft">
          <p className="hint">Сегодня запись ещё не сохранена.</p>
        </section>
      ) : null}

      {showForm ? (
        <>
          <section className="card">
            <h2>Что жую</h2>
            <div className="chip-row">
              {CHEW_FOODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={food === item ? 'chip active' : 'chip'}
                  onClick={() => setFood(item)}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                className={food === '__other' ? 'chip active' : 'chip'}
                onClick={() => setFood('__other')}
              >
                Другое
              </button>
            </div>
            {food === '__other' ? (
              <label className="field">
                <span>Название</span>
                <input
                  value={customFood}
                  onChange={(e) => setCustomFood(e.target.value)}
                  placeholder="Что жуёшь?"
                />
              </label>
            ) : null}
          </section>

          <section className="card">
            <h2>Левая сторона</h2>
            <p className="hint">5 укусов — впиши число жеваний в каждый</p>
            <div className="chew-grid">
              {left.map((value, index) => (
                <label key={`l-${index}`} className="chew-cell">
                  <span>Укус {index + 1}</span>
                  <input
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => setCell('left', index, e.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Правая сторона</h2>
            <p className="hint">5 укусов — впиши число жеваний в каждый</p>
            <div className="chew-grid">
              {right.map((value, index) => (
                <label key={`r-${index}`} className="chew-cell">
                  <span>Укус {index + 1}</span>
                  <input
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => setCell('right', index, e.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </section>

          <div className="row-gap">
            <button
              type="button"
              className="btn primary"
              disabled={!canSave}
              onClick={saveEntry}
            >
              {canSave
                ? todayEntry
                  ? 'Сохранить изменения'
                  : 'Сохранить на сегодня'
                : 'Заполни все 10 ячеек'}
            </button>
            {editing ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditing(false)}
              >
                Отмена
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <section className="card">
        <div className="card-title-row">
          <h2>Сводка для миотерапевта</h2>
          <span className="pill">{allEntries.length}</span>
        </div>
        <p className="hint">
          Одна строка — один день. Можно скопировать или отправить сообщением.
        </p>

        {allEntries.length === 0 ? (
          <p className="hint" style={{ marginTop: 10 }}>
            Пока нечего отправлять — сначала сохрани запись за сегодня.
          </p>
        ) : (
          <>
            <div className="chew-table-wrap">
              <table className="chew-table">
                <thead>
                  <tr>
                    <th>День</th>
                    <th>Что жевал</th>
                    <th>Левая</th>
                    <th>Правая</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateRu(entry.date)}</td>
                      <td>{entry.food}</td>
                      <td>{sideText(entry.left)}</td>
                      <td>{sideText(entry.right)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-gap">
              <button type="button" className="btn primary" onClick={shareReport}>
                Отправить
              </button>
              <button type="button" className="btn" onClick={copyReport}>
                Скопировать текст
              </button>
            </div>
            {copyStatus ? <p className="hint">{copyStatus}</p> : null}
          </>
        )}
      </section>
    </div>
  )
}
