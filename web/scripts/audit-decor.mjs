// 꾸미기 소품 점검 — 길 한가운데 놓인 것, 건물끼리 화면에서 겹치는 것, 맵 가장자리 밖으로 삐져나간 것을 찾는다.
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/audit-decor.mjs
import { MAPS } from '@/lib/maps'
import { TOWN_DECOR } from '@/lib/town-decor'
import { isoToScreen } from '@/lib/iso'

const ROAD = /road|path/
for (const id of Object.keys(TOWN_DECOR)) {
  const m = MAPS[id]
  if (!m?.tileAt) continue
  const decor = (m.props ?? []).filter((p) => p.id.startsWith('dc-'))
  const others = (m.props ?? []).filter((p) => !p.id.startsWith('dc-') && p.sprite && p.px)
  const box = (p) => {
    const s = isoToScreen(p.cell.x, p.cell.y)
    const ax = p.anchor?.x ?? p.px.w / 2, ay = p.anchor?.y ?? p.px.h
    return { x0: s.sx - ax, y0: s.sy - ay - (p.elev ?? 0), x1: s.sx - ax + p.px.w, y1: s.sy - ay + p.px.h - (p.elev ?? 0) }
  }
  const out = []
  for (const p of decor) {
    const { x, y } = p.cell
    const big = p.px.w >= 70
    // 길 위: 발밑 둘레 네 점이 전부 길이면 '길 한가운데'
    const r = big ? 1.2 : 0.7
    const onRoad = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dy]) => ROAD.test(m.tileAt(x + dx, y + dy)))
    if (onRoad && p.solid) out.push(`길 한가운데: ${p.id} (${x},${y})`)
    // 큰 것끼리 화면에서 60% 넘게 가림
    if (big) {
      const a = box(p)
      for (const q of [...decor, ...others]) {
        if (q === p || q.px.w < 70 || q.backdrop) continue
        const b = box(q)
        const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
        if (ix <= 0 || iy <= 0) continue
        const frac = (ix * iy) / ((a.x1 - a.x0) * (a.y1 - a.y0))
        // 앞에 있는 것(q)이 p 를 가리는 경우만
        if (frac > 0.6 && q.cell.x + q.cell.y > x + y) out.push(`가려짐 ${(frac * 100) | 0}%: ${p.id} (${x},${y}) ← ${q.id} (${q.cell.x},${q.cell.y})`)
      }
    }
  }
  console.log(id, decor.length, out.length ? '\n  ' + out.join('\n  ') : '— 이상 없음')
}
