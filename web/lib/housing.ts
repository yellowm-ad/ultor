// ============================================================================
// 개인 공간 가구 — 배치 시스템용 카탈로그.
//  · 2026-09-30 리마스터: 전부 PixelLab isometric 스프라이트(바닥 마름모 변과 평행 — 사용자 규칙).
//    iso:true 면 앵커를 footprint 중심으로 끌어올려 그린다(PNG 하단 = footprint 앞 꼭짓점).
//  · 벽에 붙는 가구는 정면 방향별 변형을 둔다: 기본 = 정면이 +y(화면 왼쪽 아래, 북벽에 붙임),
//    '-w' 변형 = 좌우반전해 정면이 +x(화면 오른쪽 아래, 서벽에 붙임).
//  · footprint(fw/fd)는 충돌 판정용 셀 크기.
// ============================================================================
import { spr, type Spr } from '@/lib/town-builder'

const D = '/images/map/dorm/'

export interface FurnitureDef {
  id: string
  label: string
  sprite: Spr
  /** 아이소 스프라이트 — 앵커를 footprint 중심으로 */
  iso?: boolean
  /** 좌우반전(반대 축 방향 변형) */
  flip?: boolean
  /** 제작 가구 — 이 아이템을 가진 개수만큼만 놓을 수 있다(없으면 기본 가구: 제한 없음) */
  itemId?: string
  /** 바닥에 깔리는 것(러그) — 밟고 지나가고, 다른 가구·사람 아래에 그린다 */
  flat?: boolean
}

const iso = (id: string, label: string, f: string, w: number, h: number, fw: number, fd: number, flip = false): FurnitureDef => ({
  id, label, sprite: spr(D + f, w, h, fw, fd), iso: true, flip,
})

export const FURNITURE_CATALOG: FurnitureDef[] = [
  iso('bed', '캐노피 침대', 'bed.png', 102, 112, 1.6, 1.1),
  iso('nightstand', '협탁(램프)', 'nightstand.png', 38, 47, 0.5, 0.5),
  iso('wardrobe', '옷장', 'wardrobe.png', 58, 119, 0.8, 0.5),
  iso('wardrobe-w', '옷장(서벽)', 'wardrobe.png', 58, 119, 0.5, 0.8, true),
  iso('weaponrack', '무기 거치대', 'weaponrack.png', 36, 85, 0.5, 0.5),
  iso('chest', '보물 상자', 'chest.png', 49, 50, 0.6, 0.45),
  iso('chest-w', '보물 상자(서벽)', 'chest.png', 49, 50, 0.45, 0.6, true),
  iso('desk', '서재 책상', 'desk.png', 66, 68, 1.1, 0.6),
  iso('fireplace', '벽난로', 'fireplace.png', 74, 88, 1.0, 0.6),
  iso('fireplace-w', '벽난로(서벽)', 'fireplace.png', 74, 88, 0.6, 1.0, true),
  iso('firewood', '장작더미', 'firewood.png', 44, 33, 0.5, 0.4),
  iso('boots', '여행자 부츠', 'boots.png', 28, 30, 0.3, 0.3),
  iso('table', '원형 테이블', 'table.png', 62, 68, 1.1, 1.1),
  iso('bookshelf', '책장', 'bookshelf.png', 56, 107, 0.8, 0.45),
  iso('bookshelf-w', '책장(서벽)', 'bookshelf.png', 56, 107, 0.45, 0.8, true),
  // 의자 — id 접미사 = 앉는 사람이 바라보는 방향(s=+y 화면 왼쪽아래, e=+x 오른쪽아래, n=-y 오른쪽위, w=-x 왼쪽위).
  // 앞모습(chair-front)·뒷모습(chair-back) 2장을 좌우반전해 4방향을 만든다.
  iso('chair-s', '나무 의자(남향)', 'chair-front.png', 28, 53, 0.5, 0.5),
  iso('chair-e', '나무 의자(동향)', 'chair-front.png', 28, 53, 0.5, 0.5, true),
  iso('chair-n', '나무 의자(북향)', 'chair-back.png', 33, 58, 0.5, 0.5),
  iso('chair-w', '나무 의자(서향)', 'chair-back.png', 33, 58, 0.5, 0.5, true),
]

// ── 제작 가구(2026-10-10) — 아카데미 실내 장식(props/academy/wb_*) 가운데 방에 둘 만한 것. ──
//    마도구 작업대에서 만들면 가방에 가구 아이템이 생기고, 가진 개수만큼 개인 공간에 놓을 수 있다.
//    재료: 'tag:…' = 그 종류 아무 재료(lib/life). footprint 는 그림 바닥 마름모에서 계산.
const A = '/images/map/props/academy/'
export interface CraftFurniture {
  id: string
  label: string
  file: string
  w: number
  h: number
  flat?: boolean
  ingredients: [itemId: string, qty: number][]
  desc: string
}
export const CRAFT_FURNITURE: CraftFurniture[] = [
  { id: 'armchair', label: '안락의자', file: 'wb_armchair', w: 49, h: 61, ingredients: [['tag:wood', 3], ['hunt-hide', 2]], desc: '푹 꺼지는 가죽 안락의자.' },
  { id: 'sofa', label: '회색 소파', file: 'wb_sofa_grey', w: 71, h: 67, ingredients: [['tag:wood', 4], ['hunt-hide', 3]], desc: '둘이 앉기 좋은 소파.' },
  { id: 'bench', label: '보라 벤치', file: 'wb_bench_purple', w: 76, h: 68, ingredients: [['tag:wood', 4], ['tag:flower', 2]], desc: '벨벳을 씌운 긴 의자.' },
  { id: 'teatable', label: '찻상', file: 'wb_teatable', w: 75, h: 54, ingredients: [['tag:wood', 3], ['tag:herb', 2]], desc: '찻주전자가 올라간 낮은 탁자.' },
  { id: 'table-tulip', label: '튤립 꽃병 탁자', file: 'wb_table_tulip', w: 54, h: 80, ingredients: [['tag:wood', 2], ['tag:flower', 3]], desc: '튤립을 꽂은 작은 원탁.' },
  { id: 'shelf-low', label: '낮은 책장', file: 'wb_shelf_low', w: 78, h: 73, ingredients: [['tag:wood', 5]], desc: '허리 높이의 책장.' },
  { id: 'book-stack', label: '책 더미', file: 'wb_book_stack', w: 32, h: 30, ingredients: [['tag:wood', 1], ['tag:herb', 1]], desc: '읽다 만 책을 쌓아 둔 더미.' },
  { id: 'lamp', label: '주황 스탠드', file: 'wb_lamp_orange', w: 24, h: 58, ingredients: [['tag:wood', 1], ['tag:crystal', 1]], desc: '따뜻한 빛의 스탠드.' },
  { id: 'candelabra', label: '촛대', file: 'wb_candelabra', w: 36, h: 88, ingredients: [['tag:ore', 2], ['tag:crystal', 1]], desc: '세 갈래 금빛 촛대.' },
  { id: 'clock', label: '괘종시계', file: 'wb_clock', w: 30, h: 90, ingredients: [['tag:wood', 3], ['tag:ore', 2]], desc: '똑딱이는 키 큰 시계.' },
  { id: 'globe', label: '지구본', file: 'wb_globe', w: 40, h: 56, ingredients: [['tag:wood', 2], ['tag:ore', 1]], desc: '에르디아 대륙이 그려진 지구본.' },
  { id: 'crystal-ball', label: '수정구', file: 'wb_crystal_ball', w: 32, h: 52, ingredients: [['tag:crystal', 3], ['tag:wood', 1]], desc: '들여다보면 안개가 도는 수정구.' },
  { id: 'telescope', label: '망원경', file: 'wb_telescope', w: 70, h: 72, ingredients: [['tag:ore', 3], ['tag:crystal', 2]], desc: '별을 보는 놋쇠 망원경.' },
  { id: 'easel', label: '이젤', file: 'wb_easel', w: 24, h: 46, ingredients: [['tag:wood', 2], ['tag:flower', 1]], desc: '그리다 만 그림이 걸린 이젤.' },
  { id: 'fern', label: '고사리 화분', file: 'wb_potted_fern', w: 34, h: 50, ingredients: [['tag:herb', 3]], desc: '손이 덜 가는 고사리 화분.' },
  { id: 'palm', label: '야자 화분', file: 'wb_potted_palm', w: 58, h: 76, ingredients: [['tag:herb', 3], ['tag:wood', 2]], desc: '잎이 넓은 실내 야자.' },
  { id: 'radiator', label: '난방기', file: 'wb_radiator', w: 54, h: 60, ingredients: [['tag:ore', 4]], desc: '겨울 방학의 친구.' },
  { id: 'piano', label: '피아노', file: 'wb_piano', w: 88, h: 114, ingredients: [['tag:wood', 8], ['tag:ore', 3], ['hunt-hide', 1]], desc: '방 한쪽을 차지하는 업라이트 피아노.' },
  { id: 'rug-red', label: '붉은 러그', file: 'wb_rug_red', w: 95, h: 62, flat: true, ingredients: [['hunt-hide', 3], ['tag:flower', 2]], desc: '바닥에 까는 붉은 러그.' },
  { id: 'rug-round', label: '둥근 러그', file: 'wb_rug_round', w: 107, h: 54, flat: true, ingredients: [['hunt-hide', 3], ['tag:herb', 2]], desc: '바닥에 까는 둥근 러그.' },
]
/** 제작 가구의 아이템 id(가방·레시피) */
export const craftFurnitureItemId = (id: string) => `furn-wb-${id}`
for (const c of CRAFT_FURNITURE) {
  // 그림 바닥 마름모(폭 = 그림 폭)의 반높이만큼 앵커를 올린다 — 러그는 그림 한가운데
  const fp = Math.round(((c.flat ? c.h : Math.min(c.h, c.w / 2)) / 32) * 100) / 100
  FURNITURE_CATALOG.push({ id: `wb-${c.id}`, label: c.label, sprite: spr(`${A}${c.file}.png`, c.w, c.h, fp, fp), iso: true, itemId: craftFurnitureItemId(c.id), flat: c.flat })
}

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE_CATALOG.map((f) => [f.id, f]))
