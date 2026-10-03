// ============================================================================
// 아틀란티스 마을 (64×56) — 리빌드
//  · 작업 순서: 해안선(불변) → 수로 → 도로 → 광장 → 건물(도로 기준 열 배치) → 조경
//  · 스프라이트 앵커 규칙(실측): PNG 하단 중앙 = cell, 건물 바닥 다이아몬드는 cell 에서
//    뒤쪽(-x,-y)으로 뻗는다. 그래서 put() 은 "바닥 중심 좌표"를 받아 앞 꼭짓점(cell)과
//    충돌 박스(= 보이는 바닥)를 함께 계산한다. → 보이는 것 = 막히는 것.
//  · 지형 좌표계: 화면 오른쪽아래 = +x, 화면 왼쪽아래 = +y (아이소 2:1)
// ============================================================================
import type { IsoStructGroup, PropDef, PropKind, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'

type Blocker = { x0: number; y0: number; x1: number; y1: number }

export const AW = 64
export const AH = 56
export const ACX = 32
export const ENTRANCE_CY = 52

const CROSS_Y = 23 // 동서 대로 / 중앙 광장 중심 y
const RES_Y = 32 // 주거 골목 y
const PARK_CY = 42 // 남측 해양광장 중심 y
const WLANE_X = 17 // 서쪽 남북 골목
const ELANE_X = 47 // 동쪽 남북 골목
const CANAL_Y0 = 35.4
const CANAL_Y1 = 37.4

const ISLAND_CY = 30
/** 수로·바다 수면이 땅보다 내려간 높이(px) — components/game/iso-water.tsx DEPTH 와 맞춘다 */
const WATER_DROP = 20

/** 해안선(불변) — 기존 각도별 물결 노이즈 그대로. 1 초과 = 바다 */
export function atlantisIslandNorm(x: number, y: number): number {
  const dx = x - ACX
  const dy = y - ISLAND_CY
  const angle = Math.atan2(dy, dx)
  const wobble = Math.sin(angle * 3) * 1.6 + Math.sin(angle * 7 + 1.3) * 0.9 + Math.sin(angle * 13 + 0.4) * 0.4
  const rx = Math.max(22, 23 + wobble)
  const ry = Math.max(26, 27 + wobble * 0.85)
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
}

// ─────────────────────────────────────────────────────────────────────────────
// 지형
// ─────────────────────────────────────────────────────────────────────────────
type Zone = 'sea' | 'canal' | 'road' | 'bridge' | 'square' | 'block' | 'garden'

const inR = (x: number, y: number, r: Blocker) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1

/** 수로 — 바다와 이어진 물길. 다리 구간(BRIDGES)은 걸어서 건널 수 있다 */
const CANALS: Blocker[] = [
  { x0: 5, y0: CANAL_Y0, x1: 29.6, y1: CANAL_Y1 }, // 서쪽 항구 수로
  { x0: 34.4, y0: CANAL_Y0, x1: 59, y1: CANAL_Y1 }, // 동쪽 항구 수로
  { x0: 37.7, y0: 1, x1: 39.5, y1: 14.2 }, // 랜드마크 동쪽 해자
  { x0: 19.5, y0: 1, x1: 21.3, y1: 14.2 }, // 랜드마크 서쪽 해자
  { x0: 23.4, y0: 51.2, x1: 29.4, y1: 57 }, // 입구 선착장 수로(서)
  { x0: 34.6, y0: 51.2, x1: 40.6, y1: 57 }, // 입구 선착장 수로(동)
  { x0: 28.5, y0: 9.4, x1: 29.7, y1: 13.4 }, // 앞마당 반사수로(서)
  { x0: 34.3, y0: 9.4, x1: 35.5, y1: 13.4 }, // 앞마당 반사수로(동)
]
const BRIDGES: Blocker[] = [
  { x0: WLANE_X - 1, y0: CANAL_Y0, x1: WLANE_X + 1, y1: CANAL_Y1 },
  { x0: ELANE_X - 1, y0: CANAL_Y0, x1: ELANE_X + 1, y1: CANAL_Y1 },
]
const FORECOURT: Blocker = { x0: 21.4, y0: 7.2, x1: 37.6, y1: 16.8 }

const octa = (x: number, y: number, cx: number, cy: number, m: number, s: number) => {
  const dx = Math.abs(x - cx)
  const dy = Math.abs(y - cy)
  return Math.max(dx, dy) < m && dx + dy < s
}

function isSquare(x: number, y: number): boolean {
  return (
    octa(x, y, ACX, CROSS_Y, 6.5, 9.2) || // 중앙 광장
    octa(x, y, ACX, PARK_CY, 5.6, 8.2) || // 남측 해양광장
    inR(x, y, FORECOURT) // 랜드마크 앞마당
  )
}

function isRoad(x: number, y: number): boolean {
  if (Math.abs(x - ACX) < 2 && y > 14 && y < 54) return true // 환영길(대로)
  if (Math.abs(y - CROSS_Y) < 1.5 && x > 8 && x < 57) return true // 동서 대로
  if (Math.abs(y - RES_Y) < 1.2 && x > 9 && x < 56) return true // 주거 골목
  if (Math.abs(x - WLANE_X) < 1 && y > 24.5 && y < 47) return true // 서쪽 골목
  if (Math.abs(x - ELANE_X) < 1 && y > 24.5 && y < 47) return true // 동쪽 골목
  if (Math.abs(y - 45.5) < 1 && ((x > 10 && x < 26.4) || (x > 37.6 && x < 54))) return true // 항구 해안길
  return false
}

/** 뒷마당 정원 띠 — 잔디는 여기에만 남긴다(빈 잔디 벌판 제거) */
const GARDENS: Blocker[] = [
  { x0: 10, y0: 27.5, x1: 25.4, y1: 28.7 },
  { x0: 38.6, y0: 27.5, x1: 54, y1: 28.7 },
  { x0: 27.6, y0: 3.4, x1: 37.4, y1: 7.2 }, // 성당 뒤뜰(동쪽)
]

function zoneAt(x: number, y: number): Zone {
  const norm = atlantisIslandNorm(x, y)
  if (norm > 1) return 'sea'
  for (const b of BRIDGES) if (inR(x, y, b)) return 'bridge'
  for (const c of CANALS) if (inR(x, y, c)) return 'canal'
  if (isSquare(x, y)) return 'square'
  if (isRoad(x, y)) return 'road'
  for (const g of GARDENS) if (inR(x, y, g)) return 'garden'
  if (norm > 0.86) return 'garden' // 해안 잔디 띠
  return 'block'
}

/** 물 지형(components/game/iso-water.tsx) — 바다·수로는 이어진 수면, 다리는 땅 높이 */
export function atlantisWaterAt(x: number, y: number): 'sea' | 'canal' | 'bridge' | null {
  const z = zoneAt(x, y)
  return z === 'sea' || z === 'canal' || z === 'bridge' ? z : null
}

export function atlantisTileAt(x: number, y: number): TileKind {
  const z = zoneAt(x, y)
  if (z === 'sea' || z === 'canal') return 'water'
  if (z === 'road' || z === 'bridge') return 'path'
  if (z === 'garden') return 'grass'
  return 'plaza' // square / block
}

// ─────────────────────────────────────────────────────────────────────────────
// 스프라이트 카탈로그 — px = 트림된 실제 픽셀, fw/fd = 보이는 바닥 다이아몬드(셀)
// ─────────────────────────────────────────────────────────────────────────────
const D = '/images/map/props/atlantis/'
interface Spr { s: string; w: number; h: number; fw: number; fd: number }
const spr = (f: string, w: number, h: number, fw: number, fd = fw): Spr => ({ s: D + f, w, h, fw, fd })

const SPR = {
  palace: spr('atl_palace_new.png', 320, 307, 4.7),
  hall: spr('atl_hall_new.png', 184, 175, 2.6),
  shopA: spr('atl_shopA_new.png', 100, 118, 1.4),
  shopB: spr('atl_shopB_new.png', 99, 116, 1.4),
  shopC: spr('atl_shopC_new.png', 99, 119, 1.4),
  shopD: spr('atl_shopD_new.png', 107, 121, 1.5),
  house: spr('atl_house.png', 104, 111, 1.4),
  houseC: spr('atl_houseC.png', 102, 125, 1.4),
  houseD: spr('atl_houseD_new.png', 121, 111, 1.6),
  townA: spr('atl2_townA.png', 82, 113, 1.15),
  townB: spr('atl2_townB.png', 74, 108, 1.0),
  townC: spr('atl2_townC.png', 86, 97, 1.2),
  cafe: spr('atl2_cafe.png', 112, 103, 1.5),
  warehouse: spr('atl2_warehouse.png', 118, 108, 1.7),
  stallTeal: spr('atl2_stallTeal.png', 86, 75, 1.1),
  stall: spr('atl_stall.png', 84, 84, 1.1),
  stallB: spr('atl_stallB.png', 81, 91, 1.1),
  stallC: spr('atl_stallC.png', 76, 87, 1.0),
  tower: spr('atl2_tower.png', 51, 124, 0.75),
  wallNE: spr('atl2_wallNE.png', 89, 68, 0.5),
  wallNEf: spr('atl2_wallNE_f.png', 89, 68, 0.5),
  octo: spr('atl3_octo.png', 120, 160, 1.9), // 쿼터뷰 3단 문어 분수(벽돌 받침)
  wallG: spr('atl3_wall.png', 167, 112, 0.6),
  wallGf: spr('atl3_wall_f.png', 167, 112, 0.6),
  towerG: spr('atl3_tower.png', 88, 172, 1.1),
  fountain: spr('atl_fountain_new.png', 113, 143, 1.6),
  gardenbed: spr('atl2_gardenbed.png', 106, 64, 1.5),
  planter: spr('atl2_planter.png', 45, 64, 0.8),
  bridge: spr('atl2_bridge.png', 86, 51, 1.0),
  bridgef: spr('atl2_bridge_f.png', 86, 51, 1.0),
  boat: spr('atl5_boat.png', 62, 69, 0.9), // PixelLab 2026-10-04 — 물 받침 없는 나룻배(수면 높이로 내려 배치)
  gazebo: spr('atl_gazebo.png', 67, 77, 0.9),
  // 입구 선착장/낚시터 (atl4_*)
  pier: spr('atl4_pier.png', 98, 77, 1.2), // 갑판이 +x 방향으로 긴 부두(충돌은 2.4×0.9 로 별도)
  fishpier: spr('atl4_fishpier.png', 89, 83, 1.3),
  hut: spr('atl4_hut.png', 103, 98, 1.5),
  rack: spr('atl4_rack.png', 78, 76, 1.2),
  fboat: spr('atl5_boat2.png', 62, 72, 1.0),
  rock1: spr('atl5_rock1.png', 66, 61, 0.8), // 바다 바위(PixelLab)
  rock2: spr('atl5_rock2.png', 53, 66, 0.7),
  stack1: spr('atl5_stack1.png', 68, 79, 0.8),
  stack2: spr('atl5_stack2.png', 66, 83, 0.8),
  crates: spr('atl4_crates.png', 49, 49, 0.7),
  // 벤치 4방향(앉는 방향): SE=+x, SW=+y, NW=-x, NE=-y. 벤치 길이는 바라보는 축의 수직 방향
  benchSE: spr('atl3_benchSE.png', 53, 57, 0.55, 1.25),
  benchNW: spr('atl3_benchNW.png', 55, 50, 0.55, 1.25),
  benchSW: spr('atl3_benchSW.png', 53, 57, 1.25, 0.55),
  benchNE: spr('atl3_benchNE.png', 55, 50, 1.25, 0.55),
  flowerbed: spr('atl_flowerbed.png', 46, 27, 0.6),
  topiary: spr('atl_topiary.png', 53, 65, 0.5),
  kelp: spr('atl_kelp.png', 53, 78, 0.5),
  reef: spr('atl_reef_new.png', 65, 48, 0.7),
  lamp: spr('atl_lamp.png', 14, 66, 0.2),
  banner: spr('atl_banner.png', 21, 47, 0.2),
  barrel: spr('atl_barrel.png', 33, 32, 0.4),
  noticeboard: spr('atl_noticeboard.png', 34, 48, 0.4),
  citizen: spr('atl_citizen.png', 18, 46, 0.3),
  guard: spr('atl_guard.png', 28, 47, 0.4),
} satisfies Record<string, Spr>
type SprKey = keyof typeof SPR

// ─────────────────────────────────────────────────────────────────────────────
// 조립
// ─────────────────────────────────────────────────────────────────────────────
function build() {
  const P: PropDef[] = []
  const B: Blocker[] = []

  const baseBox = (cx: number, cy: number, fw: number, fd: number, k = 0.9): Blocker => ({
    x0: cx - (fw * k) / 2,
    y0: cy - (fd * k) / 2,
    x1: cx + (fw * k) / 2,
    y1: cy + (fd * k) / 2,
  })
  const overlaps = (a: Blocker, b: Blocker) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

  /** 바닥 사각형이 전부 "건축 가능 지면(block)" 위인가 */
  const buildable = (cx: number, cy: number, fw: number, fd: number) => {
    const hx = fw / 2
    const hy = fd / 2
    const pts: [number, number][] = [
      [cx, cy], [cx - hx, cy - hy], [cx + hx, cy - hy], [cx - hx, cy + hy], [cx + hx, cy + hy],
      [cx - hx, cy], [cx + hx, cy], [cx, cy - hy], [cx, cy + hy],
    ]
    return pts.every(([x, y]) => zoneAt(x, y) === 'block')
  }
  /** 장식물(잔디/광장/길 위 모두 가능) — 물·다른 충돌체와만 겹치지 않으면 OK */
  const decorFree = (cx: number, cy: number, r: number) => {
    const z = zoneAt(cx, cy)
    if (z === 'sea' || z === 'canal') return false
    const bb: Blocker = { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }
    return !B.some((b) => overlaps(bb, b))
  }

  interface PutOpt {
    kind?: PropKind
    solid?: boolean // 충돌 박스 생성 여부
    label?: string
    flip?: boolean
    /** 건축 가능 지면 검사 대신 장식 검사 */
    decor?: boolean
    k?: number // 충돌 박스 축소율
    water?: boolean // 물 위 배치 허용(부두·보트) — 다른 충돌체와만 겹치지 않으면 OK
    bw?: number // 충돌 박스 크기 오버라이드(스프라이트 앵커용 fw/fd 와 다를 때)
    bd?: number
    dx?: number // 충돌 박스 중심 보정
    dy?: number
  }

  /** 바닥 중심 (cx,cy) 기준 배치 → 앞 꼭짓점 앵커/충돌 박스 자동 계산 */
  function put(id: string, key: SprKey, cx: number, cy: number, o: PutOpt = {}): boolean {
    const fk = `${key}f` as SprKey
    const S = o.flip && fk in SPR ? SPR[fk] : SPR[key]
    const solid = o.solid ?? true
    if (o.water) {
      const bb = baseBox(cx, cy, S.fw, S.fd, 0.6)
      if (B.some((b) => overlaps(bb, b))) return false
    } else if (o.decor) {
      if (!decorFree(cx, cy, Math.max(S.fw, S.fd) * 0.4)) {
        return false
      }
    } else if (!buildable(cx, cy, S.fw, S.fd) || B.some((b) => overlaps(baseBox(cx, cy, S.fw, S.fd, 0.86), b))) {
      return false
    }
    P.push({
      id: `atl-${id}`,
      kind: o.kind ?? 'cottage',
      cell: { x: cx + S.fw / 2, y: cy + S.fd / 2 },
      size: { w: 0.1, d: 0.1 },
      radial: true, // 깊이정렬 = 앞 꼭짓점 (x+y)
      label: o.label,
      sprite: S.s,
      px: { w: S.w, h: S.h },
    })
    if (solid) B.push(baseBox(cx + (o.dx ?? 0), cy + (o.dy ?? 0), o.bw ?? S.fw, o.bd ?? S.fd, o.k ?? 0.9))
    return true
  }

  // ── 열 배치 헬퍼(도로 기준) ──
  /** +x 방향으로 건물을 이어 붙임. fy = 앞 y(바닥의 +y 끝). x0 = 첫 건물 바닥 왼쪽 끝 */
  function rowX(pre: string, list: SprKey[], x0: number, fy: number, gap = 0.2, xMax = 99) {
    let cur = x0
    list.forEach((k, i) => {
      const S = SPR[k]
      const fx = cur + S.fw
      if (fx > xMax) return
      put(`${pre}${i}`, k, fx - S.fw / 2, fy - S.fd / 2, { kind: 'shop' })
      cur = fx + gap
    })
  }
  /** +y 방향으로 건물을 이어 붙임. fx = 앞 x(바닥의 +x 끝). y0 = 첫 건물 바닥 위쪽 끝 */
  function colY(pre: string, list: SprKey[], fx: number, y0: number, gap = 0.2, yMax = 99) {
    let cur = y0
    list.forEach((k, i) => {
      const S = SPR[k]
      const fy = cur + S.fd
      if (fy > yMax) return
      put(`${pre}${i}`, k, fx - S.fw / 2, fy - S.fd / 2, { kind: 'shop' })
      cur = fy + gap
    })
  }
  const deco = (id: string, key: SprKey, x: number, y: number, o: PutOpt = {}) =>
    put(id, key, x, y, { decor: true, solid: false, kind: 'bush', ...o })
  const hard = (id: string, key: SprKey, x: number, y: number, o: PutOpt = {}) =>
    put(id, key, x, y, { decor: true, solid: true, ...o })

  /** 중앙 구조물을 사방(서·동·북·남)에서 마주 보는 벤치 4개 — 각 벤치는 중앙 쪽을 바라본다 */
  const benchRing = (pre: string, cx: number, cy: number, r: number) => {
    hard(`${pre}w`, 'benchSE', cx - r, cy, { kind: 'bench', k: 0.9 }) // 서쪽 벤치 → 동(+x)을 봄
    hard(`${pre}e`, 'benchNW', cx + r, cy, { kind: 'bench', k: 0.9 }) // 동쪽 벤치 → 서(-x)를 봄
    hard(`${pre}n`, 'benchSW', cx, cy - r, { kind: 'bench', k: 0.9 }) // 북쪽 벤치 → 남(+y)을 봄
    hard(`${pre}s`, 'benchNE', cx, cy + r, { kind: 'bench', k: 0.9 }) // 남쪽 벤치 → 북(-y)을 봄
  }

  // ═══════════════ AREA 01 · 랜드마크(대성당) ═══════════════
  // 대성당 — 스프라이트 바닥(물 포함)은 x≈24.6~29.3 / y≈2.3~7.0. 계단은 남서(+y)면 x≈25~27.
  P.push({
    id: 'atl-palace', kind: 'dome', cell: { x: 29.3, y: 7 }, size: { w: 0.1, d: 0.1 }, radial: true,
    label: '아틀란티스 대성당', sprite: SPR.palace.s, px: { w: SPR.palace.w, h: SPR.palace.h },
  })
  B.push({ x0: 24.7, y0: 2.4, x1: 29.2, y1: 6.2 })
  // 앞마당을 감싸는 성벽: 서/동 측벽(수로 안쪽) + 전면 좌우 + 모서리 망루
  // 정문 망루(원형 대형) — 앞마당 진입구 좌우
  ;[[29.6, 14.4], [33.4, 14.4]].forEach(([x, y], i) =>
    put(`ctower${i}`, 'towerG', x, y, { decor: true, solid: true, kind: 'tower', k: 0.8 }),
  )
  // 대형 성벽: 한 조각 = [망루·성벽·망루·성벽 끝] 길이 WPER(≈4.1칸). 실측 앵커: 근접 망루 중심 = 앵커+(-1.35,+0.67)
  const WPER = 4.1
  // y방향 벽(화면 왼쪽아래→오른쪽위): 근접 망루 중심 (X, yb) → cell=(X+1.35, yb-0.67)
  const wallY = (pre: string, X: number, yTop: number, yBottom: number) => {
    const n = Math.ceil((yBottom - yTop) / WPER)
    for (let k = 0; k < n; k++) {
      const yb = yBottom - k * WPER
      if (!decorFree(X, yb - WPER / 2, 0.3)) continue
      P.push({
        id: `atl-${pre}${k}`, kind: 'cloister', cell: { x: X + 1.35, y: yb - 0.67 }, size: { w: 0.1, d: 0.1 }, radial: true,
        sprite: SPR.wallG.s, px: { w: SPR.wallG.w, h: SPR.wallG.h },
      })
      B.push({ x0: X - 0.32, y0: yb - WPER - 0.1, x1: X + 0.32, y1: yb + 0.35 })
    }
  }
  // x방향 벽 = 반전 스프라이트 → 근접 망루 중심 (xb, Y) → cell=(xb-0.67, Y+1.35), 벽은 -x 쪽으로 뻗음
  const wallX = (pre: string, Y: number, xLeft: number, xRight: number) => {
    const n = Math.ceil((xRight - xLeft) / WPER)
    for (let k = 0; k < n; k++) {
      const xb = xRight - k * WPER
      if (!decorFree(xb - WPER / 2, Y, 0.3)) continue
      P.push({
        id: `atl-${pre}${k}`, kind: 'cloister', cell: { x: xb - 0.67, y: Y + 1.35 }, size: { w: 0.1, d: 0.1 }, radial: true,
        sprite: SPR.wallGf.s, px: { w: SPR.wallGf.w, h: SPR.wallGf.h },
      })
      B.push({ x0: xb - WPER - 0.1, y0: Y - 0.32, x1: xb + 0.35, y1: Y + 0.32 })
    }
  }
  wallY('cwW', 21.9, 6.2, 14.4)
  wallY('cwE', 37.1, 6.2, 14.4)
  wallX('cwFW', 14.4, 21.9, 29.6)
  wallX('cwFE', 14.4, 33.4, 37.1)
  // 정원 화단 (성당 앞 정형 정원)
  ;[[24.6, 11.6], [27.0, 12.6], [24.6, 13.6], [36.0, 10.4], [36.0, 12.6]].forEach(([x, y], i) =>
    hard(`cgarden${i}`, 'gardenbed', x, y, { kind: 'bush', k: 0.7 }),
  )
  // 성벽 안쪽 회양목 열 + 산책로 배너
  for (let y = 8.8; y < 14; y += 1.5) deco(`ctopi-w${y}`, 'topiary', 22.8, y)
  ;[[29.9, 8.4], [34.1, 8.4]].forEach(([x, y], i) => deco(`cbanner${i}`, 'banner', x, y, { kind: 'banner' }))
  ;[[26.0, 9.6], [28.0, 9.6]].forEach(([x, y], i) => deco(`cflower${i}`, 'flowerbed', x, y))
  ;[[30.2, 10.4], [33.8, 10.4], [30.2, 13.2], [33.8, 13.2]].forEach(([x, y], i) =>
    deco(`cplanter${i}`, 'planter', x, y),
  )
  ;[[23.0, 9.5], [36.0, 9.0], [23.2, 12.6], [36.2, 13.6]].forEach(([x, y], i) =>
    deco(`ckelp${i}`, 'kelp', x, y, { kind: 'tree' }),
  )
  ;[[26.0, 7.9], [28.0, 7.9]].forEach(([x, y], i) => deco(`cguard${i}`, 'guard', x, y, { kind: 'statue' }))
  ;[[24.2, 9.6], [33.6, 14.0]].forEach(([x, y], i) => deco(`clamp${i}`, 'lamp', x, y, { kind: 'lamp' }))
  ;[[28.4, 5.0], [31.0, 4.6], [34.0, 5.0], [36.4, 5.8]].forEach(([x, y], i) => deco(`cback${i}`, 'topiary', x, y))
  // 성당 뒤뜰 산호
  deco('creef0', 'reef', 33.0, 3.9)
  deco('creef1', 'reef', 36.0, 4.6)

  // ═══════════════ AREA 04 · 광장 (중앙 광장 + 남측 해양광장) ═══════════════
  // 중앙 광장 — 황금 분수 + 화단·벤치·노점으로 채운 "기능 있는 광장"
  hard('cfountain', 'fountain', ACX, CROSS_Y, { kind: 'fountain', label: '중앙 분수', k: 0.95 })
  ;[[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(([dx, dy], i) =>
    hard(`pplanter${i}`, 'planter', ACX + dx, CROSS_Y + dy, { kind: 'bush' }),
  )
  ;[[-3.4, -3.4], [3.4, 3.4]].forEach(([dx, dy], i) =>
    deco(`plamp${i}`, 'lamp', ACX + dx, CROSS_Y + dy, { kind: 'lamp' }),
  )
  benchRing('pbench', ACX, CROSS_Y, 2.9)
  hard('pstall0', 'stallTeal', ACX - 5.3, CROSS_Y - 2.6, { kind: 'stall' })
  hard('pstall1', 'stall', ACX + 5.3, CROSS_Y - 2.6, { kind: 'stall' })
  hard('pstall2', 'stallB', ACX - 5.3, CROSS_Y + 2.6, { kind: 'stall' })
  hard('pstall3', 'stallC', ACX + 5.3, CROSS_Y + 2.6, { kind: 'stall' })
  ;[[-3.6, -5.6], [3.6, -5.6], [-3.6, 5.6], [3.6, 5.6]].forEach(([dx, dy], i) =>
    deco(`pflower${i}`, 'flowerbed', ACX + dx, CROSS_Y + dy),
  )
  deco('pbanner0', 'banner', ACX - 2.2, CROSS_Y - 5.6, { kind: 'banner' })
  deco('pbanner1', 'banner', ACX + 2.2, CROSS_Y - 5.6, { kind: 'banner' })

  // 남측 해양광장 — 대형 문어 분수(참조 이미지 4)
  hard('parkfountain', 'octo', ACX, PARK_CY, { kind: 'fountain', label: '해양 분수', k: 0.85 })
  ;[[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]].forEach(([dx, dy], i) =>
    hard(`kplanter${i}`, 'planter', ACX + dx, PARK_CY + dy, { kind: 'bush' }),
  )
  benchRing('kbench', ACX, PARK_CY, 3.4)
  ;[[-4.6, -2.0], [4.6, 2.0], [-2.0, 4.6]].forEach(([dx, dy], i) =>
    deco(`klamp${i}`, 'lamp', ACX + dx, PARK_CY + dy, { kind: 'lamp' }),
  )
  hard('kgazebo', 'gazebo', ACX + 4.6, PARK_CY + 3.6, { kind: 'gazebo' })
  deco('kcitizen0', 'citizen', ACX - 2.2, PARK_CY + 2.2, { kind: 'statue' })
  deco('kcitizen1', 'citizen', ACX + 2.0, PARK_CY - 2.0, { kind: 'statue' })
  ;[[-2.6, -5.0], [2.6, -5.0], [-2.6, 5.0], [2.6, 5.0]].forEach(([dx, dy], i) =>
    deco(`kflower${i}`, 'flowerbed', ACX + dx, PARK_CY + dy),
  )

  // 마을 입구 — 선착장 + 낚시터 (정원문·성벽 제거). 환영길 좌우에 항구 수로(CANALS) 2개를 파고
  // 부두·낚시 부두·어선·오두막·건조대·짐더미로 꾸민다. 출구 포탈(ACX, ENTRANCE_CY+0.5)은 그대로.
  ;[-1, 1].forEach((sx) => {
    const X = (d: number) => ACX + sx * d
    const tag = sx < 0 ? 'w' : 'e'
    // 부두(+x 방향 갑판) — 환영길 쪽 기슭에서 수로 안으로 뻗음. 서쪽은 갑판 중심 x=28.1, 동쪽은 35.9
    put(`pier${tag}`, 'pier', X(3.9), 53.2, { water: true, kind: 'wall', bw: 2.4, bd: 0.9, k: 0.95 })
    // 부두 끝 낚시 플랫폼
    put(`fpier${tag}`, 'fishpier', X(6.6), 53.2, { water: true, kind: 'wall', k: 0.9 })
    // 정박한 어선
    put(`fboat${tag}`, 'fboat', X(6.0), 55.0, { water: true, solid: false, kind: 'wall' })
    // 어부 오두막 + 건조대 + 짐더미
    put(`hut${tag}`, 'hut', X(7.4), 49.2, { decor: true, kind: 'shop' })
    put(`rack${tag}`, 'rack', X(3.8), 49.0, { decor: true, kind: 'shop' })
    put(`crates${tag}0`, 'crates', X(9.6), 50.6, { decor: true, kind: 'trashbin' })
    put(`crates${tag}1`, 'crates', X(2.7), 50.7, { decor: true, kind: 'trashbin' })
    deco(`ebarrel${tag}`, 'barrel', X(2.7), 48.0, { kind: 'trashbin' })
    deco(`elamp${tag}`, 'lamp', X(2.3), 51.4, { kind: 'lamp' })
    deco(`eflower${tag}`, 'flowerbed', X(5.4), 47.8)
  })

  // ═══════════════ AREA 02 · 왼쪽(서쪽) 부지 — 상가 + 주거 + 항구 ═══════════════
  // W1: 동서 대로 북측 상가열
  rowX('w1-', ['townA', 'shopA', 'townB', 'shopB', 'house', 'shopC', 'townC', 'shopD'], 11.2, 21.2, 0.15, 25.2)
  // W0: 그 뒤 2열(주거)
  rowX('w0-', ['houseC', 'townB', 'townA', 'cafe', 'townC'], 15.2, 18.4, 0.2, 24.5)
  // W2: 대로 남측 (서쪽 골목 양옆으로 분할)
  rowX('w2a-', ['townC', 'townA', 'shopA'], 10.6, 27.2, 0.15, 15.6)
  rowX('w2b-', ['shopA', 'shopC', 'townB'], 18.7, 27.2, 0.15, 25.2)
  // W3: 주거 골목 북측 주택
  rowX('w3a-', ['house', 'houseC', 'townA'], 10.6, 30.55, 0.2, 15.6)
  rowX('w3b-', ['houseD', 'houseC', 'house'], 18.7, 30.55, 0.2, 29.4)
  // W4: 주거 골목 남측 ~ 수로 북안
  rowX('w4a-', ['townB', 'townA', 'townC'], 10.6, 35.1, 0.15, 15.6)
  rowX('w4b-', ['shopA', 'houseC', 'shopB', 'townB'], 18.7, 35.1, 0.15, 29.4)
  // 서쪽 골목 양옆 (수로 남안 = 항구)
  colY('wl-e', ['townA', 'townB'], 20.0, 25.2, 0.2, 31)
  // 항구(SW): 수로 남안 창고·상가 + 해안길 하단 주택
  rowX('wh1a-', ['warehouse', 'townA', 'townC'], 10.6, 39.6, 0.15, 15.6)
  rowX('wh1b-', ['shopB', 'warehouse', 'townB'], 18.7, 39.6, 0.15, 26.2)
  rowX('wh2a-', ['townB', 'cafe', 'townA'], 10.6, 44.0, 0.15, 15.6)
  rowX('wh2b-', ['shopD', 'townC', 'shopA'], 18.7, 44.0, 0.15, 26.2)

  // ═══════════════ AREA 03 · 오른쪽(동쪽) 부지 — 회관 + 상가 + 주거 + 항구 ═══════════════
  put('hall', 'hall', 46.0, 20.1, { kind: 'shop', label: '마을 회관', k: 0.85 })
  rowX('e1a-', ['shopA', 'townA', 'townB'], 39.6, 21.2, 0.15, 44.4)
  rowX('e1b-', ['shopD', 'townC', 'townA', 'townB'], 48.5, 21.2, 0.15, 53.5)
  rowX('e0-', ['townC', 'houseC', 'townA', 'shopB'], 39.0, 18.2, 0.2, 44.4)
  rowX('e0b-', ['townB', 'houseD', 'townA'], 48.6, 18.2, 0.2, 54)
  rowX('e2a-', ['shopA', 'shopB', 'townB'], 39.0, 27.2, 0.15, 45.6)
  rowX('e2b-', ['townA', 'townC', 'shopA'], 48.4, 27.2, 0.15, 54)
  rowX('e3a-', ['house', 'houseD', 'houseC'], 39.0, 30.55, 0.2, 45.6)
  rowX('e3b-', ['houseC', 'house'], 48.4, 30.55, 0.2, 54)
  rowX('e4a-', ['shopC', 'townA', 'townB'], 39.0, 35.1, 0.15, 45.6)
  rowX('e4b-', ['townC', 'townA', 'shopD'], 48.4, 35.1, 0.15, 54)
  rowX('eh1a-', ['houseC', 'warehouse', 'townB'], 37.8, 39.6, 0.15, 45.6)
  rowX('eh1b-', ['warehouse', 'townA', 'townC'], 48.4, 39.6, 0.15, 54)
  rowX('eh2a-', ['shopA', 'cafe', 'townA'], 37.8, 44.0, 0.15, 45.6)
  rowX('eh2b-', ['townC', 'shopB'], 48.4, 44.0, 0.15, 52)

  // 랜드마크 해자 바깥(북동/북서) 주거 블록
  rowX('ne1-', ['townC', 'houseC', 'townB', 'shopB', 'townA'], 40.6, 12.2, 0.2, 51)
  rowX('ne2-', ['houseD', 'townA', 'townC', 'houseC'], 40.6, 16.4, 0.2, 52)
  rowX('nw1-', ['townA', 'townB', 'shopA'], 13.8, 14.4, 0.2, 19.2)
  rowX('nw2-', ['townC', 'houseC'], 14.6, 18.2, 0.2, 19.2)

  // ═══════════════ 다리·보트·해안 ═══════════════
  ;[[11.5, 36.4], [24.0, 36.4], [40.5, 36.4], [53.0, 36.4]].forEach(([x, y], i) =>
    P.push({
      id: `atl-boat${i}`, kind: 'wall', cell: { x: x + 0.45, y: y + 0.45 }, size: { w: 0.1, d: 0.1 }, radial: true,
      sprite: SPR.boat.s, px: { w: SPR.boat.w, h: SPR.boat.h }, elev: -WATER_DROP,
    }),
  )

  // 해안 바깥 바다 바위 — 섬 둘레(정규화 거리 1.04~1.3)에 드문드문, 입구 뱃길은 비운다
  {
    const rand = mulberry32(20261004)
    const kinds: SprKey[] = ['rock1', 'rock2', 'stack1', 'rock1', 'stack2']
    let n = 0
    for (let tries = 0; tries < 900 && n < 22; tries++) {
      const x = 1 + rand() * (AW - 2)
      const y = 1 + rand() * (AH - 2)
      const norm = atlantisIslandNorm(x, y)
      if (norm < 1.06 || norm > 1.32) continue
      if (Math.abs(x - ACX) < 9 && y > 44) continue
      const k = kinds[n % kinds.length]
      P.push({ id: `searock${n}`, kind: 'bush', cell: { x, y }, radial: true, sprite: SPR[k].s, px: { w: SPR[k].w, h: SPR[k].h }, elev: -WATER_DROP + 4 })
      n++
    }
  }

  // ═══════════════ 도로변 가로등·산호·화단 (충돌체 회피 자동) ═══════════════
  // 가로등은 교차로·광장 입구에만 드문드문 (동서 대로 5개 + 환영길 교차점 2개)
  ;[14, 22, 42, 50, 54].forEach((x) => deco(`lampx${x}`, 'lamp', x, 24.9, { kind: 'lamp' }))
  deco('lampa', 'lamp', 30.1, 34.0, { kind: 'lamp' })
  deco('lampb', 'lamp', 33.9, 34.0, { kind: 'lamp' })
  ;[[11.5, 28.2], [14.0, 28.2], [19.0, 28.2], [21.6, 28.2], [24.0, 28.2], [40.0, 28.2], [43.0, 28.2], [49.5, 28.2], [52.0, 28.2]].forEach(([x, y], i) =>
    deco(`gflower${i}`, 'flowerbed', x, y),
  )
  ;[[12.6, 28.4], [22.6, 28.4], [41.6, 28.4], [50.8, 28.4]].forEach(([x, y], i) => deco(`gkelp${i}`, 'kelp', x, y, { kind: 'tree' }))
  ;[
    [9.6, 22.6], [54.6, 22.2], [16.0, 17.4], [48.6, 15.6], [10.5, 33.6], [53.6, 33.6], [10.6, 47.0], [46.8, 49.2], [22.0, 50.4], [42.0, 50.0],
  ].forEach(([x, y], i) => deco(`reef${i}`, 'reef', x, y))
  ;[[10.4, 24.8], [26.2, 24.8], [38.6, 24.8], [55.0, 24.8], [10.4, 30.8], [54.6, 30.8]].forEach(([x, y], i) =>
    deco(`rkelp${i}`, 'kelp', x, y, { kind: 'tree' }),
  )
  ;[[15.2, 25.2], [18.8, 25.2], [45.2, 25.2], [48.8, 25.2]].forEach(([x, y], i) => deco(`lcrate${i}`, 'barrel', x, y, { kind: 'trashbin' }))

  // ═══════════════ 조경 패스 — 남은 빈 지면을 결정론적으로 채운다(건물·길·물은 피함) ═══════════════
  {
    const rand = mulberry32(20260919)
    const pickBlock: [SprKey, PropKind, number][] = [
      ['flowerbed', 'bush', 0.34], ['topiary', 'bush', 0.16], ['kelp', 'tree', 0.14], ['planter', 'bush', 0.12], ['barrel', 'trashbin', 0.08], ['reef', 'bush', 0.06]
    ]
    const pickGarden: [SprKey, PropKind, number][] = [
      ['flowerbed', 'bush', 0.4], ['topiary', 'bush', 0.25], ['kelp', 'tree', 0.2], ['reef', 'bush', 0.15],
    ]
    const choose = (tbl: [SprKey, PropKind, number][]) => {
      let r = rand()
      for (const [k, kind, w] of tbl) {
        if ((r -= w) <= 0) return { k, kind }
      }
      return { k: tbl[0][0], kind: tbl[0][1] }
    }
    let n = 0
    for (let y = 6; y < 54; y += 1.7) {
      for (let x = 8; x < 56; x += 1.7) {
        const jx = x + (rand() - 0.5) * 0.9
        const jy = y + (rand() - 0.5) * 0.9
        const z = zoneAt(jx, jy)
        if (z !== 'block' && z !== 'garden') continue
        const p = z === 'garden' ? 0.5 : 0.2
        if (rand() > p) continue
        const { k, kind } = choose(z === 'garden' ? pickGarden : pickBlock)
        const solid = k === 'planter' || k === 'kelp'
        if (put(`fill${n}`, k, jx, jy, { decor: true, solid, kind })) n++
      }
    }
  }

  return { P, B }
}

const built = build()
for (const p of built.P) if (p.id.startsWith('fboat')) p.elev = -WATER_DROP
export const ATLANTIS_PROPS: PropDef[] = built.P

/** 다리 난간 — 다리 양옆(수로 위 구간)에 낮은 사암 난간. 서쪽은 플레이어 뒤, 동쪽은 앞에 그려지도록 sortY 지정 */
const RAIL_TEX = { src: '/images/map/water/wall-canal.png', w: 256, h: 32, scale: 1 }
export const ATLANTIS_STRUCTURES: IsoStructGroup[] = BRIDGES.flatMap((b, i) => {
  const y0 = Math.floor(b.y0)
  const y1 = Math.floor(b.y1 - 0.5) + 1
  const rail = (x0: number, x1: number) => isoBox(x0, y0 - 0.05, x1, y1 + 0.05, 0, 9, { side: RAIL_TEX, topFill: '#f3e3bd', shadeX: 0.25, shadeY: 0.08 })
  return [
    { id: `bridge-rail-w${i}`, parts: rail(b.x0, b.x0 + 0.14), sortY: b.x0 + y0 },
    { id: `bridge-rail-e${i}`, parts: rail(b.x1 - 0.14, b.x1), sortY: b.x1 + y1 },
  ]
})

/** 수로(다리 구간 제외) 충돌 + 프롭 충돌 */
function canalBlockers(): Blocker[] {
  const out: Blocker[] = []
  for (const c of CANALS) {
    const bridges = BRIDGES.filter((b) => overlapsY(b, c)).sort((a, b) => a.x0 - b.x0)
    let cur = c.x0
    for (const b of bridges) {
      if (b.x0 > cur) out.push({ x0: cur, y0: c.y0, x1: b.x0, y1: c.y1 })
      cur = b.x1
    }
    if (cur < c.x1) out.push({ x0: cur, y0: c.y0, x1: c.x1, y1: c.y1 })
  }
  return out
}
const overlapsY = (b: Blocker, c: Blocker) => b.y0 < c.y1 && b.y1 > c.y0 && b.x0 >= c.x0 && b.x1 <= c.x1
export const ATLANTIS_BLOCKERS: Blocker[] = [...built.B, ...canalBlockers()]
