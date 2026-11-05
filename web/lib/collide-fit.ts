// 길막 맞춤(2026-11-05) — 소품 충돌 사각형을 그림의 불투명 바닥 안으로 줄이는 배율표(lib/collide-fit-data, scripts/fit-collision.mjs 가 생성).
// lib/maps buildBlockers · propBlocker 가 쓴다. 그리기·z정렬(propAABB)은 그대로.
import type { PropDef } from '@/lib/iso'
import { COLLIDE_FIT } from '@/lib/collide-fit-data'

/** 같은 그림·크기·앵커·충돌 크기면 같은 배율 */
export function collideKey(p: PropDef): string {
  const fp = p.collide ?? p.size
  const m = (p.facing === 'left' && p.kind !== 'wall') || !!p.mirrorX
  const r = (v: number | undefined) => (v == null ? '-' : Math.round(v * 100) / 100)
  return [p.sprite, `${r(p.px?.w)}x${r(p.px?.h)}`, `${r(p.anchor?.x)},${r(p.anchor?.y)}`, m ? 'M' : '', `${r(fp?.w)}x${r(fp?.d)}`, p.radial ? 'R' : '', `${r(p.collideOffset?.x)},${r(p.collideOffset?.y)}`].join('|')
}

type Box = { x0: number; y0: number; x1: number; y1: number }
/** 그림에 맞춰 줄인 충돌 사각형(표에 없으면 그대로) — 중심 기준 */
export function fitBlocker(p: PropDef, b: Box): Box {
  if (!p.sprite) return b
  const v = COLLIDE_FIT[collideKey(p)]
  if (v == null) return b
  const [s, t] = typeof v === 'number' ? [v, 0] : v
  if (s >= 1 && !t) return b
  // 뒤로 옮기기 — 화면 기준 위쪽(셀 x·y 둘 다 감소)
  const cx = (b.x0 + b.x1) / 2 - t
  const cy = (b.y0 + b.y1) / 2 - t
  const hw = ((b.x1 - b.x0) * s) / 2
  const hd = ((b.y1 - b.y0) * s) / 2
  return { x0: cx - hw, y0: cy - hd, x1: cx + hw, y1: cy + hd }
}
