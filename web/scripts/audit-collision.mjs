// 충돌 감사 — 맵마다 반 칸 격자로 걸어 다닐 수 있는 곳을 채워 보고 문제를 찾는다.
//  · 물·바다·용암·허공 위를 걸을 수 있는 칸 수   · 출발점에서 갈 수 없는 포탈   · 출발점이 막힌 맵
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/audit-collision.mjs [mapId]
import { MAPS } from '@/lib/maps'
import { groundBlocked } from '@/lib/collision'
const R = 0.24
const only = process.argv[2]
const LIQ = new Set(['water', 'demon-lava', 'sea', 'canal', 'sky-void', 'void', 'deep-water', 'lava'])
for (const [id, m] of Object.entries(MAPS)) {
  if (only && id !== only) continue
  const { w, h } = m.grid
  const bl = m.blockers ?? []
  const blocked = (x, y) => x < 0.2 || y < 0.2 || x > w - 0.2 || y > h - 0.2 || bl.some((r) => x > r.x0 - R && x < r.x1 + R && y > r.y0 - R && y < r.y1 + R) || groundBlocked(m, x, y)
  const kindAt = (x, y) => m.water?.at(x, y) ?? (m.terrain ? m.terrain.at(x, y) : m.tileAt ? m.tileAt(x, y) : 'grass')
  const S = 2, GW = w * S, GH = h * S
  const seen = new Uint8Array(GW * GH)
  const q = []
  const sx = Math.floor(m.spawn.x * S), sy = Math.floor(m.spawn.y * S)
  const spawnBlocked = blocked(m.spawn.x, m.spawn.y)
  if (!spawnBlocked) { seen[sy * GW + sx] = 1; q.push(sx, sy) }
  const kinds = {}
  let reach = 0
  while (q.length) {
    const cy = q.pop(), cx = q.pop(); reach++
    const k = kindAt((cx + 0.5) / S, (cy + 0.5) / S)
    kinds[k] = (kinds[k] ?? 0) + 1
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || seen[ny * GW + nx]) continue
      if (blocked((nx + 0.5) / S, (ny + 0.5) / S)) continue
      seen[ny * GW + nx] = 1; q.push(nx, ny)
    }
  }
  const near = (c) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = Math.floor(c.x * S) + dx, y = Math.floor(c.y * S) + dy; if (x >= 0 && y >= 0 && x < GW && y < GH && seen[y * GW + x]) return true } return false }
  const lostPortals = m.portals.filter((p) => !near(p.cell)).map((p) => `${p.id}@${p.cell.x},${p.cell.y}`)
  const liquid = Object.entries(kinds).filter(([k]) => LIQ.has(k) || /water|sea|lava|void|canal/.test(k))
  const flags = []
  if (spawnBlocked) flags.push('출발점 막힘')
  if (lostPortals.length) flags.push('못 가는 포탈: ' + lostPortals.join(' '))
  if (liquid.length) flags.push('물·허공 위 통행: ' + liquid.map(([k, n]) => `${k}×${n}`).join(' '))
  const pct = Math.round((100 * reach) / (GW * GH))
  if (flags.length || process.env.ALL) console.log(`${id} [${m.kind ?? ''} ${w}x${h}] 통행 ${pct}% blockers ${bl.length} — ${flags.join(' | ') || 'OK'}`)
}
