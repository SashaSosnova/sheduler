import {
  CREATE_IDEAS,
  MUST_DO_ITEMS,
  ROUTINE_NOTE,
  normalizeDayLog,
  todayKey,
} from './data'
import { FamilySyncCard } from './FamilySyncCard'
import type { FamilyStatus } from './familySync'
import { ScreenLimitCard } from './ScreenLimitCard'
import type { AppData, MustDoId, ScreenKind, ScreenSlot } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  onOpenExercises: () => void
  onOpenChew: () => void
  family: FamilyStatus
  firebaseReady: boolean
  onCreateFamily: () => Promise<void>
  onJoinFamily: (code: string) => Promise<void>
  onLeaveFamily: () => void
}

const OUTING_OPTIONS = [
  { value: 'none', label: 'Ничего особенного' },
  { value: 'friend', label: 'Гулять с другом' },
  { value: 'grandma', label: 'С бабушкой' },
  { value: 'parents', label: 'С родителями' },
]

export function TodayScreen({
  data,
  onChange,
  onOpenExercises,
  onOpenChew,
  family,
  firebaseReady,
  onCreateFamily,
  onJoinFamily,
  onLeaveFamily,
}: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const doneCount = MUST_DO_ITEMS.filter((i) => day.mustDo[i.id]).length
  const exerciseDone = data.exercises.filter((e) => day.exercisesDone[e.id]).length
  const exerciseTotal = data.exercises.length

  function patchDay(partial: Partial<typeof day>) {
    const next = normalizeDayLog(key, { ...day, ...partial })
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  function toggleMust(id: MustDoId) {
    patchDay({
      mustDo: { ...day.mustDo, [id]: !day.mustDo[id] },
    })
  }

  function setScreen(kind: ScreenKind, slot: ScreenSlot) {
    patchDay({
      screens: {
        ...day.screens,
        [kind]: slot,
      },
    })
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Сегодня</p>
        <h1>{formatRuDate(key)}</h1>
        <p className="sub">
          Сделано {doneCount} из {MUST_DO_ITEMS.length} · зарядка {exerciseDone}/
          {exerciseTotal || 0}
        </p>
      </header>

      <FamilySyncCard
        family={family}
        firebaseReady={firebaseReady}
        onCreate={onCreateFamily}
        onJoin={onJoinFamily}
        onLeave={onLeaveFamily}
      />

      <section className="card">
        <h2>Планы на день</h2>
        <label className="field">
          <span>Буду вне дома?</span>
          <select
            value={
              OUTING_OPTIONS.some((o) => o.value === day.outing)
                ? day.outing
                : 'none'
            }
            onChange={(e) => patchDay({ outing: e.target.value })}
          >
            {OUTING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Заметка</span>
          <input
            value={day.note}
            onChange={(e) => patchDay({ note: e.target.value })}
            placeholder="Например: гуляю после обеда"
          />
        </label>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Обязательный минимум</h2>
          <span className="pill">
            {doneCount}/{MUST_DO_ITEMS.length}
          </span>
        </div>
        <p className="hint">Время можно сдвигать — главное отметить сделанное.</p>
        <ul className="check-list">
          {MUST_DO_ITEMS.map((item) => (
            <li key={item.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(day.mustDo[item.id])}
                  onChange={() => toggleMust(item.id)}
                />
                <span>{item.label}</span>
              </label>
              {item.id === 'exercise' ? (
                <button type="button" className="linkish" onClick={onOpenExercises}>
                  Открыть упражнения →
                </button>
              ) : null}
              {item.id === 'chew' ? (
                <button type="button" className="linkish" onClick={onOpenChew}>
                  Открыть дневник жевания →
                </button>
              ) : null}
              {item.id === 'create' ? (
                <div className="create-box">
                  <p className="hint">Выбери одно занятие на сегодня:</p>
                  <div className="chip-row">
                    {CREATE_IDEAS.map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        className={day.createNote === idea ? 'chip active' : 'chip'}
                        onClick={() =>
                          patchDay({
                            createNote: idea,
                            mustDo: { ...day.mustDo, create: true },
                          })
                        }
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>Или своё</span>
                    <input
                      value={CREATE_IDEAS.includes(day.createNote) ? '' : day.createNote}
                      onChange={(e) => {
                        const v = e.target.value
                        patchDay({
                          createNote: v,
                          mustDo: {
                            ...day.mustDo,
                            create: Boolean(v.trim()),
                          },
                        })
                      }}
                      placeholder="Напиши сам"
                    />
                  </label>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Экраны — лимит времени</h2>
        <p className="hint">
          Это не «надо сделать», а ограничение. Нажми «Начать» — запустится таймер.
          Когда время вышло, на сегодня лимит использован.
        </p>
        <div className="screen-limits">
          <ScreenLimitCard
            kind="roblox"
            slot={day.screens.roblox}
            onChange={(slot) => setScreen('roblox', slot)}
          />
          <ScreenLimitCard
            kind="cartoons"
            slot={day.screens.cartoons}
            onChange={(slot) => setScreen('cartoons', slot)}
          />
        </div>
      </section>

      <section className="card soft">
        <h2>Если день пошёл иначе</h2>
        <p className="hint">
          Гуляние с другом, бабушка или поездка уже считаются свободным временем. Вечером
          добери 1–2 пункта из минимума — и день хороший.
        </p>
        <p className="hint" style={{ marginTop: 8 }}>
          {ROUTINE_NOTE}
        </p>
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
