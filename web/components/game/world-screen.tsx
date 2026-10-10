'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS, zoneAt } from '@/lib/maps'
import { MONSTERS, NPCS, npcById } from '@/lib/mock-data'
import { rosterOnMap, rosterWanderNpc } from '@/lib/school-roster'
import { FURNITURE_CATALOG } from '@/lib/housing'
import { npcWanderPosition } from '@/lib/field'
import { GATHER_NODE_META, isActivityUnlocked, isNearWater, nearestGatherNode } from '@/lib/life'
import { Button } from '@/components/ui/button'
import { IsoWorld } from '@/components/game/iso-world'
import { useGuide } from '@/components/game/guide-trail'
import { mapLockReason } from '@/lib/passages'
import { WeatherLayer } from '@/components/game/weather-layer'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hammer, MessageCircle, ShieldAlert, X } from 'lucide-react'

// 전 맵이 아이소 도트 엔진(iso-world.tsx)으로 렌더된다 — 옛 CSS 그라디언트/일러스트 렌더 경로는 제거됨(2026-09-28)
const MOVE_SPEED = 4.3 // 초당 이동 셀 수
/** Shift 달리기 — 이동속도 2배 */
const RUN_MULT = 2

export function WorldScreen() {
  const { state, dispatch } = useGame()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 960, h: 640 })
  const [moving, setMoving] = useState(false)
  const [running, setRunning] = useState(false)
  const pressedKeys = useRef<Set<string>>(new Set())
  const lastTime = useRef<number | null>(null)

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

  // 수업 장면·미니게임(리듬 Q/W/E/R 등)이 떠 있는 동안엔 월드 입력을 완전히 끊는다 — 눌려 있던 이동키도 비움
  const inputLocked = !!state.classScene
  useEffect(() => {
    if (inputLocked) pressedKeys.current.clear()
  }, [inputLocked])

  useEffect(() => {
    // e.code(물리 키) 기준 — 한글 IME 상태에서도 W/A/S/D·E 가 그대로 동작
    const down = (e: KeyboardEvent) => {
      if (inputLocked) return
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      pressedKeys.current.add(e.code)
      if (e.code === 'KeyE' && !e.repeat) tryInteract()
    }
    const up = (e: KeyboardEvent) => pressedKeys.current.delete(e.code)
    // 창 포커스를 잃으면 keyup 이 안 와서 키가 눌린 채로 남는다 → 비움
    const blur = () => pressedKeys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.position, state.screen, state.fishing, state.storyQueue.length, state.life, inputLocked])

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
      // 이동 = W/A/S/D(방향키도 보조로 허용), 달리기 = Shift
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
      const isMoving = dx !== 0 || dy !== 0
      const isRunning = isMoving && (keys.has('ShiftLeft') || keys.has('ShiftRight'))
      setMoving((prev) => (prev === isMoving ? prev : isMoving))
      setRunning((prev) => (prev === isRunning ? prev : isRunning))
      if (isMoving) {
        const len = Math.hypot(dx, dy) || 1
        const sp = MOVE_SPEED * (isRunning ? RUN_MULT : 1)
        dispatch({ type: 'MOVE', dx: (dx / len) * sp * dt, dy: (dy / len) * sp * dt })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen])

  const map = MAPS[state.currentMapId]
  /** 맵 톤(자연 지면 맵) — 1 초과 밝은 지역, 1 미만 어두운 지역. 그 밖의 맵은 1 */
  const tone = map.terrain?.tone ?? map.ambientTone ?? 1
  const mapNpcs = useMemo(
    () => NPCS.filter((n) => map.zones.some((z) => z.id === n.zoneId) && (!n.visibleFlag || !!state.storyFlags[n.visibleFlag])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, state.storyFlags],
  )

  /** E 상호작용 우선순위: NPC → 채집 지점 → 물가 낚시 */
  function tryInteract() {
    if (state.screen !== 'world' || state.fishing || state.storyQueue.length > 0) return
    const near = nearestNpc()
    if (near) {
      dispatch({ type: 'OPEN_NPC', npcId: near.id })
      return
    }
    const secret = nearestSecret()
    if (secret) {
      dispatch({ type: 'USE_PORTAL', portalId: secret.id })
      return
    }
    const node = nearestGatherNode(map, state.life, state.position)
    if (node) {
      dispatch({ type: 'GATHER', nodeKey: node.key })
      return
    }
    if (isActivityUnlocked(state, 'fishing') && isNearWater(map, state.position)) dispatch({ type: 'START_FISHING' })
  }

  /** 숨겨진 통로 — 가까이(1.3셀)에서만 E 로 열린다 */
  function nearestSecret() {
    return map.portals.find((p) => p.secret && Math.hypot(p.cell.x - state.position.x, p.cell.y - state.position.y) < 1.3) ?? null
  }

  function nearestNpc() {
    let best: (typeof NPCS)[number] | null = null
    let bestDist = 1.2
    for (const npc of mapNpcs) {
      // 배회 중인 NPC는 홈 셀이 아니라 현재(시간 기반) 배회 위치 기준으로 근접 판정
      const pos = npcWanderPosition(npc, performance.now(), map.blockers)
      const d = Math.hypot(pos.x - state.position.x, pos.y - state.position.y)
      if (d < bestDist) {
        bestDist = d
        best = npc
      }
    }
    // 이번 주 이 방·로비에 서 있는 학교 동료(lib/school-roster)
    for (const spot of rosterOnMap(state)) {
      // 배회 중인 지금 위치로 판정(iso-world 와 같은 계산)
      const pos = npcWanderPosition(rosterWanderNpc(spot), performance.now(), map.blockers)
      const d = Math.hypot(pos.x - state.position.x, pos.y - state.position.y)
      const def = npcById(spot.npcId)
      if (def && d < bestDist) {
        bestDist = d
        best = def
      }
    }
    return best
  }

  // 퀘스트 길찾기 — 켜고 끄기는 브라우저에 기억
  const [guideOn, setGuideOn] = useState(true)
  useEffect(() => {
    try {
      if (window.localStorage.getItem('ultor-guide') === 'off') setGuideOn(false)
    } catch {
      // 저장소 접근 불가 — 기본값(켬)
    }
  }, [])
  const toggleGuide = () =>
    setGuideOn((on) => {
      try {
        window.localStorage.setItem('ultor-guide', on ? 'off' : 'on')
      } catch {
        // 무시
      }
      return !on
    })
  const guide = useGuide(state, map, true)

  const furnOwned = (itemId: string) => state.inventory.find((s) => s.itemId === itemId)?.qty ?? 0

  // 군 통문(gate) 목적지 목록
  const gatePortals = useMemo(() => map.portals.filter((p) => p.kind === 'gate'), [map])

  const currentZone = zoneAt(map, state.position.x, state.position.y)
  const locationName = currentZone?.name ?? map.name
  const interactTarget = nearestNpc()
  const nearSecret = interactTarget ? null : nearestSecret()
  const nearNode = interactTarget || nearSecret ? null : nearestGatherNode(map, state.life, state.position)
  const lifePrompt = interactTarget
    ? null
    : nearSecret
      ? `${nearSecret.label} 살펴보기`
      : nearNode
      ? `${GATHER_NODE_META[nearNode.kind].verb} — ${GATHER_NODE_META[nearNode.kind].name}`
      : isActivityUnlocked(state, 'fishing') && isNearWater(map, state.position)
        ? '낚시'
        : null
  const encounterName = state.pendingEncounterUid
    ? MONSTERS.find(
        (m) => m.id === state.fieldMonsters.find((f) => f.uid === state.pendingEncounterUid)?.monsterId,
      )?.name
    : null
  const pendingPortal = state.pendingPortalId
    ? map.portals.find((p) => p.id === state.pendingPortalId)
    : null

  const dpadPress = (dx: number, dy: number) => {
    const key = dx === -1 ? 'ArrowLeft' : dx === 1 ? 'ArrowRight' : dy === -1 ? 'ArrowUp' : 'ArrowDown'
    pressedKeys.current.add(key)
  }
  const dpadRelease = (dx: number, dy: number) => {
    const key = dx === -1 ? 'ArrowLeft' : dx === 1 ? 'ArrowRight' : dy === -1 ? 'ArrowUp' : 'ArrowDown'
    pressedKeys.current.delete(key)
  }

  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-[#0b0907]" style={{ perspective: 1500 }}>
      <>
    <IsoWorld
      state={state}
      dispatch={dispatch}
      viewportSize={viewportSize}
      moving={moving}
      running={running}
      interactId={interactTarget?.id ?? nearNode?.key ?? null}
      guide={guideOn ? guide : null}
    />
    {/* 날씨(설원 눈·화산 불티·폭풍) — 화면 고정 층 */}
    {map.terrain?.weather && <WeatherLayer kind={map.terrain.weather} />}
    {/* 골든아워 따뜻한 앰비언트 — 밝은 지역(map.terrain.tone > 1)은 햇살을 더 세게 */}
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background:
          tone > 1
            ? 'linear-gradient(200deg, rgba(255,236,180,0.30) 0%, rgba(255,226,170,0.14) 40%, rgba(255,214,160,0.04) 100%)'
            : 'linear-gradient(200deg, rgba(255,214,150,0.16) 0%, rgba(255,196,140,0.06) 38%, rgba(60,44,80,0.10) 100%)',
        mixBlendMode: 'soft-light',
      }}
    />
    {/* 어두운 지역(tone < 1) — 캐릭터 주변만 조금 밝게 남기고 화면 전체를 누른다(따뜻한 검정) */}
    {tone < 1 && (
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: `radial-gradient(110% 90% at 50% 47%, rgba(8,6,6,${((1 - tone) * 0.5).toFixed(2)}) 0%, rgba(8,6,6,${((1 - tone) * 1.2).toFixed(2)}) 62%, rgba(8,6,6,${Math.min(0.6, (1 - tone) * 2.4).toFixed(2)}) 100%)`,
        }}
      />
    )}
    {/* 가장자리 비네트 — 아이소 다이아몬드 여백을 어둡게(밝은 지역은 옅게) */}
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ background: `radial-gradient(135% 105% at 50% 44%, rgba(0,0,0,0) 50%, rgba(20,14,28,${tone > 1 ? 0.4 : 0.55}) 100%)` }}
    />
      </>

      {/* 상단 좌측 구역 안내 */}
      <div className="world-location-label pointer-events-none absolute bottom-3 left-3 z-20">
        <div className="panel-gilded whitespace-nowrap px-3 py-1.5 text-xs text-gold-soft">
          현재 위치: <span className="font-display">{locationName}</span>
          {map.kind === 'field' && map.recommendedLevel ? (
            <span className="ml-1 text-muted-foreground">· 권장 Lv.{map.recommendedLevel}+</span>
          ) : null}
        </div>
      </div>

      {/* 퀘스트 길찾기 — 지금 목표와 가는 길(누르면 바닥 안내선 켜고 끄기) */}
      {guide && !state.classScene && (
        <button type="button" onClick={toggleGuide} className="guide-chip absolute left-3 top-[168px] z-20 text-left" title="길 안내 켜기/끄기">
          <span className="guide-chip-head">
            <span className={`guide-chip-dot ${guideOn ? 'is-on' : ''}`} />
            {guide.goal.quest || '이번 주 목표'}
          </span>
          <span className="guide-chip-label">{guide.goal.label}</span>
          <span className="guide-chip-route">{guide.route.here ? guide.goal.place : guide.route.hint}</span>
          {!guideOn && <span className="guide-chip-route">길 안내 꺼짐 — 누르면 켜짐</span>}
        </button>
      )}

      {/* 상호작용 프롬프트 */}
      {interactTarget && !state.pendingEncounterUid && !state.pendingPortalId && !state.gateOpen && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <div className="panel-gilded flex items-center gap-2 px-3 py-1.5 text-xs text-gold-soft">
            <MessageCircle className="size-3.5" /> {interactTarget.name}와(과) 대화 <span className="touch-hide">(E)</span>
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
                {FURNITURE_CATALOG.filter((f) => !f.itemId || furnOwned(f.itemId) > 0).map((f) => (
                  <button
                    key={f.id}
                    className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gold-soft hover:bg-white/10"
                    onClick={() => dispatch({ type: 'HOUSING_PLACE', defId: f.id })}
                  >
                    <img src={f.sprite.s} alt={f.label} className="h-8 w-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                    {f.label}
                    {f.itemId && <span className="text-[9px] text-white/60">{furnOwned(f.itemId) - state.housing.placed.filter((p) => p.defId === f.id).length}개 남음</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.housing.editMode && (
            <div className="pointer-events-auto absolute inset-x-0 bottom-[172px] z-20 flex justify-center">
              <div className="panel-gilded flex items-center gap-2 px-3 py-1.5 text-[11px] text-gold-soft">
                {state.housing.selectedId ? (
                  <>
                    <span className="text-muted-foreground">바닥을 누르면 그 자리로 옮겨집니다</span>
                    <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'HOUSING_FLIP' })}>
                      좌우 반전
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => dispatch({ type: 'HOUSING_REMOVE', id: state.housing.selectedId! })}>
                      <X className="size-3" /> 치우기
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">가구를 누르면 옮기기 · 뒤집기 · 치우기 — 새 가구는 마도구 작업대(장인 핀)에서 제작</span>
                )}
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
                const lock = mapLockReason(state, p.to)
                return (
                  <Button
                    key={p.id}
                    variant={under || lock ? 'outline' : 'default'}
                    title={lock ?? undefined}
                    className="flex-col gap-0.5 py-3"
                    onClick={() => dispatch({ type: 'USE_PORTAL', portalId: p.id })}
                  >
                    <span>{p.label}</span>
                    {lock ? (
                      <span className="text-[10px] text-red-300">메인 스토리 진행 후 개방</span>
                    ) : p.requiredLevel ? (
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

      {/* 생활 상호작용 안내 — 채집 지점/물가 근처에서만. 터치 기기는 눌러서 실행 */}
      {lifePrompt && state.screen === 'world' && !state.fishing && (
        <button
          type="button"
          onClick={tryInteract}
          className="pointer-events-auto absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-gold/60 bg-black/65 px-4 py-1.5 font-display text-xs text-gold-soft shadow-lg"
        >
          <span className="mr-1.5 rounded bg-gold/25 px-1.5 text-[10px] text-white">E</span>
          {lifePrompt}
        </button>
      )}

      {/* 터치 기기용 D-Pad — 폰·태블릿(가로) 모두 노출, 키보드+마우스 환경에선 숨김 */}
      <div className="dpad touch-only absolute z-20 grid-cols-3 grid-rows-3 gap-1" onContextMenu={(e) => e.preventDefault()}>
        <div />
        <DpadBtn icon={<ArrowUp className="size-4" />} onDown={() => dpadPress(0, -1)} onUp={() => dpadRelease(0, -1)} />
        <div />
        <DpadBtn icon={<ArrowLeft className="size-4" />} onDown={() => dpadPress(-1, 0)} onUp={() => dpadRelease(-1, 0)} />
        <button
          className="panel-gilded flex size-10 items-center justify-center text-[11px] text-gold-soft active:brightness-125"
          onClick={tryInteract}
        >
          대화
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
      onPointerDown={(e) => {
        e.preventDefault()
        onDown()
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {icon}
    </button>
  )
}
