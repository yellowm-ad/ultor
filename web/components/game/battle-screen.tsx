'use client'

import Image from 'next/image'
import { useEffect, useState, type ReactNode } from 'react'
import { useGame } from '@/lib/game-state'
import { Button } from '@/components/ui/button'
import { awaitsPlayerInput, currentActor } from '@/lib/battle-engine'
import { SKILLS, itemById, monsterById } from '@/lib/mock-data'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import { CreatureSprite, spriteIdFromRefId } from '@/components/game/creature-sprite'
import { SkillFxLayer, fxTier, type FxPos } from '@/components/game/skill-fx'
import { DiamondMark } from '@/components/game/ui-motifs'
import { MAPS } from '@/lib/maps'
import type { BattleAction, Combatant, Element, Position, Skill, SpriteSheet } from '@/lib/types'
import { POSITION_META } from '@/lib/constants'
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
  defUp: '/images/icons/status/defense.png',
  mdefUp: '/images/icons/status/defense.png',
  atkUp: '/images/icons/status/battle.png',
  matkUp: '/images/icons/status/battle.png',
  haste: '/images/icons/status/move.png',
  stealth: '/images/icons/status/detect.png',
  rally: '/images/icons/status/battle.png',
  lastStand: '/images/icons/status/battle.png',
  defendGuard: '/images/icons/status/defense.png',
}

/** 스킬 젬 버튼 배경색 — skill-fx.tsx 의 FX_COLORS 와 별개로, HUD 버튼 전용으로 가볍게 유지 */
const GEM_ELEMENT_BG: Record<Element | 'none', string> = {
  fire: 'linear-gradient(160deg, #6b2b18, #3a140a)',
  ice: 'linear-gradient(160deg, #1c4f66, #0e2a38)',
  earth: 'linear-gradient(160deg, #5a4423, #2f2312)',
  dark: 'linear-gradient(160deg, #3b2160, #1a0d2e)',
  light: 'linear-gradient(160deg, #6b5a1c, #3a300c)',
  wind: 'linear-gradient(160deg, #1f5a48, #0d2e24)',
  none: 'linear-gradient(160deg, #3a3560, #201c3c)',
}

/**
 * 4 대 4 진형 슬롯 — 값은 전투원의 **발밑** 좌표(무대 %).
 * 적: 0·1 = 전열(가운데 쪽), 2·3 = 후열. 아군은 포지션별 줄(PLAYER_LANES)에 서고, 펫은 주인 앞에 붙는다.
 * top 은 숲 배경 판석 바닥(무대 ≈45% 아래) 안에 들어오게 잡았다.
 */
const FORMATION: Record<'player' | 'enemy', FxPos[]> = {
  player: [
    { left: 36, top: 58 },
    { left: 31, top: 82 },
    { left: 22, top: 52 },
    { left: 16, top: 76 },
  ],
  enemy: [
    { left: 64, top: 58 },
    { left: 69, top: 82 },
    { left: 78, top: 52 },
    { left: 84, top: 75 },
  ],
}

/** 아군 포지션 줄 — 전위는 적 쪽(가운데), 후위는 뒤, 보조는 그 사이. 같은 줄 인원 수에 따라 위아래로 벌린다 */
const PLAYER_LANES: Record<Position, number> = { front: 36, support: 27, rear: 18 }
const LANE_TOPS: Record<number, number[]> = { 1: [70], 2: [57, 82] }

function playerFormation(players: Combatant[]): Record<string, FxPos> {
  const out: Record<string, FxPos> = {}
  const core = players.filter((c) => c.kind !== 'pet')
  ;(['front', 'support', 'rear'] as Position[]).forEach((p) => {
    const lane = core.filter((c) => (c.position ?? 'rear') === p)
    const tops = LANE_TOPS[lane.length] ?? lane.map((_, i) => 52 + i * 14)
    // 같은 줄에서 아래쪽(앞)일수록 살짝 가운데로 — 원근감
    lane.forEach((c, i) => (out[c.uid] = { left: PLAYER_LANES[p] - (tops[i] > 70 ? 4 : 0), top: tops[i] }))
  })
  // 펫 = 주인공 전용 고정 칸 — 주인공 포지션과 무관하게 항상 전위 앞에 선다
  for (const pet of players.filter((c) => c.kind === 'pet')) out[pet.uid] = { left: 44, top: 70 }
  return out
}

/** 발밑 좌표(%) — CombatantSprite 렌더용. 5명 이상이면 후열 뒤로 조금씩 밀어 넣는다. */
function combatantPos(side: 'player' | 'enemy', index: number): FxPos {
  const slots = FORMATION[side]
  if (index < slots.length) return slots[index]
  const extra = index - slots.length + 1
  const base = slots[slots.length - 1]
  return { left: base.left + (side === 'enemy' ? 4 : -4) * extra, top: base.top - 8 * extra }
}

/** 스킬 연출은 몸 중심을 기준으로 — 발밑에서 위로 올린 좌표 */
const FX_BODY_LIFT = 11

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
  const [animUid, setAnimUid] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const actor = battle ? currentActor(battle) : null
  const auto = !!battle?.auto
  const companionAuto = !!state.settings.companionAuto
  // 주인공·파티 동료 턴 = 직접 조작(자동 전투 / 동료 자동이면 AI)
  const isHeroTurn = !!battle && !!actor && !battle.isOver && awaitsPlayerInput(battle, actor, companionAuto)
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

  // 자동 전투는 리듀서(BATTLE_TICK)가 AI 로 처리한다 — battle.auto

  // 폭주 보스(보랏빛 오라) — 전장이 계속 낮게 울리고, 첫 등장 때 이름 카드 + 큰 흔들림
  const rageBoss = battle?.combatants.find((c) => c.side === 'enemy' && c.aura === 'rage-violet' && c.alive) ?? null
  const rageName = battle?.combatants.find((c) => c.side === 'enemy' && c.aura === 'rage-violet')?.name ?? null
  const [rageIntro, setRageIntro] = useState(false)
  useEffect(() => {
    if (!rageName) return
    setRageIntro(true)
    setShake(true)
    const t1 = setTimeout(() => setShake(false), 900)
    const t2 = setTimeout(() => setRageIntro(false), 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // 전투가 새로 열릴 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rageName, battle?.originCell.x, battle?.originCell.y])

  function triggerLunge(uid: string) {
    setAnimUid(uid)
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
  enemies.forEach((c, i) => { posMap[c.uid] = combatantPos('enemy', i) })
  Object.assign(posMap, playerFormation(players))
  const fxPosOf = (uid: string) => {
    const p = posMap[uid]
    return p && { left: p.left, top: p.top - FX_BODY_LIFT }
  }

  function submit(action: BattleAction) {
    if (!actor) return
    if (action.type === 'attack' || action.type === 'skill') triggerLunge(actor.uid)
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

  /** 지금 명령을 고를 수 있는가(내 차례이고 대상 고르는 중이 아님) */
  const canAct = isHeroTurn && !pending
  const availableSkills = actor ? SKILLS.filter((s) => actor.skills.includes(s.id)) : []
  const availableItems = state.inventory
    .map((slot) => ({ slot, item: itemById(slot.itemId) }))
    .filter((x) => x.item && (x.item.type === 'potion' || x.item.type === 'tool') && !x.item.useEffect?.grantExp && !!x.item.useEffect)

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

  // 부활 스킬·부활 깃털은 쓰러진 아군만 고를 수 있다
  const reviveTargeting =
    (pending?.kind === 'skill' && pending.skill.kind === 'revive') || (pending?.kind === 'item' && !!itemById(pending.itemId)?.useEffect?.reviveOnly)

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
          <div className={`boss-banner ${primaryEnemy.aura === 'rage-violet' ? 'boss-banner-rage' : ''} ${!primaryEnemy.alive ? 'opacity-40 grayscale' : ''}`}>
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
            onClick={() => dispatch({ type: 'BATTLE_SET_AUTO', auto: !auto })}
            className={`rounded-full border px-3 py-1 text-xs font-display ${auto ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/30 bg-black/40 text-white/80'}`}
          >
            자동 {auto ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { companionAuto: !companionAuto } })}
            title="동료 턴을 직접 조작할지, AI 에게 맡길지"
            className={`rounded-full border px-3 py-1 text-xs font-display ${companionAuto ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/30 bg-black/40 text-white/80'}`}
          >
            동료 {companionAuto ? '자동' : '수동'}
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
      <div className={`battle-stage relative z-10 flex-1 overflow-hidden ${isForestBattle ? 'battle-field-forest-bg' : ''} ${shake ? 'battle-shake' : rageBoss ? 'battle-rumble' : ''}`}>
        {/* 폭주 보스 — 보랏빛 그늘 + 떠오르는 불티(전장 전체) */}
        {rageBoss && (
          <div className="rage-stage" aria-hidden>
            {RAGE_EMBERS.map((e, i) => (
              <span key={i} className="rage-stage-ember" style={{ left: e.left, animationDelay: e.delay, animationDuration: e.dur }} />
            ))}
          </div>
        )}
        {rageIntro && rageName && (
          <div className="rage-title" aria-hidden>
            <span className="rage-title-sub">폭주</span>
            <span className="rage-title-name">{rageName}</span>
          </div>
        )}
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
            targetable={targetableSide === 'player' && c.kind !== 'pet' && (reviveTargeting ? !c.alive : c.alive)}
            onClick={() => handleTargetClick(c)}
            heroSheet={c.kind === 'hero' ? playerSheet(state.player.appearance.gender) : undefined}
            heroAnim={c.uid === animUid ? heroAnim : undefined}
          />
        ))}
        <SkillFxLayer fx={battle.lastFx} posOf={fxPosOf} />
      </div>

      {/* ── 로그 스트립 — 상단 가운데(하늘 쪽). 바닥에 두면 앞줄 전투원 발밑을 가려서 위로 올림 ── */}
      <div className="battle-log absolute left-1/2 top-11 z-20 w-[min(34rem,56%)] -translate-x-1/2 max-h-12 overflow-y-auto rounded-lg border border-gold/30 bg-black/50 px-2.5 py-1.5 text-[11px] leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] scrollbar-thin">
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
      <div className="relative z-20 mt-auto flex flex-col gap-1.5 px-3 pb-3">
        {/* 타임라인 */}
        <div className="battle-timeline flex min-w-0 items-center gap-2">
          <span className="battle-timeline-label shrink-0 flex items-center gap-1 text-xs font-display text-white/60">
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
                    <HeroSprite sheet={playerSheet(state.player.appearance.gender)} dir="down" px={34} />
                  ) : c.appearance?.kind === 'hero' ? (
                    <HeroSprite sheet={c.appearance.sheet} dir="down" px={34} />
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

        {/* 명령창 — 한 줄에 네 칸(공격·스킬·물약·방어). 스킬·물약 칸을 누르면 그 위로 아이콘이 차례로 펼쳐진다 */}
        <div className="battle-cmd panel-royal">
          {battle.isOver ? (
            <BattleResult />
          ) : (
            <>
              <div className="battle-cmd-line">
                <DiamondMark size={8} />
                {!isHeroTurn ? (
                  <span className="text-white/60">{actor ? `${actor.name}의 턴...` : '행동 순서 대기 중...'}</span>
                ) : pending ? (
                  <>
                    <span>{actor?.name} — 대상을 선택하세요</span>
                    <button type="button" className="battle-cmd-cancel" onClick={() => setPending(null)}>
                      취소
                    </button>
                  </>
                ) : (
                  <span>
                    {actor?.name}의 차례 · Lv.{actor?.level} · MP {actor?.mp}/{actor?.stats.maxMp}
                  </span>
                )}
              </div>
              <div className="battle-cmd-row">
                <CmdBtn icon={<Swords className="size-5" />} label="공격" hint="기본 공격" disabled={!canAct} onClick={() => { setMenu('root'); setPending({ kind: 'attack' }) }} />
                <div className="battle-cmd-slot">
                  {canAct && menu === 'skill' && (
                    <div className="battle-fan">
                      {availableSkills.length === 0 && <span className="battle-fan-empty">사용 가능한 스킬이 없습니다.</span>}
                      {availableSkills.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!actor || actor.mp < s.mpCost}
                          onClick={() => {
                            setMenu('root')
                            if (s.targeting === 'allEnemies' || s.targeting === 'allAllies' || s.targeting === 'self') {
                              submit({ type: 'skill', skillId: s.id, targetUid: actor!.uid })
                            } else {
                              setPending({ kind: 'skill', skill: s })
                            }
                          }}
                          style={{ ['--gem-bg' as string]: GEM_ELEMENT_BG[s.element ?? 'none'], animationDelay: `${i * 45}ms` }}
                          className="battle-fan-item gem-btn"
                        >
                          <Image src={s.icon} alt={s.name} width={26} height={26} />
                          <span className="battle-fan-mp">{s.mpCost}</span>
                          <span className="battle-tip">
                            <b>{s.name}</b>
                            <i>MP {s.mpCost}{actor && actor.mp < s.mpCost ? ' · MP 부족' : ''}</i>
                            {s.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <CmdBtn icon={<Sparkles className="size-5" />} label="스킬" hint={`${availableSkills.length}개`} active={menu === 'skill'} disabled={!canAct} onClick={() => setMenu(menu === 'skill' ? 'root' : 'skill')} />
                </div>
                <div className="battle-cmd-slot">
                  {canAct && menu === 'item' && (
                    <div className="battle-fan">
                      {availableItems.length === 0 && <span className="battle-fan-empty">보유한 물약/도구가 없습니다.</span>}
                      {availableItems.map(({ slot, item }, i) => (
                        <button
                          key={slot.itemId}
                          type="button"
                          onClick={() => {
                            setMenu('root')
                            if (item!.useEffect?.reviveOnly) setPending({ kind: 'item', itemId: slot.itemId, needsTarget: true })
                            else submit({ type: 'item', itemId: slot.itemId, targetUid: actor!.uid })
                          }}
                          style={{ ['--gem-bg' as string]: 'linear-gradient(160deg, #4a3a2a, #241a12)', animationDelay: `${i * 45}ms` }}
                          className="battle-fan-item gem-btn"
                        >
                          <Image src={item!.icon} alt={item!.name} width={26} height={26} />
                          <span className="battle-fan-mp is-qty">×{slot.qty}</span>
                          <span className="battle-tip">
                            <b>{item!.name}</b>
                            <i>{slot.qty}개 보유</i>
                            {item!.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <CmdBtn icon={<FlaskConical className="size-5" />} label="물약·도구" hint={`${availableItems.length}개`} active={menu === 'item'} disabled={!canAct} onClick={() => setMenu(menu === 'item' ? 'root' : 'item')} />
                </div>
                <CmdBtn icon={<Shield className="size-5" />} label="방어" hint="피해 감소" disabled={!canAct} onClick={() => { setMenu('root'); submit({ type: 'defend' }) }} />
              </div>
            </>
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
  if (rank === 'fieldBoss' || rank === 'storyBoss') return 182 // 260 × 0.7
  if (rank === 'miniBoss') return 133 // 190 × 0.7
  return 116
}

function CombatantSprite({
  c,
  side,
  pos,
  active,
  targetable,
  onClick,
  heroSheet,
  heroAnim,
}: {
  c: Combatant
  side: 'player' | 'enemy'
  pos: FxPos
  active: boolean
  targetable: boolean
  onClick: () => void
  heroSheet?: SpriteSheet
  heroAnim?: 'idle' | 'lunge' | 'hit'
}) {
  // pos = 발밑 좌표. 래퍼 하단 중앙을 그 점에 맞추고, 축소도 발밑 기준으로 해서 바닥에 붙어 있게 한다.
  const { left, top } = pos
  const scale = side === 'enemy' ? 1 : 1.08
  // 4등신 히어로 시트로 그리는 전투원 — 주인공 + 학생 동료(appearance.kind 'hero')
  const heroLook =
    c.kind === 'hero' && heroSheet
      ? heroSheet
      : c.appearance?.kind === 'hero'
        ? c.appearance.sheet
        : null
  const isHero = !!heroLook
  // 사람 보스(히어로 시트를 쓰는 적)는 아군보다 크게 — 위압감
  const spritePx = isHero ? (c.kind === 'hero' ? 150 : side === 'enemy' ? 250 : 138) : c.kind === 'pet' ? 84 : enemyMonsterPx(side, c.refId)
  const rage = c.aura === 'rage-violet' && c.alive
  // 히어로 시트 프레임 아래쪽 투명 여백(≈14%)만큼 끌어내려 발이 실제 좌표에 닿게 (크리처는 CreatureSprite groundPad)
  const footPad = isHero ? Math.round(spritePx * 0.14) : 0

  const statuses = c.effects.filter((e) => e.kind === 'status')
  const buffs = c.effects.filter((e) => e.kind === 'buff')
  const debuffs = c.effects.filter((e) => e.kind === 'debuff')
  const stealthed = buffs.some((e) => e.id === 'stealth')
  const hpPct = (c.hp / Math.max(1, c.stats.maxHp)) * 100
  const statusIcon = (id: string) => STATUS_ICON[id]
  const buffIcon = (id: string) => BUFF_ICON[id]

  return (
    <div
      className="battle-combatant absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%,-100%) scale(calc(var(--battle-sprite-k, 1) * ${scale}))`,
        transformOrigin: '50% 100%',
        zIndex: Math.round(top),
      }}
    >
      <button
        onClick={targetable ? onClick : undefined}
        className={`relative flex flex-col items-center ${targetable ? 'cursor-pointer' : 'cursor-default'} ${!c.alive ? 'opacity-25 grayscale' : stealthed ? 'opacity-50' : ''}`}
      >
        {/* 상태 아이콘 + HP */}
        <div className="mb-0.5 flex flex-col items-center gap-0.5">
          {(statuses.length > 0 || buffs.length > 0 || debuffs.length > 0) && (
            <div className="flex flex-wrap justify-center gap-0.5">
              {statuses.map((e) => (
                <span key={e.key} className="flex items-center gap-0.5 rounded-full bg-violet-950/85 py-0.5 pl-0.5 pr-1.5 text-[7px] text-violet-100 ring-1 ring-violet-400/50">
                  {statusIcon(e.id) && <Image src={statusIcon(e.id)!} alt="" width={11} height={11} className="rounded-full" />}
                  {e.name}
                </span>
              ))}
              {debuffs.map((e) => (
                <span key={e.key} className="flex items-center gap-0.5 rounded-full bg-fuchsia-950/85 py-0.5 px-1.5 text-[7px] text-fuchsia-100 ring-1 ring-fuchsia-400/50">
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
            {c.position && (
              <span className="rounded bg-black/55 px-1 text-[8px] font-bold text-gold-soft" title={POSITION_META[c.position].bonus}>
                {POSITION_META[c.position].label}
              </span>
            )}
            {c.guest && (
              <span className="rounded bg-violet-900/70 px-1 text-[8px] font-bold text-violet-100" title="임시 합류 NPC — 자동 행동 · 경험치 분배 제외">
                {c.guest === 'escort' ? '호위' : '동행'}
              </span>
            )}
            <span className={`text-[9px] font-bold ${side === 'player' ? 'text-sky-200' : 'text-red-200'} text-shadow-ink`}>
              {c.name}
            </span>
          </div>
          <div className="h-2 w-16 overflow-hidden rounded-full border border-gold/40 bg-black/55">
            <div className="bar-hp-fill h-full transition-all duration-300" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* 발밑 그림자 — 바닥에 서 있는 느낌 */}
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-black/40 blur-[2px]"
          style={{ bottom: -5, width: spritePx * 0.5, height: 12 }}
          aria-hidden
        />
        {/* 스프라이트 */}
        {rage && <RageAura px={spritePx} layer="back" />}
        <div
          style={{ marginBottom: -footPad }}
          className={`relative ${rage ? 'rage-body' : ''} ${active ? 'battle-active' : ''} ${
            heroAnim === 'lunge' ? (side === 'player' ? 'hero-lunge-right' : 'hero-lunge-left') : ''
          }`}
        >
          {heroLook ? (
            <HeroSprite
              sheet={heroLook}
              dir={side === 'enemy' ? 'down' : 'right'}
              walking={heroAnim === 'lunge' || (c.kind === 'ally' && active && c.alive)}
              px={spritePx}
              className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <CreatureSprite
              spriteId={spriteIdFromRefId(c.refId)}
              fallbackSrc={c.icon}
              dir="right"
              flip={side === 'enemy'}
              walking={active && c.alive}
              px={spritePx}
              groundPad={0.24}
              className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
            />
          )}
        </div>

        {rage && <RageAura px={spritePx} layer="front" />}
        {/* TU 뱃지 */}
        {c.alive && (
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-1.5 text-[8px] font-bold text-white/80">
            {active ? 'NOW' : `TU ${tuUntil(c)}`}
          </span>
        )}
        {targetable && <span className="absolute -top-2 text-xs text-red-400">▼</span>}
      </button>
    </div>
  )
}

/** 폭주 보스 전장 불티 위치(결정론) */
const RAGE_EMBERS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 0.53) % 3.2).toFixed(2)}s`,
  dur: `${(2.4 + ((i * 0.71) % 1.8)).toFixed(2)}s`,
}))

/**
 * 폭주 오라(보랏빛 불꽃) — back: 발밑 마법진 + 몸 뒤 거대한 불꽃 실루엣 / front: 몸을 감싸는 불꽃 혀 + 튀는 불티.
 * 순수 CSS(globals.css .rage-*) — 크기는 스프라이트 px 에 맞춘다.
 */
function RageAura({ px, layer }: { px: number; layer: 'back' | 'front' }) {
  if (layer === 'back') {
    return (
      <div className="rage-aura-back pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: -10, width: px * 1.15, height: px * 1.05 }} aria-hidden>
        <span className="rage-ring" />
        <span className="rage-glow" />
        <span className="rage-flame rage-flame-l" />
        <span className="rage-flame rage-flame-c" />
        <span className="rage-flame rage-flame-r" />
      </div>
    )
  }
  return (
    <div className="rage-aura-front pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: -6, width: px * 0.9, height: px * 0.95 }} aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className="rage-tongue" style={{ left: `${8 + i * 13}%`, animationDelay: `${(i * 0.17).toFixed(2)}s`, height: `${28 + ((i * 23) % 30)}%` }} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={`s${i}`} className="rage-spark" style={{ left: `${(i * 29) % 100}%`, animationDelay: `${((i * 0.31) % 1.6).toFixed(2)}s` }} />
      ))}
    </div>
  )
}

/** 명령창의 한 칸 — 아이콘 + 이름(+ 보조 문구) */
function CmdBtn({
  icon,
  label,
  hint,
  onClick,
  disabled,
  active,
}: {
  icon?: ReactNode
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`battle-cmd-btn ${active ? 'is-active' : ''}`}>
      {icon}
      <span className="font-display text-sm leading-none">{label}</span>
      {hint && <span className="battle-cmd-hint">{hint}</span>}
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
        {battle.victory
          ? (battle.rewardExpShare ?? 0) < (battle.rewardExp ?? 0)
            ? `승리! EXP +${battle.rewardExpShare}/인 (총 ${battle.rewardExp}) · Gold +${battle.rewardGold}`
            : `승리! EXP +${battle.rewardExp} (단독) · Gold +${battle.rewardGold}`
          : '전투 패배...'}
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
