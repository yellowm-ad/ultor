// ============================================================================
// 상태이상 (원작 9종) — 설계: Documents/울토르 시스템 DB.md §5, 속성 재배치는 PRD v2.0 §26
//   불꽃: 출혈·화상 / 얼음: 마비·감속 / 대지: 수면·약화 / 어둠: 감염·침묵·실명
//   빛은 상태이상을 걸지 않고 정화·회복·보호·부활에 집중한다.
// + 어둠 약화 효과(DebuffId) — 공격/방어/명중 감소, 환술. 정화로 함께 지워진다.
// battle-engine 이 이 모듈의 데이터/헬퍼를 사용해 매 행동마다 효과를 적용한다.
// ============================================================================
import type { Combatant, DebuffId, PlayerElement, Stats, StatusId } from '@/lib/types'

export interface StatusDef {
  id: StatusId
  name: string
  /** 로그/툴팁용 한 줄 설명 */
  desc: string
  defaultTurns: number
  /** 부여 성공 기본 확률(스킬 rider chance 와 곱해지지 않고, rider 가 우선) */
  baseChance: number
  /** 이 상태이상을 주로 거는 속성(§26) */
  element: PlayerElement
}

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  bleed: { id: 'bleed', name: '출혈', desc: '행동 시 최대 HP의 4% 물리 피해', defaultTurns: 3, baseChance: 0.4, element: 'fire' },
  infection: { id: 'infection', name: '감염', desc: '행동 시 최대 HP의 3% 피해, 같은 편에 전염될 수 있음', defaultTurns: 4, baseChance: 0.35, element: 'dark' },
  burn: { id: 'burn', name: '화상', desc: '행동 시 화염 지속 피해 + 공격력 15% 감소', defaultTurns: 3, baseChance: 0.4, element: 'fire' },
  paralysis: { id: 'paralysis', name: '마비', desc: '행동 시 35% 확률로 턴 상실, 속도 20% 감소', defaultTurns: 3, baseChance: 0.35, element: 'ice' },
  sleep: { id: 'sleep', name: '수면', desc: '행동 불가. 피격 시 즉시 해제', defaultTurns: 2, baseChance: 0.5, element: 'earth' },
  silence: { id: 'silence', name: '침묵', desc: '스킬 사용 불가(기본공격·아이템만)', defaultTurns: 3, baseChance: 0.45, element: 'dark' },
  blind: { id: 'blind', name: '실명', desc: '명중률 50% 감소', defaultTurns: 3, baseChance: 0.45, element: 'dark' },
  slow: { id: 'slow', name: '감속', desc: 'ATB 충전 40% 감소, 회피 불가', defaultTurns: 4, baseChance: 0.5, element: 'ice' },
  weaken: { id: 'weaken', name: '약화', desc: '공격력·방어력·마공·마방 20% 감소', defaultTurns: 3, baseChance: 0.45, element: 'earth' },
}

export const STATUS_LIST = Object.values(STATUS_DEFS)

/** 어둠 약화 효과 표시 정보 */
export const DEBUFF_DEFS: Record<DebuffId, { name: string; desc: string }> = {
  atkDown: { name: '공격 저하', desc: '공격력·마법 공격력 감소' },
  defDown: { name: '방어 저하', desc: '방어력·마법 방어력 감소' },
  accDown: { name: '명중 저하', desc: '명중률 감소' },
  illusion: { name: '환술', desc: '공격 대상이 뒤섞이고 명중률이 떨어진다' },
}

export function hasEffect(c: Combatant, id: string): boolean {
  return c.effects.some((e) => e.id === id)
}

/** 은신 — 단일 대상 공격의 표적이 되지 않는다 */
export function isStealthed(c: Combatant): boolean {
  return c.effects.some((e) => e.kind === 'buff' && e.id === 'stealth')
}

/** 환술 — 공격 대상 교란 확률(0~1). 걸려 있지 않으면 0 */
export function illusionChance(c: Combatant): number {
  const e = c.effects.find((x) => x.kind === 'debuff' && x.id === 'illusion')
  return e ? (e.magnitude ?? 0.5) : 0
}

/**
 * 어둠 약화 부여 — luck 저항으로 확률 감소, 이미 있으면 지속턴/수치 갱신.
 * @returns 실제 부여 여부
 */
export function applyDebuff(target: Combatant, id: DebuffId, magnitude: number, turns: number, chance = 1): boolean {
  const resist = Math.min(0.5, target.stats.luck * 0.008)
  if (Math.random() > Math.max(0.15, chance * (1 - resist))) return false
  const existing = target.effects.find((e) => e.kind === 'debuff' && e.id === id)
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, turns)
    existing.magnitude = Math.max(existing.magnitude ?? 0, magnitude)
    return true
  }
  target.effects.push({ key: newEffectKey('db'), kind: 'debuff', id, name: DEBUFF_DEFS[id].name, turnsLeft: turns, magnitude })
  return true
}

let effSeq = 0
export function newEffectKey(prefix = 'eff') {
  effSeq += 1
  return `${prefix}-${effSeq}`
}

export function hasStatus(c: Combatant, id: StatusId): boolean {
  return c.effects.some((e) => e.kind === 'status' && e.id === id)
}

/**
 * 상태이상 부여. luck 저항으로 확률 감소. 이미 있으면 지속턴 갱신(최댓값).
 * @returns 실제 부여 여부
 */
export function applyStatus(
  target: Combatant,
  id: StatusId,
  chance: number,
  turns: number | undefined,
  sourceMatk: number,
): boolean {
  const def = STATUS_DEFS[id]
  const resist = Math.min(0.6, target.stats.luck * 0.01)
  const finalChance = Math.max(0.1, chance * (1 - resist))
  if (Math.random() > finalChance) return false

  const dur = turns ?? def.defaultTurns
  const existing = target.effects.find((e) => e.kind === 'status' && e.id === id)
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, dur)
    existing.sourceMatk = sourceMatk
    return true
  }
  target.effects.push({
    key: newEffectKey('st'),
    kind: 'status',
    id,
    name: def.name,
    turnsLeft: dur,
    sourceMatk,
  })
  return true
}

/** 상태이상 + 약화 전체 해제(버프는 유지). @returns 해제된 개수 */
export function cleanseStatuses(target: Combatant): number {
  const before = target.effects.length
  target.effects = target.effects.filter((e) => e.kind === 'buff')
  return before - target.effects.length
}

/** 피격 시 호출 — 수면 해제 */
export function wakeOnHit(target: Combatant): boolean {
  const had = hasStatus(target, 'sleep')
  if (had) target.effects = target.effects.filter((e) => !(e.kind === 'status' && e.id === 'sleep'))
  return had
}

// ─── 스탯/전투 계산에 쓰이는 modifier ────────────────────────────────────────

/** 상태이상 + 버프를 반영한 실효 스탯 배수 계산 */
export function effectiveStatMultipliers(c: Combatant): Partial<Record<keyof Stats, number>> {
  const m: Partial<Record<keyof Stats, number>> = {}
  const mul = (k: keyof Stats, v: number) => (m[k] = (m[k] ?? 1) * v)

  for (const e of c.effects) {
    if (e.kind === 'status') {
      switch (e.id) {
        case 'burn':
          mul('atk', 0.85)
          break
        case 'paralysis':
          mul('spd', 0.8)
          break
        case 'weaken':
          mul('atk', 0.8)
          mul('def', 0.8)
          mul('matk', 0.8)
          mul('mdef', 0.8)
          break
      }
    } else if (e.kind === 'debuff') {
      const v = e.magnitude ?? 0.2
      switch (e.id) {
        case 'atkDown':
          mul('atk', 1 - v)
          mul('matk', 1 - v)
          break
        case 'defDown':
          mul('def', 1 - v)
          mul('mdef', 1 - v)
          break
      }
    } else {
      switch (e.id) {
        case 'atkUp':
          mul('atk', 1 + (e.magnitude ?? 0.2))
          break
        case 'defUp':
          mul('def', 1 + (e.magnitude ?? 0.2))
          break
        case 'matkUp':
          mul('matk', 1 + (e.magnitude ?? 0.2))
          break
        case 'mdefUp':
          mul('mdef', 1 + (e.magnitude ?? 0.2))
          break
        case 'defendGuard':
          mul('def', 1 + (e.magnitude ?? 0.5))
          mul('mdef', 1 + (e.magnitude ?? 0.5))
          break
        case 'ironWall':
          mul('def', 1 + (e.magnitude ?? 0.4))
          mul('mdef', 1 + (e.magnitude ?? 0.4))
          break
        case 'haste':
          mul('spd', 1 + (e.magnitude ?? 0.4))
          break
        case 'rally':
          mul('atk', 1 + (e.magnitude ?? 0.15))
          mul('matk', 1 + (e.magnitude ?? 0.15))
          break
      }
    }
  }
  return m
}

export function statWithEffects(c: Combatant, key: keyof Stats): number {
  const mult = effectiveStatMultipliers(c)[key] ?? 1
  return c.stats[key] * mult
}

/** ATB 충전 배수 (감속) */
export function atbRateFactor(c: Combatant): number {
  return hasStatus(c, 'slow') ? 0.6 : 1
}

/** 명중률 배수 (실명 · 명중 저하 · 환술) */
export function accuracyFactor(c: Combatant): number {
  let f = hasStatus(c, 'blind') ? 0.5 : 1
  for (const e of c.effects) {
    if (e.kind !== 'debuff') continue
    if (e.id === 'accDown') f *= 1 - (e.magnitude ?? 0.25)
    if (e.id === 'illusion') f *= 0.8
  }
  return f
}

/** 회피 가능 여부 (감속/수면이면 회피 0) */
export function canEvade(c: Combatant): boolean {
  return !hasStatus(c, 'slow') && !hasStatus(c, 'sleep')
}

/** 행동 불가 여부와 사유. sleep=완전 불가, paralysis=확률 */
export function actionBlock(c: Combatant): { blocked: boolean; reason?: string } {
  if (hasStatus(c, 'sleep')) return { blocked: true, reason: `${c.name}은(는) 잠들어 움직이지 못했다.` }
  if (hasStatus(c, 'paralysis') && Math.random() < 0.35)
    return { blocked: true, reason: `${c.name}은(는) 마비되어 움직이지 못했다!` }
  return { blocked: false }
}

export function skillBlocked(c: Combatant): boolean {
  return hasStatus(c, 'silence')
}

export interface DotResult {
  totalDamage: number
  logs: { text: string }[]
  spreadTo?: string // 감염 전염 대상 uid
}

/**
 * 행동 시작 시점의 지속피해(출혈/화상/감염) 처리.
 * combatant 배열을 받아 감염 전염 대상을 고를 수 있게 한다.
 */
export function tickDamageOverTime(c: Combatant, allies: Combatant[]): DotResult {
  const res: DotResult = { totalDamage: 0, logs: [] }
  for (const e of c.effects) {
    if (e.kind !== 'status') continue
    if (e.id === 'bleed') {
      const dmg = Math.max(1, Math.round(c.stats.maxHp * 0.04))
      res.totalDamage += dmg
      res.logs.push({ text: `${c.name}이(가) 출혈로 ${dmg} 피해를 입었다.` })
    } else if (e.id === 'burn') {
      const dmg = Math.max(1, Math.round((e.sourceMatk ?? c.stats.matk) * 0.6))
      res.totalDamage += dmg
      res.logs.push({ text: `${c.name}이(가) 화상으로 ${dmg} 피해를 입었다.` })
    } else if (e.id === 'infection') {
      const dmg = Math.max(1, Math.round(c.stats.maxHp * 0.03))
      res.totalDamage += dmg
      res.logs.push({ text: `${c.name}이(가) 감염으로 ${dmg} 피해를 입었다.` })
      if (Math.random() < 0.25) {
        const candidates = allies.filter(
          (a) => a.uid !== c.uid && a.alive && !a.effects.some((x) => x.kind === 'status' && x.id === 'infection'),
        )
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)]
          applyStatus(pick, 'infection', 1, e.turnsLeft, e.sourceMatk ?? c.stats.matk)
          res.spreadTo = pick.uid
          res.logs.push({ text: `감염이 ${pick.name}에게 번졌다!` })
        }
      }
    }
  }
  return res
}

/** 턴 종료 시 지속턴 감소, 만료 효과 제거. @returns 만료된 효과 이름들 */
export function decayEffects(c: Combatant): string[] {
  const expired: string[] = []
  c.effects = c.effects.filter((e) => {
    e.turnsLeft -= 1
    if (e.turnsLeft <= 0) {
      expired.push(e.name)
      return false
    }
    return true
  })
  return expired
}
