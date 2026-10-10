import type { BattleFx } from '@/lib/types'

// ============================================================================
// 스킬 모션의 길이와 갈래 — 간결한 기술은 1초, 궁극기는 기를 모으고 마법진을 깔고 길게 쏟아내 최대 5초.
// 전투 화면(battle-screen)은 totalMs 동안 다음 행동을 멈추고, impactMs 가 될 때까지 HP·로그 반영을 미룬다.
// 연출 그림은 components/game/skill-fx.tsx 가 같은 값을 받아 그린다.
// ============================================================================

export type MotionTier = 1 | 2 | 3 | 4

/**
 * quick    기본 공격·물리 기술 — 바로 친다
 * bolt     작은 마법탄
 * beam     빔 — 시전자에게서 대상까지 쭉 뻗어 한동안 유지된다
 * rain     하늘에서 쏟아지는 파편(얼음)
 * erupt    대상 발밑에서 솟구치는 바위(대지)
 * gale     전장을 가르는 바람 줄기(바람)
 * pillar   내리꽂히는 빛기둥(빛·무속성 광역)
 * support  회복·강화·약화·도구
 */
export type MotionStyle = 'quick' | 'bolt' | 'beam' | 'rain' | 'erupt' | 'gale' | 'pillar' | 'support'

export interface SkillMotion {
  style: MotionStyle
  tier: MotionTier
  /** 궁극기 — 화면이 어두워지고 기술 이름이 뜬다 */
  ultimate: boolean
  /** 기를 모으는 시간(0 = 없음) */
  castMs: number
  /** 첫 타격이 닿는 시각 — 이때 HP·로그가 반영된다 */
  impactMs: number
  /** 쏟아붓는 구간에 타격이 몇 번 터지는가 */
  waves: number
  /** 타격과 타격 사이 간격 */
  waveGapMs: number
  /** 마지막 큰 폭발 시각(궁극기) */
  finaleMs: number
  /** 연출 전체 길이 — 이 동안 다음 행동이 멈춘다 */
  totalMs: number
}

/** MP 소모량(+ 전체 대상 여부)으로 연출 등급을 산정 — 클수록 더 화려한 연출이 추가된다. */
export function fxTier(fx: Pick<BattleFx, 'mpCost' | 'aoe'>): MotionTier {
  const mp = fx.mpCost ?? 0
  let t: MotionTier = mp >= 18 ? 4 : mp >= 11 ? 3 : mp >= 7 ? 2 : 1
  if (fx.aoe && t < 2) t = 2
  return t
}

function attackStyle(fx: BattleFx, tier: MotionTier): MotionStyle {
  if (fx.physical) return 'quick'
  const el = fx.element
  if (fx.aoe) {
    if (el === 'ice') return 'rain'
    if (el === 'earth') return 'erupt'
    if (el === 'wind') return 'gale'
    if (el === 'light' || el === null) return 'pillar'
    return tier >= 3 ? 'beam' : 'pillar'
  }
  if (tier === 1) return 'bolt'
  if (el === 'earth') return 'erupt'
  return 'beam'
}

/** speed = 전투 속도 설정(1 | 2). x2 면 모든 구간이 절반이 된다. */
export function skillMotion(fx: BattleFx, speed: 1 | 2 = 1): SkillMotion {
  const tier = fxTier(fx)
  const k = speed === 2 ? 0.5 : 1
  let m: Omit<SkillMotion, 'tier'>

  if (fx.archetype === 'attack') {
    m = { style: 'quick', ultimate: false, castMs: 0, impactMs: 200, waves: 1, waveGapMs: 0, finaleMs: 0, totalMs: 1000 }
  } else if (fx.archetype === 'magicAttack') {
    const style = attackStyle(fx, tier)
    if (style === 'quick') {
      m = { style, ultimate: false, castMs: 0, impactMs: 260, waves: 1, waveGapMs: 0, finaleMs: 0, totalMs: 1100 }
    } else if (tier === 4) {
      // 궁극기 — 기 모으기 1.7초 → 쏟아붓기 → 마지막 폭발
      const castMs = 1700
      const waves = fx.aoe ? 5 : 4
      const waveGapMs = 380
      const impactMs = castMs + 260
      const finaleMs = impactMs + waves * waveGapMs
      m = { style, ultimate: true, castMs, impactMs, waves, waveGapMs, finaleMs, totalMs: Math.min(5000, finaleMs + 1050) }
    } else if (style === 'bolt') {
      m = { style, ultimate: false, castMs: 260, impactMs: 540, waves: 1, waveGapMs: 0, finaleMs: 0, totalMs: 1250 }
    } else {
      const castMs = tier === 3 ? 800 : 520
      const waves = tier === 3 ? 3 : 2
      const waveGapMs = 330
      const impactMs = castMs + 220
      m = { style, ultimate: false, castMs, impactMs, waves, waveGapMs, finaleMs: 0, totalMs: impactMs + waves * waveGapMs + 650 }
    }
  } else if (fx.archetype === 'item' || fx.archetype === 'utility') {
    m = { style: 'support', ultimate: false, castMs: 0, impactMs: 220, waves: 1, waveGapMs: 0, finaleMs: 0, totalMs: 1000 }
  } else if (tier === 4) {
    // 대부활·성역 같은 큰 지원 주문
    m = { style: 'support', ultimate: true, castMs: 1400, impactMs: 1600, waves: 3, waveGapMs: 420, finaleMs: 2900, totalMs: 3900 }
  } else {
    const castMs = tier === 1 ? 280 : tier === 2 ? 450 : 700
    m = { style: 'support', ultimate: false, castMs, impactMs: castMs + 150, waves: tier === 3 ? 2 : 1, waveGapMs: 380, finaleMs: 0, totalMs: castMs + (tier === 3 ? 1500 : 1000) }
  }

  const s = (n: number) => Math.round(n * k)
  return { ...m, tier, castMs: s(m.castMs), impactMs: s(m.impactMs), waveGapMs: s(m.waveGapMs), finaleMs: s(m.finaleMs), totalMs: s(m.totalMs) }
}
