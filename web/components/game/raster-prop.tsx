'use client'

import type { PropDef } from '@/lib/iso'
import { FOUNTAIN_FX } from '@/lib/fountain-fx-data'

/** 라스터(PNG) 프롭 — 발밑 앵커를 원점(0,0)에 맞춰 배치. 모든 소품은 PixelLab 도트(스프라이트 없는 소품은 그리지 않음) */
export function RasterProp({ p }: { p: PropDef }) {
  const w = p.px?.w
  const h = p.px?.h
  // 앵커 미지정 시 이미지 하단-중앙을 발밑으로 가정
  const ax = p.anchor?.x ?? (w ? w / 2 : 0)
  const ay = p.anchor?.y ?? (h ?? 0)
  // facing:'left' — 좌우 반전(벤치 등, 배치 방향을 통로 쪽으로 맞출 때 사용). wall은 이미 별도 처리하므로 제외.
  const mirror = p.facing === 'left' && p.kind !== 'wall'
  // 벽면 기울이기 — 발밑 앵커(ax,ay)를 축으로 skewY, 쿼터뷰 바닥선 각도에 맞춰 벽이 뜨지 않게 함
  const skew = p.skewYDeg ? `skewY(${p.skewYDeg}deg)` : ''
  const flip = mirror || p.mirrorX ? 'scaleX(-1)' : ''
  const rotate = p.rotateDeg ? `rotate(${p.rotateDeg}deg)` : ''
  const transform = [rotate, flip, skew].filter(Boolean).join(' ') || undefined
  const style = {
    imageRendering: 'pixelated' as const,
    transform,
    // 앵커(ax,ay)만큼 x=-ax,y=-ay 로 이미 옮겨놨으므로, 발밑 앵커는 항상 로컬 원점(0,0)에 위치한다.
    // 여기를 (ax,ay)로 잘못 잡으면 스프라이트마다 ax/ay 값이 달라 skew/flip 축이 제각각 어긋난다.
    transformOrigin: transform ? '0px 0px' : undefined,
  }
  // 분수 물결(lib/fountain-fx-data · scripts/gen-fountain-fx) — 물 픽셀만 칠한 프레임을 같은 자리에 겹쳐 넘긴다
  const fx = p.sprite ? FOUNTAIN_FX[p.sprite.split('?')[0]] : undefined
  if (fx && w && h) {
    const n = fx.frames
    return (
      <g style={style}>
        <image href={p.sprite} x={-ax} y={-ay} width={w} height={h} style={{ imageRendering: 'pixelated' }} />
        <svg x={-ax} y={-ay} width={w} height={h} viewBox={`0 0 ${fx.w} ${fx.h}`} preserveAspectRatio="none" overflow="hidden" pointerEvents="none">
          <image href={fx.fx} x={0} y={0} width={fx.w * n} height={fx.h} style={{ imageRendering: 'pixelated' }}>
            <animate attributeName="x" values={Array.from({ length: n }, (_, i) => -i * fx.w).join(';')} dur={`${n * 0.14}s`} calcMode="discrete" repeatCount="indefinite" />
          </image>
        </svg>
      </g>
    )
  }
  return <image href={p.sprite} x={-ax} y={-ay} width={w} height={h} style={style} />
}
