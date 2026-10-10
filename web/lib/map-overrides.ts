// ============================================================================
// 관리자 오브젝트 편집 — 맵 프롭(오브젝트)을 옮기고/지우고/새로 놓은 기록.
//   · 배포본 기록: public/map-overrides.json (모든 사람에게 적용)
//   · 이 브라우저 기록: localStorage 'ultor-map-overrides' (배포본 위에 덮어씀 — 맵 단위)
//   · 적용: MAPS[id] 를 원본(ORIGINAL) 기준으로 다시 만들어 교체한다 — props 와 blockers(충돌)를 함께 갱신.
//   · 관리자 창 「파일로 저장」 → map-overrides.json 을 web/public/ 에 넣고 배포하면 모두에게 반영.
// ============================================================================

import { useSyncExternalStore } from 'react'
import type { GameMap } from '@/lib/types'
import type { PropDef } from '@/lib/iso'
import { MAPS, propBlocker } from '@/lib/maps'
import { VILLAGE_LAYOUT, villageShift } from '@/lib/village-layout'

export interface MapOverride {
  /** 원래 프롭 id → 새 발밑 셀 */
  moved?: Record<string, { x: number; y: number }>
  /** 지운 원래 프롭 id */
  removed?: string[]
  /** 새로 놓은 프롭 */
  added?: PropDef[]
}
export type MapOverrides = Record<string, MapOverride>

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
function writeLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(local))
  } catch {
    /* 저장소를 못 쓰면 이번 세션에만 적용 */
  }
}

/** 이 브라우저 기록이 있으면 그 맵은 그것을, 없으면 배포본 기록을 쓴다 */
export function effectiveOverrides(): MapOverrides {
  return { ...published, ...local }
}

const sameBox = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) =>
  Math.abs(a.x0 - b.x0) < 1e-6 && Math.abs(a.y0 - b.y0) < 1e-6 && Math.abs(a.x1 - b.x1) < 1e-6 && Math.abs(a.y1 - b.y1) < 1e-6

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
  const oldBoxes: ReturnType<typeof propBlocker>[] = []
  const props: PropDef[] = []
  for (const p of orig.props ?? []) {
    if (removed.has(p.id) || moved[p.id]) oldBoxes.push(propBlocker(p))
    if (removed.has(p.id)) continue
    props.push(moved[p.id] ? { ...p, cell: { ...moved[p.id] } } : p)
  }
  props.push(...(ov.added ?? []))
  // 충돌: 옮기거나 지운 프롭의 원래 사각형을 빼고, 새 위치·새 프롭의 사각형을 더한다
  const blockers = [...(orig.blockers ?? [])]
  for (const box of oldBoxes) {
    if (!box) continue
    const i = blockers.findIndex((b) => sameBox(b, box))
    if (i >= 0) blockers.splice(i, 1)
  }
  for (const p of props) if (moved[p.id] || (ov.added ?? []).includes(p)) {
    const box = propBlocker(p)
    if (box) blockers.push(box)
  }
  MAP_TABLE[id] = { ...orig, props, blockers }
}

function applyAll() {
  const ids = new Set([...ORIGINAL.keys(), ...Object.keys(effectiveOverrides())])
  for (const id of ids) applyMap(id)
  version++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
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

/** 이 맵의 편집 기록을 고친다(배포본 기록을 바탕으로 복사해서 시작) */
function edit(mapId: string, fn: (o: Required<MapOverride>) => void) {
  const base = local[mapId] ?? published[mapId] ?? {}
  const o: Required<MapOverride> = {
    moved: { ...(base.moved ?? {}) },
    removed: [...(base.removed ?? [])],
    added: (base.added ?? []).map((p) => ({ ...p, cell: { ...p.cell } })),
  }
  fn(o)
  local = { ...local, [mapId]: o }
  writeLocal()
  applyAll()
}

const isAdded = (mapId: string, propId: string) => propId.startsWith('adm-') && !!MAP_TABLE[mapId]?.props?.some((p) => p.id === propId)

export function moveProp(mapId: string, propId: string, cell: { x: number; y: number }) {
  const c = { x: Math.round(cell.x * 4) / 4, y: Math.round(cell.y * 4) / 4 }
  edit(mapId, (o) => {
    const added = o.added.find((p) => p.id === propId)
    if (added) added.cell = c
    else o.moved[propId] = c
  })
}

export function removeProp(mapId: string, propId: string) {
  edit(mapId, (o) => {
    if (isAdded(mapId, propId)) o.added = o.added.filter((p) => p.id !== propId)
    else {
      delete o.moved[propId]
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

/** 이 맵의 이 브라우저 기록을 지운다(배포본 기록으로 되돌림) */
export function resetLocalMap(mapId: string) {
  const { [mapId]: _drop, ...rest } = local
  void _drop
  local = rest
  writeLocal()
  applyAll()
}

/** 이 맵을 원래 게임 상태로(배포본 기록도 무시하고 빈 기록으로 덮음) */
export function resetMapToOriginal(mapId: string) {
  local = { ...local, [mapId]: { moved: {}, removed: [], added: [] } }
  writeLocal()
  applyAll()
}

/** 배포용 파일 내용 — 배포본 + 이 브라우저 기록을 합친 것(빈 맵은 뺀다) */
export function exportMapOverrides(): string {
  const all = effectiveOverrides()
  const clean: MapOverrides = {}
  for (const [id, o] of Object.entries(all)) {
    if (Object.keys(o.moved ?? {}).length || (o.removed ?? []).length || (o.added ?? []).length) clean[id] = o
  }
  return JSON.stringify(clean, null, 2)
}

export function importMapOverrides(text: string) {
  const j = JSON.parse(text) as MapOverrides
  local = { ...local, ...j }
  writeLocal()
  applyAll()
}

/** 이 맵에서 이 브라우저로 바꾼 것 수(표시용) */
export function localChangeCount(mapId: string): number {
  const o = local[mapId]
  return o ? Object.keys(o.moved ?? {}).length + (o.removed ?? []).length + (o.added ?? []).length : 0
}
