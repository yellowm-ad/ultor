'use client'

// 흑룡 강림 — 필드 버전(lib/black-dragon). 상반신이 맵을 덮는 크기로, 양 앞발로 땅을 짚은 채 숨을 고른다.
//   그림 = PixelLab 숨쉬기 9프레임 시트(MonsterDef.colossal.field) — CSS steps 로 프레임을 넘긴다.
//   위에 코드 연출: 발밑 그림자, 눈빛 맥동, 몸을 감도는 창백한 바람 기류.

import { monsterById } from '@/lib/mock-data'
import { isoToScreen } from '@/lib/iso'
import { BLACK_DRAGON_ID, DRAGON_ANCHOR, DRAGON_FIELD_SCALE } from '@/lib/black-dragon'

export function ColossusField() {
  const c = monsterById(BLACK_DRAGON_ID)?.colossal
  if (!c) return null
  const { sx, sy } = isoToScreen(DRAGON_ANCHOR.x, DRAGON_ANCHOR.y)
  const k = DRAGON_FIELD_SCALE
  const fw = c.fieldFrame.w
  const fh = c.fieldFrame.h
  const w = fw * k
  const h = fh * k
  return (
    <g transform={`translate(${sx},${sy})`} className="colossus-field" pointerEvents="none">
      {/* 발밑 그림자 — 땅을 짚은 두 앞발 아래 */}
      <ellipse cx={0} cy={-6} rx={w * 0.46} ry={w * 0.14} fill="#000" opacity={0.45} />
      <svg x={-w / 2} y={-h} width={w} height={h} viewBox={`0 0 ${fw} ${fh}`} overflow="hidden" style={{ imageRendering: 'pixelated' }}>
        <image
          href={c.field}
          width={fw * c.fieldFrames}
          height={fh}
          className="colossus-frames"
          style={{ ['--colossus-end' as string]: `-${fw * c.fieldFrames}px`, animationDuration: `${c.fieldFrames * 0.16}s`, animationTimingFunction: `steps(${c.fieldFrames})` }}
        />
      </svg>
      {/* 눈빛 맥동(얼굴 높이) */}
      <ellipse cx={0} cy={-h * 0.53} rx={w * 0.1} ry={h * 0.035} fill="#9ff3ff" className="colossus-eyes" />
      {/* 바람 기류 — 몸을 감아 도는 창백한 선 */}
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${-w * 0.55} ${-h * (0.25 + i * 0.13)} C ${-w * 0.2} ${-h * (0.42 + i * 0.1)}, ${w * 0.2} ${-h * (0.08 + i * 0.12)}, ${w * 0.56} ${-h * (0.3 + i * 0.11)}`}
          className="colossus-wind"
          style={{ animationDelay: `${i * 0.7}s` }}
        />
      ))}
    </g>
  )
}
