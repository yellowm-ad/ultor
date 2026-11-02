'use client'

// ============================================================================
// 무너진 회랑(2026-11-02 재제작) — 버려진 신전으로 가는 길. 매번 새로 생기는 도트 미로 스테이지
//   · 미로는 판마다 무작위(깊이 우선 + 샛길). 벽·바닥 테마도 10가지 중 하나가 뽑힌다
//   · 횃불이 비추는 둘레만 보이고, 지나온 길은 흐리게 남는다. 횃불은 점점 줄어든다
//   · 화로를 지나면 횃불이 다시 타오른다. 떠도는 그림자 도깨비불에 닿으면 횃불이 깎인다
//   · 빛이 새는 출구에 닿으면 통과 — 횃불이 다 타면 입구로
//   조작: W·A·S·D / 방향키(누르고 있으면 계속 걷는다), 화면 버튼
// 그림: public/images/passage/maze/*.png (PixelLab)
// ============================================================================

import { useMemo, useRef } from 'react'
import { useGame } from '@/lib/game-state'
import { drawHero, keyCap, rng, useCanvasLoop, useHud, useImages, useInput, VH, VW, type Key } from './px-engine'
import { StageHud } from './stage-ui'
import { heroSheet, npcSheet } from '@/lib/costumes'

const MW = 13 // 방 칸 수(가로)
const MH = 9
const GW = MW * 2 + 1 // 타일 격자
const GH = MH * 2 + 1
const T = 32 // 타일 픽셀
const TORCH = 115 // 초(2026-11-02 난이도 완화: 75 → 115)
const STEP = 0.15 // 한 타일 걷는 시간
const THEMES = 10

function makeMaze(seed: number) {
  const r = rng(seed)
  const wall = new Uint8Array(GW * GH).fill(1)
  const at = (x: number, y: number) => y * GW + x
  const seen = new Uint8Array(MW * MH)
  const stack: [number, number][] = [[0, 0]]
  seen[0] = 1
  wall[at(1, 1)] = 0
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const opts = dirs.filter(([dx, dy]) => cx + dx >= 0 && cy + dy >= 0 && cx + dx < MW && cy + dy < MH && !seen[(cy + dy) * MW + cx + dx])
    if (!opts.length) {
      stack.pop()
      continue
    }
    const [dx, dy] = opts[Math.floor(r() * opts.length)]
    const nx = cx + dx,
      ny = cy + dy
    seen[ny * MW + nx] = 1
    wall[at(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = 0
    wall[at(nx * 2 + 1, ny * 2 + 1)] = 0
    stack.push([nx, ny])
  }
  // 샛길 — 막힌 벽을 조금 터서 돌아가는 길을 만든다
  for (let k = 0; k < 14; k++) {
    const x = 1 + Math.floor(r() * (GW - 2)),
      y = 1 + Math.floor(r() * (GH - 2))
    if ((x + y) % 2 === 1 && wall[at(x, y)]) wall[at(x, y)] = 0
  }
  // 입구에서 가장 먼 곳이 출구
  const dist = new Int16Array(GW * GH).fill(-1)
  const q = [at(1, 1)]
  dist[q[0]] = 0
  let far = q[0]
  while (q.length) {
    const c = q.shift()!
    if (dist[c] > dist[far]) far = c
    const x = c % GW,
      y = (c - x) / GW
    for (const [dx, dy] of dirs) {
      const n = at(x + dx, y + dy)
      if (x + dx > 0 && y + dy > 0 && x + dx < GW - 1 && y + dy < GH - 1 && !wall[n] && dist[n] < 0) {
        dist[n] = dist[c] + 1
        q.push(n)
      }
    }
  }
  // 출구 — 길로도 멀고 눈으로도 먼 곳(입구 바로 옆 벽 너머에 생기지 않게)
  {
    let best = far
    let bs = -1
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 0) continue
      const x = i % GW,
        y = (i - x) / GW
      const sc = dist[i] + 4 * Math.hypot(x - 1, y - 1)
      if (sc > bs) {
        bs = sc
        best = i
      }
    }
    far = best
  }
  const floors: number[] = []
  for (let i = 0; i < wall.length; i++) if (!wall[i] && dist[i] > 6 && i !== far) floors.push(i)
  // 화로 — 길 중간중간(입구에서 먼 순서로 고르게)
  floors.sort((a, b) => dist[a] - dist[b])
  const braziers: number[] = []
  for (let k = 1; k <= 4; k++) braziers.push(floors[Math.floor((floors.length * k) / 5)])
  // 룬이 새겨진 벽(장식) · 도깨비불 시작 자리
  const runes = new Set<number>()
  for (let k = 0; k < 18; k++) {
    const i = Math.floor(r() * wall.length)
    if (wall[i]) runes.add(i)
  }
  const wisps = [0.6, 0.92].map((f) => floors[Math.floor(floors.length * f)])
  return { wall, exit: far, braziers, runes, wisps, theme: Math.floor(r() * THEMES), dist }
}

const P = '/images/passage/maze/'
function srcFor(theme: number) {
  return {
    wall: `${P}wall${theme}.png`,
    floor: `${P}floor${theme}.png`,
    rune0: P + 'rune0.png',
    rune1: P + 'rune1.png',
    rune2: P + 'rune2.png',
    rune3: P + 'rune3.png',
    brazier: P + 'brazier0.png',
    brazierOut: P + 'brazier1.png',
    exit: P + 'exit0.png',
  }
}

type Dir = 'up' | 'down' | 'left' | 'right'
const DV: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

export function MazeStage({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const { state } = useGame()
  const heroSrc = `/images/sprites/${heroSheet(state)}.png`
  const mates = state.companions.party
    .map((id) => npcSheet(state, id))
    .filter(Boolean)
    .slice(0, 3) as string[]
  const sheets = useImages({
    hero: heroSrc,
    m0: mates[0] ? `/images/sprites/${mates[0]}.png` : heroSrc,
    m1: mates[1] ? `/images/sprites/${mates[1]}.png` : heroSrc,
    m2: mates[2] ? `/images/sprites/${mates[2]}.png` : heroSrc,
  })
  const seed = useMemo(() => (Math.random() * 1e9) | 0, [])
  const maze = useMemo(() => makeMaze(seed), [seed])
  const img = useImages(srcFor(maze.theme))
  const cv = useRef<HTMLCanvasElement | null>(null)
  const dark = useRef<HTMLCanvasElement | null>(null)
  const input = useInput(true)
  const g = useRef({
    x: 1,
    y: 1,
    fx: 1, // 그려지는 위치(보간)
    fy: 1,
    moveT: 0,
    from: [1, 1] as [number, number],
    face: 'down' as Dir,
    walking: false,
    fuel: TORCH,
    lit: new Set<number>(maze.braziers), // 아직 불이 남은 화로
    seen: new Uint8Array(GW * GH),
    trail: [] as [number, number][],
    wisps: maze.wisps.map((c) => ({ x: c % GW, y: Math.floor(c / GW), fx: c % GW, fy: Math.floor(c / GW), t: 0, from: [c % GW, Math.floor(c / GW)] as [number, number], cd: 0 })),
    over: false,
    note: '',
    noteT: 0,
    hurt: 0,
    t: 0,
    queued: null as Dir | null,
  })
  const [hud, setHud] = useHud({ fuel: 100 })

  const free = (x: number, y: number) => x > 0 && y > 0 && x < GW - 1 && y < GH - 1 && !maze.wall[y * GW + x]

  const update = (dt: number) => {
    const st = g.current
    if (st.over) return
    st.t += dt
    st.fuel -= dt
    st.noteT = Math.max(0, st.noteT - dt)
    st.hurt = Math.max(0, st.hurt - dt)
    // 입력 — 누른 순간은 예약, 누르고 있으면 계속
    for (const k of input.pressed) if (k in DV) st.queued = k as Dir
    input.pressed.clear()
    const held = (['up', 'down', 'left', 'right'] as Dir[]).find((d) => input.held.has(d as Key))
    if (st.moveT > 0) {
      st.moveT = Math.max(0, st.moveT - dt)
      const k = 1 - st.moveT / STEP
      st.fx = st.from[0] + (st.x - st.from[0]) * k
      st.fy = st.from[1] + (st.y - st.from[1]) * k
    }
    if (st.moveT <= 0) {
      st.fx = st.x
      st.fy = st.y
      const want = st.queued ?? held ?? null
      st.queued = null
      st.walking = false
      if (want) {
        st.face = want
        const [dx, dy] = DV[want]
        if (free(st.x + dx, st.y + dy)) {
          st.trail.unshift([st.x, st.y])
          if (st.trail.length > 12) st.trail.length = 12
          st.from = [st.x, st.y]
          st.x += dx
          st.y += dy
          st.moveT = STEP
          st.walking = true
          const c = st.y * GW + st.x
          if (st.lit.has(c)) {
            st.lit.delete(c)
            st.fuel = Math.min(TORCH, st.fuel + 40)
            say(st, '화로에서 불을 옮겨 붙였다! (+40초)')
          }
          if (c === maze.exit) {
            st.over = true
            window.setTimeout(() => onEnd(true), 500)
          }
        }
      }
    }
    // 시야 — 횃불 반경 안을 '본 칸'으로
    const rad = lightRadius(st.fuel)
    for (let y = Math.max(0, Math.floor(st.fy - rad)); y <= Math.min(GH - 1, Math.ceil(st.fy + rad)); y++)
      for (let x = Math.max(0, Math.floor(st.fx - rad)); x <= Math.min(GW - 1, Math.ceil(st.fx + rad)); x++) if (Math.hypot(x - st.fx, y - st.fy) <= rad) st.seen[y * GW + x] = 1
    // 도깨비불 — 길을 따라 느리게 떠돌다가 가까우면 다가온다
    for (const w of st.wisps) {
      if (w.t > 0) {
        w.t = Math.max(0, w.t - dt)
        const k = 1 - w.t / 0.6
        w.fx = w.from[0] + (w.x - w.from[0]) * k
        w.fy = w.from[1] + (w.y - w.from[1]) * k
      } else {
        const near = Math.hypot(w.x - st.x, w.y - st.y) < 3.5
        const opts = (Object.values(DV) as [number, number][]).filter(([dx, dy]) => free(w.x + dx, w.y + dy))
        if (opts.length) {
          opts.sort((a, b) => (near ? Math.hypot(w.x + a[0] - st.x, w.y + a[1] - st.y) - Math.hypot(w.x + b[0] - st.x, w.y + b[1] - st.y) : Math.random() - 0.5))
          const [dx, dy] = opts[0]
          w.from = [w.x, w.y]
          w.x += dx
          w.y += dy
          w.t = 0.6
        }
      }
      w.cd = Math.max(0, w.cd - dt)
      if (w.cd <= 0 && Math.hypot(w.fx - st.fx, w.fy - st.fy) < 0.7) {
        w.cd = 2
        st.fuel -= 6
        st.hurt = 0.4
        say(st, '그림자 도깨비불이 횃불을 핥고 지나갔다! (-6초)')
      }
    }
    if (st.fuel <= 0 && !st.over) {
      st.over = true
      window.setTimeout(() => onEnd(false), 600)
    }
    setHud({ fuel: Math.max(0, Math.round((st.fuel / TORCH) * 100)) })
  }

  function say(st: typeof g.current, msg: string) {
    st.note = msg
    st.noteT = 1.4
  }

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const st = g.current
    const camX = Math.round(Math.max(0, Math.min(GW * T - VW, st.fx * T + T / 2 - VW / 2)))
    const camY = Math.round(Math.max(0, Math.min(GH * T - VH, st.fy * T + T / 2 - VH / 2)))
    ctx.fillStyle = '#07050a'
    ctx.fillRect(0, 0, VW, VH)
    ctx.save()
    ctx.translate(-camX, -camY)
    const x0 = Math.floor(camX / T),
      y0 = Math.floor(camY / T)
    for (let y = y0; y <= Math.min(GH - 1, y0 + Math.ceil(VH / T)); y++)
      for (let x = x0; x <= Math.min(GW - 1, x0 + Math.ceil(VW / T)); x++) {
        const c = y * GW + x
        const px = x * T,
          py = y * T
        if (maze.wall[c]) {
          const rune = maze.runes.has(c)
          const ri = rune ? [img.rune0, img.rune1, img.rune2, img.rune3][c % 4] : null
          const wi = ri ?? img.wall
          if (wi) ctx.drawImage(wi, px, py, T, T)
          else {
            ctx.fillStyle = '#4a4034'
            ctx.fillRect(px, py, T, T)
          }
          // 아래가 바닥이면 벽 앞면(그림자) — 위에서 비스듬히 본 깊이
          if (y < GH - 1 && !maze.wall[c + GW]) {
            ctx.fillStyle = 'rgba(10,6,4,0.55)'
            ctx.fillRect(px, py + T - 7, T, 7)
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.fillRect(px, py + T, T, 5)
          }
        } else {
          if (img.floor) ctx.drawImage(img.floor, px, py, T, T)
          else {
            ctx.fillStyle = '#2a241d'
            ctx.fillRect(px, py, T, T)
          }
        }
      }
    // 화로
    for (const c of maze.braziers) {
      const x = (c % GW) * T + T / 2,
        y = Math.floor(c / GW) * T + T / 2
      const on = st.lit.has(c)
      const bi = on ? img.brazier : img.brazierOut
      if (bi) {
        ctx.globalAlpha = on ? 1 : 0.5
        const s = 0.42
        ctx.drawImage(bi, Math.round(x - (bi.width * s) / 2), Math.round(y - bi.height * s + 8 + (on ? Math.round(Math.sin(t * 9 + c) * 0.6) : 0)), Math.round(bi.width * s), Math.round(bi.height * s))
        ctx.globalAlpha = 1
      }
    }
    // 출구
    {
      const x = (maze.exit % GW) * T + T / 2,
        y = Math.floor(maze.exit / GW) * T + T / 2
      if (img.exit) {
        const s = 0.5
        ctx.drawImage(img.exit, Math.round(x - (img.exit.width * s) / 2), Math.round(y - img.exit.height * s + 12), Math.round(img.exit.width * s), Math.round(img.exit.height * s))
      }
    }
    // 일행 — 지나온 길을 따라
    const party = [sheets.m0, sheets.m1, sheets.m2].slice(0, mates.length)
    party.forEach((sh, i) => {
      const p = st.trail[(i + 1) * 2 - 1] ?? st.trail[st.trail.length - 1]
      if (!p) return
      drawHero(ctx, sh, 0, 0, p[0] * T + T / 2, p[1] * T + T - 2, 0.42, false, 0.9)
    })
    // 주인공
    {
      const row = st.face === 'down' ? 1 : st.face === 'up' ? 3 : 2
      const moving = st.moveT > 0
      const col = moving ? Math.floor(t * 12) % 8 : 0
      const stillCol = { down: 0, right: 2, up: 4, left: 6 }[st.face]
      drawHero(ctx, sheets.hero, moving ? row : 0, moving ? col : stillCol, st.fx * T + T / 2, st.fy * T + T - 2, 0.46, moving && st.face === 'left')
    }
    // 도깨비불
    for (const w of st.wisps) {
      const x = w.fx * T + T / 2,
        y = w.fy * T + T / 2 + Math.sin(t * 5 + w.from[0]) * 3
      const gr = ctx.createRadialGradient(x, y, 1, x, y, 12)
      gr.addColorStop(0, 'rgba(200,170,255,0.95)')
      gr.addColorStop(0.4, 'rgba(120,80,220,0.55)')
      gr.addColorStop(1, 'rgba(60,20,120,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - 12, y - 12, 24, 24)
      ctx.fillStyle = '#efe6ff'
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2)
    }
    ctx.restore()

    // 어둠 — 횃불 둘레만 밝다. 본 적 있는 칸은 흐리게, 처음 보는 곳은 캄캄
    const dc = (dark.current ??= document.createElement('canvas'))
    if (dc.width !== VW) {
      dc.width = VW
      dc.height = VH
    }
    const d = dc.getContext('2d')!
    d.globalCompositeOperation = 'source-over'
    d.clearRect(0, 0, VW, VH)
    d.fillStyle = 'rgba(4,3,6,0.97)'
    d.fillRect(0, 0, VW, VH)
    d.globalCompositeOperation = 'destination-out'
    d.fillStyle = 'rgba(0,0,0,0.55)'
    for (let y = y0; y <= Math.min(GH - 1, y0 + Math.ceil(VH / T)); y++)
      for (let x = x0; x <= Math.min(GW - 1, x0 + Math.ceil(VW / T)); x++) if (st.seen[y * GW + x]) d.fillRect(x * T - camX, y * T - camY, T, T)
    const hole = (x: number, y: number, r: number, a = 1) => {
      const gr = d.createRadialGradient(x, y, r * 0.25, x, y, r)
      gr.addColorStop(0, `rgba(0,0,0,${a})`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      d.fillStyle = gr
      d.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const flick = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.03
    hole(st.fx * T + T / 2 - camX, st.fy * T + T / 2 - camY, lightRadius(st.fuel) * T * flick)
    // 출구에서 새는 빛은 멀리서도 희미하게 보인다
    hole((maze.exit % GW) * T + T / 2 - camX, Math.floor(maze.exit / GW) * T + T / 2 - camY, 70, 0.7)
    for (const c of st.lit) hole((c % GW) * T + T / 2 - camX, Math.floor(c / GW) * T + T / 2 - camY, 40, 0.75)
    ctx.drawImage(dc, 0, 0)
    // 따뜻한 횃불 빛깔
    const px = st.fx * T + T / 2 - camX,
      py = st.fy * T + T / 2 - camY
    const warm = ctx.createRadialGradient(px, py, 4, px, py, lightRadius(st.fuel) * T)
    warm.addColorStop(0, 'rgba(255,170,80,0.18)')
    warm.addColorStop(1, 'rgba(255,170,80,0)')
    ctx.fillStyle = warm
    ctx.fillRect(0, 0, VW, VH)
    if (st.hurt > 0) {
      ctx.fillStyle = 'rgba(90,40,160,0.25)'
      ctx.fillRect(0, 0, VW, VH)
    }
    if (st.noteT > 0) {
      ctx.globalAlpha = Math.min(1, st.noteT * 3)
      keyCap(ctx, st.note, VW / 2, 18)
      ctx.globalAlpha = 1
    }
    if (st.t < 2.5) keyCap(ctx, '빛이 새는 출구를 찾아라', VW / 2, VH - 22)
  }

  useCanvasLoop(cv, true, update, draw)

  return (
    <div className="pst-wrap">
      <StageHud bars={[{ label: '횃불', v: hud.fuel, tone: 'torch' }]} items={[{ label: '화로', value: '불 옮기기 +40초' }]} />
      <div className="pst-stage">
        <canvas ref={cv} className="pst-canvas" />
      </div>
      <div className="pst-pad pst-dpad">
        {(
          [
            ['left', '←'],
            ['up', '↑'],
            ['down', '↓'],
            ['right', '→'],
          ] as [Key, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            className="pst-btn"
            onPointerDown={(e) => {
              e.preventDefault()
              input.hold(k, true)
            }}
            onPointerUp={() => input.hold(k, false)}
            onPointerLeave={() => input.hold(k, false)}
            onPointerCancel={() => input.hold(k, false)}
          >
            <span>{l}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 횃불이 줄수록 시야가 좁아진다(타일 단위) */
function lightRadius(fuel: number) {
  return 2.4 + Math.max(0, Math.min(1, fuel / TORCH)) * 2.4
}
