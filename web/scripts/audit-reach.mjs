// 도달성 감사(2026-10-18) — 맵마다 '들어올 수 있는 모든 자리'(spawn + 다른 맵 포탈의 toSpawn)에서 걸어서 닿는 곳을 채우고,
// 거기서 포탈 · NPC · 채집 지점 · 놀이 지점 · 상호작용 소품에 닿지 못하는 경우를 찾는다.
//   · 도착 자리가 막힘 / 도착 자리가 마법진 안(PORTAL_STEP_R) / 마법진이 벽·가구에 덮임(원판 반지름 안 막힘 비율)
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/audit-reach.mjs [mapId]
import { MAPS } from '@/lib/maps'
import { NPCS } from '@/lib/mock-data'
import { groundBlocked } from '@/lib/collision'
import { gatherNodesForMap } from '@/lib/life'
import { spotsOnMap } from '@/lib/activity-spots'

const R = 0.24 // 플레이어 충돌 반경(게임 blockedAt 과 같은 여유)
const only = process.argv[2]
const S = 4 // 1/4 칸 격자
let problems = 0

// 맵별 도착 지점 모으기
const arrivals = {}
for (const m of Object.values(MAPS)) {
  ;(arrivals[m.id] ??= []).push({ from: 'spawn', at: m.spawn })
  for (const p of m.portals) {
    const dest = MAPS[p.to]
    if (!dest) continue
    if (p.walkArea) continue
    ;(arrivals[p.to] ??= []).push({ from: `${m.id}:${p.id}`, at: p.toSpawn ?? dest.spawn })
  }
}

for (const [id, m] of Object.entries(MAPS)) {
  if (only && id !== only) continue
  if (id === 'testroom') continue
  const { w, h } = m.grid
  const bl = m.blockers ?? []
  const blocked = (x, y) => x < 0.2 || y < 0.2 || x > w - 0.2 || y > h - 0.2 || bl.some((r) => x > r.x0 - R && x < r.x1 + R && y > r.y0 - R && y < r.y1 + R) || groundBlocked(m, x, y)
  const GW = Math.ceil(w * S)
  const GH = Math.ceil(h * S)
  const seen = new Uint8Array(GW * GH)
  const flags = []
  const q = []
  for (const a of arrivals[id] ?? []) {
    if (blocked(a.at.x, a.at.y)) {
      flags.push(`도착 자리 막힘(${a.from} → ${a.at.x.toFixed(1)},${a.at.y.toFixed(1)})`)
      continue
    }
    const inCircle = m.portals.find((p) => !p.walkArea && !p.secret && Math.hypot(p.cell.x - a.at.x, p.cell.y - a.at.y) < 0.6)
    if (inCircle && a.from !== 'spawn') flags.push(`도착 자리가 마법진 위(${a.from} → ${inCircle.id})`)
    const gx = Math.floor(a.at.x * S)
    const gy = Math.floor(a.at.y * S)
    if (!seen[gy * GW + gx]) {
      seen[gy * GW + gx] = 1
      q.push(gx, gy)
    }
  }
  while (q.length) {
    const cy = q.pop()
    const cx = q.pop()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || seen[ny * GW + nx]) continue
      if (blocked((nx + 0.5) / S, (ny + 0.5) / S)) continue
      seen[ny * GW + nx] = 1
      q.push(nx, ny)
    }
  }
  /** c 에서 반경 r 안에 닿는 칸이 있나 */
  const reach = (c, r) => {
    const k = Math.ceil(r * S)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -k; dx <= k; dx++) {
        if (dx * dx + dy * dy > r * r * S * S) continue
        const x = Math.floor(c.x * S) + dx
        const y = Math.floor(c.y * S) + dy
        if (x >= 0 && y >= 0 && x < GW && y < GH && seen[y * GW + x]) return true
      }
    return false
  }
  for (const p of m.portals) {
    if (p.walkArea) continue
    // 마법진은 밟아야(0.6) 넘어간다. 숨은 통로는 1.3 안에서 E
    if (!reach(p.cell, p.secret ? 1.2 : 0.55)) flags.push(`못 밟는 포탈 ${p.id}`)
    if (!p.secret && p.kind !== 'gate') {
      // 원판 둘레가 벽·가구에 얼마나 덮이나(그림이 가려져 보임)
      let n = 0
      let b = 0
      for (let a = 0; a < 360; a += 15) {
        const x = p.cell.x + Math.cos((a * Math.PI) / 180) * 0.85
        const y = p.cell.y + Math.sin((a * Math.PI) / 180) * 0.85
        n++
        if (bl.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)) b++
      }
      if (b / n > 0.34) flags.push(`마법진이 가구·벽에 ${Math.round((b / n) * 100)}% 덮임 ${p.id}`)
    }
  }
  const zoneIds = new Set(m.zones.map((z) => z.id))
  for (const n of NPCS) {
    if (!zoneIds.has(n.zoneId)) continue
    if (!reach(n.cell, 1.4)) flags.push(`말 못 거는 NPC ${n.id}@${n.cell.x},${n.cell.y}`)
  }
  for (const g of gatherNodesForMap(m)) if (!reach(g.cell, 1.2)) flags.push(`못 가는 채집 ${g.key}`)
  for (const sp of spotsOnMap(id)) if (!reach(sp.cell, 1.4)) flags.push(`못 가는 놀이 지점 ${sp.id}`)
  for (const p of m.props ?? []) if (p.label && p.solid && !reach(p.cell, Math.max(p.size?.w ?? 0, p.size?.d ?? 0) / 2 + 1.4)) flags.push(`못 가는 이름표 소품 ${p.id}`)
  if (flags.length) {
    problems += flags.length
    console.log(`■ ${id} (${m.name})`)
    for (const f of flags) console.log('   - ' + f)
  }
}
console.log(problems ? `\n문제 ${problems}건` : '문제 없음')
