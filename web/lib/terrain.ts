// ============================================================================
// 자연 지면(야생맵) 공용 규칙 — 렌더(components/game/iso-terrain.tsx)와 게임 로직(field-maps 충돌·소품)이 함께 쓴다.
//  · 물 칸 덩어리를 칸 수로 나눠 표현을 고른다(2026-10-04):
//      웅덩이(1~5칸)  = 빗물이 고인 얕은 물 — 땅 높이 그대로, 밟고 지나갈 수 있다
//      연못(6칸 이상) = 돌로 둘린 천연 우물가·작은 호수 — 수면이 내려가 있고 둘레에 바위 둑, 못 들어간다
//      바다(맵 가장자리에 닿는 큰 물) = 해안 절벽 + 거품, 못 들어간다
//      flat           = 심해처럼 물이 곧 바닥인 맵 — 걸을 수 있는 얕은 물(설원의 얼어붙은 호수도 flat)
//    용암(2026-10-07)은 작아도 웅덩이 없이 둑이 있는 pond/sea 로만 나눈다(classifyPools noPuddle)
// ============================================================================

export type PoolKind = 'puddle' | 'pond' | 'sea' | 'flat'

/** 수면이 땅보다 내려간 높이(px) — 둑(벽) 높이. 물 위 소품(수련 등)도 이만큼 내려 그린다 */
export const POOL_DEPTH: Record<PoolKind, number> = { puddle: 0, pond: 14, sea: 16, flat: 0 }
/** 이 칸 수 이하인 물 덩어리는 웅덩이 */
export const PUDDLE_MAX_CELLS = 5

export const poolBlocks = (k: PoolKind | null | undefined) => k === 'pond' || k === 'sea'

/**
 * 칸 단위 물 덩어리 분류. isWater(x,y) = 칸(x,y)가 물인가(칸 중심 기준).
 * 결과: 칸마다 PoolKind | null
 */
export function classifyPools(W: number, H: number, isWater: (x: number, y: number) => boolean, flat = false, noPuddle = false): (PoolKind | null)[] {
  const out: (PoolKind | null)[] = new Array(W * H).fill(null)
  const seen = new Uint8Array(W * H)
  for (let y0 = 0; y0 < H; y0++)
    for (let x0 = 0; x0 < W; x0++) {
      if (seen[y0 * W + x0] || !isWater(x0, y0)) continue
      const comp: number[] = []
      let edge = false
      const q = [y0 * W + x0]
      seen[q[0]] = 1
      while (q.length) {
        const p = q.pop()!
        comp.push(p)
        const x = p % W
        const y = (p / W) | 0
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (seen[n] || !isWater(nx, ny)) continue
          seen[n] = 1
          q.push(n)
        }
      }
      // noPuddle = 용암처럼 작아도 둑이 있는 것(얕은 웅덩이 표현이 없는 액체)
      const kind: PoolKind = flat ? 'flat' : comp.length <= PUDDLE_MAX_CELLS && !noPuddle ? 'puddle' : edge && comp.length >= 30 ? 'sea' : 'pond'
      for (const p of comp) out[p] = kind
    }
  return out
}

/** 주기 없는 2D 값 노이즈(0~1, 부드러움) — 지면 얼룩·길 가장자리 흔들림용 */
export function valueNoise(seed: number) {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const i = Math.floor(x)
    const j = Math.floor(y)
    const u = sm(x - i)
    const v = sm(y - j)
    const a = hash(i, j) * (1 - u) + hash(i + 1, j) * u
    const b = hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u
    return a * (1 - v) + b * v
  }
}
