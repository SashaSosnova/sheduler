import { useMemo } from 'react'
import { MUST_DO_ITEMS, normalizeDayLog, todayKey } from './data'
import {
  countPerfectDays,
  countStars,
  currentStreak,
  dayStars,
  levelFromStars,
  perfectDaysInMonth,
  progressMilestones,
} from './progress'
import type { AppData } from './types'

type Props = {
  data: AppData
  onOpenToday: () => void
}

export function ProgressScreen({ data, onOpenToday }: Props) {
  const today = todayKey()
  const todayLog = normalizeDayLog(today, data.days[today])
  const todayDone = dayStars(todayLog)

  const stats = useMemo(() => {
    const stars = countStars(data.days)
    const { level, intoLevel, need } = levelFromStars(stars)
    const streak = currentStreak(data.days, today)
    const perfectMonth = perfectDaysInMonth(data.days)
    const perfectTotal = countPerfectDays(data.days)
    const milestones = progressMilestones({
      streak,
      perfectTotal,
      level,
      stars,
    })
    return { stars, level, intoLevel, need, streak, perfectMonth, milestones }
  }, [data.days, today])

  const levelPct = Math.min(100, (stats.intoLevel / stats.need) * 100)

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Прогресс</p>
        <h1>Мой прогресс</h1>
        <p className="sub">Звёзды за каждый пункт минимума · идеальный день — все 6</p>
      </header>

      <section className="card accent">
        <p className="eyebrow">Уровень</p>
        <p className="progress-level">{stats.level}</p>
        <p className="hint">
          {stats.intoLevel} из {stats.need} звёзд до уровня {stats.level + 1}
        </p>
        <div className="play-bar" aria-hidden>
          <div className="play-bar-fill" style={{ width: `${levelPct}%` }} />
        </div>
      </section>

      <section className="progress-stats">
        <div className="card soft progress-stat">
          <p className="progress-stat-value">{stats.streak}</p>
          <p className="progress-stat-label">серия</p>
        </div>
        <div className="card soft progress-stat">
          <p className="progress-stat-value">{stats.stars}</p>
          <p className="progress-stat-label">звёзды</p>
        </div>
        <div className="card soft progress-stat">
          <p className="progress-stat-value">{stats.perfectMonth}</p>
          <p className="progress-stat-label">идеальных в месяце</p>
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Сегодня</h2>
          <span className="pill">
            {todayDone}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <p className="sub">
          {todayDone >= MUST_DO_ITEMS.length
            ? 'Идеальный день! Так держать.'
            : `Ещё ${MUST_DO_ITEMS.length - todayDone}, чтобы закрыть идеальный день.`}
        </p>
        <div className="play-bar" aria-hidden>
          <div
            className="play-bar-fill"
            style={{
              width: `${(todayDone / MUST_DO_ITEMS.length) * 100}%`,
            }}
          />
        </div>
        <div className="row-gap">
          <button type="button" className="btn primary" onClick={onOpenToday}>
            Открыть «Сегодня»
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Вехи</h2>
        <ul className="status-list">
          {stats.milestones.map((m) => (
            <li key={m.id} className={m.done ? 'is-done' : ''}>
              <span className="status-mark" aria-hidden>
                {m.done ? '✓' : '○'}
              </span>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
