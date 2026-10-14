'use client'

// 퀘스트 길찾기 안내선(lib/guide) — 플레이어 발밑에서 목표(또는 목표로 이어지는 포탈)까지 바닥에 노란 반짝이가 흐른다.
// IsoWorld 의 svg 안(지면 위 · 오브젝트 아래)에 그린다.
import { memo, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
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

// 경로는 반 칸 움직일 때만 바뀐다(useGuide 가 같은 객체를 돌려준다) — 그 사이 프레임은 다시 그리지 않는다
export const GuideTrail = memo(function GuideTrail({ guide, stairs }: { guide: NonNullable<ReturnType<typeof useGuide>>; stairs?: IsoStair[] }) {
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
      {/* 길 위의 반짝이 점들은 GuideSparks(캔버스)가 그린다 */}
      {endS && reaches && !goal.npcId && (
        <g transform={`translate(${endS.sx},${endS.sy})`}>
          <ellipse cx={0} cy={0} rx={22} ry={11} fill="none" stroke={GOLD} strokeWidth={2} style={{ animation: 'guide-ring 1.6s ease-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
          <GuideArrow lift={route.portal ? 54 : 40} />
        </g>
      )}
    </g>
  )
})

/**
 * 길 위의 반짝이 점들 — 캔버스 한 장에 직접 그린다(모양·박자는 예전 SVG + globals.css guide-flow 와 같다).
 * SVG 안에서 점마다 CSS 애니메이션을 걸면 점마다 합성 레이어가 생기고, 그 위에 그려지는 소품들까지
 * 레이어로 쪼개져(맵마다 100~150개) 걷는 동안 프레임이 10fps 넘게 떨어졌다.
 * IsoWorld 의 월드 층(svg 바로 아래)에 놓는다 — ox, oy = svg 좌표 → 월드 px 변환량(-minSx, padTop), res = 화면 배율.
 */
export const GuideSparks = memo(function GuideSparks({ guide, stairs, ox, oy, res }: { guide: NonNullable<ReturnType<typeof useGuide>>; stairs?: IsoStair[]; ox: number; oy: number; res: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { path, route } = guide
  const pts = path.slice(2)
  const n = pts.length
  const end = route.target
  const reaches = !!end && path.length > 0 && Math.hypot(path[path.length - 1].x - end.x, path[path.length - 1].y - end.y) < 3.4
  const dots = pts
    .map((p, k) => {
      const s = isoToScreen(p.x, p.y)
      return { x: s.sx + ox, y: s.sy - stairElevation(stairs, p.x, p.y).z + oy, k, big: k % 4 === 0, fade: reaches ? 1 : Math.min(1, (n - k) / 10) }
    })
    .filter((d) => d.k % 2 === 0)
  const PAD = 24
  const x0 = Math.floor(Math.min(...dots.map((d) => d.x), 0) - PAD)
  const y0 = Math.floor(Math.min(...dots.map((d) => d.y), 0) - PAD)
  const x1 = Math.ceil(Math.max(...dots.map((d) => d.x), 0) + PAD)
  const y1 = Math.ceil(Math.max(...dots.map((d) => d.y), 0) + PAD)
  const w = Math.max(1, x1 - x0)
  const h = Math.max(1, y1 - y0)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !dots.length) return
    cv.width = Math.ceil(w * res)
    cv.height = Math.ceil(h * res)
    // guide-flow: 0%/100% (0.18, ×0.55) · 18% (1, ×1.3) · 45% (0.45, ×0.8) — 1.5초, 점마다 0.075초씩 어긋남
    const curve = (t: number) =>
      t < 0.18 ? [0.18 + (0.82 * t) / 0.18, 0.55 + (0.75 * t) / 0.18] : t < 0.45 ? [1 - (0.55 * (t - 0.18)) / 0.27, 1.3 - (0.5 * (t - 0.18)) / 0.27] : [0.45 - (0.27 * (t - 0.45)) / 0.55, 0.8 - (0.25 * (t - 0.45)) / 0.55]
    const t0 = performance.now()
    let raf = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      for (const d of dots) {
        const cx = (d.x - x0) * res
        const cy = (d.y - y0) * res
        // 바닥 빛 웅덩이
        ctx.globalAlpha = 0.28 * d.fade
        ctx.fillStyle = GOLD
        ctx.beginPath()
        ctx.ellipse(cx, cy, (d.big ? 13 : 8) * res, (d.big ? 6.5 : 4) * res, 0, 0, Math.PI * 2)
        ctx.fill()
        // 네 갈래 반짝이
        const t = (((now - t0) / 1000 + (n - d.k) * 0.075) % 1.5) / 1.5
        const [op, sc] = curve(t)
        const u = res * sc * (d.big ? 1.7 : 1)
        ctx.globalAlpha = op * d.fade
        ctx.setTransform(u, 0, 0, u, cx, cy)
        ctx.fillStyle = GOLD
        ctx.fillRect(-1, -4, 2, 8)
        ctx.fillRect(-4, -1, 8, 2)
        ctx.fillStyle = PALE
        ctx.fillRect(-1, -1, 2, 2)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // dots 는 guide·stairs·ox·oy 로 정해진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, stairs, ox, oy, res, w, h])
  if (!dots.length) return null
  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', left: x0, top: y0, width: w, height: h, pointerEvents: 'none' }} />
})

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
