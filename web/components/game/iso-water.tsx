'use client'

// 아이소 물 지형 — GameMap.water 가 있는 맵(아틀란티스부터 시범 적용, 2026-10-04)
//  · 바다·수로 수면은 지면 SVG 뒤의 HTML 층(WaterBackdrop). 이 층은 "지금 화면에 보이는 영역"만큼만 만들어
//    (텍스처 주기 단위로 맞춤) 시야 밖은 아예 그리지 않는다. 물결은 transform 이동(합성 전용)이라 다시 그리기 없음.
//  · 수로 모양은 캔버스로 한 번 그린 마스크(CSS mask)로 오려 낸다.
//  · 벽·그늘·거품·연석은 시작할 때 캔버스에 한 번 그려 이미지 1장으로(drawWalls) — 맵 SVG 에는 물 요소가 없다.
//    (SVG 요소 수천 개 + 깜빡이는 거품 애니메이션이 렉의 주원인이었음)
//  · 수로 벽 = 사암 벽돌(PixelLab), 해안 벽 = 잔디 끝 바위 절벽(PixelLab). 다리 칸 아래 수로 벽은 아치.
// 텍스처: public/images/map/water/* (scripts/gen-water-tex.mjs · PixelLab 벽 줄무늬)
import { memo, useEffect, useMemo, useState } from 'react'
import { ISO_TILE_W, isoToScreen } from '@/lib/iso'
import type { GameMap } from '@/lib/types'

type Low = 'sea' | 'canal'
const TEX = '/images/map/water/'
/** 물 텍스처 주기(px) — 수면 층의 위치·크기도 이 단위로 맞춰 텍스처가 월드에 고정되게 한다 */
export const WATER_TW = 256
export const WATER_TH = 128
const TW = WATER_TW
const TH = WATER_TH
const DEPTH: Record<Low, number> = { sea: 22, canal: 24 }
const WALL: Record<Low, { src: string; w: number; h: number }> = {
  sea: { src: TEX + 'wall-cliff.png', w: 256, h: 40 },
  canal: { src: TEX + 'wall-canal.png', w: 256, h: 32 },
}
const HW = ISO_TILE_W / 2

interface Face {
  key: string
  low: Low
  /** 'x' = a–d 변(왼쪽 위 이웃이 땅, 오른쪽아래를 보는 면) · 'y' = a–b 변(오른쪽 위 이웃이 땅) */
  plane: 'x' | 'y'
  ox: number
  oy: number
  /** 텍스처 이어붙임 오프셋(px) — 같은 줄의 벽이 끊기지 않게 */
  off: number
  arch: boolean
  seed: number
  /** 벽 아래쪽 끝이 땅 칸으로 삐져나가는가 — 그렇다면 비스듬히 잘라 낸다(clipPath 없이 모양으로 처리) */
  cut: boolean
}

/** 격자(다이아몬드) 전체를 감싸는 화면 사각형 + 약간의 여유 — 오버레이 캔버스 범위 */
function extOf(W: number, H: number) {
  const x0 = isoToScreen(0, H).sx
  const x1 = isoToScreen(W, 0).sx
  const y1 = isoToScreen(W, H).sy
  return { x: x0 - 64, y: -64, w: x1 - x0 + 128, h: y1 + 128 }
}

export function useWaterGrid(map: GameMap) {
  return useMemo(() => {
    const W = map.grid.w
    const H = map.grid.h
    const at = map.water?.at
    const kind: (Low | 'bridge' | null)[] = new Array(W * H).fill(null)
    if (at) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) kind[y * W + x] = at(x + 0.5, y + 0.5)
    const k = (x: number, y: number): Low | 'bridge' | null => (x < 0 || y < 0 || x >= W || y >= H ? 'sea' : kind[y * W + x])
    const low = (x: number, y: number): Low | null => {
      const v = k(x, y)
      return v === 'sea' || v === 'canal' ? v : null
    }
    return { W, H, k, low, active: !!at }
  }, [map])
}

/** 칸 거리(BFS) — from(x,y) 가 참인 칸에서 시작, through(x,y) 가 참인 칸으로만 퍼진다 */
function bfs(W: number, H: number, from: (x: number, y: number) => boolean, through: (x: number, y: number) => boolean) {
  const dist = new Array(W * H).fill(Infinity)
  const q: number[] = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (from(x, y)) {
        dist[y * W + x] = 0
        q.push(y * W + x)
      }
  for (let i = 0; i < q.length; i++) {
    const p = q[i]
    const x = p % W
    const y = (p / W) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !through(nx, ny)) continue
      const n = ny * W + nx
      if (dist[n] > dist[p] + 1) {
        dist[n] = dist[p] + 1
        q.push(n)
      }
    }
  }
  return dist
}

export interface WaterOverlays {
  /** 수심(얕은 물 밝게·먼 바다 짙게) */
  depthUrl: string | null
  /** 수로가 바다로 열리는 곳에 바다 빛 번짐 */
  blendUrl: string | null
  /** 수로 모양 마스크(흰 = 수로) */
  canalMaskUrl: string | null
  /** 벽·그늘·거품·연석을 미리 그린 한 장 */
  wallsUrl: string | null
}

/** 오버레이·마스크를 브라우저에서 한 번만 캔버스로 그려 dataURL 로 */
export function useWaterOverlays(map: GameMap): WaterOverlays {
  const g = useWaterGrid(map)
  const { W, H } = g
  const [out, setOut] = useState<WaterOverlays>({ depthUrl: null, blendUrl: null, canalMaskUrl: null, wallsUrl: null })
  useEffect(() => {
    if (!g.active) {
      setOut({ depthUrl: null, blendUrl: null, canalMaskUrl: null, wallsUrl: null })
      return
    }
    let alive = true
    let wallsObj: string | null = null
    drawWalls(g).then((u) => {
      wallsObj = u
      if (alive) setOut((o) => ({ ...o, wallsUrl: u }))
    })
    const E = extOf(W, H)
    const mk = (S: number) => {
      const c = document.createElement('canvas')
      c.width = Math.ceil(E.w * S)
      c.height = Math.ceil(E.h * S)
      return c
    }
    const cellPath = (ctx: CanvasRenderingContext2D, S: number, x: number, y: number) => {
      const pts = [isoToScreen(x, y), isoToScreen(x + 1, y), isoToScreen(x + 1, y + 1), isoToScreen(x, y + 1)].map((p) => [(p.sx - E.x) * S, (p.sy - E.y) * S] as const)
      ctx.beginPath()
      ctx.moveTo(...pts[0])
      for (const p of pts.slice(1)) ctx.lineTo(...p)
      ctx.closePath()
    }
    const blurred = (src: HTMLCanvasElement, px: number) => {
      const o = document.createElement('canvas')
      o.width = src.width
      o.height = src.height
      const c = o.getContext('2d')!
      c.filter = `blur(${px}px)`
      c.drawImage(src, 0, 0)
      return o.toDataURL()
    }

    // ① 수심 — 1/4 해상도 + 흐림
    const S = 0.25
    const dist = bfs(W, H, (x, y) => !g.low(x, y), () => true)
    const dc = mk(S)
    const dx = dc.getContext('2d')!
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const lw = g.low(x, y)
        const d = dist[y * W + x]
        const fill = !lw
          ? 'rgba(70,200,210,0.5)' // 땅 밑 — 해안 바로 앞을 밝게 물들이는 원천
          : lw === 'canal' || (d > 2 && d <= 4)
            ? null
            : d <= 1
              ? 'rgba(70,200,210,0.42)'
              : d <= 2
                ? 'rgba(50,170,200,0.22)'
                : `rgba(4,26,52,${Math.min(0.42, 0.1 + (d - 4) * 0.06)})`
        if (!fill) continue
        dx.fillStyle = fill
        cellPath(dx, S, x, y)
        dx.fill()
      }

    // ② 수로 블렌드
    const ds = bfs(W, H, (x, y) => g.low(x, y) === 'sea', (x, y) => g.low(x, y) === 'canal')
    const bc = mk(S)
    const bx = bc.getContext('2d')!
    let anyCanal = false
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const lw = g.low(x, y)
        const d = ds[y * W + x]
        const a = lw === 'sea' ? 0.95 : lw === 'canal' && d <= 4 ? [0, 0.7, 0.45, 0.25, 0.1][d] : 0
        if (lw === 'canal') anyCanal = true
        if (!a) continue
        bx.fillStyle = `rgba(16,92,136,${a})`
        cellPath(bx, S, x, y)
        bx.fill()
      }

    // ③ 수로 마스크 — 1/2 해상도, 흐림 없음(벽·연석이 가장자리를 덮는다)
    let canalMaskUrl: string | null = null
    if (anyCanal) {
      const MS = 0.5
      const mc = mk(MS)
      const mx = mc.getContext('2d')!
      mx.fillStyle = '#fff'
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (g.low(x, y) === 'canal') {
            cellPath(mx, MS, x, y)
            mx.fill()
          }
      canalMaskUrl = mc.toDataURL()
    }
    setOut((o) => ({ ...o, depthUrl: blurred(dc, 5), blendUrl: anyCanal ? blurred(bc, 4) : null, canalMaskUrl }))
    return () => {
      alive = false
      if (wallsObj) URL.revokeObjectURL(wallsObj)
    }
  }, [g, W, H])
  return out
}

/** 화면에 보이는 월드 영역(px, svg 안 좌표)을 텍스처 주기 단위로 넓혀 맞춘 사각형 */
export function waterView(camX: number, camY: number, scale: number, vw: number, vh: number, worldW: number, worldH: number) {
  // 한 주기씩 여유를 둬서 걸어 다닐 때 층을 다시 만드는 일이 드물게
  const x0 = Math.max(0, (Math.floor(-camX / scale / TW) - 1) * TW)
  const y0 = Math.max(0, (Math.floor(-camY / scale / TH) - 1) * TH)
  const x1 = Math.min(Math.ceil(worldW / TW) * TW, (Math.ceil((-camX + vw) / scale / TW) + 1) * TW)
  const y1 = Math.min(Math.ceil(worldH / TH) * TH, (Math.ceil((-camY + vh) / scale / TH) + 1) * TH)
  return { x: x0, y: y0, w: Math.max(TW, x1 - x0), h: Math.max(TH, y1 - y0) }
}

/**
 * 바다·수로 수면(HTML, 지면 SVG 뒤) — 화면에 보이는 영역만. vx,vy,vw,vh = waterView() 결과(월드 px).
 * originX/originY = svg 좌표(sx,sy) → 월드 px 변환량(-minSx, padTop).
 */
export const WaterBackdrop = memo(function WaterBackdrop({
  map,
  ov,
  originX,
  originY,
  vx,
  vy,
  vw,
  vh,
}: {
  map: GameMap
  ov: WaterOverlays
  originX: number
  originY: number
  vx: number
  vy: number
  vw: number
  vh: number
}) {
  const E = extOf(map.grid.w, map.grid.h)
  // 오버레이·마스크가 이 층 안에서 놓일 위치
  const ox = E.x + originX - vx
  const oy = E.y + originY - vy
  const tile = (f: string, pos = '0 0') => `url(${TEX}${f}) ${pos} / ${TW}px ${TH}px repeat`
  const big = { left: -TW, top: -TH, width: vw + TW * 2, height: vh + TH * 2 }
  return (
    <div className="iso-sea" style={{ position: 'absolute', left: vx, top: vy, width: vw, height: vh, overflow: 'hidden', pointerEvents: 'none', background: tile('sea.png') }}>
      <div className="sea-glint sea-glint-a" style={{ ...big, background: tile('sea-glint.png') }} />
      <div className="sea-glint sea-glint-b" style={{ ...big, background: tile('sea-glint2.png', '97px 41px') }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {ov.depthUrl && <img src={ov.depthUrl} alt="" style={{ position: 'absolute', left: ox, top: oy, width: E.w, height: E.h, maxWidth: 'none' }} />}
      {ov.canalMaskUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            background: tile('canal.png'),
            maskImage: `url(${ov.canalMaskUrl})`,
            WebkitMaskImage: `url(${ov.canalMaskUrl})`,
            maskSize: `${E.w}px ${E.h}px`,
            WebkitMaskSize: `${E.w}px ${E.h}px`,
            maskPosition: `${ox}px ${oy}px`,
            WebkitMaskPosition: `${ox}px ${oy}px`,
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        >
          <div className="sea-glint canal-glint-a" style={{ ...big, background: tile('canal-glint.png') }} />
          <div className="sea-glint sea-glint-b" style={{ ...big, background: tile('canal-glint2.png', '61px 23px') }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ov.blendUrl && <img src={ov.blendUrl} alt="" style={{ position: 'absolute', left: ox, top: oy, width: E.w, height: E.h, maxWidth: 'none' }} />}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {ov.wallsUrl && <img src={ov.wallsUrl} alt="" style={{ position: 'absolute', left: ox, top: oy, width: E.w, height: E.h, maxWidth: 'none', imageRendering: 'pixelated' }} />}
    </div>
  )
})

/** 벽·그늘·거품·연석이 들어갈 칸 경계 목록 */
function collectEdges(g: ReturnType<typeof useWaterGrid>) {
  const { W, H } = g
  const faces: Face[] = []
  const nearEdges: { low: Low; x1: number; y1: number; x2: number; y2: number }[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lw = g.low(x, y)
      if (!lw) continue
      const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0
      // 왼쪽 위(-x) 이웃이 땅 → a–d 변에 벽
      if (!g.low(x - 1, y)) {
        const d = isoToScreen(x, y + 1)
        faces.push({ key: `fx${x},${y}`, low: lw, plane: 'x', ox: d.sx, oy: d.sy, off: (((-y * HW) % 256) + 256) % 256, arch: g.k(x - 1, y) === 'bridge' && lw === 'canal', seed, cut: !g.low(x, y + 1) })
      }
      // 오른쪽 위(-y) 이웃이 땅 → a–b 변에 벽
      if (!g.low(x, y - 1)) {
        const a = isoToScreen(x, y)
        faces.push({ key: `fy${x},${y}`, low: lw, plane: 'y', ox: a.sx, oy: a.sy, off: (x * HW) % 256, arch: g.k(x, y - 1) === 'bridge' && lw === 'canal', seed, cut: !g.low(x + 1, y) })
      }
      // 앞쪽(+x, +y) 이웃이 땅 → 땅 윗면 가장자리 선(벽은 땅에 가려 안 보인다)
      if (!g.low(x + 1, y)) {
        const b = isoToScreen(x + 1, y)
        const c = isoToScreen(x + 1, y + 1)
        nearEdges.push({ low: lw, x1: b.sx, y1: b.sy, x2: c.sx, y2: c.sy })
      }
      if (!g.low(x, y + 1)) {
        const d = isoToScreen(x, y + 1)
        const c = isoToScreen(x + 1, y + 1)
        nearEdges.push({ low: lw, x1: d.sx, y1: d.sy, x2: c.sx, y2: c.sy })
      }
    }
  }
  return { faces, nearEdges }
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = src
  })

/**
 * 벽(수위 차이)·그늘·거품·연석을 캔버스 한 장에 미리 그려 둔다 → 이미지 1장.
 * (SVG 요소 수천 개로 두면 화면을 다시 그릴 때마다 비싸서 렉의 원인이 됐다)
 */
async function drawWalls(g: ReturnType<typeof useWaterGrid>): Promise<string | null> {
  const E = extOf(g.W, g.H)
  const imgs = { sea: await loadImg(WALL.sea.src), canal: await loadImg(WALL.canal.src) }
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(E.w)
  cv.height = Math.ceil(E.h)
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  const pats = { sea: ctx.createPattern(imgs.sea, 'repeat')!, canal: ctx.createPattern(imgs.canal, 'repeat')! }
  const { faces, nearEdges } = collectEdges(g)
  const poly = (pts: number[][]) => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
    ctx.closePath()
  }
  const T = 14 // 그늘 높이
  for (const f of faces) {
    const D = DEPTH[f.low]
    ctx.setTransform(1, f.plane === 'x' ? -0.5 : 0.5, 0, 1, f.ox - E.x, f.oy - E.y)
    // 면 로컬 좌표(u: 변을 따라 0~32, v: 아래로). 물 칸 다이아몬드의 아래 경계는
    //  plane x: v = u (u=0 쪽이 삐져나감) · plane y: v = 32 - u (u=32 쪽이 삐져나감) — 땅 칸이면 비스듬히 자른다
    const wall = !f.cut ? [[0, 0], [HW, 0], [HW, D], [0, D]] : f.plane === 'x' ? [[0, 0], [HW, 0], [HW, D], [D, D]] : [[0, 0], [HW, 0], [HW - D, D], [0, D]]
    const shade = !f.cut
      ? [[0, D], [HW, D], [HW, D + T], [0, D + T]]
      : f.plane === 'x'
        ? [[D, D], [HW, D], [HW, D + T], [D + T, D + T]]
        : [[0, D], [HW - D, D], [HW - D - T, D + T], [0, D + T]]
    const grad = ctx.createLinearGradient(0, D, 0, D + T)
    grad.addColorStop(0, 'rgba(3,26,38,0.5)')
    grad.addColorStop(1, 'rgba(3,26,38,0)')
    ctx.fillStyle = grad
    poly(shade)
    ctx.fill()
    const pat = pats[f.low]
    pat.setTransform(new DOMMatrix().translate(-f.off, D - WALL[f.low].h))
    ctx.fillStyle = pat
    poly(wall)
    ctx.fill()
    if (f.plane === 'x') {
      ctx.fillStyle = 'rgba(26,18,8,0.22)'
      poly(wall)
      ctx.fill()
    }
    ctx.fillStyle = f.low === 'canal' ? 'rgba(255,243,207,0.75)' : 'rgba(201,232,138,0.75)'
    ctx.fillRect(0, 0, HW, 1)
    if (f.arch) {
      ctx.fillStyle = 'rgba(6,34,43,0.88)'
      ctx.beginPath()
      ctx.moveTo(3, D)
      ctx.lineTo(3, D * 0.5)
      ctx.quadraticCurveTo(HW / 2, -D * 0.15, HW - 3, D * 0.5)
      ctx.lineTo(HW - 3, D)
      ctx.closePath()
      ctx.fill()
    }
    const fx0 = f.cut && f.plane === 'x' ? D : 0
    const fx1 = f.cut && f.plane === 'y' ? HW - D : HW
    ctx.fillStyle = `rgba(230,251,255,${0.35 + (f.seed % 40) / 100})`
    ctx.fillRect(fx0, D - 1, fx1 - fx0, 2)
    if (!f.cut) {
      ctx.fillStyle = 'rgba(230,251,255,0.6)'
      ctx.fillRect((f.seed % 20) + 3, D + 2, 4, 1)
    }
  }
  // 앞쪽 가장자리(땅이 물보다 앞) — 수로는 돌 연석, 바다는 물가 거품. 지면 SVG 아래 층이라 물 쪽으로 살짝 올려 그린다
  ctx.setTransform(1, 0, 0, 1, -E.x, -E.y)
  ctx.lineCap = 'round'
  nearEdges.forEach((e, i) => {
    const line = (dy: number, color: string, w: number, dash: number[] = []) => {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.moveTo(e.x1, e.y1 + dy)
      ctx.lineTo(e.x2, e.y2 + dy)
      ctx.stroke()
    }
    if (e.low === 'canal') line(-1, 'rgba(246,231,192,0.9)', 2)
    else {
      line(-2, `rgba(233,251,255,${0.5 + (i % 4) * 0.1})`, 2.6)
      line(-6, 'rgba(191,234,245,0.45)', 1.2, [5, 4])
    }
  })
  ctx.setLineDash([])
  return await new Promise<string | null>((res) => cv.toBlob((b) => res(b ? URL.createObjectURL(b) : null), 'image/png'))
}
