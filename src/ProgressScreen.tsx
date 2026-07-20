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
  pendingGiftStickers,
  perfectDaysInMonth,
  stickerNeedText,
  stickerOpenedHint,
  stickerProgressFromData,
  stickerRewardText,
  stickerUnlockHint,
  unlockedRankStickers,
  unlockedStickers,
  type Sticker,
  type StickerProgress,
} from './progress'
import type { AppData } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

const STICKER_COLS_MQ = '(min-width: 700px)'

export function ProgressScreen({ data, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rankPickerOpen, setRankPickerOpen] = useState(false)
  const [cols, setCols] = useState(3)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia(STICKER_COLS_MQ)
    const sync = () => setCols(mq.matches ? 4 : 3)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const progress = useMemo(() => stickerProgressFromData(data), [data])
  const pendingGifts = useMemo(() => pendingGiftStickers(data), [data])
  const moneyBank = Math.floor(data.moneyBankRub ?? 0)
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
    const stars = countStars(data.days)
    const { level, intoLevel, need } = levelFromStars(stars)
    const perfectMonth = perfectDaysInMonth(data.days)
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

  const selectedIndex = selectedId
    ? STICKERS.findIndex((s) => s.id === selectedId)
    : -1
  const detailAfterIndex =
    selectedIndex >= 0
      ? Math.min(
          STICKERS.length - 1,
          Math.floor(selectedIndex / cols) * cols + cols - 1,
        )
      : -1

  useEffect(() => {
    if (!selectedId || !detailRef.current) return
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

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

      <section className="card piggy-bank-card">
        <div className="card-title-row">
          <h2 className="piggy-bank-title">
            <svg
              className="piggy-bank-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
              <path d="M2 9v1c0 1.1.9 2 2 2h1" />
              <path d="M16 11h.01" />
            </svg>
            Свинья-копилка
          </h2>
          <span
            className={
              moneyBank > 0 || pendingGifts.length > 0 ? 'pill' : 'pill muted'
            }
          >
            {moneyBank} ₽
            {pendingGifts.length > 0 ? ` · ${pendingGifts.length}` : ''}
          </span>
        </div>
        {pendingGifts.length > 0 ? (
          <ul className="gift-pending-list">
            {pendingGifts.map((gift) => (
              <li key={gift.id} className="gift-pending-item is-readonly">
                <div className="gift-pending-main">
                  <span className="gift-pending-title">{gift.label}</span>
                  <span className="hint">{gift.giftHint}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Достижения</h2>
          <span className="pill muted">
            {stats.stickers.length}/{STICKERS.length}
          </span>
        </div>
        <div className="sticker-row">
          {STICKERS.map((s, i) => {
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
                    setSelectedId((prev) => (prev === s.id ? null : s.id))
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
                      <span className="sticker-quote">«{s.quote}»</span>
                    ) : null}
                  </span>
                </button>
                {i === detailAfterIndex && selectedSticker ? (
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
      <p className="hint">
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
