'use client'

// 아이소 구조물 렌더러 — lib/iso.ts 의 IsoPart(수직면/윗면)를 SVG 로 투영해 그린다.
// isoToScreen: sx = 32(x - y), sy = 16(x + y), 높이 z 는 화면 위로 z px.
//   plane 'y'(y 고정) 면: (u, v) → matrix(1, 0.5, 0, 1, S(from, at) - z1) — u 는 x 방향 px(셀당 32), v 는 위→아래
//   plane 'x'(x 고정) 면: 화면 왼→오 = y 감소 방향이 되도록 S(at, to) 기준 matrix(1, -0.5, 0, 1, …)
//   윗면: 셀 좌표 그대로 matrix(32, 16, -32, 16, 0, -z)
import { ISO_TILE_W, ISO_TILE_H, isoToScreen } from '@/lib/iso'
import type { IsoPart, IsoTex } from '@/lib/iso'

const HW = ISO_TILE_W / 2 // 32 — 셀 한 칸이 면 방향으로 차지하는 화면 px

function Pattern({ id, tex, cellUnits }: { id: string; tex: IsoTex & { cells?: number }; cellUnits?: boolean }) {
  // cellUnits: 윗면(셀 좌표계)용 — 한 타일 = cells 셀. 아니면 면(px 좌표계)용 — 한 타일 = 원본 px × scale
  const w = cellUnits ? (tex.cells ?? 1) : tex.w * (tex.scale ?? 1.5)
  const h = cellUnits ? (tex.cells ?? 1) : tex.h * (tex.scale ?? 1.5)
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={w} height={h}>
      <image href={tex.src} width={w} height={h} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
    </pattern>
  )
}

export function IsoPartNode({ part, pid }: { part: IsoPart; pid: string }) {
  if (part.kind === 'top') {
    const { x0, y0, x1, y1, z } = part
    const w = x1 - x0
    const h = y1 - y0
    return (
      <g transform={`matrix(${HW},${ISO_TILE_H / 2},${-HW},${ISO_TILE_H / 2},0,${-z})`} opacity={part.opacity}>
        {part.tex && (
          <defs>
            <Pattern id={pid} tex={part.tex} cellUnits />
          </defs>
        )}
        {part.img ? (
          <image href={part.img} x={x0} y={y0} width={w} height={h} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <rect x={x0} y={y0} width={w} height={h} fill={part.tex ? `url(#${pid})` : (part.fill ?? '#888')} />
        )}
        {part.shade ? <rect x={x0} y={y0} width={w} height={h} fill="#000" opacity={part.shade} /> : null}
      </g>
    )
  }
  const len = (part.to - part.from) * HW
  const hgt = part.z1 - part.z0
  if (len <= 0 || hgt <= 0) return null
  const o = part.plane === 'y' ? isoToScreen(part.from, part.at) : isoToScreen(part.at, part.to)
  const m = part.plane === 'y' ? `matrix(1,0.5,0,1,${o.sx},${o.sy - part.z1})` : `matrix(1,-0.5,0,1,${o.sx},${o.sy - part.z1})`
  return (
    <g transform={m} opacity={part.opacity}>
      {part.tex && (
        <defs>
          <Pattern id={pid} tex={part.tex} />
        </defs>
      )}
      {part.img ? (
        <image href={part.img} width={len} height={hgt} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
      ) : (
        <rect width={len} height={hgt} fill={part.tex ? `url(#${pid})` : (part.fill ?? '#777')} />
      )}
      {part.shade ? <rect width={len} height={hgt} fill="#000" opacity={part.shade} style={{ pointerEvents: 'none' }} /> : null}
    </g>
  )
}

export function IsoStructNode({ id, parts }: { id: string; parts: IsoPart[] }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {parts.map((p, i) => (
        <IsoPartNode key={i} part={p} pid={`st-${id}-${i}`} />
      ))}
    </g>
  )
}
