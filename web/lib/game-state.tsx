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
import { MAPS, zoneAt } from '@/lib/maps'
import { beatById } from '@/lib/story'
import { teleportBlockReason } from '@/lib/teleport'
import { FURNITURE_BY_ID } from '@/lib/housing'
import { FACING_CELL_VEC, facingFromCellDelta } from '@/lib/iso'
import { ITEMS, MONSTERS, NPCS, SKILLS, isBossRank, isStudentSkill, itemById, monsterById, npcById, recipeById } from '@/lib/mock-data'
import { MAX_LEVEL } from '@/lib/exp-table'
import { createInitialGameState, createPlayer, createStarterPet } from '@/lib/player-factory'
import { generateFieldMonsters, wanderState } from '@/lib/field'
import { getEffectiveStats } from '@/lib/derived'
import { canTrain, clampAffection, createPet, petDefById, petStatsForLevel, PET_DEFS } from '@/lib/pets'
import {
  advanceTurn,
  awaitsPlayerInput,
  checkBattleEnd,
  currentActor,
  initBattle,
  resolveAction,
  resolveEnemyTurn,
  tickAtb,
} from '@/lib/battle-engine'
import { addToInventory, consumeIngredients, removeFromInventory } from '@/lib/inventory'
import { ACTIVITY_META, activityUnlockLabel, gatherNodesForMap, isActivityUnlocked, isNearWater, RECIPE_CATEGORY_ACTIVITY } from '@/lib/life'
import {
  adminSetWeek,
  afterBattleDefeat,
  afterBattleFled,
  afterBattleVictory,
  acceptQuest,
  addGuest,
  classBeginGames,
  classGameDone,
  dropQuest,
  finishClass,
  setMemberPet,
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
import { COMBAT_NPCS } from '@/lib/companions'
import { mergeSave, migrateLoadedState, writeSave } from '@/lib/save'

export type Action =
  | { type: 'START_GAME'; name: string; appearance: Partial<PlayerAppearance>; starterPetId: string }
  | { type: 'SET_SCREEN'; screen: ScreenId }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'OPEN_NPC'; npcId: string }
  | { type: 'OPEN_SHOP'; npcId: string }
  | { type: 'OPEN_TAMER'; npcId: string }
  | { type: 'OPEN_CRAFT'; npcId: string }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'SELL_ITEM'; itemId: string }
  | { type: 'CRAFT_ITEM'; recipeId: string }
  | { type: 'USE_ITEM_FIELD'; itemId: string }
  | { type: 'PET_TRAIN'; skillId: string }
  | { type: 'REST' }
  | { type: 'EQUIP_ITEM'; itemId: string; slot: EquipSlot }
  | { type: 'UNEQUIP_ITEM'; slot: EquipSlot }
  | { type: 'TOGGLE_EQUIP_SKILL'; skillId: string }
  | { type: 'SET_ACTIVE_PET'; defId: string }
  | { type: 'START_BATTLE'; fieldMonsterUid: string }
  | { type: 'ENCOUNTER_FIGHT' }
  | { type: 'ENCOUNTER_FLEE' }
  | { type: 'USE_PORTAL'; portalId: string }
  | { type: 'PORTAL_CONFIRM' }
  | { type: 'PORTAL_CANCEL' }
  | { type: 'TELEPORT'; mapId: MapId }
  | { type: 'HOUSING_TOGGLE_EDIT' }
  | { type: 'HOUSING_PLACE'; defId: string }
  | { type: 'HOUSING_REMOVE'; id: string }
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
  | { type: 'ADMIN_GRANT_ALL_PETS' }
  | { type: 'ADMIN_SET_ACTIVE_PET'; defId: string }
  | { type: 'ADMIN_HEAL_FULL' }
  | { type: 'ADMIN_RESPAWN_MONSTERS' }
  // ── 4년제 학사·생활·동료 ────────────────────────────────────────────────────
  | { type: 'LOAD_GAME'; saved: Partial<GameState> }
  | { type: 'CLAIM_QUEST'; instanceId: string }
  | { type: 'END_WEEK' }
  | { type: 'DISMISS_STORY' }
  | { type: 'STORY_CHOICE'; setFlags: string[] }
  | { type: 'SET_FLAG'; flag: string; value?: boolean | number }
  | { type: 'GATHER'; nodeKey: string }
  | { type: 'START_FISHING' }
  | { type: 'FISHING_RESULT'; success: boolean }
  | { type: 'RECRUIT_COMPANION'; companionId: string }
  | { type: 'TOGGLE_PARTY_MEMBER'; companionId: string }
  | { type: 'SWAP_PARTY_MEMBER'; slot: number; companionId: string }
  | { type: 'SET_POSITION'; memberId: string; position: Position }
  | { type: 'USE_EXP_CANDY'; itemId: string; targetId: string }
  | { type: 'ADD_GUEST'; guestId: string }
  | { type: 'REMOVE_GUEST'; guestId: string }
  | { type: 'BATTLE_SET_AUTO'; auto: boolean }
  | { type: 'ACCEPT_QUEST'; instanceId: string }
  | { type: 'SET_MEMBER_PET'; memberId: string; defId: string | null }
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

const BODY_R = 0.24 // 캐릭터 반경(셀) — 이 만큼 건물 벽에서 떨어져 선다
function blockedAt(state: GameState, mapId: GameState['currentMapId'], x: number, y: number): boolean {
  const hits = (r: { x0: number; y0: number; x1: number; y1: number }) =>
    x > r.x0 - BODY_R && x < r.x1 + BODY_R && y > r.y0 - BODY_R && y < r.y1 + BODY_R
  const map = MAPS[mapId]
  const b = map.blockers
  if (b && b.some(hits)) return true
  // 야생맵 용암 웅덩이는 밟을 수 없다(물·얼음은 얕은 물가로 보고 통과 허용)
  if (map.kind === 'field' && map.tileAt?.(x, y) === 'demon-lava') return true
  // 개인 공간 가구 — 플레이어가 배치한 가구도 충돌 처리(정적 blockers 에는 없음)
  if (mapId === 'personal-space') {
    for (const f of state.housing.placed) {
      const def = FURNITURE_BY_ID[f.defId]
      if (!def) continue
      const hw = def.sprite.fw / 2
      const hd = def.sprite.fd / 2
      if (hits({ x0: f.cell.x - hw, y0: f.cell.y - hd, x1: f.cell.x + hw, y1: f.cell.y + hd })) return true
    }
  }
  return false
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const player = createPlayer(action.name, action.appearance)
      const pet = createStarterPet(action.starterPetId)
      const fieldMonsters = generateFieldMonsters(MAPS.village, state.settings.testMode)
      // 새 게임 — 1학년 1학기 1주차부터(주간 퀘스트 생성 + 입학 스토리 비트 큐잉)
      return newGameProgress({
        ...state,
        player,
        pet,
        ownedPets: [pet],
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
      return ensureWeek({
        ...loaded,
        currentMapId: map.id,
        fieldMonsters: generateFieldMonsters(map, loaded.settings.testMode),
        screen: 'world',
        previousScreen: 'world',
        toast: '이어서 시작합니다.',
      })
    }

    case 'CLAIM_QUEST':
      return claimQuest(state, action.instanceId)

    case 'ACCEPT_QUEST':
      return acceptQuest(state, action.instanceId)

    case 'SET_MEMBER_PET':
      return setMemberPet(state, action.memberId, action.defId)

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
      return head?.battle ? startStoryBattle(next, head.id, head.battle.monsterIds) : next
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

    case 'SET_ACTIVE_PET': {
      const found = state.ownedPets.find((p) => p.defId === action.defId)
      if (!found) return state
      return { ...state, pet: found, toast: `${found.nickname}을(를) 데리고 다닙니다. (고정 펫 슬롯으로 함께 싸웁니다)` }
    }

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
        state.storyQueue.length > 0
      )
        return state
      const map = MAPS[state.currentMapId]
      const clampX = (v: number) => Math.max(0.2, Math.min(map.grid.w - 0.2, v))
      const clampY = (v: number) => Math.max(0.2, Math.min(map.grid.h - 0.2, v))
      const ox = state.position.x
      const oy = state.position.y
      // 건물 충돌: 대각선이 막히면 x/y 축으로 슬라이드
      let nx = clampX(ox + action.dx)
      let ny = clampY(oy + action.dy)
      if (blockedAt(state, state.currentMapId, nx, ny)) {
        const slideX = clampX(ox + action.dx)
        const slideY = clampY(oy + action.dy)
        if (!blockedAt(state, state.currentMapId, slideX, oy)) {
          nx = slideX
          ny = oy
        } else if (!blockedAt(state, state.currentMapId, ox, slideY)) {
          nx = ox
          ny = slideY
        } else {
          nx = ox
          ny = oy
        }
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
        const at = wanderState(fm, performance.now(), map.blockers, { x: nx, y: ny }).pos
        const d = Math.hypot(at.x - nx, at.y - ny)
        if (d < radius) {
          touched = fm.uid
          break
        }
      }
      // 접촉 시 전투를 바로 시작하지 않고 '전투/피하기'를 먼저 묻는다. 이동은 정지.
      if (touched) return { ...state, facing, pendingEncounterUid: touched }

      // 포탈 타일 접촉 — 이동 여부 확인 (군 통문 gate 는 클릭 전용이라 제외)
      for (const p of map.portals) {
        if (p.kind === 'gate' || p.secret) continue
        if (p.walkArea) {
          const a = p.walkArea
          if (nx >= a.x0 && nx <= a.x1 && ny >= a.y0 && ny <= a.y1) return walkToFloor(state, p, { x: nx, y: ny }, facing)
          continue
        }
        const d = Math.hypot(p.cell.x - nx, p.cell.y - ny)
        if (d < 0.45) return { ...state, facing, pendingPortalId: p.id }
      }

      return {
        ...state,
        position: { x: nx, y: ny },
        facing,
        currentZoneId: zone?.id ?? state.currentZoneId,
      }
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

    case 'PORTAL_CONFIRM':
      return state.pendingPortalId ? travelThroughPortal(state, state.pendingPortalId) : state

    case 'TELEPORT':
      return teleportTo(state, action.mapId)

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
      return { ...state, housing: { ...state.housing, editMode: !state.housing.editMode } }
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
      const cell = { x: Math.round((state.position.x + off.x) * 2) / 2, y: Math.round((state.position.y + off.y) * 2) / 2 }
      if (blockedAt(state, 'personal-space', cell.x, cell.y)) return state
      const placed = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, defId: action.defId, cell }
      return withQuestEvents({ ...state, housing: { ...state.housing, placed: [...state.housing.placed, placed] } }, [{ type: 'PLACE_FURNITURE' }])
    }

    case 'HOUSING_REMOVE': {
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode) return state
      return { ...state, housing: { ...state.housing, placed: state.housing.placed.filter((p) => p.id !== action.id) } }
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

    case 'OPEN_TAMER':
      return { ...state, activeNpcId: action.npcId, previousScreen: state.screen, screen: 'tamer' }

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
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold + item.sellPrice },
        inventory: removeFromInventory(state.inventory, action.itemId, 1),
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

      if (item.type === 'feed' && item.useEffect.petAffection) {
        const def = petDefById(state.pet.defId)
        const liked = !item.feedElement || item.feedElement === def?.element
        const gain = liked ? item.useEffect.petAffection : Math.round(item.useEffect.petAffection * 0.5)
        const pet = { ...state.pet, affection: clampAffection(state.pet.affection + gain) }
        return {
          ...state,
          pet,
          ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
          inventory: removeFromInventory(state.inventory, action.itemId, 1),
          toast: `${state.pet.nickname}의 호감도가 ${gain} 올랐다. (${pet.affection}%)`,
        }
      }

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

    case 'PET_TRAIN': {
      const def = petDefById(state.pet.defId)
      const t = def?.trainableSkills.find((s) => s.skillId === action.skillId)
      if (!t) return state
      const check = canTrain(state.pet, action.skillId, state.player.gold, (id) =>
        state.inventory.some((s) => s.itemId === id),
      )
      if (!check.ok) return { ...state, toast: check.reason ?? '훈련할 수 없습니다.' }
      let inventory = state.inventory
      if (t.costItemId) inventory = removeFromInventory(inventory, t.costItemId, 1)
      const pet = { ...state.pet, learnedSkills: [...state.pet.learnedSkills, action.skillId] }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - t.costGold },
        pet,
        ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
        inventory,
        toast: '펫이 새 스킬을 배웠다!',
      }
    }

    case 'REST': {
      const eff = getEffectiveStats(state.player)
      const petDef = petDefById(state.pet.defId)
      const petMax = petDef ? petStatsForLevel(petDef, state.pet.level) : null
      const pet = petMax
        ? { ...state.pet, hp: petMax.maxHp, mp: petMax.maxMp }
        : state.pet
      return healCompanions({
        ...state,
        player: { ...state.player, hp: eff.maxHp, mp: eff.maxMp },
        pet,
        ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
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
        position: { ...map.spawn },
        facing: 'down',
        fieldMonsters: generateFieldMonsters(map, state.settings.testMode),
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
      if (!has && !isStudentSkill(SKILLS.find((s) => s.id === action.skillId)!)) return state // 펫·모르스 전용은 배울 수 없다
      const learnedSkills = has
        ? state.player.learnedSkills.filter((id) => id !== action.skillId)
        : [...state.player.learnedSkills, action.skillId]
      const equippedSkills = has
        ? state.player.equippedSkills.filter((id) => id !== action.skillId)
        : state.player.equippedSkills.length < 8
          ? [...state.player.equippedSkills, action.skillId]
          : state.player.equippedSkills
      return { ...state, player: { ...state.player, learnedSkills, equippedSkills } }
    }

    case 'ADMIN_LEARN_ALL_SKILLS': {
      // 학생이 배울 수 있는 스킬 전부(바람·펫 전용 제외)
      const learnedSkills = SKILLS.filter(isStudentSkill).map((s) => s.id)
      return { ...state, player: { ...state.player, learnedSkills, equippedSkills: learnedSkills.slice(0, 8) } }
    }

    case 'ADMIN_CLEAR_SKILLS':
      return { ...state, player: { ...state.player, learnedSkills: [], equippedSkills: [] } }

    case 'ADMIN_GIVE_ALL_ITEMS': {
      const inventory = ITEMS.map((i) => ({ itemId: i.id, qty: i.stackable ? 99 : 1 }))
      return { ...state, inventory }
    }

    case 'ADMIN_SET_GOLD':
      return { ...state, player: { ...state.player, gold: Math.max(0, Math.round(action.gold)) } }

    case 'ADMIN_GRANT_ALL_PETS': {
      const ownedPets = PET_DEFS.map((d) => createPet(d.id, { level: state.player.level, affection: 80 }))
      const pet = ownedPets.find((p) => p.defId === state.pet.defId) ?? ownedPets[0] ?? state.pet
      return { ...state, ownedPets, pet }
    }

    case 'ADMIN_SET_ACTIVE_PET': {
      const found = state.ownedPets.find((p) => p.defId === action.defId)
      if (!found) return state
      return { ...state, pet: found }
    }

    case 'ADMIN_HEAL_FULL': {
      const stats = state.player.stats
      const petDef = petDefById(state.pet.defId)
      const petStats = petDef ? petStatsForLevel(petDef, state.pet.level) : null
      return {
        ...state,
        player: { ...state.player, hp: stats.maxHp, mp: stats.maxMp },
        pet: petStats ? { ...state.pet, hp: petStats.maxHp, mp: petStats.maxMp } : state.pet,
      }
    }

    case 'ADMIN_RESPAWN_MONSTERS':
      return { ...state, fieldMonsters: generateFieldMonsters(MAPS[state.currentMapId], state.settings.testMode) }

    case 'TOGGLE_TEST_MODE': {
      const testMode = !state.settings.testMode
      return {
        ...state,
        settings: { ...state.settings, testMode },
        fieldMonsters: generateFieldMonsters(MAPS[state.currentMapId], testMode),
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

    case 'BATTLE_ACTOR_ACTION': {
      if (!state.battle) return state
      const { battle: resolved, itemConsumed, fled } = resolveAction(state.battle, action.actorUid, action.action)
      let inventory = state.inventory
      if (itemConsumed) inventory = removeFromInventory(inventory, itemConsumed, 1)
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
      const resolved = resolveEnemyTurn(state.battle, actor.uid)
      const ended = checkBattleEnd(resolved)
      const next = ended.isOver ? ended : advanceTurn(ended)
      return { ...state, battle: next }
    }

    case 'BATTLE_END_CONTINUE': {
      if (!state.battle) return state
      const heroC = state.battle.combatants.find((c) => c.uid === 'hero')
      const petC = state.battle.combatants.find((c) => c.uid === 'pet')

      if (state.battle.victory) {
        const prevLevel = state.player.level
        let inventory = state.inventory
        for (const id of state.battle.rewardDrops ?? []) inventory = addToInventory(inventory, id, 1)

        const fieldMonsters = state.battle.fieldMonsterUid
          ? updateFieldMonstersAfterVictory(state.fieldMonsters, state.battle.fieldMonsterUid)
          : state.fieldMonsters

        // 펫은 실제로 싸웠을 때(주인공 전위)만 HP 반영·호감도 상승
        const pet = petC
          ? { ...state.pet, hp: Math.max(1, petC.hp), mp: petC.mp, affection: clampAffection(state.pet.affection + 2) }
          : state.pet

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
            pet,
            ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
            inventory,
            fieldMonsters,
            battle: null,
            screen: 'world',
            toast: newLevel > prevLevel ? `레벨 업! Lv.${newLevel}` : null,
          },
          state.battle,
        )
      }

      const village = MAPS.village
      const respawnPos = village.respawn ?? village.spawn
      const pet = { ...state.pet, hp: Math.max(1, Math.round(state.pet.hp * 0.2)) }
      return reopenStoryBattle(afterBattleDefeat({
        ...state,
        player: { ...state.player, hp: 1, mp: Math.max(1, Math.round(state.player.stats.maxMp * 0.2)) },
        pet,
        ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
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
      fieldMonsters: generateFieldMonsters(dest, state.settings.testMode),
      pendingEncounterUid: null,
      pendingPortalId: null,
      gateOpen: false,
      toast: `텔레포트 — ${dest.name}`,
    },
    dest.id,
  )
}

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
      fieldMonsters: generateFieldMonsters(destMap, state.settings.testMode),
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
  const pos = portal.toSpawn ?? destMap.spawn
  // 방문 = VISIT 미션 + 첫 진입 스토리 비트
  return visitMap(
    {
      ...state,
      currentMapId: destMap.id,
      position: { ...pos },
      facing: 'down',
      currentZoneId: zoneAt(destMap, pos.x, pos.y)?.id ?? '',
      fieldMonsters: generateFieldMonsters(destMap, state.settings.testMode),
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
  const petC = resolved?.combatants.find((c) => c.uid === 'pet')
  const pet = petC ? { ...state.pet, hp: Math.max(1, petC.hp), mp: petC.mp } : state.pet
  return {
    ...state,
    inventory,
    player: heroC ? { ...state.player, hp: Math.max(1, heroC.hp), mp: heroC.mp } : state.player,
    pet,
    ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
    battle: null,
    screen: 'world',
    toast,
  }
}

function startBattleFromField(state: GameState, fieldMonsterUid: string): GameState {
  const fm = state.fieldMonsters.find((f) => f.uid === fieldMonsterUid)
  if (!fm) return state
  const primaryDef = MONSTERS.find((m) => m.id === fm.monsterId)
  if (!primaryDef) return state

  // 4대4 — 접촉한 몬스터 + 같은 지역 무리(일반 2~4마리 / 보스는 호위 2마리)
  const monsterDefs = [primaryDef]
  if (!primaryDef.isTestMonster) {
    const pool = MONSTERS.filter(
      (m) => !m.isTestMonster && !isBossRank(m.rank) && m.zoneKinds.some((k) => primaryDef.zoneKinds.includes(k)),
    )
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
function startStoryBattle(state: GameState, beatId: string, monsterIds: string[]): GameState {
  const defs = monsterIds.map((id) => MONSTERS.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  if (!defs.length) return state
  const ready = ensureParty(state)
  const battle = initBattle(battleParty(ready), defs, state.position, undefined, { huntEnabled: isActivityUnlocked(state, 'hunting') })
  return { ...ready, previousScreen: state.screen, screen: 'battle', battle: { ...battle, storyBeatId: beatId } }
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
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    ;(window as unknown as { __game?: typeof value }).__game = value
    // 생활 시스템 디버그 — 채집 노드 좌표 등(크롬 자동화 테스트용)
    ;(window as unknown as { __life?: unknown }).__life = { gatherNodesForMap, isNearWater, MAPS }
  }
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { MAX_PARTY_SIZE, NPCS, ITEMS, npcById }
