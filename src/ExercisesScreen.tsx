import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ControlCamera,
  type ControlCameraHandle,
} from './ControlCamera'
import {
  activeExercises,
  applyMustDoFlags,
  clearExercisesCredit,
  closeOpenWorkoutSession,
  controlForExerciseOnDate,
  controlsForDate,
  ensureOpenWorkoutSession,
  exerciseGroupNames,
  formatDuration,
  formatPlayTime,
  groupExercises,
  groupGearNeeds,
  markExercisesPartialCredit,
  moveExerciseToPosition,
  normalizeDayLog,
  parseTimerRounds,
  schoolDayPlanFromData,
  todayKey,
  uid,
  workoutDurationSec,
} from './data'
import {
  getExerciseVideoClips,
  getExerciseVideoClipsForExercises,
  removeExerciseVideoClips,
  saveExerciseVideoClip,
  shareExerciseVideos,
  type ExerciseVideoClip,
} from './exerciseVideo'
import { stampPerfectAt } from './progress'
import { playDing } from './sound'
import { Timer } from './Timer'
import type { AppData, Exercise, ExerciseControl, WorkoutSession } from './types'

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
  const allDone = total > 0 && doneCount === total
  const todayControls = controlsForDate(data.exerciseControls, key)

  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [skippedInPass, setSkippedInPass] = useState<Set<string>>(
    () => new Set(),
  )
  const [shareBusy, setShareBusy] = useState(false)
  const [shareHint, setShareHint] = useState<string | null>(null)
  const [unsentClips, setUnsentClips] = useState<ExerciseVideoClip[]>(() =>
    getExerciseVideoClips(key),
  )
  /** Briefly highlight share after a control block finishes. */
  const [sharePulse, setSharePulse] = useState(false)

  function refreshUnsentClips() {
    setUnsentClips(getExerciseVideoClips(key))
  }

  useEffect(() => {
    setShareHint(null)
    setSharePulse(false)
    setUnsentClips(getExerciseVideoClips(key))
  }, [key])

  const groupItems = useMemo(() => {
    if (!activeGroup) return []
    return groups.find((g) => g.group === activeGroup)?.items ?? []
  }, [activeGroup, groups])

  const groupPending = groupItems.filter((e) => !day.exercisesDone[e.id])
  const current =
    groupPending.find((e) => !skippedInPass.has(e.id)) ?? null
  const currentIndexInGroup = current
    ? groupItems.findIndex((e) => e.id === current.id)
    : -1
  const groupDoneCount = groupItems.filter((e) => day.exercisesDone[e.id])
    .length

  function commitDay(partial: Partial<typeof day>) {
    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, { ...day, ...partial }),
      schoolDayPlanFromData(data),
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  // Wizard state is not persisted — close a dangling approach on enter/picker.
  useEffect(() => {
    if (readOnly || activeGroup) return
    const sessions = day.workoutSessions ?? []
    if (!sessions.some((s) => s.endedAt == null)) return
    commitDay({
      workoutSessions: closeOpenWorkoutSession(sessions, Date.now()),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, activeGroup, key])

  function patchDayExercises(
    exercisesDone: Record<string, boolean>,
    timersHonored: Record<string, boolean>,
    opts?: { closeSession?: boolean },
  ) {
    const now = Date.now()
    const everyDone =
      routine.length > 0 && routine.every((e) => exercisesDone[e.id])
    const anyDone = routine.some((e) => exercisesDone[e.id])

    let workoutStartedAt = day.workoutStartedAt
    let workoutFinishedAt = day.workoutFinishedAt
    let workoutSessions: WorkoutSession[] = day.workoutSessions ?? []
    let exercisePartial = day.exercisePartial

    if (!anyDone) {
      workoutStartedAt = null
      workoutFinishedAt = null
      workoutSessions = []
      exercisePartial = false
    } else {
      if (workoutStartedAt == null) workoutStartedAt = now
      workoutSessions = ensureOpenWorkoutSession(workoutSessions, now)
      if (opts?.closeSession || everyDone) {
        workoutSessions = closeOpenWorkoutSession(workoutSessions, now)
      }
      if (everyDone) {
        workoutFinishedAt = workoutFinishedAt ?? now
        exercisePartial = false
      } else {
        workoutFinishedAt = null
      }
    }

    if (everyDone && day.workoutFinishedAt == null) {
      playDing()
    }

    const keepPartialStar = exercisePartial && anyDone && !everyDone
    commitDay({
      exercisesDone,
      timersHonored,
      workoutStartedAt,
      workoutFinishedAt,
      workoutSessions,
      exercisePartial,
      ...applyMustDoFlags(
        day,
        { exercise: everyDone || keepPartialStar },
        everyDone ? (workoutFinishedAt ?? now) : now,
      ),
    })
  }

  function markDone(ex: Exercise, withTimer: boolean) {
    if (readOnly) return
    const exercisesDone = { ...day.exercisesDone, [ex.id]: true }
    const timersHonored = { ...day.timersHonored }
    if (withTimer) timersHonored[ex.id] = true

    const everyDone =
      routine.length > 0 && routine.every((e) => exercisesDone[e.id])
    const groupFullyDone = groupItems.every((e) => exercisesDone[e.id])
    const remainingInPass = groupItems.filter(
      (e) =>
        !exercisesDone[e.id] &&
        !skippedInPass.has(e.id) &&
        e.id !== ex.id,
    )

    patchDayExercises(exercisesDone, timersHonored, {
      closeSession: everyDone || groupFullyDone || remainingInPass.length === 0,
    })

    if (everyDone || groupFullyDone || remainingInPass.length === 0) {
      if (groupFullyDone && activeGroup) {
        const blockClips = getExerciseVideoClipsForExercises(
          groupItems.map((e) => e.id),
          key,
        )
        if (blockClips.length > 0) {
          refreshUnsentClips()
          setSharePulse(true)
          setShareHint(null)
        }
      }
      setActiveGroup(null)
      setSkippedInPass(new Set())
    }
  }

  function skipCurrent() {
    if (!current) return
    const nextSkipped = new Set(skippedInPass)
    nextSkipped.add(current.id)
    const remaining = groupItems.filter(
      (e) => !day.exercisesDone[e.id] && !nextSkipped.has(e.id),
    )
    if (remaining.length === 0) {
      const now = Date.now()
      commitDay({
        workoutSessions: closeOpenWorkoutSession(
          day.workoutSessions ?? [],
          now,
        ),
      })
      setActiveGroup(null)
      setSkippedInPass(new Set())
      return
    }
    setSkippedInPass(nextSkipped)
  }

  function backToBlocks() {
    const now = Date.now()
    commitDay({
      workoutSessions: closeOpenWorkoutSession(day.workoutSessions ?? [], now),
    })
    setActiveGroup(null)
    setSkippedInPass(new Set())
  }

  function openGroup(group: string) {
    setSharePulse(false)
    setActiveGroup(group)
    setSkippedInPass(new Set())
  }

  function markControlFilmed(controlId: string) {
    onChange({
      ...data,
      exerciseControls: (data.exerciseControls ?? []).map((c) =>
        c.id === controlId ? { ...c, filmed: true } : c,
      ),
    })
  }

  async function handleControlVideo(
    exercise: Exercise,
    controlId: string,
    blob: Blob | null,
  ) {
    if (!blob || blob.size === 0) return
    await saveExerciseVideoClip({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      blob,
    })
    refreshUnsentClips()
    markControlFilmed(controlId)
  }

  async function sendUnsentVideos() {
    const clips = getExerciseVideoClips(key)
    if (clips.length === 0) {
      setShareHint('Нет записанных видео')
      refreshUnsentClips()
      return
    }
    setShareBusy(true)
    setShareHint(null)
    try {
      const result = await shareExerciseVideos(clips)
      // Keep clips on cancel / share / download — Android often reports
      // success even when the sheet was dismissed. User clears explicitly.
      if (result === 'cancelled') {
        setShareHint('Отменено — можно отправить снова')
      } else if (result === 'downloaded') {
        setShareHint('Файл скачан — можно отправить снова или убрать')
      } else {
        setShareHint('Если отправила — можно убрать из списка')
      }
      refreshUnsentClips()
    } catch (err) {
      setShareHint(
        err instanceof Error ? err.message : 'Не удалось отправить видео',
      )
      refreshUnsentClips()
    } finally {
      setShareBusy(false)
    }
  }

  function clearUnsentVideos() {
    const clips = getExerciseVideoClips(key)
    removeExerciseVideoClips(
      clips.map((c) => c.id),
      key,
    )
    refreshUnsentClips()
    setSharePulse(false)
    setShareHint(null)
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
  const showTime =
    workoutSec != null &&
    (allDone ||
      day.exercisePartial ||
      (day.workoutSessions?.length ?? 0) > 0)

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
            : day.exercisePartial
              ? `Частично · ${doneCount} из ${total}`
              : `${doneCount} из ${total}`}
        </p>
        {showTime ? (
          <p className="sub workout-time">
            {allDone || day.exercisePartial
              ? `Сегодня зарядка заняла ${formatPlayTime(workoutSec!)}`
              : `Чистое время · ${formatPlayTime(workoutSec!)}`}
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
          {unsentClips.length > 0 ? (
            <ControlVideoShare
              clips={unsentClips}
              busy={shareBusy}
              hint={shareHint}
              pulse={sharePulse}
              onSend={() => void sendUnsentVideos()}
              onClear={clearUnsentVideos}
            />
          ) : null}
        </div>
      ) : activeGroup && current ? (
        <>
          <div className="ex-wizard-nav">
            <button type="button" className="linkish" onClick={backToBlocks}>
              ← К блокам
            </button>
            <span className="ex-wizard-nav-meta">
              {groupDoneCount} из {groupItems.length} в блоке
            </span>
          </div>
          <WizardStep
            key={current.id}
            exercise={current}
            step={currentIndexInGroup + 1}
            total={groupItems.length}
            control={currentControl}
            onDone={() => markDone(current, false)}
            onTimerDone={() => markDone(current, true)}
            onSkip={skipCurrent}
            onControlVideo={
              currentControl && !currentControl.filmed
                ? (blob) =>
                    handleControlVideo(current, currentControl.id, blob)
                : undefined
            }
            onControlFilmed={
              currentControl && !currentControl.filmed
                ? () => markControlFilmed(currentControl.id)
                : undefined
            }
          />
        </>
      ) : (
        <BlockPicker
          groups={groups}
          exercisesDone={day.exercisesDone}
          onPick={openGroup}
          shareClips={unsentClips}
          shareBusy={shareBusy}
          shareHint={shareHint}
          sharePulse={sharePulse}
          onShare={() => void sendUnsentVideos()}
          onClearShare={clearUnsentVideos}
        />
      )}
    </div>
  )
}

function ControlVideoShare({
  clips,
  busy,
  hint,
  pulse,
  onSend,
  onClear,
}: {
  clips: ExerciseVideoClip[]
  busy: boolean
  hint: string | null
  pulse?: boolean
  onSend: () => void
  onClear: () => void
}) {
  const countLabel =
    clips.length === 1
      ? '1 запись'
      : clips.length < 5
        ? `${clips.length} записи`
        : `${clips.length} записей`
  const names = clips.map((c) => c.exerciseName).join(', ')

  return (
    <div className={`ex-control-share${pulse ? ' is-pulse' : ''}`}>
      <button
        type="button"
        className="btn primary wide"
        disabled={busy}
        onClick={onSend}
      >
        {busy ? 'Открываю…' : 'Отправить видео'}
      </button>
      <p className="ex-control-share-meta">
        {countLabel}
        {names ? ` · ${names}` : ''}
      </p>
      {hint ? <p className="ex-control-share-hint">{hint}</p> : null}
      <button
        type="button"
        className="btn wide muted-btn"
        disabled={busy}
        onClick={onClear}
      >
        Убрать из списка
      </button>
    </div>
  )
}

function BlockPicker({
  groups,
  exercisesDone,
  onPick,
  shareClips,
  shareBusy,
  shareHint,
  sharePulse,
  onShare,
  onClearShare,
}: {
  groups: ReturnType<typeof groupExercises>
  exercisesDone: Record<string, boolean>
  onPick: (group: string) => void
  shareClips: ExerciseVideoClip[]
  shareBusy: boolean
  shareHint: string | null
  sharePulse: boolean
  onShare: () => void
  onClearShare: () => void
}) {
  return (
    <div className="ex-block-picker">
      <p className="ex-block-picker-hint">
        Выбери блок — можно в любом порядке. Паузы между блоками в время не
        входят.
      </p>
      {shareClips.length > 0 ? (
        <div
          className={`card ex-wizard-card ex-control-share-card${sharePulse ? ' is-pulse' : ''}`}
        >
          <p className="ex-control-share-title">Видео контроля</p>
          <ControlVideoShare
            clips={shareClips}
            busy={shareBusy}
            hint={shareHint}
            onSend={onShare}
            onClear={onClearShare}
          />
        </div>
      ) : null}
      <ul className="ex-block-list">
        {groups.map(({ group, items }) => {
          const done = items.filter((e) => exercisesDone[e.id]).length
          const complete = done === items.length && items.length > 0
          const gear = groupGearNeeds(group, items)
          return (
            <li key={group}>
              <button
                type="button"
                className={`ex-block-card${complete ? ' is-complete' : ''}`}
                onClick={() => onPick(group)}
                disabled={complete}
              >
                <span className="ex-block-card-body">
                  <span className="ex-block-card-title">{group}</span>
                  <span className="ex-block-card-meta">
                    {complete
                      ? 'Готово'
                      : `${done} из ${items.length}`}
                  </span>
                  {!complete && gear.length > 0 ? (
                    <span className="ex-block-gear" aria-label="Понадобится">
                      {gear.map((label) => (
                        <span key={label} className="ex-block-gear-chip">
                          {label}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                {complete ? (
                  <span className="ex-block-done-check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
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
  onSkip,
  onControlVideo,
  onControlFilmed,
}: {
  exercise: Exercise
  step: number
  total: number
  control?: ExerciseControl
  onDone: () => void
  onTimerDone: () => void
  onSkip?: () => void
  onControlVideo?: (blob: Blob | null) => void | Promise<void>
  onControlFilmed?: () => void
}) {
  const note = exercise.notes.trim()
  const hasTimer = exercise.durationSec > 0
  const rounds = hasTimer ? parseTimerRounds(exercise.reps) : 1
  const needsFilm = Boolean(control && !control.filmed)
  const cameraRef = useRef<ControlCameraHandle | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [cameraFailed, setCameraFailed] = useState(false)
  const [needRecordHint, setNeedRecordHint] = useState(false)

  async function finish(withTimer: boolean) {
    if (finishing) return
    setFinishing(true)
    try {
      if (needsFilm && onControlVideo) {
        if (!cameraRef.current?.isRecording()) {
          setNeedRecordHint(true)
          setFinishing(false)
          return
        }
        setNeedRecordHint(false)
        let blob: Blob | null = null
        try {
          blob = (await cameraRef.current?.stopAndGetBlob()) ?? null
        } catch {
          blob = null
        }
        if (blob && blob.size > 0) {
          await onControlVideo(blob)
        } else {
          setCameraFailed(true)
          setFinishing(false)
          return
        }
      }
      if (withTimer) onTimerDone()
      else onDone()
    } catch {
      setCameraFailed(true)
      setFinishing(false)
    }
  }

  function continueWithoutVideo() {
    if (finishing) return
    onControlFilmed?.()
    if (hasTimer) onTimerDone()
    else onDone()
  }

  return (
    <div className="card ex-wizard-card">
      <p className="ex-wizard-step">
        Упражнение {step} из {total}
      </p>
      <p className="ex-wizard-group">{exercise.group}</p>
      <h2 className="ex-wizard-name">{exercise.name}</h2>
      {needsFilm ? (
        <>
          <ControlCamera
            ref={cameraRef}
            active
            onError={() => setCameraFailed(true)}
          />
          <div className="ex-control-badge">
            <p className="ex-control-badge-title">Контроль · запись</p>
            <p className="ex-control-badge-sub">
              Сначала поставь камеру, потом нажми «Начать запись». После блока
              можно отправить видео.
            </p>
            {needRecordHint ? (
              <p className="ex-control-badge-warn">
                Сначала нажми «Начать запись», потом делай упражнение
              </p>
            ) : null}
            {cameraFailed ? (
              <button
                type="button"
                className="btn primary"
                style={{ marginTop: 10 }}
                onClick={continueWithoutVideo}
              >
                Отметить без видео и продолжить
              </button>
            ) : null}
          </div>
        </>
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
          onFinish={() => void finish(true)}
        />
      ) : (
        <button
          type="button"
          className="btn primary wide"
          disabled={finishing}
          onClick={() => void finish(false)}
        >
          {finishing ? 'Сохраняю…' : 'Сделано'}
        </button>
      )}
      {onSkip ? (
        <button
          type="button"
          className="btn wide muted-btn"
          disabled={finishing}
          onClick={onSkip}
        >
          Пропустить
        </button>
      ) : null}
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
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** New exercise kept local until first Save (with order). */
  const [draftExercise, setDraftExercise] = useState<Exercise | null>(null)
  const [controlOpen, setControlOpen] = useState(false)
  const [controlIds, setControlIds] = useState<string[]>([])
  const [controlDate, setControlDate] = useState(dayKey)
  const groupOptions = exerciseGroupNames(data.exercises)
  const active = activeExercises(data.exercises)
  const manageGroups = useMemo(
    () => groupExercises(data.exercises),
    [data.exercises],
  )
  const controlPickerGroups = useMemo(
    () => groupExercises(active),
    [active],
  )
  const editingExercise =
    draftExercise && draftExercise.id === editingId
      ? draftExercise
      : editingId
        ? (data.exercises.find((e) => e.id === editingId) ?? null)
        : null
  const editingIndex = draftExercise && draftExercise.id === editingId
    ? data.exercises.length
    : editingId
      ? data.exercises.findIndex((e) => e.id === editingId)
      : -1
  const editingTotal =
    draftExercise && draftExercise.id === editingId
      ? data.exercises.length + 1
      : data.exercises.length

  function saveExercise(next: Exercise, orderPos: number) {
    const base =
      draftExercise && draftExercise.id === next.id
        ? [...data.exercises, next]
        : data.exercises.map((ex) => (ex.id === next.id ? next : ex))
    onChange({
      ...data,
      exercises: moveExerciseToPosition(base, next.id, orderPos),
    })
    setDraftExercise(null)
    setEditingId(null)
  }

  function deleteExercise(id: string) {
    if (draftExercise?.id === id) {
      setDraftExercise(null)
      setEditingId(null)
      return
    }
    const ex = data.exercises.find((e) => e.id === id)
    if (!ex?.custom) return
    onChange({
      ...data,
      exercises: data.exercises.filter((e) => e.id !== id),
      exerciseControls: (data.exerciseControls ?? []).filter(
        (c) => c.exerciseId !== id,
      ),
    })
    setEditingId(null)
  }

  function addExercise(ex: Omit<Exercise, 'id' | 'custom' | 'enabled'>) {
    const next: Exercise = {
      ...ex,
      id: uid(),
      custom: true,
      enabled: true,
    }
    // Don't sync yet — wait for Save with order position.
    setDraftExercise(next)
    setAddOpen(false)
    setEditingId(next.id)
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
          {day.exercisePartial && doneCount < total
            ? ' · частично'
            : day.mustDo.exercise &&
                (doneCount === 0 ||
                  (total > 0 && doneCount === total && workoutSec == null))
              ? ' · отметил родитель'
              : ''}
        </p>
        {workoutSec != null &&
        (doneCount === total ||
          day.exercisePartial ||
          (day.workoutSessions?.length ?? 0) > 0) ? (
          <p className="sub workout-time">
            Сегодня зарядка заняла {formatPlayTime(workoutSec)}
          </p>
        ) : null}
      </header>

      {total > 0 && doneCount < total ? (
        <section className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={Boolean(day.exercisePartial && day.mustDo.exercise)}
              onChange={() => {
                const next =
                  day.exercisePartial && day.mustDo.exercise
                    ? clearExercisesCredit(day)
                    : markExercisesPartialCredit(day)
                onChange({
                  ...data,
                  days: {
                    ...data.days,
                    [dayKey]: stampPerfectAt(
                      day,
                      next,
                      schoolDayPlanFromData(data),
                    ),
                  },
                })
              }}
            />
            <span>
              Частичный зачёт
              <span className="hint">
                {' '}
                — звезда за зарядку без полного комплекса
              </span>
            </span>
          </label>
        </section>
      ) : null}

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
          <button
            type="button"
            className={addOpen ? 'pill' : 'pill muted'}
            onClick={() => {
              setEditingId(null)
              setDraftExercise(null)
              setAddOpen((v) => !v)
            }}
          >
            {addOpen ? 'Закрыть' : '+ Добавить'}
          </button>
        </div>
        <p className="hint">
          Нажми упражнение, чтобы изменить, отключить или задать номер в
          порядке. Отключённые скрыты у ребёнка.
        </p>
        {addOpen ? (
          <AddExerciseForm
            groupOptions={groupOptions}
            onAdd={addExercise}
            onCancel={() => setAddOpen(false)}
          />
        ) : null}
        {editingExercise && editingIndex >= 0 ? (
          <ExerciseEditCard
            key={editingExercise.id}
            exercise={editingExercise}
            index={editingIndex}
            total={editingTotal}
            groupOptions={groupOptions}
            onSave={saveExercise}
            onDelete={
              editingExercise.custom
                ? () => deleteExercise(editingExercise.id)
                : undefined
            }
            onClose={() => {
              setDraftExercise(null)
              setEditingId(null)
            }}
          />
        ) : (
          <div className="parent-ex-groups" style={{ marginTop: 12 }}>
            {manageGroups.map(({ group, items }) => (
              <details key={group} className="parent-ex-group" open>
                <summary className="parent-ex-group-head">
                  <span className="parent-ex-group-title">{group}</span>
                  <span className="pill muted">
                    {items.filter((e) => e.enabled !== false).length}/
                    {items.length}
                  </span>
                </summary>
                <ul className="parent-ex-list">
                  {items.map((ex) => {
                    const pos =
                      data.exercises.findIndex((e) => e.id === ex.id) + 1
                    const on = ex.enabled !== false
                    return (
                      <li key={ex.id}>
                        <button
                          type="button"
                          className={`ex-compose-row ${on ? '' : 'is-disabled'}`}
                          onClick={() => {
                            setAddOpen(false)
                            setEditingId(ex.id)
                          }}
                        >
                          <span className="ex-compose-pos">{pos}</span>
                          <span className="ex-compose-body">
                            <span className="ex-compose-name">{ex.name}</span>
                            <span className="ex-compose-meta">
                              {ex.custom ? 'своё' : null}
                              {ex.custom && !on ? ' · ' : null}
                              {!on ? 'отключено' : null}
                              {(ex.custom || !on) && ex.reps ? ' · ' : null}
                              {ex.reps || null}
                            </span>
                          </span>
                          <span className="ex-compose-chevron" aria-hidden>
                            ›
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ExerciseEditCard({
  exercise,
  index,
  total,
  groupOptions,
  onSave,
  onDelete,
  onClose,
}: {
  exercise: Exercise
  index: number
  total: number
  groupOptions: string[]
  onSave: (next: Exercise, orderPos: number) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(exercise.name)
  const [group, setGroup] = useState(exercise.group)
  const [useCustomGroup, setUseCustomGroup] = useState(
    () => !groupOptions.includes(exercise.group),
  )
  const [customGroup, setCustomGroup] = useState(() =>
    groupOptions.includes(exercise.group) ? '' : exercise.group,
  )
  const [reps, setReps] = useState(exercise.reps)
  const [durationSec, setDurationSec] = useState(String(exercise.durationSec))
  const [notes, setNotes] = useState(exercise.notes)
  const [enabled, setEnabled] = useState(exercise.enabled !== false)
  const [orderPos, setOrderPos] = useState(String(index + 1))

  const resolvedGroup = useCustomGroup
    ? customGroup.trim() || group || 'Другое'
    : group

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const pos = Number(orderPos.replace(/[^\d]/g, '')) || index + 1
    onSave(
      {
        ...exercise,
        name: trimmed,
        group: resolvedGroup,
        reps: reps.trim(),
        notes: notes.trim(),
        durationSec: Number(durationSec) || 0,
        enabled,
      },
      pos,
    )
  }

  return (
    <div className="ex-edit-card">
      <div className="card-title-row">
        <h3>Упражнение</h3>
        <button type="button" className="pill muted" onClick={onClose}>
          Назад к списку
        </button>
      </div>
      <label className="check-row ex-edit-enabled">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => setEnabled((v) => !v)}
        />
        <span>В комплексе у ребёнка</span>
      </label>
      <label className="field">
        <span>Порядок в комплексе (1–{total})</span>
        <input
          inputMode="numeric"
          value={orderPos}
          onChange={(e) =>
            setOrderPos(e.target.value.replace(/[^\d]/g, '').slice(0, 3))
          }
        />
      </label>
      <label className="field">
        <span>Название</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Группа</span>
        <select
          value={useCustomGroup ? '__custom' : group}
          onChange={(e) => {
            if (e.target.value === '__custom') {
              setUseCustomGroup(true)
              setCustomGroup(group)
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
        <span>Описание</span>
        <textarea
          className="ex-edit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Как выполнять"
        />
      </label>
      <div className="row-gap">
        <button
          type="button"
          className="btn primary"
          disabled={!name.trim()}
          onClick={save}
        >
          Сохранить
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Отмена
        </button>
      </div>
      {onDelete ? (
        <button
          type="button"
          className="btn ghost ex-edit-delete"
          onClick={() => {
            if (window.confirm('Удалить это упражнение из комплекса?')) {
              onDelete()
            }
          }}
        >
          Удалить упражнение
        </button>
      ) : (
        <p className="hint">
          Базовое упражнение нельзя удалить — только отключить.
        </p>
      )}
    </div>
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
