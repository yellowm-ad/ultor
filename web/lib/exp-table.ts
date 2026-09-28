// ============================================================================
// 레벨업 필요 경험치 테이블
//
// 2026-09 밸런스 패치: 기존엔 메이플스토리 실측 곡선(1→50을 메이플 1→200으로 환산)을
// 그대로 써서 후반 레벨 하나에 수십억 경험치가 필요한 등 비현실적으로 가팔랐다.
// "하루 3시간 × 주 7일(주 21시간) 꾸준히 플레이하면 만렙(50) 도달, 초반 30레벨까지는
// 빠르게" 라는 목표에 맞춰 완전히 새로 설계.
//
// 설계 방식: "그 레벨에서 맞는 사냥터 몬스터를 몇 마리 잡아야 다음 레벨이 되는가"를
// 기준으로 역산했다. kills(L) = 3 + 0.05·L^1.8 (레벨1≈3마리 → 레벨49≈47마리로 완만히
// 증가), monExp(L) ≈ 5.5·L + 0.2·L² (실제 lib/mock-data.ts 몬스터 expReward 값 회귀
// 근사치)를 곱해 필요 경험치를 얻는다. 활발한 사냥 페이스(체감 시간당 60~120마리
// 처치 — 이동·전투·복귀 포함)를 가정하면 전체 1→50 합계(~53만 exp, 총 킬수 ~1,140마리)가
// 21시간 전후에 맞아떨어진다. 실제 체감 속도는 플레이 패턴에 따라 달라질 수 있으니
// 실측 후 kills()/monExp() 계수만 조정하면 됨(테이블 재계산 로직은 그대로 재사용).
// ============================================================================

// 2026-09-28: 레벨 상한 100. 기존 1→50 곡선을 레벨 2개로 쪼갠다 — 새 레벨 L 의 필요치 = 기존 레벨 (L+1)/2 필요치의 절반.
// 따라서 1→100 총 경험치(=플레이 시간)는 기존 1→50 과 거의 같고, 레벨업 빈도만 두 배가 된다.
export const MAX_LEVEL = 100

/** 레벨 L에서 다음 레벨까지 필요한 처치 수(완만히 증가) */
function killsToNextLevel(level: number): number {
  return 3 + 0.05 * Math.pow(level, 1.8)
}

/** 레벨 L대 사냥터 몬스터의 평균 처치 경험치(현재 몬스터 데이터 회귀 근사) */
function avgMonsterExpAtLevel(level: number): number {
  return 5.5 * level + 0.2 * level * level
}

/** 본 게임 레벨(1~99) → 다음 레벨까지 필요 경험치. 인덱스 0 = 레벨1→2 필요치 */
export const EXP_TO_NEXT_LEVEL: number[] = Array.from({ length: MAX_LEVEL }, (_, i) => {
  const legacy = (i + 2) / 2 // 새 레벨(i+1) → 기존 레벨 환산
  return Math.max(1, Math.round((killsToNextLevel(legacy) * avgMonsterExpAtLevel(legacy)) / 2))
})

export function expRequiredForLevel(level: number): number {
  if (level < 1 || level >= MAX_LEVEL) return Number.POSITIVE_INFINITY
  return EXP_TO_NEXT_LEVEL[level - 1]
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
