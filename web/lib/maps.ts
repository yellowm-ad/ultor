import type { GameMap, MapId, ZoneDef, ZoneKind } from '@/lib/types'
import type { IsoStair, IsoStructGroup, PropDef, TileKind } from '@/lib/iso'
import { isoBox, propAABB } from '@/lib/iso'
import { assembleFieldMaps } from '@/lib/field-specs'
import { VILLAGE_NORTH, villageShift } from '@/lib/village-layout'
import { TOWN_DECOR, decorProps } from '@/lib/town-decor'
import { AW, AH, ACX, ENTRANCE_CY, atlantisTileAt, atlantisWaterAt, ATLANTIS_PROPS, ATLANTIS_BLOCKERS, ATLANTIS_STRUCTURES } from '@/lib/atlantis-map'
import { TOWN_W, TOWN_H, TOWN_CX, TOWN_ENTRANCE_CY } from '@/lib/town-builder'
import { RUIN_TOWN_TILE_AT, RUIN_TOWN_PROPS, RUIN_TOWN_BLOCKERS, AUR_TOWN_TILE_AT, AUR_TOWN_PROPS, AUR_TOWN_BLOCKERS, DEMON_TOWN_TILE_AT, DEMON_TOWN_PROPS, DEMON_TOWN_BLOCKERS } from '@/lib/theme-towns'
import { HALL_TEX, HALL_W, HALL_H, HALL_CX, FLOOR2, HALL_PAD_TOP, HALL2_PAD_BOTTOM, STAIR_TO_1F, STAIR_TO_2F, hallTileAt, hall2TileAt, hallStairs, hall2Stairs, hallDoorFront, buildHallFloor1, buildHallFloor2 } from '@/lib/academy-hall'
import type { HallDoorKey, HallExt } from '@/lib/academy-hall'
import {
  FLOOR3_ENTRY_X,
  GALLERY_WALL_SKIP,
  YEAR2_DOOR_X,
  galleryWallDecals,
  buildUpperFloor,
  upperPortals,
  upperRoomReturn,
  upperTileAt,
  UF_W,
  UF_H,
  UF_PAD_TOP,
  UF_SPAWN,
} from '@/lib/academy-upper'
import { ACADEMY_ROOM_DEFS, ARCHIVE_ROOM, ROOM_PAD_TOP, roomBlockers as roomBlockersAc } from '@/lib/academy-rooms'
import type { AcademyRoomKey } from '@/lib/academy-rooms'
import { dormStructures, dormBlockers, DORM_PAD_TOP } from '@/lib/dorm-room'
import { buildSecretPassage, secretTileAt, SECRET_W, SECRET_H, SECRET_PAD_TOP, SECRET_SPAWN, SECRET_EXIT, SECRET_DOOR_2F, SECRET_RETURN_2F } from '@/lib/academy-secret'
import { landmarkInterior, cryptRoom, CRYPT_W, CRYPT_H, CRYPT_SPAWN, CRYPT_EXIT, CRYPT_PAD_TOP, LM_W, LM_H, LM_SPAWN, LM_EXIT, LANDMARK_PAD_TOP } from '@/lib/landmark-interiors'
import { SKY_AW, SKY_AH, SKY_CX, SKY_ENTRANCE_CY, skyTownTileAt, SKY_TOWN_PROPS, SKY_TOWN_BLOCKERS } from '@/lib/skytown-map'

type Blocker = { x0: number; y0: number; x1: number; y1: number }

/**
 * 명시적 size/collide 가 없는 "점 배치" 프롭(야생 필드의 나무·기둥 등)에 줄 기본 충돌 반경.
 * kind 기준 — SOLID_KINDS 에 새 kind 를 추가할 때 여기도 같이 채워야 실제로 막힌다.
 */
const DEFAULT_COLLIDE_SIZE: Partial<Record<PropDef['kind'], { w: number; d: number }>> = {
  tree: { w: 0.5, d: 0.5 },
}

/** solid 프롭들의 충돌 사각형을 그림(footprint)에서 그대로 산출 → "보이는 것 = 막히는 것" */
/** 프롭 하나의 충돌 사각형(없으면 null) — buildBlockers 와 같은 규칙. 관리자 오브젝트 편집(lib/map-overrides)이 쓴다 */
export function propBlocker(p: PropDef): Blocker | null {
  const solid = p.solid || SOLID_KINDS.has(p.kind)
  if (!solid) return null
  if (p.collide || p.size) return propAABB(p)
  const fb = DEFAULT_COLLIDE_SIZE[p.kind]
  return fb ? propAABB({ ...p, collide: fb, radial: true }) : null
}

function buildBlockers(props: PropDef[], extra: Blocker[] = []): Blocker[] {
  const out: Blocker[] = [...extra]
  for (const p of props) {
    const solid = p.solid || SOLID_KINDS.has(p.kind)
    if (!solid) continue
    if (p.collide || p.size) {
      const a = propAABB(p)
      if (a) out.push(a)
      continue
    }
    // size/collide 미지정 프롭(야생 필드 fprop 점배치) — kind 기본 반경으로 중심 기준 박스 생성
    const fb = DEFAULT_COLLIDE_SIZE[p.kind]
    if (!fb) continue
    const a = propAABB({ ...p, collide: fb, radial: true })
    if (a) out.push(a)
  }
  return out
}

// ============================================================================
// 멀티맵 정의 — 메인 마을(안전) + 야생 스테이지(포탈 이동)
// 셀 = 200m. 맵마다 grid 크기가 다르며 정사각형이 아니어도 된다.
// 스테이지 트리(2026-09-28 개편, lib/field-specs.ts): 지역마다 기본 3단계 → 3단계 갈림길에서 특수맵 2 + 마을
//   forest → forest-2 → forest-3 ┬ cave · swamp            (+ 마을 귀환 마법진)
//   sea → sea-2 → sea-3            ┬ deepsea · sea-cave · atlantis(안전)
//   stormhaven → -2 → -3           ┬ cloud-rift · thunder-spire · sky-temple(안전)
//   ruins → ruins-2 → ruins-3      ┬ graveyard · catacomb · temple-ruin(안전)
//   snowfield → -2 → -3            ┬ ice-cave · frozen-lake · aurora-village(안전)
//   volcano → -2 → -3              ┬ mine · lava-cave · demon-village(안전) · demon-castle
// ============================================================================

function z(
  id: string,
  kind: ZoneKind,
  name: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  description: string,
): ZoneDef {
  return { id, kind, name, cell: { x0, y0, x1, y1 }, color, description, hasMonsters: false }
}

// ── 메인 마을 (52 × 53) — 아이소메트릭 도트 엔진 ────────────────────────────
// 2026-10-10 북쪽 확장: 아래 3×3 지구(옛 52×40 좌표로 적혀 있다) 위에 지구 한 줄(3칸)을 더 붙였다.
// 옛 좌표 기준 y<0 이 새 북쪽 띠이고, 맵을 내보낼 때 전부 VILLAGE_NORTH 만큼 남쪽으로 민다(lib/village-layout.ts).
// 3×3 지구를 넓게: [학교 쿼드·중앙 광장·하우징] / [기숙사·중앙 대도서관+공원·상점가]
//                 / [대성당 성역·햇살 농가·통문 주둔지]
// 대로는 폭 3셀, 외곽 순환로 2.5셀. 지구 사이는 넉넉한 녹지 완충.
const VILLAGE_BASE_ZONES: ZoneDef[] = [
  z('z-magic-hall', 'school', '학교 본교 쿼드', 2, 2, 17, 13, '#5b6bd6', '마법동·연금술동·마도구동이 안뜰을 둘러싼 본교. 시계탑과 대강당, 도서관 별관이 있다.'),
  z('z-quad', 'plaza', '중앙 대광장', 20, 2, 33, 13, '#8891b5', '분수와 동상이 선 마을 심장부. 사방으로 대로가 뻗는다.'),
  z('z-housing', 'village', '하우징 마을', 36, 2, 50, 13, '#6fae5d', '지붕색이 제각각인 저층 주거 블록과 뒷마당 정원.'),
  z('z-dorm', 'village', '기숙사 마을', 2, 16, 17, 25, '#5a9a6a', '견습생 기숙사와 공동 식당.'),
  // 옛 '수련의 투기장' 자리(2026-10-03 교체) — 구역 id 는 그대로 둔다(NPC·퀘스트 참조 보존)
  z('z-plaza', 'school', '중앙 대도서관', 20, 16, 33, 25, '#7a5cc4', '울토르 마법학교 중앙 대도서관. 시계탑 아래 수만 권의 마법서가 잠들어 있다.'),
  z('z-park', 'park', '마로니에 공원', 20, 25, 33, 28, '#4e9c4a', '대도서관과 농가 사이의 녹지 완충대.'),
  z('z-shops', 'shopStreet', '별빛 상점가', 36, 16, 50, 25, '#d9a441', '길게 늘어선 상가 — 무기·물약·도구·펫, 시장 회관과 여관, 길드홀.'),
  z('z-temple', 'temple', '성역 대성당', 2, 27, 17, 38, '#d8c98a', '돔 대성당과 종탑·회랑·성직자 숙소가 앞광장을 감싼다.'),
  z('z-farm', 'farm', '햇살 농가', 20, 28, 33, 38, '#c9a44a', '너른 밭이랑과 헛간·풍차·농가.'),
  z('z-barracks', 'military', '통문 주둔지', 36, 27, 50, 38, '#8a8f9c', '성벽과 망루로 두른 주둔지. 웅장한 군 통문이 야생으로 통한다.'),
]

/** 북쪽 확장 지구 — 지금 좌표(밀린 뒤) 기준 */
const VILLAGE_NORTH_ZONES: ZoneDef[] = [
  z('z-north-school', 'school', '학교 북관', 2, 2, 17, VILLAGE_NORTH, '#6a5bd6', '연구동과 실습동이 안뜰을 둘러싼 학교 북쪽 별관.'),
  z('z-north-garden', 'park', '학교 정원', 20, 2, 33, VILLAGE_NORTH, '#4e9c4a', '중앙 대광장 북쪽으로 이어지는 학교 정원.'),
  z('z-north-lot', 'shopStreet', '꽃길 장터', 36, 2, 50, VILLAGE_NORTH, '#d98aa0', '빵집·꽃집·책방이 우물 마당을 둘러싼 작은 장터.'),
]
const VILLAGE_ZONES: ZoneDef[] = [
  ...VILLAGE_NORTH_ZONES,
  ...VILLAGE_BASE_ZONES.map((zn) => ({ ...zn, cell: { ...zn.cell, y0: zn.cell.y0 + VILLAGE_NORTH, y1: zn.cell.y1 + VILLAGE_NORTH } })),
]

const VW = 52
const VH = 40 // 옛(확장 전) 세로 칸 수 — 아래 배치 코드의 기준
const VN = VILLAGE_NORTH
/** 학교 북관 안뜰 중심(옛 좌표 — y<0 이 북쪽 띠) */
const NORTH_COURT = { x: 9.5, y: -4.4 }
/** 북쪽 장터 마당 중심(옛 좌표) — 가게·노점은 lib/town-decor.ts */
const NORTH_MARKET = { x: 43, y: -5.2 }
const FOUNTAIN = { x: 26.5, y: 7.5 }
const LIBRARY = { x: 26.5, y: 20.5 }
/** 대도서관 앞마당 포석(건물 기단 + 둘레) — 셀 공간 사각형 */
const onLibraryCourt = (x: number, y: number) => Math.abs(x - LIBRARY.x) < 4.4 && Math.abs(y - LIBRARY.y) < 3.7
const TEMPLE_YARD = { x: 9.5, y: 32 } // 대성당 앞광장 중심

// 대로 축(지구 경계) — 폭 3셀
const AV_L = { a: 16.8, b: 19.8 } // 세로 대로 (학교/광장 사이)
const AV_R = { a: 32.8, b: 35.8 } // 세로 대로 (광장/상점가 사이)
const ST_N = { a: 12.8, b: 15.8 } // 가로 대로 (북측 지구 경계)
const ST_S = { a: 24.8, b: 27.8 } // 가로 대로 (남측 지구 경계)
const GATE_WAY = { a: 41.5, b: 45.5 } // 주둔지 의전 대로 (ST_S → 군 통문)
const between = (v: number, r: { a: number; b: number }) => v > r.a && v < r.b

/** 북쪽 확장 띠 지면(옛 좌표 y<0) — 외곽 순환로·세로 대로를 그대로 잇고 나머지는 잔디 */
function villageNorthTileAt(x: number, y: number): TileKind {
  if (x < 2.5 || x > VW - 2.5 || y < -VN + 2.5) return 'path'
  if (between(x, AV_L) || between(x, AV_R)) return 'path'
  // 중앙 대광장 북쪽 진입로를 정원 한가운데로 연장
  if (Math.abs(x - FOUNTAIN.x) < 1.5) return 'path'
  // 학교 북관 안뜰 포석 + 남쪽 길로 나가는 통로
  if (Math.hypot((x - NORTH_COURT.x) * 0.85, y - NORTH_COURT.y) < 3.4) return 'plaza'
  if (Math.abs(x - NORTH_COURT.x) < 1.2 && y > NORTH_COURT.y) return 'path'
  // 북쪽 장터 마당 포석 + 남쪽 길·서쪽 대로로 나가는 통로
  if (Math.hypot((x - NORTH_MARKET.x) * 0.8, y - NORTH_MARKET.y) < 2.9) return 'plaza'
  if (Math.abs(x - NORTH_MARKET.x) < 1.1 && y > NORTH_MARKET.y) return 'path'
  if (Math.abs(y - NORTH_MARKET.y) < 0.9 && x > AV_R.b - 0.1 && x < NORTH_MARKET.x) return 'path'
  return (Math.floor(x) * 7 + Math.floor(y + VN) * 13) % 9 === 0 ? 'grass-dark' : 'grass'
}

/** 마을 지면 타일(지금 좌표) */
function villageTileAt(x: number, y: number): TileKind {
  return y < VN ? villageNorthTileAt(x, y - VN) : villageBaseTileAt(x, y - VN)
}

// ── 이어 그리는 마을 지면(2026-10-10) — 야생맵과 같은 방식(components/game/iso-terrain.tsx)으로 한 장에 그린다 ──
const vHash = (x: number, y: number) => {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
/** 부드러운 얼룩 무늬(0~1) — 잔디 짙은 얼룩을 칸 네모 대신 둥글게 */
const vNoise = (x: number, y: number, cell: number) => {
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  const sm = (t: number) => t * t * (3 - 2 * t)
  const fx = sm(x / cell - gx)
  const fy = sm(y / cell - gy)
  const a = vHash(gx, gy)
  const b = vHash(gx + 1, gy)
  const c = vHash(gx, gy + 1)
  const d = vHash(gx + 1, gy + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
/** 마법학교 지구(본교 쿼드 + 북관) — 흙·잔디 대신 포장된 교정. 지금 좌표 */
const onSchoolGrounds = (x: number, y: number) => x > 2.5 && x < AV_L.a && y > 2.5 && y < ST_N.a + VN
/**
 * 마을 지면(이어 그리는 지면용) — 길·포석 자리는 칸 타일과 같고,
 * 학교 지구의 맨땅은 포장석('academy-marble' → pave-school), 잔디 얼룩은 둥근 얼룩으로.
 */
function villageTerrainAt(x: number, y: number): TileKind {
  const k = villageTileAt(x, y)
  // 교정 안은 길까지 같은 포장석으로(안뜰 포석 'plaza' 는 그대로 둔다)
  if (onSchoolGrounds(x, y) && k !== 'plaza') return 'academy-marble'
  if (k !== 'grass' && k !== 'grass-dark') return k
  return vNoise(x, y, 3.4) * 0.7 + vNoise(x + 40, y + 17, 1.3) * 0.3 > 0.62 ? 'grass-dark' : 'grass'
}

/** 옛 3×3 지구 지면 타일(옛 좌표) */
function villageBaseTileAt(x: number, y: number): TileKind {
  // 외곽 순환 보도 (2.5셀 폭)
  if (x < 2.5 || x > VW - 2.5 || y < 2.5 || y > VH - 2.5) return 'path'
  // 중앙 대도서관 앞마당 포석
  if (onLibraryCourt(x, y)) return 'plaza'
  // 중앙 대광장 (세로로 약간 눌린 타원 포석)
  const df = Math.hypot(x - FOUNTAIN.x, (y - FOUNTAIN.y) * 1.15)
  if (df < 7.4) return 'plaza'
  // 대성당 앞광장 포석
  if (Math.hypot((x - TEMPLE_YARD.x) * 1.1, y - TEMPLE_YARD.y) < 4.8) return 'plaza'
  // 농가 밭이랑 (공원에 자리 내주고 남쪽으로)
  if (x > 22.5 && x < 30.8 && y > 32.6 && y < 37.4) return 'field'
  // 대성당 앞광장 좌·우 대칭 반사 연못 — 이제 PixelLab 프롭(b-pondL/R)이 물+테두리를
  // 통째로 그려서 바닥 타일로 물을 덧칠할 필요가 없다 (타일 몇 개만 찍은 것처럼 보이던 문제).
  // 대로 격자 (지구 경계)
  if (between(x, AV_L) || between(x, AV_R) || between(y, ST_N) || between(y, ST_S)) return 'path'
  // 주둔지 의전 대로 (ST_S → 군 통문, 폭 4셀)
  if (between(x, GATE_WAY) && y > ST_S.a) return 'path'
  // 광장 → 사방 진입로 (폭 ~2.4)
  if (Math.abs(x - FOUNTAIN.x) < 2.4 && y > 2.0 && y < ST_N.b) return 'path'
  if (Math.abs(y - FOUNTAIN.y) < 2.2 && x > 2.0 && x < AV_R.b) return 'path'
  // 상점가 중앙 아케이드 통로 (동서)
  if (x > AV_R.a && x < VW - 2.5 && Math.abs(y - 20.5) < 1.5) return 'path'
  // 대성당 진입로 (외곽 순환로 → 앞광장)
  if (Math.abs(x - TEMPLE_YARD.x) < 1.5 && y > ST_S.a) return 'path'
  // 마로니에 공원 잔디 — 대도서관 남측, 농가 위까지 넉넉히 (밝은 잔디)
  if (
    x > 19.8 && x < 33 && y > ST_S.b && y < 32.6 &&
    !onLibraryCourt(x, y)
  )
    return 'grass'
  // 공원 산책로 (동서, 공원 한가운데)
  if (x > 19.8 && x < 33 && Math.abs(y - 29.9) < 0.7) return 'path'
  // 나머지 잔디 — 얼룩은 아주 드물게(풀 비율↑)
  return (Math.floor(x) * 7 + Math.floor(y) * 13) % 9 === 0 ? 'grass-dark' : 'grass'
}

// 충돌·정렬을 그림에서 그대로 뽑는 구조물 종류
const SOLID_KINDS = new Set<PropDef['kind']>([
  'hall', 'cottage', 'shop', 'dome', 'barn', 'windmill', 'colosseum', 'fountain', 'tower', 'wall',
  'statue', 'gazebo', 'cloister',
  // 야생 필드/던전 나무류(fprop 의 'tree' kind — 실제 나무·기둥·첨탑·맹그로브·켈프·현수막대 등
  // 굵은 수직 구조물 전부 포함)도 충돌 처리 — 뚫고 지나가지 못하게. bush/lamp kind(관목·작은
  // 바위·버섯·등불 등)는 저프로필 장식이라 의도적으로 보행 가능하게 둔다.
  'tree',
])
// 앵커가 footprint 중심인 원형 구조물 (z정렬·충돌 모두 중심 기준)
const RADIAL_KINDS = new Set<PropDef['kind']>(['colosseum', 'fountain', 'statue', 'gazebo'])

// ── Phase 2 라스터 소품 세트 (PixelLab 생성 → 축소·트림 완료) ──
// px = 파일 실제 픽셀, anchor = 파일 좌상단 기준 발밑 오프셋
const PROP_SPRITE: Partial<
  Record<PropDef['kind'], { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number } }>
> = {
  lamp: { sprite: '/images/map/props/lamp.png', px: { w: 14, h: 72 }, anchor: { x: 7, y: 72 } },
  bench: { sprite: '/images/map/props/bench.png', px: { w: 44, h: 30 }, anchor: { x: 22, y: 30 } },
  banner: { sprite: '/images/map/props/banner.png', px: { w: 23, h: 66 }, anchor: { x: 12, y: 66 } },
  postbox: { sprite: '/images/map/props/postbox.png', px: { w: 16, h: 42 }, anchor: { x: 8, y: 42 } },
  bicycle: { sprite: '/images/map/props/bicycle.png', px: { w: 39, h: 40 }, anchor: { x: 20, y: 40 } },
  trashbin: { sprite: '/images/map/props/trashbin.png', px: { w: 16, h: 30 }, anchor: { x: 8, y: 30 } },
  bush: { sprite: '/images/map/props/bush.png', px: { w: 28, h: 24 }, anchor: { x: 14, y: 24 } },
}

// 나무는 variant 별 스프라이트 — a/b/c 는 같은 초록나무의 소·중·대 프리스케일
const TREE_SPRITE: Record<string, { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number } }> = {
  b: { sprite: '/images/map/props/tree_green_sm.png', px: { w: 42, h: 48 }, anchor: { x: 21, y: 48 } },
  a: { sprite: '/images/map/props/tree_green_md.png', px: { w: 56, h: 64 }, anchor: { x: 28, y: 64 } },
  c: { sprite: '/images/map/props/tree_green_lg.png', px: { w: 70, h: 80 }, anchor: { x: 35, y: 80 } },
  g: { sprite: '/images/map/props/tree_gold.png', px: { w: 64, h: 70 }, anchor: { x: 32, y: 70 } },
  o: { sprite: '/images/map/props/tree_orange.png', px: { w: 56, h: 66 }, anchor: { x: 28, y: 66 } },
}

// 건물 라스터 스프라이트. anchor = 이미지 좌상단 기준, footprint 뒤쪽(격자 원점측) 꼭짓점 픽셀 위치.
type Rs = { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number } }
const B_ = (n: string, w: number, h: number, ax: number, ay: number): Rs => ({
  sprite: `/images/map/props/${n}.png`, px: { w, h }, anchor: { x: ax, y: ay },
})
// id 별 (개별 footprint)
const BUILDING_SPRITE: Record<string, Rs> = {
  // 대성당 앞광장 연못 — kind:'fountain' 공용이라 KIND_BUILDING_SPRITE.fountain(중앙광장 분수)로
  // 자동 덮어써지는 걸 막으려면 id 기준 오버라이드가 먼저 매치되어야 한다.
  'b-pondR': B_('temple_pond', 160, 96, 80, 96),
  'b-magic': B_('b_hall_magic', 259, 283, 130, 150),
  'b-alch': B_('b_hall_small', 157, 178, 79, 100),
  'b-arti': B_('b_hall_small', 157, 178, 79, 100),
  'b-auditorium': B_('b_hall_small', 157, 178, 79, 100),
  'b-library': B_('b_hall_small', 157, 178, 79, 100),
  // 중앙 대도서관(PixelLab Pro, 사용자 디자인 시안 기반) — 앵커 = 기단 다이아몬드 중심(radial)
  'b-grand-library': B_('b_grand_library', 384, 320, 192, 208),
  'b-commons': B_('b_hall_small', 157, 178, 79, 100),
  'b-clock': B_('b_clocktower', 83, 195, 42, 153),
  'b-belltower': B_('b_belltower', 90, 236, 45, 191),
  'b-market': B_('b_market', 198, 175, 99, 76),
  'b-inn': B_('b_inn', 173, 197, 87, 111),
  'b-guild': B_('b_guildhall', 173, 204, 87, 118),
  'b-gate': B_('b_gate_grand', 192, 171, 96, 75),
  'b-stable': B_('b_stable', 141, 121, 71, 51),
  'b-barrack0': B_('b_barrack', 154, 117, 77, 40),
  'b-barrack1': B_('b_barrack', 154, 117, 77, 40),
  'b-statue': B_('b_statue', 86, 156, 43, 134),
  'b-statue-saint': B_('b_statue', 86, 156, 43, 134),
  'b-gazebo': B_('b_gazebo', 120, 143, 60, 114),
  // 북쪽 확장 — 학교 북관
  'b-north-lab': B_('b_guildhall', 173, 204, 87, 118),
  'b-north-hallA': B_('b_hall_small', 157, 178, 79, 100),
  'b-north-hallB': B_('b_hall_small', 157, 178, 79, 100),
}
// kind 별 (동일 스프라이트 반복)
const KIND_BUILDING_SPRITE: Partial<Record<PropDef['kind'], Rs>> = {
  shop: B_('b_shop', 170, 171, 85, 86),
  stall: B_('b_stall', 70, 75, 35, 40),
  dome: B_('b_temple', 243, 232, 122, 110),
  barn: B_('b_barn', 115, 111, 58, 53),
  windmill: B_('b_windmill', 77, 134, 39, 96),
  tower: B_('b_tower', 58, 105, 29, 76),
  colosseum: B_('b_colosseum', 218, 149, 109, 89),
  fountain: B_('b_fountain', 115, 114, 58, 82),
  statue: B_('b_statue', 86, 156, 43, 134),
  gazebo: B_('b_gazebo', 120, 143, 60, 114),
  cloister: B_('b_cloister', 58, 44, 29, 44),
}
// 주택 지붕색 variant 별
const COTTAGE_SPRITE: Record<string, Rs> = {
  red: B_('b_cottage_red', 96, 111, 48, 63),
  slate: B_('b_cottage_slate', 96, 98, 48, 50),
  teal: B_('b_cottage_teal', 96, 115, 48, 67),
}
// 벤치 방향 variant (아이소 격자축 평행)
const BENCH_SPRITE: Record<string, Rs> = {
  l: B_('b_bench_l', 30, 30, 15, 30),
  r: B_('b_bench_r', 28, 30, 14, 30),
  // 분수 둘레 벤치 — 아틀란티스 4방향 세트 재사용(이름 = 앉아서 바라보는 방향: SE=+x, SW=+y, NW=-x, NE=-y).
  // 앵커 = 하단 중앙 → cell 은 벤치 바닥의 앞 꼭짓점(중심 + fw/2, fd/2)에 둔다(fountainBenchPair 참고).
  SE: B_('atlantis/atl3_benchSE', 53, 57, 26.5, 57),
  NW: B_('atlantis/atl3_benchNW', 55, 50, 27.5, 50),
  SW: B_('atlantis/atl3_benchSW', 53, 57, 26.5, 57),
  NE: B_('atlantis/atl3_benchNE', 55, 50, 27.5, 50),
}
/** 4방향 벤치 바닥 크기(셀) — 벤치 길이는 바라보는 축의 수직 방향 */
const BENCH_FOOT: Record<'SE' | 'NW' | 'SW' | 'NE', { fw: number; fd: number }> = {
  SE: { fw: 0.55, fd: 1.25 }, NW: { fw: 0.55, fd: 1.25 },
  SW: { fw: 1.25, fd: 0.55 }, NE: { fw: 1.25, fd: 0.55 },
}
// 성벽 세그먼트 (타일링) — facing 별 축
const WALL_SPRITE: Record<'left' | 'right', Rs> = {
  right: B_('b_wall_se', 46, 40, 23, 40), // +x 축 (화면 우하)
  left: B_('b_wall_sw', 46, 40, 23, 40), // +y 축 (화면 좌하)
}

/** 마을 오브젝트 배치 — 옛 좌표(0..VW, 0..VH)로 놓고 마지막에 북쪽 확장만큼 민다. 북쪽 띠는 y<0 */
function villageProps(): PropDef[] {
  const P: PropDef[] = []
  const TEMPLE_GARDEN: [number, number][] = [] // 대성당 앞광장 화단 좌표 — furniture 단계에서 배치
  // ════════ 학교 본교 쿼드 (x2–17, y2–13) — 안뜰을 건물이 둘러쌈 ════════
  P.push({ id: 'b-magic', kind: 'hall', cell: { x: 4.4, y: 2.8 }, size: { w: 5.0, d: 3.2 }, label: '마법동' })
  P.push({ id: 'b-alch', kind: 'hall', cell: { x: 2.6, y: 7.4 }, size: { w: 2.8, d: 2.6 }, label: '연금술동' })
  P.push({ id: 'b-arti', kind: 'hall', cell: { x: 2.6, y: 10.4 }, size: { w: 2.8, d: 2.4 }, label: '마도구동' })
  P.push({ id: 'b-auditorium', kind: 'hall', cell: { x: 13.0, y: 6.6 }, size: { w: 3.2, d: 3.0 }, label: '대강당' })
  P.push({ id: 'b-library', kind: 'hall', cell: { x: 6.6, y: 10.8 }, size: { w: 2.6, d: 1.8 }, label: '도서관 별관' })
  P.push({ id: 'b-clock', kind: 'tower', cell: { x: 13.6, y: 3.0 }, size: { w: 1.3, d: 1.3 }, label: '시계탑' })

  // ════════ 중앙 대광장 (x20–33, y2–13) ════════
  P.push({
    id: 'b-fountain', kind: 'fountain', cell: { x: FOUNTAIN.x, y: FOUNTAIN.y },
    size: { w: 2.8, d: 2.8 }, collide: { w: 4.2, d: 4.2 },
  })
  P.push({ id: 'b-statue', kind: 'statue', cell: { x: 21.5, y: 4.6 }, size: { w: 1.0, d: 1.0 }, label: '창립자 상' })
  P.push({ id: 'b-gazebo', kind: 'gazebo', cell: { x: 32.3, y: 11.7 }, size: { w: 1.8, d: 1.8 } })

  // ════════ 하우징 마을 (x36–50, y2–13) — 2줄 8동 ════════
  const houseVariants = ['red', 'slate', 'teal', 'red', 'slate', 'teal', 'red', 'slate']
  const houseSpots: [number, number][] = [
    [37.6, 3.0], [40.9, 3.0], [44.2, 3.0], [47.5, 3.0],
    [38.0, 7.6], [41.3, 7.6], [44.6, 7.6], [47.9, 7.6],
  ]
  houseSpots.forEach(([x, y], i) =>
    P.push({ id: `b-house${i}`, kind: 'cottage', cell: { x, y }, size: { w: 1.6, d: 1.4 }, variant: houseVariants[i] }),
  )

  // ════════ 기숙사 마을 (x2–17, y16–25) — 2열 6동 + 공동 식당 ════════
  const dormVariants = ['slate', 'teal', 'slate', 'teal', 'slate', 'teal']
  const dormSpots: [number, number][] = [
    [4.4, 17.4], [4.4, 20.6], [4.4, 23.8],
    [8.6, 17.4], [8.6, 20.6], [8.6, 23.8],
  ]
  dormSpots.forEach(([x, y], i) =>
    P.push({ id: `b-dorm${i}`, kind: 'cottage', cell: { x, y }, size: { w: 1.6, d: 1.4 }, variant: dormVariants[i] }),
  )
  P.push({ id: 'b-commons', kind: 'hall', cell: { x: 12.4, y: 19.0 }, size: { w: 3.0, d: 2.4 }, label: '공동 식당' })

  // ════════ 중앙 대도서관 (x20–33, y16–25) — 옛 수련의 투기장 자리 ════════
  // 기단 6.3×5.7셀(그림 실측). 충돌은 건물 몸체만 — 앞 계단·화단 쪽은 걸어서 다가갈 수 있게
  P.push({
    id: 'b-grand-library', kind: 'hall', cell: { x: LIBRARY.x, y: LIBRARY.y }, radial: true,
    size: { w: 6.3, d: 5.7 }, collide: { w: 5.2, d: 4.4 }, label: '중앙 대도서관',
  })

  // ════════ 별빛 상점가 (x36–50, y16–25) — 아케이드(y≈20.5) 양옆 상가 + 노점 ════════
  P.push({ id: 'b-shop', kind: 'shop', cell: { x: 37.4, y: 16.8 }, size: { w: 3.4, d: 2.6 }, label: '무기·물약 상가' })
  P.push({ id: 'b-market', kind: 'hall', cell: { x: 42.2, y: 16.6 }, size: { w: 3.4, d: 2.8 }, label: '시장 회관' })
  P.push({ id: 'b-guild', kind: 'hall', cell: { x: 46.6, y: 16.8 }, size: { w: 2.8, d: 2.6 }, label: '길드홀' })
  P.push({ id: 'b-inn', kind: 'hall', cell: { x: 37.6, y: 22.4 }, size: { w: 3.0, d: 2.4 }, label: '여관' })
  const stalls: [number, number, string][] = [
    [42.0, 19.0, '#c76153'], [44.6, 19.0, '#4f9b93'], [47.2, 19.0, '#c58f42'], [49.3, 19.0, '#6b6a9c'],
    [42.0, 22.2, '#6b6a9c'], [44.6, 22.2, '#c76153'], [47.2, 22.2, '#4f9b93'],
  ]
  stalls.forEach(([x, y, c], i) =>
    P.push({ id: `b-stall${i}`, kind: 'stall', cell: { x, y }, size: { w: 1.2, d: 1 }, variant: c }),
  )

  // ════════ 성역 대성당 (x2–17, y27–38) — 돔 + 종탑 + 회랑 + 숙소 + 앞광장 ════════
  P.push({ id: 'b-temple', kind: 'dome', cell: { x: 3.0, y: 27.8 }, size: { w: 4.8, d: 3.8 }, label: '성역 대성당' })
  P.push({ id: 'b-belltower', kind: 'tower', cell: { x: 13.4, y: 28.0 }, size: { w: 1.4, d: 1.4 }, label: '종탑' })
  // (회랑 콜로네이드 b-cloW/E 는 종탑·돔과 겹쳐 보이는 갈색 난간이라 제거 — 2026-09-28)
  P.push({ id: 'b-priest0', kind: 'cottage', cell: { x: 3.6, y: 35.4 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-priest1', kind: 'cottage', cell: { x: 6.4, y: 36.0 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-priest2', kind: 'cottage', cell: { x: 13.6, y: 35.6 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-statue-saint', kind: 'statue', cell: { x: TEMPLE_YARD.x, y: 32.4 }, size: { w: 1.0, d: 1.0 }, label: '성녀 상' })
  // 대성당 앞광장 반사 연못 — PixelLab 프롭(돌 테두리+수련). 좌측 연못·진입부 봉헌 조상 2기는
  // 광장이 답답해 보여 제거(2026-09-28), 우측 연못만 남김.
  // radial: true → cell 이 중심점. solid: true → 벤치·나무가 실제 footprint 만큼만 피해감.
  P.push({ id: 'b-pondR', kind: 'fountain', cell: { x: 13.3, y: 33.4 }, size: { w: 2.0, d: 1.2 }, radial: true, solid: true })
  // 대성당 정원 — 앞광장 둘레 화단(부시 타원 링) + 가로수 + 벤치 (배치 헬퍼는 아래에서 재적용)
  TEMPLE_GARDEN.push(
    ...Array.from({ length: 18 }, (_, a) => {
      const th = (a / 18) * Math.PI * 2
      return [TEMPLE_YARD.x + Math.cos(th) * 5.6, TEMPLE_YARD.y + Math.sin(th) * 4.9] as [number, number]
    }),
  )
  const templeGreen: [number, number, string][] = [
    [3.4, 31.2, 'c'], [3.4, 34.0, 'a'], [15.9, 34.6, 'c'], [15.9, 30.0, 'a'],
    [9.8, 37.2, 'a'], [6.0, 37.2, 'g'], [13.2, 37.2, 'o'], [3.6, 37.0, 'c'],
  ]
  // tg-t0(돔 옆)·tg-t4(앞광장 남측)는 제거 요청 — 인덱스(id)는 그대로 유지해 나머지 나무 id 가 안 바뀌게
  const TEMPLE_TREE_SKIP = new Set([0, 4])
  templeGreen.forEach(([x, y, v], i) => {
    if (!TEMPLE_TREE_SKIP.has(i)) P.push({ id: `tg-t${i}`, kind: 'tree', cell: { x, y }, variant: v })
  })

  // ════════ 햇살 농가 (x20–33, y33–38) — 밭을 서·동에서 헛간·풍차·농가가 감쌈 ════════
  P.push({ id: 'b-barn', kind: 'barn', cell: { x: 20.0, y: 32.8 }, size: { w: 2.6, d: 2.0 } })
  P.push({ id: 'b-mill', kind: 'windmill', cell: { x: 20.4, y: 35.6 }, size: { w: 1.6, d: 1.4 } })
  // 공원 남측 가로수(y≈31.7)와 겹쳐 지붕을 뚫고 나와 보이던 문제 — 밭 쪽으로 더 내림
  P.push({ id: 'b-farmhouse', kind: 'cottage', cell: { x: 31.0, y: 34.3 }, size: { w: 1.8, d: 1.6 }, variant: 'red' })

  // ════════ 통문 주둔지 (x36–50, y27–38) — 성벽 사각 + 망루 4 + 막사 + 마구간 + 군 통문 ════════
  const BX0 = 37, BX1 = 49, BY0 = 28.5, BY1 = 36.5
  P.push({ id: 'b-tw0', kind: 'tower', cell: { x: BX0, y: BY0 }, size: { w: 1.1, d: 1.1 } })
  P.push({ id: 'b-tw1', kind: 'tower', cell: { x: BX1, y: BY0 }, size: { w: 1.1, d: 1.1 } })
  P.push({ id: 'b-tw2', kind: 'tower', cell: { x: BX1, y: BY1 }, size: { w: 1.1, d: 1.1 } })
  P.push({ id: 'b-tw3', kind: 'tower', cell: { x: BX0, y: BY1 }, size: { w: 1.1, d: 1.1 } })
  // 성벽 세그먼트 타일링 — 개구부(북: ST_S 진입 x41.5~45.5 / 남: 군 통문 x41~45) 남기고
  const WSEG = 0.95
  const wallRunX = (tag: string, x0: number, x1: number, y: number) => {
    const n = Math.max(1, Math.round((x1 - x0) / WSEG))
    for (let i = 0; i < n; i++)
      P.push({ id: `b-w${tag}${i}`, kind: 'wall', cell: { x: x0 + (i + 0.5) * ((x1 - x0) / n), y }, size: { w: 0.9, d: 0.5 }, facing: 'right' })
  }
  const wallRunY = (tag: string, y0: number, y1: number, x: number) => {
    const n = Math.max(1, Math.round((y1 - y0) / WSEG))
    for (let i = 0; i < n; i++)
      P.push({ id: `b-w${tag}${i}`, kind: 'wall', cell: { x, y: y0 + (i + 0.5) * ((y1 - y0) / n) }, size: { w: 0.5, d: 0.9 }, facing: 'left' })
  }
  wallRunX('N0', BX0 + 1.0, 41.3, BY0 + 0.2) // 북벽 좌
  wallRunX('N1', 45.7, BX1 - 1.0, BY0 + 0.2) // 북벽 우
  wallRunX('S0', BX0 + 1.0, 40.8, BY1 + 0.2) // 남벽 좌
  wallRunX('S1', 45.2, BX1 - 1.0, BY1 + 0.2) // 남벽 우
  wallRunY('W', BY0 + 1.0, BY1 - 1.0, BX0 + 0.2) // 서벽
  wallRunY('E', BY0 + 1.0, BY1 - 1.0, BX1 + 0.2) // 동벽
  P.push({ id: 'b-barrack0', kind: 'hall', cell: { x: 38.0, y: 29.8 }, size: { w: 3.0, d: 1.8 }, label: '막사' })
  P.push({ id: 'b-barrack1', kind: 'hall', cell: { x: 38.0, y: 33.0 }, size: { w: 3.0, d: 1.8 }, label: '막사' })
  P.push({ id: 'b-stable', kind: 'hall', cell: { x: 46.0, y: 33.4 }, size: { w: 2.4, d: 2.0 }, label: '마구간' })
  P.push({ id: 'b-gate', kind: 'gate', cell: { x: 42.0, y: 37.4 }, size: { w: 3.4, d: 1.2 }, label: '군 통문' })
  // ════════════════════════════════════════════════════════════════════
  //  거리 furniture — 52×40 맵. 대로 가장자리 규칙 배치.
  //  건물 footprint 와 겹치면 자동 스킵(blocked).
  // ════════════════════════════════════════════════════════════════════
  // 이 시점엔 아직 종류 기반 solid/radial 플래그 부여 루프(함수 맨 끝)가 안 돌았으므로
  // p.solid 뿐 아니라 SOLID_KINDS 로도 판정해야 건물 footprint 가 실제로 걸러지고,
  // radial 구조물(분수·콜로세움 등, collide 를 직접 지정하고 radial 은 안 적은 경우)도
  // RADIAL_KINDS 로 미리 보정해야 propAABB 가 중심 기준 박스를 계산한다 — 안 그러면
  // "뒤쪽 모서리부터 +collide" 로 잘못 계산되어 실제보다 훨씬 크고 엉뚱한 방향으로 치우친
  // 박스가 나와 멀쩡한 위치의 벤치까지 차단해버린다.
  // (안 그러면 "건물 footprint 와 겹치면 자동 스킵" 주석과 달리 나무·벤치 등이 건물을 뚫고 배치됨).
  const solidBoxes = P.filter((p) => (p.solid || SOLID_KINDS.has(p.kind)) && p.size)
    .map((p) => propAABB(p.radial != null ? p : { ...p, radial: RADIAL_KINDS.has(p.kind) }))
    .filter((b): b is NonNullable<typeof b> => !!b)
  const blocked = (x: number, y: number, m = 0.4) =>
    solidBoxes.some((b) => x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m)
  const onPlaza = (x: number, y: number) =>
    Math.hypot(x - FOUNTAIN.x, (y - FOUNTAIN.y) * 1.15) < 7.4 ||
    Math.hypot((x - TEMPLE_YARD.x) * 1.1, y - TEMPLE_YARD.y) < 4.8
  const onRoad = (x: number, y: number) =>
    x < 2.5 || x > VW - 2.5 || y < 2.5 || y > VH - 2.5 ||
    between(x, AV_L) || between(x, AV_R) || between(y, ST_N) || between(y, ST_S) ||
    (between(x, GATE_WAY) && y > ST_S.a) ||
    (Math.abs(x - FOUNTAIN.x) < 2.4 && y > 2.0 && y < ST_N.b) || // 광장 남북 진입로
    (Math.abs(y - FOUNTAIN.y) < 2.2 && x > 2.0 && x < AV_R.b) || // 광장 동서 진입로
    (x > AV_R.a && x < VW - 2.5 && Math.abs(y - 20.5) < 1.5) || // 상점가 아케이드
    (Math.abs(x - TEMPLE_YARD.x) < 1.5 && y > ST_S.a) || // 대성당 진입로
    (x > 19.8 && x < 33 && Math.abs(y - 29.9) < 0.7) // 공원 산책로
    // 대성당 연못은 이제 실제 프롭(b-pondL/R, solid+radial)이라 blocked()/solidBoxes 가
    // 정확한 footprint 로 자동 처리 — 예전엔 반경 1.9 짜리 과도한 제외구역이라 근처 벤치까지
    // 전부 조용히 걸러내던 문제가 있었음.
  const place = (id: string, kind: PropDef['kind'], x: number, y: number, extra: Partial<PropDef> = {}) => {
    if (blocked(x, y) || onRoad(x, y) || onPlaza(x, y) || onLibraryCourt(x, y)) return
    P.push({ id, kind, cell: { x, y }, ...extra })
  }

  // ── 관목 울타리 — 광장·공원·앞광장 테두리 부시 줄 ──
  const bushRow = (tag: string, x0: number, y: number, x1: number, step = 0.8) => {
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / step))
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n
      if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `hd-${tag}-${i}`, kind: 'bush', cell: { x, y } })
    }
  }
  bushRow('plazN', 20.5, 2.9, 32.5) // 광장 북
  bushRow('plazS', 20.5, 12.2, 32.5) // 광장 남
  bushRow('parkN', 20.0, 28.0, 33.0) // 공원 북 (산책로 위)
  bushRow('parkS', 20.0, 32.1, 33.0) // 공원 남
  bushRow('parkMidL', 20.0, 30.9, 24.8, 0.7) // 산책로 남측 화단 좌
  bushRow('parkMidR', 28.6, 30.9, 33.0, 0.7) // 산책로 남측 화단 우

  // 대성당 앞광장 화단 링 + 벤치 (앞광장 포장 위 벤치는 직접 push)
  TEMPLE_GARDEN.forEach(([x, y], i) => {
    if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `tg-bush${i}`, kind: 'bush', cell: { x, y } })
  })
  // 앞광장 — 성녀 상 앞, 마주보는 벤치 두 쌍(관상 공간)
  // (원래 y오프셋 -0.2/+2.1 이 대성당 돔 남벽·연못 테두리와 겹쳐 4개 전부 조용히 걸러졌었음 —
  // 돔(y<32.0)·연못(y 32.4~34.4) 사이 빈 공간과 연못 남쪽으로 오프셋 재조정)
  const yardBench: [number, number, 'l' | 'r'][] = [
    [TEMPLE_YARD.x - 2.6, TEMPLE_YARD.y + 0.2, 'l'], [TEMPLE_YARD.x + 2.6, TEMPLE_YARD.y + 0.2, 'r'],
    [TEMPLE_YARD.x - 2.6, TEMPLE_YARD.y + 2.7, 'r'], [TEMPLE_YARD.x + 2.6, TEMPLE_YARD.y + 2.7, 'l'],
  ]
  yardBench.forEach(([x, y, v], i) => {
    if (i === 3) return // be-tp3(우측 연못 남서) 제거 요청
    if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `be-tp${i}`, kind: 'bench', cell: { x, y }, variant: v })
  })

  // ── 가로등 — 대로 양편(4셀 간격) + 광장·대도서관 앞마당·앞광장·의전대로 둘레 ──
  const lamps: [number, number][] = []
  for (const ex of [AV_L.a - 0.6, AV_L.b + 0.6, AV_R.a - 0.6, AV_R.b + 0.6])
    for (let y = 4; y <= 37; y += 4.2) lamps.push([ex, y])
  for (const ey of [ST_N.a - 0.6, ST_N.b + 0.6, ST_S.a - 0.6, ST_S.b + 0.6])
    for (let x = 4; x <= 49; x += 4.4) lamps.push([x, ey])
  for (let a = 0; a < 8; a++)
    lamps.push([FOUNTAIN.x + Math.cos((a / 8) * 6.283) * 8.4, FOUNTAIN.y + Math.sin((a / 8) * 6.283) * 7.2])
  for (const [dx, dy] of [[-5.9, -4.5], [5.9, -4.5], [-5.9, 4.5], [5.9, 4.5]] as const) lamps.push([LIBRARY.x + dx, LIBRARY.y + dy])
  for (let y = 29; y <= 36; y += 3) { lamps.push([GATE_WAY.a - 0.6, y]); lamps.push([GATE_WAY.b + 0.6, y]) }
  for (let a = 0; a < 6; a++)
    lamps.push([TEMPLE_YARD.x + Math.cos((a / 6) * 6.283) * 5.2, TEMPLE_YARD.y + Math.sin((a / 6) * 6.283) * 4.8])
  // 근접 중복 제거 (2.6셀 이내면 스킵)
  const keptLamps: [number, number][] = []
  for (const [x, y] of lamps) {
    if (keptLamps.some(([kx, ky]) => Math.hypot(kx - x, ky - y) < 2.6)) continue
    keptLamps.push([x, y])
  }
  keptLamps.forEach(([x, y], i) => place(`l${i}`, 'lamp', x, y))

  // ── 현수막 — 광장 남측 진입부 · 의전 대로 입구 ──
  place('bn0', 'banner', FOUNTAIN.x - 2.8, 12.4, { variant: '#5b6bd6' })
  place('bn1', 'banner', FOUNTAIN.x + 2.8, 12.4, { variant: '#c58f42' })
  place('bn2', 'banner', GATE_WAY.a - 0.7, ST_S.b + 0.6, { variant: '#b64430' })
  place('bn3', 'banner', GATE_WAY.b + 0.7, ST_S.b + 0.6, { variant: '#b64430' })

  // ── 벤치 — 분수 둘레 / 아케이드 / 대도서관 앞마당. variant l|r = 아이소 축 방향 ──
  // (과거 좌표들이 진입로/대로 판정 경계에 딱 걸쳐 onRoad()에 은근슬쩍 걸러지던 문제 —
  // 분수 진입로 폭 ±2.2, 아케이드 폭 ±1.5, 대로 AV_L/AV_R 과 확실히 떨어지도록 여유를 둠)
  const benchSpots: [number, number, 'l' | 'r'][] = [
    [36.2, 22.2, 'l'], [43.5, 22.2, 'r'], [48.0, 22.2, 'l'], // 아케이드(북측은 상가 건물과 겹쳐 전부 남측으로)
    [LIBRARY.x - 4.6, LIBRARY.y + 3.3, 'r'], [LIBRARY.x + 4.6, LIBRARY.y - 3.3, 'l'], // 대도서관 앞마당 모서리
  ]
  benchSpots.forEach(([x, y, v], i) => {
    if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `be${i + 4}`, kind: 'bench', cell: { x, y }, variant: v })
  })

  // ── 중앙 분수 벤치 — 분수를 바라보는 벤치를 한 변에 두 개씩(서·북·동 3면. 남측은 광장 진입 동선이라 비움).
  // 예전 분수 대각 벤치 4개(be0~3)는 방향이 어긋나 보여 이걸로 교체.
  const fountainBenchPair = (tag: string, dir: 'SE' | 'NW' | 'SW' | 'NE', cx: number, cy: number, gap = 1.15) => {
    const { fw, fd } = BENCH_FOOT[dir]
    const alongY = dir === 'SE' || dir === 'NW' // 서·동 벤치는 y축을 따라 나란히
    for (const s of [-1, 1]) {
      const x = cx + (alongY ? 0 : s * gap)
      const y = cy + (alongY ? s * gap : 0)
      P.push({ id: `be-fn${tag}${s < 0 ? 0 : 1}`, kind: 'bench', cell: { x: x + fw / 2, y: y + fd / 2 }, variant: dir })
    }
  }
  fountainBenchPair('w', 'SE', FOUNTAIN.x - 3.5, FOUNTAIN.y) // 서쪽 → 동(분수)을 봄
  fountainBenchPair('n', 'SW', FOUNTAIN.x, FOUNTAIN.y - 3.5) // 북쪽 → 남(분수)을 봄
  fountainBenchPair('e', 'NW', FOUNTAIN.x + 3.5, FOUNTAIN.y - 0.7) // 동쪽 → 서(분수)를 봄 (남쪽 정자 지붕에 안 가리게 살짝 북으로)

  // ── 마로니에 공원 벤치 — 산책로 양편에 마주보게, 가운데 정자 축은 비워 자연스럽게 ──
  const parkBench: { x: number; y: number; v: 'l' | 'r' }[] = []
  for (const bx of [21.2, 23.8, 29.6, 32.2]) {
    parkBench.push({ x: bx, y: 28.7, v: 'l' }) // 북측: 산책로 남향
    parkBench.push({ x: bx + 0.5, y: 31.0, v: 'r' }) // 남측: 살짝 엇갈려 북향
  }
  parkBench.forEach(({ x, y, v }, i) => {
    if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `be-pk${i}`, kind: 'bench', cell: { x, y }, variant: v })
  })

  // ── 쓰레기통 — 대로 교차점 4곳 + 분수/공원 벤치 옆 ──
  const bins: [number, number][] = [
    [AV_L.a - 0.7, ST_N.a - 0.7], [AV_R.b + 0.7, ST_N.a - 0.7],
    [AV_L.a - 0.7, ST_S.b + 0.7], [AV_R.b + 0.7, ST_S.b + 0.7],
    [FOUNTAIN.x + 1.4, FOUNTAIN.y - 3.2], [24.0, 29.3], [41.7, 19.2],
    [TEMPLE_YARD.x + 1.4, TEMPLE_YARD.y - 3.0],
  ]
  bins.forEach(([x, y], i) => place(`tb${i}`, 'trashbin', x, y))

  // ── 우체통 — 광장 모서리·상점가·하우징 앞 ──
  const postboxes: [number, number][] = [[19.0, 3.0], [FOUNTAIN.x + 5.0, 12.2], [36.0, 15.0], [36.0, 3.0]]
  postboxes.forEach(([x, y], i) => place(`pb${i}`, 'postbox', x, y))

  // ── 자전거 — 상점·여관·집 입구 ──
  const bikes: [number, number][] = [[40.5, 19.6], [37.6, 24.4], [37.6, 5.0], [45.0, 5.2]]
  bikes.forEach(([x, y], i) => place(`bi${i}`, 'bicycle', x, y))

  // ── 나무 — 대로 verge 가로수 열 + 잔디 군집 ──
  const trees: [number, number, string][] = []
  // AV_L / AV_R verge 가로수 (건물 없는 구간)
  for (const ex of [AV_L.a - 1.3, AV_R.b + 1.3])
    for (let y = 5; y <= 36; y += 3.5) trees.push([ex, y, 'aacgo'[(y | 0) % 5]])
  // ST_N / ST_S verge
  for (const ey of [ST_N.a - 1.3, ST_S.b + 1.3])
    for (let x = 5; x <= 48; x += 4) trees.push([x, ey, 'gaoca'[(x | 0) % 5]])
  // 잔디 군집
  const clusters: [number, number, string][] = [
    [10.5, 6.0, 'c'], [15.0, 10.5, 'a'], [9.5, 12.0, 'g'], // 학교 안뜰 주변
    [24.0, 3.4, 'a'], [29.5, 4.0, 'o'], [22.0, 11.0, 'g'], [31.0, 11.5, 'c'], // 광장 코너
    [38.5, 11.0, 'a'], [43.0, 11.2, 'g'], [48.0, 5.5, 'o'], // 하우징 정원
    [12.5, 22.5, 'c'], [7.0, 15.5, 'g'], [3.5, 22.0, 'a'], // 기숙사
    [21.5, 35.0, 'o'], [31.6, 36.0, 'g'], // 농가 구석
    [48.0, 20.5, 'c'], [48.5, 30.0, 'g'], // 상점가·주둔지 동편
    [LIBRARY.x - 7.5, LIBRARY.y - 5, 'b'], [LIBRARY.x + 7.5, LIBRARY.y - 5, 'b'],
    // 마로니에 공원 — 밤나무 가로수 밀집. 산책로 y29.9 위·아래 2열 + 양 끝 큰나무
    [20.6, 28.3, 'c'], [23.0, 28.3, 'a'], [25.4, 28.3, 'c'], [28.0, 28.3, 'a'], [30.4, 28.3, 'c'], [32.3, 28.4, 'a'],
    [20.6, 31.7, 'a'], [23.6, 31.8, 'c'], [29.4, 31.8, 'c'], [32.4, 31.7, 'a'],
    [19.9, 29.9, 'g'], [32.8, 29.9, 'g'],
  ]
  trees.push(...clusters)
  trees.forEach(([x, y, v], i) => {
    if (!blocked(x, y, 0.6) && !onRoad(x, y) && !onPlaza(x, y) && !onLibraryCourt(x, y))
      P.push({ id: `t${i}`, kind: 'tree', cell: { x, y }, variant: v })
  })
  // 공원 중앙 정자(연주대) + 산책로변 쓰레기통
  P.push({ id: 'b-parkgazebo', kind: 'gazebo', cell: { x: 26.6, y: 31.6 }, size: { w: 1.8, d: 1.6 } })
  place('tb-pk0', 'trashbin', 23.0, 30.9)
  place('tb-pk1', 'trashbin', 30.2, 29.0)

  // ════════ 북쪽 확장 띠 (옛 좌표 y -10.5–0) — 학교 북관 / 학교 정원 / 꽃길 장터(가게·노점은 lib/town-decor.ts) ════════
  // place() 는 y<2.5 를 외곽 순환로로 보고 걸러내므로 여기는 직접 push 한다.
  // 학교 북관 (x2.5–16.8) — 북쪽에 건물 3동, 남쪽에 안뜰
  P.push({ id: 'b-north-hallA', kind: 'hall', cell: { x: 3.2, y: -9.8 }, size: { w: 2.8, d: 2.6 }, label: '실습동' })
  P.push({ id: 'b-north-lab', kind: 'hall', cell: { x: 7.6, y: -10.0 }, size: { w: 2.8, d: 2.6 }, label: '마법 연구동' })
  P.push({ id: 'b-north-hallB', kind: 'hall', cell: { x: 12.4, y: -9.8 }, size: { w: 2.8, d: 2.6 }, label: '기록관' })
  // (관측탑 자리에는 회색 성곽 탑 대신 망원경·지구본을 놓았다 — lib/town-decor VILLAGE '학교 북관')
  P.push({ id: 'b-north-statue', kind: 'statue', cell: { x: NORTH_COURT.x, y: NORTH_COURT.y }, size: { w: 1.0, d: 1.0 }, label: '초대 교장 상' })
  P.push({ id: 'be-nc0', kind: 'bench', cell: { x: NORTH_COURT.x - 2.4, y: NORTH_COURT.y + 0.4 }, variant: 'l' })
  P.push({ id: 'be-nc1', kind: 'bench', cell: { x: NORTH_COURT.x + 2.4, y: NORTH_COURT.y + 0.4 }, variant: 'r' })
  // 학교 정원 (x19.8–33) — 가운데 길 양옆으로 나무·관목·벤치, 동쪽에 정자
  P.push({ id: 'b-north-gazebo', kind: 'gazebo', cell: { x: 30.2, y: -5.4 }, size: { w: 1.8, d: 1.8 } })
  for (const [i, bx] of [20.4, 21.2, 22.0, 22.8, 23.6, 24.4, 28.6, 29.4, 30.2, 31.0, 31.8, 32.6].entries()) {
    P.push({ id: `hd-ngN-${i}`, kind: 'bush', cell: { x: bx, y: -10.0 } })
    P.push({ id: `hd-ngS-${i}`, kind: 'bush', cell: { x: bx, y: -0.4 } })
  }
  P.push({ id: 'be-ng0', kind: 'bench', cell: { x: 24.4, y: -7.0 }, variant: 'r' })
  P.push({ id: 'be-ng1', kind: 'bench', cell: { x: 24.4, y: -3.4 }, variant: 'r' })
  P.push({ id: 'be-ng2', kind: 'bench', cell: { x: 28.6, y: -7.0 }, variant: 'l' })
  const northTrees: [number, number, string][] = [
    [5.0, -5.6, 'c'], [3.6, -2.2, 'a'], [13.6, -1.6, 'g'], [15.6, -6.2, 'a'], // 학교 북관
    [20.8, -8.6, 'c'], [23.0, -8.8, 'a'], [20.8, -5.2, 'g'], [22.6, -2.2, 'c'], [20.6, -1.8, 'a'], // 정원 서편
    [29.6, -8.8, 'a'], [32.2, -8.6, 'c'], [32.4, -2.4, 'o'], [29.4, -2.0, 'a'], // 정원 동편
  ]
  northTrees.forEach(([x, y, v], i) => P.push({ id: `t-n${i}`, kind: 'tree', cell: { x, y }, variant: v }))
  for (const [i, ex] of [AV_L.a - 0.6, AV_L.b + 0.6, AV_R.a - 0.6, AV_R.b + 0.6].entries())
    for (const [k, y] of [-8.6, -4.4].entries()) P.push({ id: `l-n${i}${k}`, kind: 'lamp', cell: { x: ex, y } })

  // 종류 기반 플래그 + 라스터 스프라이트 일괄 부여 (개별 push 에서 누락 방지)
  for (const p of P) {
    if (SOLID_KINDS.has(p.kind)) p.solid = true
    if (RADIAL_KINDS.has(p.kind)) p.radial = true
    const rs =
      BUILDING_SPRITE[p.id] ??
      (p.kind === 'cottage'
        ? COTTAGE_SPRITE[p.variant ?? 'slate']
        : p.kind === 'tree'
          ? TREE_SPRITE[p.variant ?? 'a']
          : p.kind === 'bench'
            ? BENCH_SPRITE[p.variant ?? 'l']
            : p.kind === 'wall'
              ? WALL_SPRITE[p.facing ?? 'right']
              : KIND_BUILDING_SPRITE[p.kind] ?? PROP_SPRITE[p.kind])
    if (rs) {
      p.sprite = rs.sprite
      p.px = rs.px
      p.anchor = rs.anchor
    }
  }
  // 대성당 회랑·좌측 연못·봉헌 조상을 빼자 그 자리에 막혀 있던 자동 배치 소품(가로등·쓰레기통·나무·관목)이
  // 새로 튀어나옴 → 제거 전 모습 그대로 두도록 명시적으로 뺀다.
  const SUPPRESSED = new Set(['l6', 'l65', 'l67', 'tb2', 't7', 'tg-bush3', 'tg-bush9'])
  // 옛 좌표 → 지금 좌표(북쪽 확장만큼 남쪽으로)
  return P.filter((p) => !SUPPRESSED.has(p.id)).map((p) => ({ ...p, cell: villageShift(p.cell) }))
}

const VILLAGE_PROPS = villageProps()
// 블로커 = solid 프롭들의 footprint 에서 자동 생성 → 보이는 벽 = 막히는 벽
const VILLAGE_BLOCKERS = buildBlockers(VILLAGE_PROPS)

// ── 학교 북관 테라스(2026-10-10) — 마을 북서 모서리(학교 북관 지구)를 낮은 대리석 단 위로 올린다. ──
//    남쪽 가운데 계단으로 오르내린다(나머지 가장자리는 막힘). 단 위의 프롭은 맨 끝(MAPS 조립 뒤)에서 높이만큼 올린다.
//    좌표는 지금 마을 좌표(북쪽 확장 뒤).
const NORTH_TERRACE = { x1: 17.4, y1: 11.4, z: 26, stairX0: 7.6, stairX1: 11.4, stairY1: 12.6 }
const onNorthTerrace = (x: number, y: number) => x < NORTH_TERRACE.x1 && y < NORTH_TERRACE.y1
function northTerrace(): { structures: IsoStructGroup[]; stairs: IsoStair[]; blockers: Blocker[] } {
  const T = NORTH_TERRACE
  const steps = 3
  const d = (T.stairY1 - T.y1) / steps
  return {
    // 맵의 맨 뒤 모서리라 뒤 레이어에 그린다(길찾기 안내선이 단 위에도 보이게)
    structures: [
      { id: 'north-terrace', back: 1, parts: isoBox(0, 0, T.x1, T.y1, 0, T.z, { top: HALL_TEX.marble, side: HALL_TEX.wall, shadeY: 0.18, shadeX: 0.34 }) },
      ...Array.from({ length: steps }, (_, k) => ({
        id: `north-terrace-step${k}`,
        back: 2 + k,
        parts: isoBox(T.stairX0, T.y1 + d * k, T.stairX1, T.y1 + d * (k + 1), 0, (T.z * (steps - k)) / (steps + 1), { top: HALL_TEX.marble, side: HALL_TEX.riser }),
      })),
    ],
    stairs: [
      { x0: 0, x1: T.x1, yTop: 0, yBottom: T.y1, zTop: 0, zBase: T.z, flat: true },
      { x0: T.stairX0, x1: T.stairX1, yTop: T.y1, yBottom: T.stairY1, zTop: T.z },
    ],
    blockers: [
      // 단의 남쪽 턱(계단 양옆) · 동쪽 턱 · 계단 옆면
      { x0: 0, y0: T.y1 - 0.1, x1: T.stairX0, y1: T.y1 + 0.25 },
      { x0: T.stairX1, y0: T.y1 - 0.1, x1: T.x1 + 0.25, y1: T.y1 + 0.25 },
      { x0: T.x1 - 0.1, y0: 0, x1: T.x1 + 0.25, y1: T.y1 + 0.25 },
      { x0: T.stairX0 - 0.25, y0: T.y1, x1: T.stairX0, y1: T.stairY1 },
      { x0: T.stairX1, y0: T.y1, x1: T.stairX1 + 0.25, y1: T.stairY1 },
    ],
  }
}
const VILLAGE_TERRACE = northTerrace()

// 야생 필드 맵은 라벨 구역을 두지 않고 맵 이름/배경으로 표시한다.
const NO_ZONES: ZoneDef[] = []

// ── 야생 전투맵 — lib/field-maps.ts(생성기) + lib/field-specs.ts(지역별 구성표) ──

// ── 아틀란티스 마을 — lib/atlantis-map.ts (리빌드: 도로→광장→건물→조경, 앵커 규칙 보정) ──

// ── 천공 신전(스톰헤이븐 하늘 도시) — lib/skytown-map.ts (리빌드: 도로→광장→건물→조경, 평면 하늘 타일) ──

// ── 버려진 신전 — lib/theme-towns.ts (범용 마을 빌더 lib/town-builder.ts) ──
const RUIN_AW = TOWN_W
const RUIN_AH = TOWN_H
const RUIN_CX = TOWN_CX
const RUIN_ENTRANCE_CY = TOWN_ENTRANCE_CY

// ── 오로라 마을 — lib/theme-towns.ts (범용 마을 빌더 lib/town-builder.ts) ──
const AUR_AW = TOWN_W
const AUR_AH = TOWN_H
const AUR_CX = TOWN_CX
const AUR_ENTRANCE_CY = TOWN_ENTRANCE_CY

// ── 마물 마을 — lib/theme-towns.ts (범용 마을 빌더 lib/town-builder.ts) ──
const DEMON_AW = TOWN_W
const DEMON_AH = TOWN_H
const DEMON_CX = TOWN_CX
const DEMON_ENTRANCE_CY = TOWN_ENTRANCE_CY

// ── 개인 공간(하우징) — 크기·출입만 여기서, 벽·가구는 lib/dorm-room.ts · lib/housing.ts ──
const PERSONAL_ROOM_W = 14 // 참조 이미지(방 한 칸) 보다 넉넉하게 — 가구 배치 여유 공간 포함
const PERSONAL_ROOM_H = 12
const PERSONAL_ROOM_SPAWN = { x: PERSONAL_ROOM_W / 2, y: PERSONAL_ROOM_H - 2.6 }
const PERSONAL_ROOM_EXIT = { x: PERSONAL_ROOM_W / 2, y: PERSONAL_ROOM_H - 1.2 }

// 중앙 러그(원탁 주변)만 별도 타일, 나머지는 목재 바닥
const PERSONAL_RUG_X0 = PERSONAL_ROOM_W / 2 - 1.6
const PERSONAL_RUG_X1 = PERSONAL_ROOM_W / 2 + 1.6
const PERSONAL_RUG_Y0 = PERSONAL_ROOM_H / 2 - 1.7
const PERSONAL_RUG_Y1 = PERSONAL_ROOM_H / 2 + 1.7
const personalSpaceTileAt = (cx: number, cy: number): TileKind =>
  cx > PERSONAL_RUG_X0 && cx < PERSONAL_RUG_X1 && cy > PERSONAL_RUG_Y0 && cy < PERSONAL_RUG_Y1 ? 'personal-rug' : 'dorm-plank'

// 개인 공간 벽·랜드마크 실내는 lib/dorm-room.ts · lib/landmark-interiors.ts (투영 구조물)로 이전됨(2026-09-30).

// ════════ 마법학교 본관 — 중앙 홀(1층)·2층 회랑(lib/academy-hall.ts) + 실내 6실(lib/academy-rooms.ts) ════════
// 사용자 규칙: 벽은 맵 끝선에 높게, 가구는 쿼터뷰(아이소) 정합 — 두 파일 머리말 참고.
// 2층 회랑 확장(2학년 교실 문 · 대강당 옆 3층 계단 입구) — lib/academy-upper.ts
const HALL_EXT: HallExt = {
  wallDecals: galleryWallDecals,
  wallSkip: GALLERY_WALL_SKIP,
  structures: () => [],
  blockers: [],
}
const HALL1 = buildHallFloor1(HALL_EXT)
const HALL2 = buildHallFloor2(HALL_EXT)
const UF3 = buildUpperFloor(3)
const UF4 = buildUpperFloor(4)
const SECRET = buildSecretPassage()
/** 대강당 문 앞(2층 회랑) */
const AUD_DOOR_FRONT = { x: HALL_CX, y: 1.3 }

/** 실내 방 맵 — 남쪽 출구로 홀의 해당 문 앞(대강당은 2층 회랑)에 돌아간다 */
function academyRoomMap(key: AcademyRoomKey): GameMap {
  const { id, name, def } = ACADEMY_ROOM_DEFS[key]
  const { w, h } = def
  const toAud = key === 'auditorium'
  const upper = upperRoomReturn(key)
  return {
    id,
    name,
    kind: 'town',
    grid: { w, h },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: def.tileAt,
    props: def.props,
    structures: def.structures,
    padTop: ROOM_PAD_TOP,
    blockers: buildBlockers(def.props, roomBlockersAc(w, h)),
    // 학장실은 미르엘 교수가 머무는 구역(NPC zoneId 매칭용)
    // 방마다 구역 하나(NPC zoneId 매칭용) — 학장실은 예전 id 유지
    zones: [key === 'office' ? z('z-headmaster-office', 'school', '학장실', 0, 0, w, h, '#5b6bd6', '울토르 학장실. 미르엘 교수가 서류와 마법서 사이를 오간다.') : z(`z-${id}`, 'school', name, 0, 0, w, h, '#5b6bd6', name)],
    spawn: { x: w / 2, y: h - 2.2 },
    portals: [
      {
        id: `${id}-exit`,
        cell: { x: w / 2, y: h - 0.8 },
        to: upper ? upper.to : toAud ? 'academy-2f' : 'school-hall',
        toSpawn: upper ? upper.spawn : toAud ? { x: AUD_DOOR_FRONT.x, y: 2.5 } : hallDoorFront(key as HallDoorKey, 3.2),
        label: upper ? upper.label : toAud ? '2층 회랑으로' : '중앙 홀로',
        kind: 'exit',
      },
    ],
  }
}
const ACADEMY_ROOMS: Partial<Record<MapId, GameMap>> = Object.fromEntries(
  (Object.keys(ACADEMY_ROOM_DEFS) as AcademyRoomKey[]).map((k) => [ACADEMY_ROOM_DEFS[k].id, academyRoomMap(k)]),
)
const HALL_ROOM_PORTALS: GameMap['portals'] = (
  [
    ['fire', 'class-fire', '화염 수업관'],
    ['ice', 'class-ice', '빙결 수업관'],
    ['earth', 'class-earth', '대지 수업관'],
    ['library', 'academy-library', '도서관'],
    ['office', 'headmaster-office', '학장실'],
  ] as const
).map(([k, to, label]) => ({ id: `hall-to-${to}`, cell: hallDoorFront(k, 1.4), to, label, kind: 'portal' as const }))

// ── 관리자 테스트룸 (/admin 전용) — NPC 25종·몬스터 23종을 한 방에 모아 배치 ────
// field.ts 의 generateFieldMonsters() 가 map.id==='testroom' 을 특수 처리해 그리드로 배치하고,
// mock-data.ts 의 testRoomNpcs() 가 기존 NPC 전원을 zoneId:'z-testroom' 로 복제해 넣는다.
const TESTROOM_W = 22
const TESTROOM_H = 32
function testroomTileAt(x: number, y: number): TileKind {
  // NPC 구역(위)은 plaza, 몬스터 구역(아래)은 grass 로 구분
  if (y < 17) return (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 'plaza' : 'path'
  return (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 'grass' : 'grass-dark'
}

// 야생 전투맵(지역별 기본 3 + 특수 2) — 충돌은 여기서 소품 footprint 로 붙인다
const FIELD = assembleFieldMaps()
const FIELD_MAPS = Object.fromEntries(
  Object.entries(FIELD.built).map(([id, b]) => [id, { ...b.map, blockers: buildBlockers(b.props, b.blockers) } as GameMap]),
) as Partial<Record<MapId, GameMap>>
/** 안전 마을 출구 → 갈림길(3단계) 맵의 해당 포탈 앞 */
const townReturn = (town: string) => FIELD.townReturns[town]

export const MAPS = {
  ...FIELD_MAPS,
  village: {
    id: 'village',
    name: '울토르 마법학교 마을',
    kind: 'town',
    grid: { w: VW, h: VH + VN },
    bg: 'school',
    render: 'iso',
    assets: 'raster', // Phase 2 테스트: 가로등만 PNG, 나머지는 sprite 없어 SVG 폴백
    tileAt: villageTileAt,
    // 지면은 한 장으로 이어 그린다 — 길 = 조약돌, 광장 = 판석, 학교 = 푸른 포장석, 밭 = 이랑 흙
    terrain: {
      at: villageTerrainAt,
      pool: () => null,
      tex: { path: 'cobble', plaza: 'pave-plaza', field: 'field-soil', 'academy-marble': 'pave-school' },
    },
    props: VILLAGE_PROPS,
    zones: VILLAGE_ZONES,
    blockers: [...VILLAGE_BLOCKERS, ...VILLAGE_TERRACE.blockers],
    structures: VILLAGE_TERRACE.structures,
    stairs: VILLAGE_TERRACE.stairs,
    // 아래 좌표는 옛 좌표로 적고 villageShift 로 민다
    spawn: villageShift({ x: 26.5, y: 12.2 }),
    respawn: villageShift({ x: 9.5, y: 30.0 }),
    portals: [
      { id: 'gate-forest', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'forest', label: '에르디아 숲', kind: 'gate' },
      { id: 'gate-sea', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'sea', label: '바다', kind: 'gate', requiredLevel: 5 },
      { id: 'gate-stormhaven', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'stormhaven', label: '스톰헤이븐', kind: 'gate', requiredLevel: 15 },
      { id: 'gate-ruins', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'ruins', label: '버려진 폐허', kind: 'gate', requiredLevel: 21 },
      { id: 'gate-snowfield', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'snowfield', label: '루미나 설원', kind: 'gate', requiredLevel: 31 },
      { id: 'gate-volcano', cell: villageShift({ x: 43.5, y: 36.6 }), to: 'volcano', label: '화산지대', kind: 'gate', requiredLevel: 41 },
      { id: 'personal-space-enter', cell: villageShift({ x: 42, y: 5 }), to: 'personal-space', label: '내 개인 공간', kind: 'portal' },
      { id: 'school-hall-enter', cell: villageShift({ x: 6.9, y: 6.5 }), to: 'school-hall', label: '마법학교 본관', kind: 'portal' },
      // 학교 북관 테라스의 기록관 건물 앞(지금 마을 좌표)
      { id: 'village-archive-enter', cell: { x: 13.8, y: 6.8 }, to: 'village-archive', label: '울토르 기록관', kind: 'portal' },
    ],
  },

  // ── 숲 계열 ───────────────────────────────────────────────────────────────

  // ── 바다 계열 (바다 해안 ─▶ 심해 / 아틀란티스 마을[안전]) ──────────────────
  atlantis: {
    id: 'atlantis',
    name: '아틀란티스 마을',
    kind: 'town',
    grid: { w: AW, h: AH },
    bg: 'atlantis',
    render: 'iso',
    assets: 'raster',
    tileAt: atlantisTileAt,
    water: { at: atlantisWaterAt },
    tileFlip: false,
    structures: ATLANTIS_STRUCTURES,
    props: ATLANTIS_PROPS,
    blockers: ATLANTIS_BLOCKERS,
    zones: [
      z('z-atlantis', 'atlantis', '아틀란티스 마을', 0, 0, AW, AH, '#2f86c0', '심해 아래 잠든 수중 도시. 해류로 지은 유리 돔 아래 인어족이 살아간다.'),
    ],
    spawn: { x: ACX, y: ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'atlantis-exit', cell: { x: ACX, y: ENTRANCE_CY + 0.5 }, to: townReturn('atlantis').to, toSpawn: townReturn('atlantis').spawn, label: '해안으로', kind: 'exit' },
      { id: 'atlantis-temple-enter', cell: { x: 26, y: 9 }, to: 'atlantis-temple', label: '대성당 내부', kind: 'portal' },
    ],
  },

  // ── 스톰헤이븐 계열 (스톰헤이븐 ─▶ 천공 신전[안전]) ────────────────────────
  'sky-temple': {
    id: 'sky-temple',
    name: '천공 신전',
    kind: 'town',
    grid: { w: SKY_AW, h: SKY_AH },
    bg: 'temple',
    render: 'iso',
    assets: 'raster',
    tileAt: skyTownTileAt,
    props: SKY_TOWN_PROPS,
    blockers: SKY_TOWN_BLOCKERS,
    zones: [
      z('z-sky-temple', 'temple', '천공 신전', 0, 0, SKY_AW, SKY_AH, '#d8c98a', '폭풍 위에 떠 있는 하얀 신전. 바람을 읽는 사제들이 순례자를 맞는다.'),
    ],
    spawn: { x: SKY_CX, y: SKY_ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'sky-temple-exit', cell: { x: SKY_CX, y: SKY_ENTRANCE_CY + 0.5 }, to: townReturn('sky-temple').to, toSpawn: townReturn('sky-temple').spawn, label: '스톰헤이븐으로', kind: 'exit' },
      { id: 'sky-sanctum-enter', cell: { x: 32, y: 10 }, to: 'sky-sanctum', label: '천공 대신전 내부', kind: 'portal' },
    ],
  },

  // ── 버려진 폐허 계열 (버려진 폐허 ─▶ 버려진 묘지 / 버려진 신전[안전]) ─────
  'temple-ruin': {
    id: 'temple-ruin',
    name: '버려진 신전',
    kind: 'town',
    grid: { w: RUIN_AW, h: RUIN_AH },
    bg: 'temple',
    render: 'iso',
    assets: 'raster',
    tileAt: RUIN_TOWN_TILE_AT,
    props: RUIN_TOWN_PROPS,
    blockers: RUIN_TOWN_BLOCKERS,
    zones: [
      z('z-abandoned-temple', 'temple', '버려진 신전', 0, 0, RUIN_AW, RUIN_AH, '#9a8a54', '폐허 깊숙이 남은 옛 신전. 은둔한 수도자들이 유물을 지키며 순례자를 맞는다.'),
    ],
    spawn: { x: RUIN_CX, y: RUIN_ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'temple-ruin-exit', cell: { x: RUIN_CX, y: RUIN_ENTRANCE_CY + 0.5 }, to: townReturn('temple-ruin').to, toSpawn: townReturn('temple-ruin').spawn, label: '폐허로', kind: 'exit' },
      { id: 'ruin-sanctum-enter', cell: { x: 32, y: 10 }, to: 'ruin-sanctum', label: '신전 내부', kind: 'portal' },
    ],
  },

  // ── 루미나 설원 계열 (루미나 설원 ─▶ 오로라 마을[안전]) ────────────────────
  'aurora-village': {
    id: 'aurora-village',
    name: '오로라 마을',
    kind: 'town',
    grid: { w: AUR_AW, h: AUR_AH },
    bg: 'aurora',
    render: 'iso',
    assets: 'raster',
    tileAt: AUR_TOWN_TILE_AT,
    props: AUR_TOWN_PROPS,
    blockers: AUR_TOWN_BLOCKERS,
    zones: [
      z('z-aurora', 'aurora', '오로라 마을', 0, 0, AUR_AW, AUR_AH, '#7fb0d8', '설원 한가운데, 밤이면 하늘에 오로라가 흐르는 얼음집 마을. 설인족과 상인들이 산다.'),
    ],
    spawn: { x: AUR_CX, y: AUR_ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'aurora-exit', cell: { x: AUR_CX, y: AUR_ENTRANCE_CY + 0.5 }, to: townReturn('aurora-village').to, toSpawn: townReturn('aurora-village').spawn, label: '설원으로', kind: 'exit' },
      { id: 'aurora-sanctum-enter', cell: { x: 32, y: 10 }, to: 'aurora-sanctum', label: '설원 성소 내부', kind: 'portal' },
    ],
  },

  // ── 화산 계열 ─────────────────────────────────────────────────────────────
  'demon-village': {
    id: 'demon-village',
    name: '마물 마을',
    kind: 'town',
    grid: { w: DEMON_AW, h: DEMON_AH },
    bg: 'demon',
    render: 'iso',
    assets: 'raster',
    tileAt: DEMON_TOWN_TILE_AT,
    props: DEMON_TOWN_PROPS,
    blockers: DEMON_TOWN_BLOCKERS,
    zones: [
      z('z-demon-village', 'demon', '마물 마을', 0, 0, DEMON_AW, DEMON_AH, '#3a1230', '화산 기슭에 자리한 마물들의 정착지. 인간 사회에서 밀려난 마물과 인외종이 모르스 곁에 모여 산다.'),
    ],
    spawn: { x: DEMON_CX, y: DEMON_ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'demon-village-exit', cell: { x: DEMON_CX, y: DEMON_ENTRANCE_CY + 0.5 }, to: townReturn('demon-village').to, toSpawn: townReturn('demon-village').spawn, label: '화산지대로', kind: 'exit' },
      { id: 'demon-temple-enter', cell: { x: 32, y: 10 }, to: 'demon-temple', label: '화산 성채 내부', kind: 'portal' },
    ],
  },

  // ── 랜드마크 실내 / 개인 공간 (뼈대) ─────────────────────────────────────
  'atlantis-temple': (() => {
    const L = landmarkInterior('atlantis')
    return {
      id: 'atlantis-temple',
      name: '아틀란티스 대성당 내부',
      kind: 'town',
      grid: { w: LM_W, h: LM_H },
      bg: 'atlantis',
      render: 'iso',
      assets: 'raster',
      tileAt: L.tileAt,
      props: L.props,
      structures: L.structures,
      padTop: LANDMARK_PAD_TOP,
      blockers: buildBlockers(L.props, L.blockers),
      zones: NO_ZONES,
      spawn: { ...LM_SPAWN },
      portals: [
        { id: 'atlantis-temple-exit', cell: { ...LM_EXIT }, to: 'atlantis', toSpawn: { x: 26, y: 10.2 }, label: '대성당 밖으로', kind: 'exit' },
        // 단상 오른쪽 구석의 내려가는 계단 — 지하 벽화실(EP26 '네 개로 나뉜 마음')
        { id: 'atlantis-crypt-enter', cell: { x: 22.2, y: 5.6 }, to: 'atlantis-crypt', label: '지하 벽화실로 내려가기', kind: 'portal' },
      ],
    } as GameMap
  })(),
  // 울토르 기록관(2026-10-10) — 마을 학교 북관의 기록관 건물 안. 방 = lib/academy-rooms ARCHIVE_ROOM, 소품 = lib/town-decor
  'village-archive': {
    id: 'village-archive',
    name: '울토르 기록관',
    kind: 'town',
    grid: { w: ARCHIVE_ROOM.w, h: ARCHIVE_ROOM.h },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: ARCHIVE_ROOM.tileAt,
    props: ARCHIVE_ROOM.props,
    structures: ARCHIVE_ROOM.structures,
    padTop: ROOM_PAD_TOP,
    blockers: buildBlockers(ARCHIVE_ROOM.props, roomBlockersAc(ARCHIVE_ROOM.w, ARCHIVE_ROOM.h)),
    zones: [z('z-village-archive', 'school', '울토르 기록관', 0, 0, ARCHIVE_ROOM.w, ARCHIVE_ROOM.h, '#5b6bd6', '학교의 옛 기록을 모아 둔 곳. 책장 군데군데가 비어 있다.')],
    spawn: { x: ARCHIVE_ROOM.w / 2, y: ARCHIVE_ROOM.h - 2.2 },
    portals: [{ id: 'village-archive-exit', cell: { x: ARCHIVE_ROOM.w / 2, y: ARCHIVE_ROOM.h - 0.8 }, to: 'village', toSpawn: { x: 13.8, y: 8.2 }, label: '밖으로', kind: 'exit' }],
  } as GameMap,
  // 아틀란티스 대성당 지하 벽화실(2026-10-10) — 왕의 마음이 넷으로 나뉜 벽화 석판이 놓인 작은 방. 소품은 lib/town-decor
  'atlantis-crypt': (() => {
    const C = cryptRoom('atlantis')
    return {
      id: 'atlantis-crypt',
      name: '대성당 지하 벽화실',
      kind: 'town',
      grid: { w: CRYPT_W, h: CRYPT_H },
      bg: 'atlantis',
      render: 'iso',
      assets: 'raster',
      tileAt: C.tileAt,
      props: [],
      structures: C.structures,
      padTop: CRYPT_PAD_TOP,
      ambientTone: 0.82,
      blockers: C.blockers,
      zones: NO_ZONES,
      spawn: { ...CRYPT_SPAWN },
      portals: [{ id: 'atlantis-crypt-exit', cell: { ...CRYPT_EXIT }, to: 'atlantis-temple', toSpawn: { x: 22.2, y: 7 }, label: '대성당으로 올라가기', kind: 'exit' }],
    } as GameMap
  })(),
  'demon-temple': (() => {
    const L = landmarkInterior('demon')
    return {
      id: 'demon-temple',
      name: '화산 성채 내부',
      kind: 'town',
      grid: { w: LM_W, h: LM_H },
      bg: 'demon',
      render: 'iso',
      assets: 'raster',
      tileAt: L.tileAt,
      props: L.props,
      structures: L.structures,
      padTop: LANDMARK_PAD_TOP,
      blockers: buildBlockers(L.props, L.blockers),
      zones: NO_ZONES,
      spawn: { ...LM_SPAWN },
      portals: [{ id: 'demon-temple-exit', cell: { ...LM_EXIT }, to: 'demon-village', toSpawn: { x: 32, y: 11.4 }, label: '화산 성채 밖으로', kind: 'exit' }],
    } as GameMap
  })(),
  'sky-sanctum': (() => {
    const L = landmarkInterior('sky')
    return {
      id: 'sky-sanctum',
      name: '천공 대신전 내부',
      kind: 'town',
      grid: { w: LM_W, h: LM_H },
      bg: 'temple',
      render: 'iso',
      assets: 'raster',
      tileAt: L.tileAt,
      props: L.props,
      structures: L.structures,
      padTop: LANDMARK_PAD_TOP,
      blockers: buildBlockers(L.props, L.blockers),
      zones: NO_ZONES,
      spawn: { ...LM_SPAWN },
      portals: [{ id: 'sky-sanctum-exit', cell: { ...LM_EXIT }, to: 'sky-temple', toSpawn: { x: 32, y: 11.4 }, label: '신전 밖으로', kind: 'exit' }],
    } as GameMap
  })(),
  'ruin-sanctum': (() => {
    const L = landmarkInterior('ruin')
    return {
      id: 'ruin-sanctum',
      name: '버려진 신전 내부',
      kind: 'town',
      grid: { w: LM_W, h: LM_H },
      bg: 'temple',
      render: 'iso',
      assets: 'raster',
      tileAt: L.tileAt,
      props: L.props,
      structures: L.structures,
      padTop: LANDMARK_PAD_TOP,
      blockers: buildBlockers(L.props, L.blockers),
      zones: NO_ZONES,
      spawn: { ...LM_SPAWN },
      portals: [{ id: 'ruin-sanctum-exit', cell: { ...LM_EXIT }, to: 'temple-ruin', toSpawn: { x: 32, y: 11.4 }, label: '신전 밖으로', kind: 'exit' }],
    } as GameMap
  })(),
  'aurora-sanctum': (() => {
    const L = landmarkInterior('aurora')
    return {
      id: 'aurora-sanctum',
      name: '설원 성소 내부',
      kind: 'town',
      grid: { w: LM_W, h: LM_H },
      bg: 'aurora',
      render: 'iso',
      assets: 'raster',
      tileAt: L.tileAt,
      props: L.props,
      structures: L.structures,
      padTop: LANDMARK_PAD_TOP,
      blockers: buildBlockers(L.props, L.blockers),
      zones: NO_ZONES,
      spawn: { ...LM_SPAWN },
      portals: [{ id: 'aurora-sanctum-exit', cell: { ...LM_EXIT }, to: 'aurora-village', toSpawn: { x: 32, y: 11.4 }, label: '성소 밖으로', kind: 'exit' }],
    } as GameMap
  })(),
  'school-hall': {
    id: 'school-hall',
    name: '마법학교 중앙 홀',
    kind: 'town',
    grid: { w: HALL_W, h: HALL_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: hallTileAt,
    props: HALL1.props,
    structures: HALL1.structures,
    stairs: hallStairs(),
    padTop: HALL_PAD_TOP,
    blockers: buildBlockers(HALL1.props, HALL1.blockers),
    zones: NO_ZONES,
    spawn: { x: HALL_CX, y: HALL_H - 2.0 },
    portals: [
      { id: 'school-hall-exit', cell: { x: HALL_CX, y: HALL_H - 0.8 }, to: 'village', toSpawn: villageShift({ x: 6.9, y: 7.2 }), label: '본관 밖으로', kind: 'exit' },
      // 대계단을 끝까지 오르면 그대로 2층 회랑(같은 좌표계) — 확인창 없이 걸어서
      { id: 'hall-to-2f', cell: { x: HALL_CX, y: STAIR_TO_2F.y1 }, walkArea: STAIR_TO_2F, to: 'academy-2f', label: '2층 회랑', kind: 'portal' },
      ...HALL_ROOM_PORTALS,
    ],
  },
  'academy-2f': {
    id: 'academy-2f',
    name: '마법학교 2층 회랑',
    kind: 'town',
    grid: { w: HALL_W, h: HALL_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: hall2TileAt,
    props: HALL2.props,
    structures: HALL2.structures,
    padTop: HALL_PAD_TOP - FLOOR2,
    padBottom: HALL2_PAD_BOTTOM,
    blockers: buildBlockers(HALL2.props, HALL2.blockers),
    stairs: hall2Stairs(),
    zones: NO_ZONES,
    spawn: { x: HALL_CX, y: 2.5 },
    portals: [
      // 대계단을 걸어 내려가 맨 아래에서 1층 맵으로
      { id: '2f-to-hall', cell: { x: HALL_CX, y: STAIR_TO_1F.y0 }, walkArea: STAIR_TO_1F, to: 'school-hall', label: '1층으로', kind: 'exit' },
      { id: '2f-to-auditorium', cell: { ...AUD_DOOR_FRONT }, to: 'grand-auditorium', label: '대강당', kind: 'portal' },
      { id: '2f-to-class-year2', cell: { x: YEAR2_DOOR_X, y: 1.3 }, to: 'class-year2', label: '2학년 교실', kind: 'portal' },
      { id: '2f-to-3f', cell: { x: FLOOR3_ENTRY_X, y: 1.3 }, to: 'academy-3f', toSpawn: { ...UF_SPAWN }, label: '3층으로', kind: 'portal' },
      // 서쪽 회랑 옛 벤치 자리 — 흰 반짝임, 가까이서 E
      { id: '2f-to-secret', cell: { ...SECRET_DOOR_2F }, to: 'academy-secret', toSpawn: { ...SECRET_SPAWN }, label: '수상한 벽', kind: 'portal', secret: true, sparkleLift: 46 },
    ],
  },
  'academy-secret': {
    id: 'academy-secret',
    name: '숨겨진 통로',
    kind: 'town',
    grid: { w: SECRET_W, h: SECRET_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: secretTileAt,
    props: SECRET.props,
    structures: SECRET.structures,
    padTop: SECRET_PAD_TOP,
    blockers: buildBlockers(SECRET.props, SECRET.blockers),
    ambientTone: 0.62,
    zones: [
      z('z-secret-corridor', 'school', '숨겨진 통로', 6, 14, 12, SECRET_H, '#3d5bd6', '2층 회랑 벽 너머로 이어진 좁고 어두운 복도.'),
      z('z-secret-altar', 'school', '오망성 제단', 0, 0, SECRET_W, 14, '#3d5bd6', '푸른 촛불이 둘러싼 오망성 마법진과 낡은 제단.'),
    ],
    spawn: { ...SECRET_SPAWN },
    portals: [{ id: 'secret-exit', cell: { ...SECRET_EXIT }, to: 'academy-2f', toSpawn: { ...SECRET_RETURN_2F }, label: '2층 회랑으로', kind: 'exit' }],
  },
  'academy-3f': {
    id: 'academy-3f',
    name: '마법학교 3층',
    kind: 'town',
    grid: { w: UF_W, h: UF_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: upperTileAt,
    props: UF3.props,
    structures: UF3.structures,
    stairs: UF3.stairs,
    padTop: UF_PAD_TOP,
    blockers: buildBlockers(UF3.props, UF3.blockers),
    zones: NO_ZONES,
    spawn: { ...UF_SPAWN },
    portals: upperPortals(3, ACADEMY_ROOM_DEFS),
  },
  'academy-4f': {
    id: 'academy-4f',
    name: '마법학교 4층',
    kind: 'town',
    grid: { w: UF_W, h: UF_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: upperTileAt,
    props: UF4.props,
    structures: UF4.structures,
    stairs: UF4.stairs,
    padTop: UF_PAD_TOP,
    blockers: buildBlockers(UF4.props, UF4.blockers),
    zones: NO_ZONES,
    spawn: { ...UF_SPAWN },
    portals: upperPortals(4, ACADEMY_ROOM_DEFS),
  },
  ...ACADEMY_ROOMS,
  'personal-space': {
    id: 'personal-space',
    name: '내 개인 공간',
    kind: 'town',
    grid: { w: PERSONAL_ROOM_W, h: PERSONAL_ROOM_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: personalSpaceTileAt,
    props: [],
    structures: dormStructures(PERSONAL_ROOM_W, PERSONAL_ROOM_H),
    padTop: DORM_PAD_TOP,
    blockers: dormBlockers(PERSONAL_ROOM_W, PERSONAL_ROOM_H),
    zones: NO_ZONES,
    spawn: { ...PERSONAL_ROOM_SPAWN },
    portals: [
      { id: 'personal-space-exit', cell: { ...PERSONAL_ROOM_EXIT }, to: 'village', toSpawn: villageShift({ x: 42, y: 6.4 }), label: '마을로 나가기', kind: 'exit' },
    ],
  },

  testroom: {
    id: 'testroom',
    name: '관리자 테스트룸',
    kind: 'field',
    grid: { w: TESTROOM_W, h: TESTROOM_H },
    bg: 'plaza',
    render: 'iso',
    assets: 'raster',
    tileAt: testroomTileAt,
    zones: [
      z('z-testroom', 'plaza', '관리자 테스트룸', 0, 0, TESTROOM_W, TESTROOM_H, '#d9a441', 'NPC·몬스터 전종이 모인 관리자 전용 테스트 공간.'),
    ],
    monsterDensity: 0, // generateFieldMonsters 가 testroom 을 특수 처리하므로 밀도는 미사용
    recommendedLevel: 1,
    spawn: { x: 11, y: 30 },
    portals: [
      { id: 'testroom-exit', cell: { x: 11, y: 31 }, to: 'village', label: '마을로 돌아가기', kind: 'exit' },
    ],
  },
} as Record<MapId, GameMap>

// 마을 꾸미기 소품(lib/town-decor.ts) — 각 마을 props 뒤에 덧붙이고, 길막 소품은 충돌도 함께 더한다
for (const [id, items] of Object.entries(TOWN_DECOR)) {
  const m = (MAPS as Record<string, GameMap>)[id]
  if (!m) continue
  const extra = decorProps(items)
  m.props = [...(m.props ?? []), ...extra]
  m.blockers = [...(m.blockers ?? []), ...extra.map(propBlocker).filter((b): b is Blocker => !!b)]
}
// 학교 북관 테라스 위의 프롭(건물·동상·나무·꾸미기 소품)은 단 높이만큼 올려 그린다
MAPS.village.props = (MAPS.village.props ?? []).map((p) => (onNorthTerrace(p.cell.x, p.cell.y) ? { ...p, elev: (p.elev ?? 0) + NORTH_TERRACE.z } : p))

// 스프라이트 없이 남은 점배치 소품(실내 대홀 조명 등)에 PixelLab 도트를 붙인다 —
// 코드로 그린 SVG 건물/소품(iso-sprites) 폴백을 없애면서 모든 소품이 라스터로 그려지게.
for (const m of Object.values(MAPS)) {
  for (const p of m.props ?? []) {
    if (p.sprite) continue
    const rs = PROP_SPRITE[p.kind]
    if (rs) Object.assign(p, { sprite: rs.sprite, px: rs.px, anchor: rs.anchor })
  }
}

export const VILLAGE_MAP_ID: MapId = 'village'

export function mapById(id: MapId): GameMap {
  return MAPS[id]
}

/** 현재 맵 기준으로 좌표가 속한 라벨 구역 */
export function zoneAt(map: GameMap, x: number, y: number): ZoneDef | null {
  for (const zone of map.zones) {
    const c = zone.cell
    if (x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1) return zone
  }
  return null
}

export function zoneKindAt(map: GameMap, x: number, y: number): ZoneKind {
  return zoneAt(map, x, y)?.kind ?? (map.bg as ZoneKind) ?? 'field'
}

/** 좌표를 맵 경계 안으로 clamp */
export function clampToMap(map: GameMap, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0.2, Math.min(map.grid.w - 0.2, x)),
    y: Math.max(0.2, Math.min(map.grid.h - 0.2, y)),
  }
}
