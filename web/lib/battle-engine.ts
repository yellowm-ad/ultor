// ============================================================================
// 전투 엔진 — ATB 대기 게이지 방식. 설계: Documents/울토르 시스템 DB.md §4~5
//
// 흐름(게임 리듀서가 호출):
//   BATTLE_TICK:
//     - activeUid 없음 → tickAtb(): ATB 충전 → 준비된 전투원에 행동권 부여
//       (행동 시작 시 지속피해 적용, 수면/마비로 행동 불가면 즉시 턴 종료)
//     - activeUid == 히어로 → 대기(사용자 입력)
//     - activeUid == 펫/몬스터 → resolveEnemyTurn()/펫 AI 후 advanceTurn()
//   BATTLE_ACTOR_ACTION(히어로 입력) → resolveAction() → checkBattleEnd() → advanceTurn()
// ============================================================================
import type {
  BattleAction,
  BattleFx,
  BattleLogEntry,
  BattleState,
  Combatant,
  ElementOrNeutral,
  MonsterDef,
  Pet,
  PlayerCharacter,
  Skill,
  Stats,
} from '@/lib/types'
import { ATB, elementMultiplier } from '@/lib/constants'
import { MONSTERS, itemById, skillById } from '@/lib/mock-data'
import { rollHuntDrops } from '@/lib/life'
import { testMonsterExpReward } from '@/lib/exp-table'
import { petDefById, affectionTier, AFFECTION_TIER_META, petStatsForLevel } from '@/lib/pets'
import {
  STATUS_DEFS,
  applyStatus,
  cleanseStatuses,
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

export function combatantFromPlayer(player: PlayerCharacter, effectiveStats?: Stats): Combatant {
  const stats = effectiveStats ?? player.stats
  return {
    uid: 'hero',
    side: 'player',
    kind: 'hero',
    refId: 'hero',
    name: player.name || '주인공',
    icon: `/images/elements/${player.element}-crest.png`,
    element: player.element,
    level: player.level,
    stats,
    hp: player.hp,
    mp: player.mp,
    skills: player.learnedSkills,
    atb: 0,
    effects: [],
    alive: player.hp > 0,
  }
}

export function combatantFromPet(pet: Pet): Combatant {
  const def = petDefById(pet.defId)!
  const raw = petStatsForLevel(def, pet.level)
  const tier = affectionTier(pet.affection)
  const meta = AFFECTION_TIER_META[tier]
  const stats = { ...raw }
  ;(Object.keys(stats) as (keyof Stats)[]).forEach((k) => {
    stats[k] = Math.max(1, Math.round(stats[k] * meta.statMult))
  })
  return {
    uid: 'pet',
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
    bonusCrit: meta.critBonus,
    supportChance: meta.supportChance,
    alive: pet.hp > 0,
  }
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
    isTestMonster: def.isTestMonster,
    alive: true,
  }
}

// ─── 전투 초기화 ─────────────────────────────────────────────────────────────

export function initBattle(
  player: PlayerCharacter,
  pet: Pet,
  monsterDefs: MonsterDef[],
  originCell: { x: number; y: number },
  fieldMonsterUid?: string,
  effectiveStats?: Stats,
  /** 동료(kind:'ally') — 파티 순서대로 진형 3·4번 자리에 선다 */
  allies: Combatant[] = [],
  opts: { huntEnabled?: boolean } = {},
): BattleState {
  const hero = combatantFromPlayer(player, effectiveStats)
  const petC = combatantFromPet(pet)
  const enemies = monsterDefs.map(combatantFromMonster)
  const combatants = [hero, petC, ...allies, ...enemies]

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
  }
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
  return c.effects.some((e) => e.kind === 'buff' && e.id === 'lastStand') ? 1 + (c.effects.find((e) => e.id === 'lastStand')!.magnitude ?? 0.3) : 1
}
function takenMult(c: Combatant): number {
  let m = 1
  const ls = c.effects.find((e) => e.kind === 'buff' && e.id === 'lastStand')
  if (ls) m *= 1 + 0.5 * (ls.magnitude ?? 0.3) // 받는 피해 증가는 절반 폭
  const guard = c.effects.find((e) => e.kind === 'buff' && (e.id === 'defendGuard'))
  if (guard) m *= 1 - (guard.magnitude ?? 0.5)
  return m
}

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
  skillElement: ElementOrNeutral,
): DamageResult {
  // 명중 판정
  const hitChance = accuracyFactor(attacker) * (canEvade(defender) ? 1 - evadeChance(defender) : 1)
  if (Math.random() > hitChance) return { amount: 0, isCrit: false, missed: true }

  const atkStat = isMagic ? statWithEffects(attacker, 'matk') : statWithEffects(attacker, 'atk')
  const defStat = isMagic ? statWithEffects(defender, 'mdef') : statWithEffects(defender, 'def')

  // 종족 속성 일치 보너스
  let pw = power
  if (skillElement !== 'neutral' && attacker.element === skillElement) pw *= 1.3

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

function applyStatusRider(
  entries: BattleLogEntry[],
  attacker: Combatant,
  target: Combatant,
  skill: Skill,
) {
  if (!skill.status || !target.alive) return
  const ok = applyStatus(target, skill.status.id, skill.status.chance, skill.status.turns, statWithEffects(attacker, 'matk'))
  if (ok) log(entries, `${target.name}이(가) ${STATUS_DEFS[skill.status.id].name} 상태가 되었다.`, 'status')
}

function damageTarget(
  entries: BattleLogEntry[],
  attacker: Combatant,
  target: Combatant,
  power: number,
  isMagic: boolean,
  element: ElementOrNeutral,
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

export function resolveAction(battle: BattleState, actorUid: string, action: BattleAction): ResolveResult {
  const combatants = cloneCombatants(battle.combatants)
  const entries = [...battle.log]
  const actor = combatants.find((c) => c.uid === actorUid)
  let itemConsumed: string | undefined
  let fled = false

  if (!actor || !actor.alive) return { battle: { ...battle, combatants, log: entries } }

  const find = (uid?: string) => combatants.find((c) => c.uid === uid)

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
    return { battle: { ...battle, combatants, log: entries } }
  }

  if (action.type === 'attack') {
    const target = find(action.targetUid)
    let fx: BattleFx | undefined
    if (target && target.alive) {
      damageTarget(entries, actor, target, 1.0, false, 'neutral', '공격')
      fx = { fxId: nextUid('fx'), sourceUid: actor.uid, targetUids: [target.uid], element: 'neutral', archetype: 'attack', aoe: false, power: 1.0 }
    }
    maybeSupportAttack(entries, combatants, actor)
    return { battle: { ...battle, combatants, log: entries, lastFx: fx } }
  }

  if (action.type === 'skill') {
    const skill = skillById(action.skillId)
    if (!skill) return { battle: { ...battle, combatants, log: entries } }
    if (skillBlocked(actor)) {
      log(entries, `${actor.name}은(는) 침묵 상태라 스킬을 쓸 수 없다!`, 'status')
      return { battle: { ...battle, combatants, log: entries } }
    }
    if (actor.mp < skill.mpCost) {
      log(entries, `MP가 부족하다!`, 'system')
      return { battle: { ...battle, combatants, log: entries } }
    }
    actor.mp -= skill.mpCost
    if (skill.atbCost) actor.atb -= skill.atbCost

    const isMagic = !skill.physical
    const enemyList = combatants.filter((c) => c.side !== actor.side && c.alive)
    const allyList = combatants.filter((c) => c.side === actor.side && c.alive)
    const aoe = skill.targeting === 'allEnemies' || skill.targeting === 'allAllies'
    let fx: BattleFx | undefined

    if (skill.kind === 'attack' || (skill.kind === 'debuff' && skill.power > 0)) {
      const targets =
        skill.targeting === 'allEnemies' ? enemyList : enemyList.filter((c) => c.uid === action.targetUid)
      for (const t of targets) {
        damageTarget(entries, actor, t, skill.power, isMagic, skill.element, `[${skill.name}]`)
        applyStatusRider(entries, actor, t, skill)
      }
      fx = {
        fxId: nextUid('fx'),
        sourceUid: actor.uid,
        targetUids: targets.map((t) => t.uid),
        element: skill.element,
        archetype: isMagic ? 'magicAttack' : 'attack',
        aoe,
        power: skill.power,
        mpCost: skill.mpCost,
      }
    } else if (skill.kind === 'debuff') {
      const targets =
        skill.targeting === 'allEnemies' ? enemyList : enemyList.filter((c) => c.uid === action.targetUid)
      for (const t of targets) applyStatusRider(entries, actor, t, skill)
      log(entries, `${actor.name}의 [${skill.name}]!`)
      fx = {
        fxId: nextUid('fx'),
        sourceUid: actor.uid,
        targetUids: targets.map((t) => t.uid),
        element: skill.element,
        archetype: 'debuff',
        aoe,
        power: skill.power || 1,
        mpCost: skill.mpCost,
      }
    } else if (skill.kind === 'heal') {
      const targets =
        skill.targeting === 'allAllies'
          ? allyList
          : skill.targeting === 'self'
            ? [actor]
            : combatants.filter((c) => c.uid === action.targetUid)
      for (const t of targets) {
        if (skill.reviveHpRatio && !t.alive) {
          t.alive = true
          t.hp = Math.round(t.stats.maxHp * skill.reviveHpRatio)
          log(entries, `${actor.name}의 [${skill.name}]! ${t.name}이(가) 되살아났다!`, 'system')
        } else if (t.alive) {
          const heal = Math.round(statWithEffects(actor, 'matk') * skill.power)
          t.hp = Math.min(t.stats.maxHp, t.hp + heal)
          log(entries, `${actor.name}의 [${skill.name}]! ${t.name}의 HP를 ${heal} 회복했다.`, 'heal')
        }
      }
      fx = {
        fxId: nextUid('fx'),
        sourceUid: actor.uid,
        targetUids: targets.map((t) => t.uid),
        element: skill.element,
        archetype: 'heal',
        aoe,
        power: skill.power || 1,
        mpCost: skill.mpCost,
      }
    } else if (skill.kind === 'buff') {
      const targets = skill.targeting === 'allAllies' ? allyList : [actor]
      for (const t of targets) {
        if (skill.buff) {
          t.effects.push({
            key: nextUid('eff'),
            kind: 'buff',
            id: skill.buff.id,
            name: skill.name,
            turnsLeft: skill.buff.turns,
            magnitude: skill.buff.magnitude,
          })
        }
      }
      log(entries, `${actor.name}의 [${skill.name}]! 효과가 적용되었다.`)
      fx = {
        fxId: nextUid('fx'),
        sourceUid: actor.uid,
        targetUids: targets.map((t) => t.uid),
        element: skill.element,
        archetype: 'buff',
        aoe,
        power: 1,
        mpCost: skill.mpCost,
      }
    } else if (skill.kind === 'utility') {
      const utilTarget = skill.targeting === 'self' ? actor : find(action.targetUid) ?? actor
      if (skill.cleanse) {
        const n = cleanseStatuses(utilTarget)
        log(entries, `${actor.name}의 [${skill.name}]! ${utilTarget.name}의 상태이상 ${n}개를 해제했다.`, n ? 'status' : 'info')
      }
      if (skill.restoreMpRatio) {
        const restored = Math.round(statWithEffects(actor, 'matk') * skill.restoreMpRatio)
        actor.mp = Math.min(actor.stats.maxMp, actor.mp + restored)
        log(entries, `${actor.name}의 [${skill.name}]! MP를 ${restored} 회복했다.`, 'heal')
      }
      fx = {
        fxId: nextUid('fx'),
        sourceUid: actor.uid,
        targetUids: [utilTarget.uid],
        element: skill.element,
        archetype: 'utility',
        aoe: false,
        power: 1,
        mpCost: skill.mpCost,
      }
    }
    return { battle: { ...battle, combatants, log: entries, lastFx: fx } }
  }

  if (action.type === 'item') {
    const item = itemById(action.itemId)
    let fx: BattleFx | undefined
    if (item?.useEffect) {
      itemConsumed = action.itemId
      const target = find(action.targetUid) ?? actor
      fx = { fxId: nextUid('fx'), sourceUid: actor.uid, targetUids: [target.uid], element: 'neutral', archetype: 'item', aoe: false, power: 1 }
      const ue = item.useEffect
      if (ue.healHp) {
        target.hp = Math.min(target.stats.maxHp, target.hp + ue.healHp)
        log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name}의 HP 회복.`, 'heal')
      }
      if (ue.healMp) {
        target.mp = Math.min(target.stats.maxMp, target.mp + ue.healMp)
        log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name}의 MP 회복.`, 'heal')
      }
      if (ue.reviveOnly && !target.alive) {
        target.alive = true
        target.hp = Math.round(target.stats.maxHp * 0.5)
        log(entries, `${actor.name}이(가) [${item.name}] 사용! ${target.name} 부활!`, 'system')
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
    return { battle: { ...battle, combatants, log: entries, lastFx: fx }, itemConsumed, fled }
  }

  return { battle: { ...battle, combatants, log: entries }, itemConsumed, fled }
}

/** 펫 '헌신' 호감도: 히어로/펫 공격 시 확률로 추가 타격 */
function maybeSupportAttack(entries: BattleLogEntry[], combatants: Combatant[], actor: Combatant) {
  const pet = combatants.find((c) => c.kind === 'pet' && c.alive && c.uid !== actor.uid)
  if (!pet || !pet.supportChance || Math.random() > pet.supportChance) return
  const enemies = aliveEnemies(combatants)
  if (enemies.length === 0) return
  const t = enemies[Math.floor(Math.random() * enemies.length)]
  log(entries, `${pet.name}이(가) 지원 공격!`, 'info')
  damageTarget(entries, pet, t, 0.6, pet.element === 'neutral', pet.element, '지원 공격')
}

// ─── 적/펫 자동 행동 ─────────────────────────────────────────────────────────

export function chooseAutoAction(actor: Combatant, combatants: Combatant[]): BattleAction {
  const foes = combatants.filter((c) => c.side !== actor.side && c.alive)
  const allies = combatants.filter((c) => c.side === actor.side && c.alive)
  if (foes.length === 0) return { type: 'defend' }

  // 침묵이 아니고 스킬/MP 여유가 있으면 확률적으로 스킬
  if (!skillBlocked(actor) && actor.skills.length > 0) {
    const usable = actor.skills
      .map((id) => skillById(id))
      .filter((s): s is Skill => !!s && actor.mp >= s.mpCost)
    if (usable.length > 0 && Math.random() < (actor.traits?.includes('caster') ? 0.7 : 0.4)) {
      const s = usable[Math.floor(Math.random() * usable.length)]
      if (s.kind === 'heal' && (s.targeting === 'singleAlly' || s.targeting === 'self')) {
        const hurt = allies.slice().sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
        return { type: 'skill', skillId: s.id, targetUid: hurt?.uid ?? actor.uid }
      }
      if (s.kind === 'buff') return { type: 'skill', skillId: s.id, targetUid: actor.uid }
      const foe = foes[Math.floor(Math.random() * foes.length)]
      return { type: 'skill', skillId: s.id, targetUid: foe.uid }
    }
  }
  const foe = foes[Math.floor(Math.random() * foes.length)]
  return { type: 'attack', targetUid: foe.uid }
}

export function resolveEnemyTurn(battle: BattleState, actorUid: string): BattleState {
  const actor = battle.combatants.find((c) => c.uid === actorUid)
  if (!actor) return battle
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
  const playersAlive = alivePlayers(battle.combatants).length > 0
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
    log(entries, `전투에서 승리했다! 경험치 ${expTotal}, 골드 ${goldTotal} 획득!`, 'system')
    if (drops.length) log(entries, `획득: ${drops.map((id) => itemById(id)?.name ?? id).join(', ')}`, 'system')
    if (huntDrops.length) log(entries, `사냥 부산물: ${huntDrops.map((id) => itemById(id)?.name ?? id).join(', ')}`, 'system')
    return { ...battle, isOver: true, victory: true, log: entries, rewardExp: expTotal, rewardGold: goldTotal, rewardDrops: drops, huntDrops }
  }

  log(entries, `파티가 쓰러졌다... 마법학교로 후송된다.`, 'system')
  return { ...battle, isOver: true, victory: false, log: entries }
}

export { hasStatus }
