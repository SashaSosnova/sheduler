import { useState } from 'react'
import {
  MED_SLOT_ITEMS,
  medicationLabel,
  uid,
} from './data'
import {
  REMINDERS,
  formatReminderTime,
} from './notifications'
import { FamilySyncCard } from './FamilySyncCard'
import type { FamilyStatus } from './familySync'
import type { AppData, MedSlotId, Medication, UserRole } from './types'

type Props = {
  role: UserRole
  data: AppData
  onChange: (next: AppData) => void
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
  data,
  onChange,
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
  const medications = data.medications ?? []
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medSlots, setMedSlots] = useState<MedSlotId[]>([
    'morning',
    'day',
    'evening',
  ])

  function patchMedications(next: Medication[]) {
    onChange({
      ...data,
      medications: next,
      medicationUpdatedAt: Date.now(),
    })
  }

  function addMedication() {
    const name = medName.trim()
    if (!name || medSlots.length === 0) return
    patchMedications([
      ...medications,
      {
        id: uid(),
        name,
        dose: medDose.trim(),
        slots: [...medSlots],
      },
    ])
    setMedName('')
    setMedDose('')
    setMedSlots(['morning', 'day', 'evening'])
  }

  function removeMedication(id: string) {
    patchMedications(medications.filter((m) => m.id !== id))
  }

  function toggleMedSlot(slot: MedSlotId) {
    setMedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    )
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="screen-head-row">
          <p className="eyebrow">Настройки</p>
          <div className="screen-head-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={onGoHome}
            >
              ← На главную
            </button>
          </div>
        </div>
        <h1>Ещё</h1>
      </header>

      <section className="card">
        <h2>Режим</h2>
        <p className="hint">
          Сейчас: {role === 'parent' ? 'родитель' : 'ребёнок'}
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
            <h2>Таблетки</h2>
            <p className="hint">
              Препарат, когда давать и сколько. На днях остаются только чипы и
              отметки приёма.
            </p>
            {medications.length > 0 ? (
              <ul className="med-schedule-list" style={{ marginTop: 10 }}>
                {medications.map((med) => (
                  <li key={med.id} className="med-schedule-item">
                    <div className="med-schedule-item-main">
                      <strong>{medicationLabel(med)}</strong>
                      <span className="hint">
                        {' '}
                        —{' '}
                        {MED_SLOT_ITEMS.filter((s) => med.slots.includes(s.id))
                          .map((s) => s.label.toLowerCase())
                          .join('/')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Удалить ${med.name}`}
                      onClick={() => removeMedication(med.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint" style={{ marginTop: 8 }}>
                Пока пусто — добавь первый препарат.
              </p>
            )}
            <div className="med-add-row" style={{ marginTop: 12 }}>
              <label className="field">
                <span>Препарат</span>
                <input
                  value={medName}
                  placeholder="Магний B6"
                  onChange={(e) => setMedName(e.target.value)}
                />
              </label>
              <label className="field med-add-dose">
                <span>Сколько</span>
                <input
                  value={medDose}
                  placeholder="1 таб"
                  onChange={(e) => setMedDose(e.target.value)}
                />
              </label>
            </div>
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
              Когда принимать
            </p>
            <div className="med-slot-toggles" role="group" aria-label="Когда принимать">
              {MED_SLOT_ITEMS.map((slot) => {
                const on = medSlots.includes(slot.id)
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`med-slot-chip${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleMedSlot(slot.id)}
                  >
                    {slot.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 10 }}
              disabled={!medName.trim() || medSlots.length === 0}
              onClick={addMedication}
            >
              Добавить препарат
            </button>
          </section>

          <section className="card">
            <h2>Подпись в заданиях</h2>
            <label className="field">
              <span>От кого (род. падеж)</span>
              <input
                value={parentLabel}
                onChange={(e) => onChangeParentLabel(e.target.value)}
                placeholder="мамы"
                maxLength={24}
              />
            </label>
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
            <label className="field">
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
            <p className="hint" style={{ marginTop: 8 }}>
              Приходит даже если приложение закрыто. На Samsung: настройки →
              батарея → Sheduler → без ограничений.
            </p>
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
            <p className="hint" style={{ marginTop: 8 }}>
              Эти напоминания стоят на телефоне и приходят, даже если приложение
              закрыто.
            </p>
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
            <p className="hint" style={{ marginTop: 8 }}>
              Приходит даже если приложение закрыто. На Samsung: батарея →
              Sheduler → без ограничений.
            </p>
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
