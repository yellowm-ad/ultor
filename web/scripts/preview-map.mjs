// 맵 전체 미리보기 — lib/maps.ts 의 맵을 한 장의 PNG 로 그린다(지면은 타일 평균색, 프롭은 실제 그림 · 깊이정렬 동일).
// 코드 투영 구조물(벽·회랑)·물 표현·NPC 는 그리지 않는다. 배치를 한눈에 확인하는 용도.
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/preview-map.mjs <mapId> <out.png> [x0,y0,x1,y1 셀 범위] [배율]
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { MAPS } from '@/lib/maps'
import { TILE_SPRITES, TILE_COLORS, isoToScreen } from '@/lib/iso'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const [mapId, out, rangeS, scaleS] = process.argv.slice(2)
const map = MAPS[mapId]
if (!map) throw new Error('맵 없음: ' + mapId + ' — ' + Object.keys(MAPS).join(', '))
const { w: W, h: H } = map.grid
const [cx0, cy0, cx1, cy1] = rangeS && rangeS !== '-' ? rangeS.split(',').map(Number) : [0, 0, W, H]
const scale = Number(scaleS ?? 1)

// 화면 범위(셀 범위의 네 꼭짓점) + 위쪽 여백(키 큰 건물)
const corners = [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].map(([x, y]) => isoToScreen(x, y))
const PAD_T = 260, PAD = 40
const minX = Math.floor(Math.min(...corners.map((c) => c.sx))) - PAD
const maxX = Math.ceil(Math.max(...corners.map((c) => c.sx))) + PAD
const minY = Math.floor(Math.min(...corners.map((c) => c.sy))) - PAD_T
const maxY = Math.ceil(Math.max(...corners.map((c) => c.sy))) + PAD
const OW = maxX - minX, OH = maxY - minY

// 타일 종류별 평균색
const colorCache = new Map()
async function tileColor(k) {
  if (colorCache.has(k)) return colorCache.get(k)
  let c = [90, 110, 80]
  const sp = TILE_SPRITES[k]
  const f = sp && path.join(WEB, 'public', sp)
  if (f && fs.existsSync(f)) {
    const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++ }
    if (n) c = [r / n, g / n, b / n]
  } else if (TILE_COLORS[k]) {
    const m = /^#(..)(..)(..)/.exec(TILE_COLORS[k].top)
    if (m) c = m.slice(1).map((h) => parseInt(h, 16))
  }
  colorCache.set(k, c)
  return c
}
const kinds = new Set()
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) kinds.add(map.tileAt ? map.tileAt(x + 0.5, y + 0.5) : 'grass')
for (const k of kinds) await tileColor(k)

const buf = Buffer.alloc(OW * OH * 4)
for (let py = 0; py < OH; py++) {
  for (let px = 0; px < OW; px++) {
    const sx = px + minX, sy = py + minY
    const cx = (sy / 16 + sx / 32) / 2, cy = (sy / 16 - sx / 32) / 2
    const i = (py * OW + px) * 4
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) { buf[i] = 24; buf[i + 1] = 22; buf[i + 2] = 20; buf[i + 3] = 255; continue }
    let k = map.tileAt ? map.tileAt(cx, cy) : 'grass'
    if (map.water?.at && map.water.at(cx, cy)) k = 'water'
    const c = colorCache.get(k) ?? (await tileColor(k))
    // 칸 경계를 살짝 어둡게 — 좌표 읽기용 격자(5칸마다 진하게)
    const fx = cx - Math.floor(cx), fy = cy - Math.floor(cy)
    const edge = fx < 0.04 || fy < 0.04
    const major = (edge && fx < 0.04 && Math.floor(cx) % 5 === 0) || (edge && fy < 0.04 && Math.floor(cy) % 5 === 0)
    const d = major ? 0.72 : edge ? 0.93 : 1
    buf[i] = c[0] * d; buf[i + 1] = c[1] * d; buf[i + 2] = c[2] * d; buf[i + 3] = 255
  }
}

const list = []
for (const p of map.props ?? []) {
  if (!p.sprite) continue
  const f = path.join(WEB, 'public', p.sprite)
  if (!fs.existsSync(f)) { console.log('그림 없음', p.id, p.sprite); continue }
  const half = p.radial ? 0 : ((p.size?.w ?? 0.4) + (p.size?.d ?? 0.4)) / 2
  list.push({ p, f, sortY: p.backdrop ? -1e6 : p.cell.x + p.cell.y + half })
}
list.sort((a, b) => a.sortY - b.sortY)
const comp = []
for (const { p, f } of list) {
  const meta = await sharp(f).metadata()
  const w = p.px?.w ?? meta.width, h = p.px?.h ?? meta.height
  const ax = p.anchor?.x ?? w / 2, ay = p.anchor?.y ?? h
  const s = isoToScreen(p.cell.x, p.cell.y)
  let img = sharp(f).resize(Math.round(w), Math.round(h), { kernel: 'nearest', fit: 'fill' })
  const mirror = (p.facing === 'left' && p.kind !== 'wall') || p.mirrorX
  if (mirror) img = img.flop()
  let left = Math.round(s.sx - (mirror ? w - ax : ax) - minX), top = Math.round(s.sy - (p.elev ?? 0) - ay - minY)
  if (left >= OW || top >= OH || left + w <= 0 || top + h <= 0) continue
  // 화면 밖으로 걸치는 그림은 잘라서 붙인다
  const ex = { left: Math.max(0, -left), top: Math.max(0, -top) }
  ex.width = Math.min(Math.round(w) - ex.left, OW - Math.max(0, left))
  ex.height = Math.min(Math.round(h) - ex.top, OH - Math.max(0, top))
  if (ex.width <= 0 || ex.height <= 0) continue
  comp.push({ input: await sharp(await img.png().toBuffer()).extract(ex).png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top) })
}
// 좌표 눈금(5칸마다 숫자) — 편집할 셀을 읽기 쉽게
const labels = []
for (let x = 0; x <= W; x += 5) for (let y = 0; y <= H; y += 5) {
  if (x < cx0 - 1 || x > cx1 + 1 || y < cy0 - 1 || y > cy1 + 1) continue
  const s = isoToScreen(x, y)
  labels.push(`<text x="${s.sx - minX}" y="${s.sy - minY + 4}" font-size="11" font-family="monospace" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${x},${y}</text>`)
}
comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">${labels.join('')}</svg>`), left: 0, top: 0 })

let img = sharp(buf, { raw: { width: OW, height: OH, channels: 4 } }).composite(comp).png()
if (scale !== 1) img = sharp(await img.toBuffer()).resize(Math.round(OW * scale), null, { kernel: scale < 1 ? 'lanczos3' : 'nearest' }).png()
await img.toFile(out)
console.log(out, `${Math.round(OW * scale)}x${Math.round(OH * scale)}`, 'props', list.length)
