// ============================================================================
// 스토리 골격 — 메인 스토리 53막 통합안 v3.0 (2026-10-08 확정, Documents/메인 스토리 53막 v3.0.md)
//
//   · StoryArc  : 장(CH0~CH7 + 후일담) — 시작/끝 주차, 무대 지역
//   · 53막      : EP00 프롤로그 = lib/story-script.ts, EP01~EP52 = lib/story-episodes.ts
//   · StoryBeat : 조건이 맞으면 딱 한 번 재생되는 사건(대사 묶음). 재생되면 `beat:<id>` 플래그가 켜져
//                 다시는 발생하지 않는다. setFlags 로 다음 사건의 조건을 연다.
//   · 플래그     : GameState.storyFlags — 모든 스토리 진행은 플래그 기반(v3.0 §9)
// ============================================================================

import type { GameState } from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import type { RegionId } from '@/lib/regions'
import { SCRIPT_BEATS } from '@/lib/story-script'
import { episodeQuestId, isStoryEpisodeWeek, STORY_EPISODES } from '@/lib/story-episodes'

export interface StoryArc {
  id: string
  chapter: number // 장 번호(0~7, 후일담 8)
  name: string
  startWeek: number
  endWeek: number
  mainRegion: RegionId
  description: string
}

// v3.0 §4 지역/장 구조 — 해안(CH2)과 스톰헤이븐(CH3)은 절대 합치지 않는다.
type ChapterDef = [id: string, chapter: number, name: string, startWeek: number, endWeek: number, region: RegionId, description: string]
const CHAPTERS: ChapterDef[] = [
  ['CH0', 0, '프롤로그 · 입학', 1, 2, 'ACADEMY', '울토르 마법학교 입학. 미르엘 교수와 동기들, 학교 지하 금지구역의 금기.'],
  ['CH1', 1, '에르디아 숲', 3, 24, 'ERDIA', '숲의 이상 → 가시어미 변이체 → 고목의 문장. 봉인의 흔적이 처음 미스터리로 떠오른다.'],
  ['CH2', 2, '에르디아 해안 · 아틀란티스', 25, 48, 'COAST', "폐등대와 해저 유적 → 해파리 여왕 → 암초왕. '모르스'라는 이름이 '마왕'으로 기록된 채 처음 등장."],
  ['CH3', 3, '스톰헤이븐 · 천공 신전', 49, 96, 'STORMHAVEN', "고쳐 쓰인 기록, 성녀와의 만남, 천공 신전과 대성당의 '네 개로 나뉜 왕의 마음'."],
  ['CH4', 4, '버려진 폐허 · 버려진 신전', 97, 132, 'RUINS', "역사 개변 의혹, 미르엘의 개입. '노'의 봉인이 풀려 루스벨이 폭주하고 달아난다."],
  ['CH5', 5, '설원 · 오로라 마을', 133, 156, 'SNOWFIELD', '루스벨의 화염으로 녹는 설원, 읽을 수 없는 석비, 루스벨 추적 — 엔딩 루트의 첫 분기.'],
  ['CH6', 6, '화산지대 · 마물 마을', 157, 168, 'VOLCANO', '모르스가 사는 화산지대. 루스벨을 찾았느냐에 따라 토벌(A) 또는 대화(B/C).'],
  ['CH7', 7, '최종장', 169, 180, 'ACADEMY', "마을 상징, 학교 지하의 '희', 미르엘의 정체, 왕 앞의 증언 — A/B/C 엔딩과 졸업식."],
  ['EPILOGUE', 8, '졸업 · 후일담', 181, 192, 'ACADEMY', '본편 이후 졸업식 · 후일담 · 자유 생활.'],
]
export const STORY_ARCS: StoryArc[] = CHAPTERS.map(([id, chapter, name, startWeek, endWeek, mainRegion, description]) => ({ id, chapter, name, startWeek, endWeek, mainRegion, description }))

export function arcForWeek(globalWeek: number): StoryArc {
  return STORY_ARCS.find((a) => globalWeek >= a.startWeek && globalWeek <= a.endWeek) ?? STORY_ARCS[0]
}

// ── 스토리 플래그(v3.0 §9) ────────────────────────────────────────────────────
// 문자열 오타 방지용 상수. 루스벨 관련 키는 RUSPELL_* 하나로 통일(문서의 RUSSELL_ENRAGED → RUSPELL_ENRAGED).
export const FLAGS = {
  CH0_STARTED: 'CH0_STARTED',
  CH1_STARTED: 'CH1_STARTED',
  CH1_ERDIA_COMPLETE: 'CH1_ERDIA_COMPLETE',
  CH2_COAST_STARTED: 'CH2_COAST_STARTED',
  CH2_COAST_COMPLETE: 'CH2_COAST_COMPLETE',
  CH3_STORMHAVEN_STARTED: 'CH3_STORMHAVEN_STARTED',
  SAINT_MET: 'SAINT_MET',
  CATHEDRAL_RECORD_FOUND: 'CATHEDRAL_RECORD_FOUND',
  FOUR_EMOTIONS_DISCOVERED: 'FOUR_EMOTIONS_DISCOVERED',
  CH4_RUINS_STARTED: 'CH4_RUINS_STARTED',
  MIREL_HISTORY_SUSPICION: 'MIREL_HISTORY_SUSPICION',
  NO_SEAL_FOUND: 'NO_SEAL_FOUND',
  NO_RELEASED: 'NO_RELEASED',
  RUSPELL_ENRAGED: 'RUSPELL_ENRAGED',
  /** 엔딩 루트 첫 분기 — 설원에서 루스벨을 찾았는가(EP45) */
  RUSPELL_FOUND: 'RUSPELL_FOUND',
  SNOW_STELE_FOUND: 'SNOW_STELE_FOUND',
  ANCIENT_SCRIPT_CONFIRMED: 'ANCIENT_SCRIPT_CONFIRMED',
  MORS_MEMORY_ACQUIRED: 'MORS_MEMORY_ACQUIRED',
  MORS_TRUTH_CONFIRMED: 'MORS_TRUTH_CONFIRMED',
  MIREL_TRUE_IDENTITY_FOUND: 'MIREL_TRUE_IDENTITY_FOUND',
  // 희·노·애·락 — 모르스의 네 감정
  JOY_FRAGMENT_FOUND: 'JOY_FRAGMENT_FOUND',
  RAGE_FRAGMENT_RETURNED: 'RAGE_FRAGMENT_RETURNED',
  SORROW_FRAGMENT_CONFIRMED: 'SORROW_FRAGMENT_CONFIRMED',
  PLEASURE_FRAGMENT_RECOVERED: 'PLEASURE_FRAGMENT_RECOVERED',
  MORS_COMPLETE: 'MORS_COMPLETE',
  MIREL_DEFEATED: 'MIREL_DEFEATED',
  /** 최종전 진입 조건 — 이 플래그 전에는 모르스의 성 최종전(storyBoss)이 나오지 않는다 */
  FINAL_GATE_OPEN: 'FINAL_GATE_OPEN',
  ENDING_A: 'ENDING_A',
  ENDING_B: 'ENDING_B',
  ENDING_C: 'ENDING_C',
  /** 관리자/테스트 — 모든 생활 시스템 즉시 해금 */
  DEBUG_UNLOCK_ALL: 'DEBUG_UNLOCK_ALL',
} as const

// ── 평판 거점 · 마을 상징(v3.0 §5) — 평판 DB·분수대·상징 지급은 Phase 2 ─────────────────
export interface ReputationHub {
  id: string
  name: string
  mapId: string
  /** 평판 수치 플래그(Lv.1~5) */
  repFlag: string
  /** Lv.5 상징 획득 플래그 */
  emblemFlag: string
}
export const REPUTATION_HUBS: ReputationHub[] = [
  { id: 'SAFE_VILLAGE', name: '안전지대 마을', mapId: 'village', repFlag: 'REP_SAFE_VILLAGE', emblemFlag: 'EMBLEM_SAFE_VILLAGE' },
  { id: 'ATLANTIS', name: '아틀란티스 마을', mapId: 'atlantis', repFlag: 'REP_ATLANTIS', emblemFlag: 'EMBLEM_ATLANTIS' },
  { id: 'SKY_SANCTUARY', name: '천공 신전 성역', mapId: 'sky-temple', repFlag: 'REP_SKY_SANCTUARY', emblemFlag: 'EMBLEM_SKY_SANCTUARY' },
  { id: 'RUIN_VILLAGE', name: '폐허 신전 쪽 마을', mapId: 'temple-ruin', repFlag: 'REP_RUIN_VILLAGE', emblemFlag: 'EMBLEM_RUIN_VILLAGE' },
  { id: 'AURORA', name: '오로라 마을', mapId: 'aurora-village', repFlag: 'REP_AURORA', emblemFlag: 'EMBLEM_AURORA' },
  { id: 'MONSTER_VILLAGE', name: '마물 마을', mapId: 'demon-village', repFlag: 'REP_MONSTER_VILLAGE', emblemFlag: 'EMBLEM_MONSTER_VILLAGE' },
]
export const REPUTATION_LEVELS = ['낯선 사람', '얼굴을 아는 손님', '믿을 만한 모험가', '마을의 은인', '마을의 대변자'] as const
/** C 엔딩에 필요한 상징 — 6거점 전부(2026-10-08 확정) */
export const ENDING_EMBLEM_FLAGS: string[] = REPUTATION_HUBS.map((h) => h.emblemFlag)
/** 마물 마을 평판 Lv.5(상징) — 모르스와의 첫 대화에서 협력 루트가 열리는 조건 */
export const VOLCANO_REPUTATION_LV5 = 'EMBLEM_MONSTER_VILLAGE'

/** 엔딩 판정(v3.0 §6) — 루스벨을 못 찾았거나 마물 마을 상징이 없으면 A, 상징이 하나라도 빠지면 B, 전부면 C */
export function endingRoute(state: Pick<GameState, 'storyFlags'>): 'A' | 'B' | 'C' {
  if (!flagOn(state, FLAGS.RUSPELL_FOUND) || !flagOn(state, VOLCANO_REPUTATION_LV5)) return 'A'
  return ENDING_EMBLEM_FLAGS.every((f) => flagOn(state, f)) ? 'C' : 'B'
}

/**
 * 대사 줄 루트 판정 — 루트 전용 줄(StoryLine.route)을 보여 줄지 정한다.
 * EP47(마물 마을, 167주)을 마치기 전에는 루스벨 발견 여부만 본다(A ↔ B/C). 그 뒤로는 endingRoute.
 */
export function storyLineRoute(state: Pick<GameState, 'storyFlags'>): 'A' | 'B' | 'C' {
  if (!flagOn(state, FLAGS.RUSPELL_FOUND)) return 'A'
  if (!flagOn(state, 'EP_167_DONE')) return ENDING_EMBLEM_FLAGS.every((f) => flagOn(state, f)) ? 'C' : 'B'
  return endingRoute(state)
}
export const lineOnRoute = (l: StoryLine, r: 'A' | 'B' | 'C') => !l.route || l.route === r || (l.route === 'B_OR_C' && r !== 'A')

// ── 스토리 비트 ─────────────────────────────────────────────────────────────────
export type StoryTrigger =
  | { type: 'WEEK_START'; week: number } // 해당 globalWeek 가 시작될 때
  | { type: 'WEEK_END'; week: number } // 해당 주를 마감할 때
  | { type: 'QUEST_CLAIMED'; templateId: string } // 특정 퀘스트 보상 수령 시
  | { type: 'VISIT'; mapId: string } // 특정 맵 첫 진입
  | { type: 'FLAG'; flag: string } // 플래그가 켜진 직후
  | { type: 'DEFEAT'; monsterId?: string; mapId?: string } // 전투 승리 — 특정 몬스터 및/또는 특정 맵에서
  | { type: 'STORY_SLOT'; week: number } // 3주 메인스토리 슬롯(통합 PRD §3) — 그 주를 마감할 때(주간 보상 직후)
  | { type: 'TALK'; npcId: string } // 그 NPC 에게 말을 걸면(일반 대화 대신 장면이 바로 재생)

/** 삼원 주인공 — 플레이어와 같은 속성이면 플레이어 본인, 아니면 같은 속성 동기(리안/셀라/도란)가 말한다 */
export type HeroRole = 'fire' | 'ice' | 'earth'

export interface StoryLine {
  speaker: string // 화자 이름(또는 '' = 나레이션). hero/player 가 있으면 무시되고 실제 이름으로 바뀐다
  /** 초상화 id(Portrait 컴포넌트) — NPC id 또는 동료 id */
  portraitId?: string
  hero?: HeroRole
  /** 주인공(플레이어) 대사 — 플레이어 이름 + 주인공 도트 초상 */
  player?: boolean
  /**
   * 컷신 이미지(lib/cutscenes.ts) — 이 줄부터 띄우고 다음에 다른 컷이 오거나 null 이 올 때까지 유지.
   * 이미지가 아직 없으면 조용히 건너뛴다(대사만 진행).
   */
  cut?: string | null
  /**
   * 연출 동작(lib/story-anims) — 이 줄에서 대화창 위 무대에 캐릭터 동작을 재생한다. 여러 개면 나란히.
   * 시트가 아직 없으면 건너뛴다.
   */
  anim?: string | string[]
  /** 루트 전용 줄(EP45~) — 없으면 공통. 'B_OR_C' = 루스벨을 찾은 루트 */
  route?: 'A' | 'B' | 'C' | 'B_OR_C'
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
  /** 장면을 닫으면 이 몬스터들과 바로 전투(스토리 보스). 지거나 도망치면 장면이 되돌아가 다시 도전할 수 있다 */
  battle?: { monsterIds: string[] }
}

/**
 * 스토리 비트 — 대사 본문은 lib/story-script.ts(장기 스토리 대화집 v1.0).
 * 아래는 조작 안내용 온보딩 비트. 같은 트리거면 배열 앞쪽이 먼저 재생된다.
 */
const ONBOARDING_BEATS: StoryBeat[] = [
  {
    id: 'TUTORIAL_CONTROLS',
    arcId: 'CH0',
    title: '학사 안내',
    trigger: { type: 'WEEK_START', week: 1 },
    lines: [
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: 'W·A·S·D로 걷고(Shift를 누르고 있으면 달린단다), 사람 곁에서 E를 누르면 이야기를 나눌 수 있단다. 우선 학교 본교 쿼드에 있는 나를 찾아와 주간 보고부터 하렴.' },
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: '매주 학사 수첩(J)에서 이번 주 미션을 확인하렴. 필수 1개와 선택 2개의 보상을 받으면 다음 주로 넘어갈 수 있단다.' },
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: '야생으로 나갈 땐 통문 주둔지의 군 통문을 이용하고, 파티(P)에서 동기들을 동료로 데려갈 수 있어.' },
    ],
  },
  {
    id: 'TUTORIAL_FIRST_FIELD',
    arcId: 'CH1',
    title: '첫 야생 실습',
    trigger: { type: 'VISIT', mapId: 'forest' },
    lines: [
      { speaker: '', text: '반짝이는 풀·버섯·나무 곁에서 E를 누르면 재료를 채집할 수 있다. 채집 지점은 몇 분 뒤 다시 자라난다.' },
      { speaker: '', text: '몬스터에게 다가가면 전투할지 묻는다. 흙길을 따라가면 다음 구역으로 이어지는 마법진이, 입구엔 마을로 돌아가는 마법진이 있다.' },
    ],
  },
]

/**
 * 화산지대 첫 진입(lib/passages 의 '첫 이동 연출' 가운데 장면으로 처리하는 것) — 용암 강을 건너는 방법이
 * 루스벨을 찾았는가에 따라 갈린다. 루트 전용 줄(route)로 한 비트 안에서 나눈다.
 */
const PASSAGE_BEATS: StoryBeat[] = [
  {
    id: 'CH6_LAVA_CROSSING',
    arcId: 'CH6',
    title: '용암 강을 건너다',
    trigger: { type: 'VISIT', mapId: 'volcano' },
    lines: [
      { speaker: '', text: '화산지대 어귀. 길은 붉게 끓는 용암 강 앞에서 끊겨 있다. 건너편 검은 바위 너머로 마물 마을의 연기가 보인다.' },
      { speaker: '', player: true, text: '다리도, 돌아갈 길도 없어. 여길 어떻게 건너지…' },
      // 루스벨을 찾은 루트 — 루스벨이 불길을 가른다
      { speaker: '루스벨', portraitId: 'comp-rusbel', route: 'B_OR_C', text: '비켜 봐. 불은… 이제 내 말을 조금은 들어.' },
      { speaker: '', route: 'B_OR_C', text: '루스벨이 손을 뻗자 용암이 양쪽으로 갈라지며 식어, 검은 돌길이 강 한가운데를 가로질러 떠오른다.' },
      { speaker: '루스벨', portraitId: 'comp-rusbel', route: 'B_OR_C', text: '오래는 못 버텨. 뛰어! …그리고 고마워. 날 찾으러 와 줘서.' },
      { speaker: '', route: 'B_OR_C', text: '마지막 한 사람이 건너자마자 돌길은 다시 붉게 녹아내렸다. 싸움 없이, 모두 무사히 건넜다.' },
      // 루스벨을 찾지 못한 루트 — 미르엘이 길을 얼리고, 건너편에서 싸움이 기다린다
      { speaker: '미르엘 교수', portraitId: 'npc-mirel', route: 'A', text: '물러서 있거라. 이 정도 불은 내가 잠재우마.' },
      { speaker: '', route: 'A', text: '미르엘의 지팡이 끝에서 서리가 번지더니, 용암 위로 얼음 다리가 놓인다. 다리는 김을 내뿜으며 금세 갈라지기 시작한다.' },
      { speaker: '미르엘 교수', portraitId: 'npc-mirel', route: 'A', text: '서두르렴. 그리고 건너편에선 검을 뽑아 두는 게 좋겠구나. 마물들은 우리를 손님으로 맞지 않을 테니.' },
      { speaker: '', route: 'A', text: '다리가 무너지는 소리를 등지고 건너편에 닿았다. 불길 사이에서 화산의 마물들이 이쪽을 노려본다 — 여기서부터는 싸워서 길을 열어야 한다.' },
    ],
  },
]

/** 이 주가 메인 스토리 주인가(v3.0 §8 globalWeek 표) */
export const isStoryWeek = (globalWeek: number) => isStoryEpisodeWeek(globalWeek)

/** 주차별 직접 지정(globalWeek → 비트 id) — 비워 두면 53막 에피소드만 쓰인다 */
export const STORY_CYCLE: Record<number, string> = {}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 스토리 EP01~EP52(lib/story-episodes.ts) — 주 시작 오프닝 + 스토리 미션 보상 수령 시 결말
// ─────────────────────────────────────────────────────────────────────────────
function episodeBeats(): StoryBeat[] {
  return STORY_EPISODES.flatMap((ep) => {
    const arc = arcForWeek(ep.week)
    const info = calendarInfo(ep.week)
    return [
      {
        id: `EP_${ep.week}_OPEN`,
        arcId: arc.id,
        title: `${ep.id} — ${ep.title}`,
        trigger: { type: 'WEEK_START', week: ep.week },
        ...(ep.requiredFlags.length ? { requiredFlags: ep.requiredFlags } : {}),
        lines: [
          { speaker: '', text: `${info.year}학년 ${info.isVacation ? '방학' : '학기'} ${info.week}주차 · 메인 스토리 ${ep.id} 「${ep.title}」` },
          ...ep.brief,
          { speaker: '', text: `이번 주 필수 미션: ${ep.objectives.map((o) => o.label).join(' · ')}  (학사 수첩 J)` },
        ],
      },
      {
        id: `EP_${ep.week}_END`,
        arcId: arc.id,
        title: `${ep.id} — ${ep.title} (결말)`,
        trigger: { type: 'QUEST_CLAIMED', templateId: episodeQuestId(ep.week) },
        setFlags: [`EP_${ep.week}_DONE`, ...ep.setFlags],
        lines: ep.outro,
        ...(ep.choices.length ? { choices: ep.choices } : {}),
      },
    ] satisfies StoryBeat[]
  })
}

// 프롤로그(EP00 입학식) → 조작 안내 순
export const STORY_BEATS: StoryBeat[] = [...SCRIPT_BEATS, ...ONBOARDING_BEATS, ...PASSAGE_BEATS, ...episodeBeats()]

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

/** 학사 칭호(통합 PRD §24) — 직업 티어가 아닌 학사 상태 표시용 */
export function academicTitle(globalWeek: number): string {
  const info = calendarInfo(globalWeek)
  if (info.year === 1) return '신입생'
  if (info.year === 2) return '중급생'
  if (info.year === 3) return '상급생'
  return info.termType === 'semester1' || info.termType === 'summer' ? '연구생' : '졸업예정자'
}
