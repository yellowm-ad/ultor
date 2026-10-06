// ============================================================================
// 야생 전투맵 생성기 (2026-09-28 개편)
//
// 지역마다  기본맵 1 → 기본맵 2 → 기본맵 3(갈림길) ─┬─ 특수맵 A
//                                                  ├─ 특수맵 B
//                                                  └─ 지역 마을(있으면)
// · 맵 크기: 기본맵 38×32, 특수맵 28×22 (기존 24×20 / 18×14 대비 면적 약 2.5배 — 채집 지점이 들어갈 여유)
// · 포탈: 맵마다 동서남북 가장자리에 흩어 배치. 앞 맵의 출구가 동쪽이면 다음 맵 입구는 서쪽(반대편)이라
//   이동 방향이 자연스럽게 이어진다. 입구와 출구가 직각이면 길이 꺾이고, 마주 보면 중간 경유점으로 굽이친다.
// · 길: 입구 → (경유점) → [갈림길 광장] → 각 출구. 폭 ~2.6칸, 사인 흔들림으로 손으로 깐 듯한 곡선.
// · 지형/소품: 기존 타일·필드 프롭만 조합(테마별 풀). 길·포탈·스폰 주변은 비워 둔다.
// · 결과는 maps.ts 가 buildBlockers 로 충돌을 붙여 MAPS 에 넣는다(이 파일은 maps.ts 를 import 하지 않음).
// ============================================================================

import type { GameMap, MapId, Portal } from '@/lib/types'
import type { PropDef, TileKind } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'
import { classifyPools, poolBlocks, POOL_DEPTH, valueNoise } from '@/lib/terrain'

// ── 필드 프롭 스프라이트(기존 에셋) ─────────────────────────────────────────────
type FieldSprite = { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number }; kind: PropDef['kind'] }
export const FIELD_SPRITES = {
  forest: {
    tree: { sprite: '/images/map/props/f_forest_tree.png', px: { w: 128, h: 160 }, anchor: { x: 64, y: 150 }, kind: 'tree' },
    bush: { sprite: '/images/map/props/f_forest_bush.png', px: { w: 96, h: 56 }, anchor: { x: 48, y: 52 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_forest_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 60 }, kind: 'bush' },
    mushroom: { sprite: '/images/map/props/f_forest_mushroom.png', px: { w: 72, h: 56 }, anchor: { x: 36, y: 52 }, kind: 'bush' },
    // 쓰러진 통나무 — 옛 그림은 배경(풀·흙길)이 사각형으로 붙어 있어 PixelLab 으로 다시 그림(2026-10-04)
    log: { sprite: '/images/map/props/forest/ff_log.png', px: { w: 84, h: 64 }, anchor: { x: 42, y: 54 }, kind: 'bush' },
    firefly: { sprite: '/images/map/props/f_forest_firefly.png', px: { w: 56, h: 96 }, anchor: { x: 28, y: 92 }, kind: 'lamp' },
    // 숲 바닥 장식(PixelLab 2026-10-04) — 막지 않는 낮은 소품
    fern: { sprite: '/images/map/props/forest/ff_fern1.png', px: { w: 52, h: 35 }, anchor: { x: 24, y: 32 }, kind: 'bush' },
    fern2: { sprite: '/images/map/props/forest/ff_fern2.png', px: { w: 44, h: 50 }, anchor: { x: 19, y: 47 }, kind: 'bush' },
    flowers: { sprite: '/images/map/props/forest/ff_flowers.png', px: { w: 58, h: 42 }, anchor: { x: 29, y: 37 }, kind: 'bush' },
    stump: { sprite: '/images/map/props/forest/ff_stump1.png', px: { w: 68, h: 57 }, anchor: { x: 33, y: 50 }, kind: 'bush' },
    stump2: { sprite: '/images/map/props/forest/ff_stump2.png', px: { w: 61, h: 52 }, anchor: { x: 28, y: 46 }, kind: 'bush' },
  },
  // 연못가(천연 우물가) — 부들·이끼 바위(PixelLab 2026-10-04)
  pond: {
    cattail: { sprite: '/images/map/props/forest/ff_cattail1.png', px: { w: 68, h: 68 }, anchor: { x: 34, y: 64 }, kind: 'bush' },
    cattail2: { sprite: '/images/map/props/forest/ff_cattail2.png', px: { w: 62, h: 63 }, anchor: { x: 30, y: 60 }, kind: 'bush' },
    stone: { sprite: '/images/map/props/forest/ff_pondstone1.png', px: { w: 74, h: 58 }, anchor: { x: 38, y: 52 }, kind: 'bush' },
    stone2: { sprite: '/images/map/props/forest/ff_pondstone2.png', px: { w: 70, h: 53 }, anchor: { x: 40, y: 48 }, kind: 'bush' },
  },
  volcano: {
    // 첨탑·바위 — 원본은 이미지 테두리에서 잘려 밑동이 일자였다 → 둥근 둔덕으로 깎음(scripts/round-prop-base.mjs, 2026-10-07)
    spire: { sprite: '/images/map/props/volcano/fv_spire.png', px: { w: 72, h: 144 }, anchor: { x: 36, y: 134 }, kind: 'tree' },
    deadtree: { sprite: '/images/map/props/f_volcano_deadtree.png', px: { w: 104, h: 136 }, anchor: { x: 52, y: 128 }, kind: 'tree' },
    rock: { sprite: '/images/map/props/volcano/fv_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 58 }, kind: 'bush' },
    vent: { sprite: '/images/map/props/f_volcano_vent.png', px: { w: 88, h: 56 }, anchor: { x: 44, y: 50 }, kind: 'bush' },
    sulfur: { sprite: '/images/map/props/f_volcano_sulfur.png', px: { w: 64, h: 64 }, anchor: { x: 32, y: 58 }, kind: 'bush' },
    ashmound: { sprite: '/images/map/props/f_volcano_ashmound.png', px: { w: 72, h: 48 }, anchor: { x: 36, y: 44 }, kind: 'bush' },
  },
  sea: {
    driftwood: { sprite: '/images/map/props/f_sea_driftwood.png', px: { w: 120, h: 56 }, anchor: { x: 60, y: 52 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_sea_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 59 }, kind: 'bush' },
    coral: { sprite: '/images/map/props/f_sea_coral.png', px: { w: 80, h: 56 }, anchor: { x: 40, y: 52 }, kind: 'bush' },
    dunegrass: { sprite: '/images/map/props/f_sea_dunegrass.png', px: { w: 56, h: 72 }, anchor: { x: 28, y: 66 }, kind: 'bush' },
  },
  stormhaven: {
    banner: { sprite: '/images/map/props/f_storm_banner.png', px: { w: 56, h: 120 }, anchor: { x: 28, y: 110 }, kind: 'tree' },
    stormgrass: { sprite: '/images/map/props/f_storm_grass.png', px: { w: 64, h: 48 }, anchor: { x: 32, y: 44 }, kind: 'bush' },
    floatrock: { sprite: '/images/map/props/f_storm_rock.png', px: { w: 88, h: 72 }, anchor: { x: 44, y: 66 }, kind: 'bush' },
  },
  ruinsField: {
    pillar: { sprite: '/images/map/props/f_ruins_pillar.png', px: { w: 72, h: 104 }, anchor: { x: 36, y: 96 }, kind: 'tree' },
    rubble: { sprite: '/images/map/props/f_ruins_rubble.png', px: { w: 88, h: 56 }, anchor: { x: 44, y: 52 }, kind: 'bush' },
    crystal: { sprite: '/images/map/props/f_ruins_crystal.png', px: { w: 56, h: 80 }, anchor: { x: 28, y: 74 }, kind: 'lamp' },
    vine: { sprite: '/images/map/props/f_ruins_vine.png', px: { w: 72, h: 48 }, anchor: { x: 36, y: 44 }, kind: 'bush' },
  },
  snowfield: {
    pine: { sprite: '/images/map/props/f_snow_pine.png', px: { w: 96, h: 148 }, anchor: { x: 48, y: 136 }, kind: 'tree' },
    frostrock: { sprite: '/images/map/props/f_snow_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 59 }, kind: 'bush' },
    icicle: { sprite: '/images/map/props/f_snow_icicle.png', px: { w: 64, h: 64 }, anchor: { x: 32, y: 59 }, kind: 'bush' },
    snowmound: { sprite: '/images/map/props/f_snow_mound.png', px: { w: 72, h: 44 }, anchor: { x: 36, y: 40 }, kind: 'bush' },
  },
  cave: {
    crystal: { sprite: '/images/map/props/f_cave_crystal.png', px: { w: 64, h: 88 }, anchor: { x: 32, y: 81 }, kind: 'lamp' },
    stalagmite: { sprite: '/images/map/props/f_cave_stalagmite.png', px: { w: 72, h: 104 }, anchor: { x: 36, y: 96 }, kind: 'tree' },
    mushroom: { sprite: '/images/map/props/f_forest_mushroom.png', px: { w: 72, h: 56 }, anchor: { x: 36, y: 52 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_forest_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 60 }, kind: 'bush' },
  },
  mine: {
    orevein: { sprite: '/images/map/props/f_mine_orevein.png', px: { w: 80, h: 60 }, anchor: { x: 40, y: 55 }, kind: 'bush' },
    beam: { sprite: '/images/map/props/f_mine_beam.png', px: { w: 64, h: 112 }, anchor: { x: 32, y: 104 }, kind: 'lamp' },
    cart: { sprite: '/images/map/props/f_mine_cart.png', px: { w: 88, h: 72 }, anchor: { x: 44, y: 66 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_forest_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 60 }, kind: 'bush' },
  },
  swamp: {
    reed: { sprite: '/images/map/props/f_swamp_reed.png', px: { w: 56, h: 88 }, anchor: { x: 28, y: 82 }, kind: 'bush' },
    mangrove: { sprite: '/images/map/props/f_swamp_mangrove.png', px: { w: 112, h: 140 }, anchor: { x: 56, y: 130 }, kind: 'tree' },
    lilypad: { sprite: '/images/map/props/f_swamp_lilypad.png', px: { w: 72, h: 40 }, anchor: { x: 36, y: 36 }, kind: 'bush' },
  },
  deepsea: {
    kelp: { sprite: '/images/map/props/f_deepsea_kelp.png', px: { w: 64, h: 100 }, anchor: { x: 32, y: 93 }, kind: 'tree' },
    wreck: { sprite: '/images/map/props/f_deepsea_wreck.png', px: { w: 120, h: 64 }, anchor: { x: 60, y: 59 }, kind: 'bush' },
  },
  graveyard: {
    tombstone: { sprite: '/images/map/props/f_grave_tombstone.png', px: { w: 56, h: 80 }, anchor: { x: 28, y: 74 }, kind: 'bush' },
    deadtree: { sprite: '/images/map/props/f_grave_deadtree.png', px: { w: 96, h: 136 }, anchor: { x: 48, y: 126 }, kind: 'tree' },
    lantern: { sprite: '/images/map/props/f_grave_lantern.png', px: { w: 48, h: 72 }, anchor: { x: 24, y: 66 }, kind: 'lamp' },
  },
  demonCastle: {
    bones: { sprite: '/images/map/props/f_demon_bones.png', px: { w: 80, h: 52 }, anchor: { x: 40, y: 48 }, kind: 'bush' },
    banner: { sprite: '/images/map/props/f_demon_banner.png', px: { w: 56, h: 128 }, anchor: { x: 28, y: 118 }, kind: 'tree' },
  },
} as const satisfies Record<string, Record<string, FieldSprite>>

type Biome = keyof typeof FIELD_SPRITES
/** 'biome:key' 형식 소품 참조 */
type PropRef = string

function fprop(ref: PropRef, id: string, x: number, y: number): PropDef {
  const [biome, key] = ref.split(':') as [Biome, string]
  const s = (FIELD_SPRITES[biome] as Record<string, FieldSprite>)[key]
  return { id, kind: s.kind, cell: { x, y }, sprite: s.sprite, px: s.px, anchor: s.anchor }
}

// ── 크기 ────────────────────────────────────────────────────────────────────
export const FIELD_MAP_SIZE = { w: 38, h: 32 } // 기본맵
export const SPECIAL_MAP_SIZE = { w: 28, h: 22 } // 특수맵

// ── 테마(타일·소품 조합) ──────────────────────────────────────────────────────
interface Blob {
  kind: TileKind
  count: number
  r: [number, number]
}
interface Theme {
  /** 바닥 기본 — h: 0~1 셀 해시(얼룩용) */
  base: (h: number, x: number, y: number) => TileKind
  road: TileKind
  /** 갈림길 광장 바닥(생략 시 road) */
  hub?: TileKind
  blobs?: Blob[]
  /** 한쪽 가장자리를 물로(해안). 포탈이 없는 변을 자동 선택 */
  shore?: TileKind
  props: PropRef[]
  /** 셀당 소품 수 */
  propDensity: number
  /** 자연 지면(components/game/iso-terrain.tsx) — 칸 타일 대신 이어진 지면 + 물 표현(웅덩이/연못/바다) */
  painted?: boolean
  /** 물이 곧 바닥인 맵(심해) — 연못·바다 대신 걸을 수 있는 얕은 물 */
  flatWater?: boolean
  /** 바닥 장식(낮은 소품) — 기존 소품 배치 뒤에 따로 흩뿌린다(기존 배치는 그대로) */
  decor?: PropRef[]
  decorDensity?: number
  /** 연못 둘레 장식 · 연못 위 수련 */
  pondDecor?: PropRef[]
  lily?: boolean
  /** 지면 종류별 밝기 배율(자연 지면) */
  groundShade?: Partial<Record<TileKind, number>>
  /** 맵 전체 톤(1 초과 밝게, 1 미만 어둡게) — 에르디아 숲 첫 스테이지(1.12) 밝기를 기준으로 전 지역을 비슷하게 맞춘다 */
  tone?: number
  /** 고인 것의 종류(기본 물) — 용암: 작아도 둑이 있고 못 지나감 / 얼음: 땅 높이의 얼어붙은 호수, 지나감 */
  liquid?: 'water' | 'lava' | 'ice'
  /** 맵을 가로지르는 강(용암 강) — 한 변에서 맞은편 변으로 굽이치고, 길과 만나는 곳은 길이 덮어 자연 다리가 된다 */
  river?: { width: number }
  /** 지면 종류 → 텍스처(자연 지면) · 높이 순위 · 격자 밖 그늘 · 날씨 — GameMap.terrain 참고 */
  tex?: Partial<Record<TileKind, string>>
  rank?: Partial<Record<TileKind, number>>
  fog?: [number, number, number]
  weather?: 'snow' | 'embers' | 'storm'
  /** 같은 그림 솎아내기 간격 배율(기본 1) — 키 큰 첨탑·기둥이 많은 지역은 더 넓게 */
  spread?: number
}

/** 액체 종류 → 그 액체를 뜻하는 타일 종류(게임 로직의 tileAt 값) */
const LIQUID_TILE = { water: 'water', lava: 'demon-lava', ice: 'ice' } as const satisfies Record<string, TileKind>

// ── 지역별 자연 지면 묶음(2026-10-07) — 같은 타일 종류를 지역 텍스처로 바꿔 그린다 ──
/** 스톰헤이븐 — 폭풍 구름 위 고원: 구름 바닥 · 하얀 대리석 판 · 사암 포석 길 */
const SKY = {
  painted: true,
  spread: 1.45,
  tex: { 'sky-cloud': 'cloud', 'sky-marble': 'marble', 'sky-road': 'sky-road', 'ruin-stone': 'flagstone' },
  rank: { 'sky-cloud': 2, 'sky-marble': 1, 'ruin-stone': 1 },
  fog: [26, 26, 32],
  // 구름 바닥도 밝아서 햇살 오버레이 없이(1). 먹구름 맵은 1 아래로 살짝 눌러 흐린 날씨
  tone: 1,
} satisfies Partial<Theme>
/** 폐허 — 마른 풀밭에 깨진 포석이 드문드문 남은 옛 도시 */
const RUIN = {
  painted: true,
  spread: 1.45,
  tex: { 'ruin-moss': 'ruin-grass', 'ruin-stone': 'flagstone', plaza: 'flagstone', 'ruin-road': 'dirt', ash: 'grave-soil' },
  rank: { 'ruin-moss': 2 },
  tone: 1.08,
} satisfies Partial<Theme>
/** 설원 — 눈밭 · 바람에 그늘진 눈 · 밟힌 눈길 · 서리 돌판, 얼어붙은 호수, 잔잔한 눈 */
const SNOW = {
  painted: true,
  spread: 1.45,
  liquid: 'ice',
  tex: { snow: 'snow', 'aurora-snow': 'snow-shade', path: 'snow-path', 'aurora-stone': 'frost-stone', 'aurora-mist': 'snow-shade', 'aurora-road': 'snow-path' },
  rank: { snow: 2, 'aurora-snow': 2, 'aurora-mist': 2 },
  fog: [22, 24, 30],
  // 눈밭은 그 자체로 밝아 햇살 오버레이(tone>1)를 얹으면 하얗게 날아간다 — 흐린 눈 오는 날 톤으로 살짝 누르고 지면도 차갑게
  tone: 0.97,
  groundShade: { snow: 0.92, 'aurora-snow': 0.92, 'aurora-mist': 0.92, path: 0.95 },
  weather: 'snow',
} satisfies Partial<Theme>
/** 화산 — 화산재 · 현무암 판 · 붉은 잿길, 가라앉은 용암 웅덩이와 흐르는 용암 강, 날리는 불티 */
const LAVA = {
  painted: true,
  spread: 1.45,
  liquid: 'lava',
  tex: { ash: 'ash', 'demon-ash': 'ash', obsidian: 'basalt', 'demon-stone': 'basalt', path: 'cinder', 'demon-road': 'cinder' },
  rank: { ash: 2, 'demon-ash': 2, obsidian: 2, 'demon-stone': 2 },
  fog: [16, 9, 7],
  tone: 1.08,
  weather: 'embers',
} satisfies Partial<Theme>

const pick = (h: number, pairs: [number, TileKind][], last: TileKind): TileKind => {
  for (const [t, k] of pairs) if (h < t) return k
  return last
}

export const THEMES = {
  forest1: { base: (h) => pick(h, [[0.25, 'grass-dark']], 'grass'), road: 'dirt', blobs: [{ kind: 'water', count: 2, r: [1.4, 2.2] }], props: ['forest:tree', 'forest:tree', 'forest:bush', 'forest:bush', 'forest:rock', 'forest:mushroom', 'forest:log', 'forest:firefly'], propDensity: 0.05, painted: true, tone: 1.12, decor: ['forest:fern', 'forest:fern2', 'forest:flowers', 'forest:fern', 'forest:stump', 'forest:stump2'], decorDensity: 0.012, pondDecor: ['pond:cattail', 'pond:cattail2', 'pond:stone2', 'pond:cattail', 'forest:fern'], lily: true },
  forest2: { base: (h) => pick(h, [[0.5, 'grass-dark']], 'grass'), road: 'dirt', blobs: [{ kind: 'water', count: 1, r: [1.8, 2.6] }], props: ['forest:tree', 'forest:tree', 'forest:tree', 'forest:bush', 'forest:mushroom', 'forest:log', 'forest:firefly'], propDensity: 0.062, painted: true, tone: 1.1, decor: ['forest:fern', 'forest:fern2', 'forest:flowers', 'forest:fern', 'forest:stump', 'forest:stump2'], decorDensity: 0.012, pondDecor: ['pond:cattail', 'pond:cattail2', 'pond:stone2', 'pond:cattail', 'forest:fern'], lily: true },
  forest3: { base: (h) => pick(h, [[0.6, 'grass-dark']], 'grass'), road: 'dirt', hub: 'dirt', blobs: [{ kind: 'swamp', count: 2, r: [1.6, 2.4] }], props: ['forest:tree', 'forest:tree', 'forest:tree', 'forest:mushroom', 'forest:mushroom', 'forest:firefly', 'forest:firefly', 'forest:log'], propDensity: 0.07, painted: true, tone: 1.08, decor: ['forest:fern', 'forest:fern2', 'forest:flowers', 'forest:fern', 'forest:stump', 'forest:stump2'], decorDensity: 0.012, pondDecor: ['pond:cattail', 'pond:cattail2', 'pond:stone2', 'pond:cattail', 'forest:fern'], lily: true },
  cave: { base: (h) => pick(h, [[0.22, 'mine']], 'cave'), road: 'dirt', blobs: [{ kind: 'water', count: 2, r: [1.2, 1.8] }], props: ['cave:stalagmite', 'cave:stalagmite', 'cave:crystal', 'cave:mushroom', 'cave:rock'], propDensity: 0.06, painted: true, tone: 1.1, pondDecor: ['pond:stone2', 'cave:crystal', 'pond:stone'], groundShade: { dirt: 0.7 } },
  swamp: { base: (h) => pick(h, [[0.3, 'grass-dark']], 'swamp'), road: 'dirt', blobs: [{ kind: 'water', count: 6, r: [0.9, 1.6] }], props: ['swamp:reed', 'swamp:reed', 'swamp:mangrove', 'swamp:lilypad'], propDensity: 0.06, painted: true, tone: 1.08, pondDecor: ['pond:cattail', 'swamp:reed', 'pond:cattail2'], lily: true },
  sea1: { base: (h) => pick(h, [[0.08, 'grass']], 'sand'), road: 'dirt', shore: 'water', props: ['sea:driftwood', 'sea:rock', 'sea:coral', 'sea:dunegrass', 'sea:dunegrass'], propDensity: 0.045, painted: true, tone: 1.12 },
  sea2: { base: (h) => pick(h, [[0.1, 'grass']], 'sand'), road: 'dirt', blobs: [{ kind: 'water', count: 7, r: [1.0, 2.0] }], props: ['sea:coral', 'sea:coral', 'sea:rock', 'sea:driftwood', 'sea:dunegrass'], propDensity: 0.05, painted: true, tone: 1.12, pondDecor: ['sea:rock', 'pond:stone2', 'sea:dunegrass'] },
  sea3: { base: (h) => pick(h, [[0.04, 'grass']], 'sand'), road: 'dirt', hub: 'sand', shore: 'water', blobs: [{ kind: 'water', count: 5, r: [1.2, 2.2] }], props: ['sea:rock', 'sea:rock', 'sea:coral', 'sea:driftwood', 'sea:dunegrass'], propDensity: 0.05, painted: true, tone: 1.1, pondDecor: ['sea:rock', 'pond:stone2', 'sea:dunegrass'] },
  deepsea: { base: (h) => pick(h, [[0.3, 'sand']], 'water'), road: 'sand', props: ['deepsea:kelp', 'deepsea:kelp', 'deepsea:wreck', 'sea:coral', 'sea:rock'], propDensity: 0.055, painted: true, tone: 1.08, flatWater: true },
  seaCave: { base: (h) => pick(h, [[0.2, 'sand']], 'cave'), road: 'sand', blobs: [{ kind: 'water', count: 5, r: [1.0, 1.8] }], props: ['cave:crystal', 'cave:stalagmite', 'sea:coral', 'sea:rock', 'deepsea:kelp'], propDensity: 0.055, painted: true, tone: 1.08, pondDecor: ['pond:stone2', 'cave:crystal', 'sea:rock'], groundShade: { sand: 0.72 } },
  // 스톰헤이븐 — 구름 위 고원. 안쪽(2·3단계·첨탑)으로 갈수록 먹구름이 짙고 빗줄기·번개
  storm1: { ...SKY, base: (h) => pick(h, [[0.22, 'sky-marble']], 'sky-cloud'), road: 'sky-road', props: ['stormhaven:banner', 'stormhaven:stormgrass', 'stormhaven:stormgrass', 'stormhaven:floatrock'], propDensity: 0.04 },
  storm2: { ...SKY, tone: 0.97, tex: { ...SKY.tex, 'sky-marble': 'cloud-dark' }, rank: { 'sky-cloud': 2, 'sky-marble': 2 }, weather: 'storm', base: (h) => pick(h, [[0.42, 'sky-marble']], 'sky-cloud'), road: 'sky-road', props: ['stormhaven:floatrock', 'stormhaven:floatrock', 'stormhaven:stormgrass', 'stormhaven:banner'], propDensity: 0.04 },
  storm3: { ...SKY, tone: 0.97, tex: { ...SKY.tex, 'sky-cloud': 'cloud-dark' }, weather: 'storm', base: (h) => pick(h, [[0.3, 'sky-cloud'], [0.42, 'ruin-stone']], 'sky-marble'), road: 'sky-road', hub: 'ruin-stone', props: ['stormhaven:banner', 'stormhaven:floatrock', 'ruinsField:pillar', 'stormhaven:stormgrass', 'ruinsField:rubble'], propDensity: 0.04 },
  cloudRift: { ...SKY, base: (h) => pick(h, [[0.18, 'sky-marble']], 'sky-cloud'), road: 'sky-road', props: ['stormhaven:floatrock', 'stormhaven:floatrock', 'stormhaven:stormgrass'], propDensity: 0.04 },
  thunderSpire: { ...SKY, tex: { ...SKY.tex, 'sky-cloud': 'cloud-dark' }, weather: 'storm', tone: 0.94, base: (h) => pick(h, [[0.35, 'sky-cloud'], [0.5, 'ruin-stone']], 'sky-marble'), road: 'sky-road', props: ['ruinsField:pillar', 'stormhaven:banner', 'ruinsField:crystal', 'stormhaven:floatrock', 'stormhaven:floatrock'], propDensity: 0.038 },
  // 폐허 — 1단계는 풀밭 사이 포석 조각, 갈수록 포석이 넓어지고 3단계는 깨진 광장
  ruins1: { ...RUIN, base: (h) => pick(h, [[0.28, 'ruin-stone']], 'ruin-moss'), road: 'ruin-road', props: ['ruinsField:pillar', 'ruinsField:rubble', 'ruinsField:crystal', 'ruinsField:rubble', 'ruinsField:pillar'], propDensity: 0.038 },
  ruins2: { ...RUIN, base: (h) => pick(h, [[0.5, 'ruin-stone']], 'ruin-moss'), road: 'ruin-road', props: ['ruinsField:pillar', 'ruinsField:pillar', 'ruinsField:rubble', 'ruinsField:rubble', 'graveyard:deadtree'], propDensity: 0.04 },
  ruins3: { ...RUIN, base: (h) => pick(h, [[0.32, 'ruin-moss']], 'ruin-stone'), road: 'ruin-road', hub: 'plaza', props: ['ruinsField:pillar', 'ruinsField:crystal', 'ruinsField:rubble', 'graveyard:lantern', 'ruinsField:rubble'], propDensity: 0.036 },
  graveyard: { ...RUIN, tone: 1.02, groundShade: { 'ruin-moss': 0.82 }, base: (h) => pick(h, [[0.3, 'ruin-moss']], 'ash'), road: 'dirt', rank: { 'ruin-moss': 2, ash: 2 }, props: ['graveyard:tombstone', 'graveyard:tombstone', 'graveyard:deadtree', 'graveyard:lantern'], propDensity: 0.06 },
  catacomb: { ...RUIN, groundShade: { 'ruin-stone': 0.78, 'ruin-road': 0.8 }, base: (h) => pick(h, [[0.3, 'cave']], 'ruin-stone'), road: 'ruin-road', rank: {}, props: ['graveyard:tombstone', 'graveyard:lantern', 'ruinsField:pillar', 'cave:rock', 'ruinsField:rubble'], propDensity: 0.055 },
  // 설원 — 얼어붙은 호수(밟고 지나감)와 눈 내림. 얼음 동굴은 실내라 눈이 오지 않는다
  snow1: { ...SNOW, base: (h) => pick(h, [[0.2, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 2, r: [1.8, 2.8] }], props: ['snowfield:pine', 'snowfield:pine', 'snowfield:frostrock', 'snowfield:snowmound'], propDensity: 0.045 },
  snow2: { ...SNOW, base: (h) => pick(h, [[0.4, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 1, r: [2.2, 3.0] }], props: ['snowfield:snowmound', 'snowfield:snowmound', 'snowfield:frostrock', 'snowfield:pine'], propDensity: 0.04 },
  snow3: { ...SNOW, base: (h) => pick(h, [[0.18, 'aurora-snow']], 'snow'), road: 'path', hub: 'aurora-stone', blobs: [{ kind: 'ice', count: 1, r: [1.8, 2.4] }], props: ['snowfield:pine', 'snowfield:pine', 'snowfield:pine', 'snowfield:frostrock', 'snowfield:snowmound'], propDensity: 0.06 },
  iceCave: { ...SNOW, weather: undefined, fog: [12, 14, 20], base: (h) => pick(h, [[0.25, 'aurora-mist']], 'aurora-stone'), road: 'aurora-road', rank: { 'aurora-mist': 2 }, blobs: [{ kind: 'ice', count: 4, r: [1.4, 2.4] }], props: ['snowfield:icicle', 'cave:crystal', 'cave:crystal', 'cave:stalagmite', 'snowfield:frostrock'], propDensity: 0.055 },
  frozenLake: { ...SNOW, base: (h) => pick(h, [[0.25, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 3, r: [3.0, 4.4] }], props: ['snowfield:pine', 'snowfield:frostrock', 'snowfield:snowmound'], propDensity: 0.04 },
  // 화산 — 1단계 용암 웅덩이, 2단계부터 맵을 가로지르는 용암 강(길이 지나는 곳은 식은 바위 다리)
  volcano1: { ...LAVA, base: (h) => pick(h, [[0.4, 'obsidian']], 'ash'), road: 'path', blobs: [{ kind: 'demon-lava', count: 3, r: [1.1, 1.7] }], props: ['volcano:spire', 'volcano:deadtree', 'volcano:rock', 'volcano:sulfur', 'volcano:ashmound', 'volcano:vent'], propDensity: 0.045 },
  volcano2: { ...LAVA, base: (h) => pick(h, [[0.45, 'demon-stone']], 'demon-ash'), road: 'demon-road', river: { width: 1.5 }, blobs: [{ kind: 'demon-lava', count: 1, r: [1.0, 1.5] }], props: ['volcano:rock', 'volcano:rock', 'volcano:ashmound', 'volcano:spire', 'volcano:deadtree'], propDensity: 0.045 },
  volcano3: { ...LAVA, base: (h) => pick(h, [[0.55, 'obsidian']], 'ash'), road: 'demon-road', hub: 'demon-stone', river: { width: 1.8 }, blobs: [{ kind: 'demon-lava', count: 3, r: [1.2, 2.0] }], props: ['volcano:vent', 'volcano:spire', 'volcano:sulfur', 'volcano:rock', 'volcano:deadtree', 'volcano:ashmound'], propDensity: 0.045 },
  // 폐광산 — 보랏빛 광맥 타일 대신 갱도 돌바닥 + 진흙 웅덩이 자국
  mine: { painted: true, spread: 1.45, tone: 1.08, tex: { mine: 'cave', cave: 'mud' }, rank: { mine: 2 }, fog: [12, 9, 8], base: (h) => pick(h, [[0.32, 'cave']], 'mine'), road: 'dirt', props: ['mine:orevein', 'mine:beam', 'mine:cart', 'mine:rock', 'mine:orevein'], propDensity: 0.045 },
  lavaCave: { ...LAVA, base: (h) => pick(h, [[0.35, 'cave']], 'obsidian'), road: 'demon-road', river: { width: 1.4 }, blobs: [{ kind: 'demon-lava', count: 4, r: [1.0, 1.7] }], props: ['volcano:spire', 'cave:crystal', 'volcano:rock', 'cave:stalagmite'], propDensity: 0.05, groundShade: { cave: 0.85 } },
  demonCastle: { ...LAVA, base: (h) => pick(h, [[0.3, 'ash'], [0.62, 'demon-stone']], 'obsidian'), road: 'demon-road', blobs: [{ kind: 'demon-lava', count: 2, r: [1.0, 1.5] }], props: ['demonCastle:bones', 'demonCastle:banner', 'volcano:spire', 'volcano:rock', 'volcano:deadtree'], propDensity: 0.04 },
} satisfies Record<string, Theme>

export type ThemeId = keyof typeof THEMES

// ── 스펙 ────────────────────────────────────────────────────────────────────
export type Side = 'N' | 'S' | 'E' | 'W'

export interface FieldExit {
  to: MapId
  side: Side
  /** 변 위의 위치 0~1 */
  t: number
  label: string
  requiredLevel?: number
  kind?: Portal['kind']
}

export interface FieldMapSpec {
  id: MapId
  name: string
  bg: string
  theme: ThemeId
  special?: boolean
  /** 들어오는 입구(=뒤로 가는 포탈) */
  entry: { side: Side; t: number; back: MapId; label: string; backSpawn?: { x: number; y: number } }
  exits: FieldExit[]
  monsterPool: string[]
  boss?: string
  recommendedLevel: number
  seed: number
}

const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' }
export const oppositeSide = (s: Side) => OPPOSITE[s]

/** 변 위 좌표 — inset 만큼 안쪽 */
export function edgePoint(side: Side, t: number, w: number, h: number, inset: number): { x: number; y: number } {
  const clampT = (v: number, len: number) => Math.max(2.5, Math.min(len - 2.5, v * len))
  switch (side) {
    case 'N':
      return { x: clampT(t, w), y: inset }
    case 'S':
      return { x: clampT(t, w), y: h - inset }
    case 'W':
      return { x: inset, y: clampT(t, h) }
    case 'E':
      return { x: w - inset, y: clampT(t, h) }
  }
}

const PORTAL_INSET = 1.3
const SPAWN_INSET = 3.2

export interface BuiltFieldMap {
  map: Omit<GameMap, 'blockers'>
  props: PropDef[]
  /** 소품 외 충돌(연못·바다 칸) */
  blockers: { x0: number; y0: number; x1: number; y1: number }[]
  /** 이 맵의 포탈(to)로 되돌아올 때 설 위치 */
  arrivalFor: (to: MapId) => { x: number; y: number }
}

type Pt = { x: number; y: number }

/** 경로 폴리라인을 촘촘히 샘플링(사인 흔들림 포함) */
function samplePath(points: Pt[], rand: () => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(2, Math.ceil(len / 0.35))
    const nx = -(b.y - a.y) / (len || 1)
    const ny = (b.x - a.x) / (len || 1)
    const amp = 0.5 + rand() * 0.7
    const freq = 1.2 + rand() * 1.4
    const phase = rand() * Math.PI * 2
    for (let k = 0; k <= n; k++) {
      const t = k / n
      // 양 끝은 흔들림 0 — 경유점에서 끊기지 않게
      const wob = Math.sin(t * Math.PI * freq + phase) * amp * Math.sin(t * Math.PI)
      out.push({ x: a.x + (b.x - a.x) * t + nx * wob, y: a.y + (b.y - a.y) * t + ny * wob })
    }
  }
  return out
}

export function buildFieldMap(spec: FieldMapSpec): BuiltFieldMap {
  const { w, h } = spec.special ? SPECIAL_MAP_SIZE : FIELD_MAP_SIZE
  const theme: Theme = THEMES[spec.theme]
  const rand = mulberry32(spec.seed)

  // 포탈 · 스폰
  const entryPortal = edgePoint(spec.entry.side, spec.entry.t, w, h, PORTAL_INSET)
  const spawn = edgePoint(spec.entry.side, spec.entry.t, w, h, SPAWN_INSET)
  const exitPortals = spec.exits.map((e) => ({ e, cell: edgePoint(e.side, e.t, w, h, PORTAL_INSET), inner: edgePoint(e.side, e.t, w, h, SPAWN_INSET) }))

  // 길 — 입구 → (경유점) → [갈림길] → 출구들
  const center = { x: w / 2 + (rand() - 0.5) * w * 0.16, y: h / 2 + (rand() - 0.5) * h * 0.16 }
  const routes: Pt[][] = []
  const hubbed = exitPortals.length > 1
  if (hubbed) {
    routes.push([spawn, center])
    for (const x of exitPortals) routes.push([center, x.inner, x.cell])
  } else if (exitPortals.length === 1) {
    const target = exitPortals[0]
    const straight = OPPOSITE[spec.entry.side] === target.e.side
    if (straight) {
      // 마주 보는 변 — 가운데를 두 번 비틀어 S자로
      const dx = target.inner.x - spawn.x
      const dy = target.inner.y - spawn.y
      const len = Math.hypot(dx, dy) || 1
      const px = -dy / len
      const py = dx / len
      const off = (spec.entry.side === 'N' || spec.entry.side === 'S' ? w : h) * (0.16 + rand() * 0.08)
      const s = rand() < 0.5 ? 1 : -1
      const p1 = { x: spawn.x + dx * 0.33 + px * off * s, y: spawn.y + dy * 0.33 + py * off * s }
      const p2 = { x: spawn.x + dx * 0.68 - px * off * s * 0.8, y: spawn.y + dy * 0.68 - py * off * s * 0.8 }
      routes.push([spawn, p1, p2, target.inner, target.cell])
    } else {
      // 직각 — 모퉁이 쪽으로 꺾는 길
      // 입구에서 곧게 들어오다 중앙 쪽으로 크게 꺾어 출구로 — 모서리에 붙지 않게 무릎점을 중앙으로 당긴다
      const bendFirstX = spec.entry.side === 'N' || spec.entry.side === 'S'
      const knee = bendFirstX ? { x: spawn.x, y: target.inner.y } : { x: target.inner.x, y: spawn.y }
      const pull = 0.5 + rand() * 0.15
      const mid = { x: knee.x + (center.x - knee.x) * pull, y: knee.y + (center.y - knee.y) * pull }
      routes.push([spawn, mid, target.inner, target.cell])
    }
  }
  routes.unshift([entryPortal, spawn])
  const samples = routes.flatMap((r) => samplePath(r, rand))

  const ROAD_W = 1.3
  const roadGrid = new Uint8Array(w * h)
  const nearRoadDist = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      let best = 1e9
      for (const s of samples) {
        const d = (s.x - cx) ** 2 + (s.y - cy) ** 2
        if (d < best) best = d
      }
      const dist = Math.sqrt(best)
      nearRoadDist[y * w + x] = dist
      if (dist < ROAD_W || (hubbed && Math.hypot(cx - center.x, cy - center.y) < 2.6)) roadGrid[y * w + x] = 1
    }
  }
  const idx = (x: number, y: number) => Math.min(h - 1, Math.max(0, Math.floor(y))) * w + Math.min(w - 1, Math.max(0, Math.floor(x)))
  const roadAt = (x: number, y: number) => roadGrid[idx(x, y)] === 1
  const roadDist = (x: number, y: number) => nearRoadDist[idx(x, y)]

  // 지형 얼룩(연못·용암·얼음 등) — 길·포탈과 떨어진 곳에만
  const keepClear: (Pt & { r: number })[] = [
    { ...spawn, r: 3 },
    { ...entryPortal, r: 2.4 },
    ...exitPortals.flatMap((x) => [{ ...x.cell, r: 2.6 }, { ...x.inner, r: 2.2 }]),
    ...(hubbed ? [{ ...center, r: 3.4 }] : []),
  ]
  // 강(용암 강) — 한 변에서 맞은편 변으로 굽이친다. 입구·출구·갈림길을 가장 덜 건드리는 물길을 몇 번 뽑아 고른다.
  //  길은 강보다 먼저 판정되므로 길이 지나는 곳은 자연 다리(식은 바위)가 되어 막히지 않는다.
  const liquidTile: TileKind = LIQUID_TILE[theme.liquid ?? 'water']
  const riverW = theme.river?.width ?? 0
  const riverDist = new Float32Array(theme.river ? w * h : 0)
  if (theme.river) {
    let best: Pt[] = []
    let bestBad = Infinity
    for (let tries = 0; tries < 16 && bestBad > 0; tries++) {
      const vertical = rand() < 0.5
      const a = 0.2 + rand() * 0.6
      const b = 0.2 + rand() * 0.6
      const m1 = 0.15 + rand() * 0.7
      const m2 = 0.15 + rand() * 0.7
      const ctrl: Pt[] = vertical
        ? [{ x: a * w, y: -1.5 }, { x: m1 * w, y: h * 0.36 }, { x: m2 * w, y: h * 0.66 }, { x: b * w, y: h + 1.5 }]
        : [{ x: -1.5, y: a * h }, { x: w * 0.36, y: m1 * h }, { x: w * 0.66, y: m2 * h }, { x: w + 1.5, y: b * h }]
      const pts = samplePath(ctrl, rand)
      const bad = keepClear.filter((k) => pts.some((s) => Math.hypot(s.x - k.x, s.y - k.y) < k.r + riverW + 0.6)).length
      if (bad < bestBad) {
        bestBad = bad
        best = pts
      }
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let d = 1e9
        for (const s of best) d = Math.min(d, (s.x - x - 0.5) ** 2 + (s.y - y - 0.5) ** 2)
        riverDist[y * w + x] = Math.sqrt(d)
      }
  }
  const riverAt = (x: number, y: number) => riverW > 0 && riverDist[idx(x, y)] < riverW

  const blobs: (Pt & { r: number; kind: TileKind })[] = []
  for (const b of theme.blobs ?? []) {
    let placed = 0
    for (let tries = 0; tries < 200 && placed < b.count; tries++) {
      const r = b.r[0] + rand() * (b.r[1] - b.r[0])
      const x = r + 1 + rand() * (w - 2 * r - 2)
      const y = r + 1 + rand() * (h - 2 * r - 2)
      if (roadDist(x, y) < r + 1.2) continue
      if (riverW && riverDist[idx(x, y)] < r + riverW + 1.5) continue
      if (keepClear.some((k) => Math.hypot(k.x - x, k.y - y) < k.r + r)) continue
      if (blobs.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 1)) continue
      blobs.push({ x, y, r, kind: b.kind })
      placed++
    }
  }

  // 해안 — 포탈이 없는 변 중 하나를 물가로
  const usedSides = new Set<Side>([spec.entry.side, ...spec.exits.map((e) => e.side)])
  const shoreSide: Side | null = theme.shore ? ((['N', 'E', 'W', 'S'] as Side[]).find((s) => !usedSides.has(s)) ?? null) : null
  const shoreDepth = (along: number) => 3.2 + Math.sin(along * 0.28) * 1.4 + Math.sin(along * 0.11 + 1.3) * 0.8
  const inShore = (x: number, y: number, rd: (x: number, y: number) => number = roadDist) => {
    if (!shoreSide || !theme.shore) return false
    if (rd(x, y) < ROAD_W + 0.8) return false
    switch (shoreSide) {
      case 'N':
        return y < shoreDepth(x)
      case 'S':
        return y > h - shoreDepth(x)
      case 'W':
        return x < shoreDepth(y)
      case 'E':
        return x > w - shoreDepth(y)
    }
  }

  const tileAt = (x: number, y: number): TileKind => {
    if (roadAt(x, y)) {
      if (hubbed && theme.hub && Math.hypot(x - center.x, y - center.y) < 2.6) return theme.hub
      return theme.road
    }
    if (riverAt(x, y)) return liquidTile
    for (const b of blobs) {
      const wob = Math.sin(Math.atan2(y - b.y, x - b.x) * 3 + b.x) * 0.35
      if (Math.hypot(x - b.x, y - b.y) < b.r + wob) return b.kind
    }
    if (inShore(x, y)) return theme.shore!
    const hh = (((Math.floor(x) * 73856093) ^ (Math.floor(y) * 19349663) ^ spec.seed) >>> 0) % 1000 / 1000
    return theme.base(hh, x, y)
  }

  // 소품
  const props: PropDef[] = []
  const target = Math.round(w * h * theme.propDensity)
  for (let tries = 0; tries < target * 30 && props.length < target; tries++) {
    const x = 1 + rand() * (w - 2)
    const y = 1 + rand() * (h - 2)
    if (roadDist(x, y) < ROAD_W + 0.9) continue
    if (keepClear.some((k) => Math.hypot(k.x - x, k.y - y) < k.r)) continue
    const t = tileAt(x, y)
    if (t === 'water' || t === 'demon-lava' || t === 'ice') {
      // 물가 소품(수련·산호·켈프)만 물 위 허용
      const ref = theme.props[Math.floor(rand() * theme.props.length)]
      if (!/lilypad|coral|kelp/.test(ref) || t !== 'water') continue
      if (props.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 2.0)) continue
      props.push(fprop(ref, `${spec.id}-p${props.length}`, x, y))
      continue
    }
    if (props.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 2.0)) continue
    const ref = theme.props[Math.floor(rand() * theme.props.length)]
    if (/lilypad/.test(ref)) continue // 수련은 물 위에만(땅 위에 떠 있던 문제)
    props.push(fprop(ref, `${spec.id}-p${props.length}`, x, y))
  }

  // ── 자연 지면(components/game/iso-terrain.tsx) · 물 표현(lib/terrain.ts) ──
  //  tileAt(칸 단위, 게임 로직)은 그대로 두고, 그림용 at 은 같은 길·얼룩을 소수 좌표로 매끈하게 계산한다.
  let terrain: GameMap['terrain']
  const blockers: BuiltFieldMap['blockers'] = []
  if (theme.painted) {
    // 얼음은 땅 높이(밟고 지나감), 용암은 작아도 둑이 있다
    const pools = classifyPools(w, h, (x, y) => tileAt(x + 0.5, y + 0.5) === liquidTile, theme.flatWater || theme.liquid === 'ice', theme.liquid === 'lava')
    const pool = (x: number, y: number) => {
      const cx = Math.floor(x)
      const cy = Math.floor(y)
      return cx < 0 || cy < 0 || cx >= w || cy >= h ? null : pools[cy * w + cx]
    }
    const nEdge = valueNoise(spec.seed)
    const nPatch = valueNoise(spec.seed + 99)
    // 칸 중심 거리장(길·강)을 겹선형 보간 — 칸 계단 없는 곡선
    const bilerp = (field: Float32Array) => (x: number, y: number) => {
      const fx = Math.min(w - 1, Math.max(0, x - 0.5))
      const fy = Math.min(h - 1, Math.max(0, y - 0.5))
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const x1 = Math.min(w - 1, x0 + 1)
      const y1 = Math.min(h - 1, y0 + 1)
      const u = fx - x0
      const v = fy - y0
      const a = field[y0 * w + x0] * (1 - u) + field[y0 * w + x1] * u
      const b = field[y1 * w + x0] * (1 - u) + field[y1 * w + x1] * u
      return a * (1 - v) + b * v
    }
    const roadF = bilerp(nearRoadDist)
    const riverF = riverW ? bilerp(riverDist) : null
    const at = (x: number, y: number): TileKind => {
      const wob = (nEdge(x * 1.7, y * 1.7) - 0.5) * 0.55
      const inHub = hubbed && Math.hypot(x - center.x, y - center.y) + wob < 2.6
      if (inHub && theme.hub) return theme.hub
      if (inHub || roadF(x, y) + wob < ROAD_W) return theme.road
      if (riverF && riverF(x, y) + wob * 1.4 < riverW) return liquidTile
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, y - b.y)
        if (d > b.r + 0.36) continue // 흔들림(±0.35) 밖 — atan2 생략
        if (d < b.r - 0.36) return b.kind
        if (d < b.r + Math.sin(Math.atan2(y - b.y, x - b.x) * 3 + b.x) * 0.35) return b.kind
      }
      if (inShore(x, y, roadF)) return theme.shore!
      // 바탕 얼룩 — 칸 해시(소금후추 체크무늬) 대신 부드러운 노이즈 덩어리
      const n = nPatch(x * 0.28, y * 0.28) * 0.7 + nPatch(x * 0.9 + 50, y * 0.9) * 0.3
      return theme.base(Math.min(0.999, Math.max(0, (n - 0.5) * 2.4 + 0.5)), x, y)
    }
    terrain = { at, pool, shade: theme.groundShade, tone: theme.tone, tex: theme.tex, rank: theme.rank, liquid: theme.liquid, fog: theme.fog, weather: theme.weather }
    // 연못·바다는 못 들어간다 — 물 칸끼리 맞닿은 쪽은 틈 없이, 물가 쪽만 조금 안으로
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!poolBlocks(pools[y * w + x])) continue
        const open = (dx: number, dy: number) => !poolBlocks(pool(x + dx, y + dy)) && x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h
        blockers.push({ x0: x + (open(-1, 0) ? 0.12 : 0), y0: y + (open(0, -1) ? 0.12 : 0), x1: x + 1 - (open(1, 0) ? 0.12 : 0), y1: y + 1 - (open(0, 1) ? 0.12 : 0) })
      }
    // 물 위 소품(수련·산호·켈프)은 수면 높이로 — 칸 중심이 물이 아닌 가장자리 칸이면 이웃 물 칸의 표현을 따른다
    const poolNear = (x: number, y: number) => {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const pk = pool(x + dx, y + dy)
        if (pk) return pk
      }
      return null
    }
    for (const p of props) {
      if (tileAt(p.cell.x, p.cell.y) !== 'water') continue
      const pk = poolNear(p.cell.x, p.cell.y)
      if (pk) p.elev = -POOL_DEPTH[pk]
    }
    // 장식은 기존 배치 난수와 따로(기존 소품 자리는 그대로)
    const drand = mulberry32(spec.seed ^ 0x5eed)
    const free = (x: number, y: number, gap: number) =>
      x > 0.8 && y > 0.8 && x < w - 0.8 && y < h - 0.8 &&
      roadDist(x, y) > ROAD_W + 0.4 &&
      !keepClear.some((k) => Math.hypot(k.x - x, k.y - y) < k.r) &&
      !props.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < gap)
    const deco = (ref: PropRef, x: number, y: number) => props.push(fprop(ref, `${spec.id}-d${props.length}`, x, y))
    // 연못 둘레(천연 우물가) — 둑 바로 바깥에 부들·이끼 바위, 연못 위엔 수련
    for (const b of blobs) {
      if (b.kind !== 'water' || pool(b.x, b.y) !== 'pond') continue
      if (theme.pondDecor) {
        const n = 2 + Math.floor(drand() * 2)
        const a0 = drand() * Math.PI * 2
        for (let k = 0; k < n; k++) {
          const ang = a0 + (k / n) * Math.PI * 2 + (drand() - 0.5) * 0.6
          const rr = b.r + 0.75 + drand() * 0.3
          const x = b.x + Math.cos(ang) * rr
          const y = b.y + Math.sin(ang) * rr
          if (tileAt(x, y) === 'water' || !free(x, y, 1.1)) continue
          deco(theme.pondDecor[Math.floor(drand() * theme.pondDecor.length)], x, y)
        }
      }
      if (theme.lily) {
        const n = 1 + Math.floor(drand() * 2)
        for (let k = 0; k < n; k++) {
          const ang = drand() * Math.PI * 2
          const rr = drand() * Math.max(0, b.r - 1.1)
          const x = b.x + Math.cos(ang) * rr
          const y = b.y + Math.sin(ang) * rr
          if (pool(x, y) !== 'pond' || props.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 0.9)) continue
          const lp = fprop('swamp:lilypad', `${spec.id}-l${props.length}`, x, y)
          lp.elev = -POOL_DEPTH.pond
          props.push(lp)
        }
      }
    }
    // 바닥 장식(고사리·들꽃·그루터기)
    if (theme.decor) {
      const target = Math.round(w * h * (theme.decorDensity ?? 0.02))
      let placed = 0
      for (let tries = 0; tries < target * 30 && placed < target; tries++) {
        const x = 1 + drand() * (w - 2)
        const y = 1 + drand() * (h - 2)
        if (tileAt(x, y) === liquidTile || !free(x, y, 1.3)) continue
        deco(theme.decor[Math.floor(drand() * theme.decor.length)], x, y)
        placed++
      }
    }
    // 물가에 바짝 붙은 땅 소품(나무·표지판 등)은 꺼진 수면 위로 걸쳐 보이므로 뺀다
    // 용암은 둑이 달아올라 보여 소품을 더 멀리(1칸) 떼어 놓는다
    const nr = theme.liquid === 'lava' ? 1.8 : 1
    const nearWater = (x: number, y: number) =>
      [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4]].some(([dx, dy]) => at(x + dx * nr, y + dy * nr) === liquidTile)
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i]
      if ((p.elev ?? 0) < 0 || tileAt(p.cell.x, p.cell.y) === liquidTile) continue
      // 얼음 호수는 땅 높이지만 얼음 위에 나무가 박혀 보이지 않게 함께 정리
      if (poolNear(p.cell.x, p.cell.y) && (poolBlocks(poolNear(p.cell.x, p.cell.y)) || theme.liquid === 'ice') && nearWater(p.cell.x, p.cell.y)) props.splice(i, 1)
    }
  }

  // 같은 그림이 몰려 있으면 솎아 낸다(가시성) — 종류가 다른 소품끼리는 그대로, 같은 스프라이트가 가까이 반복될 때만 뒤에 놓인 쪽을 뺀다
  if (theme.painted) {
    const kept: PropDef[] = []
    for (const p of props) {
      const gap = (p.kind === 'tree' ? 3.0 : 4.2) * (theme.spread ?? 1)
      if (kept.some((q) => q.sprite === p.sprite && Math.hypot(q.cell.x - p.cell.x, q.cell.y - p.cell.y) < gap)) continue
      kept.push(p)
    }
    props.splice(0, props.length, ...kept)
  }

  // 포탈
  const portals: Portal[] = [
    {
      id: `${spec.id}-back`,
      cell: entryPortal,
      to: spec.entry.back,
      toSpawn: spec.entry.backSpawn,
      label: spec.entry.label,
      kind: 'exit',
    },
    ...exitPortals.map((x) => ({
      id: `${spec.id}-to-${x.e.to}`,
      cell: x.cell,
      to: x.e.to,
      label: x.e.label,
      requiredLevel: x.e.requiredLevel,
      kind: x.e.kind ?? ('portal' as const),
    })),
  ]

  // 보스 — 갈림길 옆 또는 입구에서 먼 쪽
  const bossCell = hubbed
    ? { x: center.x + (center.x < w / 2 ? 3.5 : -3.5), y: center.y - 3 }
    : edgePoint(OPPOSITE[spec.entry.side], 0.5, w, h, spec.special ? 5 : 7)

  const arrivalFor = (to: MapId) => {
    const x = exitPortals.find((p) => p.e.to === to)
    return x ? { ...x.inner } : { ...spawn }
  }

  return {
    props,
    blockers,
    arrivalFor,
    map: {
      id: spec.id,
      name: spec.name,
      kind: 'field',
      grid: { w, h },
      bg: spec.bg,
      render: 'iso',
      assets: 'raster',
      tileAt,
      roadAt,
      terrain,
      props,
      zones: [],
      monsterPool: spec.monsterPool,
      monsterDensity: spec.special ? 0.06 : 0.05,
      monsterSpacing: spec.special ? 2.2 : 2.6,
      bossSpawns: spec.boss ? [{ monsterId: spec.boss, cell: bossCell }] : undefined,
      recommendedLevel: spec.recommendedLevel,
      spawn,
      portals,
    },
  }
}
