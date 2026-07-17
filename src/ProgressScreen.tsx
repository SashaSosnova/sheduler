import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import { todayKey } from './data'
import {
  STICKERS,
  countPerfectDays,
  countStars,
  currentStreak,
  isStickerUnlocked,
  levelFromStars,
  levelRank,
  perfectDaysInMonth,
  stickerNeedText,
  stickerOpenedHint,
  stickerRewardText,
  stickerUnlockHint,
  unlockedStickers,
  type Sticker,
} from './progress'
import type { AppData } from './types'

type Props = {
  data: AppData
}

const STICKER_COLS_MQ = '(min-width: 700px)'

export function ProgressScreen({ data }: Props) {
  const today = todayKey()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cols, setCols] = useState(3)
  const detailRef = useRef<HTMLDivElement>(null)
  const bestStreak = data.bestStreak ?? 0

  useEffect(() => {
    const mq = window.matchMedia(STICKER_COLS_MQ)
    const sync = () => setCols(mq.matches ? 4 : 3)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const stats = useMemo(() => {
    const stars = countStars(data.days)
    const { level, intoLevel, need } = levelFromStars(stars)
    const streak = currentStreak(data.days, today)
    const perfectMonth = perfectDaysInMonth(data.days)
    const perfectTotal = countPerfectDays(data.days)
    const stickers = unlockedStickers(perfectTotal, streak, bestStreak)
    return {
      stars,
      level,
      intoLevel,
      need,
      streak,
      perfectMonth,
      perfectTotal,
      stickers,
    }
  }, [data.days, bestStreak, today])

  const selectedSticker =
    STICKERS.find((s) => s.id === selectedId) ?? null
  const selectedOpen = selectedSticker
    ? isStickerUnlocked(
        selectedSticker,
        stats.perfectTotal,
        stats.streak,
        bestStreak,
      )
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

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Прогресс</p>
        <h1>Мой прогресс</h1>
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

      <section className="card">
        <div className="card-title-row">
          <h2>Достижения</h2>
          <span className="pill muted">
            {stats.stickers.length}/{STICKERS.length}
          </span>
        </div>
        <div className="sticker-row">
          {STICKERS.map((s, i) => {
            const open = isStickerUnlocked(
              s,
              stats.perfectTotal,
              stats.streak,
              bestStreak,
            )
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
                      : `${stickerNeedText(s)}. ${stickerUnlockHint(s)}`
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
                  />
                ) : null}
              </Fragment>
            )
          })}
        </div>
      </section>
    </div>
  )
}

type DetailProps = {
  sticker: Sticker
  open: boolean
  reward: string | null
}

function StickerDetailCard({
  ref,
  sticker,
  open,
  reward,
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
        {open ? stickerOpenedHint(sticker) : stickerUnlockHint(sticker)}
      </p>
      {reward ? (
        <p className="hint sticker-detail-reward">{reward}</p>
      ) : null}
    </div>
  )
}
