// ════════ 마법학교 본관 상층 — 2층 회랑 확장(2학년 교실 · 3층 계단 입구) + 3층 · 4층 복도 (2026-10-02) ════════
// 2026-10-08: 2층 회랑의 3층 계단 구조물은 통로를 가로막아 제거 — 대강당 문 옆 벽면 계단실 아치(입구)만 남김.
// 사용자 규칙(feedback-wall-furniture-iso-rules): 벽은 맵 끝선(x=0, y=0)에 전체 길이로 높게, 가구·구조물은 쿼터뷰 축 정합.
//   · 계단·벽은 iso-structures 투영면으로 정확히 그리고, 문·아치는 PixelLab 정면도를 벽면에 투영해 붙인다.
//   · 올라가는 계단 = 북벽을 향해 오르는 계단 구조물 + 꼭대기 벽면 아치(포탈). 내려가는 쪽 = 서벽의 계단실 아치(포탈).
import type { GameMap, MapId } from '@/lib/types'
import type { IsoPart, IsoStair, IsoStructGroup, PropDef, TileKind } from '@/lib/iso'
import { FLOOR2, GAL, HALL_CX, HALL_SPR, HALL_TEX as T, isoProp } from '@/lib/academy-hall'
import type { AcademyRoomKey } from '@/lib/academy-rooms'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
type Spr = { s: string; w: number; h: number }

/** 벽면 평면 이미지(문·창·아치) — 폭 중심 at, 바닥 z0, 화면 높이 hPx */
function wallDecal(plane: 'x' | 'y', at: number, hPx: number, z0: number, sp: Spr): IsoPart {
  const wc = (hPx * (sp.w / sp.h)) / 32
  return { kind: 'face', plane, at: 0, from: at - wc / 2, to: at + wc / 2, z0, z1: z0 + hPx, img: sp.s }
}
const decalHalfWidth = (hPx: number, sp: Spr) => (hPx * (sp.w / sp.h)) / 64

/** 북벽을 향해 오르는 직선 계단(난간 포함). zBase = 계단 아래 바닥 높이(맵 기준) */
function straightStair(id: string, s: IsoStair, zBase: number, steps: number): IsoStructGroup[] {
  const out: IsoStructGroup[] = []
  const depth = (s.yBottom - s.yTop) / steps
  const rise = s.zTop / steps
  for (let i = 0; i < steps; i++) {
    const y1 = s.yBottom - depth * i
    const y0 = y1 - depth
    const z1 = zBase + rise * (i + 1)
    const parts: IsoPart[] = [
      { kind: 'face', plane: 'y', at: y1, from: s.x0, to: s.x1, z0: zBase, z1, tex: T.riser },
      { kind: 'face', plane: 'x', at: s.x1, from: y0, to: y1, z0: zBase, z1, tex: T.wall, shade: 0.32 },
      { kind: 'top', x0: s.x0, y0, x1: s.x1, y1, z: z1, tex: T.marble },
      { kind: 'top', x0: s.x0 + 0.9, y0, x1: s.x1 - 0.9, y1, z: z1, tex: T.carpet },
      { kind: 'face', plane: 'x', at: s.x0, from: y0, to: y1, z0: z1, z1: z1 + 34, tex: T.rail },
      { kind: 'face', plane: 'x', at: s.x1, from: y0, to: y1, z0: z1, z1: z1 + 34, tex: T.rail },
    ]
    out.push({ id: `${id}${i}`, sortY: s.x0 + y0, parts })
  }
  return out
}
/** 계단 옆면 충돌 — 정면(아래)에서만 오른다. 맨 아래 한 줄은 비워 옆으로 지나다닐 수 있게 */
function stairBlockers(s: IsoStair): Blocker[] {
  const yb = s.yBottom - 0.55
  return [
    { x0: s.x0 - 0.25, y0: s.yTop - 0.4, x1: s.x0 + 0.05, y1: yb },
    { x0: s.x1 - 0.05, y0: s.yTop - 0.4, x1: s.x1 + 0.25, y1: yb },
  ]
}

// ════════ 2층 회랑 확장 ════════
/** 2층 북벽 2학년 교실 문 위치(x) */
export const YEAR2_DOOR_X = 10
const ARCH_H = 200
/** 3층 계단 입구(계단실 아치) — 대강당 대문(x=HALL_CX, 높이 240) 오른쪽, 회랑 바닥에 대문과 같은 기준선으로 */
export const FLOOR3_ENTRY_X = HALL_CX + 6.6
const ENTRY_H = 224

/** 2층 벽에 붙는 문·아치 — zBase 는 academy-hall 의 기준(1층 맵 0, 2층 맵 -FLOOR2) */
export function galleryWallDecals(zBase: number): IsoPart[] {
  const z2 = zBase + FLOOR2
  return [
    wallDecal('y', YEAR2_DOOR_X, 184, z2, HALL_SPR.doorClass),
    wallDecal('y', FLOOR3_ENTRY_X, ENTRY_H, z2, HALL_SPR.archStair),
    wallDecal('y', FLOOR3_ENTRY_X, 96, z2 + ENTRY_H + 24, HALL_SPR.banner),
  ]
}
/** 2층 벽 창·배너를 비워야 하는 구간(x) — 문·아치와 겹치지 않게 */
export const GALLERY_WALL_SKIP: [number, number][] = [
  [YEAR2_DOOR_X - 2.2, YEAR2_DOOR_X + 2.2],
  [FLOOR3_ENTRY_X - decalHalfWidth(ENTRY_H, HALL_SPR.archStair) - 0.4, FLOOR3_ENTRY_X + decalHalfWidth(ENTRY_H, HALL_SPR.archStair) + 0.4],
]
/** 회랑 책장이 계단·문을 막지 않게 — 이 x 의 북쪽 책장은 뺀다 */
export const GALLERY_SHELF_SKIP = (x: number) => GALLERY_WALL_SKIP.some(([a, b]) => x > a - 0.4 && x < b + 0.4)
export const GALLERY_LIMIT_Y = GAL

// ════════ 3층 · 4층 복도 ════════
export const UF_W = 46
export const UF_H = 10
const UF_WALL_H = 440
export const UF_PAD_TOP = UF_WALL_H + 80
/** 서벽 계단실 아치(아래층으로) — y 중심 */
const DOWN_ARCH_Y = 5
/** 동쪽 끝 오르는 계단(3층 → 4층) */
const UP_STAIR: IsoStair = { x0: UF_W - 5, x1: UF_W - 0.8, yTop: 0.55, yBottom: 4.4, zTop: 130 }

export interface UpperDoor {
  key: AcademyRoomKey
  at: number // 북벽 x
  door: Spr
}
export const FLOOR3_DOORS: UpperDoor[] = [
  { key: 'year3', at: 8, door: HALL_SPR.doorClass },
  { key: 'dark', at: 13.2, door: HALL_SPR.doorDark },
  { key: 'light', at: 18.4, door: HALL_SPR.doorLight },
  { key: 'practice', at: 23.8, door: HALL_SPR.doorLab },
  { key: 'labFire', at: 29.2, door: HALL_SPR.doorOffice },
  { key: 'labIce', at: 33.6, door: HALL_SPR.doorOffice },
  { key: 'labEarth', at: 38, door: HALL_SPR.doorOffice },
]
export const FLOOR4_DOORS: UpperDoor[] = [
  { key: 'year4', at: 9, door: HALL_SPR.doorClass },
  { key: 'practiceAdv', at: 15.5, door: HALL_SPR.doorLab },
  { key: 'council', at: 23, door: HALL_SPR.doorMeeting },
  { key: 'labDark', at: 30, door: HALL_SPR.doorOffice },
  { key: 'labLight', at: 35.5, door: HALL_SPR.doorOffice },
]
const DOOR_H = 184

/** 복도 바닥 — 대리석 + 가운데 남색 러너 */
export const upperTileAt = (x: number, y: number): TileKind => (y > 4.6 && y < 6.6 && x > 3.2 ? 'academy-carpet' : 'academy-marble')

export function buildUpperFloor(floor: 3 | 4): { props: PropDef[]; structures: IsoStructGroup[]; blockers: Blocker[]; stairs: IsoStair[] } {
  const doors = floor === 3 ? FLOOR3_DOORS : FLOOR4_DOORS
  const hasUp = floor === 3
  const busy: [number, number][] = doors.map((d) => [d.at - decalHalfWidth(DOOR_H, d.door) - 0.5, d.at + decalHalfWidth(DOOR_H, d.door) + 0.5])
  if (hasUp) busy.push([UP_STAIR.x0 - 0.5, UF_W])
  const free = (x: number, half: number) => !busy.some(([a, b]) => x + half > a && x - half < b)

  const parts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: UF_W, z0: 0, z1: UF_WALL_H, tex: T.wall },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: UF_H, z0: 0, z1: UF_WALL_H, tex: T.wall, shade: 0.14 },
    { kind: 'face', plane: 'y', at: 0, from: 0, to: UF_W, z0: 0, z1: 14, fill: '#7d6a4c' },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: UF_H, z0: 0, z1: 14, fill: '#6c5b40' },
  ]
  // 문 사이 높은 창 + 배너, 문 위 배너
  for (let x = 3; x < UF_W - 1; x += 2.6) {
    if (free(x, 0.8)) parts.push(wallDecal('y', x, 220, 170, HALL_SPR.window))
  }
  for (const d of doors) {
    parts.push(wallDecal('y', d.at, DOOR_H, 0, d.door))
    parts.push(wallDecal('y', d.at, 110, DOOR_H + 40, HALL_SPR.banner))
  }
  // 서벽 — 아래층 계단실 아치 + 창
  parts.push(wallDecal('x', DOWN_ARCH_Y, 230, 0, HALL_SPR.archStair))
  parts.push(wallDecal('x', 1.6, 200, 190, HALL_SPR.window))
  parts.push(wallDecal('x', 8.6, 200, 190, HALL_SPR.window))
  const structures: IsoStructGroup[] = [{ id: `uf${floor}-walls`, back: 0, parts }]
  const stairs: IsoStair[] = []
  if (hasUp) {
    structures.push(...straightStair(`uf${floor}-up`, UP_STAIR, 0, 7))
    structures[0].parts.push(wallDecal('y', (UP_STAIR.x0 + UP_STAIR.x1) / 2, ARCH_H, UP_STAIR.zTop, HALL_SPR.archStair))
    stairs.push(UP_STAIR)
  }

  // 소품 — 문 사이 가로등, 남쪽 벤치·화분·전시대(통로는 비움)
  const props: PropDef[] = []
  const S = HALL_SPR
  for (let i = 0; i < doors.length - 1; i++) {
    const x = (doors[i].at + doors[i + 1].at) / 2
    props.push(isoProp(`uf${floor}-lamp${i}`, S.lamp, x, 1.1, 0.3))
  }
  const southXs = floor === 3 ? [9, 16, 24, 31, 37] : [10, 18, 26, 33, 40]
  southXs.forEach((x, i) => props.push(i % 2 ? isoProp(`uf${floor}-display${i}`, S.display, x, 8.6, 0.8) : isoProp(`uf${floor}-bench${i}`, S.bench, x, 8.7, 0.7)))
  ;[[2.2, 8.6], [UF_W - 1.6, 8.6], [5.4, 1.4]].forEach(([x, y], i) => props.push(isoProp(`uf${floor}-plant${i}`, S.plant, x, y, 0.5)))
  if (!hasUp) {
    props.push(isoProp('uf4-tower', S.booktower, UF_W - 3, 2.4, 0.9, { scale: 1.05 }))
    props.push(isoProp('uf4-orb', S.orb, UF_W - 6.5, 2, 0.5))
  }

  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: UF_W, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: UF_H },
    { x0: UF_W - 0.3, y0: 0, x1: UF_W, y1: UF_H },
    { x0: 0, y0: UF_H - 0.3, x1: UF_W, y1: UF_H },
    ...(hasUp ? stairBlockers(UP_STAIR) : []),
  ]
  return { props, structures, blockers, stairs }
}

/** 복도의 문 앞 셀(포탈 d=1.3 · 되돌아올 때 d=2.8) */
export const upperDoorFront = (d: UpperDoor, dist: number) => ({ x: d.at, y: dist })

/** 복도 맵의 포탈 — 방 문 + 위/아래층 계단 */
export function upperPortals(floor: 3 | 4, roomIds: Record<AcademyRoomKey, { id: MapId; name: string }>): GameMap['portals'] {
  const doors = floor === 3 ? FLOOR3_DOORS : FLOOR4_DOORS
  const out: GameMap['portals'] = doors.map((d) => ({ id: `${floor}f-to-${roomIds[d.key].id}`, cell: upperDoorFront(d, 1.3), to: roomIds[d.key].id, label: roomIds[d.key].name, kind: 'portal' as const }))
  // 아래층 — 서벽 계단실
  out.push(
    floor === 3
      ? { id: '3f-to-2f', cell: { x: 1.2, y: DOWN_ARCH_Y }, to: 'academy-2f', toSpawn: { x: FLOOR3_ENTRY_X, y: 2.7 }, label: '2층으로', kind: 'exit' as const }
      : { id: '4f-to-3f', cell: { x: 1.2, y: DOWN_ARCH_Y }, to: 'academy-3f', toSpawn: { x: (UP_STAIR.x0 + UP_STAIR.x1) / 2, y: UP_STAIR.yBottom - 0.15 }, label: '3층으로', kind: 'exit' as const },
  )
  if (floor === 3) out.push({ id: '3f-to-4f', cell: { x: (UP_STAIR.x0 + UP_STAIR.x1) / 2, y: UP_STAIR.yTop + 0.6 }, to: 'academy-4f', toSpawn: { x: 2.6, y: DOWN_ARCH_Y }, label: '4층으로', kind: 'portal' as const })
  return out
}
/** 위층 복도에 처음 도착하는 자리(서벽 계단실 앞) */
export const UF_SPAWN = { x: 2.6, y: DOWN_ARCH_Y }

/** 상층 방 → 돌아갈 복도와 문 앞 위치 */
export function upperRoomReturn(key: AcademyRoomKey): { to: MapId; spawn: { x: number; y: number }; label: string } | null {
  if (key === 'year2') return { to: 'academy-2f', spawn: { x: YEAR2_DOOR_X, y: 2.8 }, label: '2층 회랑으로' }
  const d3 = FLOOR3_DOORS.find((d) => d.key === key)
  if (d3) return { to: 'academy-3f', spawn: upperDoorFront(d3, 2.8), label: '3층 복도로' }
  const d4 = FLOOR4_DOORS.find((d) => d.key === key)
  if (d4) return { to: 'academy-4f', spawn: upperDoorFront(d4, 2.8), label: '4층 복도로' }
  return null
}
