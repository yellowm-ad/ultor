// ============================================================================
// 아이소메트릭 투영 + 맵 데이터 타입
//  - 게임플레이 좌표는 기존과 동일한 셀(x,y). 렌더만 2:1 다이메트릭으로 투영.
//  - 오브젝트(건물/나무/캐릭터)는 화면 y 기준 깊이정렬 → 뒤 물체는 앞 물체에 가려짐.
// ============================================================================

export const ISO_TILE_W = 64
export const ISO_TILE_H = 32 // 2:1

/** 셀 좌표 → 아이소 화면 좌표(px). 원점은 격자 (0,0) 타일의 위쪽 꼭짓점. */
export function isoToScreen(cx: number, cy: number): { sx: number; sy: number } {
  return {
    sx: (cx - cy) * (ISO_TILE_W / 2),
    sy: (cx + cy) * (ISO_TILE_H / 2),
  }
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
  | 'atlantis-cathedral' // 아틀란티스 대성당 내부 — 픽셀랩 생성 + plaza 마스크로 정합(scripts/mask-fit-tile.mjs)

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
  'atlantis-cathedral': '/images/map/tiles/atlantis-cathedral.png',
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
  'atlantis-cathedral': { top: '#1f5c52', edge: '#123a34' },
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
