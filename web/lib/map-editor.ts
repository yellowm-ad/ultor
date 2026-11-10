// 관리자 오브젝트 편집 모드 상태 — 켜짐 여부 · 도구(오브젝트/바닥/벽) · 선택 · 놓으려는 카탈로그 항목 · 붓.
// iso-world(맵 조작)와 admin-panel(버튼) 이 같이 쓴다.
//
// 드래그 상태(editor drag)는 따로 둔다 — 포인터가 움직일 때마다 바뀌므로, 그걸 듣는 작은 오버레이만 다시 그리고
// 맵 전체(iso-world)는 드래그 시작·끝에만 다시 그린다(2026-11-03 최적화).
import { useSyncExternalStore } from 'react'
import type { PropCatalogItem } from '@/lib/prop-catalog'
import { ISO_TILE_W, type IsoTex, type TileKind } from '@/lib/iso'
import { addProp } from '@/lib/map-overrides'

export type EditorTool = 'object' | 'floor' | 'wall'

export interface MapEditorState {
  on: boolean
  tool: EditorTool
  selected: string | null
  placing: PropCatalogItem | null
  /** 새로 놓는 오브젝트를 길막(충돌)으로 할지 */
  solid: boolean
  /** 바닥 붓 — 칠할 타일(null = 원래 바닥으로 되돌리기) */
  tile: TileKind | null
  /** 붓 크기(칸) */
  brush: 1 | 2 | 3
  /** 벽 도구 — 고른 면(`그룹id#면번호`)과 그 면의 원래 무늬 */
  wall: { key: string; src: string } | null
  /** 벽 도구 — 같은 무늬 면을 한꺼번에 바꿀지 */
  wallAll: boolean
  /** 벽에 칠할 무늬 */
  wallTex: IsoTex | null
  /** 길막(충돌 사각형)을 맵 위에 보여 줄지 */
  showBlockers: boolean
  /** 고른 '주인 없는' 길막(벽·지형 상자) — lib/map-overrides blockKey */
  block: string | null
}

let st: MapEditorState = { on: false, tool: 'object', selected: null, placing: null, solid: true, tile: null, brush: 1, wall: null, wallAll: false, wallTex: null, showBlockers: false, block: null }
const subs = new Set<() => void>()

export function setMapEditor(patch: Partial<MapEditorState>) {
  st = { ...st, ...patch }
  subs.forEach((f) => f())
}
export const getMapEditor = () => st

export function useMapEditor(): MapEditorState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => st,
    () => st,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 드래그(끌어서 옮기기 · 끌어다 놓기 · 바닥 칠하기) — 포인터 위치를 셀 좌표로 바꿔 들고 있는다.
// ─────────────────────────────────────────────────────────────────────────────
export type DragKind = 'prop' | 'furn' | 'new-prop' | 'new-furn' | 'paint' | 'hover'
export interface EditorDrag {
  kind: DragKind
  /** 옮기는 대상 id(prop/furn) · 새로 놓는 가구 defId(new-furn) */
  id: string | null
  /** 지금 놓일 자리(발밑 셀, 1/4칸 맞춤) — 맵 밖이면 null */
  cell: { x: number; y: number } | null
  /** 잡은 자리와 발밑의 차이(잡은 곳이 그대로 따라오게) */
  grab: { x: number; y: number }
  /** 움직였는가(아니면 클릭으로 본다) */
  moved: boolean
  /** 바닥 칠하기 — 지나간 칸 'x,y' */
  cells?: Set<string>
}

let drag: EditorDrag | null = null
const dragSubs = new Set<() => void>()
const emitDrag = () => dragSubs.forEach((f) => f())
export const getDrag = () => drag
export function setDrag(d: EditorDrag | null) {
  drag = d
  emitDrag()
}
const subDrag = (cb: () => void) => {
  dragSubs.add(cb)
  return () => dragSubs.delete(cb)
}
/** 오버레이용 — 포인터가 움직일 때마다 바뀐다 */
export function useEditorDrag(): EditorDrag | null {
  return useSyncExternalStore(subDrag, () => drag, () => null)
}
/** 맵용 — 무엇을 끌고 있는지(id)만. 끌기 시작·끝에만 바뀐다 */
export function useDraggingId(): string | null {
  return useSyncExternalStore(
    subDrag,
    () => (drag && (drag.kind === 'prop' || drag.kind === 'furn') && drag.moved ? drag.id : null),
    () => null,
  )
}

/** 화면 좌표 → 셀 좌표(아이소 월드 svg 의 CTM 사용). 월드 svg 위가 아니면 null */
export function clientToCell(clientX: number, clientY: number, svg?: SVGSVGElement | null): { x: number; y: number } | null {
  const el = svg ?? worldSvgAt(clientX, clientY)
  const ctm = el?.getScreenCTM()
  if (!el || !ctm) return null
  const pt = el.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const loc = pt.matrixTransform(ctm.inverse())
  // isoToScreen 역변환: sx = 32(x−y), sy = 16(x+y)
  return { x: (loc.y / 16 + loc.x / 32) / 2, y: (loc.y / 16 - loc.x / 32) / 2 }
}
/** 그 화면 자리에 아이소 월드가 있으면 그 svg(다른 창·패널에 가려져 있으면 null) */
export function worldSvgAt(clientX: number, clientY: number): SVGSVGElement | null {
  if (typeof document === 'undefined') return null
  const hit = document.elementFromPoint(clientX, clientY)
  return (hit?.closest('svg[data-iso-world]') as SVGSVGElement | null) ?? null
}
export const snap4 = (v: number) => Math.round(v * 4) / 4

/**
 * 끌기 시작 — 창 전체의 pointermove/pointerup 을 듣고, 끝나면 onEnd(마지막 상태)를 부른다.
 * svg 를 주면 그 svg 기준(맵 안에서 시작한 끌기), 안 주면 놓는 순간 포인터 아래 월드 svg 를 찾는다(패널에서 끌어오기).
 */
export function beginDrag(
  e: { clientX: number; clientY: number; pointerId?: number },
  init: Omit<EditorDrag, 'cell' | 'moved'>,
  opt: { svg?: SVGSVGElement | null; onMove?: (d: EditorDrag) => void; onEnd: (d: EditorDrag) => void },
) {
  const sx = e.clientX
  const sy = e.clientY
  const at = (cx: number, cy: number) => {
    const c = clientToCell(cx, cy, opt.svg ?? worldSvgAt(cx, cy))
    return c ? { x: snap4(c.x - init.grab.x), y: snap4(c.y - init.grab.y) } : null
  }
  setDrag({ ...init, cell: opt.svg ? at(sx, sy) : null, moved: false })
  let raf = 0
  let last = { x: sx, y: sy }
  const flush = () => {
    raf = 0
    const d = getDrag()
    if (!d) return
    const cell = at(last.x, last.y)
    const moved = d.moved || Math.hypot(last.x - sx, last.y - sy) > 5
    const same = cell && d.cell && cell.x === d.cell.x && cell.y === d.cell.y
    if (same && moved === d.moved) return
    const next = { ...d, cell, moved }
    opt.onMove?.(next)
    setDrag(next)
  }
  const move = (ev: PointerEvent) => {
    last = { x: ev.clientX, y: ev.clientY }
    // 포인터 이벤트는 프레임보다 자주 온다 — 한 프레임에 한 번만 처리
    if (!raf) raf = requestAnimationFrame(flush)
  }
  const end = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    if (raf) cancelAnimationFrame(raf)
    last = { x: ev.clientX, y: ev.clientY }
    flush()
    const d = getDrag()
    setDrag(null)
    if (d && ev.type === 'pointerup') opt.onEnd(d)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}

/** 카탈로그 오브젝트를 맵에 새로 놓는다 — 발밑 크기는 그림 폭에서 어림(새 오브젝트는 중심 기준) */
export function placeCatalogItem(mapId: string, it: PropCatalogItem, cell: { x: number; y: number }, solid: boolean): string {
  const fp = Math.max(0.5, Math.round((it.w / ISO_TILE_W) * 0.8 * 2) / 2)
  return addProp(mapId, {
    kind: solid ? 'statue' : 'bicycle',
    cell,
    sprite: it.src,
    px: { w: it.w, h: it.h },
    radial: true,
    size: { w: fp, d: fp },
    solid,
    label: undefined,
  })
}

/** 바닥 붓이 덮는 칸들('x,y') */
export function brushCells(cell: { x: number; y: number }, n: number): string[] {
  const x0 = Math.floor(cell.x - (n - 1) / 2)
  const y0 = Math.floor(cell.y - (n - 1) / 2)
  const out: string[] = []
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push(`${x0 + dx},${y0 + dy}`)
  return out
}
