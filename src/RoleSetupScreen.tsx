import { useState } from 'react'
import { ParentPinDialog } from './ParentPinDialog'
import type { UserRole } from './types'

type Props = {
  onChoose: (role: UserRole) => void
}

export function RoleSetupScreen({ onChoose }: Props) {
  const [pinOpen, setPinOpen] = useState(false)

  return (
    <div className="screen role-setup">
      <header className="screen-head">
        <p className="eyebrow">Настройка</p>
        <h1>Кто будет пользоваться?</h1>
      </header>

      <button
        type="button"
        className="card role-card"
        onClick={() => onChoose('child')}
      >
        <h2>Я ребёнок</h2>
      </button>

      <button
        type="button"
        className="card role-card"
        onClick={() => setPinOpen(true)}
      >
        <h2>Я родитель</h2>
      </button>

      <ParentPinDialog
        open={pinOpen}
        onSuccess={() => {
          setPinOpen(false)
          onChoose('parent')
        }}
        onCancel={() => setPinOpen(false)}
      />
    </div>
  )
}
