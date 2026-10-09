// 스토리 연출 동작 시트 조립 — story-anims.txt 의 각 동작(남쪽 8프레임)을 PixelLab 캐릭터 spritesheet export 에서 뽑아
// public/images/story-anims/<id>.png 로 만든다. 96px 셀 · 8열 × 1행(참조 프레임 0 제외).
// 같은 캐릭터는 zip 을 한 번만 받는다(캐시: scripts/_pixellab/story-sheets/<charId>).
//
// node scripts/_pixellab/build-story-anims.mjs [--refetch] [id ...]
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(__dirname, 'story-sheets')
const OUT = path.join(__dirname, '..', '..', 'public', 'images', 'story-anims')
const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/mcp/characters'
const CELL = 96
const COLS = 8
const args = process.argv.slice(2)
const refetch = args.includes('--refetch')
const only = args.filter((a) => !a.startsWith('--'))
fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })
const rows = fs.readFileSync(path.join(__dirname, 'story-anims.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'))
  .filter(([id]) => !only.length || only.includes(id))

async function clearBackdrop(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const at = (x, y) => (y * w + x) * 4
  // 불투명 영역 bbox — 배경판은 셀 안쪽 사각형으로 붙어 나올 때가 있다
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[at(x, y) + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return png
  const c0 = at(x0, y0)
  const same = (i, j) => data[i + 3] > 10 && data[j + 3] > 10 && Math.abs(data[i] - data[j]) < 6 && Math.abs(data[i + 1] - data[j + 1]) < 6 && Math.abs(data[i + 2] - data[j + 2]) < 6
  // 네 모서리가 같은 색이어야 배경판으로 본다(캐릭터 자체가 모서리에 닿은 경우 오탐 방지)
  if (!(same(c0, at(x1, y0)) && same(c0, at(x0, y1)) && same(c0, at(x1, y1)))) return png
  const [br, bg, bb] = [data[c0], data[c0 + 1], data[c0 + 2]]
  const near = (i) => data[i + 3] > 10 && Math.abs(data[i] - br) < 18 && Math.abs(data[i + 1] - bg) < 18 && Math.abs(data[i + 2] - bb) < 18
  const seen = new Uint8Array(w * h)
  const stack = []
  for (let x = x0; x <= x1; x++) stack.push([x, y0], [x, y1])
  for (let y = y0; y <= y1; y++) stack.push([x0, y], [x1, y])
  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue
    seen[y * w + x] = 1
    const i = at(x, y)
    if (!near(i)) continue
    data[i + 3] = 0
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

const fetched = new Set()
for (const [id, charId, animName] of rows) {
  const dirPath = path.join(CACHE, charId)
  if (!fetched.has(charId) && (refetch || !fs.existsSync(dirPath))) {
    fs.rmSync(dirPath, { recursive: true, force: true })
    fs.mkdirSync(dirPath, { recursive: true })
    const zip = path.join(dirPath, '_sheet.zip')
    execFileSync('curl', ['-sS', '-f', '-L', '--max-time', '120', '-H', `Authorization: Bearer ${TOKEN}`, '-o', zip, `${API}/${charId}/spritesheet`], { stdio: ['ignore', 'ignore', 'inherit'] })
    execFileSync('unzip', ['-o', '-q', zip, '-d', dirPath])
    fs.rmSync(zip)
  }
  fetched.add(charId)
  const json = fs.readdirSync(dirPath).find((f) => f.endsWith('.json'))
  const png = fs.readdirSync(dirPath).find((f) => f.endsWith('.png'))
  const meta = JSON.parse(fs.readFileSync(path.join(dirPath, json), 'utf8')).spritesheet
  const inCell = meta.cell_size.width
  const buf = await sharp(path.join(dirPath, png)).toBuffer()
  const anim = [...meta.rows].reverse().find((r) => r.type === 'animation' && String(r.animation || '').toLowerCase() === animName.toLowerCase() && r.direction === 'south')
  if (!anim) {
    console.log(`✗ ${id}: '${animName}' south 없음`)
    continue
  }
  const rowIdx = meta.rows.indexOf(anim)
  const layers = []
  for (let c = 0; c < COLS; c++) {
    const col = Math.min(anim.frame_count - 1, c + 1)
    let cell = await clearBackdrop(await sharp(buf).extract({ left: col * inCell, top: rowIdx * inCell, width: inCell, height: inCell }).png().toBuffer())
    let size = inCell
    if (inCell < 80) {
      size = Math.round(inCell * 1.5)
      cell = await sharp(cell).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
    }
    if (size > CELL) {
      const cut = Math.round((size - CELL) / 2)
      cell = await sharp(cell).extract({ left: cut, top: cut, width: CELL, height: CELL }).png().toBuffer()
      size = CELL
    }
    const off = Math.round((CELL - size) / 2)
    layers.push({ input: cell, left: c * CELL + off, top: off })
  }
  await sharp({ create: { width: CELL * COLS, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(path.join(OUT, `${id}.png`))
  console.log(`✓ ${id}`)
}
