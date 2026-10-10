'use client'

import { useEffect, useState } from 'react'
import type { GameMap } from '@/lib/types'
import { ISO_TILE_W, ISO_TILE_H, isoToScreen, TILE_COLORS, TILE_SPRITES, type TileKind } from '@/lib/iso'

// ============================================================================
// 칸 타일 지면(마을·실내)을 한 장의 캔버스로 — 2026-10-10 최적화.
// 예전에는 칸마다 <image> 하나씩(마을 52×53 = 2,700여 개)을 SVG 에 올려, 걷는 동안 브라우저가 그 전부를
// 매 프레임 다시 따지느라 느렸다. 타일은 변하지 않으므로 맵에 들어올 때 한 번만 캔버스에 그려 둔다.
// 자연 지면(map.terrain)은 iso-terrain.tsx 가 따로 그린다.
// ============================================================================

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const cache = new Map<string, HTMLCanvasElement>()
const imgCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadImg(src: string): Promise<HTMLImageElement | null> {
  let p = imgCache.get(src)
  if (!p) {
    p = new Promise((res) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => res(null)
      im.src = src
    })
    imgCache.set(src, p)
  }
  return p
}

const kindAt = (map: GameMap, x: number, y: number): TileKind => (map.tileAt ? map.tileAt(x + 0.5, y + 0.5) : 'grass')

async function paintGround(map: GameMap, R: Rect): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = map.grid
  const raster = map.assets === 'raster'
  // 쓰이는 타일 그림을 먼저 모두 받아 둔다
  const kinds = new Set<TileKind>()
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) kinds.add(kindAt(map, x, y))
  const imgs = new Map<TileKind, HTMLImageElement | null>()
  if (raster) {
    await Promise.all(
      [...kinds].map(async (k) => {
        const src = TILE_SPRITES[k]
        if (src) imgs.set(k, await loadImg(src))
      }),
    )
  }
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(R.w)
  cv.height = Math.ceil(R.h)
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.translate(-R.x, -R.y)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 물 지형 맵: 바다·수로 칸은 수면 층이 그린다
      const wk = map.water?.at(x + 0.5, y + 0.5)
      if (wk === 'sea' || wk === 'canal') continue
      const kind = kindAt(map, x, y)
      const a = isoToScreen(x, y)
      const im = imgs.get(kind)
      if (im) {
        // 셀 해시로 좌우/상하 뒤집어 반복 패턴(솔기) 완화
        const h = map.tileFlip === false ? 0 : ((x * 73856093) ^ (y * 19349663)) >>> 0
        const fx = h & 1 ? -1 : 1
        const fy = h & 2 ? -1 : 1
        ctx.save()
        ctx.translate(a.sx, a.sy + ISO_TILE_H / 2)
        ctx.scale(fx, fy)
        ctx.drawImage(im, -ISO_TILE_W / 2, -ISO_TILE_H / 2, ISO_TILE_W, ISO_TILE_H * 2)
        ctx.restore()
        continue
      }
      const col = TILE_COLORS[kind]
      const b = isoToScreen(x + 1, y)
      const c = isoToScreen(x + 1, y + 1)
      const d = isoToScreen(x, y + 1)
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.lineTo(c.sx, c.sy)
      ctx.lineTo(d.sx, d.sy)
      ctx.closePath()
      ctx.fillStyle = col.top
      ctx.fill()
      ctx.strokeStyle = col.edge
      ctx.lineWidth = 0.6
      ctx.stroke()
    }
  }
  return cv
}

/** 칸 타일 지면 캔버스. 자연 지면 맵이면 null. 그려지기 전에도 null(그동안은 groundFallbackColor 로 채운다) */
export function useGroundArt(map: GameMap, rect: Rect): HTMLCanvasElement | null {
  const [art, setArt] = useState<{ id: string; canvas: HTMLCanvasElement } | null>(() => {
    const c = cache.get(map.id)
    return c ? { id: map.id, canvas: c } : null
  })
  useEffect(() => {
    if (map.terrain) return
    const hit = cache.get(map.id)
    if (hit) {
      setArt({ id: map.id, canvas: hit })
      return
    }
    let alive = true
    paintGround(map, rect).then((canvas) => {
      cache.set(map.id, canvas)
      if (alive) setArt({ id: map.id, canvas })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, rect.x, rect.y, rect.w, rect.h])
  return !map.terrain && art?.id === map.id ? art.canvas : null
}

/** 지면이 그려지기 전 잠깐 깔아 두는 바탕색 — 맵 한가운데 칸의 색(바닥이 통째로 비어 보이지 않게) */
export function groundFallbackColor(map: GameMap): string {
  const cx = map.grid.w / 2
  const cy = map.grid.h / 2
  const kind = (map.terrain ? map.terrain.at(cx, cy) : map.tileAt ? map.tileAt(cx, cy) : 'grass') as TileKind
  return TILE_COLORS[kind]?.top ?? '#3b4a35'
}
