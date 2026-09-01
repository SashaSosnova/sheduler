import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import {
  STICKERS,
  countStars,
  equippedRankSticker,
  isStickerUnlocked,
  levelFromStars,
  levelRank,
  perfectDaysInMonth,
  stickerNeedText,
  stickerOpenedHint,
  stickerProgressFromData,
  stickerRewardText,
  stickerUnlockHint,
  stickersForTrack,
  unlockedRankStickers,
  unlockedStickers,
  visibleStickerTracks,
  type Sticker,
  type StickerProgress,
} from './progress'
import { schoolDayPlanFromData } from './data'
import type { AppData } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

const STICKER_COLS_MQ = '(min-width: 700px)'

function bindAlbumSwipe(
  viewport: HTMLDivElement,
  track: HTMLDivElement,
  pageCount: number,
  pageIndexRef: { current: number },
  setPageIndex: (index: number) => void,
) {
  type Swipe = {
    id: number
    x: number
    y: number
    lock: 'x' | 'y' | null
  }
  let swipe: Swipe | null = null
  let swallowClick = false

  function setDrag(px: number, dragging: boolean) {
    track.style.setProperty('--album-drag', `${px}px`)
    track.classList.toggle('is-dragging', dragging)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, lock: null }
  }

  function onPointerMove(e: PointerEvent) {
    if (!swipe || swipe.id !== e.pointerId) return
    const dx = e.clientX - swipe.x
    const dy = e.clientY - swipe.y
    if (!swipe.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      swipe.lock = Math.abs(dx) > Math.abs(dy) + 4 ? 'x' : 'y'
      if (swipe.lock === 'x') {
        try {
          viewport.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    }
    if (swipe.lock !== 'x') return
    const i = pageIndexRef.current
    const last = pageCount - 1
    const next =
      (i === 0 && dx > 0) || (i === last && dx < 0) ? dx * 0.32 : dx
    setDrag(next, true)
  }

  function onPointerUp(e: PointerEvent) {
    if (!swipe || swipe.id !== e.pointerId) return
    const dx = e.clientX - swipe.x
    const lock = swipe.lock
    swipe = null
    if (lock !== 'x') {
      setDrag(0, false)
      return
    }
    const threshold = Math.max(40, viewport.clientWidth * 0.15)
    let next = pageIndexRef.current
    if (dx < -threshold) next = Math.min(pageCount - 1, next + 1)
    else if (dx > threshold) next = Math.max(0, next - 1)
    if (Math.abs(dx) > 12) swallowClick = true
    setPageIndex(next)
    setDrag(0, false)
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    e.preventDefault()
    e.stopPropagation()
  }

  function onTouchMove(e: TouchEvent) {
    if (swipe?.lock === 'x') e.preventDefault()
  }

  viewport.addEventListener('pointerdown', onPointerDown)
  viewport.addEventListener('pointermove', onPointerMove)
  viewport.addEventListener('pointerup', onPointerUp)
  viewport.addEventListener('pointercancel', onPointerUp)
  viewport.addEventListener('click', onClickCapture, true)
  viewport.addEventListener('touchmove', onTouchMove, { passive: false })
  return () => {
    viewport.removeEventListener('pointerdown', onPointerDown)
    viewport.removeEventListener('pointermove', onPointerMove)
    viewport.removeEventListener('pointerup', onPointerUp)
    viewport.removeEventListener('pointercancel', onPointerUp)
    viewport.removeEventListener('click', onClickCapture, true)
    viewport.removeEventListener('touchmove', onTouchMove)
  }
}

export function ProgressScreen({ data, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rankPickerOpen, setRankPickerOpen] = useState(false)
  const [cols, setCols] = useState(3)
  const [pageIndex, setPageIndex] = useState(0)
  const detailRef = useRef<HTMLDivElement>(null)
  const albumRef = useRef<HTMLDivElement>(null)
  const albumTrackRef = useRef<HTMLDivElement>(null)
  const pageIndexRef = useRef(0)
  const pages = useMemo(() => visibleStickerTracks(), [])
  pageIndexRef.current = pageIndex

  useEffect(() => {
    const mq = window.matchMedia(STICKER_COLS_MQ)
    const sync = () => setCols(mq.matches ? 4 : 3)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const progress = useMemo(() => stickerProgressFromData(data), [data])
  const rankOptions = useMemo(() => unlockedRankStickers(progress), [progress])
  const equipped = useMemo(
    () => equippedRankSticker(data.equippedStickerId, progress),
    [data.equippedStickerId, progress],
  )

  // Persist auto-picked first unlocked rank when unset / stale.
  useEffect(() => {
    if (!equipped) {
      if (data.equippedStickerId != null) {
        onChange({ ...data, equippedStickerId: null })
      }
      return
    }
    if (data.equippedStickerId !== equipped.id) {
      onChange({ ...data, equippedStickerId: equipped.id })
    }
  }, [equipped, data, onChange])

  const stats = useMemo(() => {
    const plan = schoolDayPlanFromData(data)
    const stars = countStars(data.days, plan)
    const { level, intoLevel, need } = levelFromStars(stars)
    const perfectMonth = perfectDaysInMonth(data.days, new Date(), plan)
    const stickers = unlockedStickers(progress)
    return {
      stars,
      level,
      intoLevel,
      need,
      streak: progress.streak,
      perfectMonth,
      perfectTotal: progress.perfectTotal,
      stickers,
    }
  }, [data.days, progress])

  const selectedSticker =
    STICKERS.find((s) => s.id === selectedId) ?? null
  const selectedOpen = selectedSticker
    ? isStickerUnlocked(selectedSticker, progress)
    : false
  const selectedReward = selectedSticker
    ? stickerRewardText(selectedSticker)
    : null

  const activePage = pages[pageIndex] ?? pages[0]
  const pageStickers = activePage ? stickersForTrack(activePage.id) : []
  const pageOpenCount = pageStickers.filter((s) =>
    isStickerUnlocked(s, progress),
  ).length
  const showSchoolTeaser =
    activePage?.id === 'school' && pageStickers.length === 0

  const selectedIndex = selectedId
    ? pageStickers.findIndex((s) => s.id === selectedId)
    : -1
  const detailAfterIndex =
    selectedIndex >= 0
      ? Math.min(
          pageStickers.length - 1,
          Math.floor(selectedIndex / cols) * cols + cols - 1,
        )
      : -1

  useEffect(() => {
    if (!selectedId || !activePage) return
    if (
      !stickersForTrack(activePage.id).some((s) => s.id === selectedId)
    ) {
      setSelectedId(null)
    }
  }, [activePage, selectedId])

  useEffect(() => {
    if (!selectedId || !detailRef.current) return
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  useEffect(() => {
    const viewport = albumRef.current
    const track = albumTrackRef.current
    if (!viewport || !track) return
    return bindAlbumSwipe(
      viewport,
      track,
      pages.length,
      pageIndexRef,
      setPageIndex,
    )
  }, [pages.length])

  function goToPage(index: number) {
    setPageIndex(index)
  }

  const levelPct = Math.min(100, (stats.intoLevel / stats.need) * 100)
  const rank = levelRank(stats.level)
  const rankTitle = equipped ? stickerNeedText(equipped) : null

  return (
    <div className={`screen ${rankPickerOpen ? 'screen-sheet-open' : ''}`}>
      <header className="screen-head rank-screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Достижения</p>
        </div>
        <div className="screen-head-row">
          <h1>Моё звание</h1>
          {rankOptions.length > 0 ? (
            <button
              type="button"
              className="rank-edit-btn"
              aria-label="Выбрать звание"
              onClick={() => setRankPickerOpen(true)}
            >
              <span aria-hidden>✎</span>
            </button>
          ) : null}
        </div>
        <p className="rank-title-value">
          {rankTitle ?? 'Звание ещё не получено'}
        </p>
      </header>

      <section className="level-card-wrap">
        <div className="card level-card">
          <div className="level-progress-box">
            <p className="level-badge">
              Уровень <span>{stats.level}</span>
            </p>
            <p className="level-hero-progress-hint">
              <span className="level-star" aria-hidden>
                ★
              </span>
              <span className="level-frac">
                {stats.intoLevel}/{stats.need}
              </span>
              <span className="level-next"> до ур. {stats.level + 1}</span>
            </p>
            <div className="play-bar" aria-hidden>
              <div
                className="play-bar-fill"
                style={{
                  width: `${Math.max(levelPct, levelPct > 0 ? 8 : 0)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="level-hero-art-wrap" aria-hidden>
          <img
            className="level-hero-art"
            src={rank.image}
            alt=""
            draggable={false}
          />
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

      <section className="card sticker-album-card">
        <div className="card-title-row">
          <h2>Достижения</h2>
          <span className="pill muted">
            {stats.stickers.length}/{STICKERS.length}
          </span>
        </div>
        <div className="sticker-album-chapter">
          <div className="sticker-album-head">
            <p className="sticker-album-page-title">
              {activePage?.label ?? 'Достижения'}
            </p>
            {showSchoolTeaser ? (
              <span className="pill muted">скоро</span>
            ) : (
              <span className="pill muted">
                {pageOpenCount}/{pageStickers.length}
              </span>
            )}
          </div>
          <div ref={albumRef} className="sticker-album">
            <div
              ref={albumTrackRef}
              className="sticker-album-track"
              style={{
                transform: `translate3d(calc(${-pageIndex * 100}% + var(--album-drag, 0px)), 0, 0)`,
              }}
            >
              {pages.map((page) => {
                const stickers = stickersForTrack(page.id)
                const teaser = page.id === 'school' && stickers.length === 0
                return (
                  <div key={page.id} className="sticker-album-page">
                    {teaser ? (
                      <SchoolSoonSplash />
                    ) : (
                      <div className="sticker-row">
                        {stickers.map((s, i) => {
                          const open = isStickerUnlocked(s, progress)
                          const selected = selectedId === s.id
                          return (
                            <Fragment key={s.id}>
                              <button
                                type="button"
                                className={`sticker kind-${s.kind} ${open ? 'open' : 'locked'} ${selected ? 'selected' : ''}`}
                                aria-pressed={selected}
                                aria-label={
                                  open
                                    ? `${s.label}. ${s.quote}. ${s.detail}`
                                    : `${stickerNeedText(s)}. ${stickerUnlockHint(s, progress)}`
                                }
                                onClick={() =>
                                  setSelectedId((prev) =>
                                    prev === s.id ? null : s.id,
                                  )
                                }
                              >
                                <img
                                  className="sticker-art"
                                  src={s.image}
                                  alt=""
                                  draggable={false}
                                />
                                <span className="sticker-caption">
                                  <span className="sticker-label">
                                    {open ? s.label : stickerNeedText(s)}
                                  </span>
                                  {open ? (
                                    <span className="sticker-quote">
                                      «{s.quote}»
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                              {page.id === activePage?.id &&
                              i === detailAfterIndex &&
                              selectedSticker ? (
                                <StickerDetailCard
                                  ref={detailRef}
                                  sticker={selectedSticker}
                                  open={selectedOpen}
                                  reward={selectedReward}
                                  progress={progress}
                                />
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div
            className="sticker-album-dots"
            role="tablist"
            aria-label="Страницы альбома"
          >
            {pages.map((page, i) => (
              <button
                key={page.id}
                type="button"
                role="tab"
                aria-selected={i === pageIndex}
                aria-label={page.label}
                className={`sticker-album-dot${i === pageIndex ? ' is-active' : ''}`}
                onClick={() => goToPage(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {rankPickerOpen ? (
        <div
          className="action-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Выбрать звание"
        >
          <div className="action-sheet-handle" />
          <div className="action-sheet-head">
            <h2>Звание</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="Закрыть"
              onClick={() => setRankPickerOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="action-sheet-body">
            <ul className="rank-picker-list">
              {rankOptions.map((s) => {
                const title = stickerNeedText(s)
                const active = equipped?.id === s.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`rank-picker-item ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        onChange({ ...data, equippedStickerId: s.id })
                        setRankPickerOpen(false)
                      }}
                    >
                      <span className="rank-picker-title">{title}</span>
                      <span className="rank-picker-hero">{s.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SchoolSoonSplash() {
  return (
    <div className="school-soon">
      <div className="school-soon-art-wrap">
        <img
          className="school-soon-art"
          src="./stickers/school-soon.png?v=4"
          alt="1 сентября"
          draggable={false}
        />
      </div>
      <p className="school-soon-title">Скоро появится!</p>
      <p className="school-soon-sub">Жди 1 сентября</p>
    </div>
  )
}

type DetailProps = {
  sticker: Sticker
  open: boolean
  reward: string | null
  progress: StickerProgress
}

function StickerDetailCard({
  ref,
  sticker,
  open,
  reward,
  progress,
}: DetailProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={`sticker-detail sticker-detail--inline ${open ? 'is-open' : 'is-locked'}`}
    >
      <div className="sticker-detail-head">
        <img
          className={`sticker-art detail ${open ? '' : 'is-locked'}`}
          src={sticker.image}
          alt=""
          draggable={false}
        />
        <div>
          <p className="sticker-detail-franchise">{sticker.detail}</p>
          <p className="sticker-detail-title">
            {open ? sticker.label : 'Ещё закрыто'}
          </p>
          {open ? (
            <p className="sticker-detail-quote">«{sticker.quote}»</p>
          ) : null}
        </div>
      </div>
      <p className="hint sticker-detail-hint">
        {open
          ? stickerOpenedHint(sticker)
          : stickerUnlockHint(sticker, progress)}
      </p>
      {reward ? (
        <p className="hint sticker-detail-reward">{reward}</p>
      ) : null}
    </div>
  )
}
