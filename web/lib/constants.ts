import type { Element, ElementOrNeutral, GameSettings, JobTier, JobTierId, Stats } from '@/lib/types'

// ────────────────────────────────────────────────────────────────
// 맵 설정 — 셀 = 200m. 맵별 그리드 크기는 lib/maps.ts 의 GameMap.grid 참조.
// ────────────────────────────────────────────────────────────────
export const CELL_SIZE_METERS = 200
export const MONSTERS_PER_CELL = 1 // 200m 정사각형(셀 1칸)당 1마리

// ────────────────────────────────────────────────────────────────
// 전직 5단계 — 견습생 → 수습 마도사 → 정마도사 → 상급 마도사 → 삼원 대현자
// (Lv 1/10/20/30/40). 울토르 마법학교의 삼원(三源) 학제 승급 단계.
// ────────────────────────────────────────────────────────────────
export const JOB_TIERS: JobTier[] = [
  { id: 'apprentice', order: 0, name: '견습생', shortName: '견습', minLevel: 1, description: '울토르 마법학교에 갓 입학한 삼원 견습생.' },
  { id: 'novice', order: 1, name: '수습 마도사', shortName: '수습', minLevel: 20, description: '삼원 기초 학제를 수료한 수습 마도사.' },
  { id: 'adept', order: 2, name: '정마도사', shortName: '정마도사', minLevel: 40, description: '한 계통을 온전히 다루는 정식 마도사.' },
  { id: 'magus', order: 3, name: '상급 마도사', shortName: '상급', minLevel: 60, description: '계통의 2차 정수(번개·물·풀)를 각성한 상급 마도사.' },
  { id: 'archmagus', order: 4, name: '삼원 대현자', shortName: '대현자', minLevel: 80, description: '계통의 극의(빛·우주·어둠)에 도달한 울토르 최고위, 삼원 대현자.' },
]

export const JOB_TIER_ORDER: JobTierId[] = ['apprentice', 'novice', 'adept', 'magus', 'archmagus']

export function jobTierForLevel(level: number): JobTier {
  let best = JOB_TIERS[0]
  for (const t of JOB_TIERS) if (level >= t.minLevel) best = t
  return best
}

export function nextJobTier(currentId: JobTierId): JobTier | null {
  const cur = JOB_TIERS.find((t) => t.id === currentId)!
  return JOB_TIERS.find((t) => t.order === cur.order + 1) ?? null
}

export function jobTierAtLeast(have: JobTierId, need: JobTierId): boolean {
  return JOB_TIER_ORDER.indexOf(have) >= JOB_TIER_ORDER.indexOf(need)
}

// ────────────────────────────────────────────────────────────────
// 삼원(三源) — 화염계 > 빙결계 > 대지계 > 화염계 (상성 순환)
//   화염계: 불 → 번개 → 빛 (시간)   빙결계: 얼음 → 물 → 우주 (공간)
//   대지계: 흙 → 풀 → 어둠 (죽음)
//   evolution = [Lv1 1차, Lv30 2차, Lv40 극의]
// ────────────────────────────────────────────────────────────────
export const ELEMENTS: Element[] = ['fire', 'ice', 'earth']

export const ELEMENT_META: Record<
  ElementOrNeutral,
  {
    name: string
    line: string
    evolution: [string, string, string]
    apex: string
    color: string
    icon: string
    leanStats: Partial<Stats>
    strongAgainst: ElementOrNeutral
    weakAgainst: ElementOrNeutral
    blurb: string
  }
> = {
  fire: {
    name: '불',
    line: '화염계',
    evolution: ['불', '번개', '빛'],
    apex: '시간',
    color: 'var(--elem-fire)',
    icon: '/images/elements/fire-crest.png',
    leanStats: { matk: 3, atk: 1 },
    strongAgainst: 'ice',
    weakAgainst: 'earth',
    blurb: '화염계 — 불로 시작해 번개를 거쳐 빛(시간)에 이르는 계통. 폭발적인 마법공격력으로 적을 태우고 화상을 입힌다. 빙결계에 강하고 대지계에 약하다.',
  },
  ice: {
    name: '얼음',
    line: '빙결계',
    evolution: ['얼음', '물', '우주'],
    apex: '공간',
    color: 'var(--elem-ice)',
    icon: '/images/elements/ice-crest.png',
    leanStats: { mdef: 2, maxMp: 10, spd: -1 },
    strongAgainst: 'earth',
    weakAgainst: 'fire',
    blurb: '빙결계 — 얼음에서 물을 거쳐 우주(공간)에 이르는 계통. 냉기로 적의 행동을 묶는 제어 마법. 감속·마비에 특화되며 대지계에 강하고 화염계에 약하다.',
  },
  earth: {
    name: '흙',
    line: '대지계',
    evolution: ['흙', '풀', '어둠'],
    apex: '죽음',
    color: 'var(--elem-earth)',
    icon: '/images/elements/earth-crest.png',
    leanStats: { def: 2, maxHp: 15 },
    strongAgainst: 'fire',
    weakAgainst: 'ice',
    blurb: '대지계 — 흙에서 풀을 거쳐 어둠(죽음)에 이르는 계통. 단단한 방어와 약화·수면. 체력과 방어력에 특화되며 화염계에 강하고 빙결계에 약하다.',
  },
  neutral: {
    name: '무',
    line: '무속성',
    evolution: ['무', '무', '무'],
    apex: '무',
    color: 'var(--elem-neutral)',
    icon: '/images/elements/neutral-crest.png',
    leanStats: {},
    strongAgainst: 'neutral',
    weakAgainst: 'neutral',
    blurb: '삼원 어디에도 속하지 않는다. 상성의 영향을 주고받지 않는다.',
  },
}

/** 상성 배율: 우위 1.5 / 열위 0.67 / 그 외 1.0 */
export function elementMultiplier(attacker: ElementOrNeutral, defender: ElementOrNeutral): number {
  if (attacker === 'neutral' || defender === 'neutral') return 1
  const meta = ELEMENT_META[attacker]
  if (meta.strongAgainst === defender) return 1.5
  if (meta.weakAgainst === defender) return 0.67
  return 1
}

// ────────────────────────────────────────────────────────────────
// 스탯 기본값 / 성장
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

/**
 * 레벨 상한 100 확장(2026-09-28) — 기존 밸런스는 레벨 50 기준으로 잡혀 있었다.
 * 스탯·몬스터 수치는 그대로 두고 레벨 축만 2배로 늘리기 위해, 새 레벨 L 을 기존 레벨 (L+1)/2 로 환산해 계산한다.
 *   새 1 → 기존 1,  새 99 → 기존 50,  새 100 → 기존 50.5
 * 몬스터/지역 권장 레벨 데이터는 toLevel100(기존) = 2·기존 − 1 로 옮겼다.
 */
export const MAX_CHARACTER_LEVEL = 100
export function legacyLevel(level: number): number {
  return (level + 1) / 2
}
export function toLevel100(legacy: number): number {
  return Math.max(1, legacy * 2 - 1)
}

export function computeStatsForLevel(element: ElementOrNeutral, levelIn: number): Stats {
  const level = legacyLevel(levelIn)
  const lean = ELEMENT_META[element].leanStats
  const out = {} as Stats
  ;(Object.keys(BASE_STATS) as (keyof Stats)[]).forEach((key) => {
    const base = BASE_STATS[key]
    const growth = STAT_GROWTH_PER_LEVEL[key] * (level - 1)
    const leanBonus = (lean[key] ?? 0) * level * 0.4
    out[key] = Math.max(1, Math.round(base + growth + leanBonus))
  })
  return out
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
// 파티 / 기타
// ────────────────────────────────────────────────────────────────
export const MAX_PARTY_SIZE = 4
export const MAX_ACTIVE_PETS = 2

export const DEFAULT_SETTINGS: GameSettings = {
  testMode: true,
  bgmVolume: 60,
  sfxVolume: 80,
  battleAnimSpeed: 1,
}

export const STARTING_GOLD = 500
