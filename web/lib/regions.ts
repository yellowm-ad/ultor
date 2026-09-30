// ============================================================================
// 지역(region) 테이블 (§학사 PRD 50~51, 74)
//
// PRD 원문의 "스톰헤이븐 해"는 실제 게임 맵 구조에 맞춰 둘로 나눴다:
//   · COAST      — 바다 해안 · 아틀란티스 마을 · 심해   (항구/수중/낚시, 해파리 여왕 · 심해 암초왕)
//   · STORMHAVEN — 스톰헤이븐(하늘 도시) · 천공 신전     (PRD 3장 "하늘 유적"의 하늘 쪽)
//   · RUINS      — 버려진 폐허 · 묘지 · 버려진 신전      (PRD 3장 "하늘 유적"의 언데드/석상 쪽)
// 맵 하나는 반드시 한 지역에 속하고(regionOfMap), 퀘스트 생성·채집 테이블·낚시 테이블이 이 id 로 동작한다.
// contentProfile(1~5)은 UI에 노출하지 않는 퀘스트 생성 가중치용 내부 값(§74).
// ============================================================================

import type { MapId } from '@/lib/types'

export type RegionId = 'ACADEMY' | 'ERDIA' | 'COAST' | 'STORMHAVEN' | 'RUINS' | 'SNOWFIELD' | 'VOLCANO' | 'MORS'

export interface RegionDef {
  id: RegionId
  name: string
  maps: MapId[]
  recommendedLevel: number
  /** 퀘스트 생성기 가중치 보정 — 1(드묾) ~ 5(주력) */
  contentProfile: { gather: number; hunt: number; fish: number; craft: number; alchemy: number; explore: number; story: number }
  description: string
}

export const REGIONS: RegionDef[] = [
  {
    id: 'ACADEMY',
    name: '울토르 마법학교',
    maps: ['village', 'school-hall', 'academy-2f', 'class-fire', 'class-ice', 'class-earth', 'grand-auditorium', 'headmaster-office', 'academy-library', 'personal-space', 'testroom'],
    recommendedLevel: 1,
    contentProfile: { gather: 1, hunt: 1, fish: 1, craft: 4, alchemy: 3, explore: 2, story: 4 },
    description: '메인 허브. 수업·동아리·제작·하우징.',
  },
  {
    id: 'ERDIA',
    name: '에르디아 숲',
    maps: ['forest', 'forest-2', 'forest-3', 'cave', 'swamp'],
    recommendedLevel: 2,
    contentProfile: { gather: 5, hunt: 4, fish: 2, craft: 2, alchemy: 3, explore: 3, story: 5 },
    description: '1장 무대. 숲 → 깊은 숲 → 고목숲(갈림길: 이끼 동굴·안개 늪지). 가시어미와 고대목 골렘.',
  },
  {
    id: 'COAST',
    name: '바다 해안 · 아틀란티스',
    maps: ['sea', 'sea-2', 'sea-3', 'deepsea', 'sea-cave', 'atlantis', 'atlantis-temple'],
    recommendedLevel: 3,
    contentProfile: { gather: 3, hunt: 3, fish: 5, craft: 2, alchemy: 3, explore: 5, story: 4 },
    description: '2장 무대. 항구·해안·수중 탐험, 해파리 여왕과 심해 암초왕, 모르스의 인장.',
  },
  {
    id: 'STORMHAVEN',
    name: '스톰헤이븐 · 천공 신전',
    maps: ['stormhaven', 'stormhaven-2', 'stormhaven-3', 'cloud-rift', 'thunder-spire', 'sky-temple', 'sky-sanctum'],
    recommendedLevel: 7,
    contentProfile: { gather: 2, hunt: 3, fish: 1, craft: 4, alchemy: 2, explore: 5, story: 5 },
    description: '3장 전반. 폭풍 위 하늘 도시와 천공 신전, 하늘의 이상 마력 현상.',
  },
  {
    id: 'RUINS',
    name: '버려진 폐허',
    maps: ['ruins', 'ruins-2', 'ruins-3', 'graveyard', 'catacomb', 'temple-ruin', 'ruin-sanctum'],
    recommendedLevel: 10,
    contentProfile: { gather: 2, hunt: 4, fish: 1, craft: 4, alchemy: 3, explore: 5, story: 5 },
    description: '3장 후반. 언데드 마법사·석상 병사, 석상 거인왕과 봉인 균열.',
  },
  {
    id: 'SNOWFIELD',
    name: '루미나 설원',
    maps: ['snowfield', 'snowfield-2', 'snowfield-3', 'ice-cave', 'frozen-lake', 'aurora-village', 'aurora-sanctum'],
    recommendedLevel: 15,
    contentProfile: { gather: 4, hunt: 5, fish: 3, craft: 4, alchemy: 2, explore: 3, story: 4 },
    description: '4장 무대. 추위·사냥·가죽, 인간에게 적대적이지 않았던 마족의 기록.',
  },
  {
    id: 'VOLCANO',
    name: '화산지대',
    maps: ['volcano', 'volcano-2', 'volcano-3', 'mine', 'lava-cave', 'demon-village', 'demon-temple'],
    recommendedLevel: 20,
    contentProfile: { gather: 5, hunt: 5, fish: 1, craft: 5, alchemy: 5, explore: 3, story: 4 },
    description: '5장 무대. 광석·대장간·마도구, 봉인의 핵심 매개체.',
  },
  {
    id: 'MORS',
    name: '모르스의 성',
    maps: ['demon-castle'],
    recommendedLevel: 32,
    contentProfile: { gather: 1, hunt: 2, fish: 1, craft: 1, alchemy: 1, explore: 2, story: 5 },
    description: '최종장. 4학년 2학기 최종 조건 전에는 모르스와 싸울 수 없다.',
  },
]

const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]))
const REGION_BY_MAP = new Map<MapId, RegionId>(REGIONS.flatMap((r) => r.maps.map((m) => [m, r.id] as [MapId, RegionId])))

export function regionById(id: RegionId): RegionDef {
  return REGION_BY_ID.get(id)!
}

export function regionOfMap(mapId: MapId): RegionId {
  return REGION_BY_MAP.get(mapId) ?? 'ACADEMY'
}
