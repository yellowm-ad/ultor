// ============================================================================
// 학사·생활·동료 진행 로직 — 게임 리듀서(game-state.tsx)가 호출하는 순수 함수 모음.
// 전부 (GameState, ...) → GameState 형태라 리듀서 케이스는 한 줄 위임만 한다.
// ============================================================================

import type { BattleState, Combatant, GameState, MapId, Stats } from '@/lib/types'
import { calendarInfo, calendarLabel, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import { beatsFor, type StoryTrigger } from '@/lib/story'
import { applyQuestEvents, generateWeeklyQuests, questTemplateById, weekCompletion, yearRewardMult, type QuestEvent } from '@/lib/quests'
import { addCourseScore, settleTerm } from '@/lib/academics'
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
import { canRecruit, combatantFromCompanion, companionById, companionStats, COMPANION_SLOTS, createCompanionProgress } from '@/lib/companions'
import { addToInventory, hasItem, removeFromInventory } from '@/lib/inventory'
import { applyExp } from '@/lib/exp-table'
import { getEffectiveStats } from '@/lib/derived'
import { autoLearnSkillIds, itemById, monsterById } from '@/lib/mock-data'
import { computeStatsForLevel, JOB_TIER_ORDER } from '@/lib/constants'
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
  const next = { ...state, storyFlags: { ...state.storyFlags, [flag]: value } }
  if (!was && value) return queueBeats(next, (t) => t.type === 'FLAG' && t.flag === flag)
  return next
}

export function dismissStory(state: GameState): GameState {
  return { ...state, storyQueue: state.storyQueue.slice(1) }
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
    life: { gatheredAt: {} },
    collections: { fish: {}, monsters: {}, gathered: {}, crafted: {} },
    mealBuff: null,
    fishing: null,
  }
  return ensureWeek(fresh)
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
        const amount = Math.round(r.amount * mult)
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
  // 이번 주에 새로 열린 생활 활동 안내
  const unlocked = (Object.keys(ACTIVITY_META) as ActivityId[]).filter((a) => activityUnlockWeek(a) === ngw)
  if (unlocked.length) msgs.push(`새로 해금: ${unlocked.map((a) => ACTIVITY_META[a].name).join(', ')}`)
  return { ...next, toast: [`${calendarLabel(ngw)} 시작`, ...msgs].join(' · ') }
}

export function adminSetWeek(state: GameState, week: number): GameState {
  const gw = Math.max(1, Math.min(TOTAL_WEEKS, Math.round(week)))
  return ensureWeek({ ...state, calendar: { globalWeek: gw }, weekly: { ...state.weekly, week: 0 } })
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
// 동료 (§63 · 4대4)
// ─────────────────────────────────────────────────────────────────────────────
export function recruitCompanion(state: GameState, id: string): GameState {
  const def = companionById(id)
  if (!def || state.companions.recruited[id]) return state
  const check = canRecruit(state, def)
  if (!check.ok) return { ...state, toast: check.reason ?? '아직 합류할 수 없습니다.' }
  const recruited = { ...state.companions.recruited, [id]: createCompanionProgress(def, state.player.level) }
  const party = state.companions.party.length < COMPANION_SLOTS ? [...state.companions.party, id] : state.companions.party
  return { ...state, companions: { recruited, party }, toast: `${def.name}이(가) 동료로 합류했다!` }
}

export function togglePartyMember(state: GameState, id: string): GameState {
  if (!state.companions.recruited[id]) return state
  const inParty = state.companions.party.includes(id)
  if (inParty) return { ...state, companions: { ...state.companions, party: state.companions.party.filter((p) => p !== id) } }
  if (state.companions.party.length >= COMPANION_SLOTS) return { ...state, toast: `동료는 최대 ${COMPANION_SLOTS}명까지 데려갈 수 있습니다.` }
  return { ...state, companions: { ...state.companions, party: [...state.companions.party, id] } }
}

export function partyAllies(state: GameState): Combatant[] {
  return state.companions.party.flatMap((id) => {
    const def = companionById(id)
    const prog = state.companions.recruited[id]
    return def && prog ? [combatantFromCompanion(def, prog)] : []
  })
}

/** 전투가 끝난 뒤 동료 HP/MP 를 전투 결과로 되돌려 적는다(쓰러졌으면 1) */
function syncCompanionsFromBattle(state: GameState, battle: BattleState, ratioOnDefeat?: number): GameState {
  const recruited = { ...state.companions.recruited }
  for (const c of battle.combatants) {
    if (c.kind !== 'ally') continue
    const prog = recruited[c.refId]
    if (!prog) continue
    const hp = ratioOnDefeat != null ? Math.max(1, Math.round(c.stats.maxHp * ratioOnDefeat)) : Math.max(1, c.hp)
    recruited[c.refId] = { ...prog, hp, mp: c.mp }
  }
  return { ...state, companions: { ...state.companions, recruited } }
}

export function healCompanions(state: GameState): GameState {
  const recruited = { ...state.companions.recruited }
  for (const [id, prog] of Object.entries(recruited)) {
    const def = companionById(id)
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
function grantHeroExp(state: GameState, amount: number): GameState {
  const r = applyExp(state.player.level, state.player.exp, amount)
  if (!r.leveledUp) return { ...state, player: { ...state.player, exp: r.newExp } }
  const stats = computeStatsForLevel(state.player.element, r.newLevel)
  const learned = autoLearnSkillIds(state.player.element, r.newLevel, JOB_TIER_ORDER.indexOf(state.player.jobTierId))
  return {
    ...state,
    player: {
      ...state.player,
      level: r.newLevel,
      exp: r.newExp,
      stats,
      hp: stats.maxHp,
      mp: stats.maxMp,
      learnedSkills: Array.from(new Set([...state.player.learnedSkills, ...learned])),
    },
  }
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
      const def = companionById(c.refId)!
      const s = companionStats(def, r.newLevel)
      recruited[c.refId] = { level: r.newLevel, exp: r.newExp, hp: s.maxHp, mp: s.maxMp }
    } else {
      recruited[c.refId] = { ...prog, exp: r.newExp }
    }
    next = addAffinity(next, c.refId, 1)
  }
  next = { ...next, companions: { ...next.companions, recruited } }

  // 펫 경험치(기존엔 펫 레벨이 오르지 않았음)
  const petR = applyExp(next.pet.level, next.pet.exp, expGain)
  if (petR.newLevel !== next.pet.level || petR.newExp !== next.pet.exp) {
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
