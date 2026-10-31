// ============================================================================
// 소환수 — 설계: 울토르_시스템_개편_PRD_v2.1 §S2 (2026-10-31 개편)
//   펫을 기르고 먹이 주던 시스템은 폐지됐다. 예전 펫 8종은 '소환 마법'으로 부르는 소환수가 된다.
//   · 소환 마법(스킬 kind 'summon')을 쓰면 소환수가 전장에 나와 2턴(숙련도 7부터 3턴) 동안 자동으로 싸우고 돌아간다.
//   · 소환수 능력치 = 시전자 레벨 성장식 × 소환 마법 숙련도 배율. 숙련도 4·8 에서 소환수가 기술을 하나씩 더 쓴다.
//   · 한 번에 한 마리 — 소환 중에 다시 부르면 먼저 있던 소환수가 돌아가고 새로 나온다.
// ============================================================================
import type { Combatant, PetDef, Stats } from '@/lib/types'
import { masteryPowerMult } from '@/lib/skill-mastery'

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

/** 소환수 8종(옛 펫 도감). innateSkills = 처음부터 쓰는 기술, trainableSkills[i].minLevel = 그 기술이 열리는 소환 마법 숙련도 */
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
      { skillId: 'pet-fire-breath', minLevel: 4, costGold: 0 },
      { skillId: 'pet-guard', minLevel: 8, costGold: 0 },
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
      { skillId: 'pet-burn-fang', minLevel: 4, costGold: 0 },
      { skillId: 'pet-roar-atk', minLevel: 8, costGold: 0 },
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
      { skillId: 'pet-frost-nip', minLevel: 4, costGold: 0 },
      { skillId: 'pet-slow-howl', minLevel: 8, costGold: 0 },
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
      { skillId: 'pet-ice-shard', minLevel: 4, costGold: 0 },
      { skillId: 'pet-mp-song', minLevel: 8, costGold: 0 },
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
      { skillId: 'pet-stone-skin', minLevel: 4, costGold: 0 },
      { skillId: 'pet-taunt', minLevel: 8, costGold: 0 },
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
      { skillId: 'pet-quake-stomp', minLevel: 4, costGold: 0 },
      { skillId: 'pet-shield-ally', minLevel: 8, costGold: 0 },
    ],
  },
  {
    id: 'pet-wisp',
    name: '하양',
    species: '빛 정령',
    element: 'light',
    icon: '/images/pets/wisp.png',
    rarity: 'special',
    baseStats: common({ maxMp: 40, matk: 7, mdef: 6, spd: 8, luck: 6 }),
    growth: { maxHp: 7, maxMp: 9, atk: 0.5, matk: 1.6, def: 0.6, mdef: 1.1, spd: 1.1, luck: 0.9 },
    innateSkills: ['pet-glow'],
    trainableSkills: [
      { skillId: 'pet-heal-lite', minLevel: 4, costGold: 0 },
      { skillId: 'pet-cleanse', minLevel: 8, costGold: 0 },
    ],
  },
  {
    id: 'pet-shade',
    name: '그늘',
    species: '그림자 고양이',
    element: 'dark',
    icon: '/images/pets/shade.png',
    rarity: 'special',
    baseStats: common({ atk: 8, matk: 6, spd: 11, luck: 7 }),
    growth: { maxHp: 8, maxMp: 5, atk: 1.6, matk: 1.2, def: 0.6, mdef: 0.7, spd: 1.5, luck: 1 },
    innateSkills: ['pet-shadow-claw'],
    trainableSkills: [
      { skillId: 'pet-silence-hiss', minLevel: 4, costGold: 0 },
      { skillId: 'pet-blind-dust', minLevel: 8, costGold: 0 },
    ],
  },
]

export function petDefById(id: string): PetDef | undefined {
  return PET_DEFS.find((p) => p.id === id)
}

/** 소환 마법 id ↔ 소환수 id */
export const summonSkillIdOf = (petId: string) => `summon-${petId.replace(/^pet-/, '')}`

/** 소환수 전투원 — 시전자 레벨·숙련도로 능력치를 정한다 */
export function summonCombatant(def: PetDef, owner: Combatant, masteryLv: number, turns: number): Combatant {
  const mult = masteryPowerMult(masteryLv)
  const stats = { ...def.baseStats }
  ;(Object.keys(stats) as (keyof Stats)[]).forEach((k) => {
    // 시전자 레벨을 따라 자란다(옛 펫 성장식 그대로) — 숙련도가 오를수록 더 강하게
    stats[k] = Math.max(1, Math.round((def.baseStats[k] + (def.growth[k] ?? 0) * (Math.max(1, owner.level) - 1)) * mult))
  })
  const skills = [...def.innateSkills, ...def.trainableSkills.filter((t) => masteryLv >= t.minLevel).map((t) => t.skillId)]
  return {
    uid: `summon-${def.id}`,
    side: owner.side,
    kind: 'pet',
    refId: def.id,
    name: def.name,
    icon: def.icon,
    element: def.element,
    level: owner.level,
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    skills,
    atb: 60, // 나오자마자 곧 움직이게
    effects: [],
    ownerUid: owner.uid,
    summonTurns: turns,
    alive: true,
  }
}
