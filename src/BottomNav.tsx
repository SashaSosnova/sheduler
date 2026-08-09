import type { TabId, UserRole } from './types'

type NavTab = { id: TabId; label: string; icon: string }

const CHILD_TABS: NavTab[] = [
  { id: 'today', label: 'Сегодня', icon: './nav/today.png?v=18' },
  { id: 'progress', label: 'Прогресс', icon: './nav/progress.png?v=18' },
  { id: 'roblox', label: 'Roblox', icon: './nav/roblox.png?v=18' },
  { id: 'exercises', label: 'Зарядка', icon: './nav/exercises.png?v=18' },
  { id: 'chew', label: 'Жевание', icon: './nav/chew.png?v=18' },
]

const PARENT_TABS: NavTab[] = [
  { id: 'calendar', label: 'Дни', icon: './nav/calendar.png?v=18' },
  { id: 'today', label: 'Награды', icon: './nav/rewards.png?v=18' },
  { id: 'exercises', label: 'Зарядка', icon: './nav/exercises.png?v=18' },
  { id: 'chew', label: 'Жевание', icon: './nav/chew.png?v=18' },
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
          key={`${role}-${tab.id}`}
          type="button"
          className={active === tab.id ? 'nav-btn active' : 'nav-btn'}
          aria-label={tab.label}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <img className="nav-icon" src={tab.icon} alt="" draggable={false} />
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
