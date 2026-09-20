'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/lib/game-state'
import { ELEMENT_META } from '@/lib/constants'
import { MAPS, zoneAt } from '@/lib/maps'
import { MONSTERS, NPCS } from '@/lib/mock-data'
import { FURNITURE_CATALOG } from '@/lib/housing'
import { npcWanderPosition } from '@/lib/field'
import { Button } from '@/components/ui/button'
import { HeroPortrait } from '@/components/game/portrait'
import { HeroSprite as PixelHero } from '@/components/game/pixel-hero'
import { CreatureSprite, type Facing } from '@/components/game/creature-sprite'
import { IsoWorld } from '@/components/game/iso-world'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, DoorOpen, Hammer, MessageCircle, ShieldAlert, X } from 'lucide-react'

const TILE = 64
const MOVE_SPEED = 2.1 // 초당 이동 셀 수 (쿼터뷰 맵)
const FLAT_MOVE_SPEED = 4.3 // 이미지/아이소 맵 도보 속도
const IMG_ZOOM = 2.7 // 이미지 맵 확대 배율 — 캐릭터가 건물 사이를 걷는 스케일

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// 필드 스테이지(쿼터뷰) 바닥 — PixelLab로 그린 지역별 타일 텍스처. 아직 그리지 않은 bg 키는
// undefined로 남아 기존 zoneBg() CSS 그라디언트 바닥으로 폴백된다.
const FLOOR_TEXTURE: Partial<Record<string, string>> = {
  forest: '/images/map/floor/forest_floor.png',
  sea: '/images/map/floor/sea_floor.png',
  sky: '/images/map/floor/sky_floor.png',
  snow: '/images/map/floor/snow_floor.png',
  ruins: '/images/map/floor/ruins_floor.png',
  volcano: '/images/map/floor/volcano_floor.png',
}

// 마을 NPC 폰(pawn) 색 — 역할별 로브/그림자/머리
const ELEM_SPRITE: Record<string, { robe: string; shade: string; hair: string; accent: string }> = {
  fire: { robe: '#b5462f', shade: '#7f2e20', hair: '#efe4d2', accent: '#e8641f' },
  ice: { robe: '#3f7fa6', shade: '#2b566f', hair: '#dfeef6', accent: '#6fc3e6' },
  earth: { robe: '#6d7a3e', shade: '#4b5528', hair: '#e6ddc4', accent: '#caa246' },
}
const SKIN = '#f0d9bf'

// 구역별 기본 배경 (원작·나무위키 삽화 미사용 — 전부 CSS 그라디언트로 자체 제작)
function zoneBg(kind: string): string {
  switch (kind) {
    case 'school': // 마법학교 — 자수정 석조 + 창문 격자
      return 'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 26px), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 30px), linear-gradient(160deg, #3a3a78, #232152)'
    case 'forest': // 숲 — 층층 나뭇잎 캐노피 + 흙 패치
      return 'radial-gradient(circle at 33% 48%, rgba(96,72,48,0.38) 0 22px, transparent 26px), radial-gradient(circle at 78% 22%, rgba(88,66,44,0.32) 0 18px, transparent 22px), radial-gradient(circle at 20% 25%, rgba(120,190,110,0.35) 0 14px, transparent 15px), radial-gradient(circle at 70% 60%, rgba(90,160,90,0.3) 0 20px, transparent 22px), radial-gradient(circle at 45% 85%, rgba(140,200,120,0.25) 0 16px, transparent 18px), linear-gradient(180deg, #2f6b3a, #1c4726)'
    case 'sea': // 바다 — 물결 줄무늬
      return 'repeating-linear-gradient(115deg, rgba(255,255,255,0.10) 0 3px, transparent 3px 18px), linear-gradient(180deg, #2f86c0, #16466e)'
    case 'colosseum': // 콜로세움 — 모래 + 원형 경기장
      return 'radial-gradient(circle at 50% 50%, transparent 0 40%, rgba(0,0,0,0.18) 41% 43%, transparent 44%), radial-gradient(circle at 50% 50%, rgba(255,220,160,0.18), transparent 70%), linear-gradient(160deg, #c98a4a, #7a4a26)'
    case 'shopStreet': // 상점가 — 차양 줄무늬
      return 'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 10px, rgba(0,0,0,0.05) 10px 20px), linear-gradient(160deg, #d9a441, #8a5a1e)'
    case 'village': // 기숙사 마을 — 잔디 + 길
      return 'linear-gradient(90deg, transparent 44%, rgba(200,170,120,0.35) 45% 55%, transparent 56%), radial-gradient(circle at 30% 40%, rgba(120,190,110,0.25) 0 12px, transparent 14px), linear-gradient(180deg, #6fae5d, #3f7a38)'
    case 'military': // 연구동 — 강철 격자
      return 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 16px), linear-gradient(160deg, #8a8f9c, #4a4f5c)'
    case 'ruins': // 버려진 폐허 — 균열
      return 'repeating-linear-gradient(70deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 22px), repeating-linear-gradient(200deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 30px), linear-gradient(160deg, #4a3a5c, #221a30)'
    case 'sky': // 스톰헤이븐 — 폭풍 위 하늘길
      return 'radial-gradient(circle at 50% 15%, rgba(255,255,255,0.16), transparent 55%), repeating-linear-gradient(105deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 22px), linear-gradient(180deg, #6f8fc4, #35507e)'
    case 'snow': // 루미나 설원 — 눈밭 + 서리 결정
      return 'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.30) 0 10px, transparent 12px), radial-gradient(circle at 72% 62%, rgba(220,235,255,0.22) 0 14px, transparent 16px), linear-gradient(180deg, #dfeaf5, #a9c2dc)'
    case 'aurora': // 오로라 마을 — 얼음집 + 밤하늘 오로라
      return 'linear-gradient(115deg, rgba(120,255,200,0.14) 0 30%, transparent 55%), linear-gradient(250deg, rgba(150,120,255,0.16) 0 35%, transparent 60%), repeating-linear-gradient(90deg, rgba(200,235,255,0.10) 0 2px, transparent 2px 26px), linear-gradient(180deg, #1f3350, #10203a)'
    case 'plaza': // 중앙 광장 — 포석 + 분수 원형
      return 'radial-gradient(circle at 50% 42%, rgba(180,200,255,0.16) 0 26px, transparent 28px), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 28px), linear-gradient(160deg, #6b7290, #3f4560)'
    case 'park': // 공원 — 잔디 + 나무 점
      return 'radial-gradient(circle at 25% 30%, rgba(120,200,110,0.35) 0 12px, transparent 14px), radial-gradient(circle at 70% 65%, rgba(100,180,95,0.3) 0 16px, transparent 18px), linear-gradient(180deg, #4e9c4a, #2f6b30)'
    case 'farm': // 농가 — 밭이랑 줄무늬
      return 'repeating-linear-gradient(90deg, rgba(120,80,40,0.35) 0 6px, rgba(180,140,80,0.25) 6px 20px), linear-gradient(180deg, #caa74e, #8a6a2e)'
    case 'temple': // 신전 — 대리석 + 빛기둥
      return 'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 30px), radial-gradient(circle at 50% 20%, rgba(255,240,200,0.22), transparent 60%), linear-gradient(180deg, #d8c98a, #9a8a54)'
    case 'cave': // 동굴 — 어두운 암반 + 이끼
      return 'radial-gradient(circle at 30% 40%, rgba(90,150,90,0.18) 0 18px, transparent 20px), repeating-linear-gradient(35deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 26px), linear-gradient(160deg, #2b2f33, #16181b)'
    case 'mine': // 폐광산 — 갱목 격자 + 광맥
      return 'repeating-linear-gradient(0deg, rgba(120,90,50,0.3) 0 3px, transparent 3px 34px), repeating-linear-gradient(90deg, rgba(200,160,90,0.12) 0 1px, transparent 1px 20px), linear-gradient(160deg, #3a332c, #201c17)'
    case 'swamp': // 늪지 — 탁한 물 얼룩
      return 'radial-gradient(circle at 40% 60%, rgba(80,110,70,0.4) 0 30px, transparent 34px), radial-gradient(circle at 75% 25%, rgba(60,90,60,0.35) 0 26px, transparent 30px), linear-gradient(180deg, #3f4a34, #232b1c)'
    case 'deepsea': // 심해 — 짙은 청색 + 광선
      return 'radial-gradient(circle at 50% 0%, rgba(120,200,255,0.14), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 3px, transparent 3px 24px), linear-gradient(180deg, #123a5c, #06131f)'
    case 'atlantis': // 아틀란티스 — 수중 도시 석조
      return 'repeating-linear-gradient(90deg, rgba(180,230,255,0.12) 0 2px, transparent 2px 26px), repeating-linear-gradient(0deg, rgba(180,230,255,0.10) 0 2px, transparent 2px 30px), linear-gradient(160deg, #2f7fa8, #12455f)'
    case 'graveyard': // 묘지 — 비석 그림자
      return 'repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 6px, transparent 6px 40px), radial-gradient(circle at 50% 80%, rgba(120,140,160,0.12), transparent 60%), linear-gradient(180deg, #3a3f47, #1c1f24)'
    case 'volcano': // 화산지대 — 용암 균열
      return 'repeating-linear-gradient(50deg, rgba(255,90,20,0.22) 0 1px, transparent 1px 24px), repeating-linear-gradient(300deg, rgba(255,120,30,0.18) 0 1px, transparent 1px 32px), linear-gradient(160deg, #5a2418, #241009)'
    case 'demon': // 마물 영역 — 검붉은 안개
      return 'radial-gradient(circle at 50% 30%, rgba(200,40,60,0.20), transparent 60%), repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 20px), linear-gradient(160deg, #3a1230, #170512)'
    default:
      return 'linear-gradient(180deg, #1a1f45, #12163a)'
  }
}

export function WorldScreen() {
  const { state, dispatch } = useGame()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 960, h: 640 })
  const [moving, setMoving] = useState(false)
  const pressedKeys = useRef<Set<string>>(new Set())
  const lastTime = useRef<number | null>(null)
  const mapIdRef = useRef(state.currentMapId)
  mapIdRef.current = state.currentMapId

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setViewportSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      pressedKeys.current.add(e.key.toLowerCase())
      if (e.key.toLowerCase() === 'e') tryInteract()
    }
    const up = (e: KeyboardEvent) => pressedKeys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.position, state.screen])

  useEffect(() => {
    let raf = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (state.screen !== 'world') {
        lastTime.current = t
        return
      }
      if (lastTime.current == null) lastTime.current = t
      const dt = Math.min(0.06, (t - lastTime.current) / 1000)
      lastTime.current = t

      const keys = pressedKeys.current
      let dx = 0
      let dy = 0
      if (keys.has('arrowup') || keys.has('w')) dy -= 1
      if (keys.has('arrowdown') || keys.has('s')) dy += 1
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1
      if (keys.has('arrowright') || keys.has('d')) dx += 1
      const isMoving = dx !== 0 || dy !== 0
      setMoving((prev) => (prev === isMoving ? prev : isMoving))
      if (isMoving) {
        const len = Math.hypot(dx, dy) || 1
        const rm = MAPS[mapIdRef.current].render
        const spd = rm === 'image' || rm === 'iso' ? FLAT_MOVE_SPEED : MOVE_SPEED
        dispatch({ type: 'MOVE', dx: (dx / len) * spd * dt, dy: (dy / len) * spd * dt })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen])

  const map = MAPS[state.currentMapId]
  const floorTexture = FLOOR_TEXTURE[map.bg]
  const mapNpcs = useMemo(
    () => NPCS.filter((n) => map.zones.some((z) => z.id === n.zoneId)),
    [map],
  )

  function tryInteract() {
    const near = nearestNpc()
    if (near) dispatch({ type: 'OPEN_NPC', npcId: near.id })
  }

  function nearestNpc() {
    let best: (typeof NPCS)[number] | null = null
    let bestDist = 1.2
    for (const npc of mapNpcs) {
      // 배회 중인 NPC는 홈 셀이 아니라 현재(시간 기반) 배회 위치 기준으로 근접 판정
      const pos = npcWanderPosition(npc, Date.now())
      const d = Math.hypot(pos.x - state.position.x, pos.y - state.position.y)
      if (d < bestDist) {
        bestDist = d
        best = npc
      }
    }
    return best
  }

  const camX = viewportSize.w / 2 - state.position.x * TILE
  const camY = viewportSize.h / 2 - state.position.y * TILE

  // 이미지 맵: 확대(IMG_ZOOM)한 좌표계에서 플레이어를 화면 중앙에 두되,
  // 맵 밖 검은 여백이 보이지 않도록 카메라를 맵 경계 안으로 clamp.
  const EFF = TILE * IMG_ZOOM
  const planeW = map.grid.w * EFF
  const planeH = map.grid.h * EFF
  const flatCamX = clamp(
    viewportSize.w / 2 - state.position.x * EFF,
    Math.min(0, viewportSize.w - planeW),
    0,
  )
  const flatCamY = clamp(
    viewportSize.h / 2 - state.position.y * EFF,
    Math.min(0, viewportSize.h - planeH),
    0,
  )

  const visibleMonsters = useMemo(() => {
    return state.fieldMonsters.filter((fm) => {
      const d = Math.hypot(fm.homeCell.x - state.position.x, fm.homeCell.y - state.position.y)
      return d < 6.5
    })
  }, [state.fieldMonsters, state.position.x, state.position.y])

  // 군 통문(gate) 은 같은 셀에 여러 목적지가 겹치므로 하나의 마커로 합친다
  const gatePortals = useMemo(() => map.portals.filter((p) => p.kind === 'gate'), [map])
  const tilePortals = useMemo(() => map.portals.filter((p) => p.kind !== 'gate'), [map])
  const gateCell = gatePortals[0]?.cell

  const currentZone = zoneAt(map, state.position.x, state.position.y)
  const locationName = currentZone?.name ?? map.name
  const interactTarget = nearestNpc()
  const elem = ELEMENT_META[state.player.element]
  const encounterName = state.pendingEncounterUid
    ? MONSTERS.find(
        (m) => m.id === state.fieldMonsters.find((f) => f.uid === state.pendingEncounterUid)?.monsterId,
      )?.name
    : null
  const pendingPortal = state.pendingPortalId
    ? map.portals.find((p) => p.id === state.pendingPortalId)
    : null

  const iso = map.render === 'iso'
  const flat = !iso && !!map.bgImage

  // ── 이미지 맵(평면): 캐릭터/폰이 장면 안에 서 있는 형태로 렌더 ──
  const renderWorldSprites = () => (
    <>
      {tilePortals.map((p) => (
        <PortalPawn
          key={p.id}
          x={p.cell.x}
          y={p.cell.y}
          eff={EFF}
          kind={p.kind}
          label={`${p.label}${p.requiredLevel ? ` · Lv.${p.requiredLevel}+` : ''}`}
          onClick={() => dispatch({ type: 'USE_PORTAL', portalId: p.id })}
        />
      ))}
      {gateCell && (
        <PortalPawn
          x={gateCell.x}
          y={gateCell.y}
          eff={EFF}
          kind="gate"
          label="군 통문"
          onClick={() => dispatch({ type: 'OPEN_GATE' })}
        />
      )}
      {mapNpcs.map((npc) => (
        <NpcPawn
          key={npc.id}
          npc={npc}
          eff={EFF}
          active={interactTarget?.id === npc.id}
          onClick={() => dispatch({ type: 'OPEN_NPC', npcId: npc.id })}
        />
      ))}
      <HeroSprite
        x={state.position.x}
        y={state.position.y}
        eff={EFF}
        element={state.player.element}
        gender={state.player.gender}
        facing={state.facing}
        moving={moving}
      />
    </>
  )

  // ── 쿼터뷰(그라디언트) 맵: 기존 카드형 마커 ──
  const renderQuarterMarkers = () => (
    <>
      {tilePortals.map((p) => (
        <Marker key={p.id} x={p.cell.x} y={p.cell.y} tile={TILE} onClick={() => dispatch({ type: 'USE_PORTAL', portalId: p.id })}>
          <div
            className={`flex size-8 items-center justify-center rounded-full border-2 ${p.kind === 'exit' ? 'border-sky-300 bg-sky-950/80' : 'border-fuchsia-300 bg-fuchsia-950/80'}`}
          >
            <DoorOpen className={`size-4 ${p.kind === 'exit' ? 'text-sky-200' : 'text-fuchsia-200'}`} />
          </div>
          <span className="text-[9px] font-semibold text-fuchsia-100 whitespace-nowrap">
            {p.label}
            {p.requiredLevel ? ` · Lv.${p.requiredLevel}+` : ''}
          </span>
        </Marker>
      ))}

      {gateCell && (
        <Marker x={gateCell.x} y={gateCell.y} tile={TILE} onClick={() => dispatch({ type: 'OPEN_GATE' })}>
          <div className="flex size-9 items-center justify-center rounded-md border-2 border-amber-300 bg-amber-950/80">
            <DoorOpen className="size-5 text-amber-200" />
          </div>
          <span className="text-[10px] font-display text-amber-100 whitespace-nowrap">군 통문</span>
        </Marker>
      )}

      {mapNpcs.map((npc) => (
        <Marker key={npc.id} x={npc.cell.x} y={npc.cell.y} tile={TILE} onClick={() => dispatch({ type: 'OPEN_NPC', npcId: npc.id })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={npc.icon}
            alt={npc.name}
            width={44}
            height={44}
            style={{ imageRendering: 'pixelated' }}
            className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]"
          />
          <span className="text-[10px] font-semibold text-gold-soft whitespace-nowrap">{npc.name}</span>
        </Marker>
      ))}

      {visibleMonsters.map((fm) => {
        const def = MONSTERS.find((m) => m.id === fm.monsterId)
        if (!def) return null
        // 배회 방향(wanderSeed)에 대략 맞춰 스프라이트가 바라보는 쪽 결정
        const wdir = (['right', 'down', 'down', 'up'] as Facing[])[fm.wanderSeed % 4]
        return (
          <Marker key={fm.uid} x={fm.homeCell.x} y={fm.homeCell.y} tile={TILE} wanderSeed={fm.wanderSeed}>
            {def.isTestMonster ? (
              <div className="flex size-7 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-950">
                <CreatureSprite spriteId={def.id} fallbackSrc={def.icon} px={22} />
              </div>
            ) : (
              <CreatureSprite
                spriteId={def.id}
                fallbackSrc={def.icon}
                dir={wdir}
                walking
                px={30}
                className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]"
              />
            )}
            <span className={`text-[9px] font-semibold whitespace-nowrap ${def.isTestMonster ? 'text-emerald-200' : 'text-red-200'}`}>
              {def.isTestMonster ? 'TEST' : def.name}
            </span>
          </Marker>
        )
      })}

      <Marker x={state.position.x} y={state.position.y} tile={TILE}>
        <div
          className="h-14 w-11 overflow-hidden rounded-md border-2"
          style={{ borderColor: elem.color as string, background: '#1a1435' }}
        >
          <PixelHero element={state.player.element} gender={state.player.gender} dir={state.facing} walking={moving} px={52} className="h-full w-full" />
        </div>
        <span className="text-[10px] font-semibold text-white whitespace-nowrap">{state.player.name}</span>
      </Marker>
    </>
  )

  const dpadPress = (dx: number, dy: number) => {
    const key = dx === -1 ? 'arrowleft' : dx === 1 ? 'arrowright' : dy === -1 ? 'arrowup' : 'arrowdown'
    pressedKeys.current.add(key)
  }
  const dpadRelease = (dx: number, dy: number) => {
    const key = dx === -1 ? 'arrowleft' : dx === 1 ? 'arrowright' : dy === -1 ? 'arrowup' : 'arrowdown'
    pressedKeys.current.delete(key)
  }

  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-[#0b0907]" style={{ perspective: 1500 }}>
      {iso ? (
        <>
          <IsoWorld
            state={state}
            dispatch={dispatch}
            viewportSize={viewportSize}
            moving={moving}
            interactId={interactTarget?.id ?? null}
          />
          {/* 골든아워 따뜻한 앰비언트 */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                'linear-gradient(200deg, rgba(255,214,150,0.16) 0%, rgba(255,196,140,0.06) 38%, rgba(60,44,80,0.10) 100%)',
              mixBlendMode: 'soft-light',
            }}
          />
          {/* 가장자리 비네트 — 아이소 다이아몬드 여백을 어둡게 */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: 'radial-gradient(135% 105% at 50% 44%, rgba(0,0,0,0) 50%, rgba(20,14,28,0.70) 100%)' }}
          />
        </>
      ) : flat ? (
        /* ── 이미지 맵: 쿼터뷰 일러스트를 확대해 카메라를 따라다니며 탐험 ── */
        <div className="absolute left-0 top-0" style={{ transform: `translate3d(${flatCamX}px, ${flatCamY}px, 0)`, willChange: 'transform' }}>
          <div
            className="absolute left-0 top-0"
            style={{
              width: planeW,
              height: planeH,
              backgroundImage: `url(${map.bgImage})`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              backgroundColor: '#0e1230',
              boxShadow: '0 0 0 6px rgba(217,164,65,0.35), 0 30px 80px rgba(0,0,0,0.6)',
            }}
          />
          {/* 지면 위 은은한 비네트 — 장면 깊이감 */}
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: planeW,
              height: planeH,
              background:
                'radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%), linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 16%)',
            }}
          />
          {renderWorldSprites()}
        </div>
      ) : (
        /* ── 그라디언트 맵: 쿼터뷰 렌더 ── */
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate3d(${viewportSize.w / 2}px, ${viewportSize.h * 0.32}px, 0) rotateX(55deg) rotateZ(45deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute"
            style={{
              transform: `translate3d(${camX - viewportSize.w / 2}px, ${camY - viewportSize.h * 0.32}px, 0)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* 바닥 그리드 — PixelLab 타일 텍스처가 있으면 그걸, 없으면 기존 CSS 그라디언트 폴백 */}
            <div
              className="absolute"
              style={{
                left: 0,
                top: 0,
                width: map.grid.w * TILE,
                height: map.grid.h * TILE,
                backgroundImage: floorTexture
                  ? `linear-gradient(rgba(217,164,65,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(217,164,65,0.06) 1px, transparent 1px), url(${floorTexture})`
                  : `linear-gradient(rgba(217,164,65,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(217,164,65,0.10) 1px, transparent 1px), ${zoneBg(map.bg)}`,
                backgroundSize: floorTexture
                  ? `${TILE}px ${TILE}px, ${TILE}px ${TILE}px, ${TILE * 4}px ${TILE * 4}px`
                  : `${TILE}px ${TILE}px, ${TILE}px ${TILE}px, cover`,
                backgroundRepeat: floorTexture ? 'repeat, repeat, repeat' : undefined,
                backgroundColor: '#0e1230',
                boxShadow: '0 0 0 4px rgba(217,164,65,0.4), inset 0 0 120px rgba(0,0,0,0.55)',
              }}
            />

            {/* 구역 타일 (마을 등 town 맵) */}
            {map.zones.map((zone) => (
              <div key={zone.id}>
                <div
                  className="absolute"
                  style={{
                    left: zone.cell.x0 * TILE,
                    top: zone.cell.y0 * TILE,
                    width: (zone.cell.x1 - zone.cell.x0) * TILE,
                    height: (zone.cell.y1 - zone.cell.y0) * TILE,
                    background: zoneBg(zone.kind),
                    border: `2px solid ${zone.color}cc`,
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.35)',
                  }}
                />
                <BillboardLabel x={zone.cell.x0 + 0.15} y={zone.cell.y0 + 0.15} tile={TILE}>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-display text-gold-soft text-shadow-ink whitespace-nowrap">
                    {zone.name}
                  </span>
                </BillboardLabel>
              </div>
            ))}

            {/* 필드 지역 프롭 (숲 등) — 빌보드 PNG. 뒤(작은 x+y)부터 그려 앞 물체가 가리게 */}
            {map.props
              ?.slice()
              .sort((a, b) => a.cell.x + a.cell.y - (b.cell.x + b.cell.y))
              .map((p) => (
                <FieldProp key={p.id} p={p} tile={TILE} />
              ))}

            {renderQuarterMarkers()}
          </div>
        </div>
      )}

      {/* 상단 좌측 구역 안내 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20">
        <div className="panel-gilded px-3 py-1.5 text-xs text-gold-soft">
          현재 위치: <span className="font-display">{locationName}</span>
          {map.kind === 'field' && map.recommendedLevel ? (
            <span className="ml-1 text-muted-foreground">· 권장 Lv.{map.recommendedLevel}+</span>
          ) : null}
        </div>
      </div>

      {/* 상호작용 프롬프트 */}
      {interactTarget && !state.pendingEncounterUid && !state.pendingPortalId && !state.gateOpen && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <div className="panel-gilded flex items-center gap-2 px-3 py-1.5 text-xs text-gold-soft">
            <MessageCircle className="size-3.5" /> {interactTarget.name}와(과) 대화 (E)
          </div>
        </div>
      )}

      {/* 내 개인 공간 — 가구 배치 모드 */}
      {state.currentMapId === 'personal-space' && (
        <>
          <div className="pointer-events-auto absolute bottom-3 right-3 z-20">
            <Button
              variant={state.housing.editMode ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => dispatch({ type: 'HOUSING_TOGGLE_EDIT' })}
            >
              <Hammer className="size-3.5" /> {state.housing.editMode ? '배치 완료' : '가구 배치'}
            </Button>
          </div>
          {state.housing.editMode && (
            <div className="pointer-events-auto absolute inset-x-0 bottom-16 z-20 flex justify-center">
              <div className="panel-gilded flex max-w-[92vw] items-center gap-2 overflow-x-auto px-3 py-2">
                <span className="shrink-0 text-[11px] text-muted-foreground">바라보는 방향 앞에 놓기 →</span>
                {FURNITURE_CATALOG.map((f) => (
                  <button
                    key={f.id}
                    className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gold-soft hover:bg-white/10"
                    onClick={() => dispatch({ type: 'HOUSING_PLACE', defId: f.id })}
                  >
                    <img src={f.sprite.s} alt={f.label} className="h-8 w-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                    {f.label}
                  </button>
                ))}
                <span className="mx-1 shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <X className="size-3" /> 배치된 가구 클릭 시 제거
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* 군 통문 — 목적지 선택 */}
      {state.gateOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="panel-gilded flex w-[min(92vw,420px)] flex-col gap-3 px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 font-display text-sm text-gold-soft text-shadow-ink">
              <ShieldAlert className="size-4" /> 군 통문 — 어디로 나갈까?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {gatePortals.map((p) => {
                const under = p.requiredLevel != null && state.player.level < p.requiredLevel
                return (
                  <Button
                    key={p.id}
                    variant={under ? 'outline' : 'default'}
                    className="flex-col gap-0.5 py-3"
                    onClick={() => dispatch({ type: 'USE_PORTAL', portalId: p.id })}
                  >
                    <span>{p.label}</span>
                    {p.requiredLevel ? (
                      <span className={`text-[10px] ${under ? 'text-red-300' : 'text-black/60'}`}>
                        권장 Lv.{p.requiredLevel}+
                      </span>
                    ) : null}
                  </Button>
                )
              })}
            </div>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLOSE_GATE' })}>
              닫기
            </Button>
          </div>
        </div>
      )}

      {/* 포탈 타일 접촉 — 이동 여부 확인 */}
      {pendingPortal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="panel-gilded flex flex-col items-center gap-3 px-6 py-5 text-center">
            <div className="font-display text-sm text-gold-soft text-shadow-ink">
              {pendingPortal.label}
              {pendingPortal.requiredLevel ? ` (권장 Lv.${pendingPortal.requiredLevel}+)` : ''}
            </div>
            <div className="text-xs text-muted-foreground">이동할까?</div>
            <div className="flex gap-2">
              <Button variant="default" onClick={() => dispatch({ type: 'PORTAL_CONFIRM' })}>
                이동하기
              </Button>
              <Button variant="outline" onClick={() => dispatch({ type: 'PORTAL_CANCEL' })}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 몬스터 접촉 — 전투 여부 확인 */}
      {state.pendingEncounterUid && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="panel-gilded flex flex-col items-center gap-3 px-6 py-5 text-center">
            <div className="font-display text-sm text-gold-soft text-shadow-ink">
              {encounterName ?? '몬스터'}와(과) 마주쳤다!
            </div>
            <div className="text-xs text-muted-foreground">전투를 시작할까?</div>
            <div className="flex gap-2">
              <Button variant="default" onClick={() => dispatch({ type: 'ENCOUNTER_FIGHT' })}>
                전투하기
              </Button>
              <Button variant="outline" onClick={() => dispatch({ type: 'ENCOUNTER_FLEE' })}>
                피하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일용 D-Pad */}
      <div className="absolute bottom-4 right-4 z-20 grid grid-cols-3 grid-rows-3 gap-1 select-none sm:hidden">
        <div />
        <DpadBtn icon={<ArrowUp className="size-4" />} onDown={() => dpadPress(0, -1)} onUp={() => dpadRelease(0, -1)} />
        <div />
        <DpadBtn icon={<ArrowLeft className="size-4" />} onDown={() => dpadPress(-1, 0)} onUp={() => dpadRelease(-1, 0)} />
        <button
          className="panel-gilded flex size-10 items-center justify-center text-[10px] text-gold-soft"
          onClick={tryInteract}
        >
          talk
        </button>
        <DpadBtn icon={<ArrowRight className="size-4" />} onDown={() => dpadPress(1, 0)} onUp={() => dpadRelease(1, 0)} />
        <div />
        <DpadBtn icon={<ArrowDown className="size-4" />} onDown={() => dpadPress(0, 1)} onUp={() => dpadRelease(0, 1)} />
        <div />
      </div>
    </div>
  )
}

function DpadBtn({ icon, onDown, onUp }: { icon: ReactNode; onDown: () => void; onUp: () => void }) {
  return (
    <button
      className="panel-gilded flex size-10 items-center justify-center text-gold-soft active:brightness-125"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      {icon}
    </button>
  )
}

interface MarkerProps {
  x: number
  y: number
  tile: number
  children: ReactNode
  onClick?: () => void
  wanderSeed?: number
}

// ────────────────────────────────────────────────────────────────
// 이미지 맵(평면)용 인게임 스프라이트 — 캐릭터/NPC/포탈이 장면에 서 있는 형태
// 좌표 (x,y) 는 발밑(그라운드) 기준. 그림자는 발밑에, 몸은 위로 세운다.
// ────────────────────────────────────────────────────────────────

/** 플레이어 캐릭터 */
function HeroSprite({
  x,
  y,
  eff,
  element,
  gender,
  facing,
  moving,
}: {
  x: number
  y: number
  eff: number
  element: 'fire' | 'ice' | 'earth'
  gender: 'male' | 'female'
  facing: 'up' | 'down' | 'left' | 'right'
  moving: boolean
}) {
  const p = ELEM_SPRITE[element] ?? ELEM_SPRITE.fire
  const flip = facing === 'left'
  const back = facing === 'up'
  return (
    <div className="pointer-events-none absolute z-10" style={{ left: x * eff, top: y * eff }}>
      {/* 발밑 그림자 */}
      <div
        style={{
          position: 'absolute',
          left: -16,
          top: -6,
          width: 32,
          height: 11,
          borderRadius: '50%',
          background: 'radial-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          transform: `translate(-50%, 0)`,
          transformOrigin: 'bottom center',
          animation: moving ? 'sprite-walk 0.5s ease-in-out infinite' : 'sprite-idle 2.6s ease-in-out infinite',
          filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.45))',
        }}
      >
        <PixelHero element={element} gender={gender} dir={facing} walking={moving} px={72} />
      </div>
    </div>
  )
}

/** 마을 NPC */
function NpcPawn({
  npc,
  eff,
  active,
  onClick,
}: {
  npc: { id: string; name: string; role: string; icon: string; cell: { x: number; y: number } }
  eff: number
  active: boolean
  onClick: () => void
}) {
  return (
    <div
      className="absolute z-10 cursor-pointer"
      style={{ left: npc.cell.x * eff, top: npc.cell.y * eff }}
      onClick={onClick}
    >
      <div
        style={{
          position: 'absolute',
          left: -14,
          top: -5,
          width: 28,
          height: 9,
          borderRadius: '50%',
          background: 'radial-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          transform: 'translate(-50%, 0)',
          transformOrigin: 'bottom center',
          animation: 'sprite-idle 2.8s ease-in-out infinite',
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={npc.icon} alt={npc.name} width={62} height={62} style={{ imageRendering: 'pixelated', display: 'block' }} />
      </div>
      {/* 이름표 + 대화 표시 */}
      <div style={{ position: 'absolute', left: 0, bottom: 64, transform: 'translate(-50%, 0)' }}>
        <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold text-shadow-ink ${
              active ? 'bg-gold text-black' : 'bg-black/65 text-gold-soft'
            }`}
          >
            {npc.name}
          </span>
          <MessageCircle className={`size-3.5 ${active ? 'text-gold-soft' : 'text-white/70'}`} style={{ animation: 'sprite-idle 1.6s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  )
}

/** 포탈 / 군 통문 — 지면의 빛무리 + 문 아이콘 */
function PortalPawn({
  x,
  y,
  eff,
  kind,
  label,
  onClick,
}: {
  x: number
  y: number
  eff: number
  kind: 'gate' | 'portal' | 'exit'
  label: string
  onClick: () => void
}) {
  const color = kind === 'gate' ? '#f0c040' : kind === 'exit' ? '#7fd0f0' : '#e879f9'
  const big = kind === 'gate'
  return (
    <div className="absolute z-[9] cursor-pointer" style={{ left: x * eff, top: y * eff }} onClick={onClick}>
      {/* 지면 빛무리 */}
      <div
        style={{
          position: 'absolute',
          left: big ? -34 : -24,
          top: big ? -16 : -12,
          width: big ? 68 : 48,
          height: big ? 26 : 18,
          borderRadius: '50%',
          background: `radial-gradient(${color}cc, ${color}00 70%)`,
          animation: 'portal-pulse 2s ease-in-out infinite',
        }}
      />
      <div style={{ position: 'absolute', left: 0, bottom: 6, transform: 'translate(-50%, 0)' }}>
        <div
          className="flex items-center justify-center rounded-md border-2"
          style={{
            width: big ? 34 : 26,
            height: big ? 34 : 26,
            borderColor: color,
            background: 'rgba(10,8,16,0.78)',
            boxShadow: `0 0 12px ${color}aa`,
          }}
        >
          <DoorOpen style={{ width: big ? 18 : 14, height: big ? 18 : 14, color }} />
        </div>
      </div>
      <div
        className={`absolute whitespace-nowrap rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold ${big ? 'font-display' : ''}`}
        style={{ left: 0, bottom: big ? 46 : 38, transform: 'translate(-50%, 0)', color }}
      >
        {label}
      </div>
    </div>
  )
}

function Marker({
  x,
  y,
  tile,
  children,
  onClick,
  wanderSeed,
}: MarkerProps) {
  return (
    <div
      className="absolute"
      style={{
        left: x * tile,
        top: y * tile,
        transformStyle: 'preserve-3d',
        animation: wanderSeed != null ? `wander-${wanderSeed % 4} 3.4s ease-in-out infinite` : undefined,
        animationDelay: wanderSeed != null ? `${(wanderSeed % 1000) / 1000}s` : undefined,
      }}
    >
      {/* 쿼터뷰 정면을 향하는 레이어. 콘텐츠를 화면상 위로 띄우고 지면과 기둥으로 연결 */}
      <div style={{ transform: 'rotateX(-55deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}>
        {/* 지면 그림자 */}
        <div
          style={{
            position: 'absolute',
            left: -9,
            top: -4,
            width: 18,
            height: 8,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            filter: 'blur(1.5px)',
          }}
        />
        {/* 기둥 */}
        <div
          style={{
            position: 'absolute',
            left: -1,
            top: -40,
            width: 2,
            height: 40,
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          }}
        />
        {/* 떠 있는 콘텐츠 (다크 플레이트) */}
        <div
          className={onClick ? 'cursor-pointer' : ''}
          onClick={onClick}
          style={{ position: 'absolute', left: 0, top: -40, transform: 'translate(-50%, -100%)' }}
        >
          <div className="flex flex-col items-center gap-0.5 rounded-lg border border-gold/60 bg-[#14100a]/90 px-1.5 py-1 shadow-[0_4px_10px_rgba(0,0,0,0.6)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function BillboardLabel({ x, y, tile, children }: { x: number; y: number; tile: number; children: ReactNode }) {
  return (
    <div className="absolute" style={{ left: x * tile, top: y * tile, transformStyle: 'preserve-3d' }}>
      <div style={{ transform: 'rotateX(-55deg) rotateZ(-45deg) translateY(-14px)' }}>{children}</div>
    </div>
  )
}

/** 필드 지역 소품 — 쿼터뷰 지면에 발밑 앵커를 맞춰 세우는 빌보드 스프라이트 */
function FieldProp({ p, tile }: { p: { cell: { x: number; y: number }; sprite?: string; px?: { w: number; h: number }; anchor?: { x: number; y: number } }; tile: number }) {
  const S = 0.55 // 파일 픽셀 → 화면 배율 (52px 주인공 대비 균형)
  const fw = p.px?.w ?? 48
  const fh = p.px?.h ?? 48
  const w = fw * S
  const h = fh * S
  const ax = (p.anchor?.x ?? fw / 2) * S
  const ay = (p.anchor?.y ?? fh) * S
  if (!p.sprite) return null
  return (
    <div className="absolute" style={{ left: p.cell.x * tile, top: p.cell.y * tile, transformStyle: 'preserve-3d' }}>
      <div style={{ transform: 'rotateX(-55deg) rotateZ(-45deg)' }}>
        <div
          style={{
            position: 'absolute',
            left: -w * 0.3,
            top: -7,
            width: w * 0.6,
            height: 9,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.32)',
            filter: 'blur(2px)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.sprite}
          alt=""
          width={w}
          height={h}
          style={{ position: 'absolute', left: -ax, top: -ay, imageRendering: 'pixelated', pointerEvents: 'none' }}
        />
      </div>
    </div>
  )
}
