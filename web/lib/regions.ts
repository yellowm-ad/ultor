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
    maps: ['village', 'village-archive', 'school-hall', 'academy-2f', 'class-fire', 'class-ice', 'class-earth', 'grand-auditorium', 'headmaster-office', 'academy-library', 'academy-3f', 'academy-4f', 'academy-secret', 'class-year2', 'class-year3', 'class-year4', 'class-dark', 'class-light', 'practice-lab', 'practice-lab-adv', 'council-room', 'lab-fire', 'lab-ice', 'lab-earth', 'lab-dark', 'lab-light', 'personal-space', 'testroom'],
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
    description: 'CH1 무대. 숲 → 깊은 숲 → 고목숲(갈림길: 이끼 동굴·안개 늪지). 가시어미 변이체와 고대목 골렘, 첫 봉인의 흔적.',
  },
  {
    id: 'COAST',
    name: '바다 해안 · 아틀란티스',
    maps: ['sea', 'sea-2', 'sea-3', 'deepsea', 'sea-cave', 'atlantis', 'atlantis-temple', 'atlantis-crypt'],
    recommendedLevel: 3,
    contentProfile: { gather: 3, hunt: 3, fish: 5, craft: 2, alchemy: 3, explore: 5, story: 4 },
    description: "CH2 무대. 폐등대·해저 유적·심해, 해파리 여왕과 암초왕. '모르스'라는 이름이 '마왕'으로 기록된 채 처음 등장.",
  },
  {
    id: 'STORMHAVEN',
    name: '스톰헤이븐 · 천공 신전',
    maps: ['stormhaven', 'stormhaven-2', 'stormhaven-3', 'cloud-rift', 'thunder-spire', 'sky-temple', 'sky-sanctum'],
    recommendedLevel: 7,
    contentProfile: { gather: 2, hunt: 3, fish: 1, craft: 4, alchemy: 2, explore: 5, story: 5 },
    description: "CH3 무대. 폭풍 위 하늘 도시와 천공 신전, 성녀와 '네 개로 나뉜 왕의 마음'의 기록.",
  },
  {
    id: 'RUINS',
    name: '버려진 폐허',
    maps: ['ruins', 'ruins-2', 'ruins-3', 'graveyard', 'catacomb', 'temple-ruin', 'ruin-sanctum'],
    recommendedLevel: 10,
    contentProfile: { gather: 2, hunt: 4, fish: 1, craft: 4, alchemy: 3, explore: 5, story: 5 },
    description: "CH4 무대. 언데드가 기억하는 인마대전, 버려진 신전의 '노' 봉인 — 폭주한 루스벨.",
  },
  {
    id: 'SNOWFIELD',
    name: '루미나 설원',
    maps: ['snowfield', 'snowfield-2', 'snowfield-3', 'ice-cave', 'frozen-lake', 'aurora-village', 'aurora-sanctum'],
    recommendedLevel: 15,
    contentProfile: { gather: 4, hunt: 5, fish: 3, craft: 4, alchemy: 2, explore: 3, story: 4 },
    description: 'CH5 무대. 루스벨의 화염으로 녹아내리는 설원, 유실 문자의 석비, 오로라 마을.',
  },
  {
    id: 'VOLCANO',
    name: '화산지대',
    maps: ['volcano', 'volcano-2', 'volcano-3', 'mine', 'lava-cave', 'demon-village', 'demon-temple'],
    recommendedLevel: 20,
    contentProfile: { gather: 5, hunt: 5, fish: 1, craft: 5, alchemy: 5, explore: 3, story: 4 },
    description: "CH6 무대. 인간 사회에서 밀려난 마물들의 땅. 모르스가 '애'의 인격으로 살아가는 곳.",
  },
  {
    id: 'MORS',
    name: '모르스의 성',
    maps: ['demon-castle'],
    recommendedLevel: 32,
    contentProfile: { gather: 1, hunt: 2, fish: 1, craft: 1, alchemy: 1, explore: 2, story: 5 },
    description: '최종장. 모르스는 필드에서 싸울 수 없다 — 4학년 2학기 엔딩 조건에 따른 최종전에서만 만난다.',
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
