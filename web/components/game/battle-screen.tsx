'use client'

import Image from 'next/image'
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/lib/game-state'
import { DamagePopLayer } from '@/components/game/damage-pops'
import { skillHitCount } from '@/lib/skill-hits'
import { Button } from '@/components/ui/button'
import { awaitsPlayerInput, currentActor } from '@/lib/battle-engine'
import { SKILLS, itemById, monsterById, skillById } from '@/lib/mock-data'
import { HeroSprite } from '@/components/game/pixel-hero'
import { CreatureSprite, spriteIdFromRefId } from '@/components/game/creature-sprite'
import { masteredMpCost } from '@/lib/skill-mastery'
import { SkillFxLayer, type FxPos } from '@/components/game/skill-fx'
import { previewFx } from '@/components/game/magic-screen'
import { skillMotion } from '@/lib/skill-motion'
import { DiamondMark } from '@/components/game/ui-motifs'
import { MAPS } from '@/lib/maps'
import type { BattleAction, BattleFx, BattleLogEntry, Combatant, Element, Position, Skill, SpriteSheet } from '@/lib/types'
import { POSITION_META } from '@/lib/constants'
import { FlaskConical, Shield, Sparkles, Swords } from 'lucide-react'
import { heroSheet, npcSheet } from '@/lib/costumes'

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

/** 다른 플레이어 팀 — playerFormation 을 좌우로 뒤집는다(펫은 몬스터로 싸우지만 자리는 펫 칸) */
function rivalFormation(enemies: Combatant[]): Record<string, FxPos> {
  const asPlayers = enemies.map((c) => (c.kind === 'monster' ? { ...c, kind: 'pet' as const } : c))
  return Object.fromEntries(Object.entries(playerFormation(asPlayers)).map(([uid, p]) => [uid, { left: 100 - p.left, top: p.top }]))
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

// 지역별 전투 배경 — 맵 bg 키 → 전투 삽화(PixelLab Pro, 숲과 같은 구도) + 분위기 덧칠 + 파티클.
// 전용 삽화가 없는 지역(동굴·늪·심해·묘지·폐광·마물령·신전·오로라·학교 등)도 가장 가까운 삽화에
// 색 덧칠을 얹어 테마를 맞춘다 — 예전처럼 CSS 초원 그라디언트(테스트 화면)로 떨어지는 맵이 없게.
type ParticleKind = 'droplet' | 'light' | 'spirit' | 'snow' | 'ember'
type BattleBackdrop = { img: string; tint?: string; particle?: ParticleKind; forest?: boolean; pixel?: boolean; /** background-position — 전투원 발밑이 바닥(러그)에 오게 */ pos?: string }
const FOREST_IMG = '/images/battle/forest_bg.png?v=2'
const BATTLE_BACKDROPS: Record<string, BattleBackdrop> = {
  forest: { img: FOREST_IMG, forest: true, pixel: true },
  sky: { img: '/images/battle/sky_bg.png', particle: 'light' },
  sea: { img: '/images/battle/sea_bg.png', particle: 'droplet' },
  snow: { img: '/images/battle/snow_bg.png', particle: 'snow' },
  ruins: { img: '/images/battle/ruins_bg.png', particle: 'spirit' },
  volcano: { img: '/images/battle/volcano_bg.png', particle: 'ember' },
  // ── 전용 삽화 없는 지역: 가까운 삽화 + 덧칠 ──
  cave: { img: FOREST_IMG, pixel: true, particle: 'light', tint: 'radial-gradient(120% 90% at 50% 70%, rgba(20,48,36,0.35), rgba(4,12,10,0.82) 75%), linear-gradient(180deg, rgba(4,10,8,0.85) 0%, rgba(6,18,14,0.5) 45%, rgba(8,20,14,0.4) 100%)' },
  swamp: { img: FOREST_IMG, pixel: true, particle: 'spirit', tint: 'linear-gradient(180deg, rgba(150,168,150,0.5) 0%, rgba(96,118,92,0.38) 45%, rgba(34,52,30,0.45) 100%)' },
  deepsea: { img: '/images/battle/sea_bg.png', particle: 'droplet', tint: 'linear-gradient(180deg, rgba(2,10,34,0.82) 0%, rgba(6,26,60,0.6) 50%, rgba(2,14,36,0.7) 100%)' },
  atlantis: { img: '/images/battle/sea_bg.png', particle: 'droplet', tint: 'linear-gradient(180deg, rgba(20,70,110,0.35) 0%, rgba(40,110,140,0.2) 60%, rgba(10,40,70,0.3) 100%)' },
  graveyard: { img: '/images/battle/ruins_bg.png', particle: 'spirit', tint: 'linear-gradient(180deg, rgba(18,10,34,0.72) 0%, rgba(30,20,48,0.45) 50%, rgba(12,8,20,0.55) 100%)' },
  mine: { img: '/images/battle/ruins_bg.png', particle: 'ember', tint: 'radial-gradient(90% 70% at 50% 75%, rgba(120,70,20,0.2), rgba(14,8,4,0.8) 80%), linear-gradient(180deg, rgba(10,6,2,0.8) 0%, rgba(30,18,8,0.45) 100%)' },
  demon: { img: '/images/battle/volcano_bg.png', particle: 'ember', tint: 'linear-gradient(180deg, rgba(30,0,24,0.6) 0%, rgba(60,8,30,0.35) 55%, rgba(16,0,10,0.55) 100%)' },
  temple: { img: '/images/battle/sky_bg.png', particle: 'light', tint: 'linear-gradient(180deg, rgba(255,236,190,0.18) 0%, rgba(255,250,230,0.08) 60%, rgba(60,50,30,0.2) 100%)' },
  aurora: { img: '/images/battle/snow_bg.png', particle: 'snow', tint: 'linear-gradient(180deg, rgba(40,160,140,0.35) 0%, rgba(110,80,180,0.22) 25%, rgba(10,20,50,0.25) 55%, transparent 100%)' },
  // 개인 공간 샌드백(무기 거치대) — 방 안 연습장(PixelLab, 개인 공간 그림 참고)
  personal: { img: '/images/battle/personal_bg.png?v=1', pixel: true, pos: 'center 74%' },
  // 학교·광장·마을 등 — 학교 앞 숲길 훈련장
  school: { img: FOREST_IMG, forest: true, pixel: true },
}
/** 맵 id 로 고르는 예외 — 같은 bg 키라도 성격이 다른 곳(버려진 신전 = 폐허) */
const BATTLE_BACKDROP_BY_MAP: Record<string, string> = {
  'temple-ruin': 'ruins',
  'ruin-sanctum': 'ruins',
  'ruin-guild': 'ruins',
  'demon-temple': 'demon',
  'personal-space': 'personal',
}
function battleBackdropFor(mapId: string, bg: string | undefined): BattleBackdrop {
  const key = BATTLE_BACKDROP_BY_MAP[mapId] ?? bg ?? 'school'
  return BATTLE_BACKDROPS[key] ?? BATTLE_BACKDROPS.school
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
  const heroTurnRaw = !!battle && !!actor && !battle.isOver && awaitsPlayerInput(battle, actor, companionAuto)
  const speed = state.settings.battleAnimSpeed

  // 행동 순서(TU) 자동 진행
  useEffect(() => {
    if (!battle || battle.isOver) return
    const delay = speed === 2 ? 200 : 430
    // 스킬 연출이 도는 동안에는 다음 행동으로 넘어가지 않는다
    const timer = setInterval(() => {
      if (performance.now() < busyUntilRef.current) return
      dispatch({ type: 'BATTLE_TICK' })
    }, delay)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.isOver, speed])

  useEffect(() => {
    setMenu('root')
    setPending(null)
  }, [battle?.activeUid])

  // ── 스킬 연출 시계 ──
  // 행동은 리듀서에서 즉시 계산되지만, 화면은 연출에 맞춰 따라간다:
  //  · 첫 타격(impactMs) 전까지는 직전 HP·로그를 그대로 보여 주고(hold)
  //  · 연출이 끝날 때(totalMs)까지 다음 행동·입력을 멈춘다(busy)
  // 개발 빌드 전용 — 크롬 자동 점검에서 스킬 연출만 따로 재생한다: window.__fxTest('fire-master-1')
  const [testFx, setTestFx] = useState<BattleFx | undefined>()
  useEffect(() => {
    if (!(process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_HOOKS === '1') || !battle) return
    const w = window as unknown as { __fxTest?: (id: string) => string }
    w.__fxTest = (id: string) => {
      const s = skillById(id)
      if (!s) return 'no-skill'
      const base = previewFx(s, Date.now())
      const hero = battle.combatants.find((c) => c.kind === 'hero')
      if (!hero) return 'no-hero'
      const foes = battle.combatants.filter((c) => c.side !== hero.side && c.alive).map((c) => c.uid)
      const friends = battle.combatants.filter((c) => c.side === hero.side && c.alive).map((c) => c.uid)
      const toSelf = base.targetUids[0] === 'hero'
      setTestFx({ ...base, sourceUid: hero.uid, targetUids: toSelf ? (base.aoe ? friends : [hero.uid]) : base.aoe ? foes : foes.slice(0, 1) })
      return 'ok'
    }
    return () => {
      delete w.__fxTest
    }
  }, [battle])
  const fx = battle?.lastFx
  const motion = fx ? skillMotion(fx, speed) : null
  const [, bumpFx] = useReducer((n: number) => n + 1, 0)
  const committedRef = useRef<{ combatants: Combatant[]; log: BattleLogEntry[] } | null>(null)
  const fxClockRef = useRef<{ fxId: string; start: number; prev: { combatants: Combatant[]; log: BattleLogEntry[] } | null } | null>(null)
  const busyUntilRef = useRef(0)
  if (fx && motion && fxClockRef.current?.fxId !== fx.fxId) {
    const now = performance.now()
    fxClockRef.current = { fxId: fx.fxId, start: now, prev: committedRef.current }
    busyUntilRef.current = now + motion.totalMs
  }
  useEffect(() => {
    if (battle) committedRef.current = { combatants: battle.combatants, log: battle.log }
  })
  const fxElapsed = fx && fxClockRef.current ? performance.now() - fxClockRef.current.start : Infinity
  const fxHolding = !!motion && fxElapsed < motion.impactMs
  const fxBusy = !!motion && fxElapsed < motion.totalMs
  const fxCasting = !!motion && motion.castMs > 0 && fxElapsed < motion.castMs
  /** 맞는 순간 — 대상이 번쩍이며 밀린다 */
  const fxHitting = !!motion && !fxHolding && fxElapsed < motion.impactMs + 450
  // 다단 히트(lib/skill-hits) — 총 피해를 타수로 나눠 impactMs 부터 hitSpan 동안 한 대씩 보여 준다
  const hits = fx ? skillHitCount(fx.skillId) : 1
  const hitSpan = motion && hits > 1 ? Math.max(0, Math.min(((hits - 1) * 170) / speed, motion.totalMs - motion.impactMs - 250)) : 0
  const hitGap = hits > 1 && hitSpan > 0 ? hitSpan / (hits - 1) : 0
  const hitsShown = !motion || fxHolding ? 0 : hitGap > 0 ? Math.min(hits, 1 + Math.floor((fxElapsed - motion.impactMs) / hitGap)) : hits
  useEffect(() => {
    if (!fx || !motion) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)))
    for (const ms of [motion.castMs, motion.impactMs, motion.impactMs + 450, motion.totalMs]) at(ms + 15, bumpFx)
    for (let k = 1; k < hits; k++) at(motion.impactMs + hitGap * k + 15, bumpFx)
    // 강한 기술은 맞는 순간, 궁극기는 마무리 폭발에서 전장을 흔든다
    const shakeAt = motion.ultimate ? motion.finaleMs : motion.tier >= 3 ? motion.impactMs : -1
    if (shakeAt >= 0) {
      at(shakeAt, () => setShake(true))
      at(shakeAt + 520, () => setShake(false))
    }
    return () => {
      timers.forEach(clearTimeout)
      setShake(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx?.fxId])

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

  // 연출이 도는 동안에는 명령을 받지 않는다
  const isHeroTurn = heroTurnRaw && !fxBusy

  if (!battle) return null
  // 화면에 보이는 전투원·로그 — 타격 전까지는 직전 상태
  const prevView = fxClockRef.current?.prev
  const view =
    fxHolding && prevView
      ? prevView
      : hitsShown < hits && prevView
        ? {
            // 다단 히트 도중 — HP 를 타수 비율만큼만 깎아 보여 주고, 쓰러지는 건 마지막 타에서
            combatants: battle.combatants.map((c) => {
              const p = prevView.combatants.find((x) => x.uid === c.uid)
              if (!p || p.hp === c.hp) return c
              return { ...c, hp: p.hp + Math.round(((c.hp - p.hp) * hitsShown) / hits), alive: p.alive || c.alive }
            }),
            log: battle.log,
          }
        : { combatants: battle.combatants, log: battle.log }
  const showResult = battle.isOver && !fxBusy

  const backdrop = battleBackdropFor(state.currentMapId, MAPS[state.currentMapId]?.bg)
  const isForestBattle = !!backdrop.forest
  const particleKind = backdrop.particle
  const enemies = view.combatants.filter((c) => c.side === 'enemy')
  const players = view.combatants.filter((c) => c.side === 'player')
  const hero = players.find((c) => c.kind === 'hero')

  const posMap: Record<string, FxPos> = {}
  enemies.forEach((c, i) => { posMap[c.uid] = combatantPos('enemy', i) })
  // 천공 콜로세움 — 상대 팀은 아군 진형을 거울처럼(전위·보조·후위 줄, 펫은 주인공 앞)
  if (battle.pvp) Object.assign(posMap, rivalFormation(enemies))
  Object.assign(posMap, playerFormation(players))
  // 거대 보스(흑룡) — 세븐나이츠식 구도: 보스가 오른쪽에서 무대를 덮고, 일행은 왼쪽 아래에 작게 모인다
  const colossus = enemies.find((c) => monsterById(c.refId)?.colossal)
  if (colossus) {
    posMap[colossus.uid] = { left: 70, top: 70 }
    for (const c of players) {
      const p = posMap[c.uid]
      if (p) posMap[c.uid] = { left: 8 + p.left * 0.72, top: 66 + (p.top - 50) * 0.55 }
    }
  }
  const fxPosOf = (uid: string) => {
    const p = posMap[uid]
    return p && { left: p.left, top: p.top - FX_BODY_LIFT }
  }
  const fxGroundOf = (uid: string) => posMap[uid]
  /** 연출 속 역할 — 기를 모으는 시전자 / 지금 맞는 대상 */
  const fxRoleOf = (uid: string): 'cast' | 'hit' | undefined => {
    if (!fx) return undefined
    if (fxCasting && uid === fx.sourceUid) return 'cast'
    if (fxHitting && (fx.archetype === 'attack' || fx.archetype === 'magicAttack') && fx.targetUids.includes(uid)) return 'hit'
    return undefined
  }

  function submit(action: BattleAction) {
    if (!actor) return
    // 몸으로 치는 행동만 돌진한다 — 마법은 제자리에서 기를 모은다(fxRoleOf 'cast')
    if (action.type === 'attack' || (action.type === 'skill' && skillById(action.skillId)?.physical)) triggerLunge(actor.uid)
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
  /** 숙련도가 반영된 MP 소모 */
  const mpOf = (s: { id: string; mpCost: number }) => masteredMpCost(s, actor?.mastery?.[s.id])
  const availableItems = state.inventory
    .map((slot) => ({ slot, item: itemById(slot.itemId) }))
    .filter((x) => x.item && (x.item.type === 'potion' || x.item.type === 'tool') && !x.item.useEffect?.grantExp && !x.item.useEffect?.invisibleSec && !!x.item.useEffect)

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

  // 키보드 — 1~4 = 공격·스킬·물약·방어, 펼친 상태에선 1~9 = 그 순서의 스킬/물약, Space·Enter = 첫 대상 고르기, Esc = 취소
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    if (e.repeat) return
    // 결과 화면 — Space·Enter = 계속하기
    if (battle.isOver) {
      if (fxBusy || (e.code !== 'Space' && e.code !== 'Enter')) return
      e.preventDefault()
      dispatch({ type: 'BATTLE_END_CONTINUE' })
      return
    }
    if (!isHeroTurn) return
    const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : NaN
    if (e.key === 'Escape') {
      if (pending) setPending(null)
      else setMenu('root')
      return
    }
    if (pending) {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      const pool = targetableSide === 'enemy' ? enemies.filter((c) => c.alive) : targetableSide === 'player' ? players.filter((c) => c.kind !== 'pet' && (reviveTargeting ? !c.alive : c.alive)) : []
      if (pool[0]) handleTargetClick(pool[0])
      return
    }
    if (!(n >= 1 && n <= 9)) return
    if (menu === 'skill') {
      const s = availableSkills[n - 1]
      if (!s || !actor || actor.mp < mpOf(s)) return
      setMenu('root')
      if (s.targeting === 'allEnemies' || s.targeting === 'allAllies' || s.targeting === 'self') submit({ type: 'skill', skillId: s.id, targetUid: actor.uid })
      else setPending({ kind: 'skill', skill: s })
    } else if (menu === 'item') {
      const it = availableItems[n - 1]
      if (!it || !actor) return
      setMenu('root')
      if (it.item!.useEffect?.reviveOnly) setPending({ kind: 'item', itemId: it.slot.itemId, needsTarget: true })
      else submit({ type: 'item', itemId: it.slot.itemId, targetUid: actor.uid })
    } else if (n === 1) setPending({ kind: 'attack' })
    else if (n === 2) setMenu('skill')
    else if (n === 3) setMenu('item')
    else if (n === 4) submit({ type: 'defend' })
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // 타임라인: 살아있는 전투원을 TU 오름차순으로
  const order = view.combatants
    .filter((c) => c.alive)
    .map((c) => ({ c, tu: c.uid === battle.activeUid ? -1 : tuUntil(c) }))
    .sort((a, b) => a.tu - b.tu)
    .slice(0, 8)

  return (
    <div
      className={`battle-field relative flex h-full w-full flex-col overflow-hidden battle-field-custom-bg ${backdrop.pixel ? 'is-pixel' : ''}`}
      style={{ backgroundImage: backdrop.tint ? `${backdrop.tint}, url(${backdrop.img})` : `url(${backdrop.img})`, ...(backdrop.pos ? { backgroundPosition: backdrop.pos } : {}) }}
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
            className={`rounded-full border px-3 py-1 text-xs font-display ${auto ? 'border-gold bg-gold/25 text-gold-soft' : 'border-[#c79a3e]/55 bg-[#14100c]/85 text-[#f3e6c4]'}`}
          >
            자동 {auto ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { companionAuto: !companionAuto } })}
            title="동료 턴을 직접 조작할지, AI 에게 맡길지"
            className={`rounded-full border px-3 py-1 text-xs font-display ${companionAuto ? 'border-gold bg-gold/25 text-gold-soft' : 'border-[#c79a3e]/55 bg-[#14100c]/85 text-[#f3e6c4]'}`}
          >
            동료 {companionAuto ? '자동' : '수동'}
          </button>
          <button
            onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { battleAnimSpeed: speed === 2 ? 1 : 2 } })}
            className={`rounded-full border px-3 py-1 text-xs font-display ${speed === 2 ? 'border-gold bg-gold/25 text-gold-soft' : 'border-[#c79a3e]/55 bg-[#14100c]/85 text-[#f3e6c4]'}`}
          >
            x{speed}
          </button>
          <button
            onClick={() => actor && isHeroTurn && submit({ type: 'flee' })}
            disabled={!isHeroTurn}
            className="rounded-full border border-[#c79a3e]/55 bg-[#14100c]/85 px-3 py-1 text-xs font-display text-[#f3e6c4] disabled:opacity-40"
          >
            {battle.sandbag ? "그만두기" : "도망"}
          </button>
        </div>
      </div>

      {/* ── 전장 ── */}
      <div className={`battle-stage relative z-10 flex-1 overflow-hidden ${isForestBattle ? 'battle-field-forest-bg' : ''} ${shake ? 'battle-shake' : rageBoss ? 'battle-rumble' : ''} ${colossus ? 'is-colossus' : ''}`}>
        {/* 거대 보스 — 무대를 덮는 흑룡(일반 CombatantSprite 대신) */}
        {colossus && (
          <ColossusBattle
            c={colossus}
            active={actor?.uid === colossus.uid || fxRoleOf(colossus.uid) === 'cast'}
            hit={fxRoleOf(colossus.uid) === 'hit'}
            targetable={targetableSide === 'enemy' && colossus.alive}
            onClick={() => handleTargetClick(colossus)}
          />
        )}
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
        {enemies.filter((c) => c !== colossus).map((c) => (
          <CombatantSprite
            key={c.uid}
            c={c}
            side="enemy"
            pos={posMap[c.uid]}
            active={actor?.uid === c.uid}
            targetable={targetableSide === 'enemy' && c.alive}
            onClick={() => handleTargetClick(c)}
            fxRole={fxRoleOf(c.uid)}
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
            heroSheet={c.kind === 'hero' ? heroSheet(state) : undefined}
            heroAnim={c.uid === animUid ? heroAnim : undefined}
            fxRole={fxRoleOf(c.uid)}
          />
        ))}
        <SkillFxLayer fx={testFx ?? battle.lastFx} posOf={fxPosOf} groundOf={fxGroundOf} speed={speed} />
        {/* 데미지 숫자 — 보이는 HP 변화(타격 시점)에 맞춰 머리 위로 */}
        <DamagePopLayer
          combatants={view.combatants}
          log={view.log}
          posOf={(uid) => posMap[uid]}
          missTargets={battle.lastFx?.targetUids ?? []}
          liftOf={(uid) => (uid === colossus?.uid ? 34 : players.some((c) => c.uid === uid) ? (colossus ? 17 : 24) : 26)}
        />
      </div>

      {/* ── 로그 스트립 — 상단 가운데(하늘 쪽). 바닥에 두면 앞줄 전투원 발밑을 가려서 위로 올림 ── */}
      <div className="battle-log absolute left-1/2 top-11 z-20 w-[min(34rem,56%)] -translate-x-1/2 max-h-12 overflow-y-auto rounded-lg border border-gold/30 bg-black/50 px-2.5 py-1.5 text-[11px] leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] scrollbar-thin">
        {view.log.slice(-3).map((l) => (
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
                    <HeroSprite sheet={heroSheet(state)} dir="down" px={34} />
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
          {showResult ? (
            <BattleResult />
          ) : (
            <>
              <div className="battle-cmd-line">
                <DiamondMark size={8} />
                {!isHeroTurn ? (
                  <span className="text-white/60">{actor ? `${actor.name}의 턴...` : '행동 순서 대기 중...'}</span>
                ) : pending ? (
                  <>
                    <span>{actor?.name} — 대상을 선택하세요 <span className="opacity-60">(눌러서 고르기 · Space = 첫 대상 · Esc = 취소)</span></span>
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
                <CmdBtn icon={<Swords className="size-5" />} label="공격" hint="1 · 기본 공격" disabled={!canAct} onClick={() => { setMenu('root'); setPending({ kind: 'attack' }) }} />
                <div className="battle-cmd-slot">
                  {canAct && menu === 'skill' && (
                    <div className="battle-fan">
                      {availableSkills.length === 0 && <span className="battle-fan-empty">사용 가능한 스킬이 없습니다.</span>}
                      {availableSkills.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!actor || actor.mp < mpOf(s)}
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
                          <span className="battle-fan-mp">{mpOf(s)}</span>
                          {i < 9 && <span className="battle-fan-key">{i + 1}</span>}
                          <span className="battle-tip">
                            <b>{s.name}</b>
                            <i>MP {mpOf(s)}{actor?.mastery?.[s.id] ? ` · 숙련 Lv.${actor.mastery[s.id]}` : ''}{actor && actor.mp < mpOf(s) ? ' · MP 부족' : ''}</i>
                            {s.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <CmdBtn icon={<Sparkles className="size-5" />} label="스킬" hint={`2 · ${availableSkills.length}개`} active={menu === 'skill'} disabled={!canAct} onClick={() => setMenu(menu === 'skill' ? 'root' : 'skill')} />
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
                          {i < 9 && <span className="battle-fan-key">{i + 1}</span>}
                          <span className="battle-tip">
                            <b>{item!.name}</b>
                            <i>{slot.qty}개 보유</i>
                            {item!.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <CmdBtn icon={<FlaskConical className="size-5" />} label="물약·도구" hint={`3 · ${availableItems.length}개`} active={menu === 'item'} disabled={!canAct} onClick={() => setMenu(menu === 'item' ? 'root' : 'item')} />
                </div>
                <CmdBtn icon={<Shield className="size-5" />} label="방어" hint="4 · 피해 감소" disabled={!canAct} onClick={() => { setMenu('root'); submit({ type: 'defend' }) }} />
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

/** 거대 보스(MonsterDef.colossal) — 전투용 그림을 무대 높이보다 크게, 오른쪽에서 일행 쪽으로 몸을 들이민 구도.
 *  코드 연출: 숨쉬기(아래 기준 들썩임) · 행동할 때 앞으로 덮쳐 오기 · 맞을 때 번쩍 · 눈빛 · 바람 기류 */
function ColossusBattle({ c, active, hit, targetable, onClick }: { c: Combatant; active: boolean; hit: boolean; targetable: boolean; onClick: () => void }) {
  const col = monsterById(c.refId)?.colossal
  if (!col) return null
  const hpPct = (c.hp / Math.max(1, c.stats.maxHp)) * 100
  return (
    <>
      <div className="colossus-bossbar" aria-label={`${c.name} 체력`}>
        <span className="colossus-bossbar-name">{c.name}</span>
        <div className="colossus-bossbar-track">
          <div className="colossus-bossbar-fill" style={{ width: `${hpPct}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={targetable ? onClick : undefined}
        className={`colossus-battle ${active ? 'is-active' : ''} ${hit ? 'is-hit' : ''} ${targetable ? 'is-targetable' : ''}`}
        aria-label={c.name}
      >
        <span className="colossus-battle-body">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={col.battle} alt="" draggable={false} />
          <span className="colossus-battle-eyes" />
        </span>
        <span className="colossus-battle-wind" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ top: `${18 + i * 14}%`, animationDelay: `${i * 0.55}s` }} />
          ))}
        </span>
      </button>
    </>
  )
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
  fxRole,
}: {
  c: Combatant
  side: 'player' | 'enemy'
  pos: FxPos
  active: boolean
  targetable: boolean
  onClick: () => void
  heroSheet?: SpriteSheet
  heroAnim?: 'idle' | 'lunge' | 'hit'
  fxRole?: 'cast' | 'hit'
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
  // 콜로세움 상대(rival)는 보스가 아니라 같은 학생 — 아군과 같은 크기
  const spritePx = isHero ? (c.kind === 'hero' ? 150 : side === 'enemy' && !c.rival ? 250 : 138) : c.kind === 'pet' || (c.rival && c.kind === 'monster') ? 84 : enemyMonsterPx(c.rival ? 'player' : side, c.refId)
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
            heroAnim === 'lunge' ? (side === 'player' ? 'hero-lunge-right' : 'hero-lunge-left') : fxRole === 'cast' ? 'battle-casting' : fxRole === 'hit' && c.alive ? (side === 'enemy' ? 'battle-hit-right' : 'battle-hit-left') : ''
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
          ) : c.isTestMonster ? (
            // 샌드백 허수아비 — 개인 공간의 무기 거치대 그림 그대로
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/map/dorm/weaponrack.png" alt="" draggable={false} style={{ height: spritePx * 1.45, width: 'auto', imageRendering: 'pixelated' }} className="drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]" />
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
        {battle.pvp
          ? `${battle.victory ? '승리!' : '패배...'} ${battle.pvp.opponentName}의 팀 — ${battle.pvp.practice ? '연습 대전(점수 변동 없음)' : '계속하면 점수가 기록됩니다'}`
          : battle.victory
          ? (battle.rewardExpShare ?? 0) < (battle.rewardExp ?? 0)
            ? `승리! EXP +${battle.rewardExpShare}/인 (총 ${battle.rewardExp}) · Gold +${battle.rewardGold}`
            : `승리! EXP +${battle.rewardExp} (단독) · Gold +${battle.rewardGold}`
          : battle.interrupted
          ? '전투 중단 — 누군가 흑룡 앞을 막아섰다!'
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
      <Button size="sm" onClick={() => dispatch({ type: 'BATTLE_END_CONTINUE' })}>계속하기 <span className="opacity-60">· Space</span></Button>
    </div>
  )
}
