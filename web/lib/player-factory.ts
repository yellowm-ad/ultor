import type { Element, GameState, Gender, Pet, PlayerCharacter } from '@/lib/types'
import { computeStatsForLevel, jobTierForLevel, STARTING_GOLD, DEFAULT_SETTINGS } from '@/lib/constants'
import { MAPS } from '@/lib/maps'
import { autoLearnSkillIds } from '@/lib/mock-data'
import { createPet, STARTER_PET_BY_ELEMENT } from '@/lib/pets'
import { createInitialCalendar } from '@/lib/calendar'
import { createInitialAcademics } from '@/lib/academics'

export function createPlayer(name: string, element: Element, gender: Gender = 'male'): PlayerCharacter {
  const stats = computeStatsForLevel(element, 1)
  const jobTier = jobTierForLevel(1)
  return {
    name: name || '이름없는 견습생',
    element,
    gender,
    level: 1,
    exp: 0,
    jobTierId: jobTier.id,
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    gold: STARTING_GOLD,
    equipped: {},
    learnedSkills: autoLearnSkillIds(element, 1, 0),
  }
}

export function createStarterPet(element: Element): Pet {
  return createPet(STARTER_PET_BY_ELEMENT[element], { level: 1, affection: 45 })
}

export function createInitialGameState(): GameState {
  const player = createPlayer('', 'fire', 'male')
  const pet = createStarterPet('fire')
  const village = MAPS.village

  return {
    screen: 'title',
    previousScreen: 'title',
    player,
    pet,
    ownedPets: [pet],
    position: { ...village.spawn },
    facing: 'down',
    currentMapId: 'village',
    currentZoneId: 'z-quad',
    inventory: [
      { itemId: 'potion-hp-s', qty: 5 },
      { itemId: 'potion-mp-s', qty: 3 },
      { itemId: 'tool-escape', qty: 3 },
      { itemId: 'feed-any', qty: 2 },
    ],
    fieldMonsters: [],
    pendingEncounterUid: null,
    pendingPortalId: null,
    gateOpen: false,
    activeNpcId: null,
    activeShopId: null,
    battle: null,
    settings: DEFAULT_SETTINGS,
    toast: null,
    housing: {
      editMode: false,
      // 2026-09-30 리마스터 배치(참고: 루트 `개인 공간 디자인안.png`) — 벽은 맵 끝선(x=0 서벽, y=0 북벽).
      // 서벽=침실(책장·협탁·캐노피 침대·상자), 북벽=옷장·서재 책상·벽난로, 중앙 러그=원탁+의자 4.
      // 벽에 붙는 가구는 벽 방향 변형(-w = 서벽용)을 쓴다. id 접두어 'seed2-' — 옛 'seed-' 배치는 로드 시 교체(game-state LOAD_GAME).
      placed: [
        { id: 'seed2-bookshelf-w', defId: 'bookshelf-w', cell: { x: 0.75, y: 2.4 } },
        { id: 'seed2-nightstand', defId: 'nightstand', cell: { x: 0.8, y: 3.8 } },
        { id: 'seed2-bed', defId: 'bed', cell: { x: 1.6, y: 5.2 } },
        { id: 'seed2-chest-w', defId: 'chest-w', cell: { x: 0.75, y: 7.6 } },
        { id: 'seed2-boots', defId: 'boots', cell: { x: 1.9, y: 8.6 } },
        { id: 'seed2-wardrobe', defId: 'wardrobe', cell: { x: 2.4, y: 0.75 } },
        { id: 'seed2-bookshelf', defId: 'bookshelf', cell: { x: 3.6, y: 0.75 } },
        { id: 'seed2-desk', defId: 'desk', cell: { x: 7.6, y: 1.0 } },
        { id: 'seed2-desk-chair', defId: 'chair-n', cell: { x: 7.6, y: 2.0 } },
        { id: 'seed2-fireplace', defId: 'fireplace', cell: { x: 10.6, y: 0.8 } },
        { id: 'seed2-firewood', defId: 'firewood', cell: { x: 12.0, y: 1.0 } },
        { id: 'seed2-weaponrack', defId: 'weaponrack', cell: { x: 12.9, y: 3.0 } },
        { id: 'seed2-table', defId: 'table', cell: { x: 7, y: 6 } },
        { id: 'seed2-chair-n', defId: 'chair-s', cell: { x: 7, y: 4.9 } },
        { id: 'seed2-chair-s', defId: 'chair-n', cell: { x: 7, y: 7.1 } },
        { id: 'seed2-chair-w', defId: 'chair-e', cell: { x: 5.9, y: 6 } },
        { id: 'seed2-chair-e', defId: 'chair-w', cell: { x: 8.1, y: 6 } },
      ],
    },
    // ── 4년제 학사·생활 시스템 — START_GAME 에서 시드/주간 퀘스트를 새로 채운다 ──
    playerSeed: 1,
    calendar: createInitialCalendar(),
    weekly: { week: 0, quests: [], lastSeen: {} },
    academics: createInitialAcademics(),
    storyFlags: {},
    storyQueue: [],
    relationships: {},
    companions: { recruited: {}, party: [] },
    life: { gatheredAt: {} },
    collections: { fish: {}, monsters: {}, gathered: {}, crafted: {} },
    mealBuff: null,
    fishing: null,
  }
}
