// 마을 꾸미기 초안 뽑기 — 맵의 빈자리를 찾아 소품을 규칙대로 흩어 놓고 lib/town-decor.ts 에 붙일 목록을 출력한다.
// (초안일 뿐 — 미리보기로 보고 손으로 고친다)
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/scatter-decor.mjs <mapId> <spec.json>
//   spec: { seed, road:[타일…], ground:[타일…], center:[x,y], radius, groups:[{ items:[그림…], gap, near:'road'|'any', nearDist, edge }] }
//     gap = 다른 것(기존 프롭·충돌·이미 놓은 것)과 띄울 거리(셀), items 는 한 번씩만 놓는다
import fs from 'node:fs'
import { MAPS } from '@/lib/maps'
import { mulberry32 } from '@/lib/rng'

const [mapId, specFile] = process.argv.slice(2)
const map = MAPS[mapId]
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'))
const rand = mulberry32(spec.seed ?? 1)
const { w: W, h: H } = map.grid
const road = new Set(spec.road ?? [])
const ground = new Set(spec.ground ?? [])
const tile = (x, y) => map.tileAt(x, y)
const isRoad = (x, y) => road.has(tile(x, y))
const isGround = (x, y) => ground.has(tile(x, y)) && !(map.water?.at && map.water.at(x, y))

const taken = [] // {x,y,r}
for (const p of map.props ?? []) taken.push({ x: p.cell.x + (p.radial ? 0 : (p.size?.w ?? 0) / 2), y: p.cell.y + (p.radial ? 0 : (p.size?.d ?? 0) / 2), r: Math.max(p.size?.w ?? 0.5, p.size?.d ?? 0.5) / 2 })
const boxes = map.blockers ?? []
const portals = map.portals.map((p) => p.cell).concat([map.spawn])

function free(x, y, gap) {
  if (x < 2 || y < 2 || x > W - 2 || y > H - 2) return false
  if (boxes.some((b) => x > b.x0 - gap && x < b.x1 + gap && y > b.y0 - gap && y < b.y1 + gap)) return false
  if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + gap)) return false
  if (portals.some((c) => Math.hypot(c.x - x, c.y - y) < 2.5 + gap)) return false
  return true
}
/** 둘레 (2gap+1)칸이 전부 설 수 있는 바닥인가 / 길에 닿는가 */
function footprintOk(x, y, gap, allowRoad) {
  for (let dx = -gap; dx <= gap; dx += 0.5) for (let dy = -gap; dy <= gap; dy += 0.5) {
    if (!isGround(x + dx, y + dy) && !(allowRoad && isRoad(x + dx, y + dy))) return false
    if (!allowRoad && isRoad(x + dx, y + dy)) return false
  }
  return true
}
function roadDist(x, y, max) {
  for (let d = 0.5; d <= max; d += 0.5) for (let a = 0; a < 8; a++) {
    const th = (a / 8) * Math.PI * 2
    if (isRoad(x + Math.cos(th) * d, y + Math.sin(th) * d)) return d
  }
  return Infinity
}

const out = []
for (const g of spec.groups) {
  const gap = g.gap ?? 1
  for (const name of g.items) {
    let placed = false
    for (let t = 0; t < 4000 && !placed; t++) {
      const ang = rand() * Math.PI * 2
      const rr = Math.sqrt(rand()) * (g.radius ?? spec.radius)
      const x = Math.round((spec.center[0] + Math.cos(ang) * rr) * 5) / 5
      const y = Math.round((spec.center[1] + Math.sin(ang) * rr) * 5) / 5
      if ((g.minR ?? 0) > rr) continue
      if (!free(x, y, gap)) continue
      if (!footprintOk(x, y, Math.min(gap, g.foot ?? gap), !!g.onRoad)) continue
      if (g.near === 'road') {
        const d = roadDist(x, y, g.nearDist ?? 2)
        if (d > (g.nearDist ?? 2)) continue
      }
      taken.push({ x, y, r: gap * 0.75 })
      out.push(`  ['${name}', ${x}, ${y}${g.walk ? ', W' : ''}],`)
      placed = true
    }
    if (!placed) console.error('자리 없음', name)
  }
}
console.log(out.join('\n'))
