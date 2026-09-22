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
      // 왼쪽(서벽)=침실, 중앙(러그)=공용 공간, 오른쪽(북벽)=서재+벽난로.
      // 뒤쪽 꼭짓점(문) 근처만 비우고 벽에서 충분히 떨어뜨려 배치 — lib/maps.ts personalSpaceWalls() 좌표계 기준.
      placed: [
        // 왼쪽 — 침실
        { id: 'seed-bookshelf', defId: 'bookshelf', cell: { x: 1.7, y: 3.6 } },
        { id: 'seed-wardrobe', defId: 'wardrobe', cell: { x: 3.6, y: 1.9 } },
        { id: 'seed-nightstand', defId: 'nightstand', cell: { x: 1.6, y: 4.9 } },
        { id: 'seed-bed', defId: 'bed', cell: { x: 2.1, y: 6.6 } },
        { id: 'seed-chest', defId: 'chest', cell: { x: 1.6, y: 8.7 } },
        { id: 'seed-boots', defId: 'boots', cell: { x: 2.9, y: 8.9 } },
        // 중앙 — 러그 위 원탁 + 의자 4개. 테이블 쪽을 바라보도록 각자 반대 방향 스프라이트 사용
        // (테이블 북쪽 자리 → 남향 의자, 남쪽 자리 → 북향 의자, 서쪽 자리 → 동향 의자, 동쪽 자리 → 서향 의자).
        { id: 'seed-table', defId: 'table', cell: { x: 7, y: 6 } },
        { id: 'seed-chair-n', defId: 'chair-s', cell: { x: 7, y: 4.9 } },
        { id: 'seed-chair-s', defId: 'chair-n', cell: { x: 7, y: 7.1 } },
        { id: 'seed-chair-w', defId: 'chair-e', cell: { x: 5.8, y: 6 } },
        { id: 'seed-chair-e', defId: 'chair-w', cell: { x: 8.2, y: 6 } },
        // 오른쪽 — 서재 + 벽난로
        { id: 'seed-weaponrack', defId: 'weaponrack', cell: { x: 11.7, y: 5.7 } },
        { id: 'seed-desk', defId: 'desk', cell: { x: 9.6, y: 2.3 } },
        { id: 'seed-desk-chair', defId: 'chair-n', cell: { x: 9.6, y: 3.4 } },
        { id: 'seed-bookshelf2', defId: 'bookshelf', cell: { x: 12.5, y: 5.0 } },
        { id: 'seed-fireplace', defId: 'fireplace', cell: { x: 12.6, y: 7.2 } },
        { id: 'seed-firewood', defId: 'firewood', cell: { x: 12.0, y: 8.3 } },
      ],
    },
  }
}
