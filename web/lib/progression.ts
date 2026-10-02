// ============================================================================
// 학사·생활·동료 진행 로직 — 게임 리듀서(game-state.tsx)가 호출하는 순수 함수 모음.
// 전부 (GameState, ...) → GameState 형태라 리듀서 케이스는 한 줄 위임만 한다.
// ============================================================================

import type { BattleState, GameState, MapId, Position, Stats } from '@/lib/types'
import { calendarInfo, calendarLabel, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import { beatsFor, type StoryTrigger } from '@/lib/story'
import { applyQuestEvents, generateWeeklyQuests, questTemplateById, weekCompletion, yearRewardMult, type QuestEvent } from '@/lib/quests'
import { addCourseScore, settleTerm, skillsFromCourses } from '@/lib/academics'
import {
  ACTIVITY_META,
  activityUnlockWeek,
  gatherNodesForMap,
  isActivityUnlocked,
  isNearWater,
  isNodeReady,
  rollFish,
  rollGather,
  type ActivityId,
} from '@/lib/life'
import { canRecruit, combatantFromCompanion, COMBAT_NPCS, companionStats, COMPANION_SLOTS, createCompanionProgress, npcPetCombatant, schoolNpcById } from '@/lib/companions'
import { addToInventory, hasItem, removeFromInventory } from '@/lib/inventory'
import { applyExp, questExpMult } from '@/lib/exp-table'
import { getEffectiveStats } from '@/lib/derived'
import { itemById, monsterById, SKILLS } from '@/lib/mock-data'
import { computeStatsForLevel, formationError, FORMATION_LIMITS, SKILL_LOADOUT_SIZE } from '@/lib/constants'
import { combatantFromPet, combatantFromPlayer, type PartyMemberInput } from '@/lib/battle-engine'
import { petDefById } from '@/lib/pets'
import { MAPS } from '@/lib/maps'
import { regionOfMap } from '@/lib/regions'

// ─────────────────────────────────────────────────────────────────────────────
// 공용
// ─────────────────────────────────────────────────────────────────────────────
function joinToast(a: string | null | undefined, b: string | null | undefined): string | null {
  if (a && b) return `${a} · ${b}`
  return a || b || null
}

/** 조건 맞는 스토리 비트를 큐에 넣고, 재생 표시 플래그 + setFlags 를 즉시 켠다(재발생 방지 §82-10) */
export function queueBeats(state: GameState, match: (t: StoryTrigger) => boolean, depth = 0): GameState {
  const beats = beatsFor(state, match)
  if (beats.length === 0) return state
  const storyFlags = { ...state.storyFlags }
  const newFlags: string[] = []
  for (const b of beats) {
    storyFlags[`beat:${b.id}`] = true
    for (const f of b.setFlags ?? []) {
      if (!storyFlags[f]) newFlags.push(f)
      storyFlags[f] = true
    }
  }
  let next: GameState = { ...state, storyFlags, storyQueue: [...state.storyQueue, ...beats.map((b) => b.id)] }
  // 켜진 플래그로 이어지는 FLAG 트리거(연쇄는 3단계까지만)
  if (depth < 3 && newFlags.length) next = queueBeats(next, (t) => t.type === 'FLAG' && newFlags.includes(t.flag), depth + 1)
  return next
}

export function setStoryFlag(state: GameState, flag: string, value: boolean | number = true): GameState {
  const was = state.storyFlags[flag]
  const next = refreshSkills({ ...state, storyFlags: { ...state.storyFlags, [flag]: value } })
  if (!was && value) return queueBeats(next, (t) => t.type === 'FLAG' && t.flag === flag)
  return next
}

export function dismissStory(state: GameState): GameState {
  return { ...state, storyQueue: state.storyQueue.slice(1) }
}

/** 스토리 선택지 — 현재 비트를 닫고 고른 쪽 플래그를 켠다(FLAG 트리거로 다음 장면이 이어짐) */
export function chooseStory(state: GameState, flags: string[]): GameState {
  return flags.reduce((s, f) => setStoryFlag(s, f), dismissStory(state))
}

/** 퀘스트 진행 이벤트 적용 + 완료 알림 토스트 */
export function withQuestEvents(state: GameState, events: QuestEvent[], toast?: string | null): GameState {
  if (events.length === 0) return toast !== undefined ? { ...state, toast } : state
  const { weekly, completed } = applyQuestEvents(state.weekly, events)
  const doneMsg = completed.length ? `미션 달성: ${completed.join(', ')}` : null
  return { ...state, weekly, toast: joinToast(toast ?? null, doneMsg) ?? state.toast }
}

// ─────────────────────────────────────────────────────────────────────────────
// 주간 진행 (§66)
// ─────────────────────────────────────────────────────────────────────────────
/** 현재 globalWeek 의 주간 퀘스트가 없으면 생성하고 WEEK_START 비트를 큐잉 */
export function ensureWeek(state: GameState): GameState {
  const gw = state.calendar.globalWeek
  if (state.weekly.week === gw) return state
  const weekly = generateWeeklyQuests(state)
  return queueBeats({ ...state, weekly }, (t) => t.type === 'WEEK_START' && t.week === gw)
}

export function newGameProgress(state: GameState): GameState {
  const playerSeed = Math.floor(Math.random() * 2 ** 31)
  const fresh: GameState = {
    ...state,
    playerSeed,
    calendar: { globalWeek: 1 },
    weekly: { week: 0, quests: [], lastSeen: {} },
    academics: { courseScore: {}, totalCredits: 0, history: [] },
    storyFlags: {},
    storyQueue: [],
    relationships: {},
    companions: { recruited: {}, party: [] },
    formation: { positions: { hero: 'front' } },
    life: { gatheredAt: {} },
    collections: { fish: {}, monsters: {}, gathered: {}, crafted: {} },
    mealBuff: null,
    fishing: null,
  }
  // 1학년 동기(리안·셀라·도란)가 입학과 함께 파티에 들어와 4인 편성을 채운다(§16)
  return refreshSkills(ensureParty(ensureWeek(fresh)))
}

export function claimQuest(state: GameState, instanceId: string): GameState {
  const q = state.weekly.quests.find((x) => x.instanceId === instanceId)
  if (!q || q.status !== 'complete') return state
  const t = questTemplateById(q.templateId)
  if (!t) return state
  const mult = yearRewardMult(state.calendar.globalWeek)
  let next: GameState = {
    ...state,
    weekly: { ...state.weekly, quests: state.weekly.quests.map((x) => (x.instanceId === instanceId ? { ...x, status: 'claimed' as const } : x)) },
  }
  const parts: string[] = []
  for (const r of t.rewards) {
    switch (r.type) {
      case 'EXP': {
        // 같은 보상이 고레벨에서도 의미를 갖도록 레벨 비례(Lv.100 곡선)
        const amount = Math.round(r.amount * mult * questExpMult(next.player.level))
        next = grantHeroExp(next, amount)
        parts.push(`EXP ${amount}`)
        break
      }
      case 'GOLD': {
        const amount = Math.round(r.amount * mult)
        next = { ...next, player: { ...next.player, gold: next.player.gold + amount } }
        parts.push(`${amount}G`)
        break
      }
      case 'ITEM':
        next = { ...next, inventory: addToInventory(next.inventory, r.itemId, r.amount) }
        parts.push(`${itemById(r.itemId)?.name ?? r.itemId} x${r.amount}`)
        break
      case 'COURSE':
        next = { ...next, academics: addCourseScore(next.academics, next.calendar.globalWeek, r.amount, r.courseId) }
        parts.push(`수업 점수 +${r.amount}`)
        break
      case 'RELATIONSHIP':
        next = addAffinity(next, r.npcId, r.amount)
        break
      case 'FLAG':
        next = setStoryFlag(next, r.flag, r.value ?? true)
        break
    }
  }
  next = queueBeats(next, (tr) => tr.type === 'QUEST_CLAIMED' && tr.templateId === t.id)
  const before = next.player.learnedSkills.length
  next = refreshSkills(next)
  const learned = next.player.learnedSkills.slice(before)
  if (learned.length) parts.push(`새 마법: ${skillNames(learned)}`)
  return { ...next, toast: `「${t.title}」 보상 — ${parts.join(', ')}` }
}

/** 주 마감 → 다음 주. force = 관리자/테스트 모드 강제 진행 */
export function endWeek(state: GameState, force = false): GameState {
  const gw = state.calendar.globalWeek
  if (!force && !weekCompletion(state.weekly).canEnd) {
    return { ...state, toast: '필수 미션과 선택 미션 2개의 보상을 받아야 다음 주로 넘어갈 수 있습니다.' }
  }
  if (gw >= TOTAL_WEEKS) return { ...state, toast: '4학년 겨울방학 — 마지막 주입니다. (후일담 구간)' }
  let next = queueBeats(state, (t) => t.type === 'WEEK_END' && t.week === gw)
  const info = calendarInfo(gw)
  const msgs: string[] = []
  if (info.week === WEEKS_PER_TERM) {
    const settled = settleTerm(next.academics, gw)
    next = { ...next, academics: settled.academics }
    if (settled.summary) msgs.push(settled.summary)
  }
  const ngw = gw + 1
  next = { ...next, calendar: { globalWeek: ngw } }
  next = ensureWeek(next)
  const beforeSkills = next.player.learnedSkills.length
  next = ensureParty(refreshSkills(next))
  const newSkills = next.player.learnedSkills.slice(beforeSkills)
  if (newSkills.length) msgs.push(`새 마법 습득: ${skillNames(newSkills)}`)
  // 이번 주에 새로 열린 생활 활동 안내
  const unlocked = (Object.keys(ACTIVITY_META) as ActivityId[]).filter((a) => activityUnlockWeek(a) === ngw)
  if (unlocked.length) msgs.push(`새로 해금: ${unlocked.map((a) => ACTIVITY_META[a].name).join(', ')}`)
  return { ...next, toast: [`${calendarLabel(ngw)} 시작`, ...msgs].join(' · ') }
}

export function adminSetWeek(state: GameState, week: number): GameState {
  const gw = Math.max(1, Math.min(TOTAL_WEEKS, Math.round(week)))
  return ensureParty(refreshSkills(ensureWeek({ ...state, calendar: { globalWeek: gw }, weekly: { ...state.weekly, week: 0 } })))
}

// ─────────────────────────────────────────────────────────────────────────────
// 스킬 습득(§4, §23~24) — 수업·레벨·스토리·아이템 조건. 전직 없음.
// ─────────────────────────────────────────────────────────────────────────────
/** 조건을 모두 만족한 학생 스킬 목록 */
export function earnedSkillIds(state: GameState): string[] {
  const fromCourses = new Set(skillsFromCourses(state.academics, state.calendar.globalWeek))
  const unlockAll = !!state.storyFlags.DEBUG_UNLOCK_ALL
  return SKILLS.filter((s) => {
    if (s.owner || !s.learnRequirements?.length) return false // 펫·모르스 전용, 수업 외 스킬
    return s.learnRequirements.every((r) => {
      switch (r.type) {
        case 'course':
          return unlockAll || fromCourses.has(s.id)
        case 'level':
          return state.player.level >= r.level
        case 'storyFlag':
          return !!state.storyFlags[r.id]
        case 'item':
          return hasItem(state.inventory, r.id)
      }
    })
  }).map((s) => s.id)
}

/**
 * 배운 스킬 갱신 — 새로 배운 스킬은 장착 슬롯이 남아 있으면 자동 장착.
 * 이미 배운 스킬은 잃지 않는다(펫·모르스 전용처럼 학생이 가질 수 없는 스킬만 걸러낸다).
 */
export function refreshSkills(state: GameState): GameState {
  const valid = (id: string) => {
    const s = SKILLS.find((x) => x.id === id)
    return !!s && !s.owner
  }
  const learned = state.player.learnedSkills.filter(valid)
  const add = earnedSkillIds(state).filter((id) => !learned.includes(id))
  const learnedSkills = [...learned, ...add]
  const equipped = state.player.equippedSkills.filter((id) => learnedSkills.includes(id))
  for (const id of add) if (equipped.length < SKILL_LOADOUT_SIZE) equipped.push(id)
  if (add.length === 0 && learnedSkills.length === state.player.learnedSkills.length && equipped.length === state.player.equippedSkills.length) return state
  return { ...state, player: { ...state.player, learnedSkills, equippedSkills: equipped } }
}

/** 스킬 장착/해제 */
export function toggleEquipSkill(state: GameState, skillId: string): GameState {
  const { learnedSkills, equippedSkills } = state.player
  if (!learnedSkills.includes(skillId)) return state
  if (equippedSkills.includes(skillId)) return { ...state, player: { ...state.player, equippedSkills: equippedSkills.filter((id) => id !== skillId) } }
  if (equippedSkills.length >= SKILL_LOADOUT_SIZE) return { ...state, toast: `전투 스킬은 최대 ${SKILL_LOADOUT_SIZE}개까지 장착할 수 있습니다.` }
  return { ...state, player: { ...state.player, equippedSkills: [...equippedSkills, skillId] } }
}

function skillNames(ids: string[]): string {
  return ids.map((id) => SKILLS.find((s) => s.id === id)?.name ?? id).join(', ')
}

// ─────────────────────────────────────────────────────────────────────────────
// 관계 · 대화 · 방문
// ─────────────────────────────────────────────────────────────────────────────
export function addAffinity(state: GameState, id: string, amount: number): GameState {
  const cur = state.relationships[id] ?? { affinity: 0, lastTalkWeek: 0 }
  const affinity = Math.max(0, Math.min(100, cur.affinity + amount))
  return { ...state, relationships: { ...state.relationships, [id]: { ...cur, affinity } } }
}

/** NPC 대화 — 주 1회 관계도 +2, TALK 퀘스트 이벤트 */
export function talkTo(state: GameState, npcId: string): GameState {
  const gw = state.calendar.globalWeek
  const cur = state.relationships[npcId] ?? { affinity: 0, lastTalkWeek: 0 }
  let next = state
  if (cur.lastTalkWeek !== gw) {
    next = {
      ...next,
      relationships: { ...next.relationships, [npcId]: { affinity: Math.min(100, cur.affinity + 2), lastTalkWeek: gw } },
    }
  }
  return withQuestEvents(next, [{ type: 'TALK', npcId }])
}

export function visitMap(state: GameState, mapId: MapId): GameState {
  const next = queueBeats(state, (t) => t.type === 'VISIT' && t.mapId === mapId)
  return withQuestEvents(next, [{ type: 'VISIT', mapId }], next.toast)
}

// ─────────────────────────────────────────────────────────────────────────────
// 채집 · 낚시 (§33, §35)
// ─────────────────────────────────────────────────────────────────────────────
export function gatherAt(state: GameState, nodeKey: string): GameState {
  if (!isActivityUnlocked(state, 'gathering')) return { ...state, toast: '채집은 아직 할 수 없습니다.' }
  const map = MAPS[state.currentMapId]
  const node = gatherNodesForMap(map).find((n) => n.key === nodeKey)
  if (!node || !isNodeReady(state.life, nodeKey)) return state
  if (Math.hypot(node.cell.x - state.position.x, node.cell.y - state.position.y) > 1.6) return state
  const got = rollGather(state.currentMapId, node.kind, hasItem(state.inventory, 'tool-gather-sickle'))
  let inventory = state.inventory
  const gathered = { ...state.collections.gathered }
  for (const g of got) {
    inventory = addToInventory(inventory, g.itemId, g.qty)
    gathered[g.itemId] = (gathered[g.itemId] ?? 0) + g.qty
  }
  const next: GameState = {
    ...state,
    inventory,
    life: { ...state.life, gatheredAt: { ...state.life.gatheredAt, [nodeKey]: Date.now() } },
    collections: { ...state.collections, gathered },
  }
  const label = got.map((g) => `${itemById(g.itemId)?.name ?? g.itemId} x${g.qty}`).join(', ')
  return withQuestEvents(next, got.map((g) => ({ type: 'GATHER' as const, itemId: g.itemId, qty: g.qty })), `채집: ${label}`)
}

export function startFishing(state: GameState): GameState {
  if (!isActivityUnlocked(state, 'fishing')) return { ...state, toast: `낚시는 ${ACTIVITY_META.fishing.year}학년 겨울방학에 해금됩니다.` }
  const hasRod = hasItem(state.inventory, 'tool-rod-basic') || hasItem(state.inventory, 'tool-rod-silver')
  if (!hasRod) return { ...state, toast: '낚싯대가 필요합니다. (별빛 상점가 만물상 토비)' }
  if (!isNearWater(MAPS[state.currentMapId], state.position)) return { ...state, toast: '물가에서만 낚시할 수 있습니다.' }
  const roll = rollFish(state.currentMapId, hasItem(state.inventory, 'tool-rod-silver'))
  return { ...state, fishing: { fishId: roll.fishId, difficulty: roll.difficulty } }
}

export function resolveFishing(state: GameState, success: boolean): GameState {
  if (!state.fishing) return state
  const { fishId } = state.fishing
  if (!success) return { ...state, fishing: null, toast: '물고기가 도망갔다…' }
  const next: GameState = {
    ...state,
    fishing: null,
    inventory: addToInventory(state.inventory, fishId, 1),
    collections: { ...state.collections, fish: { ...state.collections.fish, [fishId]: (state.collections.fish[fishId] ?? 0) + 1 } },
  }
  return withQuestEvents(next, [{ type: 'FISH', fishId }], `${itemById(fishId)?.name ?? fishId}을(를) 낚았다!`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 요리 버프 (§36)
// ─────────────────────────────────────────────────────────────────────────────
export function eatFood(state: GameState, itemId: string): GameState {
  const item = itemById(itemId)
  if (!item || item.type !== 'food' || !hasItem(state.inventory, itemId)) return state
  const eff = getEffectiveStats(state.player)
  const hp = Math.min(eff.maxHp, state.player.hp + (item.useEffect?.healHp ?? 0))
  const mp = Math.min(eff.maxMp, state.player.mp + (item.useEffect?.healMp ?? 0))
  return {
    ...state,
    player: { ...state.player, hp, mp },
    inventory: removeFromInventory(state.inventory, itemId, 1),
    mealBuff: item.mealBuff ? { itemId, battlesLeft: item.mealBuff.battles } : state.mealBuff,
    toast: item.mealBuff ? `${item.name}을(를) 먹었다 — ${item.mealBuff.battles}전투 동안 버프` : `${item.name}을(를) 먹었다.`,
  }
}

/** 장비 + 식사 버프 반영 스탯(전투 진입용) */
export function battleStats(state: GameState): Stats {
  const eff = getEffectiveStats(state.player)
  const buff = state.mealBuff ? itemById(state.mealBuff.itemId)?.mealBuff : null
  if (!buff) return eff
  const out = { ...eff }
  for (const k of Object.keys(buff.statPct) as (keyof Stats)[]) out[k] = Math.round(out[k] * (1 + (buff.statPct[k] ?? 0)))
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 파티 · 진형 · 펫 귀속 (PRD v2.0 §16~20)
//   핵심 전투원 = 주인공 + 학교 NPC 3명. 펫은 전위 캐릭터에게만 귀속.
//   주인공은 보유 펫 중 1마리(state.pet), NPC 는 각자 고정 펫.
// ─────────────────────────────────────────────────────────────────────────────
export function recruitCompanion(state: GameState, id: string): GameState {
  const def = schoolNpcById(id)
  if (!def || state.companions.recruited[id]) return state
  const check = canRecruit(state, def)
  if (!check.ok) return { ...state, toast: check.reason ?? '아직 합류할 수 없습니다.' }
  const recruited = { ...state.companions.recruited, [id]: createCompanionProgress(def, state.player.level) }
  const party = state.companions.party.length < COMPANION_SLOTS ? [...state.companions.party, id] : state.companions.party
  const next = normalizeFormation({ ...state, companions: { recruited, party } })
  return { ...next, toast: `${def.name}이(가) 파티에 합류했다!` }
}

/** 파티 편성 — 파티에 없으면 넣고(빈 자리가 있을 때), 있으면 뺀다(대기 동료가 있어야 4인 유지) */
export function togglePartyMember(state: GameState, id: string): GameState {
  if (!state.companions.recruited[id]) return state
  const inParty = state.companions.party.includes(id)
  if (inParty) {
    const bench = Object.keys(state.companions.recruited).filter((x) => !state.companions.party.includes(x))
    if (bench.length === 0) return { ...state, toast: '4인 편성을 유지해야 합니다. 대기 중인 동료와 교체하세요.' }
    return normalizeFormation({ ...state, companions: { ...state.companions, party: state.companions.party.filter((p) => p !== id) } })
  }
  if (state.companions.party.length >= COMPANION_SLOTS) return { ...state, toast: `동료는 최대 ${COMPANION_SLOTS}명입니다. 교체할 자리를 먼저 고르세요.` }
  return normalizeFormation({ ...state, companions: { ...state.companions, party: [...state.companions.party, id] } })
}

/** 파티 슬롯 교체 — slot 자리의 동료를 대기 동료 id 로 바꾼다(포지션은 물려받는다) */
export function swapPartyMember(state: GameState, slot: number, id: string): GameState {
  if (!state.companions.recruited[id] || state.companions.party.includes(id)) return state
  const party = [...state.companions.party]
  const outgoing = party[slot]
  if (outgoing) party[slot] = id
  else party.push(id)
  const positions = { ...state.formation.positions }
  if (outgoing && positions[outgoing]) {
    positions[id] = positions[outgoing]
    delete positions[outgoing]
  }
  return normalizeFormation({ ...state, companions: { ...state.companions, party: party.slice(0, COMPANION_SLOTS) }, formation: { positions } })
}

/** 파티원 id 목록(주인공 'hero' 포함, 최대 4) */
export function partyMemberIds(state: Pick<GameState, 'companions'>): string[] {
  return ['hero', ...state.companions.party.slice(0, COMPANION_SLOTS)]
}

/** 포지션 변경 — 인원 제한(전위 1~2 · 후위 1~2 · 보조 0~1)을 어기면 거절 */
export function setMemberPosition(state: GameState, memberId: string, position: Position): GameState {
  const ids = partyMemberIds(state)
  if (!ids.includes(memberId)) return state
  const positions = { ...state.formation.positions, [memberId]: position }
  const err = formationError(ids.map((id) => positions[id] ?? 'rear'))
  if (err) return { ...state, toast: err }
  return { ...state, formation: { positions } }
}

/**
 * 진형 정리 — 파티원 모두에게 포지션을 주고 인원 제한을 맞춘다.
 * 기존 배치를 최대한 유지하고, 넘치는 자리는 남는 자리로 옮긴다.
 */
export function normalizeFormation(state: GameState): GameState {
  const ids = partyMemberIds(state)
  const positions: Record<string, Position> = {}
  for (const id of ids) {
    positions[id] = state.formation.positions[id] ?? (id === 'hero' ? 'front' : schoolNpcById(id)?.combat?.defaultPosition ?? 'rear')
  }
  const order: Position[] = ['front', 'rear', 'support']
  const count = () => {
    const c: Record<Position, number> = { front: 0, rear: 0, support: 0 }
    for (const id of ids) c[positions[id]] += 1
    return c
  }
  // 1) 최대치 초과 → 다른 자리로(주인공은 마지막에 옮긴다)
  for (const p of order) {
    while (count()[p] > FORMATION_LIMITS[p].max) {
      const mover = [...ids].reverse().find((id) => positions[id] === p && id !== 'hero') ?? ids.find((id) => positions[id] === p)!
      positions[mover] = order.find((q) => q !== p && count()[q] < FORMATION_LIMITS[q].max) ?? 'rear'
    }
  }
  // 2) 최소치 미달(전위 1명 이상 · 2인 이상이면 후위 1명 이상) → 여유 있는 자리에서 데려온다
  const mins: Position[] = ids.length >= 2 ? ['front', 'rear'] : ['front']
  for (const p of mins) {
    if (count()[p] >= FORMATION_LIMITS[p].min) continue
    const donor = order.filter((q) => q !== p).sort((a, b) => count()[b] - count()[a])[0]
    const mover = [...ids].reverse().find((id) => positions[id] === donor && id !== 'hero') ?? ids.find((id) => positions[id] === donor)
    if (mover) positions[mover] = p
  }
  return { ...state, formation: { positions } }
}

/**
 * 파티 보장 — 합류 가능한 1학년 동기를 자동 합류시키고, 빈 자리는 대기 동료로 채운다(4인 유지).
 */
export function ensureParty(state: GameState): GameState {
  let next = state
  for (const def of COMBAT_NPCS) {
    if (!def.starter || next.companions.recruited[def.id]) continue
    if (!canRecruit(next, def).ok) continue
    next = {
      ...next,
      companions: { ...next.companions, recruited: { ...next.companions.recruited, [def.id]: createCompanionProgress(def, next.player.level) } },
    }
  }
  const party = next.companions.party.filter((id) => !!next.companions.recruited[id] && !!schoolNpcById(id)?.combat)
  for (const id of Object.keys(next.companions.recruited)) {
    if (party.length >= COMPANION_SLOTS) break
    if (!party.includes(id) && schoolNpcById(id)?.combat) party.push(id)
  }
  return normalizeFormation({ ...next, companions: { ...next.companions, party } })
}

/**
 * 전투 파티 구성 — 핵심 전투원 + 포지션 + 펫(주인공 = 선택 펫, NPC = 고정 펫).
 * 펫은 battle-engine.initBattle 에서 주인이 전위일 때만 실제로 참가한다.
 */
export function battleParty(state: GameState): PartyMemberInput[] {
  const pos = (id: string): Position => state.formation.positions[id] ?? 'rear'
  const weapon = state.player.equipped.weapon ? itemById(state.player.equipped.weapon)?.weaponElement : undefined
  const hero = combatantFromPlayer(state.player, battleStats(state), weapon)
  const heroPet = petDefById(state.pet.defId) ? combatantFromPet(state.pet, 'hero') : null
  const members: PartyMemberInput[] = [{ combatant: hero, position: pos('hero'), pet: heroPet }]
  for (const id of state.companions.party.slice(0, COMPANION_SLOTS)) {
    const def = schoolNpcById(id)
    const prog = state.companions.recruited[id]
    if (!def?.combat || !prog) continue
    const c = combatantFromCompanion(def, prog)
    members.push({ combatant: c, position: pos(id), pet: npcPetCombatant(def, prog.level, c.uid) })
  }
  return members
}

/** 전투가 끝난 뒤 동료 HP/MP 를 전투 결과로 되돌려 적는다(쓰러졌으면 1). 보조 포지션 HP 보너스는 비율로 환산 */
function syncCompanionsFromBattle(state: GameState, battle: BattleState, ratioOnDefeat?: number): GameState {
  const recruited = { ...state.companions.recruited }
  for (const c of battle.combatants) {
    if (c.kind !== 'ally') continue
    const prog = recruited[c.refId]
    const def = schoolNpcById(c.refId)
    if (!prog || !def) continue
    const baseMax = companionStats(def, prog.level).maxHp
    const ratio = ratioOnDefeat != null ? ratioOnDefeat : c.hp / Math.max(1, c.stats.maxHp)
    const hp = Math.max(1, Math.min(baseMax, Math.round(baseMax * ratio)))
    recruited[c.refId] = { ...prog, hp, mp: c.mp }
  }
  return { ...state, companions: { ...state.companions, recruited } }
}

export function healCompanions(state: GameState): GameState {
  const recruited = { ...state.companions.recruited }
  for (const [id, prog] of Object.entries(recruited)) {
    const def = schoolNpcById(id)
    if (!def) continue
    const s = companionStats(def, prog.level)
    recruited[id] = { ...prog, hp: s.maxHp, mp: s.maxMp }
  }
  return { ...state, companions: { ...state.companions, recruited } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 전투 종료 후처리 — 리듀서의 기존 승리/패배 처리 "다음에" 호출
// ─────────────────────────────────────────────────────────────────────────────
/** 퀘스트 보상 경험치 — 레벨업 시 전투 승리 경로와 같은 규칙으로 스탯·스킬 갱신 */
export function grantHeroExp(state: GameState, amount: number): GameState {
  const r = applyExp(state.player.level, state.player.exp, amount)
  if (!r.leveledUp) return { ...state, player: { ...state.player, exp: r.newExp } }
  const stats = computeStatsForLevel(r.newLevel)
  return refreshSkills({
    ...state,
    player: { ...state.player, level: r.newLevel, exp: r.newExp, stats, hp: stats.maxHp, mp: stats.maxMp },
  })
}

export function afterBattleVictory(state: GameState, battle: BattleState): GameState {
  let next = syncCompanionsFromBattle(state, battle)
  const expGain = battle.rewardExp ?? 0
  // 동료 경험치 — 주인공과 같은 양(파티에 있던 동료만)
  const recruited = { ...next.companions.recruited }
  for (const c of battle.combatants) {
    if (c.kind !== 'ally' || !recruited[c.refId]) continue
    const prog = recruited[c.refId]
    const r = applyExp(prog.level, prog.exp, expGain)
    if (r.leveledUp) {
      const def = schoolNpcById(c.refId)!
      const s = companionStats(def, r.newLevel)
      recruited[c.refId] = { level: r.newLevel, exp: r.newExp, hp: s.maxHp, mp: s.maxMp }
    } else {
      recruited[c.refId] = { ...prog, exp: r.newExp }
    }
    next = addAffinity(next, c.refId, 1)
  }
  next = { ...next, companions: { ...next.companions, recruited } }

  // 펫 경험치 — 이번 전투에 실제로 참가했을 때(주인공이 전위)만(§20, §22)
  const heroPetFought = battle.combatants.some((c) => c.uid === 'pet')
  const petR = applyExp(next.pet.level, next.pet.exp, heroPetFought ? expGain : 0)
  if (heroPetFought && (petR.newLevel !== next.pet.level || petR.newExp !== next.pet.exp)) {
    const pet = { ...next.pet, level: petR.newLevel, exp: petR.newExp }
    next = { ...next, pet, ownedPets: next.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)) }
  }

  // 사냥 부산물
  let inventory = next.inventory
  for (const id of battle.huntDrops ?? []) inventory = addToInventory(inventory, id, 1)

  // 도감 + 퀘스트 이벤트
  const monsters = { ...next.collections.monsters }
  const events: QuestEvent[] = []
  for (const c of battle.combatants) {
    if (c.side !== 'enemy') continue
    const def = monsterById(c.refId)
    if (!def || def.isTestMonster) continue
    monsters[def.id] = (monsters[def.id] ?? 0) + 1
    events.push({ type: 'KILL', monsterId: def.id, family: def.family })
  }
  events.push({ type: 'WIN_BATTLE', regionId: regionOfMap(next.currentMapId) })
  for (const id of battle.huntDrops ?? []) events.push({ type: 'HUNT', itemId: id, qty: 1 })

  const mealBuff = next.mealBuff && next.mealBuff.battlesLeft > 1 ? { ...next.mealBuff, battlesLeft: next.mealBuff.battlesLeft - 1 } : null
  next = { ...next, inventory, mealBuff, collections: { ...next.collections, monsters } }
  // 전투 승리 스토리 비트(보스 처치 후 장면 등)
  const defeated = new Set(battle.combatants.filter((c) => c.side === 'enemy').map((c) => c.refId))
  const mapId = next.currentMapId
  next = queueBeats(next, (t) => t.type === 'DEFEAT' && (!t.monsterId || defeated.has(t.monsterId)) && (!t.mapId || t.mapId === mapId))
  return withQuestEvents(next, events, next.toast)
}

export function afterBattleDefeat(state: GameState, battle: BattleState): GameState {
  const next = syncCompanionsFromBattle(state, battle, 0.2)
  const mealBuff = next.mealBuff && next.mealBuff.battlesLeft > 1 ? { ...next.mealBuff, battlesLeft: next.mealBuff.battlesLeft - 1 } : null
  return { ...next, mealBuff }
}

export function afterBattleFled(state: GameState, battle: BattleState | null): GameState {
  return battle ? syncCompanionsFromBattle(state, battle) : state
}
