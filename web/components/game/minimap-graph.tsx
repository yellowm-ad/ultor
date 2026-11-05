'use client'

// 맵 연결도(소울나이트식) — 야외 맵을 칸, 포탈 연결을 통로로 그린다. 미니맵(작게, 현재 칸 중심)과 전체 지도(크게, 전체 맞춤)가 함께 쓴다.
//   · 칸 색 = 지역 색 · 지금 위치 = 금테 + 주인공 얼굴 · ⌂ 마을 · ☠ 보스 맵 · ! 길 안내 목표 · ◆ 가 본 곳 · ? 아직 안 가 본 곳
// 배치는 lib/map-graph GRAPH_POS, 연결은 lib/maps 포탈. 실내에 있으면 그 실내가 속한 야외 칸을 현재 위치로 본다(graphAnchor).

import { useMemo } from 'react'
import type { GameState, MapId } from '@/lib/types'
import { MAPS } from '@/lib/maps'
import { regionOfMap } from '@/lib/regions'
import { GRAPH_POS, REGION_COLOR } from '@/lib/map-graph'
import { HeroSprite } from '@/components/game/pixel-hero'
import { heroSheet } from '@/lib/costumes'

type Edge = { a: MapId; b: MapId }

function useGraph() {
  return useMemo(() => {
    const ids = Object.keys(GRAPH_POS) as MapId[]
    const edges: Edge[] = []
    const seen = new Set<string>()
    for (const a of ids) {
      for (const p of MAPS[a]?.portals ?? []) {
        const b = p.to as MapId
        if (!GRAPH_POS[b] || a === b) continue
        const k = [a, b].sort().join('|')
        if (seen.has(k)) continue
        seen.add(k)
        edges.push({ a, b })
      }
    }
    return { ids, edges }
  }, [])
}

/** 통로 경로 — 마을에서 나가는 길은 마을 위아래로 한 번 꺾어 각 갈래로(참고 이미지의 꺾인 통로) */
function edgePath(a: MapId, b: MapId, U: number): string {
  const A = GRAPH_POS[a]!
  const B = GRAPH_POS[b]!
  const hub = a === 'village' ? A : b === 'village' ? B : null
  if (hub) {
    const o = hub === A ? B : A
    const mid = Math.sign(o.y) * 0.75
    return `M${hub.x * U},${hub.y * U} L${hub.x * U},${mid * U} L${o.x * U},${mid * U} L${o.x * U},${o.y * U}`
  }
  return `M${A.x * U},${A.y * U} L${B.x * U},${B.y * U}`
}

export interface MapGraphProps {
  state: GameState
  /** 지금 위치(야외 칸) */
  focus: MapId
  guideMap: MapId | null
  width: number
  height: number
  /** 칸 간격 · 칸 크기(px) */
  unit: number
  node: number
  /** 'focus' = 현재 칸을 가운데 · 'fit' = 전체를 가운데 */
  center?: 'focus' | 'fit'
  /** 칸 이름표 */
  labels?: boolean
  selected?: MapId | null
  onPick?: (id: MapId) => void
}

export function MapGraph({ state, focus, guideMap, width, height, unit: U, node: NODE, center = 'focus', labels, selected, onPick }: MapGraphProps) {
  const { ids, edges } = useGraph()
  const at = GRAPH_POS[focus] ?? { x: 0, y: 0 }
  const visited = new Set(state.visitedMaps ?? [])
  visited.add('village')
  const tx = width / 2 - (center === 'focus' ? at.x : 0) * U
  const ty = height / 2 - (center === 'focus' ? at.y : 0) * U
  const colorOf = (id: MapId) => REGION_COLOR[regionOfMap(id)] ?? '#c8b88a'
  const face = Math.round(NODE * 1.7)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <g style={{ transform: `translate(${tx}px, ${ty}px)`, transition: 'transform 0.45s ease-out' }}>
        {/* 통로 — 바깥 어두운 테 + 지역 색 */}
        {edges.map(({ a, b }) => {
          const d = edgePath(a, b, U)
          const c = colorOf(a === 'village' ? b : a)
          const dim = !visited.has(a) && !visited.has(b)
          return (
            <g key={`${a}-${b}`} opacity={dim ? 0.35 : 1}>
              <path d={d} fill="none" stroke="#000" strokeWidth={NODE * 0.42} strokeLinejoin="miter" />
              <path d={d} fill="none" stroke={c} strokeWidth={NODE * 0.2} strokeLinejoin="miter" />
            </g>
          )
        })}
        {/* 칸 */}
        {ids.map((id) => {
          const p = GRAPH_POS[id]!
          const m = MAPS[id]
          const c = colorOf(id)
          const here = id === focus
          const known = visited.has(id)
          const town = m?.kind === 'town'
          const boss = !!m?.bossSpawns?.length
          const goal = guideMap === id && !here
          const picked = selected === id
          const size = here ? NODE * 1.4 : town ? NODE * 1.15 : NODE
          const cx = p.x * U
          const cy = p.y * U
          const x = cx - size / 2
          const y = cy - size / 2
          return (
            <g key={id} opacity={known || here ? 1 : 0.6} style={{ cursor: onPick ? 'pointer' : undefined }} onClick={onPick ? (e) => (e.stopPropagation(), onPick(id)) : undefined}>
              <rect x={x - 2} y={y - 2} width={size + 4} height={size + 4} fill="#000" />
              <rect x={x} y={y} width={size} height={size} fill={known ? `${c}55` : '#2a241c'} stroke={here || picked ? '#ffd84a' : c} strokeWidth={here || picked ? 2.5 : 1.5} />
              {!here && (
                <text x={cx} y={cy + NODE * 0.3} textAnchor="middle" fontSize={NODE * (town ? 0.75 : 0.62)} fontWeight={800} fill={goal ? '#ffd84a' : known ? '#fff6dc' : '#8a7c62'} style={{ pointerEvents: 'none' }}>
                  {goal ? '!' : !known ? '?' : town ? '⌂' : boss ? '☠' : '◆'}
                </text>
              )}
              {(goal || picked) && (
                <rect x={x - 4} y={y - 4} width={size + 8} height={size + 8} fill="none" stroke="#ffd84a" strokeWidth={1.5} style={picked ? undefined : { animation: 'portal-pulse 1.2s ease-in-out infinite' }} />
              )}
              {labels && (
                <text x={cx} y={cy + size / 2 + 13} textAnchor="middle" fontSize={10} fontWeight={700} fill={known ? '#f3e6c4' : '#7a6e58'} stroke="#000" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                  {known ? m?.name : '???'}
                </text>
              )}
            </g>
          )
        })}
        {/* 지금 위치 — 주인공 얼굴 */}
        <foreignObject x={at.x * U - face / 2} y={at.y * U - face * 0.78} width={face} height={face} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <div style={{ width: face, height: face, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
            <HeroSprite sheet={heroSheet(state)} dir="down" px={Math.round(face * 1.45)} />
          </div>
        </foreignObject>
      </g>
    </svg>
  )
}

/** 미니맵 — 현재 칸 중심, 누르면 전체 지도 */
export function MinimapGraph({ state, focus, guideMap, onOpen }: { state: GameState; focus: MapId; guideMap: MapId | null; onOpen: () => void }) {
  return (
    <div
      className="relative shrink-0 cursor-pointer overflow-hidden rounded-[6px] border-2 border-[#c79a3e]/80 bg-[#0d0a08]/90 shadow-[0_0_0_2px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.5)] pointer-events-auto"
      style={{ width: 196, height: 196 }}
      onClick={onOpen}
      title="전체 지도 · 텔레포트"
    >
      <MapGraph state={state} focus={focus} guideMap={guideMap} width={196} height={196} unit={21} node={13} />
    </div>
  )
}
