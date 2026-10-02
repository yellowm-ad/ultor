// ============================================================================
// 전투 엔진 — ATB 대기 게이지 방식. 설계: Documents/울토르 시스템 DB.md §4~5, PRD v2.0 §16~20, §32~33
//
// 4대4: 아군 핵심 전투원 4명(주인공 + 학교 NPC 3) vs 적 최대 4. 펫은 전위 주인에게 귀속된 부속 유닛.
//   포지션 보너스(해당 캐릭터에게만): 전위 주는 피해 +10% · 후위 주는 회복 +10% · 보조 최대 HP +10%
//   어둠: 약화/환술/은신/즉사(일반 몬스터만, 엘리트·보스류는 면역 + 피해 0) · 빛: 회복/강화/정화/부활
//   바람: 모르스 전용 — 그 외 전투원이 쓰려 하면 런타임에서 막는다.
//
// 흐름(게임 리듀서가 호출):
//   BATTLE_TICK:
//     - activeUid 없음 → tickAtb(): ATB 충전 → 준비된 전투원에 행동권 부여
//       (행동 시작 시 지속피해 적용, 수면/마비로 행동 불가면 즉시 턴 종료)
//     - activeUid == 주인공 → 대기(사용자 입력)
//     - activeUid == NPC/펫/몬스터 → resolveEnemyTurn()(자동 행동) 후 advanceTurn()
//   BATTLE_ACTOR_ACTION(주인공 입력) → resolveAction() → checkBattleEnd() → advanceTurn()
// ============================================================================
import type {
  AiProfile,
  BattleAction,
  BattleFx,
  BattleLogEntry,
  BattleState,
  Combatant,
  MonsterDef,
  Pet,
  PetLink,
  PlayerCharacter,
  Position,
  Skill,
  SkillElement,
  Stats,
} from '@/lib/types'
import { ATB, MAX_ACTIVE_PETS, MAX_ENEMIES, MAX_GUESTS, MAX_PARTY_SIZE, MORS_MONSTER_ID, POSITION_BONUS, elementMultiplier, expSharePerMember } from '@/lib/constants'
import { MONSTERS, itemById, skillById } from '@/lib/mock-data'
import { rollHuntDrops } from '@/lib/life'
import { testMonsterExpReward } from '@/lib/exp-table'
import { petDefById, affectionTier, AFFECTION_TIER_META, petStatsForLevel } from '@/lib/pets'
import {
  STATUS_DEFS,
  applyDebuff,
  applyStatus,
  cleanseStatuses,
  illusionChance,
  isStealthed,
  wakeOnHit,
  statWithEffects,
  atbRateFactor,
  accuracyFactor,
  canEvade,
  actionBlock,
  skillBlocked,
  tickDamageOverTime,
  decayEffects,
  hasStatus,
} from '@/lib/status-effects'

export type { BattleAction }

let uidSeq = 0
function nextUid(prefix: string) {
  uidSeq += 1
  return `${prefix}-${uidSeq}`
}

function log(entries: BattleLogEntry[], text: string, kind: BattleLogEntry['kind'] = 'info') {
  entries.push({ id: nextUid('log'), text, kind })
}

// ─── 전투원 생성 ─────────────────────────────────────────────────────────────

export function combatantFromPlayer(player: PlayerCharacter, effectiveStats?: Stats, weaponElement?: Combatant['weaponElement']): Combatant {
  const stats = effectiveStats ?? player.stats
  return {
    uid: 'hero',
    side: 'player',
    kind: 'hero',
    refId: 'hero',
    name: player.name || '주인공',
    icon: '/images/elements/neutral-crest.png',
    element: null,
    level: player.level,
    stats,
    hp: player.hp,
    mp: player.mp,
    // 전투에는 장착 스킬만 들고 간다(레벨 제한 미달 스킬 제외)
    skills: player.equippedSkills.filter((id) => {
      const s = skillById(id)
      return !!s && (s.levelRequired ?? 0) <= player.level
    }),
    atb: 0,
    effects: [],
    weaponElement,
    alive: player.hp > 0,
  }
}

export function combatantFromPet(pet: Pet, ownerUid: string, uid = 'pet'): Combatant {
  const def = petDefById(pet.defId)!
  const raw = petStatsForLevel(def, pet.level)
  const tier = affectionTier(pet.affection)
  const meta = AFFECTION_TIER_META[tier]
  const stats = { ...raw }
  ;(Object.keys(stats) as (keyof Stats)[]).forEach((k) => {
    stats[k] = Math.max(1, Math.round(stats[k] * meta.statMult))
  })
  return {
    uid,
    side: 'player',
    kind: 'pet',
    refId: pet.defId,
    name: pet.nickname,
    icon: def.icon,
    element: def.element,
    level: pet.level,
    stats,
    hp: Math.min(pet.hp, stats.maxHp),
    mp: Math.min(pet.mp, stats.maxMp),
    skills: pet.learnedSkills,
    atb: 0,
    effects: [],
    ownerUid,
    bonusCrit: meta.critBonus,
    supportChance: meta.supportChance,
    alive: pet.hp > 0,
  }
}

/** 몬스터 AI 성향 — 명시값이 없으면 특성에서 유추(§33) */
export function aiProfileOf(def: Pick<MonsterDef, 'aiProfile' | 'traits'>): AiProfile {
  if (def.aiProfile) return def.aiProfile
  const t = def.traits ?? []
  if (t.includes('caster')) return 'healerHunt'
  if (t.includes('swift')) return 'finisher'
  if (t.includes('aggressive') || t.includes('tank')) return 'melee'
  return 'random'
}

export function combatantFromMonster(def: MonsterDef): Combatant {
  return {
    uid: nextUid('mon'),
    side: 'enemy',
    kind: 'monster',
    refId: def.id,
    name: def.name,
    icon: def.icon,
    element: def.element,
    level: def.level,
    stats: { ...def.stats },
    hp: def.stats.maxHp,
    mp: def.stats.maxMp,
    skills: def.skills,
    atb: Math.random() * 20, // 몬스터는 약간의 무작위 선턴/후턴
    effects: [],
    traits: def.traits,
    rank: def.rank ?? 'normal',
    aiProfile: aiProfileOf(def),
    isTestMonster: def.isTestMonster,
    alive: true,
  }
}

/** 포지션 적용 — 전위는 최대 HP +10%(현재 HP 도 같은 비율로) */
export function applyPosition(c: Combatant, position: Position): Combatant {
  if (position !== 'front') return { ...c, position }
  const maxHp = Math.round(c.stats.maxHp * POSITION_BONUS.frontMaxHp)
  const hp = c.alive ? Math.min(maxHp, Math.round(c.hp * POSITION_BONUS.frontMaxHp)) : c.hp
  return { ...c, position, stats: { ...c.stats, maxHp }, hp }
}

// ─── 전투 초기화 ─────────────────────────────────────────────────────────────

export interface PartyMemberInput {
  combatant: Combatant // 포지션 미적용 상태
  position: Position
  /** 이 캐릭터가 데려가는 펫 — 전위일 때만 실제로 참가 */
  pet?: Combatant | null
}

/**
 * 전투 시작. party = 진형 6칸의 전투원(주인공 + 동료 최대 3 + 임시 NPC 최대 2) — 포지션과 펫을 함께 넘긴다.
 * 펫은 진형과 별개인 고정 펫 슬롯으로 주인과 PetLink 로 묶여 참가한다.
 */
export function initBattle(
  party: PartyMemberInput[],
  monsterDefs: MonsterDef[],
  originCell: { x: number; y: number },
  fieldMonsterUid?: string,
  opts: { huntEnabled?: boolean } = {},
): BattleState {
  const members = party.slice(0, MAX_PARTY_SIZE + MAX_GUESTS)
  const core = members.map((m) => applyPosition(m.combatant, m.position))
  const petLinks: PetLink[] = []
  const pets: Combatant[] = []
  // 펫은 전위 캐릭터만, 전투당 최대 2마리(통합 PRD §26)
  members.forEach((m) => {
    if (!m.pet || m.position !== 'front' || pets.length >= MAX_ACTIVE_PETS) return
    const owner = core.find((c) => c.uid === m.combatant.uid)!
    pets.push({ ...m.pet, ownerUid: owner.uid })
    petLinks.push({ petUid: m.pet.uid, ownerCombatantUid: owner.uid })
  })
  const enemies = monsterDefs.slice(0, MAX_ENEMIES).map(combatantFromMonster)
  const combatants = [...core, ...pets, ...enemies]

  const entries: BattleLogEntry[] = []
  log(entries, `${enemies.map((e) => e.name).join(', ')}이(가) 나타났다!`, 'system')

  return {
    round: 1,
    tick: 0,
    activeUid: null,
    combatants,
    log: entries,
    isOver: false,
    victory: false,
    originCell,
    fieldMonsterUid,
    huntEnabled: opts.huntEnabled,
    petLinks,
  }
}

/** 펫 귀속 검증 — 주인이 없거나 전위가 아니면 false */
export function validPetLink(battle: BattleState, link: PetLink): boolean {
  const owner = battle.combatants.find((c) => c.uid === link.ownerCombatantUid)
  return !!owner && owner.position === 'front'
}

/** 플레이어가 직접 조작하는 전투원 — 주인공 + 파티 동료(임시 NPC·펫 제외) */
export function isPlayerControlled(c: Combatant): boolean {
  return c.side === 'player' && (c.kind === 'hero' || (c.kind === 'ally' && !c.guest))
}

/** 이 전투원의 턴에 사용자 입력을 기다려야 하는가(자동 전투 · 동료 자동 설정 반영) */
export function awaitsPlayerInput(battle: BattleState, actor: Combatant, companionAuto?: boolean): boolean {
  if (battle.auto || !isPlayerControlled(actor)) return false
  return actor.kind === 'hero' || !companionAuto
}

/** 경험치 분배 대상(주인공 + 파티 동료) 수 */
export function expShareMemberCount(combatants: Combatant[]): number {
  return combatants.filter(isPlayerControlled).length
}

// ─── ATB 충전 ────────────────────────────────────────────────────────────────

function atbGain(c: Combatant): number {
  const spd = statWithEffects(c, 'spd')
  return ATB.BASE_TICK * (spd / ATB.REF_SPD) * atbRateFactor(c)
}

/**
 * activeUid 가 없을 때 호출. 아무도 준비되지 않았으면 전원 ATB 를 조금씩 채우고,
 * 준비된 전투원이 생기면 activeUid 를 부여하고 행동-시작 처리(지속피해/행동불가)를 한다.
 */
export function tickAtb(battle: BattleState): BattleState {
  if (battle.isOver || battle.activeUid) return battle
  const combatants = cloneCombatants(battle.combatants)
  const entries = [...battle.log]
  let tick = battle.tick

  // 아무도 100 이상이 아닐 때까지 충전
  let guard = 0
  while (!combatants.some((c) => c.alive && c.atb >= ATB.THRESHOLD) && guard < 4000) {
    for (const c of combatants) if (c.alive) c.atb += atbGain(c)
    tick += 1
    guard += 1
  }

  // 준비된 전투원 중 atb 가장 높은(동률이면 spd 높은, 그다음 아군) 하나 선택
  const ready = combatants
    .filter((c) => c.alive && c.atb >= ATB.THRESHOLD)
    .sort((a, b) => b.atb - a.atb || b.stats.spd - a.stats.spd || (a.side === 'player' ? -1 : 1))
  const actor = ready[0]
  if (!actor) return { ...battle, combatants, log: entries, tick }

  // 행동 시작: 지속피해(출혈/화상/감염)
  const allies = combatants.filter((c) => c.side === actor.side)
  const dot = tickDamageOverTime(actor, allies)
  if (dot.totalDamage > 0) {
    actor.hp = Math.max(0, actor.hp - dot.totalDamage)
    for (const l of dot.logs) log(entries, l.text, 'status')
    if (actor.hp <= 0) {
      actor.alive = false
      actor.atb = 0
      log(entries, `${actor.name}이(가) 지속 피해로 쓰러졌다!`, 'system')
      return { ...battle, combatants, log: entries, tick, activeUid: null }
    }
  }

  // 행동 불가(수면/마비)
  const block = actionBlock(actor)
  if (block.blocked) {
    log(entries, block.reason ?? `${actor.name}은(는) 움직이지 못했다.`, 'status')
    endActorTurn(actor, entries)
    return { ...battle, combatants, log: entries, tick, activeUid: null, round: battle.round + 1 }
  }

  return { ...battle, combatants, log: entries, tick, activeUid: actor.uid }
}

function cloneCombatants(list: Combatant[]): Combatant[] {
  return list.map((c) => ({ ...c, stats: { ...c.stats }, effects: c.effects.map((e) => ({ ...e })) }))
}

export function currentActor(battle: BattleState): Combatant | null {
  if (!battle.activeUid) return null
  return battle.combatants.find((c) => c.uid === battle.activeUid && c.alive) ?? null
}

// ─── 데미지 계산 ─────────────────────────────────────────────────────────────

function dealtMult(c: Combatant): number {
  let m = 1
  const ls = c.effects.find((e) => e.kind === 'buff' && e.id === 'lastStand')
  if (ls) m *= 1 + (ls.magnitude ?? 0.3)
  if (c.position === 'rear') m *= POSITION_BONUS.rearDamage // 후위: 공격력·마법공격력 +10%
  return m
}
function takenMult(c: Combatant): number {
  let m = 1
  const ls = c.effects.find((e) => e.kind === 'buff' && e.id === 'lastStand')
  if (ls) m *= 1 + 0.5 * (ls.magnitude ?? 0.3) // 받는 피해 증가는 절반 폭
  const guard = c.effects.find((e) => e.kind === 'buff' && e.id === 'defendGuard')
  if (guard) m *= 1 - (guard.magnitude ?? 0.5)
  if (c.position === 'front') m *= POSITION_BONUS.frontTaken // 전위: 받는 피해 -5%
  return m
}
/** 보조: 주는 회복량 +10% */
function healMult(c: Combatant): number {
  return c.position === 'support' ? POSITION_BONUS.supportHealing : 1
}

/** 장착 무기와 같은 속성 스킬 위력 +8%(§29) */
const WEAPON_ELEMENT_BONUS = 1.08

export interface DamageResult {
  amount: number
  isCrit: boolean
  missed: boolean
}

export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  power: number,
  isMagic: boolean,
  skillElement: SkillElement,
): DamageResult {
  // 명중 판정
  const hitChance = accuracyFactor(attacker) * (canEvade(defender) ? 1 - evadeChance(defender) : 1)
  if (Math.random() > hitChance) return { amount: 0, isCrit: false, missed: true }

  const atkStat = isMagic ? statWithEffects(attacker, 'matk') : statWithEffects(attacker, 'atk')
  const defStat = isMagic ? statWithEffects(defender, 'mdef') : statWithEffects(defender, 'def')

  // 캐릭터 고정 속성 보너스는 폐지(§10). 무기 속성 일치만 +8%.
  let pw = power
  if (skillElement && attacker.weaponElement === skillElement) pw *= WEAPON_ELEMENT_BONUS

  const elemMult = elementMultiplier(skillElement, defender.element)
  const critChance = Math.min(0.5, 0.05 + statWithEffects(attacker, 'luck') * 0.01 + (attacker.bonusCrit ?? 0))
  const isCrit = Math.random() < critChance
  const variance = 0.85 + Math.random() * 0.3
  let raw = atkStat * pw * elemMult * variance - defStat * 0.5
  if (isCrit) raw *= 1.6
  raw *= dealtMult(attacker) * takenMult(defender)
  return { amount: Math.max(1, Math.round(raw)), isCrit, missed: false }
}

function evadeChance(c: Combatant): number {
  return Math.min(0.3, 0.02 + statWithEffects(c, 'luck') * 0.006)
}

// ─── 행동 처리 ───────────────────────────────────────────────────────────────

function aliveEnemies(list: Combatant[]) {
  return list.filter((c) => c.side === 'enemy' && c.alive)
}
function alivePlayers(list: Combatant[]) {
  return list.filter((c) => c.side === 'player' && c.alive)
}

export interface ResolveResult {
  battle: BattleState
  itemConsumed?: string
  fled?: boolean
}

function applyStatusRider(entries: BattleLogEntry[], attacker: Combatant, target: Combatant, skill: Skill) {
  if (!skill.status || !target.alive) return
  const ok = applyStatus(target, skill.status.id, skill.status.chance, skill.status.turns, statWithEffects(attacker, 'matk'))
  if (ok) log(entries, `${target.name}이(가) ${STATUS_DEFS[skill.status.id].name} 상태가 되었다.`, 'status')
}

function applyDebuffRider(entries: BattleLogEntry[], target: Combatant, skill: Skill) {
  if (!skill.debuff || !target.alive) return
  const d = skill.debuff
  const ok = applyDebuff(target, d.id, d.magnitude, d.turns, d.chance ?? 1)
  log(entries, ok ? `${target.name}에게 ${skill.name}의 효과가 걸렸다.` : `${target.name}은(는) ${skill.name}을(를) 버텨냈다.`, 'status')
}

function damageTarget(
  entries: BattleLogEntry[],
  attacker: Combatant,
  target: Combatant,
  power: number,
  isMagic: boolean,
  element: SkillElement,
  label: string,
) {
  const { amount, isCrit, missed } = computeDamage(attacker, target, power, isMagic, element)
  if (missed) {
    log(entries, `${attacker.name}의 ${label} — 빗나갔다!`, 'info')
    return
  }
  wakeOnHit(target)
  target.hp = Math.max(0, target.hp - amount)
  log(entries, `${attacker.name}의 ${label}! ${target.name}에게 ${amount}의 피해${isCrit ? ' (치명타!)' : ''}`, 'damage')
  if (target.hp <= 0) {
    target.alive = false
    log(entries, `${target.name}을(를) 쓰러뜨렸다!`, 'system')
  }
}

/** 바람 속성 사용 가능 여부 — 모르스만(§8, §45) */
export function canUseSkill(actor: Combatant, skill: Skill): boolean {
  if (skill.element === 'wind' || skill.owner === 'mors') return actor.kind === 'monster' && actor.refId === MORS_MONSTER_ID
  return true
}

/** 즉사 가능한 대상인가 — 일반 몬스터만(엘리트·보스류·모르스 면역) */
export function isExecutable(target: Combatant): boolean {
  if (target.kind !== 'monster') return false
  if (target.refId === MORS_MONSTER_ID) return false
  return (target.rank ?? 'normal') === 'normal'
}

/**
 * 환술에 걸린 전투원의 단일 대상 공격 — 확률적으로 표적이 아무 전투원(같은 편 포함)으로 바뀐다.
 */
function confusedTarget(actor: Combatant, intended: Combatant | undefined, combatants: Combatant[]): Combatant | undefined {
  const ch = illusionChance(actor)
  if (!ch || Math.random() > ch) return intended
  const pool = combatants.filter((c) => c.alive && c.uid !== actor.uid)
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : intended
}

/** 은신 중인 적을 단일 대상으로 노렸을 때 — 다른 대상으로 돌리거나(가능하면) 실패 */
function redirectFromStealth(actor: Combatant, target: Combatant | undefined, combatants: Combatant[]): Combatant | undefined {
  if (!target || target.side === actor.side || !isStealthed(target)) return target
  const visible = combatants.filter((c) => c.side === target.side && c.alive && !isStealthed(c))
  return visible.length ? visible[Math.floor(Math.random() * visible.length)] : undefined
}

export function resolveAction(battle: BattleState, actorUid: string, action: BattleAction): ResolveResult {
  const combatants = cloneCombatants(battle.combatants)
  const entries = [...battle.log]
  const actor = combatants.find((c) => c.uid === actorUid)
  let itemConsumed: string | undefined
  let fled = false

  if (!actor || !actor.alive) return { battle: { ...battle, combatants, log: entries } }

  const find = (uid?: string) => combatants.find((c) => c.uid === uid)
  const done = (fx?: BattleFx): ResolveResult => ({ battle: { ...battle, combatants, log: entries, lastFx: fx ?? battle.lastFx } })

  if (action.type === 'flee') {
    if (Math.random() < 0.75) {
      log(entries, `${actor.name}이(가) 전투에서 도망쳤다!`, 'system')
      fled = true
    } else {
      log(entries, `${actor.name}의 도망이 실패했다!`, 'system')
    }
    return { battle: { ...battle, combatants, log: entries }, fled }
  }

  if (action.type === 'defend') {
    actor.effects.push({ key: nextUid('eff'), kind: 'buff', id: 'defendGuard', name: '방어', turnsLeft: 1, magnitude: 0.5 })
    actor.atb += ATB.DEFEND_GAIN
    log(entries, `${actor.name}이(가) 방어 태세를 취했다.`)
    return done()
  }

  if (action.type === 'attack') {
    let target = redirectFromStealth(actor, find(action.targetUid), combatants)
    target = confusedTarget(actor, target, combatants)
    let fx: BattleFx | undefined
    if (target && target.alive) {
      if (target.side === actor.side) log(entries, `${actor.name}은(는) 환술에 홀려 같은 편을 공격했다!`, 'status')
      damageTarget(entries, actor, target, 1.0, false, null, '공격')
      fx = { fxId: nextUid('fx'), sourceUid: actor.uid, targetUids: [target.uid], element: null, archetype: 'attack', aoe: false, power: 1.0 }
    } else {
      log(entries, `${actor.name}의 공격 — 노릴 대상이 보이지 않는다.`)
    }
    maybeSupportAttack(entries, combatants, actor)
    return done(fx)
  }

  if (action.type === 'skill') {
    const skill = skillById(action.skillId)
    if (!skill) return done()
    if (!actor.skills.includes(skill.id)) {
      log(entries, `${actor.name}은(는) [${skill.name}]을(를) 배우지 않았다.`, 'system')
      return done()
    }
    if (!canUseSkill(actor, skill)) {
      log(entries, `${actor.name}은(는) [${skill.name}]을(를) 다룰 수 없다 — 유실된 바람의 힘이다.`, 'system')
      return done()
    }
    if (skillBlocked(actor)) {
      log(entries, `${actor.name}은(는) 침묵 상태라 스킬을 쓸 수 없다!`, 'status')
      return done()
    }
    if (actor.mp < skill.mpCost) {
      log(entries, `MP가 부족하다!`, 'system')
      return done()
    }
    actor.mp -= skill.mpCost
    if (skill.atbCost) actor.atb -= skill.atbCost

    const isMagic = !skill.physical
    const enemyList = combatants.filter((c) => c.side !== actor.side && c.alive)
    const allyList = combatants.filter((c) => c.side === actor.side && c.alive)
    const aoe = skill.targeting === 'allEnemies' || skill.targeting === 'allAllies'
    const mkFx = (targets: Combatant[], archetype: BattleFx['archetype'], power = skill.power || 1): BattleFx => ({
      fxId: nextUid('fx'),
      sourceUid: actor.uid,
      targetUids: targets.map((t) => t.uid),
      element: skill.element,
      archetype,
      aoe,
      power,
      mpCost: skill.mpCost,
    })
    /** 적 대상 목록 — 단일 대상은 은신·환술 보정 */
    const enemyTargets = (): Combatant[] => {
      if (skill.targeting === 'allEnemies') return enemyList
      let t = redirectFromStealth(actor, find(action.targetUid), combatants)
      t = confusedTarget(actor, t, combatants)
      return t && t.alive ? [t] : []
    }
    /** 아군 대상 목록 */
    const allyTargets = (includeDead = false): Combatant[] => {
      if (skill.targeting === 'allAllies') return combatants.filter((c) => c.side === actor.side && (includeDead || c.alive))
      if (skill.targeting === 'self') return [actor]
      const t = find(action.targetUid)
      return t && t.side === actor.side ? [t] : [actor]
    }

    switch (skill.kind) {
      case 'attack':
      case 'debuff': {
        if (skill.kind === 'attack' || skill.power > 0) {
          const targets = enemyTargets()
          for (const t of targets) {
            damageTarget(entries, actor, t, skill.power, isMagic, skill.element, `[${skill.name}]`)
            applyStatusRider(entries, actor, t, skill)
            applyDebuffRider(entries, t, skill)
          }
          return done(mkFx(targets, isMagic ? 'magicAttack' : 'attack'))
        }
        const targets = enemyTargets()
        log(entries, `${actor.name}의 [${skill.name}]!`)
        for (const t of targets) {
          applyStatusRider(entries, actor, t, skill)
          applyDebuffRider(entries, t, skill)
        }
        return done(mkFx(targets, 'debuff'))
      }
      case 'illusion': {
        const targets = enemyTargets()
        log(entries, `${actor.name}의 [${skill.name}]!`)
        for (const t of targets) applyDebuffRider(entries, t, skill)
        return done(mkFx(targets, 'debuff'))
      }
      case 'execute': {
        const targets = enemyTargets()
        log(entries, `${actor.name}의 [${skill.name}]!`)
        const ex = skill.execute
        for (const t of targets) {
          if (!isExecutable(t)) {
            // 보스류: 즉사 면역 + 피해 0(§6, §32)
            log(entries, `${t.name}에게는 통하지 않는다! (즉사 면역 · 피해 0)`, 'status')
            continue
          }
          if (ex && Math.random() < ex.successChance) {
            t.hp = 0
            t.alive = false
            log(entries, `${t.name}의 영혼이 거두어졌다! (즉사)`, 'system')
          } else {
            log(entries, `${t.name}은(는) 죽음의 손길을 피했다.`, 'info')
          }
        }
        return done(mkFx(targets, 'debuff'))
      }
      case 'heal': {
        const targets = allyTargets().filter((t) => t.alive)
        for (const t of targets) {
          const heal = Math.round(statWithEffects(actor, 'matk') * skill.power * healMult(actor))
          t.hp = Math.min(t.stats.maxHp, t.hp + heal)
          log(entries, `${actor.name}의 [${skill.name}]! ${t.name}의 HP를 ${heal} 회복했다.`, 'heal')
        }
        return done(mkFx(targets, 'heal'))
      }
      case 'revive': {
        const targets = allyTargets(true).filter((t) => !t.alive && t.kind !== 'pet')
        if (targets.length === 0) log(entries, `${actor.name}의 [${skill.name}]! 되살릴 동료가 없다.`)
        for (const t of targets) {
          t.alive = true
          t.effects = []
          t.atb = 0
          t.hp = Math.max(1, Math.round(t.stats.maxHp * (skill.reviveHpRatio ?? 0.5) * healMult(actor)))
          log(entries, `${actor.name}의 [${skill.name}]! ${t.name}이(가) 되살아났다!`, 'system')
        }
        return done(mkFx(targets, 'heal'))
      }
      case 'buff':
      case 'stealth': {
        const targets = allyTargets().filter((t) => t.alive)
        // 보조: 버프 효율 +10%
        const buffMult = actor.position === 'support' ? POSITION_BONUS.supportBuff : 1
        for (const t of targets) {
          if (!skill.buff) continue
          const existing = t.effects.find((e) => e.kind === 'buff' && e.id === skill.buff!.id)
          if (existing) {
            existing.turnsLeft = Math.max(existing.turnsLeft, skill.buff.turns)
            existing.magnitude = Math.max(existing.magnitude ?? 0, skill.buff.magnitude * buffMult)
          } else {
            t.effects.push({ key: nextUid('eff'), kind: 'buff', id: skill.buff.id, name: skill.name, turnsLeft: skill.buff.turns, magnitude: skill.buff.magnitude * buffMult })
          }
        }
        const who = targets.length === 1 && targets[0].uid !== actor.uid ? ` ${targets[0].name}에게` : ''
        log(entries, skill.kind === 'stealth' ? `${actor.name}의 [${skill.name}]!${who} 그림자가 드리워졌다.` : `${actor.name}의 [${skill.name}]!${who} 효과가 적용되었다.`)
        return done(mkFx(targets, 'buff', 1))
      }
      case 'utility': {
        const utilTarget = skill.targeting === 'self' ? actor : find(action.targetUid) ?? actor
        if (skill.cleanse) {
          const n = cleanseStatuses(utilTarget)
          log(entries, `${actor.name}의 [${skill.name}]! ${utilTarget.name}의 상태이상·약화 ${n}개를 해제했다.`, n ? 'status' : 'info')
        }
        if (skill.restoreMpRatio) {
          const restored = Math.round(statWithEffects(actor, 'matk') * skill.restoreMpRatio)
          actor.mp = Math.min(actor.stats.maxMp, actor.mp + restored)
          log(entries, `${actor.name}의 [${skill.name}]! MP를 ${restored} 회복했다.`, 'heal')
        }
        return done({ ...mkFx([utilTarget], 'utility', 1), aoe: false })
      }
    }
    return done()
  }

  if (action.type === 'item') {
    const item = itemById(action.itemId)
    let fx: BattleFx | undefined
    if (item?.useEffect) {
      itemConsumed = action.itemId
      const target = find(action.targetUid) ?? actor
      fx = { fxId: nextUid('fx'), sourceUid: actor.uid, targetUids: [target.uid], element: null, archetype: 'item', aoe: false, power: 1 }
      const ue = item.useEffect
      if (ue.reviveOnly) {
        if (!target.alive) {
          target.alive = true
          target.hp = Math.round(target.stats.maxHp * 0.5)
          log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name} 부활!`, 'system')
        }
      } else {
        if (ue.healHp && target.alive) {
          target.hp = Math.min(target.stats.maxHp, target.hp + ue.healHp)
          log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name}의 HP 회복.`, 'heal')
        }
        if (ue.healMp && target.alive) {
          target.mp = Math.min(target.stats.maxMp, target.mp + ue.healMp)
          log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name}의 MP 회복.`, 'heal')
        }
      }
      if (ue.cureStatus) {
        const n = cleanseStatuses(target)
        log(entries, `${actor.name}이(가) [${item.name}] 사용! 상태이상 ${n}개 치료.`, 'status')
      }
      if (ue.atbBoost) {
        target.atb += ue.atbBoost
        log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name}의 ATB가 찼다.`)
      }
      if (ue.escapeBattle) {
        log(entries, `${actor.name}이(가) [${item.name}]으로 전투에서 벗어났다!`, 'system')
        fled = true
      }
    }
    return { battle: { ...battle, combatants, log: entries, lastFx: fx ?? battle.lastFx }, itemConsumed, fled }
  }

  return { battle: { ...battle, combatants, log: entries }, itemConsumed, fled }
}

/** 펫 '헌신' 호감도: 주인이 공격할 때 자기 펫이 확률로 추가 타격 */
function maybeSupportAttack(entries: BattleLogEntry[], combatants: Combatant[], actor: Combatant) {
  const pet = combatants.find((c) => c.kind === 'pet' && c.alive && c.ownerUid === actor.uid)
  if (!pet || !pet.supportChance || Math.random() > pet.supportChance) return
  const enemies = aliveEnemies(combatants).filter((c) => !isStealthed(c))
  if (enemies.length === 0) return
  const t = enemies[Math.floor(Math.random() * enemies.length)]
  log(entries, `${pet.name}이(가) 지원 공격!`, 'info')
  damageTarget(entries, pet, t, 0.6, false, pet.element, '지원 공격')
}

// ─── 자동 행동(NPC · 펫 · 몬스터) ────────────────────────────────────────────

/** 표적 성향에 따른 가중치(§33) */
function targetWeight(profile: AiProfile, t: Combatant): number {
  const hpRatio = t.hp / Math.max(1, t.stats.maxHp)
  switch (profile) {
    case 'melee':
      return t.position === 'front' ? 4 : t.kind === 'pet' ? 1.5 : 1
    case 'healerHunt':
      return t.position === 'rear' ? 4 : t.position === 'support' ? 2 : 1
    case 'support':
      return t.position === 'support' ? 4 : 1
    case 'finisher':
      return 1 + (1 - hpRatio) * 6
    default:
      return 1
  }
}

function pickWeighted<T>(list: T[], weight: (t: T) => number): T {
  const ws = list.map(weight)
  const total = ws.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < list.length; i++) {
    r -= ws[i]
    if (r <= 0) return list[i]
  }
  return list[list.length - 1]
}

/** 단일 대상 표적 선택 — 은신은 제외(전원 은신이면 예외), 성향 가중치 적용 */
function pickFoe(actor: Combatant, foes: Combatant[]): Combatant {
  const visible = foes.filter((f) => !isStealthed(f))
  const pool = visible.length ? visible : foes
  const profile: AiProfile = actor.aiProfile ?? (actor.side === 'player' ? 'finisher' : 'random')
  return pickWeighted(pool, (t) => targetWeight(profile, t))
}

export function chooseAutoAction(actor: Combatant, combatants: Combatant[]): BattleAction {
  const foes = combatants.filter((c) => c.side !== actor.side && c.alive)
  const allies = combatants.filter((c) => c.side === actor.side && c.alive)
  const fallen = combatants.filter((c) => c.side === actor.side && !c.alive && c.kind !== 'pet')
  if (foes.length === 0) return { type: 'defend' }

  if (!skillBlocked(actor) && actor.skills.length > 0) {
    const usable = actor.skills
      .map((id) => skillById(id))
      .filter((s): s is Skill => !!s && actor.mp >= s.mpCost && canUseSkill(actor, s))
    const has = (k: Skill['kind']) => usable.filter((s) => s.kind === k)

    // 1) 쓰러진 동료가 있으면 부활 우선
    const revive = has('revive')[0]
    if (revive && fallen.length) return { type: 'skill', skillId: revive.id, targetUid: fallen[0].uid }

    // 2) 체력 50% 미만 동료가 있으면 회복
    const hurt = allies.slice().sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
    const heal = has('heal')[0]
    if (heal && hurt && hurt.hp / hurt.stats.maxHp < 0.5) {
      const target = heal.targeting === 'self' ? actor : hurt
      if (heal.targeting !== 'self' || target.hp / target.stats.maxHp < 0.5) return { type: 'skill', skillId: heal.id, targetUid: target.uid }
    }

    if (Math.random() < (actor.traits?.includes('caster') || actor.kind === 'ally' ? 0.65 : 0.4)) {
      // 즉사기는 일반 몬스터가 있을 때만 의미가 있다
      const candidates = usable.filter((s) => {
        if (s.kind === 'heal' || s.kind === 'revive') return false
        if (s.kind === 'execute') return foes.some(isExecutable)
        if (s.kind === 'stealth') return allies.some((a) => !isStealthed(a) && a.kind !== 'pet')
        if (s.cleanse) return allies.some((a) => a.effects.some((e) => e.kind !== 'buff'))
        return true
      })
      if (candidates.length > 0) {
        const s = candidates[Math.floor(Math.random() * candidates.length)]
        if (s.kind === 'buff') {
          const t = s.targeting === 'singleAlly' ? allies[Math.floor(Math.random() * allies.length)] : actor
          return { type: 'skill', skillId: s.id, targetUid: t.uid }
        }
        if (s.kind === 'stealth') {
          const t = allies.filter((a) => a.kind !== 'pet' && !isStealthed(a)).sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0] ?? actor
          return { type: 'skill', skillId: s.id, targetUid: t.uid }
        }
        if (s.kind === 'utility') {
          const t = s.cleanse ? allies.find((a) => a.effects.some((e) => e.kind !== 'buff')) ?? actor : actor
          return { type: 'skill', skillId: s.id, targetUid: t.uid }
        }
        if (s.kind === 'execute') {
          const t = foes.filter(isExecutable)
          return { type: 'skill', skillId: s.id, targetUid: (t[Math.floor(Math.random() * t.length)] ?? foes[0]).uid }
        }
        return { type: 'skill', skillId: s.id, targetUid: pickFoe(actor, foes).uid }
      }
    }
  }
  return { type: 'attack', targetUid: pickFoe(actor, foes).uid }
}

export function resolveEnemyTurn(battle: BattleState, actorUid: string): BattleState {
  const actor = battle.combatants.find((c) => c.uid === actorUid)
  if (!actor) return battle
  // 펫은 주인이 전투에 있을 때만 행동 — 귀속이 깨졌으면 대기
  if (actor.kind === 'pet') {
    const link = battle.petLinks?.find((l) => l.petUid === actor.uid)
    if (!link || !validPetLink(battle, link)) return battle
  }
  const action = chooseAutoAction(actor, battle.combatants)
  const { battle: next } = resolveAction(battle, actorUid, action)
  return next
}

// ─── 턴 종료 / 진행 ──────────────────────────────────────────────────────────

function endActorTurn(actor: Combatant, entries: BattleLogEntry[]) {
  actor.atb = Math.max(0, actor.atb - ATB.THRESHOLD)
  const expired = decayEffects(actor)
  for (const name of expired) log(entries, `${actor.name}의 ${name} 효과가 사라졌다.`, 'info')
}

/** 행동을 마친 activeUid 의 ATB/효과를 정리하고 activeUid 를 비운다 */
export function advanceTurn(battle: BattleState): BattleState {
  const combatants = cloneCombatants(battle.combatants)
  const entries = [...battle.log]
  const actor = combatants.find((c) => c.uid === battle.activeUid)
  if (actor) endActorTurn(actor, entries)
  return { ...battle, combatants, log: entries, activeUid: null, round: battle.round + 1 }
}

export function checkBattleEnd(battle: BattleState): BattleState {
  const enemiesAlive = aliveEnemies(battle.combatants).length > 0
  // 펫·임시 NPC 만 남으면 패배 — 주인공 + 파티 동료 기준
  const playersAlive = alivePlayers(battle.combatants).some(isPlayerControlled)
  if (enemiesAlive && playersAlive) return battle

  const entries = [...battle.log]
  if (!enemiesAlive) {
    const heroLevel = battle.combatants.find((c) => c.uid === 'hero')?.level ?? 1
    let expTotal = 0
    let goldTotal = 0
    const drops: string[] = []
    const huntDrops: string[] = []
    for (const c of battle.combatants) {
      if (c.side !== 'enemy') continue
      const def = MONSTERS.find((m) => m.id === c.refId)
      if (!def) continue
      if (def.isTestMonster) {
        expTotal += testMonsterExpReward(heroLevel)
      } else {
        expTotal += def.expReward
        goldTotal += def.goldReward
        for (const d of def.dropTable ?? []) if (Math.random() < d.chance) drops.push(d.itemId)
        if (battle.huntEnabled) huntDrops.push(...rollHuntDrops(def.family))
      }
    }
    const members = expShareMemberCount(battle.combatants)
    const share = expSharePerMember(expTotal, members)
    log(entries, members > 1 ? `전투에서 승리했다! 경험치 ${expTotal} (${members}명 분배 · 1인당 ${share}), 골드 ${goldTotal} 획득!` : `전투에서 승리했다! 경험치 ${expTotal} (단독 전투 · 전부 획득), 골드 ${goldTotal} 획득!`, 'system')
    if (drops.length) log(entries, `획득: ${drops.map((id) => itemById(id)?.name ?? id).join(', ')}`, 'system')
    if (huntDrops.length) log(entries, `사냥 부산물: ${huntDrops.map((id) => itemById(id)?.name ?? id).join(', ')}`, 'system')
    return { ...battle, isOver: true, victory: true, log: entries, rewardExp: expTotal, rewardExpShare: share, rewardGold: goldTotal, rewardDrops: drops, huntDrops }
  }

  log(entries, `파티가 쓰러졌다... 마법학교로 후송된다.`, 'system')
  return { ...battle, isOver: true, victory: false, log: entries }
}

export { hasStatus }
