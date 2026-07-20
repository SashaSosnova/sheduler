import type { TabId, UserRole } from './types'

const CHILD_TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'roblox', label: 'Roblox' },
  { id: 'exercises', label: 'Зарядка' },
  { id: 'chew', label: 'Жевание' },
]

const PARENT_TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'Дни' },
  { id: 'exercises', label: 'Зарядка' },
  { id: 'chew', label: 'Жевание' },
]

type Props = {
  active: TabId
  role: UserRole
  onChange: (tab: TabId) => void
}

export function BottomNav({ active, role, onChange }: Props) {
  const tabs = role === 'parent' ? PARENT_TABS : CHILD_TABS
  return (
    <nav
      className="bottom-nav"
      aria-label="Главное меню"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
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
