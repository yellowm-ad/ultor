'use client'

// ============================================================================
// 편집 오버레이(2026-11-03) — 아이소 월드 svg 맨 위에 그린다.
//   · AdminEditOverlay : 관리자 오브젝트 편집 — 선택 표시 · 끌기 미리보기(초록=빈 자리/빨강=길막과 겹침) ·
//                        새 오브젝트 미리보기 · 바닥 붓 · 벽면 고르기 · 길막 보기 · 단축키(R 회전, Del 제거, Esc, Ctrl+Z)
//   · HousingOverlay   : 내 방 가구 배치 — 끌기 미리보기(놓을 수 있으면 초록, 아니면 빨강 + 이유) · 단축키(R/Del/Esc)
// 포인터가 움직일 때마다 바뀌는 건 이 오버레이뿐 — 맵 전체는 끌기 시작·끝에만 다시 그린다.
// ============================================================================

import { useEffect, type Dispatch } from 'react'
import type { Action } from '@/lib/game-state'
import type { GameMap, GameState } from '@/lib/types'
import { ISO_TILE_H, isoToScreen, propAABB, TILE_COLORS, type PropDef } from '@/lib/iso'
import { propBlocker } from '@/lib/maps'
import { brushCells, getMapEditor, setMapEditor, useEditorDrag, type MapEditorState } from '@/lib/map-editor'
import { flipProp, removeProp, undoMapEdit, wallKey } from '@/lib/map-overrides'
import { FURNITURE_BY_ID, furnitureFitReason, furnitureHalf } from '@/lib/housing'
import { RasterProp } from '@/components/game/raster-prop'

type Box = { x0: number; y0: number; x1: number; y1: number }
const HW = 32

/** 셀 사각형 → 화면 마름모 */
function boxPoints(b: Box): string {
  const a = isoToScreen(b.x0, b.y0)
  const c = isoToScreen(b.x1, b.y0)
  const d = isoToScreen(b.x1, b.y1)
  const e = isoToScreen(b.x0, b.y1)
  return `${a.sx},${a.sy} ${c.sx},${c.sy} ${d.sx},${d.sy} ${e.sx},${e.sy}`
}
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 - 0.02 && a.x1 > b.x0 + 0.02 && a.y0 < b.y1 - 0.02 && a.y1 > b.y0 + 0.02

function Ghost({ p, ok, box }: { p: PropDef; ok: boolean; box: Box | null }) {
  const s = isoToScreen(p.cell.x, p.cell.y)
  const col = ok ? '#7dff9a' : '#ff6b6b'
  return (
    <g pointerEvents="none">
      {box && <polygon points={boxPoints(box)} fill={ok ? 'rgba(125,255,154,0.22)' : 'rgba(255,107,107,0.28)'} stroke={col} strokeWidth={2} />}
      <g transform={`translate(${s.sx},${s.sy - (p.elev ?? 0)})`} opacity={0.78}>
        <RasterProp p={p} />
      </g>
    </g>
  )
}

const editingTarget = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)
}

// ─────────────────────────────────────────────────────────────────────────────
// 관리자 오브젝트 편집
// ─────────────────────────────────────────────────────────────────────────────
export function AdminEditOverlay({ map, editor }: { map: GameMap; editor: MapEditorState }) {
  const drag = useEditorDrag()

  // 단축키 — R 회전 · Delete 제거 · Esc 선택 해제 · Ctrl+Z 되돌리기
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (editingTarget(e)) return
      const ed = getMapEditor()
      if (!ed.on) return
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault()
        undoMapEdit(map.id)
        return
      }
      if (e.code === 'Escape') setMapEditor({ selected: null, placing: null, wall: null })
      if (!ed.selected || ed.tool !== 'object') return
      if (e.code === 'KeyR' && !e.repeat) flipProp(map.id, ed.selected)
      if (e.code === 'Delete' || e.code === 'Backspace') {
        removeProp(map.id, ed.selected)
        setMapEditor({ selected: null })
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [map.id])

  const sel = editor.tool === 'object' && editor.selected ? map.props?.find((p) => p.id === editor.selected) : undefined
  const selBox = sel ? propBlocker(sel) : null

  // 끌기·새로 놓기 미리보기
  let ghost: React.ReactNode = null
  if (editor.tool === 'object' && drag?.cell) {
    const others = (box: Box | null, selfBox: Box | null) =>
      !box || !(map.blockers ?? []).some((b) => !(selfBox && Math.abs(b.x0 - selfBox.x0) < 1e-6 && Math.abs(b.y0 - selfBox.y0) < 1e-6 && Math.abs(b.x1 - selfBox.x1) < 1e-6 && Math.abs(b.y1 - selfBox.y1) < 1e-6) && overlaps(box, b))
    if (drag.kind === 'prop' && drag.moved) {
      const p = map.props?.find((q) => q.id === drag.id)
      if (p) {
        const moved = { ...p, cell: drag.cell }
        const box = propBlocker(moved) ?? (p.size ? propAABB(moved) : null)
        ghost = <Ghost p={moved} ok={others(propBlocker(moved), propBlocker(p))} box={box} />
      }
    } else if ((drag.kind === 'new-prop' || drag.kind === 'hover') && editor.placing) {
      const it = editor.placing
      const fp = Math.max(0.5, Math.round((it.w / 64) * 0.8 * 2) / 2)
      const p: PropDef = { id: '__ghost', kind: editor.solid ? 'statue' : 'bicycle', cell: drag.cell, sprite: it.src, px: { w: it.w, h: it.h }, radial: true, size: { w: fp, d: fp }, solid: editor.solid }
      ghost = <Ghost p={p} ok={others(propBlocker(p), null)} box={propAABB(p)} />
    }
  }

  // 바닥 붓 — 칠한 칸 + 붓 테두리
  let paint: React.ReactNode = null
  if (editor.tool === 'floor') {
    const col = editor.tile ? TILE_COLORS[editor.tile]?.top ?? '#fff' : 'transparent'
    const cells = drag?.kind === 'paint' && drag.cells ? [...drag.cells] : []
    const hover = drag?.cell ? brushCells(drag.cell, editor.brush) : []
    paint = (
      <g pointerEvents="none">
        {cells.map((k) => {
          const [x, y] = k.split(',').map(Number)
          return <polygon key={k} points={boxPoints({ x0: x, y0: y, x1: x + 1, y1: y + 1 })} fill={col} opacity={0.75} />
        })}
        {hover.map((k) => {
          const [x, y] = k.split(',').map(Number)
          return <polygon key={`h${k}`} points={boxPoints({ x0: x, y0: y, x1: x + 1, y1: y + 1 })} fill="none" stroke={editor.tile ? '#ffd75a' : '#9ad7ff'} strokeWidth={1.5} strokeDasharray={editor.tile ? undefined : '4 3'} />
        })}
      </g>
    )
  }

  return (
    <g>
      {editor.showBlockers && (
        <g pointerEvents="none">
          {(map.blockers ?? []).map((b, i) => (
            <polygon key={i} points={boxPoints(b)} fill="rgba(255,80,80,0.16)" stroke="rgba(255,120,120,0.7)" strokeWidth={1} />
          ))}
        </g>
      )}
      {sel && !(drag?.kind === 'prop' && drag.moved) && (
        <g pointerEvents="none">
          {selBox && <polygon points={boxPoints(selBox)} fill="rgba(255,215,90,0.14)" stroke="#ffd75a" strokeWidth={2} strokeDasharray="5 3" />}
          {(() => {
            const s = isoToScreen(sel.cell.x, sel.cell.y)
            return (
              <g transform={`translate(${s.sx},${s.sy - (sel.elev ?? 0)})`}>
                {!selBox && <ellipse cx={0} cy={0} rx={26} ry={12} fill="rgba(255,215,90,0.18)" stroke="#ffd75a" strokeWidth={2} strokeDasharray="5 3" />}
                <text x={0} y={22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffd75a" stroke="#000" strokeWidth={3} paintOrder="stroke">
                  {sel.id} · R 회전 · Del 제거
                </text>
              </g>
            )
          })()}
        </g>
      )}
      {ghost}
      {paint}
      {editor.tool === 'wall' && <WallPicker map={map} editor={editor} />}
    </g>
  )
}

/** 벽 도구 — 무늬 있는 수직면마다 누를 수 있는 판을 덮는다(고른 면은 금색 테두리) */
function WallPicker({ map, editor }: { map: GameMap; editor: MapEditorState }) {
  const nodes: React.ReactNode[] = []
  for (const g of map.structures ?? []) {
    g.parts.forEach((part, i) => {
      if (part.kind !== 'face' || !part.tex || part.img) return
      const len = (part.to - part.from) * HW
      const hgt = part.z1 - part.z0
      if (len <= 0 || hgt <= 0) return
      const o = part.plane === 'y' ? isoToScreen(part.from, part.at) : isoToScreen(part.at, part.to)
      const m = part.plane === 'y' ? `matrix(1,0.5,0,1,${o.sx},${o.sy - part.z1})` : `matrix(1,-0.5,0,1,${o.sx},${o.sy - part.z1})`
      const key = wallKey(g.id, i)
      const picked = editor.wall && (editor.wall.key === key || (editor.wallAll && editor.wall.src === part.tex.src))
      nodes.push(
        <g key={key} transform={m}>
          <rect
            width={len}
            height={hgt}
            fill={picked ? 'rgba(255,215,90,0.22)' : 'rgba(255,255,255,0.001)'}
            stroke={picked ? '#ffd75a' : 'rgba(255,255,255,0.18)'}
            strokeWidth={picked ? 2 : 1}
            strokeDasharray={picked ? undefined : '3 4'}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              setMapEditor({ wall: { key, src: part.tex!.src } })
            }}
          />
        </g>,
      )
    })
  }
  return <g>{nodes}</g>
}

// ─────────────────────────────────────────────────────────────────────────────
// 내 방 가구 배치
// ─────────────────────────────────────────────────────────────────────────────
export function HousingOverlay({ state, dispatch, map, bodyR }: { state: GameState; dispatch: Dispatch<Action>; map: GameMap; bodyR: number }) {
  const drag = useEditorDrag()
  const sel = state.housing.selectedId

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (editingTarget(e) || !sel) return
      if (e.code === 'KeyR' && !e.repeat) dispatch({ type: 'HOUSING_FLIP' })
      if (e.code === 'Delete' || e.code === 'Backspace') dispatch({ type: 'HOUSING_REMOVE', id: sel })
      if (e.code === 'Escape') dispatch({ type: 'HOUSING_SELECT', id: null })
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [sel, dispatch])

  if (!drag?.cell || !drag.moved || (drag.kind !== 'furn' && drag.kind !== 'new-furn')) return null
  const me = drag.kind === 'furn' ? state.housing.placed.find((p) => p.id === drag.id) : null
  const def = FURNITURE_BY_ID[me ? me.defId : (drag.id ?? '')]
  if (!def) return null
  const flip = me?.flip
  const why = furnitureFitReason({
    def,
    cell: drag.cell,
    flip,
    grid: map.grid,
    walls: map.blockers,
    others: state.housing.placed.filter((p) => p.id !== me?.id),
    player: state.position,
    bodyR,
  })
  const { hw, hd } = furnitureHalf(def, flip)
  const { w, h, fw, fd } = def.sprite
  const p: PropDef = {
    id: '__ghost',
    kind: 'cottage',
    cell: drag.cell,
    sprite: def.sprite.s,
    px: { w, h },
    anchor: def.iso ? { x: w / 2, y: h - 8 * (fw + fd) } : undefined,
    facing: !!def.flip !== !!flip ? 'left' : undefined,
  }
  const s = isoToScreen(drag.cell.x, drag.cell.y)
  return (
    <g pointerEvents="none">
      <Ghost p={p} ok={!why} box={{ x0: drag.cell.x - hw, y0: drag.cell.y - hd, x1: drag.cell.x + hw, y1: drag.cell.y + hd }} />
      {why && (
        <text x={s.sx} y={s.sy + ISO_TILE_H + 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffb3b3" stroke="#000" strokeWidth={3} paintOrder="stroke">
          {why}
        </text>
      )}
    </g>
  )
}
