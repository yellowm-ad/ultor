'use client'

// 자연 지면(야생맵) — GameMap.terrain 이 있는 맵(에르디아 숲·물가 맵부터, 2026-10-04)
//  · 칸 타일(다이아몬드) 대신 지면 전체를 시작할 때 캔버스에 한 번 그려 이미지 1장으로 만든다(iso-water 의 벽과 같은 방식).
//    → 풀/흙/모래 경계가 칸 계단 없이 곡선 + 디더링으로 섞이고, 체크무늬가 사라진다.
//  · 지면 종류는 1/16칸 격자로 미리 샘플(terrain.at)해 두고 픽셀마다 베이어 흔들림으로 경계를 섞는다.
//  · 높이 차 표현: 풀(높음)이 흙길(낮음) 위로 살짝 그늘을 드리우고, 길 쪽 가장자리엔 풀잎 끝이 밝게.
//  · 물(lib/terrain.ts PoolKind):
//      웅덩이 = 땅 높이의 얕은 물 — 진흙 빛을 반투명하게 덮고 둘레는 젖은 흙
//      연못·바다 = 수면이 내려가 있다. 먼 쪽 둑에 바위 벽(water/wall-cliff.png, 어제 만든 해안 절벽 재사용) + 물가 거품·그늘·수심
//      flat(심해) = 바닥이 곧 물 — 모래 가장자리에 옅은 거품만
//    수면 자체는 지면 이미지 뒤의 HTML 층(TerrainWaterBackdrop)이 물결 애니메이션과 함께 그리고, 지면 이미지는 그 자리만 비워 둔다.
//  · 나무·덤불 발밑에 점묘 그림자를 지면에 그려 소품이 땅에 붙어 보이게 한다.
//  · 격자 바깥은 가장자리 지면을 이어 그리며 어둡게 물들인다(검은 허공 대신 숲 그늘).
//  · 나머지 지역(2026-10-07): terrain.tex 로 지역 텍스처(설원 눈길·화산재·구름 등), terrain.liquid 로 고인 것의 종류를 바꾼다.
//      용암 = 연못처럼 가라앉은 현무암 둑 + 흐르는 용암 수면(3겹) + 둘레 땅이 달아오르는 열기 / 얼음 = 땅 높이의 얼어붙은 호수 + 눈 쌓인 흰 테
// 텍스처: public/images/map/terrain/* (scripts/gen-terrain-tex.mjs)
import { memo, useEffect, useRef, useState } from 'react'
import type { TileKind } from '@/lib/iso'
import { isoToScreen } from '@/lib/iso'
import type { GameMap } from '@/lib/types'
import { POOL_DEPTH, type PoolKind } from '@/lib/terrain'

const TEX_DIR = '/images/map/terrain/'
const TEX_FILE: Partial<Record<TileKind, string>> = {
  grass: 'grass',
  'grass-dark': 'grass-dark',
  dirt: 'dirt',
  path: 'dirt',
  sand: 'sand',
  cave: 'cave',
  mine: 'mine',
  swamp: 'swamp',
}
/** 높이 순위 — 높은 쪽이 낮은 쪽 위로 그늘을 드리운다 */
const RANK: Partial<Record<TileKind, number>> = { grass: 2, 'grass-dark': 2, swamp: 2 }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const WATER = 255
const POOL_CODE: Record<PoolKind, number> = { puddle: 1, pond: 2, sea: 3, flat: 4 }
const CODE_POOL: PoolKind[] = ['puddle', 'puddle', 'pond', 'sea', 'flat']
const SS = 16 // 칸당 지면 샘플 수(한 축)
/** 둑(가라앉은 물가 벽) — 물은 바위 절벽, 용암은 아래가 달아오른 현무암 */
const WALL = { water: '/images/map/water/wall-cliff.png', lava: '/images/map/water/wall-basalt.png', h: 40 }
/** 격자 바깥 그늘 색 기본(따뜻한 검정) — 지역마다 terrain.fog 로 바꾼다 */
const FOG0: [number, number, number] = [12, 10, 8]
/**
 * 액체별 물가 색(2026-10-07) — far = 먼 둑 그늘, front = 앞 물가(거품/열기 테), shallow = 물가 띠(얕은 물/서리 테), lip = 벽 아래 수면에 닿는 줄
 *  용암은 수심 그늘 대신 앞 물가가 노랗게 달아오르고, 얼음은 물가에 눈이 쌓인 흰 테
 */
const SHORE = {
  water: { far: [3, 26, 38], front: [228, 250, 255], shallow: [120, 228, 222], lip: [230, 250, 255] },
  lava: { far: [40, 6, 2], front: [255, 214, 96], shallow: [255, 180, 70], lip: [255, 176, 64] },
  ice: { far: [40, 70, 100], front: [246, 250, 255], shallow: [236, 246, 255], lip: [246, 250, 255] },
} as const

type Tex = { w: number; h: number; d: Uint8ClampedArray }
const loadTex = (src: string) =>
  new Promise<Tex>((res, rej) => {
    const im = new Image()
    im.onload = () => {
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const x = c.getContext('2d')!
      x.drawImage(im, 0, 0)
      res({ w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data })
    }
    im.onerror = rej
    im.src = src
  })

export type Surface = 'canal' | 'sea' | 'lava' | 'ice'

export interface TerrainRect {
  x: number
  y: number
  w: number
  h: number
}
export interface TerrainArt {
  /** 다 그린 지면 캔버스(PNG 로 인코딩하지 않고 그대로 화면에 붙인다 — 수백만 픽셀 인코딩·디코딩이 느렸다) */
  canvas: HTMLCanvasElement | null
  /** 수면 텍스처(public/images/map/water/{surface}.png) — 물이 없으면 null */
  surface: Surface | null
}

/** 최근 맵 몇 개는 다시 그리지 않는다(포탈로 오갈 때) */
const CACHE = new Map<string, Promise<TerrainArt>>()
const CACHE_MAX = 6

const keyOf = (map: GameMap, rect: TerrainRect) => `${map.id}:${rect.x},${rect.y},${rect.w},${rect.h}`
/** 지금 화면에 필요한 맵 — 이 맵은 서둘러 그리고, 나머지(미리 그려 두는 이웃 맵)는 게임이 끊기지 않게 틈틈이 그린다 */
let URGENT: string | null = null

function paintCached(map: GameMap, rect: TerrainRect) {
  const key = keyOf(map, rect)
  let job = CACHE.get(key)
  if (job) {
    // 최근에 쓴 것을 뒤로 — 오래 안 쓴 맵부터 버린다(지금 맵이 밀려나 바닥이 다시 비는 일을 막는다)
    CACHE.delete(key)
    CACHE.set(key, job)
    return job
  }
  job = paintTerrain(map, rect, key)
  CACHE.set(key, job)
  while (CACHE.size > CACHE_MAX) {
    const oldest = [...CACHE.keys()].find((k) => k !== URGENT && k !== key)
    if (!oldest) break
    CACHE.delete(oldest)
  }
  return job
}

/**
 * 지면을 맵마다 한 번 그린다. rect = svg 좌표의 월드 사각형(카메라가 보여 줄 수 있는 전 범위).
 * 다 그리면 next(포탈로 이어진 맵들)를 차례로 미리 그려 두어 맵을 옮길 때 바로 보이게 한다.
 */
export function useTerrainArt(map: GameMap, rect: TerrainRect, next: { map: GameMap; rect: TerrainRect }[] = []): TerrainArt {
  const [art, setArt] = useState<TerrainArt & { id: string | null }>({ id: null, canvas: null, surface: null })
  useEffect(() => {
    let alive = true
    ;(async () => {
      URGENT = map.terrain ? keyOf(map, rect) : null
      if (map.terrain) {
        const r = await paintCached(map, rect)
        if (!alive) return
        setArt({ id: map.id, ...r })
      }
      // 이웃 맵은 가까운 몇 곳만 미리 — 전부 그리면 캐시가 넘쳐 서로 밀어낸다
      for (const n of next.slice(0, PRELOAD_MAX)) {
        if (!alive) return
        if (n.map.terrain) await paintCached(n.map, n.rect)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, rect.x, rect.y, rect.w, rect.h])
  return art.id === map.id ? art : { canvas: null, surface: null }
}

/** 메인 스레드를 잠깐 양보 — 큰 지면을 그리는 동안에도 게임 입력·애니메이션이 멈추지 않게(setTimeout 과 달리 백그라운드에서 1초로 늘어지지 않는다) */
const yieldNow = () =>
  new Promise<void>((r) => {
    const c = new MessageChannel()
    c.port1.onmessage = () => r()
    c.port2.postMessage(0)
  })
const SLICE_MS = 24
/** 미리 그리기(이웃 맵)는 5ms 일하고 40ms 쉰다 — 걷는 동안 프레임을 잡아먹지 않게 */
const BG_SLICE_MS = 5
const BG_REST_MS = 40
const PRELOAD_MAX = 4
const restNow = () => new Promise<void>((r) => setTimeout(r, BG_REST_MS))

/** 지면 캔버스를 월드 층(HTML)에 붙인다 — 수면 층 위, 오브젝트 SVG 아래 */
export function TerrainCanvas({ canvas, w, h }: { canvas: HTMLCanvasElement; w: number; h: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;image-rendering:pixelated`
    el.replaceChildren(canvas)
    return () => {
      if (canvas.parentNode === el) el.removeChild(canvas)
    }
  }, [canvas, w, h])
  return <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, pointerEvents: 'none' }} />
}

async function paintTerrain(map: GameMap, R: TerrainRect, key: string): Promise<TerrainArt> {
  const T = map.terrain!
  const liquid = T.liquid ?? 'water'
  const LIQ: TileKind = liquid === 'lava' ? 'demon-lava' : liquid === 'ice' ? 'ice' : 'water'
  const SH = SHORE[liquid]
  const FOG = T.fog ?? FOG0
  const texFile = (k: TileKind) => T.tex?.[k] ?? TEX_FILE[k] ?? 'grass'
  let last = performance.now()
  const breathe = async () => {
    const bg = URGENT !== key
    if (performance.now() - last > (bg ? BG_SLICE_MS : SLICE_MS)) {
      await (bg ? restNow() : yieldNow())
      last = performance.now()
    }
  }
  const W = map.grid.w
  const H = map.grid.h

  // ① 지면 종류 — 1/16칸 격자 샘플
  const kinds: TileKind[] = []
  const kindIdx = new Map<TileKind, number>()
  const GW = W * SS
  const GH = H * SS
  const grid = new Uint8Array(GW * GH)
  for (let gy = 0; gy < GH; gy++) {
    if ((gy & 1) === 0) await breathe()
    for (let gx = 0; gx < GW; gx++) {
      const k = T.at((gx + 0.5) / SS, (gy + 0.5) / SS)
      let i = k === LIQ ? WATER : kindIdx.get(k)
      if (i === undefined) {
        i = kinds.length
        kinds.push(k)
        kindIdx.set(k, i)
      }
      grid[gy * GW + gx] = i
    }
  }

  // ② 칸별 물 표현 + 물가에서 떨어진 거리(수심 빛)
  const pools: (PoolKind | null)[] = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pools.push(T.pool(x + 0.5, y + 0.5))
  const dist = new Float32Array(W * H).fill(1e9)
  const q: number[] = []
  pools.forEach((p, i) => {
    if (!p) {
      dist[i] = 0
      q.push(i)
    }
  })
  for (let h = 0; h < q.length; h++) {
    const p = q[h]
    const x = p % W
    const y = (p / W) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const n = ny * W + nx
      if (dist[n] > dist[p] + 1) {
        dist[n] = dist[p] + 1
        q.push(n)
      }
    }
  }
  const distAt = (cx: number, cy: number) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(cx)))
    const y = Math.min(H - 1, Math.max(0, Math.floor(cy)))
    return dist[y * W + x]
  }
  const poolAt = (cx: number, cy: number): PoolKind => {
    const x = Math.floor(cx)
    const y = Math.floor(cy)
    const own = pools[y * W + x]
    if (own) return own
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const p = pools[ny * W + nx]
        if (p) return p
      }
    return 'puddle'
  }

  const files = [...new Set(kinds.map(texFile))]
  const texByFile = new Map<string, Tex>()
  await Promise.all(files.map(async (f) => texByFile.set(f, await loadTex(TEX_DIR + f + '.png'))))
  // 맵 톤 — 밝은 지역은 밝기+조금 들어 올림(화사하게), 어두운 지역은 지면을 절반만 누른다(나머지는 화면 오버레이가 맡음)
  const tone = T.tone ?? 1
  const gMul = tone >= 1 ? tone : 1 - (1 - tone) * 0.35
  const gAdd = tone > 1 ? (tone - 1) * 60 : 0
  const toned = (t: Tex, f = 1, cool = 1) => {
    if (f === 1 && gMul === 1 && gAdd === 0) return t
    const d = new Uint8ClampedArray(t.d)
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * f * gMul + gAdd
      d[i + 1] = d[i + 1] * f * gMul + gAdd
      d[i + 2] = d[i + 2] * f * cool * gMul + gAdd * 0.8
    }
    return { ...t, d }
  }
  // 동굴 속 모래처럼 튀는 바닥은 더 누르고 살짝 차갑게 — 그늘진 느낌
  const tex = kinds.map((k) => toned(texByFile.get(texFile(k))!, T.shade?.[k] ?? 1, T.shade?.[k] ? 1.04 : 1))
  const tex32 = tex.map((t) => new Uint32Array(t.d.buffer, t.d.byteOffset, t.w * t.h))
  const rank = kinds.map((k) => (T.rank ?? RANK)[k] ?? 1)
  const wall = toned(await loadTex(liquid === 'lava' ? WALL.lava : WALL.water))
  // 웅덩이 바닥색 — 맵에서 가장 흔한 땅의 평균색을 어둡게(풀밭이면 흙빛). 늪은 진흙, 모래밭은 젖은 모래
  const count = new Array(kinds.length).fill(0)
  for (let i = 0; i < grid.length; i += 7) if (grid[i] !== WATER) count[grid[i]]++
  const main = count.indexOf(Math.max(...count, 0))
  const bedKind = main >= 0 && RANK[kinds[main]] === 2 && kinds[main] !== 'swamp' ? 'dirt' : (kinds[main] ?? 'dirt')
  const bedTex = texByFile.get(texFile(bedKind)) ?? (await loadTex(TEX_DIR + texFile(bedKind) + '.png'))
  const BED = [0, 0, 0]
  for (let i = 0; i < bedTex.d.length; i += 4) for (let c = 0; c < 3; c++) BED[c] += bedTex.d[i + c]
  for (let c = 0; c < 3; c++) BED[c] = (BED[c] / (bedTex.d.length / 4)) * 0.6

  // ③ 픽셀마다 지면 종류·물 표현
  const PW = Math.ceil(R.w)
  const PH = Math.ceil(R.h)
  const N = PW * PH
  const K = new Uint8Array(N)
  const P = new Uint8Array(N)
  const FOGA = new Float32Array(N)
  let anyWater = false
  let anySea = false
  const JIT = new Float32Array(16).map((_, j) => (BAYER[j] - 0.5) * 0.09)
  const Wm = W - 1e-3
  const Hm = H - 1e-3
  for (let py = 0; py < PH; py++) {
    if ((py & 3) === 0) await breathe()
    const sy = R.y + py + 0.5
    // 셀 좌표는 x 로 1px 갈 때 cx += 1/64, cy -= 1/64 — 곱셈 없이 더해 간다
    let cx0 = (R.x + 0.5) / 64 + sy / 32
    let cy0 = sy / 32 - (R.x + 0.5) / 64
    const jrow = (py & 3) * 4
    for (let px = 0; px < PW; px++, cx0 += 1 / 64, cy0 -= 1 / 64) {
      const i = py * PW + px
      const jt = JIT[jrow + (px & 3)]
      let cx = cx0 + jt
      let cy = cy0 - jt
      if (cx < 0 || cy < 0 || cx > W || cy > H) {
        const od = Math.max(-cx, cx - W, -cy, cy - H)
        FOGA[i] = od <= 0.1 ? 0 : od >= 1.8 ? 0.95 : ((od - 0.1) / 1.7) * 0.95
        cx = cx < 0 ? 0 : cx > Wm ? Wm : cx
        cy = cy < 0 ? 0 : cy > Hm ? Hm : cy
      } else {
        if (cx > Wm) cx = Wm
        if (cy > Hm) cy = Hm
      }
      const ccx = cx
      const ccy = cy
      const k = grid[((ccy * SS) | 0) * GW + ((ccx * SS) | 0)]
      K[i] = k
      if (k === WATER) {
        const pk = poolAt(ccx, ccy)
        P[i] = POOL_CODE[pk]
        anyWater = true
        if (pk === 'sea' || pk === 'flat') anySea = true
      }
    }
  }

  // ④ 소품 발밑 그림자(점묘)
  const shade = new Float32Array(N)
  for (const p of map.props ?? []) {
    if (!p.sprite || !p.px || (p.kind !== 'tree' && p.kind !== 'bush') || (p.elev ?? 0) < 0) continue
    const s = isoToScreen(p.cell.x, p.cell.y)
    const isTree = p.kind === 'tree'
    const rx = p.px.w * (isTree ? 0.3 : 0.28)
    const ry = rx * (isTree ? 0.42 : 0.36)
    const a = isTree ? 0.34 : 0.2
    const ox = s.sx - R.x
    const oy = s.sy - R.y + (isTree ? 2 : 0)
    for (let y = Math.floor(oy - ry); y <= Math.ceil(oy + ry); y++) {
      if (y < 0 || y >= PH) continue
      for (let x = Math.floor(ox - rx); x <= Math.ceil(ox + rx); x++) {
        if (x < 0 || x >= PW) continue
        const d = Math.hypot((x - ox) / rx, (y - oy) / ry)
        if (d >= 1) continue
        const v = Math.min(1, (1 - d) / 0.5)
        if (v > BAYER[(y & 3) * 4 + (x & 3)]) shade[y * PW + x] = Math.max(shade[y * PW + x], a)
      }
    }
  }

  // ⑤ 바닷가 — 젖은 모래 띠(땅 쪽)·얕은 물 띠(물 쪽)용 픽셀 거리(체비쇼프, 2패스). 바다·얕은 바닥 물이 있을 때만
  const beachy = (j: number) => K[j] === WATER && (P[j] === 3 || P[j] === 4)
  const nearSea = liquid === 'water' && anyBeach(P) ? chebyshev(PW, PH, beachy, 10) : null
  // 물가 띠(얕은 물·서리 테) — 바다·얕은 바닥 물, 얼음 호수
  const nearLand = nearSea || (liquid === 'ice' && anyWater) ? chebyshev(PW, PH, (j) => K[j] !== WATER, 12) : null
  // 용암 열기 — 용암에서 가까운 땅이 붉게 달아오른다
  const HOT = 14
  const nearHot = liquid === 'lava' && anyWater ? chebyshev(PW, PH, (j) => K[j] === WATER, HOT) : null

  // ⑥ 합성
  const cv = document.createElement('canvas')
  cv.width = PW
  cv.height = PH
  const ctx = cv.getContext('2d')
  if (!ctx) return { canvas: null, surface: null }
  const img = ctx.createImageData(PW, PH)
  const out = img.data
  const out32 = new Uint32Array(out.buffer)
  const DEPTH_BY_CODE = CODE_POOL.map((p) => POOL_DEPTH[p])
  const isWater = (j: number) => j < 0 || j >= N || K[j] === WATER
  const wetAt = liquid !== 'water' ? () => false : (j: number) => j >= 0 && j < N && K[j] === WATER && (P[j] === 1 || P[j] === 4)
  for (let py = 0; py < PH; py++) {
    if ((py & 3) === 0) await breathe()
    const sy = Math.floor(R.y + py)
    const ty = ((sy % 128) + 128) % 128
    for (let px = 0; px < PW; px++) {
      const i = py * PW + px
      const o = i * 4
      const sx = Math.floor(R.x + px)
      const tx = ((sx % 256) + 256) % 256
      const fog = FOGA[i]
      const k = K[i]
      // 빠른 길: 위아래 2px 가 같은 땅이고 그림자·그늘·좌우 웅덩이 없음 → 텍스처 그대로 복사(대부분의 픽셀)
      if (
        k !== WATER && fog === 0 && shade[i] === 0 && py > 1 && py < PH - 2 && (!nearSea || nearSea[i] > 10) && (!nearHot || nearHot[i] > HOT) &&
        K[i - PW] === k && K[i - 2 * PW] === k && K[i + PW] === k && K[i + 2 * PW] === k &&
        K[i - 1] === k && K[i + 1] === k && K[i - 2] === k && K[i + 2] === k
      ) {
        const t = tex[k]
        out32[i] = tex32[k][(ty % t.h) * t.w + (tx % t.w)]
        continue
      }
      const bay = BAYER[(py & 3) * 4 + (px & 3)]
      let r: number, g: number, bl: number, a: number
      if (k !== WATER) {
        // ── 땅
        const t = tex[k]
        const ti = ((ty % t.h) * t.w + (tx % t.w)) * 4
        r = t.d[ti]
        g = t.d[ti + 1]
        bl = t.d[ti + 2]
        a = 255
        let mul = 1
        const up1 = py > 0 ? K[i - PW] : k
        const up2 = py > 1 ? K[i - 2 * PW] : k
        const dn1 = py < PH - 1 ? K[i + PW] : k
        // 높은 지면(풀)이 위에 있으면 그늘 — 풀이 길 위로 살짝 덮인 느낌
        if (up1 !== WATER && rank[up1] > rank[k]) mul *= 0.72
        else if (up2 !== WATER && rank[up2] > rank[k]) mul *= 0.86
        // 아래가 낮은 지면이면 풀잎 끝 밝게(점묘)
        if (dn1 !== WATER && rank[dn1] < rank[k] && bay > 0.35) mul *= 1.16
        // 연못·바다 먼 쪽 둑 윗선 — 밝은 테두리
        if (dn1 === WATER && DEPTH_BY_CODE[P[i + PW]] > 0) mul *= 1.2
        // 웅덩이 둘레 젖은 흙(위아래 2칸·좌우 2칸 안에 웅덩이 물)
        if (
          wetAt(i - PW) || wetAt(i + PW) || wetAt(i - 1) || wetAt(i + 1) ||
          wetAt(i - 2 * PW) || wetAt(i + 2 * PW) || wetAt(i - 2) || wetAt(i + 2)
        ) {
          r = r * 0.6 + 40 * 0.4
          g = g * 0.6 + 30 * 0.4
          bl = bl * 0.6 + 22 * 0.4
        }
        // 젖은 모래 — 물에서 가까울수록 짙게(점묘로 단계)
        if (nearSea && nearSea[i] <= 10) {
          const wv = 1 - nearSea[i] / 11
          if (wv > bay * 0.9) {
            const m = nearSea[i] <= 2 ? 0.45 : 0.28
            r = r * (1 - m) + 150 * m
            g = g * (1 - m) + 118 * m
            bl = bl * (1 - m) + 80 * m
          }
        }
        mul *= 1 - shade[i]
        r *= mul
        g *= mul
        bl *= mul
        // 용암 열기 — 가까울수록 주황빛을 더한다(점묘 단계)
        if (nearHot && nearHot[i] <= HOT) {
          const hv = 1 - nearHot[i] / (HOT + 1)
          const add = hv * hv * (hv > bay * 0.8 ? 90 : 55)
          r += add
          g += add * 0.38
          bl += add * 0.08
        }
      } else {
        // ── 물
        const pk = CODE_POOL[P[i]]
        const D = DEPTH_BY_CODE[P[i]]
        let wallK = 0
        if (D > 0) for (let s = 1; s <= D; s++) if (!isWater(i - s * PW)) { wallK = s; break }
        if (wallK) {
          // 먼 쪽 둑(바위 벽) — 위가 땅, 아래로 수면까지
          const row = Math.min(WALL.h - 1, wallK - 1 + (WALL.h - D))
          const wi = (row * 256 + tx) * 4
          const dark = 1 - (wallK / D) * 0.3
          r = wall.d[wi] * dark
          g = wall.d[wi + 1] * dark
          bl = wall.d[wi + 2] * dark
          a = 255
          if (wallK >= D - 1) {
            // 수면에 닿는 거품 줄(용암은 달아오른 줄)
            r = r * 0.35 + SH.lip[0] * 0.65
            g = g * 0.35 + SH.lip[1] * 0.65
            bl = bl * 0.35 + SH.lip[2] * 0.65
          }
        } else {
          // 수면 — 비워 두고(뒤 HTML 층의 물결이 보인다) 그늘·수심·거품만 반투명으로 얹는다
          r = SH.far[0]
          g = SH.far[1]
          bl = SH.far[2]
          a = 0
          if (D > 0) {
            for (let s = D + 1; s <= D + 9; s++)
              if (!isWater(i - s * PW)) {
                a = Math.max(a, 0.5 * (1 - (s - D) / 10))
                break
              }
            const cx = (R.x + px + 0.5) / 64 + (R.y + py + 0.5) / 32
            const cy = (R.y + py + 0.5) / 32 - (R.x + px + 0.5) / 64
            const dd = distAt(cx, cy)
            // 연못은 숲 그늘에 어울리게 기본으로 한 겹 눌러 주고, 물가에서 멀수록 짙게
            if (liquid === 'water') a = Math.max(a, (pk === 'pond' ? 0.2 : 0) + Math.min(0.3, Math.max(0, (dd - 1) * 0.12)))
            // 용암은 한가운데가 더 밝다 — 물가 쪽만 살짝 식은 빛(그늘)
            else if (dd <= 1) a = Math.max(a, 0.18)
          }
          // 앞쪽 물가(바로 아래가 땅) — 거품
          const nearFront = !isWater(i + PW) || !isWater(i + 2 * PW)
          if (pk === 'puddle') {
            // 빗물 웅덩이 — 진흙 바닥이 비치는 얕은 물
            const edge = nearFront || !isWater(i - PW) || !isWater(i - 2 * PW) || !isWater(i - 1) || !isWater(i + 1) || !isWater(i - 2) || !isWater(i + 2)
            r = BED[0]
            g = BED[1]
            bl = BED[2]
            a = edge ? 0.72 : 0.4
            // 하늘 반사 반짝임
            if (!edge && ((sx * 7 + sy * 13) % 97 === 0 || (sx * 3 + sy * 5) % 151 === 0)) {
              r = 220
              g = 240
              bl = 255
              a = 0.7
            }
          } else if (nearLand && nearLand[i] <= 12 && !nearFront) {
            // 얕은 물 — 물가에서 가까울수록 밝은 청록(점묘)
            const sv = 1 - nearLand[i] / 13
            if (sv > bay) {
              r = SH.shallow[0]
              g = SH.shallow[1]
              bl = SH.shallow[2]
              a = Math.max(a, liquid === 'ice' ? (nearLand[i] <= 2 ? 0.85 : 0.35) : (nearLand[i] <= 3 ? 0.45 : 0.25) * (pk === 'flat' ? 0.6 : 1))
            }
          } else if (nearFront) {
            const strong = !isWater(i + PW)
            r = SH.front[0]
            g = SH.front[1]
            bl = SH.front[2]
            a = liquid === 'ice' ? (strong ? 0.9 : 0.6) : pk === 'flat' ? (strong ? 0.4 : 0.2) : strong ? 0.75 : 0.4
          }
          // 어두운 지역은 수면도 한 겹 눌러 준다(밝게 뜨지 않게)
          if (tone < 1 && a < 0.9 && liquid !== 'lava') {
            const da = (1 - tone) * 0.6
            const na = a + da * (1 - a)
            r = (r * a + 4 * da * (1 - a)) / na
            g = (g * a + 12 * da * (1 - a)) / na
            bl = (bl * a + 18 * da * (1 - a)) / na
            a = na
          }
          a *= 255
        }
      }
      if (fog > 0) {
        r = r * (1 - fog) + FOG[0] * fog
        g = g * (1 - fog) + FOG[1] * fog
        bl = bl * (1 - fog) + FOG[2] * fog
        a = a + (255 - a) * fog
      }
      out[o] = r
      out[o + 1] = g
      out[o + 2] = bl
      out[o + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas: cv, surface: !anyWater ? null : liquid === 'water' ? (anySea ? 'sea' : 'canal') : liquid }
}

const anyBeach = (P: Uint8Array) => {
  for (let i = 0; i < P.length; i++) if (P[i] === 3 || P[i] === 4) return true
  return false
}

/** 픽셀 거리장(체비쇼프, 앞뒤 2패스) — src(j) 가 참인 픽셀까지의 거리, cap 초과는 cap+1 */
function chebyshev(PW: number, PH: number, src: (j: number) => boolean, cap: number) {
  const d = new Uint8Array(PW * PH).fill(cap + 1)
  for (let i = 0; i < d.length; i++) if (src(i)) d[i] = 0
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x
      let v = d[i]
      if (v === 0) continue
      if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1
      if (y > 0) {
        if (d[i - PW] + 1 < v) v = d[i - PW] + 1
        if (x > 0 && d[i - PW - 1] + 1 < v) v = d[i - PW - 1] + 1
        if (x < PW - 1 && d[i - PW + 1] + 1 < v) v = d[i - PW + 1] + 1
      }
      d[i] = v
    }
  for (let y = PH - 1; y >= 0; y--)
    for (let x = PW - 1; x >= 0; x--) {
      const i = y * PW + x
      let v = d[i]
      if (v === 0) continue
      if (x < PW - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1
      if (y < PH - 1) {
        if (d[i + PW] + 1 < v) v = d[i + PW] + 1
        if (x < PW - 1 && d[i + PW + 1] + 1 < v) v = d[i + PW + 1] + 1
        if (x > 0 && d[i + PW - 1] + 1 < v) v = d[i + PW - 1] + 1
      }
      d[i] = v
    }
  return d
}

/** 자연 지면 맵의 수면(HTML, 지면 이미지 뒤) — 화면에 보이는 영역만. vx..vh = waterView() 결과(월드 px) */
export const TerrainWaterBackdrop = memo(function TerrainWaterBackdrop({ surface, vx, vy, vw, vh }: { surface: Surface; vx: number; vy: number; vw: number; vh: number }) {
  const tile = (f: string, pos = '0 0') => `url(/images/map/water/${f}) ${pos} / 256px 128px repeat`
  const big = { left: -256, top: -128, width: vw + 512, height: vh + 256 }
  if (surface === 'lava') {
    // 용암 — 바탕·식은 껍질·노란 열기 줄 세 겹이 서로 다른 빠르기로 같은 쪽(결 방향)으로 흐른다. transform·opacity 만 움직여 합성 단계에서 처리
    return (
      <div className="iso-sea iso-lava" style={{ position: 'absolute', left: vx, top: vy, width: vw, height: vh, overflow: 'hidden', pointerEvents: 'none', background: '#b8300c' }}>
        <div className="sea-glint lava-base" style={{ ...big, background: tile('lava.png') }} />
        <div className="sea-glint lava-crust" style={{ ...big, background: tile('lava-crust.png', '61px 23px') }} />
        <div className="sea-glint lava-glint" style={{ ...big, background: tile('lava-glint.png', '131px 77px') }} />
      </div>
    )
  }
  if (surface === 'ice') {
    // 얼음 — 멈춘 바탕 위로 반짝임만 아주 느리게
    return (
      <div className="iso-sea" style={{ position: 'absolute', left: vx, top: vy, width: vw, height: vh, overflow: 'hidden', pointerEvents: 'none', background: tile('ice.png') }}>
        <div className="sea-glint ice-glint" style={{ ...big, background: tile('ice-glint.png') }} />
      </div>
    )
  }
  const sea = surface === 'sea'
  return (
    <div className="iso-sea" style={{ position: 'absolute', left: vx, top: vy, width: vw, height: vh, overflow: 'hidden', pointerEvents: 'none', background: tile(surface + '.png') }}>
      <div className={`sea-glint ${sea ? 'sea-glint-a' : 'canal-glint-a'}`} style={{ ...big, background: tile(sea ? 'sea-glint.png' : 'canal-glint.png') }} />
      <div className="sea-glint sea-glint-b" style={{ ...big, background: tile(sea ? 'sea-glint2.png' : 'canal-glint2.png', sea ? '97px 41px' : '61px 23px') }} />
    </div>
  )
})
