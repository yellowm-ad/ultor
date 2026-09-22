// ============================================================================
// 개인 공간 가구 — 배치 시스템용 카탈로그.
//  · 앵커 규칙은 town-builder 와 동일: PNG 하단 중앙 = cell, footprint(fw/fd)는
//    바닥에 깔리는 칸 크기(충돌 판정용)로 사람이 직접 잡음(픽셀 크기 자동환산 아님).
// ============================================================================
import { spr, type Spr } from '@/lib/town-builder'

const H = '/images/map/props/housing/'

export interface FurnitureDef {
  id: string
  label: string
  sprite: Spr
}

export const FURNITURE_CATALOG: FurnitureDef[] = [
  { id: 'bed', label: '침대', sprite: spr(H + 'bed.png', 78, 84, 1.1, 1.7) },
  { id: 'nightstand', label: '협탁(램프)', sprite: spr(H + 'nightstand.png', 27, 39, 0.45, 0.45) },
  { id: 'wardrobe', label: '옷장', sprite: spr(H + 'wardrobe.png', 56, 98, 0.7, 0.5) },
  { id: 'weaponrack', label: '무기 거치대', sprite: spr(H + 'weaponrack.png', 36, 80, 0.4, 0.4) },
  { id: 'chest', label: '보물 상자', sprite: spr(H + 'chest.png', 42, 34, 0.55, 0.45) },
  { id: 'desk', label: '서재 책상', sprite: spr(H + 'desk.png', 78, 72, 1.0, 0.6) },
  { id: 'fireplace', label: '벽난로', sprite: spr(H + 'fireplace.png', 30, 38, 0.45, 0.35) },
  { id: 'firewood', label: '장작더미', sprite: spr(H + 'firewood.png', 34, 30, 0.45, 0.35) },
  { id: 'boots', label: '여행자 부츠', sprite: spr(H + 'boots.png', 23, 26, 0.3, 0.25) },
  { id: 'table', label: '원형 테이블', sprite: spr(H + 'table.png', 88, 64, 1.3, 0.9) },
  { id: 'bookshelf', label: '책장', sprite: spr(H + 'bookshelf.png', 56, 100, 0.7, 0.5) },
  // 의자 — 8방향 생성분 중 4방향(남/북/동/서)만 사용. id 뒤 접미사가 "의자가 향하는 화면 방향"
  // (= 앉는 사람이 바라보는 쪽). 테이블/책상 자리마다 그 반대편에서 마주보도록 골라 배치한다.
  { id: 'chair-s', label: '나무 의자(남향)', sprite: spr(H + 'chair-s.png', 56, 56, 0.5, 0.5) },
  { id: 'chair-n', label: '나무 의자(북향)', sprite: spr(H + 'chair-n.png', 56, 56, 0.5, 0.5) },
  { id: 'chair-e', label: '나무 의자(동향)', sprite: spr(H + 'chair-e.png', 56, 56, 0.5, 0.5) },
  { id: 'chair-w', label: '나무 의자(서향)', sprite: spr(H + 'chair-w.png', 56, 56, 0.5, 0.5) },
]

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE_CATALOG.map((f) => [f.id, f]))
