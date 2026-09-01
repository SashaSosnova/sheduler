import { useMemo } from 'react'
import {
  canEnterSchoolGrade,
  clampSchoolGradeDate,
  SCHOOL_GRADES_START,
  SCHOOL_MARKS,
  SCHOOL_TRACK_SUBJECTS,
  schoolSubjectShort,
  todayKey,
  uid,
} from './data'
import { countFivesInSubject } from './progress'
import { playDing } from './sound'
import type { AppData, SchoolGrade, SchoolMark } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  date: string
  readOnly?: boolean
  /** Inside another card (parent calendar day) */
  embedded?: boolean
  /** Full diary: date picker + history of all marks */
  diary?: boolean
  onDateChange?: (date: string) => void
  /** Parent screens: start collapsed behind a summary row */
  collapsed?: boolean
}

function formatDiaryDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function groupGradesByDate(grades: SchoolGrade[]): {
  date: string
  items: SchoolGrade[]
}[] {
  const sorted = [...grades].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.createdAt - a.createdAt
  })
  const groups: { date: string; items: SchoolGrade[] }[] = []
  for (const grade of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === grade.date) last.items.push(grade)
    else groups.push({ date: grade.date, items: [grade] })
  }
  return groups
}

function GradeRow({
  grade,
  readOnly,
  onRemove,
}: {
  grade: SchoolGrade
  readOnly: boolean
  onRemove: (id: string) => void
}) {
  return (
    <li className="school-grade-item">
      <span>
        <strong>{grade.mark}</strong>
        {' · '}
        {grade.subject}
      </span>
      {readOnly ? null : (
        <button
          type="button"
          className="icon-btn"
          aria-label="Удалить оценку"
          onClick={() => onRemove(grade.id)}
        >
          ×
        </button>
      )}
    </li>
  )
}

export function SchoolGradesCard({
  data,
  onChange,
  date,
  readOnly = false,
  embedded = false,
  diary = false,
  onDateChange,
  collapsed = false,
}: Props) {
  const grades = data.schoolGrades ?? []
  const today = todayKey()
  const schoolNotStarted = today < SCHOOL_GRADES_START
  const dateTooEarly = date < SCHOOL_GRADES_START
  const canAdd = !readOnly && canEnterSchoolGrade(date)
  const todayGrades = grades.filter((g) => g.date === date)
  const maxDate = schoolNotStarted ? SCHOOL_GRADES_START : today

  const fiveCounts = SCHOOL_TRACK_SUBJECTS.map((name) => {
    const n = countFivesInSubject(grades, name)
    return `${schoolSubjectShort(name)} ${n}`
  }).join(' · ')

  const historyGroups = useMemo(() => {
    if (!diary) return []
    return groupGradesByDate(grades).filter((g) => g.date !== date)
  }, [diary, grades, date])

  function addGrade(subject: string, mark: SchoolMark) {
    if (!canEnterSchoolGrade(date)) return
    const entryDate = date
    if (mark === 5) playDing()
    onChange({
      ...data,
      schoolGrades: [
        ...grades,
        {
          id: uid(),
          date: entryDate,
          subject,
          mark,
          createdAt: Date.now(),
        },
      ],
    })
  }

  function removeGrade(id: string) {
    onChange({
      ...data,
      schoolGrades: grades.filter((g) => g.id !== id),
      deletedSchoolGradeIds: [...(data.deletedSchoolGradeIds ?? []), id],
    })
  }

  const title = diary ? 'Дневник оценок' : readOnly ? 'Оценки' : 'Школа'
  const hint = schoolNotStarted
    ? '1 сентября — линейка, уроков нет. Оценки можно ставить с 2 сентября.'
    : dateTooEarly
      ? 'Оценки только с 2 сентября — первого учебного дня.'
      : diary
        ? `Пятёрки: ${fiveCounts}. Для четверти без троек пиши все оценки, не только 5.`
        : readOnly
          ? `Пятёрки: ${fiveCounts}`
          : `Пятёрки: ${fiveCounts}. Для четверти без троек пиши все оценки, не только 5.`

  const pill = todayGrades.length ? (
    <span className="pill">{todayGrades.length}</span>
  ) : (
    <span className="pill muted">оценки</span>
  )

  const body = (
    <>
      {collapsed ? null : (
        <div className="card-title-row">
          {embedded ? <h3>{title}</h3> : <h2>{title}</h2>}
          {pill}
        </div>
      )}
      <p className="hint" style={{ marginTop: collapsed ? 0 : 8 }}>
        {hint}
      </p>

      {diary && onDateChange && !schoolNotStarted ? (
        <label className="field">
          <span>Дата</span>
          <input
            type="date"
            value={date < SCHOOL_GRADES_START ? SCHOOL_GRADES_START : date}
            min={SCHOOL_GRADES_START}
            max={maxDate}
            onChange={(e) => {
              const next = e.target.value
              if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return
              onDateChange(clampSchoolGradeDate(next))
            }}
          />
        </label>
      ) : diary && !schoolNotStarted ? (
        <p className="hint" style={{ marginTop: 8 }}>
          {formatDiaryDate(date)}
        </p>
      ) : null}

      {canAdd ? (
        <ul className="school-subject-entry">
          {SCHOOL_TRACK_SUBJECTS.map((name) => (
            <li key={name} className="school-subject-row">
              <span>{schoolSubjectShort(name)}</span>
              <div className="school-mark-row">
                {SCHOOL_MARKS.map((mark) => (
                  <button
                    key={mark}
                    type="button"
                    className="school-mark-btn"
                    aria-label={`${name}: ${mark}`}
                    onClick={() => addGrade(name, mark)}
                  >
                    {mark}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {todayGrades.length ? (
        <ul className="school-grade-list">
          {todayGrades.map((grade) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              readOnly={readOnly}
              onRemove={removeGrade}
            />
          ))}
        </ul>
      ) : diary && !readOnly ? null : diary ? (
        <p className="hint" style={{ marginTop: 10 }}>
          За этот день оценок нет
        </p>
      ) : null}

      {diary && historyGroups.length ? (
        <div className="school-grade-history">
          <p className="school-grade-history-title">История</p>
          {historyGroups.map((group) => (
            <div key={group.date}>
              <p className="school-grade-day-head">
                {formatDiaryDate(group.date)}
              </p>
              <ul className="school-grade-list">
                {group.items.map((grade) => (
                  <GradeRow
                    key={grade.id}
                    grade={grade}
                    readOnly={readOnly}
                    onRemove={removeGrade}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )

  if (collapsed) {
    return (
      <details className="parent-calendar-fold">
        <summary className="parent-calendar-fold-head">
          <span className="parent-calendar-fold-title">{title}</span>
          {pill}
        </summary>
        <div className="parent-fold-body">{body}</div>
      </details>
    )
  }
  if (embedded) {
    return <div className="calendar-detail-block">{body}</div>
  }
  return <section className="card">{body}</section>
}
