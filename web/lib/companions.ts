// ============================================================================
// 동료 NPC 시스템 기초 (§학사 PRD 63, 75 · 4 대 4 전투)
//
//   파티 = 주인공 + 활성 펫 + 동료 최대 2명 (MAX_PARTY_SIZE 4).
//   동료는 전투에서 kind:'ally' 로 참가해 자동으로 행동하고(battle-engine chooseAutoAction),
//   전투 승리 시 주인공과 같은 경험치를 받아 따로 성장한다.
//
// ⚠ 스토리 라인 미확정 — 아래 로스터의 이름·설정·합류 조건은 전부 임시.
//   · joinFlag  : 이 스토리 플래그가 켜져야 합류 가능(없으면 joinYear 만 따진다)
//   · joinYear  : 이 학년부터 합류 가능(학교 동기들은 1학년부터)
//   스토리 작업 시 joinFlag 에 사건 플래그를 넣고, STORY_BEATS 의 setFlags 로 열어주면 된다.
//
// 외형: 학생 동료는 주인공과 같은 4등신 히어로 시트(hero-<계통>-<성별>.png)를 임시로 빌려 쓴다.
//       전용 도트가 생기면 appearance 를 { kind:'npc', npcId } 로 바꾸거나 새 시트를 연결한다.
// ============================================================================

import type { Combatant, CompanionProgress, Element, GameState, Gender, Stats } from '@/lib/types'
import { computeStatsForLevel, jobTierForLevel, JOB_TIER_ORDER, MAX_PARTY_SIZE } from '@/lib/constants'
import { autoLearnSkillIds } from '@/lib/mock-data'
import { calendarInfo } from '@/lib/calendar'
import { flagOn } from '@/lib/story'

export type CompanionRole = 'student' | 'professor' | 'story'

export interface CompanionDef {
  id: string
  name: string
  /** 한 줄 소개(동료 화면·파티 카드) */
  title: string
  role: CompanionRole
  element: Element
  gender: Gender
  /** 계통 기본 스탯에 곱하는 역할 보정 — 탱커/딜러/힐러 성향 */
  statMult?: Partial<Stats>
  /** 합류 가능 조건 */
  joinYear: number
  joinFlag?: string
  /** 합류 시 레벨 — 생략하면 주인공 레벨에 맞춘다 */
  joinLevel?: number
  /** 전투 외형 */
  appearance: Combatant['appearance']
  /** 동료 화면 대사(합류 전/후) — 스토리 작업 시 교체 */
  lines: { recruit: string; idle: string }
}

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'comp-rian',
    name: '리안',
    title: '화염계 동기 · 돌격형',
    role: 'student',
    element: 'fire',
    gender: 'male',
    statMult: { atk: 1.15, matk: 1.1, def: 0.9 },
    joinYear: 1,
    appearance: { kind: 'hero', element: 'fire', gender: 'male' },
    lines: { recruit: '같은 반이지? 숲 실습 같이 가자. 앞은 내가 맡을게!', idle: '다음엔 더 센 놈이랑 붙어 보고 싶은데.' },
  },
  {
    id: 'comp-sella',
    name: '셀라',
    title: '빙결계 동기 · 제어형',
    role: 'student',
    element: 'ice',
    gender: 'female',
    statMult: { mdef: 1.15, spd: 1.1, maxHp: 0.92 },
    joinYear: 1,
    appearance: { kind: 'hero', element: 'ice', gender: 'female' },
    lines: { recruit: '…혼자 다니면 위험해. 내가 적 발을 묶어 둘게.', idle: '노트 정리 끝나면 같이 복습할래?' },
  },
  {
    id: 'comp-doran',
    name: '도란',
    title: '대지계 동기 · 방어형',
    role: 'student',
    element: 'earth',
    gender: 'male',
    statMult: { maxHp: 1.2, def: 1.2, spd: 0.9 },
    joinYear: 1,
    appearance: { kind: 'hero', element: 'earth', gender: 'male' },
    lines: { recruit: '힘 쓰는 일이면 나한테 맡겨. 뒤는 걱정 마.', idle: '공동 식당 오늘 메뉴 봤어?' },
  },
  {
    id: 'comp-yuna',
    name: '유나',
    title: '대지계 선배 · 회복형',
    role: 'student',
    element: 'earth',
    gender: 'female',
    statMult: { matk: 1.1, mdef: 1.1, atk: 0.85 },
    joinYear: 2,
    appearance: { kind: 'hero', element: 'earth', gender: 'female' },
    lines: { recruit: '후배들끼리만 보내긴 불안하잖니. 다치면 바로 말해.', idle: '약초는 뿌리째 뽑으면 안 돼, 알지?' },
  },
  {
    id: 'comp-kael',
    name: '카엘',
    title: '빙결계 조교 · 전술형',
    role: 'story',
    element: 'ice',
    gender: 'male',
    statMult: { matk: 1.15, spd: 1.05 },
    joinYear: 2,
    joinFlag: 'COMP_KAEL_JOIN', // 스토리 이벤트로 열 예정
    appearance: { kind: 'hero', element: 'ice', gender: 'male' },
    lines: { recruit: '교수님 지시다. 이번 조사는 내가 동행한다.', idle: '보고서는 오늘 안에 내.' },
  },
  {
    id: 'comp-mirel',
    name: '미르엘 교수',
    title: '화염계 교수 · 게스트',
    role: 'professor',
    element: 'fire',
    gender: 'female',
    statMult: { matk: 1.25, maxMp: 1.2 },
    joinYear: 1,
    joinFlag: 'COMP_MIREL_JOIN', // 대원정 등 특정 스토리 구간에서만 합류(게스트)
    joinLevel: 40,
    appearance: { kind: 'hero', element: 'fire', gender: 'female' },
    lines: { recruit: '이번 원정은 나도 함께 가마. 너무 기대지는 말고.', idle: '기초가 탄탄해야 극의에 닿는단다.' },
  },
]

const BY_ID = new Map(COMPANIONS.map((c) => [c.id, c]))
export function companionById(id: string): CompanionDef | undefined {
  return BY_ID.get(id)
}

/** 동료 파티 슬롯 수 — 주인공·펫을 뺀 나머지 */
export const COMPANION_SLOTS = MAX_PARTY_SIZE - 2

export function canRecruit(state: Pick<GameState, 'calendar' | 'storyFlags' | 'settings'>, def: CompanionDef): { ok: boolean; reason?: string } {
  if (state.storyFlags.DEBUG_UNLOCK_ALL) return { ok: true }
  const year = calendarInfo(state.calendar.globalWeek).year
  if (year < def.joinYear) return { ok: false, reason: `${def.joinYear}학년부터 합류 가능` }
  if (def.joinFlag && !flagOn(state, def.joinFlag)) return { ok: false, reason: '스토리 진행 후 합류' }
  return { ok: true }
}

export function companionStats(def: CompanionDef, level: number): Stats {
  const base = computeStatsForLevel(def.element, level)
  const out = { ...base }
  for (const k of Object.keys(def.statMult ?? {}) as (keyof Stats)[]) {
    out[k] = Math.max(1, Math.round(base[k] * (def.statMult![k] ?? 1)))
  }
  return out
}

export function companionSkills(def: CompanionDef, level: number): string[] {
  const tier = jobTierForLevel(level)
  return autoLearnSkillIds(def.element, level, JOB_TIER_ORDER.indexOf(tier.id))
}

export function createCompanionProgress(def: CompanionDef, heroLevel: number): CompanionProgress {
  const level = def.joinLevel ?? Math.max(1, heroLevel)
  const stats = companionStats(def, level)
  return { level, exp: 0, hp: stats.maxHp, mp: stats.maxMp }
}

export function combatantFromCompanion(def: CompanionDef, prog: CompanionProgress): Combatant {
  const stats = companionStats(def, prog.level)
  return {
    uid: `ally-${def.id}`,
    side: 'player',
    kind: 'ally',
    refId: def.id,
    name: def.name,
    icon: `/images/elements/${def.element}-crest.png`,
    element: def.element,
    level: prog.level,
    stats,
    hp: Math.min(prog.hp, stats.maxHp),
    mp: Math.min(prog.mp, stats.maxMp),
    skills: companionSkills(def, prog.level),
    atb: 0,
    effects: [],
    appearance: def.appearance,
    alive: prog.hp > 0,
  }
}
