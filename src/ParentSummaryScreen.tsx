import { useEffect, useState } from 'react'
import {
  SCREEN_LIMITS,
  flushScreenOvertime,
  formatPlayTimeWithOvertime,
  screenOvertimeSec,
  normalizeDayLog,
  todayKey,
} from './data'
import {
  dismissGiftSticker,
  giftMoneyBankRub,
  giftRobloxBankMinutes,
  payoutMoneyBankRub,
  pendingGiftStickers,
  robloxLimitSeconds,
  stampPerfectAt,
} from './progress'
import type { AppData } from './types'

const PARENT_BANK_GIFTS = [5, 10, 15, 30] as const
const PARENT_MONEY_GIFTS = [100, 200, 300] as const
const PARENT_MONEY_PAYOUTS = [100, 200, 300, 500] as const

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

export function ParentSummaryScreen({ data, onChange }: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])

  const roblox = day.screens.roblox
  const limitSec = robloxLimitSeconds(data.days, key)
  const running = Boolean(roblox.endsAt && !roblox.finished)
  const [now, setNow] = useState(Date.now())

  const timedOut =
    !roblox.finished && !running && roblox.remainingSec <= 0 && roblox.usedSec > 0
  const overtimeTicking = timedOut && roblox.overtimeStartedAt != null

  useEffect(() => {
    if (!running && !overtimeTicking) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running, overtimeTicking])

  const livePlayed =
    running && roblox.endsAt
      ? Math.max(
          0,
          Math.floor((now - (roblox.endsAt - roblox.remainingSec * 1000)) / 1000),
        )
      : 0
  const displayUsed = Math.min(limitSec, roblox.usedSec + livePlayed)
  const overtimeLive = screenOvertimeSec(roblox, now)
  const statusLabel = roblox.finished
    ? 'лимит закрыт'
    : running
      ? 'сейчас играет'
      : timedOut
        ? overtimeLive > 0 || overtimeTicking
          ? 'доигрывает сверх лимита'
          : 'время вышло'
        : roblox.usedSec > 0
          ? 'пауза'
          : 'ещё не играл'

  function patchDay(partial: Partial<typeof day>) {
    const next = stampPerfectAt(
      day,
      normalizeDayLog(key, { ...day, ...partial }),
    )
    onChange({
      ...data,
      days: {
        ...data.days,
        [key]: next,
      },
    })
  }

  const pendingGifts = pendingGiftStickers(data)
  const moneyBank = Math.floor(data.moneyBankRub ?? 0)

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Родитель</p>
        </div>
        <h1>Награды</h1>
        <p className="sub">Roblox и копилка</p>
      </header>

      <section className="card parent-screen-card">
        <div className="card-title-row">
          <h2>Компьютер / {SCREEN_LIMITS.roblox.label}</h2>
          <span className={roblox.finished || running ? 'pill' : 'pill muted'}>
            {statusLabel}
          </span>
        </div>
        <p className="parent-play-time">
          {formatPlayTimeWithOvertime(displayUsed, overtimeLive)}
        </p>
        <p className="hint">из {Math.round(limitSec / 60)} мин на сегодня</p>
        <div className="parent-roblox-bank">
          <p className="hint">
            Копилка бонусов:{' '}
            <strong>{Math.floor(data.robloxBonusBankMin ?? 0)} мин</strong>
          </p>
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
        </div>
        <div className="play-bar" aria-hidden>
          <div
            className="play-bar-fill"
            style={{ width: `${Math.min(100, (displayUsed / limitSec) * 100)}%` }}
          />
        </div>
        {overtimeLive > 0 || overtimeTicking || (timedOut && !roblox.finished) ? (
          <div className="row-gap" style={{ marginTop: 12 }}>
            {overtimeLive > 0 || overtimeTicking ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  patchDay({
                    screens: {
                      ...day.screens,
                      roblox: {
                        ...flushScreenOvertime(roblox),
                        overtimeSec: 0,
                        overtimeStartedAt: null,
                      },
                    },
                  })
                }
              >
                Сбросить превышение
              </button>
            ) : null}
            {!roblox.finished ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  patchDay({
                    screens: {
                      ...day.screens,
                      roblox: {
                        ...flushScreenOvertime(roblox),
                        endsAt: null,
                        remainingSec: 0,
                        finished: true,
                        overtimeSec: 0,
                        overtimeStartedAt: null,
                      },
                    },
                  })
                }
              >
                Закрыть день без превышения
              </button>
            ) : null}
          </div>
        ) : null}
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
