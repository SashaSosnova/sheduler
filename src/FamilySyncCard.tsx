import { useState } from 'react'
import type { FamilyStatus } from './familySync'

type Props = {
  family: FamilyStatus
  firebaseReady: boolean
  onCreate: () => Promise<void>
  onJoin: (code: string) => Promise<void>
  onLeave: () => void
  /** Parent phone: emphasize joining child's family code */
  joinPreferred?: boolean
}

export function FamilySyncCard({
  family,
  firebaseReady,
  onCreate,
  onJoin,
  onLeave,
  joinPreferred = false,
}: Props) {
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    setBusy(true)
    try {
      await onCreate()
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    setBusy(true)
    try {
      await onJoin(joinCode)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Облако — все устройства</h2>
      {!firebaseReady ? (
        <p className="hint">
          Firebase ещё не настроен. Нужен файл `.env` с ключами проекта.
        </p>
      ) : null}

      {family.code ? (
        <>
          <p>
            Код семьи: <strong className="family-code">{family.code}</strong>
          </p>
          <p className="hint">
            {family.connected ? 'Онлайн' : 'Подключаемся…'}
            {family.syncing ? ' · сохраняем…' : ''}
          </p>
          {family.lastSyncedAt ? (
            <p className="hint">
              Обновлено:{' '}
              {new Date(family.lastSyncedAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
          <div className="row-gap">
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={onLeave}
            >
              Отключить это устройство
            </button>
          </div>
        </>
      ) : joinPreferred ? (
        <>
          <label className="field">
            <span>Код семьи</span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Например AB12CD"
              maxLength={8}
            />
          </label>
          <div className="row-gap">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !firebaseReady || joinCode.trim().length < 4}
              onClick={handleJoin}
            >
              Подключиться
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row-gap">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !firebaseReady}
              onClick={handleCreate}
            >
              Создать семью
            </button>
          </div>
          <label className="field">
            <span>Уже есть код?</span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Например AB12CD"
              maxLength={8}
            />
          </label>
          <div className="row-gap">
            <button
              type="button"
              className="btn"
              disabled={busy || !firebaseReady || joinCode.trim().length < 4}
              onClick={handleJoin}
            >
              Войти по коду
            </button>
          </div>
        </>
      )}

      {family.error ? <p className="family-error">{family.error}</p> : null}
    </section>
  )
}
