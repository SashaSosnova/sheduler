import type { TabId, UserRole } from './types'

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'exercises', label: 'Зарядка' },
  { id: 'chew', label: 'Жевание' },
  { id: 'settings', label: 'Ещё' },
]

type Props = {
  active: TabId
  role: UserRole
  onChange: (tab: TabId) => void
}

export function BottomNav({ active, role, onChange }: Props) {
  const tabs =
    role === 'parent'
      ? ALL_TABS.filter((tab) => tab.id !== 'progress')
      : ALL_TABS

  return (
    <nav className="bottom-nav" aria-label="Главное меню">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? 'nav-btn active' : 'nav-btn'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
