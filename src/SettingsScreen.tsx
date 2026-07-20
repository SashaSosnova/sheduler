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
  parentAlertsEnabled: boolean
  parentAlertsBusy: boolean
  parentAlertsDenied: boolean
  parentAlertsSupported: boolean
  childName: string
  parentLabel: string
  onToggleParentAlerts: (enabled: boolean) => void
  onChangeChildName: (name: string) => void
  onChangeParentLabel: (label: string) => void
  childTaskAlertsEnabled: boolean
  childTaskAlertsBusy: boolean
  childTaskAlertsDenied: boolean
  childTaskAlertsSupported: boolean
  onToggleChildTaskAlerts: (enabled: boolean) => void
  onCreateFamily: () => Promise<void>
  onJoinFamily: (code: string) => Promise<void>
  onLeaveFamily: () => void
  onChangeRole: (role: UserRole) => void
  onGoHome: () => void
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
  parentAlertsEnabled,
  parentAlertsBusy,
  parentAlertsDenied,
  parentAlertsSupported,
  childName,
  parentLabel,
  onToggleParentAlerts,
  onChangeChildName,
  onChangeParentLabel,
  childTaskAlertsEnabled,
  childTaskAlertsBusy,
  childTaskAlertsDenied,
  childTaskAlertsSupported,
  onToggleChildTaskAlerts,
  onCreateFamily,
  onJoinFamily,
  onLeaveFamily,
  onChangeRole,
  onGoHome,
}: Props) {
  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Настройки</p>
          <button
            type="button"
            className="btn ghost"
            onClick={onGoHome}
          >
            ← На главную
          </button>
        </div>
        <h1>Ещё</h1>
        <p className="sub">Семья в облаке и режим приложения</p>
      </header>

      <section className="card">
        <h2>Режим</h2>
        <p className="hint">
          Сейчас:{' '}
          {role === 'parent'
            ? 'родитель (можно отмечать за ребёнка)'
            : 'ребёнок'}
        </p>
        <div className="row-gap">
          {role === 'child' ? (
            <button
              type="button"
              className="btn"
              onClick={() => onChangeRole('parent')}
            >
              Переключить на родителя (пин-код)
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

      {role === 'parent' ? (
        <>
          <section className="card">
            <h2>Подпись в заданиях</h2>
            <p className="hint">
              Так ребёнок увидит, от кого задание — в списке и в уведомлении.
            </p>
            <label className="field" style={{ marginTop: 12 }}>
              <span>От кого (род. падеж)</span>
              <input
                value={parentLabel}
                onChange={(e) => onChangeParentLabel(e.target.value)}
                placeholder="мамы"
                maxLength={24}
              />
            </label>
            <p className="hint" style={{ marginTop: 8 }}>
              Пример: «Добавлено задание от {parentLabel || 'мамы'}: Купить хлеб»
            </p>
            <div className="row-gap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className={parentLabel === 'мамы' ? 'btn primary' : 'btn'}
                onClick={() => onChangeParentLabel('мамы')}
              >
                мамы
              </button>
              <button
                type="button"
                className={parentLabel === 'папы' ? 'btn primary' : 'btn'}
                onClick={() => onChangeParentLabel('папы')}
              >
                папы
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2>Уведомления о ребёнке</h2>
              <span className={parentAlertsEnabled ? 'pill' : 'pill muted'}>
                {parentAlertsEnabled ? 'вкл' : 'выкл'}
              </span>
            </div>
            <p className="hint">
              Когда через облако придёт зарядка или дневник жевания — придёт
              уведомление. Нужны одно семейное облако и приложение на телефоне
              родителя (лучше не выгружать его из памяти полностью).
            </p>
            <label className="field" style={{ marginTop: 12 }}>
              <span>Имя в уведомлениях</span>
              <input
                value={childName}
                onChange={(e) => onChangeChildName(e.target.value)}
                placeholder="Даня"
                maxLength={24}
              />
            </label>
            {!parentAlertsSupported ? (
              <p className="hint" style={{ marginTop: 8 }}>
                В браузере не работает — только в приложении на телефоне.
              </p>
            ) : null}
            {parentAlertsDenied ? (
              <p className="hint" style={{ marginTop: 8 }}>
                Нет разрешения на уведомления. Включи их в настройках телефона для
                приложения.
              </p>
            ) : null}
            <ul className="status-list" style={{ marginTop: 10 }}>
              <li>
                <span className="status-mark" aria-hidden>
                  ·
                </span>
                <span>
                  {childName} сделал зарядку за … минут
                </span>
              </li>
              <li>
                <span className="status-mark" aria-hidden>
                  ·
                </span>
                <span>{childName} заполнил дневник жевания</span>
              </li>
            </ul>
            <div className="row-gap">
              <button
                type="button"
                className={parentAlertsEnabled ? 'btn' : 'btn primary'}
                disabled={parentAlertsBusy || !parentAlertsSupported}
                onClick={() => onToggleParentAlerts(!parentAlertsEnabled)}
              >
                {parentAlertsBusy
                  ? 'Секунду…'
                  : parentAlertsEnabled
                    ? 'Выключить уведомления'
                    : 'Включить уведомления'}
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="card">
            <div className="card-title-row">
              <h2>Напоминания</h2>
              <span className={notificationsEnabled ? 'pill' : 'pill muted'}>
                {notificationsEnabled ? 'вкл' : 'выкл'}
              </span>
            </div>
            <p className="hint">
              Каждый день в одно и то же время — умывание, зарядка и дневник
              жевания.
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
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2>Задания от родителя</h2>
              <span className={childTaskAlertsEnabled ? 'pill' : 'pill muted'}>
                {childTaskAlertsEnabled ? 'вкл' : 'выкл'}
              </span>
            </div>
            <p className="hint">
              Когда родитель добавит задание через облако — придёт уведомление.
              Нужны одно семейное облако и приложение на телефоне ребёнка (лучше
              не выгружать его из памяти полностью).
            </p>
            {!childTaskAlertsSupported ? (
              <p className="hint" style={{ marginTop: 8 }}>
                В браузере не работает — только в приложении на телефоне.
              </p>
            ) : null}
            {childTaskAlertsDenied ? (
              <p className="hint" style={{ marginTop: 8 }}>
                Нет разрешения на уведомления. Включи их в настройках телефона для
                приложения.
              </p>
            ) : null}
            <ul className="status-list" style={{ marginTop: 10 }}>
              <li>
                <span className="status-mark" aria-hidden>
                  ·
                </span>
                <span>Добавлено задание от мамы: Купить хлеб</span>
              </li>
            </ul>
            <div className="row-gap">
              <button
                type="button"
                className={childTaskAlertsEnabled ? 'btn' : 'btn primary'}
                disabled={childTaskAlertsBusy || !childTaskAlertsSupported}
                onClick={() => onToggleChildTaskAlerts(!childTaskAlertsEnabled)}
              >
                {childTaskAlertsBusy
                  ? 'Секунду…'
                  : childTaskAlertsEnabled
                    ? 'Выключить уведомления'
                    : 'Включить уведомления'}
              </button>
            </div>
          </section>
        </>
      )}

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
