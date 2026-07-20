import { useEffect } from 'react'
import {
  SCREEN_LIMITS,
  formatPlayTime,
  normalizeDayLog,
  todayKey,
} from './data'
import {
  claimRobloxBankMinutes,
  robloxBonusMinutes,
  robloxLimitSeconds,
  stampPerfectAt,
} from './progress'
import { ScreenLimitCard } from './ScreenLimitCard'
import type { AppData, ScreenSlot } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

export function RobloxScreen({ data, onChange }: Props) {
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const robloxLimit = robloxLimitSeconds(data.days, key)
  const robloxBonusMin = robloxBonusMinutes(data.days, key)
  const robloxBankMin = Math.max(0, Math.floor(data.robloxBonusBankMin ?? 0))
  const robloxSlot = day.screens.roblox
  const bankClaimOptions = [10, 15, 20, 25, 30].filter((n) => n <= robloxBankMin)

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

  function claimBank(minutes: number) {
    onChange(claimRobloxBankMinutes(data, minutes, key))
  }

  function setSlot(slot: ScreenSlot) {
    patchDay({
      screens: {
        ...day.screens,
        roblox: slot,
      },
    })
  }

  // Sync unused Roblox slot to today's limit (base + achievement bonuses)
  useEffect(() => {
    if (robloxSlot.finished || robloxSlot.endsAt || robloxSlot.usedSec > 0) return
    if (robloxSlot.remainingSec === robloxLimit) return
    const base = SCREEN_LIMITS.roblox.seconds
    if (robloxSlot.remainingSec < base) return
    patchDay({
      screens: {
        ...day.screens,
        roblox: { ...robloxSlot, remainingSec: robloxLimit },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    robloxLimit,
    robloxSlot.remainingSec,
    robloxSlot.finished,
    robloxSlot.endsAt,
    robloxSlot.usedSec,
  ])

  const limitMin = Math.round(robloxLimit / 60)
  const usedSec = robloxSlot.usedSec
  const subParts = [`Лимит ${limitMin} мин`]
  if (robloxBonusMin > 0) subParts.push(`из копилки +${robloxBonusMin}`)
  if (usedSec > 0) subParts.push(`сыграно ${formatPlayTime(usedSec)}`)

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Игра</p>
        </div>
        <h1 className="no-capitalize">Roblox</h1>
        <p className="sub">{subParts.join(' · ')}</p>
      </header>

      <ScreenLimitCard
        kind="roblox"
        slot={robloxSlot}
        limitSeconds={robloxLimit}
        bonusNote={
          robloxBonusMin > 0
            ? `Сегодня из копилки: +${robloxBonusMin} мин`
            : undefined
        }
        onChange={setSlot}
      />

      <section className="card">
        <div className="card-title-row">
          <h2>Копилка бонусов</h2>
          <span className={robloxBankMin > 0 ? 'pill' : 'pill muted'}>
            {robloxBankMin} мин
          </span>
        </div>
        {robloxBankMin <= 0 ? (
          <p className="hint">
            Сюда падают бонусные минуты за серии и достижения — потом можно
            взять в любой день.
          </p>
        ) : (
          <div className="roblox-bank-actions">
            {bankClaimOptions.map((n) => (
              <button
                key={n}
                type="button"
                className="btn ghost"
                onClick={() => claimBank(n)}
              >
                +{n} мин сегодня
              </button>
            ))}
            <button
              type="button"
              className="btn primary"
              onClick={() => claimBank(robloxBankMin)}
            >
              Все {robloxBankMin} мин сегодня
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
