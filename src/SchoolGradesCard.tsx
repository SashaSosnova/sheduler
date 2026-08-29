import { useMemo, useState } from 'react'
import {
  SCHOOL_MARKS,
  SCHOOL_SUBJECTS,
  SCHOOL_TRACK_SUBJECTS,
  normalizeSchoolSubject,
  schoolSubjectKey,
  schoolSubjectShort,
  uid,
} from './data'
import { countFivesInSubject } from './progress'
import { playDing } from './sound'
import type { AppData, SchoolMark } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  date: string
  readOnly?: boolean
  /** Inside another card (parent calendar) */
  embedded?: boolean
}

export function SchoolGradesCard({
  data,
  onChange,
  date,
  readOnly = false,
  embedded = false,
}: Props) {
  const grades = data.schoolGrades ?? []
  const todayGrades = grades.filter((g) => g.date === date)
  const [subject, setSubject] = useState('')
  const [custom, setCustom] = useState('')

  const subjects = useMemo(() => {
    const extra: string[] = []
    const seen = new Set(SCHOOL_SUBJECTS.map((s) => schoolSubjectKey(s)))
    for (const grade of grades) {
      const key = schoolSubjectKey(grade.subject)
      if (!key || seen.has(key)) continue
      seen.add(key)
      extra.push(grade.subject)
    }
    return [...SCHOOL_SUBJECTS, ...extra]
  }, [grades])

  const fiveCounts = SCHOOL_TRACK_SUBJECTS.map((name) => {
    const n = countFivesInSubject(grades, name)
    return `${schoolSubjectShort(name)} ${n}`
  }).join(' · ')

  function addGrade(mark: SchoolMark) {
    const name = normalizeSchoolSubject(subject || custom)
    if (!name) return
    if (mark === 5) playDing()
    onChange({
      ...data,
      schoolGrades: [
        ...grades,
        {
          id: uid(),
          date,
          subject: name,
          mark,
          createdAt: Date.now(),
        },
      ],
    })
    setCustom('')
  }

  function removeGrade(id: string) {
    onChange({
      ...data,
      schoolGrades: grades.filter((g) => g.id !== id),
      deletedSchoolGradeIds: [...(data.deletedSchoolGradeIds ?? []), id],
    })
  }

  const body = (
    <>
      <div className="card-title-row">
        {embedded ? <h3>Школа</h3> : <h2>Школа</h2>}
        {todayGrades.length ? (
          <span className="pill">{todayGrades.length}</span>
        ) : (
          <span className="pill muted">оценки</span>
        )}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Счётчик пятёрок: {fiveCounts}. Чтобы четверть без троек считалась —
        пиши все оценки, не только пятёрки.
      </p>

      {todayGrades.length ? (
        <ul className="school-grade-list">
          {todayGrades.map((grade) => (
            <li key={grade.id} className="school-grade-item">
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
                  onClick={() => removeGrade(grade.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {readOnly ? null : (
        <>
          <div className="create-chip-grid" style={{ marginTop: 10 }}>
            {subjects.map((name) => {
              const active =
                schoolSubjectKey(subject) === schoolSubjectKey(name)
              return (
                <button
                  key={name}
                  type="button"
                  className={active ? 'chip active' : 'chip'}
                  onClick={() => {
                    setSubject(active ? '' : name)
                    setCustom('')
                  }}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <div className="add-row" style={{ marginTop: 10 }}>
            <label className="field grow">
              <span>Другой предмет</span>
              <input
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value)
                  setSubject('')
                }}
                placeholder="Например: география"
              />
            </label>
          </div>
          {subject || custom.trim() ? (
            <div className="school-mark-row">
              {SCHOOL_MARKS.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  className={mark === 5 ? 'btn primary' : 'btn ghost'}
                  onClick={() => addGrade(mark)}
                >
                  {mark}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </>
  )

  if (embedded) {
    return <div className="calendar-detail-block">{body}</div>
  }
  return <section className="card">{body}</section>
}
