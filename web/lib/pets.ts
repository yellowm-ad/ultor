// ============================================================================
// 펫 시스템 — 설계: Documents/울토르 시스템 DB.md §6
// 도감 8종 + 호감도 4구간 + 스킬 훈련.
// ============================================================================
import type { AffectionTier, Element, Pet, PetDef, Stats } from '@/lib/types'

const common = (s: Partial<Stats>): Stats => ({
  maxHp: 40,
  maxMp: 20,
  atk: 5,
  def: 3,
  matk: 4,
  mdef: 3,
  spd: 7,
  luck: 4,
  ...s,
})

export const PET_DEFS: PetDef[] = [
  {
    id: 'pet-emberling',
    name: '이글릿',
    species: '불도마뱀',
    element: 'fire',
    icon: '/images/pets/emberling.png',
    rarity: 'common',
    baseStats: common({ atk: 6, matk: 6 }),
    growth: { maxHp: 9, maxMp: 4, atk: 1.4, matk: 1.4, def: 0.7, mdef: 0.7, spd: 1, luck: 0.5 },
    innateSkills: ['pet-scratch'],
    trainableSkills: [
      { skillId: 'pet-fire-breath', minLevel: 9, costGold: 400 },
      { skillId: 'pet-guard', minLevel: 15, costGold: 600 },
    ],
  },
  {
    id: 'pet-magma-pup',
    name: '마그누',
    species: '용암 강아지',
    element: 'fire',
    icon: '/images/pets/magma-pup.png',
    rarity: 'rare',
    baseStats: common({ maxHp: 52, atk: 8, def: 4 }),
    growth: { maxHp: 12, maxMp: 4, atk: 1.7, matk: 1.1, def: 1, mdef: 0.8, spd: 1, luck: 0.5 },
    innateSkills: ['pet-bite'],
    trainableSkills: [
      { skillId: 'pet-burn-fang', minLevel: 11, costGold: 700 },
      { skillId: 'pet-roar-atk', minLevel: 23, costGold: 1200 },
    ],
  },
  {
    id: 'pet-frostkit',
    name: '서리',
    species: '눈여우',
    element: 'ice',
    icon: '/images/pets/frostkit.png',
    rarity: 'common',
    baseStats: common({ matk: 6, spd: 8, mdef: 4 }),
    growth: { maxHp: 8, maxMp: 6, atk: 1, matk: 1.5, def: 0.6, mdef: 0.9, spd: 1.2, luck: 0.6 },
    innateSkills: ['pet-scratch'],
    trainableSkills: [
      { skillId: 'pet-frost-nip', minLevel: 9, costGold: 400 },
      { skillId: 'pet-slow-howl', minLevel: 17, costGold: 650 },
    ],
  },
  {
    id: 'pet-glacier-owl',
    name: '서리깃',
    species: '빙하 올빼미',
    element: 'ice',
    icon: '/images/pets/glacier-owl.png',
    rarity: 'rare',
    baseStats: common({ maxMp: 32, matk: 8, mdef: 5, spd: 9 }),
    growth: { maxHp: 7, maxMp: 8, atk: 0.8, matk: 1.8, def: 0.6, mdef: 1, spd: 1.3, luck: 0.7 },
    innateSkills: ['pet-peck'],
    trainableSkills: [
      { skillId: 'pet-ice-shard', minLevel: 11, costGold: 700 },
      { skillId: 'pet-mp-song', minLevel: 23, costGold: 1200 },
    ],
  },
  {
    id: 'pet-pebblemole',
    name: '모구',
    species: '돌두더지',
    element: 'earth',
    icon: '/images/pets/pebblemole.png',
    rarity: 'common',
    baseStats: common({ maxHp: 56, def: 6, mdef: 5, spd: 5 }),
    growth: { maxHp: 14, maxMp: 3, atk: 1.1, matk: 0.8, def: 1.2, mdef: 1, spd: 0.7, luck: 0.4 },
    innateSkills: ['pet-headbutt'],
    trainableSkills: [
      { skillId: 'pet-stone-skin', minLevel: 9, costGold: 400 },
      { skillId: 'pet-taunt', minLevel: 15, costGold: 600 },
    ],
  },
  {
    id: 'pet-golem-cub',
    name: '바우',
    species: '꼬마 골렘',
    element: 'earth',
    icon: '/images/pets/golem-cub.png',
    rarity: 'rare',
    baseStats: common({ maxHp: 68, atk: 7, def: 8, mdef: 6, spd: 4 }),
    growth: { maxHp: 17, maxMp: 3, atk: 1.4, matk: 0.6, def: 1.5, mdef: 1.1, spd: 0.6, luck: 0.4 },
    innateSkills: ['pet-slam'],
    trainableSkills: [
      { skillId: 'pet-quake-stomp', minLevel: 13, costGold: 800 },
      { skillId: 'pet-shield-ally', minLevel: 23, costGold: 1300 },
    ],
  },
  {
    id: 'pet-wisp',
    name: '하양',
    species: '빛 정령',
    element: 'neutral',
    icon: '/images/pets/wisp.png',
    rarity: 'special',
    baseStats: common({ maxMp: 40, matk: 7, mdef: 6, spd: 8, luck: 6 }),
    growth: { maxHp: 7, maxMp: 9, atk: 0.5, matk: 1.6, def: 0.6, mdef: 1.1, spd: 1.1, luck: 0.9 },
    innateSkills: ['pet-glow'],
    trainableSkills: [
      { skillId: 'pet-heal-lite', minLevel: 7, costGold: 600 },
      { skillId: 'pet-cleanse', minLevel: 19, costGold: 1100 },
    ],
  },
  {
    id: 'pet-shade',
    name: '그늘',
    species: '그림자 고양이',
    element: 'neutral',
    icon: '/images/pets/shade.png',
    rarity: 'special',
    baseStats: common({ atk: 8, matk: 6, spd: 11, luck: 7 }),
    growth: { maxHp: 8, maxMp: 5, atk: 1.6, matk: 1.2, def: 0.6, mdef: 0.7, spd: 1.5, luck: 1 },
    innateSkills: ['pet-shadow-claw'],
    trainableSkills: [
      { skillId: 'pet-silence-hiss', minLevel: 11, costGold: 800 },
      { skillId: 'pet-blind-dust', minLevel: 21, costGold: 1200 },
    ],
  },
]

export function petDefById(id: string): PetDef | undefined {
  return PET_DEFS.find((p) => p.id === id)
}

/** 속성별 스타터 펫 매핑 */
export const STARTER_PET_BY_ELEMENT: Record<Element, string> = {
  fire: 'pet-emberling',
  ice: 'pet-frostkit',
  earth: 'pet-pebblemole',
}

export function petStatsForLevel(def: PetDef, level: number): Stats {
  const out = { ...def.baseStats }
  ;(Object.keys(out) as (keyof Stats)[]).forEach((k) => {
    // 레벨 100 확장 — 기존(50 기준) 성장률을 유지하도록 레벨을 환산(constants.legacyLevel)
    out[k] = Math.max(1, Math.round(def.baseStats[k] + (def.growth[k] ?? 0) * ((level + 1) / 2 - 1)))
  })
  return out
}

export function createPet(defId: string, opts?: { level?: number; affection?: number; nickname?: string }): Pet {
  const def = petDefById(defId)!
  const level = opts?.level ?? 1
  const stats = petStatsForLevel(def, level)
  return {
    defId,
    nickname: opts?.nickname ?? def.name,
    level,
    exp: 0,
    affection: opts?.affection ?? 40,
    learnedSkills: [...def.innateSkills],
    hp: stats.maxHp,
    mp: stats.maxMp,
  }
}

// ─── 호감도 ──────────────────────────────────────────────────────────────────

export function affectionTier(affection: number): AffectionTier {
  if (affection >= 75) return 'devoted'
  if (affection >= 50) return 'close'
  if (affection >= 20) return 'familiar'
  return 'unfamiliar'
}

export const AFFECTION_TIER_META: Record<
  AffectionTier,
  { label: string; statMult: number; critBonus: number; disobeyChance: number; supportChance: number; note: string }
> = {
  unfamiliar: { label: '낯섦', statMult: 1.0, critBonus: 0, disobeyChance: 0.1, supportChance: 0, note: '가끔 명령을 무시한다' },
  familiar: { label: '익숙', statMult: 1.0, critBonus: 0, disobeyChance: 0, supportChance: 0, note: '정상 참여' },
  close: { label: '친밀', statMult: 1.05, critBonus: 0.05, disobeyChance: 0, supportChance: 0, note: '전 스탯 +5%, 치명타 +5%' },
  devoted: { label: '헌신', statMult: 1.12, critBonus: 0.05, disobeyChance: 0, supportChance: 0.25, note: '전 스탯 +12%, 25% 확률 지원 공격' },
}

export function clampAffection(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// ─── 스킬 훈련 ───────────────────────────────────────────────────────────────

export interface TrainCheck {
  ok: boolean
  reason?: string
}

export function canTrain(pet: Pet, skillId: string, gold: number, hasItem: (id: string) => boolean): TrainCheck {
  const def = petDefById(pet.defId)
  const t = def?.trainableSkills.find((s) => s.skillId === skillId)
  if (!t) return { ok: false, reason: '이 펫이 배울 수 없는 스킬입니다.' }
  if (pet.learnedSkills.includes(skillId)) return { ok: false, reason: '이미 배운 스킬입니다.' }
  if (pet.level < t.minLevel) return { ok: false, reason: `펫 레벨 ${t.minLevel} 이상 필요합니다.` }
  if (gold < t.costGold) return { ok: false, reason: '골드가 부족합니다.' }
  if (t.costItemId && !hasItem(t.costItemId)) return { ok: false, reason: '훈련서가 필요합니다.' }
  return { ok: true }
}
