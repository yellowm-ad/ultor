import type { GameMap, MapId, ZoneDef, ZoneKind } from '@/lib/types'
import type { PropDef, TileKind } from '@/lib/iso'
import { propAABB } from '@/lib/iso'
import { assembleFieldMaps } from '@/lib/field-specs'
import { AW, AH, ACX, ENTRANCE_CY, atlantisTileAt, ATLANTIS_PROPS, ATLANTIS_BLOCKERS } from '@/lib/atlantis-map'
import { TOWN_W, TOWN_H, TOWN_CX, TOWN_ENTRANCE_CY } from '@/lib/town-builder'
import { RUIN_TOWN_TILE_AT, RUIN_TOWN_PROPS, RUIN_TOWN_BLOCKERS, AUR_TOWN_TILE_AT, AUR_TOWN_PROPS, AUR_TOWN_BLOCKERS, DEMON_TOWN_TILE_AT, DEMON_TOWN_PROPS, DEMON_TOWN_BLOCKERS } from '@/lib/theme-towns'
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

// ── 메인 마을 (52 × 40) — 아이소메트릭 도트 엔진 ────────────────────────────
// 3×3 지구를 넓게: [학교 쿼드·중앙 광장·하우징] / [기숙사·콜로세움+공원·상점가]
//                 / [대성당 성역·햇살 농가·통문 주둔지]
// 대로는 폭 3셀, 외곽 순환로 2.5셀. 지구 사이는 넉넉한 녹지 완충.
const VILLAGE_ZONES: ZoneDef[] = [
  z('z-magic-hall', 'school', '학교 본교 쿼드', 2, 2, 17, 13, '#5b6bd6', '마법동·연금술동·마도구동이 안뜰을 둘러싼 본교. 시계탑과 대강당, 도서관 별관이 있다.'),
  z('z-quad', 'plaza', '중앙 대광장', 20, 2, 33, 13, '#8891b5', '분수와 동상이 선 마을 심장부. 사방으로 대로가 뻗는다.'),
  z('z-housing', 'village', '하우징 마을', 36, 2, 50, 13, '#6fae5d', '지붕색이 제각각인 저층 주거 블록과 뒷마당 정원.'),
  z('z-dorm', 'village', '기숙사 마을', 2, 16, 17, 25, '#5a9a6a', '견습생 기숙사와 공동 식당.'),
  z('z-plaza', 'colosseum', '수련의 투기장', 20, 16, 33, 25, '#c9622b', '계단식 관중석의 원형 투기장. 파티 대전이 준비 중이다.'),
  z('z-park', 'park', '마로니에 공원', 20, 25, 33, 28, '#4e9c4a', '투기장과 농가 사이의 녹지 완충대.'),
  z('z-shops', 'shopStreet', '별빛 상점가', 36, 16, 50, 25, '#d9a441', '길게 늘어선 상가 — 무기·물약·도구·펫, 시장 회관과 여관, 길드홀.'),
  z('z-temple', 'temple', '성역 대성당', 2, 27, 17, 38, '#d8c98a', '돔 대성당과 종탑·회랑·성직자 숙소가 앞광장을 감싼다.'),
  z('z-farm', 'farm', '햇살 농가', 20, 28, 33, 38, '#c9a44a', '너른 밭이랑과 헛간·풍차·농가.'),
  z('z-barracks', 'military', '통문 주둔지', 36, 27, 50, 38, '#8a8f9c', '성벽과 망루로 두른 주둔지. 웅장한 군 통문이 야생으로 통한다.'),
]

const VW = 52
const VH = 40
const FOUNTAIN = { x: 26.5, y: 7.5 }
const COLOSSEUM = { x: 26.5, y: 20.5 }
const TEMPLE_YARD = { x: 9.5, y: 32 } // 대성당 앞광장 중심

// 대로 축(지구 경계) — 폭 3셀
const AV_L = { a: 16.8, b: 19.8 } // 세로 대로 (학교/광장 사이)
const AV_R = { a: 32.8, b: 35.8 } // 세로 대로 (광장/상점가 사이)
const ST_N = { a: 12.8, b: 15.8 } // 가로 대로 (북측 지구 경계)
const ST_S = { a: 24.8, b: 27.8 } // 가로 대로 (남측 지구 경계)
const GATE_WAY = { a: 41.5, b: 45.5 } // 주둔지 의전 대로 (ST_S → 군 통문)
const between = (v: number, r: { a: number; b: number }) => v > r.a && v < r.b

/** 마을 지면 타일 */
function villageTileAt(x: number, y: number): TileKind {
  // 외곽 순환 보도 (2.5셀 폭)
  if (x < 2.5 || x > VW - 2.5 || y < 2.5 || y > VH - 2.5) return 'path'
  // 콜로세움 모래 바닥 (구조물 반경과 맞춤)
  if (Math.hypot(x - COLOSSEUM.x, y - COLOSSEUM.y) < 5.6) return 'sand'
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
  // 마로니에 공원 잔디 — 투기장 남측, 농가 위까지 넉넉히 (밝은 잔디)
  if (
    x > 19.8 && x < 33 && y > ST_S.b && y < 32.6 &&
    Math.hypot(x - COLOSSEUM.x, y - COLOSSEUM.y) >= 5.6
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

/** 마을 오브젝트 배치 — 모든 좌표는 격자(0..VW, 0..VH) 안에 있고 대로를 침범하지 않는다 */
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

  // ════════ 수련의 투기장 (x20–33, y16–25) ════════
  P.push({
    id: 'b-colosseum', kind: 'colosseum', cell: { x: COLOSSEUM.x, y: COLOSSEUM.y },
    size: { w: 5.0, d: 5.0 }, collide: { w: 8.0, d: 7.6 }, label: '수련의 투기장',
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
  const onSand = (x: number, y: number) => Math.hypot(x - COLOSSEUM.x, y - COLOSSEUM.y) < 5.6
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
    if (blocked(x, y) || onRoad(x, y) || onPlaza(x, y) || onSand(x, y)) return
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

  // ── 가로등 — 대로 양편(4셀 간격) + 광장·투기장·앞광장·의전대로 둘레 ──
  const lamps: [number, number][] = []
  for (const ex of [AV_L.a - 0.6, AV_L.b + 0.6, AV_R.a - 0.6, AV_R.b + 0.6])
    for (let y = 4; y <= 37; y += 4.2) lamps.push([ex, y])
  for (const ey of [ST_N.a - 0.6, ST_N.b + 0.6, ST_S.a - 0.6, ST_S.b + 0.6])
    for (let x = 4; x <= 49; x += 4.4) lamps.push([x, ey])
  for (let a = 0; a < 8; a++)
    lamps.push([FOUNTAIN.x + Math.cos((a / 8) * 6.283) * 8.4, FOUNTAIN.y + Math.sin((a / 8) * 6.283) * 7.2])
  for (let a = 0; a < 6; a++)
    lamps.push([COLOSSEUM.x + Math.cos((a / 6) * 6.283 + 0.5) * 6.6, COLOSSEUM.y + Math.sin((a / 6) * 6.283 + 0.5) * 6.4])
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

  // ── 벤치 — 분수 둘레 / 아케이드 / 투기장. variant l|r = 아이소 축 방향 ──
  // (과거 좌표들이 진입로/대로 판정 경계에 딱 걸쳐 onRoad()에 은근슬쩍 걸러지던 문제 —
  // 분수 진입로 폭 ±2.2, 아케이드 폭 ±1.5, 대로 AV_L/AV_R 과 확실히 떨어지도록 여유를 둠)
  const benchSpots: [number, number, 'l' | 'r'][] = [
    [36.2, 22.2, 'l'], [43.5, 22.2, 'r'], [48.0, 22.2, 'l'], // 아케이드(북측은 상가 건물과 겹쳐 전부 남측으로)
    [COLOSSEUM.x - 5.2, COLOSSEUM.y - 3.2, 'r'], [COLOSSEUM.x + 5.2, COLOSSEUM.y + 3.2, 'l'], // 투기장 대각 코너(동서는 대로에 걸림)
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
    [COLOSSEUM.x - 7.5, COLOSSEUM.y - 5, 'b'], [COLOSSEUM.x + 7.5, COLOSSEUM.y - 5, 'b'],
    // 마로니에 공원 — 밤나무 가로수 밀집. 산책로 y29.9 위·아래 2열 + 양 끝 큰나무
    [20.6, 28.3, 'c'], [23.0, 28.3, 'a'], [25.4, 28.3, 'c'], [28.0, 28.3, 'a'], [30.4, 28.3, 'c'], [32.3, 28.4, 'a'],
    [20.6, 31.7, 'a'], [23.6, 31.8, 'c'], [29.4, 31.8, 'c'], [32.4, 31.7, 'a'],
    [19.9, 29.9, 'g'], [32.8, 29.9, 'g'],
  ]
  trees.push(...clusters)
  trees.forEach(([x, y, v], i) => {
    if (!blocked(x, y, 0.6) && !onRoad(x, y) && !onPlaza(x, y) && !onSand(x, y))
      P.push({ id: `t${i}`, kind: 'tree', cell: { x, y }, variant: v })
  })
  // 공원 중앙 정자(연주대) + 산책로변 쓰레기통
  P.push({ id: 'b-parkgazebo', kind: 'gazebo', cell: { x: 26.6, y: 31.6 }, size: { w: 1.8, d: 1.6 } })
  place('tb-pk0', 'trashbin', 23.0, 30.9)
  place('tb-pk1', 'trashbin', 30.2, 29.0)

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
  return P.filter((p) => !SUPPRESSED.has(p.id))
}

const VILLAGE_PROPS = villageProps()
// 블로커 = solid 프롭들의 footprint 에서 자동 생성 → 보이는 벽 = 막히는 벽
const VILLAGE_BLOCKERS = buildBlockers(VILLAGE_PROPS)

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

// ── 랜드마크 실내 / 개인 공간 — 뼈대만(빈 방 + 출입 포탈). 참조 이미지 도착 후 내부 장식 채움 ──
// 마을 랜드마크(대성당·화산 성채) 실내 = 해당 마을(64×56)의 1/4 크기.
// 개인 공간(하우징 촌장 옆) = 기본 마을(52×40)의 2/9 크기, 정사각형(정육면체) 방으로 근사.
const LANDMARK_ROOM_W = 16 // 64 / 4
const LANDMARK_ROOM_H = 14 // 56 / 4
const LANDMARK_ROOM_SPAWN = { x: LANDMARK_ROOM_W / 2, y: LANDMARK_ROOM_H - 2.6 }
const LANDMARK_ROOM_EXIT = { x: LANDMARK_ROOM_W / 2, y: LANDMARK_ROOM_H - 1.2 }

const PERSONAL_ROOM_W = 14 // 참조 이미지(방 한 칸) 보다 넉넉하게 — 가구 배치 여유 공간 포함
const PERSONAL_ROOM_H = 12
const PERSONAL_ROOM_SPAWN = { x: PERSONAL_ROOM_W / 2, y: PERSONAL_ROOM_H - 2.6 }
const PERSONAL_ROOM_EXIT = { x: PERSONAL_ROOM_W / 2, y: PERSONAL_ROOM_H - 1.2 }

/** 사방 벽 + 남쪽 출입구만 뚫은 빈 방 블로커(뼈대) */
function roomBlockers(w: number, h: number, doorW = 2.6, wallThickness = 0.5): Blocker[] {
  const doorX = w / 2
  return [
    { x0: 0, y0: 0, x1: w, y1: wallThickness }, // 북벽
    { x0: 0, y0: h - 0.5, x1: doorX - doorW / 2, y1: h }, // 남벽 서쪽
    { x0: doorX + doorW / 2, y0: h - 0.5, x1: w, y1: h }, // 남벽 동쪽
    { x0: 0, y0: 0, x1: wallThickness, y1: h }, // 서벽
    { x0: w - 0.5, y0: 0, x1: w, y1: h }, // 동벽
  ]
}
const atlantisTempleTileAt = (): TileKind => 'atlantis-cathedral'
const demonTempleTileAt = (): TileKind => 'demon-stone'
// 중앙 러그(원탁 주변)만 별도 타일, 나머지는 목재 바닥
const PERSONAL_RUG_X0 = PERSONAL_ROOM_W / 2 - 1.6
const PERSONAL_RUG_X1 = PERSONAL_ROOM_W / 2 + 1.6
const PERSONAL_RUG_Y0 = PERSONAL_ROOM_H / 2 - 1.7
const PERSONAL_RUG_Y1 = PERSONAL_ROOM_H / 2 + 1.7
const personalSpaceTileAt = (cx: number, cy: number): TileKind =>
  cx > PERSONAL_RUG_X0 && cx < PERSONAL_RUG_X1 && cy > PERSONAL_RUG_Y0 && cy < PERSONAL_RUG_Y1 ? 'personal-rug' : 'personal-wood'

// 개인 공간 벽 — 뒤쪽 두 면(북벽=오른쪽, 서벽=왼쪽)만 세우고 앞쪽은 개방(참고 이미지 구도).
// PixelLab 빌딩 키트(1칸짜리 독립 블록)는 칸 사이에 틈이 생겨(=기둥처럼 뚝뚝 끊김) 폐기하고,
// 평면 벽돌 텍스처를 그 칸의 바닥 대각선 기울기(ISO_SKEW_DEG)만큼 skewY 로 눕혀 이어붙이는 방식으로
// 되돌린다 — 이 방식은 빈틈 없이 이어지는 걸 실측으로 확인했다. 문도 같은 벽의 한 세그먼트로 넣어
// 그 벽면 각도에 맞춰 같이 기울인다(뚝 떨어진 정면 삽화가 아니라 벽에 실제로 박힌 문이 되도록).
const WALL_PLAIN = { s: '/images/map/props/housing/wall_plain.png', w: 116, h: 72 }
const WALL_WINDOW = { s: '/images/map/props/housing/wall_window.png', w: 80, h: 121 }
const WALL_DOOR = { s: '/images/map/props/housing/door.png', w: 92, h: 148 }
const WALL_PX_PER_CELL = 72.6 // WALL_PLAIN.w/1.6 ≈ 72.5, 이 비율로 셀폭→px폭 환산
// 쿼터뷰 바닥선 기울기 — ISO_TILE_W:ISO_TILE_H = 64:32(2:1)이므로 셀당 화면 이동은 (±32,±16),
// 즉 벽 밑변이 바닥 대각선과 같은 기울기(높이:폭 = 1:2)로 누워야 뜨지 않는다.
const ISO_SKEW_DEG = (Math.atan2(1, 2) * 180) / Math.PI // ≈ 26.565°

type WallSeg = { fw: number; pxW: number; pxH: number; sprite: { s: string; w: number; h: number }; feature?: boolean }

/** 평범한 벽 세그먼트 — 셀 폭(fw)에서 px 크기를 그대로 환산(원본 비율 유지) */
function plainSeg(sprite: { s: string; w: number; h: number }, fw: number, pxPerCell: number): WallSeg {
  const pxW = fw * pxPerCell
  return { fw, pxW, pxH: sprite.h * (pxW / sprite.w), sprite }
}
/**
 * 창문/문처럼 벽보다 아치가 높이 솟는 조각 — "벽 폭에 맞춰 늘리기"가 아니라
 * "평벽 높이의 배수"로 목표 높이를 먼저 정하고 그 높이에서 원본 비율대로 폭을 역산한다.
 * (전엔 반대로 폭부터 맞춰서 세로로 2배 넘게 부풀어 보였다 — "창문이 벽보다 훨씬 크다"는 지적의 원인.)
 * feature:true 표시 — renderWallRun 에서 정렬 우선순위를 올려, 폭이 좁아진 만큼 바로 옆 평벽 조각한테
 * (겹치는 기울어진 영역에서) 덮여 가려지지 않도록 한다.
 */
function featureSeg(sprite: { s: string; w: number; h: number }, plainPxH: number, hFactor: number, pxPerCell: number): WallSeg {
  const pxH = plainPxH * hFactor
  const pxW = pxH * (sprite.w / sprite.h)
  return { fw: pxW / pxPerCell, pxW, pxH, sprite, feature: true }
}

/**
 * 세그먼트 목록을 이어붙여 하나의 skewY 벽으로 렌더.
 * sign=1: 북벽(+x 방향, +skew, 결 그대로). sign=-1: 서벽(+y 방향) — 벽돌 텍스처의 결(가로줄)이
 * 원래 "북벽 방향"으로 그려져 있어, 좌우반전(mirrorX)만으로는 서벽 길이 방향과 결이 안 맞는다.
 * 북벽과 동일하게 먼저 스큐를 먹인 뒤 앵커를 축으로 90도 통째로 돌려(rotateDeg) 결을 서벽 방향으로 맞춘다.
 */
function renderWallRun(idPrefix: string, segs: WallSeg[], start: number, fixedOther: number, sign: 1 | -1): PropDef[] {
  const out: PropDef[] = []
  let pos = start
  segs.forEach((seg, i) => {
    const center = pos + seg.fw / 2
    const cell = sign === 1 ? { x: center, y: fixedOther } : { x: fixedOther, y: center }
    const collide = sign === 1 ? { w: seg.fw, d: 0.3 } : { w: 0.3, d: seg.fw }
    // feature(창문/문)는 폭이 평벽보다 좁아서, 기울어져 겹치는 영역에서 옆 평벽 조각이 나중에(sortY 더 크게)
    // 그려지면 문/창을 덮어버린다 — size 를 부풀려 항상 옆 평벽보다 나중에(sortY 더 크게) 그려지도록 강제한다.
    // collide 는 실제 폭 그대로 둬 충돌엔 영향 없다.
    const size = seg.feature ? (sign === 1 ? { w: 6, d: 0.3 } : { w: 0.3, d: 6 }) : collide
    out.push({
      id: `${idPrefix}${i}`, kind: 'wall', cell,
      sprite: seg.sprite.s, px: { w: seg.pxW, h: seg.pxH }, size, collide,
      // mirrorX 를 같이 걸면 scaleX(-1)·skewY(-θ) 가 합성돼 도로 skewY(+θ)와 같은 모양(오른쪽이 처지는 평행사변형)이
      // 나와버린다(부호가 상쇄됨) — 그래서 서벽이 북벽과 "같은 방향"으로 기운 것처럼 보였다.
      // 반대쪽으로 기운 모양이 필요할 뿐이니 미러 없이 skew 부호만 반대로 준다.
      skewYDeg: sign * ISO_SKEW_DEG,
    })
    pos += seg.fw
  })
  return out
}

function personalSpaceWalls(): PropDef[] {
  const margin = 1.0 // 방 모서리 여백(=roomBlockers 두께와 정렬)
  const plainFw = 1.9 // 평벽 한 칸 기준 폭 — 이 높이를 창문/문 크기의 기준으로 삼는다
  const plainPxH = plainSeg(WALL_PLAIN, plainFw, WALL_PX_PER_CELL).pxH
  const windowSeg = () => featureSeg(WALL_WINDOW, plainPxH, 1.2, WALL_PX_PER_CELL) // 평벽보다 아치가 20% 더 높은 "작은 창"
  const doorSeg = () => featureSeg(WALL_DOOR, plainPxH, 1.35, WALL_PX_PER_CELL) // 평벽보다 35% 더 높은 "작은 문" — 벽과 어울리는 크기

  // 북벽(오른쪽, +x 방향으로 이어붙임, 화면상 우하향) — 뒤쪽 꼭짓점에 문, 창문 2개
  const door = doorSeg()
  const northLen = PERSONAL_ROOM_W - 2 * margin - door.fw
  const northPlainCount = 5
  const northWindows = [windowSeg(), windowSeg()]
  const northPlainW = (northLen - northWindows.reduce((s, w) => s + w.fw, 0)) / northPlainCount
  const northSegs: WallSeg[] = [door]
  let wi = 0
  for (let i = 0; i < northPlainCount; i++) {
    northSegs.push(i === 1 || i === 3 ? northWindows[wi++] : plainSeg(WALL_PLAIN, northPlainW, WALL_PX_PER_CELL))
  }
  const northWalls = renderWallRun('pwall-n', northSegs, margin, margin - 0.1, 1)

  // 서벽(왼쪽, +y 방향으로 이어붙임, 화면상 좌하향) = 북벽의 거울상 — 창문 1개, 뒤쪽 꼭짓점은 북벽 문과 맞물림
  const westLen = PERSONAL_ROOM_H - 2 * margin
  const westPlainCount = 5
  const westWindow = windowSeg()
  const westPlainW = (westLen - westWindow.fw) / westPlainCount
  const westSegs: WallSeg[] = Array.from({ length: westPlainCount }, (_, i) =>
    i === 2 ? westWindow : plainSeg(WALL_PLAIN, westPlainW, WALL_PX_PER_CELL),
  )
  const westWalls = renderWallRun('pwall-w', westSegs, margin, margin - 0.1, -1)

  return [...northWalls, ...westWalls]
}
const PERSONAL_SPACE_WALLS = personalSpaceWalls()
const PERSONAL_SPACE_BLOCKERS = buildBlockers(PERSONAL_SPACE_WALLS, roomBlockers(PERSONAL_ROOM_W, PERSONAL_ROOM_H))

// ── 랜드마크 실내(대성당·옥좌실·신전 등) = "웅장한 홀" 뼈대 — 개인 공간 크기의 약 6배(북쪽/깊이 3배 × 동쪽/폭 2배),
// 벽 높이도 약 4배로 키운 전용 텍스처를 테마별로 하나씩 써서 개인 공간과 같은 skewY 눕히기 기법으로 두 면만 세운다.
// 기존 기둥/제단 등 장식 프롭은 좌표를 새 크기에 비례 확대해 그대로 재사용(세부 장식 추가는 다음 패스).
const GRAND_ROOM_W = PERSONAL_ROOM_W * 2 // 28 — 동쪽(폭) 2배
const GRAND_ROOM_H = PERSONAL_ROOM_H * 3 // 36 — 북쪽(깊이) 3배
const GRAND_CX = GRAND_ROOM_W / 2
const GRAND_ROOM_SPAWN = { x: GRAND_CX, y: GRAND_ROOM_H - 3 }
const GRAND_ROOM_EXIT = { x: GRAND_CX, y: GRAND_ROOM_H - 1.5 }
const GRAND_DOOR_W = 4.0

/**
 * 평벽 조각 n개 사이사이에 feature(창/문) 조각들을 균등 간격으로 끼워 넣은 세그먼트 목록을 만든다.
 * leadingFeature 가 있으면 맨 앞에 고정으로 붙인다(랜드마크 문 = 벽 시작점, 뒤쪽 꼭짓점 쪽).
 */
function interleaveWallSegs(
  plain: { s: string; w: number; h: number },
  totalLen: number,
  plainCount: number,
  pxPerCell: number,
  features: WallSeg[],
  leadingFeature?: WallSeg,
): WallSeg[] {
  const fixedLen = (leadingFeature?.fw ?? 0) + features.reduce((s, f) => s + f.fw, 0)
  const plainW = (totalLen - fixedLen) / plainCount
  const segs: WallSeg[] = leadingFeature ? [leadingFeature] : []
  // 남은 평벽 자리에 창문을 거의 고르게 분산(끝 칸은 피해 모서리와 안 겹치게)
  const gap = Math.max(1, Math.floor(plainCount / (features.length + 1)))
  let fi = 0
  for (let i = 0; i < plainCount; i++) {
    if (fi < features.length && i > 0 && i % gap === 0) segs.push(features[fi++])
    segs.push(plainSeg(plain, plainW, pxPerCell))
  }
  while (fi < features.length) segs.push(features[fi++])
  return segs
}

/**
 * 랜드마크 전용 큰 벽판(테마별 1장)을 개인 공간과 똑같은 기법(plainSeg/featureSeg/renderWallRun)으로
 * 북/서 두 면에 이어붙인다. windowSprite/doorSprite 를 주면 개인 공간처럼 벽보다 살짝 높이 솟는 작은 창/문을
 * 끼워 넣는다(없으면 평벽만 있는 뼈대). 문은 북벽 뒤쪽 꼭짓점 쪽 첫 칸, 창문은 북벽 2개·서벽(더 긴 면) 3개.
 */
function buildGrandHallWalls(
  plain: { s: string; w: number; h: number },
  plainFw = 3.2,
  windowSprite?: { s: string; w: number; h: number },
  doorSprite?: { s: string; w: number; h: number },
): PropDef[] {
  const margin = 1.5
  const pxPerCell = plain.w / plainFw
  const plainPxH = plainSeg(plain, plainFw, pxPerCell).pxH
  const mkWindow = () => featureSeg(windowSprite!, plainPxH, 1.15, pxPerCell)
  const door = doorSprite ? featureSeg(doorSprite, plainPxH, 1.3, pxPerCell) : undefined

  const northWindows = windowSprite ? [mkWindow(), mkWindow()] : []
  const northSegs = interleaveWallSegs(plain, GRAND_ROOM_W - 2 * margin, 5, pxPerCell, northWindows, door)
  const westWindows = windowSprite ? [mkWindow(), mkWindow(), mkWindow()] : []
  const westSegs = interleaveWallSegs(plain, GRAND_ROOM_H - 2 * margin, 6, pxPerCell, westWindows)

  return [
    ...renderWallRun('gwall-n', northSegs, margin, margin - 0.1, 1),
    ...renderWallRun('gwall-w', westSegs, margin, margin - 0.1, -1),
  ]
}

/** 기존 랜드마크 장식 프롭(옛 16×14 기준 좌표)을 새 웅장한 홀 크기에 비례 확대 배치 */
function scaleLandmarkToGrand(props: PropDef[]): PropDef[] {
  const sx = GRAND_ROOM_W / LANDMARK_ROOM_W
  const sy = GRAND_ROOM_H / LANDMARK_ROOM_H
  return props.map((p) => ({ ...p, cell: { x: GRAND_CX + (p.cell.x - LM_CX) * sx, y: p.cell.y * sy } }))
}

// ── 랜드마크 실내 장식 — 참고 이미지(고딕 성당·용암 옥좌실) 컨셉으로 "웅장한" 느낌만 우선 채움.
// 픽셀랩 생성 에셋(기둥·장미창·옥좌) + SVG 폴백 램프로 최소 구성. 세부 장식은 추후 보강.
const LM_CX = LANDMARK_ROOM_W / 2

// 랜드마크별 웅장한 홀 전용 벽판(픽셀랩 생성, 테마 컨셉) — 개인 공간 wall_plain.png 자리를 대신한다
const GW = '/images/map/props/grand/'
const GRAND_WALL_SCHOOL = { s: GW + 'wall-school.png', w: 96, h: 252 }
const GRAND_WALL_ATLANTIS = { s: GW + 'wall-atlantis.png', w: 64, h: 168 }
const GRAND_WALL_DEMON = { s: GW + 'wall-demon.png', w: 64, h: 168 }
const GRAND_WALL_SKY = { s: GW + 'wall-sky.png', w: 64, h: 168 }
const GRAND_WALL_RUIN = { s: GW + 'wall-ruin.png', w: 64, h: 168 }
// TODO: 오로라 전용 벽 텍스처는 픽셀랩 생성 예산(9/30 리셋) 소진으로 보류 — 당분간 하늘 신전 벽(흰-파랑 톤이 비슷)을 임시로 재사용
const GRAND_WALL_AURORA = GRAND_WALL_SKY
// 창문/문 — 개인 공간 wall_window.png/door.png 를 테마 색상으로 로컬 리컬러링(scripts, 생성 예산 0 소모)
const GRAND_WINDOW_SCHOOL = { s: GW + 'window-school.png', w: 80, h: 121 }
const GRAND_WINDOW_ATLANTIS = { s: GW + 'window-atlantis.png', w: 80, h: 121 }
const GRAND_WINDOW_DEMON = { s: GW + 'window-demon.png', w: 80, h: 121 }
const GRAND_WINDOW_SKY = { s: GW + 'window-sky.png', w: 80, h: 121 }
const GRAND_WINDOW_RUIN = { s: GW + 'window-ruin.png', w: 80, h: 121 }
const GRAND_WINDOW_AURORA = { s: GW + 'window-aurora.png', w: 80, h: 121 }
const GRAND_DOOR_SCHOOL = { s: GW + 'door-school.png', w: 92, h: 148 }
const GRAND_DOOR_ATLANTIS = { s: GW + 'door-atlantis.png', w: 92, h: 148 }
const GRAND_DOOR_DEMON = { s: GW + 'door-demon.png', w: 92, h: 148 }
const GRAND_DOOR_SKY = { s: GW + 'door-sky.png', w: 92, h: 148 }
const GRAND_DOOR_RUIN = { s: GW + 'door-ruin.png', w: 92, h: 148 }
const GRAND_DOOR_AURORA = { s: GW + 'door-aurora.png', w: 92, h: 148 }
/** 홀 중간 깊이에 마주보는 동상 2개 + 안쪽 기둥 옆 결정 장식 2개(테마별 기존 에셋 재사용, 생성 예산 0) */
function grandDecor(idPrefix: string, statue: { s: string; w: number; h: number }, crystal: { s: string; w: number; h: number }): PropDef[] {
  return [
    { id: `${idPrefix}-statue-w`, kind: 'statue', cell: { x: GRAND_CX - 7, y: 16 }, sprite: statue.s, px: { w: statue.w, h: statue.h }, size: { w: 0.4, d: 0.4 } },
    { id: `${idPrefix}-statue-e`, kind: 'statue', cell: { x: GRAND_CX + 7, y: 16 }, sprite: statue.s, px: { w: statue.w, h: statue.h }, size: { w: 0.4, d: 0.4 } },
    { id: `${idPrefix}-crystal-w`, kind: 'bush', cell: { x: GRAND_CX - 5, y: 6 }, sprite: crystal.s, px: { w: crystal.w, h: crystal.h }, size: { w: 0.3, d: 0.3 } },
    { id: `${idPrefix}-crystal-e`, kind: 'bush', cell: { x: GRAND_CX + 5, y: 6 }, sprite: crystal.s, px: { w: crystal.w, h: crystal.h }, size: { w: 0.3, d: 0.3 } },
  ]
}
const ATLANTIS_TEMPLE_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_ATLANTIS, 3.2, GRAND_WINDOW_ATLANTIS, GRAND_DOOR_ATLANTIS),
  ...scaleLandmarkToGrand([
    { id: 'atltemple-window', kind: 'dome', cell: { x: LM_CX, y: 1.6 }, size: { w: 0.1, d: 0.1 }, radial: true, label: '장미창', sprite: '/images/map/props/atlantis/atl4_window.png', px: { w: 86, h: 162 } },
    { id: 'atltemple-pillar-nw', kind: 'tower', cell: { x: LM_CX - 4, y: 3.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'atltemple-pillar-ne', kind: 'tower', cell: { x: LM_CX + 4, y: 3.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'atltemple-pillar-sw', kind: 'tower', cell: { x: LM_CX - 4, y: 8.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'atltemple-pillar-se', kind: 'tower', cell: { x: LM_CX + 4, y: 8.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'atltemple-lamp-w', kind: 'lamp', cell: { x: LM_CX - 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
    { id: 'atltemple-lamp-e', kind: 'lamp', cell: { x: LM_CX + 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
  ]),
  // 세부 장식 — 진주 기념비 중앙 + 해초 장식(테마 기존 에셋 재사용)
  { id: 'atltemple-monument', kind: 'statue', cell: { x: GRAND_CX, y: 16 }, sprite: '/images/map/props/atlantis/atl_pearlmonument.png', px: { w: 120, h: 119 }, size: { w: 0.5, d: 0.5 } },
  { id: 'atltemple-kelp-w', kind: 'bush', cell: { x: GRAND_CX - 5, y: 6 }, sprite: '/images/map/props/atlantis/atl_kelp.png', px: { w: 38, h: 56 }, size: { w: 0.3, d: 0.3 } },
  { id: 'atltemple-kelp-e', kind: 'bush', cell: { x: GRAND_CX + 5, y: 6 }, sprite: '/images/map/props/atlantis/atl_kelp.png', px: { w: 38, h: 56 }, size: { w: 0.3, d: 0.3 } },
]
const DEMON_TEMPLE_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_DEMON, 3.2, GRAND_WINDOW_DEMON, GRAND_DOOR_DEMON),
  ...scaleLandmarkToGrand([
    { id: 'demtemple-throne', kind: 'dome', cell: { x: LM_CX, y: 2.2 }, size: { w: 0.1, d: 0.1 }, radial: true, label: '옥좌', sprite: '/images/map/props/demon/dm_throne.png', px: { w: 50, h: 105 } },
    { id: 'demtemple-lamp-w', kind: 'lamp', cell: { x: LM_CX - 3, y: 5.5 }, size: { w: 0.2, d: 0.2 } },
    { id: 'demtemple-lamp-e', kind: 'lamp', cell: { x: LM_CX + 3, y: 5.5 }, size: { w: 0.2, d: 0.2 } },
    { id: 'demtemple-lamp-w2', kind: 'lamp', cell: { x: LM_CX - 3, y: 9 }, size: { w: 0.2, d: 0.2 } },
    { id: 'demtemple-lamp-e2', kind: 'lamp', cell: { x: LM_CX + 3, y: 9 }, size: { w: 0.2, d: 0.2 } },
  ]),
  ...grandDecor('demtemple', { s: '/images/map/props/demon/dm_statue.png', w: 57, h: 107 }, { s: '/images/map/props/demon/dm_crystals.png', w: 54, h: 56 }),
]
const skySanctumTileAt = (): TileKind => 'sky-marble'
const ruinSanctumTileAt = (): TileKind => 'ruin-stone'
const auroraSanctumTileAt = (): TileKind => 'aurora-stone'
const SKY_SANCTUM_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_SKY, 3.2, GRAND_WINDOW_SKY, GRAND_DOOR_SKY),
  ...scaleLandmarkToGrand([
    { id: 'skysanctum-altar', kind: 'dome', cell: { x: LM_CX, y: 2.4 }, size: { w: 0.1, d: 0.1 }, radial: true, label: '빛의 제단', sprite: '/images/map/props/skytemple/sk4_altar.png', px: { w: 64, h: 71 } },
    { id: 'skysanctum-pillar-nw', kind: 'tower', cell: { x: LM_CX - 4, y: 3.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'skysanctum-pillar-ne', kind: 'tower', cell: { x: LM_CX + 4, y: 3.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'skysanctum-pillar-sw', kind: 'tower', cell: { x: LM_CX - 4, y: 8.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'skysanctum-pillar-se', kind: 'tower', cell: { x: LM_CX + 4, y: 8.4 }, sprite: '/images/map/props/atlantis/atl4_pillar.png', px: { w: 31, h: 133 }, size: { w: 0.3, d: 0.3 } },
    { id: 'skysanctum-lamp-w', kind: 'lamp', cell: { x: LM_CX - 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
    { id: 'skysanctum-lamp-e', kind: 'lamp', cell: { x: LM_CX + 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
  ]),
  ...grandDecor('skysanctum', { s: '/images/map/props/skytemple/sk2_statue.png', w: 58, h: 99 }, { s: '/images/map/props/skytemple/sk2_crystals.png', w: 46, h: 66 }),
]
const RUIN_SANCTUM_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_RUIN, 3.2, GRAND_WINDOW_RUIN, GRAND_DOOR_RUIN),
  ...scaleLandmarkToGrand([
    { id: 'ruinsanctum-altar', kind: 'dome', cell: { x: LM_CX, y: 2.4 }, size: { w: 0.1, d: 0.1 }, radial: true, label: '깨어진 제단', sprite: '/images/map/props/templeruin/rt4_altar.png', px: { w: 85, h: 82 } },
    { id: 'ruinsanctum-pillar-nw', kind: 'tower', cell: { x: LM_CX - 4, y: 3.4 }, sprite: '/images/map/props/templeruin/rt4_pillar.png', px: { w: 56, h: 138 }, size: { w: 0.3, d: 0.3 } },
    { id: 'ruinsanctum-pillar-ne', kind: 'tower', cell: { x: LM_CX + 4, y: 3.4 }, sprite: '/images/map/props/templeruin/rt4_pillar.png', px: { w: 56, h: 138 }, size: { w: 0.3, d: 0.3 } },
    { id: 'ruinsanctum-pillar-sw', kind: 'tower', cell: { x: LM_CX - 4, y: 8.4 }, sprite: '/images/map/props/templeruin/rt4_pillar.png', px: { w: 56, h: 138 }, size: { w: 0.3, d: 0.3 } },
    { id: 'ruinsanctum-pillar-se', kind: 'tower', cell: { x: LM_CX + 4, y: 8.4 }, sprite: '/images/map/props/templeruin/rt4_pillar.png', px: { w: 56, h: 138 }, size: { w: 0.3, d: 0.3 } },
    { id: 'ruinsanctum-lamp-w', kind: 'lamp', cell: { x: LM_CX - 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
    { id: 'ruinsanctum-lamp-e', kind: 'lamp', cell: { x: LM_CX + 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
  ]),
  ...grandDecor('ruinsanctum', { s: '/images/map/props/templeruin/rt_statue.png', w: 58, h: 98 }, { s: '/images/map/props/templeruin/rt_crystals.png', w: 54, h: 60 }),
]
const AURORA_SANCTUM_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_AURORA, 3.2, GRAND_WINDOW_AURORA, GRAND_DOOR_AURORA),
  ...scaleLandmarkToGrand([
    { id: 'aurorasanctum-altar', kind: 'dome', cell: { x: LM_CX, y: 2.4 }, size: { w: 0.1, d: 0.1 }, radial: true, label: '오로라 제단', sprite: '/images/map/props/aurora/au4_altar.png', px: { w: 61, h: 91 } },
    { id: 'aurorasanctum-pillar-nw', kind: 'tower', cell: { x: LM_CX - 4, y: 3.4 }, sprite: '/images/map/props/aurora/au4_pillar.png', px: { w: 53, h: 134 }, size: { w: 0.3, d: 0.3 } },
    { id: 'aurorasanctum-pillar-ne', kind: 'tower', cell: { x: LM_CX + 4, y: 3.4 }, sprite: '/images/map/props/aurora/au4_pillar.png', px: { w: 53, h: 134 }, size: { w: 0.3, d: 0.3 } },
    { id: 'aurorasanctum-pillar-sw', kind: 'tower', cell: { x: LM_CX - 4, y: 8.4 }, sprite: '/images/map/props/aurora/au4_pillar.png', px: { w: 53, h: 134 }, size: { w: 0.3, d: 0.3 } },
    { id: 'aurorasanctum-pillar-se', kind: 'tower', cell: { x: LM_CX + 4, y: 8.4 }, sprite: '/images/map/props/aurora/au4_pillar.png', px: { w: 53, h: 134 }, size: { w: 0.3, d: 0.3 } },
    { id: 'aurorasanctum-lamp-w', kind: 'lamp', cell: { x: LM_CX - 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
    { id: 'aurorasanctum-lamp-e', kind: 'lamp', cell: { x: LM_CX + 2.2, y: 6 }, size: { w: 0.2, d: 0.2 } },
  ]),
  ...grandDecor('aurorasanctum', { s: '/images/map/props/aurora/au_statue.png', w: 66, h: 94 }, { s: '/images/map/props/aurora/au_crystals.png', w: 58, h: 65 }),
]
const ATLANTIS_TEMPLE_BLOCKERS = buildBlockers(ATLANTIS_TEMPLE_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))
const DEMON_TEMPLE_BLOCKERS = buildBlockers(DEMON_TEMPLE_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))
const SKY_SANCTUM_BLOCKERS = buildBlockers(SKY_SANCTUM_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))
const RUIN_SANCTUM_BLOCKERS = buildBlockers(RUIN_SANCTUM_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))
const AURORA_SANCTUM_BLOCKERS = buildBlockers(AURORA_SANCTUM_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))

// ════════ 마법학교 본관 — 중앙 홀 + 수업관/대강당/학장실/도서관 (참고: 루트 `마법학교 실내.png`) ════════
// 중앙 홀: 천사상 분수 + 금/청 상감 마법진 바닥 + 카페 테이블·벤치·가로등·배너(참고 이미지 구도).
// 뒤쪽 두 벽(북=화면 오른쪽 위, 서=왼쪽 위)에 문 6개를 달고, 문 앞 마법진 포탈로 각 실내 맵에 들어간다.
//   서벽: 화염 / 빙결 / 대지 수업관 · 북벽: 도서관 / 대강당 / 학장실
// 벽은 평벽을 빈틈없이 이은 뒤 문을 그 앞에 겹쳐 세우고(backdrop 레이어), 소품은 전부 PixelLab 생성(props/academy/).
const AC = '/images/map/props/academy/'
type Spr = { s: string; w: number; h: number }
const acs = (f: string, w: number, h: number): Spr => ({ s: AC + f, w, h })
const AC_SPR = {
  fountain: acs('ac_fountain.png', 300, 300),
  cafe: acs('ac_cafe.png', 78, 90),
  bench: acs('ac_bench.png', 80, 51),
  lamp: acs('ac_lamp.png', 41, 176),
  tree: acs('ac_tree.png', 60, 112),
  banner: acs('ac_banner.png', 48, 136),
  doorFire: acs('door_fire.png', 88, 147),
  doorIce: acs('door_ice.png', 92, 154),
  doorEarth: acs('door_earth.png', 85, 144),
  doorHall: acs('door_hall.png', 124, 185),
  doorOffice: acs('door_office.png', 66, 142),
  doorLibrary: acs('door_library.png', 95, 146),
  desk: acs('cl_desk.png', 80, 79),
  board: acs('cl_board.png', 69, 106),
  fireAltar: acs('fr_altar.png', 100, 129),
  brazier: acs('fr_brazier.png', 50, 110),
  iceAltar: acs('ic_altar.png', 93, 121),
  iceCrystal: acs('ic_crystal.png', 53, 97),
  earthTree: acs('ea_tree.png', 134, 169),
  herbBed: acs('ea_herbs.png', 122, 87),
  wallFire: acs('wall_fire.png', 64, 160),
  wallIce: acs('wall_ice.png', 64, 160),
  wallEarth: acs('wall_earth.png', 64, 160),
  wallLibrary: acs('wall_library.png', 64, 160),
  wallOffice: acs('wall_office.png', 64, 160),
  stage: acs('au_stage.png', 198, 155),
  pew: acs('au_pew.png', 108, 58),
  organ: acs('au_organ.png', 92, 159),
  bigDesk: acs('of_desk.png', 106, 98),
  globe: acs('of_globe.png', 54, 78),
  fireplace: acs('of_fireplace.png', 121, 121),
  perch: acs('of_perch.png', 55, 104),
  bookshelf: acs('lb_shelf.png', 65, 131),
  readTable: acs('lb_table.png', 101, 87),
  orb: acs('lb_orb.png', 64, 112),
}
const AC_WALL_M = 1.4 // 벽 선(북 y / 서 x) — 이 안쪽 약 0.5셀까지 이동 불가(벽 뒤로 못 들어가게)

/** 뒤쪽 두 벽 + 문(겹쳐 세움). 문 위치는 북벽 x / 서벽 y 셀 좌표. 전부 backdrop 레이어. */
function academyWalls(
  id: string,
  w: number,
  h: number,
  wall: Spr,
  doors: { side: 'N' | 'W'; at: number; door: Spr; hPx: number }[] = [],
  wallFw = 3.0,
): PropDef[] {
  const m = AC_WALL_M
  // 셀 하나가 벽 방향으로 화면상 32px(ISO_TILE_W/2) — 이 비율로 늘려야 조각 사이 틈 없이 딱 맞물린다
  const ppc = 32
  const run = (len: number) => {
    const n = Math.max(1, Math.round(len / wallFw))
    return Array.from({ length: n }, () => plainSeg(wall, len / n, ppc))
  }
  const walls = [
    ...renderWallRun(`${id}-wn`, run(w - m - 0.4), m, m - 0.1, 1),
    ...renderWallRun(`${id}-ww`, run(h - m - 0.4), m, m - 0.1, -1),
  ]
  const doorProps = doors.flatMap((d, i) => {
    const pxW = d.hPx * (d.door.w / d.door.h)
    const seg: WallSeg = { fw: pxW / ppc, pxW, pxH: d.hPx, sprite: d.door, feature: true }
    return renderWallRun(`${id}-door${i}-`, [seg], d.at - seg.fw / 2, m - 0.08, d.side === 'N' ? 1 : -1)
  })
  return [...walls, ...doorProps].map((p) => ({ ...p, backdrop: true }))
}

/** 실내 소품 1개 — 중심 앵커(radial). footprint 반경 r 셀만큼 앵커를 이미지 바닥에서 끌어올린다 */
function acProp(
  id: string,
  sp: Spr,
  x: number,
  y: number,
  r = 0.5,
  opt: { scale?: number; solid?: boolean; kind?: PropDef['kind']; flip?: boolean } = {},
): PropDef {
  const k = opt.scale ?? 1
  const w = sp.w * k
  const h = sp.h * k
  return {
    id,
    kind: opt.kind ?? 'statue',
    cell: { x, y },
    sprite: sp.s,
    px: { w, h },
    anchor: { x: w / 2, y: h - 22 * r * k },
    radial: true,
    size: { w: r * 2, d: r * 2 },
    collide: { w: r * 1.7, d: r * 1.7 },
    solid: opt.solid ?? true,
    facing: opt.flip ? 'left' : undefined,
  }
}

/** 벽 두께(뒤로 못 들어감) + 앞쪽 두 면 + 남쪽 출구 틈 */
function academyBlockers(w: number, h: number, props: PropDef[], exitW = 2.4): Blocker[] {
  const t = AC_WALL_M + 0.5
  return buildBlockers(
    props.filter((p) => !p.backdrop),
    [
      { x0: 0, y0: 0, x1: w, y1: t },
      { x0: 0, y0: 0, x1: t, y1: h },
      { x0: w - 0.4, y0: 0, x1: w, y1: h },
      { x0: 0, y0: h - 0.4, x1: w / 2 - exitW / 2, y1: h },
      { x0: w / 2 + exitW / 2, y0: h - 0.4, x1: w, y1: h },
    ],
  )
}

// ── 중앙 홀 ──
const HALL_W = 34
const HALL_H = 30
const HALL_FX = 17.5 // 분수·마법진 중심
const HALL_FY = 15
// 문 위치 — 서벽(y): 화염·빙결·대지 / 북벽(x): 도서관·대강당·학장실
const HALL_DOORS = {
  fire: { side: 'W' as const, at: 7.5 },
  ice: { side: 'W' as const, at: 15 },
  earth: { side: 'W' as const, at: 22.5 },
  library: { side: 'N' as const, at: 8.5 },
  auditorium: { side: 'N' as const, at: HALL_FX },
  office: { side: 'N' as const, at: 26.5 },
}
/** 문 앞(홀 안쪽) 셀 — d=1.5 포탈 위치, d=3.4 되돌아올 때 도착 위치 */
const hallFront = (k: keyof typeof HALL_DOORS, d: number) => {
  const o = HALL_DOORS[k]
  return o.side === 'N' ? { x: o.at, y: AC_WALL_M + d } : { x: AC_WALL_M + d, y: o.at }
}
const schoolHallTileAt = (): TileKind => 'academy-marble'
const SCHOOL_HALL_INLAY: GameMap['floorInlay'] = [{ cx: HALL_FX, cy: HALL_FY, r: 8.6, gold: '#c9a24a', blue: '#4f78c8' }]
const SCHOOL_HALL_PROPS: PropDef[] = (() => {
  const S = AC_SPR
  const out: PropDef[] = academyWalls('hall', HALL_W, HALL_H, GRAND_WALL_SCHOOL, [
    { ...HALL_DOORS.fire, door: S.doorFire, hPx: 150 },
    { ...HALL_DOORS.ice, door: S.doorIce, hPx: 150 },
    { ...HALL_DOORS.earth, door: S.doorEarth, hPx: 150 },
    { ...HALL_DOORS.library, door: S.doorLibrary, hPx: 150 },
    { ...HALL_DOORS.auditorium, door: S.doorHall, hPx: 220 },
    { ...HALL_DOORS.office, door: S.doorOffice, hPx: 150 },
  ])
  // 천사상 분수 — 앵커는 수반 중심
  out.push({ ...acProp('hall-fountain', S.fountain, HALL_FX, HALL_FY, 2.9, { kind: 'fountain' }), anchor: { x: 150, y: 214 }, label: '천사의 분수' })
  // 분수 둘레 가로등 4 + 벤치 4 (마법진 안쪽 링)
  const ring4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  ring4.forEach(([dx, dy], i) => out.push(acProp(`hall-lamp${i}`, S.lamp, HALL_FX + dx * 5.6, HALL_FY + dy * 5.6, 0.25, { kind: 'lamp' })))
  const diag4 = [[1, -1], [1, 1], [-1, 1], [-1, -1]]
  diag4.forEach(([dx, dy], i) => out.push(acProp(`hall-bench${i}`, S.bench, HALL_FX + dx * 3.9, HALL_FY + dy * 3.9, 0.55, { flip: dx * dy > 0 })))
  // 문마다 양옆 배너 기둥
  for (const [k, o] of Object.entries(HALL_DOORS)) {
    const half = k === 'auditorium' ? 3.4 : 2.2
    for (const s of [-1, 1]) {
      const c = o.side === 'N' ? { x: o.at + s * half, y: AC_WALL_M + 1.0 } : { x: AC_WALL_M + 1.0, y: o.at + s * half }
      out.push(acProp(`hall-banner-${k}${s}`, S.banner, c.x, c.y, 0.3))
    }
  }
  // 카페 테라스(동쪽·남서쪽) + 화분 나무 + 외곽 가로등
  const cafes = [[27.5, 8], [30.5, 12.5], [28, 21.5], [31, 25], [8.5, 25.5], [12.5, 27.2]]
  cafes.forEach(([x, y], i) => out.push(acProp(`hall-cafe${i}`, S.cafe, x, y, 0.7)))
  const trees = [[31.8, 4.2], [4.2, 27.8], [31.8, 18], [21.5, 27.6], [4.4, 4.4]]
  trees.forEach(([x, y], i) => out.push(acProp(`hall-tree${i}`, S.tree, x, y, 0.55)))
  const outerLamps = [[9.5, 18.5], [25.5, 11.5], [14, 25], [23.5, 24]]
  outerLamps.forEach(([x, y], i) => out.push(acProp(`hall-lamp-o${i}`, S.lamp, x, y, 0.25, { kind: 'lamp' })))
  return out
})()
const SCHOOL_HALL_BLOCKERS = academyBlockers(HALL_W, HALL_H, SCHOOL_HALL_PROPS, 3)

// ── 수업관(화염·빙결·대지) — 18×16, 칠판·중앙 제단·책상 8개·테마 장식 ──
const CLASS_W = 18
const CLASS_H = 16
const CLASS_CORNERS = [[3.3, 3.3], [14.8, 3.4], [3.3, 13.6], [15, 13.6], [3.3, 8.6]]
function classroomProps(id: string, wall: Spr, center: PropDef, decor: PropDef[]): PropDef[] {
  const S = AC_SPR
  const out = academyWalls(id, CLASS_W, CLASS_H, wall)
  out.push(acProp(`${id}-board`, S.board, CLASS_W / 2, AC_WALL_M + 1.2, 0.5, { scale: 1.2 }))
  out.push(center)
  for (const [i, x] of [4.2, 6.9, 11.1, 13.8].entries()) {
    for (const [j, y] of [9.4, 11.8].entries()) out.push(acProp(`${id}-desk${i}-${j}`, S.desk, x, y, 0.6))
  }
  return [...out, ...decor]
}
const CLASS_FIRE_PROPS = classroomProps(
  'clfire',
  AC_SPR.wallFire,
  acProp('clfire-altar', AC_SPR.fireAltar, CLASS_W / 2, 6, 1.0, { scale: 1.1 }),
  CLASS_CORNERS.map(([x, y], i) => acProp(`clfire-brazier${i}`, AC_SPR.brazier, x, y, 0.35)),
)
const CLASS_ICE_PROPS = classroomProps(
  'clice',
  AC_SPR.wallIce,
  acProp('clice-altar', AC_SPR.iceAltar, CLASS_W / 2, 6, 1.0, { scale: 1.1 }),
  CLASS_CORNERS.map(([x, y], i) => acProp(`clice-crystal${i}`, AC_SPR.iceCrystal, x, y, 0.45, { flip: i % 2 === 1 })),
)
const CLASS_EARTH_PROPS = classroomProps('clearth', AC_SPR.wallEarth, acProp('clearth-tree', AC_SPR.earthTree, CLASS_W / 2, 6, 1.3), [
  acProp('clearth-herb0', AC_SPR.herbBed, 3.4, 5.2, 0.8),
  acProp('clearth-herb1', AC_SPR.herbBed, 15, 5.2, 0.8, { flip: true }),
  ...[[3.3, 13.6], [15, 13.6], [3.4, 9.2]].map(([x, y], i) => acProp(`clearth-pot${i}`, AC_SPR.tree, x, y, 0.5)),
])
const classTile = (k: TileKind) => (): TileKind => k

// ── 대강당 — 26×22, 무대·파이프오르간·신도석 줄·남색 카펫 통로 ──
const AUD_W = 26
const AUD_H = 22
const audTileAt = (x: number, y: number): TileKind =>
  x > AUD_W / 2 - 1.6 && x < AUD_W / 2 + 1.6 && y > 7.5 ? 'academy-carpet' : 'academy-marble'
const AUD_PROPS: PropDef[] = (() => {
  const S = AC_SPR
  const out = academyWalls('aud', AUD_W, AUD_H, GRAND_WALL_SCHOOL)
  out.push({ ...acProp('aud-stage', S.stage, AUD_W / 2, 4.6, 2.2, { scale: 1.3 }), label: '대강당 무대' })
  out.push(acProp('aud-organ', S.organ, 4.2, 4.2, 1.1))
  for (const [j, y] of [9.8, 12.3, 14.8, 17.3].entries()) {
    for (const [i, x] of [AUD_W / 2 - 4.6, AUD_W / 2 + 4.6].entries()) out.push(acProp(`aud-pew${j}-${i}`, S.pew, x, y, 0.8, { scale: 1.15 }))
  }
  const lamps = [[3.3, 9], [3.3, 15], [22.8, 9], [22.8, 15]]
  lamps.forEach(([x, y], i) => out.push(acProp(`aud-lamp${i}`, S.lamp, x, y, 0.25, { kind: 'lamp' })))
  ;[8.5, 17.5, 21.5].forEach((x, i) => out.push(acProp(`aud-banner${i}`, S.banner, x, AC_WALL_M + 1, 0.3)))
  return out
})()

// ── 학장실 — 16×14, 원목 바닥+러그, 대형 책상·벽난로·책장·지구본·불사조 횃대 ──
const OFF_W = 16
const OFF_H = 14
const offTileAt = (x: number, y: number): TileKind => (x > 4.5 && x < 11.5 && y > 4.2 && y < 10.5 ? 'personal-rug' : 'personal-wood')
const OFF_PROPS: PropDef[] = [
  ...academyWalls('off', OFF_W, OFF_H, AC_SPR.wallOffice),
  acProp('off-fireplace', AC_SPR.fireplace, OFF_W / 2, AC_WALL_M + 1.0, 0.8),
  acProp('off-shelf0', AC_SPR.bookshelf, 4.2, AC_WALL_M + 0.9, 0.6),
  acProp('off-shelf1', AC_SPR.bookshelf, 11.8, AC_WALL_M + 0.9, 0.6),
  { ...acProp('off-desk', AC_SPR.bigDesk, OFF_W / 2, 7, 1.0), label: '학장의 책상' },
  acProp('off-globe', AC_SPR.globe, 13, 8.2, 0.35),
  acProp('off-perch', AC_SPR.perch, 3.4, 7.6, 0.35),
  acProp('off-tree', AC_SPR.tree, 13.4, 11.6, 0.5),
]

// ── 도서관 — 22×18, 책장 열·열람 테이블·떠 있는 마도 구체 ──
const LIB_W = 22
const LIB_H = 18
const libTileAt = (x: number): TileKind => (x > LIB_W / 2 - 1.4 && x < LIB_W / 2 + 1.4 ? 'personal-rug' : 'personal-wood')
const LIB_PROPS: PropDef[] = (() => {
  const S = AC_SPR
  const out = academyWalls('lib', LIB_W, LIB_H, S.wallLibrary)
  ;[4.3, 7.5, 14.5, 17.7].forEach((x, i) => out.push(acProp(`lib-shelf-n${i}`, S.bookshelf, x, AC_WALL_M + 0.9, 0.6)))
  ;[4.6, 7.6, 14.4, 17.4].forEach((x, i) => out.push(acProp(`lib-shelf-r${i}`, S.bookshelf, x, 7, 0.6)))
  out.push({ ...acProp('lib-orb', S.orb, LIB_W / 2, 5.2, 0.6), label: '지식의 구체' })
  const tables = [[6, 11.8], [16, 11.8], [6, 14.6], [16, 14.6]]
  tables.forEach(([x, y], i) => out.push(acProp(`lib-table${i}`, S.readTable, x, y, 0.9)))
  ;[3.2, 19].forEach((x, i) => out.push(acProp(`lib-lamp${i}`, S.lamp, x, 3.6, 0.25, { kind: 'lamp' })))
  return out
})()

/** 실내 방 맵 공통 — 남쪽 출구 포탈로 홀의 해당 문 앞에 돌아간다 */
function academyRoomMap(
  id: MapId,
  name: string,
  w: number,
  h: number,
  tileAt: (x: number, y: number) => TileKind,
  props: PropDef[],
  back: keyof typeof HALL_DOORS,
): GameMap {
  return {
    id,
    name,
    kind: 'town',
    grid: { w, h },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt,
    props,
    blockers: academyBlockers(w, h, props),
    zones: NO_ZONES,
    spawn: { x: w / 2, y: h - 2.6 },
    portals: [{ id: `${id}-exit`, cell: { x: w / 2, y: h - 1.1 }, to: 'school-hall', toSpawn: hallFront(back, 3.4), label: '중앙 홀로', kind: 'exit' }],
  }
}
const ACADEMY_ROOMS: Partial<Record<MapId, GameMap>> = {
  'class-fire': academyRoomMap('class-fire', '화염 수업관', CLASS_W, CLASS_H, classTile('academy-fire'), CLASS_FIRE_PROPS, 'fire'),
  'class-ice': academyRoomMap('class-ice', '빙결 수업관', CLASS_W, CLASS_H, classTile('academy-ice'), CLASS_ICE_PROPS, 'ice'),
  'class-earth': academyRoomMap('class-earth', '대지 수업관', CLASS_W, CLASS_H, classTile('academy-earth'), CLASS_EARTH_PROPS, 'earth'),
  'grand-auditorium': academyRoomMap('grand-auditorium', '대강당', AUD_W, AUD_H, audTileAt, AUD_PROPS, 'auditorium'),
  'headmaster-office': academyRoomMap('headmaster-office', '학장실', OFF_W, OFF_H, offTileAt, OFF_PROPS, 'office'),
  'academy-library': academyRoomMap('academy-library', '도서관', LIB_W, LIB_H, libTileAt, LIB_PROPS, 'library'),
}
const HALL_ROOM_PORTALS: GameMap['portals'] = (
  [
    ['fire', 'class-fire', '화염 수업관'],
    ['ice', 'class-ice', '빙결 수업관'],
    ['earth', 'class-earth', '대지 수업관'],
    ['library', 'academy-library', '도서관'],
    ['auditorium', 'grand-auditorium', '대강당'],
    ['office', 'headmaster-office', '학장실'],
  ] as const
).map(([k, to, label]) => ({ id: `hall-to-${to}`, cell: hallFront(k, 1.5), to, label, kind: 'portal' as const }))

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
  Object.entries(FIELD.built).map(([id, b]) => [id, { ...b.map, blockers: buildBlockers(b.props) } as GameMap]),
) as Partial<Record<MapId, GameMap>>
/** 안전 마을 출구 → 갈림길(3단계) 맵의 해당 포탈 앞 */
const townReturn = (town: string) => FIELD.townReturns[town]

export const MAPS = {
  ...FIELD_MAPS,
  village: {
    id: 'village',
    name: '울토르 마법학교 마을',
    kind: 'town',
    grid: { w: VW, h: VH },
    bg: 'school',
    render: 'iso',
    assets: 'raster', // Phase 2 테스트: 가로등만 PNG, 나머지는 sprite 없어 SVG 폴백
    tileAt: villageTileAt,
    props: VILLAGE_PROPS,
    zones: VILLAGE_ZONES,
    blockers: VILLAGE_BLOCKERS,
    spawn: { x: 26.5, y: 12.2 },
    respawn: { x: 9.5, y: 30.0 },
    portals: [
      { id: 'gate-forest', cell: { x: 43.5, y: 36.6 }, to: 'forest', label: '에르디아 숲', kind: 'gate' },
      { id: 'gate-sea', cell: { x: 43.5, y: 36.6 }, to: 'sea', label: '바다', kind: 'gate', requiredLevel: 5 },
      { id: 'gate-stormhaven', cell: { x: 43.5, y: 36.6 }, to: 'stormhaven', label: '스톰헤이븐', kind: 'gate', requiredLevel: 15 },
      { id: 'gate-ruins', cell: { x: 43.5, y: 36.6 }, to: 'ruins', label: '버려진 폐허', kind: 'gate', requiredLevel: 21 },
      { id: 'gate-snowfield', cell: { x: 43.5, y: 36.6 }, to: 'snowfield', label: '루미나 설원', kind: 'gate', requiredLevel: 31 },
      { id: 'gate-volcano', cell: { x: 43.5, y: 36.6 }, to: 'volcano', label: '화산지대', kind: 'gate', requiredLevel: 41 },
      { id: 'personal-space-enter', cell: { x: 42, y: 5 }, to: 'personal-space', label: '내 개인 공간', kind: 'portal' },
      { id: 'school-hall-enter', cell: { x: 6.9, y: 6.5 }, to: 'school-hall', label: '마법학교 본관', kind: 'portal' },
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
      z('z-demon-village', 'demon', '마물 마을', 0, 0, DEMON_AW, DEMON_AH, '#3a1230', '화산 기슭에 자리한 마물들의 정착지. 모르스를 따르지 않는 온건파 마물이 교역한다.'),
    ],
    spawn: { x: DEMON_CX, y: DEMON_ENTRANCE_CY - 0.2 },
    portals: [
      { id: 'demon-village-exit', cell: { x: DEMON_CX, y: DEMON_ENTRANCE_CY + 0.5 }, to: townReturn('demon-village').to, toSpawn: townReturn('demon-village').spawn, label: '화산지대로', kind: 'exit' },
      { id: 'demon-temple-enter', cell: { x: 32, y: 10 }, to: 'demon-temple', label: '화산 성채 내부', kind: 'portal' },
    ],
  },

  // ── 랜드마크 실내 / 개인 공간 (뼈대) ─────────────────────────────────────
  'atlantis-temple': {
    id: 'atlantis-temple',
    name: '아틀란티스 대성당 내부',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'atlantis',
    render: 'iso',
    assets: 'raster',
    tileAt: atlantisTempleTileAt,
    props: ATLANTIS_TEMPLE_PROPS,
    blockers: ATLANTIS_TEMPLE_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'atlantis-temple-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'atlantis', toSpawn: { x: 26, y: 10.2 }, label: '대성당 밖으로', kind: 'exit' },
    ],
  },
  'demon-temple': {
    id: 'demon-temple',
    name: '화산 성채 내부',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'demon',
    render: 'iso',
    assets: 'raster',
    tileAt: demonTempleTileAt,
    props: DEMON_TEMPLE_PROPS,
    blockers: DEMON_TEMPLE_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'demon-temple-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'demon-village', toSpawn: { x: 32, y: 11.4 }, label: '화산 성채 밖으로', kind: 'exit' },
    ],
  },
  'sky-sanctum': {
    id: 'sky-sanctum',
    name: '천공 대신전 내부',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'temple',
    render: 'iso',
    assets: 'raster',
    tileAt: skySanctumTileAt,
    props: SKY_SANCTUM_PROPS,
    blockers: SKY_SANCTUM_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'sky-sanctum-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'sky-temple', toSpawn: { x: 32, y: 11.4 }, label: '신전 밖으로', kind: 'exit' },
    ],
  },
  'ruin-sanctum': {
    id: 'ruin-sanctum',
    name: '버려진 신전 내부',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'temple',
    render: 'iso',
    assets: 'raster',
    tileAt: ruinSanctumTileAt,
    props: RUIN_SANCTUM_PROPS,
    blockers: RUIN_SANCTUM_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'ruin-sanctum-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'temple-ruin', toSpawn: { x: 32, y: 11.4 }, label: '신전 밖으로', kind: 'exit' },
    ],
  },
  'aurora-sanctum': {
    id: 'aurora-sanctum',
    name: '설원 성소 내부',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'aurora',
    render: 'iso',
    assets: 'raster',
    tileAt: auroraSanctumTileAt,
    props: AURORA_SANCTUM_PROPS,
    blockers: AURORA_SANCTUM_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'aurora-sanctum-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'aurora-village', toSpawn: { x: 32, y: 11.4 }, label: '성소 밖으로', kind: 'exit' },
    ],
  },
  'school-hall': {
    id: 'school-hall',
    name: '마법학교 중앙 홀',
    kind: 'town',
    grid: { w: HALL_W, h: HALL_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: schoolHallTileAt,
    props: SCHOOL_HALL_PROPS,
    floorInlay: SCHOOL_HALL_INLAY,
    blockers: SCHOOL_HALL_BLOCKERS,
    zones: NO_ZONES,
    spawn: { x: HALL_FX, y: HALL_H - 2.4 },
    portals: [
      { id: 'school-hall-exit', cell: { x: HALL_FX, y: HALL_H - 1.0 }, to: 'village', toSpawn: { x: 6.9, y: 7.2 }, label: '본관 밖으로', kind: 'exit' },
      ...HALL_ROOM_PORTALS,
    ],
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
    props: PERSONAL_SPACE_WALLS,
    blockers: PERSONAL_SPACE_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...PERSONAL_ROOM_SPAWN },
    portals: [
      { id: 'personal-space-exit', cell: { ...PERSONAL_ROOM_EXIT }, to: 'village', toSpawn: { x: 42, y: 6.4 }, label: '마을로 나가기', kind: 'exit' },
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
