// ============================================================================
// 미니맵 연결도(2026-11-05) — 소울나이트식 '방 + 통로' 그래프. 야외 맵(마을·야생·마을 거점)을 고정 배치한다.
//   울토르 마을이 가운데. 북쪽 세 갈래(폐허·천공·설원), 남쪽 세 갈래(숲·화산·해안) — 지역마다 3단계 사슬 끝에서 갈래가 나뉜다.
//   좌표 단위 = 칸 한 개 간격. 연결은 lib/maps 포탈에서 뽑는다(여기는 자리와 색만).
// ============================================================================

import type { MapId } from '@/lib/types'
import type { RegionId } from '@/lib/regions'

export const GRAPH_POS: Partial<Record<MapId, { x: number; y: number }>> = {
  village: { x: 0, y: 0 },
  // 북 — 폐허
  ruins: { x: -3, y: -1.5 }, 'ruins-2': { x: -3, y: -2.5 }, 'ruins-3': { x: -3, y: -3.5 },
  'temple-ruin': { x: -3, y: -4.5 }, graveyard: { x: -4, y: -3.5 }, catacomb: { x: -2, y: -3.5 },
  // 북 — 천공
  stormhaven: { x: 0, y: -1.5 }, 'stormhaven-2': { x: 0, y: -2.5 }, 'stormhaven-3': { x: 0, y: -3.5 },
  'sky-temple': { x: 0, y: -4.5 }, 'cloud-rift': { x: -1, y: -3.5 }, 'thunder-spire': { x: 1, y: -3.5 }, 'sky-colosseum': { x: 1, y: -4.5 },
  // 북 — 설원
  snowfield: { x: 3, y: -1.5 }, 'snowfield-2': { x: 3, y: -2.5 }, 'snowfield-3': { x: 3, y: -3.5 },
  'aurora-village': { x: 3, y: -4.5 }, 'ice-cave': { x: 2, y: -3.5 }, 'frozen-lake': { x: 4, y: -3.5 },
  // 남 — 에르디아 숲
  forest: { x: -3, y: 1.5 }, 'forest-2': { x: -3, y: 2.5 }, 'forest-3': { x: -3, y: 3.5 },
  cave: { x: -4, y: 3.5 }, swamp: { x: -2, y: 3.5 },
  // 남 — 화산
  volcano: { x: 0, y: 1.5 }, 'volcano-2': { x: 0, y: 2.5 }, 'volcano-3': { x: 0, y: 3.5 },
  'demon-village': { x: 0, y: 4.5 }, mine: { x: -1, y: 3.5 }, 'lava-cave': { x: 1, y: 3.5 }, 'demon-castle': { x: 1, y: 4.5 },
  // 남 — 해안
  sea: { x: 3, y: 1.5 }, 'sea-2': { x: 3, y: 2.5 }, 'sea-3': { x: 3, y: 3.5 },
  atlantis: { x: 3, y: 4.5 }, deepsea: { x: 2, y: 3.5 }, 'sea-cave': { x: 4, y: 3.5 },
}

/** 지역별 통로·칸 색(참고 이미지처럼 갈래마다 다른 색) */
export const REGION_COLOR: Record<RegionId, string> = {
  ACADEMY: '#e8c46a',
  ERDIA: '#4fbf5a',
  COAST: '#3fc6d6',
  STORMHAVEN: '#a8d8ff',
  RUINS: '#a070e0',
  SNOWFIELD: '#d6ecff',
  VOLCANO: '#e5533a',
  MORS: '#b0202a',
}

/** 실내·작은 맵에서 연결도의 '지금 위치'로 쓸 야외 칸 — 포탈을 따라 가장 가까운 야외 맵(BFS, 결과 기억) */
const anchorCache = new Map<string, MapId | null>()
export function graphAnchor(mapId: MapId, maps: Partial<Record<MapId, { portals: { to: string }[] }>>): MapId | null {
  if (GRAPH_POS[mapId]) return mapId
  const hit = anchorCache.get(mapId)
  if (hit !== undefined) return hit
  const seen = new Set<string>([mapId])
  const queue: string[] = [mapId]
  let found: MapId | null = null
  while (queue.length && !found) {
    const cur = queue.shift()!
    for (const p of maps[cur as MapId]?.portals ?? []) {
      if (seen.has(p.to)) continue
      seen.add(p.to)
      if (GRAPH_POS[p.to as MapId]) {
        found = p.to as MapId
        break
      }
      queue.push(p.to)
    }
  }
  anchorCache.set(mapId, found)
  return found
}
