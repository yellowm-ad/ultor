// ════════ 개인 공간(기숙사 방) 리마스터 — 참고: 루트 `개인 공간 디자인안.png` + 판타지 숙소 검색(크롬, 2026-09-30) ════════
// 사용자 규칙: 벽은 맵 끝선(x=0 서벽, y=0 북벽)에 전체 길이로 높게. 벽면에 아치 창·그리핀 배너·문을 평면으로 붙인다.
// 가구는 하우징 배치 시스템(lib/housing.ts, 전부 isometric 스프라이트)이 그린다.
import type { IsoPart, IsoStructGroup, IsoTex } from '@/lib/iso'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
const D = '/images/map/dorm/'
const WALL: IsoTex = { src: D + 'wall.png', w: 64, h: 128, scale: 2.4 }
const WALL_H = 128 * 2.4 // ≈ 307 — 벽판 한 장 높이
const WINDOW = { s: D + 'window.png', w: 64, h: 108 }
const BANNER = { s: D + 'banner.png', w: 40, h: 89 }
const DOOR = { s: '/images/map/props/housing/door.png', w: 92, h: 148 }

function decal(plane: 'x' | 'y', at: number, hPx: number, z0: number, sp: { s: string; w: number; h: number }): IsoPart {
  const wc = (hPx * (sp.w / sp.h)) / 32
  return { kind: 'face', plane, at: 0, from: at - wc / 2, to: at + wc / 2, z0, z1: z0 + hPx, img: sp.s }
}

export function dormStructures(w: number, h: number): IsoStructGroup[] {
  const parts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: WALL_H, tex: WALL },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: WALL_H, tex: WALL, shade: 0.14 },
    // 북벽: 뒤쪽 꼭짓점 쪽 문 + 아치 창 2 + 배너 2 / 서벽: 아치 창 1 + 배너 1
    decal('y', 5.4, 160, 0, DOOR),
    decal('y', 9.2, 150, 80, WINDOW),
    decal('y', 12.6, 110, 110, BANNER),
    decal('y', 1.4, 110, 110, BANNER),
    decal('x', 6.4, 150, 80, WINDOW),
    decal('x', 10.2, 110, 110, BANNER),
  ]
  return [{ id: 'dorm-walls', back: 0, parts }]
}

export function dormBlockers(w: number, h: number): Blocker[] {
  const exitW = 2.2
  return [
    { x0: 0, y0: 0, x1: w, y1: 0.4 },
    { x0: 0, y0: 0, x1: 0.4, y1: h },
    { x0: w - 0.3, y0: 0, x1: w, y1: h },
    { x0: 0, y0: h - 0.3, x1: w / 2 - exitW / 2, y1: h },
    { x0: w / 2 + exitW / 2, y0: h - 0.3, x1: w, y1: h },
  ]
}
export const DORM_PAD_TOP = WALL_H + 60
