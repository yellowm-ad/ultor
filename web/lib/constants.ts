import type { Element, GameSettings, PlayerElement, Position, SkillElement, Stats } from '@/lib/types'

// ────────────────────────────────────────────────────────────────
// 맵 설정 — 셀 = 200m. 맵별 그리드 크기는 lib/maps.ts 의 GameMap.grid 참조.
// ────────────────────────────────────────────────────────────────
export const CELL_SIZE_METERS = 200
export const MONSTERS_PER_CELL = 1 // 200m 정사각형(셀 1칸)당 1마리

// ────────────────────────────────────────────────────────────────
// 속성(§PRD v2.0 §5~11) — 전직·속성 진화·캐릭터 고정 속성은 폐지.
//   플레이어 5속성: 불꽃 · 얼음 · 대지 · 어둠 · 빛 (전부 학교 수업으로 배운다)
//   바람: 오래전 유실된 속성 — 모르스만 사용(availability MORS_ONLY)
//   3원소 핵심 상성: 불꽃 > 얼음 > 대지 > 불꽃 (우위 1.5 / 열위 0.67)
//   어둠·빛·바람·속성 없음(null)은 상성 1.0 — 역할(디버프/회복 등)로 차별화한다.
// ────────────────────────────────────────────────────────────────
/** 플레이어가 배울 수 있는 속성 */
export const PLAYER_ELEMENTS: PlayerElement[] = ['fire', 'ice', 'earth', 'dark', 'light']
/** 3원소 — 1~2학년 기본 교육 */
export const TRIAD_ELEMENTS: PlayerElement[] = ['fire', 'ice', 'earth']
/** 모르스 전용 속성 보유자(몬스터 id) */
export const MORS_MONSTER_ID = 'mon-mors'

export interface ElementMeta {
  name: string
  /** 계열 이름(화염 마법 등) */
  line: string
  /** 전투 역할 요약(§25) */
  role: string
  color: string
  icon: string
  availability: 'player' | 'MORS_ONLY'
  strongAgainst?: Element
  weakAgainst?: Element
  blurb: string
}

export const ELEMENT_META: Record<Element, ElementMeta> = {
  fire: {
    name: '불꽃',
    line: '화염 마법',
    role: '공격 · 지속피해 · 압박',
    color: 'var(--elem-fire)',
    icon: '/images/elements/fire-crest.png',
    availability: 'player',
    strongAgainst: 'ice',
    weakAgainst: 'earth',
    blurb: '폭발적인 화력으로 적을 태우고 화상·출혈을 남긴다. 얼음에 강하고 대지에 약하다.',
  },
  ice: {
    name: '얼음',
    line: '빙결 마법',
    role: '제어 · 감속 · 마비',
    color: 'var(--elem-ice)',
    icon: '/images/elements/ice-crest.png',
    availability: 'player',
    strongAgainst: 'earth',
    weakAgainst: 'fire',
    blurb: '냉기로 적의 행동을 묶는다. 감속·마비에 특화되며 대지에 강하고 불꽃에 약하다.',
  },
  earth: {
    name: '대지',
    line: '대지 마법',
    role: '방어 · 보호 · 약화 · 수면',
    color: 'var(--elem-earth)',
    icon: '/images/elements/earth-crest.png',
    availability: 'player',
    strongAgainst: 'fire',
    weakAgainst: 'ice',
    blurb: '단단한 방어와 아군 보호, 약화·수면. 불꽃에 강하고 얼음에 약하다.',
  },
  dark: {
    name: '어둠',
    line: '암흑 마법',
    role: '디버프 · 환술 · 은신 · 즉사',
    color: 'var(--elem-dark)',
    icon: '/images/elements/dark-crest.png',
    availability: 'player',
    blurb: '적을 약화·교란하고 아군을 숨긴다. 일반 몬스터는 즉사시킬 수 있지만 보스에게는 통하지 않는다. 상성은 없다.',
  },
  light: {
    name: '빛',
    line: '광휘 마법',
    role: '회복 · 강화 · 정화 · 부활',
    color: 'var(--elem-light)',
    icon: '/images/elements/light-crest.png',
    availability: 'player',
    blurb: '아군을 치유·강화하고 상태이상을 씻어내며 쓰러진 동료를 되살린다. 상성은 없다.',
  },
  wind: {
    name: '바람',
    line: '유실된 바람',
    role: '모르스 전용',
    color: 'var(--elem-wind)',
    icon: '/images/elements/wind-crest.png',
    availability: 'MORS_ONLY',
    blurb: '오래전 인간의 마법 교육에서 끊긴 유실된 속성. 오직 모르스만이 다룬다.',
  },
}

/** 속성 없음(null) 표시용 메타 — 전투 속성이 아니라 UI 라벨 */
export const NO_ELEMENT_META = {
  name: '무',
  line: '속성 없음',
  color: 'var(--elem-neutral)',
  icon: '/images/elements/neutral-crest.png',
}

export function elementLabel(e: SkillElement): string {
  return e ? ELEMENT_META[e].name : NO_ELEMENT_META.name
}
export function elementIcon(e: SkillElement): string {
  return e ? ELEMENT_META[e].icon : NO_ELEMENT_META.icon
}
export function elementColor(e: SkillElement): string {
  return e ? ELEMENT_META[e].color : NO_ELEMENT_META.color
}

/** 상성 배율: 3원소끼리만 우위 1.5 / 열위 0.67, 그 외 1.0 */
export function elementMultiplier(attacker: SkillElement, defender: SkillElement): number {
  if (!attacker || !defender) return 1
  const meta = ELEMENT_META[attacker]
  if (meta.strongAgainst === defender) return 1.5
  if (meta.weakAgainst === defender) return 0.67
  return 1
}

// ────────────────────────────────────────────────────────────────
// 스탯 성장(§15) — 8스탯, 속성별 보정 없음. finalStat = round(BASE + GROWTH × (level − 1))
// ────────────────────────────────────────────────────────────────
export const BASE_STATS: Stats = {
  maxHp: 60,
  maxMp: 40,
  atk: 6,
  def: 4,
  matk: 8,
  mdef: 4,
  spd: 6,
  luck: 3,
}

export const STAT_GROWTH_PER_LEVEL: Stats = {
  maxHp: 14,
  maxMp: 8,
  atk: 2.2,
  def: 1.6,
  matk: 2.6,
  mdef: 1.6,
  spd: 1.2,
  luck: 0.8,
}

export const MAX_CHARACTER_LEVEL = 100

export function computeStatsForLevel(levelIn: number): Stats {
  const level = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, levelIn))
  const out = {} as Stats
  ;(Object.keys(BASE_STATS) as (keyof Stats)[]).forEach((key) => {
    out[key] = Math.max(1, Math.round(BASE_STATS[key] + STAT_GROWTH_PER_LEVEL[key] * (level - 1)))
  })
  return out
}

/**
 * 몬스터 데이터는 옛 50레벨 축으로 적혀 있다(lib/mock-data MONSTERS_LEGACY). 새 100레벨 축 = 2·옛 − 1.
 */
export function toLevel100(legacy: number): number {
  return Math.max(1, legacy * 2 - 1)
}

// ────────────────────────────────────────────────────────────────
// ATB 대기 게이지
// ────────────────────────────────────────────────────────────────
export const ATB = {
  THRESHOLD: 100,
  BASE_TICK: 8,
  REF_SPD: 20,
  SLOW_FACTOR: 0.6,
  DEFEND_GAIN: 20,
}

// ────────────────────────────────────────────────────────────────
// 4대4 전투 · 포지션(§16~20)
// ────────────────────────────────────────────────────────────────
/** 아군 핵심 전투원 수(주인공 + 학교 NPC 3). 펫은 여기에 포함되지 않는 부속 유닛 */
export const MAX_PARTY_SIZE = 4
/** 적 최대 수 */
export const MAX_ENEMIES = 4
/** 파티 등록 펫 최대 수 — 전위가 최대 2명이라 자연히 지켜진다 */
export const MAX_ACTIVE_PETS = 2
/** 전투에 들고 가는 스킬 슬롯 수 */
export const SKILL_LOADOUT_SIZE = 8

export const POSITIONS: Position[] = ['front', 'rear', 'support']

export const POSITION_META: Record<Position, { label: string; short: string; bonus: string; role: string }> = {
  front: { label: '전위', short: '전', bonus: '주는 피해 +10% · 펫 동행 가능', role: '메인 딜러 · 근접 · 펫 운용' },
  rear: { label: '후위', short: '후', bonus: '주는 회복량 +10%', role: '힐러 · 원거리 마법 · 안정적인 공격' },
  support: { label: '보조', short: '보', bonus: '최대 HP +10%', role: '버퍼 · 디버퍼 · 제어 · 생존 보조' },
}

/** 포지션 보너스(§18~19) — 해당 캐릭터에게만 적용 */
export const POSITION_BONUS = {
  frontDamage: 1.1,
  rearHealing: 1.1,
  supportMaxHp: 1.1,
}

/** 포지션별 인원 제한(§17) — 4명 기준. 합계는 파티 인원과 같아야 한다 */
export const FORMATION_LIMITS: Record<Position, { min: number; max: number }> = {
  front: { min: 1, max: 2 },
  rear: { min: 1, max: 2 },
  support: { min: 0, max: 1 },
}

export function countPositions(positions: Position[]): Record<Position, number> {
  const c: Record<Position, number> = { front: 0, rear: 0, support: 0 }
  for (const p of positions) c[p] += 1
  return c
}

/** 진형 검증 — 문제가 없으면 null, 있으면 사유 */
export function formationError(positions: Position[]): string | null {
  const c = countPositions(positions)
  // 인원이 4명 미만(관리자 샌드박스 등)이면 최소 인원 조건은 가능한 만큼만 본다
  const n = positions.length
  for (const p of POSITIONS) {
    const { min, max } = FORMATION_LIMITS[p]
    if (c[p] > max) return `${POSITION_META[p].label}는 최대 ${max}명까지 설 수 있습니다.`
    if (n >= MAX_PARTY_SIZE && c[p] < min) return `${POSITION_META[p].label}에 최소 ${min}명이 필요합니다.`
  }
  if (n > 0 && c.front === 0) return '전위에 최소 1명이 필요합니다.'
  return null
}

export const DEFAULT_SETTINGS: GameSettings = {
  testMode: true,
  bgmVolume: 60,
  sfxVolume: 80,
  battleAnimSpeed: 1,
}

export const STARTING_GOLD = 500
