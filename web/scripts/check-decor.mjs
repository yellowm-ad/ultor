// 꾸미기 소품이 기존 충돌 사각형·포탈·출발점과 겹치는지 검사 — 겹치면 목록을 출력한다.
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/check-decor.mjs
import { MAPS } from '@/lib/maps'
import { TOWN_DECOR } from '@/lib/town-decor'
import { propAABB } from '@/lib/iso'
let bad = 0
for (const id of Object.keys(TOWN_DECOR)) {
  const m = MAPS[id]
  if (!m) { console.log('맵 없음', id); continue }
  const decor = (m.props ?? []).filter((p) => p.id.startsWith('dc-'))
  const others = (m.props ?? []).filter((p) => !p.id.startsWith('dc-') && (p.solid) && (p.size || p.collide)).map((p) => ({ id: p.id, b: propAABB(p) }))
  for (const d of decor) {
    const b = propAABB(d)
    const hit = d.solid ? others.filter((o) => o.b && b.x0 < o.b.x1 - 0.15 && b.x1 > o.b.x0 + 0.15 && b.y0 < o.b.y1 - 0.15 && b.y1 > o.b.y0 + 0.15).map((o) => o.id) : []
    const near = [...m.portals.map((p) => [p.id, p.cell]), ['spawn', m.spawn]].filter(([, c]) => d.solid && Math.hypot(c.x - d.cell.x, c.y - d.cell.y) < 1.6).map(([n]) => n)
    const out = d.cell.x < 0.5 || d.cell.y < 0.5 || d.cell.x > m.grid.w - 0.5 || d.cell.y > m.grid.h - 0.5
    if (hit.length || near.length || out) { bad++; console.log(id, d.id, `${d.cell.x},${d.cell.y}`, hit.length ? '겹침: ' + hit.join(',') : '', near.length ? '포탈 근처: ' + near.join(',') : '', out ? '맵 밖' : '') }
  }
  console.log(id, 'decor', decor.length)
}
console.log(bad ? `문제 ${bad}건` : '문제 없음')
