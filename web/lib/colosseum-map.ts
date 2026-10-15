// ============================================================================
// 천공 콜로세움(스톰헤이븐 천공 신전의 비밀 투기장) — 멀티플레이 광장 맵 (48×46)
//  · 구름바다 위 섬 한가운데 대리석 투기장: 북·서쪽은 계단식 관중석(높은 벽, 뒤는 막힘), 남·동쪽은 낮은 벽 + 정문
//  · 투기장 안 = 모래 바닥 + 금빛 마법진, 북쪽 제단 앞에 투기장장 그로먼
//  · 동쪽 휴게 광장 = 다른 플레이어들이 모여 있는 곳(components/game/iso-world 의 라이벌 표시)
//  · 그림은 천공 신전(lib/skytown-map)·랜드마크 실내(lib/landmark-interiors)와 같은 에셋을 쓴다
// ============================================================================
import type { IsoStructGroup, IsoTex, PropDef, PropKind, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'

type Blocker = { x0: number; y0: number; x1: number; y1: number }

export const COL_W = 48
export const COL_H = 46
export const COL_CX = 24
const ISLAND_CY = 24
/** 투기장 사각형(안쪽 바닥) */
const A = { x0: 17, y0: 13, x1: 31, y1: 27 }
export const ARENA_CENTER = { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 }
/** 관중석 깊이(북·서) */
const STAND = 1.8
/** 정문 — 남쪽(가로)·동쪽(세로) 틈 */
const GATE_S = { x0: 22.5, x1: 25.5 }
const GATE_E = { y0: 18.5, y1: 21.5 }
/** 동쪽 휴게 광장 */
const LOUNGE = { x: 38.5, y: 33.5 }
export const COL_ENTRANCE = { x: COL_CX, y: 42.2 }

function islandNorm(x: number, y: number): number {
  const dx = x - COL_CX
  const dy = y - ISLAND_CY
  const ang = Math.atan2(dy, dx)
  const wob = Math.sin(ang * 3 + 0.6) * 1.1 + Math.sin(ang * 7 + 1.9) * 0.6
  const rx = 21.5 + wob
  const ry = 20.5 + wob * 0.8
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
}

const inR = (x: number, y: number, r: Blocker) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1
const ARENA_FLOOR: Blocker = { x0: A.x0, y0: A.y0, x1: A.x1, y1: A.y1 }
/** 관중석 뒤(북·서) — 깊이정렬이 어긋나지 않게 걸어 들어갈 수 없는 곳 */
const BEHIND: Blocker[] = [
  { x0: 0, y0: 0, x1: A.x1 + 0.4, y1: A.y0 - STAND },
  { x0: 0, y0: 0, x1: A.x0 - STAND, y1: A.y1 + 1.5 },
]

type Zone = 'sky' | 'arena' | 'road' | 'plaza' | 'garden' | 'back'
function zoneAt(x: number, y: number): Zone {
  const norm = islandNorm(x, y)
  if (norm > 1) return 'sky'
  if (BEHIND.some((b) => inR(x, y, b))) return 'back'
  if (inR(x, y, ARENA_FLOOR)) return 'arena'
  if (Math.abs(x - COL_CX) < 1.5 && y >= A.y1 && y < 45) return 'road'
  if (Math.abs(y - (GATE_E.y0 + GATE_E.y1) / 2) < 1.5 && x >= A.x1 && x < 45) return 'road'
  if (norm > 0.84) return 'garden'
  return 'plaza'
}

export function colosseumTileAt(x: number, y: number): TileKind {
  const z = zoneAt(x, y)
  if (z === 'sky') return 'sky-cloud'
  if (z === 'arena') return 'sand'
  if (z === 'road') return 'sky-road'
  if (z === 'garden' || z === 'back') return 'grass'
  return 'sky-marble'
}

// ── 스프라이트 ──
const S_ = '/images/map/props/skytemple/'
const AT_ = '/images/map/props/atlantis/'
const L_ = '/images/map/landmark/'
interface Spr { s: string; w: number; h: number; fw: number; fd: number }
const sp = (dir: string, f: string, w: number, h: number, fw: number, fd = fw): Spr => ({ s: dir + f, w, h, fw, fd })
const SPR = {
  gtower: sp(S_, 'sk2_gtower.png', 88, 165, 1.3),
  arch: sp(S_, 'sky_arch.png', 85, 98, 1.4, 0.6),
  angel: sp(L_, 'iso_angel.png', 54, 110, 0.7),
  brazier: sp(L_, 'iso_cloud_brazier.png', 48, 92, 0.6),
  altar: sp(L_, 'iso_sun_altar.png', 76, 109, 1.1),
  harp: sp(L_, 'iso_harp.png', 56, 89, 0.7),
  fountain: sp(S_, 'sky_fountain_new.png', 102, 154, 1.5),
  stallBlue: sp(S_, 'sk2_stallBlue.png', 87, 72, 1.2),
  stallRed: sp(S_, 'sk2_stallRed.png', 90, 72, 1.2),
  lamp: sp(S_, 'sky_lamp.png', 14, 62, 0.2),
  crystals: sp(S_, 'sk2_crystals.png', 46, 66, 0.6),
  tree: sp(S_, 'sky_tree.png', 49, 66, 0.6),
  spire: sp(S_, 'sk2_spire.png', 45, 168, 0.5),
  islandA: sp(S_, 'sk2_islandA.png', 71, 105, 1.2),
  islandB: sp(S_, 'sk2_islandB.png', 76, 99, 1.2),
  islandC: sp(S_, 'sk2_islandC.png', 98, 105, 1.4),
  islandD: sp(S_, 'sk2_islandD.png', 64, 93, 1.0),
  cloudBig: sp(S_, 'sk2_cloudBig.png', 116, 57, 1.4),
  cloudSm: sp(S_, 'sk2_cloudSm.png', 50, 33, 0.8),
  airship: sp(S_, 'sk2_airship.png', 79, 118, 1.4),
  benchSE: sp(AT_, 'atl3_benchSE.png', 53, 57, 0.55, 1.25),
  benchNW: sp(AT_, 'atl3_benchNW.png', 55, 50, 0.55, 1.25),
  benchSW: sp(AT_, 'atl3_benchSW.png', 53, 57, 1.25, 0.55),
  benchNE: sp(AT_, 'atl3_benchNE.png', 55, 50, 1.25, 0.55),
  flowerbed: sp(AT_, 'atl_flowerbed.png', 46, 27, 0.6),
  planter: sp(AT_, 'atl2_planter.png', 45, 64, 0.8),
  banner: sp(AT_, 'atl_banner.png', 21, 47, 0.2),
} satisfies Record<string, Spr>
type SprKey = keyof typeof SPR

const WALL: IsoTex = { src: L_ + 'wall_sky.png', w: 64, h: 64, scale: 1.5 }
const TRIM = '#e9d9a0'
const SEAT = '#d8d0bc'
const WALL_Z = 34
const TIER_Z = 14
const FRONT_Z = 14

function build() {
  const P: PropDef[] = []
  const B: Blocker[] = []
  const box = (cx: number, cy: number, fw: number, fd: number, k = 0.9): Blocker => ({ x0: cx - (fw * k) / 2, y0: cy - (fd * k) / 2, x1: cx + (fw * k) / 2, y1: cy + (fd * k) / 2 })
  const overlaps = (a: Blocker, b: Blocker) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

  function put(id: string, key: SprKey, cx: number, cy: number, o: { kind?: PropKind; solid?: boolean; label?: string; k?: number; elev?: number; glow?: PropDef['glow']; check?: boolean } = {}): boolean {
    const S = SPR[key]
    if (o.check) {
      const z = zoneAt(cx, cy)
      if (z === 'sky' || z === 'road' || z === 'arena' || z === 'back') return false
      if (B.some((b) => overlaps(box(cx, cy, Math.max(S.fw, 0.6), Math.max(S.fd, 0.6), 1.3), b))) return false
    }
    P.push({
      id: `col-${id}`,
      kind: o.kind ?? 'bush',
      cell: { x: cx + S.fw / 2, y: cy + S.fd / 2 },
      size: { w: 0.1, d: 0.1 },
      radial: true,
      label: o.label,
      sprite: S.s,
      px: { w: S.w, h: S.h },
      ...(o.elev ? { elev: o.elev } : {}),
      ...(o.glow ? { glow: o.glow } : {}),
    })
    if (o.solid ?? true) B.push(box(cx, cy, S.fw, S.fd, o.k ?? 0.9))
    return true
  }

  // ═══ 투기장 ═══
  // 네 모서리 탑
  ;[[A.x0 - 0.9, A.y0 - 0.9], [A.x1 + 0.9, A.y0 - 0.9], [A.x0 - 0.9, A.y1 + 0.9], [A.x1 + 0.9, A.y1 + 0.9]].forEach(([x, y], i) =>
    put(`tower${i}`, 'gtower', x, y, { kind: 'tower', k: 0.85 }),
  )
  put('gate', 'arch', COL_CX, A.y1 + 0.35, { kind: 'gate', solid: false, label: '천공 콜로세움' })
  ;[GATE_E.y0 - 0.7, GATE_E.y1 + 0.7].forEach((y, i) => put(`angelE${i}`, 'angel', A.x1 + 1.0, y, { kind: 'statue' }))
  ;[GATE_S.x0 - 0.9, GATE_S.x1 + 0.9].forEach((x, i) => put(`angelS${i}`, 'angel', x, A.y1 + 1.2, { kind: 'statue' }))
  // 안쪽 네 귀퉁이 화로 + 북쪽 제단(그로먼 뒤)
  ;[[A.x0 + 1.1, A.y0 + 1.1], [A.x1 - 1.1, A.y0 + 1.1], [A.x0 + 1.1, A.y1 - 1.1], [A.x1 - 1.1, A.y1 - 1.1]].forEach(([x, y], i) =>
    put(`brazier${i}`, 'brazier', x, y, { kind: 'lamp', glow: { color: '#ffe7a8', y: 70, r: 70 } }),
  )
  put('altar', 'altar', COL_CX, A.y0 + 0.9, { kind: 'statue', label: '맹약의 제단' })
  ;[COL_CX - 2.4, COL_CX + 2.4].forEach((x, i) => put(`harp${i}`, 'harp', x, A.y0 + 0.8, { kind: 'statue' }))
  // 관중석 위 깃발
  ;[19, 21.5, 26.5, 29].forEach((x, i) => put(`bannerN${i}`, 'banner', x, A.y0 - 0.15, { solid: false, elev: WALL_Z + TIER_Z * 2 }))
  ;[15.5, 18, 22, 24.5].forEach((y, i) => put(`bannerW${i}`, 'banner', A.x0 - 0.15, y, { solid: false, elev: WALL_Z + TIER_Z * 2 }))

  // ═══ 남쪽 진입로 · 동쪽 휴게 광장 ═══
  ;[30.5, 34, 37.5, 41].forEach((y, i) => {
    put(`lampW${i}`, 'lamp', COL_CX - 2.0, y, { kind: 'lamp', solid: false })
    put(`lampE${i}`, 'lamp', COL_CX + 2.0, y, { kind: 'lamp', solid: false })
  })
  ;[34.5, 38.5, 42.5].forEach((x, i) => {
    put(`lampEN${i}`, 'lamp', x, GATE_E.y0 - 0.9, { kind: 'lamp', solid: false })
    put(`lampES${i}`, 'lamp', x, GATE_E.y1 + 0.9, { kind: 'lamp', solid: false })
  })
  put('fountain', 'fountain', LOUNGE.x, LOUNGE.y, { kind: 'fountain', label: '교류 광장', k: 0.85 })
  put('benchW', 'benchSE', LOUNGE.x - 3.2, LOUNGE.y, { kind: 'bench' })
  put('benchE', 'benchNW', LOUNGE.x + 3.2, LOUNGE.y, { kind: 'bench' })
  put('benchN', 'benchSW', LOUNGE.x, LOUNGE.y - 3.2, { kind: 'bench' })
  put('benchS', 'benchNE', LOUNGE.x, LOUNGE.y + 3.2, { kind: 'bench' })
  put('stall0', 'stallBlue', LOUNGE.x - 4.6, LOUNGE.y - 4.4, { kind: 'stall' })
  put('stall1', 'stallRed', LOUNGE.x + 4.4, LOUNGE.y - 4.4, { kind: 'stall' })
  ;[[-2.6, -2.6], [2.6, 2.6], [-2.6, 2.6], [2.6, -2.6]].forEach(([dx, dy], i) => put(`lplanter${i}`, 'planter', LOUNGE.x + dx, LOUNGE.y + dy, { kind: 'bush' }))
  ;[[COL_CX - 4.5, 31], [COL_CX + 4.5, 31], [COL_CX - 4.5, 36], [COL_CX + 4.5, 36]].forEach(([x, y], i) => put(`splanter${i}`, 'planter', x, y, { kind: 'bush' }))
  ;[[A.x1 + 2.2, A.y1 + 2.4], [COL_CX - 3.4, 40.5], [COL_CX + 3.4, 40.5]].forEach(([x, y], i) => put(`crystal${i}`, 'crystals', x, y, { solid: false }))

  // ═══ 조경 — 남은 빈 땅을 결정론적으로 ═══
  {
    const rand = mulberry32(20261015)
    let n = 0
    for (let y = 4; y < 45; y += 1.5) {
      for (let x = 4; x < 46; x += 1.5) {
        const jx = x + (rand() - 0.5) * 0.8
        const jy = y + (rand() - 0.5) * 0.8
        // 관중석 뒤('back') — 관중석은 항상 뒤 레이어라 가까이 세운 소품은 관중석 위에 그려진다. 5칸 넘게 떨어진 곳만 드문드문
        if (zoneAt(jx, jy) === 'back') {
          const far = jy < A.y0 - STAND - 5 || jx < A.x0 - STAND - 5
          if (far && islandNorm(jx, jy) < 0.93 && rand() < 0.3 && put(`back${n}`, rand() < 0.7 ? 'tree' : 'crystals', jx, jy, { kind: 'tree', solid: false })) n++
          continue
        }
        if (zoneAt(jx, jy) !== 'garden' || rand() > 0.5) continue
        const r = rand()
        const key: SprKey = r < 0.4 ? 'tree' : r < 0.75 ? 'flowerbed' : 'crystals'
        if (put(`fill${n}`, key, jx, jy, { kind: key === 'tree' ? 'tree' : 'bush', solid: key === 'tree', check: true })) n++
      }
    }
  }

  // ═══ 섬 바깥(구름바다) ═══
  {
    const rand = mulberry32(4401)
    let n = 0
    for (let y = 0.5; y < COL_H; y += 2) {
      for (let x = 0.5; x < COL_W; x += 2) {
        const jx = x + (rand() - 0.5) * 1.2
        const jy = y + (rand() - 0.5) * 1.2
        const d = islandNorm(jx, jy) - 1
        if (d < 0.02 || d > 0.3 || rand() > 0.6) continue
        put(`cloud${n++}`, rand() < 0.55 ? 'cloudSm' : 'cloudBig', jx, jy, { solid: false })
      }
    }
  }
  ;[
    ['islandA', 3, 8], ['islandC', 45, 6], ['islandB', 45.5, 30], ['islandD', 2.5, 34], ['islandC', 8, 44.5], ['islandA', 40, 45], ['islandD', 24, 1.5],
  ].forEach(([k, x, y], i) => put(`float${i}`, k as SprKey, x as number, y as number, { solid: false }))
  put('ship0', 'airship', COL_CX - 6, 45.2, { solid: false })
  put('ship1', 'airship', 46, 18, { solid: false })
  ;[[2, 20], [46, 40], [12, 2.5], [36, 2.2]].forEach(([x, y], i) => put(`spire${i}`, 'spire', x, y, { solid: false, kind: 'tree' }))

  return { P, B }
}

const built = build()
export const COLOSSEUM_PROPS: PropDef[] = built.P

/** 투기장 벽 — 북·서 = 계단식 관중석(항상 뒤 레이어), 남·동 = 낮은 벽을 한 칸씩(앞뒤 정렬이 맞게), 정문 자리는 비운다 */
function arenaStructures(): { structures: IsoStructGroup[]; blockers: Blocker[] } {
  const structures: IsoStructGroup[] = []
  const blockers: Blocker[] = []
  let back = 0
  // 북쪽 관중석: 안쪽 벽 → 뒤로 갈수록 높은 단
  for (let t = 2; t >= 0; t--) {
    const y1 = A.y0 - t * (STAND / 3)
    const y0 = y1 - STAND / 3
    const z = WALL_Z + TIER_Z * t
    structures.push({ id: `col-standN${t}`, back: back++, parts: isoBox(A.x0 - STAND, y0, A.x1 + 0.4, y1, 0, z, { side: WALL, topFill: t === 0 ? TRIM : SEAT, shadeX: 0.3, shadeY: 0.1 }) })
  }
  for (let t = 2; t >= 0; t--) {
    const x1 = A.x0 - t * (STAND / 3)
    const x0 = x1 - STAND / 3
    const z = WALL_Z + TIER_Z * t
    structures.push({ id: `col-standW${t}`, back: back++, parts: isoBox(x0, A.y0, x1, A.y1 + 0.4, 0, z, { side: WALL, topFill: t === 0 ? TRIM : SEAT, shadeX: 0.3, shadeY: 0.1 }) })
  }
  blockers.push({ x0: A.x0 - STAND, y0: A.y0 - STAND, x1: A.x1 + 0.4, y1: A.y0 })
  blockers.push({ x0: A.x0 - STAND, y0: A.y0, x1: A.x0, y1: A.y1 + 0.4 })
  // 남쪽 낮은 벽(정문 틈 제외)
  for (let x = A.x0; x < A.x1 + 0.4; x += 1) {
    const x1 = Math.min(x + 1, A.x1 + 0.4)
    if (x1 > GATE_S.x0 && x < GATE_S.x1) continue
    structures.push({ id: `col-wallS${x}`, sortY: x1 + A.y1 + 0.4, parts: isoBox(x, A.y1, x1, A.y1 + 0.4, 0, FRONT_Z, { side: WALL, topFill: TRIM }) })
    blockers.push({ x0: x, y0: A.y1, x1, y1: A.y1 + 0.4 })
  }
  // 동쪽 낮은 벽(정문 틈 제외)
  for (let y = A.y0; y < A.y1; y += 1) {
    const y1 = Math.min(y + 1, A.y1)
    if (y1 > GATE_E.y0 && y < GATE_E.y1) continue
    structures.push({ id: `col-wallE${y}`, sortY: A.x1 + 0.4 + y1, parts: isoBox(A.x1, y, A.x1 + 0.4, y1, 0, FRONT_Z, { side: WALL, topFill: TRIM }) })
    blockers.push({ x0: A.x1, y0: y, x1: A.x1 + 0.4, y1 })
  }
  return { structures, blockers }
}
const walls = arenaStructures()
export const COLOSSEUM_STRUCTURES: IsoStructGroup[] = walls.structures

/** 걸을 수 없는 곳 — 구름바다·관중석 뒤(칸 단위 가로 런) + 벽 + 소품 */
function outsideBlockers(): Blocker[] {
  const out: Blocker[] = []
  for (let j = 0; j < COL_H; j++) {
    let i0 = -1
    for (let i = 0; i <= COL_W; i++) {
      const z = i < COL_W ? zoneAt(i + 0.5, j + 0.5) : 'plaza'
      const blocked = z === 'sky' || z === 'back'
      if (blocked && i0 < 0) i0 = i
      if (!blocked && i0 >= 0) {
        out.push({ x0: i0, y0: j, x1: i, y1: j + 1 })
        i0 = -1
      }
    }
  }
  return out
}
export const COLOSSEUM_BLOCKERS: Blocker[] = [...built.B, ...walls.blockers, ...outsideBlockers()]

/** 다른 플레이어가 서 있을 자리 — 휴게 광장 둘레와 남쪽 진입로 양옆(콜로세움 밖) */
export const COLOSSEUM_LOBBY_SPOTS: { x: number; y: number }[] = [
  { x: LOUNGE.x - 2.0, y: LOUNGE.y + 1.4 },
  { x: LOUNGE.x + 1.6, y: LOUNGE.y - 1.9 },
  { x: LOUNGE.x + 2.1, y: LOUNGE.y + 1.7 },
  { x: LOUNGE.x - 1.7, y: LOUNGE.y - 1.8 },
  { x: LOUNGE.x - 5.6, y: LOUNGE.y + 0.8 },
  { x: LOUNGE.x + 5.4, y: LOUNGE.y + 0.4 },
  { x: COL_CX - 6.4, y: 33.4 },
  { x: COL_CX + 6.6, y: 32.6 },
  { x: COL_CX - 6.6, y: 38.2 },
  { x: COL_CX + 6.2, y: 38.8 },
  { x: LOUNGE.x - 1.2, y: LOUNGE.y + 5.4 },
  { x: LOUNGE.x + 0.8, y: LOUNGE.y - 5.6 },
  { x: A.x1 + 4.6, y: GATE_E.y0 - 2.6 },
  { x: A.x1 + 6.8, y: GATE_E.y1 + 2.4 },
  { x: COL_CX - 2.8, y: 43 },
  { x: COL_CX + 9.6, y: 41.2 },
]
