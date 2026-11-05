'use client'

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type {
  BattleAction as EngineBattleAction,
  EquipSlot,
  GameState,
  MapId,
  PlayerAppearance,
  Portal,
  Position,
  ScreenId,
} from '@/lib/types'
import { MAX_ENEMIES, MAX_PARTY_SIZE, computeStatsForLevel } from '@/lib/constants'
import { BLACK_DRAGON_ID, DRAGON_FLAGS, DRAGON_ROUNDS, dragonInReach } from '@/lib/black-dragon'
import { TRIAL_MIN_LEVEL, trialByEl, trialKey, trialReady, trialState } from '@/lib/guild-trials'
import { MAPS, zoneAt } from '@/lib/maps'
import { ARENA_MAP_ID, initArenaBattle, type ArenaIdentity, type ArenaMatch, type ArenaTeam } from '@/lib/arena'
import { beatById } from '@/lib/story'
import { teleportBlockReason } from '@/lib/teleport'
import { FURNITURE_BY_ID, furnitureFitReason, furnitureHalf } from '@/lib/housing'
import { baseCostumeOf, costumeById, COSTUMES, emptyWardrobe, ownsCostume } from '@/lib/costumes'
import { mapLockReason, passageFlag, passageFor } from '@/lib/passages'
import { activitySpotById, ARCADE_REWARD_GOLD } from '@/lib/activity-spots'
import { FACING_CELL_VEC, facingFromCellDelta } from '@/lib/iso'
import { ITEMS, MONSTERS, NPCS, SKILLS, isBossRank, isStudentSkill, itemById, monsterById, npcById, recipeById, skillById } from '@/lib/mock-data'
import { MAX_LEVEL } from '@/lib/exp-table'
import { createInitialGameState, createPlayer } from '@/lib/player-factory'
import { defeatKey, generateFieldMonsters, pruneDefeats, wanderState } from '@/lib/field'
import { monsterView } from '@/lib/monster-charge'
import { getEffectiveStats } from '@/lib/derived'
import { enhanceCost, enhanceOnce, gearName, gearOf, isEnhanceable, ENHANCE_MAX } from '@/lib/gear-enhance'
import {
  advanceTurn,
  awaitsPlayerInput,
  checkBattleEnd,
  currentActor,
  initBattle,
  SANDBAG_HP,
  resolveAction,
  resolveEnemyTurn,
  tickAtb,
} from '@/lib/battle-engine'
import { addToInventory, consumeIngredients, removeFromInventory } from '@/lib/inventory'
import { finalOpen, hubById, repFinal, repLevel, repLevelName, repPoints, reqDoneKey, requestBlocker, weeklyRequests } from '@/lib/reputation'
import { ACTIVITY_META, activityUnlockLabel, gatherNodesForMap, isActivityUnlocked, isNearWater, isNodeReady, RECIPE_CATEGORY_ACTIVITY } from '@/lib/life'
import { fieldSpellById, isInvisible, PULL_RANGE, type FieldSpellId } from '@/lib/field-spells'
import { CACHE_NEAR, cacheFlag, cacheReward, cachesForMap, isCacheOpened } from '@/lib/hidden-caches'
import {
  adminSetWeek,
  afterBattleDefeat,
  afterBattleFled,
  afterBattleVictory,
  acceptQuest,
  acceptGuildQuest,
  dropGuildQuest,
  openGuildBoard,
  startEpisode,
  addGuest,
  classBeginGames,
  classGameDone,
  dropQuest,
  finishClass,
  readMasteryScroll,
  startClass,
  battleExpShare,
  battleParty,
  claimQuest,
  dismissStory,
  chooseStory,
  eatFood,
  endWeek,
  ensureWeek,
  ensureParty,
  gatherAt,
  grantHeroExp,
  healCompanions,
  newGameProgress,
  recruitCompanion,
  acceptFavor,
  completeFavor,
  refreshSkills,
  removeGuest,
  resolveFishing,
  setMemberPosition,
  setStoryFlag,
  startFishing,
  swapPartyMember,
  talkTo,
  toggleEquipSkill,
  togglePartyMember,
  useExpCandy,
  visitMap,
  withQuestEvents,
} from '@/lib/progression'
import type { GuildKey } from '@/lib/guild-quest-data'
import { COMBAT_NPCS } from '@/lib/companions'
import { mergeSave, migrateLoadedState, writeSave } from '@/lib/save'
import { VILLAGE_LAYOUT, villageShift } from '@/lib/village-layout'

export type Action =
  | { type: 'START_GAME'; name: string; appearance: Partial<PlayerAppearance> }
  | { type: 'SET_SCREEN'; screen: ScreenId }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'OPEN_NPC'; npcId: string }
  | { type: 'OPEN_SHOP'; npcId: string }
  | { type: 'OPEN_CRAFT'; npcId: string }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'SELL_ITEM'; itemId: string }
  | { type: 'CRAFT_ITEM'; recipeId: string }
  | { type: 'USE_ITEM_FIELD'; itemId: string }
  /** 제작대 장비 강화 — 골드만 쓴다(lib/gear-enhance) */
  | { type: 'ENHANCE_GEAR'; itemId: string }
  /** 스킬 숙련의 스크롤 읽기 — 마법 창에서 스킬을 골라 */
  | { type: 'USE_MASTERY_SCROLL'; itemId: string; skillId: string }
  | { type: 'REST' }
  | { type: 'EQUIP_ITEM'; itemId: string; slot: EquipSlot }
  | { type: 'UNEQUIP_ITEM'; slot: EquipSlot }
  | { type: 'TOGGLE_EQUIP_SKILL'; skillId: string }
  | { type: 'START_BATTLE'; fieldMonsterUid: string }
  /** 천공 콜로세움 창 — 신분이 없으면 이때 넘겨준 것으로(무작위 값은 리듀서 밖에서 만든다) */
  | { type: 'OPEN_ARENA'; identity: ArenaIdentity }
  | { type: 'ARENA_FIGHT'; opponent: ArenaTeam; match: ArenaMatch }
  | { type: 'ARENA_RESULT_CLEAR' }
  /** 타이틀 「멀티플레이」 — 불러온 기록의 캐릭터를 천공 콜로세움 입구로 */
  | { type: 'ENTER_ARENA_MAP' }
  | { type: 'ENCOUNTER_FIGHT' }
  /** 돌진한 몬스터가 플레이어에게 닿음(lib/monster-charge) — 접촉과 같이 바로 전투 전환 */
  | { type: 'ENCOUNTER'; uid: string }
  | { type: 'ENCOUNTER_FLEE' }
  | { type: 'USE_PORTAL'; portalId: string }
  | { type: 'PASSAGE_DONE'; fish?: number }
  | { type: 'ADMIN_PASSAGE_TEST'; id: import('@/lib/passages').PassageId }
  | { type: 'ADMIN_FISH_TEST' }
  | { type: 'REP_FULFILL'; hubId: string; slot: number }
  | { type: 'REP_FINAL'; hubId: string }
  /** 길드 전수 시험(lib/guild-trials) — 받기 / 재료 바치고 완료 */
  | { type: 'TRIAL_ACCEPT'; el: string }
  | { type: 'TRIAL_COMPLETE'; el: string }
  /** 코스튬(스킨) 갈아입기 — owner 'hero' 또는 동료 NPC id. costumeId 가 없으면 기본 복장으로 */
  | { type: 'COSTUME_WEAR'; owner: string; costumeId?: string }
  | { type: 'ADMIN_GIVE_ALL_COSTUMES' }
  | { type: 'SPOT_USE'; spotId: string }
  | { type: 'PASSAGE_CANCEL' }
  | { type: 'PORTAL_CONFIRM' }
  | { type: 'PORTAL_CANCEL' }
  | { type: 'TELEPORT'; mapId: MapId }
  | { type: 'CAST_FIELD_SPELL'; spell: import('@/lib/field-spells').FieldSpellId }
  | { type: 'INVISIBLE_END' }
  | { type: 'OPEN_CACHE'; key: string }
  | { type: 'HOUSING_TOGGLE_EDIT' }
  | { type: 'HOUSING_PLACE'; defId: string; cell?: { x: number; y: number } }
  | { type: 'HOUSING_REMOVE'; id: string }
  | { type: 'HOUSING_SELECT'; id: string | null }
  | { type: 'HOUSING_MOVE'; cell: { x: number; y: number } }
  | { type: 'HOUSING_FLIP' }
  | { type: 'OPEN_GATE' }
  | { type: 'CLOSE_GATE' }
  | { type: 'BATTLE_ACTOR_ACTION'; actorUid: string; action: EngineBattleAction }
  | { type: 'BATTLE_TICK' }
  | { type: 'BATTLE_END_CONTINUE' }
  | { type: 'TOGGLE_TEST_MODE' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<GameState['settings']> }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'RESET_GAME' }
  // ── 관리자 테스트룸(/admin) 전용 ──────────────────────────────────────────
  | { type: 'ADMIN_ENTER_TESTROOM' }
  | { type: 'ADMIN_SET_LEVEL'; level: number }
  | { type: 'ADMIN_TOGGLE_SKILL'; skillId: string }
  | { type: 'ADMIN_LEARN_ALL_SKILLS' }
  | { type: 'ADMIN_CLEAR_SKILLS' }
  | { type: 'ADMIN_GIVE_ALL_ITEMS' }
  | { type: 'ADMIN_SET_GOLD'; gold: number }
  | { type: 'ADMIN_HEAL_FULL' }
  | { type: 'ADMIN_RESPAWN_MONSTERS' }
  | { type: 'FIELD_RESPAWN_TICK' }
  | { type: 'START_SANDBAG' }
  // ── 4년제 학사·생활·동료 ────────────────────────────────────────────────────
  | { type: 'LOAD_GAME'; saved: Partial<GameState> }
  | { type: 'CLAIM_QUEST'; instanceId: string }
  | { type: 'START_EPISODE' }
  | { type: 'OPEN_GUILD_BOARD'; guild: GuildKey }
  | { type: 'GUILD_ACCEPT'; guild: GuildKey; templateId: string }
  | { type: 'GUILD_DROP'; instanceId: string }
  | { type: 'END_WEEK' }
  | { type: 'DISMISS_STORY' }
  | { type: 'STORY_CHOICE'; setFlags: string[] }
  | { type: 'SET_FLAG'; flag: string; value?: boolean | number }
  | { type: 'GATHER'; nodeKey: string }
  | { type: 'START_FISHING' }
  | { type: 'FISHING_RESULT'; success: boolean }
  | { type: 'RECRUIT_COMPANION'; companionId: string }
  /** 동료의 부탁 — 받기 / 들어주기(lib/companions favor 합류) */
  | { type: 'FAVOR_ACCEPT'; companionId: string }
  | { type: 'FAVOR_COMPLETE'; companionId: string }
  | { type: 'TOGGLE_PARTY_MEMBER'; companionId: string }
  | { type: 'SWAP_PARTY_MEMBER'; slot: number; companionId: string }
  | { type: 'SET_POSITION'; memberId: string; position: Position }
  | { type: 'USE_EXP_CANDY'; itemId: string; targetId: string }
  | { type: 'ADD_GUEST'; guestId: string }
  | { type: 'REMOVE_GUEST'; guestId: string }
  | { type: 'BATTLE_SET_AUTO'; auto: boolean }
  | { type: 'ACCEPT_QUEST'; instanceId: string }
  | { type: 'DROP_QUEST'; instanceId: string }
  | { type: 'START_CLASS' }
  | { type: 'ADMIN_CLASS_TEST'; game: import('@/lib/curriculum').MiniGameType }
  | { type: 'CLASS_ALERT' }
  | { type: 'CLASS_BEGIN_GAMES' }
  | { type: 'CLASS_GAME_DONE'; score: number; label: string }
  | { type: 'CLASS_GIVE_ITEMS'; items: { itemId: string; qty: number }[] }
  | { type: 'CLASS_FINISH' }
  | { type: 'ADMIN_SET_WEEK'; week: number }
  | { type: 'ADMIN_FORCE_END_WEEK' }
  | { type: 'ADMIN_TOGGLE_UNLOCK_ALL' }
  | { type: 'ADMIN_RECRUIT_ALL' }
  | { type: 'ADMIN_GIVE_ITEM'; itemId: string; qty: number }
  | { type: 'ADMIN_PLAY_BEAT'; beatId: string }
  | { type: 'ADMIN_SET_FLAGS'; flags: Record<string, boolean> }

import { groundBlocked } from '@/lib/collision'

const BODY_R = 0.24 // 캐릭터 반경(셀) — 이 만큼 건물 벽에서 떨어져 선다
function blockedAt(state: GameState, mapId: GameState['currentMapId'], x: number, y: number): boolean {
  const hits = (r: { x0: number; y0: number; x1: number; y1: number }) =>
    x > r.x0 - BODY_R && x < r.x1 + BODY_R && y > r.y0 - BODY_R && y < r.y1 + BODY_R
  const map = MAPS[mapId]
  const b = map.blockers
  if (b && b.some(hits)) return true
  // 바다·용암·뚫린 바닥은 밟을 수 없다(lib/collision) — 야생맵의 얕은 물·얼음은 통과 허용
  if (groundBlocked(map, x, y)) return true
  // 개인 공간 가구 — 플레이어가 배치한 가구도 충돌 처리(정적 blockers 에는 없음)
  if (mapId === 'personal-space') {
    for (const f of state.housing.placed) {
      const def = FURNITURE_BY_ID[f.defId]
      if (!def) continue
      if (def.flat) continue
      const { hw, hd } = furnitureHalf(def, f.flip)
      if (hits({ x0: f.cell.x - hw, y0: f.cell.y - hd, x1: f.cell.x + hw, y1: f.cell.y + hd })) return true
    }
  }
  return false
}

/** 전투가 끝난 직후(이기든 도망치든) 몬스터에 닿아도 다시 싸움이 붙지 않는 시간 — 억울한 연속 조우 방지(2026-10-18) */
export const CONTACT_SAFE_MS = 3000
export const isContactSafe = (s: Pick<GameState, 'contactSafeUntil'>, now = Date.now()) => (s.contactSafeUntil ?? 0) > now

function reducer(state: GameState, action: Action): GameState {
  let next = reducerCore(state, action)
  // 새 전투 시작 — 설정의 「전투 시작 시 자동」을 기본값으로(전투 중 버튼으로 언제든 전환)
  if (next.battle && !state.battle && next.battle.auto === undefined) {
    next = { ...next, battle: { ...next.battle, auto: !!next.settings.battleAutoStart } }
  }
  // 전투 → 필드로 돌아오는 모든 길(승리·도망·패배·스토리 전투)과 「슬쩍 피해 지나갔다」에서 잠깐 접촉 무시
  if ((state.battle && !next.battle) || (state.pendingEncounterUid && !next.pendingEncounterUid && !next.battle)) {
    return { ...next, contactSafeUntil: Date.now() + CONTACT_SAFE_MS }
  }
  return next
}

function reducerCore(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const player = createPlayer(action.name, action.appearance)
      const fieldMonsters = generateFieldMonsters(MAPS.village, state.settings.testMode, state.monsterDefeats)
      // 새 게임 — 1학년 1학기 1주차부터(주간 퀘스트 생성 + 입학 스토리 비트 큐잉)
      return newGameProgress({
        ...state,
        player,
        currentMapId: 'village',
        currentZoneId: 'z-quad',
        position: { ...MAPS.village.spawn },
        fieldMonsters,
        pendingEncounterUid: null,
        pendingPortalId: null,
        gateOpen: false,
        screen: 'world',
        previousScreen: 'world',
      })
    }

    case 'LOAD_GAME': {
      const fresh = createInitialGameState()
      // 예전 세이브(고정 속성·전직·Lv50 시절)는 신규 규칙으로 변환한 뒤에만 쓴다
      const loaded = migrateLoadedState(mergeSave(fresh, action.saved), action.saved)
      // 개인 공간 리마스터(2026-09-30): 손대지 않은 옛 초기 배치('seed-' 만)는 새 배치로 교체 — 벽 위치·가구 방향이 바뀜
      const placed = loaded.housing?.placed ?? []
      if (placed.length > 0 && placed.every((p) => p.id.startsWith('seed-'))) {
        loaded.housing = { ...loaded.housing, placed: fresh.housing.placed }
      }
      const map = MAPS[loaded.currentMapId] ?? MAPS.village
      // 마을 북쪽 확장(2026-10-10) 전 세이브는 마을 안 위치가 옛 좌표 → 같은 자리에 서도록 민다
      if (action.saved.villageLayout !== VILLAGE_LAYOUT) {
        if (map.id === 'village') loaded.position = villageShift(loaded.position)
        loaded.villageLayout = VILLAGE_LAYOUT
      }
      return ensureWeek({
        ...loaded,
        currentMapId: map.id,
        fieldMonsters: generateFieldMonsters(map, loaded.settings.testMode, loaded.monsterDefeats),
        screen: 'world',
        previousScreen: 'world',
        toast: '이어서 시작합니다.',
      })
    }

    case 'CLAIM_QUEST':
      return claimQuest(state, action.instanceId)

    case 'ACCEPT_QUEST':
      return acceptQuest(state, action.instanceId)

    // 메인 스토리 다음 막(레벨 관문 · lib/story-progress)
    case 'START_EPISODE':
      if (state.screen !== 'world' && state.screen !== 'journal') return state
      return { ...startEpisode(state), screen: 'world' }

    // 길드 서브 퀘스트 게시판
    case 'OPEN_GUILD_BOARD':
      return openGuildBoard({ ...state, activeNpcId: null }, action.guild)
    case 'GUILD_ACCEPT':
      return acceptGuildQuest(state, action.guild, action.templateId)
    case 'GUILD_DROP':
      return dropGuildQuest(state, action.instanceId)

    case 'DROP_QUEST':
      return dropQuest(state, action.instanceId)

    // ── 수업(통합 PRD §2.1) ──
    case 'START_CLASS':
      return startClass(state)

    case 'ADMIN_CLASS_TEST':
      return startClass(state, { game: action.game })

    case 'CLASS_ALERT':
      return state.classScene ? { ...state, classScene: { ...state.classScene, alert: true } } : state

    case 'CLASS_BEGIN_GAMES':
      return classBeginGames(state)

    case 'CLASS_GAME_DONE':
      return classGameDone(state, action.score, action.label)

    case 'CLASS_GIVE_ITEMS': {
      let inventory = state.inventory
      for (const it of action.items) if (itemById(it.itemId)) inventory = addToInventory(inventory, it.itemId, it.qty)
      return { ...state, inventory }
    }

    case 'CLASS_FINISH':
      return finishClass(state)

    case 'END_WEEK':
      return endWeek(state)

    case 'DISMISS_STORY': {
      // 장면이 보스전을 여는 비트면(EP37 폭주한 루스벨 등) 닫자마자 전투
      const head = state.storyQueue[0] ? beatById(state.storyQueue[0]) : undefined
      const next = dismissStory(state)
      return head?.battle ? startStoryBattle(next, head.id, head.battle.monsterIds, head.battle.scripted) : next
    }

    case 'STORY_CHOICE':
      return chooseStory(state, action.setFlags)

    case 'SET_FLAG':
      return setStoryFlag(state, action.flag, action.value ?? true)

    case 'GATHER':
      return gatherAt(state, action.nodeKey)

    case 'START_FISHING':
      return state.screen === 'world' && !state.fishing ? startFishing(state) : state

    case 'FISHING_RESULT':
      return resolveFishing(state, action.success)

    case 'RECRUIT_COMPANION':
      return recruitCompanion(state, action.companionId)

    case 'FAVOR_ACCEPT':
      return acceptFavor(state, action.companionId)

    case 'FAVOR_COMPLETE':
      return completeFavor(state, action.companionId)

    case 'TOGGLE_PARTY_MEMBER':
      return togglePartyMember(state, action.companionId)

    case 'SWAP_PARTY_MEMBER':
      return swapPartyMember(state, action.slot, action.companionId)

    case 'SET_POSITION':
      return setMemberPosition(state, action.memberId, action.position)

    case 'USE_EXP_CANDY':
      return useExpCandy(state, action.itemId, action.targetId)

    case 'ADD_GUEST':
      return addGuest(state, action.guestId)

    case 'REMOVE_GUEST':
      return removeGuest(state, action.guestId)

    case 'BATTLE_SET_AUTO':
      return state.battle ? { ...state, battle: { ...state.battle, auto: action.auto } } : state

    case 'TOGGLE_EQUIP_SKILL':
      return toggleEquipSkill(state, action.skillId)

    case 'ADMIN_SET_WEEK':
      return adminSetWeek(state, action.week)

    case 'ADMIN_FORCE_END_WEEK':
      return endWeek(state, true)

    case 'ADMIN_TOGGLE_UNLOCK_ALL':
      return { ...state, storyFlags: { ...state.storyFlags, DEBUG_UNLOCK_ALL: !state.storyFlags.DEBUG_UNLOCK_ALL } }

    // 관리자 — 스토리 장면 바로 재생(컷신 확인용). 플래그는 바꾸지 않고 큐 맨 앞에 넣는다
    case 'ADMIN_PLAY_BEAT':
      return state.screen === 'world' ? { ...state, storyQueue: [action.beatId, ...state.storyQueue.filter((b) => b !== action.beatId)] } : state

    // 관리자 — 스토리 플래그 직접 켜고 끄기(루트 테스트용)
    case 'ADMIN_SET_FLAGS':
      return { ...state, storyFlags: { ...state.storyFlags, ...action.flags } }

    case 'ADMIN_GIVE_ITEM':
      return itemById(action.itemId) ? { ...state, inventory: addToInventory(state.inventory, action.itemId, action.qty) } : state

    case 'ADMIN_RECRUIT_ALL': {
      let next: GameState = { ...state, storyFlags: { ...state.storyFlags, DEBUG_UNLOCK_ALL: true } }
      for (const c of COMBAT_NPCS) next = recruitCompanion(next, c.id)
      return { ...ensureParty(next), toast: '전투 가능한 학교 NPC 전원이 합류했습니다.' }
    }

    case 'SET_SCREEN': {
      if (action.screen === state.screen) return state
      return { ...state, previousScreen: state.screen, screen: action.screen }
    }

    case 'MOVE': {
      if (
        state.classScene ||
        state.screen !== 'world' ||
        state.battle ||
        state.pendingEncounterUid ||
        state.pendingPortalId ||
        state.gateOpen ||
        state.fishing ||
        state.passage ||
        state.storyQueue.length > 0
      )
        return state
      const map = MAPS[state.currentMapId]
      const clampX = (v: number) => Math.max(0.2, Math.min(map.grid.w - 0.2, v))
      const clampY = (v: number) => Math.max(0.2, Math.min(map.grid.h - 0.2, v))
      const ox = state.position.x
      const oy = state.position.y
      // 건물 충돌: 대각선이 막히면 x/y 축으로 슬라이드.
      // 한 번에 0.2칸 이하로 나눠 움직인다 — 프레임이 떨어진 채 질주하면 한 번에 0.7칸 넘게 가서 얇은 벽(난간·울타리)을 뚫던 문제(2026-11-03)
      const steps = Math.max(1, Math.ceil(Math.hypot(action.dx, action.dy) / 0.2))
      const sx = action.dx / steps
      const sy = action.dy / steps
      let nx = ox
      let ny = oy
      for (let i = 0; i < steps; i++) {
        const tx = clampX(nx + sx)
        const ty = clampY(ny + sy)
        if (!blockedAt(state, state.currentMapId, tx, ty)) {
          nx = tx
          ny = ty
        } else if (sx !== 0 && !blockedAt(state, state.currentMapId, tx, ny)) nx = tx
        else if (sy !== 0 && !blockedAt(state, state.currentMapId, nx, ty)) ny = ty
        else break
      }
      const zone = zoneAt(map, nx, ny)
      // 쿼터뷰: 셀 축 이동이 화면에선 대각으로 보이므로 '화면 방향'으로 8방향 판정(S키 = 화면 왼쪽 아래 → down-left)
      const facing = facingFromCellDelta(action.dx, action.dy) ?? state.facing

      const CONTACT_RADIUS = 0.32
      let touched: string | null = null
      for (const fm of state.fieldMonsters) {
        const rank = monsterById(fm.monsterId)?.rank
        // 보스는 덩치가 큰 만큼 접촉 판정도 넉넉하게(필드보스가 가장 큼, 스프라이트 축소에 맞춰 비례 완화)
        const radius = rank === 'fieldBoss' || rank === 'storyBoss' ? CONTACT_RADIUS * 1.84 : rank === 'miniBoss' ? CONTACT_RADIUS * 1.35 : CONTACT_RADIUS
        // 화면에 보이는 위치(배회 중 위치)로 판정 — 예전엔 집 좌표로 재서 보이는 몬스터에 닿아도 전투가 안 걸렸다
        if (Math.hypot(fm.homeCell.x - nx, fm.homeCell.y - ny) > 4) continue
        const at = monsterView(fm, performance.now(), map, { x: nx, y: ny }).pos
        const d = Math.hypot(at.x - nx, at.y - ny)
        if (d < radius) {
          touched = fm.uid
          break
        }
      }
      // 흑룡 강림(lib/black-dragon) — 앞발 가까이 다가가면 바로 흑룡전(투명해도 흑룡은 알아챈다)
      if (dragonInReach(state, nx, ny) && !isContactSafe(state)) return startDragonBattle({ ...state, position: { x: nx, y: ny }, facing })
      // 투명한 동안은 닿아도 그냥 지나간다
      if (touched && (isInvisible(state) || isContactSafe(state))) touched = null
      // 접촉 — 묻지 않고 바로 전투로(world-screen 이 화면 전환 연출을 보여 준 뒤 ENCOUNTER_FIGHT). 이동은 정지.
      if (touched) return { ...state, facing, pendingEncounterUid: touched }

      // 바닥 이동 마법진 — 밟아 들어서는 순간 확인 없이 바로 이동(2026-10-18). 군 통문(gate)은 행선지 고르는 창을 연다.
      // 이미 마법진 위에 서 있던 걸음(잠긴 곳이라 못 넘어간 뒤 등)은 다시 걸지 않는다 — 밖으로 나갔다 들어와야 한다.
      for (const p of map.portals) {
        // 숨은 통로·문은 밟아도 안 열린다 — 가까이에서 E(world-screen tryInteract)
        if (p.secret || p.door) continue
        if (p.walkArea) {
          const a = p.walkArea
          if (nx >= a.x0 && nx <= a.x1 && ny >= a.y0 && ny <= a.y1) return walkToFloor(state, p, { x: nx, y: ny }, facing)
          continue
        }
        const d = Math.hypot(p.cell.x - nx, p.cell.y - ny)
        if (d >= PORTAL_STEP_R || Math.hypot(p.cell.x - ox, p.cell.y - oy) < PORTAL_STEP_R) continue
        const onCircle = { ...state, position: { x: nx, y: ny }, facing, currentZoneId: zone?.id ?? state.currentZoneId }
        if (p.kind === 'gate') return { ...onCircle, gateOpen: true }
        return travelThroughPortal(onCircle, p.id)
      }

      return {
        ...state,
        position: { x: nx, y: ny },
        facing,
        currentZoneId: zone?.id ?? state.currentZoneId,
      }
    }

    case 'ENCOUNTER': {
      if (
        state.classScene || state.screen !== 'world' || state.battle || state.pendingEncounterUid || state.pendingPortalId ||
        state.gateOpen || state.fishing || state.passage || state.storyQueue.length > 0 || isInvisible(state) || isContactSafe(state) ||
        !state.fieldMonsters.some((f) => f.uid === action.uid)
      )
        return state
      return { ...state, pendingEncounterUid: action.uid }
    }

    case 'ENCOUNTER_FIGHT': {
      if (!state.pendingEncounterUid) return state
      return startBattleFromField({ ...state, pendingEncounterUid: null }, state.pendingEncounterUid)
    }

    case 'ENCOUNTER_FLEE': {
      const map = MAPS[state.currentMapId]
      const fm = state.pendingEncounterUid
        ? state.fieldMonsters.find((f) => f.uid === state.pendingEncounterUid)
        : null
      let position = state.position
      if (fm) {
        const at = wanderState(fm, performance.now(), map.blockers, state.position).pos
        const dx = state.position.x - at.x
        const dy = state.position.y - at.y
        const len = Math.hypot(dx, dy) || 1
        position = {
          x: Math.max(0.2, Math.min(map.grid.w - 0.2, state.position.x + (dx / len) * 0.75)),
          y: Math.max(0.2, Math.min(map.grid.h - 0.2, state.position.y + (dy / len) * 0.75)),
        }
      }
      return { ...state, position, pendingEncounterUid: null, toast: '슬쩍 피해 지나갔다.' }
    }

    case 'OPEN_GATE':
      return { ...state, gateOpen: true }

    case 'CLOSE_GATE':
      return { ...state, gateOpen: false }

    case 'USE_PORTAL':
      if (state.classScene) return state
      return travelThroughPortal(state, action.portalId)

    // 첫 이동 연출(lib/passages) — 통과하면 플래그를 켜고 그 포탈로 넘어간다 / 포기하면 제자리
    // 마을 놀이 지점(lib/activity-spots) — 낚시터는 바로 낚시, 미니게임 지점은 연습 한 판
    case 'SPOT_USE': {
      const spot = activitySpotById(action.spotId)
      if (!spot || spot.mapId !== state.currentMapId || state.screen !== 'world' || state.fishing || state.passage || state.classScene) return state
      if (Math.hypot(spot.cell.x - state.position.x, spot.cell.y - state.position.y) > (spot.reach ?? 1.6) + 0.8) return { ...state, toast: `${spot.label} — 조금 더 가까이 가야 한다.` }
      if (spot.kind === 'fishing') return startFishing(state, true)
      if (spot.kind === 'fountain') return spot.hubId ? { ...state, fountainHubId: spot.hubId, previousScreen: state.screen, screen: 'fountain' } : state
      if (spot.kind === 'guildBoard') return spot.guild ? openGuildBoard(state, spot.guild) : state
      return spot.game ? { ...state, passage: { id: spot.game, portalId: '' } } : state
    }

    // 길드 전수 시험 — 받기: trial:<el> = 1
    case 'TRIAL_ACCEPT': {
      const t = trialByEl(action.el)
      if (!t || trialState(state, t) !== 'offer') return state
      return { ...state, storyFlags: { ...state.storyFlags, [trialKey(t.el)]: 1 }, toast: `「${t.title}」을(를) 받았다 — ${t.items.map((r) => `${itemById(r.itemId)?.name ?? r.itemId} ×${r.qty}`).join(', ')}` }
    }
    // 길드 전수 시험 — 완료: 재료를 바치고 GUILD_MASTER_<EL> → 최상급 마법 습득(레벨 조건에 맞춰 refreshSkills)
    case 'TRIAL_COMPLETE': {
      const t = trialByEl(action.el)
      if (!t || trialState(state, t) !== 'asked') return state
      if (!trialReady(state, t)) return { ...state, toast: `${t.title} — 재료가 모자라다.` }
      let inventory = state.inventory
      for (const r of t.items) inventory = removeFromInventory(inventory, r.itemId, r.qty)
      const before = new Set(state.player.learnedSkills)
      const done = setStoryFlag({ ...state, inventory, storyFlags: { ...state.storyFlags, [trialKey(t.el)]: 2 } }, t.flag)
      const got = done.player.learnedSkills.filter((id) => !before.has(id)).map((id) => skillById(id)?.name ?? id)
      const later = t.skills.filter((id) => !done.player.learnedSkills.includes(id)).map((id) => `${skillById(id)?.name} (Lv.${skillById(id)?.levelRequired ?? TRIAL_MIN_LEVEL})`)
      return { ...done, toast: `✦ 최상급 마법 전수 ✦ ${got.length ? got.join(' · ') : ''}${later.length ? `${got.length ? ' — ' : ''}레벨이 차면: ${later.join(' · ')}` : ''}` }
    }

    // 분수대 의뢰(lib/reputation) — 이번 주 slot 번째 의뢰를 들어준다
    case 'REP_FULFILL': {
      const hub = hubById(action.hubId)
      if (!hub) return state
      const week = state.calendar.globalWeek
      const req = weeklyRequests(hub.id, week)[action.slot]
      const doneKey = reqDoneKey(hub.id, week, action.slot)
      if (!req || state.storyFlags[doneKey]) return state
      const block = requestBlocker(state, req)
      if (block) return { ...state, toast: block }
      let inventory = state.inventory
      let gold = state.player.gold
      if (req.kind === 'donate') gold -= req.gold
      else {
        const inv = consumeIngredients(inventory, [{ itemId: req.itemId, quantity: req.qty }])
        if (!inv) return { ...state, toast: '납품할 물건이 부족합니다.' }
        inventory = inv
        gold += req.gold
      }
      const prevLv = repLevel(state, hub)
      const storyFlags = { ...state.storyFlags, [doneKey]: true, [`repPts:${hub.id}`]: repPoints(state, hub.id) + req.pts }
      const lv = repLevel({ storyFlags }, hub)
      storyFlags[hub.repFlag] = lv
      const msg = `${req.who}의 부탁을 들어주었다 — 평판 +${req.pts}${req.kind === 'deliver' ? ` · 사례 ${req.gold}G` : ''}`
      return { ...state, inventory, player: { ...state.player, gold }, storyFlags, toast: lv > prevLv ? `${hub.name} 평판 Lv.${lv} 「${repLevelName(lv)}」!` : msg }
    }
    // 최종 평판 의뢰(Lv.4 → 5) — 상징
    case 'REP_FINAL': {
      const hub = hubById(action.hubId)
      const fin = hub && repFinal(hub.id)
      if (!hub || !fin || !finalOpen(state, hub)) return state
      const inv = consumeIngredients(state.inventory, fin.items.map((i) => ({ itemId: i.itemId, quantity: i.qty })))
      if (!inv) return { ...state, toast: '납품할 물건이 부족합니다.' }
      return {
        ...state,
        inventory: inv,
        player: { ...state.player, gold: state.player.gold + fin.gold },
        storyFlags: { ...state.storyFlags, [hub.emblemFlag]: true, [hub.repFlag]: 5 },
        toast: `${hub.name}의 상징 「${fin.emblem}」을(를) 받았다! 평판 Lv.5 「${repLevelName(5)}」`,
      }
    }

    case 'COSTUME_WEAR': {
      const c = action.costumeId ? costumeById(action.costumeId) : baseCostumeOf(action.owner)
      if (!c || c.owner !== action.owner || !ownsCostume(state, c.id)) return state
      const wd = state.wardrobe ?? emptyWardrobe()
      const worn = { ...wd.worn }
      if (c.base) delete worn[action.owner]
      else worn[action.owner] = c.id
      return { ...state, wardrobe: { ...wd, worn }, toast: `${c.name}(으)로 갈아입었다.` }
    }
    case 'ADMIN_GIVE_ALL_COSTUMES': {
      const wd = state.wardrobe ?? emptyWardrobe()
      return { ...state, wardrobe: { ...wd, owned: COSTUMES.filter((c) => !c.base).map((c) => c.id) }, toast: `코스튬 ${COSTUMES.filter((c) => !c.base).length}벌 지급` }
    }
    // 낚시 미니게임 테스트 — 지금 맵의 어종으로 한 판(낚시터 규칙: 해금·낚싯대·물가 무시)
    case 'ADMIN_FISH_TEST':
      return state.fishing || state.passage || state.classScene || state.battle ? state : startFishing({ ...state, screen: 'world' }, true)
    case 'ADMIN_PASSAGE_TEST':
      return state.passage || state.classScene || state.battle ? state : { ...state, screen: 'world', passage: { id: action.id, portalId: '' } }

    case 'PASSAGE_DONE': {
      if (!state.passage) return state
      const { id, portalId } = state.passage
      // 함선에서 잡은 물고기는 가방으로(최대 5마리)
      if (action.fish && action.fish > 0) {
        const n = Math.min(5, action.fish)
        return reducer({ ...state, inventory: addToInventory(state.inventory, 'fish-mackerel', n), toast: `고등어 ${n}마리를 챙겼다.` }, { type: 'PASSAGE_DONE' })
      }
      // 놀이 지점의 연습 판 — 이동 없이 용돈만
      if (!portalId) return { ...state, passage: null, player: { ...state.player, gold: state.player.gold + ARCADE_REWARD_GOLD }, toast: `훈련 통과! ${ARCADE_REWARD_GOLD}G 를 받았다.` }
      return travelThroughPortal({ ...state, passage: null, storyFlags: { ...state.storyFlags, [passageFlag(id)]: true } }, portalId)
    }
    case 'PASSAGE_CANCEL':
      return state.passage ? { ...state, passage: null, toast: state.passage.portalId ? '발길을 돌렸다.' : null } : state

    case 'PORTAL_CONFIRM':
      return state.pendingPortalId ? travelThroughPortal(state, state.pendingPortalId) : state

    case 'TELEPORT':
      return teleportTo(state, action.mapId)

    // 탐사 마법(lib/field-spells) — 순간이동 · 끌어오기 · 질주 · 등불 · 투명화(중·고급, Lv.30 — 투명한 물약과 같은 효과)
    case 'CAST_FIELD_SPELL':
      return castFieldSpell(state, action.spell)
    // 숨은 룬 상자(lib/hidden-caches) — 가까이에서 E. 저장마다 한 번
    case 'OPEN_CACHE': {
      const map = MAPS[state.currentMapId]
      const c = cachesForMap(map).find((x) => x.key === action.key)
      if (!c || isCacheOpened(state, c.key) || Math.hypot(c.cell.x - state.position.x, c.cell.y - state.position.y) > CACHE_NEAR + 0.2) return state
      const r = cacheReward(map, c.key)
      const name = itemById(r.itemId)?.name ?? r.itemId
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold + r.gold },
        inventory: addToInventory(state.inventory, r.itemId, r.qty),
        storyFlags: { ...state.storyFlags, [cacheFlag(c.key)]: true },
        toast: `숨은 룬 상자를 열었다! ${r.gold}G · ${name} x${r.qty}`,
      }
    }
    // 지속형 탐사 효과가 끝났을 때(world-screen 이 끝나는 시각에 보낸다) — 끝난 것만 지우고 알려 준다
    case 'INVISIBLE_END': {
      const now = Date.now() + 50
      const ended: string[] = []
      const next = { ...state }
      if (state.invisibleUntil && state.invisibleUntil <= now) { next.invisibleUntil = undefined; ended.push('투명화') }
      if (state.hasteUntil && state.hasteUntil <= now) { next.hasteUntil = undefined; ended.push('질주') }
      if (state.lightUntil && state.lightUntil <= now) { next.lightUntil = undefined; ended.push('등불') }
      return ended.length ? { ...next, toast: `${ended.join('·')} 효과가 풀렸다.` } : state
    }

    case 'PORTAL_CANCEL': {
      if (!state.pendingPortalId) return state
      const map = MAPS[state.currentMapId]
      const p = map.portals.find((pp) => pp.id === state.pendingPortalId)
      let position = state.position
      if (p) {
        const dx = state.position.x - p.cell.x
        const dy = state.position.y - p.cell.y
        const len = Math.hypot(dx, dy) || 1
        position = {
          x: Math.max(0.2, Math.min(map.grid.w - 0.2, state.position.x + (dx / len) * 0.9)),
          y: Math.max(0.2, Math.min(map.grid.h - 0.2, state.position.y + (dy / len) * 0.9)),
        }
      }
      return { ...state, position, pendingPortalId: null }
    }

    case 'HOUSING_TOGGLE_EDIT': {
      if (state.currentMapId !== 'personal-space') return state
      return { ...state, housing: { ...state.housing, editMode: !state.housing.editMode, selectedId: null } }
    }

    case 'HOUSING_PLACE': {
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode) return state
      const def = FURNITURE_BY_ID[action.defId]
      if (!def) return state
      const off =
        (() => {
          const v = FACING_CELL_VEC[state.facing] ?? FACING_CELL_VEC['down-left']
          return { x: v.x * 0.9, y: v.y * 0.9 }
        })()
      // 끌어다 놓으면 그 자리(1/4칸), 아니면 바라보는 방향 앞(1/2칸)
      const cell = action.cell
        ? { x: Math.round(action.cell.x * 4) / 4, y: Math.round(action.cell.y * 4) / 4 }
        : { x: Math.round((state.position.x + off.x) * 2) / 2, y: Math.round((state.position.y + off.y) * 2) / 2 }
      // 제작 가구는 가방에 가진 개수만큼만(놓아도 가방에서 빠지지 않는다 — 치우면 다시 놓을 수 있다)
      if (def.itemId) {
        const own = state.inventory.find((s) => s.itemId === def.itemId)?.qty ?? 0
        const used = state.housing.placed.filter((p) => p.defId === def.id).length
        if (used >= own) return { ...state, toast: `${def.label}을(를) 더 가지고 있지 않습니다. 마도구 작업대에서 만들 수 있어요.` }
      }
      const fit = (c: { x: number; y: number }) =>
        furnitureFitReason({ def, cell: c, grid: MAPS['personal-space'].grid, walls: MAPS['personal-space'].blockers, others: state.housing.placed, player: state.position, bodyR: BODY_R })
      let why = fit(cell)
      // 버튼으로 놓을 때 큰 가구가 발에 걸리면 조금 더 앞에 놓아 본다
      if (why && !action.cell) {
        const v = FACING_CELL_VEC[state.facing] ?? FACING_CELL_VEC['down-left']
        for (const k of [1.4, 1.9, 2.4]) {
          const c = { x: Math.round((state.position.x + v.x * k) * 2) / 2, y: Math.round((state.position.y + v.y * k) * 2) / 2 }
          if (!fit(c)) {
            cell.x = c.x
            cell.y = c.y
            why = null
            break
          }
        }
      }
      if (why) return { ...state, toast: why }
      const placed = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, defId: action.defId, cell }
      return withQuestEvents({ ...state, housing: { ...state.housing, placed: [...state.housing.placed, placed], selectedId: placed.id } }, [{ type: 'PLACE_FURNITURE' }])
    }

    case 'HOUSING_REMOVE': {
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode) return state
      return { ...state, housing: { ...state.housing, placed: state.housing.placed.filter((p) => p.id !== action.id), selectedId: null } }
    }

    case 'HOUSING_SELECT': {
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode) return state
      return { ...state, housing: { ...state.housing, selectedId: action.id } }
    }

    // 고른 가구를 누른 바닥으로 옮긴다(1/4칸 단위). 벽·방 밖·서 있는 자리에는 못 놓는다
    case 'HOUSING_MOVE': {
      const sel = state.housing.selectedId
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode || !sel) return state
      const map = MAPS['personal-space']
      const cell = { x: Math.round(action.cell.x * 4) / 4, y: Math.round(action.cell.y * 4) / 4 }
      const me = state.housing.placed.find((p) => p.id === sel)
      const def = FURNITURE_BY_ID[me?.defId ?? '']
      if (!def || !me) return state
      if (me.cell.x === cell.x && me.cell.y === cell.y) return state
      const why = furnitureFitReason({ def, cell, flip: me.flip, grid: map.grid, walls: map.blockers, others: state.housing.placed.filter((p) => p.id !== sel), player: state.position, bodyR: BODY_R })
      if (why) return { ...state, toast: why }
      return { ...state, housing: { ...state.housing, placed: state.housing.placed.map((p) => (p.id === sel ? { ...p, cell } : p)) } }
    }

    case 'HOUSING_FLIP': {
      const sel = state.housing.selectedId
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode || !sel) return state
      const me = state.housing.placed.find((p) => p.id === sel)
      const def = FURNITURE_BY_ID[me?.defId ?? '']
      if (!me || !def) return state
      // 돌리면 발밑 가로·세로가 바뀐다 — 벽·다른 가구에 걸리면 돌리지 않는다
      const map = MAPS['personal-space']
      const why = furnitureFitReason({ def, cell: me.cell, flip: !me.flip, grid: map.grid, walls: map.blockers, others: state.housing.placed.filter((p) => p.id !== sel), player: state.position, bodyR: BODY_R })
      if (why) return { ...state, toast: `돌릴 수 없습니다 — ${why}` }
      return { ...state, housing: { ...state.housing, placed: state.housing.placed.map((p) => (p.id === sel ? { ...p, flip: !p.flip } : p)) } }
    }

    case 'OPEN_NPC':
      if (state.classScene) return state
      // 대화 = 관계도(주 1회) + TALK 미션 진행. 그 NPC 의 스토리 장면이 열렸으면 일반 대화 대신 장면부터
      {
        const talked = talkTo({ ...state, activeNpcId: action.npcId, previousScreen: state.screen, screen: 'dialogue' }, action.npcId)
        return talked.storyQueue.length > state.storyQueue.length ? { ...talked, activeNpcId: null, screen: 'world' } : talked
      }

    case 'OPEN_SHOP':
      return { ...state, activeNpcId: action.npcId, activeShopId: action.npcId, previousScreen: state.screen, screen: 'shop' }

    case 'OPEN_CRAFT':
      return { ...state, activeNpcId: action.npcId, previousScreen: state.screen, screen: 'craft' }

    case 'CLOSE_OVERLAY':
      return { ...state, activeNpcId: null, activeShopId: null, screen: 'world' }

    case 'BUY_ITEM': {
      const item = itemById(action.itemId)
      if (!item || state.player.gold < item.price) return { ...state, toast: '골드가 부족합니다.' }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - item.price },
        inventory: addToInventory(state.inventory, action.itemId, 1),
        toast: `${item.name}을(를) 구매했습니다.`,
      }
    }

    case 'SELL_ITEM': {
      const item = itemById(action.itemId)
      const slot = state.inventory.find((s) => s.itemId === action.itemId)
      if (!item || !slot) return state
      const inventory = removeFromInventory(state.inventory, action.itemId, 1)
      // 마지막 한 개를 팔면 장착·강화 상태도 함께 사라진다
      let player = { ...state.player, gold: state.player.gold + item.sellPrice }
      if (!inventory.some((s) => s.itemId === action.itemId)) {
        const equipped = Object.fromEntries(Object.entries(player.equipped).filter(([, id]) => id !== action.itemId))
        const gear = { ...(player.gear ?? {}) }
        delete gear[action.itemId]
        player = { ...player, equipped, gear }
      }
      return {
        ...state,
        player,
        inventory,
        toast: `${item.name}을(를) 판매했습니다. (+${item.sellPrice}G)`,
      }
    }

    case 'CRAFT_ITEM': {
      const recipe = recipeById(action.recipeId)
      if (!recipe) return state
      const category = recipe.category ?? 'equipment'
      const activity = RECIPE_CATEGORY_ACTIVITY[category]
      if (!isActivityUnlocked(state, activity)) {
        return { ...state, toast: `${ACTIVITY_META[activity].name}은(는) ${activityUnlockLabel(activity)}에 해금됩니다.` }
      }
      const consumed = consumeIngredients(state.inventory, recipe.ingredients)
      if (!consumed) return { ...state, toast: '재료가 부족합니다.' }
      const inventory = addToInventory(consumed, recipe.outputItemId, recipe.outputQuantity)
      const output = itemById(recipe.outputItemId)
      const crafted = { ...state.collections.crafted, [recipe.outputItemId]: (state.collections.crafted[recipe.outputItemId] ?? 0) + recipe.outputQuantity }
      const evType = category === 'alchemy' ? 'ALCHEMY' : category === 'cooking' ? 'COOK' : 'CRAFT'
      return withQuestEvents(
        { ...state, inventory, collections: { ...state.collections, crafted } },
        [{ type: evType, itemId: recipe.outputItemId, qty: recipe.outputQuantity }],
        `${output?.name ?? '아이템'}을(를) 제작했습니다.`,
      )
    }

    case 'USE_ITEM_FIELD': {
      const item = itemById(action.itemId)
      const slot = state.inventory.find((s) => s.itemId === action.itemId)
      if (item?.type === 'food') return eatFood(state, action.itemId)
      if (!item?.useEffect || !slot) return state
      if (item.useEffect.grantExp) return { ...state, toast: '마력캔디는 가방에서 먹일 캐릭터를 골라 사용하세요.' }
      if (item.useEffect.invisibleSec) {
        if (state.battle) return state
        return {
          ...state,
          invisibleUntil: Math.max(state.invisibleUntil ?? 0, Date.now()) + item.useEffect.invisibleSec * 1000,
          inventory: removeFromInventory(state.inventory, action.itemId, 1),
          toast: `몸이 투명해졌다. ${Math.round(item.useEffect.invisibleSec / 60)}분 동안 몬스터에 닿아도 싸움이 붙지 않는다.`,
        }
      }

      if (item.type === 'scroll') return { ...state, toast: '숙련의 스크롤은 마법 창(HUD 「마법」)에서 스킬을 골라 읽어요.' }

      let hp = state.player.hp
      let mp = state.player.mp
      const eff = getEffectiveStats(state.player)
      if (item.useEffect.healHp) hp = Math.min(eff.maxHp, hp + item.useEffect.healHp)
      if (item.useEffect.healMp) mp = Math.min(eff.maxMp, mp + item.useEffect.healMp)
      return {
        ...state,
        player: { ...state.player, hp, mp },
        inventory: removeFromInventory(state.inventory, action.itemId, 1),
        toast: `${item.name}을(를) 사용했습니다.`,
      }
    }

    case 'REST': {
      const eff = getEffectiveStats(state.player)
      return healCompanions({
        ...state,
        player: { ...state.player, hp: eff.maxHp, mp: eff.maxMp },
        activeNpcId: null,
        screen: 'world',
        toast: '기숙사에서 충분히 쉬었다. 파티 전원의 HP·MP가 모두 회복되었다.',
      })
    }

    case 'EQUIP_ITEM': {
      const item = itemById(action.itemId)
      if (!item) return state
      if (item.requiredLevel && state.player.level < item.requiredLevel) {
        return { ...state, toast: `Lv.${item.requiredLevel} 이상부터 착용할 수 있습니다.` }
      }
      return {
        ...state,
        player: { ...state.player, equipped: { ...state.player.equipped, [action.slot]: action.itemId } },
        toast: `${item.name}을(를) 장착했습니다.`,
      }
    }

    case 'ENHANCE_GEAR': {
      const item = itemById(action.itemId)
      if (!isEnhanceable(item) || !state.inventory.some((s) => s.itemId === action.itemId)) return state
      const mods = gearOf(state.player.gear, action.itemId)
      if (mods.enh >= ENHANCE_MAX) return { ...state, toast: `${item.name}은(는) 이미 +${ENHANCE_MAX} 입니다.` }
      const cost = enhanceCost(item, mods.enh)
      if (state.player.gold < cost) return { ...state, toast: '골드가 부족합니다.' }
      const r = enhanceOnce(item, mods)
      const gear = { ...(state.player.gear ?? {}), [action.itemId]: r.mods }
      const msg =
        r.outcome === 'success'
          ? `강화 성공! ${gearName(item, r.mods)}`
          : r.outcome === 'drop'
            ? `강화 실패… ${gearName(item, r.mods)}(으)로 한 단계 떨어졌다.`
            : `강화 실패. +${mods.enh} 그대로 유지된다.`
      return { ...state, player: { ...state.player, gold: state.player.gold - cost, gear }, toast: msg }
    }

    case 'USE_MASTERY_SCROLL':
      return readMasteryScroll(state, action.itemId, action.skillId)

    case 'UNEQUIP_ITEM': {
      const equipped = { ...state.player.equipped }
      delete equipped[action.slot]
      return { ...state, player: { ...state.player, equipped } }
    }

    // ── 관리자 테스트룸(/admin) 전용 액션 — 저장 데이터가 없는 순수 샌드박스이므로
    // 밸런스·검증 없이 즉시 원하는 상태로 만든다 ──────────────────────────────
    case 'ADMIN_ENTER_TESTROOM': {
      const map = MAPS.testroom
      return ensureWeek({
        ...state,
        currentMapId: 'testroom',
        currentZoneId: 'z-testroom',
        // 관리자 부팅 직후의 입학식 프롤로그 등 자동 장면은 건너뛴다(봤음 플래그는 큐에 넣을 때 이미 켜짐) — 장면은 '컷신' 탭에서 재생
        storyQueue: [],
        position: { ...map.spawn },
        facing: 'down',
        fieldMonsters: generateFieldMonsters(map, state.settings.testMode, state.monsterDefeats),
        pendingEncounterUid: null,
        pendingPortalId: null,
        gateOpen: false,
        screen: 'world',
        previousScreen: 'world',
      })
    }

    case 'ADMIN_SET_LEVEL': {
      const level = Math.max(1, Math.min(MAX_LEVEL, Math.round(action.level)))
      const stats = computeStatsForLevel(level)
      return refreshSkills({
        ...state,
        player: { ...state.player, level, exp: 0, stats, hp: stats.maxHp, mp: stats.maxMp },
      })
    }

    case 'ADMIN_TOGGLE_SKILL': {
      const has = state.player.learnedSkills.includes(action.skillId)
      if (!has && !isStudentSkill(SKILLS.find((s) => s.id === action.skillId)!)) return state // 소환수 기술·모르스 전용은 배울 수 없다
      const learnedSkills = has
        ? state.player.learnedSkills.filter((id) => id !== action.skillId)
        : [...state.player.learnedSkills, action.skillId]
      // 장착 칸·소환 칸 배치는 refreshSkills 와 같은 규칙(toggleEquipSkill)으로
      const player = { ...state.player, learnedSkills, equippedSkills: state.player.equippedSkills.filter((id) => id !== action.skillId), summonSkills: (state.player.summonSkills ?? []).filter((id) => id !== action.skillId) }
      return has ? { ...state, player } : toggleEquipSkill({ ...state, player }, action.skillId)
    }

    case 'ADMIN_LEARN_ALL_SKILLS': {
      // 학생이 배울 수 있는 스킬 전부(바람·소환수 기술 제외) — 소환 마법은 소환 칸 4개에
      const learnedSkills = SKILLS.filter(isStudentSkill).map((s) => s.id)
      const summonIds = SKILLS.filter((s) => s.kind === 'summon').map((s) => s.id)
      return { ...state, player: { ...state.player, learnedSkills, equippedSkills: learnedSkills.filter((id) => !summonIds.includes(id)).slice(0, 8), summonSkills: summonIds.slice(0, 4) } }
    }

    case 'ADMIN_CLEAR_SKILLS':
      return { ...state, player: { ...state.player, learnedSkills: [], equippedSkills: [] } }

    case 'ADMIN_GIVE_ALL_ITEMS': {
      const inventory = ITEMS.map((i) => ({ itemId: i.id, qty: i.stackable ? 99 : 1 }))
      return { ...state, inventory }
    }

    case 'ADMIN_SET_GOLD':
      return { ...state, player: { ...state.player, gold: Math.max(0, Math.round(action.gold)) } }

    case 'ADMIN_HEAL_FULL': {
      const stats = getEffectiveStats(state.player)
      return {
        ...state,
        player: { ...state.player, hp: stats.maxHp, mp: stats.maxMp },
      }
    }

    // 개인 공간 무기 거치대 = 샌드백 — 죽지 않는 허수아비에게 마법 시험(lib/battle-engine sandbag)
    case 'START_SANDBAG': {
      if (state.currentMapId !== 'personal-space' || state.screen !== 'world' || state.battle) return state
      if (!nearSandbag(state)) return { ...state, toast: '무기 거치대 가까이 가야 한다.' }
      const def = MONSTERS.find((m) => m.isTestMonster)
      if (!def) return state
      const ready = ensureParty(state)
      const base = initBattle(battleParty(ready), [def], state.position, undefined, { huntEnabled: false })
      const combatants = base.combatants.map((c) =>
        c.isTestMonster ? { ...c, name: '샌드백 허수아비', hp: SANDBAG_HP, stats: { ...c.stats, maxHp: SANDBAG_HP, def: 0, mdef: 0, spd: 1 } } : c,
      )
      const log = [{ ...base.log[0], text: '샌드백 허수아비 — 마음껏 시험해 보자! (끝낼 때는 「그만두기」)' }]
      return { ...ready, previousScreen: state.screen, screen: 'battle', battle: { ...base, combatants, log, sandbag: true } }
    }

    // 맵에 머무는 동안에도 리젠 시간(15분)이 지난 몬스터를 제자리에 되살린다 — 플레이어 바로 옆은 다음 틱으로 미룬다
    case 'FIELD_RESPAWN_TICK': {
      if (state.screen !== 'world' || state.battle) return state
      const map = MAPS[state.currentMapId]
      if (!map || map.kind !== 'field') return state
      const now = Date.now()
      const monsterDefeats = pruneDefeats(state.monsterDefeats, now)
      const have = new Set(state.fieldMonsters.map((m) => m.uid))
      const back = generateFieldMonsters(map, state.settings.testMode, monsterDefeats).filter(
        (m) => !have.has(m.uid) && Math.hypot(m.cell.x - state.position.x, m.cell.y - state.position.y) > 4,
      )
      if (!back.length) return state
      return { ...state, monsterDefeats, fieldMonsters: [...state.fieldMonsters, ...back] }
    }

    case 'ADMIN_RESPAWN_MONSTERS': {
      // 관리자 — 이 맵에서 잡은 기록을 지우고 전부 다시 배치
      const monsterDefeats = Object.fromEntries(Object.entries(state.monsterDefeats ?? {}).filter(([k]) => !k.startsWith(state.currentMapId + ':')))
      return { ...state, monsterDefeats, fieldMonsters: generateFieldMonsters(MAPS[state.currentMapId], state.settings.testMode, monsterDefeats) }
    }

    case 'TOGGLE_TEST_MODE': {
      const testMode = !state.settings.testMode
      return {
        ...state,
        settings: { ...state.settings, testMode },
        fieldMonsters: generateFieldMonsters(MAPS[state.currentMapId], testMode, state.monsterDefeats),
      }
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }

    case 'SHOW_TOAST':
      return { ...state, toast: action.message }

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    case 'START_BATTLE':
      return startBattleFromField(state, action.fieldMonsterUid)

    case 'OPEN_ARENA':
      return { ...state, arena: state.arena ?? action.identity, activeNpcId: 'npc-arena', previousScreen: state.screen, screen: 'arena' }

    case 'ARENA_FIGHT':
      return { ...state, previousScreen: 'arena', screen: 'battle', battle: initArenaBattle(state, action.opponent, action.match), arenaResult: null }

    case 'ARENA_RESULT_CLEAR':
      return { ...state, arenaResult: null }

    case 'ENTER_ARENA_MAP': {
      const dest = MAPS[ARENA_MAP_ID]
      const pos = dest.spawn
      return visitMap(
        {
          ...state,
          screen: 'world',
          currentMapId: dest.id,
          position: { ...pos },
          facing: 'up',
          currentZoneId: zoneAt(dest, pos.x, pos.y)?.id ?? '',
          fieldMonsters: [],
          pendingEncounterUid: null,
          pendingPortalId: null,
          gateOpen: false,
          toast: '천공 콜로세움 — 제단 앞 투기장장 그로먼에게 말을 걸어 보세요.',
        },
        dest.id,
      )
    }

    case 'BATTLE_ACTOR_ACTION': {
      if (!state.battle) return state
      const { battle: resolved, itemConsumed, fled } = resolveAction(state.battle, action.actorUid, action.action)
      let inventory = state.inventory
      if (itemConsumed) inventory = removeFromInventory(inventory, itemConsumed, 1)
      // 콜로세움에서 도망 = 기권패
      if (fled && state.battle.pvp) return endArenaBattle({ ...state, inventory }, false)
      // 샌드백 연습 끝 — 전투 전 상태 그대로(HP·MP·아이템 소모 없음)
      if (fled && state.battle.sandbag) return { ...state, battle: null, screen: 'world', toast: '샌드백 연습을 마쳤다.', contactSafeUntil: Date.now() + 1500 }
      if (fled) return reopenStoryBattle(afterBattleFled(leaveBattle(state, resolved, inventory, '전투에서 벗어났습니다.'), resolved), resolved)
      const ended = checkBattleEnd(resolved)
      const next = ended.isOver ? ended : advanceTurn(ended)
      return { ...state, battle: next, inventory }
    }

    case 'BATTLE_TICK': {
      if (!state.battle || state.battle.isOver) return state
      if (!state.battle.activeUid) return { ...state, battle: tickAtb(state.battle) }
      const actor = currentActor(state.battle)
      if (!actor) return { ...state, battle: { ...state.battle, activeUid: null } }
      // 주인공·파티 동료 턴은 사용자 입력 대기(자동 전투/동료 자동 설정이면 AI 가 대신 행동)
      if (awaitsPlayerInput(state.battle, actor, state.settings.companionAuto)) return state
      const acted = resolveEnemyTurn(state.battle, actor.uid)
      // 연출 전투 — 적이 행동한 횟수를 센다(DRAGON_ROUNDS 번이면 중단)
      const resolved = acted.scripted && actor.side === 'enemy' ? { ...acted, scripted: { ...acted.scripted, enemyTurns: acted.scripted.enemyTurns + 1 } } : acted
      const ended = checkBattleEnd(resolved)
      const next = ended.isOver ? ended : advanceTurn(ended)
      return { ...state, battle: next }
    }

    case 'BATTLE_END_CONTINUE': {
      if (!state.battle) return state
      if (state.battle.pvp) return endArenaBattle(state, state.battle.victory)
      // 연출 전투 중단(흑룡전) — 패배·후송 없이 그 자리로, 다음 장면 플래그
      if (state.battle.interrupted && state.battle.scripted) {
        const flag = state.battle.scripted.flag
        const left = leaveBattle(state, state.battle, state.inventory, '')
        const next = { ...left, player: { ...left.player, hp: Math.max(left.player.hp, Math.round(left.player.stats.maxHp * 0.3)) }, contactSafeUntil: Date.now() + 3000 }
        return setStoryFlag(next, flag)
      }
      const heroC = state.battle.combatants.find((c) => c.uid === 'hero')

      if (state.battle.victory) {
        const prevLevel = state.player.level
        let inventory = state.inventory
        for (const id of state.battle.rewardDrops ?? []) inventory = addToInventory(inventory, id, 1)

        const fieldMonsters = state.battle.fieldMonsterUid
          ? updateFieldMonstersAfterVictory(state.fieldMonsters, state.battle.fieldMonsterUid)
          : state.fieldMonsters
        // 잡은 개체는 15분 동안 이 맵에 다시 나타나지 않는다(테스트 허수아비는 제외 — updateFieldMonstersAfterVictory 가 남겨 둔다)
        const beaten = state.battle.fieldMonsterUid
        const monsterDefeats =
          beaten && fieldMonsters.length < state.fieldMonsters.length
            ? { ...pruneDefeats(state.monsterDefeats), [defeatKey(state.currentMapId, beaten)]: Date.now() }
            : state.monsterDefeats

        // 경험치·레벨업(스탯 갱신 + 레벨 조건 스킬)은 퀘스트 경험치와 같은 경로
        const leveled = grantHeroExp(
          {
            ...state,
            player: {
              ...state.player,
              hp: heroC ? Math.max(1, Math.round((heroC.hp / Math.max(1, heroC.stats.maxHp)) * state.player.stats.maxHp)) : state.player.hp,
              mp: heroC?.mp ?? state.player.mp,
              gold: state.player.gold + (state.battle.rewardGold ?? 0),
            },
          },
          battleExpShare(state.battle), // 파티 인원수로 나눈 1인 몫
        )
        const newLevel = leveled.player.level

        // 동료 성장·사냥 부산물·도감·주간 미션·식사 버프 차감(lib/progression.ts)
        return afterBattleVictory(
          {
            ...leveled,
            inventory,
            fieldMonsters,
            monsterDefeats,
            battle: null,
            screen: 'world',
            toast: newLevel > prevLevel ? `레벨 업! Lv.${newLevel}` : null,
          },
          state.battle,
        )
      }

      const village = MAPS.village
      const respawnPos = village.respawn ?? village.spawn
      return reopenStoryBattle(afterBattleDefeat({
        ...state,
        player: { ...state.player, hp: 1, mp: Math.max(1, Math.round(state.player.stats.maxMp * 0.2)) },
        currentMapId: 'village',
        position: { ...respawnPos },
        currentZoneId: zoneAt(village, respawnPos.x, respawnPos.y)?.id ?? state.currentZoneId,
        fieldMonsters: [],
        pendingEncounterUid: null,
        pendingPortalId: null,
        gateOpen: false,
        battle: null,
        screen: 'world',
        toast: '기절했다... 성역 신전에서 정신을 차렸다.',
      }, state.battle), state.battle)
    }

    case 'RESET_GAME':
      return createInitialGameState()

    default:
      return state
  }
}

/** 전체 지도 텔레포트(2026-10-07) — 가 본 맵(또는 학교·마을)의 입구로 바로 이동. 수업·전투·스토리 장면 중엔 안 된다 */
function teleportTo(state: GameState, mapId: MapId): GameState {
  const reason = teleportBlockReason(state, mapId)
  if (reason) return { ...state, toast: reason }
  const dest = MAPS[mapId]
  const pos = dest.respawn ?? dest.spawn
  return visitMap(
    {
      ...state,
      screen: 'world',
      currentMapId: dest.id,
      position: { ...pos },
      facing: 'down',
      currentZoneId: zoneAt(dest, pos.x, pos.y)?.id ?? '',
      fieldMonsters: generateFieldMonsters(dest, state.settings.testMode, state.monsterDefeats),
      pendingEncounterUid: null,
      pendingPortalId: null,
      gateOpen: false,
      toast: `텔레포트 — ${dest.name}`,
    },
    dest.id,
  )
}

/** 탐사 마법 시전 — 배운 레벨·MP·상황을 보고 효과를 건다 */
function castFieldSpell(state: GameState, id: FieldSpellId): GameState {
  const sp = fieldSpellById(id)
  // 필드 화면에서만 — 대화·상점·가방 창이 열린 채 숫자 키를 눌러도 시전되지 않게
  if (state.screen !== 'world' || state.battle || state.classScene || state.storyQueue.length > 0 || state.passage || state.fishing || state.gateOpen) return state
  if (state.player.level < sp.level) return { ...state, toast: `${sp.name}은(는) Lv.${sp.level}에 배운다.` }
  if (state.player.mp < sp.mp) return { ...state, toast: `MP가 부족하다. (${sp.name} ${sp.mp})` }
  const now = Date.now()
  const paid = { ...state, player: { ...state.player, mp: state.player.mp - sp.mp } }
  const until = (cur?: number) => Math.max(cur ?? 0, now) + (sp.sec ?? 0) * 1000
  switch (id) {
    case 'teleport':
      return { ...paid, previousScreen: state.screen, screen: 'worldmap', toast: '순간이동 — 갈 곳을 고르세요.' }
    case 'pull': {
      const map = MAPS[state.currentMapId]
      const near = gatherNodesForMap(map).filter((n) => isNodeReady(state.life, n.key, now) && Math.hypot(n.cell.x - state.position.x, n.cell.y - state.position.y) <= PULL_RANGE)
      if (!near.length) return { ...state, toast: `주변 ${PULL_RANGE}칸 안에 끌어올 채집물이 없다.` }
      let next: GameState = paid
      const got: string[] = []
      for (const n of near) {
        next = gatherAt(next, n.key, PULL_RANGE + 0.5)
        if (next.toast?.startsWith('채집: ')) got.push(next.toast.slice(4))
      }
      return { ...next, pullFx: { at: now, cells: near.map((n) => n.cell) }, toast: got.length ? `끌어오기 — ${got.join(' / ')}` : next.toast }
    }
    case 'haste':
      return { ...paid, hasteUntil: until(state.hasteUntil), toast: `질주! ${sp.sec! / 60}분 동안 발이 빨라진다.` }
    case 'light':
      return { ...paid, lightUntil: until(state.lightUntil), toast: `등불! ${sp.sec! / 60}분 동안 주변이 밝아지고, 숨은 룬 상자가 빛기둥으로 드러난다.` }
    case 'vanish':
      return { ...paid, invisibleUntil: until(state.invisibleUntil), toast: `투명화! ${sp.sec! / 60}분 동안 몬스터가 알아채지 못한다.` }
  }
}

/** 이동 마법진을 밟았다고 보는 거리(셀)
/** 이동 마법진을 밟았다고 보는 거리(셀) — 그림(원판 지름 약 2셀)의 안쪽 금테 정도 */
const PORTAL_STEP_R = 0.6

/** 같은 좌표계의 위/아래층으로 걸어서 넘어간다 — 확인창·도착 토스트 없이 위치·방향 유지 */
function walkToFloor(state: GameState, portal: Portal, pos: { x: number; y: number }, facing: GameState['facing']): GameState {
  const destMap = MAPS[portal.to]
  return visitMap(
    {
      ...state,
      currentMapId: destMap.id,
      position: { ...pos },
      facing,
      currentZoneId: zoneAt(destMap, pos.x, pos.y)?.id ?? '',
      fieldMonsters: generateFieldMonsters(destMap, state.settings.testMode, state.monsterDefeats),
      pendingEncounterUid: null,
      pendingPortalId: null,
      gateOpen: false,
    },
    destMap.id,
  )
}

/** 포탈(타일/군 통문)을 통해 다른 맵으로 이동 */
function travelThroughPortal(state: GameState, portalId: string): GameState {
  const fromMap = MAPS[state.currentMapId]
  const portal = fromMap.portals.find((p) => p.id === portalId)
  if (!portal) return state
  const destMap = MAPS[portal.to]
  // 메인 스토리가 아직 닿지 않은 지역은 잠겨 있다
  const lock = mapLockReason(state, destMap.id)
  if (lock) return { ...state, pendingPortalId: null, gateOpen: false, toast: lock }
  // 처음 가는 길이면 건너는 연출부터(통과하면 PASSAGE_DONE 이 다시 이 함수를 부른다)
  const passage = passageFor(state, destMap.id)
  if (passage) return { ...state, pendingPortalId: null, gateOpen: false, passage: { id: passage.id, portalId } }
  const pos = portal.toSpawn ?? destMap.spawn
  // 방문 = VISIT 미션 + 첫 진입 스토리 비트
  return visitMap(
    {
      ...state,
      currentMapId: destMap.id,
      position: { ...pos },
      facing: 'down',
      currentZoneId: zoneAt(destMap, pos.x, pos.y)?.id ?? '',
      fieldMonsters: generateFieldMonsters(destMap, state.settings.testMode, state.monsterDefeats),
      pendingEncounterUid: null,
      pendingPortalId: null,
      gateOpen: false,
      toast: `${destMap.name}에 도착했다.`,
    },
    destMap.id,
  )
}

function leaveBattle(
  state: GameState,
  resolved: GameState['battle'],
  inventory: GameState['inventory'],
  toast: string,
): GameState {
  const heroC = resolved?.combatants.find((c) => c.uid === 'hero')
  return {
    ...state,
    inventory,
    player: heroC ? { ...state.player, hp: Math.max(1, heroC.hp), mp: heroC.mp } : state.player,
    battle: null,
    screen: 'world',
    toast,
  }
}

/** 콜로세움 대전 끝 — HP·동료·펫은 대전 전 그대로(콜로세움이 치료), 콜로세움 창으로 돌아가 결과를 보고한다 */
function endArenaBattle(state: GameState, won: boolean): GameState {
  const match = state.battle?.pvp
  if (!match) return state
  return { ...state, battle: null, activeNpcId: 'npc-arena', screen: 'arena', arenaResult: { match, won } }
}

/** 개인 공간에 놓인 무기 거치대(샌드백) 근처인가 */
export function nearSandbag(state: Pick<GameState, 'currentMapId' | 'housing' | 'position'>): boolean {
  if (state.currentMapId !== 'personal-space') return false
  return state.housing.placed.some((p) => p.defId === 'weaponrack' && Math.hypot(p.cell.x - state.position.x, p.cell.y - state.position.y) < 1.7)
}

function startBattleFromField(state: GameState, fieldMonsterUid: string): GameState {
  const fm = state.fieldMonsters.find((f) => f.uid === fieldMonsterUid)
  if (!fm) return state
  const primaryDef = MONSTERS.find((m) => m.id === fm.monsterId)
  if (!primaryDef) return state

  // 4대4 — 접촉한 몬스터 + 같은 지역 무리(일반 2~4마리 / 보스는 호위 2마리)
  const monsterDefs = [primaryDef]
  if (!primaryDef.isTestMonster) {
    // 무리는 '이 맵에 실제로 사는 몬스터' 중에서, 맵 권장 레벨 +2 를 넘지 않게(2026-10-18).
    // 예전엔 같은 지형 종류 전체에서 뽑아 첫 숲(권장 Lv.3)의 Lv.1 들쥐 옆에 Lv.9 늑대·Lv.15 나무 골렘이 붙어 Lv.1~3 이 거의 졌다.
    const mapIds = new Set(state.fieldMonsters.map((f) => f.monsterId))
    const cap = Math.max(primaryDef.level, MAPS[state.currentMapId]?.recommendedLevel ?? primaryDef.level) + 2
    const fits = (m: (typeof MONSTERS)[number]) => !m.isTestMonster && !isBossRank(m.rank) && m.level <= cap
    let pool = MONSTERS.filter((m) => fits(m) && mapIds.has(m.id))
    if (!pool.length) pool = MONSTERS.filter((m) => fits(m) && m.zoneKinds.some((k) => primaryDef.zoneKinds.includes(k)))
    const extra = isBossRank(primaryDef.rank) ? 2 : 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < extra && pool.length > 0 && monsterDefs.length < MAX_ENEMIES; i++) {
      monsterDefs.push(pool[Math.floor(Math.random() * pool.length)])
    }
  }

  // 핵심 전투원 4명(주인공 + 학교 NPC 3) + 포지션 + 전위 주인의 펫, 사냥 해금 여부
  const ready = ensureParty(state)
  const battle = initBattle(battleParty(ready), monsterDefs, state.position, fieldMonsterUid, {
    huntEnabled: isActivityUnlocked(state, 'hunting'),
  })
  return { ...ready, previousScreen: state.screen, screen: 'battle', battle }
}

/** 스토리 장면이 여는 보스전 — 호위 없이 지정한 몬스터만(장면의 battle.monsterIds) */
function startStoryBattle(state: GameState, beatId: string, monsterIds: string[], scripted?: { endAfter: number; flag: string; endLine: string }): GameState {
  const defs = monsterIds.map((id) => MONSTERS.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  if (!defs.length) return state
  const ready = ensureParty(state)
  const battle = initBattle(battleParty(ready), defs, state.position, undefined, { huntEnabled: isActivityUnlocked(state, 'hunting') })
  // 연출 전투(요르문간드 등) — 흑룡전과 같은 규칙: 적이 endAfter 번 행동하면 중단 → flag
  if (scripted) return { ...ready, previousScreen: state.screen, screen: 'battle', battle: { ...battle, scripted: { ...scripted, enemyTurns: 0 } } }
  return { ...ready, previousScreen: state.screen, screen: 'battle', battle: { ...battle, storyBeatId: beatId } }
}

/** 흑룡전(lib/black-dragon) — 이길 수 없는 연출 전투. DRAGON_ROUNDS 번 버티면 중단 → DRAGON_FOUGHT */
function startDragonBattle(state: GameState): GameState {
  const def = MONSTERS.find((m) => m.id === BLACK_DRAGON_ID)
  if (!def) return state
  const ready = ensureParty(state)
  const battle = initBattle(battleParty(ready), [def], state.position, undefined, { huntEnabled: false })
  return {
    ...ready,
    previousScreen: state.screen,
    screen: 'battle',
    battle: { ...battle, scripted: { endAfter: DRAGON_ROUNDS, enemyTurns: 0, flag: DRAGON_FLAGS.fought, endLine: '하늘이 갈라지는 굉음 — 누군가 흑룡과 일행 사이에 내려섰다!' } },
  }
}

/** 스토리 보스전에서 지거나 도망치면 그 장면을 다시 볼 수 있게(같은 곳에 다시 가면 재도전) */
function reopenStoryBattle(state: GameState, battle: GameState['battle']): GameState {
  const id = battle?.storyBeatId
  if (!id) return state
  const storyFlags = { ...state.storyFlags }
  delete storyFlags[`beat:${id}`]
  return { ...state, storyFlags, toast: `${state.toast ? state.toast + ' ' : ''}같은 장소에 다시 가면 재도전할 수 있다.` }
}

function updateFieldMonstersAfterVictory(fieldMonsters: GameState['fieldMonsters'], uid: string) {
  const fm = fieldMonsters.find((f) => f.uid === uid)
  if (!fm) return fieldMonsters
  const def = MONSTERS.find((m) => m.id === fm.monsterId)
  if (def?.isTestMonster) return fieldMonsters
  return fieldMonsters.filter((f) => f.uid !== uid)
}

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<Action> } | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialGameState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  // 자동 저장 — 상태가 1.5초간 멈추면 저장(이동 중 매 프레임 직렬화 방지). 전투 중엔 저장하지 않는다.
  useEffect(() => {
    if (state.screen === 'battle' || state.screen === 'title' || state.screen === 'create') return
    const id = window.setTimeout(() => writeSave(state), 1500)
    return () => window.clearTimeout(id)
  }, [state])
  if ((process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_HOOKS === '1') && typeof window !== 'undefined') {
    ;(window as unknown as { __game?: typeof value }).__game = value
    // 생활 시스템 디버그 — 채집 노드 좌표 등(크롬 자동화 테스트용)
    ;(window as unknown as { __life?: unknown }).__life = { gatherNodesForMap, isNearWater, MAPS, NPCS }
  }
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { MAX_PARTY_SIZE, NPCS, ITEMS, npcById }
