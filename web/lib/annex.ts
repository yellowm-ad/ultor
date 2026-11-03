// ============================================================================
// 학교 북관 3동 + 중앙 대도서관 내부(2026-11-02)
//
//   마을 북쪽 학교 북관의 건물 셋을 새 용도로:
//     · 소환·무속성 마법관(학교 부관) — 차가운 청회색 석재. 소환 마법과 무속성 마법을 다룬다
//     · 연금·제작관(학교 부관)       — 따뜻한 붉은 벽돌·목재. 연금·마도구·장비·마력캔디 '만드는 법'을 배우는 곳
//     · 동아리관                      — 아늑한 석재+나무 징두리. 미니게임·생활 활동 컨셉의 부실이 잔뜩
//   그리고 중앙 대도서관에 들어갈 수 있게 — 넓은 열람 홀 + 북벽 문 너머 '울토르 기록관'(기존 village-archive)
//
//   구조는 마법학교 본관 방과 같은 규칙: 벽은 맵 끝선(x=0, y=0)에 높게, 가구는 PixelLab 아이소 스프라이트,
//   문은 벽면에 붙이는 평범한 정면 그림(교실·연구실·회의실 문 재사용). 문 앞 포탈 = E 로 여는 문(maps.ts 가 자동 판정).
//   GameMap 조립(충돌 계산·구역)은 lib/maps.ts 가 한다(annexMaps) — 여기는 방 데이터만.
// ============================================================================

import type { MapId } from '@/lib/types'
import type { IsoPart, IsoStructGroup, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { HALL_SPR, isoProp } from '@/lib/academy-hall'
import { ROOM_SPR } from '@/lib/academy-rooms'

type Spr = { s: string; w: number; h: number }
type Blocker = { x0: number; y0: number; x1: number; y1: number }
const A = '/images/map/academy/'
const P = '/images/map/props/academy/'
const C = '/images/map/props/club/'
const spr = (f: string, w: number, h: number, dir = P): Spr => ({ s: dir + f, w, h })
const tex = (src: string, w: number, h: number, scale: number): IsoTex => ({ src, w, h, scale })

// ── 벽 재질(같은 본관 석벽을 색만 달리 — 차갑게/따뜻하게) ──
export const ANNEX_WALL = {
  arcane: tex(A + 'tex_wall_arcane.png', 64, 64, 1.5), // 청회색 석재
  forge: tex(A + 'tex_wall_forge.png', 64, 64, 1.5), // 붉은 벽돌
  club: tex('/images/map/dorm/wall.png', 64, 128, 2.2), // 돌 + 나무 징두리
  library: tex(P + 'wall_library.png', 64, 160, 2.25), // 책장 벽
  ice: tex(P + 'wall_ice.png', 64, 160, 2.25),
  earth: tex(P + 'wall_earth.png', 64, 160, 2.25),
  fire: tex(P + 'wall_fire.png', 64, 160, 2.25),
  dark: tex(P + 'wall_dark.png', 64, 160, 2.25),
  light: tex(P + 'wall_light.png', 64, 160, 2.25),
  office: tex(P + 'wall_office.png', 64, 160, 2.25),
}
type WallKey = keyof typeof ANNEX_WALL

// ── 꾸미기 소품(기존 wb_* + 동아리 전용 PixelLab 신규) ──
const W = {
  armchair: spr('wb_armchair.png', 49, 61),
  armor: spr('wb_armor.png', 70, 88),
  benchDouble: spr('wb_bench_double.png', 98, 100),
  bookStack: spr('wb_book_stack.png', 32, 30),
  bust: spr('wb_bust.png', 33, 88),
  candelabra: spr('wb_candelabra.png', 36, 88),
  caseCrystal: spr('wb_case_crystal.png', 68, 84),
  caseFossil: spr('wb_case_fossil.png', 65, 84),
  casePotion: spr('wb_case_potion.png', 78, 90),
  caseRelic: spr('wb_case_relic.png', 75, 89),
  caseWide: spr('wb_case_wide.png', 107, 103),
  catalog: spr('wb_catalog.png', 60, 90),
  cauldron: spr('wb_cauldron.png', 54, 50),
  clock: spr('wb_clock.png', 30, 90),
  crystalBall: spr('wb_crystal_ball.png', 32, 52),
  deskStudy: spr('wb_desk_study.png', 79, 97),
  easelSmall: spr('wb_easel.png', 24, 46),
  globe: spr('wb_globe.png', 40, 56),
  lampOrange: spr('wb_lamp_orange.png', 24, 58),
  notice: spr('wb_notice.png', 50, 78),
  owl: spr('wb_owl_statue.png', 72, 104),
  piano: spr('wb_piano.png', 88, 114),
  fern: spr('wb_potted_fern.png', 34, 50),
  palm: spr('wb_potted_palm.png', 58, 76),
  pottedTree: spr('wb_potted_tree.png', 54, 84),
  rugRed: spr('wb_rug_red.png', 95, 62),
  rugRound: spr('wb_rug_round.png', 107, 54),
  rugRunner: spr('wb_rug_runner.png', 76, 44),
  rugSquare: spr('wb_rug_square.png', 118, 70),
  shelfCrest: spr('wb_shelf_crest.png', 85, 115),
  shelfLow: spr('wb_shelf_low.png', 78, 73),
  shelfPotion: spr('wb_shelf_potion.png', 91, 106),
  sofaGrey: spr('wb_sofa_grey.png', 71, 67),
  teatable: spr('wb_teatable.png', 75, 54),
  tableReading: spr('wb_table_reading.png', 93, 92),
  tableDisplay: spr('wb_table_display.png', 116, 108),
  tableBouquet: spr('wb_table_bouquet.png', 60, 83),
  telescope: spr('wb_telescope.png', 70, 72),
  trophy: spr('wb_trophy.png', 72, 104),
  urn: spr('wb_statue_urn.png', 30, 61),
  flowerbox: spr('wb_flowerbox.png', 83, 80),
}
/** 동아리 전용(PixelLab 2026-11-02) — 크기는 잘라 낸 그림 실측 */
export const CLUB_SPR = {
  easel: spr('easel.png', 47, 63, C),
  fishing: spr('fishing.png', 61, 53, C),
  mapTable: spr('maptable.png', 62, 56, C),
  herbRack: spr('herbrack.png', 58, 63, C),
  instruments: spr('instruments.png', 50, 50, C),
}
const R = ROOM_SPR
const H = HALL_SPR

/** 바닥에 깔리는 것(러그) — 충돌 없이 사람 뒤에 */
const flat = (id: string, sp: Spr, x: number, y: number, scale = 1): PropDef => ({ ...isoProp(id, sp, x, y, 0.2, { scale, solid: false }), backdrop: true, backOrder: 0 })

// ── 벽 + 문 ──
const WALL_H = 300
export const ANNEX_PAD_TOP = WALL_H + 60
type Door = { side: 'N' | 'W'; at: number; sp: Spr }
function wallDecal(plane: 'x' | 'y', at: number, hPx: number, z0: number, sp: Spr): IsoPart {
  const wCells = (hPx * (sp.w / sp.h)) / 32
  return { kind: 'face', plane, at: 0, from: at - wCells / 2, to: at + wCells / 2, z0, z1: z0 + hPx, img: sp.s }
}
function walls(id: string, w: number, h: number, t: IsoTex, doors: Door[], windows = true): IsoStructGroup[] {
  const hz = Math.max(WALL_H, t.h * (t.scale ?? 1.5))
  const parts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: hz, tex: t },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: hz, tex: t, shade: 0.14 },
    { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: 12, fill: '#3b2f24' },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: 12, fill: '#33291f' },
  ]
  const busyN = doors.filter((d) => d.side === 'N').map((d) => d.at)
  const busyW = doors.filter((d) => d.side === 'W').map((d) => d.at)
  // 문 사이 빈 벽에 높은 창(본관과 같은 란셋 창)
  if (windows) {
    for (let x = 2.5; x < w - 1.5; x += 3.5) if (!busyN.some((a) => Math.abs(a - x) < 2.4)) parts.push(wallDecal('y', x, 170, 90, H.window))
    for (let y = 2.5; y < h - 1.5; y += 3.5) if (!busyW.some((a) => Math.abs(a - y) < 2.4)) parts.push(wallDecal('x', y, 170, 90, H.window))
  }
  for (const d of doors) parts.push(wallDecal(d.side === 'N' ? 'y' : 'x', d.at, 168, 0, d.sp))
  return [{ id: `${id}-walls`, back: 0, parts }]
}
/** 벽·남쪽 출구 둘레 충돌(출구 폭 exitW) */
function edgeBlockers(w: number, h: number, exitW = 2.6): Blocker[] {
  return [
    { x0: 0, y0: 0, x1: w, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: h },
    { x0: w - 0.3, y0: 0, x1: w, y1: h },
    { x0: 0, y0: h - 0.3, x1: w / 2 - exitW / 2, y1: h },
    { x0: w / 2 + exitW / 2, y0: h - 0.3, x1: w, y1: h },
  ]
}

// ── 데이터 형태(maps.ts 가 GameMap 으로 조립) ──
export interface AnnexPortal {
  id: string
  cell: { x: number; y: number }
  to: MapId
  toSpawn?: { x: number; y: number }
  label: string
  kind: 'portal' | 'exit'
}
export interface AnnexSpace {
  id: MapId
  name: string
  desc: string
  w: number
  h: number
  tileAt: (x: number, y: number) => TileKind
  props: PropDef[]
  structures: IsoStructGroup[]
  edge: Blocker[]
  spawn: { x: number; y: number }
  portals: AnnexPortal[]
}

interface RoomSpec {
  id: MapId
  name: string
  desc: string
  wall: WallKey
  tile: TileKind
  w?: number
  h?: number
  /** (w, h) → 가구 */
  props: (w: number, h: number) => PropDef[]
  /** 문 그림 */
  door: Spr
}
interface HubSpec {
  id: MapId
  name: string
  desc: string
  wall: WallKey
  tile: (x: number, y: number, w: number, h: number) => TileKind
  w: number
  h: number
  props: (w: number, h: number) => PropDef[]
  rooms: { side: 'N' | 'W'; at: number; room: RoomSpec }[]
  /** 밖(마을)으로 */
  out: { to: MapId; spawn: { x: number; y: number }; label: string }
}

const doorFront = (side: 'N' | 'W', at: number, d: number) => (side === 'N' ? { x: at, y: d } : { x: d, y: at })

function buildHub(spec: HubSpec): AnnexSpace[] {
  const { w, h } = spec
  const doors: Door[] = spec.rooms.map((r) => ({ side: r.side, at: r.at, sp: r.room.door }))
  const hub: AnnexSpace = {
    id: spec.id,
    name: spec.name,
    desc: spec.desc,
    w,
    h,
    tileAt: (x, y) => spec.tile(x, y, w, h),
    props: spec.props(w, h),
    structures: walls(spec.id, w, h, ANNEX_WALL[spec.wall], doors),
    edge: edgeBlockers(w, h),
    spawn: { x: w / 2, y: h - 2.2 },
    portals: [
      ...spec.rooms.map((r) => ({ id: `${spec.id}-to-${r.room.id}`, cell: doorFront(r.side, r.at, 1.4), to: r.room.id, label: r.room.name, kind: 'portal' as const })),
      { id: `${spec.id}-exit`, cell: { x: w / 2, y: h - 0.8 }, to: spec.out.to, toSpawn: spec.out.spawn, label: spec.out.label, kind: 'exit' },
    ],
  }
  const rooms: AnnexSpace[] = spec.rooms.map(({ side, at, room }) => {
    const rw = room.w ?? 14
    const rh = room.h ?? 12
    return {
      id: room.id,
      name: room.name,
      desc: room.desc,
      w: rw,
      h: rh,
      tileAt: () => room.tile,
      props: room.props(rw, rh),
      structures: walls(room.id, rw, rh, ANNEX_WALL[room.wall], [], true),
      edge: edgeBlockers(rw, rh),
      spawn: { x: rw / 2, y: rh - 2.2 },
      portals: [{ id: `${room.id}-exit`, cell: { x: rw / 2, y: rh - 0.8 }, to: spec.id, toSpawn: doorFront(side, at, 3.0), label: `${spec.name}로`, kind: 'exit' }],
    }
  })
  return [hub, ...rooms]
}

// 공용 배치 도우미
const corners4 = (id: string, sp: Spr, w: number, h: number, r = 0.4, inset = 1.3) =>
  [[inset, inset], [w - inset, inset], [inset, h - inset - 0.6], [w - inset, h - inset - 0.6]].map(([x, y], i) => isoProp(`${id}${i}`, sp, x, y, r))
const deskRows = (id: string, w: number, ys: number[]) => {
  const out: PropDef[] = []
  const xs = [w / 2 - 3.6, w / 2 - 1.2, w / 2 + 1.2, w / 2 + 3.6]
  ys.forEach((y, j) => xs.forEach((x, i) => out.push(isoProp(`${id}-desk${i}-${j}`, R.desk, x, y, 0.7))))
  return out
}

// 바닥 마스크 — 가운데 긴 카펫 길
const runner = (base: TileKind, mid: TileKind, half = 1.3) => (x: number, _y: number, w: number) => (Math.abs(x - w / 2) < half ? mid : base)

// ════════ ① 소환·무속성 마법관(학교 부관) ════════
const DOOR = { cls: H.doorClass, lab: H.doorLab, meet: H.doorMeeting, office: H.doorOffice, lib: H.doorLibrary, dark: H.doorDark, light: H.doorLight }

const ARCANE_ROOMS: RoomSpec[] = [
  {
    id: 'arcane-summon',
    name: '소환 수업관',
    desc: '소환진 위에서 계약한 존재를 불러내는 법을 배우는 강의실.',
    wall: 'arcane',
    tile: 'academy-dark',
    w: 17,
    h: 15,
    door: DOOR.cls,
    props: (w, h) => [
      isoProp('as-board', R.board, w / 2, 1.4, 0.8, { scale: 1.15 }),
      { ...isoProp('as-orb', H.orb, w / 2, 4.6, 0.6), label: '소환 매개 구체' },
      ...deskRows('as', w, [8.6, 11.2]),
      ...corners4('as-cb', W.crystalBall, w, h, 0.3),
      isoProp('as-owl', W.owl, w - 1.6, 5.4, 0.5),
    ],
  },
  {
    id: 'arcane-neutral',
    name: '무속성 수업관',
    desc: '어느 원소에도 기대지 않는 순수 마력 — 방벽·강화·해제를 다루는 강의실.',
    wall: 'light',
    tile: 'academy-light',
    w: 17,
    h: 15,
    door: DOOR.light,
    props: (w, h) => [
      isoProp('an-board', R.board, w / 2, 1.4, 0.8, { scale: 1.15 }),
      isoProp('an-altar', R.lightAltar, w / 2, 4.6, 0.8),
      ...deskRows('an', w, [8.6, 11.2]),
      ...corners4('an-lamp', H.lamp, w, h, 0.3),
    ],
  },
  {
    id: 'arcane-circle',
    name: '소환진 실습실',
    desc: '바닥 가득 그린 소환진. 계약수와 처음 마주하는 방이다.',
    wall: 'dark',
    tile: 'academy-carpet',
    w: 16,
    h: 14,
    door: DOOR.dark,
    props: (w, h) => [
      isoProp('ac-altar', R.darkAltar, w / 2, 5.6, 0.9, { scale: 1.1 }),
      ...[[w / 2 - 4, 3.6], [w / 2 + 4, 3.6], [w / 2 - 4, 8.4], [w / 2 + 4, 8.4]].map(([x, y], i) => isoProp(`ac-brz${i}`, R.brazier, x, y, 0.35)),
      isoProp('ac-case0', W.caseCrystal, 1.4, 4.0, 0.5),
      isoProp('ac-case1', W.caseRelic, 1.4, 8.0, 0.5),
      isoProp('ac-candel', W.candelabra, w - 1.4, h - 2.2, 0.3),
    ],
  },
  {
    id: 'arcane-lab',
    name: '소환·무속성 연구실',
    desc: '담당 교수의 연구실. 계약서 두루마리와 마력 측정구가 쌓여 있다.',
    wall: 'office',
    tile: 'dorm-plank',
    w: 14,
    h: 12,
    door: DOOR.office,
    props: (w, h) => [
      isoProp('al-desk', R.bigDesk, w / 2, 4.6, 1.0),
      isoProp('al-case0', R.bookcase, 1.4, 3.6, 0.8),
      isoProp('al-case1', R.bookcase, 1.4, 7.6, 0.8),
      isoProp('al-globe', W.globe, w - 1.8, 2.4, 0.3),
      isoProp('al-cb', W.crystalBall, w - 1.8, 6.4, 0.3),
      flat('al-rug', W.rugRed, w / 2, 8.4),
      isoProp('al-arm', W.armchair, w / 2 + 2.4, h - 2.6, 0.4),
    ],
  },
]
const ARCANE: HubSpec = {
  id: 'annex-arcane',
  name: '소환·무속성 마법관',
  desc: '학교 부관. 소환 마법과 무속성 마법을 가르친다. 차가운 청회색 석재로 지은 조용한 건물.',
  wall: 'arcane',
  tile: runner('academy-marble', 'academy-carpet'),
  w: 20,
  h: 18,
  props: (w, h) => [
    { ...isoProp('ha-orb', H.orb, w / 2, 7.2, 0.6), label: '부관 마력 구체' },
    ...[[3.4, 9.6], [w - 3.4, 9.6]].map(([x, y], i) => isoProp(`ha-bench${i}`, H.bench, x, y, 0.8)),
    ...[[1.6, h - 2.2], [w - 1.6, h - 2.2], [w - 1.6, 2.0]].map(([x, y], i) => isoProp(`ha-plant${i}`, H.plant, x, y, 0.5)),
    isoProp('ha-notice', W.notice, w - 1.6, 6.4, 0.3),
    isoProp('ha-bust', W.bust, w - 1.6, 12.4, 0.3),
    isoProp('ha-cbL', W.caseCrystal, 4.4, 13.4, 0.5),
  ],
  rooms: [
    { side: 'N', at: 5, room: ARCANE_ROOMS[0] },
    { side: 'N', at: 15, room: ARCANE_ROOMS[1] },
    { side: 'W', at: 6, room: ARCANE_ROOMS[2] },
    { side: 'W', at: 12, room: ARCANE_ROOMS[3] },
  ],
  out: { to: 'village', spawn: { x: 0, y: 0 }, label: '밖으로' },
}

// ════════ ② 연금·제작관(학교 부관) ════════
const CRAFT_ROOMS: RoomSpec[] = [
  {
    id: 'craft-alchemy',
    name: '연금 실습실',
    desc: '가마솥과 증류기가 늘어선 실습실. 약초 조합과 물약 제조를 배운다.',
    wall: 'earth',
    tile: 'academy-earth',
    w: 17,
    h: 15,
    door: DOOR.lab,
    props: (w, h) => [
      isoProp('ca-board', R.board, w / 2, 1.4, 0.8, { scale: 1.1 }),
      ...[[w / 2 - 3.4, 6.0], [w / 2 + 3.4, 6.0], [w / 2 - 3.4, 10.4], [w / 2 + 3.4, 10.4]].map(([x, y], i) => isoProp(`ca-lab${i}`, R.labTable, x, y, 0.9)),
      isoProp('ca-caul', R.cauldron, w / 2, 8.2, 0.8),
      isoProp('ca-shelf0', W.shelfPotion, 1.4, 4.0, 0.6),
      isoProp('ca-shelf1', W.casePotion, 1.4, 8.6, 0.5),
      isoProp('ca-herbs', R.herbs, w - 2.0, h - 2.4, 0.8),
    ],
  },
  {
    id: 'craft-magitool',
    name: '마도구 공방',
    desc: '낚싯대·채집 낫·탐험 등불 같은 마도구의 회로를 새기는 공방.',
    wall: 'forge',
    tile: 'dorm-plank',
    w: 16,
    h: 14,
    door: DOOR.lab,
    props: (w, h) => [
      isoProp('cm-desk0', R.bigDesk, w / 2 - 3, 5.0, 1.0),
      isoProp('cm-desk1', R.bigDesk, w / 2 + 3, 5.0, 1.0),
      isoProp('cm-tele', W.telescope, w - 2.0, 9.6, 0.5),
      isoProp('cm-case', W.caseWide, 1.6, 9.0, 0.8),
      isoProp('cm-globe', W.globe, w / 2, 9.6, 0.3),
      isoProp('cm-clock', W.clock, w - 1.4, 2.2, 0.3),
      isoProp('cm-lamp', W.lampOrange, 1.4, h - 2.0, 0.2),
    ],
  },
  {
    id: 'craft-forge',
    name: '장비 제작실',
    desc: '지팡이와 로브, 장신구를 직접 만들어 보는 실습실. 화로가 꺼지지 않는다.',
    wall: 'fire',
    tile: 'academy-fire',
    w: 16,
    h: 14,
    door: DOOR.cls,
    props: (w, h) => [
      { ...isoProp('cf-fire', R.fireplace, w / 2, 1.2, 0.9, { flip: true }), label: '제작 화로' },
      isoProp('cf-armor0', W.armor, 1.6, 4.6, 0.5),
      isoProp('cf-armor1', W.armor, 1.6, 8.6, 0.5),
      isoProp('cf-table', R.labTable, w / 2, 6.6, 0.9),
      ...[[w / 2 - 4, 4.0], [w / 2 + 4, 4.0]].map(([x, y], i) => isoProp(`cf-brz${i}`, R.brazier, x, y, 0.35)),
      isoProp('cf-trophy', W.trophy, w - 1.8, h - 2.4, 0.5),
    ],
  },
  {
    id: 'craft-candy',
    name: '마력캔디 제과실',
    desc: '마력 결정을 녹여 사탕으로 굳히는 달콤한 실습실. 늘 설탕 냄새가 난다.',
    wall: 'light',
    tile: 'dorm-plank',
    w: 14,
    h: 12,
    door: DOOR.cls,
    props: (w, h) => [
      isoProp('cc-counter', H.counter, w / 2, 3.4, 1.0),
      isoProp('cc-caul', W.cauldron, w / 2 - 3, 6.6, 0.4),
      isoProp('cc-caul2', W.cauldron, w / 2 + 3, 6.6, 0.4),
      isoProp('cc-cafe0', H.cafe, w / 2 - 2.6, 9.4, 0.6),
      isoProp('cc-cafe1', H.cafe, w / 2 + 2.6, 9.4, 0.6),
      isoProp('cc-shelf', W.shelfPotion, 1.4, 4.4, 0.6),
      isoProp('cc-bouquet', W.tableBouquet, w - 1.6, h - 2.4, 0.4),
    ],
  },
]
const CRAFT: HubSpec = {
  id: 'annex-craft',
  name: '연금·제작관',
  desc: '학교 부관. 연금술과 마도구·장비·마력캔디를 만드는 법을 배운다. 붉은 벽돌과 목재의 따뜻한 건물.',
  wall: 'forge',
  tile: runner('dorm-plank', 'academy-carpet'),
  w: 20,
  h: 18,
  props: (w, h) => [
    isoProp('hc-counter', H.counter, w / 2, 7.0, 1.0),
    ...[[3.4, 9.6], [w - 3.4, 9.6]].map(([x, y], i) => isoProp(`hc-bench${i}`, H.bench, x, y, 0.8)),
    isoProp('hc-case0', W.casePotion, w - 1.6, 6.4, 0.5),
    isoProp('hc-case1', W.caseFossil, w - 1.6, 12.4, 0.5),
    isoProp('hc-notice', W.notice, 4.4, 13.6, 0.3),
    ...[[1.6, h - 2.2], [w - 1.6, h - 2.2]].map(([x, y], i) => isoProp(`hc-plant${i}`, W.palm, x, y, 0.4)),
    isoProp('hc-caul', W.cauldron, w - 3.6, 2.4, 0.4),
  ],
  rooms: [
    { side: 'N', at: 5, room: CRAFT_ROOMS[0] },
    { side: 'N', at: 15, room: CRAFT_ROOMS[1] },
    { side: 'W', at: 6, room: CRAFT_ROOMS[2] },
    { side: 'W', at: 12, room: CRAFT_ROOMS[3] },
  ],
  out: { to: 'village', spawn: { x: 0, y: 0 }, label: '밖으로' },
}

// ════════ ③ 동아리관 — 부실 9곳 ════════
const club = (id: MapId, name: string, desc: string, wall: WallKey, tile: TileKind, door: Spr, props: RoomSpec['props']): RoomSpec => ({ id, name, desc, wall, tile, door, w: 13, h: 11, props })
const CLUB_ROOMS: RoomSpec[] = [
  club('club-explore', '탐험 동아리', '지도와 나침반, 탐험 일지가 가득한 부실. 다음 원정 계획이 칠판에 적혀 있다.', 'club', 'dorm-plank', DOOR.cls, (w, h) => [
    { ...isoProp('ce-map', CLUB_SPR.mapTable, w / 2, 4.6, 0.9, { scale: 1.5 }), label: '원정 지도' },
    isoProp('ce-globe', W.globe, 1.6, 3.0, 0.3),
    isoProp('ce-tele', W.telescope, w - 2.0, 3.0, 0.5),
    isoProp('ce-case', W.caseFossil, 1.6, 7.0, 0.5),
    flat('ce-rug', W.rugSquare, w / 2, 8.2),
    isoProp('ce-lamp', W.lampOrange, w - 1.4, h - 2.0, 0.2),
  ]),
  club('club-fishing', '낚시 동아리', '낚싯대 거치대와 작은 수조. 부원들이 잡은 물고기 탁본이 벽에 붙어 있다.', 'club', 'dorm-plank', DOOR.cls, (w, h) => [
    { ...isoProp('cf2-gear', CLUB_SPR.fishing, w / 2, 3.8, 0.9, { scale: 1.5 }), label: '낚시 도구' },
    isoProp('cf2-sofa', W.sofaGrey, w / 2 - 2.6, 7.6, 0.7),
    isoProp('cf2-tea', W.teatable, w / 2 + 1.0, 7.8, 0.6),
    isoProp('cf2-trophy', W.trophy, w - 1.6, 4.0, 0.5),
    isoProp('cf2-fern', W.fern, 1.4, h - 2.0, 0.3),
  ]),
  club('club-gather', '채집 동아리', '말린 약초와 버섯 표본, 채집 바구니가 걸린 부실.', 'earth', 'academy-earth', DOOR.lab, (w, h) => [
    { ...isoProp('cg-rack', CLUB_SPR.herbRack, w / 2, 3.8, 0.9, { scale: 1.5 }), label: '약초 건조대' },
    isoProp('cg-herbs', R.herbs, 2.6, 7.6, 0.8),
    isoProp('cg-tree', W.pottedTree, w - 1.6, 3.0, 0.4),
    isoProp('cg-flower', W.flowerbox, w - 2.2, h - 2.4, 0.6),
    isoProp('cg-fern', W.fern, 1.4, 3.0, 0.3),
  ]),
  club('club-alchemy', '연금 동아리', '수업이 끝나도 가마솥이 끓는 곳. 이상한 색의 연기가 자주 난다.', 'forge', 'dorm-plank', DOOR.lab, (w, h) => [
    isoProp('ch-caul', R.cauldron, w / 2, 4.6, 0.8),
    isoProp('ch-shelf', W.shelfPotion, 1.4, 3.8, 0.6),
    isoProp('ch-case', W.casePotion, w - 1.6, 3.8, 0.5),
    isoProp('ch-lab', R.labTable, w / 2, 7.0, 0.9),
    isoProp('ch-candel', W.candelabra, 1.4, h - 2.0, 0.3),
  ]),
  club('club-art', '미술 동아리', '이젤과 물감 냄새. 학교 풍경을 그린 그림이 벽마다 걸려 있다.', 'light', 'dorm-plank', DOOR.cls, (w, h) => [
    { ...isoProp('ca2-easel', CLUB_SPR.easel, w / 2, 4.4, 0.8, { scale: 1.5 }), label: '이젤' },
    isoProp('ca2-easel1', W.easelSmall, 2.6, 6.4, 0.3, { scale: 1.4 }),
    isoProp('ca2-easel2', W.easelSmall, w - 2.6, 6.4, 0.3, { scale: 1.4 }),
    isoProp('ca2-bust', W.bust, 1.4, 3.0, 0.3),
    isoProp('ca2-urn', W.urn, w - 1.4, 3.0, 0.3),
    flat('ca2-rug', W.rugRound, w / 2, 7.2),
  ]),
  club('club-music', '음악 동아리', '마법 리듬을 연습하는 합주실. 피아노와 현악기, 북이 놓여 있다.', 'office', 'academy-carpet', DOOR.meet, (w, h) => [
    { ...isoProp('cm2-inst', CLUB_SPR.instruments, w / 2 + 2.4, 4.4, 0.8, { scale: 1.5 }), label: '악기 거치대' },
    isoProp('cm2-piano', W.piano, w / 2 - 2.6, 4.2, 0.9),
    isoProp('cm2-bench', W.benchDouble, w / 2, 7.2, 0.7),
    isoProp('cm2-lamp', H.lamp, 1.4, h - 2.0, 0.3),
  ]),
  club('club-rune', '룬 연구회', '룬 카드와 마법진 도안을 연구하는 모임. 짝맞추기 대회 상장이 걸려 있다.', 'dark', 'academy-dark', DOOR.dark, (w, h) => [
    isoProp('cr-table', W.tableReading, w / 2, 4.8, 0.9),
    isoProp('cr-cb', W.crystalBall, w / 2, 3.0, 0.3),
    isoProp('cr-case', W.caseRelic, 1.6, 3.8, 0.5),
    isoProp('cr-shelf', W.shelfCrest, w - 1.6, 3.8, 0.6),
    isoProp('cr-stack', W.bookStack, w / 2 + 2.2, 7.6, 0.2),
    isoProp('cr-candel', W.candelabra, 1.4, h - 2.0, 0.3),
  ]),
  club('club-cooking', '요리 동아리', '모닥불 요리부터 연회 요리까지. 늘 시식 손님이 기웃거린다.', 'forge', 'dorm-plank', DOOR.cls, (w, h) => [
    isoProp('ck-counter', H.counter, w / 2, 3.6, 1.0),
    isoProp('ck-caul', W.cauldron, 2.2, 6.4, 0.4),
    isoProp('ck-cafe', H.cafe, w / 2, 7.6, 0.6),
    isoProp('ck-bouquet', W.tableBouquet, w - 1.6, 6.4, 0.4),
    isoProp('ck-herbs', R.herbs, w - 2.4, h - 2.4, 0.8, { scale: 0.8 }),
  ]),
  club('club-astro', '천문 관측회', '별자리 지도와 망원경. 밤이면 옥상으로 올라간다.', 'office', 'academy-carpet', DOOR.meet, (w, h) => [
    isoProp('cs-tele', W.telescope, w / 2, 4.2, 0.6, { scale: 1.3 }),
    isoProp('cs-globe', W.globe, 2.0, 3.2, 0.3),
    isoProp('cs-orb', H.orb, w - 2.0, 3.6, 0.5, { scale: 0.8 }),
    isoProp('cs-desk', W.deskStudy, w / 2, 8.0, 0.7),
    isoProp('cs-clock', W.clock, 1.4, h - 2.0, 0.3),
  ]),
]
const CLUB: HubSpec = {
  id: 'club-hall',
  name: '동아리관',
  desc: '학생 동아리 부실이 모여 있는 건물. 복도마다 부원 모집 게시물이 붙어 있다.',
  wall: 'club',
  tile: runner('dorm-plank', 'academy-carpet', 1.5),
  w: 26,
  h: 22,
  props: (w, h) => [
    { ...isoProp('hcl-notice', W.notice, w / 2, 9.4, 0.4, { scale: 1.3 }), label: '동아리 모집 게시판' },
    ...[[w / 2 - 4.6, 12.6], [w / 2 + 4.6, 12.6]].map(([x, y], i) => isoProp(`hcl-sofa${i}`, H.sofa, x, y, 0.8, { flip: i === 1 })),
    isoProp('hcl-tea', W.teatable, w / 2 - 4.6, 14.6, 0.6),
    isoProp('hcl-trophy0', W.trophy, w - 1.6, 4.2, 0.5),
    isoProp('hcl-trophy1', W.trophy, w - 1.6, 9.6, 0.5),
    ...[[1.6, h - 2.2], [w - 1.6, h - 2.2], [w - 1.6, 15.0]].map(([x, y], i) => isoProp(`hcl-plant${i}`, W.palm, x, y, 0.4)),
    isoProp('hcl-piano', W.piano, w - 3.4, h - 3.6, 0.9),
    isoProp('hcl-lamp0', W.lampOrange, w / 2 - 2.2, 5.4, 0.2),
    isoProp('hcl-lamp1', W.lampOrange, w / 2 + 2.2, 5.4, 0.2),
  ],
  rooms: [
    { side: 'N', at: 4, room: CLUB_ROOMS[0] },
    { side: 'N', at: 8.5, room: CLUB_ROOMS[1] },
    { side: 'N', at: 13, room: CLUB_ROOMS[2] },
    { side: 'N', at: 17.5, room: CLUB_ROOMS[3] },
    { side: 'N', at: 22, room: CLUB_ROOMS[4] },
    { side: 'W', at: 5, room: CLUB_ROOMS[5] },
    { side: 'W', at: 9.5, room: CLUB_ROOMS[6] },
    { side: 'W', at: 14, room: CLUB_ROOMS[7] },
    { side: 'W', at: 18.5, room: CLUB_ROOMS[8] },
  ],
  out: { to: 'village', spawn: { x: 0, y: 0 }, label: '밖으로' },
}

// ════════ ④ 중앙 대도서관 — 넓은 열람 홀 + 북벽 문 너머 울토르 기록관 ════════
const GL_W = 28
const GL_H = 22
export const GRAND_LIBRARY_ARCHIVE_DOOR = { side: 'N' as const, at: GL_W / 2 }
function grandLibrary(outSpawn: { x: number; y: number }): AnnexSpace {
  const w = GL_W
  const h = GL_H
  const cx = w / 2
  const props: PropDef[] = [
    // 북벽 기록관 문 양옆 — 원통 책장 기둥
    isoProp('gl-tower0', H.booktower, cx - 3.4, 1.6, 0.8),
    isoProp('gl-tower1', H.booktower, cx + 3.4, 1.6, 0.8),
    { ...isoProp('gl-orb', H.orb, cx, 7.6, 0.6), label: '지식의 구체' },
    flat('gl-rug', W.rugSquare, cx, 7.6, 1.4),
    // 서쪽·동쪽 서가 줄(책장 3열 × 2)
    ...[4.4, 8.0, 11.6].flatMap((y, j) => [
      isoProp(`gl-caseW${j}a`, R.bookcase, 3.6, y + 2.2, 1.0),
      isoProp(`gl-caseW${j}b`, R.bookcase, 6.6, y + 2.2, 1.0),
      isoProp(`gl-caseE${j}a`, R.bookcase, w - 6.6, y + 2.2, 1.0),
      isoProp(`gl-caseE${j}b`, R.bookcase, w - 3.6, y + 2.2, 1.0),
    ]),
    // 가운데 열람석
    ...[[cx - 3.2, 12.0], [cx + 3.2, 12.0], [cx - 3.2, 15.4], [cx + 3.2, 15.4]].map(([x, y], i) => isoProp(`gl-desk${i}`, H.desk, x, y, 1.0)),
    ...[[cx - 3.2, 13.6], [cx + 3.2, 13.6]].map(([x, y], i) => isoProp(`gl-lampd${i}`, W.lampOrange, x, y, 0.2)),
    // 안내 데스크·목록함·전시
    { ...isoProp('gl-counter', H.counter, cx + 7.4, h - 3.4, 1.0), label: '대출 안내 데스크' },
    isoProp('gl-catalog0', W.catalog, cx - 7.6, h - 3.0, 0.4),
    isoProp('gl-catalog1', W.catalog, cx - 9.0, h - 3.0, 0.4),
    isoProp('gl-display', H.display, cx, h - 4.0, 0.9),
    isoProp('gl-globe', W.globe, 1.6, h - 2.6, 0.3),
    isoProp('gl-clock', W.clock, w - 1.4, 2.0, 0.3),
    isoProp('gl-owl', W.owl, 1.6, 2.0, 0.5),
    ...[[1.4, 16.4], [w - 1.4, 16.4]].map(([x, y], i) => isoProp(`gl-lamp${i}`, H.lamp, x, y, 0.3)),
    ...[[1.6, h - 1.4], [w - 1.6, h - 1.4]].map(([x, y], i) => isoProp(`gl-plant${i}`, H.plant, x, y, 0.5)),
    isoProp('gl-stack0', W.bookStack, cx - 1.6, 13.2, 0.2),
    isoProp('gl-stack1', W.bookStack, cx + 4.6, 16.8, 0.2),
    isoProp('gl-bust0', W.bust, 1.4, 6.0, 0.3),
    isoProp('gl-bust1', W.bust, w - 1.4, 6.0, 0.3),
  ]
  return {
    id: 'grand-library',
    name: '중앙 대도서관',
    desc: '시계탑 아래 수만 권의 마법서가 잠든 울토르의 대도서관. 북쪽 문 너머는 학교의 옛 기록을 지키는 기록관이다.',
    w,
    h,
    tileAt: (x, y) => (Math.abs(x - cx) < 1.4 || (y > 6 && y < 9.4 && Math.abs(x - cx) < 4) ? 'academy-carpet' : 'dorm-plank'),
    props,
    structures: walls('gl', w, h, ANNEX_WALL.library, [{ side: 'N', at: cx, sp: H.doorLibrary }], false),
    edge: edgeBlockers(w, h),
    spawn: { x: cx, y: h - 2.2 },
    portals: [
      { id: 'grand-library-to-archive', cell: { x: cx, y: 1.4 }, to: 'village-archive', label: '울토르 기록관', kind: 'portal' },
      { id: 'grand-library-exit', cell: { x: cx, y: h - 0.8 }, to: 'village', toSpawn: outSpawn, label: '밖으로', kind: 'exit' },
    ],
  }
}
export const GRAND_LIBRARY_ARCHIVE_RETURN = { x: GL_W / 2, y: 3.0 }

/** 마을 쪽 입구(건물 앞 셀) — maps.ts 가 마을 포탈과 각 건물 출구 도착점으로 쓴다 */
export function annexSpaces(front: { arcane: { x: number; y: number }; craft: { x: number; y: number }; club: { x: number; y: number }; library: { x: number; y: number } }): AnnexSpace[] {
  const withOut = (h: HubSpec, p: { x: number; y: number }): HubSpec => ({ ...h, out: { ...h.out, spawn: p } })
  return [
    ...buildHub(withOut(ARCANE, front.arcane)),
    ...buildHub(withOut(CRAFT, front.craft)),
    ...buildHub(withOut(CLUB, front.club)),
    grandLibrary(front.library),
  ]
}

/** 새 맵 id 전부(lib/types MapId · lib/regions 학교 구역 목록과 맞출 것) */
export const ANNEX_MAP_IDS = [
  'grand-library',
  'annex-arcane', 'arcane-summon', 'arcane-neutral', 'arcane-circle', 'arcane-lab',
  'annex-craft', 'craft-alchemy', 'craft-magitool', 'craft-forge', 'craft-candy',
  'club-hall', 'club-explore', 'club-fishing', 'club-gather', 'club-alchemy', 'club-art', 'club-music', 'club-rune', 'club-cooking', 'club-astro',
] as const
