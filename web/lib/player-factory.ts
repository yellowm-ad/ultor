import type { Element, GameState, Gender, Pet, PlayerCharacter } from '@/lib/types'
import { computeStatsForLevel, jobTierForLevel, STARTING_GOLD, DEFAULT_SETTINGS } from '@/lib/constants'
import { MAPS } from '@/lib/maps'
import { autoLearnSkillIds } from '@/lib/mock-data'
import { createPet, STARTER_PET_BY_ELEMENT } from '@/lib/pets'

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
      placed: [
        { id: 'seed-bed', defId: 'bed', cell: { x: 2.5, y: 8 } },
        { id: 'seed-nightstand', defId: 'nightstand', cell: { x: 2.5, y: 6.3 } },
        { id: 'seed-wardrobe', defId: 'wardrobe', cell: { x: 5, y: 1.8 } },
        { id: 'seed-weaponrack', defId: 'weaponrack', cell: { x: 9.5, y: 1.8 } },
        { id: 'seed-chest', defId: 'chest', cell: { x: 7, y: 5 } },
        { id: 'seed-desk', defId: 'desk', cell: { x: 11.5, y: 3 } },
        { id: 'seed-fireplace', defId: 'fireplace', cell: { x: 12.3, y: 6 } },
        { id: 'seed-firewood', defId: 'firewood', cell: { x: 12.3, y: 7.5 } },
        { id: 'seed-boots', defId: 'boots', cell: { x: 3.5, y: 9 } },
      ],
    },
  }
}
