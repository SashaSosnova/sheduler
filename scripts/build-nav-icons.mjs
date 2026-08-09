import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcDir =
  'C:/Users/amles/.cursor/projects/c-Users-amles-Projects-book/assets'
const dstDir = path.join(root, 'public', 'nav')
const SIZE = 256
const PAD = 16

const items = [
  'today',
  'progress',
  'roblox',
  'exercises',
  'chew',
  'calendar',
  'rewards',
  'settings',
]

async function punchPlate(inputBuf) {
  const { data, info } = await sharp(inputBuf)
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h, channels } = info

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 8) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (r > 228 && g > 228 && b > 228 && sat < 0.12) data[i + 3] = 0
    else if (r > 218 && g > 218 && b > 218 && sat < 0.08) {
      data[i + 3] = Math.round(
        a * Math.max(0, 1 - ((r + g + b) / 3 - 218) / 37),
      )
    }
  }

  const seen = new Uint8Array(w * h)
  const stack = []
  const isBg = (o) => {
    const a = data[o + 3]
    if (a < 20) return true
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (r > 210 && g > 210 && b > 210 && sat < 0.14) return true
    if (r < 35 && g < 35 && b < 35 && sat < 0.2) return true
    return false
  }
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (seen[i]) return
    if (!isBg(i * 4)) return
    seen[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    data[i * 4 + 3] = 0
    const x = i % w
    const y = (i / w) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  return sharp(data, { raw: { width: w, height: h, channels } })
    .trim({ threshold: 6 })
    .png()
    .toBuffer()
}

for (const name of items) {
  const input = await sharp(path.join(srcDir, `nav-${name}.png`))
    .png()
    .toBuffer()
  let art = await punchPlate(input)
  const max = SIZE - PAD * 2
  art = await sharp(art)
    .resize(max, max, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const meta = await sharp(art).metadata()
  const realW = meta.width ?? max
  const realH = meta.height ?? max
  const outPath = path.join(dstDir, `${name}.png`)

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: art,
        top: Math.round((SIZE - realH) / 2),
        left: Math.round((SIZE - realW) / 2),
      },
    ])
    .png()
    .toFile(outPath)

  console.log('wrote', name, `${realW}x${realH}`)
}
