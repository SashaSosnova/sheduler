import { useState } from 'react'
import { normalizeStudioSprintStates } from './data'
import {
  STUDIO_PROJECT,
  type StudioGuideFrame,
  type StudioSprintDef,
} from './studioProject'
import type { AppData, StudioSprintState, StudioSprintStatus } from './types'

type Mode = 'child' | 'parent'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
  mode: Mode
}

const STATUS_LABEL: Record<StudioSprintStatus, string> = {
  todo: 'ещё не сдан',
  submitted: 'на проверке',
  needs_work: 'доработать',
  approved: 'принято',
}

function statusClass(status: StudioSprintStatus): string {
  if (status === 'approved') return 'pill'
  if (status === 'submitted') return 'pill'
  if (status === 'needs_work') return 'pill'
  return 'pill muted'
}

function emptyState(): StudioSprintState {
  return { status: 'todo', updatedAt: 0 }
}

function GuideFrameGrid({
  frames,
  className,
}: {
  frames: StudioGuideFrame[]
  className?: string
}) {
  return (
    <div className={className ?? 'studio-guide-grid'}>
      {frames.map((frame) => (
        <figure key={frame.src} className="studio-guide-item">
          <img src={frame.src} alt={frame.caption} loading="lazy" />
          <figcaption>{frame.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function patchSprint(
  data: AppData,
  sprintId: string,
  next: Omit<StudioSprintState, 'updatedAt'> & { updatedAt?: number },
): AppData {
  const states = normalizeStudioSprintStates(data.studioSprintStates)
  const prev = states[sprintId] ?? emptyState()
  const childNote =
    next.childNote !== undefined ? next.childNote.trim() : prev.childNote
  const parentNote =
    next.parentNote !== undefined ? next.parentNote.trim() : prev.parentNote
  return {
    ...data,
    studioSprintStates: {
      ...states,
      [sprintId]: {
        status: next.status,
        updatedAt: next.updatedAt ?? Date.now(),
        ...(childNote ? { childNote } : {}),
        ...(parentNote ? { parentNote } : {}),
      },
    },
  }
}

function submitSprint(data: AppData, sprintId: string): AppData {
  return patchSprint(data, sprintId, {
    status: 'submitted',
    childNote: '',
    parentNote: '',
  })
}

function SprintRow({
  sprint,
  state,
  mode,
  data,
  onChange,
}: {
  sprint: StudioSprintDef
  state: StudioSprintState
  mode: Mode
  data: AppData
  onChange: (next: AppData) => void
}) {
  const [descOpen, setDescOpen] = useState(false)
  const [parentDraft, setParentDraft] = useState('')
  const [adviceOpen, setAdviceOpen] = useState(false)

  const canFirstSubmit = mode === 'child' && state.status === 'todo'
  const canResubmit = mode === 'child' && state.status === 'needs_work'
  const canReview = mode === 'parent' && state.status === 'submitted'
  const hasPuzzles = Boolean(sprint.puzzleChoices?.length)

  return (
    <li className="studio-sprint">
      <div className="card-title-row">
        <h3 className="studio-sprint-title">{sprint.title}</h3>
        <span className={statusClass(state.status)}>
          {STATUS_LABEL[state.status]}
        </span>
      </div>

      {mode === 'parent' ? (
        <p className="hint" style={{ marginTop: 8 }}>
          {sprint.parentCheck}
        </p>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 8 }}>
            {sprint.goal}
          </p>
          <button
            type="button"
            className="linkish"
            onClick={() => setDescOpen((v) => !v)}
          >
            {descOpen ? 'Свернуть описание' : 'Описание →'}
          </button>
          {descOpen ? (
            <div className="studio-sprint-details">
              <ul className="studio-desc">
                {sprint.description.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              {sprint.visualGuide ? (
                <div className="studio-visual-guide">
                  <p className="eyebrow">{sprint.visualGuide.title}</p>
                  <p className="hint" style={{ marginTop: 4 }}>
                    Не копируй один в один — подсмотри объекты и раскладку.
                  </p>
                  <GuideFrameGrid frames={sprint.visualGuide.frames} />
                  {sprint.visualGuide.helpers?.length ? (
                    <div className="studio-helpers">
                      <p className="eyebrow">Помощники в Studio</p>
                      <ul className="studio-desc">
                        {sprint.visualGuide.helpers.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasPuzzles ? (
                <div className="studio-puzzles">
                  <p className="eyebrow">Загадки на выбор</p>
                  <ul className="studio-puzzle-list">
                    {sprint.puzzleChoices!.map((puzzle) => (
                      <li key={puzzle.id} className="studio-puzzle-item">
                        <p className="studio-puzzle-title">{puzzle.title}</p>
                        <p className="hint">{puzzle.summary}</p>
                        {puzzle.steps?.length ? (
                          <GuideFrameGrid
                            frames={puzzle.steps}
                            className="studio-guide-grid studio-guide-grid-steps"
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {state.status === 'needs_work' && state.parentNote ? (
        <div className="studio-note studio-note-parent">
          <p className="eyebrow">Совет родителя</p>
          <p>{state.parentNote}</p>
        </div>
      ) : null}

      {canFirstSubmit ? (
        <div className="studio-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => onChange(submitSprint(data, sprint.id))}
          >
            Сделано, проверяй
          </button>
        </div>
      ) : null}

      {canResubmit ? (
        <div className="studio-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => onChange(submitSprint(data, sprint.id))}
          >
            Поправил
          </button>
        </div>
      ) : null}

      {canReview ? (
        <div className="studio-actions">
          <div className="studio-review-row">
            <button
              type="button"
              className={`btn studio-btn-rework${adviceOpen ? ' active' : ''}`}
              onClick={() => setAdviceOpen((v) => !v)}
            >
              На доработку
            </button>
            <button
              type="button"
              className="btn studio-btn-ok"
              onClick={() =>
                onChange(
                  patchSprint(data, sprint.id, {
                    status: 'approved',
                    parentNote: '',
                  }),
                )
              }
            >
              Всё ок
            </button>
          </div>
          {adviceOpen ? (
            <>
              <label className="field">
                <span>Замечания</span>
                <textarea
                  value={parentDraft}
                  onChange={(e) => setParentDraft(e.target.value)}
                  rows={3}
                  placeholder="Что улучшить…"
                />
              </label>
              <button
                type="button"
                className="btn studio-btn-rework"
                disabled={!parentDraft.trim()}
                onClick={() => {
                  onChange(
                    patchSprint(data, sprint.id, {
                      status: 'needs_work',
                      parentNote: parentDraft,
                    }),
                  )
                  setAdviceOpen(false)
                  setParentDraft('')
                }}
              >
                Отправить
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function ChildBrief() {
  const [open, setOpen] = useState(false)

  return (
    <div className="studio-brief-fold">
      <p className="hint studio-pitch">{STUDIO_PROJECT.pitch}</p>
      <button
        type="button"
        className="linkish"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Свернуть описание' : 'Подробнее об игре →'}
      </button>
      {open ? (
        <div className="studio-brief-body">
          <div className="studio-brief">
            <p className="eyebrow">Сюжет</p>
            <ul className="studio-fixed-rules">
              {STUDIO_PROJECT.story.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="studio-brief studio-brief-mechanic">
            <p className="eyebrow">Петля и инвентарь</p>
            <ul className="studio-fixed-rules">
              {STUDIO_PROJECT.mechanic.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="studio-brief studio-brief-visual">
            <p className="eyebrow">Стиль</p>
            <ul className="studio-fixed-rules">
              {STUDIO_PROJECT.visualStyle.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="studio-brief">
            <p className="eyebrow">Рамка — не меняем</p>
            <ul className="studio-fixed-rules">
              {STUDIO_PROJECT.fixedRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="studio-mood">
            <p className="eyebrow">Картинки для вдохновения</p>
            <p className="hint" style={{ marginTop: 4 }}>
              Не копируй один в один — подсмотри настроение, цвета и часы.
            </p>
            <div className="studio-mood-grid">
              {STUDIO_PROJECT.moodImages.map((img) => (
                <figure key={img.src} className="studio-mood-item">
                  <img src={img.src} alt={img.caption} loading="lazy" />
                  <figcaption>{img.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function StudioProjectCard({ data, onChange, mode }: Props) {
  const states = normalizeStudioSprintStates(data.studioSprintStates)
  const approved = STUDIO_PROJECT.sprints.filter(
    (s) => (states[s.id] ?? emptyState()).status === 'approved',
  ).length
  const total = STUDIO_PROJECT.sprints.length

  return (
    <section className="card studio-project-card">
      <div className="studio-hero">
        <img
          className="studio-cover"
          src="./studio/cover.png"
          alt="Башня Хранителя Времени"
        />
        <div className="studio-hero-text">
          <div className="card-title-row">
            <h2>{STUDIO_PROJECT.title}</h2>
            <span className={approved > 0 ? 'pill' : 'pill muted'}>
              {approved}/{total}
            </span>
          </div>
          {mode === 'parent' ? (
            <p className="hint" style={{ marginTop: 6 }}>
              Ребёнок сдаёт спринт — ты принимаешь или возвращаешь с замечанием.
            </p>
          ) : null}
        </div>
      </div>

      {mode === 'parent' ? (
        <div className="studio-brief">
          <p className="eyebrow">Что должно быть в игре</p>
          <ul className="studio-fixed-rules">
            {STUDIO_PROJECT.parentBrief.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <ChildBrief />
      )}

      <ul className="studio-sprint-list">
        {STUDIO_PROJECT.sprints.map((sprint) => (
          <SprintRow
            key={sprint.id}
            sprint={sprint}
            state={states[sprint.id] ?? emptyState()}
            mode={mode}
            data={data}
            onChange={onChange}
          />
        ))}
      </ul>
    </section>
  )
}
