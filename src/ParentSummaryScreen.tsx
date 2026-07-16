import { MUST_DO_ITEMS, normalizeDayLog, todayKey } from './data'
import { FamilySyncCard } from './FamilySyncCard'
import type { FamilyStatus } from './familySync'
import type { AppData } from './types'

type Props = {
  data: AppData
  family: FamilyStatus
  firebaseReady: boolean
  onCreateFamily: () => Promise<void>
  onJoinFamily: (code: string) => Promise<void>
  onLeaveFamily: () => void
  onOpenExercises: () => void
  onOpenChew: () => void
}

export function ParentSummaryScreen({
  data,
  family,
  firebaseReady,
  onCreateFamily,
  onJoinFamily,
  onLeaveFamily,
  onOpenExercises,
  onOpenChew,
}: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const doneCount = MUST_DO_ITEMS.filter((i) => day.mustDo[i.id]).length
  const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const exerciseTotal = data.exercises.length
  const extraDone = day.extraTasks.filter((t) => t.done).length
  const chewToday = (data.chewEntries ?? [])
    .filter((e) => e.date === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0]

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Родитель · только просмотр</p>
        <h1>{formatRuDate(key)}</h1>
        <p className="sub">
          Минимум {doneCount}/{MUST_DO_ITEMS.length} · зарядка {exerciseDone}/
          {exerciseTotal || 0}
          {day.extraTasks.length
            ? ` · ещё ${extraDone}/${day.extraTasks.length}`
            : ''}
        </p>
      </header>

      <FamilySyncCard
        family={family}
        firebaseReady={firebaseReady}
        onCreate={onCreateFamily}
        onJoin={onJoinFamily}
        onLeave={onLeaveFamily}
        joinPreferred
      />

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <ul className="status-list">
          {MUST_DO_ITEMS.map((item) => {
            const done = Boolean(day.mustDo[item.id])
            return (
              <li key={item.id} className={done ? 'is-done' : ''}>
                <span className="status-mark" aria-hidden>
                  {done ? '✓' : '○'}
                </span>
                <span>
                  {item.label}
                  {item.id === 'create' && day.createNote ? (
                    <span className="hint"> — {day.createNote}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {day.extraTasks.length ? (
        <section className="card">
          <div className="card-title-row">
            <h2>Планы на день</h2>
            <span className="pill">
              {extraDone}/{day.extraTasks.length}
            </span>
          </div>
          <ul className="status-list">
            {day.extraTasks.map((task) => (
              <li key={task.id} className={task.done ? 'is-done' : ''}>
                <span className="status-mark" aria-hidden>
                  {task.done ? '✓' : '○'}
                </span>
                <span>{task.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <div className="card-title-row">
          <h2>Зарядка</h2>
          <span className="pill">
            {exerciseDone}/{exerciseTotal || 0}
          </span>
        </div>
        <p className="hint">
          {exerciseDone === 0
            ? 'Пока ничего не отмечено.'
            : exerciseDone === exerciseTotal
              ? 'Весь комплекс отмечен.'
              : `Сделано ${exerciseDone} из ${exerciseTotal}.`}
        </p>
        <div className="row-gap">
          <button type="button" className="btn" onClick={onOpenExercises}>
            Смотреть упражнения →
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Дневник жевания</h2>
          <span className={chewToday ? 'pill' : 'pill muted'}>
            {chewToday ? 'есть' : 'нет'}
          </span>
        </div>
        {chewToday ? (
          <>
            <p>
              <strong>{chewToday.food}</strong>
            </p>
            <p className="hint">Левая: {chewToday.left.join(', ')}</p>
            <p className="hint">Правая: {chewToday.right.join(', ')}</p>
          </>
        ) : (
          <p className="hint">Сегодня ещё не заполнено.</p>
        )}
        <div className="row-gap">
          <button type="button" className="btn" onClick={onOpenChew}>
            Открыть дневник →
          </button>
        </div>
      </section>
    </div>
  )
}

function formatRuDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
