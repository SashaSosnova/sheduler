import { useEffect, useMemo, useState } from 'react'
import { shareChewReportImage } from './chewReportImage'
import {
  CHEW_FOODS,
  applyMustDoFlags,
  chewDurationSec,
  formatPlayTime,
  normalizeDayLog,
  todayKey,
  uid,
} from './data'
import { shiftDayKey, stampPerfectAt } from './progress'
import type { AppData, ChewEntry } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  readOnly?: boolean
  /** False while another tab is shown — screen stays mounted to keep the draft */
  active?: boolean
}

type ReportPeriod = '14' | 'month' | 'all' | 'custom'

const EMPTY_SIDE = (): string[] => ['', '', '', '', '']

function formatDateRu(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function monthStartKey(today = todayKey()): string {
  return `${today.slice(0, 7)}-01`
}

function reportRange(
  period: ReportPeriod,
  customFrom: string,
  customTo: string,
  today = todayKey(),
): { from: string; to: string } | null {
  if (period === 'all') return null
  if (period === '14') {
    return { from: shiftDayKey(today, -13), to: today }
  }
  if (period === 'month') {
    return { from: monthStartKey(today), to: today }
  }
  const from = customFrom || customTo || today
  const to = customTo || customFrom || today
  return from <= to ? { from, to } : { from: to, to: from }
}

function filterEntriesByRange(
  entries: ChewEntry[],
  range: { from: string; to: string } | null,
): ChewEntry[] {
  if (!range) return entries
  return entries.filter((e) => e.date >= range.from && e.date <= range.to)
}

function sideText(values: number[]): string {
  return values.join(', ')
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

export function ChewDiaryScreen({
  data,
  onChange,
  readOnly = false,
  active = true,
}: Props) {
  const key = todayKey()
  const [editing, setEditing] = useState(false)
  const [food, setFood] = useState<string>(CHEW_FOODS[0])
  const [customFood, setCustomFood] = useState('')
  const [left, setLeft] = useState(EMPTY_SIDE)
  const [right, setRight] = useState(EMPTY_SIDE)
  const [shareStatus, setShareStatus] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('14')
  const [customFrom, setCustomFrom] = useState(() => shiftDayKey(todayKey(), -13))
  const [customTo, setCustomTo] = useState(() => todayKey())
  /** Wall-clock start of the current fill session (first cell typed) */
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)

  const todayEntry = useMemo(() => {
    const list = (data.chewEntries ?? []).filter((e) => e.date === key)
    if (list.length === 0) return null
    return list.sort((a, b) => b.createdAt - a.createdAt)[0]
  }, [data.chewEntries, key])

  const todayChewSec = todayEntry ? chewDurationSec(todayEntry) : null

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

  const range = useMemo(
    () => reportRange(reportPeriod, customFrom, customTo, key),
    [reportPeriod, customFrom, customTo, key],
  )

  const reportEntries = useMemo(
    () => filterEntriesByRange(allEntries, range),
    [allEntries, range],
  )

  const rangeLabel = useMemo(() => {
    if (!range) return 'все дни'
    if (range.from === range.to) return formatDateRu(range.from)
    return `${formatDateRu(range.from)} – ${formatDateRu(range.to)}`
  }, [range])

  const showForm = !readOnly && (!todayEntry || editing)

  useEffect(() => {
    if (readOnly) setEditing(false)
  }, [readOnly])

  useEffect(() => {
    if (!active) setReportOpen(false)
  }, [active])

  // New calendar day — clear the draft. Do not reset when switching food.
  useEffect(() => {
    setEditing(false)
    setFood(CHEW_FOODS[0])
    setCustomFood('')
    setLeft(EMPTY_SIDE())
    setRight(EMPTY_SIDE())
    setSessionStartedAt(null)
  }, [key])

  useEffect(() => {
    if (!reportOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [reportOpen])

  const selectedFood = food === '__other' ? customFood.trim() : food
  const leftNums = left.map((v) => Number(v))
  const rightNums = right.map((v) => Number(v))
  const leftOk = left.every((v) => v !== '' && Number(v) > 0)
  const rightOk = right.every((v) => v !== '' && Number(v) > 0)
  const canSave = Boolean(selectedFood) && leftOk && rightOk

  function selectFood(next: string) {
    // Only change the label — keep filled cells and session timer
    setFood(next)
  }

  function startEditing() {
    if (!todayEntry) return
    const fields = toFields(todayEntry)
    setFood(fields.food)
    setCustomFood(fields.customFood)
    setLeft(fields.left)
    setRight(fields.right)
    setSessionStartedAt(todayEntry.startedAt ?? null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function setCell(side: 'left' | 'right', index: number, value: string) {
    const clean = value.replace(/[^\d]/g, '').slice(0, 3)
    if (clean !== '' && sessionStartedAt == null) {
      setSessionStartedAt(Date.now())
    }
    if (side === 'left') {
      setLeft((prev) => prev.map((v, i) => (i === index ? clean : v)))
    } else {
      setRight((prev) => prev.map((v, i) => (i === index ? clean : v)))
    }
  }

  function saveEntry() {
    if (!canSave) return
    const now = Date.now()
    const startedAt = todayEntry?.startedAt ?? sessionStartedAt ?? now
    const entry: ChewEntry = {
      id: todayEntry?.id ?? uid(),
      date: key,
      food: selectedFood,
      left: leftNums,
      right: rightNums,
      startedAt,
      // Keep first-save finish time so duration stays stable on edits
      createdAt: todayEntry?.startedAt != null ? todayEntry.createdAt : now,
    }
    const withoutToday = (data.chewEntries ?? []).filter((e) => e.date !== key)
    const day = normalizeDayLog(key, data.days[key])
    const nextDay = stampPerfectAt(
      day,
      normalizeDayLog(key, {
        ...day,
        ...applyMustDoFlags(day, { chew: true }, now),
      }),
    )
    onChange({
      ...data,
      chewEntries: [entry, ...withoutToday],
      days: {
        ...data.days,
        [key]: nextDay,
      },
    })
    setEditing(false)
    setSessionStartedAt(null)
  }

  async function shareReportImage() {
    if (shareBusy || reportEntries.length === 0) return
    setShareBusy(true)
    setShareStatus('')
    try {
      const result = await shareChewReportImage(reportEntries)
      if (result === 'shared') {
        setShareStatus('Отправлено')
      } else if (result === 'downloaded') {
        setShareStatus('Картинка скачана — приложи её в сообщении')
      } else if (result === 'cancelled') {
        setShareStatus('')
      }
    } catch {
      setShareStatus(
        'Не удалось поделиться. Открой «На весь экран» и сделай скриншот.',
      )
    } finally {
      setShareBusy(false)
      window.setTimeout(() => setShareStatus(''), 4000)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">
            {readOnly ? 'Родитель · просмотр' : 'Дневник жевания'}
          </p>
        </div>
        <h1>{readOnly ? 'Дневник жевания' : 'Одна запись в день'}</h1>
        {todayChewSec != null ? (
          <p className="sub">Сегодня жевание заняло {formatPlayTime(todayChewSec)}</p>
        ) : null}
      </header>

      {todayEntry && !editing ? (
        <section className="card accent">
          <h2>{readOnly ? 'Сегодня' : 'Сегодня уже заполнено'}</h2>
          <p>
            <strong>{todayEntry.food}</strong>
          </p>
          <p className="hint">Левая: {sideText(todayEntry.left)}</p>
          <p className="hint">Правая: {sideText(todayEntry.right)}</p>
          {todayChewSec != null ? (
            <p className="hint">Жевание заняло {formatPlayTime(todayChewSec)}</p>
          ) : null}
          {!readOnly ? (
            <div className="row-gap">
              <button type="button" className="btn" onClick={startEditing}>
                Исправить
              </button>
            </div>
          ) : null}
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
                  onClick={() => selectFood(item)}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                className={food === '__other' ? 'chip active' : 'chip'}
                onClick={() => selectFood('__other')}
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
                onClick={cancelEditing}
              >
                Отмена
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {readOnly ? (
        <section className="card">
          <div className="card-title-row">
            <h2>Сводка для миотерапевта</h2>
            <span className="pill">
              {reportEntries.length}
              {allEntries.length !== reportEntries.length
                ? `/${allEntries.length}`
                : ''}
            </span>
          </div>
          {allEntries.length > 0 ? (
            <>
              <p className="hint" style={{ marginTop: 8 }}>
                Период для таблицы и картинки
              </p>
              <div className="chip-row chew-period-chips">
                {(
                  [
                    ['14', '14 дней'],
                    ['month', 'Этот месяц'],
                    ['all', 'Все'],
                    ['custom', 'Свои даты'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={reportPeriod === id ? 'chip active' : 'chip'}
                    onClick={() => {
                      setReportPeriod(id)
                      if (id === 'custom') {
                        setCustomFrom(shiftDayKey(key, -13))
                        setCustomTo(key)
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {reportPeriod === 'custom' ? (
                <div className="chew-period-custom">
                  <label className="field">
                    <span>С</span>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || key}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>По</span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      max={key}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <p className="hint">{rangeLabel}</p>
              {reportEntries.length > 0 ? (
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
                        {reportEntries.map((entry) => (
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
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setReportOpen(true)}
                    >
                      На весь экран
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={shareBusy}
                      onClick={() => void shareReportImage()}
                    >
                      {shareBusy ? 'Готовим…' : 'Поделиться картинкой'}
                    </button>
                  </div>
                  {shareStatus ? <p className="hint">{shareStatus}</p> : null}
                </>
              ) : (
                <p className="hint">В этом периоде записей нет</p>
              )}
            </>
          ) : (
            <p className="hint" style={{ marginTop: 8 }}>
              Пока нет записей дневника
            </p>
          )}
        </section>
      ) : null}

      {reportOpen && readOnly ? (
        <div className="chew-report-overlay" role="dialog" aria-modal="true">
          <div className="chew-report-toolbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Закрыть"
              onClick={() => setReportOpen(false)}
            >
              ×
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={shareBusy || reportEntries.length === 0}
              onClick={() => void shareReportImage()}
            >
              {shareBusy ? 'Готовим…' : 'Поделиться'}
            </button>
          </div>
          <div className="chew-report-sheet">
            <h2>Дневник жевания</h2>
            <p className="hint">
              {reportEntries.length}{' '}
              {reportEntries.length === 1 ? 'день' : 'дней'} · {rangeLabel}
            </p>
            <div className="chew-table-wrap chew-report-table">
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
                  {reportEntries.map((entry) => (
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
          </div>
          {shareStatus ? (
            <p className="chew-report-status">{shareStatus}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
