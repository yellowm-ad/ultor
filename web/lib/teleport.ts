// ============================================================================
// 전체 지도 텔레포트(2026-10-07) — 미니맵 → 전체 지도에서 가 본 맵을 골라 그 맵 입구로 바로 이동한다.
//   · 대상: 한 번이라도 들어가 본 맵(GameState.visitedMaps) + 학교·마을 허브(옛 세이브도 바로 쓸 수 있게)
//   · 수업·전투·스토리 장면·낚시 중엔 막는다(진행 중인 장면이 끊기지 않게)
// ============================================================================

import type { GameState, MapId } from '@/lib/types'
import { MAPS } from '@/lib/maps'

/** 언제든 돌아갈 수 있는 허브 */
export const TELEPORT_HUBS: MapId[] = ['village', 'school-hall']

export function teleportTargets(state: Pick<GameState, 'visitedMaps' | 'currentMapId'>): Set<MapId> {
  const out = new Set<MapId>([...TELEPORT_HUBS, ...(state.visitedMaps ?? []), state.currentMapId])
  out.delete('testroom')
  return out
}

/** 텔레포트할 수 없는 이유(되면 null) */
export function teleportBlockReason(state: GameState, mapId: MapId): string | null {
  if (!MAPS[mapId]) return '알 수 없는 장소입니다.'
  if (mapId === state.currentMapId) return '이미 이곳에 있습니다.'
  if (state.classScene) return '수업 중에는 텔레포트할 수 없습니다.'
  if (state.battle) return '전투 중에는 텔레포트할 수 없습니다.'
  if (state.storyQueue.length > 0) return '이야기가 끝난 뒤에 이동할 수 있습니다.'
  if (state.fishing) return '낚시를 마친 뒤에 이동할 수 있습니다.'
  if (!teleportTargets(state).has(mapId)) return '한 번 가 본 곳으로만 텔레포트할 수 있습니다.'
  return null
}
