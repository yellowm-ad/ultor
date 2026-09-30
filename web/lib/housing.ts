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

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE_CATALOG.map((f) => [f.id, f]))
