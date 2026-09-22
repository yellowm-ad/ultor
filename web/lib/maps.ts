import type { GameMap, MapId, ZoneDef, ZoneKind } from '@/lib/types'
import type { PropDef, TileKind } from '@/lib/iso'
import { propAABB } from '@/lib/iso'
import { mulberry32 } from '@/lib/rng'
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

/** props 배열의 셀 좌표만 균일 스케일(맵 확장 시 기존 배치를 그대로 넓힌다) */
function scaleProps(props: PropDef[], s: number): PropDef[] {
  return props.map((p) => ({ ...p, cell: { x: p.cell.x * s, y: p.cell.y * s } }))
}

/**
 * 빈 공간에 자연물을 흩뿌려 채운다(결정론적 시드) — 지형 확장으로 생긴 여백을
 * 손으로 일일이 배치하지 않고 자연스럽게 메우기 위한 헬퍼.
 */
function scatterProps(
  biome: keyof typeof FIELD_SPRITES,
  pool: string[],
  count: number,
  w: number,
  h: number,
  avoid: { x: number; y: number; r: number }[],
  seed: number,
  idPrefix: string,
  reject?: (x: number, y: number) => boolean,
): PropDef[] {
  const rand = mulberry32(seed)
  const out: PropDef[] = []
  let tries = 0
  while (out.length < count && tries < count * 25) {
    tries++
    const x = 1 + rand() * (w - 2)
    const y = 1 + rand() * (h - 2)
    if (avoid.some((a) => Math.hypot(x - a.x, y - a.y) < a.r)) continue
    if (reject?.(x, y)) continue
    if (out.some((p) => Math.hypot(p.cell.x - x, p.cell.y - y) < 1.7)) continue
    const key = pool[Math.floor(rand() * pool.length)] as keyof (typeof FIELD_SPRITES)[typeof biome]
    out.push(fprop(biome, key, `${idPrefix}${out.length}`, x, y))
  }
  return out
}

// ============================================================================
// 멀티맵 정의 — 메인 마을(안전) + 야생 스테이지(포탈 이동)
// 셀 = 200m. 맵마다 grid 크기가 다르며 정사각형이 아니어도 된다.
// 스테이지 트리:
//   village ──군 통문──▶ forest / sea / stormhaven / ruins / snowfield / volcano
//   forest    ─▶ cave ─▶ mine,   forest ─▶ swamp
//   sea       ─▶ deepsea,        sea    ─▶ atlantis(안전)
//   stormhaven─▶ sky-temple(천공 신전, 안전)
//   ruins     ─▶ graveyard,      ruins  ─▶ temple-ruin(버려진 신전, 안전)
//   snowfield ─▶ aurora-village(오로라 마을, 안전)
//   volcano   ─▶ demon-village(마물 마을, 안전),  volcano ─▶ demon-castle
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
  'b-pondL': B_('temple_pond', 160, 96, 80, 96),
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
  P.push({ id: 'b-gazebo', kind: 'gazebo', cell: { x: 32.0, y: 10.8 }, size: { w: 1.8, d: 1.8 } })

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
  // 회랑 — 앞광장 좌·우를 짧게 감싸는 콜로네이드 (돔 옆 3칸씩)
  for (let i = 0; i < 4; i++) {
    P.push({ id: `b-cloW${i}`, kind: 'cloister', cell: { x: 3.4, y: 28.6 + i * 0.95 }, size: { w: 0.6, d: 0.85 } })
    P.push({ id: `b-cloE${i}`, kind: 'cloister', cell: { x: 15.6, y: 28.6 + i * 0.95 }, size: { w: 0.6, d: 0.85 } })
  }
  P.push({ id: 'b-priest0', kind: 'cottage', cell: { x: 3.6, y: 35.4 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-priest1', kind: 'cottage', cell: { x: 6.4, y: 36.0 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-priest2', kind: 'cottage', cell: { x: 13.6, y: 35.6 }, size: { w: 1.6, d: 1.4 }, variant: 'slate' })
  P.push({ id: 'b-statue-saint', kind: 'statue', cell: { x: TEMPLE_YARD.x, y: 32.4 }, size: { w: 1.0, d: 1.0 }, label: '성녀 상' })
  // 대성당 앞광장 좌·우 대칭 반사 연못 — PixelLab 프롭(돌 테두리+수련) 로 교체.
  // radial: true → cell 이 중심점. solid: true → 벤치·나무가 실제 footprint 만큼만 피해감.
  P.push({ id: 'b-pondL', kind: 'fountain', cell: { x: 5.7, y: 33.4 }, size: { w: 2.0, d: 1.2 }, radial: true, solid: true })
  P.push({ id: 'b-pondR', kind: 'fountain', cell: { x: 13.3, y: 33.4 }, size: { w: 2.0, d: 1.2 }, radial: true, solid: true })
  // 앞광장 진입부 소형 봉헌 조상 2기
  P.push({ id: 'b-shrineL', kind: 'statue', cell: { x: 7.2, y: 36.4 }, size: { w: 0.8, d: 0.8 } })
  P.push({ id: 'b-shrineR', kind: 'statue', cell: { x: 11.8, y: 36.4 }, size: { w: 0.8, d: 0.8 } })
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
  templeGreen.forEach(([x, y, v], i) => P.push({ id: `tg-t${i}`, kind: 'tree', cell: { x, y }, variant: v }))

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
    [FOUNTAIN.x - 3.4, FOUNTAIN.y - 2.7, 'l'], [FOUNTAIN.x + 3.4, FOUNTAIN.y - 2.7, 'r'],
    [FOUNTAIN.x - 3.4, FOUNTAIN.y + 2.7, 'r'], [FOUNTAIN.x + 3.4, FOUNTAIN.y + 2.7, 'l'],
    [36.2, 22.2, 'l'], [43.5, 22.2, 'r'], [48.0, 22.2, 'l'], // 아케이드(북측은 상가 건물과 겹쳐 전부 남측으로)
    [COLOSSEUM.x - 5.2, COLOSSEUM.y - 3.2, 'r'], [COLOSSEUM.x + 5.2, COLOSSEUM.y + 3.2, 'l'], // 투기장 대각 코너(동서는 대로에 걸림)
  ]
  benchSpots.forEach(([x, y, v], i) => {
    if (!blocked(x, y) && !onRoad(x, y)) P.push({ id: `be${i}`, kind: 'bench', cell: { x, y }, variant: v })
  })

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
  return P
}

const VILLAGE_PROPS = villageProps()
// 블로커 = solid 프롭들의 footprint 에서 자동 생성 → 보이는 벽 = 막히는 벽
const VILLAGE_BLOCKERS = buildBlockers(VILLAGE_PROPS)

// 야생 필드 맵은 라벨 구역을 두지 않고 맵 이름/배경으로 표시한다.
const NO_ZONES: ZoneDef[] = []

// ── 필드(야생) 지역 프롭 세트 ────────────────────────────────────────────────
// world-screen 의 쿼터뷰 경로에서 빌보드 PNG 로 세워 렌더한다(FieldProp).
// kind 는 쿼터뷰 빌보드에서 쓰이지 않으므로 형식상 근사값을 넣는다.
// px = 파일 실제 픽셀, anchor = 파일 좌상단 기준 발밑(그라운드) 오프셋.
type FieldSprite = { sprite: string; px: { w: number; h: number }; anchor: { x: number; y: number }; kind: PropDef['kind'] }
const FIELD_SPRITES = {
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
    coral: { sprite: '/images/map/props/f_sea_coral.png', px: { w: 80, h: 56 }, anchor: { x: 40, y: 52 }, kind: 'bush' },
    rock: { sprite: '/images/map/props/f_sea_rock.png', px: { w: 88, h: 64 }, anchor: { x: 44, y: 59 }, kind: 'bush' },
  },
  graveyard: {
    tombstone: { sprite: '/images/map/props/f_grave_tombstone.png', px: { w: 56, h: 80 }, anchor: { x: 28, y: 74 }, kind: 'bush' },
    deadtree: { sprite: '/images/map/props/f_grave_deadtree.png', px: { w: 96, h: 136 }, anchor: { x: 48, y: 126 }, kind: 'tree' },
    lantern: { sprite: '/images/map/props/f_grave_lantern.png', px: { w: 48, h: 72 }, anchor: { x: 24, y: 66 }, kind: 'lamp' },
  },
  demonCastle: {
    bones: { sprite: '/images/map/props/f_demon_bones.png', px: { w: 80, h: 52 }, anchor: { x: 40, y: 48 }, kind: 'bush' },
    banner: { sprite: '/images/map/props/f_demon_banner.png', px: { w: 56, h: 128 }, anchor: { x: 28, y: 118 }, kind: 'tree' },
    spire: { sprite: '/images/map/props/f_volcano_spire.png', px: { w: 72, h: 144 }, anchor: { x: 36, y: 134 }, kind: 'tree' },
    vent: { sprite: '/images/map/props/f_volcano_vent.png', px: { w: 88, h: 56 }, anchor: { x: 44, y: 50 }, kind: 'bush' },
  },
} as const satisfies Record<string, Record<string, FieldSprite>>

function fprop<B extends keyof typeof FIELD_SPRITES>(
  biome: B,
  key: keyof (typeof FIELD_SPRITES)[B],
  id: string,
  x: number,
  y: number,
): PropDef {
  const s = FIELD_SPRITES[biome][key] as FieldSprite
  return { id, kind: s.kind, cell: { x, y }, sprite: s.sprite, px: s.px, anchor: s.anchor }
}

// ── 야생 스테이지 공통 템플릿 ────────────────────────────────────────────────
// 6개 야생 사냥터(숲·바다·스톰헤이븐·폐허·설원·화산) 전부 같은 12×10 원본 골격
// (스폰 6,8.6 / 마을출구 6,9.4 / 포탈 2,1.6·10,1.6 또는 단일 포탈 6,1.6) 을 공유한다.
// "좁아서 답답하다" 피드백 반영 — 1.5배(18×15)에서 2배(24×20)로 더 넓히고,
// 스폰↔포탈을 잇는 굽이치는 통로(nearRoad)를 깔아 시야가 트이게 한다.
const FIELD_SCALE = 2
const FIELD_W = 12 * FIELD_SCALE
const FIELD_H = 10 * FIELD_SCALE
const FIELD_SPAWN = { x: 6 * FIELD_SCALE, y: 8.6 * FIELD_SCALE }
const FIELD_EXIT = { x: 6 * FIELD_SCALE, y: 9.4 * FIELD_SCALE }
const FIELD_PORTAL_L = { x: 2 * FIELD_SCALE, y: 1.6 * FIELD_SCALE }
const FIELD_PORTAL_R = { x: 10 * FIELD_SCALE, y: 1.6 * FIELD_SCALE }
const FIELD_PORTAL_C = { x: 6 * FIELD_SCALE, y: 1.6 * FIELD_SCALE } // 포탈이 하나뿐인 맵(스톰헤이븐·설원)

/** 스폰→목적지 사이 굽이치는 통로 판정 — 통로 폭 안이면 true (지형 타일/장식 배치 양쪽에 사용) */
function nearRoad(
  x: number,
  y: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  wiggle: number,
): boolean {
  const dy = to.y - from.y
  if (Math.abs(dy) < 0.01) return false
  const t = (y - from.y) / dy
  if (t < -0.08 || t > 1.08) return false
  const baseX = from.x + (to.x - from.x) * t
  const wob = Math.sin(t * Math.PI * 2.4) * wiggle
  return Math.abs(x - (baseX + wob)) < width
}
/** 스폰에서 여러 목적지로 뻗는 통로 중 하나에라도 걸리면 true */
function onFieldRoad(x: number, y: number, targets: { x: number; y: number }[], width = 1.3, wiggle = 1.7): boolean {
  return targets.some((t) => nearRoad(x, y, FIELD_SPAWN, t, width, wiggle))
}

// 에르디아 숲 — 원본 배치를 FIELD_SCALE 만큼 넓히고, 새로 생긴 여백은 scatterProps 로 채운다.
const FOREST_BASE_PROPS: PropDef[] = [
  fprop('forest', 'tree', 'ft1', 1.2, 2.3), fprop('forest', 'tree', 'ft2', 3.6, 1.1), fprop('forest', 'tree', 'ft3', 8.0, 1.0),
  fprop('forest', 'tree', 'ft4', 11.0, 2.6), fprop('forest', 'tree', 'ft5', 0.8, 5.6), fprop('forest', 'tree', 'ft6', 11.2, 6.2),
  fprop('forest', 'tree', 'ft7', 2.0, 8.6), fprop('forest', 'tree', 'ft8', 9.7, 8.8), fprop('forest', 'tree', 'ft9', 6.2, 0.7),
  fprop('forest', 'bush', 'fb1', 4.4, 3.2), fprop('forest', 'bush', 'fb2', 8.6, 4.0), fprop('forest', 'bush', 'fb3', 2.7, 6.7),
  fprop('forest', 'bush', 'fb4', 10.2, 4.7),
  fprop('forest', 'rock', 'fr1', 7.4, 2.6), fprop('forest', 'rock', 'fr2', 3.0, 4.6),
  fprop('forest', 'log', 'fl1', 5.6, 5.2), fprop('forest', 'log', 'fl2', 8.8, 6.8),
  fprop('forest', 'mushroom', 'fm1', 4.8, 6.3), fprop('forest', 'mushroom', 'fm2', 6.9, 4.1), fprop('forest', 'mushroom', 'fm3', 9.4, 2.2),
  fprop('forest', 'firefly', 'ff1', 3.9, 7.7), fprop('forest', 'firefly', 'ff2', 7.7, 7.6),
]
const FOREST_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_L.x, y: FIELD_PORTAL_L.y, r: 2.0 },
  { x: FIELD_PORTAL_R.x, y: FIELD_PORTAL_R.y, r: 2.0 },
]
const forestOnRoad = (x: number, y: number) => onFieldRoad(x, y, [FIELD_PORTAL_L, FIELD_PORTAL_R], 1.5, 2.0)
const FOREST_PROPS: PropDef[] = [
  ...scaleProps(FOREST_BASE_PROPS, FIELD_SCALE).filter((p) => !forestOnRoad(p.cell.x, p.cell.y)),
  ...scatterProps(
    'forest',
    ['tree', 'bush', 'bush', 'rock', 'mushroom', 'log', 'firefly'],
    30,
    FIELD_W,
    FIELD_H,
    FOREST_AVOID,
    7301,
    'ftx',
    forestOnRoad,
  ),
]

/** 에르디아 숲 지면 — 스폰↔포탈 굽이치는 오솔길(우선) + 완만한 개울 + 잔디 얼룩 */
function forestTileAt(x: number, y: number): TileKind {
  if (forestOnRoad(x, y)) return 'dirt'
  const streamY = FIELD_H * 0.5 + Math.sin(x * 0.24) * 2.6
  if (Math.abs(y - streamY) < 0.7) return 'water'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 3 ? 'grass-dark' : 'grass'
}

// 화산지대 — forest 와 동일한 원리로 넓히고, 스폰↔포탈 길은 맨 ash 로 정리해 걸어다니기 편하게.
const VOLCANO_BASE_PROPS: PropDef[] = [
  fprop('volcano', 'spire', 'vt1', 1.2, 2.3), fprop('volcano', 'spire', 'vt2', 3.6, 1.1), fprop('volcano', 'spire', 'vt3', 8.0, 1.0),
  fprop('volcano', 'deadtree', 'vt4', 11.0, 2.6), fprop('volcano', 'deadtree', 'vt5', 0.8, 5.6), fprop('volcano', 'deadtree', 'vt6', 11.2, 6.2),
  fprop('volcano', 'deadtree', 'vt7', 2.0, 8.6), fprop('volcano', 'spire', 'vt8', 9.7, 8.8), fprop('volcano', 'spire', 'vt9', 6.2, 0.7),
  fprop('volcano', 'sulfur', 'vb1', 4.4, 3.2), fprop('volcano', 'ashmound', 'vb2', 8.6, 4.0), fprop('volcano', 'sulfur', 'vb3', 2.7, 6.7),
  fprop('volcano', 'ashmound', 'vb4', 10.2, 4.7),
  fprop('volcano', 'rock', 'vr1', 7.4, 2.6), fprop('volcano', 'rock', 'vr2', 3.0, 4.6),
  fprop('volcano', 'rock', 'vl1', 5.6, 5.2), fprop('volcano', 'rock', 'vl2', 8.8, 6.8),
  fprop('volcano', 'vent', 'vm1', 4.8, 6.3), fprop('volcano', 'vent', 'vm2', 6.9, 4.1), fprop('volcano', 'vent', 'vm3', 9.4, 2.2),
  fprop('volcano', 'ashmound', 'vf1', 3.9, 7.7), fprop('volcano', 'sulfur', 'vf2', 7.7, 7.6),
]
const VOLCANO_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_L.x, y: FIELD_PORTAL_L.y, r: 2.0 },
  { x: FIELD_PORTAL_R.x, y: FIELD_PORTAL_R.y, r: 2.0 },
]
const volcanoOnRoad = (x: number, y: number) => onFieldRoad(x, y, [FIELD_PORTAL_L, FIELD_PORTAL_R], 1.5, 2.0)
const VOLCANO_PROPS: PropDef[] = [
  ...scaleProps(VOLCANO_BASE_PROPS, FIELD_SCALE).filter((p) => !volcanoOnRoad(p.cell.x, p.cell.y)),
  ...scatterProps(
    'volcano',
    ['spire', 'deadtree', 'rock', 'vent', 'sulfur', 'ashmound'],
    28,
    FIELD_W,
    FIELD_H,
    VOLCANO_AVOID,
    8302,
    'vtx',
    volcanoOnRoad,
  ),
]

/** 화산지대 지면 — 스폰↔포탈 길은 맨 ash로 정리, 나머지는 흑요석 얼룩 */
function volcanoTileAt(x: number, y: number): TileKind {
  if (volcanoOnRoad(x, y)) return 'path'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 4 ? 'ash' : 'obsidian'
}

// ── 바다 해안 — 위쪽 물결치는 해안선, 아래쪽 모래톱 뒤 사구 잔디 ─────────────
/** 해안선(위=바다) — x에 따라 완만히 굽이침 */
function seaShoreline(x: number): number {
  return FIELD_H * 0.27 + Math.sin(x * 0.22) * 2.4
}
function seaTileAt(x: number, y: number): TileKind {
  if (y < seaShoreline(x)) return 'water'
  if (y > FIELD_H - 5.5 + Math.sin(x * 0.22) * 1.6) {
    const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
    return h < 4 ? 'grass-dark' : 'grass'
  }
  const h = (Math.floor(x) * 5 + Math.floor(y) * 11) % 13
  return h < 2 ? 'dirt' : 'sand'
}
const SEA_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_L.x, y: FIELD_PORTAL_L.y, r: 2.0 },
  { x: FIELD_PORTAL_R.x, y: FIELD_PORTAL_R.y, r: 2.0 },
]
const seaOnRoad = (x: number, y: number) => onFieldRoad(x, y, [FIELD_PORTAL_L, FIELD_PORTAL_R], 1.6, 2.2)
const SEA_PROPS: PropDef[] = scatterProps(
  'sea',
  ['driftwood', 'rock', 'coral', 'dunegrass', 'dunegrass'],
  32,
  FIELD_W,
  FIELD_H,
  SEA_AVOID,
  4102,
  'sex',
  (x, y) => y < seaShoreline(x) + 0.6 || seaOnRoad(x, y), // 물속·바로 물가·통행로엔 세우지 않는다
)

// ── 스톰헤이븐 — 구름바다 위, 폭풍에 부서진 돌길이 스폰→천공 신전 포탈까지 굽이쳐 지나간다
function stormhavenTileAt(x: number, y: number): TileKind {
  if (onFieldRoad(x, y, [FIELD_PORTAL_C], 1.6, 2.6)) return 'path'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 9
  return h === 0 ? 'plaza' : 'cloud'
}
const STORM_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_C.x, y: FIELD_PORTAL_C.y, r: 2.2 },
]
const STORM_PROPS: PropDef[] = scatterProps(
  'stormhaven',
  ['banner', 'stormgrass', 'stormgrass', 'floatrock'],
  28,
  FIELD_W,
  FIELD_H,
  STORM_AVOID,
  5203,
  'stx',
  (x, y) => onFieldRoad(x, y, [FIELD_PORTAL_C], 1.6, 2.6),
)

// ── 버려진 폐허(야생) — 깨진 포석·잡초 침식·보랏빛 크리스탈, 포탈까지 넓은 포석 길 ──
const ruinsOnRoad = (x: number, y: number) => onFieldRoad(x, y, [FIELD_PORTAL_L, FIELD_PORTAL_R], 1.6, 2.0)
function ruinsFieldTileAt(x: number, y: number): TileKind {
  if (ruinsOnRoad(x, y)) return 'plaza'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 13
  if (h < 3) return 'plaza'
  if (h < 5) return 'dirt'
  return 'ash'
}
const RUINSF_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_L.x, y: FIELD_PORTAL_L.y, r: 2.0 },
  { x: FIELD_PORTAL_R.x, y: FIELD_PORTAL_R.y, r: 2.0 },
]
const RUINSF_PROPS: PropDef[] = scatterProps(
  'ruinsField',
  ['pillar', 'rubble', 'crystal', 'vine', 'vine'],
  30,
  FIELD_W,
  FIELD_H,
  RUINSF_AVOID,
  6304,
  'rfx',
  ruinsOnRoad,
)

// ── 루미나 설원 — 얼어붙은 연못 두 곳 + 다져진 눈길이 포탈까지 이어진다 ────────
const SNOWF_POND1 = { x: FIELD_W * 0.28, y: FIELD_H * 0.58, r: 2.8 }
const SNOWF_POND2 = { x: FIELD_W * 0.7, y: FIELD_H * 0.32, r: 2.2 }
const snowfOnRoad = (x: number, y: number) => onFieldRoad(x, y, [FIELD_PORTAL_C], 1.6, 2.6)
function snowfieldTileAt(x: number, y: number): TileKind {
  if (snowfOnRoad(x, y)) return 'path'
  if (Math.hypot(x - SNOWF_POND1.x, y - SNOWF_POND1.y) < SNOWF_POND1.r) return 'ice'
  if (Math.hypot(x - SNOWF_POND2.x, y - SNOWF_POND2.y) < SNOWF_POND2.r) return 'ice'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 2 ? 'path' : 'snow'
}
const SNOWF_AVOID = [
  { x: FIELD_SPAWN.x, y: FIELD_SPAWN.y, r: 2.2 },
  { x: FIELD_EXIT.x, y: FIELD_EXIT.y, r: 1.8 },
  { x: FIELD_PORTAL_C.x, y: FIELD_PORTAL_C.y, r: 2.2 },
  { x: SNOWF_POND1.x, y: SNOWF_POND1.y, r: SNOWF_POND1.r + 0.4 },
  { x: SNOWF_POND2.x, y: SNOWF_POND2.y, r: SNOWF_POND2.r + 0.4 },
]
const SNOWF_PROPS: PropDef[] = scatterProps(
  'snowfield',
  ['pine', 'frostrock', 'icicle', 'snowmound'],
  30,
  FIELD_W,
  FIELD_H,
  SNOWF_AVOID,
  7405,
  'sfx',
  snowfOnRoad,
)

// ── 2차 던전(서브 스테이지) 공통 템플릿 — 여태 구 렌더러(반복 텍스처)로 남아있던
// 이끼 동굴·폐광산·안개 늪지·심해·버려진 묘지·모르스의 성을 같은 iso 방식으로 구현.
// 원본 10×8(늪지만 10×10) 골격을 1.8배 넓히고, 스폰 근처는 넉넉히 비워 답답하지 않게 한다.
const SUB_W = 18
const SUB_H = 14
const SUB_SPAWN = { x: 9, y: 11.6 }
const SUB_EXIT = { x: 9, y: 12.9 }
const CAVE_FORWARD = { x: 3.6, y: 2.5 } // 폐광산 갱도 입구

// 이끼 동굴 — 스폰에서 폐광산 입구까지 다져진 길이 이어진다.
function caveTileAt(x: number, y: number): TileKind {
  if (nearRoad(x, y, SUB_SPAWN, CAVE_FORWARD, 1.4, 1.6)) return 'dirt'
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 3 ? 'dirt' : 'cave'
}
const CAVE_AVOID = [
  { x: SUB_SPAWN.x, y: SUB_SPAWN.y, r: 2.0 },
  { x: SUB_EXIT.x, y: SUB_EXIT.y, r: 1.6 },
  { x: CAVE_FORWARD.x, y: CAVE_FORWARD.y, r: 1.8 },
]
const CAVE_PROPS: PropDef[] = scatterProps(
  'cave',
  ['stalagmite', 'crystal', 'mushroom', 'rock'],
  18,
  SUB_W,
  SUB_H,
  CAVE_AVOID,
  9101,
  'cvx',
  (x, y) => nearRoad(x, y, SUB_SPAWN, CAVE_FORWARD, 1.4, 1.6),
)

// 폐광산 — 막다른 갱도. 광맥·갱목·수레를 산개.
function mineTileAt(x: number, y: number): TileKind {
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 3 ? 'dirt' : 'mine'
}
const MINE_AVOID = [
  { x: SUB_SPAWN.x, y: SUB_SPAWN.y, r: 2.2 },
  { x: SUB_EXIT.x, y: SUB_EXIT.y, r: 1.8 },
]
const MINE_PROPS: PropDef[] = scatterProps('mine', ['orevein', 'beam', 'cart', 'rock'], 18, SUB_W, SUB_H, MINE_AVOID, 9202, 'mnx')

// 안개 늪지 — 막다른 늪. 웅덩이 사이 갈대·맹그로브·수련.
const SWAMP_W = 18
const SWAMP_H = 18
const SWAMP_SPAWN = { x: 9, y: 15.5 }
const SWAMP_EXIT = { x: 9, y: 16.9 }
function swampTileAt(x: number, y: number): TileKind {
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 9
  if (h === 0) return 'water'
  return h < 4 ? 'dirt' : 'swamp'
}
const SWAMP_AVOID = [
  { x: SWAMP_SPAWN.x, y: SWAMP_SPAWN.y, r: 2.2 },
  { x: SWAMP_EXIT.x, y: SWAMP_EXIT.y, r: 1.8 },
]
const SWAMP_PROPS: PropDef[] = scatterProps('swamp', ['reed', 'reed', 'mangrove', 'lilypad'], 22, SWAMP_W, SWAMP_H, SWAMP_AVOID, 9303, 'swx')

// 심해 — 막다른 해저. 수초·난파선 잔해, 바다 프롭 재사용.
function deepseaTileAt(x: number, y: number): TileKind {
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 13
  return h < 3 ? 'sand' : 'water'
}
const DEEPSEA_AVOID = [
  { x: SUB_SPAWN.x, y: SUB_SPAWN.y, r: 2.2 },
  { x: SUB_EXIT.x, y: SUB_EXIT.y, r: 1.8 },
]
const DEEPSEA_PROPS: PropDef[] = scatterProps('deepsea', ['kelp', 'kelp', 'wreck', 'coral', 'rock'], 18, SUB_W, SUB_H, DEEPSEA_AVOID, 9404, 'dsx')

// 버려진 묘지 — 막다른 묘역. 비석·고사목·도깨비불.
function graveyardTileAt(x: number, y: number): TileKind {
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 3 ? 'dirt' : 'ash'
}
const GRAVEYARD_AVOID = [
  { x: SUB_SPAWN.x, y: SUB_SPAWN.y, r: 2.2 },
  { x: SUB_EXIT.x, y: SUB_EXIT.y, r: 1.8 },
]
const GRAVEYARD_PROPS: PropDef[] = scatterProps(
  'graveyard',
  ['tombstone', 'tombstone', 'deadtree', 'lantern'],
  20,
  SUB_W,
  SUB_H,
  GRAVEYARD_AVOID,
  9505,
  'grx',
)

// 모르스의 성 — 최종 던전 입구. 흑요석 바닥에 뼈무더기·마물 깃발, 화산 프롭 재사용.
function demonCastleTileAt(x: number, y: number): TileKind {
  const h = (Math.floor(x) * 7 + Math.floor(y) * 13) % 11
  return h < 4 ? 'ash' : 'obsidian'
}
const DEMONCASTLE_AVOID = [
  { x: SUB_SPAWN.x, y: SUB_SPAWN.y, r: 2.2 },
  { x: SUB_EXIT.x, y: SUB_EXIT.y, r: 1.8 },
]
const DEMONCASTLE_PROPS: PropDef[] = scatterProps(
  'demonCastle',
  ['bones', 'banner', 'spire', 'vent'],
  18,
  SUB_W,
  SUB_H,
  DEMONCASTLE_AVOID,
  9606,
  'dcx',
)

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

// 마법학교 본관 대강당(신규) — 아직 세부 장식 없는 뼈대만(다음 패스에서 채움)
const schoolHallTileAt = (): TileKind => 'plaza'
// school 벽판은 원래부터 스테인드글라스가 그려져 있어 별도 창문은 넣지 않고 문만 추가
const SCHOOL_HALL_PROPS: PropDef[] = [
  ...buildGrandHallWalls(GRAND_WALL_SCHOOL, 3.2, undefined, GRAND_DOOR_SCHOOL),
  // 세부 장식 — 마을에서 쓰는 동상(기존 에셋)을 중앙에, 램프는 SVG 폴백(양옆)
  { id: 'schoolhall-statue', kind: 'statue', cell: { x: GRAND_CX, y: 18 }, sprite: '/images/map/props/b_statue.png', px: { w: 86, h: 156 }, size: { w: 0.5, d: 0.5 } },
  { id: 'schoolhall-lamp-w', kind: 'lamp', cell: { x: GRAND_CX - 6, y: 8 }, size: { w: 0.2, d: 0.2 } },
  { id: 'schoolhall-lamp-e', kind: 'lamp', cell: { x: GRAND_CX + 6, y: 8 }, size: { w: 0.2, d: 0.2 } },
]
const SCHOOL_HALL_BLOCKERS = buildBlockers(SCHOOL_HALL_PROPS, roomBlockers(GRAND_ROOM_W, GRAND_ROOM_H, GRAND_DOOR_W))

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

export const MAPS: Record<MapId, GameMap> = {
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
      { id: 'gate-sea', cell: { x: 43.5, y: 36.6 }, to: 'sea', label: '바다', kind: 'gate', requiredLevel: 3 },
      { id: 'gate-stormhaven', cell: { x: 43.5, y: 36.6 }, to: 'stormhaven', label: '스톰헤이븐', kind: 'gate', requiredLevel: 7 },
      { id: 'gate-ruins', cell: { x: 43.5, y: 36.6 }, to: 'ruins', label: '버려진 폐허', kind: 'gate', requiredLevel: 10 },
      { id: 'gate-snowfield', cell: { x: 43.5, y: 36.6 }, to: 'snowfield', label: '루미나 설원', kind: 'gate', requiredLevel: 15 },
      { id: 'gate-volcano', cell: { x: 43.5, y: 36.6 }, to: 'volcano', label: '화산지대', kind: 'gate', requiredLevel: 20 },
      { id: 'personal-space-enter', cell: { x: 42, y: 5 }, to: 'personal-space', label: '내 개인 공간', kind: 'portal' },
      { id: 'school-hall-enter', cell: { x: 6.9, y: 6.5 }, to: 'school-hall', label: '본관 대강당', kind: 'portal' },
    ],
  },

  // ── 숲 계열 ───────────────────────────────────────────────────────────────
  forest: {
    id: 'forest',
    name: '에르디아 숲',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'forest',
    render: 'iso',
    assets: 'raster',
    tileAt: forestTileAt,
    props: FOREST_PROPS,
    blockers: buildBlockers(FOREST_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'forest',
    // 권장레벨(2) ±5 범위로 제한 + 1레벨 잡몹 비중 확대(나무골렘 lv8은 범위 밖이라 제외, cave/swamp에서 담당)
    monsterPool: ['mon-field-mouse', 'mon-glow-moth', 'mon-field-mouse', 'mon-glow-moth', 'mon-forest-raccoon', 'mon-thorn-vine', 'mon-sprite-green', 'mon-grey-wolf', 'mon-mush-cap'],
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    bossSpawns: [{ monsterId: 'mon-thorn-matriarch', cell: { x: 12, y: 13 } }],
    recommendedLevel: 2,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'forest-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'forest-cave', cell: { ...FIELD_PORTAL_L }, to: 'cave', label: '동굴 입구', kind: 'portal' },
      { id: 'forest-swamp', cell: { ...FIELD_PORTAL_R }, to: 'swamp', label: '안개 늪지', kind: 'portal', requiredLevel: 5 },
    ],
  },
  cave: {
    id: 'cave',
    name: '이끼 동굴',
    kind: 'field',
    grid: { w: SUB_W, h: SUB_H },
    bg: 'cave',
    render: 'iso',
    assets: 'raster',
    tileAt: caveTileAt,
    props: CAVE_PROPS,
    blockers: buildBlockers(CAVE_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'forest',
    monsterDensity: 0.12,
    monsterSpacing: 1.5,
    recommendedLevel: 6,
    spawn: { ...SUB_SPAWN },
    portals: [
      { id: 'cave-exit', cell: { ...SUB_EXIT }, to: 'forest', toSpawn: { x: 4, y: 5.2 }, label: '숲으로', kind: 'exit' },
      { id: 'cave-mine', cell: { ...CAVE_FORWARD }, to: 'mine', label: '폐광산 갱도', kind: 'portal', requiredLevel: 10 },
    ],
  },
  mine: {
    id: 'mine',
    name: '폐광산',
    kind: 'field',
    grid: { w: SUB_W, h: SUB_H },
    bg: 'mine',
    render: 'iso',
    assets: 'raster',
    tileAt: mineTileAt,
    props: MINE_PROPS,
    blockers: buildBlockers(MINE_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(10) ±5 범위로 제한
    monsterPool: ['mon-ember-imp', 'mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor'],
    monsterDensity: 0.12,
    monsterSpacing: 1.5,
    recommendedLevel: 10,
    spawn: { ...SUB_SPAWN },
    portals: [
      { id: 'mine-exit', cell: { ...SUB_EXIT }, to: 'cave', toSpawn: { x: 3.6, y: 4.3 }, label: '동굴로', kind: 'exit' },
    ],
  },
  swamp: {
    id: 'swamp',
    name: '안개 늪지',
    kind: 'field',
    grid: { w: SWAMP_W, h: SWAMP_H },
    bg: 'swamp',
    render: 'iso',
    assets: 'raster',
    tileAt: swampTileAt,
    props: SWAMP_PROPS,
    blockers: buildBlockers(SWAMP_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'forest',
    monsterDensity: 0.11,
    monsterSpacing: 1.5,
    bossSpawns: [{ monsterId: 'mon-ancient-bark-golem', cell: { x: 9, y: 5 } }],
    recommendedLevel: 5,
    spawn: { ...SWAMP_SPAWN },
    portals: [
      { id: 'swamp-exit', cell: { ...SWAMP_EXIT }, to: 'forest', toSpawn: { x: 20, y: 5.2 }, label: '숲으로', kind: 'exit' },
    ],
  },

  // ── 바다 계열 (바다 해안 ─▶ 심해 / 아틀란티스 마을[안전]) ──────────────────
  sea: {
    id: 'sea',
    name: '바다 해안',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'sea',
    render: 'iso',
    assets: 'raster',
    tileAt: seaTileAt,
    props: SEA_PROPS,
    blockers: buildBlockers(SEA_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'sea',
    // 권장레벨(3) ±5 범위로 제한 — 암초거북(lv9)·밀물정령(lv11)은 범위 밖이라 심해에서 담당
    monsterPool: ['mon-bubble-spirit', 'mon-crab-soldier', 'mon-shallows-eel', 'mon-siren-larva'],
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    bossSpawns: [{ monsterId: 'mon-jelly-queen', cell: { x: 12, y: 13 } }],
    recommendedLevel: 3,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'sea-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'sea-deepsea', cell: { ...FIELD_PORTAL_L }, to: 'deepsea', label: '심해로', kind: 'portal', requiredLevel: 9 },
      { id: 'sea-atlantis', cell: { ...FIELD_PORTAL_R }, to: 'atlantis', label: '아틀란티스 마을', kind: 'portal' },
    ],
  },
  deepsea: {
    id: 'deepsea',
    name: '심해',
    kind: 'field',
    grid: { w: SUB_W, h: SUB_H },
    bg: 'deepsea',
    render: 'iso',
    assets: 'raster',
    tileAt: deepseaTileAt,
    props: DEEPSEA_PROPS,
    blockers: buildBlockers(DEEPSEA_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'sea',
    monsterDensity: 0.12,
    monsterSpacing: 1.5,
    bossSpawns: [{ monsterId: 'mon-reef-king', cell: { x: 9, y: 4 } }],
    recommendedLevel: 9,
    spawn: { ...SUB_SPAWN },
    portals: [
      { id: 'deepsea-exit', cell: { ...SUB_EXIT }, to: 'sea', toSpawn: { x: 4, y: 5.2 }, label: '해안으로', kind: 'exit' },
    ],
  },
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
      { id: 'atlantis-exit', cell: { x: ACX, y: ENTRANCE_CY + 0.5 }, to: 'sea', toSpawn: { x: 20, y: 5.2 }, label: '해안으로', kind: 'exit' },
      { id: 'atlantis-temple-enter', cell: { x: 26, y: 9 }, to: 'atlantis-temple', label: '대성당 내부', kind: 'portal' },
    ],
  },

  // ── 스톰헤이븐 계열 (스톰헤이븐 ─▶ 천공 신전[안전]) ────────────────────────
  stormhaven: {
    id: 'stormhaven',
    name: '스톰헤이븐',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'sky',
    render: 'iso',
    assets: 'raster',
    tileAt: stormhavenTileAt,
    props: STORM_PROPS,
    blockers: buildBlockers(STORM_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'sea',
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    recommendedLevel: 7,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'stormhaven-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'stormhaven-sky-temple', cell: { ...FIELD_PORTAL_C }, to: 'sky-temple', label: '천공 신전', kind: 'portal', requiredLevel: 9 },
    ],
  },
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
      { id: 'sky-temple-exit', cell: { x: SKY_CX, y: SKY_ENTRANCE_CY + 0.5 }, to: 'stormhaven', toSpawn: { x: 12, y: 5.2 }, label: '스톰헤이븐으로', kind: 'exit' },
      { id: 'sky-sanctum-enter', cell: { x: 32, y: 10 }, to: 'sky-sanctum', label: '천공 대신전 내부', kind: 'portal' },
    ],
  },

  // ── 버려진 폐허 계열 (버려진 폐허 ─▶ 버려진 묘지 / 버려진 신전[안전]) ─────
  ruins: {
    id: 'ruins',
    name: '버려진 폐허',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'ruins',
    render: 'iso',
    assets: 'raster',
    tileAt: ruinsFieldTileAt,
    props: RUINSF_PROPS,
    blockers: buildBlockers(RUINSF_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(10) ±5 범위로 제한
    monsterPool: ['mon-ember-imp', 'mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor'],
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    bossSpawns: [{ monsterId: 'mon-stone-titan', cell: { x: 12, y: 13 } }],
    recommendedLevel: 10,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'ruins-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'ruins-graveyard', cell: { ...FIELD_PORTAL_L }, to: 'graveyard', label: '버려진 묘지', kind: 'portal', requiredLevel: 13 },
      { id: 'ruins-temple', cell: { ...FIELD_PORTAL_R }, to: 'temple-ruin', label: '버려진 신전', kind: 'portal', requiredLevel: 18 },
    ],
  },
  graveyard: {
    id: 'graveyard',
    name: '버려진 묘지',
    kind: 'field',
    grid: { w: SUB_W, h: SUB_H },
    bg: 'graveyard',
    render: 'iso',
    assets: 'raster',
    tileAt: graveyardTileAt,
    props: GRAVEYARD_PROPS,
    blockers: buildBlockers(GRAVEYARD_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(13) ±5 범위로 제한
    monsterPool: ['mon-ember-imp', 'mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor', 'mon-wraith', 'mon-dark-acolyte'],
    monsterDensity: 0.12,
    monsterSpacing: 1.5,
    bossSpawns: [{ monsterId: 'mon-stone-titan-king', cell: { x: 9, y: 4 } }],
    recommendedLevel: 13,
    spawn: { ...SUB_SPAWN },
    portals: [
      { id: 'graveyard-exit', cell: { ...SUB_EXIT }, to: 'ruins', toSpawn: { x: 4, y: 5.2 }, label: '폐허로', kind: 'exit' },
    ],
  },
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
      { id: 'temple-ruin-exit', cell: { x: RUIN_CX, y: RUIN_ENTRANCE_CY + 0.5 }, to: 'ruins', toSpawn: { x: 20, y: 5.2 }, label: '폐허로', kind: 'exit' },
      { id: 'ruin-sanctum-enter', cell: { x: 32, y: 10 }, to: 'ruin-sanctum', label: '신전 내부', kind: 'portal' },
    ],
  },

  // ── 루미나 설원 계열 (루미나 설원 ─▶ 오로라 마을[안전]) ────────────────────
  snowfield: {
    id: 'snowfield',
    name: '루미나 설원',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'snow',
    render: 'iso',
    assets: 'raster',
    tileAt: snowfieldTileAt,
    props: SNOWF_PROPS,
    blockers: buildBlockers(SNOWF_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(15) ±5 범위로 제한
    monsterPool: ['mon-ember-imp', 'mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor', 'mon-wraith', 'mon-dark-acolyte', 'mon-flame-warden'],
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    recommendedLevel: 15,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'snowfield-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'snowfield-aurora', cell: { ...FIELD_PORTAL_C }, to: 'aurora-village', label: '오로라 마을', kind: 'portal', requiredLevel: 16 },
    ],
  },
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
      { id: 'aurora-exit', cell: { x: AUR_CX, y: AUR_ENTRANCE_CY + 0.5 }, to: 'snowfield', toSpawn: { x: 12, y: 5.2 }, label: '설원으로', kind: 'exit' },
      { id: 'aurora-sanctum-enter', cell: { x: 32, y: 10 }, to: 'aurora-sanctum', label: '설원 성소 내부', kind: 'portal' },
    ],
  },

  // ── 화산 계열 ─────────────────────────────────────────────────────────────
  volcano: {
    id: 'volcano',
    name: '화산지대',
    kind: 'field',
    grid: { w: FIELD_W, h: FIELD_H },
    bg: 'volcano',
    render: 'iso',
    assets: 'raster',
    tileAt: volcanoTileAt,
    props: VOLCANO_PROPS,
    blockers: buildBlockers(VOLCANO_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(20) ±5 범위로 제한
    monsterPool: ['mon-cursed-armor', 'mon-wraith', 'mon-dark-acolyte', 'mon-flame-warden', 'mon-frost-revenant', 'mon-dark-mage'],
    monsterDensity: 0.1,
    monsterSpacing: 1.7,
    recommendedLevel: 20,
    spawn: { ...FIELD_SPAWN },
    portals: [
      { id: 'volcano-exit', cell: { ...FIELD_EXIT }, to: 'village', toSpawn: { x: 43.5, y: 35.4 }, label: '마을로 돌아가기', kind: 'exit' },
      { id: 'volcano-demon-village', cell: { ...FIELD_PORTAL_L }, to: 'demon-village', label: '마물 마을', kind: 'portal', requiredLevel: 25 },
      { id: 'volcano-demon-castle', cell: { ...FIELD_PORTAL_R }, to: 'demon-castle', label: '모르스의 성', kind: 'portal', requiredLevel: 32 },
    ],
  },
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
      { id: 'demon-village-exit', cell: { x: DEMON_CX, y: DEMON_ENTRANCE_CY + 0.5 }, to: 'volcano', toSpawn: { x: 4, y: 5.2 }, label: '화산지대로', kind: 'exit' },
      { id: 'demon-temple-enter', cell: { x: 32, y: 10 }, to: 'demon-temple', label: '화산 성채 내부', kind: 'portal' },
    ],
  },
  'demon-castle': {
    id: 'demon-castle',
    name: '모르스의 성',
    kind: 'field',
    grid: { w: SUB_W, h: SUB_H },
    bg: 'demon',
    render: 'iso',
    assets: 'raster',
    tileAt: demonCastleTileAt,
    props: DEMONCASTLE_PROPS,
    blockers: buildBlockers(DEMONCASTLE_PROPS),
    zones: NO_ZONES,
    monsterZoneKind: 'ruins',
    // 권장레벨(32) ±5 범위로 제한 — 이 레벨대는 모르스의 전령(lv32) 하나뿐
    monsterPool: ['mon-azka-herald'],
    monsterDensity: 0.12,
    monsterSpacing: 1.5,
    recommendedLevel: 32,
    spawn: { ...SUB_SPAWN },
    portals: [
      { id: 'demon-castle-exit', cell: { ...SUB_EXIT }, to: 'volcano', toSpawn: { x: 20, y: 5.2 }, label: '화산지대로', kind: 'exit' },
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
    name: '마법학교 본관 대강당',
    kind: 'town',
    grid: { w: GRAND_ROOM_W, h: GRAND_ROOM_H },
    bg: 'school',
    render: 'iso',
    assets: 'raster',
    tileAt: schoolHallTileAt,
    props: SCHOOL_HALL_PROPS,
    blockers: SCHOOL_HALL_BLOCKERS,
    zones: NO_ZONES,
    spawn: { ...GRAND_ROOM_SPAWN },
    portals: [
      { id: 'school-hall-exit', cell: { ...GRAND_ROOM_EXIT }, to: 'village', toSpawn: { x: 6.9, y: 7.2 }, label: '대강당 밖으로', kind: 'exit' },
    ],
  },
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
