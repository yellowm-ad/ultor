'use client'

// ============================================================================
// 전체 지도 — 미니맵을 눌러 여는 확대판. 현재 맵 구조(구역+포탈+내 위치)를 크게 보여주고,
// 좌측 목록에서 다른 지역을 골라 그 맵의 구역 배치도 미리 볼 수 있다(이동 없이 조회만).
// ============================================================================
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS } from '@/lib/maps'
import type { MapId } from '@/lib/types'
import { Modal } from '@/components/ui/modal'

const MAP_GROUPS: { label: string; ids: MapId[] }[] = [
  { label: '마법학교 마을', ids: ['village'] },
  { label: '에르디아 숲', ids: ['forest', 'cave', 'mine', 'swamp'] },
  { label: '바다', ids: ['sea', 'deepsea', 'atlantis', 'atlantis-temple'] },
  { label: '스톰헤이븐', ids: ['stormhaven', 'sky-temple', 'sky-sanctum'] },
  { label: '버려진 폐허', ids: ['ruins', 'graveyard', 'temple-ruin', 'ruin-sanctum'] },
  { label: '루미나 설원', ids: ['snowfield', 'aurora-village', 'aurora-sanctum'] },
  { label: '화산지대', ids: ['volcano', 'demon-village', 'demon-temple', 'demon-castle'] },
  { label: '개인 공간', ids: ['personal-space'] },
]

const BOX = 440

export function WorldMapScreen() {
  const { state, dispatch } = useGame()
  const [viewId, setViewId] = useState<MapId>(state.currentMapId)

  if (state.screen !== 'worldmap') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const map = MAPS[viewId]
  const aspect = map.grid.w / map.grid.h
  let w = BOX
  let h = BOX / aspect
  if (h > BOX) {
    h = BOX
    w = BOX * aspect
  }
  const fx = (cx: number) => (cx / map.grid.w) * w
  const fy = (cy: number) => (cy / map.grid.h) * h
  const gateShown = new Set<string>()

  return (
    <Modal open onClose={close} title={`지도 — ${map.name}`} widthClass="max-w-4xl">
      <div className="flex gap-4">
        <div className="flex w-40 shrink-0 flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: BOX }}>
          {MAP_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="mb-1 text-[10px] font-display text-gold-soft">{g.label}</div>
              <div className="flex flex-col gap-0.5">
                {g.ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewId(id)}
                    className={`rounded-md px-2 py-1 text-left text-[11px] transition-colors ${
                      viewId === id ? 'bg-gold/20 text-gold-soft' : 'text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    {MAPS[id].name}
                    {id === state.currentMapId && <span className="ml-1 text-[9px] text-emerald-400">● 현재 위치</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="relative" style={{ width: w, height: h }}>
            {map.zones.map((z) => (
              <div
                key={z.id}
                className="absolute flex items-center justify-center overflow-hidden"
                style={{
                  left: fx(z.cell.x0),
                  top: fy(z.cell.y0),
                  width: fx(z.cell.x1) - fx(z.cell.x0),
                  height: fy(z.cell.y1) - fy(z.cell.y0),
                  background: `${z.color}55`,
                  border: `1px solid ${z.color}bb`,
                }}
              >
                <span className="px-1 text-center text-[10px] leading-tight text-white/90" style={{ textShadow: '0 1px 2px #000' }}>
                  {z.name}
                </span>
              </div>
            ))}

            {map.portals.map((p) => {
              if (p.kind === 'gate') {
                if (gateShown.has(`${p.cell.x},${p.cell.y}`)) return null
                gateShown.add(`${p.cell.x},${p.cell.y}`)
              }
              const color = p.kind === 'gate' ? '#f0c040' : p.kind === 'exit' ? '#7fd0f0' : '#e879f9'
              return (
                <div key={p.id} className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center" style={{ left: fx(p.cell.x), top: fy(p.cell.y) }}>
                  <span className="mb-0.5 whitespace-nowrap rounded bg-black/75 px-1 text-[9px]" style={{ color }}>
                    {p.label}
                  </span>
                  <div className="rounded-full border border-black/40" style={{ width: 8, height: 8, background: color }} />
                </div>
              )
            })}

            {viewId === state.currentMapId && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                style={{ left: fx(state.position.x), top: fy(state.position.y), width: 10, height: 10, background: '#fff176' }}
              />
            )}

            {map.zones.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
                (야생 지역 — 세부 구역 없이 포탈 배치만 표시됩니다)
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
