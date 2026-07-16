import type { UserRole } from './types'

type Props = {
  onChoose: (role: UserRole) => void
}

export function RoleSetupScreen({ onChoose }: Props) {
  return (
    <div className="screen role-setup">
      <header className="screen-head">
        <p className="eyebrow">Настройка</p>
        <h1>Кто будет пользоваться?</h1>
        <p className="sub">Выбери один раз — потом экран откроется в нужном режиме.</p>
      </header>

      <button type="button" className="card role-card" onClick={() => onChoose('child')}>
        <h2>Я ребёнок</h2>
        <p className="hint">
          Чеклист на день, зарядка, дневник жевания и таймер Roblox. Можно отмечать
          сделанное.
        </p>
      </button>

      <button type="button" className="card role-card" onClick={() => onChoose('parent')}>
        <h2>Я родитель</h2>
        <p className="hint">
          Только смотреть сводку: что сделано сегодня, зарядку и дневник жевания. Без
          отметок и таймеров.
        </p>
      </button>
    </div>
  )
}
