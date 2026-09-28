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

// ── 필드 프롭 스프라이트(기존 에셋) ─────────────────────────────────────────────
type FieldSprite = { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number }; kind: PropDef['kind'] }
export const FIELD_SPRITES = {
  forest: {
    tree: { sprite: '/images/map/props/f_forest_tree.png', px: { w: 128, h: 160 }, anchor: { x: 64, y: 150 }, kind: 'tree' },
    bush: { sprite: '/images/map/props/f_forest_bush.png', px: { w: 96, h: 56 }, anchor: { x: 48, y: 52 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_forest_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 60 }, kind: 'bush' },
    mushroom: { sprite: '/images/map/props/f_forest_mushroom.png', px: { w: 72, h: 56 }, anchor: { x: 36, y: 52 }, kind: 'bush' },
    log: { sprite: '/images/map/props/f_forest_log.png', px: { w: 120, h: 56 }, anchor: { x: 60, y: 48 }, kind: 'bush' },
    firefly: { sprite: '/images/map/props/f_forest_firefly.png', px: { w: 56, h: 96 }, anchor: { x: 28, y: 92 }, kind: 'lamp' },
  },
  volcano: {
    spire: { sprite: '/images/map/props/f_volcano_spire.png', px: { w: 72, h: 144 }, anchor: { x: 36, y: 134 }, kind: 'tree' },
    deadtree: { sprite: '/images/map/props/f_volcano_deadtree.png', px: { w: 104, h: 136 }, anchor: { x: 52, y: 128 }, kind: 'tree' },
    rock: { sprite: '/images/map/props/f_volcano_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 58 }, kind: 'bush' },
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
}

const pick = (h: number, pairs: [number, TileKind][], last: TileKind): TileKind => {
  for (const [t, k] of pairs) if (h < t) return k
  return last
}

export const THEMES = {
  forest1: { base: (h) => pick(h, [[0.25, 'grass-dark']], 'grass'), road: 'dirt', blobs: [{ kind: 'water', count: 2, r: [1.4, 2.2] }], props: ['forest:tree', 'forest:tree', 'forest:bush', 'forest:bush', 'forest:rock', 'forest:mushroom', 'forest:log', 'forest:firefly'], propDensity: 0.05 },
  forest2: { base: (h) => pick(h, [[0.5, 'grass-dark']], 'grass'), road: 'dirt', blobs: [{ kind: 'water', count: 1, r: [1.8, 2.6] }], props: ['forest:tree', 'forest:tree', 'forest:tree', 'forest:bush', 'forest:mushroom', 'forest:log', 'forest:firefly'], propDensity: 0.062 },
  forest3: { base: (h) => pick(h, [[0.6, 'grass-dark']], 'grass'), road: 'dirt', hub: 'dirt', blobs: [{ kind: 'swamp', count: 2, r: [1.6, 2.4] }], props: ['forest:tree', 'forest:tree', 'forest:tree', 'forest:mushroom', 'forest:mushroom', 'forest:firefly', 'forest:firefly', 'forest:log'], propDensity: 0.07 },
  cave: { base: (h) => pick(h, [[0.22, 'mine']], 'cave'), road: 'dirt', blobs: [{ kind: 'water', count: 2, r: [1.2, 1.8] }], props: ['cave:stalagmite', 'cave:stalagmite', 'cave:crystal', 'cave:mushroom', 'cave:rock'], propDensity: 0.06 },
  swamp: { base: (h) => pick(h, [[0.3, 'grass-dark']], 'swamp'), road: 'dirt', blobs: [{ kind: 'water', count: 6, r: [0.9, 1.6] }], props: ['swamp:reed', 'swamp:reed', 'swamp:mangrove', 'swamp:lilypad'], propDensity: 0.06 },
  sea1: { base: (h) => pick(h, [[0.08, 'grass']], 'sand'), road: 'dirt', shore: 'water', props: ['sea:driftwood', 'sea:rock', 'sea:coral', 'sea:dunegrass', 'sea:dunegrass'], propDensity: 0.045 },
  sea2: { base: (h) => pick(h, [[0.1, 'grass']], 'sand'), road: 'dirt', blobs: [{ kind: 'water', count: 7, r: [1.0, 2.0] }], props: ['sea:coral', 'sea:coral', 'sea:rock', 'sea:driftwood', 'sea:dunegrass'], propDensity: 0.05 },
  sea3: { base: (h) => pick(h, [[0.04, 'grass']], 'sand'), road: 'dirt', hub: 'sand', shore: 'water', blobs: [{ kind: 'water', count: 5, r: [1.2, 2.2] }], props: ['sea:rock', 'sea:rock', 'sea:coral', 'sea:driftwood', 'sea:dunegrass'], propDensity: 0.05 },
  deepsea: { base: (h) => pick(h, [[0.3, 'sand']], 'water'), road: 'sand', props: ['deepsea:kelp', 'deepsea:kelp', 'deepsea:wreck', 'sea:coral', 'sea:rock'], propDensity: 0.055 },
  seaCave: { base: (h) => pick(h, [[0.2, 'sand']], 'cave'), road: 'sand', blobs: [{ kind: 'water', count: 5, r: [1.0, 1.8] }], props: ['cave:crystal', 'cave:stalagmite', 'sea:coral', 'sea:rock', 'deepsea:kelp'], propDensity: 0.055 },
  storm1: { base: (h) => pick(h, [[0.14, 'sky-marble']], 'sky-cloud'), road: 'sky-road', blobs: [{ kind: 'sky-marble', count: 3, r: [1.6, 2.4] }], props: ['stormhaven:banner', 'stormhaven:stormgrass', 'stormhaven:stormgrass', 'stormhaven:floatrock'], propDensity: 0.045 },
  storm2: { base: (h) => pick(h, [[0.06, 'sky-marble']], 'sky-cloud'), road: 'sky-road', blobs: [{ kind: 'sky-marble', count: 5, r: [1.4, 2.4] }], props: ['stormhaven:floatrock', 'stormhaven:floatrock', 'stormhaven:stormgrass', 'stormhaven:banner'], propDensity: 0.045 },
  storm3: { base: (h) => pick(h, [[0.12, 'ruin-stone']], 'sky-marble'), road: 'sky-road', hub: 'sky-cloud', props: ['stormhaven:banner', 'stormhaven:banner', 'stormhaven:floatrock', 'ruinsField:pillar', 'stormhaven:stormgrass'], propDensity: 0.05 },
  cloudRift: { base: (h) => pick(h, [[0.1, 'sky-marble']], 'sky-cloud'), road: 'sky-road', blobs: [{ kind: 'sky-marble', count: 4, r: [1.2, 2.0] }], props: ['stormhaven:floatrock', 'stormhaven:floatrock', 'stormhaven:stormgrass'], propDensity: 0.045 },
  thunderSpire: { base: (h) => pick(h, [[0.12, 'ruin-stone']], 'sky-marble'), road: 'sky-road', props: ['ruinsField:pillar', 'ruinsField:pillar', 'stormhaven:banner', 'ruinsField:crystal', 'stormhaven:floatrock'], propDensity: 0.055 },
  ruins1: { base: (h) => pick(h, [[0.23, 'plaza'], [0.38, 'dirt']], 'ash'), road: 'ruin-road', props: ['ruinsField:pillar', 'ruinsField:rubble', 'ruinsField:crystal', 'ruinsField:vine', 'ruinsField:vine'], propDensity: 0.05 },
  ruins2: { base: (h) => pick(h, [[0.4, 'ruin-stone'], [0.5, 'dirt']], 'ash'), road: 'ruin-road', props: ['ruinsField:pillar', 'ruinsField:pillar', 'ruinsField:rubble', 'ruinsField:rubble', 'ruinsField:vine'], propDensity: 0.055 },
  ruins3: { base: (h) => pick(h, [[0.3, 'ruin-moss'], [0.4, 'ash']], 'plaza'), road: 'ruin-road', hub: 'ruin-stone', props: ['ruinsField:pillar', 'ruinsField:crystal', 'ruinsField:crystal', 'ruinsField:rubble', 'graveyard:lantern'], propDensity: 0.055 },
  graveyard: { base: (h) => pick(h, [[0.28, 'ruin-moss']], 'ash'), road: 'dirt', props: ['graveyard:tombstone', 'graveyard:tombstone', 'graveyard:deadtree', 'graveyard:lantern'], propDensity: 0.065 },
  catacomb: { base: (h) => pick(h, [[0.3, 'cave']], 'ruin-stone'), road: 'ruin-road', props: ['graveyard:tombstone', 'graveyard:lantern', 'ruinsField:pillar', 'cave:rock', 'ruinsField:rubble'], propDensity: 0.06 },
  snow1: { base: (h) => pick(h, [[0.15, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 2, r: [1.8, 2.8] }], props: ['snowfield:pine', 'snowfield:frostrock', 'snowfield:icicle', 'snowfield:snowmound'], propDensity: 0.05 },
  snow2: { base: (h) => pick(h, [[0.35, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 1, r: [2.0, 2.8] }], props: ['snowfield:snowmound', 'snowfield:snowmound', 'snowfield:frostrock', 'snowfield:pine'], propDensity: 0.048 },
  snow3: { base: (h) => pick(h, [[0.12, 'aurora-snow']], 'snow'), road: 'path', hub: 'aurora-stone', props: ['snowfield:pine', 'snowfield:pine', 'snowfield:pine', 'snowfield:icicle', 'snowfield:frostrock'], propDensity: 0.065 },
  iceCave: { base: (h) => pick(h, [[0.2, 'aurora-mist']], 'aurora-stone'), road: 'aurora-road', blobs: [{ kind: 'ice', count: 5, r: [1.4, 2.4] }], props: ['snowfield:icicle', 'snowfield:icicle', 'cave:crystal', 'cave:stalagmite', 'snowfield:frostrock'], propDensity: 0.06 },
  frozenLake: { base: (h) => pick(h, [[0.2, 'aurora-snow']], 'snow'), road: 'path', blobs: [{ kind: 'ice', count: 3, r: [3.0, 4.4] }], props: ['snowfield:pine', 'snowfield:frostrock', 'snowfield:snowmound'], propDensity: 0.045 },
  volcano1: { base: (h) => pick(h, [[0.36, 'ash']], 'obsidian'), road: 'path', props: ['volcano:spire', 'volcano:deadtree', 'volcano:rock', 'volcano:vent', 'volcano:sulfur', 'volcano:ashmound'], propDensity: 0.05 },
  volcano2: { base: (h) => pick(h, [[0.45, 'demon-ash']], 'ash'), road: 'demon-road', blobs: [{ kind: 'demon-lava', count: 2, r: [1.0, 1.6] }], props: ['volcano:rock', 'volcano:rock', 'volcano:ashmound', 'volcano:spire', 'volcano:deadtree'], propDensity: 0.05 },
  volcano3: { base: (h) => pick(h, [[0.3, 'demon-stone']], 'obsidian'), road: 'demon-road', hub: 'demon-stone', blobs: [{ kind: 'demon-lava', count: 5, r: [1.2, 2.2] }], props: ['volcano:vent', 'volcano:vent', 'volcano:spire', 'volcano:sulfur', 'volcano:rock'], propDensity: 0.05 },
  mine: { base: (h) => pick(h, [[0.3, 'cave']], 'mine'), road: 'dirt', props: ['mine:orevein', 'mine:orevein', 'mine:beam', 'mine:cart', 'mine:rock'], propDensity: 0.06 },
  lavaCave: { base: (h) => pick(h, [[0.35, 'obsidian']], 'cave'), road: 'demon-road', blobs: [{ kind: 'demon-lava', count: 6, r: [1.0, 1.8] }], props: ['volcano:vent', 'volcano:spire', 'cave:crystal', 'volcano:rock'], propDensity: 0.055 },
  demonCastle: { base: (h) => pick(h, [[0.3, 'ash'], [0.5, 'demon-stone']], 'obsidian'), road: 'demon-road', props: ['demonCastle:bones', 'demonCastle:banner', 'volcano:spire', 'volcano:vent'], propDensity: 0.055 },
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
  const blobs: (Pt & { r: number; kind: TileKind })[] = []
  for (const b of theme.blobs ?? []) {
    let placed = 0
    for (let tries = 0; tries < 200 && placed < b.count; tries++) {
      const r = b.r[0] + rand() * (b.r[1] - b.r[0])
      const x = r + 1 + rand() * (w - 2 * r - 2)
      const y = r + 1 + rand() * (h - 2 * r - 2)
      if (roadDist(x, y) < r + 1.2) continue
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
  const inShore = (x: number, y: number) => {
    if (!shoreSide || !theme.shore) return false
    if (roadDist(x, y) < ROAD_W + 0.8) return false
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
    props.push(fprop(ref, `${spec.id}-p${props.length}`, x, y))
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
