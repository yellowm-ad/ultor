'use client'

// ============================================================================
// 폭풍의 나선 계단(2026-11-02 재제작) — 스톰헤이븐으로 오르는 8층 탑을 옆에서 본 실시간 스테이지
//   · 탑 안의 계단이 층마다 좌우로 꺾이며 올라간다(오른쪽으로 오르는 단 = 앞쪽 · 왼쪽 단 = 기둥 뒤쪽, 어둡게)
//   · 일행은 저절로 오른다. 함정은 다가오는 순간 맞는 동작으로 피한다
//       바닥 가시 · 마법 룬     → Space(뛰기)
//       벽 칼날(머리 높이)       → S / ↓(숙이기)
//       굴러오는 바위            → W / ↑(벽에 붙기)
//   · 세 번 맞으면 실패. 맞으면 잠깐 뒤로 밀리고 1초 무적
// 그림: public/images/passage/spiral/*.png (PixelLab) — 없으면 절차적으로 그린다
// ============================================================================

import { useMemo, useRef } from 'react'
import { useGame } from '@/lib/game-state'
import { schoolNpcById } from '@/lib/companions'
import { drawHero, keyCap, noFlash, rng, useCanvasLoop, useHud, useImages, useInput, VH, VW, type Key } from './px-engine'
import { StageHud, TouchPad } from './stage-ui'

const FLOORS = 8
const X0 = 64 // 계단 왼쪽 끝
const X1 = 416 // 오른쪽 끝
const LAND = 28 // 층계참 폭
const RUN = X1 - X0 // 한 층 계단의 가로 길이
const RISE = 104 // 한 층 높이
const SEG = RUN + LAND // 한 층 경로 길이(가로 기준)
const TOTAL = SEG * FLOORS
const SPEED = 54 // px/s (2026-11-02 난이도 완화: 66 → 54)
const STEP_W = 16
const JUMP_T = 0.78
const DUCK_T = 0.95
const HIDE_T = 1.1

type TrapKind = 'spike' | 'rune' | 'blade' | 'boulder'
interface Trap {
  kind: TrapKind
  s: number // 경로 위치
  done: boolean
  /** 바위: 지금 경로 위치(위에서 굴러 내려온다) · 칼날: 튀어나온 정도 0~1 */
  pos: number
  live: boolean
}
const NEED: Record<TrapKind, { key: string; act: 'jump' | 'duck' | 'hide'; name: string }> = {
  spike: { key: 'Space', act: 'jump', name: '바닥 가시' },
  rune: { key: 'Space', act: 'jump', name: '마법 룬' },
  blade: { key: 'S ↓', act: 'duck', name: '벽 칼날' },
  boulder: { key: 'W ↑', act: 'hide', name: '굴러오는 바위' },
}

/** 경로 위치 s → 화면 좌표(세계 y 는 위로 갈수록 작다), 진행 방향, 층 */
function pathAt(s: number) {
  const f = Math.max(0, Math.min(FLOORS - 1, Math.floor(s / SEG)))
  const r = Math.min(SEG, s - f * SEG)
  const dir = f % 2 === 0 ? 1 : -1
  const base = -f * RISE
  if (r < LAND) {
    // 층계참 — 바깥으로 나갔다가 몸을 돌려 이번 층 계단 쪽으로
    const edge = dir > 0 ? X0 : X1
    const half = LAND / 2
    const out = r < half ? r * 2 : LAND - (r - half) * 2
    return { x: edge - dir * out, y: base, dir: r < half ? -dir : dir, f, onStair: false }
  }
  const k = (r - LAND) / RUN
  const x = dir > 0 ? X0 + k * RUN : X1 - k * RUN
  // 계단은 단 단위로 오른다(단 i 위에서는 그 단의 윗면)
  const steps = RUN / STEP_W
  const i = Math.min(steps - 1, Math.floor(k * steps))
  const y = base - (i + 1) * (RISE / steps)
  return { x, y, dir, f, onStair: true }
}

function makeTraps(seed: number): Trap[] {
  const r = rng(seed)
  const out: Trap[] = []
  const kinds: TrapKind[] = ['spike', 'blade', 'boulder', 'rune']
  // 1층은 하나씩 차례로 보여 주고, 위로 갈수록 촘촘하게
  let s = SEG * 0.55
  let i = 0
  while (s < TOTAL - SEG * 0.3) {
    const f = Math.floor(s / SEG)
    const kind = i < 4 ? kinds[i] : kinds[Math.floor(r() * kinds.length)]
    // 층계참 위에는 두지 않는다
    const rr = s - f * SEG
    if (rr < LAND + 30 || rr > SEG - 30) {
      s += 40
      continue
    }
    out.push({ kind, s, done: false, pos: 0, live: false })
    const gap = Math.max(140, 240 - f * 12) * (0.85 + r() * 0.45)
    s += gap
    i++
  }
  return out
}

const P = '/images/passage/spiral/'
const SRC = {
  wall: P + 'wall.png',
  wall2: P + 'wall2.png',
  spike: P + 'spike.png',
  blade: P + 'blade.png',
  boulder: P + 'boulder.png',
  rune: P + 'rune.png',
  window: P + 'window.png',
  windowBolt: P + 'window-bolt.png',
  torch0: P + 'torch0.png',
  torch1: P + 'torch1.png',
  torch2: P + 'torch2.png',
}

export function SpiralStage({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const { state } = useGame()
  const heroSheet = `/images/sprites/protag-${state.player.appearance.gender}.png`
  const mates = state.companions.party
    .map((id) => schoolNpcById(id)?.sprite)
    .filter(Boolean)
    .slice(0, 3) as string[]
  const sheets = useImages({
    hero: heroSheet,
    m0: mates[0] ? `/images/sprites/${mates[0]}.png` : heroSheet,
    m1: mates[1] ? `/images/sprites/${mates[1]}.png` : heroSheet,
    m2: mates[2] ? `/images/sprites/${mates[2]}.png` : heroSheet,
  })
  const img = useImages(SRC)
  const seed = useMemo(() => (Math.random() * 1e9) | 0, [])
  const cv = useRef<HTMLCanvasElement | null>(null)
  const input = useInput(true)
  const g = useRef({
    s: LAND / 2,
    /** 시작 연출 — 탑 꼭대기에서 일행까지 카메라가 내려온다 */
    intro: 3.2,
    lives: 4,
    jump: 0,
    duck: 0,
    hide: 0,
    inv: 0,
    flash: 0,
    shake: 0,
    knock: 0,
    over: false,
    t: 0,
    traps: makeTraps(seed),
    note: '',
    noteT: 0,
    bolt: 0,
    nextBolt: 3,
    rain: Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % VW, y: (i * 97) % VH })),
    trail: [] as number[],
  })
  const [hud, setHud] = useHud({ lives: 4, floor: 1, pct: 0 })

  const press = (k: Key) => {
    const st = g.current
    if (st.over) return
    if (k === 'jump' && st.jump <= 0 && st.duck <= 0) st.jump = JUMP_T
    if (k === 'down' && st.jump <= 0) st.duck = DUCK_T
    if (k === 'up' && st.jump <= 0) st.hide = HIDE_T
  }

  const update = (dt: number) => {
    const st = g.current
    if (st.over) return
    if (st.intro > 0) {
      st.intro = Math.max(0, st.intro - dt)
      input.pressed.clear()
      if (input.held.size) st.intro = Math.min(st.intro, 0.4) // 키를 누르면 연출을 빨리 끝낸다
      return
    }
    st.t += dt
    for (const k of input.pressed) press(k)
    input.pressed.clear()
    st.jump = Math.max(0, st.jump - dt)
    st.duck = Math.max(0, st.duck - dt)
    st.hide = Math.max(0, st.hide - dt)
    st.inv = Math.max(0, st.inv - dt)
    st.flash = Math.max(0, st.flash - dt)
    st.shake = Math.max(0, st.shake - dt)
    st.noteT = Math.max(0, st.noteT - dt)
    st.bolt = Math.max(0, st.bolt - dt)
    st.nextBolt -= dt
    if (st.nextBolt <= 0) {
      st.bolt = 0.35
      st.nextBolt = 3 + Math.random() * 5
    }
    // 밀려나는 중이면 뒤로, 아니면 앞으로(벽에 붙거나 숙이면 조금 느리게)
    if (st.knock > 0) {
      st.knock = Math.max(0, st.knock - dt)
      st.s = Math.max(0, st.s - 90 * dt)
    } else st.s += SPEED * dt * (st.hide > 0 ? 0.35 : st.duck > 0 ? 0.75 : 1)
    st.trail.unshift(st.s)
    if (st.trail.length > 90) st.trail.length = 90

    for (const tr of st.traps) {
      if (tr.done) continue
      const ahead = tr.s - st.s
      if (tr.kind === 'boulder') {
        // 플레이어가 150px 안에 오면 위에서 굴러 내려온다
        if (!tr.live && ahead < 170) {
          tr.live = true
          tr.pos = tr.s + 60
        }
        if (tr.live) {
          tr.pos -= 105 * dt
          const d = tr.pos - st.s
          if (Math.abs(d) < 9) {
            if (st.hide > 0 || st.inv > 0) {
              if (st.hide > 0) say(st, '벽에 붙어 바위를 흘려보냈다!')
              tr.done = true
            } else hit(st, tr)
          } else if (d < -40) tr.done = true
        }
        continue
      }
      if (tr.kind === 'blade') {
        tr.pos = ahead < 70 && ahead > -30 ? Math.min(1, tr.pos + dt * 5) : Math.max(0, tr.pos - dt * 3)
      }
      if (tr.kind === 'spike' || tr.kind === 'rune') tr.pos = ahead < 60 ? Math.min(1, tr.pos + dt * 6) : 0
      if (Math.abs(ahead) < (tr.kind === 'rune' ? 9 : 7)) {
        const need = NEED[tr.kind].act
        const ok = (need === 'jump' && st.jump > 0) || (need === 'duck' && st.duck > 0)
        if (ok || st.inv > 0) {
          if (ok) say(st, tr.kind === 'blade' ? '칼날 아래로 숙였다!' : '훌쩍 뛰어넘었다!')
          tr.done = true
        } else hit(st, tr)
      } else if (ahead < -14) tr.done = true
    }
    if (st.lives <= 0) {
      st.over = true
      window.setTimeout(() => onEnd(false), 700)
    } else if (st.s >= TOTAL) {
      st.over = true
      window.setTimeout(() => onEnd(true), 600)
    }
    const p = pathAt(st.s)
    setHud({ lives: st.lives, floor: Math.min(FLOORS, p.f + 1), pct: Math.round((st.s / TOTAL) * 100) })
  }

  function say(st: typeof g.current, msg: string) {
    st.note = msg
    st.noteT = 0.9
  }
  function hit(st: typeof g.current, tr: Trap) {
    tr.done = true
    st.lives -= 1
    st.inv = 1.8
    st.flash = 0.25
    st.shake = 0.3
    st.knock = 0.35
    say(st, `${NEED[tr.kind].name}에 맞았다!`)
  }

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const st = g.current
    const me = pathAt(st.s)
    // 카메라 — 주인공을 화면 아래 60% 쯤에
    let camY = Math.round(me.y - VH * 0.62)
    if (st.intro > 0) {
      // 꼭대기(스톰헤이븐 문)에서 출발점까지 천천히
      const k = Math.min(1, st.intro / 2.6)
      const e = k * k * (3 - 2 * k)
      const topY = -FLOORS * RISE - VH * 0.45
      camY = Math.round(camY + (topY - camY) * e)
    }
    const sh = st.shake > 0 ? Math.round((Math.random() - 0.5) * 6) : 0
    ctx.save()
    ctx.translate(sh, -camY)

    drawTowerBack(ctx, img, camY, t, st.bolt)

    // 뒤쪽(왼쪽으로 오르는) 계단 → 가운데 기둥 → 앞쪽 계단 순서로 — 나선을 도는 느낌
    for (const front of [false, true]) {
      for (let f = 0; f < FLOORS; f++) {
        const isFront = f % 2 === 0
        if (isFront !== front) continue
        const base = -f * RISE
        if (base - RISE > camY + VH + 40 || base < camY - 40) continue
        drawFlight(ctx, img, f, front)
      }
      if (!front) {
        // 주인공이 기둥 뒤를 지날 때는 기둥을 비친다
        const behind = me.dir < 0 && me.onStair && Math.abs(me.x - VW / 2) < 60
        drawPillar(ctx, camY, behind ? 0.45 : 1)
      }
    }
    // 꼭대기 문
    drawTopGate(ctx, -FLOORS * RISE, t)

    // 함정
    for (const tr of st.traps) {
      if (tr.done && tr.kind !== 'spike' && tr.kind !== 'rune' && tr.kind !== 'blade') continue
      drawTrap(ctx, img, tr, t)
    }

    // 일행(뒤따라 온다)
    const party = [sheets.m2, sheets.m1, sheets.m0].filter((_, i) => mates.length > 2 - i)
    party.forEach((sheet, i) => {
      const idx = (party.length - i) * 16
      const s = st.trail[Math.min(idx, st.trail.length - 1)] ?? 0
      const p = pathAt(Math.max(0, s - (party.length - i) * 4))
      const fr = Math.floor(t * 9 + i * 2) % 8
      drawHero(ctx, sheet, 2, fr, p.x, p.y, 0.5, p.dir < 0, 0.92)
    })
    // 주인공
    const jumpH = st.jump > 0 ? Math.sin((1 - st.jump / JUMP_T) * Math.PI) * 30 : 0
    const blink = st.inv > 0 && Math.floor(t * 16) % 2 === 0
    if (!blink) {
      const fr = st.over ? 0 : Math.floor(t * 10) % 8
      if (st.hide > 0) {
        // 벽에 붙기 — 뒤로 반 칸 물러나 어둡게
        ctx.globalAlpha = 0.65
        drawHero(ctx, sheets.hero, 0, 4, me.x, me.y - 6, 0.52, false)
        ctx.globalAlpha = 1
      } else if (st.duck > 0) {
        ctx.save()
        ctx.translate(me.x, me.y)
        ctx.scale(1, 0.62)
        drawHero(ctx, sheets.hero, 2, 3, 0, 0, 0.55, me.dir < 0)
        ctx.restore()
      } else drawHero(ctx, sheets.hero, 2, st.jump > 0 ? 5 : fr, me.x, me.y - jumpH, 0.55, me.dir < 0)
    }

    // 다가오는 함정 키 안내
    for (const tr of st.traps) {
      if (tr.done) continue
      const ahead = (tr.kind === 'boulder' && tr.live ? tr.pos : tr.s) - st.s
      if (ahead > 0 && ahead < 150) {
        const p = pathAt(tr.kind === 'boulder' && tr.live ? tr.pos : tr.s)
        keyCap(ctx, NEED[tr.kind].key, p.x, p.y - 46, ahead < 55 ? '#ff8a6a' : '#ffe9a8')
      }
    }
    ctx.restore()

    // 비 · 번개(창밖 폭풍) — 화면 고정 레이어
    ctx.fillStyle = 'rgba(190,210,235,0.18)'
    for (const d of st.rain) {
      d.y += 7
      d.x -= 2
      if (d.y > VH) {
        d.y = -10
        d.x = Math.random() * (VW + 60)
      }
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 6)
    }
    if (st.flash > 0) {
      ctx.fillStyle = `rgba(160,30,20,${noFlash() ? 0.12 : 0.28})`
      ctx.fillRect(0, 0, VW, VH)
    }
    // 가장자리 어둡게(비네트)
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VW, VH)
    if (st.noteT > 0) {
      ctx.globalAlpha = Math.min(1, st.noteT * 3)
      keyCap(ctx, st.note, VW / 2, 22)
      ctx.globalAlpha = 1
    }
    if (st.intro > 0) {
      keyCap(ctx, st.intro > 1.2 ? `폭풍의 탑 — ${FLOORS}층` : '출발!', VW / 2, VH - 26)
    }
  }

  useCanvasLoop(cv, true, update, draw)

  return (
    <div className="pst-wrap">
      <StageHud lives={hud.lives} maxLives={4} items={[{ label: '층', value: `${hud.floor} / ${FLOORS}` }]} progress={{ label: '스톰헤이븐까지', pct: hud.pct }} />
      <div className="pst-stage">
        <canvas ref={cv} className="pst-canvas" />
      </div>
      <TouchPad
        buttons={[
          { k: 'up', label: '벽에 붙기', sub: 'W ↑' },
          { k: 'down', label: '숙이기', sub: 'S ↓' },
          { k: 'jump', label: '뛰기', sub: 'Space', big: true },
        ]}
        onTap={(k) => input.tap(k)}
      />
    </div>
  )
}

// ── 그리기 ──────────────────────────────────────────────────────────────────
type Img = Record<keyof typeof SRC, HTMLImageElement | null>

function drawTowerBack(ctx: CanvasRenderingContext2D, img: Img, camY: number, t: number, bolt: number) {
  const top = camY - 20
  const bot = camY + VH + 20
  // 벽돌 벽
  if (img.wall && img.wall2) {
    const y0 = Math.floor(top / 64) * 64
    for (let y = y0; y < bot; y += 64)
      for (let x = 0, i = 0; x < VW; i++) {
        const w = (i + Math.abs(y / 64)) % 3 === 0 ? img.wall2 : img.wall
        ctx.drawImage(w, x, y)
        x += w.width
      }
  } else {
    ctx.fillStyle = '#3b332b'
    ctx.fillRect(0, top, VW, bot - top)
    ctx.fillStyle = '#2c251f'
    for (let y = Math.floor(top / 12) * 12; y < bot; y += 12) {
      ctx.fillRect(0, y, VW, 1)
      for (let x = (y / 12) % 2 ? 0 : 14; x < VW; x += 28) ctx.fillRect(x, y, 1, 12)
    }
  }
  // 따뜻한 조명 + 아래로 갈수록 어둡게
  ctx.fillStyle = 'rgba(20,12,6,0.35)'
  ctx.fillRect(0, top, VW, bot - top)
  // 가운데 기둥(나선의 축) — 뒤쪽 계단을 가린다
  // 창문과 횃불 — 층마다
  for (let f = -1; f <= FLOORS + 1; f++) {
    const y = -f * RISE - 70
    if (y < top - 80 || y > bot) continue
    const wx = f % 2 ? 110 : VW - 110
    if (img.window && img.windowBolt) {
      const wi = bolt > 0 && !noFlash() ? img.windowBolt : img.window
      ctx.drawImage(wi, Math.round(wx - wi.width * 0.4), y - 30, Math.round(wi.width * 0.8), Math.round(wi.height * 0.8))
    } else {
      ctx.fillStyle = bolt > 0 ? '#b8c4e8' : '#18202e'
      ctx.fillRect(wx - 12, y - 18, 24, 30)
      ctx.fillStyle = '#6b5a48'
      ctx.fillRect(wx - 14, y - 20, 28, 3)
    }
    const tx = f % 2 ? VW - 60 : 60
    const fl = Math.floor(t * 8 + f) % 3
    const ti = [img.torch0, img.torch1, img.torch2][fl]
    if (ti) ctx.drawImage(ti, Math.round(tx - ti.width * 0.3), y - 14 + Math.round((57 - ti.height) * 0.6), Math.round(ti.width * 0.6), Math.round(ti.height * 0.6))
    else {
      ctx.fillStyle = '#4a3b2c'
      ctx.fillRect(tx - 2, y + 8, 4, 10)
      ctx.fillStyle = ['#ff9a3c', '#ffc35a', '#ff7a2a'][fl]
      ctx.fillRect(tx - 3, y + 1, 6, 7)
    }
    // 횃불 빛 번짐
    const lg = ctx.createRadialGradient(tx, y + 6, 2, tx, y + 6, 60)
    lg.addColorStop(0, 'rgba(255,170,80,0.22)')
    lg.addColorStop(1, 'rgba(255,170,80,0)')
    ctx.fillStyle = lg
    ctx.fillRect(tx - 60, y - 54, 120, 120)
  }
  // 원통형 탑 벽 — 양 끝으로 갈수록 어둡게 휘어 보이게
  const cyl = ctx.createLinearGradient(0, 0, VW, 0)
  cyl.addColorStop(0, 'rgba(6,4,2,0.82)')
  cyl.addColorStop(0.16, 'rgba(6,4,2,0.25)')
  cyl.addColorStop(0.5, 'rgba(6,4,2,0)')
  cyl.addColorStop(0.84, 'rgba(6,4,2,0.25)')
  cyl.addColorStop(1, 'rgba(6,4,2,0.82)')
  ctx.fillStyle = cyl
  ctx.fillRect(0, top, VW, bot - top)
}

function drawPillar(ctx: CanvasRenderingContext2D, camY: number, alpha: number) {
  const top = camY - 20
  const bot = camY + VH + 20
  const g = ctx.createLinearGradient(VW / 2 - 30, 0, VW / 2 + 30, 0)
  g.addColorStop(0, '#221a13')
  g.addColorStop(0.4, '#6a5644')
  g.addColorStop(0.55, '#57473a')
  g.addColorStop(1, '#1a140f')
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fillRect(VW / 2 - 30, top, 60, bot - top)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  for (let y = Math.floor(top / 18) * 18; y < bot; y += 18) {
    ctx.fillRect(VW / 2 - 30, y, 60, 1)
    ctx.fillRect(VW / 2 + ((y / 18) % 2 ? -10 : 8), y, 1, 18)
  }
  // 층 표지(기둥에 새긴 숫자)
  ctx.font = 'bold 10px "Gowun Batang", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let f = 0; f < FLOORS; f++) {
    const y = -f * RISE - 40
    if (y < top || y > bot) continue
    ctx.fillStyle = '#2a1f15'
    ctx.fillRect(VW / 2 - 11, y - 8, 22, 16)
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(VW / 2 - 11, y - 8, 22, 1)
    ctx.fillRect(VW / 2 - 11, y + 7, 22, 1)
    ctx.fillText(`${f + 1}F`, VW / 2, y + 1)
  }
  ctx.fillStyle = '#120d08'
  ctx.fillRect(VW / 2 - 31, top, 1, bot - top)
  ctx.fillRect(VW / 2 + 30, top, 1, bot - top)
  ctx.restore()
}

function drawFlight(ctx: CanvasRenderingContext2D, img: Img, f: number, front: boolean) {
  const dir = f % 2 === 0 ? 1 : -1
  const base = -f * RISE
  const steps = RUN / STEP_W
  const rise = RISE / steps
  const shade = front ? 0 : 0.45
  // 계단 밑 석조 받침(두꺼운 띠) — 떠 있는 띠처럼 보이지 않게
  const sx0 = dir > 0 ? X0 - LAND : X1 + LAND
  const sx1 = dir > 0 ? X1 : X0
  ctx.fillStyle = front ? '#3b2e22' : '#241b14'
  ctx.beginPath()
  ctx.moveTo(sx0, base + 14)
  ctx.lineTo(dir > 0 ? X0 : X1, base + 14)
  ctx.lineTo(sx1, base - RISE + 14)
  ctx.lineTo(sx1, base - RISE + 44)
  ctx.lineTo(dir > 0 ? X0 : X1, base + 44)
  ctx.lineTo(sx0, base + 44)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = front ? 'rgba(255,210,150,0.08)' : 'rgba(0,0,0,0.2)'
  ctx.fillRect(Math.min(sx0, dir > 0 ? X0 : X1), base + 40, LAND, 4)
  // 층계참
  const lx = dir > 0 ? X0 - LAND : X1
  stoneBlock(ctx, img, lx, base, LAND, 18, shade)
  for (let i = 0; i < steps; i++) {
    const x = dir > 0 ? X0 + i * STEP_W : X1 - (i + 1) * STEP_W
    const y = base - Math.round((i + 1) * rise)
    stoneBlock(ctx, img, x, y, STEP_W, 14 + Math.round(rise), shade)
  }
  // 위층 층계참까지 이어지는 난간 기둥(앞쪽만)
  if (front) {
    ctx.fillStyle = '#1c1510'
    for (let i = 0; i <= steps; i += 4) {
      const x = dir > 0 ? X0 + i * STEP_W : X1 - i * STEP_W
      const y = base - Math.round(i * rise)
      ctx.fillRect(Math.round(x), y + 10, 2, 8)
    }
  }
}

function stoneBlock(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, w: number, h: number, shade: number) {
  x = Math.round(x)
  y = Math.round(y)
  // 디딤돌 — 벽 타일과 같은 따뜻한 돌색(윗면 밝게, 앞면 어둡게, 이음매)
  void img
  ctx.fillStyle = '#7d6550'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#b39572'
  ctx.fillRect(x, y, w, 2)
  ctx.fillStyle = '#94785c'
  ctx.fillRect(x, y + 2, w, 2)
  ctx.fillStyle = '#4e3d2e'
  ctx.fillRect(x, y + h - 3, w, 3)
  ctx.fillRect(x + w - 1, y + 2, 1, h)
  ctx.fillStyle = '#5f4a38'
  if (w > 20) for (let i = 8; i < w; i += 14) ctx.fillRect(x + i, y + 5, 1, h - 8)
  ctx.fillStyle = '#120d08'
  ctx.fillRect(x, y, w, 1)
  if (shade) {
    ctx.fillStyle = `rgba(12,8,5,${shade})`
    ctx.fillRect(x, y, w, h)
  }
}

function drawTopGate(ctx: CanvasRenderingContext2D, y: number, t: number) {
  const x = X0 - LAND - 4
  ctx.fillStyle = '#1a140f'
  ctx.fillRect(x - 6, y - 60, 40, 60)
  const glow = 0.55 + Math.sin(t * 3) * 0.15
  ctx.fillStyle = `rgba(200,225,255,${glow})`
  ctx.fillRect(x, y - 54, 28, 54)
  ctx.fillStyle = '#d9a441'
  ctx.fillRect(x - 6, y - 62, 40, 3)
}

function drawTrap(ctx: CanvasRenderingContext2D, img: Img, tr: Trap, t: number) {
  if (tr.kind === 'boulder') {
    if (!tr.live || tr.done) return
    const p = pathAt(tr.pos)
    ctx.save()
    ctx.translate(Math.round(p.x), Math.round(p.y - 12))
    ctx.rotate(-tr.pos / 12 * p.dir)
    if (img.boulder) ctx.drawImage(img.boulder, -13, -13, 26, 26)
    else {
      ctx.fillStyle = '#7a6753'
      ctx.beginPath()
      ctx.arc(0, 0, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3d3228'
      ctx.fillRect(-4, -2, 8, 2)
    }
    ctx.restore()
    return
  }
  const p = pathAt(tr.s)
  if (tr.kind === 'spike') {
    const h = Math.round(5 + tr.pos * 12)
    if (img.spike) ctx.drawImage(img.spike, Math.round(p.x - 11), Math.round(p.y - h), 22, h + 2)
    else {
      ctx.fillStyle = '#d8d2c2'
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(p.x + i * 4 - 2, p.y)
        ctx.lineTo(p.x + i * 4, p.y - h)
        ctx.lineTo(p.x + i * 4 + 2, p.y)
        ctx.fill()
      }
    }
  } else if (tr.kind === 'rune') {
    const a = 0.55 + Math.sin(t * 8) * 0.25 + tr.pos * 0.2
    ctx.globalAlpha = Math.min(1, a)
    if (img.rune) ctx.drawImage(img.rune, Math.round(p.x - 15), Math.round(p.y - 7), 30, 10)
    else {
      ctx.fillStyle = '#b78cff'
      ctx.fillRect(Math.round(p.x - 12), Math.round(p.y - 3), 24, 3)
    }
    ctx.globalAlpha = 1
    if (tr.pos > 0.3) {
      ctx.fillStyle = `rgba(183,140,255,${0.25 * tr.pos})`
      ctx.fillRect(Math.round(p.x - 10), Math.round(p.y - 30 * tr.pos), 20, Math.round(30 * tr.pos))
    }
  } else if (tr.kind === 'blade') {
    // 벽 틈에서 머리 높이로 튀어나와 길을 가로막는 칼날 — 다가오는 쪽을 향한다
    const y = Math.round(p.y - 26)
    const ahead = p.dir // 진행 방향
    const slotX = Math.round(p.x + ahead * 12)
    if (img.blade) {
      const w = Math.round(14 + tr.pos * 16)
      ctx.save()
      ctx.translate(slotX, y)
      // 그림은 칼끝이 오른쪽 — 진행 방향이 오른쪽이면 왼쪽(다가오는 쪽)을 향하게 뒤집는다
      if (ahead > 0) ctx.scale(-1, 1)
      ctx.drawImage(img.blade, 0, 0, img.blade.width, img.blade.height, -4, -14, w, 28)
      ctx.restore()
    } else {
      ctx.fillStyle = '#c8cdd4'
      ctx.fillRect(Math.min(slotX, slotX - ahead * 24), y - 1, 24, 3)
    }
    if (tr.pos > 0 && tr.pos < 1) {
      ctx.fillStyle = 'rgba(255,120,80,0.7)'
      ctx.fillRect(slotX - 1, y - 14, 2, 28)
    }
  }
}
