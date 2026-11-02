'use client'

// ============================================================================
// 아틀란티스로 가는 배(2026-11-02 재제작) — 전투 화면처럼 옆에서 보는 횡스크롤 러너
//   · 범선은 계속 앞으로 달리고, 바다 위 장애물이 오른쪽에서 다가온다(크롬 공룡 게임 느낌)
//       암초 · 큰 파도 · 크라켄 촉수(물 위)   → Space(너울을 타고 뛰어넘기, 길게 누르면 더 높이)
//       날치 떼(돛 높이로 날아온다)           → S / ↓(돛을 내리고 엎드리기)
//   · 공중의 금빛 물고기는 뛰어올라 받으면 잡는다(통과하면 가방에 — 최대 5마리)
//   · 하트 3개. 아틀란티스에 닿으면 통과
// 그림: public/images/passage/voyage/*.png (PixelLab)
// ============================================================================

import { useMemo, useRef } from 'react'
import { useGame } from '@/lib/game-state'
import { schoolNpcById } from '@/lib/companions'
import { drawHero, keyCap, rng, useCanvasLoop, useHud, useImages, useInput, VH, VW, type Key } from './px-engine'
import { StageHud, TouchPad } from './stage-ui'

const WY = 214 // 수면(배 바닥) 높이
const SHIP_X = 112 // 배 가운데
const DIST = 5200 // 아틀란티스까지
const GRAV = 820
const JUMP_V = -320 // 2026-11-02 난이도 완화 — 더 높이 뜨고 판정 상자는 작게
const HOLD_GRAV = 0.42 // 누르고 있는 동안 중력 배율(최대 0.24초)

type ObKind = 'reef' | 'wave' | 'tentacle' | 'fishes' | 'gold'
interface Ob {
  kind: ObKind
  x: number
  /** 그림 변형 번호 */
  v: number
  /** 크라켄: 솟아오른 정도 0~1 · 날치 떼: 높이 흔들림 위상 */
  k: number
  hit: boolean
}
const OB_BOX: Record<ObKind, { w: number; top: number; bot: number }> = {
  reef: { w: 26, top: WY - 22, bot: WY + 4 },
  wave: { w: 30, top: WY - 34, bot: WY + 4 },
  tentacle: { w: 20, top: WY - 44, bot: WY + 4 },
  fishes: { w: 30, top: WY - 96, bot: WY - 74 },
  gold: { w: 30, top: WY - 110, bot: WY - 78 },
}
const OB_NAME: Record<ObKind, string> = { reef: '암초', wave: '큰 파도', tentacle: '크라켄 촉수', fishes: '날치 떼', gold: '' }

const P = '/images/passage/voyage/'
const SRC = {
  ship: P + 'ship.png',
  bg: P + 'bg.png',
  wave0: P + 'wave0.png',
  wave1: P + 'wave1.png',
  wave2: P + 'wave2.png',
  reef0: P + 'reef0.png',
  reef1: P + 'reef1.png',
  reef2: P + 'reef2.png',
  fish0: P + 'fish0.png',
  fish1: P + 'fish1.png',
  fish2: P + 'fish2.png',
  tentacle0: P + 'tentacle0.png',
  tentacle1: P + 'tentacle1.png',
  tentacle2: P + 'tentacle2.png',
}
type Img = Record<keyof typeof SRC, HTMLImageElement | null>

export function VoyageStage({ onEnd }: { onEnd: (ok: boolean, caught?: number) => void }) {
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
    r: rng(seed),
    dist: 0,
    speed: 120,
    y: 0, // 배가 수면에서 뜬 높이(위가 음수)
    vy: 0,
    air: false,
    hold: 0,
    duck: false,
    lives: 4,
    inv: 0,
    flash: 0,
    obs: [] as Ob[],
    next: 1.6,
    caught: 0,
    t: 0,
    over: false,
    note: '',
    noteT: 0,
    intro: 2.2,
    splash: [] as { x: number; y: number; vx: number; vy: number; life: number }[],
    gulls: Array.from({ length: 3 }, (_, i) => ({ x: 120 + i * 160, y: 40 + i * 14, p: i })),
  })
  const [hud, setHud] = useHud({ lives: 4, caught: 0, pct: 0 })

  const jump = () => {
    const st = g.current
    if (st.over || st.air) return
    st.air = true
    st.vy = JUMP_V
    st.hold = 0.24
    for (let i = 0; i < 8; i++) st.splash.push({ x: SHIP_X - 30 + Math.random() * 60, y: WY, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 80, life: 0.6 })
  }

  const update = (dt: number) => {
    const st = g.current
    if (st.over) return
    if (st.intro > 0) {
      st.intro = Math.max(0, st.intro - dt)
      input.pressed.clear()
      st.t += dt
      return
    }
    st.t += dt
    for (const k of input.pressed) if (k === 'jump' || k === 'up') jump()
    input.pressed.clear()
    const holdJump = input.held.has('jump') || input.held.has('up')
    st.duck = !st.air && input.held.has('down')
    // 점프 물리 — 누르고 있으면 조금 더 높이
    if (st.air) {
      const gm = holdJump && st.hold > 0 && st.vy < 0 ? HOLD_GRAV : 1
      st.hold = Math.max(0, st.hold - dt)
      st.vy += GRAV * gm * dt
      st.y += st.vy * dt
      if (st.y >= 0) {
        st.y = 0
        st.vy = 0
        st.air = false
        for (let i = 0; i < 12; i++) st.splash.push({ x: SHIP_X - 44 + Math.random() * 88, y: WY, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 120, life: 0.7 })
      }
    }
    st.speed = Math.min(185, 110 + st.dist * 0.016)
    st.dist += st.speed * dt
    st.inv = Math.max(0, st.inv - dt)
    st.flash = Math.max(0, st.flash - dt)
    st.noteT = Math.max(0, st.noteT - dt)

    // 장애물 생성 — 처음엔 하나씩 소개, 뒤로 갈수록 섞어서 촘촘하게
    st.next -= dt
    if (st.next <= 0 && st.dist < DIST - 500) {
      const r = st.r()
      const intro: ObKind[] = ['reef', 'fishes', 'wave', 'tentacle']
      const n = st.obs.filter((o) => o.kind !== 'gold').length
      const used = Math.floor(st.dist / 900)
      const kind: ObKind = used < intro.length && n === 0 ? intro[used] : r < 0.3 ? 'reef' : r < 0.52 ? 'fishes' : r < 0.78 ? 'wave' : 'tentacle'
      st.obs.push({ kind, x: VW + 40, v: Math.floor(st.r() * 3), k: kind === 'fishes' ? st.r() * 6 : 0, hit: false })
      // 금빛 물고기 — 가끔 공중에
      if (st.r() < 0.35) st.obs.push({ kind: 'gold', x: VW + 140 + st.r() * 60, v: 0, k: 0, hit: false })
      const base = Math.max(1.4, 2.6 - st.dist / 4500)
      st.next = base * (0.75 + st.r() * 0.6)
    }

    // 배의 판정 상자 — 선체(아래)와 돛(위)
    const shipBot = WY + st.y
    const hull = { x0: SHIP_X - 30, x1: SHIP_X + 28, y0: shipBot - 22, y1: shipBot }
    const sail = { x0: SHIP_X - 16, x1: SHIP_X + 16, y0: shipBot - (st.duck ? 50 : 88), y1: shipBot - 22 }
    for (const o of st.obs) {
      o.x -= (st.speed + (o.kind === 'fishes' ? 70 : 0)) * dt
      if (o.kind === 'tentacle') o.k = Math.min(1, o.k + dt * (o.x < VW - 60 ? 1.6 : 0))
      if (o.kind === 'fishes') o.k += dt * 6
      if (o.hit) continue
      const b = OB_BOX[o.kind]
      const ox0 = o.x - b.w / 2
      const ox1 = o.x + b.w / 2
      const top = o.kind === 'tentacle' ? WY - 44 * o.k : b.top
      const touches = (h: { x0: number; x1: number; y0: number; y1: number }) => ox1 > h.x0 && ox0 < h.x1 && b.bot > h.y0 && top < h.y1
      if (touches(hull) || touches(sail)) {
        o.hit = true
        if (o.kind === 'gold') {
          st.caught += 1
          say(st, '금빛 물고기를 낚아챘다!')
          continue
        }
        if (st.inv > 0) continue
        st.lives -= 1
        st.inv = 1.8
        st.flash = 0.3
        say(st, `${OB_NAME[o.kind]}에 부딪혔다!`)
      }
    }
    st.obs = st.obs.filter((o) => o.x > -80 && !(o.kind === 'gold' && o.hit))
    for (const p of st.splash) {
      p.vy += 300 * dt
      p.x += (p.vx - st.speed * 0.4) * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    st.splash = st.splash.filter((p) => p.life > 0)
    for (const gl of st.gulls) {
      gl.x -= (st.speed * 0.15 + 12) * dt
      if (gl.x < -20) {
        gl.x = VW + 20
        gl.y = 28 + Math.random() * 50
      }
    }
    if (st.lives <= 0) {
      st.over = true
      window.setTimeout(() => onEnd(false), 700)
    } else if (st.dist >= DIST) {
      st.over = true
      window.setTimeout(() => onEnd(true, st.caught), 900)
    }
    setHud({ lives: st.lives, caught: st.caught, pct: Math.round((st.dist / DIST) * 100) })
  }

  function say(st: typeof g.current, msg: string) {
    st.note = msg
    st.noteT = 1
  }

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const st = g.current
    const prog = Math.min(1, st.dist / DIST)
    drawSea(ctx, img, st.dist, prog, t)
    for (const gl of st.gulls) {
      const w = Math.sin(t * 8 + gl.p) > 0 ? 2 : 0
      ctx.fillStyle = '#f4f1e8'
      ctx.fillRect(Math.round(gl.x - 4), Math.round(gl.y + w), 3, 1)
      ctx.fillRect(Math.round(gl.x - 1), Math.round(gl.y + 1), 2, 1)
      ctx.fillRect(Math.round(gl.x + 1), Math.round(gl.y + w), 3, 1)
    }
    // 장애물(배 뒤쪽 레이어)
    for (const o of st.obs) drawOb(ctx, img, o, t)
    // 배 + 갑판의 일행
    const bob = st.air ? 0 : Math.round(Math.sin(t * 3.2) * 1.5)
    const tilt = st.air ? Math.max(-0.22, Math.min(0.18, st.vy / 1400)) : Math.sin(t * 1.7) * 0.025
    const blink = st.inv > 0 && Math.floor(t * 14) % 2 === 0
    ctx.save()
    ctx.translate(SHIP_X, WY + st.y + bob)
    ctx.rotate(tilt)
    if (!blink) {
      if (img.ship) {
        const w = img.ship.width
        const h = img.ship.height
        if (st.duck) {
          // 돛을 반쯤 내린다 — 위쪽(돛)만 눌러 그린다
          const cut = Math.round(h * 0.55)
          ctx.drawImage(img.ship, 0, 0, w, cut, -w / 2, -h + cut * 0.45, w, cut * 0.55)
          ctx.drawImage(img.ship, 0, cut, w, h - cut, -w / 2, -(h - cut), w, h - cut)
        } else ctx.drawImage(img.ship, -w / 2, -h + 4, w, h)
      } else {
        ctx.fillStyle = '#6b4a2b'
        ctx.fillRect(-44, -24, 88, 22)
        ctx.fillStyle = '#efe6d0'
        ctx.fillRect(-18, st.duck ? -54 : -90, 36, st.duck ? 30 : 66)
      }
      // 갑판 위 일행 — 배 앞에 그린다(엎드리면 낮게)
      const crew = [sheets.hero, ...[sheets.m0, sheets.m1, sheets.m2].slice(0, mates.length)]
      crew.forEach((sh, i) => {
        const cx = 14 - i * 13
        const foot = -30
        if (st.duck) {
          ctx.save()
          ctx.translate(cx, foot)
          ctx.scale(1, 0.55)
          drawHero(ctx, sh, 2, 2, 0, 0, 0.32)
          ctx.restore()
        } else drawHero(ctx, sh, 2, st.air ? 5 : Math.floor(t * 2 + i) % 2 ? 0 : 1, cx, foot, 0.32)
      })
    }
    ctx.restore()
    // 물보라
    ctx.fillStyle = 'rgba(240,250,255,0.9)'
    for (const p of st.splash) ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
    // 뱃머리 물살
    if (!st.air) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      for (let i = 0; i < 6; i++) {
        const x = SHIP_X + 44 - ((t * 60 + i * 9) % 54)
        ctx.fillRect(Math.round(x), WY - 2 + (i % 2), 4, 1)
      }
    }
    // 다가오는 장애물 키 안내
    for (const o of st.obs) {
      if (o.hit || o.kind === 'gold') continue
      const d = o.x - SHIP_X
      if (d > 40 && d < 260) keyCap(ctx, o.kind === 'fishes' ? 'S ↓' : 'Space', o.x, OB_BOX[o.kind].top - 14, d < 130 ? '#ff8a6a' : '#ffe9a8')
    }
    if (st.flash > 0) {
      ctx.fillStyle = 'rgba(160,30,20,0.22)'
      ctx.fillRect(0, 0, VW, VH)
    }
    if (st.noteT > 0) {
      ctx.globalAlpha = Math.min(1, st.noteT * 3)
      keyCap(ctx, st.note, VW / 2, 18)
      ctx.globalAlpha = 1
    }
    if (st.intro > 0) keyCap(ctx, st.intro > 1 ? '닻을 올려라!' : '출항!', VW / 2, VH / 2 - 40)
  }

  useCanvasLoop(cv, true, update, draw)

  return (
    <div className="pst-wrap">
      <StageHud lives={hud.lives} maxLives={4} items={[{ label: '잡은 물고기', value: `${hud.caught}` }]} progress={{ label: '아틀란티스까지', pct: hud.pct }} />
      <div className="pst-stage">
        <canvas ref={cv} className="pst-canvas" />
      </div>
      <TouchPad
        buttons={[
          { k: 'down', label: '엎드리기', sub: 'S ↓ (누르고 있기)' },
          { k: 'jump', label: '뛰어넘기', sub: 'Space (길게 = 높이)', big: true },
        ]}
        onTap={(k: Key) => {
          // 화면 버튼은 '누르고 있기'가 불편해서 — 엎드리기는 0.65초, 뛰기는 짧게 유지
          input.tap(k)
          input.held.add(k)
          window.setTimeout(() => input.held.delete(k), k === 'down' ? 650 : 200)
        }}
      />
    </div>
  )
}

// ── 그리기 ──────────────────────────────────────────────────────────────────
function drawSea(ctx: CanvasRenderingContext2D, img: Img, dist: number, prog: number, t: number) {
  // 하늘·수평선·아틀란티스 — 배경 한 장을 크게 깔고, 진행할수록 오른쪽(아틀란티스 쪽)으로 다가간다
  if (img.bg) {
    const s = 1.6
    const w = img.bg.width * s
    const h = img.bg.height * s
    const x = -Math.round((w - VW) * prog)
    ctx.drawImage(img.bg, 0, 0, img.bg.width, img.bg.height, x, Math.round(VH - h + 46), Math.round(w), Math.round(h))
  } else {
    const sk = ctx.createLinearGradient(0, 0, 0, VH)
    sk.addColorStop(0, '#5fb0e8')
    sk.addColorStop(0.6, '#bfe6f5')
    ctx.fillStyle = sk
    ctx.fillRect(0, 0, VW, VH)
  }
  // 가까운 바다 — 띠 몇 겹이 다른 속도로 흐른다
  const bands = [
    { y: WY - 8, c: '#2a86b8', sp: 0.35, a: '#5fb8de' },
    { y: WY + 6, c: '#1f6f9e', sp: 0.6, a: '#4aa3cf' },
    { y: WY + 22, c: '#175a84', sp: 0.9, a: '#3a8dbd' },
    { y: WY + 40, c: '#10476a', sp: 1.2, a: '#2f78a6' },
  ]
  for (const b of bands) {
    ctx.fillStyle = b.c
    ctx.fillRect(0, b.y, VW, VH - b.y)
    ctx.fillStyle = b.a
    const off = (dist * b.sp) % 48
    for (let x = -off; x < VW; x += 48) {
      const yy = b.y + Math.round(Math.sin((x + dist * b.sp) * 0.05 + t) * 1.5)
      ctx.fillRect(Math.round(x), yy, 22, 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillRect(Math.round(x + 4), yy, 8, 1)
      ctx.fillStyle = b.a
    }
  }
}

function drawOb(ctx: CanvasRenderingContext2D, img: Img, o: Ob, t: number) {
  const pick = <K extends keyof Img>(a: K, b: K, c: K) => [img[a], img[b], img[c]][o.v] ?? img[a]
  if (o.kind === 'gold') {
    const y = WY - 94 + Math.round(Math.sin(t * 4 + o.x * 0.05) * 3)
    const fi = img.fish0
    ctx.save()
    ctx.translate(Math.round(o.x), y)
    if (fi) {
      ctx.filter = 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15)'
      ctx.drawImage(fi, -10, -12, 20, 24)
      ctx.filter = 'none'
    } else {
      ctx.fillStyle = '#ffd84a'
      ctx.fillRect(-6, -3, 12, 6)
    }
    ctx.restore()
    ctx.fillStyle = `rgba(255,230,120,${0.35 + Math.sin(t * 8) * 0.2})`
    ctx.fillRect(Math.round(o.x) - 1, y - 16, 2, 4)
    return
  }
  if (o.kind === 'fishes') {
    // 날치 셋이 돛 높이로 날아든다
    const fi = pick('fish0', 'fish1', 'fish2')
    for (let i = 0; i < 3; i++) {
      const x = o.x + i * 14 - 14
      const y = WY - 84 + Math.round(Math.sin(o.k + i * 1.4) * 5) + (i === 1 ? -8 : 0)
      if (fi) {
        ctx.save()
        ctx.translate(Math.round(x), y)
        ctx.scale(-1, 1)
        ctx.rotate(-0.6)
        ctx.drawImage(fi, -11, -13, 22, 26)
        ctx.restore()
      } else {
        ctx.fillStyle = '#9fc4e0'
        ctx.fillRect(Math.round(x) - 6, y - 2, 12, 4)
      }
    }
    return
  }
  if (o.kind === 'reef') {
    const ri = pick('reef0', 'reef1', 'reef2')
    if (ri) ctx.drawImage(ri, Math.round(o.x - 21), WY - 36, 42, 42)
    return
  }
  if (o.kind === 'wave') {
    const wi = pick('wave0', 'wave1', 'wave2')
    if (wi) ctx.drawImage(wi, Math.round(o.x - 28), WY - 52, 56, 56)
    return
  }
  if (o.kind === 'tentacle') {
    const ti = pick('tentacle0', 'tentacle1', 'tentacle2')
    const h = Math.round(64 * o.k)
    // 솟기 전 — 물거품 예고
    if (o.k < 1) {
      ctx.fillStyle = 'rgba(230,245,255,0.8)'
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(o.x - 12 + ((t * 40 + i * 7) % 24)), WY - 2 - (i % 3), 3, 2)
    }
    if (ti && h > 2) {
      const sw = Math.sin(t * 3) * 0.08
      ctx.save()
      ctx.translate(Math.round(o.x), WY + 2)
      ctx.rotate(sw)
      ctx.drawImage(ti, 0, 0, ti.width, Math.round((ti.height * h) / 64), -16, -h, 32, h)
      ctx.restore()
    }
  }
}
