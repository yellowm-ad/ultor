'use client'

// ============================================================================
// 수업 장면 배우 — 교실 책상 수만큼 교복 학생(경청 애니) + 칠판 앞 교수(강의 애니) + 느낌표/말풍선
//   iso-world 의 깊이 정렬 목록에 entity 로 끼워 넣는다. 시트: public/images/class/<id>.png
//   (96px 셀, row0 = 애니 8프레임, row1 = 8방향 회전) — scripts/_pixellab/build-class-sheets.mjs
// ============================================================================

import { useEffect, useState } from 'react'
import type { GameMap, GameState } from '@/lib/types'
import { isoToScreen } from '@/lib/iso'
import { professorById } from '@/lib/curriculum'
import { schoolNpcById } from '@/lib/companions'
import { HeroSprite } from '@/components/game/pixel-hero'

const STUDENT_SHEETS = ['student-m1', 'student-f1', 'student-m2', 'student-f2', 'student-m3', 'student-f3']
const CELL = 96
/** 64px 캐릭터가 96px 셀 가운데 있으므로 NPC(64셀→74px)와 같은 키가 되도록 */
const DISPLAY = Math.round((74 * CELL) / 64)

/** 시트 한 줄(8프레임)을 반복 재생하는 배우 스프라이트 */
function ClassActorSprite({ sheet, fps = 7, delay = 0, still }: { sheet: string; fps?: number; delay?: number; still?: boolean }) {
  const scale = DISPLAY / CELL
  return (
    <div
      style={{
        width: DISPLAY,
        height: DISPLAY,
        backgroundImage: `url(/images/class/${sheet}.png)`,
        backgroundSize: `${8 * CELL * scale}px ${2 * CELL * scale}px`,
        backgroundPosition: still ? `${-4 * DISPLAY}px ${-DISPLAY}px` : '0 0',
        imageRendering: 'pixelated',
        animation: still ? undefined : `class-actor-frames ${8 / fps}s steps(8) ${-delay}s infinite`,
        ['--class-actor-w' as string]: `${-8 * DISPLAY}px`,
      }}
    />
  )
}

export interface ClassSeat {
  x: number
  y: number
}

/** 교실 맵의 학생 자리 — 책상(…-desk…) · 실험 작업대(pr-table/pa-table) 뒤(남쪽)에 칠판을 향해 선다 */
export function classSeats(map: GameMap): ClassSeat[] {
  const out: ClassSeat[] = []
  for (const p of map.props ?? []) {
    if (/-desk\d+-\d+$/.test(p.id) || /^(pr|pa)-table/.test(p.id)) out.push({ x: p.cell.x, y: p.cell.y + 0.95 })
  }
  return out
}

/** 교수 위치 — 칠판 앞(중앙 제단이 있으면 그 왼쪽) */
export function professorSpot(map: GameMap): { x: number; y: number } {
  const board = (map.props ?? []).find((p) => /-board$/.test(p.id))
  const altar = (map.props ?? []).some((p) => /-(altar|orb|tree)$/.test(p.id) && p.cell.y > 3 && p.cell.y < 6)
  if (!board) return { x: map.grid.w / 2, y: 3 }
  return altar ? { x: board.cell.x - 3, y: 3.1 } : { x: board.cell.x, y: 3.3 }
}

/** 강의 말풍선 — 5초 동안 교수 대사를 순서대로 */
function useLectureLine(lines: string[], active: boolean): string | null {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!active) return
    setI(0)
    const id = setInterval(() => setI((x) => x + 1), 1700)
    return () => clearInterval(id)
  }, [active, lines])
  return active && lines.length ? lines[Math.min(i, lines.length - 1)] : null
}

export function useClassActorEntities(state: GameState, map: GameMap): { sortY: number; node: React.ReactNode }[] {
  const sc = state.classScene
  const inClass = !!sc && sc.room === map.id
  const prof = sc ? professorById(sc.professorId) : undefined
  const line = useLectureLine(prof?.lectureLines ?? [], inClass && sc?.phase === 'lecture' && !sc.alert)
  if (!inClass || !sc) return []

  const seats = classSeats(map)
  const me = state.position
  // 플레이어 자리와 가장 가까운 좌석은 비운다
  const mine = seats.reduce((best, s, i) => (Math.hypot(s.x - me.x, s.y - me.y) < Math.hypot(seats[best].x - me.x, seats[best].y - me.y) ? i : best), 0)
  // 같은 반 동료(파티) — 앞쪽 좌석부터 앉힌다
  const mates = state.companions.party.map((id) => schoolNpcById(id)).filter((d): d is NonNullable<typeof d> => !!d)
  const out: { sortY: number; node: React.ReactNode }[] = []
  let mateIdx = 0
  seats.forEach((seat, i) => {
    if (i === mine) return
    const s = isoToScreen(seat.x, seat.y)
    const mate = mateIdx < mates.length && i % 3 === 0 ? mates[mateIdx++] : null
    const sheet = STUDENT_SHEETS[(i + (sc.seed % 6)) % STUDENT_SHEETS.length]
    out.push({
      sortY: seat.x + seat.y + 0.2,
      node: (
        <g key={`cls-st-${i}`} transform={`translate(${s.sx},${s.sy})`}>
          <ellipse cx={0} cy={1} rx={13} ry={4.5} fill="rgba(0,0,0,0.32)" />
          <foreignObject x={-DISPLAY / 2} y={-DISPLAY + 7 + (DISPLAY - 74) / 2} width={DISPLAY} height={DISPLAY} style={{ overflow: 'visible' }}>
            {mate ? (
              <div style={{ width: DISPLAY, height: DISPLAY, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <HeroSprite sheet={mate.sprite} dir="up" px={78} />
              </div>
            ) : (
              <ClassActorSprite sheet={sheet} fps={5 + (i % 3)} delay={(i * 0.37) % 1.5} />
            )}
          </foreignObject>
        </g>
      ),
    })
  })

  // 교수
  const spot = professorSpot(map)
  const ps = isoToScreen(spot.x, spot.y)
  out.push({
    sortY: spot.x + spot.y + 0.2,
    node: (
      <g key="cls-prof" transform={`translate(${ps.sx},${ps.sy})`}>
        <ellipse cx={0} cy={1} rx={14} ry={5} fill="rgba(0,0,0,0.35)" />
        <foreignObject x={-DISPLAY / 2} y={-DISPLAY + 7 + (DISPLAY - 74) / 2} width={DISPLAY} height={DISPLAY} style={{ overflow: 'visible' }}>
          <ClassActorSprite sheet={prof?.lectureSheet ?? 'prof-mirel'} fps={sc.phase === 'lecture' ? 7 : 4} still={sc.phase !== 'lecture'} />
        </foreignObject>
        <g transform="translate(0,-74)">
          <rect x={-(prof?.name.length ?? 4) * 5 - 6} y={-9} width={(prof?.name.length ?? 4) * 10 + 12} height={14} rx={3} fill="rgba(60,40,10,0.85)" />
          <text x={0} y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f3dca0">
            {prof?.name ?? '교수'}
          </text>
        </g>
        {sc.alert && (
          <foreignObject x={-22} y={-140} width={44} height={56} style={{ overflow: 'visible' }}>
            <img src="/images/class/ui/bubble_exclaim.png" alt="!" className="class-exclaim" style={{ width: 44, height: 'auto', imageRendering: 'pixelated' }} />
          </foreignObject>
        )}
        {line && (
          <foreignObject x={-120} y={-150} width={240} height={70} style={{ overflow: 'visible' }}>
            <div className="class-speech">{line}</div>
          </foreignObject>
        )}
      </g>
    ),
  })
  return out
}
