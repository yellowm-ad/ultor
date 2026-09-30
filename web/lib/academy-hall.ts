// ════════ 마법학교 중앙 홀(1층) + 2층 회랑 ════════
// 참고: 루트 `마법학교 실내.png`, `마법학교 중앙홀 참고 이미지 1~5` (국회도서관 로비의 원형 모자이크·중앙 대계단·2층 회랑,
// 원통 책장 기둥·전시 테이블·붉은 소파).
// 사용자 규칙(feedback-wall-furniture-iso-rules): 벽은 맵 끝선(x=0, y=0)에 전체 길이로 높게 / 모든 가구·구조물은 쿼터뷰 축 정합.
//   → 벽·회랑 바닥판·난간·기둥·계단은 iso-structures 가 투영면으로 정확히 그리고, 가구는 PixelLab isometric 스프라이트만 쓴다.
//
// 좌표: 셀(x 오른쪽 아래, y 왼쪽 아래), 높이 z(px, 위로). 1층 바닥 z=0, 2층 회랑 바닥 z=FLOOR2.
import type { GameMap } from '@/lib/types'
import type { IsoPart, IsoStructGroup, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
type Spr = { s: string; w: number; h: number }

const A = '/images/map/academy/'
const P = '/images/map/props/academy/' // 이전 패스 에셋(문 정면도 등 — 벽면에 평면으로 붙이는 용도라 규칙 위배 아님)
const tex = (f: string, w: number, h: number, scale = 1.5): IsoTex => ({ src: A + f, w, h, scale })
const T = {
  wall: tex('tex_wall.png', 64, 64, 1.5),
  rail: tex('tex_rail.png', 64, 40, 1.0),
  cornice: tex('tex_cornice.png', 64, 32, 0.9),
  pillar: tex('tex_pillar.png', 32, 96, 0.8),
  riser: tex('tex_riser.png', 32, 16, 1.25),
  marble: { ...tex('tex_marble.png', 32, 32), cells: 2 },
  carpet: { ...tex('tex_carpet.png', 16, 16), cells: 0.5 },
}
const spr = (f: string, w: number, h: number, dir = A): Spr => ({ s: dir + f, w, h })
export const HALL_SPR = {
  bench: spr('iso_bench.png', 93, 72),
  booktower: spr('iso_booktower.png', 87, 171),
  display: spr('iso_display.png', 108, 85),
  sofa: spr('iso_sofa.png', 90, 70),
  cafe: spr('iso_cafe.png', 71, 55),
  plant: spr('iso_plant.png', 74, 99),
  lamp: spr('iso_lamp.png', 37, 152),
  counter: spr('iso_counter.png', 118, 89),
  desk: spr('iso_desk.png', 110, 85),
  orb: spr('iso_orb.png', 74, 119),
  shelf: spr('iso_shelf.png', 78, 116),
  fountain: spr('ac_fountain.png', 300, 300, P),
  window: spr('win_lancet.png', 48, 158),
  banner: spr('banner_flat.png', 46, 115),
  doorFire: spr('door_fire.png', 88, 147, P),
  doorIce: spr('door_ice.png', 92, 154, P),
  doorEarth: spr('door_earth.png', 85, 144, P),
  doorHall: spr('door_hall.png', 124, 185, P),
  doorOffice: spr('door_office.png', 66, 142, P),
  doorLibrary: spr('door_library.png', 95, 146, P),
}

// ── 치수 ──
export const HALL_W = 40
export const HALL_H = 36
export const FLOOR2 = 340 // 2층 회랑 바닥 높이(px)
const SLAB = 28 // 회랑 바닥판 두께
const WALL_Z = FLOOR2 + 380 // 벽 전체 높이(화면 위까지 치솟게)
export const GAL = 4 // 회랑 깊이(셀) — 이보다 깊으면 바닥판이 1층 문 윗부분을 가린다(투영상 z = FLOOR2 - 32·GAL)
const RAIL_H = 40
// 대계단: x 21~27, 회랑 앞선(y=GAL) → 1층 y=STAIR_Y1
export const STAIR = { x0: 21, x1: 27, yTop: GAL, yBottom: GAL + 8.5, zTop: FLOOR2 }
const STEPS = 17
export const HALL_CX = (STAIR.x0 + STAIR.x1) / 2 // 24
export const MOSAIC = { cx: HALL_CX, cy: 23.5, r: 11 }

// 1층 문(회랑 아래) — 북벽 x / 서벽 y
export const HALL_DOORS = {
  library: { side: 'N' as const, at: 10, door: HALL_SPR.doorLibrary },
  office: { side: 'N' as const, at: 35, door: HALL_SPR.doorOffice },
  fire: { side: 'W' as const, at: 11, door: HALL_SPR.doorFire },
  ice: { side: 'W' as const, at: 19.5, door: HALL_SPR.doorIce },
  earth: { side: 'W' as const, at: 27, door: HALL_SPR.doorEarth },
}
export type HallDoorKey = keyof typeof HALL_DOORS
/** 문 앞 셀 — d=1.4 포탈, d=3.2 되돌아올 때 도착 */
export const hallDoorFront = (k: HallDoorKey, d: number) => {
  const o = HALL_DOORS[k]
  return o.side === 'N' ? { x: o.at, y: d } : { x: d, y: o.at }
}

// ── 공용 파츠 ──
/** 벽면에 평면 이미지(문·창·배너) — 원본 비율 유지, 폭 중심 at, 바닥 z0, 화면 높이 hPx */
function wallDecal(plane: 'x' | 'y', at: number, hPx: number, z0: number, sp: Spr): IsoPart {
  const wCells = (hPx * (sp.w / sp.h)) / 32
  // plane 'y'(북벽): from/to 는 x. plane 'x'(서벽): from/to 는 y
  return { kind: 'face', plane, at: 0, from: at - wCells / 2, to: at + wCells / 2, z0, z1: z0 + hPx, img: sp.s }
}

/** 뒤쪽 두 벽(맵 끝선) + 1층 회랑 아래 그늘 + 문/창/배너 */
function backWalls(zBase: number, doors: WallDoor[], zFrom = zBase): IsoStructGroup[] {
  // zFrom: 벽을 그리기 시작할 높이(2층 맵은 회랑 바닥 z=0 부터 — 그 아래는 회랑 바닥에 가려짐)
  const parts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: HALL_W, z0: zFrom, z1: WALL_Z + zBase, tex: T.wall },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: HALL_H, z0: zFrom, z1: WALL_Z + zBase, tex: T.wall, shade: 0.14 },
    // 벽 밑단 몰딩(처마 텍스처를 거꾸로 재활용하지 않고 짙은 띠)
    { kind: 'face', plane: 'y', at: 0, from: 0, to: HALL_W, z0: zFrom, z1: zFrom + 14, fill: '#7d6a4c' },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: HALL_H, z0: zFrom, z1: zFrom + 14, fill: '#6c5b40' },
  ]
  const decals: IsoPart[] = []
  // 2층 벽 — 높은 스테인드글라스 창과 배너를 번갈아(양 벽 전체 길이)
  for (let x = 4; x < HALL_W - 1; x += 5) {
    if (Math.abs(x + 1 - HALL_CX) < 4) continue // 대강당 문 자리 비움
    decals.push(wallDecal('y', x, 240, zBase + FLOOR2 + 60, HALL_SPR.window))
    decals.push(wallDecal('y', x + 2.5, 150, zBase + FLOOR2 + 150, HALL_SPR.banner))
  }
  for (let y = 5; y < HALL_H - 1; y += 5) {
    decals.push(wallDecal('x', y, 240, zBase + FLOOR2 + 60, HALL_SPR.window))
    decals.push(wallDecal('x', y + 2.5, 150, zBase + FLOOR2 + 150, HALL_SPR.banner))
  }
  // 1층 문 + 문 위 배너(회랑 바닥판에 가리지 않을 높이까지)
  for (const d of doors) decals.push(wallDecal(d.plane, d.at, d.h, zBase + (d.z0 ?? 0), d.sp))
  // wallDecal 의 at:0 은 벽면(x=0 / y=0) — plane 그대로
  return [{ id: `walls${zBase}`, back: 0, parts: [...parts, ...decals] }]
}

/** 2층 회랑 바닥판(ㄱ자) + 앞선 처마 + 난간. z 는 zBase 기준(1층 맵 0, 2층 맵 -FLOOR2) */
function gallerySlab(zBase: number): IsoStructGroup[] {
  const z = zBase + FLOOR2
  const top: IsoPart[] = [
    { kind: 'top', x0: 0, y0: 0, x1: HALL_W, y1: GAL, z, tex: T.marble },
    { kind: 'top', x0: 0, y0: GAL, x1: GAL, y1: HALL_H, z, tex: T.marble },
  ]
  const edge: IsoPart[] = [
    { kind: 'face', plane: 'y', at: GAL, from: GAL, to: HALL_W, z0: z - SLAB, z1: z, tex: T.cornice },
    { kind: 'face', plane: 'x', at: HALL_W, from: 0, to: GAL, z0: z - SLAB, z1: z, tex: T.cornice, shade: 0.25 },
    { kind: 'face', plane: 'x', at: GAL, from: GAL, to: HALL_H, z0: z - SLAB, z1: z, tex: T.cornice, shade: 0.25 },
    { kind: 'face', plane: 'y', at: HALL_H, from: 0, to: GAL, z0: z - SLAB, z1: z, tex: T.cornice },
  ]
  return [
    { id: `gal-top${zBase}`, back: 100, parts: top },
    { id: `gal-edge${zBase}`, back: 110, parts: edge },
  ]
}
function galleryRails(zBase: number): IsoStructGroup {
  const z = zBase + FLOOR2
  return {
    id: `gal-rail${zBase}`,
    back: 400,
    parts: [
      { kind: 'face', plane: 'y', at: GAL, from: GAL, to: STAIR.x0, z0: z, z1: z + RAIL_H, tex: T.rail },
      { kind: 'face', plane: 'y', at: GAL, from: STAIR.x1, to: HALL_W, z0: z, z1: z + RAIL_H, tex: T.rail },
      { kind: 'face', plane: 'x', at: GAL, from: GAL, to: HALL_H, z0: z, z1: z + RAIL_H, tex: T.rail },
    ],
  }
}

/** 회랑을 받치는 기둥(1층 바닥 → 바닥판 밑) */
function pillars(zBase: number): IsoStructGroup[] {
  const out: IsoStructGroup[] = []
  const pz = zBase + FLOOR2 - SLAB
  const k = 0.35
  const mk = (id: string, cx: number, cy: number) =>
    out.push({ id, sortY: cx + cy, parts: isoBox(cx - k, cy - k, cx + k, cy + k, zBase, pz, { side: T.pillar, topFill: '#e8dcc0' }) })
  for (const x of [GAL, 9, 14, 19.4, 28.6, 33, 38]) mk(`pil-n${x}${zBase}`, x - k, GAL - k)
  for (const y of [9, 14, 19, 24, 29, 34]) mk(`pil-w${y}${zBase}`, GAL - k, y - k)
  return out
}

/** 중앙 대계단 — 17단, 가운데 붉은 카펫, 양옆 계단식 난간 */
function grandStair(zBase: number): IsoStructGroup[] {
  const out: IsoStructGroup[] = []
  const depth = (STAIR.yBottom - STAIR.yTop) / STEPS
  const rise = STAIR.zTop / STEPS
  for (let i = 0; i < STEPS; i++) {
    const y1 = STAIR.yBottom - depth * i
    const y0 = y1 - depth
    const z1 = zBase + rise * (i + 1)
    const parts: IsoPart[] = [
      { kind: 'face', plane: 'y', at: y1, from: STAIR.x0, to: STAIR.x1, z0: zBase, z1, tex: T.riser },
      { kind: 'face', plane: 'x', at: STAIR.x1, from: y0, to: y1, z0: zBase, z1, tex: T.wall, shade: 0.32 },
      { kind: 'top', x0: STAIR.x0, y0, x1: STAIR.x1, y1, z: z1, tex: T.marble },
      { kind: 'top', x0: STAIR.x0 + 1.4, y0, x1: STAIR.x1 - 1.4, y1, z: z1, tex: T.carpet },
      { kind: 'face', plane: 'x', at: STAIR.x0, from: y0, to: y1, z0: z1, z1: z1 + RAIL_H, tex: T.rail },
      { kind: 'face', plane: 'x', at: STAIR.x1, from: y0, to: y1, z0: z1, z1: z1 + RAIL_H, tex: T.rail },
    ]
    out.push({ id: `stair${i}${zBase}`, sortY: STAIR.x0 + y0, parts })
  }
  return out
}

/** 1층 원형 모자이크(참고 4·5) */
function mosaic(zBase: number): IsoStructGroup {
  const { cx, cy, r } = MOSAIC
  return { id: `mosaic${zBase}`, back: -50, parts: [{ kind: 'top', x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, z: zBase, img: A + 'mosaic.png' }] }
}

// ── 가구 ──
/** 아이소 스프라이트 소품 — 발밑 footprint 반경 r(셀)만큼 앵커를 끌어올림. flip = 좌우반전(축 방향 전환) */
export function isoProp(id: string, sp: Spr, x: number, y: number, r: number, o: { flip?: boolean; scale?: number; elev?: number; solid?: boolean; back?: number } = {}): PropDef {
  const k = o.scale ?? 1
  const w = sp.w * k
  const h = sp.h * k
  return {
    id, kind: 'statue', cell: { x, y }, sprite: sp.s, px: { w, h },
    anchor: { x: w / 2, y: h - 16 * r * k }, radial: true,
    size: { w: r * 2, d: r * 2 }, collide: { w: r * 1.6, d: r * 1.6 },
    solid: o.solid ?? true, facing: o.flip ? 'left' : undefined,
    elev: o.elev, backdrop: o.back != null ? true : undefined, backOrder: o.back,
  }
}

function hallFurniture(): PropDef[] {
  const S = HALL_SPR
  const out: PropDef[] = []
  const { cx, cy } = MOSAIC
  out.push({ ...isoProp('hall-fountain', S.fountain, cx, cy, 2.9, { scale: 0.9 }), anchor: { x: 135, y: 193 }, label: '천사의 분수' })
  // 분수 둘레 벤치 4 — 축 방향 두 가지(원본/반전)
  out.push(isoProp('hall-bench-n', S.bench, cx, cy - 4.3, 0.7))
  out.push(isoProp('hall-bench-s', S.bench, cx, cy + 4.3, 0.7))
  out.push(isoProp('hall-bench-w', S.bench, cx - 4.3, cy, 0.7, { flip: true }))
  out.push(isoProp('hall-bench-e', S.bench, cx + 4.3, cy, 0.7, { flip: true }))
  // 원통 책장 기둥 4 (참고 1·2)
  ;[[cx - 8.5, cy - 7], [cx + 8.5, cy - 7], [cx - 8.5, cy + 7], [cx + 8.5, cy + 7]].forEach(([x, y], i) => out.push(isoProp(`hall-tower${i}`, S.booktower, x, y, 0.9, { scale: 1.1 })))
  // 전시 테이블(모자이크 위, 참고 4)
  ;[[cx - 6, cy + 1], [cx + 6, cy - 1], [cx - 1, cy + 8], [cx + 6.5, cy - 7.5]].forEach(([x, y], i) => out.push(isoProp(`hall-display${i}`, S.display, x, y, 0.8, { flip: i < 2 })))
  // 동쪽 라운지 — 붉은 소파·카페 테이블
  ;[[37.2, 18], [37.2, 24], [37.2, 30]].forEach(([x, y], i) => out.push(isoProp(`hall-sofa${i}`, S.sofa, x, y, 0.8, { flip: true })))
  ;[[34.5, 21], [34.5, 27], [31, 33.5], [36.5, 34]].forEach(([x, y], i) => out.push(isoProp(`hall-cafe${i}`, S.cafe, x, y, 0.6)))
  // 서쪽 열람 구역 — 독서 책상
  ;[[9, 17], [9, 23], [9, 29]].forEach(([x, y], i) => out.push(isoProp(`hall-desk${i}`, S.desk, x, y, 1.0)))
  // 안내 데스크(입구 옆)
  out.push({ ...isoProp('hall-counter', S.counter, 15, 33, 1.1), label: '안내 데스크' })
  // 계단 입구 가로등 + 마법구
  out.push(isoProp('hall-lamp-sw', S.lamp, STAIR.x0 - 0.6, STAIR.yBottom + 0.4, 0.3))
  out.push(isoProp('hall-lamp-se', S.lamp, STAIR.x1 + 0.6, STAIR.yBottom + 0.4, 0.3))
  out.push(isoProp('hall-orb-w', S.orb, STAIR.x0 - 2.2, STAIR.yBottom - 1.5, 0.5))
  out.push(isoProp('hall-orb-e', S.orb, STAIR.x1 + 2.2, STAIR.yBottom - 1.5, 0.5))
  // 화분 — 기둥 사이·구석
  ;[[GAL + 1.2, 6], [GAL + 1.2, 33.5], [38.5, GAL + 1.4], [16.5, GAL + 1.4], [31.5, GAL + 1.4]].forEach(([x, y], i) => out.push(isoProp(`hall-plant${i}`, S.plant, x, y, 0.5)))
  return out
}

/** 2층 회랑 위 소품 — 1층 맵에선 elev 로 띄우고 backdrop, 2층 맵에선 바닥에 그대로 */
function galleryFurniture(onFloor2: boolean): PropDef[] {
  const S = HALL_SPR
  const e = onFloor2 ? undefined : FLOOR2
  const b = (n: number) => (onFloor2 ? undefined : 200 + n)
  const out: PropDef[] = []
  // 북쪽 회랑 — 벽에 붙은 책장(책 면이 +y), 대강당 문 양옆 비움
  for (const x of [3, 6, 9, 12, 15, 32, 35, 38]) out.push(isoProp(`g-shelf-n${x}`, S.shelf, x, 1.0, 0.6, { elev: e, back: b(x), flip: true }))
  // 서쪽 회랑 — 벽에 붙은 책장(책 면이 +x)
  for (const y of [8, 11, 14, 22, 25, 28, 31]) out.push(isoProp(`g-shelf-w${y}`, S.shelf, 1.0, y, 0.6, { elev: e, back: b(y + 50) }))
  // 회랑 벤치·화분
  ;[18, 30].forEach((x, i) => out.push(isoProp(`g-plant-n${i}`, S.plant, x, 2.6, 0.5, { elev: e, back: b(x + 100) })))
  ;[17.5].forEach((y, i) => out.push(isoProp(`g-bench-w${i}`, S.bench, 2.4, y, 0.7, { elev: e, back: b(y + 150), flip: true })))
  return out
}

// ── 1층 맵 ──
export const hallTileAt = (): TileKind => 'academy-marble'
type WallDoor = { plane: 'x' | 'y'; at: number; sp: Spr; h: number; z0?: number }
function floor1Doors(): WallDoor[] {
  return (Object.values(HALL_DOORS) as { side: 'N' | 'W'; at: number; door: Spr }[]).map((d) => ({
    plane: d.side === 'N' ? 'y' : 'x',
    at: d.at,
    sp: d.door,
    h: 184,
  }))
}
/** 회랑 아래 그늘(바닥·벽 1층부) — 위층이 덮은 공간의 깊이감 */
function galleryShade(zb: number): IsoStructGroup {
  const parts: IsoPart[] = [
    { kind: 'top', x0: 0, y0: 0, x1: HALL_W, y1: GAL, z: zb, fill: '#000', opacity: 0.22 },
    { kind: 'top', x0: 0, y0: GAL, x1: GAL, y1: HALL_H, z: zb, fill: '#000', opacity: 0.22 },
    { kind: 'face', plane: 'y', at: 0, from: 0, to: HALL_W, z0: zb, z1: zb + FLOOR2, fill: '#000', opacity: 0.22 },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: HALL_H, z0: zb, z1: zb + FLOOR2, fill: '#000', opacity: 0.22 },
  ]
  return { id: `gal-shade${zb}`, back: 1, parts }
}

export function buildHallFloor1(): { props: PropDef[]; structures: IsoStructGroup[]; blockers: Blocker[] } {
  const doors: WallDoor[] = floor1Doors()
  // 2층 벽 정면(계단 위) 대강당 대문 — 1층 맵에선 장식(입장은 2층에서)
  doors.push({ plane: 'y', at: HALL_CX, sp: HALL_SPR.doorHall, h: 240, z0: FLOOR2 })
  const structures = [...backWalls(0, doors), galleryShade(0), mosaic(0), ...gallerySlab(0), galleryRails(0), ...pillars(0), ...grandStair(0)]
  const props = [...hallFurniture(), ...galleryFurniture(false)]
  const t = 0.5
  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: HALL_W, y1: t }, // 북벽
    { x0: 0, y0: 0, x1: t, y1: HALL_H }, // 서벽
    { x0: HALL_W - 0.3, y0: 0, x1: HALL_W, y1: HALL_H },
    { x0: 0, y0: HALL_H - 0.3, x1: HALL_CX - 1.8, y1: HALL_H },
    { x0: HALL_CX + 1.8, y0: HALL_H - 0.3, x1: HALL_W, y1: HALL_H },
    // 계단 옆면·뒷면 — 정면(아래)에서만 오를 수 있게
    { x0: STAIR.x0 - 0.25, y0: STAIR.yTop - 0.4, x1: STAIR.x0 + 0.05, y1: STAIR.yBottom },
    { x0: STAIR.x1 - 0.05, y0: STAIR.yTop - 0.4, x1: STAIR.x1 + 0.25, y1: STAIR.yBottom },
    { x0: STAIR.x0, y0: STAIR.yTop - 0.6, x1: STAIR.x1, y1: STAIR.yTop - 0.1 },
    // 기둥
    ...structures
      .filter((g) => g.id.startsWith('pil-'))
      .map((g) => {
        const top = g.parts.find((p) => p.kind === 'top') as Extract<IsoPart, { kind: 'top' }>
        return { x0: top.x0, y0: top.y0, x1: top.x1, y1: top.y1 }
      }),
  ]
  // 2층 회랑 소품은 1층에서 충돌 없음
  return { props: props.map((p) => (p.elev ? { ...p, solid: false } : p)), structures, blockers }
}

// ── 2층 맵(회랑) — 가운데는 뚫린 아트리움, 1층이 FLOOR2 아래로 내려다보인다 ──
export const hall2TileAt = (x: number, y: number): TileKind => (x < GAL || y < GAL ? 'academy-marble' : 'academy-void')
export function buildHallFloor2(): { props: PropDef[]; structures: IsoStructGroup[]; blockers: Blocker[] } {
  const zb = -FLOOR2 // 1층 기준 구조물을 FLOOR2 만큼 내려 그린다
  // 그리기 순서(backdrop): 벽(0) → 1층 모자이크(5) → 1층 기둥·계단(10+깊이) → 분수(60) → 회랑 처마(110) → 난간(400)
  const below: IsoStructGroup[] = [
    // 1층 바닥(아트리움으로 보이는 부분)
    { id: 'f1-floor', back: 2, parts: [{ kind: 'top', x0: 0, y0: 0, x1: HALL_W, y1: HALL_H, z: zb, tex: { ...tex('tex_marble.png', 32, 32), cells: 2 } }] },
    { ...galleryShade(zb), back: 3 },
    { ...mosaic(zb), back: 5 },
    ...[...pillars(zb), ...grandStair(zb)].map((g) => ({ ...g, back: 10 + (g.sortY ?? 0) / 100 })),
  ]
  // 벽은 1층 바닥부터 전부(기둥 사이로 1층 문이 보이게) — 회랑 바닥(z=0)은 아래에서 구조물로 다시 덮는다
  const walls = backWalls(zb, [...floor1Doors(), { plane: 'y', at: HALL_CX, sp: HALL_SPR.doorHall, h: 240, z0: FLOOR2 }])
  // 회랑 바닥판 윗면(z=0)까지 구조물로 — 아래층 벽 하단을 덮어 가린다
  const slab = gallerySlab(zb)
  const rails = galleryRails(zb)
  const fountain: PropDef = { ...isoProp('f2-fountain', HALL_SPR.fountain, MOSAIC.cx, MOSAIC.cy, 2.9, { scale: 0.9, elev: -FLOOR2, back: 60, solid: false }), anchor: { x: 135, y: 193 } }
  // 1층 가구도 아트리움 아래로 내려다보이게(충돌 없음, backdrop 깊이순)
  const f1 = hallFurniture()
    .filter((p) => p.id !== 'hall-fountain')
    .map((p) => ({ ...p, id: `f1-${p.id}`, elev: -FLOOR2, solid: false, backdrop: true, backOrder: 60 + (p.cell.x + p.cell.y) / 100, label: undefined }))
  const props = [fountain, ...f1, ...galleryFurniture(true)]
  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: HALL_W, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: HALL_H },
    { x0: HALL_W - 0.3, y0: 0, x1: HALL_W, y1: GAL },
    { x0: 0, y0: HALL_H - 0.3, x1: GAL, y1: HALL_H },
    // 아트리움(뚫린 곳) 전체 — 1층으로는 계단 위 포탈로 내려간다
    { x0: GAL - 0.1, y0: GAL - 0.1, x1: HALL_W, y1: HALL_H },
  ]
  return { props, structures: [...walls, ...below, ...slab, rails], blockers }
}

export const HALL_PAD_TOP = WALL_Z + 60
/** 2층 맵: 아트리움 아래로 내려다보이는 1층이 잘리지 않게 */
export const HALL2_PAD_BOTTOM = FLOOR2 + 80
export const hallStairs = (): GameMap['stairs'] => [{ ...STAIR }]
