import type { TabId } from './types'

const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'Месяц' },
  { id: 'exercises', label: 'Зарядка' },
  { id: 'chew', label: 'Жевание' },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Главное меню">
      {TABS.map((tab) => (
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
