// ============================================================================
// 마을 꾸미기 소품(2026-10-10) — 맵 꾸미기용 오브젝트(scripts/_pixellab/map-decor.txt 로 만든 210종)와
// 기존 프롭을 각 마을의 빈자리에 섞어 놓는다. 마을을 만드는 코드(lib/maps.ts · town-builder 등)는 건드리지 않고
// 여기 목록만 맵 props 뒤에 덧붙인다(lib/maps.ts 맨 끝 applyTownDecor).
//   · 한 줄 = [그림 이름(props/ 아래 경로), x, y, 옵션?]  — 좌표는 그 맵의 셀 좌표
//   · 관리자 오브젝트 편집으로 놓은 것과 같은 모양의 프롭이 된다(id 는 `dc-<그림>-<순번>` — 옮기기·지우기 가능)
//   · 미리보기: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/preview-map.mjs <mapId> out.png
// ============================================================================

import type { PropDef } from '@/lib/iso'
import { ISO_TILE_W } from '@/lib/iso'
import { PROP_CATALOG } from '@/lib/prop-catalog'

interface DecorOpt {
  /** 지나갈 수 있는가(기본: 폭 40px 이상이면 길막) */
  walk?: boolean
  /** 좌우 반전 그림(<이름>_f.png)이 없을 때 그림을 거울상으로 */
  mirror?: boolean
  /** 충돌·정렬 바닥 크기(셀) 직접 지정 */
  size?: number
  /** 바닥에 깔리는 것(러그·화단 바닥) — 항상 사람 뒤에 그린다 */
  flat?: boolean
}
export type DecorItem = [sprite: string, x: number, y: number, opt?: DecorOpt]

const CATALOG = new Map(PROP_CATALOG.map((c) => [c.src, c]))

/** 꾸미기 목록 → 프롭. 그림이 카탈로그에 없으면 건너뛴다(오타 방지용으로 콘솔에 알림) */
export function decorProps(items: DecorItem[]): PropDef[] {
  const count = new Map<string, number>()
  const out: PropDef[] = []
  for (const [name, x, y, opt = {}] of items) {
    const src = `/images/map/props/${name}.png`
    const it = CATALOG.get(src)
    if (!it) {
      console.warn('[town-decor] 그림 없음:', name)
      continue
    }
    const base = name.split('/').pop()!
    const n = count.get(base) ?? 0
    count.set(base, n + 1)
    const solid = opt.walk === undefined ? it.w >= 40 && !opt.flat : !opt.walk
    // 바닥 다이아몬드(폭 = 그림 폭)의 중심을 발밑으로 — 건물·좌대처럼 자기 바닥이 있는 그림이 칸 가운데에 앉는다
    const baseH = Math.min(it.h, it.w / 2)
    const fp = opt.size ?? Math.max(0.5, Math.round((it.w / ISO_TILE_W) * 0.8 * 2) / 2)
    out.push({
      id: `dc-${base}-${n}`,
      kind: solid ? 'statue' : 'bicycle',
      cell: { x, y },
      sprite: src,
      px: { w: it.w, h: it.h },
      anchor: { x: it.w / 2, y: it.h - baseH / 2 },
      radial: true,
      size: { w: fp, d: fp },
      solid,
      ...(opt.mirror ? { mirrorX: true } : {}),
      ...(opt.flat ? { backdrop: true } : {}),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 마을별 꾸미기 목록
// ─────────────────────────────────────────────────────────────────────────────
export const TOWN_DECOR: Record<string, DecorItem[]> = {}
