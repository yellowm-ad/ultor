'use client'

import { guideGoal, guidePin, guideRoute, subscribeGuidePin } from '@/lib/guide'
import { useMemo, useSyncExternalStore } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS } from '@/lib/maps'
import { MONSTERS } from '@/lib/mock-data'
import { DiamondMark } from '@/components/game/ui-motifs'
import { mapThumbUrl } from '@/components/game/map-thumb'

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
  // 지금 따라가는 목표가 이 맵에서 가리키는 곳
  const pin = useSyncExternalStore(subscribeGuidePin, guidePin, () => null)
  const target = useMemo(() => {
    const goal = guideGoal(state, pin)
    return goal ? guideRoute(state, goal).target : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, state.weekly, state.calendar.globalWeek, state.storyFlags, state.currentMapId, state.classScene])
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
      if (p.secret) return null
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
  // 야생맵은 구역이 없어 비어 보였다 — 지형 썸네일(길·물·용암)을 바탕에 깐다
  const thumb = map.zones.length === 0 ? mapThumbUrl(map) : null

  // 원형 미니맵 테두리에 마커가 반쯤 가려지지 않도록 안쪽으로 살짝 여백을 둔다(지도 끝 근처를 걸을 때 대비).
  const MARK_PAD = 6
  const fx = (cx: number) => Math.min(w - MARK_PAD, Math.max(MARK_PAD, (cx / map.grid.w) * w))
  const fy = (cy: number) => Math.min(h - MARK_PAD, Math.max(MARK_PAD, (cy / map.grid.h) * h))

  return (
    <div className="minimap-safe title-enter-2 pointer-events-none absolute right-3 top-24 z-30 flex flex-col items-center gap-1 sm:right-4 sm:top-32">
      <div className="hud-map-label flex items-center gap-1 text-[11px]">
        <DiamondMark size={8} />
        {map.name}
      </div>
      <div
        className="hud-map-label pointer-events-auto text-[9px] opacity-70"
        style={{ cursor: 'pointer' }}
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'worldmap' })}
      >
        전체 지도 · 텔레포트
      </div>
      <div
        className="relative shrink-0 cursor-pointer overflow-hidden rounded-full border border-gold/70 bg-[#100c08] shadow-[0_0_0_2px_rgba(0,0,0,0.5),0_6px_18px_rgba(0,0,0,0.5),0_0_14px_rgba(240,217,153,0.25)] pointer-events-auto"
        style={{ width: diameter, height: diameter }}
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'worldmap' })}
      >
        <div
          className="absolute overflow-hidden"
          style={{ width: w, height: h, left: (diameter - w) / 2, top: (diameter - h) / 2, background: thumb ? `url(${thumb}) 0 0 / 100% 100%` : undefined, imageRendering: 'pixelated' }}
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

          {/* 길찾기 목표(lib/guide) — 이 맵에서 가야 할 곳에 깜빡이는 노란 마름모 */}
          {target && (
            <div
              className="absolute"
              style={{ left: fx(target.x) - 4, top: fy(target.y) - 4, width: 8, height: 8, transform: 'rotate(45deg)', background: '#ffd84a', boxShadow: '0 0 6px 2px rgba(255,216,74,0.8)', animation: 'portal-pulse 1.2s ease-in-out infinite' }}
            />
          )}

          {/* 플레이어 */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
            style={{
              left: fx(state.position.x),
              top: fy(state.position.y),
              width: 7,
              height: 7,
              background: 'var(--gold, #e8c46a)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
