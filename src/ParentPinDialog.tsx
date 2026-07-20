import { useEffect, useRef, useState } from 'react'
import { isParentPinValid } from './parentPin'

type Props = {
  open: boolean
  title?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ParentPinDialog({
  open,
  title = 'Пин-код родителя',
  onSuccess,
  onCancel,
}: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPin('')
    setError(false)
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open])

  if (!open) return null

  function submit() {
    if (!isParentPinValid(pin)) {
      setError(true)
      setPin('')
      inputRef.current?.focus()
      return
    }
    onSuccess()
  }

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card pin-card">
        <h2>{title}</h2>
        <p className="hint">Введи пин-код, чтобы открыть режим родителя.</p>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Пин-код</span>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            maxLength={8}
            onChange={(e) => {
              setError(false)
              setPin(e.target.value.replace(/\D/g, ''))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </label>
        {error ? (
          <p className="hint pin-error" style={{ marginTop: 8 }}>
            Неверный пин-код
          </p>
        ) : null}
        <div className="row-gap" style={{ marginTop: 14 }}>
          <button type="button" className="btn primary" onClick={submit}>
            Войти
          </button>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
