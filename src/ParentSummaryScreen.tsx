import { WeeklyGradesCard } from './WeeklyGradesCard'
import {
  dismissGiftSticker,
  giftMoneyBankRub,
  giftRobloxBankMinutes,
  payoutMoneyBankRub,
  payoutRobloxBankMinutes,
  pendingGiftStickers,
} from './progress'
import type { AppData } from './types'

const PARENT_BANK_GIFTS = [5, 10, 15, 30] as const
const PARENT_BANK_PAYOUTS = [10, 15, 20, 30] as const
const PARENT_MONEY_GIFTS = [100, 200, 300] as const
const PARENT_MONEY_PAYOUTS = [100, 200, 300, 500] as const

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

export function ParentSummaryScreen({ data, onChange }: Props) {
  const pendingGifts = pendingGiftStickers(data)
  const moneyBank = Math.floor(data.moneyBankRub ?? 0)
  const robloxBankMin = Math.floor(data.robloxBonusBankMin ?? 0)

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
        </div>
        <h1>Награды</h1>
        <p className="sub">Оценки за неделю, гаджеты и копилка</p>
      </header>

      <WeeklyGradesCard data={data} onChange={onChange} collapsed />

      <section className="card">
        <div className="card-title-row">
          <h2>Гаджеты</h2>
          <span className={robloxBankMin > 0 ? 'pill' : 'pill muted'}>
            {robloxBankMin} мин
          </span>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Минуты за компьютером — выдать сверх обычного времени.
        </p>
        <div className="parent-roblox-bank">
          <div className="row-gap">
            {PARENT_BANK_GIFTS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => onChange(giftRobloxBankMinutes(data, n))}
              >
                +{n} мин
              </button>
            ))}
          </div>
          {robloxBankMin > 0 ? (
            <div className="row-gap" style={{ marginTop: 10 }}>
              {PARENT_BANK_PAYOUTS.filter((n) => n <= robloxBankMin).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn ghost"
                  onClick={() => onChange(payoutRobloxBankMinutes(data, n))}
                >
                  Выдать {n} мин
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onChange(payoutRobloxBankMinutes(data, robloxBankMin))
                }
              >
                Выдать всё
              </button>
            </div>
          ) : null}
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
        {moneyBank > 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>
            {moneyBank} ₽ на любую покупку.
          </p>
        ) : null}
        <div className="parent-roblox-bank">
          <div className="row-gap">
            {PARENT_MONEY_GIFTS.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => onChange(giftMoneyBankRub(data, n))}
              >
                +{n} ₽
              </button>
            ))}
          </div>
          {moneyBank > 0 ? (
            <div className="row-gap" style={{ marginTop: 10 }}>
              {PARENT_MONEY_PAYOUTS.filter((n) => n <= moneyBank).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn ghost"
                  onClick={() => onChange(payoutMoneyBankRub(data, n))}
                >
                  −{n} ₽
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => onChange(payoutMoneyBankRub(data, moneyBank))}
              >
                Списать всё
              </button>
            </div>
          ) : null}

          {pendingGifts.length > 0 ? (
            <ul className="gift-pending-list">
              {pendingGifts.map((gift) => (
                <li key={gift.id} className="gift-pending-item">
                  <div className="gift-pending-main">
                    <span className="gift-pending-title">{gift.label}</span>
                    <span className="hint">{gift.giftHint}</span>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => onChange(dismissGiftSticker(data, gift.id))}
                  >
                    Выдать
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  )
}
