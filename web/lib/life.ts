// ============================================================================
// 생활 콘텐츠 기초 (§학사 PRD 29, 33~38, 52~58)
//
//   · 활동 해금표(ACTIVITY_UNLOCKS) — 학년/학기에 따라 채집·낚시·사냥·요리·연금·제작 카테고리가 열린다
//   · 채집 — 지역별 채집 테이블 + 필드 맵마다 결정론적으로 뿌려지는 채집 노드(리스폰 있음)
//   · 낚시 — 물가(water 타일 인접)에서 지역별 어종 테이블 굴림 → 미니게임
//   · 사냥 — 몬스터 계통(family)별 부산물(고기·가죽·뼈·발톱·마력핵) 추가 드랍
//   · 요리/연금술/마도구/가구/코스튬 — 신규 아이템 + 레시피(태그 재료 'tag:herb' 지원)
//
// 아이콘은 scripts/gen-life-icons.mjs 가 만든 임시 도트 SVG(/images/items/life/*.svg).
// PixelLab 으로 교체할 때는 같은 경로에 PNG 를 두고 ITEM 의 icon 만 바꾸면 된다.
// ============================================================================

import type { GameMap, GameState, ItemDef, MapId, MaterialTag, MonsterFamily, RecipeCategory, RecipeDef } from '@/lib/types'
import { calendarInfo, globalWeekOf } from '@/lib/calendar'
import type { TermType } from '@/lib/types'
import { regionOfMap, type RegionId } from '@/lib/regions'
import { mulberry32 } from '@/lib/rng'

// ─────────────────────────────────────────────────────────────────────────────
// 활동 해금 (§29)
// ─────────────────────────────────────────────────────────────────────────────
export type ActivityId =
  | 'gathering'
  | 'crafting' // 기본 장비 제작
  | 'fishing'
  | 'alchemy'
  | 'cooking'
  | 'hunting'
  | 'furniture'
  | 'magicTool'
  | 'costume'

export const ACTIVITY_META: Record<ActivityId, { name: string; year: number; term: TermType }> = {
  gathering: { name: '채집', year: 1, term: 'semester1' },
  crafting: { name: '기본 제작', year: 1, term: 'semester2' },
  fishing: { name: '낚시', year: 1, term: 'winter' },
  alchemy: { name: '연금술', year: 2, term: 'semester1' },
  cooking: { name: '요리', year: 2, term: 'semester1' },
  hunting: { name: '사냥', year: 2, term: 'semester2' },
  furniture: { name: '가구 제작', year: 3, term: 'semester1' },
  magicTool: { name: '마도구 제작', year: 3, term: 'semester2' },
  costume: { name: '코스튬 제작', year: 3, term: 'semester2' },
}

export function activityUnlockWeek(a: ActivityId): number {
  const m = ACTIVITY_META[a]
  return globalWeekOf(m.year, m.term, 1)
}

/** 관리자 DEBUG_UNLOCK_ALL 플래그면 전부 열림(테스트 모드와는 무관) */
export function isActivityUnlocked(state: Pick<GameState, 'calendar' | 'settings' | 'storyFlags'>, a: ActivityId): boolean {
  if (state.storyFlags.DEBUG_UNLOCK_ALL) return true
  return state.calendar.globalWeek >= activityUnlockWeek(a)
}

export function activityUnlockLabel(a: ActivityId): string {
  const m = ACTIVITY_META[a]
  const termLabel = { semester1: '1학기', summer: '여름방학', semester2: '2학기', winter: '겨울방학' }[m.term]
  return `${m.year}학년 ${termLabel}`
}

export const RECIPE_CATEGORY_ACTIVITY: Record<RecipeCategory, ActivityId> = {
  equipment: 'crafting',
  alchemy: 'alchemy',
  cooking: 'cooking',
  magicTool: 'magicTool',
  furniture: 'furniture',
  costume: 'costume',
}

export const RECIPE_CATEGORY_LABEL: Record<RecipeCategory, string> = {
  equipment: '장비',
  alchemy: '연금술',
  cooking: '요리',
  magicTool: '마도구',
  furniture: '가구',
  costume: '코스튬',
}

// ─────────────────────────────────────────────────────────────────────────────
// 신규 아이템
// ─────────────────────────────────────────────────────────────────────────────
const LIFE_ICON = (id: string) => `/images/items/life/${id}.svg`

function mat(id: string, name: string, tags: MaterialTag[], sellPrice: number, description: string): ItemDef {
  return { id, name, type: 'material', icon: LIFE_ICON(id), description, price: 0, sellPrice, stackable: true, maxStack: 99, shopBuyable: false, tags }
}
function fish(id: string, name: string, sellPrice: number, description: string): ItemDef {
  return { id, name, type: 'fish', icon: LIFE_ICON(id), description, price: 0, sellPrice, stackable: true, maxStack: 99, shopBuyable: false, tags: ['fish'] }
}

/** 채집 재료 — 지역별 */
const gatherItems: ItemDef[] = [
  // 에르디아
  mat('herb-mint', '숲박하', ['herb'], 4, '에르디아 숲 어디서나 자라는 향긋한 약초. 회복약의 기본 재료.'),
  mat('herb-moonleaf', '달잎풀', ['herb'], 14, '달빛을 머금은 희귀 약초. 마나 계열 조합에 쓰인다.'),
  mat('flower-dew', '이슬꽃', ['flower'], 6, '아침 이슬이 맺힌 채로 피는 작은 꽃.'),
  mat('wood-oak', '참나무 가지', ['wood'], 5, '단단한 참나무 가지. 제작의 기본 목재.'),
  mat('mush-button', '갈색 버섯', ['mushroom'], 4, '숲 그늘에서 흔히 자라는 식용 버섯.'),
  mat('mush-glow', '빛버섯', ['mushroom'], 16, '어둠 속에서 은은히 빛나는 버섯. 연금술 촉매로 귀하다.'),
  // 해안
  mat('sea-kelp', '다시마', ['seafood'], 5, '해안 바위에 붙어 자라는 다시마. 국물 요리에 좋다.'),
  mat('sea-shell', '조개껍데기', ['seafood'], 5, '모래사장에서 주운 매끈한 조개껍데기.'),
  mat('sea-pearl', '작은 진주', ['crystal'], 30, '조개 속에서 드물게 나오는 작은 진주.'),
  mat('herb-saltgrass', '갯풀', ['herb'], 6, '짠 바닷바람을 견디는 해안 약초.'),
  // 스톰헤이븐
  mat('crystal-wind', '바람 결정', ['crystal'], 18, '폭풍이 굳어 생긴 반투명한 결정.'),
  mat('flower-cloud', '구름꽃', ['flower'], 12, '하늘 도시 난간에만 피는 새하얀 꽃.'),
  mat('herb-skyroot', '하늘뿌리', ['herb'], 12, '공중 정원의 흙 없이 자라는 뿌리 약초.'),
  // 폐허
  mat('ore-iron', '철광석', ['ore'], 10, '폐허 바닥에서 캐낸 철광석.'),
  mat('crystal-mana', '마력 결정', ['crystal'], 22, '오래된 마법진 자리에 맺힌 마력 결정.'),
  mat('mush-grave', '묘지버섯', ['mushroom'], 12, '묘지 흙에서만 자라는 창백한 버섯.'),
  // 설원
  mat('herb-frostmint', '서리박하', ['herb'], 14, '눈 속에서도 푸른 박하. 냉기 저항 조합에 쓰인다.'),
  mat('ore-silver', '은광석', ['ore'], 20, '설원 암벽에서 캐는 은광석.'),
  mat('wood-pine', '설원 소나무', ['wood'], 10, '곧게 자란 설원 소나무 목재.'),
  // 화산
  mat('ore-obsidian', '흑요석', ['ore'], 26, '화산 유리가 굳은 검은 광석.'),
  mat('ore-firestone', '화염석', ['ore', 'crystal'], 30, '안에서 불씨가 꺼지지 않는 광석.'),
  mat('herb-ember', '불씨풀', ['herb'], 16, '용암 곁에서 자라는 붉은 약초.'),
]

/** 사냥 부산물 — 계통(family)별 */
const huntItems: ItemDef[] = [
  mat('hunt-meat', '짐승 고기', ['meat'], 8, '사냥한 짐승에게서 얻은 고기. 요리 재료.'),
  mat('hunt-hide', '짐승 가죽', ['hide'], 10, '손질하면 장비·가구·코스튬에 쓰이는 가죽.'),
  mat('hunt-bone', '뼈', ['bone'], 6, '단단한 뼈. 마도구와 가구의 재료.'),
  mat('hunt-claw', '발톱', ['claw'], 10, '날카로운 발톱. 장비 강화 재료.'),
  mat('hunt-fillet', '해산 살코기', ['meat', 'seafood'], 9, '수생 몬스터의 살코기.'),
  mat('hunt-sap', '마력 수액', ['herb'], 9, '식물형 몬스터의 수액. 연금술 재료.'),
  mat('hunt-core', '마력핵', ['core'], 40, '마력이 응축된 핵. 드물게 얻는 희귀 부위.'),
]

/** 어획물 — 지역별 */
const fishItems: ItemDef[] = [
  fish('fish-minnow', '피라미', 4, '어디서나 잡히는 작은 물고기.'),
  fish('fish-carp', '붕어', 8, '숲 늪지에 사는 흔한 민물고기.'),
  fish('fish-trout', '숲송어', 12, '맑은 물을 좋아하는 송어.'),
  fish('fish-moonkoi', '달빛 잉어', 60, '보름달이 뜨는 밤에만 모습을 드러낸다는 잉어.'),
  fish('fish-mackerel', '고등어', 10, '해안에서 잘 잡히는 등푸른 생선.'),
  fish('fish-snapper', '도미', 22, '붉은 빛이 도는 고급 생선.'),
  fish('fish-pearlray', '진주가오리', 80, '등에 진주 무늬가 있는 희귀 가오리.'),
  fish('fish-icecod', '얼음대구', 18, '설원 얼음 구멍 아래 사는 대구.'),
  fish('fish-frostsalmon', '서리연어', 70, '서리가 낀 듯한 은빛 연어. 희귀.'),
  fish('fish-lavaeel', '용암장어', 90, '뜨거운 물에서만 사는 불가사의한 장어.'),
]

/** 요리 결과물 — 식사 버프(§36) */
const foodItems: ItemDef[] = [
  { id: 'food-fire-fish', name: '화염 생선구이', type: 'food', icon: LIFE_ICON('food-fire-fish'), description: 'HP 60 회복. 3전투 동안 마법공격력 +10%.', price: 0, sellPrice: 30, stackable: true, maxStack: 20, useEffect: { healHp: 60 }, mealBuff: { label: '화염 생선구이', statPct: { matk: 0.1 }, battles: 3 } },
  { id: 'food-mushroom-stew', name: '빙결 버섯 스튜', type: 'food', icon: LIFE_ICON('food-mushroom-stew'), description: 'HP 50 회복. 3전투 동안 운 +15%(상태이상 저항).', price: 0, sellPrice: 26, stackable: true, maxStack: 20, useEffect: { healHp: 50 }, mealBuff: { label: '빙결 버섯 스튜', statPct: { luck: 0.15, mdef: 0.05 }, battles: 3 } },
  { id: 'food-berry-tart', name: '마력 열매 타르트', type: 'food', icon: LIFE_ICON('food-berry-tart'), description: 'MP 50 회복. 3전투 동안 최대 MP +10%.', price: 0, sellPrice: 28, stackable: true, maxStack: 20, useEffect: { healMp: 50 }, mealBuff: { label: '마력 열매 타르트', statPct: { maxMp: 0.1 }, battles: 3 } },
  { id: 'food-meat-skewer', name: '짐승 고기 꼬치', type: 'food', icon: LIFE_ICON('food-meat-skewer'), description: 'HP 80 회복. 3전투 동안 물리공격력 +10%.', price: 0, sellPrice: 24, stackable: true, maxStack: 20, useEffect: { healHp: 80 }, mealBuff: { label: '짐승 고기 꼬치', statPct: { atk: 0.1 }, battles: 3 } },
  { id: 'food-seafood-soup', name: '해산물 수프', type: 'food', icon: LIFE_ICON('food-seafood-soup'), description: 'HP 100 회복. 4전투 동안 최대 HP +10%, 방어 +5%.', price: 0, sellPrice: 34, stackable: true, maxStack: 20, useEffect: { healHp: 100 }, mealBuff: { label: '해산물 수프', statPct: { maxHp: 0.1, def: 0.05 }, battles: 4 } },
  { id: 'food-trail-lunch', name: '야영 도시락', type: 'food', icon: LIFE_ICON('food-trail-lunch'), description: 'HP 60·MP 20 회복. 3전투 동안 속도 +8%.', price: 0, sellPrice: 22, stackable: true, maxStack: 20, useEffect: { healHp: 60, healMp: 20 }, mealBuff: { label: '야영 도시락', statPct: { spd: 0.08 }, battles: 3 } },
]

/** 연금술·마도구·가구·코스튬 결과물 */
const craftedLifeItems: ItemDef[] = [
  { id: 'alch-catalyst', name: '희귀 촉매', type: 'material', icon: LIFE_ICON('alch-catalyst'), description: '고급 연금술과 마도구 제작에 쓰이는 촉매.', price: 0, sellPrice: 80, stackable: true, maxStack: 30, shopBuyable: false, tags: ['core'] },
  { id: 'alch-tonic', name: '전투 강장제', type: 'potion', icon: LIFE_ICON('alch-tonic'), description: '대상의 ATB를 즉시 35 채우고 HP 30 회복.', price: 0, sellPrice: 30, stackable: true, maxStack: 20, useEffect: { atbBoost: 35, healHp: 30 } },
  { id: 'tool-rod-basic', name: '견습생 낚싯대', type: 'tool', icon: LIFE_ICON('tool-rod-basic'), description: '물가에서 E(상호작용)로 낚시를 할 수 있다. 가방에 있기만 하면 된다.', price: 120, sellPrice: 30, stackable: false, maxStack: 1 },
  { id: 'tool-rod-silver', name: '은빛 낚싯대', type: 'tool', icon: LIFE_ICON('tool-rod-silver'), description: '마도구 낚싯대. 낚시 판정 구간이 넓어지고 희귀 어종이 잘 걸린다.', price: 0, sellPrice: 160, stackable: false, maxStack: 1, shopBuyable: false },
  { id: 'tool-gather-sickle', name: '채집용 마법 낫', type: 'tool', icon: LIFE_ICON('tool-gather-sickle'), description: '가방에 있으면 채집할 때마다 재료를 1개 더 얻는다.', price: 0, sellPrice: 120, stackable: false, maxStack: 1, shopBuyable: false },
  { id: 'tool-explore-lantern', name: '탐사용 마력 등불', type: 'tool', icon: LIFE_ICON('tool-explore-lantern'), description: '탐사용 마도구. (던전 시야 시스템 도입 시 사용 예정)', price: 0, sellPrice: 90, stackable: false, maxStack: 1, shopBuyable: false },
  { id: 'furn-herb-pot', name: '허브 화분', type: 'furniture', icon: LIFE_ICON('furn-herb-pot'), description: '개인 공간용 가구. (하우징 가구 인벤토리 연동 예정)', price: 0, sellPrice: 40, stackable: true, maxStack: 10, shopBuyable: false },
  { id: 'furn-hide-rug', name: '가죽 러그', type: 'furniture', icon: LIFE_ICON('furn-hide-rug'), description: '개인 공간용 가구. (하우징 가구 인벤토리 연동 예정)', price: 0, sellPrice: 60, stackable: true, maxStack: 10, shopBuyable: false },
  { id: 'cos-festival-cape', name: '축제 망토', type: 'costume', icon: LIFE_ICON('cos-festival-cape'), description: '학교 축제용 코스튬. (외형 시스템 도입 시 착용 예정)', price: 0, sellPrice: 100, stackable: false, maxStack: 1, shopBuyable: false },
]

export const LIFE_ITEMS: ItemDef[] = [...gatherItems, ...huntItems, ...fishItems, ...foodItems, ...craftedLifeItems]

// ─────────────────────────────────────────────────────────────────────────────
// 채집 (§33, §53)
// ─────────────────────────────────────────────────────────────────────────────
export type GatherNodeKind = 'herb' | 'flower' | 'wood' | 'ore' | 'crystal' | 'mushroom' | 'shore'

export const GATHER_NODE_META: Record<GatherNodeKind, { name: string; verb: string; icon: string }> = {
  herb: { name: '약초 덤불', verb: '채집', icon: '/images/map/gather/herb.svg' },
  flower: { name: '꽃무리', verb: '채집', icon: '/images/map/gather/flower.svg' },
  wood: { name: '쓰러진 나무', verb: '벌목', icon: '/images/map/gather/wood.svg' },
  ore: { name: '광맥', verb: '채굴', icon: '/images/map/gather/ore.svg' },
  crystal: { name: '마력 결정', verb: '채굴', icon: '/images/map/gather/crystal.svg' },
  mushroom: { name: '버섯 군락', verb: '채집', icon: '/images/map/gather/mushroom.svg' },
  shore: { name: '갯바위', verb: '채집', icon: '/images/map/gather/shore.svg' },
}

type DropRow = { itemId: string; weight: number }
/** 지역 × 노드 종류 → 드랍 테이블 */
export const GATHER_TABLES: Partial<Record<RegionId, Partial<Record<GatherNodeKind, DropRow[]>>>> = {
  ERDIA: {
    herb: [{ itemId: 'herb-mint', weight: 10 }, { itemId: 'herb-moonleaf', weight: 1 }],
    flower: [{ itemId: 'flower-dew', weight: 1 }],
    wood: [{ itemId: 'wood-oak', weight: 1 }],
    mushroom: [{ itemId: 'mush-button', weight: 8 }, { itemId: 'mush-glow', weight: 1 }],
  },
  COAST: {
    shore: [{ itemId: 'sea-kelp', weight: 6 }, { itemId: 'sea-shell', weight: 6 }, { itemId: 'sea-pearl', weight: 1 }],
    herb: [{ itemId: 'herb-saltgrass', weight: 1 }],
  },
  STORMHAVEN: {
    crystal: [{ itemId: 'crystal-wind', weight: 1 }],
    flower: [{ itemId: 'flower-cloud', weight: 1 }],
    herb: [{ itemId: 'herb-skyroot', weight: 1 }],
  },
  RUINS: {
    ore: [{ itemId: 'ore-iron', weight: 1 }],
    crystal: [{ itemId: 'crystal-mana', weight: 1 }],
    mushroom: [{ itemId: 'mush-grave', weight: 1 }],
  },
  SNOWFIELD: {
    herb: [{ itemId: 'herb-frostmint', weight: 1 }],
    ore: [{ itemId: 'ore-silver', weight: 1 }],
    wood: [{ itemId: 'wood-pine', weight: 1 }],
  },
  VOLCANO: {
    ore: [{ itemId: 'ore-obsidian', weight: 3 }, { itemId: 'ore-firestone', weight: 1 }],
    herb: [{ itemId: 'herb-ember', weight: 1 }],
  },
}

/** 채집 노드 리스폰 — 실시간 3분 */
export const GATHER_RESPAWN_MS = 3 * 60 * 1000
const NODE_TOUCH_R = 1.3

export interface GatherNode {
  key: string // `${mapId}:${idx}`
  kind: GatherNodeKind
  cell: { x: number; y: number }
}

const nodeCache = new Map<MapId, GatherNode[]>()

/** 필드 맵의 채집 노드(맵마다 고정 배치). 안전 마을·실내는 없음 */
export function gatherNodesForMap(map: GameMap): GatherNode[] {
  const cached = nodeCache.get(map.id)
  if (cached) return cached
  const table = GATHER_TABLES[regionOfMap(map.id)]
  if (map.kind !== 'field' || !table || map.id === 'testroom') {
    nodeCache.set(map.id, [])
    return []
  }
  const kinds = Object.keys(table) as GatherNodeKind[]
  let h = 7771
  for (let i = 0; i < map.id.length; i++) h = (h * 33 + map.id.charCodeAt(i)) | 0
  const rand = mulberry32(h >>> 0)
  const area = map.grid.w * map.grid.h
  const target = Math.max(6, Math.min(18, Math.round(area / 90)))
  const nodes: GatherNode[] = []
  const blocked = (x: number, y: number) =>
    (map.blockers ?? []).some((b) => x > b.x0 - 0.6 && x < b.x1 + 0.6 && y > b.y0 - 0.6 && y < b.y1 + 0.6)
  for (let attempt = 0; attempt < target * 30 && nodes.length < target; attempt++) {
    const x = 1.5 + rand() * (map.grid.w - 3)
    const y = 1.5 + rand() * (map.grid.h - 3)
    const tile = map.tileAt?.(x, y)
    if (tile === 'water' || tile === 'demon-lava' || blocked(x, y)) continue
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < 2.5) continue
    if (map.portals.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 2)) continue
    if (nodes.some((n) => Math.hypot(n.cell.x - x, n.cell.y - y) < 3)) continue
    const kind = kinds[Math.floor(rand() * kinds.length)]
    nodes.push({ key: `${map.id}:${nodes.length}`, kind, cell: { x, y } })
  }
  nodeCache.set(map.id, nodes)
  return nodes
}

export function isNodeReady(life: GameState['life'], key: string, now = Date.now()): boolean {
  const t = life.gatheredAt[key]
  return t == null || now - t >= GATHER_RESPAWN_MS
}

export function nearestGatherNode(map: GameMap, life: GameState['life'], pos: { x: number; y: number }, now = Date.now()): GatherNode | null {
  let best: GatherNode | null = null
  let bestD = NODE_TOUCH_R
  for (const n of gatherNodesForMap(map)) {
    if (!isNodeReady(life, n.key, now)) continue
    const d = Math.hypot(n.cell.x - pos.x, n.cell.y - pos.y)
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

function pickWeighted(rows: DropRow[], rand: () => number): string {
  const total = rows.reduce((a, r) => a + r.weight, 0)
  let roll = rand() * total
  for (const r of rows) {
    roll -= r.weight
    if (roll <= 0) return r.itemId
  }
  return rows[rows.length - 1].itemId
}

/** 채집 1회 결과 — [itemId, qty] 목록 */
export function rollGather(mapId: MapId, kind: GatherNodeKind, hasSickle: boolean, rand = Math.random): { itemId: string; qty: number }[] {
  const rows = GATHER_TABLES[regionOfMap(mapId)]?.[kind]
  if (!rows) return []
  const itemId = pickWeighted(rows, rand)
  const qty = 1 + (rand() < 0.35 ? 1 : 0) + (hasSickle ? 1 : 0)
  return [{ itemId, qty }]
}

// ─────────────────────────────────────────────────────────────────────────────
// 낚시 (§35, §54)
// ─────────────────────────────────────────────────────────────────────────────
type FishRow = { fishId: string; weight: number; difficulty: number }
export const FISH_TABLES: Partial<Record<RegionId, FishRow[]>> = {
  ACADEMY: [{ fishId: 'fish-minnow', weight: 8, difficulty: 0.1 }, { fishId: 'fish-carp', weight: 3, difficulty: 0.25 }],
  ERDIA: [
    { fishId: 'fish-minnow', weight: 5, difficulty: 0.1 },
    { fishId: 'fish-carp', weight: 6, difficulty: 0.25 },
    { fishId: 'fish-trout', weight: 4, difficulty: 0.4 },
    { fishId: 'fish-moonkoi', weight: 1, difficulty: 0.8 },
  ],
  COAST: [
    { fishId: 'fish-mackerel', weight: 8, difficulty: 0.3 },
    { fishId: 'fish-snapper', weight: 4, difficulty: 0.5 },
    { fishId: 'fish-pearlray', weight: 1, difficulty: 0.85 },
  ],
  SNOWFIELD: [
    { fishId: 'fish-icecod', weight: 6, difficulty: 0.45 },
    { fishId: 'fish-frostsalmon', weight: 1, difficulty: 0.85 },
  ],
  VOLCANO: [{ fishId: 'fish-lavaeel', weight: 1, difficulty: 0.9 }],
}

export function fishTableFor(mapId: MapId): FishRow[] {
  return FISH_TABLES[regionOfMap(mapId)] ?? [{ fishId: 'fish-minnow', weight: 1, difficulty: 0.1 }]
}

/** 플레이어 위치 근처(1.3셀)에 물 타일이 있으면 낚시 가능 */
export function isNearWater(map: GameMap, pos: { x: number; y: number }): boolean {
  if (!map.tileAt) return false
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) {
    const x = pos.x + dx * 1.2
    const y = pos.y + dy * 1.2
    if (x < 0 || y < 0 || x >= map.grid.w || y >= map.grid.h) continue
    if (map.tileAt(x, y) === 'water') return true
  }
  return false
}

export function rollFish(mapId: MapId, silverRod: boolean, rand = Math.random): { fishId: string; difficulty: number } {
  const rows = fishTableFor(mapId).map((r) => ({ ...r, weight: silverRod && r.difficulty >= 0.8 ? r.weight * 2 : r.weight }))
  const total = rows.reduce((a, r) => a + r.weight, 0)
  let roll = rand() * total
  for (const r of rows) {
    roll -= r.weight
    if (roll <= 0) return { fishId: r.fishId, difficulty: Math.max(0.05, r.difficulty - (silverRod ? 0.15 : 0)) }
  }
  const last = rows[rows.length - 1]
  return { fishId: last.fishId, difficulty: last.difficulty }
}

// ─────────────────────────────────────────────────────────────────────────────
// 사냥 부산물 (§34, §55)
// ─────────────────────────────────────────────────────────────────────────────
export const HUNT_TABLES: Partial<Record<MonsterFamily, { itemId: string; chance: number }[]>> = {
  beast: [
    { itemId: 'hunt-meat', chance: 0.55 },
    { itemId: 'hunt-hide', chance: 0.4 },
    { itemId: 'hunt-bone', chance: 0.25 },
    { itemId: 'hunt-claw', chance: 0.2 },
  ],
  aquatic: [{ itemId: 'hunt-fillet', chance: 0.55 }, { itemId: 'hunt-bone', chance: 0.2 }],
  plant: [{ itemId: 'hunt-sap', chance: 0.5 }],
  undead: [{ itemId: 'hunt-bone', chance: 0.5 }],
  construct: [{ itemId: 'hunt-core', chance: 0.12 }],
  darkmage: [{ itemId: 'hunt-core', chance: 0.08 }],
}
/** 모든 계통 공통 희귀 부위 확률 */
export const HUNT_RARE_CORE_CHANCE = 0.04

export function rollHuntDrops(family: MonsterFamily, rand = Math.random): string[] {
  const out: string[] = []
  for (const row of HUNT_TABLES[family] ?? []) if (rand() < row.chance) out.push(row.itemId)
  if (family !== 'test' && rand() < HUNT_RARE_CORE_CHANCE && !out.includes('hunt-core')) out.push('hunt-core')
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 신규 레시피 — 재료 itemId 가 'tag:herb' 처럼 태그면 그 태그의 아무 재료나 소모
// ─────────────────────────────────────────────────────────────────────────────
export const LIFE_RECIPES: RecipeDef[] = [
  // 연금술 (연금술동 가마)
  { id: 'alch-hp-s', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'tag:herb', quantity: 2 }], outputItemId: 'potion-hp-s', outputQuantity: 2 },
  { id: 'alch-mp-s', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'tag:flower', quantity: 2 }, { itemId: 'tag:herb', quantity: 1 }], outputItemId: 'potion-mp-s', outputQuantity: 2 },
  { id: 'alch-antidote', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'tag:herb', quantity: 1 }, { itemId: 'tag:mushroom', quantity: 1 }], outputItemId: 'tool-antidote', outputQuantity: 1 },
  { id: 'alch-hp-m', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'potion-hp-s', quantity: 2 }, { itemId: 'herb-moonleaf', quantity: 1 }], outputItemId: 'potion-hp-m', outputQuantity: 1 },
  { id: 'alch-tonic', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'hunt-sap', quantity: 2 }, { itemId: 'tag:herb', quantity: 1 }], outputItemId: 'alch-tonic', outputQuantity: 1 },
  { id: 'alch-catalyst', station: 'alchemy_pot', category: 'alchemy', ingredients: [{ itemId: 'tag:crystal', quantity: 2 }, { itemId: 'mush-glow', quantity: 1 }], outputItemId: 'alch-catalyst', outputQuantity: 1 },
  // 요리 (공동 식당 주방)
  { id: 'cook-fire-fish', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:fish', quantity: 1 }, { itemId: 'tag:herb', quantity: 1 }], outputItemId: 'food-fire-fish', outputQuantity: 1 },
  { id: 'cook-mushroom-stew', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:mushroom', quantity: 2 }, { itemId: 'tag:herb', quantity: 1 }], outputItemId: 'food-mushroom-stew', outputQuantity: 1 },
  { id: 'cook-berry-tart', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:flower', quantity: 2 }, { itemId: 'tag:herb', quantity: 1 }], outputItemId: 'food-berry-tart', outputQuantity: 1 },
  { id: 'cook-meat-skewer', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:meat', quantity: 2 }], outputItemId: 'food-meat-skewer', outputQuantity: 1 },
  { id: 'cook-seafood-soup', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:seafood', quantity: 2 }, { itemId: 'tag:fish', quantity: 1 }], outputItemId: 'food-seafood-soup', outputQuantity: 1 },
  { id: 'cook-trail-lunch', station: 'cooking_pot', category: 'cooking', ingredients: [{ itemId: 'tag:herb', quantity: 2 }, { itemId: 'tag:meat', quantity: 1 }], outputItemId: 'food-trail-lunch', outputQuantity: 1 },
  // 마도구 (마도구 작업대)
  { id: 'tool-gather-sickle', station: 'magic_workbench', category: 'magicTool', ingredients: [{ itemId: 'tag:wood', quantity: 3 }, { itemId: 'tag:ore', quantity: 2 }, { itemId: 'tag:crystal', quantity: 1 }], outputItemId: 'tool-gather-sickle', outputQuantity: 1 },
  { id: 'tool-rod-silver', station: 'magic_workbench', category: 'magicTool', ingredients: [{ itemId: 'tool-rod-basic', quantity: 1 }, { itemId: 'ore-silver', quantity: 2 }, { itemId: 'alch-catalyst', quantity: 1 }], outputItemId: 'tool-rod-silver', outputQuantity: 1 },
  { id: 'tool-explore-lantern', station: 'magic_workbench', category: 'magicTool', ingredients: [{ itemId: 'tag:wood', quantity: 2 }, { itemId: 'tag:crystal', quantity: 2 }], outputItemId: 'tool-explore-lantern', outputQuantity: 1 },
  // 가구
  { id: 'furn-herb-pot', station: 'magic_workbench', category: 'furniture', ingredients: [{ itemId: 'tag:wood', quantity: 2 }, { itemId: 'tag:herb', quantity: 2 }], outputItemId: 'furn-herb-pot', outputQuantity: 1 },
  { id: 'furn-hide-rug', station: 'magic_workbench', category: 'furniture', ingredients: [{ itemId: 'hunt-hide', quantity: 4 }], outputItemId: 'furn-hide-rug', outputQuantity: 1 },
  // 코스튬
  { id: 'cos-festival-cape', station: 'magic_workbench', category: 'costume', ingredients: [{ itemId: 'hunt-hide', quantity: 3 }, { itemId: 'tag:flower', quantity: 4 }], outputItemId: 'cos-festival-cape', outputQuantity: 1 },
]

// ─────────────────────────────────────────────────────────────────────────────
// 태그 재료 헬퍼 — 레시피/퀘스트 공용
// ─────────────────────────────────────────────────────────────────────────────
export function itemMatches(item: ItemDef | undefined, target: string): boolean {
  if (!item) return false
  if (target === 'any') return true
  if (target.startsWith('tag:')) return !!item.tags?.includes(target.slice(4) as MaterialTag)
  return item.id === target
}

export const TAG_LABEL: Record<MaterialTag, string> = {
  herb: '약초',
  flower: '꽃',
  wood: '목재',
  ore: '광석',
  crystal: '결정',
  mushroom: '버섯',
  seafood: '해산물',
  meat: '고기',
  hide: '가죽',
  bone: '뼈',
  claw: '발톱',
  core: '마력핵',
  fish: '물고기',
}

export function currentYear(state: Pick<GameState, 'calendar'>): number {
  return calendarInfo(state.calendar.globalWeek).year
}
