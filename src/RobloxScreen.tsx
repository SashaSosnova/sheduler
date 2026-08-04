import { useEffect, useState } from 'react'
import {
  flushScreenOvertime,
  formatPlayTime,
  isRobloxEnabled,
  normalizeDayLog,
  normalizeRobloxLimitMin,
  todayKey,
} from './data'
import {
  claimRobloxBankMinutes,
  robloxBonusMinutes,
  robloxLimitSeconds,
  stampPerfectAt,
} from './progress'
import { ScreenLimitCard } from './ScreenLimitCard'
import { StudioProjectCard } from './StudioProjectCard'
import type { AppData, ScreenSlot } from './types'

type Props = {
  data: AppData
  onChange: (next: AppData) => void
}

type RobloxPane = 'play' | 'studio'

export function RobloxScreen({ data, onChange }: Props) {
  const [pane, setPane] = useState<RobloxPane>('studio')
  const key = todayKey()
  const day = normalizeDayLog(key, data.days[key])
  const allowed = isRobloxEnabled(data)
  const robloxLimit = robloxLimitSeconds(data, key)
  const baseMin = normalizeRobloxLimitMin(data.robloxLimitMin)
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
    if (!allowed) return
    onChange(claimRobloxBankMinutes(data, minutes, key))
  }

  function setSlot(slot: ScreenSlot) {
    if (!allowed) return
    patchDay({
      screens: {
        ...day.screens,
        roblox: slot,
      },
    })
  }

  // Parent banned Roblox while a session was running — stop and keep usedSec.
  useEffect(() => {
    if (allowed) return
    if (robloxSlot.endsAt == null && robloxSlot.overtimeStartedAt == null) {
      return
    }
    const now = Date.now()
    let next = flushScreenOvertime(robloxSlot, now)
    if (robloxSlot.endsAt != null && !robloxSlot.finished) {
      const left = Math.max(0, Math.ceil((robloxSlot.endsAt - now) / 1000))
      const played = Math.max(0, robloxSlot.remainingSec - left)
      next = {
        ...next,
        endsAt: null,
        remainingSec: left,
        finished: false,
        usedSec: robloxSlot.usedSec + played,
        overtimeStartedAt: null,
      }
    } else {
      next = {
        ...next,
        endsAt: null,
        overtimeStartedAt: null,
      }
    }
    patchDay({
      screens: {
        ...day.screens,
        roblox: next,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, robloxSlot.endsAt, robloxSlot.overtimeStartedAt])

  // Sync unused Roblox slot to today's limit (base + bonuses)
  useEffect(() => {
    if (!allowed) return
    if (robloxSlot.finished || robloxSlot.endsAt || robloxSlot.usedSec > 0) return
    if (robloxSlot.remainingSec === robloxLimit) return
    const baseSec = baseMin * 60
    if (robloxSlot.remainingSec < baseSec && robloxSlot.remainingSec !== 0) {
      return
    }
    patchDay({
      screens: {
        ...day.screens,
        roblox: { ...robloxSlot, remainingSec: robloxLimit },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allowed,
    robloxLimit,
    baseMin,
    robloxSlot.remainingSec,
    robloxSlot.finished,
    robloxSlot.endsAt,
    robloxSlot.usedSec,
  ])

  const usedSec = robloxSlot.usedSec
  const playSubParts: string[] = []
  if (!allowed) {
    playSubParts.push('сейчас нельзя')
  } else {
    playSubParts.push(`лимит ${Math.round(robloxLimit / 60)} мин`)
    if (robloxBonusMin > 0) playSubParts.push(`из копилки +${robloxBonusMin}`)
    if (usedSec > 0) playSubParts.push(`сыграно ${formatPlayTime(usedSec)}`)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Игра</p>
        </div>
        <h1 className="no-capitalize">
          {pane === 'play' ? 'Roblox' : 'Roblox Studio'}
        </h1>
        {pane === 'play' && playSubParts.length ? (
          <p className="sub">{playSubParts.join(' · ')}</p>
        ) : null}
        {pane === 'studio' ? (
          <p className="sub">Проект в башне Хранителя Времени</p>
        ) : null}
      </header>

      <div className="roblox-pane-switch" role="tablist" aria-label="Раздел Roblox">
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'studio'}
          className={
            pane === 'studio' ? 'roblox-pane-btn active' : 'roblox-pane-btn'
          }
          onClick={() => setPane('studio')}
        >
          Roblox Studio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'play'}
          className={pane === 'play' ? 'roblox-pane-btn active' : 'roblox-pane-btn'}
          onClick={() => setPane('play')}
        >
          Roblox
        </button>
      </div>

      {pane === 'play' ? (
        <>
          {!allowed ? (
            <section className="card">
              <h2>Пока нельзя</h2>
              <p className="hint" style={{ marginTop: 8 }}>
                Родители временно запретили Roblox. Можно заниматься за
                компьютером другими делами — просто без этой игры.
              </p>
            </section>
          ) : (
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
          )}

          <section className="card">
            <div className="card-title-row">
              <h2>Копилка бонусов</h2>
              <span className={robloxBankMin > 0 ? 'pill' : 'pill muted'}>
                {robloxBankMin} мин
              </span>
            </div>
            {!allowed ? (
              <p className="hint" style={{ marginTop: 8 }}>
                Пока игра запрещена, минуты из копилки потратить нельзя.
              </p>
            ) : robloxBankMin > 0 ? (
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
            ) : null}
          </section>
        </>
      ) : (
        <StudioProjectCard data={data} onChange={onChange} mode="child" />
      )}
    </div>
  )
}
