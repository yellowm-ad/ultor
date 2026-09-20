'use client'

import React, { createContext, useContext, useMemo, useReducer } from 'react'
import type {
  BattleAction as EngineBattleAction,
  Element,
  EquipSlot,
  GameState,
  Gender,
  ScreenId,
} from '@/lib/types'
import {
  JOB_TIER_ORDER,
  MAX_PARTY_SIZE,
  jobTierForLevel,
  jobTierAtLeast,
  computeStatsForLevel,
} from '@/lib/constants'
import { MAPS, zoneAt } from '@/lib/maps'
import { FURNITURE_BY_ID } from '@/lib/housing'
import { ITEMS, MONSTERS, NPCS, SKILLS, autoLearnSkillIds, itemById, monsterById, npcById, recipeById } from '@/lib/mock-data'
import { applyExp } from '@/lib/exp-table'
import { createInitialGameState, createPlayer, createStarterPet } from '@/lib/player-factory'
import { generateFieldMonsters } from '@/lib/field'
import { getEffectiveStats } from '@/lib/derived'
import { canTrain, clampAffection, createPet, petDefById, petStatsForLevel, PET_DEFS } from '@/lib/pets'
import {
  advanceTurn,
  checkBattleEnd,
  currentActor,
  initBattle,
  resolveAction,
  resolveEnemyTurn,
  tickAtb,
} from '@/lib/battle-engine'

export type Action =
  | { type: 'START_GAME'; name: string; element: Element; gender: Gender }
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
  | { type: 'JOB_CHANGE' }
  | { type: 'START_BATTLE'; fieldMonsterUid: string }
  | { type: 'ENCOUNTER_FIGHT' }
  | { type: 'ENCOUNTER_FLEE' }
  | { type: 'USE_PORTAL'; portalId: string }
  | { type: 'PORTAL_CONFIRM' }
  | { type: 'PORTAL_CANCEL' }
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
  | { type: 'ADMIN_SET_ELEMENT'; element: Element }
  | { type: 'ADMIN_SET_GENDER'; gender: Gender }
  | { type: 'ADMIN_TOGGLE_SKILL'; skillId: string }
  | { type: 'ADMIN_LEARN_ALL_SKILLS' }
  | { type: 'ADMIN_CLEAR_SKILLS' }
  | { type: 'ADMIN_GIVE_ALL_ITEMS' }
  | { type: 'ADMIN_SET_GOLD'; gold: number }
  | { type: 'ADMIN_GRANT_ALL_PETS' }
  | { type: 'ADMIN_SET_ACTIVE_PET'; defId: string }
  | { type: 'ADMIN_HEAL_FULL' }
  | { type: 'ADMIN_RESPAWN_MONSTERS' }

function addToInventory(inv: GameState['inventory'], itemId: string, qty = 1) {
  const idx = inv.findIndex((s) => s.itemId === itemId)
  if (idx >= 0) {
    const copy = [...inv]
    copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
    return copy
  }
  return [...inv, { itemId, qty }]
}

function removeFromInventory(inv: GameState['inventory'], itemId: string, qty = 1) {
  const idx = inv.findIndex((s) => s.itemId === itemId)
  if (idx < 0) return inv
  const copy = [...inv]
  const remaining = copy[idx].qty - qty
  if (remaining <= 0) copy.splice(idx, 1)
  else copy[idx] = { ...copy[idx], qty: remaining }
  return copy
}

function refreshLearnedSkills(element: string, level: number, tierId: string): string[] {
  return autoLearnSkillIds(element, level, JOB_TIER_ORDER.indexOf(tierId as never))
}

const BODY_R = 0.24 // 캐릭터 반경(셀) — 이 만큼 건물 벽에서 떨어져 선다
function blockedAt(state: GameState, mapId: GameState['currentMapId'], x: number, y: number): boolean {
  const hits = (r: { x0: number; y0: number; x1: number; y1: number }) =>
    x > r.x0 - BODY_R && x < r.x1 + BODY_R && y > r.y0 - BODY_R && y < r.y1 + BODY_R
  const b = MAPS[mapId].blockers
  if (b && b.some(hits)) return true
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
      const player = createPlayer(action.name, action.element, action.gender)
      const pet = createStarterPet(action.element)
      const fieldMonsters = generateFieldMonsters(MAPS.village, state.settings.testMode)
      return {
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
      }
    }

    case 'SET_SCREEN': {
      if (action.screen === state.screen) return state
      return { ...state, previousScreen: state.screen, screen: action.screen }
    }

    case 'MOVE': {
      if (
        state.screen !== 'world' ||
        state.battle ||
        state.pendingEncounterUid ||
        state.pendingPortalId ||
        state.gateOpen
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
      const facing =
        Math.abs(action.dx) > Math.abs(action.dy)
          ? action.dx > 0
            ? 'right'
            : 'left'
          : action.dy > 0
            ? 'down'
            : action.dy < 0
              ? 'up'
              : state.facing

      const CONTACT_RADIUS = 0.32
      let touched: string | null = null
      for (const fm of state.fieldMonsters) {
        const rank = monsterById(fm.monsterId)?.rank
        // 보스는 덩치가 큰 만큼 접촉 판정도 넉넉하게(필드보스가 가장 큼, 스프라이트 축소에 맞춰 비례 완화)
        const radius = rank === 'fieldBoss' ? CONTACT_RADIUS * 1.84 : rank === 'midBoss' ? CONTACT_RADIUS * 1.35 : CONTACT_RADIUS
        const d = Math.hypot(fm.homeCell.x - nx, fm.homeCell.y - ny)
        if (d < radius) {
          touched = fm.uid
          break
        }
      }
      // 접촉 시 전투를 바로 시작하지 않고 '전투/피하기'를 먼저 묻는다. 이동은 정지.
      if (touched) return { ...state, facing, pendingEncounterUid: touched }

      // 포탈 타일 접촉 — 이동 여부 확인 (군 통문 gate 는 클릭 전용이라 제외)
      for (const p of map.portals) {
        if (p.kind === 'gate') continue
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
        const dx = state.position.x - fm.homeCell.x
        const dy = state.position.y - fm.homeCell.y
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
      return travelThroughPortal(state, action.portalId)

    case 'PORTAL_CONFIRM':
      return state.pendingPortalId ? travelThroughPortal(state, state.pendingPortalId) : state

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
        state.facing === 'up' ? { x: 0, y: -0.9 } : state.facing === 'down' ? { x: 0, y: 0.9 } : state.facing === 'left' ? { x: -0.9, y: 0 } : { x: 0.9, y: 0 }
      const cell = { x: Math.round((state.position.x + off.x) * 2) / 2, y: Math.round((state.position.y + off.y) * 2) / 2 }
      if (blockedAt(state, 'personal-space', cell.x, cell.y)) return state
      const placed = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, defId: action.defId, cell }
      return { ...state, housing: { ...state.housing, placed: [...state.housing.placed, placed] } }
    }

    case 'HOUSING_REMOVE': {
      if (state.currentMapId !== 'personal-space' || !state.housing.editMode) return state
      return { ...state, housing: { ...state.housing, placed: state.housing.placed.filter((p) => p.id !== action.id) } }
    }

    case 'OPEN_NPC':
      return { ...state, activeNpcId: action.npcId, previousScreen: state.screen, screen: 'dialogue' }

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
      const hasAll = recipe.ingredients.every((ing) => {
        const slot = state.inventory.find((s) => s.itemId === ing.itemId)
        return (slot?.qty ?? 0) >= ing.quantity
      })
      if (!hasAll) return { ...state, toast: '재료가 부족합니다.' }
      let inventory = state.inventory
      for (const ing of recipe.ingredients) inventory = removeFromInventory(inventory, ing.itemId, ing.quantity)
      inventory = addToInventory(inventory, recipe.outputItemId, recipe.outputQuantity)
      const output = itemById(recipe.outputItemId)
      return { ...state, inventory, toast: `${output?.name ?? '아이템'}을(를) 제작했습니다.` }
    }

    case 'USE_ITEM_FIELD': {
      const item = itemById(action.itemId)
      const slot = state.inventory.find((s) => s.itemId === action.itemId)
      if (!item?.useEffect || !slot) return state

      if (item.type === 'feed' && item.useEffect.petAffection) {
        const def = petDefById(state.pet.defId)
        const liked = item.feedElement === 'neutral' || item.feedElement === def?.element
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
      return {
        ...state,
        player: { ...state.player, hp: eff.maxHp, mp: eff.maxMp },
        pet,
        ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
        activeNpcId: null,
        screen: 'world',
        toast: '기숙사에서 충분히 쉬었다. 파티 전원의 HP·MP가 모두 회복되었다.',
      }
    }

    case 'EQUIP_ITEM': {
      const item = itemById(action.itemId)
      if (!item) return state
      if (item.requiredJobTier && !jobTierAtLeast(state.player.jobTierId, item.requiredJobTier)) {
        return { ...state, toast: '전직 단계가 부족하여 착용할 수 없습니다.' }
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

    case 'JOB_CHANGE': {
      const eligible = jobTierForLevel(state.player.level)
      if (eligible.id === state.player.jobTierId) return { ...state, toast: '아직 전직할 수 없습니다.' }
      const learned = refreshLearnedSkills(state.player.element, state.player.level, eligible.id)
      return {
        ...state,
        player: {
          ...state.player,
          jobTierId: eligible.id,
          learnedSkills: Array.from(new Set([...state.player.learnedSkills, ...learned])),
        },
        toast: `${eligible.name}(으)로 전직했습니다!`,
      }
    }

    // ── 관리자 테스트룸(/admin) 전용 액션 — 저장 데이터가 없는 순수 샌드박스이므로
    // 밸런스·검증 없이 즉시 원하는 상태로 만든다 ──────────────────────────────
    case 'ADMIN_ENTER_TESTROOM': {
      const map = MAPS.testroom
      return {
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
      }
    }

    case 'ADMIN_SET_LEVEL': {
      const level = Math.max(1, Math.min(50, Math.round(action.level)))
      const stats = computeStatsForLevel(state.player.element, level)
      return {
        ...state,
        player: {
          ...state.player,
          level,
          exp: 0,
          jobTierId: jobTierForLevel(level).id,
          stats,
          hp: stats.maxHp,
          mp: stats.maxMp,
        },
      }
    }

    case 'ADMIN_SET_ELEMENT': {
      const stats = computeStatsForLevel(action.element, state.player.level)
      return { ...state, player: { ...state.player, element: action.element, stats, hp: stats.maxHp, mp: stats.maxMp } }
    }

    case 'ADMIN_SET_GENDER':
      return { ...state, player: { ...state.player, gender: action.gender } }

    case 'ADMIN_TOGGLE_SKILL': {
      const has = state.player.learnedSkills.includes(action.skillId)
      const learnedSkills = has
        ? state.player.learnedSkills.filter((id) => id !== action.skillId)
        : [...state.player.learnedSkills, action.skillId]
      return { ...state, player: { ...state.player, learnedSkills } }
    }

    case 'ADMIN_LEARN_ALL_SKILLS':
      return { ...state, player: { ...state.player, learnedSkills: SKILLS.map((s) => s.id) } }

    case 'ADMIN_CLEAR_SKILLS':
      return { ...state, player: { ...state.player, learnedSkills: [] } }

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
      if (fled) return leaveBattle(state, resolved, inventory, '전투에서 벗어났습니다.')
      const ended = checkBattleEnd(resolved)
      const next = ended.isOver ? ended : advanceTurn(ended)
      return { ...state, battle: next, inventory }
    }

    case 'BATTLE_TICK': {
      if (!state.battle || state.battle.isOver) return state
      if (!state.battle.activeUid) return { ...state, battle: tickAtb(state.battle) }
      const actor = currentActor(state.battle)
      if (!actor) return { ...state, battle: { ...state.battle, activeUid: null } }
      if (actor.kind === 'hero') return state
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
        const expResult = applyExp(state.player.level, state.player.exp, state.battle.rewardExp ?? 0)
        let newStats = state.player.stats
        let hp = heroC?.hp ?? state.player.hp
        let mp = heroC?.mp ?? state.player.mp
        let learnedSkills = state.player.learnedSkills
        if (expResult.leveledUp) {
          newStats = computeStatsForLevel(state.player.element, expResult.newLevel)
          hp = newStats.maxHp
          mp = newStats.maxMp
          learnedSkills = Array.from(
            new Set([
              ...learnedSkills,
              ...refreshLearnedSkills(state.player.element, expResult.newLevel, state.player.jobTierId),
            ]),
          )
        }
        let inventory = state.inventory
        for (const id of state.battle.rewardDrops ?? []) inventory = addToInventory(inventory, id, 1)

        const fieldMonsters = state.battle.fieldMonsterUid
          ? updateFieldMonstersAfterVictory(state.fieldMonsters, state.battle.fieldMonsterUid)
          : state.fieldMonsters

        const eligibleTier = jobTierForLevel(expResult.newLevel)
        const jobChangedAvailable = eligibleTier.id !== state.player.jobTierId

        const pet = {
          ...state.pet,
          hp: Math.max(1, petC?.hp ?? state.pet.hp),
          mp: petC?.mp ?? state.pet.mp,
          affection: clampAffection(state.pet.affection + 2),
        }

        return {
          ...state,
          player: {
            ...state.player,
            level: expResult.newLevel,
            exp: expResult.newExp,
            stats: newStats,
            hp,
            mp,
            learnedSkills,
            gold: state.player.gold + (state.battle.rewardGold ?? 0),
          },
          pet,
          ownedPets: state.ownedPets.map((p) => (p.defId === pet.defId ? pet : p)),
          inventory,
          fieldMonsters,
          battle: null,
          screen: 'world',
          toast: expResult.leveledUp
            ? `레벨 업! Lv.${expResult.newLevel}${jobChangedAvailable ? ' — 전직 가능!' : ''}`
            : null,
        }
      }

      const village = MAPS.village
      const respawnPos = village.respawn ?? village.spawn
      const pet = { ...state.pet, hp: Math.max(1, Math.round(state.pet.hp * 0.2)) }
      return {
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
      }
    }

    case 'RESET_GAME':
      return createInitialGameState()

    default:
      return state
  }
}

/** 포탈(타일/군 통문)을 통해 다른 맵으로 이동 */
function travelThroughPortal(state: GameState, portalId: string): GameState {
  const fromMap = MAPS[state.currentMapId]
  const portal = fromMap.portals.find((p) => p.id === portalId)
  if (!portal) return state
  const destMap = MAPS[portal.to]
  const pos = portal.toSpawn ?? destMap.spawn
  return {
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
  }
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

  const monsterDefs = [primaryDef]
  if (!primaryDef.isTestMonster && Math.random() < 0.5) {
    const pool = MONSTERS.filter(
      (m) => !m.isTestMonster && m.zoneKinds.some((k) => primaryDef.zoneKinds.includes(k)),
    )
    if (pool.length > 0) monsterDefs.push(pool[Math.floor(Math.random() * pool.length)])
  }

  const effectiveStats = getEffectiveStats(state.player)
  const battle = initBattle(state.player, state.pet, monsterDefs, state.position, fieldMonsterUid, effectiveStats)
  return { ...state, previousScreen: state.screen, screen: 'battle', battle }
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
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    ;(window as unknown as { __game?: typeof value }).__game = value
  }
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { MAX_PARTY_SIZE, NPCS, ITEMS, npcById }
