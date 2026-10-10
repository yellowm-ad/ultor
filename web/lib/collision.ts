import type { GameMap } from '@/lib/types'
import { stairElevation } from '@/lib/iso'

/**
 * 발 디딜 수 없는 바닥 — 충돌 사각형(map.blockers)과 별개로, 바닥 종류만으로 막히는 곳.
 *  · 바다(물 지형 맵의 'sea') — 섬 밖으로 걸어 나가지 못하게
 *  · 용암 — 야생·마을 모두
 *  · 뚫린 곳(2층 아트리움·비밀 통로 바깥의 'academy-void')
 * 야생맵의 얕은 물·얼음은 물가로 보고 지나갈 수 있다(전투·채집 동선).
 */
export function groundBlocked(map: GameMap, x: number, y: number): boolean {
  if (map.water?.at(x, y) === 'sea') return true
  const t = map.tileAt?.(x, y)
  if (t === 'demon-lava') return true
  if (t === 'academy-void') {
    // 뚫린 곳 위로 놓인 계단과 그 끝의 포탈 자리는 밟을 수 있다
    if (stairElevation(map.stairs, x, y).stair) return false
    if (map.portals.some((p) => p.walkArea && x >= p.walkArea.x0 - 0.3 && x <= p.walkArea.x1 + 0.3 && y >= p.walkArea.y0 - 0.3 && y <= p.walkArea.y1 + 0.3)) return false
    return true
  }
  if (map.terrain && map.terrain.at(x, y) === 'demon-lava') return true
  return false
}
