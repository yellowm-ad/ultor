'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/lib/game-state'
import { Button } from '@/components/ui/button'
import { currentActor } from '@/lib/battle-engine'
import { SKILLS, itemById, monsterById } from '@/lib/mock-data'
import { HeroSprite } from '@/components/game/pixel-hero'
import { CreatureSprite, spriteIdFromRefId } from '@/components/game/creature-sprite'
import { SkillFxLayer, fxTier, type FxPos } from '@/components/game/skill-fx'
import { DiamondMark } from '@/components/game/ui-motifs'
import { MAPS } from '@/lib/maps'
import type { BattleAction, Combatant, ElementOrNeutral, Skill } from '@/lib/types'
import { FlaskConical, Shield, Sparkles, Swords } from 'lucide-react'

/** 상태이상/버프 뱃지 아이콘 — 데스크톱 "속성, 아이템 각종 아이콘.png" 시트에서 크롭 */
const STATUS_ICON: Record<string, string> = {
  burn: '/images/icons/status/burn.png',
  bleed: '/images/icons/status/bleed.png',
  slow: '/images/icons/status/freeze.png',
  paralysis: '/images/icons/status/stun.png',
  weaken: '/images/icons/status/poison.png',
  sleep: '/images/icons/status/sleep.png',
  silence: '/images/icons/status/antimagic.png',
  blind: '/images/icons/status/detect.png',
}
const BUFF_ICON: Record<string, string> = {
  ironWall: '/images/icons/status/defense.png',
  rally: '/images/icons/status/battle.png',
  lastStand: '/images/icons/status/battle.png',
  defendGuard: '/images/icons/status/defense.png',
}

/** 스킬 젬 버튼 배경색 — skill-fx.tsx 의 FX_COLORS 와 별개로, HUD 버튼 전용으로 가볍게 유지 */
const GEM_ELEMENT_BG: Record<ElementOrNeutral, string> = {
  fire: 'linear-gradient(160deg, #6b2b18, #3a140a)',
  ice: 'linear-gradient(160deg, #1c4f66, #0e2a38)',
  earth: 'linear-gradient(160deg, #5a4423, #2f2312)',
  neutral: 'linear-gradient(160deg, #3a3560, #201c3c)',
}

/** 전장 배치 좌표(%) — CombatantSprite 렌더와 SkillFxLayer 위치 계산이 같은 값을 쓰도록 공유 */
function combatantPos(side: 'player' | 'enemy', index: number, count: number): FxPos {
  const spread = count > 1 ? index / (count - 1) - 0.5 : 0
  const left = side === 'enemy' ? 68 + spread * 22 : 32 + spread * 24
  const top =
    side === 'enemy'
      ? 42 + Math.abs(spread) * 12 + (index % 2) * 7
      : 58 + Math.abs(spread) * 8 + (index % 2) * 8
  return { left, top }
}

// 지역별 전투 배경 삽화 — 구도는 숲(forest_bg.png)과 동일한 PixelLab Pro 생성물,
// 기후/부산물/원경만 지역에 맞게 다름. 아직 그리지 않은 bg 키(cave/mine/swamp/deepsea/demon 등)는
// undefined로 남아 기존 CSS 그라디언트 전장으로 자연스럽게 폴백된다.
const CUSTOM_BATTLE_BG: Partial<Record<string, string>> = {
  sky: '/images/battle/sky_bg.png',
  sea: '/images/battle/sea_bg.png',
  snow: '/images/battle/snow_bg.png',
  ruins: '/images/battle/ruins_bg.png',
  volcano: '/images/battle/volcano_bg.png',
}

// 숲 전투 배경 위에 뿌릴 반딧불 — variant(방황 경로)·위치·속도를 미리 고정해 자연스럽게 흩뿌린다
const FOREST_FIREFLIES: { variant: 'a' | 'b' | 'c'; left: string; top: string; delay: string }[] = [
  { variant: 'a', left: '18%', top: '58%', delay: '0s' },
  { variant: 'b', left: '32%', top: '42%', delay: '1.4s' },
  { variant: 'c', left: '48%', top: '66%', delay: '0.6s' },
  { variant: 'a', left: '63%', top: '48%', delay: '2.2s' },
  { variant: 'b', left: '76%', top: '62%', delay: '0.9s' },
  { variant: 'c', left: '55%', top: '30%', delay: '1.8s' },
]

// 나머지 지역 전투 배경 위에 뿌릴 파티클 — 반딧불과 동일한 6개 스팟을 재사용하고
// zoneBg별로 종류(물방울/빛/영혼/눈/불씨)와 궤적(상승/낙하)만 갈아끼운다
const ZONE_PARTICLE_KIND: Partial<Record<string, 'droplet' | 'light' | 'spirit' | 'snow' | 'ember'>> = {
  sea: 'droplet',
  sky: 'light',
  ruins: 'spirit',
  snow: 'snow',
  volcano: 'ember',
}

// ============================================================================
// 전투 화면 — 저장된 예시(클래식 JRPG 배틀 구도) 참고:
//  · 초원 필드 + 원경 산맥
//  · 아군은 앞(좌하), 적은 뒤(우상)에 배치, 4등신 스프라이트로 대치
//  · 하단: 행동 순서 타임라인(TU 숫자) + 우측 액션 링
//  · 상단: 자동 / x2 / 도망
//  · 움직임은 주인공 캐릭터만 (공격 시 앞으로 돌진 후 복귀)
// ============================================================================

type Pending =
  | { kind: 'attack' }
  | { kind: 'skill'; skill: Skill }
  | { kind: 'item'; itemId: string; needsTarget: boolean }
  | null

// 대략적인 TU(다음 행동까지 남은 시간 단위) 추정 — 표시용
function tuUntil(c: Combatant): number {
  const gain = Math.max(0.5, (c.stats.spd / 20) * 8)
  return Math.max(0, Math.round((100 - Math.min(100, c.atb)) / gain))
}

export function BattleScreen() {
  const { state, dispatch } = useGame()
  const battle = state.battle
  const [menu, setMenu] = useState<'root' | 'skill' | 'item'>('root')
  const [pending, setPending] = useState<Pending>(null)
  const [heroAnim, setHeroAnim] = useState<'idle' | 'lunge' | 'hit'>('idle')
  const [auto, setAuto] = useState(false)
  const [shake, setShake] = useState(false)
  const autoRef = useRef(false)

  const actor = battle ? currentActor(battle) : null
  const isHeroTurn = actor?.kind === 'hero'
  const speed = state.settings.battleAnimSpeed

  // 행동 순서(TU) 자동 진행
  useEffect(() => {
    if (!battle || battle.isOver) return
    const delay = speed === 2 ? 200 : 430
    const timer = setInterval(() => dispatch({ type: 'BATTLE_TICK' }), delay)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.isOver, speed])

  useEffect(() => {
    setMenu('root')
    setPending(null)
  }, [battle?.activeUid])

  // 궁극기(tier4) 연출 발동 시 전장을 짧게 흔든다
  useEffect(() => {
    const fx = battle?.lastFx
    if (!fx || fxTier(fx) < 4) return
    setShake(true)
    const t = setTimeout(() => setShake(false), 520)
    return () => clearTimeout(t)
  }, [battle?.lastFx])

  // 자동 전투: 히어로 턴이면 기본 공격 자동 실행
  useEffect(() => {
    autoRef.current = auto
    if (!auto || !battle || battle.isOver || !isHeroTurn || !actor) return
    const enemies = battle.combatants.filter((c) => c.side === 'enemy' && c.alive)
    if (enemies.length === 0) return
    const t = setTimeout(() => {
      dispatch({ type: 'BATTLE_ACTOR_ACTION', actorUid: actor.uid, action: { type: 'attack', targetUid: enemies[0].uid } })
      triggerLunge()
    }, speed === 2 ? 260 : 520)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, battle?.activeUid, isHeroTurn])

  function triggerLunge() {
    setHeroAnim('lunge')
    setTimeout(() => setHeroAnim('idle'), speed === 2 ? 260 : 460)
  }

  if (!battle) return null

  const zoneBg = MAPS[state.currentMapId]?.bg
  const isForestBattle = zoneBg === 'forest'
  const customBattleBg = zoneBg ? CUSTOM_BATTLE_BG[zoneBg] : undefined
  const particleKind = zoneBg ? ZONE_PARTICLE_KIND[zoneBg] : undefined
  const enemies = battle.combatants.filter((c) => c.side === 'enemy')
  const players = battle.combatants.filter((c) => c.side === 'player')
  const hero = players.find((c) => c.kind === 'hero')

  const posMap: Record<string, FxPos> = {}
  enemies.forEach((c, i) => { posMap[c.uid] = combatantPos('enemy', i, enemies.length) })
  players.forEach((c, i) => { posMap[c.uid] = combatantPos('player', i, players.length) })

  function submit(action: BattleAction) {
    if (!actor) return
    if (action.type === 'attack' || action.type === 'skill') triggerLunge()
    dispatch({ type: 'BATTLE_ACTOR_ACTION', actorUid: actor.uid, action })
    setPending(null)
    setMenu('root')
  }

  function handleTargetClick(target: Combatant) {
    if (!pending) return
    if (pending.kind === 'attack') {
      if (target.side !== 'enemy' || !target.alive) return
      submit({ type: 'attack', targetUid: target.uid })
    } else if (pending.kind === 'skill') {
      const t = pending.skill.targeting
      if (t === 'singleEnemy' && (target.side !== 'enemy' || !target.alive)) return
      if (t === 'singleAlly' && target.side !== 'player') return
      submit({ type: 'skill', skillId: pending.skill.id, targetUid: target.uid })
    } else if (pending.kind === 'item') {
      submit({ type: 'item', itemId: pending.itemId, targetUid: target.uid })
    }
  }

  const availableSkills = actor ? SKILLS.filter((s) => actor.skills.includes(s.id)) : []
  const availableItems = state.inventory
    .map((slot) => ({ slot, item: itemById(slot.itemId) }))
    .filter((x) => x.item && (x.item.type === 'potion' || x.item.type === 'tool'))

  const targetableSide =
    pending?.kind === 'attack'
      ? 'enemy'
      : pending?.kind === 'skill'
        ? pending.skill.targeting === 'singleEnemy'
          ? 'enemy'
          : pending.skill.targeting === 'singleAlly'
            ? 'player'
            : null
        : pending?.kind === 'item' && pending.needsTarget
          ? 'player'
          : null

  const primaryEnemy = enemies.find((c) => c.alive) ?? enemies[0]

  // 타임라인: 살아있는 전투원을 TU 오름차순으로
  const order = battle.combatants
    .filter((c) => c.alive)
    .map((c) => ({ c, tu: c.uid === battle.activeUid ? -1 : tuUntil(c) }))
    .sort((a, b) => a.tu - b.tu)
    .slice(0, 8)

  return (
    <div
      className={`battle-field relative flex h-full w-full flex-col overflow-hidden ${isForestBattle ? 'battle-field-forest-edge' : customBattleBg ? 'battle-field-custom-bg' : ''}`}
      style={customBattleBg ? { backgroundImage: `url(${customBattleBg})` } : undefined}
    >
      {/* ── 상단 바: 좌측 보스 배너 + 가운데 컨트롤(자동/속도/도망) ── */}
      <div className="relative z-20 flex items-start px-3 pt-2">
        {primaryEnemy && (
          <div className={`boss-banner ${!primaryEnemy.alive ? 'opacity-40 grayscale' : ''}`}>
            <div className="portrait-ring portrait-ring-enemy flex size-9 shrink-0 items-center justify-center">
              <Image src={primaryEnemy.icon} alt={primaryEnemy.name} width={20} height={20} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-display text-white/90 text-shadow-ink">
                <DiamondMark size={9} />
                Lv.{primaryEnemy.level} {primaryEnemy.name}
              </span>
              <div className="boss-banner-hp">
                <div
                  className="bar-hp-fill h-full transition-all duration-300"
                  style={{ width: `${(primaryEnemy.hp / Math.max(1, primaryEnemy.stats.maxHp)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2">
          <button
            onClick={() => setAuto((a) => !a)}
            className={`rounded-full border px-3 py-1 text-xs font-display ${auto ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/30 bg-black/40 text-white/80'}`}
          >
            자동 {auto ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { battleAnimSpeed: speed === 2 ? 1 : 2 } })}
            className={`rounded-full border px-3 py-1 text-xs font-display ${speed === 2 ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/30 bg-black/40 text-white/80'}`}
          >
            x{speed}
          </button>
          <button
            onClick={() => actor && isHeroTurn && submit({ type: 'flee' })}
            disabled={!isHeroTurn}
            className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-display text-white/80 disabled:opacity-40"
          >
            도망
          </button>
        </div>
      </div>

      {/* ── 전장 ── */}
      <div className={`battle-stage relative z-10 flex-1 overflow-hidden ${isForestBattle ? 'battle-field-forest-bg' : ''} ${shake ? 'battle-shake' : ''}`}>
        {isForestBattle && (
          <>
            {/* 살랑이는 나무 그림자 */}
            <div className="battle-forest-shadow" aria-hidden />
            {/* 은은하게 돌아다니는 반짝임 */}
            <div className="battle-fireflies" aria-hidden>
              {FOREST_FIREFLIES.map((f, i) => (
                <span
                  key={i}
                  className={`battle-firefly battle-firefly-${f.variant}`}
                  style={{ left: f.left, top: f.top, animationDelay: `${f.delay}, ${f.delay}` }}
                />
              ))}
            </div>
          </>
        )}
        {particleKind && (
          <div className="battle-particles" aria-hidden>
            {FOREST_FIREFLIES.map((f, i) => (
              <span
                key={i}
                className={`battle-particle battle-particle-${particleKind} battle-particle-motion-${particleKind === 'snow' ? 'fall' : 'rise'}-${f.variant}`}
                style={{ left: f.left, top: f.top, animationDelay: `${f.delay}, ${f.delay}` }}
              />
            ))}
          </div>
        )}
        {/* 적: 뒤(우상) */}
        {enemies.map((c) => (
          <CombatantSprite
            key={c.uid}
            c={c}
            side="enemy"
            pos={posMap[c.uid]}
            active={actor?.uid === c.uid}
            targetable={targetableSide === 'enemy' && c.alive}
            onClick={() => handleTargetClick(c)}
          />
        ))}
        {/* 아군: 앞(좌하) */}
        {players.map((c) => (
          <CombatantSprite
            key={c.uid}
            c={c}
            side="player"
            pos={posMap[c.uid]}
            active={actor?.uid === c.uid}
            targetable={targetableSide === 'player' && c.alive}
            onClick={() => handleTargetClick(c)}
            heroGender={c.kind === 'hero' ? state.player.gender : undefined}
            heroElement={c.kind === 'hero' ? state.player.element : undefined}
            heroAnim={c.kind === 'hero' ? heroAnim : undefined}
          />
        ))}
        <SkillFxLayer fx={battle.lastFx} posOf={(uid) => posMap[uid]} />
      </div>

      {/* ── 로그 스트립 ── */}
      <div className="battle-log relative z-20 mx-3 mb-1 max-h-12 overflow-y-auto rounded-lg border border-gold/30 bg-black/50 px-2.5 py-1.5 text-[11px] leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] scrollbar-thin">
        {battle.log.slice(-3).map((l) => (
          <div
            key={l.id}
            className={
              l.kind === 'damage' ? 'text-red-300'
              : l.kind === 'heal' ? 'text-emerald-300'
              : l.kind === 'status' ? 'text-violet-300'
              : l.kind === 'system' ? 'text-gold-soft'
              : 'text-white/80'
            }
          >
            {l.text}
          </div>
        ))}
      </div>

      {/* ── 하단: 타임라인 + 액션 ── */}
      <div className="relative z-20 flex items-end gap-2 px-3 pb-3">
        {/* 타임라인 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="battle-timeline-label flex items-center gap-1 text-xs font-display text-white/60">
            <DiamondMark size={9} />
            행동 순서
          </span>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {order.map(({ c, tu }, i) => (
              <div key={c.uid} className="flex shrink-0 flex-col items-center gap-0.5">
                <div
                  className={`portrait-ring ${c.side === 'player' ? 'portrait-ring-player' : 'portrait-ring-enemy'} ${
                    i === 0 ? 'portrait-ring-active' : ''
                  } flex size-11 items-center justify-center`}
                >
                  {c.kind === 'hero' ? (
                    <HeroSprite element={state.player.element} gender={state.player.gender} dir="down" px={34} />
                  ) : (
                    <Image src={c.icon} alt={c.name} width={22} height={22} />
                  )}
                </div>
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${i === 0 ? 'bg-gold/25 text-gold-soft' : 'bg-black/40 text-white/70'}`}>
                  {tu < 0 ? 'NOW' : `TU ${tu}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 액션 패널 */}
        <div className="battle-action-panel panel-royal w-[48%] max-w-[360px] shrink-0 p-2.5">
          {battle.isOver ? (
            <BattleResult />
          ) : !isHeroTurn ? (
            <div className="flex h-16 items-center justify-center text-xs text-white/60">
              {actor ? `${actor.name}의 턴...` : '행동 순서 대기 중...'}
            </div>
          ) : pending ? (
            <div className="flex h-16 flex-col items-center justify-center gap-1 text-center text-xs">
              <span className="text-gold-soft">대상을 선택하세요</span>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>취소</Button>
            </div>
          ) : menu === 'root' ? (
            <div className="battle-root-menu grid grid-cols-2 gap-2">
              <RingBtn icon={<Swords className="size-5" />} label="공격" hint="기본 공격" onClick={() => setPending({ kind: 'attack' })} />
              <RingBtn icon={<Sparkles className="size-5" />} label="스킬" hint={`${availableSkills.length}개`} onClick={() => setMenu('skill')} />
              <RingBtn icon={<FlaskConical className="size-5" />} label="물약·도구" hint={`${availableItems.length}개`} onClick={() => setMenu('item')} />
              <RingBtn icon={<Shield className="size-5" />} label="방어" hint="피해 감소" onClick={() => submit({ type: 'defend' })} />
            </div>
          ) : menu === 'skill' ? (
            <div className="flex max-h-28 flex-wrap content-start gap-1.5 overflow-y-auto scrollbar-thin">
              {availableSkills.length === 0 && <span className="text-xs opacity-60">사용 가능한 스킬이 없습니다.</span>}
              {availableSkills.map((s) => (
                <button
                  key={s.id}
                  disabled={!actor || actor.mp < s.mpCost}
                  title={s.description}
                  onClick={() => {
                    if (s.targeting === 'allEnemies' || s.targeting === 'allAllies' || s.targeting === 'self') {
                      submit({ type: 'skill', skillId: s.id, targetUid: actor!.uid })
                    } else {
                      setPending({ kind: 'skill', skill: s })
                    }
                  }}
                  style={{ ['--gem-bg' as string]: GEM_ELEMENT_BG[s.element] }}
                  className="gem-btn flex w-[30%] min-w-16 flex-col items-center gap-0.5 px-1.5 py-1.5 text-white/90"
                >
                  <Image src={s.icon} alt={s.name} width={22} height={22} />
                  <span className="text-center text-[10px] leading-tight">{s.name}</span>
                  <span className="rounded-full bg-black/40 px-1.5 text-[9px] font-bold text-mp">{s.mpCost}MP</span>
                </button>
              ))}
              <button onClick={() => setMenu('root')} className="self-center rounded-md px-2 py-1 text-[11px] text-white/60">뒤로</button>
            </div>
          ) : (
            <div className="flex max-h-28 flex-wrap content-start gap-1.5 overflow-y-auto scrollbar-thin">
              {availableItems.length === 0 && <span className="text-xs opacity-60">보유한 물약/도구가 없습니다.</span>}
              {availableItems.map(({ slot, item }) => (
                <button
                  key={slot.itemId}
                  title={item!.description}
                  onClick={() => {
                    if (item!.useEffect?.reviveOnly) setPending({ kind: 'item', itemId: slot.itemId, needsTarget: true })
                    else submit({ type: 'item', itemId: slot.itemId, targetUid: actor!.uid })
                  }}
                  style={{ ['--gem-bg' as string]: 'linear-gradient(160deg, #3a3560, #201c3c)' }}
                  className="gem-btn flex w-[30%] min-w-16 flex-col items-center gap-0.5 px-1.5 py-1.5 text-white/90"
                >
                  <Image src={item!.icon} alt={item!.name} width={22} height={22} />
                  <span className="text-center text-[10px] leading-tight">{item!.name}</span>
                  <span className="rounded-full bg-black/40 px-1.5 text-[9px] font-bold text-gold-soft">×{slot.qty}</span>
                </button>
              ))}
              <button onClick={() => setMenu('root')} className="self-center rounded-md px-2 py-1 text-[11px] text-white/60">뒤로</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 전투 화면 몬스터 크기 — 필드에서는 일반몹 1배 기준 중간보스 3배/필드보스 6배를 그대로 쓰지만,
 * 전투 화면은 고정 높이(overflow-hidden) 무대라 그 비율을 그대로 적용하면 화면 밖으로 잘린다.
 * 그래서 여기서는 "확실히 커 보이되 잘리지 않는" 선에서 완화한 배율(약 1.6배/2.2배)을 쓴다.
 */
function enemyMonsterPx(side: 'player' | 'enemy', refId: string): number {
  if (side !== 'enemy') return 116
  const rank = monsterById(refId)?.rank
  if (rank === 'fieldBoss') return 182 // 260 × 0.7
  if (rank === 'midBoss') return 133 // 190 × 0.7
  return 116
}

function CombatantSprite({
  c,
  side,
  pos,
  active,
  targetable,
  onClick,
  heroGender,
  heroElement,
  heroAnim,
}: {
  c: Combatant
  side: 'player' | 'enemy'
  pos: FxPos
  active: boolean
  targetable: boolean
  onClick: () => void
  heroGender?: 'male' | 'female'
  heroElement?: 'fire' | 'ice' | 'earth'
  heroAnim?: 'idle' | 'lunge' | 'hit'
}) {
  // 필드 배치: 중앙에서 대치 — 아군은 좌중앙(근경, 크게), 적은 우중앙(원경, 약간 작게)
  const { left, top } = pos
  const scale = side === 'enemy' ? 0.95 : 1.12

  const statuses = c.effects.filter((e) => e.kind === 'status')
  const buffs = c.effects.filter((e) => e.kind === 'buff')
  const hpPct = (c.hp / Math.max(1, c.stats.maxHp)) * 100
  const statusIcon = (id: string) => STATUS_ICON[id]
  const buffIcon = (id: string) => BUFF_ICON[id]

  return (
    <div
      className="battle-combatant absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%,-50%) scale(calc(var(--battle-sprite-k, 1) * ${scale}))`, zIndex: Math.round(top) }}
    >
      <button
        onClick={targetable ? onClick : undefined}
        className={`relative flex flex-col items-center ${targetable ? 'cursor-pointer' : 'cursor-default'} ${!c.alive ? 'opacity-25 grayscale' : ''}`}
      >
        {/* 상태 아이콘 + HP */}
        <div className="mb-0.5 flex flex-col items-center gap-0.5">
          {(statuses.length > 0 || buffs.length > 0) && (
            <div className="flex flex-wrap justify-center gap-0.5">
              {statuses.map((e) => (
                <span key={e.key} className="flex items-center gap-0.5 rounded-full bg-violet-950/85 py-0.5 pl-0.5 pr-1.5 text-[7px] text-violet-100 ring-1 ring-violet-400/50">
                  {statusIcon(e.id) && <Image src={statusIcon(e.id)!} alt="" width={11} height={11} className="rounded-full" />}
                  {e.name}
                </span>
              ))}
              {buffs.map((e) => (
                <span key={e.key} className="flex items-center gap-0.5 rounded-full bg-emerald-950/85 py-0.5 pl-0.5 pr-1.5 text-[7px] text-emerald-100 ring-1 ring-emerald-400/50">
                  {buffIcon(e.id) && <Image src={buffIcon(e.id)!} alt="" width={11} height={11} className="rounded-full" />}
                  {e.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className={`text-[9px] font-bold ${side === 'player' ? 'text-sky-200' : 'text-red-200'} text-shadow-ink`}>
              {c.name}
            </span>
          </div>
          <div className="h-2 w-16 overflow-hidden rounded-full border border-gold/40 bg-black/55">
            <div className="bar-hp-fill h-full transition-all duration-300" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* 스프라이트 */}
        <div
          className={`${active ? 'battle-active' : ''} ${
            heroAnim === 'lunge' ? (side === 'player' ? 'hero-lunge-right' : 'hero-lunge-left') : ''
          }`}
        >
          {c.kind === 'hero' && heroElement && heroGender ? (
            <HeroSprite
              element={heroElement}
              gender={heroGender}
              dir="right"
              walking={heroAnim === 'lunge'}
              px={150}
              className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <CreatureSprite
              spriteId={spriteIdFromRefId(c.refId)}
              fallbackSrc={c.icon}
              dir="right"
              flip={side === 'enemy'}
              walking={active && c.alive}
              px={enemyMonsterPx(side, c.refId)}
              className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
            />
          )}
        </div>

        {/* TU 뱃지 */}
        {c.alive && (
          <span className="mt-0.5 rounded-full bg-black/55 px-1.5 text-[8px] font-bold text-white/80">
            {active ? 'NOW' : `TU ${tuUntil(c)}`}
          </span>
        )}
        {targetable && <span className="absolute -top-2 text-xs text-red-400">▼</span>}
      </button>
    </div>
  )
}

function RingBtn({
  icon,
  label,
  hint,
  onClick,
}: {
  icon?: ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="battle-ring-btn gem-btn flex h-16 flex-col items-center justify-center gap-0.5 text-gold-soft">
      {icon}
      <span className="font-display text-sm leading-none">{label}</span>
      {hint && <span className="battle-ring-hint mt-0.5 text-[10px] text-white/60">{hint}</span>}
    </button>
  )
}

function BattleResult() {
  const { state, dispatch } = useGame()
  const battle = state.battle
  if (!battle) return null

  const dropCounts = new Map<string, number>()
  for (const id of battle.rewardDrops ?? []) dropCounts.set(id, (dropCounts.get(id) ?? 0) + 1)
  const drops = [...dropCounts.entries()].map(([id, qty]) => ({ item: itemById(id), qty })).filter((d) => d.item)

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
      <span className={`font-display text-sm ${battle.victory ? 'text-gold-soft' : 'text-red-300'}`}>
        {battle.victory ? `승리! EXP +${battle.rewardExp} · Gold +${battle.rewardGold}` : '전투 패배...'}
      </span>
      {battle.victory && drops.length > 0 && (
        <div className="flex max-w-xs flex-wrap items-center justify-center gap-1.5">
          {drops.map(({ item, qty }) => (
            <span key={item!.id} className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white/85">
              <Image src={item!.icon} alt="" width={14} height={14} />
              {item!.name} {qty > 1 ? `x${qty}` : ''}
            </span>
          ))}
        </div>
      )}
      <Button size="sm" onClick={() => dispatch({ type: 'BATTLE_END_CONTINUE' })}>계속하기</Button>
    </div>
  )
}
