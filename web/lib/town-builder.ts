// ============================================================================
// 범용 마을 빌더 (64×56 섬 마을) — 버려진 신전 / 오로라 마을 / 마물 마을이 공유
//  · lib/atlantis-map.ts · lib/skytown-map.ts 와 같은 구조를 테마 설정(TownCfg)으로 일반화.
//  · 작업 순서: 섬 윤곽(불변) → 도로 → 광장 → 건물(도로 기준 열 배치) → 조경 → 섬 바깥 장식
//  · 스프라이트 앵커: PNG 하단 중앙 = cell, 건물 바닥은 cell 에서 뒤(-x,-y)로 뻗음 → put() 이
//    "바닥 중심 좌표"를 받아 앞 꼭짓점 앵커 + 충돌 박스(= 보이는 바닥)를 함께 계산한다.
// ============================================================================
import type { PropDef, PropKind, TileKind } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'

export type Blocker = { x0: number; y0: number; x1: number; y1: number }

export const TOWN_W = 64
export const TOWN_H = 56
export const TOWN_CX = 32
export const TOWN_ENTRANCE_CY = 52

const CROSS_Y = 23
const RES_Y = 32
const PARK_CY = 42
const WLANE_X = 17
const ELANE_X = 47
const ISLAND_CY = 30
const CX = TOWN_CX
const ENT = TOWN_ENTRANCE_CY

/** 섬 윤곽(불변) — 1 초과 = 바깥 */
export function townIslandNorm(x: number, y: number): number {
  const dx = x - CX
  const dy = y - ISLAND_CY
  const angle = Math.atan2(dy, dx)
  const wobble = Math.sin(angle * 3) * 1.6 + Math.sin(angle * 7 + 1.3) * 0.9 + Math.sin(angle * 13 + 0.4) * 0.4
  const rx = Math.max(22, 23 + wobble)
  const ry = Math.max(26, 27 + wobble * 0.85)
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
}

type Zone = 'out' | 'road' | 'square' | 'block' | 'garden'
const inR = (x: number, y: number, r: Blocker) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1
const octa = (x: number, y: number, cx: number, cy: number, m: number, s: number) => {
  const dx = Math.abs(x - cx)
  const dy = Math.abs(y - cy)
  return Math.max(dx, dy) < m && dx + dy < s
}
const FORECOURT: Blocker = { x0: 24, y0: 9, x1: 40, y1: 16.8 }
const GARDENS: Blocker[] = [
  { x0: 10, y0: 27.5, x1: 25.4, y1: 28.7 },
  { x0: 38.6, y0: 27.5, x1: 54, y1: 28.7 },
  { x0: 10, y0: 41.2, x1: 27, y1: 50.6 },
  { x0: 37, y0: 41.2, x1: 54, y1: 50.6 },
]
function isSquare(x: number, y: number): boolean {
  return octa(x, y, CX, CROSS_Y, 6.8, 9.6) || octa(x, y, CX, PARK_CY, 5.6, 8.2) || inR(x, y, FORECOURT)
}
function isRoad(x: number, y: number): boolean {
  if (Math.abs(x - CX) < 2 && y > 14 && y < 54) return true
  if (Math.abs(y - CROSS_Y) < 1.5 && x > 8 && x < 57) return true
  if (Math.abs(y - RES_Y) < 1.2 && x > 9 && x < 56) return true
  if (Math.abs(x - WLANE_X) < 1 && y > 24.5 && y < 47) return true
  if (Math.abs(x - ELANE_X) < 1 && y > 24.5 && y < 47) return true
  return false
}
export function townZoneAt(x: number, y: number): Zone {
  const norm = townIslandNorm(x, y)
  if (norm > 1) return 'out'
  if (isSquare(x, y)) return 'square'
  if (isRoad(x, y)) return 'road'
  for (const g of GARDENS) if (inR(x, y, g)) return 'garden'
  if (norm > 0.88) return 'garden'
  return 'block'
}

// ─────────────────────────────────────────────────────────────────────────────
// 스프라이트 정의 / 테마 설정
// ─────────────────────────────────────────────────────────────────────────────
export interface Spr { s: string; w: number; h: number; fw: number; fd: number }
/** 경로·트림된 px 로 정의. fw/fd 생략 시 폭/72 로 바닥 크기 추정 */
export const spr = (s: string, w: number, h: number, fw?: number, fd?: number): Spr => {
  const f = fw ?? Math.round((w / 72) * 100) / 100
  return { s, w, h, fw: f, fd: fd ?? f }
}

export interface TownCfg {
  /** 프롭 id 접두어 */
  id: string
  tiles: { outside: TileKind; road: TileKind; square: TileKind; garden: TileKind }
  /** 섬 바깥 이동 차단 여부(하늘/용암/안개) */
  blockOutside: boolean
  temple: Spr
  /** 신전 바닥 중심 y (x 는 32) */
  templeCy: number
  templeLabel: string
  hall: Spr
  hallLabel: string
  /** 주택 변주(인덱스 0~n, 마지막이 선술집) — 열 배치가 순환 사용 */
  houses: Spr[]
  stallA: Spr
  stallB: Spr
  centerFountain: Spr
  centerFountainLabel: string
  parkFountain: Spr
  parkFountainLabel: string
  statue: Spr
  stairs: Spr
  gtower: Spr
  crystals: Spr
  planter: Spr
  /** 골목·정원에 흩뿌리는 화분 대신 쓸 것(생략 = planter). 광장 네 귀퉁이 화분은 그대로 planter */
  scatterPlanter?: Spr
  /** 골목·정원에 흩뿌리는 crystals 대신 쓸 것(생략 = crystals). 광장·입구 장식은 그대로 crystals */
  scatterCrystals?: Spr
  patch: Spr
  lamp: Spr
  tree: Spr
  benches: { SE: Spr; NW: Spr; SW: Spr; NE: Spr }
  gardenbed?: Spr
  gazebo?: Spr
  /** 섬 바깥 해안 띠(구름/안개/용암 바위) */
  rim: Spr[]
  /** 섬 바깥 떠 있는 섬·바위 — [스프라이트, x, y] */
  floats: [Spr, number, number][]
  /** 입구 바깥 정박물(비공선 등) */
  ships?: [Spr, number, number][]
  /** 첨탑/기둥 장식 */
  spires?: [Spr, number, number][]
  seed: number
}

export interface TownOut {
  props: PropDef[]
  blockers: Blocker[]
  tileAt: (x: number, y: number) => TileKind
}

export function createTown(cfg: TownCfg): TownOut {
  const tileAt = (x: number, y: number): TileKind => {
    const z = townZoneAt(x, y)
    if (z === 'out') return cfg.tiles.outside
    if (z === 'road') return cfg.tiles.road
    if (z === 'garden') return cfg.tiles.garden
    return cfg.tiles.square
  }

  const P: PropDef[] = []
  const B: Blocker[] = []
  const baseBox = (cx: number, cy: number, fw: number, fd: number, k = 0.9): Blocker => ({
    x0: cx - (fw * k) / 2, y0: cy - (fd * k) / 2, x1: cx + (fw * k) / 2, y1: cy + (fd * k) / 2,
  })
  const overlaps = (a: Blocker, b: Blocker) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
  const buildable = (cx: number, cy: number, fw: number, fd: number) => {
    const hx = fw / 2
    const hy = fd / 2
    const pts: [number, number][] = [
      [cx, cy], [cx - hx, cy - hy], [cx + hx, cy - hy], [cx - hx, cy + hy], [cx + hx, cy + hy],
      [cx - hx, cy], [cx + hx, cy], [cx, cy - hy], [cx, cy + hy],
    ]
    return pts.every(([x, y]) => townZoneAt(x, y) === 'block')
  }
  const decorFree = (cx: number, cy: number, r: number) => {
    if (townZoneAt(cx, cy) === 'out') return false
    const bb: Blocker = { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }
    return !B.some((b) => overlaps(bb, b))
  }

  interface PutOpt {
    kind?: PropKind
    solid?: boolean
    label?: string
    decor?: boolean
    free?: boolean
    k?: number
    bw?: number
    bd?: number
  }
  let seq = 0
  function put(id: string, S: Spr, cx: number, cy: number, o: PutOpt = {}): boolean {
    const solid = o.solid ?? true
    if (o.free) {
      // no check
    } else if (o.decor) {
      if (!decorFree(cx, cy, Math.max(S.fw, S.fd) * 0.4)) return false
    } else if (!buildable(cx, cy, S.fw, S.fd) || B.some((b) => overlaps(baseBox(cx, cy, S.fw, S.fd, 0.86), b))) {
      return false
    }
    P.push({
      id: `${cfg.id}-${id}-${seq++}`, kind: o.kind ?? 'cottage', cell: { x: cx + S.fw / 2, y: cy + S.fd / 2 },
      size: { w: 0.1, d: 0.1 }, radial: true, label: o.label, sprite: S.s, px: { w: S.w, h: S.h },
    })
    if (solid) B.push(baseBox(cx, cy, o.bw ?? S.fw, o.bd ?? S.fd, o.k ?? 0.9))
    return true
  }
  const H = (i: number) => cfg.houses[i % cfg.houses.length]
  /** +x 방향으로 건물을 이어 붙임 (인덱스 → cfg.houses) */
  function rowX(pre: string, list: number[], x0: number, fy: number, gap = 0.2, xMax = 99) {
    let cur = x0
    list.forEach((idx, i) => {
      const S = H(idx)
      const fx = cur + S.fw
      if (fx > xMax) return
      put(`${pre}${i}`, S, fx - S.fw / 2, fy - S.fd / 2, { kind: 'shop' })
      cur = fx + gap
    })
  }
  const deco = (id: string, S: Spr, x: number, y: number, o: PutOpt = {}) => put(id, S, x, y, { decor: true, solid: false, kind: 'bush', ...o })
  const hard = (id: string, S: Spr, x: number, y: number, o: PutOpt = {}) => put(id, S, x, y, { decor: true, solid: true, ...o })
  const benchRing = (pre: string, cx: number, cy: number, r: number) => {
    hard(`${pre}w`, cfg.benches.SE, cx - r, cy, { kind: 'bench', k: 0.9 })
    hard(`${pre}e`, cfg.benches.NW, cx + r, cy, { kind: 'bench', k: 0.9 })
    hard(`${pre}n`, cfg.benches.SW, cx, cy - r, { kind: 'bench', k: 0.9 })
    hard(`${pre}s`, cfg.benches.NE, cx, cy + r, { kind: 'bench', k: 0.9 })
  }

  // ═══════════════ 랜드마크(북) — 신전 ═══════════════
  put('temple', cfg.temple, CX, cfg.templeCy, { free: true, kind: 'dome', label: cfg.templeLabel, k: 0.8 })
  const gb = cfg.gardenbed ?? cfg.planter
  ;[[26.6, 11.6], [37.4, 11.6], [26.6, 14.6], [37.4, 14.6]].forEach(([x, y], i) => hard(`fgarden${i}`, gb, x, y, { kind: 'bush', k: 0.7 }))
  ;[[30.2, 11.0], [33.8, 11.0], [30.2, 14.4], [33.8, 14.4]].forEach(([x, y], i) => deco(`fpatch${i}`, cfg.patch, x, y))
  ;[[29.0, 9.8], [35.0, 9.8]].forEach(([x, y], i) => hard(`fstatue${i}`, cfg.statue, x, y, { kind: 'statue' }))
  ;[[25.0, 9.6], [39.0, 9.6], [25.0, 16.0], [39.0, 16.0]].forEach(([x, y], i) => deco(`fcrystal${i}`, cfg.crystals, x, y))
  ;[[28.6, 15.8], [35.4, 15.8]].forEach(([x, y], i) => deco(`flamp${i}`, cfg.lamp, x, y, { kind: 'lamp' }))

  // ═══════════════ 광장 — 중앙 + 남측 ═══════════════
  hard('cfountain', cfg.centerFountain, CX, CROSS_Y, { kind: 'fountain', label: cfg.centerFountainLabel, k: 0.85 })
  benchRing('cbench', CX, CROSS_Y, 3.3)
  ;[[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]].forEach(([dx, dy], i) => hard(`cplanter${i}`, cfg.planter, CX + dx, CROSS_Y + dy, { kind: 'bush' }))
  hard('cstall0', cfg.stallA, CX - 6.0, CROSS_Y - 2.4, { kind: 'stall' })
  hard('cstall1', cfg.stallB, CX + 6.0, CROSS_Y - 2.4, { kind: 'stall' })
  hard('cstall2', cfg.stallB, CX - 6.0, CROSS_Y + 2.6, { kind: 'stall' })
  hard('cstall3', cfg.stallA, CX + 6.0, CROSS_Y + 2.6, { kind: 'stall' })
  ;[[-3.8, -6.2], [3.8, -6.2], [-3.8, 6.2], [3.8, 6.2]].forEach(([dx, dy], i) => deco(`cpatch${i}`, cfg.patch, CX + dx, CROSS_Y + dy))
  ;[[-3.8, -3.8], [3.8, 3.8]].forEach(([dx, dy], i) => deco(`clamp${i}`, cfg.lamp, CX + dx, CROSS_Y + dy, { kind: 'lamp' }))

  hard('pfountain', cfg.parkFountain, CX, PARK_CY, { kind: 'fountain', label: cfg.parkFountainLabel, k: 0.85 })
  benchRing('pbench', CX, PARK_CY, 3.2)
  ;[[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]].forEach(([dx, dy], i) => hard(`pplanter${i}`, cfg.planter, CX + dx, PARK_CY + dy, { kind: 'bush' }))
  ;[[-4.6, -2.0], [4.6, 2.0]].forEach(([dx, dy], i) => deco(`plamp${i}`, cfg.lamp, CX + dx, PARK_CY + dy, { kind: 'lamp' }))
  hard('pstatue0', cfg.statue, CX - 2.4, PARK_CY + 3.0, { kind: 'statue' })
  hard('pstatue1', cfg.statue, CX + 2.4, PARK_CY - 3.0, { kind: 'statue' })
  if (cfg.gazebo) hard('pgazebo', cfg.gazebo, CX + 4.8, PARK_CY + 3.4, { kind: 'gazebo' })

  // ═══════════════ 왼쪽(서) / 오른쪽(동) 부지 — 도로 기준 열 배치 ═══════════════
  // 인덱스: 0~n 주택 변주 (마지막 = 선술집). 열마다 순환 패턴이 달라 이웃이 같은 건물이 되지 않게 한다.
  rowX('w1-', [0, 1, 5, 2, 6, 4, 7, 8], 11.2, 21.2, 0.15, 25.4)
  rowX('w0-', [3, 4, 1, 7, 0], 15.2, 18.4, 0.2, 24.5)
  rowX('w2a-', [2, 8, 4], 10.6, 27.2, 0.15, 15.6)
  rowX('w2b-', [6, 3, 4], 18.7, 27.2, 0.15, 25.2)
  rowX('w3a-', [4, 7, 0], 10.6, 30.55, 0.2, 15.6)
  rowX('w3b-', [3, 1, 8, 2], 18.7, 30.55, 0.2, 29.4)
  rowX('w4a-', [6, 4, 3], 10.6, 35.1, 0.15, 15.6)
  rowX('w4b-', [2, 0, 7, 4], 18.7, 35.1, 0.15, 29.4)
  rowX('wh1a-', [4, 1, 8], 10.6, 39.8, 0.15, 15.6)
  rowX('wh1b-', [0, 5, 6], 18.7, 39.8, 0.15, 26.2)

  put('hall', cfg.hall, 46.0, 19.9, { kind: 'shop', label: cfg.hallLabel, k: 0.85 })
  rowX('e1a-', [7, 0, 1], 39.6, 21.2, 0.15, 44.4)
  rowX('e1b-', [1, 4, 8, 3], 48.5, 21.2, 0.15, 53.5)
  rowX('e0-', [4, 6, 0, 1], 39.0, 18.2, 0.2, 44.4)
  rowX('e0b-', [8, 2, 1], 48.6, 18.2, 0.2, 54)
  rowX('e2a-', [3, 7, 4], 39.0, 27.2, 0.15, 45.6)
  rowX('e2b-', [2, 0, 6], 48.4, 27.2, 0.15, 54)
  rowX('e3a-', [1, 3, 8], 39.0, 30.55, 0.2, 45.6)
  rowX('e3b-', [4, 7], 48.4, 30.55, 0.2, 54)
  rowX('e4a-', [0, 6, 1], 39.0, 35.1, 0.15, 45.6)
  rowX('e4b-', [3, 8, 2], 48.4, 35.1, 0.15, 54)
  rowX('eh1a-', [1, 5, 7], 37.8, 39.8, 0.15, 45.6)
  rowX('eh1b-', [2, 4, 6], 48.4, 39.8, 0.15, 54)
  rowX('nw1-', [1, 0, 4], 13.8, 14.6, 0.2, 21.4)
  rowX('ne1-', [4, 2, 7, 1, 8], 40.6, 13.6, 0.2, 51)
  rowX('ne2-', [6, 3, 1, 2], 40.6, 17.0, 0.2, 52)

  // ═══════════════ 입구 — 계단 + 성탑 2 ═══════════════
  put('stairs', cfg.stairs, CX, ENT - 1.6, { decor: true, solid: false, kind: 'gate', label: '마을 입구' })
  ;[-1, 1].forEach((sx) => {
    put(`gtower${sx}`, cfg.gtower, CX + sx * 3.9, ENT - 1.8, { decor: true, kind: 'tower', k: 0.8 })
    deco(`gcrystal${sx}`, cfg.crystals, CX + sx * 2.6, ENT - 4.2)
    deco(`glamp${sx}`, cfg.lamp, CX + sx * 2.3, ENT - 3.2, { kind: 'lamp' })
  })

  // 도로변 가로등(드문드문) + 패치
  ;[14, 22, 42, 50, 54].forEach((x) => deco(`lampx${x}`, cfg.lamp, x, 24.9, { kind: 'lamp' }))
  deco('lampa', cfg.lamp, 30.1, 34.0, { kind: 'lamp' })
  deco('lampb', cfg.lamp, 33.9, 34.0, { kind: 'lamp' })
  ;[[11.5, 28.2], [14.0, 28.2], [19.0, 28.2], [21.6, 28.2], [24.0, 28.2], [40.0, 28.2], [43.0, 28.2], [49.5, 28.2], [52.0, 28.2]].forEach(([x, y], i) =>
    deco(`gpatch${i}`, cfg.patch, x, y),
  )

  // ═══════════════ 조경 패스 ═══════════════
  {
    const rand = mulberry32(cfg.seed)
    type Pick = [Spr, PropKind, number]
    const sp = cfg.scatterPlanter ?? cfg.planter
    const sc = cfg.scatterCrystals ?? cfg.crystals
    const pickBlock: Pick[] = [[cfg.patch, 'bush', 0.4], [sp, 'bush', 0.2], [sc, 'bush', 0.25], [cfg.tree, 'tree', 0.15]]
    const pickGarden: Pick[] = [[cfg.tree, 'tree', 0.42], [cfg.patch, 'bush', 0.28], [sc, 'bush', 0.15], [sp, 'bush', 0.15]]
    const choose = (tbl: Pick[]) => {
      let r = rand()
      for (const [k, kind, w] of tbl) if ((r -= w) <= 0) return { k, kind }
      return { k: tbl[0][0], kind: tbl[0][1] }
    }
    let n = 0
    for (let y = 4; y < 54; y += 1.6) {
      for (let x = 8; x < 56; x += 1.6) {
        const jx = x + (rand() - 0.5) * 0.9
        const jy = y + (rand() - 0.5) * 0.9
        const z = townZoneAt(jx, jy)
        if (z !== 'block' && z !== 'garden') continue
        if (rand() > (z === 'garden' ? 0.62 : 0.18)) continue
        const { k, kind } = choose(z === 'garden' ? pickGarden : pickBlock)
        const solid = k === cfg.planter || k === sp || k === cfg.tree
        if (put(`fill${n}`, k, jx, jy, { decor: true, solid, kind })) n++
      }
    }
  }

  // ═══════════════ 섬 바깥 장식 ═══════════════
  if (cfg.rim.length) {
    const rand = mulberry32(cfg.seed + 777)
    let n = 0
    for (let y = 0.5; y < TOWN_H; y += 2.0) {
      for (let x = 0.5; x < TOWN_W; x += 2.0) {
        const jx = x + (rand() - 0.5) * 1.2
        const jy = y + (rand() - 0.5) * 1.2
        const d = townIslandNorm(jx, jy) - 1
        if (d < 0.02 || d > 0.34 || rand() > 0.6) continue
        put(`rim${n++}`, cfg.rim[Math.floor(rand() * cfg.rim.length)], jx, jy, { free: true, solid: false, kind: 'bush' })
      }
    }
  }
  cfg.floats.forEach(([S, x, y], i) => put(`float${i}`, S, x, y, { free: true, solid: false, kind: 'bush' }))
  cfg.ships?.forEach(([S, x, y], i) => put(`ship${i}`, S, x, y, { free: true, solid: false, kind: 'bush' }))
  cfg.spires?.forEach(([S, x, y], i) => put(`spire${i}`, S, x, y, { free: true, solid: false, kind: 'tree' }))

  // 섬 바깥 이동 차단(선택)
  if (cfg.blockOutside) {
    for (let j = 0; j < TOWN_H; j++) {
      let i0 = -1
      for (let i = 0; i <= TOWN_W; i++) {
        const outside = i < TOWN_W && townZoneAt(i + 0.5, j + 0.5) === 'out'
        if (outside && i0 < 0) i0 = i
        if (!outside && i0 >= 0) {
          B.push({ x0: i0, y0: j, x1: i, y1: j + 1 })
          i0 = -1
        }
      }
    }
  }

  return { props: P, blockers: B, tileAt }
}
