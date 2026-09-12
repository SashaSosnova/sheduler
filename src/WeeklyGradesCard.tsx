import {
  SCHOOL_MARKS,
  WEEKLY_GRADE_RUB,
  addWeeklyGradeMark,
  currentWeeklyGradeWeek,
  formatRubDelta,
  formatWeekRange,
  normalizeWeeklyGradeWeeks,
  removeWeeklyGradeMark,
  weeklyGradeMoney,
} from './data'
import { playDing } from './sound'
import type { AppData, SchoolMark } from './types'

type Props = {
  data: AppData
  onChange?: (next: AppData) => void
  readOnly?: boolean
  collapsed?: boolean
}

function markClass(mark: SchoolMark): string {
  if (mark >= 5) return 'weekly-grade-chip is-five'
  if (mark === 4) return 'weekly-grade-chip is-four'
  if (mark === 3) return 'weekly-grade-chip is-three'
  return 'weekly-grade-chip is-two'
}

function RatesHint() {
  return (
    <p className="weekly-grade-rates">
      {SCHOOL_MARKS.map((mark) => (
        <span key={mark}>
          {mark} → {formatRubDelta(WEEKLY_GRADE_RUB[mark])}
        </span>
      ))}
    </p>
  )
}

export function WeeklyGradesCard({
  data,
  onChange,
  readOnly = false,
  collapsed = false,
}: Props) {
  const week = currentWeeklyGradeWeek(data)
  const canEdit = Boolean(onChange) && !readOnly
  const pending = weeklyGradeMoney(week.marks)
  const history = normalizeWeeklyGradeWeeks(data.weeklyGradeWeeks).filter(
    (w) => w.weekEnd !== week.weekEnd && w.marks.length > 0,
  )

  function addMark(mark: SchoolMark) {
    if (!onChange || !canEdit) return
    if (mark === 5) playDing()
    onChange(addWeeklyGradeMark(data, mark))
  }

  function removeMark(index: number) {
    if (!onChange || !canEdit) return
    onChange(removeWeeklyGradeMark(data, index))
  }

  const body = (
    <>
      {collapsed ? null : <h2>Оценки за неделю</h2>}
      <RatesHint />
      <p className="weekly-grade-range">{formatWeekRange(week.weekEnd)}</p>

      {canEdit ? (
        <div className="school-mark-row" style={{ marginTop: 10 }}>
          {SCHOOL_MARKS.map((mark) => (
            <button
              key={mark}
              type="button"
              className="school-mark-btn"
              aria-label={`Добавить оценку ${mark}`}
              onClick={() => addMark(mark)}
            >
              {mark}
            </button>
          ))}
        </div>
      ) : null}

      {week.marks.length ? (
        <ul className="weekly-grade-chips">
          {week.marks.map((mark, index) => (
            <li key={`${mark}-${index}`} className={markClass(mark)}>
              <span>{mark}</span>
              {canEdit ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Убрать оценку ${mark}`}
                  onClick={() => removeMark(index)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint" style={{ marginTop: 10 }}>
          Пока нет оценок за эту неделю
        </p>
      )}

      {week.marks.length ? (
        <p className="weekly-grade-total">
          За неделю: {formatRubDelta(pending)}
        </p>
      ) : null}

      {history.length ? (
        <div className="school-grade-history">
          <p className="school-grade-history-title">Прошлые недели</p>
          {history.map((past) => (
            <p key={past.weekEnd} className="weekly-grade-history-row">
              <span>{formatWeekRange(past.weekEnd)}</span>
              <span>{formatRubDelta(weeklyGradeMoney(past.marks))}</span>
            </p>
          ))}
        </div>
      ) : null}
    </>
  )

  if (collapsed) {
    return (
      <details className="parent-calendar-fold">
        <summary className="parent-calendar-fold-head">
          <span className="parent-calendar-fold-title">Оценки за неделю</span>
        </summary>
        <div className="parent-fold-body">{body}</div>
      </details>
    )
  }

  return <section className="card">{body}</section>
}
