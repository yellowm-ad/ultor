'use client'

import { useMemo, useState, useEffect, type Dispatch } from 'react'
import type { Action } from '@/lib/game-state'
import type { GameMap, GameState } from '@/lib/types'
import { MAPS } from '@/lib/maps'
import { NPCS, MONSTERS } from '@/lib/mock-data'
import { wanderState, npcWanderState } from '@/lib/field'
import { ISO_TILE_W, ISO_TILE_H, isoToScreen, isoBounds, stairElevation, TILE_COLORS, TILE_SPRITES } from '@/lib/iso'
import { IsoStructNode } from '@/components/game/iso-structures'
import { useWaterOverlays, WaterBackdrop, waterView } from '@/components/game/iso-water'
import { useTerrainArt, TerrainWaterBackdrop, TerrainCanvas } from '@/components/game/iso-terrain'
import type { TileKind, PropDef } from '@/lib/iso'
import { FURNITURE_BY_ID } from '@/lib/housing'
import { GATHER_NODE_META, gatherNodesForMap, isNodeReady } from '@/lib/life'
import { CreatureSprite, NpcSprite } from '@/components/game/creature-sprite'
import { professorSpot, useClassActorEntities } from '@/components/game/class-actors'

const BASE_SCALE = 1.15 // 맵 4배 확장(52×40)에 맞춰 축소 (기존 1.4)
const PAD_TOP = 240 // 키 큰 건물이 앵커 위로 솟는 여유
const PAD_BOTTOM = 60

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 맵의 월드 사각형(svg 좌표) — 자연 지면 캔버스 범위. 아래 IsoWorld 의 worldW/worldH 계산과 같다 */
function worldRectOf(m: GameMap) {
  const b = isoBounds(m.grid.w, m.grid.h)
  const pt = Math.max(PAD_TOP, m.padTop ?? 0)
  return { x: b.minSx, y: -pt, w: b.width, h: b.height + pt + Math.max(PAD_BOTTOM, m.padBottom ?? 0) }
}

/** 라스터(PNG) 프롭 — 발밑 앵커를 원점(0,0)에 맞춰 배치. 모든 소품은 PixelLab 도트(스프라이트 없는 소품은 그리지 않음) */
function RasterProp({ p }: { p: PropDef }) {
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
  return (
    <image
      href={p.sprite}
      x={-ax}
      y={-ay}
      width={w}
      height={h}
      style={{
        imageRendering: 'pixelated',
        transform,
        // 앵커(ax,ay)만큼 x=-ax,y=-ay 로 이미 옮겨놨으므로, 발밑 앵커는 항상 로컬 원점(0,0)에 위치한다.
        // 여기를 (ax,ay)로 잘못 잡으면 스프라이트마다 ax/ay 값이 달라 skew/flip 축이 제각각 어긋난다.
        transformOrigin: transform ? '0px 0px' : undefined,
      }}
    />
  )
}

/**
 * 바닥 상감 마법진 — 참고 이미지(마법학교 실내.png)의 금/청 라인 원형 문양.
 * matrix(32,16,-32,16) = isoToScreen 과 같은 투영이라 원·선을 셀 단위로 그리면 바닥에 눕는다.
 */
function FloorInlay({ cx, cy, r, gold, blue }: { cx: number; cy: number; r: number; gold: string; blue: string }) {
  const pt = (a: number, rr: number) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const
  const star = (n: number, rr: number, skip: number) =>
    Array.from({ length: n }, (_, i) => pt((i * skip * Math.PI * 2) / n - Math.PI / 4, rr).join(',')).join(' ')
  return (
    <g transform={`matrix(${ISO_TILE_W / 2},${ISO_TILE_H / 2},${-ISO_TILE_W / 2},${ISO_TILE_H / 2},0,0)`} style={{ pointerEvents: 'none' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={blue} strokeOpacity={0.45} strokeWidth={0.55} />
      <circle cx={cx} cy={cy} r={r + 0.32} fill="none" stroke={gold} strokeWidth={0.09} />
      <circle cx={cx} cy={cy} r={r - 0.32} fill="none" stroke={gold} strokeWidth={0.07} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={gold} strokeWidth={0.08} />
      <circle cx={cx} cy={cy} r={r * 0.62 - 0.25} fill="none" stroke={blue} strokeOpacity={0.35} strokeWidth={0.3} />
      {/* 8각 별(두 겹 사각) + 방사선 */}
      <polygon points={star(8, r - 0.35, 3)} fill={blue} fillOpacity={0.1} stroke={gold} strokeWidth={0.06} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        const [x0, y0] = pt(a, r * 0.62)
        const [x1, y1] = pt(a, i % 2 ? r - 0.32 : r + 0.32)
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={gold} strokeOpacity={i % 2 ? 0.45 : 0.8} strokeWidth={0.05} />
      })}
      {/* 네 방위 보석 원판 */}
      {[0, 1, 2, 3].map((i) => {
        const [x, y] = pt((i * Math.PI) / 2 - Math.PI / 4, r)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={0.75} fill={blue} fillOpacity={0.55} stroke={gold} strokeWidth={0.08} />
            <circle cx={x} cy={y} r={0.3} fill="#e9f4ff" fillOpacity={0.8} />
          </g>
        )
      })}
    </g>
  )
}

export function IsoWorld({
  state,
  dispatch,
  viewportSize,
  moving,
  running = false,
  interactId,
}: {
  state: GameState
  dispatch: Dispatch<Action>
  viewportSize: { w: number; h: number }
  moving: boolean
  /** Shift 달리기 — 달리기 행(4/5/6) + 빠른 프레임 */
  running?: boolean
  interactId: string | null
}) {
  const map = MAPS[state.currentMapId]
  const waterArt = useWaterOverlays(map)
  const [heroFrame, setHeroFrame] = useState(0)
  useEffect(() => {
    if (!moving) { setHeroFrame(0); return }
    const id = setInterval(() => setHeroFrame((f) => (f + 1) % 8), running ? 75 : 115)
    return () => clearInterval(id)
  }, [moving, running])

  // 필드 몬스터 배회 애니메이션 시각(視刻) — 10fps 면 충분히 자연스럽다
  const [wanderT, setWanderT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setWanderT(performance.now()), 100)
    return () => clearInterval(id)
  }, [])
  const { w: VW, h: VH } = map.grid
  const bounds = useMemo(() => isoBounds(VW, VH), [VW, VH])
  const originX = -bounds.minSx
  // 높은 벽(구조물)이 있는 맵은 위 여백을 벽 높이만큼 늘린다
  const padTop = Math.max(PAD_TOP, map.padTop ?? 0)
  const originY = padTop
  const worldW = bounds.width
  const worldH = bounds.height + padTop + Math.max(PAD_BOTTOM, map.padBottom ?? 0)
  // 자연 지면(야생맵) — 지면 전체를 한 장으로(components/game/iso-terrain.tsx). 그려지기 전엔 칸 타일로 보여 준다
  const terrainNext = useMemo(
    () =>
      [...new Set(map.portals.map((p) => p.to))]
        .map((id) => MAPS[id as keyof typeof MAPS] as GameMap | undefined)
        .filter((m): m is GameMap => !!m?.terrain)
        .map((m) => ({ map: m, rect: worldRectOf(m) })),
    [map],
  )
  const terrainArt = useTerrainArt(map, worldRectOf(map), terrainNext)

  // 지면 (정적 — 메모)
  const ground = useMemo(() => {
    const tiles: React.ReactNode[] = []
    if (map.terrain) return tiles
    for (let y = 0; y < VH; y++) {
      for (let x = 0; x < VW; x++) {
        // 물 지형 맵: 바다·수로 칸은 WaterLayer 가 이어진 수면으로 그린다
        const wk = map.water?.at(x + 0.5, y + 0.5)
        if (wk === 'sea' || wk === 'canal') continue
        const kind: TileKind = map.tileAt ? map.tileAt(x + 0.5, y + 0.5) : 'grass'
        const a = isoToScreen(x, y)
        const sprite = map.assets === 'raster' ? TILE_SPRITES[kind] : undefined
        if (sprite) {
          // 다이메트릭 타일 PNG: 상단 꼭짓점(a)에 맞춰 배치.
          // 셀 해시로 좌우/상하 뒤집어 반복 패턴(솔기) 완화.
          const h = map.tileFlip === false ? 0 : ((x * 73856093) ^ (y * 19349663)) >>> 0
          const fx = h & 1 ? -1 : 1
          const fy = h & 2 ? -1 : 1
          const px = fx < 0 ? 2 * a.sx : 0
          const py = fy < 0 ? 2 * (a.sy + ISO_TILE_H / 2) : 0
          tiles.push(
            <g key={`${x}-${y}`} transform={`translate(${px},${py}) scale(${fx},${fy})`}>
              <image
                href={sprite}
                x={a.sx - ISO_TILE_W / 2}
                y={a.sy}
                width={ISO_TILE_W}
                height={ISO_TILE_H * 2}
                style={{ imageRendering: 'pixelated' }}
              />
            </g>,
          )
          continue
        }
        const col = TILE_COLORS[kind]
        const b = isoToScreen(x + 1, y)
        const c = isoToScreen(x + 1, y + 1)
        const d = isoToScreen(x, y + 1)
        tiles.push(
          <polygon
            key={`${x}-${y}`}
            points={`${a.sx},${a.sy} ${b.sx},${b.sy} ${c.sx},${c.sy} ${d.sx},${d.sy}`}
            fill={col.top}
            stroke={col.edge}
            strokeWidth={0.6}
          />,
        )
      }
    }
    // 상감 마법진(마법학교 홀) — 셀 좌표계를 그대로 쓰도록 아이소 투영 행렬로 변환해 그린다
    for (const [i, c] of (map.floorInlay ?? []).entries()) {
      tiles.push(<FloorInlay key={`inlay-${i}`} {...c} />)
    }
    return tiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, VW, VH])

  // 정적 오브젝트(건물·나무·NPC·포탈) — 깊이정렬 목록
  const staticEntities = useMemo(() => {
    const list: { sortY: number; node: React.ReactNode }[] = []

    let backdropOrder = 0
    for (const p of map.props ?? []) {
      // 원형 구조물(콜로세움·분수)은 앵커가 중심이라 half 가산 없이 정렬
      const half = p.radial ? 0 : ((p.size?.w ?? 0.4) + (p.size?.d ?? 0.4)) / 2
      const s = isoToScreen(p.cell.x, p.cell.y)
      list.push({
        // backdrop(방 뒤쪽 벽·문) = 선언 순서대로 맨 뒤 레이어 — 긴 벽 조각이 앞의 플레이어를 덮지 않게
        sortY: p.backdrop ? -1e6 + (p.backOrder ?? backdropOrder++) : p.cell.x + p.cell.y + half,
        node: (
          <g key={p.id} transform={`translate(${s.sx},${s.sy - (p.elev ?? 0)})`}>
            {p.sprite ? <RasterProp p={p} /> : null}
          </g>
        ),
      })
    }

    // 코드 투영 구조물(벽·회랑·계단·기둥) — back 지정 시 backdrop 레이어, 아니면 sortY 로 깊이정렬
    for (const g of map.structures ?? []) {
      list.push({
        sortY: g.back != null ? -1e6 + g.back : (g.sortY ?? 0),
        node: <IsoStructNode key={`st-${g.id}`} id={g.id} parts={g.parts} />,
      })
    }

    list.sort((a, b) => a.sortY - b.sortY)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // NPC — 홈 셀(npc.cell) 주변을 배회(npcWanderPosition, 몬스터와 동일한 시간기반 리사주 곡선).
  // wanderT 마다 위치 재계산되므로 static 메모 밖(몬스터와 동일 패턴)에 둔다.
  const mapNpcsForRoam = useMemo(() => NPCS.filter((n) => map.zones.some((z) => z.id === n.zoneId)), [map])
  // 수업 장면 — 책상마다 학생, 칠판 앞 교수(lib/curriculum · components/game/class-actors)
  const classEntities = useClassActorEntities(state, map)
  const ND = 74 // NPC 도트 스프라이트 표시 크기
  const npcEntities = mapNpcsForRoam.map((npc) => {
    const { pos, facing: dir, moving } = npcWanderState(npc, wanderT, map.blockers)
    const s = isoToScreen(pos.x, pos.y)
    return {
      sortY: pos.x + pos.y + 0.2,
      node: (
        <g
          key={npc.id}
          transform={`translate(${s.sx},${s.sy})`}
          style={{ cursor: 'pointer' }}
          onClick={() => dispatch({ type: 'OPEN_NPC', npcId: npc.id })}
        >
          <ellipse cx={0} cy={1} rx={13} ry={4.5} fill="rgba(0,0,0,0.32)" />
          <foreignObject x={-ND / 2} y={-ND + 7} width={ND} height={ND} style={{ overflow: 'visible' }}>
            <NpcSprite npcId={`${npc.spriteId ?? npc.id}-walk`} fallbackSrc={npc.icon} dir={dir} walking={moving} px={ND} />
          </foreignObject>
          <g transform="translate(0,-58)">
            <rect x={-npc.name.length * 5 - 5} y={-9} width={npc.name.length * 10 + 10} height={14} rx={3} fill={interactId === npc.id ? '#e0b050' : 'rgba(10,8,16,0.68)'} />
            <text x={0} y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill={interactId === npc.id ? '#000' : '#e8dcc0'}>
              {npc.name}
            </text>
          </g>
          <circle cx={0} cy={-52} r={2.2} fill={interactId === npc.id ? '#e8dcc0' : '#ffffffaa'} />
        </g>
      ),
    }
  })

  // 필드 몬스터 — 홈 셀 반경 6.5셀 안만 렌더(연산 절약), wanderT 마다 배회 위치 재계산
  const visibleMonsters = useMemo(
    () =>
      state.fieldMonsters.filter(
        (fm) => Math.hypot(fm.homeCell.x - state.position.x, fm.homeCell.y - state.position.y) < 6.5,
      ),
    [state.fieldMonsters, state.position.x, state.position.y],
  )
  const MD = 58 // 몬스터 도트 표시 크기(일반 몬스터 기준)
  /** 필드에서의 보스 크기 배율 — 일반몹 1배 기준 중간보스 2.1배(3×0.7), 필드보스 4.2배(6×0.7) */
  const fieldRankScale = (rank?: string) => (rank === 'fieldBoss' || rank === 'storyBoss' ? 4.2 : rank === 'miniBoss' ? 2.1 : 1)
  const monsterEntities = visibleMonsters.flatMap((fm) => {
    const def = MONSTERS.find((m) => m.id === fm.monsterId)
    if (!def) return []
    const { pos, facing: dir, moving } = wanderState(fm, wanderT, map.blockers)
    const s = isoToScreen(pos.x, pos.y)
    const scale = fieldRankScale(def.rank)
    const size = MD * scale
    const shadowRx = 12 * Math.sqrt(scale)
    const shadowRy = 4 * Math.sqrt(scale)
    const labelY = -54 - (size - MD)
    return [
      {
        sortY: pos.x + pos.y,
        node: (
          <g key={fm.uid} transform={`translate(${s.sx},${s.sy})`}>
            <ellipse cx={0} cy={2} rx={shadowRx} ry={shadowRy} fill="rgba(0,0,0,0.34)" />
            <foreignObject x={-size / 2} y={-size + 8} width={size} height={size} style={{ overflow: 'visible' }}>
              <CreatureSprite spriteId={def.id} fallbackSrc={def.icon} dir={dir} walking={moving} px={size} />
            </foreignObject>
            <g transform={`translate(0,${labelY})`}>
              <rect
                x={-def.name.length * 5 - 5}
                y={-9}
                width={def.name.length * 10 + 10}
                height={14}
                rx={3}
                fill={def.isTestMonster ? 'rgba(6,60,30,0.75)' : def.rank === 'fieldBoss' ? 'rgba(120,20,10,0.85)' : def.rank === 'miniBoss' ? 'rgba(90,50,10,0.8)' : 'rgba(60,10,10,0.68)'}
              />
              <text x={0} y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill={def.isTestMonster ? '#a8f0c0' : '#f0c0c0'}>
                {def.isTestMonster ? 'TEST' : def.name}
              </text>
            </g>
          </g>
        ),
      },
    ]
  })

  // ── 포탈/통문: 푸른 계열 마법진 (도트). 건물 위에 항상 렌더 → 클릭 보장 ──
  const portalNodes = useMemo(() => {
    const seen = new Set<string>()
    const nodes: React.ReactNode[] = []
    for (const p of map.portals) {
      if (p.kind === 'gate') {
        const k = `${p.cell.x},${p.cell.y}`
        if (seen.has(k)) continue
        seen.add(k)
      }
      const s0 = isoToScreen(p.cell.x, p.cell.y)
      const s = { sx: s0.sx, sy: s0.sy - stairElevation(map.stairs, p.cell.x, p.cell.y).z }
      const isGate = p.kind === 'gate'
      const c1 = isGate ? '#3f8cff' : p.kind === 'exit' ? '#5fd0ff' : '#8f7bff' // 링
      const c2 = isGate ? '#a9d4ff' : p.kind === 'exit' ? '#bff0ff' : '#d9d0ff' // 코어
      const R = isGate ? 30 : 22
      const label = isGate ? p.label : p.label + (p.requiredLevel ? ` Lv.${p.requiredLevel}+` : '')
      // 8방향 룬 마크 (마법진 테두리)
      const runes = Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <rect key={i} x={Math.cos(a) * R - 2} y={Math.sin(a) * R * 0.5 - 2} width={4} height={4} fill={c1} />
      })
      nodes.push(
        <g
          key={p.id}
          transform={`translate(${s.sx},${s.sy})`}
          style={{ cursor: 'pointer' }}
          onClick={() => dispatch(isGate ? { type: 'OPEN_GATE' } : { type: 'USE_PORTAL', portalId: p.id })}
        >
          {/* 바깥 마법진 */}
          <ellipse cx={0} cy={0} rx={R} ry={R * 0.5} fill="none" stroke={`${c1}66`} strokeWidth={5} style={{ animation: 'portal-pulse 2s ease-in-out infinite' }} />
          <ellipse cx={0} cy={0} rx={R - 6} ry={(R - 6) * 0.5} fill={`${c1}22`} stroke={c1} strokeWidth={2} />
          {runes}
          {/* 회전 다이아 */}
          <g style={{ animation: 'mill-spin 6s linear infinite' }}>
            <rect x={-3} y={-R * 0.5} width={6} height={6} fill={c2} />
            <rect x={-3} y={R * 0.5 - 6} width={6} height={6} fill={c2} />
            <rect x={-R + 2} y={-3} width={6} height={6} fill={c2} />
            <rect x={R - 8} y={-3} width={6} height={6} fill={c2} />
          </g>
          {/* 코어 광원 */}
          <ellipse cx={0} cy={0} rx={R * 0.42} ry={R * 0.24} fill={c2} opacity={0.9} />
          <ellipse cx={0} cy={-2} rx={R * 0.22} ry={R * 0.12} fill="#ffffff" opacity={0.85} />
          {/* 위로 솟는 빛 기둥 */}
          <rect x={-2} y={-R * 1.6} width={4} height={R * 1.6} fill={`url(#portalBeam)`} opacity={0.5} />
          {/* 라벨 */}
          <g transform={`translate(0,${-R - 18})`}>
            <rect x={-label.length * 4 - 5} y={-9} width={label.length * 8 + 10} height={15} rx={3} fill="rgba(8,10,22,0.82)" stroke={`${c1}88`} strokeWidth={1} />
            <text x={0} y={2} textAnchor="middle" fontSize={9} fontWeight={700} fill={c2}>{label}</text>
          </g>
          {/* 넉넉한 클릭 히트영역 (투명) */}
          <rect x={-R - 6} y={-R - 26} width={R * 2 + 12} height={R + 34} fill="transparent" />
        </g>,
      )
    }
    return nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // 플레이어
  // 계단 위에서는 높이만큼 띄우고, 깊이정렬은 계단 왼쪽 끝 기준으로 보정(같은 단의 오른쪽 부분에 가려지지 않게)
  const onStair = stairElevation(map.stairs, state.position.x, state.position.y)
  const ps0 = isoToScreen(state.position.x, state.position.y)
  const ps = { sx: ps0.sx, sy: ps0.sy - onStair.z }
  const playerSortY = onStair.stair ? onStair.stair.x0 + state.position.y + 0.25 : state.position.x + state.position.y
  // 주인공 PixelLab 4등신 시트(scripts/build-hero-sheets.mjs): 88px 셀, 8열 × 11행.
  //   row0 = 8방향 회전 (s0 se1 e2 ne3 n4 nw5 w6 sw7)
  //   row1~3 = 걷기 S/E/N · row4~6 = 달리기 S/E/N · row7/8 = 대각 걷기 SE/NE · row9/10 = 대각 달리기 SE/NE
  //   서쪽 계열(W/SW/NW) 이동은 동쪽 행을 좌우 반전. facing 은 '화면 기준' 8방향(쿼터뷰라 S키는 down-left).
  const DIR_COL: Record<string, number> = {
    down: 0, 'down-right': 1, right: 2, 'up-right': 3, up: 4, 'up-left': 5, left: 6, 'down-left': 7,
  }
  const WALK_ROW: Record<string, number> = {
    down: 1, right: 2, left: 2, up: 3, 'down-right': 7, 'down-left': 7, 'up-right': 8, 'up-left': 8,
  }
  const RUN_ROW: Record<string, number> = {
    down: 4, right: 5, left: 5, up: 6, 'down-right': 9, 'down-left': 9, 'up-right': 10, 'up-left': 10,
  }
  const facing = state.facing
  let heroCol: number
  let heroRow = 0
  if (moving && WALK_ROW[facing] != null) {
    heroRow = (running ? RUN_ROW : WALK_ROW)[facing]
    heroCol = heroFrame % 8
  } else {
    heroCol = DIR_COL[facing] ?? 0
  }
  const heroFlip = moving && (facing === 'left' || facing === 'down-left' || facing === 'up-left')
  const HD = 88
  const playerNode = (
    <g key="__player" transform={`translate(${ps.sx},${ps.sy})`}>
      <ellipse cx={0} cy={2} rx={17} ry={5.5} fill="rgba(0,0,0,0.34)" />
      <g transform={heroFlip ? 'scale(-1,1)' : undefined}>
        <svg
          x={-HD / 2}
          y={-HD + 10}
          width={HD}
          height={HD}
          viewBox={`${heroCol * 88} ${heroRow * 88} 88 88`}
          overflow="hidden"
          style={{ imageRendering: 'pixelated' }}
        >
          <image href={`/images/sprites/protag-${state.player.appearance.gender}.png`} width={704} height={968} />
        </svg>
      </g>
    </g>
  )

  // 개인 공간 가구 — 플레이어가 배치한 것만, 편집 모드에서는 클릭으로 제거
  const furnitureEntities =
    state.currentMapId === 'personal-space'
      ? state.housing.placed.flatMap((f) => {
          const def = FURNITURE_BY_ID[f.defId]
          if (!def) return []
          const s = isoToScreen(f.cell.x, f.cell.y)
          const { w, h, fw, fd } = def.sprite
          // 아이소 가구: PNG 하단 = footprint 앞 꼭짓점 → 앵커를 footprint 중심까지 끌어올림(8·(fw+fd) px)
          const prop: PropDef = {
            id: f.id, kind: 'cottage', cell: f.cell, sprite: def.sprite.s, px: { w, h },
            anchor: def.iso ? { x: w / 2, y: h - 8 * (fw + fd) } : undefined,
            facing: def.flip ? 'left' : undefined,
          }
          const half = (def.sprite.fw + def.sprite.fd) / 2
          return [
            {
              sortY: f.cell.x + f.cell.y + half,
              node: (
                <g
                  key={f.id}
                  transform={`translate(${s.sx},${s.sy})`}
                  style={state.housing.editMode ? { cursor: 'pointer' } : undefined}
                  onClick={state.housing.editMode ? () => dispatch({ type: 'HOUSING_REMOVE', id: f.id }) : undefined}
                >
                  <RasterProp p={prop} />
                </g>
              ),
            },
          ]
        })
      : []

  // 채집 지점 — 채집 후 리스폰 전에는 흐리게(그루터기만). 아이콘은 임시 SVG(lib/life.ts GATHER_NODE_META)
  const gatherNodes = useMemo(() => gatherNodesForMap(map), [map])
  const now = Date.now()
  const gatherEntities = gatherNodes.map((n) => {
    const s = isoToScreen(n.cell.x, n.cell.y)
    const ready = isNodeReady(state.life, n.key, now)
    const meta = GATHER_NODE_META[n.kind]
    const hot = interactId === n.key
    return {
      sortY: n.cell.x + n.cell.y,
      node: (
        <g
          key={n.key}
          transform={`translate(${s.sx},${s.sy})`}
          style={{ cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.35 }}
          onClick={ready ? () => dispatch({ type: 'GATHER', nodeKey: n.key }) : undefined}
        >
          <ellipse cx={0} cy={1} rx={12} ry={4} fill="rgba(0,0,0,0.28)" />
          <image href={meta.icon} x={-16} y={-30} width={32} height={32} style={{ imageRendering: 'pixelated' }} />
          {ready && (
            <g style={{ animation: 'portal-pulse 1.8s ease-in-out infinite' }}>
              <rect x={-1.5} y={-40} width={3} height={3} fill="#fff6c8" />
              <rect x={9} y={-33} width={2} height={2} fill="#fff6c8" />
            </g>
          )}
          {hot && (
            <g transform="translate(0,-46)">
              <rect x={-meta.name.length * 5 - 5} y={-9} width={meta.name.length * 10 + 10} height={14} rx={3} fill="#e0b050" />
              <text x={0} y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000">
                {meta.name}
              </text>
            </g>
          )}
        </g>
      ),
    }
  })

  const allEntities = [...staticEntities, ...gatherEntities, ...monsterEntities, ...npcEntities, ...furnitureEntities, ...classEntities].sort((a, b) => a.sortY - b.sortY)
  const behind = allEntities.filter((e) => e.sortY <= playerSortY).map((e) => e.node)
  const front = allEntities.filter((e) => e.sortY > playerSortY).map((e) => e.node)

  // 개발 모드 전용: window.__isoScale 로 카메라 배율을 바꿔 전체 구도를 확인(크롬 자동화 스크린샷용)
  const devScale = process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' ? (window as unknown as { __isoScale?: number }).__isoScale : undefined
  const SCALE = devScale ?? BASE_SCALE
  // 수업 중엔 카메라를 플레이어와 교수 사이(조금 위)로 — 강의 말풍선·느낌표가 레터박스에 가리지 않게
  const inClass = !!state.classScene && state.classScene.room === map.id
  const profFocus = inClass ? isoToScreen(professorSpot(map).x, professorSpot(map).y) : null
  const focus = profFocus ? { sx: (ps.sx + profFocus.sx) / 2, sy: (ps.sy + profFocus.sy) / 2 - 40 } : ps
  const camX = clamp(viewportSize.w / 2 - (originX + focus.sx) * SCALE, Math.min(0, viewportSize.w - worldW * SCALE), 0)
  const camY = clamp(viewportSize.h / 2 - (originY + focus.sy) * SCALE, Math.min(0, viewportSize.h - worldH * SCALE), 0)

  // 수면 층은 화면에 보이는 영역만(텍스처 주기 단위로 맞춰 카메라가 조금 움직여선 다시 만들지 않는다)
  const waterViewRect = map.water || terrainArt.surface ? waterView(camX, camY, SCALE, viewportSize.w, viewportSize.h, worldW, worldH) : null

  return (
    <div className="absolute left-0 top-0" style={{ transform: `translate3d(${camX}px, ${camY}px, 0) scale(${SCALE})`, transformOrigin: '0 0', willChange: 'transform' }}>
      {waterViewRect && terrainArt.surface && <TerrainWaterBackdrop surface={terrainArt.surface} vx={waterViewRect.x} vy={waterViewRect.y} vw={waterViewRect.w} vh={waterViewRect.h} />}
      {terrainArt.canvas && <TerrainCanvas canvas={terrainArt.canvas} w={worldW} h={worldH} />}
      {waterViewRect && map.water && <WaterBackdrop map={map} ov={waterArt} originX={originX} originY={originY} vx={waterViewRect.x} vy={waterViewRect.y} vw={waterViewRect.w} vh={waterViewRect.h} />}
      <svg
        width={worldW}
        height={worldH}
        viewBox={`${bounds.minSx} ${-padTop} ${worldW} ${worldH}`}
        style={{ display: 'block', overflow: 'visible', position: 'relative' }}
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="portalBeam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#bfe4ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#bfe4ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 지면 */}
        {/* 자연 지면 맵은 지면 캔버스가 대신한다(그리는 동안 옛 칸 타일이 번쩍이지 않게 비워 둠) */}
        {!map.terrain && <g>{ground}</g>}
        {/* 격자 외곽 */}
        {!map.water && !map.terrain && <polygon
          points={`${isoToScreen(0, 0).sx},${isoToScreen(0, 0).sy} ${isoToScreen(VW, 0).sx},${isoToScreen(VW, 0).sy} ${isoToScreen(VW, VH).sx},${isoToScreen(VW, VH).sy} ${isoToScreen(0, VH).sx},${isoToScreen(0, VH).sy}`}
          fill="none"
          stroke="rgba(217,164,65,0.35)"
          strokeWidth={3}
        />}
        {/* 오브젝트 (뒤 → 플레이어 → 앞) */}
        {behind}
        {playerNode}
        {front}
        {/* 마법진 포탈 — 건물보다 위에 그려 클릭 보장(수업 중엔 숨김) */}
        {!inClass && portalNodes}
      </svg>
    </div>
  )
}
