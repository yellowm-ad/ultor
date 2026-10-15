// 천공 콜로세움 — 게임 쪽(팀 스냅숏 만들기·대전 시작). 형식·검증·점수는 lib/arena-core.ts
import type { BattleState, Combatant, GameState, Position } from '@/lib/types'
import { applyPosition, initBattle } from '@/lib/battle-engine'
import { battleParty, ensureParty } from '@/lib/progression'
import { ARENA_NAME_MAX, teamPower, type ArenaIdentity, type ArenaMatch, type ArenaTeam, type ArenaUnit } from '@/lib/arena-core'

export * from '@/lib/arena-core'

const rid = (n: number) => {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}
export const newArenaIdentity = (): ArenaIdentity => ({ pid: rid(8), token: rid(16) })

const unitOf = (c: Combatant, position?: Position): ArenaUnit => ({
  kind: c.kind === 'hero' ? 'hero' : c.kind === 'pet' ? 'pet' : 'ally',
  refId: c.refId,
  name: c.name,
  icon: c.icon,
  element: c.element,
  level: c.level,
  stats: { ...c.stats },
  skills: [...c.skills],
  ...(position ? { position } : {}),
  ...(c.weaponElement ? { weaponElement: c.weaponElement } : {}),
  ...(c.appearance ? { appearance: c.appearance } : {}),
  ...(c.aiProfile ? { aiProfile: c.aiProfile } : {}),
})

/** 지금 파티로 팀 스냅숏 — 주인공 + 파티 동료(임시 NPC 제외) + 펫 */
export function buildArenaTeam(state: GameState, pid: string): ArenaTeam {
  const ready = ensureParty(state)
  const members = battleParty(ready).filter((m) => !m.combatant.guest)
  const gender = state.player.appearance.gender
  const units: ArenaUnit[] = []
  for (const m of members) {
    const u = unitOf(m.combatant, m.position)
    // 상대 화면에서 주인공은 "다른 사람" — 성별 히어로 시트로 그린다(pixel-hero playerSheet 와 같은 이름)
    if (u.kind === 'hero') u.appearance = { kind: 'hero', sheet: `protag-${gender}` }
    units.push(u)
    if (m.pet) units.push(unitOf(m.pet))
  }
  return {
    pid,
    name: (state.player.name || '이름 없는 견습생').slice(0, ARENA_NAME_MAX),
    gender,
    level: state.player.level,
    units,
    power: teamPower(units),
    updatedAt: Date.now(),
  }
}

let arenaUid = 0
/** 상대 팀 → 적 전투원. 주인공·동료는 사람(ally)으로, 펫은 몬스터처럼 싸운다(즉사 면역 위해 엘리트 취급) */
function enemyFromUnit(u: ArenaUnit): Combatant {
  arenaUid += 1
  const base: Combatant = {
    uid: `rival-${arenaUid}`,
    side: 'enemy',
    kind: u.kind === 'pet' ? 'monster' : 'ally',
    refId: u.refId,
    name: u.name,
    icon: u.icon,
    element: u.element,
    level: u.level,
    stats: { ...u.stats },
    hp: u.stats.maxHp,
    mp: u.stats.maxMp,
    skills: [...u.skills],
    atb: Math.random() * 20,
    effects: [],
    aiProfile: u.aiProfile ?? (u.kind === 'pet' ? 'melee' : 'random'),
    rank: u.kind === 'pet' ? 'elite' : undefined,
    rival: true,
    ...(u.weaponElement ? { weaponElement: u.weaponElement } : {}),
    ...(u.appearance ? { appearance: u.appearance } : {}),
    alive: true,
  }
  return u.position ? applyPosition(base, u.position) : base
}

/** 대전 시작 — 내 파티는 꽉 찬 HP·MP 로(콜로세움은 치료해 주고 내보낸다), 상대는 스냅숏 그대로 */
export function initArenaBattle(state: GameState, opponent: ArenaTeam, match: ArenaMatch): BattleState {
  const ready = ensureParty(state)
  const party = battleParty(ready)
    .filter((m) => !m.combatant.guest)
    .map((m) => ({
      ...m,
      combatant: { ...m.combatant, hp: m.combatant.stats.maxHp, mp: m.combatant.stats.maxMp, alive: true },
      pet: m.pet ? { ...m.pet, hp: m.pet.stats.maxHp, mp: m.pet.stats.maxMp, alive: true } : m.pet,
    }))
  const battle = initBattle(party, [], state.position)
  const enemies = opponent.units.slice(0, 6).map(enemyFromUnit)
  return {
    ...battle,
    combatants: [...battle.combatants, ...enemies],
    log: [{ id: `log-arena-${arenaUid}`, text: `천공 콜로세움 — ${opponent.name}의 팀과 맞붙는다!`, kind: 'system' }],
    pvp: match,
  }
}

