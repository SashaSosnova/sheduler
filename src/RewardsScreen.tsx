import {
  pendingPhysicalGiftStickers,
  pendingRobloxDonateStickers,
} from './progress'
import type { AppData } from './types'
import { WeeklyGradesCard } from './WeeklyGradesCard'

type Props = {
  data: AppData
}

export function RewardsScreen({ data }: Props) {
  const pendingGifts = pendingPhysicalGiftStickers(data)
  const pendingDonates = pendingRobloxDonateStickers(data)
  const moneyBank = Math.floor(data.moneyBankRub ?? 0)
  const robloxBankMin = Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0))

  const extrasPill = [
    `${robloxBankMin} мин`,
    pendingDonates.length > 0 ? `${pendingDonates.length}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Копилки</p>
        </div>
        <h1>Награды</h1>
        <p className="sub">Рубли, подарки и бонусы Roblox</p>
      </header>

      <WeeklyGradesCard data={data} readOnly />

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
        ) : moneyBank <= 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>
            Сюда падают рубли и подарки за ачивки.
          </p>
        ) : null}
      </section>

      <section className="card">
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
              <rect x="3" y="8" width="14" height="12" rx="2" />
              <path d="M17 12h3l1 3v5h-4" />
              <circle cx="8" cy="16" r="1.2" />
              <path d="M7 8V6h6v2" />
            </svg>
            Roblox
          </h2>
          <span
            className={
              robloxBankMin > 0 || pendingDonates.length > 0
                ? 'pill'
                : 'pill muted'
            }
          >
            {extrasPill}
          </span>
        </div>

        {robloxBankMin <= 0 && pendingDonates.length === 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>
            Сюда падают бонусные минуты и донаты за ачивки.
          </p>
        ) : (
          <>
            {robloxBankMin > 0 ? (
              <p className="hint" style={{ marginTop: 8 }}>
                {robloxBankMin} мин бонуса — родитель выдаст сверх обычного
                времени на компьютере.
              </p>
            ) : null}
            {pendingDonates.length > 0 ? (
              <>
                <p className="hint" style={{ marginTop: 14 }}>
                  Донаты
                </p>
                <ul className="gift-pending-list">
                  {pendingDonates.map((gift) => (
                    <li key={gift.id} className="gift-pending-item is-readonly">
                      <div className="gift-pending-main">
                        <span className="gift-pending-title">{gift.label}</span>
                        <span className="hint">{gift.giftHint}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
