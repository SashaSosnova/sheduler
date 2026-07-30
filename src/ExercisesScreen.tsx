import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  activeExercises,
  applyMustDoFlags,
  controlForExerciseOnDate,
  controlsForDate,
  exerciseGroupNames,
  formatDuration,
  formatPlayTime,
  groupExercises,
  moveExerciseInList,
  normalizeDayLog,
  parseTimerRounds,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import { stampPerfectAt } from './progress'
import { playDing } from './sound'
import { Timer } from './Timer'
import type { AppData, Exercise, ExerciseControl } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  /** Parent: list + manage; child: wizard */
  readOnly?: boolean
}

export function ExercisesScreen({
  data,
  onChange,
  readOnly = false,
}: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const routine = activeExercises(data.exercises)

  const doneCount = routine.filter((e) => day.exercisesDone[e.id]).length
  const total = routine.length
  const workoutSec = workoutDurationSec(day)
  const groups = useMemo(() => groupExercises(routine), [routine])

  const current =
    routine.find((e) => !day.exercisesDone[e.id]) ?? null
  const currentIndex = current
    ? routine.findIndex((e) => e.id === current.id)
    : -1
  const allDone = total > 0 && current == null
  const todayControls = controlsForDate(data.exerciseControls, key)

  function patchDayExercises(
    exercisesDone: Record<string, boolean>,
    timersHonored: Record<string, boolean>,
  ) {
    const now = Date.now()
    const everyDone =
      routine.length > 0 && routine.every((e) => exercisesDone[e.id])
    const anyDone = routine.some((e) => exercisesDone[e.id])

    let workoutStartedAt = day.workoutStartedAt
    let workoutFinishedAt = day.workoutFinishedAt

    if (!anyDone) {
      workoutStartedAt = null
      workoutFinishedAt = null
    } else {
      if (workoutStartedAt == null) workoutStartedAt = now
      workoutFinishedAt = everyDone ? (workoutFinishedAt ?? now) : null
    }

    if (everyDone && day.workoutFinishedAt == null) {
      playDing()
    }

    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, {
        ...day,
        exercisesDone,
        timersHonored,
        workoutStartedAt,
        workoutFinishedAt,
        ...applyMustDoFlags(
          day,
          { exercise: everyDone },
          everyDone ? (workoutFinishedAt ?? now) : now,
        ),
      }),
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  function markDone(ex: Exercise, withTimer: boolean) {
    if (readOnly) return
    const exercisesDone = { ...day.exercisesDone, [ex.id]: true }
    const timersHonored = { ...day.timersHonored }
    if (withTimer) timersHonored[ex.id] = true
    patchDayExercises(exercisesDone, timersHonored)
  }

  function markControlFilmed(controlId: string) {
    onChange({
      ...data,
      exerciseControls: (data.exerciseControls ?? []).map((c) =>
        c.id === controlId ? { ...c, filmed: true } : c,
      ),
    })
  }

  if (readOnly) {
    return (
      <ParentExerciseScreen
        data={data}
        onChange={onChange}
        day={day}
        dayKey={key}
        doneCount={doneCount}
        total={total}
        workoutSec={workoutSec}
        groups={groups}
        todayControls={todayControls}
      />
    )
  }

  const currentControl = current
    ? controlForExerciseOnDate(data.exerciseControls, key, current.id)
    : undefined

  return (
    <div className="screen ex-wizard-screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Зарядка · ДЗ №28</p>
        </div>
        <h1>Комплекс упражнений</h1>
        <p className="sub">
          {allDone
            ? `Готово · ${total} из ${total}`
            : `${doneCount} из ${total}`}
        </p>
        {workoutSec != null ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
        {todayControls.some((c) => !c.filmed) ? (
          <p className="sub ex-control-today-hint">
            Сегодня контроль — снять упражнение на видео
          </p>
        ) : null}
      </header>

      <div
        className="ex-wizard-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
        aria-label="Прогресс зарядки"
      >
        <div
          className="ex-wizard-progress-bar"
          style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
        />
      </div>

      {allDone ? (
        <div className="card ex-wizard-card ex-wizard-complete">
          <p className="ex-wizard-complete-title">Зарядка сделана</p>
          <p className="ex-wizard-complete-sub">
            Все {total} упражнений отмечены. Можно отдыхать.
          </p>
        </div>
      ) : current ? (
        <WizardStep
          key={current.id}
          exercise={current}
          step={currentIndex + 1}
          total={total}
          control={currentControl}
          onDone={() => markDone(current, false)}
          onTimerDone={() => markDone(current, true)}
          onControlFilmed={
            currentControl && !currentControl.filmed
              ? () => markControlFilmed(currentControl.id)
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

function WizardStep({
  exercise,
  step,
  total,
  control,
  onDone,
  onTimerDone,
  onControlFilmed,
}: {
  exercise: Exercise
  step: number
  total: number
  control?: ExerciseControl
  onDone: () => void
  onTimerDone: () => void
  onControlFilmed?: () => void
}) {
  const note = exercise.notes.trim()
  const hasTimer = exercise.durationSec > 0
  const rounds = hasTimer ? parseTimerRounds(exercise.reps) : 1
  const needsFilm = Boolean(control && !control.filmed)

  return (
    <div className="card ex-wizard-card">
      <p className="ex-wizard-step">
        Упражнение {step} из {total}
      </p>
      <p className="ex-wizard-group">{exercise.group}</p>
      <h2 className="ex-wizard-name">{exercise.name}</h2>
      {needsFilm ? (
        <div className="ex-control-badge">
          <p className="ex-control-badge-title">Контроль · снять на видео</p>
          <p className="ex-control-badge-sub">
            Миотерапевт ждёт запись этого упражнения
          </p>
          {onControlFilmed ? (
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 10 }}
              onClick={onControlFilmed}
            >
              Снято на видео
            </button>
          ) : null}
        </div>
      ) : control?.filmed ? (
        <p className="pill ex-control-done-pill">Контроль снят ✓</p>
      ) : null}
      {note ? <p className="ex-wizard-desc">{note}</p> : null}

      <div className="ex-wizard-meta">
        {exercise.reps ? (
          <span className="pill muted">{exercise.reps}</span>
        ) : null}
        {hasTimer ? (
          <span className="pill muted">
            {rounds > 1
              ? `${formatDuration(exercise.durationSec)} × ${rounds}`
              : formatDuration(exercise.durationSec)}
          </span>
        ) : null}
      </div>

      {hasTimer ? (
        <Timer
          key={exercise.id}
          persistKey={exercise.id}
          seconds={exercise.durationSec}
          rounds={rounds}
          onFinish={onTimerDone}
        />
      ) : (
        <button type="button" className="btn primary wide" onClick={onDone}>
          Сделано
        </button>
      )}
    </div>
  )
}

function ParentExerciseScreen({
  data,
  onChange,
  day,
  dayKey,
  doneCount,
  total,
  workoutSec,
  groups,
  todayControls,
}: {
  data: AppData
  onChange: (next: AppData) => void
  day: ReturnType<typeof normalizeDayLog>
  dayKey: string
  doneCount: number
  total: number
  workoutSec: number | null
  groups: ReturnType<typeof groupExercises>
  todayControls: ExerciseControl[]
}) {
  const [manageOpen, setManageOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [controlOpen, setControlOpen] = useState(false)
  const [controlIds, setControlIds] = useState<string[]>([])
  const [controlDate, setControlDate] = useState(dayKey)
  const groupOptions = exerciseGroupNames(data.exercises)
  const active = activeExercises(data.exercises)
  const controlPickerGroups = useMemo(
    () => groupExercises(active),
    [active],
  )
  function setExerciseEnabled(id: string, enabled: boolean) {
    onChange({
      ...data,
      exercises: data.exercises.map((ex) =>
        ex.id === id ? { ...ex, enabled } : ex,
      ),
    })
  }

  function reorderExercises(fromIndex: number, toIndex: number) {
    onChange({
      ...data,
      exercises: moveExerciseInList(data.exercises, fromIndex, toIndex),
    })
  }

  function addExercise(ex: Omit<Exercise, 'id' | 'custom' | 'enabled'>) {
    const next: Exercise = {
      ...ex,
      id: uid(),
      custom: true,
      enabled: true,
    }
    onChange({
      ...data,
      exercises: [...data.exercises, next],
    })
    setAddOpen(false)
  }

  function toggleControlPick(id: string) {
    setControlIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function assignControls() {
    if (controlIds.length === 0 || !controlDate) return
    const existing = data.exerciseControls ?? []
    const additions: ExerciseControl[] = []
    for (const exerciseId of controlIds) {
      const already = existing.some(
        (c) =>
          c.exerciseId === exerciseId &&
          c.date === controlDate &&
          !c.filmed,
      )
      if (already) continue
      if (additions.some((c) => c.exerciseId === exerciseId)) continue
      additions.push({
        id: uid(),
        exerciseId,
        date: controlDate,
        filmed: false,
      })
    }
    if (additions.length === 0) {
      setControlOpen(false)
      setControlIds([])
      return
    }
    onChange({
      ...data,
      exerciseControls: [...existing, ...additions],
    })
    setControlOpen(false)
    setControlIds([])
  }

  function removeControl(id: string) {
    onChange({
      ...data,
      exerciseControls: (data.exerciseControls ?? []).filter((c) => c.id !== id),
    })
  }

  function toggleControlFilmed(id: string) {
    onChange({
      ...data,
      exerciseControls: (data.exerciseControls ?? []).map((c) =>
        c.id === id ? { ...c, filmed: !c.filmed } : c,
      ),
    })
  }

  const upcomingControls = (data.exerciseControls ?? [])
    .filter((c) => c.date >= dayKey)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
        </div>
        <h1>Зарядка</h1>
        <p className="sub">
          Сегодня {doneCount} из {total}
          {day.mustDo.exercise &&
          (doneCount === 0 ||
            (total > 0 && doneCount === total && workoutSec == null))
            ? ' · отметил родитель'
            : ''}
        </p>
        {workoutSec != null ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
      </header>

      <section className="card">
        <div className="card-title-row">
          <h2>Контроль (видео)</h2>
          <button
            type="button"
            className="pill muted"
            onClick={() => {
              setControlDate(dayKey)
              setControlIds([])
              setControlOpen((v) => !v)
            }}
          >
            {controlOpen ? 'Скрыть' : 'Назначить'}
          </button>
        </div>
        {todayControls.length > 0 ? (
          <ul className="check-list" style={{ marginTop: 8 }}>
            {todayControls.map((c) => {
              const name =
                data.exercises.find((e) => e.id === c.exerciseId)?.name ??
                c.exerciseId
              return (
                <li key={c.id}>
                  <div className="check-row with-action">
                    <label className="check-row-main">
                      <input
                        type="checkbox"
                        checked={c.filmed}
                        onChange={() => toggleControlFilmed(c.id)}
                      />
                      <span className={c.filmed ? 'is-done' : undefined}>
                        Сегодня · {name}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Удалить"
                      onClick={() => removeControl(c.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="hint">Сегодня контроля нет</p>
        )}
        {upcomingControls.filter((c) => c.date !== dayKey).length > 0 ? (
          <ul className="calendar-exercise-list" style={{ marginTop: 10 }}>
            {upcomingControls
              .filter((c) => c.date !== dayKey)
              .map((c) => {
                const name =
                  data.exercises.find((e) => e.id === c.exerciseId)?.name ??
                  c.exerciseId
                return (
                  <li key={c.id} className={c.filmed ? 'done' : ''}>
                    {c.date} · {name}
                    {c.filmed ? ' · снято' : ''}
                    <button
                      type="button"
                      className="linkish"
                      style={{ marginLeft: 8 }}
                      onClick={() => removeControl(c.id)}
                    >
                      убрать
                    </button>
                  </li>
                )
              })}
          </ul>
        ) : null}
        {controlOpen ? (
          <div className="ex-control-form">
            <label className="field">
              <span>Дата съёмки</span>
              <input
                type="date"
                value={controlDate}
                onChange={(e) => setControlDate(e.target.value)}
              />
            </label>
            <p className="hint">Отметь одно или несколько упражнений</p>
            <div className="ex-control-pick">
              {controlPickerGroups.map(({ group, items }) => (
                <div key={group} className="ex-control-pick-group">
                  <p className="ex-control-pick-title">{group}</p>
                  <ul className="check-list">
                    {items.map((ex) => {
                      const checked = controlIds.includes(ex.id)
                      return (
                        <li key={ex.id}>
                          <label className="check-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleControlPick(ex.id)}
                            />
                            <span>{ex.name}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="row-gap" style={{ marginTop: 4 }}>
              <button
                type="button"
                className="btn primary"
                disabled={controlIds.length === 0 || !controlDate}
                onClick={assignControls}
              >
                {controlIds.length > 1
                  ? `Назначить контроль (${controlIds.length})`
                  : 'Назначить контроль'}
              </button>
              {controlIds.length > 0 ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setControlIds([])}
                >
                  Сбросить выбор
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="parent-ex-groups">
        {groups.map(({ group, items }) => {
          const groupDone = items.filter((ex) => day.exercisesDone[ex.id]).length
          return (
            <details key={group} className="parent-ex-group">
              <summary className="parent-ex-group-head">
                <span className="parent-ex-group-title">{group}</span>
                <span className="pill">
                  {groupDone}/{items.length}
                </span>
              </summary>
              <ul className="parent-ex-list">
                {items.map((ex) => {
                  const checked = Boolean(day.exercisesDone[ex.id])
                  const control = controlForExerciseOnDate(
                    data.exerciseControls,
                    dayKey,
                    ex.id,
                  )
                  return (
                    <li
                      key={ex.id}
                      className={`parent-ex-row ${checked ? 'is-done' : ''}`}
                    >
                      <label className="parent-ex-item">
                        <input type="checkbox" checked={checked} disabled />
                        <span className="ex-name">
                          {ex.name}
                          {control ? (
                            <span className="ex-control-inline">
                              {control.filmed
                                ? ' · контроль снят'
                                : ' · контроль'}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </div>

      <section className="card">
        <div className="card-title-row">
          <h2>Состав комплекса</h2>
          <div className="ex-manage-head-actions">
            <button
              type="button"
              className={addOpen ? 'pill' : 'pill muted'}
              onClick={() => {
                setAddOpen((v) => !v)
                if (!manageOpen) setManageOpen(true)
              }}
            >
              {addOpen ? 'Закрыть' : '+ Добавить'}
            </button>
            <button
              type="button"
              className="pill muted"
              onClick={() => setManageOpen((v) => !v)}
            >
              {manageOpen ? 'Скрыть' : 'Настроить'}
            </button>
          </div>
        </div>
        <p className="hint">
          Зажми строку и перетащи на нужное место. Отключённые не показываются
          ребёнку.
        </p>
        {addOpen ? (
          <AddExerciseForm
            groupOptions={groupOptions}
            onAdd={addExercise}
            onCancel={() => setAddOpen(false)}
          />
        ) : null}
        {manageOpen ? (
          <ManageExerciseList
            exercises={data.exercises}
            onToggleEnabled={setExerciseEnabled}
            onReorder={reorderExercises}
          />
        ) : null}
      </section>
    </div>
  )
}

const LONG_PRESS_MS = 380

function ManageExerciseList({
  exercises,
  onToggleEnabled,
  onReorder,
}: {
  exercises: Exercise[]
  onToggleEnabled: (id: string, enabled: boolean) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const pressTimer = useRef<number | null>(null)
  const fromIndexRef = useRef<number | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder

  function clearPressTimer() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function indexFromPoint(clientY: number): number | null {
    const list = listRef.current
    if (!list) return null
    const rows = [...list.querySelectorAll<HTMLElement>('[data-ex-index]')]
    if (rows.length === 0) return null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return Number(row.dataset.exIndex)
      }
    }
    const first = rows[0]!.getBoundingClientRect()
    const last = rows[rows.length - 1]!.getBoundingClientRect()
    if (clientY < first.top) return 0
    if (clientY > last.bottom) return rows.length - 1
    return null
  }

  function endDrag(commit: boolean) {
    clearPressTimer()
    const from = fromIndexRef.current
    const to = overIndexRef.current
    draggingRef.current = false
    fromIndexRef.current = null
    overIndexRef.current = null
    setDragIndex(null)
    setOverIndex(null)
    if (commit && from != null && to != null && from !== to) {
      onReorderRef.current(from, to)
    }
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current) return
      e.preventDefault()
      const idx = indexFromPoint(e.clientY)
      if (idx == null) return
      overIndexRef.current = idx
      setOverIndex(idx)
    }
    function onUp() {
      if (draggingRef.current) endDrag(true)
      else clearPressTimer()
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      clearPressTimer()
    }
  }, [])

  function onRowPointerDown(index: number, e: ReactPointerEvent) {
    if (
      (e.target as HTMLElement).closest('input,button,label.ex-manage-toggle')
    ) {
      return
    }
    clearPressTimer()
    pressTimer.current = window.setTimeout(() => {
      draggingRef.current = true
      fromIndexRef.current = index
      overIndexRef.current = index
      setDragIndex(index)
      setOverIndex(index)
    }, LONG_PRESS_MS)
  }

  function onRowPointerUp() {
    if (!draggingRef.current) clearPressTimer()
  }

  return (
    <ul ref={listRef} className="ex-manage-list">
      {exercises.map((ex, index) => {
        const on = ex.enabled !== false
        const isDrag = dragIndex === index
        const isOver = overIndex === index && dragIndex != null && dragIndex !== index
        return (
          <li
            key={ex.id}
            data-ex-index={index}
            className={[
              'ex-manage-row',
              on ? '' : 'is-disabled',
              isDrag ? 'is-dragging' : '',
              isOver ? 'is-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={(e) => onRowPointerDown(index, e)}
            onPointerUp={onRowPointerUp}
            onPointerCancel={onRowPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="ex-manage-handle" aria-hidden>
              ⋮⋮
            </span>
            <label className="ex-manage-toggle">
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggleEnabled(ex.id, !on)}
              />
            </label>
            <span className="ex-manage-body">
              <span className="ex-manage-name">
                {ex.name}
                {ex.custom ? <span className="hint"> · своё</span> : null}
                {!on ? <span className="hint"> · отключено</span> : null}
              </span>
              <span className="ex-manage-group">{ex.group}</span>
            </span>
            <span className="ex-manage-pos">{index + 1}</span>
          </li>
        )
      })}
    </ul>
  )
}

function AddExerciseForm({
  groupOptions,
  onAdd,
  onCancel,
}: {
  groupOptions: string[]
  onAdd: (ex: Omit<Exercise, 'id' | 'custom' | 'enabled'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState(groupOptions[0] ?? 'Другое')
  const [customGroup, setCustomGroup] = useState('')
  const [useCustomGroup, setUseCustomGroup] = useState(false)
  const [reps, setReps] = useState('')
  const [durationSec, setDurationSec] = useState('0')
  const [notes, setNotes] = useState('')

  const resolvedGroup = useCustomGroup
    ? customGroup.trim() || 'Другое'
    : group

  return (
    <div className="ex-add-form">
      <label className="field">
        <span>Название</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Язык к носу"
        />
      </label>
      <label className="field">
        <span>Группа</span>
        <select
          value={useCustomGroup ? '__custom' : group}
          onChange={(e) => {
            if (e.target.value === '__custom') {
              setUseCustomGroup(true)
            } else {
              setUseCustomGroup(false)
              setGroup(e.target.value)
            }
          }}
        >
          {groupOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value="__custom">Своя группа…</option>
        </select>
      </label>
      {useCustomGroup ? (
        <label className="field">
          <span>Название группы</span>
          <input
            value={customGroup}
            onChange={(e) => setCustomGroup(e.target.value)}
            placeholder="Группа"
          />
        </label>
      ) : null}
      <label className="field">
        <span>Повторы / подходы</span>
        <input
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="например: 10 раз"
        />
      </label>
      <label className="field">
        <span>Таймер (сек, 0 = без таймера)</span>
        <input
          inputMode="numeric"
          value={durationSec}
          onChange={(e) =>
            setDurationSec(e.target.value.replace(/[^\d]/g, '').slice(0, 4))
          }
        />
      </label>
      <label className="field">
        <span>Заметки</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Как выполнять"
        />
      </label>
      <div className="row-gap">
        <button
          type="button"
          className="btn primary"
          disabled={!name.trim()}
          onClick={() =>
            onAdd({
              name: name.trim(),
              group: resolvedGroup,
              reps: reps.trim(),
              durationSec: Number(durationSec) || 0,
              notes: notes.trim(),
            })
          }
        >
          Добавить
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  )
}
