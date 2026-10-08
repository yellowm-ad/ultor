// ============================================================================
// 학교 동료 배치(2026-10-08) — 학교 동료(lib/companions SCHOOL_NPCS, homeRoom 이 있는 인원)가 매주 학교 안
// 자기 방(homeRoom) 또는 로비(중앙 홀 · 2층 회랑) 중 한 곳에 무작위로 서 있다. 다가가 E 로 대화(파티 합류도 가능).
//   · 같은 주·같은 세이브면 항상 같은 배치(주차 + playerSeed 시드) — 주가 바뀌면 다시 섞인다.
//   · 스토리상 자리를 비운 동료(폭주 후 도주한 루스벨 등)는 나오지 않는다.
//   · 대화용 NpcDef 는 lib/mock-data 가 SCHOOL_NPCS 로 만들어 npcById 에 등록한다(role 'companion').
// ============================================================================

import type { GameState, MapId } from '@/lib/types'
import { MAPS } from '@/lib/maps'
import { isCompanionAway, SCHOOL_NPCS } from '@/lib/companions'
import { stairElevation } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'
import type { NpcDef } from '@/lib/types'

/** 배회 반경(셀) — 제자리 근처를 천천히 걷다 멈췄다 한다(lib/field npcWanderState) */
export const ROSTER_ROAM = 0.9

/** 배회 계산용 NPC 모양 — 서 있는 자리를 배회 중심으로 */
export function rosterWanderNpc(spot: RosterSpot): NpcDef {
  return { id: `roster-${spot.npcId}`, name: '', role: 'companion', icon: '', zoneId: 'school-roster', cell: { x: spot.x, y: spot.y }, greeting: [], roam: ROSTER_ROAM }
}

export const SCHOOL_LOBBIES: MapId[] = ['school-hall', 'academy-2f']

export interface RosterSpot {
  npcId: string
  mapId: MapId
  x: number
  y: number
  /** 서 있는 방향(화면 기준) */
  facing: 'down' | 'left' | 'right'
}

type RosterState = Pick<GameState, 'calendar' | 'playerSeed' | 'storyFlags'>

/** 이 맵 안에서 사람이 서도 되는 칸인가 — 벽·가구·계단·포탈·뚫린 아트리움을 피한다 */
function freeCell(mapId: MapId, x: number, y: number, taken: RosterSpot[]): boolean {
  const map = MAPS[mapId]
  if (!map) return false
  const m = 0.5
  if ((map.blockers ?? []).some((b) => x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m)) return false
  if (map.tileAt && map.tileAt(x, y) === 'academy-void') return false
  if (stairElevation(map.stairs, x, y).stair) return false
  if (map.portals.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 2)) return false
  if (Math.hypot(map.spawn.x - x, map.spawn.y - y) < 1.5) return false
  return !taken.some((t) => t.mapId === mapId && Math.hypot(t.x - x, t.y - y) < 1.6)
}

let cacheKey = ''
let cache: RosterSpot[] = []

/** 이번 주 학교 동료 배치 전부 */
export function schoolRoster(state: RosterState): RosterSpot[] {
  const away = SCHOOL_NPCS.filter((d) => isCompanionAway(state, d)).map((d) => d.id)
  const key = `${state.calendar.globalWeek}|${state.playerSeed}|${away.join(',')}`
  if (key === cacheKey) return cache
  const rand = mulberry32((state.playerSeed ^ (state.calendar.globalWeek * 2654435761)) >>> 0)
  const out: RosterSpot[] = []
  for (const def of SCHOOL_NPCS) {
    if (!def.homeRoom || away.includes(def.id)) continue
    // 절반은 자기 방, 절반은 로비(중앙 홀 · 2층 회랑)
    const mapId = rand() < 0.5 ? def.homeRoom : SCHOOL_LOBBIES[Math.floor(rand() * SCHOOL_LOBBIES.length)]
    const map = MAPS[mapId]
    if (!map) continue
    for (let tries = 0; tries < 60; tries++) {
      const x = 1.5 + rand() * (map.grid.w - 3)
      const y = 1.5 + rand() * (map.grid.h - 3)
      if (!freeCell(mapId, x, y, out)) continue
      const f = rand()
      out.push({ npcId: def.id, mapId, x, y, facing: f < 0.25 ? 'left' : f < 0.5 ? 'right' : 'down' })
      break
    }
  }
  cacheKey = key
  cache = out
  return out
}

/** 지금 맵에 있는 학교 동료 — 수업 중인 교실에는 내보내지 않는다(학생 배우와 겹침) */
export function rosterOnMap(state: RosterState & Pick<GameState, 'currentMapId' | 'classScene'>): RosterSpot[] {
  if (state.classScene && state.classScene.room === state.currentMapId) return []
  return schoolRoster(state).filter((s) => s.mapId === state.currentMapId)
}
