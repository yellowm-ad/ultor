'use client'

// ============================================================================
// 4등신 주인공 도트 스프라이트 — PixelLab 시트 전용
//
//   public/images/sprites/hero-<element>-<gender>.png  (8열 × 4행, 6종 모두 존재)
//   row0 = 8방향 회전(정지), row1/2/3 = south/east/north 걷기 8프레임. west 걷기 = east 좌우 반전.
//
// (예전 삼면도 팔레트 절차적 SVG 폴백은 6종 시트가 모두 갖춰져 제거 — 2026-09-28)
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import type { Gender, SpriteSheet } from '@/lib/types'

export type Facing = 'down' | 'up' | 'left' | 'right'

function sheetSrc(sheet: SpriteSheet) {
  return `/images/sprites/${sheet}.png`
}

/** 주인공 시트 키 — 고정 외형 2종(흑발 금안 · 울토르 교복) */
export function playerSheet(gender: Gender): SpriteSheet {
  return `protag-${gender}`
}

const SHEET_COLS = 8
/** 4방향 → row 0 회전 컬럼 (PixelLab 방향 순서 기준) */
const DIR_COL: Record<Facing, number> = { down: 0, right: 2, up: 4, left: 6 }
/** 4방향 → 걷기 행. left 는 right(row2) 를 좌우 반전. */
const WALK_ROW: Record<Facing, number> = { down: 1, right: 2, left: 2, up: 3 }
const WALK_FRAMES = 8
const WALK_MS = 115

/**
 * 주인공 스프라이트 — PixelLab 시트를 잘라 방향·걷기 애니메이션.
 */
export function HeroSprite({
  sheet,
  dir = 'down',
  walking = false,
  px = 64,
  className,
}: {
  sheet: SpriteSheet
  dir?: Facing
  walking?: boolean
  px?: number
  className?: string
}) {
  const [frame, setFrame] = useState(0) // 0..7
  const raf = useRef<number>(0)

  // 걷기 프레임 타이머
  useEffect(() => {
    if (!walking) {
      setFrame(0)
      return
    }
    let last = 0
    const tick = (t: number) => {
      raf.current = requestAnimationFrame(tick)
      if (t - last < WALK_MS) return
      last = t
      setFrame((f) => (f + 1) % WALK_FRAMES)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [walking])

  {
    // 정지 = row0 회전 컬럼. 걷기 = 방향별 걷기 행(row1/2/3) 8프레임 순환.
    // west(좌) 걷기는 east 행(row2)을 좌우 반전.
    const row = walking ? WALK_ROW[dir] : 0
    const col = walking ? frame : DIR_COL[dir]
    const flipX = walking && dir === 'left'
    return (
      <div
        className={className}
        style={{
          width: px,
          height: px,
          transform: flipX ? 'scaleX(-1)' : undefined,
          backgroundImage: `url(${sheetSrc(sheet)})`,
          // 높이 auto — 주인공 시트는 달리기 3행이 더 붙어 7행(그 외 4행)
          backgroundSize: `${px * SHEET_COLS}px auto`,
          backgroundPosition: `-${col * px}px -${row * px}px`,
          imageRendering: 'pixelated',
        }}
        role="img"
        aria-label="주인공 스프라이트"
      />
    )
  }
}
