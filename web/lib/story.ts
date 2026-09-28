// ============================================================================
// 스토리 골격 (§학사 PRD 9~28, 43~44, 62)
//
// ⚠ 스토리 라인은 아직 미확정 — 여기는 "그릇"만 있다. 실제 대사/사건은 STORY_BEATS 와
//   MAIN_QUEST_BY_WEEK(주차별 필수 퀘스트) 에 데이터로만 추가하면 코드 수정 없이 게임에 반영된다.
//
//   · StoryArc  : 장(chapter) 단위 — 시작/끝 주차, 무대 지역
//   · StoryBeat : 조건이 맞으면 딱 한 번 재생되는 사건(대사 묶음). 재생되면 `beat:<id>` 플래그가 켜져
//                 다시는 발생하지 않는다(§82-10). setFlags 로 다음 사건의 조건을 연다.
//   · 플래그     : GameState.storyFlags — 모든 스토리 진행은 플래그 기반(§82-4)
// ============================================================================

import type { GameState } from '@/lib/types'
import { globalWeekOf } from '@/lib/calendar'
import type { RegionId } from '@/lib/regions'

export interface StoryArc {
  id: string
  chapter: number // 0 = 최종장/후일담 등 번호 없는 장
  name: string
  startWeek: number
  endWeek: number
  mainRegion: RegionId
  description: string
}

// 학기/방학 배치는 PRD §10~28 그대로, 지역은 regions.ts 의 실제 맵 구성 기준으로 조정.
export const STORY_ARCS: StoryArc[] = [
  { id: 'CH1_ERDIA', chapter: 1, name: '입학 · 에르디아', startWeek: globalWeekOf(1, 'semester1', 1), endWeek: globalWeekOf(1, 'summer', 12), mainRegion: 'ERDIA', description: '입학, 삼원 교육, 가시어미 변이체 → 여름 에르디아 대원정 · 고대목 골렘.' },
  { id: 'CH2_COAST', chapter: 2, name: '바다 해안 · 심해', startWeek: globalWeekOf(1, 'semester2', 1), endWeek: globalWeekOf(2, 'summer', 12), mainRegion: 'COAST', description: '이상 해류 → 해안 원정(해파리 여왕) → 모르스의 인장 → 심해 암초왕.' },
  { id: 'CH3_SKY', chapter: 3, name: '스톰헤이븐 · 하늘 유적', startWeek: globalWeekOf(2, 'semester2', 1), endWeek: globalWeekOf(2, 'winter', 12), mainRegion: 'STORMHAVEN', description: '하늘의 이상 마력 → 천공 신전 · 버려진 폐허 → 석상 거인왕, 봉인 균열.' },
  { id: 'CH4_SNOWFIELD', chapter: 4, name: '루미나 설원', startWeek: globalWeekOf(3, 'semester1', 1), endWeek: globalWeekOf(3, 'summer', 12), mainRegion: 'SNOWFIELD', description: '쉬어가는 학기(축제·동아리) → 설원 원정, 적대적이지 않았던 마족의 기록.' },
  { id: 'CH5_VOLCANO', chapter: 5, name: '화산지대', startWeek: globalWeekOf(3, 'semester2', 1), endWeek: globalWeekOf(3, 'winter', 12), mainRegion: 'VOLCANO', description: '제작 중심 학기 → 화산 원정, 봉인의 핵심 매개체.' },
  { id: 'FINAL_TRUTH', chapter: 6, name: '진실', startWeek: globalWeekOf(4, 'semester1', 1), endWeek: globalWeekOf(4, 'summer', 12), mainRegion: 'ACADEMY', description: '모든 지역 재방문(회수 단계) → 최종 대원정.' },
  { id: 'FINAL_MORS', chapter: 7, name: '모르스', startWeek: globalWeekOf(4, 'semester2', 1), endWeek: globalWeekOf(4, 'semester2', 12), mainRegion: 'MORS', description: '봉인 붕괴 · 학교 방어전 · 최종전.' },
  { id: 'EPILOGUE', chapter: 0, name: '후일담', startWeek: globalWeekOf(4, 'winter', 1), endWeek: globalWeekOf(4, 'winter', 12), mainRegion: 'ACADEMY', description: '졸업식 · 동료 후일담 · 자유 이동(본편은 4학년 2학기에서 끝).' },
]

export function arcForWeek(globalWeek: number): StoryArc {
  return STORY_ARCS.find((a) => globalWeek >= a.startWeek && globalWeek <= a.endWeek) ?? STORY_ARCS[0]
}

// ── 주요 플래그 (§27 엔딩 플래그 포함) ──────────────────────────────────────────
// 문자열 오타 방지용 상수. 새 플래그는 자유롭게 문자열로 써도 동작한다.
export const FLAGS = {
  // 장 클리어
  ERDIA_CLEARED: 'ERDIA_CLEARED',
  COAST_CLEARED: 'COAST_CLEARED',
  SKY_CLEARED: 'SKY_CLEARED',
  SNOWFIELD_CLEARED: 'SNOWFIELD_CLEARED',
  VOLCANO_CLEARED: 'VOLCANO_CLEARED',
  /** 모르스 최종전 진입 조건(§26) — 이 플래그 전에는 storyBoss 가 나오지 않는다 */
  FINAL_GATE_OPEN: 'FINAL_GATE_OPEN',
  // 엔딩 분기(§27)
  DEMON_TRUST: 'DEMON_TRUST',
  ACADEMY_TRUST: 'ACADEMY_TRUST',
  SEAL_KNOWLEDGE: 'SEAL_KNOWLEDGE',
  MORS_DIALOGUE: 'MORS_DIALOGUE',
  ALLY_DEMON: 'ALLY_DEMON',
  ALLY_HUMAN: 'ALLY_HUMAN',
  SACRIFICE_FLAG: 'SACRIFICE_FLAG',
  PRESERVATION_FLAG: 'PRESERVATION_FLAG',
  /** 관리자/테스트 — 모든 생활 시스템 즉시 해금 */
  DEBUG_UNLOCK_ALL: 'DEBUG_UNLOCK_ALL',
} as const

// ── 스토리 비트 ─────────────────────────────────────────────────────────────────
export type StoryTrigger =
  | { type: 'WEEK_START'; week: number } // 해당 globalWeek 가 시작될 때
  | { type: 'WEEK_END'; week: number } // 해당 주를 마감할 때
  | { type: 'QUEST_CLAIMED'; templateId: string } // 특정 퀘스트 보상 수령 시
  | { type: 'VISIT'; mapId: string } // 특정 맵 첫 진입
  | { type: 'FLAG'; flag: string } // 플래그가 켜진 직후

export interface StoryLine {
  speaker: string // 화자 이름(또는 '' = 나레이션)
  /** 초상화 id(Portrait 컴포넌트) — NPC id 또는 동료 id */
  portraitId?: string
  text: string
}

export interface StoryBeat {
  id: string
  arcId: string
  title: string
  trigger: StoryTrigger
  requiredFlags?: string[]
  /** 재생 후 켜질 플래그 */
  setFlags?: string[]
  lines: StoryLine[]
}

/**
 * 실제 스토리 비트 — 스토리 라인 확정 후 여기에 추가.
 * 예시 1개만 둔다(입학식 나레이션). 지우거나 내용만 바꿔도 된다.
 */
export const STORY_BEATS: StoryBeat[] = [
  {
    id: 'Y1W01_ENROLL',
    arcId: 'CH1_ERDIA',
    title: '입학',
    trigger: { type: 'WEEK_START', week: 1 },
    setFlags: ['CH1_STARTED'],
    lines: [
      { speaker: '', text: '울토르 마법학교의 첫 주가 시작되었다. (스토리 초안 자리 — lib/story.ts 의 STORY_BEATS 에서 수정)' },
      { speaker: '미르엘 교수', portraitId: 'npc-job-trainer', text: '매주 학사 수첩(J)에서 이번 주 미션을 확인하렴. 필수 1개와 선택 2개를 끝내면 다음 주로 넘어갈 수 있단다.' },
    ],
  },
]

/**
 * 주차별 필수(MAIN) 퀘스트 — globalWeek → quests.ts 의 템플릿 id.
 * 비어 있는 주는 MAIN_FALLBACK_BY_TERM(학기/방학 기본 일과)로 채워진다.
 */
export const MAIN_QUEST_BY_WEEK: Record<number, string> = {}

export function flagOn(state: Pick<GameState, 'storyFlags'>, flag: string): boolean {
  const v = state.storyFlags[flag]
  return v === true || (typeof v === 'number' && v > 0)
}

export function flagsAllOn(state: Pick<GameState, 'storyFlags'>, flags: string[] | undefined): boolean {
  return !flags || flags.every((f) => flagOn(state, f))
}

/** 발생 조건을 만족하고 아직 재생되지 않은 비트들 */
export function beatsFor(state: Pick<GameState, 'storyFlags'>, match: (t: StoryTrigger) => boolean): StoryBeat[] {
  return STORY_BEATS.filter((b) => match(b.trigger) && !flagOn(state, `beat:${b.id}`) && flagsAllOn(state, b.requiredFlags))
}

export function beatById(id: string): StoryBeat | undefined {
  return STORY_BEATS.find((b) => b.id === id)
}
