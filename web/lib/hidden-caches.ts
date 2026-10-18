// ============================================================================
// 숨은 룬 상자(2026-10-18) — 야생 맵마다 1~2개, 걸어서 닿는 곳에만 고정 배치. 평소엔 안 보이고(바로 옆에서만 희미하게),
// 탐사 마법 「등불」을 켜면 멀리서도 빛기둥으로 드러난다. 저장마다 한 번씩만 열린다(storyFlags `cache:<key>`).
// 스타듀밸리·테라리아처럼 '돌아다니면 뭔가 있다'는 발견의 보상 — 등불 마법을 쓸 이유가 된다.
// 화면: components/game/iso-world(그림) · world-screen(E 로 열기) · 처리: lib/game-state OPEN_CACHE
// ============================================================================

import type { GameMap, GameState, MapId } from '@/lib/types'
import { gatherNodesForMap, walkableFrom } from '@/lib/life'
import { mulberry32 } from '@/lib/rng'

export interface HiddenCache {
  key: string
  mapId: MapId
  cell: { x: number; y: number }
}

/** 이만큼 가까우면 등불 없이도 희미하게 보이고 E 로 열 수 있다 */
export const CACHE_NEAR = 1.7

const cache = new Map<MapId, HiddenCache[]>()

export function cachesForMap(map: GameMap): HiddenCache[] {
  const hit = cache.get(map.id)
  if (hit) return hit
  if (map.kind !== 'field' || map.id === 'testroom') {
    cache.set(map.id, [])
    return []
  }
  let h = 90210
  for (let i = 0; i < map.id.length; i++) h = (h * 31 + map.id.charCodeAt(i)) | 0
  const rand = mulberry32(h >>> 0)
  const want = map.grid.w * map.grid.h >= 900 ? 2 : 1
  const reach = walkableFrom(map)
  const nodes = gatherNodesForMap(map)
  const bl = map.blockers ?? []
  const out: HiddenCache[] = []
  for (let attempt = 0; attempt < 400 && out.length < want; attempt++) {
    const x = 2 + rand() * (map.grid.w - 4)
    const y = 2 + rand() * (map.grid.h - 4)
    if (!reach(x, y)) continue
    if (bl.some((b) => x > b.x0 - 0.7 && x < b.x1 + 0.7 && y > b.y0 - 0.7 && y < b.y1 + 0.7)) continue
    // 입구·포탈에서 멀리(찾아다니는 맛), 채집물·다른 상자와 겹치지 않게
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < 7) continue
    if (map.portals.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 5)) continue
    if (nodes.some((n) => Math.hypot(n.cell.x - x, n.cell.y - y) < 2.5)) continue
    if (out.some((c) => Math.hypot(c.cell.x - x, c.cell.y - y) < 8)) continue
    out.push({ key: `${map.id}:${out.length}`, mapId: map.id, cell: { x, y } })
  }
  cache.set(map.id, out)
  return out
}

export const cacheFlag = (key: string) => `cache:${key}`
export const isCacheOpened = (s: Pick<GameState, 'storyFlags'>, key: string) => !!s.storyFlags[cacheFlag(key)]

/** 상자 보상 — 맵 권장 레벨에 비례한 금화 + 상자마다 정해진 물약 한 가지 */
export function cacheReward(map: GameMap, key: string): { gold: number; itemId: string; qty: number } {
  const lv = map.recommendedLevel ?? 1
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) | 0
  const table = lv >= 30 ? ['potion-elixir', 'potion-invisible', 'potion-hp-l', 'candy-mana'] : lv >= 12 ? ['potion-invisible', 'potion-hp-m', 'potion-mp-m', 'candy-mana-s'] : ['potion-invisible', 'potion-hp-s', 'potion-mp-s', 'candy-mana-s']
  const itemId = table[Math.abs(h) % table.length]
  return { gold: 40 + lv * 12, itemId, qty: itemId === 'potion-elixir' || itemId === 'candy-mana' ? 1 : 2 }
}
