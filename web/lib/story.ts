// ============================================================================
// 스토리 골격 (§학사 PRD 9~28, 43~44, 62)
//
// 실제 대사/사건은 lib/story-script.ts(대화집 v1.0 초안) 와 MAIN_QUEST_BY_WEEK(주차별 필수 퀘스트) 에
//   데이터로만 추가하면 코드 수정 없이 게임에 반영된다.
//
//   · StoryArc  : 장(chapter) 단위 — 시작/끝 주차, 무대 지역
//   · StoryBeat : 조건이 맞으면 딱 한 번 재생되는 사건(대사 묶음). 재생되면 `beat:<id>` 플래그가 켜져
//                 다시는 발생하지 않는다(§82-10). setFlags 로 다음 사건의 조건을 연다.
//   · 플래그     : GameState.storyFlags — 모든 스토리 진행은 플래그 기반(§82-4)
// ============================================================================

import type { GameState } from '@/lib/types'
import { globalWeekOf } from '@/lib/calendar'
import type { RegionId } from '@/lib/regions'
import { SCRIPT_BEATS } from '@/lib/story-script'

export interface StoryArc {
  id: string
  chapter: number // 0 = 최종장/후일담 등 번호 없는 장
  name: string
  startWeek: number
  endWeek: number
  mainRegion: RegionId
  description: string
}

// 학기/방학 배치는 PRD §10~28, 장 구성은 「장기 스토리 대화집 v1.0」(2026-09-28) 기준.
// 해안(학교생활의 연장)과 스톰헤이븐(첫 대형 방학 원정)은 분리. 둘 다 게임 지역으로는 COAST 에 속한다.
export const STORY_ARCS: StoryArc[] = [
  { id: 'CH1_ERDIA', chapter: 1, name: '입학 · 에르디아 숲', startWeek: globalWeekOf(1, 'semester1', 1), endWeek: globalWeekOf(1, 'summer', 12), mainRegion: 'ERDIA', description: '입학, 삼원 교육, 가시어미 변이체 → 여름 에르디아 대원정 · 고대목 골렘.' },
  { id: 'CH2_SHORE', chapter: 2, name: '에르디아 해안', startWeek: globalWeekOf(1, 'semester2', 1), endWeek: globalWeekOf(1, 'winter', 12), mainRegion: 'COAST', description: '해안 생태 실습 · 낚시 · 오래된 등대 → 해안 수호수, 봉인의 파편.' },
  { id: 'CH3_STORMHAVEN', chapter: 3, name: '스톰헤이븐', startWeek: globalWeekOf(2, 'semester1', 1), endWeek: globalWeekOf(2, 'summer', 12), mainRegion: 'COAST', description: '첫 대형 방학 원정 — 해파리 여왕 → 모르스의 인장 → 심해 암초왕.' },
  { id: 'CH4_SKY', chapter: 4, name: '하늘 유적', startWeek: globalWeekOf(2, 'semester2', 1), endWeek: globalWeekOf(2, 'winter', 12), mainRegion: 'STORMHAVEN', description: '하늘의 마력 폭주 → 하늘 유적 · 언데드 마법사 → 석상 거인왕, 봉인 균열.' },
  { id: 'CH5_SNOWFIELD', chapter: 5, name: '루미나 설원', startWeek: globalWeekOf(3, 'semester1', 1), endWeek: globalWeekOf(3, 'summer', 12), mainRegion: 'SNOWFIELD', description: '쉬어가는 학기 → 설원 원정, 온건파 마족 세르와의 첫 접촉.' },
  { id: 'CH6_VOLCANO', chapter: 6, name: '화산지대', startWeek: globalWeekOf(3, 'semester2', 1), endWeek: globalWeekOf(3, 'winter', 12), mainRegion: 'VOLCANO', description: '제작 중심 학기 → 화산 원정, 봉인이 누군가의 힘을 빼내는 장치였다는 진실.' },
  { id: 'FINAL_TRUTH', chapter: 7, name: '회수', startWeek: globalWeekOf(4, 'semester1', 1), endWeek: globalWeekOf(4, 'summer', 12), mainRegion: 'ACADEMY', description: '모든 지역 재방문(회수 단계) → 최종 대원정 준비.' },
  { id: 'FINAL_MORS', chapter: 8, name: '모르스', startWeek: globalWeekOf(4, 'semester2', 1), endWeek: globalWeekOf(4, 'semester2', 12), mainRegion: 'MORS', description: '봉인 붕괴 · 최종문 · 모르스와의 대면과 선택.' },
  { id: 'EPILOGUE', chapter: 0, name: '졸업', startWeek: globalWeekOf(4, 'winter', 1), endWeek: globalWeekOf(4, 'winter', 12), mainRegion: 'ACADEMY', description: '졸업식 · 동료 후일담 · 자유 이동(본편은 4학년 2학기에서 끝).' },
]

export function arcForWeek(globalWeek: number): StoryArc {
  return STORY_ARCS.find((a) => globalWeek >= a.startWeek && globalWeek <= a.endWeek) ?? STORY_ARCS[0]
}

// ── 주요 플래그 (§27 엔딩 플래그 포함) ──────────────────────────────────────────
// 문자열 오타 방지용 상수. 새 플래그는 자유롭게 문자열로 써도 동작한다.
export const FLAGS = {
  // 장 클리어
  ERDIA_CLEARED: 'ERDIA_CLEARED',
  SHORE_CLEARED: 'SHORE_CLEARED',
  STORMHAVEN_CLEARED: 'STORMHAVEN_CLEARED',
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
  | { type: 'DEFEAT'; monsterId?: string; mapId?: string } // 전투 승리 — 특정 몬스터 및/또는 특정 맵에서

/** 삼원 주인공 — 플레이어와 같은 속성이면 플레이어 본인, 아니면 같은 속성 동기(리안/셀라/도란)가 말한다 */
export type HeroRole = 'fire' | 'ice' | 'earth'

export interface StoryLine {
  speaker: string // 화자 이름(또는 '' = 나레이션). hero 가 있으면 무시되고 실제 이름으로 바뀐다
  /** 초상화 id(Portrait 컴포넌트) — NPC id 또는 동료 id */
  portraitId?: string
  hero?: HeroRole
  text: string
}

export interface StoryChoice {
  label: string
  setFlags: string[]
}

export interface StoryBeat {
  id: string
  arcId: string
  title: string
  trigger: StoryTrigger
  requiredFlags?: string[]
  /** 이 주차(globalWeek) 이전에는 조건이 맞아도 발생하지 않는다 — 방문/전투 트리거 페이싱용 */
  minWeek?: number
  /** 재생 후 켜질 플래그 */
  setFlags?: string[]
  lines: StoryLine[]
  /** 마지막 대사에서 고르는 선택지 — 고른 쪽 setFlags 가 켜지고 FLAG 트리거로 이어진다 */
  choices?: StoryChoice[]
}

/**
 * 스토리 비트 — 대사 본문은 lib/story-script.ts(장기 스토리 대화집 v1.0).
 * 아래는 조작 안내용 온보딩 비트. 같은 트리거면 배열 앞쪽이 먼저 재생된다.
 */
const ONBOARDING_BEATS: StoryBeat[] = [
  {
    id: 'TUTORIAL_CONTROLS',
    arcId: 'CH1_ERDIA',
    title: '학사 안내',
    trigger: { type: 'WEEK_START', week: 1 },
    lines: [
      { speaker: '미르엘 교수', portraitId: 'npc-job-trainer', text: '방향키(WASD)로 걷고, 사람 곁에서 E를 누르면 이야기를 나눌 수 있단다. 우선 학교 본교 쿼드에 있는 나를 찾아와 주간 보고부터 하렴.' },
      { speaker: '미르엘 교수', portraitId: 'npc-job-trainer', text: '매주 학사 수첩(J)에서 이번 주 미션을 확인하렴. 필수 1개와 선택 2개의 보상을 받으면 다음 주로 넘어갈 수 있단다.' },
      { speaker: '미르엘 교수', portraitId: 'npc-job-trainer', text: '야생으로 나갈 땐 통문 주둔지의 군 통문을 이용하고, 파티(P)에서 동기들을 동료로 데려갈 수 있어.' },
    ],
  },
  {
    id: 'TUTORIAL_FIRST_FIELD',
    arcId: 'CH1_ERDIA',
    title: '첫 야생 실습',
    trigger: { type: 'VISIT', mapId: 'forest' },
    lines: [
      { speaker: '', text: '반짝이는 풀·버섯·나무 곁에서 E를 누르면 재료를 채집할 수 있다. 채집 지점은 몇 분 뒤 다시 자라난다.' },
      { speaker: '', text: '몬스터에게 다가가면 전투할지 묻는다. 흙길을 따라가면 다음 구역으로 이어지는 마법진이, 입구엔 마을로 돌아가는 마법진이 있다.' },
    ],
  },
]

// 대화집 비트가 먼저(P-01 입학식 → 조작 안내, 1-01 첫 실습 → 채집 안내 순)
export const STORY_BEATS: StoryBeat[] = [...SCRIPT_BEATS, ...ONBOARDING_BEATS]

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
export function beatsFor(state: Pick<GameState, 'storyFlags' | 'calendar'>, match: (t: StoryTrigger) => boolean): StoryBeat[] {
  return STORY_BEATS.filter(
    (b) =>
      match(b.trigger) &&
      !flagOn(state, `beat:${b.id}`) &&
      flagsAllOn(state, b.requiredFlags) &&
      (b.minWeek === undefined || state.calendar.globalWeek >= b.minWeek),
  )
}

export function beatById(id: string): StoryBeat | undefined {
  return STORY_BEATS.find((b) => b.id === id)
}
