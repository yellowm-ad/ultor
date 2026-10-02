// ============================================================================
// 레벨업 필요 경험치 — Lv.100 곡선(§PRD v2.0 §14)
//
// 목표 체감:
//   Lv.1~30   빠른 성장
//   Lv.31~50  점점 느려짐
//   Lv.51~80  노력이 필요한 성장
//   Lv.81~100 한 레벨 올리는 것 자체가 장기 목표
//
// 현재 레벨 L 에서 다음 레벨까지:
//   L ≤ 30 : 80·L^1.35
//   L ≤ 50 : C2·L^2.0    (C2 = XP(30) / 30²)
//   L ≤ 80 : C3·L^2.4    (C3 = C2·50² / 50^2.4)
//   L > 80 : C4·L^3.0    (C4 = C3·80^2.4 / 80³)
// 구간 경계에서 값이 이어지도록 계수를 이어 붙인다. 누적 1→100 ≈ 354만 EXP.
//
// 몬스터 처치 경험치도 같은 곡선에 맞춰 레벨별로 다시 잡는다(monsterBaseExp) — "그 레벨 사냥터 몬스터를
// 몇 마리 잡아야 다음 레벨인가"가 Lv1 ≈ 3마리 → Lv30 ≈ 12 → Lv50 ≈ 24 → Lv80 ≈ 60 → Lv99 ≈ 136마리로 늘어난다.
// ============================================================================

export const MAX_LEVEL = 100

const XP30 = Math.round(80 * Math.pow(30, 1.35))
const C2 = XP30 / (30 * 30)
const C3 = (C2 * 50 * 50) / Math.pow(50, 2.4)
const C4 = (C3 * Math.pow(80, 2.4)) / Math.pow(80, 3)

function expToNextRaw(level: number): number {
  const L = level
  if (L <= 30) return Math.round(80 * Math.pow(L, 1.35))
  if (L <= 50) return Math.round(C2 * Math.pow(L, 2.0))
  if (L <= 80) return Math.round(C3 * Math.pow(L, 2.4))
  return Math.round(C4 * Math.pow(L, 3.0))
}

/** 인덱스 0 = 레벨1→2 필요치 … 인덱스 98 = 레벨99→100 */
export const EXP_TO_NEXT_LEVEL: number[] = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => expToNextRaw(i + 1))

export function expRequiredForLevel(level: number): number {
  if (level < 1 || level >= MAX_LEVEL) return Number.POSITIVE_INFINITY
  return EXP_TO_NEXT_LEVEL[level - 1]
}

/** 레벨 1 → target 까지 누적 필요 경험치 */
export function totalExpToReach(target: number): number {
  let sum = 0
  for (let l = 1; l < Math.min(target, MAX_LEVEL); l++) sum += EXP_TO_NEXT_LEVEL[l - 1]
  return sum
}

// ── 몬스터 경험치 기준값 ──────────────────────────────────────────────────────
/** 해당 레벨 사냥터에서 다음 레벨까지 잡아야 하는 몬스터 수(체감 설계치) */
function killsToNextLevel(level: number): number {
  if (level <= 30) return 3 + 0.3 * level
  if (level <= 50) return 12 + 0.6 * (level - 30)
  if (level <= 80) return 24 + 1.2 * (level - 50)
  return 60 + 4 * (level - 80)
}

const MONSTER_BASE_EXP: number[] = (() => {
  const out: number[] = []
  let best = 0
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const v = expToNextRaw(Math.min(l, MAX_LEVEL - 1)) / killsToNextLevel(l)
    best = Math.max(best, v) // 고레벨 구간에서 값이 꺾이지 않게 단조 증가
    out.push(best)
  }
  return out
})()

/** 레벨 L(새 100 축) 표준 몬스터 1마리의 처치 경험치 */
export function monsterBaseExp(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)))
  return MONSTER_BASE_EXP[l - 1]
}

/** 옛 50레벨 축 밸런스에서 쓰던 표준 몬스터 경험치(5.5·L + 0.2·L²) — 몬스터별 상대 배율을 보존하는 데 쓴다 */
export function legacyMonsterBaseExp(legacyLevel: number): number {
  return 5.5 * legacyLevel + 0.2 * legacyLevel * legacyLevel
}

/** 퀘스트 EXP 보상 배율 — 같은 보상이 고레벨에서도 의미를 잃지 않도록 표준 몬스터 경험치에 비례 */
export function questExpMult(level: number): number {
  return monsterBaseExp(level) / monsterBaseExp(1)
}

/**
 * 테스트몹 전용: "몬스터 10마리 처치 시 1레벨 상승"이 되도록
 * 현재 레벨 기준 필요경험치의 1/10을 정확히 지급한다. (기획 9번)
 */
export function testMonsterExpReward(currentLevel: number): number {
  const req = expRequiredForLevel(currentLevel)
  if (!Number.isFinite(req)) return 0
  return Math.max(1, Math.ceil(req / 10))
}

export interface LevelUpResult {
  newLevel: number
  newExp: number
  leveledUp: boolean
  levelsGained: number
}

/** 경험치를 더하고 필요 시 여러 레벨을 한 번에 올린다 (최대 레벨 캡 적용) */
export function applyExp(level: number, exp: number, gained: number): LevelUpResult {
  let curLevel = level
  let curExp = exp + gained
  let levelsGained = 0

  while (curLevel < MAX_LEVEL) {
    const need = expRequiredForLevel(curLevel)
    if (curExp >= need) {
      curExp -= need
      curLevel += 1
      levelsGained += 1
    } else {
      break
    }
  }

  if (curLevel >= MAX_LEVEL) {
    curLevel = MAX_LEVEL
    curExp = 0
  }

  return { newLevel: curLevel, newExp: curExp, leveledUp: levelsGained > 0, levelsGained }
}

export function expProgressPercent(level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 100
  const need = expRequiredForLevel(level)
  return Math.max(0, Math.min(100, (exp / need) * 100))
}
