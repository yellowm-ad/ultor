'use client'

import { useMemo, useState, useEffect, type Dispatch } from 'react'
import type { Action } from '@/lib/game-state'
import type { GameState } from '@/lib/types'
import { MAPS } from '@/lib/maps'
import { ELEMENT_META } from '@/lib/constants'
import { NPCS, MONSTERS } from '@/lib/mock-data'
import { wanderState, npcWanderState } from '@/lib/field'
import { ISO_TILE_W, ISO_TILE_H, isoToScreen, isoBounds, TILE_COLORS, TILE_SPRITES } from '@/lib/iso'
import type { TileKind, PropDef } from '@/lib/iso'
import { renderProp } from '@/components/game/iso-sprites'
import { FURNITURE_BY_ID } from '@/lib/housing'
import { CreatureSprite, NpcSprite } from '@/components/game/creature-sprite'

const SCALE = 1.15 // 맵 4배 확장(52×40)에 맞춰 축소 (기존 1.4)
const PAD_TOP = 240 // 키 큰 건물이 앵커 위로 솟는 여유
const PAD_BOTTOM = 60
const HW = ISO_TILE_W / 2
const HH = ISO_TILE_H / 2

// 프롭 종류별 대략 높이 (지면 그림자 계산용)
const H_BY_KIND: Record<string, number> = {
  hall: 72, dome: 60, cottage: 30, shop: 44, tower: 40, barn: 26, windmill: 46, gate: 56, wall: 22,
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 라스터(PNG) 프롭 — 발밑 앵커를 원점(0,0)에 맞춰 배치. assets:'raster' 맵에서만 사용 */
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

const ELEM_SPRITE: Record<string, { robe: string; shade: string; hair: string; accent: string }> = {
  fire: { robe: '#b5462f', shade: '#7f2e20', hair: '#efe4d2', accent: '#e8641f' },
  ice: { robe: '#3f7fa6', shade: '#2b566f', hair: '#dfeef6', accent: '#6fc3e6' },
  earth: { robe: '#6d7a3e', shade: '#4b5528', hair: '#e6ddc4', accent: '#caa246' },
}

export function IsoWorld({
  state,
  dispatch,
  viewportSize,
  moving,
  interactId,
}: {
  state: GameState
  dispatch: Dispatch<Action>
  viewportSize: { w: number; h: number }
  moving: boolean
  interactId: string | null
}) {
  const map = MAPS[state.currentMapId]
  const [heroFrame, setHeroFrame] = useState(0)
  useEffect(() => {
    if (!moving) { setHeroFrame(0); return }
    const id = setInterval(() => setHeroFrame((f) => (f + 1) % 8), 115)
    return () => clearInterval(id)
  }, [moving])

  // 필드 몬스터 배회 애니메이션 시각(視刻) — 10fps 면 충분히 자연스럽다
  const [wanderT, setWanderT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setWanderT(performance.now()), 100)
    return () => clearInterval(id)
  }, [])
  const { w: VW, h: VH } = map.grid
  const bounds = useMemo(() => isoBounds(VW, VH), [VW, VH])
  const originX = -bounds.minSx
  const originY = PAD_TOP
  const worldW = bounds.width
  const worldH = bounds.height + PAD_TOP + PAD_BOTTOM

  // 지면 (정적 — 메모)
  const ground = useMemo(() => {
    const tiles: React.ReactNode[] = []
    for (let y = 0; y < VH; y++) {
      for (let x = 0; x < VW; x++) {
        const kind: TileKind = map.tileAt ? map.tileAt(x + 0.5, y + 0.5) : 'grass'
        const a = isoToScreen(x, y)
        const sprite = map.assets === 'raster' ? TILE_SPRITES[kind] : undefined
        if (sprite) {
          // 다이메트릭 타일 PNG: 상단 꼭짓점(a)에 맞춰 배치.
          // 셀 해시로 좌우/상하 뒤집어 반복 패턴(솔기) 완화.
          const h = ((x * 73856093) ^ (y * 19349663)) >>> 0
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
    return tiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, VW, VH])

  // 건물 지면 그림자 (정적 — 메모)
  const castShadows = useMemo(() => {
    const out: React.ReactNode[] = []
    for (const p of map.props ?? []) {
      if (p.sprite) continue // 라스터 스프라이트는 그림자를 자체 포함
      const H = H_BY_KIND[p.kind]
      if (!H || !p.size) continue
      const { w, d } = p.size
      const s = isoToScreen(p.cell.x, p.cell.y)
      const A = [0, 0]
      const B = [w * HW, w * HH]
      const Dp = [-d * HW, d * HH]
      const Cp = [w * HW - d * HW, w * HH + d * HH]
      const ox = H * 0.55
      const oy = H * 0.3
      const off = (pt: number[]) => [pt[0] + ox, pt[1] + oy]
      const pts = [A, B, off(B), off(Cp), off(Dp), Dp].map((pt) => pt.join(',')).join(' ')
      out.push(<polygon key={p.id} transform={`translate(${s.sx},${s.sy})`} points={pts} fill="rgba(58,42,22,0.16)" />)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // 정적 오브젝트(건물·나무·NPC·포탈) — 깊이정렬 목록
  const staticEntities = useMemo(() => {
    const list: { sortY: number; node: React.ReactNode }[] = []

    const raster = map.assets === 'raster'
    for (const p of map.props ?? []) {
      // 원형 구조물(콜로세움·분수)은 앵커가 중심이라 half 가산 없이 정렬
      const half = p.radial ? 0 : ((p.size?.w ?? 0.4) + (p.size?.d ?? 0.4)) / 2
      const s = isoToScreen(p.cell.x, p.cell.y)
      list.push({
        sortY: p.cell.x + p.cell.y + half,
        node: (
          <g key={p.id} transform={`translate(${s.sx},${s.sy})`}>
            {raster && p.sprite ? <RasterProp p={p} /> : renderProp(p)}
          </g>
        ),
      })
    }

    list.sort((a, b) => a.sortY - b.sortY)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // NPC — 홈 셀(npc.cell) 주변을 배회(npcWanderPosition, 몬스터와 동일한 시간기반 리사주 곡선).
  // wanderT 마다 위치 재계산되므로 static 메모 밖(몬스터와 동일 패턴)에 둔다.
  const mapNpcsForRoam = useMemo(() => NPCS.filter((n) => map.zones.some((z) => z.id === n.zoneId)), [map])
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
            <NpcSprite npcId={`${npc.id}-walk`} fallbackSrc={npc.icon} dir={dir} walking={moving} px={ND} />
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
  const fieldRankScale = (rank?: string) => (rank === 'fieldBoss' ? 4.2 : rank === 'midBoss' ? 2.1 : 1)
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
                fill={def.isTestMonster ? 'rgba(6,60,30,0.75)' : def.rank === 'fieldBoss' ? 'rgba(120,20,10,0.85)' : def.rank === 'midBoss' ? 'rgba(90,50,10,0.8)' : 'rgba(60,10,10,0.68)'}
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
      const s = isoToScreen(p.cell.x, p.cell.y)
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
  const pe = ELEM_SPRITE[state.player.element] ?? ELEM_SPRITE.fire
  const ps = isoToScreen(state.position.x, state.position.y)
  const playerSortY = state.position.x + state.position.y
  // PixelLab 4등신 스프라이트 시트: 88px 셀, 8열 × 4행.
  //   row0 = 8방향 회전 (s0 se1 e2 ne3 n4 nw5 w6 sw7), row1/2/3 = south/east/north 걷기 8프레임.
  //   west(좌) 걷기는 east 행(row2)을 좌우 반전.
  const DIR_COL: Record<string, number> = { down: 0, right: 2, up: 4, left: 6 }
  const WALK_ROW: Record<string, number> = { down: 1, right: 2, left: 2, up: 3 }
  const facing = state.facing
  let heroCol: number
  let heroRow = 0
  if (moving && WALK_ROW[facing] != null) {
    heroRow = WALK_ROW[facing]
    heroCol = heroFrame % 8
  } else {
    heroCol = DIR_COL[facing] ?? 0
  }
  const heroFlip = moving && facing === 'left'
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
          <image href={`/images/sprites/hero-${state.player.element}-${state.player.gender}.png`} width={704} height={352} />
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
          const prop: PropDef = { id: f.id, kind: 'cottage', cell: f.cell, sprite: def.sprite.s, px: { w: def.sprite.w, h: def.sprite.h } }
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

  const allEntities = [...staticEntities, ...monsterEntities, ...npcEntities, ...furnitureEntities].sort((a, b) => a.sortY - b.sortY)
  const behind = allEntities.filter((e) => e.sortY <= playerSortY).map((e) => e.node)
  const front = allEntities.filter((e) => e.sortY > playerSortY).map((e) => e.node)

  const camX = clamp(viewportSize.w / 2 - (originX + ps.sx) * SCALE, Math.min(0, viewportSize.w - worldW * SCALE), 0)
  const camY = clamp(viewportSize.h / 2 - (originY + ps.sy) * SCALE, Math.min(0, viewportSize.h - worldH * SCALE), 0)

  return (
    <div className="absolute left-0 top-0" style={{ transform: `translate3d(${camX}px, ${camY}px, 0) scale(${SCALE})`, transformOrigin: '0 0', willChange: 'transform' }}>
      <svg
        width={worldW}
        height={worldH}
        viewBox={`${bounds.minSx} ${-PAD_TOP} ${worldW} ${worldH}`}
        style={{ display: 'block', overflow: 'visible' }}
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="portalBeam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#bfe4ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#bfe4ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 지면 */}
        <g>{ground}</g>
        {/* 건물 그림자 */}
        <g>{castShadows}</g>
        {/* 격자 외곽 */}
        <polygon
          points={`${isoToScreen(0, 0).sx},${isoToScreen(0, 0).sy} ${isoToScreen(VW, 0).sx},${isoToScreen(VW, 0).sy} ${isoToScreen(VW, VH).sx},${isoToScreen(VW, VH).sy} ${isoToScreen(0, VH).sx},${isoToScreen(0, VH).sy}`}
          fill="none"
          stroke="rgba(217,164,65,0.35)"
          strokeWidth={3}
        />
        {/* 오브젝트 (뒤 → 플레이어 → 앞) */}
        {behind}
        {playerNode}
        {front}
        {/* 마법진 포탈 — 건물보다 위에 그려 클릭 보장 */}
        {portalNodes}
      </svg>
    </div>
  )
}
