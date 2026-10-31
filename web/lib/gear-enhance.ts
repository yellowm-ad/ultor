// ============================================================================
// 장비 강화(2026-10-31) — 설계: 울토르_시스템_개편_PRD_v2.1 §S3
//   · 제작대 「장비 강화」 탭에서 골드만 내고 +1 ~ +10 까지 강화한다. 재료는 쓰지 않는다.
//   · 실패해도 장비는 부서지지 않는다. 대신 +4 이상에서 실패하면 일정 확률로 한 단계 떨어진다.
//   · 등급(일반 → 유일)이 높을수록 성공 확률이 낮고 비용이 비싸다.
//   · 강화 단계마다 장비 기본 능력치 +10%. 처음 도달하는 단계에서는 잠재력(최대 4줄)이 무작위로 자란다
//     — +1·+3·+6·+9 에 새 줄이 열리고, 그 밖의 단계는 열린 줄 하나가 커진다. (떨어졌다 다시 오른 단계는 잠재력이 자라지 않는다)
//   · 강화 상태는 장비 id 단위로 저장(player.gear) — 같은 장비를 두 개 갖고 있으면 강화 상태를 함께 쓴다.
// ============================================================================
import type { GearMods, ItemDef, ItemRarity, PotentialLine, StatKey, Stats } from '@/lib/types'

export const ENHANCE_MAX = 10
export const POTENTIAL_MAX = 4
/** 새 잠재력 줄이 열리는 단계 */
export const POTENTIAL_OPEN_AT = [1, 3, 6, 9]

export const RARITY_LABEL: Record<ItemRarity, string> = { common: '일반', uncommon: '고급', rare: '희귀', mythic: '신화', unique: '유일' }

/** +L → +(L+1) 기본 성공률(일반 등급 기준, %) */
const BASE_RATE = [95, 90, 85, 75, 65, 55, 45, 35, 25, 15]
const RARITY_RATE: Record<ItemRarity, number> = { common: 1, uncommon: 0.9, rare: 0.8, mythic: 0.68, unique: 0.56 }
const RARITY_COST: Record<ItemRarity, number> = { common: 120, uncommon: 300, rare: 700, mythic: 1500, unique: 3000 }

export function isEnhanceable(item: ItemDef | undefined): item is ItemDef {
  return !!item && (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory')
}

export const rarityOf = (item: ItemDef): ItemRarity => item.rarity ?? 'common'

export function gearOf(gear: Record<string, GearMods> | undefined, itemId: string): GearMods {
  return gear?.[itemId] ?? { enh: 0, best: 0, pot: [] }
}

/** 성공 확률(0~1) */
export function enhanceSuccessRate(item: ItemDef, enh: number): number {
  if (enh >= ENHANCE_MAX) return 0
  return Math.max(0.03, (BASE_RATE[enh] / 100) * RARITY_RATE[rarityOf(item)])
}
/** 실패 시 한 단계 떨어질 확률(0~1) — +4 미만은 유지 */
export function enhanceDropRate(enh: number): number {
  if (enh < 4) return 0
  return Math.min(0.6, 0.25 + (enh - 4) * 0.06)
}
/** 강화 비용(골드) */
export function enhanceCost(item: ItemDef, enh: number): number {
  return Math.round((RARITY_COST[rarityOf(item)] * (1 + enh * 0.65) * (1 + (item.tier ?? 1) * 0.15)) / 10) * 10
}

/** 강화 단계가 반영된 기본 능력치(잠재력 제외) */
export function enhancedBonus(item: ItemDef, enh: number): Partial<Stats> {
  const out: Partial<Stats> = {}
  for (const [k, v] of Object.entries(item.statBonus ?? {}) as [StatKey, number][]) {
    out[k] = v + (v > 0 ? Math.ceil((v * enh) / 10) : 0)
  }
  return out
}

/** 장비 하나의 총 보너스(강화 + 잠재력) */
export function gearTotalBonus(item: ItemDef, mods: GearMods): Partial<Stats> {
  const out = enhancedBonus(item, mods.enh)
  for (const p of mods.pot) out[p.stat] = (out[p.stat] ?? 0) + p.value
  return out
}

// ── 잠재력 ───────────────────────────────────────────────────────────────────
const POT_STATS: StatKey[] = ['maxHp', 'maxMp', 'atk', 'def', 'matk', 'mdef', 'spd', 'luck']
/** 한 번 자랄 때 오르는 폭(티어 1 기준) */
const POT_STEP: Record<StatKey, [number, number]> = {
  maxHp: [8, 18],
  maxMp: [5, 12],
  atk: [1, 3],
  def: [1, 3],
  matk: [1, 3],
  mdef: [1, 3],
  spd: [1, 2],
  luck: [1, 2],
}
/** 무기는 공격 쪽, 방어구는 방어 쪽 잠재력이 더 잘 붙는다 */
function potWeights(item: ItemDef): Record<StatKey, number> {
  const w: Record<StatKey, number> = { maxHp: 2, maxMp: 2, atk: 1.5, def: 1.5, matk: 1.5, mdef: 1.5, spd: 1, luck: 1 }
  if (item.type === 'weapon') Object.assign(w, { atk: 3, matk: 3.5, luck: 1.5 })
  if (item.type === 'armor') Object.assign(w, { def: 3, mdef: 3, maxHp: 3 })
  if (item.type === 'accessory') Object.assign(w, { spd: 2, luck: 2, maxMp: 2.5 })
  return w
}

function rollStep(item: ItemDef, stat: StatKey, rand: () => number): number {
  const [a, b] = POT_STEP[stat]
  const scale = 1 + ((item.tier ?? 1) - 1) * 0.6
  return Math.max(1, Math.round((a + rand() * (b - a)) * scale))
}

function growPotential(item: ItemDef, pot: PotentialLine[], level: number, rand: () => number): PotentialLine[] {
  const out = pot.map((p) => ({ ...p }))
  if (POTENTIAL_OPEN_AT.includes(level) && out.length < POTENTIAL_MAX) {
    const w = potWeights(item)
    const free = POT_STATS.filter((k) => !out.some((p) => p.stat === k))
    const total = free.reduce((s, k) => s + w[k], 0)
    let r = rand() * total
    const stat = free.find((k) => (r -= w[k]) <= 0) ?? free[free.length - 1]
    out.push({ stat, value: rollStep(item, stat, rand) })
  } else if (out.length) {
    const p = out[Math.floor(rand() * out.length)]
    p.value += rollStep(item, p.stat, rand)
  }
  return out
}

export type EnhanceOutcome = 'success' | 'keep' | 'drop'

/** 강화 1회 — rand 는 리듀서 밖에서 주입(테스트 재현용) */
export function enhanceOnce(item: ItemDef, mods: GearMods, rand: () => number = Math.random): { mods: GearMods; outcome: EnhanceOutcome } {
  if (mods.enh >= ENHANCE_MAX) return { mods, outcome: 'keep' }
  if (rand() < enhanceSuccessRate(item, mods.enh)) {
    const enh = mods.enh + 1
    const fresh = enh > mods.best
    return { mods: { enh, best: Math.max(mods.best, enh), pot: fresh ? growPotential(item, mods.pot, enh, rand) : mods.pot }, outcome: 'success' }
  }
  if (rand() < enhanceDropRate(mods.enh)) return { mods: { ...mods, enh: mods.enh - 1 }, outcome: 'drop' }
  return { mods, outcome: 'keep' }
}

/** 장비 이름 + 강화 단계 */
export function gearName(item: ItemDef, mods?: GearMods): string {
  return mods && mods.enh > 0 ? `${item.name} +${mods.enh}` : item.name
}

/** 능력치 짧은 이름(잠재력 줄 표기) */
export const STAT_SHORT: Record<StatKey, string> = { maxHp: 'HP', maxMp: 'MP', atk: '공격', def: '방어', matk: '마공', mdef: '마방', spd: '속도', luck: '행운' }
