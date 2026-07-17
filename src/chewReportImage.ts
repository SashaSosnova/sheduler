import type { ChewEntry } from './types'

function formatDateRu(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function sideText(values: number[]): string {
  return values.join(', ')
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/** Renders the chew diary as a clean PNG for messengers / screenshots. */
export async function renderChewReportPng(entries: ChewEntry[]): Promise<Blob> {
  const scale = 2
  const padX = 28
  const padY = 28
  const titleSize = 22
  const headerSize = 12
  const cellSize = 13
  const rowMinH = 34
  const lineH = 18

  const cols = [
    { label: 'День', width: 110 },
    { label: 'Что жевал', width: 120 },
    { label: 'Левая (5 укусов)', width: 168 },
    { label: 'Правая (5 укусов)', width: 168 },
  ] as const

  const tableW = cols.reduce((s, c) => s + c.width, 0)
  const contentW = tableW

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas недоступен')

  measure.font = `${cellSize}px system-ui, sans-serif`
  const rowHeights = entries.map((entry) => {
    const cells = [
      formatDateRu(entry.date),
      entry.food,
      sideText(entry.left),
      sideText(entry.right),
    ]
    let maxLines = 1
    cells.forEach((text, i) => {
      const lines = wrapLines(measure, text, cols[i].width - 16)
      maxLines = Math.max(maxLines, lines.length)
    })
    return Math.max(rowMinH, maxLines * lineH + 12)
  })

  const titleBlock = 56
  const headerH = 36
  const tableH = headerH + rowHeights.reduce((s, h) => s + h, 0)
  const width = contentW + padX * 2
  const height = padY + titleBlock + tableH + padY

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')

  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#1a1a1a'
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`
  ctx.fillText('Дневник жевания', padX, padY + 24)

  ctx.fillStyle = '#666666'
  ctx.font = `400 12px system-ui, sans-serif`
  ctx.fillText(
    `${entries.length} ${entries.length === 1 ? 'день' : 'дней'} · для миотерапевта`,
    padX,
    padY + 44,
  )

  const tableTop = padY + titleBlock
  let x = padX
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(padX, tableTop, tableW, headerH)

  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = 1
  ctx.strokeRect(padX + 0.5, tableTop + 0.5, tableW - 1, tableH - 1)

  ctx.fillStyle = '#555555'
  ctx.font = `700 ${headerSize}px system-ui, sans-serif`
  cols.forEach((col) => {
    ctx.fillText(col.label, x + 8, tableTop + 23)
    x += col.width
  })

  let y = tableTop + headerH
  entries.forEach((entry, rowIndex) => {
    const rowH = rowHeights[rowIndex]
    if (rowIndex % 2 === 1) {
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(padX, y, tableW, rowH)
    }

    ctx.beginPath()
    ctx.moveTo(padX, y + 0.5)
    ctx.lineTo(padX + tableW, y + 0.5)
    ctx.strokeStyle = '#e5e5e5'
    ctx.stroke()

    const cells = [
      formatDateRu(entry.date),
      entry.food,
      sideText(entry.left),
      sideText(entry.right),
    ]
    let cx = padX
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `400 ${cellSize}px system-ui, sans-serif`
    cells.forEach((text, i) => {
      const lines = wrapLines(ctx, text, cols[i].width - 16)
      lines.forEach((line, li) => {
        ctx.fillText(line, cx + 8, y + 16 + li * lineH)
      })
      cx += cols[i].width
    })
    y += rowH
  })

  // Column separators
  x = padX
  cols.forEach((_col, i) => {
    if (i === 0) return
    x += cols[i - 1].width
    ctx.beginPath()
    ctx.moveTo(x + 0.5, tableTop)
    ctx.lineTo(x + 0.5, tableTop + tableH)
    ctx.strokeStyle = '#e5e5e5'
    ctx.stroke()
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Не удалось создать изображение'))
      },
      'image/png',
    )
  })
}

export async function shareChewReportImage(entries: ChewEntry[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await renderChewReportPng(entries)
  const file = new File([blob], 'dnevnik-zhevaniya.png', { type: 'image/png' })

  const canShareFiles =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: 'Дневник жевания',
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
      /* fall through to download */
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dnevnik-zhevaniya.png'
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
