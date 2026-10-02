// ============================================================================
// 학교 NPC + 파티 전투 프로필 (PRD v2.0 §2, §16~20 · 학사 PRD §63, §75)
//
//   예전 플레이어블 주인공 6인(남/녀 × 3원소 시트)은 더 이상 플레이어 캐릭터가 아니다.
//   이들은 울토르 학교 NPC(동기·선배·조교·교수)로 편입되었고, 외형·성격·말투는 그대로 유지한다.
//
//   전투: 주인공 + 학교 NPC 3명 = 핵심 전투원 4명(4대4). 펫은 핵심 슬롯을 차지하지 않는 부속 유닛.
//   · 학교 NPC 는 npcCombatProfile 이 있어야 파티에 들어올 수 있다(없으면 전투 불가 — 순수 학교 NPC).
//   · 과거 플레이어블 속성을 그대로 상속하지 않는다 — 스킬은 프로필에 명시된 목록을 레벨에 따라 쓴다.
//   · 각 NPC 는 고정 펫을 데리고 다니며, 전위(front)에 섰을 때만 그 펫이 함께 싸운다.
//
// ⚠ 스토리 라인 미확정 — 합류 조건(joinYear/joinFlag)은 임시값.
//   1학년 동기 셋(리안·셀라·도란)은 입학과 동시에 파티에 들어와 4인 편성을 채운다.
// ============================================================================

import type { Combatant, CompanionProgress, GameState, Gender, Position, SpriteSheet, Stats } from '@/lib/types'
import { computeStatsForLevel, MAX_PARTY_SIZE } from '@/lib/constants'
import { calendarInfo } from '@/lib/calendar'
import { flagOn } from '@/lib/story'
import { petDefById, petStatsForLevel } from '@/lib/pets'

export type SchoolNpcRole = 'student' | 'professor' | 'story'

/** 전투가 가능한 학교 NPC 의 전투 설정 */
export interface NpcCombatProfile {
  /** 기본 스탯(PRD §15 공용 성장식)에 곱하는 성향 보정 */
  statMult?: Partial<Stats>
  /** 레벨이 오르면 쓸 수 있게 되는 스킬(속성 무관 — 명시 목록) */
  skills: { skillId: string; level: number }[]
  /** 처음 편성될 때의 포지션 */
  defaultPosition: Position
  /** 고정 펫(전위일 때만 전투 참가) */
  petDefId: string
  /** 합류 시 레벨 — 생략하면 주인공 레벨에 맞춘다 */
  joinLevel?: number
}

export interface SchoolNpc {
  id: string
  name: string
  /** 학교 내 역할 한 줄(동기·선배·조교·교수) */
  title: string
  role: SchoolNpcRole
  gender: Gender
  personality: string
  /** 외형 — 4등신 도트 시트 키(예전 주인공 시트 hero-* 를 그대로 쓰거나, 리메이크 시트 npc-*) */
  sprite: SpriteSheet
  portrait: string
  /** 합류 가능 조건 */
  joinYear: number
  joinFlag?: string
  /** true = 입학과 동시에 파티 합류(1학년 동기) */
  starter?: boolean
  /** 전투 프로필 — 없으면 파티에 들어올 수 없다 */
  combat?: NpcCombatProfile
  /** 파티 화면 대사(합류 전/후) — 스토리 작업 시 교체 */
  lines: { recruit: string; idle: string }
}

export const SCHOOL_NPCS: SchoolNpc[] = [
  {
    id: 'comp-rian',
    name: '리안',
    title: '1학년 동기 · 돌격형',
    role: 'student',
    gender: 'male',
    personality: '앞뒤 재지 않고 먼저 뛰어드는 저돌적인 성격. 한번 불붙으면 좀처럼 물러서지 않는다.',
    sprite: 'hero-fire-male',
    portrait: '/images/portraits/hero-fire-male.png',
    joinYear: 1,
    starter: true,
    combat: {
      statMult: { atk: 1.15, matk: 1.1, def: 0.9 },
      defaultPosition: 'front',
      petDefId: 'pet-magma-pup',
      skills: [
        { skillId: 'fire-basic-1', level: 1 },
        { skillId: 'earth-basic-1', level: 3 },
        { skillId: 'fire-basic-3', level: 8 },
        { skillId: 'fire-adv-1', level: 16 },
        { skillId: 'fire-adv-2', level: 26 },
        { skillId: 'n-laststand', level: 34 },
        { skillId: 'fire-high-2', level: 48 },
        { skillId: 'fire-high-1', level: 58 },
        { skillId: 'fire-master-1', level: 75 },
      ],
    },
    lines: { recruit: '같은 반이지? 숲 실습 같이 가자. 앞은 내가 맡을게!', idle: '다음엔 더 센 놈이랑 붙어 보고 싶은데.' },
  },
  {
    id: 'comp-sella',
    name: '셀라',
    title: '1학년 동기 · 제어형',
    role: 'student',
    gender: 'female',
    personality: '냉철하고 분석적인 완벽주의자. 스스로에게 유독 엄격한 잣대를 들이댄다.',
    sprite: 'npc-sella', // 2026-10-02 삼면도 기반 리메이크 도트(PixelLab 6215ba84)
    portrait: '/images/portraits/hero-ice-female.png',
    joinYear: 1,
    starter: true,
    combat: {
      statMult: { mdef: 1.15, spd: 1.1, maxHp: 0.92 },
      defaultPosition: 'support',
      petDefId: 'pet-glacier-owl',
      skills: [
        { skillId: 'ice-basic-1', level: 1 },
        { skillId: 'n-firstaid', level: 4 },
        { skillId: 'ice-basic-3', level: 10 },
        { skillId: 'ice-adv-1', level: 18 },
        { skillId: 'ice-adv-2', level: 28 },
        { skillId: 'ice-adv-3', level: 36 },
        { skillId: 'dark-illusion', level: 46 },
        { skillId: 'ice-high-2', level: 60 },
        { skillId: 'ice-master-1', level: 78 },
      ],
    },
    lines: { recruit: '…혼자 다니면 위험해. 내가 적 발을 묶어 둘게.', idle: '노트 정리 끝나면 같이 복습할래?' },
  },
  {
    id: 'comp-doran',
    name: '도란',
    title: '1학년 동기 · 방어형',
    role: 'student',
    gender: 'male',
    personality: '말보다 행동으로 신뢰를 쌓는 우직한 성격. 든든한 존재감으로 곁을 지킨다.',
    sprite: 'hero-earth-male',
    portrait: '/images/portraits/hero-earth-male.png',
    joinYear: 1,
    starter: true,
    combat: {
      statMult: { maxHp: 1.2, def: 1.2, spd: 0.9 },
      defaultPosition: 'rear',
      petDefId: 'pet-golem-cub',
      skills: [
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'earth-basic-2', level: 5 },
        { skillId: 'n-firstaid', level: 9 },
        { skillId: 'earth-basic-3', level: 14 },
        { skillId: 'earth-adv-2', level: 24 },
        { skillId: 'earth-adv-3', level: 34 },
        { skillId: 'light-bulwark', level: 50 },
        { skillId: 'earth-high-1', level: 58 },
        { skillId: 'earth-master-1', level: 76 },
      ],
    },
    lines: { recruit: '힘 쓰는 일이면 나한테 맡겨. 뒤는 걱정 마.', idle: '공동 식당 오늘 메뉴 봤어?' },
  },
  {
    id: 'comp-yuna',
    name: '유나',
    title: '2학년 선배 · 회복형',
    role: 'student',
    gender: 'female',
    personality: '온화하지만 심지가 굳어 한번 정한 목표는 끝까지 밀어붙이는 뚝심이 있다.',
    sprite: 'hero-earth-female',
    portrait: '/images/portraits/hero-earth-female.png',
    joinYear: 2,
    combat: {
      statMult: { matk: 1.1, mdef: 1.1, atk: 0.85 },
      defaultPosition: 'rear',
      petDefId: 'pet-wisp',
      skills: [
        { skillId: 'light-heal', level: 1 },
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'light-purify', level: 12 },
        { skillId: 'light-might', level: 20 },
        { skillId: 'light-revive', level: 32 },
        { skillId: 'light-sanctuary', level: 44 },
        { skillId: 'light-ward', level: 56 },
        { skillId: 'light-rebirth', level: 80 },
      ],
    },
    lines: { recruit: '후배들끼리만 보내긴 불안하잖니. 다치면 바로 말해.', idle: '약초는 뿌리째 뽑으면 안 돼, 알지?' },
  },
  {
    id: 'comp-kael',
    name: '카엘',
    title: '빙결 수업 조교 · 전술형',
    role: 'story',
    gender: 'male',
    personality: '감정을 잘 드러내지 않는 차분한 성격이지만, 뒤에서 동료를 세심하게 챙기는 편이다.',
    sprite: 'hero-ice-male',
    portrait: '/images/portraits/hero-ice-male.png',
    joinYear: 2,
    joinFlag: 'COMP_KAEL_JOIN', // 스토리 이벤트로 열 예정
    combat: {
      statMult: { matk: 1.15, spd: 1.05 },
      defaultPosition: 'support',
      petDefId: 'pet-frostkit',
      skills: [
        { skillId: 'ice-basic-1', level: 1 },
        { skillId: 'dark-curse', level: 1 },
        { skillId: 'dark-veil', level: 14 },
        { skillId: 'ice-adv-2', level: 22 },
        { skillId: 'dark-execute', level: 30 },
        { skillId: 'dark-miasma', level: 42 },
        { skillId: 'ice-high-1', level: 54 },
        { skillId: 'dark-sentence', level: 72 },
      ],
    },
    lines: { recruit: '교수님 지시다. 이번 조사는 내가 동행한다.', idle: '보고서는 오늘 안에 내.' },
  },
  {
    id: 'comp-mirel',
    name: '미르엘 교수',
    title: '화염 수업 교수 · 게스트',
    role: 'professor',
    gender: 'female',
    personality: '승부욕이 남다르고 지는 걸 죽기보다 싫어한다. 자신감 넘치는 태도로 학생들의 시선을 끈다.',
    sprite: 'hero-fire-female',
    portrait: '/images/portraits/hero-fire-female.png',
    joinYear: 1,
    joinFlag: 'COMP_MIREL_JOIN', // 대원정 등 특정 스토리 구간에서만 합류(게스트)
    combat: {
      statMult: { matk: 1.25, maxMp: 1.2 },
      defaultPosition: 'rear',
      joinLevel: 40,
      petDefId: 'pet-shade',
      skills: [
        { skillId: 'fire-adv-2', level: 1 },
        { skillId: 'light-heal', level: 1 },
        { skillId: 'fire-high-1', level: 40 },
        { skillId: 'light-haste', level: 40 },
        { skillId: 'fire-master-1', level: 60 },
        { skillId: 'fire-master-2', level: 80 },
      ],
    },
    lines: { recruit: '이번 원정은 나도 함께 가마. 너무 기대지는 말고.', idle: '기초가 탄탄해야 극의에 닿는단다.' },
  },
]

/** 전투 프로필이 있는 학교 NPC(파티 편성 후보) */
export const COMBAT_NPCS = SCHOOL_NPCS.filter((n) => !!n.combat)

const BY_ID = new Map(SCHOOL_NPCS.map((c) => [c.id, c]))
export function schoolNpcById(id: string): SchoolNpc | undefined {
  return BY_ID.get(id)
}

/** 파티 슬롯 수 — 주인공을 뺀 나머지(펫은 슬롯을 차지하지 않는다) */
export const COMPANION_SLOTS = MAX_PARTY_SIZE - 1

export function canRecruit(state: Pick<GameState, 'calendar' | 'storyFlags' | 'settings'>, def: SchoolNpc): { ok: boolean; reason?: string } {
  if (!def.combat) return { ok: false, reason: '전투에 참가하지 않는 NPC' }
  if (state.storyFlags.DEBUG_UNLOCK_ALL) return { ok: true }
  const year = calendarInfo(state.calendar.globalWeek).year
  if (year < def.joinYear) return { ok: false, reason: `${def.joinYear}학년부터 합류 가능` }
  if (def.joinFlag && !flagOn(state, def.joinFlag)) return { ok: false, reason: '스토리 진행 후 합류' }
  return { ok: true }
}

export function companionStats(def: SchoolNpc, level: number): Stats {
  const base = computeStatsForLevel(level)
  const out = { ...base }
  const mult = def.combat?.statMult ?? {}
  for (const k of Object.keys(mult) as (keyof Stats)[]) {
    out[k] = Math.max(1, Math.round(base[k] * (mult[k] ?? 1)))
  }
  return out
}

export function companionSkills(def: SchoolNpc, level: number): string[] {
  return (def.combat?.skills ?? []).filter((s) => level >= s.level).map((s) => s.skillId)
}

export function createCompanionProgress(def: SchoolNpc, heroLevel: number): CompanionProgress {
  const level = def.combat?.joinLevel ?? Math.max(1, heroLevel)
  const stats = companionStats(def, level)
  return { level, exp: 0, hp: stats.maxHp, mp: stats.maxMp }
}

export function combatantFromCompanion(def: SchoolNpc, prog: CompanionProgress): Combatant {
  const stats = companionStats(def, prog.level)
  return {
    uid: `ally-${def.id}`,
    side: 'player',
    kind: 'ally',
    refId: def.id,
    name: def.name,
    icon: def.portrait,
    element: null,
    level: prog.level,
    stats,
    hp: Math.min(prog.hp, stats.maxHp),
    mp: Math.min(prog.mp, stats.maxMp),
    skills: companionSkills(def, prog.level),
    atb: 0,
    effects: [],
    appearance: { kind: 'hero', sheet: def.sprite },
    alive: prog.hp > 0,
  }
}

/** NPC 고정 펫 전투원 — 매 전투 가득 찬 상태로 나온다(호감도 '친밀' 고정) */
export function npcPetCombatant(def: SchoolNpc, level: number, ownerUid: string): Combatant | null {
  const petDef = def.combat ? petDefById(def.combat.petDefId) : undefined
  if (!petDef) return null
  const raw = petStatsForLevel(petDef, level)
  const stats = { ...raw }
  ;(Object.keys(stats) as (keyof Stats)[]).forEach((k) => (stats[k] = Math.max(1, Math.round(stats[k] * 1.05))))
  return {
    uid: `pet-${def.id}`,
    side: 'player',
    kind: 'pet',
    refId: petDef.id,
    name: `${def.name}의 ${petDef.name}`,
    icon: petDef.icon,
    element: petDef.element,
    level,
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    skills: [...petDef.innateSkills, ...petDef.trainableSkills.filter((t) => level >= t.minLevel).map((t) => t.skillId)],
    atb: 0,
    effects: [],
    ownerUid,
    bonusCrit: 0.05,
    alive: true,
  }
}
