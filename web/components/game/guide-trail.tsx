'use client'

// 퀘스트 길찾기 안내선(lib/guide) — 플레이어 발밑에서 목표(또는 목표로 이어지는 포탈)까지 바닥에 노란 반짝이가 흐른다.
// IsoWorld 의 svg 안(지면 위 · 오브젝트 아래)에 그린다.
import { useMemo, useSyncExternalStore } from 'react'
import type { GameMap, GameState } from '@/lib/types'
import { isoToScreen, stairElevation, type IsoStair } from '@/lib/iso'
import { guideGoal, guidePath, guidePin, guideRoute, subscribeGuidePin } from '@/lib/guide'

const GOLD = '#ffd84a'
const PALE = '#fff6c8'

/** 지금 화면에 깔 안내 — 목표·경로(셀 좌표). 안내가 꺼져 있거나 갈 곳이 없으면 null */
export function useGuide(state: GameState, map: GameMap, on: boolean) {
  // 반 칸 단위로만 다시 계산(걷는 동안 매 프레임 계산하지 않게)
  const px = Math.round(state.position.x * 2) / 2
  const py = Math.round(state.position.y * 2) / 2
  const pin = useSyncExternalStore(subscribeGuidePin, guidePin, () => null)
  const goal = useMemo(
    () => (on ? guideGoal(state, pin) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, pin, state.weekly, state.calendar.globalWeek, state.storyFlags, state.currentMapId, state.classScene, px, py],
  )
  return useMemo(() => {
    if (!goal) return null
    let route = guideRoute(state, goal)
    // 전투 목표인데 야생에 이미 와 있으면 — 가장 가까운 몬스터 쪽으로 안내한다
    if (!route.target && goal.kind === 'battle' && map.kind === 'field' && (!goal.mapId || goal.mapId === map.id)) {
      let best: { x: number; y: number } | null = null
      let bd = Infinity
      for (const fm of state.fieldMonsters) {
        const d = Math.hypot(fm.homeCell.x - px, fm.homeCell.y - py)
        if (d < bd) {
          bd = d
          best = fm.homeCell
        }
      }
      if (best) route = { ...route, target: best, here: true }
    }
    const path = route.target ? guidePath(map, { x: px, y: py }, route.target) : []
    return { goal, route, path }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, map, px, py, state.fieldMonsters])
}

/** 네 갈래 반짝이 한 점 */
function Spark({ s }: { s: number }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-1} y={-4} width={2} height={8} fill={GOLD} />
      <rect x={-4} y={-1} width={8} height={2} fill={GOLD} />
      <rect x={-1} y={-1} width={2} height={2} fill={PALE} />
    </g>
  )
}

export function GuideTrail({ guide, stairs }: { guide: NonNullable<ReturnType<typeof useGuide>>; stairs?: IsoStair[] }) {
  // 계단·테라스 위에서는 그 높이만큼 띄운다
  const at = (x: number, y: number) => {
    const s = isoToScreen(x, y)
    return { sx: s.sx, sy: s.sy - stairElevation(stairs, x, y).z }
  }
  const { path, route, goal } = guide
  // 발밑 두 점은 캐릭터에 가려 지저분하므로 건너뛴다
  const pts = path.slice(2)
  const n = pts.length
  const line = pts.map((p) => { const s = at(p.x, p.y); return `${s.sx.toFixed(1)},${s.sy.toFixed(1)}` }).join(' ')
  const end = route.target
  const endS = end ? at(end.x, end.y) : null
  // 길 끝이 목적지에 닿았을 때만 도착 표식(멀리 있으면 안내선이 도중에 흐려진다)
  const reaches = !!end && path.length > 0 && Math.hypot(path[path.length - 1].x - end.x, path[path.length - 1].y - end.y) < 3.4
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* 바닥에 깔리는 빛줄기 — 넓고 옅은 띠 + 목표 쪽으로 흐르는 점선 */}
      {n > 1 && (
        <>
          <polyline points={line} fill="none" stroke={GOLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.16} />
          <polyline points={line} fill="none" stroke={PALE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 13" opacity={0.85} style={{ animation: 'guide-dash 0.9s linear infinite' }} />
        </>
      )}
      {pts.map((p, k) => {
        const s = at(p.x, p.y)
        // 끝으로 갈수록(목적지에 닿지 않는 긴 길) 흐려진다
        const fade = reaches ? 1 : Math.min(1, (n - k) / 10)
        const big = k % 4 === 0
        if (k % 2) return null
        return (
          <g key={k} transform={`translate(${s.sx},${s.sy})`} opacity={fade}>
            <ellipse cx={0} cy={0} rx={big ? 13 : 8} ry={big ? 6.5 : 4} fill={GOLD} opacity={0.28} />
            <g style={{ animation: `guide-flow 1.5s linear ${(-(n - k) * 0.075).toFixed(2)}s infinite`, transformBox: 'fill-box', transformOrigin: 'center' }}>
              <Spark s={big ? 1.7 : 1} />
            </g>
          </g>
        )
      })}
      {endS && reaches && !goal.npcId && (
        <g transform={`translate(${endS.sx},${endS.sy})`}>
          <ellipse cx={0} cy={0} rx={22} ry={11} fill="none" stroke={GOLD} strokeWidth={2} style={{ animation: 'guide-ring 1.6s ease-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
          <GuideArrow lift={route.portal ? 54 : 40} />
        </g>
      )}
    </g>
  )
}

/** 목표 머리 위에 뜨는 노란 화살표(통통 튄다) — 말 걸 NPC · 타야 할 포탈 */
export function GuideArrow({ lift }: { lift: number }) {
  return (
    <g transform={`translate(0,${-lift})`} style={{ pointerEvents: 'none' }}>
      <g style={{ animation: 'guide-bob 0.9s ease-in-out infinite' }}>
        <polygon points="-7,-12 7,-12 7,-4 0,4 -7,-4" fill={GOLD} stroke="#5a3d00" strokeWidth={1.5} />
        <rect x={-1.5} y={-10} width={3} height={5} fill="#5a3d00" />
        <rect x={-1.5} y={-3.5} width={3} height={2.5} fill="#5a3d00" />
      </g>
    </g>
  )
}
