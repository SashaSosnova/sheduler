import { FamilySyncCard } from './FamilySyncCard'
import type { FamilyStatus } from './familySync'
import type { UserRole } from './types'

type Props = {
  role: UserRole
  family: FamilyStatus
  firebaseReady: boolean
  onCreateFamily: () => Promise<void>
  onJoinFamily: (code: string) => Promise<void>
  onLeaveFamily: () => void
  onChangeRole: (role: UserRole) => void
}

export function SettingsScreen({
  role,
  family,
  firebaseReady,
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
