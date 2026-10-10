// ════════ 마법학교 실내 6실 — 화염·빙결·대지 수업관 / 대강당 / 학장실 / 도서관 ════════
// 사용자 규칙(feedback-wall-furniture-iso-rules):
//   · 벽 = 맵 끝선(x=0, y=0)에 전체 길이로, 높게(방 테마 벽판을 투영면 패턴으로) — 안쪽에 띄워 세우지 않는다
//   · 가구 = PixelLab isometric 스프라이트만(바닥 마름모 변과 평행). 정면을 바라보는 가구 금지
// 원형 소품(지구본·불사조 횃대·얼음 결정·생명나무 원형 화분)은 방향이 없어 규칙과 무관하게 재사용.
import type { GameMap, MapId } from '@/lib/types'
import type { IsoPart, IsoStructGroup, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { isoProp, HALL_SPR } from '@/lib/academy-hall'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
type Spr = { s: string; w: number; h: number }
const A = '/images/map/academy/'
const P = '/images/map/props/academy/'
const spr = (f: string, w: number, h: number, dir = A): Spr => ({ s: dir + f, w, h })

export const ROOM_SPR = {
  desk: spr('iso_sdesk.png', 70, 64),
  board: spr('iso_board.png', 81, 105),
  fireAltar: spr('iso_firealtar.png', 86, 119),
  iceAltar: spr('iso_icealtar.png', 82, 102),
  brazier: spr('iso_brazier.png', 46, 80),
  herbs: spr('iso_herbs.png', 108, 72),
  stage: spr('iso_stage.png', 184, 164),
  pew: spr('iso_pew.png', 77, 76),
  organ: spr('iso_organ.png', 110, 169),
  fireplace: spr('iso_fireplace.png', 109, 123),
  bigDesk: spr('iso_bigdesk.png', 112, 101),
  bookcase: spr('iso_bookcase.png', 90, 93),
  // 방향 없는 원형 소품(이전 패스 에셋)
  iceCrystal: spr('ic_crystal.png', 53, 97, P),
  earthTree: spr('ea_tree.png', 134, 169, P),
  globe: spr('of_globe.png', 54, 78, P),
  perch: spr('of_perch.png', 55, 104, P),
  // 2026-10-02 상층 교실·실습실·회의실(PixelLab pixflux isometric)
  darkAltar: spr('iso_darkaltar.png', 86, 104),
  lightAltar: spr('iso_lightaltar.png', 74, 119),
  labTable: spr('iso_labtable.png', 100, 85),
  cauldron: spr('iso_cauldron.png', 86, 90),
  confTable: spr('iso_conftable.png', 154, 114),
}

/** 방 테마 벽판(64×160 등) — 한 장 높이가 곧 벽 높이가 되도록 배율 */
const wallTex = (f: string, w: number, h: number, scale: number): IsoTex => ({ src: P + f, w, h, scale })
const ROOM_WALL_H = 360

/** 뒤쪽 두 벽 — 맵 끝선 전체 길이, 높이 ROOM_WALL_H */
function roomWalls(id: string, w: number, h: number, t: IsoTex, decals: IsoPart[] = [], height?: number): IsoStructGroup[] {
  // 높이 미지정 = 벽판 한 장 높이(창 하나가 딱 들어가게)
  const hz = height ?? t.h * (t.scale ?? 1.5)
  return [
    {
      id: `${id}-walls`,
      back: 0,
      parts: [
        { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: hz, tex: t },
        { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: hz, tex: t, shade: 0.14 },
        { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: 10, fill: '#3b2f24' },
        { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: 10, fill: '#33291f' },
        ...decals,
      ],
    },
  ]
}
/** 벽면 평면 장식(창·배너) */
function decal(plane: 'x' | 'y', at: number, hPx: number, z0: number, sp: Spr): IsoPart {
  const wc = (hPx * (sp.w / sp.h)) / 32
  return { kind: 'face', plane, at: 0, from: at - wc / 2, to: at + wc / 2, z0, z1: z0 + hPx, img: sp.s }
}

function roomBlockers(w: number, h: number, exitW = 2.4): Blocker[] {
  return [
    { x0: 0, y0: 0, x1: w, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: h },
    { x0: w - 0.3, y0: 0, x1: w, y1: h },
    { x0: 0, y0: h - 0.3, x1: w / 2 - exitW / 2, y1: h },
    { x0: w / 2 + exitW / 2, y0: h - 0.3, x1: w, y1: h },
  ]
}

type RoomDef = { props: PropDef[]; structures: IsoStructGroup[]; w: number; h: number; tileAt: (x: number, y: number) => TileKind }

// ── 수업관 3종 — 17×15, 북벽 칠판 · 중앙 제단 · 칠판을 향한 책상 8개 ──
const CW = 17
const CH = 15
function classroom(id: string, t: IsoTex, tile: TileKind, center: PropDef, decor: PropDef[], o: { decals?: IsoPart[]; height?: number } = {}): RoomDef {
  const R = ROOM_SPR
  const props: PropDef[] = [isoProp(`${id}-board`, R.board, CW / 2, 1.4, 0.8, { scale: 1.15 }), center]
  for (const [i, x] of [3.8, 6.6, 10.4, 13.2].entries()) {
    for (const [j, y] of [8.6, 11.2].entries()) props.push(isoProp(`${id}-desk${i}-${j}`, R.desk, x, y, 0.7))
  }
  return { w: CW, h: CH, tileAt: () => tile, structures: roomWalls(id, CW, CH, t, o.decals, o.height), props: [...props, ...decor] }
}
const corners = (id: string, sp: Spr, r: number) =>
  [[1.6, 1.6], [CW - 1.6, 1.6], [1.6, 7.2], [1.6, CH - 1.8], [CW - 1.4, CH - 1.8]].map(([x, y], i) => isoProp(`${id}${i}`, sp, x, y, r))

const R = ROOM_SPR
const FIRE = classroom('clfire', wallTex('wall_fire.png', 64, 160, 2.25), 'academy-fire', isoProp('clfire-altar', R.fireAltar, CW / 2, 4.8, 0.9, { scale: 1.1 }), corners('clfire-brazier', R.brazier, 0.35))
const ICE = classroom('clice', wallTex('wall_ice.png', 64, 160, 2.25), 'academy-ice', isoProp('clice-altar', R.iceAltar, CW / 2, 4.8, 0.9, { scale: 1.1 }), corners('clice-crystal', R.iceCrystal, 0.45))
const EARTH = classroom('clearth', wallTex('wall_earth.png', 64, 160, 2.25), 'academy-earth', isoProp('clearth-tree', R.earthTree, CW / 2, 4.8, 1.3), [
  isoProp('clearth-herb0', R.herbs, 1.8, 4.6, 0.8, { flip: true }),
  isoProp('clearth-herb1', R.herbs, 1.8, 9.4, 0.8, { flip: true }),
  ...[[CW - 1.6, 1.6], [1.6, CH - 1.8], [CW - 1.4, CH - 1.8]].map(([x, y], i) => isoProp(`clearth-plant${i}`, HALL_SPR.plant, x, y, 0.5)),
])

// ── 대강당 — 24×20, 북벽 무대 · 오르간 · 신도석 8 · 남색 카펫 통로 ──
const AW = 24
const AH = 20
const AUD: RoomDef = (() => {
  const props: PropDef[] = [
    { ...isoProp('aud-stage', R.stage, AW / 2, 3.4, 2.6, { scale: 1.9 }), label: '대강당 무대' },
    isoProp('aud-organ', R.organ, 2.6, 2.6, 1.0),
  ]
  for (const [j, y] of [8, 10.5, 13, 15.5].entries()) {
    for (const [i, x] of [AW / 2 - 4.8, AW / 2 + 4.8].entries()) props.push(isoProp(`aud-pew${j}-${i}`, R.pew, x, y, 0.9, { scale: 1.1 }))
  }
  ;[[1.6, 8], [1.6, 14], [AW - 1.4, 8], [AW - 1.4, 14]].forEach(([x, y], i) => props.push(isoProp(`aud-lamp${i}`, HALL_SPR.lamp, x, y, 0.3)))
  const decals: IsoPart[] = []
  for (let x = 3; x < AW - 1; x += 4.5) decals.push(decal('y', x, 220, 110, HALL_SPR.window))
  for (let y = 4; y < AH - 1; y += 4.5) decals.push(decal('x', y, 220, 110, HALL_SPR.window))
  for (let x = 5.2; x < AW - 1; x += 4.5) decals.push(decal('y', x, 140, 170, HALL_SPR.banner))
  const structures = roomWalls('aud', AW, AH, { src: A + 'tex_wall.png', w: 64, h: 64, scale: 1.5 }, decals, ROOM_WALL_H)
  return {
    w: AW,
    h: AH,
    tileAt: (x, y) => (x > AW / 2 - 1.6 && x < AW / 2 + 1.6 && y > 6 ? 'academy-carpet' : 'academy-marble'),
    structures,
    props,
  }
})()

// ── 학장실 — 15×13, 북벽 벽난로 · 책장 · 학장 책상 · 지구본 · 불사조 횃대 ──
const OW = 15
const OH = 13
const OFFICE: RoomDef = {
  w: OW,
  h: OH,
  tileAt: (x, y) => (x > 4 && x < 11 && y > 3.8 && y < 9.8 ? 'personal-rug' : 'personal-wood'),
  structures: roomWalls('off', OW, OH, wallTex('wall_office.png', 64, 160, 2.25)),
  props: [
    isoProp('off-fireplace', R.fireplace, OW / 2, 1.2, 0.9, { flip: true }),
    isoProp('off-shelf0', HALL_SPR.shelf, 3.6, 1.0, 0.6, { flip: true }),
    isoProp('off-shelf1', HALL_SPR.shelf, 11.4, 1.0, 0.6, { flip: true }),
    isoProp('off-shelf2', HALL_SPR.shelf, 1.0, 4.5, 0.6),
    { ...isoProp('off-desk', R.bigDesk, OW / 2, 6.4, 1.1), label: '학장의 책상' },
    isoProp('off-globe', R.globe, 11.8, 7.6, 0.35),
    isoProp('off-perch', R.perch, 2.4, 8.2, 0.35),
    isoProp('off-plant', HALL_SPR.plant, 12.6, 11, 0.5),
  ],
}

// ── 도서관 — 20×16, 책장 벽 · 이중 책장 열 · 열람 책상 · 지식의 구체 ──
const LW = 20
const LH = 16
const LIBRARY: RoomDef = {
  w: LW,
  h: LH,
  tileAt: (x) => (x > LW / 2 - 1.3 && x < LW / 2 + 1.3 ? 'personal-rug' : 'personal-wood'),
  structures: roomWalls('lib', LW, LH, wallTex('wall_library.png', 64, 160, 2.25)),
  props: [
    { ...isoProp('lib-orb', HALL_SPR.orb, LW / 2, 3.2, 0.6), label: '지식의 구체' },
    ...[3.6, 7.2].map((x, i) => isoProp(`lib-case-w${i}`, R.bookcase, x, 5.6, 1.0)),
    ...[12.8, 16.4].map((x, i) => isoProp(`lib-case-e${i}`, R.bookcase, x, 5.6, 1.0)),
    ...[[5, 10.6], [15, 10.6], [5, 13.4], [15, 13.4]].map(([x, y], i) => isoProp(`lib-desk${i}`, HALL_SPR.desk, x, y, 1.0)),
    ...[[1.4, 2], [LW - 1.4, 2]].map(([x, y], i) => isoProp(`lib-lamp${i}`, HALL_SPR.lamp, x, y, 0.3)),
    ...[[1.4, 9], [1.4, 12.5]].map(([x, y], i) => isoProp(`lib-shelf-w${i}`, HALL_SPR.shelf, x, y, 0.6)),
  ],
}


// ════════ 상층(2~4층) — 학년 교실 · 어둠/빛 수업관 · 실습실 · 교수 회의실 · 교수 연구실 (2026-10-02) ════════
// 벽은 본관 석벽(tex_wall) 또는 속성 벽판, 가구는 전부 isometric(기존 + PixelLab 신규 5종).
const TEXW: IsoTex = { src: A + 'tex_wall.png', w: 64, h: 64, scale: 1.5 }
/** 본관 석벽 방의 창 — 북벽/서벽 전체에 일정 간격(칠판 등 가리는 자리는 skipX) */
function stoneDecals(w: number, h: number, skipX: number[] = []): IsoPart[] {
  const out: IsoPart[] = []
  for (let x = 3; x < w - 1; x += 4.5) if (!skipX.some((sx) => Math.abs(sx - x) < 2.2)) out.push(decal('y', x, 200, 120, HALL_SPR.window))
  for (let y = 3.5; y < h - 1; y += 4.5) out.push(decal('x', y, 200, 120, HALL_SPR.window))
  return out
}

// ── 학년 교실(2·3·4학년) — 수업관과 같은 칠판·책상 배치, 바닥만 학년별로 ──
function yearClass(n: 2 | 3 | 4, tile: TileKind): RoomDef {
  const id = `cly${n}`
  return classroom(id, TEXW, tile, isoProp(`${id}-orb`, HALL_SPR.orb, CW / 2, 4.6, 0.5), [
    isoProp(`${id}-case0`, R.bookcase, 1.4, 5.2, 0.8),
    isoProp(`${id}-case1`, R.bookcase, 1.4, 9.6, 0.8),
    isoProp(`${id}-shelf`, HALL_SPR.shelf, CW - 3, 1.0, 0.6, { flip: true }),
    ...[[CW - 1.4, CH - 1.8], [1.6, CH - 1.8]].map(([x, y], i) => isoProp(`${id}-plant${i}`, HALL_SPR.plant, x, y, 0.5)),
    ...[[CW - 1.4, 5], [CW - 1.4, 10]].map(([x, y], i) => isoProp(`${id}-lamp${i}`, HALL_SPR.lamp, x, y, 0.3)),
  ], { decals: stoneDecals(CW, CH, [CW / 2]), height: ROOM_WALL_H })
}
const Y2 = yearClass(2, 'academy-marble')
const Y3 = yearClass(3, 'dorm-plank')
const Y4 = yearClass(4, 'academy-carpet')

// ── 어둠 · 빛 수업관 — 3학년부터. 속성 벽판(PixelLab Pro) + 속성 제단 ──
const DARK = classroom('cldark', wallTex('wall_dark.png', 64, 160, 2.25), 'academy-dark', isoProp('cldark-altar', R.darkAltar, CW / 2, 4.8, 0.9, { scale: 1.15 }), corners('cldark-orb', HALL_SPR.orb, 0.5))
const LIGHT = classroom('cllight', wallTex('wall_light.png', 64, 160, 2.25), 'academy-light', isoProp('cllight-altar', R.lightAltar, CW / 2, 4.8, 0.9, { scale: 1.15 }), corners('cllight-lamp', HALL_SPR.lamp, 0.3))

// ── 마법 실습실(3층) — 20×16, 실험 작업대 6 · 가마솥 2 · 약초 선반 ──
const PW = 20
const PH = 16
const PRACTICE: RoomDef = (() => {
  const props: PropDef[] = [
    isoProp('pr-board', R.board, PW / 2, 1.4, 0.8, { scale: 1.15 }),
    isoProp('pr-shelf0', HALL_SPR.shelf, 4, 1.0, 0.6, { flip: true }),
    isoProp('pr-shelf1', HALL_SPR.shelf, PW - 4, 1.0, 0.6, { flip: true }),
    isoProp('pr-herb0', R.herbs, 1.8, 5, 0.8, { flip: true }),
    isoProp('pr-herb1', R.herbs, 1.8, 10, 0.8, { flip: true }),
    isoProp('pr-cauldron0', R.cauldron, 4, PH - 2.4, 0.9),
    isoProp('pr-cauldron1', R.cauldron, PW - 3, PH - 2.4, 0.9),
  ]
  for (const [i, x] of [6, 10.5, 15].entries()) for (const [j, y] of [6, 10].entries()) props.push(isoProp(`pr-table${i}-${j}`, R.labTable, x, y, 1.0))
  return { w: PW, h: PH, tileAt: () => 'academy-marble', structures: roomWalls('pr', PW, PH, TEXW, stoneDecals(PW, PH, [PW / 2]), ROOM_WALL_H), props }
})()

// ── 고등 마법 실습실(4층) — 22×18, 가운데 5속성 제단 원형 배치 · 마력 공명구 · 가마솥 · 작업대 ──
const GW = 22
const GH = 18
const PRACTICE_ADV: RoomDef = (() => {
  const cx = GW / 2
  const cy = 8.5
  const ring: [Spr, number][] = [[R.fireAltar, 0.9], [R.iceAltar, 0.9], [R.earthTree, 1.3], [R.darkAltar, 0.9], [R.lightAltar, 0.9]]
  const props: PropDef[] = ring.map(([sp, r], i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length
    return isoProp(`pa-altar${i}`, sp, cx + Math.cos(a) * 4.6, cy + Math.sin(a) * 4.0, r, { scale: sp === R.earthTree ? 0.8 : 1 })
  })
  props.push({ ...isoProp('pa-orb', HALL_SPR.orb, cx, cy, 0.5), label: '마력 공명구' })
  ;[[2.4, 3], [GW - 2.4, 3], [2.4, GH - 2.4], [GW - 2.4, GH - 2.4]].forEach(([x, y], i) => props.push(isoProp(`pa-cauldron${i}`, R.cauldron, x, y, 0.9)))
  ;[[6.5, GH - 2.2], [GW - 6.5, GH - 2.2]].forEach(([x, y], i) => props.push(isoProp(`pa-table${i}`, R.labTable, x, y, 1.0)))
  return {
    w: GW,
    h: GH,
    tileAt: (x, y) => (Math.hypot(x - cx, (y - cy) * 1.1) < 6.2 ? 'academy-carpet' : 'academy-marble'),
    structures: roomWalls('pa', GW, GH, TEXW, stoneDecals(GW, GH), ROOM_WALL_H),
    props,
  }
})()

// ── 교수 회의실(4층) — 18×14, 긴 회의 탁자 · 벽난로 · 책장 ──
const MW = 18
const MH = 14
const COUNCIL: RoomDef = {
  w: MW,
  h: MH,
  tileAt: (x, y) => (x > 3 && x < MW - 3 && y > 3.6 && y < MH - 2.4 ? 'academy-carpet' : 'dorm-plank'),
  structures: roomWalls('mt', MW, MH, TEXW, stoneDecals(MW, MH, [MW / 2]), ROOM_WALL_H),
  props: [
    { ...isoProp('mt-table', R.confTable, MW / 2, 7.8, 2.8, { scale: 1.5 }), label: '교수 회의 탁자' },
    isoProp('mt-fireplace', R.fireplace, MW / 2, 1.2, 0.9, { flip: true }),
    isoProp('mt-case0', R.bookcase, 1.4, 4.6, 0.8),
    isoProp('mt-case1', R.bookcase, 1.4, 9.2, 0.8),
    isoProp('mt-shelf0', HALL_SPR.shelf, 4, 1.0, 0.6, { flip: true }),
    isoProp('mt-shelf1', HALL_SPR.shelf, MW - 4, 1.0, 0.6, { flip: true }),
    isoProp('mt-globe', R.globe, MW - 2, MH - 2.2, 0.35),
    isoProp('mt-plant', HALL_SPR.plant, 2, MH - 2, 0.5),
  ],
}

// ── 교수 연구실 5종(화염·빙결·대지·어둠·빛) — 14×12, 연구 책상 · 책장 · 속성 소품 ──
const LW2 = 14
const LH2 = 12
function professorLab(id: string, t: IsoTex, tile: TileKind, keyProp: PropDef): RoomDef {
  return {
    w: LW2,
    h: LH2,
    tileAt: () => tile,
    structures: roomWalls(id, LW2, LH2, t),
    props: [
      { ...isoProp(`${id}-desk`, R.bigDesk, LW2 / 2, 6, 1.1), label: '연구 책상' },
      isoProp(`${id}-case0`, R.bookcase, 3.4, 1.0, 0.8, { flip: true }),
      isoProp(`${id}-case1`, R.bookcase, LW2 - 3.4, 1.0, 0.8, { flip: true }),
      isoProp(`${id}-shelf`, HALL_SPR.shelf, 1.0, 5, 0.6),
      keyProp,
      isoProp(`${id}-globe`, R.globe, LW2 - 2, LH2 - 2.4, 0.35),
      isoProp(`${id}-plant`, HALL_SPR.plant, 1.8, LH2 - 2, 0.5),
    ],
  }
}
const LAB_FIRE = professorLab('lbfire', wallTex('wall_fire.png', 64, 160, 2.25), 'academy-fire', isoProp('lbfire-k', R.brazier, LW2 - 2, 4.5, 0.35))
const LAB_ICE = professorLab('lbice', wallTex('wall_ice.png', 64, 160, 2.25), 'academy-ice', isoProp('lbice-k', R.iceCrystal, LW2 - 2, 4.5, 0.45))
const LAB_EARTH = professorLab('lbearth', wallTex('wall_earth.png', 64, 160, 2.25), 'academy-earth', isoProp('lbearth-k', R.herbs, LW2 - 2.2, 4.5, 0.8))
const LAB_DARK = professorLab('lbdark', wallTex('wall_dark.png', 64, 160, 2.25), 'academy-dark', isoProp('lbdark-k', R.darkAltar, LW2 - 2.2, 4.5, 0.9, { scale: 0.8 }))
const LAB_LIGHT = professorLab('lblight', wallTex('wall_light.png', 64, 160, 2.25), 'academy-light', isoProp('lblight-k', R.lightAltar, LW2 - 2.2, 4.5, 0.9, { scale: 0.8 }))

export type AcademyRoomKey =
  | 'fire' | 'ice' | 'earth' | 'auditorium' | 'office' | 'library'
  | 'year2' | 'year3' | 'year4' | 'dark' | 'light' | 'practice' | 'practiceAdv' | 'council'
  | 'labFire' | 'labIce' | 'labEarth' | 'labDark' | 'labLight'
export const ACADEMY_ROOM_DEFS: Record<AcademyRoomKey, { id: MapId; name: string; def: RoomDef }> = {
  fire: { id: 'class-fire', name: '화염 수업관', def: FIRE },
  ice: { id: 'class-ice', name: '빙결 수업관', def: ICE },
  earth: { id: 'class-earth', name: '대지 수업관', def: EARTH },
  auditorium: { id: 'grand-auditorium', name: '대강당', def: AUD },
  office: { id: 'headmaster-office', name: '학장실', def: OFFICE },
  library: { id: 'academy-library', name: '도서관', def: LIBRARY },
  year2: { id: 'class-year2', name: '2학년 교실', def: Y2 },
  year3: { id: 'class-year3', name: '3학년 교실', def: Y3 },
  year4: { id: 'class-year4', name: '4학년 교실', def: Y4 },
  dark: { id: 'class-dark', name: '어둠 수업관', def: DARK },
  light: { id: 'class-light', name: '빛 수업관', def: LIGHT },
  practice: { id: 'practice-lab', name: '마법 실습실', def: PRACTICE },
  practiceAdv: { id: 'practice-lab-adv', name: '고등 마법 실습실', def: PRACTICE_ADV },
  council: { id: 'council-room', name: '교수 회의실', def: COUNCIL },
  labFire: { id: 'lab-fire', name: '화염 교수 연구실', def: LAB_FIRE },
  labIce: { id: 'lab-ice', name: '빙결 교수 연구실', def: LAB_ICE },
  labEarth: { id: 'lab-earth', name: '대지 교수 연구실', def: LAB_EARTH },
  labDark: { id: 'lab-dark', name: '어둠 교수 연구실', def: LAB_DARK },
  labLight: { id: 'lab-light', name: '빛 교수 연구실', def: LAB_LIGHT },
}
// ── 울토르 기록관(2026-10-10) — 마을 학교 북관의 '기록관' 건물 안. 14×12, 책장 벽 · 빈 책장 줄. ──
//    메인 스토리 EP26(벽화 뒤의 옛 '울토르 기록관' 문장)에서 이어지는 곳. 가구는 여기에 책장만 두고 나머지는 lib/town-decor.
const ARW = 14
const ARH = 12
export const ARCHIVE_ROOM: RoomDef = {
  w: ARW,
  h: ARH,
  tileAt: (x) => (x > ARW / 2 - 1.2 && x < ARW / 2 + 1.2 ? 'personal-rug' : 'personal-wood'),
  structures: roomWalls('arc', ARW, ARH, wallTex('wall_library.png', 64, 160, 2.25)),
  props: [
    isoProp('arc-shelf0', HALL_SPR.shelf, 2.6, 1.0, 0.6, { flip: true }),
    isoProp('arc-shelf1', HALL_SPR.shelf, 5.0, 1.0, 0.6, { flip: true }),
    isoProp('arc-shelf2', HALL_SPR.shelf, 9.0, 1.0, 0.6, { flip: true }),
    isoProp('arc-shelf3', HALL_SPR.shelf, 11.4, 1.0, 0.6, { flip: true }),
    isoProp('arc-shelf4', HALL_SPR.shelf, 1.0, 4.0, 0.6),
    isoProp('arc-shelf5', HALL_SPR.shelf, 1.0, 6.6, 0.6),
    isoProp('arc-plant', HALL_SPR.plant, 12.4, 10.2, 0.5),
  ],
}

export const ROOM_PAD_TOP = ROOM_WALL_H + 60
export { roomBlockers }
export type { RoomDef, GameMap }
