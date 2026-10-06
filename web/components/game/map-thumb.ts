'use client'

// 맵 지형 썸네일(2026-10-07) — 미니맵·전체 지도 바탕. 칸 좌표(위에서 본 격자)로 지면 종류를 샘플해 작은 이미지 한 장으로 만든다.
// 야생맵은 구역(zone)이 없어 미니맵이 텅 비어 보였다 → 길·숲·물·용암이 보이게.
// 맵마다 한 번만 만들고(캐시), PNG data URL 로 돌려준다(셀당 3px — 38×32 맵이면 114×96).
import type { GameMap } from '@/lib/types'
import type { TileKind } from '@/lib/iso'
import { TILE_COLORS } from '@/lib/iso'

const CACHE = new Map<string, string>()
const S = 3

/** 썸네일용 색 보정 — 타일 색이 실제 텍스처와 다른 것들(설원 길·용암·얼음 등) */
const OVERRIDE: Partial<Record<TileKind, string>> = {
  water: '#3d8fbf',
  'demon-lava': '#f06a1c',
  ice: '#9fd6ee',
}

const hex = (h: string) => {
  const v = parseInt(h.replace('#', '').slice(0, 6), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function mapThumbUrl(map: GameMap): string | null {
  if (typeof document === 'undefined') return null
  const hit = CACHE.get(map.id)
  if (hit) return hit
  const W = map.grid.w * S
  const H = map.grid.h * S
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(W, H)
  const colorCache = new Map<string, number[]>()
  const col = (k: TileKind) => {
    let c = colorCache.get(k)
    if (!c) {
      c = hex(OVERRIDE[k] ?? TILE_COLORS[k]?.top ?? '#5a5a5a')
      colorCache.set(k, c)
    }
    return c
  }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / S
      const y = (py + 0.5) / S
      const wk = map.water?.at(x, y)
      const k: TileKind = wk === 'sea' || wk === 'canal' ? 'water' : (map.terrain?.at(x, y) ?? map.tileAt?.(x, y) ?? 'grass')
      let [r, g, b] = col(k)
      // 길은 밝게 — 어디로 이어지는지 한눈에
      if (map.roadAt?.(x, y)) {
        r = r * 0.6 + 230 * 0.4
        g = g * 0.6 + 210 * 0.4
        b = b * 0.6 + 160 * 0.4
      }
      const o = (py * W + px) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  // 나무·첨탑 같은 큰 소품은 어두운 점
  ctx.fillStyle = 'rgba(10,14,8,0.55)'
  for (const p of map.props ?? []) {
    if (p.kind !== 'tree') continue
    ctx.fillRect(Math.round(p.cell.x * S) - 1, Math.round(p.cell.y * S) - 1, 3, 3)
  }
  const url = cv.toDataURL()
  CACHE.set(map.id, url)
  return url
}
