// 수업 장면 배우(교수 강의 · 학생 경청) 시트 조립 — PixelLab 캐릭터 spritesheet export 에서
// 지정한 애니메이션(Lecture/Listen) 한 방향 8프레임 + 8방향 회전을 뽑아 게임용 시트로 만든다.
//
// 입력: scripts/_pixellab/class-actors.txt  ("<id>\t<charId>\t<animName>\t<direction>")
// 출력: public/images/class/<id>.png   96px 셀 · 8열 × 2행
//   row 0 = 애니메이션 8프레임(참조 프레임 0 제외, 프레임 1~8)
//   row 1 = 8방향 회전(south, south-east, east, north-east, north, north-west, west, south-west)
//
// node scripts/_pixellab/build-class-sheets.mjs [--refetch] [id ...]
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LIST = path.join(__dirname, 'class-actors.txt')
const CACHE = path.join(__dirname, 'class-sheets')
const OUT = path.join(__dirname, '..', '..', 'public', 'images', 'class')
const TOKEN = process.env.PIXELLAB_TOKEN || 'b8429f49-152d-480c-afc7-451eb5033691'
const API = 'https://api.pixellab.ai/mcp/characters'
const CELL = 96
const COLS = 8

const args = process.argv.slice(2)
const refetch = args.includes('--refetch')
const only = args.filter((a) => !a.startsWith('--'))
fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })

const rows = fs
  .readFileSync(LIST, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('\t'))
  .filter(([id]) => !only.length || only.includes(id))

/**
 * 애니 프레임에 불투명 배경판이 붙어 나오는 경우(PixelLab v3 가끔) — 네 모서리 색과 같은(±18) 픽셀을
 * 가장자리에서부터 flood-fill 로 투명 처리. 모서리가 이미 투명이면 그대로.
 */
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

for (const [id, charId, animName, dir] of rows) {
  const dirPath = path.join(CACHE, id)
  if (refetch || !fs.existsSync(dirPath) || !fs.readdirSync(dirPath).some((f) => f.endsWith('.json'))) {
    fs.rmSync(dirPath, { recursive: true, force: true })
    fs.mkdirSync(dirPath, { recursive: true })
    const zip = path.join(dirPath, '_sheet.zip')
    execFileSync('curl', ['-sS', '-f', '-L', '--max-time', '90', '-H', `Authorization: Bearer ${TOKEN}`, '-o', zip, `${API}/${charId}/spritesheet`], { stdio: ['ignore', 'ignore', 'inherit'] })
    execFileSync('unzip', ['-o', '-q', zip, '-d', dirPath])
    fs.rmSync(zip)
  }
  const json = fs.readdirSync(dirPath).find((f) => f.endsWith('.json'))
  const png = fs.readdirSync(dirPath).find((f) => f.endsWith('.png'))
  const meta = JSON.parse(fs.readFileSync(path.join(dirPath, json), 'utf8')).spritesheet
  const inCell = meta.cell_size.width
  const buf = await sharp(path.join(dirPath, png)).toBuffer()
  const rot = meta.rows.find((r) => r.type === 'rotations')
  // 같은 이름 애니가 여럿이면 마지막(가장 최근) 것
  const anim = [...meta.rows].reverse().find((r) => r.type === 'animation' && String(r.animation || '').toLowerCase() === animName.toLowerCase() && r.direction === dir)
  if (!anim) {
    console.log(`✗ ${id}: '${animName}' ${dir} 애니 없음 (rows: ${meta.rows.map((r) => `${r.animation || r.type}:${r.direction || ''}`).join(', ')})`)
    continue
  }
  const grab = async (rowIdx, col) => {
    let cell = await clearBackdrop(await sharp(buf).extract({ left: col * inCell, top: rowIdx * inCell, width: inCell, height: inCell }).png().toBuffer())
    // 마을 NPC 출신(48px 캐릭터, 56~64 셀)은 학생(64px 캐릭터)보다 작다 → 1.5배 nearest 확대
    let size = inCell
    if (inCell < 80) {
      size = Math.round(inCell * 1.5)
      cell = await sharp(cell).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
    }
    // 96 셀 가운데에(넘치면 잘라서) 얹는다
    if (size <= CELL) return { buf: cell, off: Math.round((CELL - size) / 2) }
    if (size !== inCell) {
      const cut = Math.round((size - CELL) / 2)
      return { buf: await sharp(cell).extract({ left: cut, top: cut, width: CELL, height: CELL }).toBuffer(), off: 0 }
    }
    const cut = Math.round((inCell - CELL) / 2)
    return { buf: await sharp(cell).extract({ left: cut, top: cut, width: CELL, height: CELL }).toBuffer(), off: 0 }
  }
  const layers = []
  const animRowIdx = meta.rows.indexOf(anim)
  const frames = anim.frame_count
  for (let c = 0; c < COLS; c++) {
    const src = Math.min(frames - 1, c + 1) // 프레임 0 = 참조(정지)
    const g = await grab(animRowIdx, src)
    layers.push({ input: g.buf, left: c * CELL + g.off, top: g.off })
  }
  const rotIdx = meta.rows.indexOf(rot)
  for (let c = 0; c < COLS; c++) {
    const g = await grab(rotIdx, c)
    layers.push({ input: g.buf, left: c * CELL + g.off, top: CELL + g.off })
  }
  await sharp({ create: { width: COLS * CELL, height: 2 * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, `${id}.png`))
  console.log(`✓ ${id}.png  (${animName} ${dir}, src ${inCell}px)`)
}
