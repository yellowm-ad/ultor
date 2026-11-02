'use client'

// ============================================================================
// 첫 이동 스테이지 공용 도트 캔버스 엔진(2026-11-02)
//   · 논리 해상도(기본 480×270)로 그리고 CSS 로 정수배 확대(image-rendering: pixelated) — 도트가 뭉개지지 않고 가볍다
//   · 이미지 미리 읽기(없으면 null → 각 스테이지가 절차적으로 대신 그린다)
//   · 키 입력: 누른 순간(press) + 누르고 있는 중(held). 월드 이동 키와 겹치므로 전파를 막는다
//   · 주인공·동료 시트(8열 × 88px, row2 = 오른쪽 걷기 8프레임) 그리기
// ============================================================================

import { useEffect, useRef, useState } from 'react'

export const VW = 480
export const VH = 270

export type ImgMap<K extends string> = Record<K, HTMLImageElement | null>

/** 이미지 묶음을 미리 읽는다(실패한 것은 null) */
export function useImages<K extends string>(srcs: Record<K, string>): ImgMap<K> {
  const [imgs, setImgs] = useState<ImgMap<K>>(() => Object.fromEntries(Object.keys(srcs).map((k) => [k, null])) as ImgMap<K>)
  const key = Object.values(srcs).join('|')
  useEffect(() => {
    let alive = true
    const out = {} as ImgMap<K>
    const ks = Object.keys(srcs) as K[]
    let left = ks.length
    for (const k of ks) {
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => {
        out[k] = im
        if (--left === 0 && alive) setImgs({ ...out })
      }
      im.onerror = () => {
        out[k] = null
        if (--left === 0 && alive) setImgs({ ...out })
      }
      im.src = srcs[k]
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return imgs
}

export type Key = 'jump' | 'down' | 'up' | 'left' | 'right' | 'act'
const KEYMAP: Record<string, Key> = {
  ' ': 'jump',
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  e: 'act',
  enter: 'act',
}

export interface Input {
  held: Set<Key>
  /** 이번 프레임에 새로 눌린 키(틱에서 읽고 비운다) */
  pressed: Set<Key>
  /** 화면 버튼에서 호출 */
  tap: (k: Key) => void
  hold: (k: Key, on: boolean) => void
}

export function useInput(active: boolean): Input {
  const ref = useRef<Input | null>(null)
  if (!ref.current) {
    const held = new Set<Key>()
    const pressed = new Set<Key>()
    ref.current = {
      held,
      pressed,
      tap: (k) => pressed.add(k),
      hold: (k, on) => {
        if (on) {
          if (!held.has(k)) pressed.add(k)
          held.add(k)
        } else held.delete(k)
      },
    }
  }
  useEffect(() => {
    if (!active) return
    const inp = ref.current!
    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key.toLowerCase()]
      if (!k) return
      e.preventDefault()
      e.stopPropagation()
      if (!e.repeat) inp.pressed.add(k)
      inp.held.add(k)
    }
    // 떼기는 막지 않는다 — 키를 누른 채 스테이지에 들어오면 월드가 그 키를 '눌림'으로 기억하고 있어서,
    // 떼기까지 가로채면 스테이지가 끝난 뒤 캐릭터가 혼자 계속 걸었다(2026-11-02)
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key.toLowerCase()]
      if (!k) return
      inp.held.delete(k)
    }
    const blur = () => inp.held.clear()
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', blur)
      inp.held.clear()
      inp.pressed.clear()
    }
  }, [active])
  return ref.current
}

/**
 * 고정 프레임 루프 — update(dt) 후 draw(ctx). React 상태는 HUD 용으로 hud() 가 바뀔 때만 다시 그린다.
 * 탭이 숨으면 rAF 가 멈추므로 dt 는 최대 50ms 로 자른다.
 */
export function useCanvasLoop(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  running: boolean,
  update: (dt: number, t: number) => void,
  draw: (ctx: CanvasRenderingContext2D, t: number) => void,
  size: { w: number; h: number } = { w: VW, h: VH },
) {
  const u = useRef(update)
  const d = useRef(draw)
  u.current = update
  d.current = draw
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    cv.width = size.w
    cv.height = size.h
    const ctx = cv.getContext('2d', { alpha: false })
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    let last = performance.now()
    const t0 = last
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000
      if (running) u.current(dt, t)
      d.current(ctx, t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [canvas, running, size.w, size.h])
}

/** HUD 값이 바뀔 때만 React 를 다시 그리게 하는 작은 저장소 */
export function useHud<T>(initial: T): [T, (v: T) => void] {
  const [v, setV] = useState(initial)
  const last = useRef(JSON.stringify(initial))
  const set = (nv: T) => {
    const s = JSON.stringify(nv)
    if (s !== last.current) {
      last.current = s
      setV(nv)
    }
  }
  return [v, set]
}

export const HERO_CELL = 88
/**
 * 시트에서 한 칸 그리기. row 2 = 오른쪽 걷기(8프레임), row 0 col 2 = 오른쪽 정지.
 * (cx, footY) = 발 위치. scale 은 88px 칸 기준 배율.
 */
export function drawHero(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, row: number, col: number, cx: number, footY: number, scale: number, flip = false, alpha = 1) {
  const s = HERO_CELL * scale
  if (!img) {
    // 시트가 아직이면 작은 실루엣
    ctx.fillStyle = '#2b2118'
    ctx.fillRect(Math.round(cx - 5), Math.round(footY - 22), 10, 22)
    ctx.fillStyle = '#f1d6b0'
    ctx.fillRect(Math.round(cx - 4), Math.round(footY - 30), 8, 8)
    return
  }
  ctx.save()
  ctx.globalAlpha = alpha
  // 시트의 발은 칸 아래에서 약 14% 위
  const x = Math.round(cx - s / 2)
  const y = Math.round(footY - s * 0.86)
  if (flip) {
    ctx.translate(x + s, y)
    ctx.scale(-1, 1)
    ctx.drawImage(img, col * HERO_CELL, row * HERO_CELL, HERO_CELL, HERO_CELL, 0, 0, s, s)
  } else ctx.drawImage(img, col * HERO_CELL, row * HERO_CELL, HERO_CELL, HERO_CELL, x, y, s, s)
  ctx.restore()
}

/** 사진 민감 설정(.no-flash) — 번쩍임을 약하게 */
export const noFlash = () => typeof document !== 'undefined' && document.documentElement.classList.contains('no-flash')

/** 정수 시드 난수 */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 도트 글씨용 — 캔버스 위 짧은 말풍선/키 표시 */
export function keyCap(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color = '#ffe9a8') {
  ctx.font = 'bold 10px Pretendard, "Apple SD Gothic Neo", sans-serif'
  const w = Math.ceil(ctx.measureText(label).width) + 8
  const X = Math.round(x - w / 2)
  const Y = Math.round(y - 7)
  ctx.fillStyle = '#120d08'
  ctx.fillRect(X - 1, Y - 1, w + 2, 15)
  ctx.fillStyle = '#3a2a16'
  ctx.fillRect(X, Y, w, 13)
  ctx.fillStyle = color
  ctx.fillRect(X, Y + 12, w, 1)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, Math.round(x), Y + 7)
}
