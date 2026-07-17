import { useEffect, useState } from 'react'

type Props = {
  show: boolean
  onDone?: () => void
}

const COLORS = ['#2f6f5e', '#e8a54b', '#5b8def', '#d4576a', '#7bb89a']

/** Short burst of falling bits when a perfect day is completed. */
export function Confetti({ show, onDone }: Props) {
  const [pieces, setPieces] = useState<
    { id: number; left: number; delay: number; color: string; rot: number }[]
  >([])

  useEffect(() => {
    if (!show) {
      setPieces([])
      return
    }
    setPieces(
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * 360,
      })),
    )
    const id = window.setTimeout(() => onDone?.(), 2200)
    return () => window.clearTimeout(id)
  }, [show, onDone])

  if (!show || pieces.length === 0) return null

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  )
}
