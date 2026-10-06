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

import type { GameState, TermType } from '@/lib/types'
import { calendarInfo, globalWeekOf, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import type { RegionId } from '@/lib/regions'
import { SCRIPT_BEATS } from '@/lib/story-script'
import { episodeQuestId, isStoryEpisodeWeek, STORY_EPISODES } from '@/lib/story-episodes'

export interface StoryArc {
  id: string
  chapter: number // 학기 단계 번호(1~16)
  name: string
  startWeek: number
  endWeek: number
  mainRegion: RegionId
  description: string
}

// 학기별 진행(통합 PRD v1.0 §5~13 · 2026-10-02 사용자 결정: '장(chapter) 배치' 폐기).
// 16개 학기·방학이 각각 하나의 스토리 단계 — 학기 = 학교생활 중심, 방학 = 지역 원정 중심.
// 해안(1학년 여름) → 스톰헤이븐(1학년 2학기·겨울, 심해 원정은 게임 지역 COAST) → 하늘 유적·폐허(2학년 1학기·여름)
// → 설원(2학년 2학기·겨울) → 화산(3학년) → 회수·최종 원정(4학년 1학기·여름) → 모르스(4학년 2학기) → 졸업(4학년 겨울).
// ⚠ 단계 이름/설명은 상세 스토리 작업 때 사용자가 다시 쓴다. id = 학기 termId(예: Y1_SEMESTER1).
type TermStage = [year: number, term: TermType, name: string, region: RegionId, description: string]
const TERM_STAGES: TermStage[] = [
  [1, 'semester1', '입학 · 에르디아 숲', 'ERDIA', '입학식과 삼원 기초 수업. 숲 실습 중 몬스터 이상행동 → 가시어미 변이체 → 고대목 골렘, 첫 봉인 단서.'],
  [1, 'summer', '에르디아 해안', 'COAST', '휴식 겸 현장실습. 어업 마을 · 낚시 · 등대 조사 → 고대 해안 유적 → 해안 수호수, 이상한 인장의 파편.'],
  [1, 'semester2', '스톰헤이븐 입항', 'COAST', '학교 밖 세계가 하나의 사건으로 이어진다. 스톰헤이븐 입항 · 하늘과 폭풍의 이상징후.'],
  [1, 'winter', '스톰헤이븐 원정', 'COAST', '첫 대형 원정. 심해 탐사 → 해파리 여왕 → 모르스의 인장 → 심해 암초왕.'],
  [2, 'semester1', '하늘 유적', 'STORMHAVEN', '스톰헤이븐의 기록을 쫓아 하늘 유적으로. "우리가 알던 인마대전의 기록은 정확한가?"'],
  [2, 'summer', '폐허 원정', 'RUINS', '버려진 폐허 · 묘지 · 신전. 언데드와 흑마법사 → 석상 거인왕 → 봉인 균열.'],
  [2, 'semester2', '루미나 설원', 'SNOWFIELD', '템포를 낮추는 학기. 사냥 · 채집 · 설원 낚시 · 마을 생활 · 동료 이벤트.'],
  [2, 'winter', '설원 원정', 'SNOWFIELD', '전투보다 관계와 진실. 온건파 마족과의 첫 접촉.'],
  [3, 'semester1', '화산지대', 'VOLCANO', '제작 · 마도구 · 장비가 이야기와 이어진다. 광석 채굴과 화산 대장간.'],
  [3, 'summer', '화산 원정', 'VOLCANO', '봉인의 매개체를 찾아 화산 깊은 곳으로 — 봉인 수호자.'],
  [3, 'semester2', '봉인의 진실', 'VOLCANO', '인마대전의 진실. 봉인은 누군가의 힘을 계속 소모시키는 구조였다.'],
  [3, 'winter', '전환점', 'ACADEMY', '3학년의 끝. 동료 · 교수와의 관계를 정리하고 마지막 해를 준비한다.'],
  [4, 'semester1', '회수', 'ACADEMY', '과거 지역 재방문 — 4년간의 기록(도움 · 평판 · 관계 · 연구 · 봉인 파편)이 졸업 프로젝트로 모인다.'],
  [4, 'summer', '최종 원정', 'ACADEMY', '모든 지역의 봉인 흔적을 연결하는 마지막 외부원정.'],
  [4, 'semester2', '모르스', 'MORS', '학교 내부 이상현상 → 봉인 붕괴 → 학교 방어전 → 최종 게이트 해금 → 모르스. 본편 엔딩.'],
  [4, 'winter', '졸업', 'ACADEMY', '졸업식 · 후일담 · 자유 생활(본편은 4학년 2학기에서 끝).'],
]
export const STORY_ARCS: StoryArc[] = TERM_STAGES.map(([year, term, name, mainRegion, description], i) => ({
  id: `Y${year}_${term.toUpperCase()}`,
  chapter: i + 1, // 단계 번호(1~16)
  name,
  startWeek: globalWeekOf(year, term, 1),
  endWeek: globalWeekOf(year, term, 12),
  mainRegion,
  description,
}))

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
  | { type: 'STORY_SLOT'; week: number } // 3주 메인스토리 슬롯(통합 PRD §3) — 그 주를 마감할 때(주간 보상 직후)

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
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: 'W·A·S·D로 걷고(Shift를 누르고 있으면 달린단다), 사람 곁에서 E를 누르면 이야기를 나눌 수 있단다. 우선 학교 본교 쿼드에 있는 나를 찾아와 주간 보고부터 하렴.' },
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: '매주 학사 수첩(J)에서 이번 주 미션을 확인하렴. 필수 1개와 선택 2개의 보상을 받으면 다음 주로 넘어갈 수 있단다.' },
      { speaker: '에드릭 교수', portraitId: 'npc-job-trainer', text: '야생으로 나갈 땐 통문 주둔지의 군 통문을 이용하고, 파티(P)에서 동기들을 동료로 데려갈 수 있어.' },
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

// ─────────────────────────────────────────────────────────────────────────────
// 3주 스토리 슬롯(통합 PRD §3, §39, §49) — 3·6·9·12주차를 마감할 때 메인스토리 비트가 재생된다.
//   · 대화집(story-script)의 주차 트리거 비트는 같은 학기 안의 가장 가까운 다음 슬롯으로 옮긴다
//     (학기 1주차 오프닝·입학식은 그대로 주 시작에). ⚠ 임시 배치 — 상세 스토리 작업 때 사용자가 다시 짠다.
//   · 대화집 비트가 없는 슬롯은 장(Arc) 설명으로 만든 임시 비트로 채운다(STORY_CYCLE 로 덮어쓸 수 있음).
//   · 강도(§49): 학기 3주 LOW → 6주 MID → 9주 LOW/MID → 12주 HIGH
// ─────────────────────────────────────────────────────────────────────────────
export type StoryIntensity = 'LOW' | 'MID' | 'HIGH'
export const SLOT_INTENSITY: Record<number, StoryIntensity> = { 3: 'LOW', 6: 'MID', 9: 'MID', 12: 'HIGH' }
export const isStoryWeek = (globalWeek: number) => calendarInfo(globalWeek).week % 3 === 0

/** 학기 내 주차 → 같은 학기의 다음 슬롯 주(globalWeek) */
function slotWeekFor(globalWeek: number): number {
  const info = calendarInfo(globalWeek)
  const slot = Math.min(WEEKS_PER_TERM, Math.ceil(info.week / 3) * 3)
  return globalWeek - info.week + slot
}
function slotify(b: StoryBeat): StoryBeat {
  const t = b.trigger
  if (t.type === 'WEEK_START') {
    if (calendarInfo(t.week).week === 1) return b // 학기 오프닝은 주 시작 그대로
    return { ...b, trigger: { type: 'STORY_SLOT', week: slotWeekFor(t.week) } }
  }
  if (t.type === 'WEEK_END') return { ...b, trigger: { type: 'STORY_SLOT', week: slotWeekFor(t.week) } }
  return b
}
const SLOTTED_SCRIPT = SCRIPT_BEATS.map(slotify)

/** 슬롯별 직접 지정(globalWeek → 비트 id) — 비워 두면 대화집/임시 비트가 쓰인다 */
export const STORY_CYCLE: Record<number, string> = {}

const PLACEHOLDER_NARRATION: Record<StoryIntensity, (arc: StoryArc) => string[]> = {
  LOW: (a) => [`${a.name} — 수업과 과제로 바쁜 한 주가 지나갔다.`, '기숙사 휴게실에서는 요즘 학교 밖에서 들려오는 이상한 소문이 화제다.'],
  MID: (a) => [`${a.name} — 외부활동에서 마주친 흔적들이 하나의 방향을 가리키기 시작한다.`, `교수진이 조용히 조사를 시작했다는 이야기가 돈다. (${a.description})`],
  HIGH: (a) => [`${a.name} — 학기의 끝, 쌓여 온 단서가 사건이 되어 터진다.`, a.description],
}
function placeholderBeats(): StoryBeat[] {
  const taken = new Set(SLOTTED_SCRIPT.filter((b) => b.trigger.type === 'STORY_SLOT').map((b) => (b.trigger as { week: number }).week))
  const out: StoryBeat[] = []
  for (let gw = 3; gw <= TOTAL_WEEKS; gw += 3) {
    const info = calendarInfo(gw)
    // 스토리 주간 에피소드가 있는 주는 결말 장면이 대신한다
    if (info.isPostGame || taken.has(gw) || STORY_CYCLE[gw] || isStoryEpisodeWeek(gw)) continue
    const arc = arcForWeek(gw)
    const intensity = SLOT_INTENSITY[info.week] ?? 'LOW'
    out.push({
      id: `SLOT_${gw}`,
      arcId: arc.id,
      title: `${arc.name} · ${info.year}학년 ${info.isVacation ? '방학' : '학기'} ${info.week}주차`,
      trigger: { type: 'STORY_SLOT', week: gw },
      lines: PLACEHOLDER_NARRATION[intensity](arc).map((text) => ({ speaker: '', text })),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 3주 스토리 주간 에피소드(lib/story-episodes.ts, 2026-10-07) — 주 시작 오프닝 + 미션 보상 수령 시 결말
// ─────────────────────────────────────────────────────────────────────────────
function episodeBeats(): StoryBeat[] {
  return STORY_EPISODES.flatMap((ep) => {
    const arc = arcForWeek(ep.week)
    const info = calendarInfo(ep.week)
    return [
      {
        id: `EP_${ep.week}_OPEN`,
        arcId: arc.id,
        title: `스토리 ${ep.no}화 — ${ep.title}`,
        trigger: { type: 'WEEK_START', week: ep.week },
        lines: [
          { speaker: '', text: `${info.year}학년 ${info.isVacation ? '방학' : '학기'} ${info.week}주차 · 스토리 ${ep.no}화 「${ep.title}」${info.isVacation ? '' : ' — 이번 주는 수업이 없다.'}` },
          ...ep.brief,
          { speaker: '', text: `이번 주 필수 미션: ${ep.objectives.map((o) => o.label).join(' · ')}  (학사 수첩 J)` },
        ],
      },
      {
        id: `EP_${ep.week}_END`,
        arcId: arc.id,
        title: ep.title,
        trigger: { type: 'QUEST_CLAIMED', templateId: episodeQuestId(ep.week) },
        setFlags: [`EP_${ep.week}_DONE`, ...ep.setFlags],
        lines: ep.outro,
        ...(ep.choices.length ? { choices: ep.choices } : {}),
      },
    ] satisfies StoryBeat[]
  })
}

// 대화집 비트가 먼저(P-01 입학식 → 조작 안내, 1-01 첫 실습 → 채집 안내 순)
export const STORY_BEATS: StoryBeat[] = [...SLOTTED_SCRIPT, ...ONBOARDING_BEATS, ...episodeBeats(), ...placeholderBeats()]

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
