import {
  REMINDERS,
  formatReminderTime,
} from './notifications'
import { FamilySyncCard } from './FamilySyncCard'
import type { FamilyStatus } from './familySync'
import type { UserRole } from './types'

type Props = {
  role: UserRole
  family: FamilyStatus
  firebaseReady: boolean
  notificationsEnabled: boolean
  notificationsSupported: boolean
  notificationsBusy: boolean
  notificationsDenied: boolean
  onToggleNotifications: (enabled: boolean) => void
  onCreateFamily: () => Promise<void>
  onJoinFamily: (code: string) => Promise<void>
  onLeaveFamily: () => void
  onChangeRole: (role: UserRole) => void
}

export function SettingsScreen({
  role,
  family,
  firebaseReady,
  notificationsEnabled,
  notificationsSupported,
  notificationsBusy,
  notificationsDenied,
  onToggleNotifications,
  onCreateFamily,
  onJoinFamily,
  onLeaveFamily,
  onChangeRole,
}: Props) {
  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Настройки</p>
        <h1>Ещё</h1>
        <p className="sub">Семья в облаке и режим приложения</p>
      </header>

      <section className="card">
        <h2>Режим</h2>
        <p className="hint">
          Сейчас: {role === 'parent' ? 'родитель (только просмотр)' : 'ребёнок'}
        </p>
        <div className="row-gap">
          {role === 'child' ? (
            <button
              type="button"
              className="btn"
              onClick={() => onChangeRole('parent')}
            >
              Переключить на родителя
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => onChangeRole('child')}
            >
              Переключить на ребёнка
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Напоминания</h2>
          <span className={notificationsEnabled && role === 'child' ? 'pill' : 'pill muted'}>
            {role !== 'child'
              ? 'на телефоне ребёнка'
              : notificationsEnabled
                ? 'вкл'
                : 'выкл'}
          </span>
        </div>
        {role === 'parent' ? (
          <p className="hint">
            Уведомления приходят на телефоне ребёнка, если там включены напоминания.
          </p>
        ) : (
          <>
            <p className="hint">
              Каждый день в одно и то же время — умывание, зарядка и дневник жевания.
            </p>
            {!notificationsSupported ? (
              <p className="hint" style={{ marginTop: 8 }}>
                В браузере не работает — только в приложении на телефоне.
              </p>
            ) : null}
            {notificationsDenied ? (
              <p className="hint" style={{ marginTop: 8 }}>
                Нет разрешения на уведомления. Включи их в настройках телефона для
                приложения.
              </p>
            ) : null}
            <ul className="status-list" style={{ marginTop: 10 }}>
              {REMINDERS.map((r) => (
                <li key={r.id}>
                  <span className="status-mark" aria-hidden>
                    ·
                  </span>
                  <span>
                    {formatReminderTime(r.hour, r.minute)} — {r.title}
                  </span>
                </li>
              ))}
            </ul>
            <div className="row-gap">
              <button
                type="button"
                className={notificationsEnabled ? 'btn' : 'btn primary'}
                disabled={notificationsBusy || !notificationsSupported}
                onClick={() => onToggleNotifications(!notificationsEnabled)}
              >
                {notificationsBusy
                  ? 'Секунду…'
                  : notificationsEnabled
                    ? 'Выключить напоминания'
                    : 'Включить напоминания'}
              </button>
            </div>
          </>
        )}
      </section>

      <FamilySyncCard
        family={family}
        firebaseReady={firebaseReady}
        onCreate={onCreateFamily}
        onJoin={onJoinFamily}
        onLeave={onLeaveFamily}
        joinPreferred={role === 'parent'}
      />
    </div>
  )
}
