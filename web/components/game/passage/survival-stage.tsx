'use client'

// ============================================================================
// 설원 횡단(2026-11-02 재제작) — 루미나 설원 어귀에서 오로라 능선까지 직접 걸어서 건너는 스테이지
//   · 설원 맵 그림(public/images/map: 눈 지형 · 침엽수 · 서리바위 · 눈더미)을 그대로 깔고,
//     갈림길마다 거점(캠프 · 사냥터 · 얼음 동굴 · 눈보라 길 · 버려진 보급소 · 수상한 발자국) 중 하나로 걸어간다
//   · 걷는 동안 체온·허기가 줄고, 도착한 거점에서 일이 벌어진다(기존 규칙 그대로)
//   · 다음 거점은 ← ↑ → (A W D) 또는 눌러서 고른다. 수상한 발자국은 따라갈지 정한다
//   · 마지막 눈보라를 넘어 능선에 오르면 통과 / 체력이 다하면 어귀로
// 그림: public/images/passage/survival/*.png (거점 — PixelLab) + 기존 설원 지형·소품
// ============================================================================

import { useMemo, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { drawHero, keyCap, rng, useCanvasLoop, useHud, useImages, useInput, VH, VW, type Key } from './px-engine'
import { StageHud } from './stage-ui'
import { heroSheet, npcSheet } from '@/lib/costumes'

type NodeKind = 'camp' | 'hunt' | 'cave' | 'storm' | 'supply' | 'tracks'
const NODE: Record<NodeKind, { name: string; hint: string }> = {
  camp: { name: '캠프', hint: '불을 피운다 — 체온 크게 회복' },
  hunt: { name: '사냥터', hint: '사냥 — 허기 크게 회복, 다칠 수 있다' },
  cave: { name: '얼음 동굴', hint: '바람을 피한다 — 체온·허기 조금 회복' },
  storm: { name: '눈보라 길', hint: '체온이 크게 깎인다 — 가끔 보급품' },
  supply: { name: '버려진 보급소', hint: '체온·허기·체력 조금씩' },
  tracks: { name: '수상한 발자국', hint: '따라갈지 고른다' },
}
const LAYERS = 7
const LANE_X = [128, 240, 352]
const GAP = 118 // 층 사이 세로 간격
const START_Y = 0
const nodeY = (l: number) => START_Y - (l + 1) * GAP
const RIDGE_Y = nodeY(LAYERS) - 30
const WALK = 46 // px/s

const P = '/images/passage/survival/'
const SRC = {
  snow: P + 'snow.png',
  path: P + 'path.png',
  shade: P + 'shade.png',
  camp: P + 'camp.png',
  hunt: P + 'hunt.png',
  cave: P + 'cave.png',
  storm: P + 'storm.png',
  supply: P + 'supply.png',
  tracks: P + 'tracks.png',
  pine: '/images/map/props/f_snow_pine.png',
  rock: '/images/map/props/f_snow_rock.png',
  mound: '/images/map/props/f_snow_mound.png',
}
type Img = Record<keyof typeof SRC, HTMLImageElement | null>

interface St {
  layer: number
  col: number
  warm: number
  food: number
  hp: number
  log: string
  ask: boolean
  done: boolean
}

export function SurvivalStage({ onEnd }: { onEnd: (ok: boolean) => void }) {
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
  const img = useImages(SRC)
  const seed = useMemo(() => (Math.random() * 1e9) | 0, [])
  const map = useMemo(() => {
    const r = rng(seed)
    const pool: NodeKind[] = ['camp', 'hunt', 'cave', 'storm', 'supply', 'tracks', 'hunt', 'camp', 'storm']
    return Array.from({ length: LAYERS }, (_, l) => {
      const row = Array.from({ length: 3 }, () => pool[Math.floor(r() * pool.length)])
      if (!row.some((k) => k === 'camp' || k === 'cave' || k === 'supply')) row[Math.floor(r() * 3)] = l % 2 ? 'camp' : 'cave'
      if (l === LAYERS - 1 && !row.includes('storm')) row[1] = 'storm'
      return row
    })
  }, [seed])
  // 설원 소품 — 길에서 비켜난 자리에 고정 배치
  const decor = useMemo(() => {
    const r = rng(seed + 7)
    const out: { x: number; y: number; k: 'pine' | 'rock' | 'mound' | 'shade' }[] = []
    for (let i = 0; i < 70; i++) {
      const y = 60 - r() * (LAYERS * GAP + 260)
      const x = r() * VW
      if (LANE_X.some((lx) => Math.abs(lx - x) < 34)) continue
      const v = r()
      out.push({ x, y, k: v < 0.5 ? 'pine' : v < 0.68 ? 'rock' : v < 0.85 ? 'mound' : 'shade' })
    }
    return out.sort((a, b) => a.y - b.y)
  }, [seed])

  const [st, setSt] = useState<St>({ layer: -1, col: 1, warm: 85, food: 85, hp: 3, log: '설원 어귀. 눈 위로 세 갈래 길이 나 있다.', ask: false, done: false })
  const stRef = useRef(st)
  stRef.current = st
  const cv = useRef<HTMLCanvasElement | null>(null)
  const input = useInput(true)
  const anim = useRef({
    x: LANE_X[1],
    y: START_Y,
    walk: null as null | { fx: number; fy: number; tx: number; ty: number; t: number; dur: number; col: number; climb?: boolean },
    trail: [] as [number, number][],
    snow: Array.from({ length: 70 }, (_, i) => ({ x: (i * 67) % VW, y: (i * 41) % VH, s: 0.5 + (i % 3) * 0.4 })),
    pop: 0,
  })
  const [hud, setHud] = useHud({ warm: 85, food: 85, hp: 3 })

  // ── 규칙(이전 판과 같은 수치) ──
  const settle = (s: St, log: string) => {
    let { warm, food, hp } = s
    const extra: string[] = []
    if (warm <= 0) {
      hp -= 1
      warm = 25
      extra.push('몸이 얼어 체력이 깎였다.')
    }
    if (food <= 0) {
      hp -= 1
      food = 25
      extra.push('굶주려 체력이 깎였다.')
    }
    const next = { ...s, warm: Math.min(100, warm), food: Math.min(100, food), hp: Math.min(3, hp), log: [log, ...extra].join(' ') }
    setSt(next)
    anim.current.pop = 2.4
    if (next.hp <= 0) {
      next.done = true
      window.setTimeout(() => onEnd(false), 1100)
    }
  }
  const arrive = (layer: number, col: number) => {
    const s0 = stRef.current
    const kind = map[layer][col]
    const s = { ...s0, layer, col, warm: s0.warm - 12, food: s0.food - 10, ask: false }
    const r = Math.random()
    switch (kind) {
      case 'camp':
        return settle({ ...s, warm: s.warm + 42, food: s.food - 4 }, '바람막이 뒤에 불을 피웠다. 손끝에 감각이 돌아온다.')
      case 'hunt':
        return r < 0.2
          ? settle({ ...s, food: s.food + 35, warm: s.warm - 6 }, '눈토끼를 잡았지만 얼음에 미끄러져 옷이 젖었다.')
          : settle({ ...s, food: s.food + 45, warm: s.warm - 8 }, '눈토끼 두 마리를 잡아 배를 채웠다.')
      case 'cave':
        return settle({ ...s, warm: s.warm + 22, food: s.food + 12 }, '얼음 동굴에서 바람을 피하며 말린 열매를 씹었다.')
      case 'storm':
        return r < 0.5
          ? settle({ ...s, warm: s.warm - 22, food: s.food + 28 }, '눈보라 속에서 반쯤 묻힌 보급 상자를 찾았다.')
          : settle({ ...s, warm: s.warm - 24 }, '눈보라가 뼛속까지 파고든다. 앞이 보이지 않는다.')
      case 'supply':
        return settle({ ...s, warm: s.warm + 14, food: s.food + 22, hp: s.hp + 1 }, '버려진 보급소에 담요와 통조림이 남아 있었다.')
      case 'tracks':
        anim.current.pop = 2.4
        return setSt({ ...s, ask: true, log: '눈 위에 커다란 발자국이 숲 쪽으로 이어진다. 따라가 볼까?' })
    }
  }
  const tracks = (follow: boolean) => {
    const s = { ...stRef.current, ask: false }
    if (!follow) return settle(s, '발자국을 등지고 걸음을 재촉했다.')
    return Math.random() < 0.7
      ? settle({ ...s, food: s.food + 50, warm: s.warm + 10 }, '발자국 끝에 설인 사냥꾼의 모닥불이 있었다. 고깃국을 얻어먹었다.')
      : settle({ ...s, hp: s.hp - 1, warm: s.warm - 10 }, '서리곰의 굴이었다! 간신히 달아났지만 다쳤다.')
  }
  const climb = () => {
    const s = stRef.current
    let { warm, food, hp } = s
    const notes: string[] = []
    warm -= 28
    food -= 16
    if (warm < 0) {
      hp -= 1
      notes.push('얼어붙은 손으로 바위를 붙잡았다.')
    }
    if (food < 0) {
      hp -= 1
      notes.push('허기에 다리가 풀렸다.')
    }
    const ok = hp > 0
    setSt({ ...s, warm: Math.max(0, warm), food: Math.max(0, food), hp, layer: LAYERS, done: true, log: ok ? ['마지막 눈보라를 뚫고 능선에 올랐다!', ...notes].join(' ') : ['능선을 눈앞에 두고 쓰러졌다.', ...notes].join(' ') })
    anim.current.pop = 3
    window.setTimeout(() => onEnd(ok), 1600)
  }

  const canGo = (col: number) => {
    const s = stRef.current
    return !s.done && !s.ask && !anim.current.walk && s.layer < LAYERS - 1 && (s.layer < 0 || Math.abs(col - s.col) <= 1)
  }
  const go = (col: number) => {
    if (!canGo(col)) return
    const s = stRef.current
    const a = anim.current
    const tx = LANE_X[col]
    const ty = nodeY(s.layer + 1)
    a.walk = { fx: a.x, fy: a.y, tx, ty, t: 0, dur: Math.hypot(tx - a.x, ty - a.y) / WALK, col }
  }
  const goRidge = () => {
    const s = stRef.current
    const a = anim.current
    if (s.done || s.ask || a.walk || s.layer !== LAYERS - 1) return
    a.walk = { fx: a.x, fy: a.y, tx: VW / 2, ty: RIDGE_Y + 20, t: 0, dur: Math.hypot(VW / 2 - a.x, RIDGE_Y + 20 - a.y) / WALK, col: 1, climb: true }
  }

  const update = (dt: number) => {
    const a = anim.current
    const s = stRef.current
    for (const k of input.pressed) {
      if (s.ask) continue
      if (s.layer === LAYERS - 1 && (k === 'up' || k === 'act' || k === 'jump')) goRidge()
      else if (k === 'left') go(s.layer < 0 ? 0 : s.col - 1)
      else if (k === 'up') go(s.layer < 0 ? 1 : s.col)
      else if (k === 'right') go(s.layer < 0 ? 2 : s.col + 1)
    }
    input.pressed.clear()
    a.pop = Math.max(0, a.pop - dt)
    if (a.walk) {
      const w = a.walk
      w.t += dt
      const k = Math.min(1, w.t / w.dur)
      a.x = w.fx + (w.tx - w.fx) * k
      a.y = w.fy + (w.ty - w.fy) * k
      if (a.trail.length === 0 || Math.hypot(a.trail[0][0] - a.x, a.trail[0][1] - a.y) > 3) {
        a.trail.unshift([a.x, a.y])
        if (a.trail.length > 40) a.trail.length = 40
      }
      // 걷는 동안 체온·허기가 줄어드는 게 보이게(정산은 도착할 때 한 번)
      const live = { warm: Math.round(s.warm - 12 * k), food: Math.round(s.food - 10 * k), hp: s.hp }
      setHud(w.climb ? { warm: Math.round(s.warm - 28 * k), food: Math.round(s.food - 16 * k), hp: s.hp } : live)
      if (k >= 1) {
        a.walk = null
        if (w.climb) climb()
        else arrive(s.layer + 1, w.col)
      }
    } else setHud({ warm: s.warm, food: s.food, hp: s.hp })
    for (const f of a.snow) {
      f.y += (18 + f.s * 22) * dt
      f.x -= (10 + f.s * 14) * dt
      if (f.y > VH) {
        f.y = -4
        f.x = Math.random() * (VW + 40)
      }
      if (f.x < -4) f.x = VW + 4
    }
  }

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const a = anim.current
    const s = stRef.current
    const camY = Math.round(Math.min(START_Y + 60 - VH, a.y - VH * 0.66))
    ctx.save()
    ctx.translate(0, -camY)
    // 눈밭
    if (img.snow) {
      const tw = img.snow.width,
        th = img.snow.height
      for (let y = Math.floor(camY / th) * th; y < camY + VH; y += th)
        for (let x = (Math.abs(y / th) % 2) * -(tw / 2); x < VW; x += tw) ctx.drawImage(img.snow, Math.round(x), y)
    } else {
      ctx.fillStyle = '#e8eef6'
      ctx.fillRect(0, camY, VW, VH)
    }
    // 능선 위 하늘과 오로라
    const skyBot = RIDGE_Y - 10
    if (camY < skyBot) {
      const sk = ctx.createLinearGradient(0, skyBot - 200, 0, skyBot)
      sk.addColorStop(0, '#0b1424')
      sk.addColorStop(1, '#2a3e5a')
      ctx.fillStyle = sk
      ctx.fillRect(0, camY, VW, skyBot - camY)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['rgba(120,255,190,0.18)', 'rgba(140,200,255,0.16)', 'rgba(200,140,255,0.12)'][i]
        for (let x = 0; x < VW; x += 4) {
          const y = skyBot - 150 + i * 22 + Math.sin(x * 0.02 + t * 0.6 + i) * 14
          ctx.fillRect(x, Math.round(y), 4, 18 + Math.round(Math.sin(x * 0.05 + t + i) * 6))
        }
      }
      // 능선(눈 덮인 산등성이)
      ctx.fillStyle = '#d9e4f0'
      ctx.beginPath()
      ctx.moveTo(0, skyBot + 6)
      for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, skyBot - 18 + Math.round(Math.sin(x * 0.03) * 10 + Math.sin(x * 0.11) * 4))
      ctx.lineTo(VW, skyBot + 6)
      ctx.fill()
      ctx.fillStyle = '#9fb3c8'
      ctx.fillRect(0, skyBot + 4, VW, 3)
    }
    // 길 — 지나갈 수 있는 갈래(지나온 길은 진하게)
    const pathLine = (x0: number, y0: number, x1: number, y1: number, on: boolean, done: boolean) => {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineWidth = done ? 16 : 12
      ctx.strokeStyle = img.path ? ctx.createPattern(img.path, 'repeat') ?? '#c9d6e3' : '#c9d6e3'
      ctx.globalAlpha = done ? 1 : on ? 0.85 : 0.4
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      if (on && !done) {
        ctx.setLineDash([4, 6])
        ctx.lineDashOffset = -t * 20
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255,220,120,0.9)'
        ctx.stroke()
      }
      ctx.restore()
    }
    for (let l = -1; l < LAYERS - 1; l++) {
      // 어귀(l = -1)는 가운데 한 점에서 세 갈래, 그 뒤로는 바로 옆 칸까지만 이어진다
      for (const c of l < 0 ? [1] : [0, 1, 2])
        for (const n of l < 0 ? [0, 1, 2] : [c - 1, c, c + 1]) {
          if (n < 0 || n > 2) continue
          const here = l === s.layer && (l < 0 || c === s.col)
          pathLine(LANE_X[c], l < 0 ? START_Y : nodeY(l), LANE_X[n], nodeY(l + 1), here && !s.ask && !s.done, false)
        }
    }
    for (let c = 0; c < 3; c++) pathLine(LANE_X[c], nodeY(LAYERS - 1), VW / 2, RIDGE_Y + 20, s.layer === LAYERS - 1 && c === s.col, false)
    // 발자국(지나온 길)
    ctx.fillStyle = 'rgba(120,140,170,0.55)'
    a.trail.forEach(([x, y], i) => {
      if (i % 3) return
      ctx.fillRect(Math.round(x + (i % 6 ? -3 : 2)), Math.round(y), 2, 2)
    })
    // 소품 + 거점 + 일행을 y 순으로
    type D = { y: number; f: () => void }
    const ds: D[] = []
    for (const d of decor) {
      if (d.y < camY - 160 || d.y > camY + VH + 40) continue
      const im = img[d.k]
      if (!im) continue
      if (d.k === 'shade') {
        ctx.globalAlpha = 0.6
        ctx.drawImage(im, Math.round(d.x - 56), Math.round(d.y - 28))
        ctx.globalAlpha = 1
        continue
      }
      const sc = d.k === 'pine' ? 0.55 : 0.5
      ds.push({ y: d.y, f: () => ctx.drawImage(im, Math.round(d.x - (im.width * sc) / 2), Math.round(d.y - im.height * sc), Math.round(im.width * sc), Math.round(im.height * sc)) })
    }
    map.forEach((row, l) =>
      row.forEach((k, c) => {
        const x = LANE_X[c],
          y = nodeY(l)
        const im = img[k]
        const isNext = !s.ask && !s.done && !a.walk && l === s.layer + 1 && (s.layer < 0 || Math.abs(c - s.col) <= 1)
        const past = l < s.layer || (l === s.layer && c !== s.col)
        ds.push({
          y,
          f: () => {
            // 발밑 원(고를 수 있으면 금빛으로 깜빡)
            ctx.fillStyle = isNext ? `rgba(255,210,110,${0.35 + Math.sin(t * 5) * 0.15})` : 'rgba(80,100,130,0.25)'
            ctx.beginPath()
            ctx.ellipse(x, y, 26, 10, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = past ? 0.45 : 1
            if (im) ctx.drawImage(im, Math.round(x - 26), Math.round(y - 44), 52, 52)
            else drawNodeFallback(ctx, k, x, y, t)
            ctx.globalAlpha = 1
            if (isNext || (l === s.layer && c === s.col)) {
              ctx.font = 'bold 10px Pretendard, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillStyle = '#1b2433'
              ctx.fillText(NODE[k].name, x + 1, y + 21)
              ctx.fillStyle = l === s.layer && c === s.col ? '#ffe9a8' : '#ffffff'
              ctx.fillText(NODE[k].name, x, y + 20)
            }
            if (isNext) {
              const key = s.layer < 0 ? ['←', '↑', '→'][c] : c < s.col ? '←' : c > s.col ? '→' : '↑'
              keyCap(ctx, key, x, y - 54)
            }
          },
        })
      }),
    )
    // 일행 + 주인공
    const moving = !!a.walk
    const dirX = a.walk ? a.walk.tx - a.walk.fx : 0
    const row = moving ? (Math.abs(dirX) > 30 ? 2 : 3) : 0
    const frame = moving ? Math.floor(t * 10) % 8 : 4
    const party = [sheets.m0, sheets.m1, sheets.m2].slice(0, mates.length)
    party.forEach((sh, i) => {
      const p = a.trail[(i + 1) * 6] ?? [a.x + (i - 1) * 12, a.y + 14 + i * 4]
      ds.push({ y: p[1], f: () => drawHero(ctx, sh, row, frame, p[0], p[1], 0.42, dirX < -30) })
    })
    ds.push({ y: a.y, f: () => drawHero(ctx, sheets.hero, row, frame, a.x, a.y, 0.46, dirX < -30) })
    ds.sort((p, q) => p.y - q.y).forEach((d) => d.f())
    // 출발점 표지
    keyCap(ctx, '설원 어귀', LANE_X[1], START_Y + 26)
    if (s.layer === LAYERS - 1 && !s.done && !s.ask && !a.walk) keyCap(ctx, '↑ 능선으로 (체온 −28 · 허기 −16)', VW / 2, RIDGE_Y + 2, '#ffe9a8')
    ctx.restore()

    // 눈발 — 눈보라 거점 근처면 거세게
    const stormy = s.layer >= 0 && s.layer < LAYERS && map[s.layer]?.[s.col] === 'storm'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (const f of a.snow) {
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s > 1 ? 2 : 1, f.s > 1 ? 2 : 1)
      if (stormy) ctx.fillRect(Math.round(f.x - 6), Math.round(f.y + 3), 4, 1)
    }
    if (stormy) {
      ctx.fillStyle = 'rgba(220,232,245,0.28)'
      ctx.fillRect(0, 0, VW, VH)
    }
    // 차가운 가장자리
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VW * 0.6)
    v.addColorStop(0, 'rgba(20,40,70,0)')
    v.addColorStop(1, `rgba(20,40,70,${0.25 + Math.max(0, 50 - s.warm) / 120})`)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VW, VH)
  }

  useCanvasLoop(cv, true, update, draw)

  const canAny = !st.done && !st.ask && st.layer < LAYERS - 1
  return (
    <div className="pst-wrap">
      <StageHud
        lives={hud.hp}
        bars={[
          { label: '체온', v: hud.warm, tone: 'warm' },
          { label: '허기', v: hud.food, tone: 'food' },
        ]}
        items={[{ label: '능선까지', value: `${Math.max(0, LAYERS - 1 - st.layer)}갈래 + 눈보라` }]}
      />
      <div className="pst-stage">
        <canvas
          ref={cv}
          className="pst-canvas"
          onPointerDown={(e) => {
            // 거점을 눌러서 고르기
            const r = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width) * VW
            const c = LANE_X.reduce((b, lx, i) => (Math.abs(lx - x) < Math.abs(LANE_X[b] - x) ? i : b), 0)
            if (stRef.current.layer === LAYERS - 1) goRidge()
            else go(c)
          }}
        />
        <div className={`pst-log ${anim.current.pop > 0 ? 'is-pop' : ''}`}>{st.log}</div>
      </div>
      <div className="pst-pad">
        {st.ask ? (
          <>
            <button type="button" className="pst-btn is-big" onClick={() => tracks(true)}>
              <span>따라간다</span>
            </button>
            <button type="button" className="pst-btn" onClick={() => tracks(false)}>
              <span>지나친다</span>
            </button>
          </>
        ) : st.layer === LAYERS - 1 && !st.done ? (
          <button type="button" className="pst-btn is-big" onClick={goRidge}>
            <span>능선으로 오른다</span>
            <small>체온 −28 · 허기 −16</small>
          </button>
        ) : (
          (
            [
              ['left', '←', 0],
              ['up', '↑', 1],
              ['right', '→', 2],
            ] as [Key, string, number][]
          ).map(([k, l, i]) => {
            const col = st.layer < 0 ? i : st.col + i - 1
            const ok = canAny && col >= 0 && col <= 2
            const kind = ok ? map[st.layer + 1]?.[col] : undefined
            return (
              <button key={k} type="button" className="pst-btn" disabled={!ok} onClick={() => go(col)}>
                <span>
                  {l} {kind ? NODE[kind].name : ''}
                </span>
                {kind && <small>{NODE[kind].hint}</small>}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function drawNodeFallback(ctx: CanvasRenderingContext2D, k: NodeKind, x: number, y: number, t: number) {
  if (k === 'storm') {
    ctx.strokeStyle = 'rgba(230,240,255,0.9)'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x, y - 18, 6 + i * 6, t * 3 + i, t * 3 + i + 4)
      ctx.stroke()
    }
    return
  }
  if (k === 'tracks') {
    ctx.fillStyle = '#7a8aa6'
    for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x - 14 + i * 7), Math.round(y - 8 - (i % 2) * 6), 5, 4)
    return
  }
  ctx.fillStyle = '#6b5a48'
  ctx.fillRect(x - 10, y - 20, 20, 18)
}
