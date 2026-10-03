// ============================================================================
// 아이소메트릭 투영 + 맵 데이터 타입
//  - 게임플레이 좌표는 기존과 동일한 셀(x,y). 렌더만 2:1 다이메트릭으로 투영.
//  - 오브젝트(건물/나무/캐릭터)는 화면 y 기준 깊이정렬 → 뒤 물체는 앞 물체에 가려짐.
// ============================================================================

import type { Facing } from '@/lib/types'

export const ISO_TILE_W = 64
export const ISO_TILE_H = 32 // 2:1

/** 셀 좌표 → 아이소 화면 좌표(px). 원점은 격자 (0,0) 타일의 위쪽 꼭짓점. */
export function isoToScreen(cx: number, cy: number): { sx: number; sy: number } {
  return {
    sx: (cx - cy) * (ISO_TILE_W / 2),
    sy: (cx + cy) * (ISO_TILE_H / 2),
  }
}

/** 화면 기준 8방향(오른쪽부터 시계방향, 화면 y는 아래로) */
const FACING_OCTANTS: Facing[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']

/** 셀 공간 이동량 → 화면에 보이는 진행 방향(8방향). 이동이 없으면 null */
export function facingFromCellDelta(dx: number, dy: number): Facing | null {
  if (!dx && !dy) return null
  const sx = (dx - dy) * (ISO_TILE_W / 2)
  const sy = (dx + dy) * (ISO_TILE_H / 2)
  const oct = Math.round(Math.atan2(sy, sx) / (Math.PI / 4))
  return FACING_OCTANTS[((oct % 8) + 8) % 8]
}

/** 화면 8방향 → 셀 공간 단위 벡터(바라보는 칸 앞 계산용) */
export const FACING_CELL_VEC: Record<Facing, { x: number; y: number }> = {
  'down-left': { x: 0, y: 1 },
  'up-right': { x: 0, y: -1 },
  'up-left': { x: -1, y: 0 },
  'down-right': { x: 1, y: 0 },
  down: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  up: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  left: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  right: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
}

/** 격자 크기 → 아이소 평면의 화면 바운딩 박스 */
export function isoBounds(w: number, h: number) {
  const minSx = (0 - (h - 1)) * (ISO_TILE_W / 2)
  const maxSx = (w - 1 - 0) * (ISO_TILE_W / 2) + ISO_TILE_W
  const minSy = 0
  const maxSy = (w - 1 + (h - 1)) * (ISO_TILE_H / 2) + ISO_TILE_H
  return { minSx, maxSx, minSy, maxSy, width: maxSx - minSx, height: maxSy - minSy }
}

// ─────────────────────────────────────────────────────────────────────────────
// 지면 타일
// ─────────────────────────────────────────────────────────────────────────────
export type TileKind =
  | 'grass'
  | 'grass-dark'
  | 'path'
  | 'plaza'
  | 'sand'
  | 'field'
  | 'water'
  | 'dirt'
  | 'cloud' // 천공 신전 — 흰 구름 바닥
  | 'ash' // 버려진 신전 — 어두운 폐허 바닥
  | 'ice' // 오로라 마을 — 밝은 남색 얼음 바닥
  | 'obsidian' // 마물 마을 — 붉은 화산암 바닥
  | 'snow' // 루미나 설원 — 순백 눈밭
  | 'cave' // 이끼 동굴 — 축축한 암반 + 이끼
  | 'mine' // 폐광산 — 암반+갱목 바닥
  | 'swamp' // 안개 늪지 — 진흙+웅덩이
  | 'sky-marble' // 천공 신전(하늘 도시) — 크림 대리석 슬랩(평면 타일)
  | 'sky-road' // 천공 신전 — 하늘빛 포석 길(평면 타일)
  | 'sky-cloud' // 천공 신전 — 섬 바깥 솜구름(평면 타일)
  | 'ruin-stone' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'ruin-road' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'ruin-moss' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'ruin-mist' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'aurora-stone' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'aurora-road' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'aurora-snow' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'aurora-mist' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'demon-stone' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'demon-road' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'demon-ash' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'demon-lava' // 마을 테마 평면 타일 (scripts/gen-town-tiles.mjs)
  | 'personal-wood' // 내 개인 공간 — 픽셀랩 생성 + plaza 마스크로 정합(scripts/mask-fit-tile.mjs)
  | 'personal-rug' // 내 개인 공간 — 중앙 러그, 픽셀랩 생성 + plaza 마스크로 정합(scripts/mask-fit-tile.mjs)
  | 'atlantis-cathedral' // 아틀란티스 대성당 내부 — 픽셀랩 생성 + plaza 마스크로 정합(scripts/mask-fit-tile.mjs)
  | 'academy-marble' // 마법학교 중앙 홀 — 베이지 석판 (scripts/gen-academy-tiles.mjs)
  | 'academy-fire' // 화염 수업관 바닥
  | 'academy-ice' // 빙결 수업관 바닥
  | 'academy-earth' // 대지 수업관(온실) 바닥
  | 'academy-carpet' // 대강당 남색 카펫
  | 'academy-dark' // 어둠 수업관·연구실 바닥
  | 'academy-light' // 빛 수업관·연구실 바닥
  | 'dorm-plank' // 개인 공간 짙은 널빤지 (scripts/gen-academy-tiles.mjs)
  | 'academy-void' // 2층 아트리움(뚫린 곳) — 타일 없이 어둡게, 아래층 구조물이 비쳐 보인다

/**
 * 라스터 모드에서 지면 타일 PNG 경로 (다이메트릭 2:1, 폭 = ISO_TILE_W 배수).
 * 비어있으면 iso-world 가 TILE_COLORS 폴리곤으로 폴백.
 */
export const TILE_SPRITES: Partial<Record<TileKind, string>> = {
  grass: '/images/map/tiles/grass.png',
  'grass-dark': '/images/map/tiles/grass-dark.png',
  path: '/images/map/tiles/path.png',
  plaza: '/images/map/tiles/plaza.png',
  sand: '/images/map/tiles/sand.png',
  field: '/images/map/tiles/field.png',
  water: '/images/map/tiles/water.png',
  dirt: '/images/map/tiles/dirt.png',
  snow: '/images/map/tiles/snow.png',
  ice: '/images/map/tiles/ice.png',
  ash: '/images/map/tiles/ash.png',
  obsidian: '/images/map/tiles/obsidian.png',
  cloud: '/images/map/tiles/cloud.png',
  cave: '/images/map/tiles/cave.png',
  mine: '/images/map/tiles/mine.png',
  swamp: '/images/map/tiles/swamp.png',
  'sky-marble': '/images/map/tiles/sky-marble.png',
  'sky-road': '/images/map/tiles/sky-road.png',
  'sky-cloud': '/images/map/tiles/sky-cloud.png',
  'ruin-stone': '/images/map/tiles/ruin-stone.png',
  'ruin-road': '/images/map/tiles/ruin-road.png',
  'ruin-moss': '/images/map/tiles/ruin-moss.png',
  'ruin-mist': '/images/map/tiles/ruin-mist.png',
  'aurora-stone': '/images/map/tiles/aurora-stone.png',
  'aurora-road': '/images/map/tiles/aurora-road.png',
  'aurora-snow': '/images/map/tiles/aurora-snow.png',
  'aurora-mist': '/images/map/tiles/aurora-mist.png',
  'demon-stone': '/images/map/tiles/demon-stone.png',
  'demon-road': '/images/map/tiles/demon-road.png',
  'demon-ash': '/images/map/tiles/demon-ash.png',
  'demon-lava': '/images/map/tiles/demon-lava.png',
  'personal-wood': '/images/map/tiles/personal-wood.png',
  'personal-rug': '/images/map/tiles/personal-rug.png',
  'atlantis-cathedral': '/images/map/tiles/atlantis-cathedral.png',
  'academy-marble': '/images/map/tiles/academy-marble.png',
  'academy-fire': '/images/map/tiles/academy-fire.png',
  'academy-ice': '/images/map/tiles/academy-ice.png',
  'academy-earth': '/images/map/tiles/academy-earth.png',
  'academy-carpet': '/images/map/tiles/academy-carpet.png',
  'academy-dark': '/images/map/tiles/academy-dark.png',
  'academy-light': '/images/map/tiles/academy-light.png',
  'dorm-plank': '/images/map/tiles/dorm-plank.png',
}

/** 타일별 상/좌/우 면 색 (좌·우는 살짝 어둡게 해 미세 입체) */
export const TILE_COLORS: Record<TileKind, { top: string; edge: string }> = {
  grass: { top: '#7cb45b', edge: '#6aa24c' },
  'grass-dark': { top: '#6fa851', edge: '#5f9445' },
  path: { top: '#cdb58c', edge: '#b89f76' }, // 따뜻한 조약돌
  plaza: { top: '#dccbaa', edge: '#c3b088' },
  sand: { top: '#e0c68e', edge: '#c6a869' },
  field: { top: '#b0864a', edge: '#8c6633' },
  water: { top: '#6fc3dc', edge: '#4aa3c0' },
  dirt: { top: '#a48963', edge: '#836a47' },
  cloud: { top: '#f2eee0', edge: '#ddd6c0' },
  ash: { top: '#4a4550', edge: '#332f38' },
  ice: { top: '#5f86c4', edge: '#42639e' },
  obsidian: { top: '#6b2a22', edge: '#4a1a15' },
  snow: { top: '#eef3f8', edge: '#d3dfea' },
  cave: { top: '#3a4038', edge: '#272b26' },
  mine: { top: '#4a4038', edge: '#332c26' },
  swamp: { top: '#3f4a34', edge: '#2a3122' },
  'sky-marble': { top: '#f3efe4', edge: '#cfc4a6' },
  'sky-road': { top: '#bccce4', edge: '#7f93b8' },
  'sky-cloud': { top: '#f1f8ff', edge: '#c4d8ee' },
  'ruin-stone': { top: '#6a6577', edge: '#3b3647' },
  'ruin-road': { top: '#4a4560', edge: '#2a2636' },
  'ruin-moss': { top: '#2d4a34', edge: '#14201c' },
  'ruin-mist': { top: '#483f6a', edge: '#26213c' },
  'aurora-stone': { top: '#e3ecf5', edge: '#a7bdd4' },
  'aurora-road': { top: '#bdd2dc', edge: '#7f9cae' },
  'aurora-snow': { top: '#f2f8fd', edge: '#c3d6e8' },
  'aurora-mist': { top: '#dcf3f4', edge: '#a3d0de' },
  'demon-stone': { top: '#3b2b2e', edge: '#150c0e' },
  'demon-road': { top: '#2a1d1f', edge: '#8a3a14' },
  'demon-ash': { top: '#4a4143', edge: '#2b2426' },
  'demon-lava': { top: '#ff6a1a', edge: '#5a1a0a' },
  'personal-wood': { top: '#5a3a2c', edge: '#3a2419' },
  'personal-rug': { top: '#2d4a34', edge: '#1c3022' },
  'atlantis-cathedral': { top: '#1f5c52', edge: '#123a34' },
  'academy-marble': { top: '#d9c9a6', edge: '#a8946e' },
  'academy-fire': { top: '#6b3a2c', edge: '#34180f' },
  'academy-ice': { top: '#bcd6ea', edge: '#7ea3c2' },
  'academy-earth': { top: '#6f7a4c', edge: '#3c4428' },
  'academy-carpet': { top: '#2b407a', edge: '#b89445' },
  'academy-dark': { top: '#2c2238', edge: '#120d18' },
  'academy-light': { top: '#ece4cf', edge: '#c9b98a' },
  'academy-void': { top: '#0d0c12', edge: '#0d0c12' },
  'dorm-plank': { top: '#5a3a26', edge: '#2a1a12' },
}

// ─────────────────────────────────────────────────────────────────────────────
// 오브젝트(프롭) — 건물·구조물·자연물
// ─────────────────────────────────────────────────────────────────────────────
export type PropKind =
  | 'hall' // 학교 건물동 (첨탑 + 아치 스테인드글라스)
  | 'cottage' // 소형 주택
  | 'shop' // 상점 건물
  | 'stall' // 시장 천막 노점
  | 'dome' // 신전 (돔)
  | 'barn' // 헛간
  | 'windmill' // 풍차
  | 'colosseum' // 원형 투기장
  | 'fountain' // 분수
  | 'gate' // 대형 아치 성문
  | 'wall' // 목책/성벽 구간
  | 'tower' // 성벽 망루
  | 'tree' // 나무
  | 'hedge' // 낮은 관목 울타리 (레거시 SVG)
  | 'bush' // 관목 (라스터)
  | 'lamp' // 가로등
  | 'bench' // 벤치
  | 'banner' // 현수막 기둥
  | 'postbox' // 우체통
  | 'bicycle' // 자전거
  | 'trashbin' // 쓰레기통
  | 'statue' // 동상·기념비 (radial)
  | 'gazebo' // 정자
  | 'cloister' // 회랑 (긴 아케이드 복도)

export interface PropDef {
  id: string
  kind: PropKind
  /** 발밑(그라운드) 앵커 셀 좌표 — 깊이정렬·배치 기준 */
  cell: { x: number; y: number }
  /** 격자 상 footprint (셀). 깊이정렬 tie-break, 그림자 크기용 */
  size?: { w: number; d: number }
  /** 픽셀 높이 힌트 (없으면 kind 기본값) */
  height?: number
  /** 색 변주(주택 지붕색 등) / 방향 */
  variant?: string
  facing?: 'left' | 'right'
  /** 쿼터뷰 바닥선에 맞춰 벽면을 기울이는 각도(도) — 벽(kind:'wall') 전용, 발밑 앵커를 축으로 기움 */
  skewYDeg?: number
  /** 벽면 좌우 반전(facing/wall 제외 로직과 무관한 별도 플래그) — 반대쪽 벽에 같은 스프라이트를 거울상으로 재사용할 때 */
  mirrorX?: boolean
  /** 바닥에서 띄워 그리는 높이(px) — 2층 회랑 위 소품 등 */
  elev?: number
  /** backdrop 레이어 안에서의 명시 순서(작을수록 먼저). 구조물(IsoStructGroup.back)과 같은 축 */
  backOrder?: number
  /** 방 뒤쪽 벽(북/서) 배경 레이어 — 항상 다른 오브젝트·플레이어보다 먼저(뒤에) 그린다. 긴 벽 조각의 깊이정렬 오류 방지 */
  backdrop?: boolean
  /** 벽면 회전각(도) — 벽돌 결 방향이 다른 벽(서벽 등)에 같은 텍스처를 재사용할 때 90도 돌려서 결을 맞춘다 */
  rotateDeg?: number
  /** 라벨(대형 구조물 위 표시, 선택) */
  label?: string
  /**
   * 앵커가 footprint 중심인가(원형 구조물: 분수·콜로세움·나무).
   * true 면 깊이정렬·충돌 모두 cell 을 중심으로 계산.
   * false/미지정이면 cell 은 footprint 의 뒤쪽(격자 원점측) 꼭짓점.
   */
  radial?: boolean
  /** 이동 불가 구조물인가. 충돌 사각형은 propAABB() 로 자동 산출 */
  solid?: boolean
  /** 충돌 footprint(셀) 오버라이드. 없으면 size 사용 (그림보다 살짝 작게 주고 싶을 때) */
  collide?: { w: number; d: number }
  // ── 라스터(PNG) 에셋 모드 (GameMap.assets === 'raster') ──
  /** 투명배경 PNG 경로 (public/ 기준). 있으면 SVG 스프라이트 대신 사용 */
  sprite?: string
  /** sprite 의 발밑 앵커 = 이미지 좌상단 기준 픽셀 오프셋 */
  anchor?: { x: number; y: number }
  /** sprite 원본 픽셀 크기 (없으면 자연 크기) */
  px?: { w: number; h: number }
}

/**
 * 프롭의 충돌 사각형(셀 좌표)을 footprint 로부터 산출.
 * radial → cell 중심 ±half, 아니면 cell 에서 +x/+y 방향으로 확장.
 * wall(facing:'left') 은 footprint 축이 뒤바뀌므로 보정.
 */
export function propAABB(
  p: PropDef,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const fp = p.collide ?? p.size
  if (!fp) return null
  let w = fp.w
  let d = fp.d
  if (p.kind === 'wall' && p.facing === 'left') {
    w = fp.d
    d = fp.w
  }
  if (p.radial) {
    return {
      x0: p.cell.x - w / 2,
      y0: p.cell.y - d / 2,
      x1: p.cell.x + w / 2,
      y1: p.cell.y + d / 2,
    }
  }
  return { x0: p.cell.x, y0: p.cell.y, x1: p.cell.x + w, y1: p.cell.y + d }
}


// ─────────────────────────────────────────────────────────────────────────────
// 아이소 구조물 — 벽·회랑 바닥판·계단 단·난간·기둥을 "투영된 평면"으로 정확히 그린다.
// 모든 면이 바닥 격자 축(x·y)과 평행하도록 코드로 투영하고, 표면은 PixelLab 평면 텍스처를 패턴으로 반복.
// (정면 스프라이트를 대충 세우는 대신 — 사용자 규칙: 벽은 맵 끝에 높게, 모든 것은 쿼터뷰 축 정합)
// ─────────────────────────────────────────────────────────────────────────────
/** 반복 텍스처 — w/h 는 원본 px, scale 은 화면 배율(기본 1.5) */
export interface IsoTex {
  src: string
  w: number
  h: number
  scale?: number
}
export type IsoPart =
  /** 수직면. plane 'y' = y 고정(북벽처럼 +y 쪽에서 보임, x 방향으로 뻗음), 'x' = x 고정(서벽처럼 +x 쪽에서 보임) */
  | {
      kind: 'face'
      plane: 'x' | 'y'
      at: number
      from: number
      to: number
      z0: number
      z1: number
      tex?: IsoTex
      /** 텍스처 대신 한 장 이미지를 면 전체에 붙임(문·창·배너 등) */
      img?: string
      /** 0~1 어둡게 — 측면 음영 */
      shade?: number
      fill?: string
      /** 면 전체 불투명도(그늘 오버레이 등) */
      opacity?: number
    }
  /** 수평면(윗면) — z 높이, 텍스처는 cells 셀마다 1회 반복, 또는 img 한 장을 영역에 펼침 */
  | { kind: 'top'; x0: number; y0: number; x1: number; y1: number; z: number; tex?: IsoTex & { cells?: number }; img?: string; shade?: number; fill?: string; opacity?: number }

export interface IsoStructGroup {
  id: string
  parts: IsoPart[]
  /** 지정 시 backdrop 레이어(항상 플레이어 뒤)에서의 순서. 없으면 sortY 로 깊이정렬 */
  back?: number
  sortY?: number
}

/** 직육면체 — 윗면 + 보이는 두 옆면(+y 면, +x 면) */
export function isoBox(
  x0: number, y0: number, x1: number, y1: number, z0: number, z1: number,
  opt: { top?: IsoTex & { cells?: number }; topFill?: string; side?: IsoTex; sideFill?: string; shadeY?: number; shadeX?: number } = {},
): IsoPart[] {
  return [
    { kind: 'face', plane: 'y', at: y1, from: x0, to: x1, z0, z1, tex: opt.side, fill: opt.sideFill, shade: opt.shadeY ?? 0.12 },
    { kind: 'face', plane: 'x', at: x1, from: y0, to: y1, z0, z1, tex: opt.side, fill: opt.sideFill, shade: opt.shadeX ?? 0.3 },
    { kind: 'top', x0, y0, x1, y1, z: z1, tex: opt.top, fill: opt.topFill },
  ]
}

/** 계단 — 이 사각형 안에서 플레이어가 y 에 따라 선형으로 올라간다(yBottom→yTop 에서 0→zTop) */
export interface IsoStair {
  x0: number
  x1: number
  yTop: number
  yBottom: number
  zTop: number
}
export function stairElevation(stairs: IsoStair[] | undefined, x: number, y: number): { z: number; stair: IsoStair | null } {
  for (const s of stairs ?? []) {
    if (x >= s.x0 && x <= s.x1 && y >= s.yTop && y <= s.yBottom) {
      return { z: (s.zTop * (s.yBottom - y)) / (s.yBottom - s.yTop), stair: s }
    }
  }
  return { z: 0, stair: null }
}
