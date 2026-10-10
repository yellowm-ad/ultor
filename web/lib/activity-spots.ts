// ============================================================================
// 마을 놀이 지점(2026-10-10) — 마을마다 변두리에 낚시터 하나, 안쪽에 미니게임 지점 하나.
// 가까이 가서 E(또는 누르기)로 바로 시작한다.
//   · fishing : 기존 낚시(components/game/fishing-overlay) 그대로 — 낚시터에서는 낚싯대를 빌려 주므로
//               해금 시기·낚싯대·물가 조건 없이 할 수 있다. 잡히는 물고기는 그 지역 표(lib/life FISH_TABLES).
//   · arcade  : 첫 이동 연출의 미니게임(lib/passages)을 연습으로 다시 한다 — 이기면 용돈.
// 지점 옆의 소품(낚시대·좌판 등)은 lib/town-decor 에 놓는다. 여기는 상호작용 자리만.
// ============================================================================

import type { MapId } from '@/lib/types'
import type { PassageId } from '@/lib/passages'

export interface ActivitySpot {
  id: string
  mapId: MapId
  cell: { x: number; y: number }
  kind: 'fishing' | 'arcade'
  /** arcade — 어떤 미니게임인가 */
  game?: PassageId
  /** 머리표 이름 */
  label: string
  /** E 안내 문구 */
  prompt: string
}

export const ACTIVITY_SPOTS: ActivitySpot[] = [
  // ── 낚시터(변두리) ──
  { id: 'fish-village', mapId: 'village', cell: { x: 33.6, y: 49.4 }, kind: 'fishing', label: '농가 연못 낚시터', prompt: '낚시하기 — 농가 연못' },
  { id: 'fish-aurora', mapId: 'aurora-village', cell: { x: 20.5, y: 50.8 }, kind: 'fishing', label: '얼음 낚시 구멍', prompt: '낚시하기 — 얼음 구멍' },
  { id: 'fish-demon', mapId: 'demon-village', cell: { x: 20.5, y: 50.8 }, kind: 'fishing', label: '용암 낚시터', prompt: '낚시하기 — 용암 웅덩이' },
  { id: 'fish-sky', mapId: 'sky-temple', cell: { x: 20.5, y: 50.8 }, kind: 'fishing', label: '구름 낚시터', prompt: '낚시하기 — 구름 가장자리' },
  { id: 'fish-ruin', mapId: 'temple-ruin', cell: { x: 9.8, y: 39 }, kind: 'fishing', label: '안개 연못', prompt: '낚시하기 — 안개 연못' },
  { id: 'fish-atlantis', mapId: 'atlantis', cell: { x: 50, y: 46 }, kind: 'fishing', label: '방파제 낚시터', prompt: '낚시하기 — 방파제' },
  // ── 미니게임 ──
  { id: 'arc-village', mapId: 'village', cell: { x: 40.4, y: 47.4 }, kind: 'arcade', game: 'spiral', label: '경비대 훈련장', prompt: '함정 계단 훈련 해 보기' },
  { id: 'arc-atlantis', mapId: 'atlantis', cell: { x: 20, y: 50 }, kind: 'arcade', game: 'voyage', label: '범선 체험장', prompt: '범선 타고 물고기 잡기' },
  { id: 'arc-ruin', mapId: 'temple-ruin', cell: { x: 46, y: 49.6 }, kind: 'arcade', game: 'maze', label: '순례자의 미로', prompt: '횃불 들고 미로 돌기' },
  { id: 'arc-aurora', mapId: 'aurora-village', cell: { x: 15.4, y: 42.6 }, kind: 'arcade', game: 'survival', label: '사냥꾼 캠프', prompt: '설원 생존 훈련 받기' },
  { id: 'arc-sky', mapId: 'sky-temple', cell: { x: 48.6, y: 19.6 }, kind: 'arcade', game: 'spiral', label: '바람 계단 시험', prompt: '바람 계단 시험 치르기' },
  { id: 'arc-demon', mapId: 'demon-village', cell: { x: 33.2, y: 30.4 }, kind: 'arcade', game: 'maze', label: '용암 동굴 담력 시험', prompt: '용암 동굴 미로 들어가기' },
]

const BY_ID = new Map(ACTIVITY_SPOTS.map((s) => [s.id, s]))
export const activitySpotById = (id: string) => BY_ID.get(id)
export const spotsOnMap = (mapId: MapId) => ACTIVITY_SPOTS.filter((s) => s.mapId === mapId)

/** 플레이어 가까이(1.6칸)의 놀이 지점 */
export function nearestSpot(mapId: MapId, pos: { x: number; y: number }): ActivitySpot | null {
  let best: ActivitySpot | null = null
  let bd = 1.6
  for (const s of ACTIVITY_SPOTS) {
    if (s.mapId !== mapId) continue
    const d = Math.hypot(s.cell.x - pos.x, s.cell.y - pos.y)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  return best
}

/** 미니게임 지점에서 이기면 받는 용돈 */
export const ARCADE_REWARD_GOLD = 20
