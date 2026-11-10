// ============================================================================
// 관리자 오브젝트 편집 — 맵 프롭(오브젝트)을 옮기고/돌리고/지우고/새로 놓은 기록 + 바닥 타일 · 벽면 무늬.
//   · 배포본 기록: public/map-overrides.json (모든 사람에게 적용)
//   · 이 브라우저 기록: localStorage 'ultor-map-overrides' (배포본 위에 덮어씀 — 맵 단위)
//   · 적용: MAPS[id] 를 원본(ORIGINAL) 기준으로 다시 만들어 교체한다 — props 와 blockers(충돌)를 함께 갱신.
//   · 관리자 창 「파일로 저장」 → map-overrides.json 을 web/public/ 에 넣고 배포하면 모두에게 반영.
//   · 2026-11-03: 회전(좌우 반전 — 발밑 사각형의 가로·세로도 바뀐다), 바닥 칠하기, 벽면 무늬 바꾸기, 되돌리기(Ctrl+Z).
//     편집 한 번에 그 맵만 다시 만든다(예전엔 모든 맵을 다시 만들었다).
// ============================================================================

import { useSyncExternalStore } from 'react'
import type { GameMap } from '@/lib/types'
import type { IsoPart, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { MAPS, propBlocker } from '@/lib/maps'
import { isMirrored } from '@/lib/iso'
import { VILLAGE_LAYOUT, villageShift } from '@/lib/village-layout'

export interface MapOverride {
  /** 원래 프롭 id → 새 발밑 셀 */
  moved?: Record<string, { x: number; y: number }>
  /** 지운 원래 프롭 id */
  removed?: string[]
  /** 새로 놓은 프롭 */
  added?: PropDef[]
  /** 원래 프롭 id → 좌우 반전(원래 방향의 반대로) */
  flip?: Record<string, boolean>
  /** 바닥 타일 'x,y'(정수 칸) → 타일 종류 */
  tiles?: Record<string, TileKind>
  /** 벽면 '구조물id#면번호' → 새 무늬 */
  walls?: Record<string, IsoTex>
  /** 프롭 id → 그림 크기 배율(원래 크기 = 1) */
  size?: Record<string, number>
  /** 프롭 id → 직접 정한 길막(off = 길막 없음) */
  collide?: Record<string, CollideEdit>
  /** 꺼 둔 '주인 없는' 길막(벽·지형 상자) — blockKey 목록 */
  blockOff?: string[]
}
export interface CollideEdit {
  w: number
  d: number
  /** 발밑 셀 기준 길막 중심(맵 축) */
  ox: number
  oy: number
  off?: boolean
}
export type MapOverrides = Record<string, MapOverride>
type FullOverride = Required<MapOverride>

const LS_KEY = 'ultor-map-overrides'
/** 이 브라우저 기록이 어느 마을 배치 판 좌표로 적혔는지 */
const LS_LAYOUT_KEY = 'ultor-map-overrides-village-layout'
const EVENT = 'ultor-map-overrides'
const MAP_TABLE = MAPS as unknown as Record<string, GameMap>
const ORIGINAL = new Map<string, GameMap>()

let published: MapOverrides = {}
let local: MapOverrides = {}
let version = 0
let started = false
/** 되돌리기 — 맵마다 편집 전 기록(이 브라우저 기록)을 쌓는다 */
const undoStack = new Map<string, (MapOverride | undefined)[]>()
const UNDO_MAX = 60

/** 마을 북쪽 확장 전 기록(옛 좌표)이면 마을 프롭 자리를 확장만큼 민다 */
function shiftVillage(all: MapOverrides): MapOverrides {
  const v = all.village
  if (!v) return all
  return {
    ...all,
    village: {
      ...v,
      moved: v.moved && Object.fromEntries(Object.entries(v.moved).map(([id, c]) => [id, villageShift(c)])),
      added: v.added?.map((p) => ({ ...p, cell: villageShift(p.cell) })),
    },
  }
}

function readLocal(): MapOverrides {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as MapOverrides
    if (localStorage.getItem(LS_LAYOUT_KEY) === String(VILLAGE_LAYOUT)) return all
    const shifted = shiftVillage(all)
    localStorage.setItem(LS_KEY, JSON.stringify(shifted))
    localStorage.setItem(LS_LAYOUT_KEY, String(VILLAGE_LAYOUT))
    return shifted
  } catch {
    return {}
  }
}
let writeTimer: ReturnType<typeof setTimeout> | null = null
/** 저장은 잠깐 모았다가 한 번에(연속 편집 중 매번 JSON 전체를 쓰지 않게) */
function writeLocal() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(local))
      localStorage.setItem(LS_LAYOUT_KEY, String(VILLAGE_LAYOUT))
    } catch {
      /* 저장소를 못 쓰면 이번 세션에만 적용 */
    }
  }, 250)
}

/** 이 브라우저 기록이 있으면 그 맵은 그것을, 없으면 배포본 기록을 쓴다 */
export function effectiveOverrides(): MapOverrides {
  return { ...published, ...local }
}

const sameBox = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) =>
  Math.abs(a.x0 - b.x0) < 1e-6 && Math.abs(a.y0 - b.y0) < 1e-6 && Math.abs(a.x1 - b.x1) < 1e-6 && Math.abs(a.y1 - b.y1) < 1e-6

/** 길막 상자 하나를 가리키는 이름(소수 3자리) — 주인 없는 길막 끄기에 쓴다 */
export const blockKey = (b: { x0: number; y0: number; x1: number; y1: number }) => [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(3)).join(',')

const tileFnCache = new Map<string, { sig: string; tileAt?: (x: number, y: number) => TileKind; terrain?: GameMap['terrain'] }>()
const tileKey = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`
export const wallKey = (groupId: string, partIndex: number) => `${groupId}#${partIndex}`

/** 그림 크기 배율 · 직접 정한 길막을 프롭에 입힌다 */
function resizeAndCollide(p: PropDef, k: number | undefined, c: CollideEdit | undefined): PropDef {
  let q = p
  if (k != null && k !== 1 && p.px) {
    q = { ...q, px: { w: p.px.w * k, h: p.px.h * k }, ...(p.anchor ? { anchor: { x: p.anchor.x * k, y: p.anchor.y * k } } : {}) }
    // 맵이 붙여 준 길막(collideBox)도 그림과 같이 커지고 작아진다
    if (p.collideBox) q.collideBox = { w: p.collideBox.w * k, d: p.collideBox.d * k, ox: p.collideBox.ox * k, oy: p.collideBox.oy * k }
  }
  if (c) q = c.off ? { ...q, collideOff: true, collideBox: undefined } : { ...q, solid: true, collideOff: false, collideBox: { w: c.w, d: c.d, ox: c.ox, oy: c.oy } }
  return q
}

function applyMap(id: string) {
  const current = MAP_TABLE[id]
  if (!current) return
  if (!ORIGINAL.has(id)) ORIGINAL.set(id, current)
  const orig = ORIGINAL.get(id)!
  const ov = effectiveOverrides()[id]
  if (!ov) {
    MAP_TABLE[id] = orig
    return
  }
  const removed = new Set(ov.removed ?? [])
  const moved = ov.moved ?? {}
  const flip = ov.flip ?? {}
  const sizeOv = ov.size ?? {}
  const collideOv = ov.collide ?? {}
  const changed = (pid: string) => !!moved[pid] || !!flip[pid] || sizeOv[pid] != null || !!collideOv[pid]
  const oldBoxes: ReturnType<typeof propBlocker>[] = []
  const props: PropDef[] = []
  for (const p of orig.props ?? []) {
    if (removed.has(p.id) || changed(p.id)) oldBoxes.push(propBlocker(p))
    if (removed.has(p.id)) continue
    if (!changed(p.id)) {
      props.push(p)
      continue
    }
    const q: PropDef = { ...p, cell: moved[p.id] ? { ...moved[p.id] } : p.cell }
    if (flip[p.id]) {
      // 지금 뒤집혀 있으면 바로 세우고(facing·mirrorX 둘 다 끔), 아니면 뒤집는다
      if (isMirrored(p)) {
        q.mirrorX = false
        if (q.facing === 'left') q.facing = undefined
      } else q.mirrorX = true
      // 맵이 붙여 준 길막도 같이 뒤집는다(화면 좌우 반전 = 셀 x·y 축 맞바꿈)
      if (q.collideBox) q.collideBox = { w: q.collideBox.d, d: q.collideBox.w, ox: q.collideBox.oy, oy: q.collideBox.ox }
    }
    props.push(resizeAndCollide(q, sizeOv[p.id], collideOv[p.id]))
  }
  const addedNow = (ov.added ?? []).map((a) => resizeAndCollide(a, sizeOv[a.id], collideOv[a.id]))
  props.push(...addedNow)
  // 충돌: 옮기거나 돌리거나 지운 프롭의 원래 사각형을 빼고, 새 자리·새 프롭의 사각형을 더한다
  const blockers = [...(orig.blockers ?? [])]
  for (const box of oldBoxes) {
    if (!box) continue
    const i = blockers.findIndex((b) => sameBox(b, box))
    if (i >= 0) blockers.splice(i, 1)
  }
  const added = new Set(addedNow)
  for (const p of props)
    if (changed(p.id) || added.has(p)) {
      const box = propBlocker(p)
      if (box) blockers.push(box)
    }
  // 관리자가 끈 주인 없는 길막
  const off = ov.blockOff?.length ? new Set(ov.blockOff) : null
  const next: GameMap = { ...orig, props, blockers: off ? blockers.filter((b) => !off.has(blockKey(b))) : blockers }
  // 바닥 타일 — 칠한 칸만 바꾸고 나머지는 원래 함수(낚시·채집·물/용암 판정도 같이 따라간다)
  const tiles = ov.tiles
  if (tiles && Object.keys(tiles).length) {
    // 칠한 칸이 그대로면 같은 함수를 다시 쓴다 — 바닥 캔버스는 함수가 바뀔 때만 다시 그린다(오브젝트만 옮길 땐 그대로)
    const sig = JSON.stringify(tiles)
    let hit = tileFnCache.get(id)
    if (!hit || hit.sig !== sig) {
      const pick = (x: number, y: number) => tiles[tileKey(x, y)]
      const baseTile = orig.tileAt
      const T = orig.terrain
      hit = {
        sig,
        tileAt: baseTile ? (x: number, y: number) => pick(x, y) ?? baseTile(x, y) : undefined,
        // 자연 지형(야생맵·마을): 칠한 칸은 그 바닥으로, 물웅덩이도 메운다
        terrain: T ? { ...T, at: (x: number, y: number) => pick(x, y) ?? T.at(x, y), pool: (x: number, y: number) => (pick(x, y) ? null : T.pool(x, y)) } : undefined,
      }
      tileFnCache.set(id, hit)
    }
    if (hit.tileAt) next.tileAt = hit.tileAt
    if (hit.terrain) next.terrain = hit.terrain
  }
  // 벽면 무늬
  const walls = ov.walls
  if (walls && Object.keys(walls).length && orig.structures) {
    next.structures = orig.structures.map((g) => {
      let hit = false
      const parts = g.parts.map((part, i): IsoPart => {
        const t = walls[wallKey(g.id, i)]
        if (!t || part.kind !== 'face') return part
        hit = true
        return { ...part, tex: t }
      })
      return hit ? { ...g, parts } : g
    })
  }
  MAP_TABLE[id] = next
}

function bump() {
  version++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}
function applyAll() {
  const ids = new Set([...ORIGINAL.keys(), ...Object.keys(effectiveOverrides())])
  for (const id of ids) applyMap(id)
  bump()
}

/** 앱 시작 시 한 번 — 이 브라우저 기록을 바로 적용하고, 배포본 기록(public/map-overrides.json)을 받아 다시 적용 */
export function initMapOverrides() {
  if (started || typeof window === 'undefined') return
  started = true
  local = readLocal()
  applyAll()
  fetch('/map-overrides.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: MapOverrides) => {
      published = j && typeof j === 'object' ? j : {}
      applyAll()
    })
    .catch(() => {})
}

/** 맵 기록이 바뀌면 다시 그리기 위한 훅 */
export function useMapOverridesVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      return () => window.removeEventListener(EVENT, cb)
    },
    () => version,
    () => 0,
  )
}

/** 원래 맵(편집 전) — 벽 무늬 목록·원래 바닥 확인용 */
export const originalMap = (id: string): GameMap | undefined => ORIGINAL.get(id) ?? MAP_TABLE[id]

function full(base: MapOverride): FullOverride {
  return {
    moved: { ...(base.moved ?? {}) },
    removed: [...(base.removed ?? [])],
    added: (base.added ?? []).map((p) => ({ ...p, cell: { ...p.cell } })),
    flip: { ...(base.flip ?? {}) },
    tiles: { ...(base.tiles ?? {}) },
    walls: { ...(base.walls ?? {}) },
    size: { ...(base.size ?? {}) },
    collide: { ...(base.collide ?? {}) },
    blockOff: [...(base.blockOff ?? [])],
  }
}

/** 이 맵의 편집 기록을 고친다(배포본 기록을 바탕으로 복사해서 시작). 그 맵만 다시 만든다 */
function edit(mapId: string, fn: (o: FullOverride) => void) {
  const stack = undoStack.get(mapId) ?? []
  stack.push(local[mapId])
  if (stack.length > UNDO_MAX) stack.shift()
  undoStack.set(mapId, stack)
  const o = full(local[mapId] ?? published[mapId] ?? {})
  fn(o)
  local = { ...local, [mapId]: o }
  writeLocal()
  applyMap(mapId)
  bump()
}

/** 마지막 편집 되돌리기 — 되돌릴 게 없으면 false */
export function undoMapEdit(mapId: string): boolean {
  const stack = undoStack.get(mapId)
  if (!stack?.length) return false
  const prev = stack.pop()
  if (prev) local = { ...local, [mapId]: prev }
  else {
    const { [mapId]: _drop, ...rest } = local
    void _drop
    local = rest
  }
  writeLocal()
  applyMap(mapId)
  bump()
  return true
}
export const canUndoMapEdit = (mapId: string) => (undoStack.get(mapId)?.length ?? 0) > 0

const isAdded = (mapId: string, propId: string) => propId.startsWith('adm-') && !!MAP_TABLE[mapId]?.props?.some((p) => p.id === propId)

export function moveProp(mapId: string, propId: string, cell: { x: number; y: number }) {
  const c = { x: Math.round(cell.x * 4) / 4, y: Math.round(cell.y * 4) / 4 }
  const cur = MAP_TABLE[mapId]?.props?.find((p) => p.id === propId)
  if (cur && cur.cell.x === c.x && cur.cell.y === c.y) return
  edit(mapId, (o) => {
    const added = o.added.find((p) => p.id === propId)
    if (added) added.cell = c
    else o.moved[propId] = c
  })
}

/** 좌우 반전(회전) — 그림이 뒤집히고, 발밑 사각형의 가로·세로가 서로 바뀐다(lib/iso propAABB) */
export function flipProp(mapId: string, propId: string) {
  edit(mapId, (o) => {
    const added = o.added.find((p) => p.id === propId)
    if (added) {
      if (isMirrored(added)) {
        added.mirrorX = false
        if (added.facing === 'left') added.facing = undefined
      } else added.mirrorX = true
    }
    else if (o.flip[propId]) delete o.flip[propId]
    else o.flip[propId] = true
  })
}

export function removeProp(mapId: string, propId: string) {
  edit(mapId, (o) => {
    if (isAdded(mapId, propId)) o.added = o.added.filter((p) => p.id !== propId)
    else {
      delete o.moved[propId]
      delete o.flip[propId]
      delete o.size[propId]
      delete o.collide[propId]
      if (!o.removed.includes(propId)) o.removed.push(propId)
    }
  })
}

export function addProp(mapId: string, prop: Omit<PropDef, 'id'>): string {
  const id = `adm-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
  edit(mapId, (o) => {
    o.added.push({ ...prop, id, cell: { x: Math.round(prop.cell.x * 4) / 4, y: Math.round(prop.cell.y * 4) / 4 } } as PropDef)
  })
  return id
}

/** 그림 크기 배율(원래 = 1, 0.3~3) */
export function scaleProp(mapId: string, propId: string, k: number) {
  const v = Math.round(Math.max(0.3, Math.min(3, k)) * 100) / 100
  edit(mapId, (o) => {
    if (Math.abs(v - 1) < 1e-6) delete o.size[propId]
    else o.size[propId] = v
  })
}
export const propSizeOf = (mapId: string, propId: string) => effectiveOverrides()[mapId]?.size?.[propId] ?? 1

/** 길막 직접 정하기 — null = 자동(원래대로), { off: true } = 길막 없음 */
export function setPropCollide(mapId: string, propId: string, c: CollideEdit | null) {
  edit(mapId, (o) => {
    if (!c) delete o.collide[propId]
    else o.collide[propId] = { w: r2(c.w), d: r2(c.d), ox: r2(c.ox), oy: r2(c.oy), ...(c.off ? { off: true } : {}) }
  })
}
const r2 = (v: number) => Math.round(v * 100) / 100
/** 지금 길막(편집 시작값) — 셀 기준 중심 · 너비 · 깊이. 길막이 없으면 0.6칸 상자 */
export function propCollideNow(mapId: string, propId: string): CollideEdit & { custom: boolean } {
  const p = MAP_TABLE[mapId]?.props?.find((x) => x.id === propId)
  const custom = effectiveOverrides()[mapId]?.collide?.[propId]
  if (custom) return { ...custom, custom: true }
  const b = p ? propBlocker(p) : null
  if (!p || !b) return { w: 0.6, d: 0.6, ox: 0, oy: 0, off: true, custom: false }
  return { w: b.x1 - b.x0, d: b.y1 - b.y0, ox: (b.x0 + b.x1) / 2 - p.cell.x, oy: (b.y0 + b.y1) / 2 - p.cell.y, custom: false }
}

/** 주인 없는 길막(벽·지형 상자) 끄기/켜기 */
export function setBlockOff(mapId: string, key: string, off: boolean) {
  edit(mapId, (o) => {
    o.blockOff = o.blockOff.filter((k) => k !== key)
    if (off) o.blockOff.push(key)
  })
}
/** 이 맵에서 꺼 둔 주인 없는 길막 상자들(원래 맵 기준) */
export function offBlockers(mapId: string): { x0: number; y0: number; x1: number; y1: number }[] {
  const keys = effectiveOverrides()[mapId]?.blockOff
  if (!keys?.length) return []
  const set = new Set(keys)
  return (originalMap(mapId)?.blockers ?? []).filter((b) => set.has(blockKey(b)))
}

/** 바닥 칠하기 — kind null 이면 원래 바닥으로 */
export function paintTiles(mapId: string, cells: Iterable<string>, kind: TileKind | null) {
  const map = MAP_TABLE[mapId]
  if (!map) return
  const list = [...cells].filter((k) => {
    const [x, y] = k.split(',').map(Number)
    return x >= 0 && y >= 0 && x < map.grid.w && y < map.grid.h
  })
  if (!list.length) return
  edit(mapId, (o) => {
    for (const k of list) {
      if (kind) o.tiles[k] = kind
      else delete o.tiles[k]
    }
  })
}

/** 벽면 무늬 바꾸기 — tex null 이면 원래 무늬로 */
export function setWallTex(mapId: string, keys: string[], tex: IsoTex | null) {
  if (!keys.length) return
  edit(mapId, (o) => {
    for (const k of keys) {
      if (tex) o.walls[k] = tex
      else delete o.walls[k]
    }
  })
}

/** 이 맵의 이 브라우저 기록을 지운다(배포본 기록으로 되돌림) */
export function resetLocalMap(mapId: string) {
  const { [mapId]: _drop, ...rest } = local
  void _drop
  local = rest
  undoStack.delete(mapId)
  writeLocal()
  applyMap(mapId)
  bump()
}

/** 이 맵을 원래 게임 상태로(배포본 기록도 무시하고 빈 기록으로 덮음) */
export function resetMapToOriginal(mapId: string) {
  edit(mapId, (o) => {
    o.moved = {}
    o.removed = []
    o.added = []
    o.flip = {}
    o.tiles = {}
    o.walls = {}
    o.size = {}
    o.collide = {}
    o.blockOff = []
  })
}

const countOf = (o: MapOverride | undefined) =>
  o
    ? Object.keys(o.moved ?? {}).length +
      (o.removed ?? []).length +
      (o.added ?? []).length +
      Object.keys(o.flip ?? {}).length +
      Object.keys(o.tiles ?? {}).length +
      Object.keys(o.walls ?? {}).length +
      Object.keys(o.size ?? {}).length +
      Object.keys(o.collide ?? {}).length +
      (o.blockOff ?? []).length
    : 0

/** 배포용 파일 내용 — 배포본 + 이 브라우저 기록을 합친 것(빈 맵·빈 칸은 뺀다) */
export function exportMapOverrides(): string {
  const all = effectiveOverrides()
  const clean: MapOverrides = {}
  for (const [id, o] of Object.entries(all)) {
    if (!countOf(o)) continue
    const c: MapOverride = {}
    if (Object.keys(o.moved ?? {}).length) c.moved = o.moved
    if ((o.removed ?? []).length) c.removed = o.removed
    if ((o.added ?? []).length) c.added = o.added
    if (Object.keys(o.flip ?? {}).length) c.flip = o.flip
    if (Object.keys(o.tiles ?? {}).length) c.tiles = o.tiles
    if (Object.keys(o.walls ?? {}).length) c.walls = o.walls
    // 크기·길막 편집도 파일에 담는다(예전엔 빠져서 배포하면 사라졌다)
    if (Object.keys(o.size ?? {}).length) c.size = o.size
    if (Object.keys(o.collide ?? {}).length) c.collide = o.collide
    if ((o.blockOff ?? []).length) c.blockOff = o.blockOff
    clean[id] = c
  }
  return JSON.stringify(clean, null, 2)
}

export function importMapOverrides(text: string) {
  const j = JSON.parse(text) as MapOverrides
  local = { ...local, ...j }
  undoStack.clear()
  writeLocal()
  applyAll()
}

/** 이 맵에서 이 브라우저로 바꾼 것 수(표시용) */
export function localChangeCount(mapId: string): number {
  return countOf(local[mapId])
}

// ─────────────────────────────────────────────────────────────────────────────
// 팔레트 — 바닥 타일 · 벽 무늬(게임에 이미 있는 것 중에서 고른다)
// ─────────────────────────────────────────────────────────────────────────────
/** 벽 무늬 후보 — 모든 맵의 수직면 텍스처 가운데 '벽' 그림(난간·기둥·계단 단 제외) */
let wallPalette: IsoTex[] | null = null
export function wallTextures(): IsoTex[] {
  if (wallPalette) return wallPalette
  const seen = new Map<string, IsoTex>()
  for (const m of Object.values(MAP_TABLE)) {
    const om = ORIGINAL.get(m.id) ?? m
    for (const g of om.structures ?? [])
      for (const p of g.parts)
        if (p.kind === 'face' && p.tex && /wall/i.test(p.tex.src) && !seen.has(p.tex.src)) seen.set(p.tex.src, { src: p.tex.src, w: p.tex.w, h: p.tex.h, scale: p.tex.scale })
  }
  wallPalette = [...seen.values()]
  return wallPalette
}
