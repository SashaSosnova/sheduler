type Props = {
  onOpenSettings?: () => void
  /** Child-only: trophy opens Достижения */
  onOpenAchievements?: () => void
}

export function ScreenHeadActions({
  onOpenSettings,
  onOpenAchievements,
}: Props) {
  if (!onOpenSettings && !onOpenAchievements) return null

  return (
    <div className="screen-head-actions">
      {onOpenAchievements ? (
        <button
          type="button"
          className="btn ghost settings-btn"
          onClick={onOpenAchievements}
          aria-label="Достижения"
          title="Достижения"
        >
          <svg
            className="head-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </button>
      ) : null}
      {onOpenSettings ? (
        <button
          type="button"
          className="settings-btn settings-btn--sticker"
          onClick={onOpenSettings}
          aria-label="Ещё"
          title="Ещё"
        >
          <img
            className="settings-sticker"
            src="./nav/settings.png?v=18"
            alt=""
            draggable={false}
          />
        </button>
      ) : null}
    </div>
  )
}
