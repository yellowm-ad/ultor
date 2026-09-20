'use client'

import { useMemo } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS } from '@/lib/maps'
import { ELEMENT_META } from '@/lib/constants'
import { MONSTERS } from '@/lib/mock-data'
import { DiamondMark } from '@/components/game/ui-motifs'

const MAX = 148

export function Minimap() {
  const { state, dispatch } = useGame()

  const nearMonsters = useMemo(
    () =>
      state.fieldMonsters.filter((fm) => {
        const d = Math.hypot(fm.homeCell.x - state.position.x, fm.homeCell.y - state.position.y)
        return d < 9
      }),
    [state.fieldMonsters, state.position.x, state.position.y],
  )

  const map = MAPS[state.currentMapId]
  const aspect = map.grid.w / map.grid.h
  let w = MAX
  let h = MAX / aspect
  if (h > MAX) {
    h = MAX
    w = MAX * aspect
  }
  const diameter = Math.max(w, h) + 8

  // 구역 블록 + 포탈 — 맵이 바뀔 때만 다시 계산(이동 중 매 프레임 재생성 방지)
  const staticMarks = useMemo(() => {
    const fx = (cx: number) => (cx / map.grid.w) * w
    const fy = (cy: number) => (cy / map.grid.h) * h
    const gateShown = new Set<string>()
    const zones = map.zones.map((z) => (
      <div
        key={z.id}
        className="absolute"
        style={{
          left: fx(z.cell.x0),
          top: fy(z.cell.y0),
          width: fx(z.cell.x1) - fx(z.cell.x0),
          height: fy(z.cell.y1) - fy(z.cell.y0),
          background: `${z.color}44`,
          border: `1px solid ${z.color}aa`,
        }}
      />
    ))
    const portals = map.portals.map((p) => {
      if (p.kind === 'gate') {
        if (gateShown.has(`${p.cell.x},${p.cell.y}`)) return null
        gateShown.add(`${p.cell.x},${p.cell.y}`)
      }
      const color = p.kind === 'gate' ? '#f0c040' : p.kind === 'exit' ? '#7fd0f0' : '#e879f9'
      return (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[2px]"
          style={{ left: fx(p.cell.x), top: fy(p.cell.y), width: 5, height: 5, background: color }}
        />
      )
    })
    return { zones, portals }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, w, h])

  if (state.screen !== 'world') return null

  const fx = (cx: number) => (cx / map.grid.w) * w
  const fy = (cy: number) => (cy / map.grid.h) * h
  const elem = ELEMENT_META[state.player.element]

  return (
    <div className="title-enter-2 pointer-events-none absolute right-3 top-24 z-30 flex flex-col items-center gap-1 sm:right-4 sm:top-32">
      <div className="hud-map-label flex items-center gap-1 text-[11px]">
        <DiamondMark size={8} />
        {map.name}
      </div>
      <div
        className="hud-map-label pointer-events-auto text-[9px] opacity-70"
        style={{ cursor: 'pointer' }}
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'worldmap' })}
      >
        전체 지도 보기
      </div>
      <div
        className="relative shrink-0 cursor-pointer overflow-hidden rounded-full border border-gold/70 bg-[#100c08] shadow-[0_0_0_2px_rgba(0,0,0,0.5),0_6px_18px_rgba(0,0,0,0.5),0_0_14px_rgba(240,217,153,0.25)] pointer-events-auto"
        style={{ width: diameter, height: diameter }}
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'worldmap' })}
      >
        <div
          className="absolute overflow-hidden"
          style={{ width: w, height: h, left: (diameter - w) / 2, top: (diameter - h) / 2 }}
        >
          {/* 구역 블록 */}
          {staticMarks.zones}

          {/* 포탈 */}
          {staticMarks.portals}

          {/* 몬스터 */}
          {nearMonsters.map((fm) => {
            const isTest = MONSTERS.find((m) => m.id === fm.monsterId)?.isTestMonster
            return (
              <div
                key={fm.uid}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: fx(fm.homeCell.x),
                  top: fy(fm.homeCell.y),
                  width: 3,
                  height: 3,
                  background: isTest ? '#34d399' : '#f87171',
                }}
              />
            )
          })}

          {/* 플레이어 */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
            style={{
              left: fx(state.position.x),
              top: fy(state.position.y),
              width: 7,
              height: 7,
              background: elem.color as string,
            }}
          />
        </div>
      </div>
    </div>
  )
}
